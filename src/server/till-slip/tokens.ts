/**
 * Till Slip Receipt Token Service
 * 
 * Provides secure token generation and verification for QR code-based
 * customer feedback collection. Tokens are:
 * - Opaque and URL-safe (no sensitive data exposed)
 * - Single-use (cannot be reused after submission)
 * - Time-limited (configurable expiry, default from settings)
 * - Cryptographically secure
 * 
 * URL Format: https://app.pickd.co/r/{token}
 * Optional query params: ?utm_source=receipt (no sensitive fields allowed)
 */

import crypto from 'crypto';
import { db } from '@/server/db';
import { TillReceiptStatus, Prisma } from '@prisma/client';

// ============================================================
// TYPES
// ============================================================

export interface MintTokenResult {
  /** URL-safe token for QR code / URL */
  token: string;
  /** SHA-256 hash stored in database */
  tokenHash: string;
  /** Full URL for the feedback page */
  feedbackUrl: string;
  /** When the token expires */
  expiresAt: Date;
  /** Database record ID */
  receiptId: string;
}

export interface VerifyTokenResult {
  /** Whether the token is valid */
  valid: boolean;
  /** Error message if invalid */
  error?: 'TOKEN_NOT_FOUND' | 'TOKEN_EXPIRED' | 'TOKEN_ALREADY_USED' | 'CHANNEL_INACTIVE';
  /** Receipt record if valid */
  receipt?: {
    id: string;
    tenantId: string;
    settingsId: string;
    receiptRef: string | null;
    status: TillReceiptStatus;
    issuedAt: Date;
    expiresAt: Date;
    meta: Record<string, unknown> | null;
  };
  /** Settings for the feedback channel */
  settings?: {
    id: string;
    tenantId: string;
    shortCode: string;
    isActive: boolean;
    incentiveType: string;
    incentiveTitle: string | null;
    incentiveDescription: string | null;
    discountPercent: number | null;
    discountTerms: string | null;
    prizeDrawTitle: string | null;
    prizeDrawDescription: string | null;
    prizeDrawTerms: string | null;
    headerColor: string | null;
    accentColor: string | null;
    logoUrl: string | null;
    tokenExpiryDays: number;
    requireReceiptNumber: boolean;
    redirectToGoogleReview: boolean;
    googleReviewUrl: string | null;
    themeOptions: string[] | null;
  };
  /** Tenant name for display */
  tenantName?: string;
}

export interface MintTokenOptions {
  /** Receipt reference from POS (optional) */
  receiptRef?: string;
  /** Custom expiry in days (overrides settings) */
  expiryDays?: number;
  /** Additional metadata (must be JSON-serializable) */
  meta?: Prisma.InputJsonValue;
}

// ============================================================
// CONSTANTS
// ============================================================

/** Length of the generated token in bytes (before base64url encoding) */
const TOKEN_BYTE_LENGTH = 18; // Results in 24-char base64url string

/** Default token expiry if not configured */
const DEFAULT_EXPIRY_DAYS = 7;

/** Get base URL for feedback pages (read at call time, not module load) */
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://picktenterprise.vercel.app';
}

// ============================================================
// TOKEN GENERATION
// ============================================================

/**
 * Generate a cryptographically secure, URL-safe token
 * 
 * Uses crypto.randomBytes for security, encoded as base64url
 * to ensure URL safety without encoding issues.
 */
export function generateSecureToken(): string {
  const bytes = crypto.randomBytes(TOKEN_BYTE_LENGTH);
  // base64url encoding: URL-safe, no padding
  return bytes.toString('base64url');
}

/**
 * Compute SHA-256 hash of a token for storage
 * 
 * We store the hash rather than the raw token to prevent
 * exposure if the database is compromised.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Hash a receipt reference with tenant salt for duplicate detection
 * 
 * This allows checking for duplicate receipts without storing
 * the raw receipt number (which might be sensitive).
 */
export function hashReceiptRef(receiptRef: string, tenantId: string): string {
  const salt = `${tenantId}:receipt:${process.env.RECEIPT_HASH_SECRET || 'pickd-salt'}`;
  return crypto.createHash('sha256').update(`${salt}:${receiptRef}`).digest('hex');
}

/**
 * Extract last 4 characters of receipt ref for display
 */
export function getReceiptLastFour(receiptRef: string): string {
  if (receiptRef.length <= 4) return receiptRef;
  return receiptRef.slice(-4);
}

/**
 * Build the feedback URL for a token
 */
export function buildFeedbackUrl(token: string, utmSource?: string): string {
  const url = new URL(`/r/${token}`, getBaseUrl());
  if (utmSource) {
    url.searchParams.set('utm_source', utmSource);
  }
  return url.toString();
}

// ============================================================
// MINT TOKEN
// ============================================================

/**
 * Mint a new receipt token for QR code generation
 * 
 * Creates a secure, single-use token that can be embedded in a QR code
 * and used by customers to submit feedback.
 * 
 * @param tenantId - The tenant/branch ID
 * @param options - Optional configuration (receipt ref, expiry, metadata)
 * @returns Token details including URL and database record ID
 * 
 * @example
 * ```ts
 * const result = await mintReceiptToken('tenant-001', {
 *   receiptRef: 'INV-2026-001234',
 *   meta: { tableNumber: 'T12', covers: 4 }
 * });
 * // Generate QR code from result.feedbackUrl
 * ```
 */
export async function mintReceiptToken(
  tenantId: string,
  options: MintTokenOptions = {}
): Promise<MintTokenResult> {
  // Fetch settings for this tenant
  const settings = await db.tillReviewSettings.findUnique({
    where: { tenantId },
  });

  if (!settings) {
    throw new Error(`Till slip settings not found for tenant ${tenantId}`);
  }

  if (!settings.isActive) {
    throw new Error(`Till slip channel is not active for tenant ${tenantId}`);
  }

  // Check for duplicate receipt if receiptRef provided
  if (options.receiptRef) {
    const receiptRefHash = hashReceiptRef(options.receiptRef, tenantId);
    
    const existingReceipt = await db.tillReceipt.findFirst({
      where: {
        tenantId,
        receiptRefHash,
        status: { not: 'EXPIRED' }, // Allow reuse of expired receipts
      },
    });

    if (existingReceipt) {
      throw new Error(`Receipt ${options.receiptRef} has already been used`);
    }
  }

  // Generate secure token
  const token = generateSecureToken();
  const tokenHash = hashToken(token);

  // Calculate expiry
  const expiryDays = options.expiryDays ?? settings.tokenExpiryDays ?? DEFAULT_EXPIRY_DAYS;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiryDays);

  // Prepare receipt ref fields
  const receiptRefHash = options.receiptRef 
    ? hashReceiptRef(options.receiptRef, tenantId) 
    : null;
  const receiptLastFour = options.receiptRef 
    ? getReceiptLastFour(options.receiptRef) 
    : null;

  // Create receipt record
  const receipt = await db.tillReceipt.create({
    data: {
      tenantId,
      settingsId: settings.id,
      receiptRef: options.receiptRef ?? null,
      receiptRefHash,
      receiptLastFour,
      token,
      tokenHash,
      status: 'ISSUED',
      issuedAt: new Date(),
      expiresAt,
      meta: options.meta ?? Prisma.JsonNull,
    },
  });

  return {
    token,
    tokenHash,
    feedbackUrl: buildFeedbackUrl(token, 'receipt'),
    expiresAt,
    receiptId: receipt.id,
  };
}

// ============================================================
// VERIFY TOKEN
// ============================================================

/**
 * Verify a receipt token and return the associated receipt
 * 
 * Checks:
 * 1. Token exists in database
 * 2. Token has not expired
 * 3. Token has not already been used (submitted)
 * 4. Channel is still active
 * 
 * @param token - The token from the URL
 * @returns Verification result with receipt data or error
 * 
 * @example
 * ```ts
 * const result = await verifyReceiptToken('abc123xyz...');
 * if (result.valid) {
 *   // Show feedback form
 *   console.log(result.receipt, result.settings);
 * } else {
 *   // Show error: result.error
 * }
 * ```
 */
export async function verifyReceiptToken(token: string): Promise<VerifyTokenResult> {
  // Hash the token to look up in database
  const tokenHash = hashToken(token);

  // Find the receipt by token hash
  const receipt = await db.tillReceipt.findUnique({
    where: { tokenHash },
    include: {
      settings: true,
      tenant: {
        select: { name: true },
      },
    },
  });

  // Token not found
  if (!receipt) {
    return {
      valid: false,
      error: 'TOKEN_NOT_FOUND',
    };
  }

  // Check if channel is active
  if (!receipt.settings.isActive) {
    return {
      valid: false,
      error: 'CHANNEL_INACTIVE',
    };
  }

  // Check expiry
  if (new Date() > receipt.expiresAt) {
    // Mark as expired if not already
    if (receipt.status === 'ISSUED') {
      await db.tillReceipt.update({
        where: { id: receipt.id },
        data: { status: 'EXPIRED' },
      });
    }
    return {
      valid: false,
      error: 'TOKEN_EXPIRED',
    };
  }

  // Check if already used (submitted or redeemed)
  if (receipt.status !== 'ISSUED') {
    return {
      valid: false,
      error: 'TOKEN_ALREADY_USED',
    };
  }

  // Parse theme options from JSON
  let themeOptions: string[] | null = null;
  if (receipt.settings.themeOptions) {
    try {
      themeOptions = receipt.settings.themeOptions as string[];
    } catch {
      themeOptions = null;
    }
  }

  // Token is valid
  return {
    valid: true,
    receipt: {
      id: receipt.id,
      tenantId: receipt.tenantId,
      settingsId: receipt.settingsId,
      receiptRef: receipt.receiptRef,
      status: receipt.status,
      issuedAt: receipt.issuedAt,
      expiresAt: receipt.expiresAt,
      meta: receipt.meta as Record<string, unknown> | null,
    },
    settings: {
      id: receipt.settings.id,
      tenantId: receipt.settings.tenantId,
      shortCode: receipt.settings.shortCode,
      isActive: receipt.settings.isActive,
      incentiveType: receipt.settings.incentiveType,
      incentiveTitle: receipt.settings.incentiveTitle,
      incentiveDescription: receipt.settings.incentiveDescription,
      discountPercent: receipt.settings.discountPercent,
      discountTerms: receipt.settings.discountTerms,
      prizeDrawTitle: receipt.settings.prizeDrawTitle,
      prizeDrawDescription: receipt.settings.prizeDrawDescription,
      prizeDrawTerms: receipt.settings.prizeDrawTerms,
      headerColor: receipt.settings.headerColor,
      accentColor: receipt.settings.accentColor,
      logoUrl: receipt.settings.logoUrl,
      requireReceiptNumber: receipt.settings.requireReceiptNumber,
      redirectToGoogleReview: receipt.settings.redirectToGoogleReview,
      googleReviewUrl: receipt.settings.googleReviewUrl,
      tokenExpiryDays: receipt.settings.tokenExpiryDays,
      themeOptions,
    },
    tenantName: receipt.tenant.name,
  };
}

// ============================================================
// MARK TOKEN AS USED
// ============================================================

/**
 * Mark a token as submitted (used) after feedback is recorded
 * 
 * This prevents replay attacks - once submitted, the token
 * cannot be used again.
 * 
 * @param receiptId - The receipt record ID
 * @returns Updated receipt record
 */
export async function markTokenAsSubmitted(receiptId: string): Promise<void> {
  await db.tillReceipt.update({
    where: { id: receiptId },
    data: { status: 'SUBMITTED' },
  });
}

/**
 * Mark a token as redeemed (incentive code used)
 * 
 * @param receiptId - The receipt record ID
 * @param redeemedBy - User ID of staff who redeemed (optional)
 */
export async function markTokenAsRedeemed(
  receiptId: string,
  redeemedBy?: string
): Promise<void> {
  await db.tillReceipt.update({
    where: { id: receiptId },
    data: { status: 'REDEEMED' },
  });

  // Also update the submission if it exists
  const submission = await db.tillReviewSubmission.findUnique({
    where: { receiptId },
  });

  if (submission) {
    await db.tillReviewSubmission.update({
      where: { id: submission.id },
      data: {
        incentiveRedeemed: true,
        incentiveRedeemedAt: new Date(),
        incentiveRedeemedBy: redeemedBy ?? null,
      },
    });
  }
}

// ============================================================
// BATCH OPERATIONS
// ============================================================

/**
 * Expire old tokens that have passed their expiry date
 * 
 * Should be run periodically (e.g., daily cron job) to clean up
 * expired tokens and update their status.
 * 
 * @returns Number of tokens expired
 */
export async function expireOldTokens(): Promise<number> {
  const result = await db.tillReceipt.updateMany({
    where: {
      status: 'ISSUED',
      expiresAt: { lt: new Date() },
    },
    data: { status: 'EXPIRED' },
  });

  return result.count;
}

/**
 * Generate a batch of tokens for pre-printing
 * 
 * Useful for restaurants that want to pre-print QR codes
 * on receipts without real-time token generation.
 * 
 * @param tenantId - The tenant/branch ID
 * @param count - Number of tokens to generate
 * @param expiryDays - Custom expiry (optional)
 * @returns Array of token results
 */
export async function mintTokenBatch(
  tenantId: string,
  count: number,
  expiryDays?: number
): Promise<MintTokenResult[]> {
  const results: MintTokenResult[] = [];

  for (let i = 0; i < count; i++) {
    const result = await mintReceiptToken(tenantId, { expiryDays });
    results.push(result);
  }

  return results;
}

// ============================================================
// URL VALIDATION
// ============================================================

/**
 * Validate that a feedback URL only contains allowed parameters
 * 
 * Allowed: utm_source, utm_medium, utm_campaign (marketing tracking)
 * Blocked: Any parameter that could contain sensitive data
 */
export function validateFeedbackUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    
    // Check path format
    const pathMatch = parsed.pathname.match(/^\/r\/([A-Za-z0-9_-]+)$/);
    if (!pathMatch) {
      return { valid: false, error: 'Invalid URL path format' };
    }

    // Allowed query parameters (marketing tracking only)
    const allowedParams = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']);
    
    for (const [key] of parsed.searchParams) {
      if (!allowedParams.has(key)) {
        return { valid: false, error: `Disallowed query parameter: ${key}` };
      }
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Extract token from a feedback URL
 */
export function extractTokenFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const pathMatch = parsed.pathname.match(/^\/r\/([A-Za-z0-9_-]+)$/);
    return pathMatch ? pathMatch[1] : null;
  } catch {
    return null;
  }
}
