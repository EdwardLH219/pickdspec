/**
 * API Route: Issue Receipt Token for POS Integration
 * 
 * Option A: Server-side token generation
 * Called by POS system at receipt print time to generate a unique,
 * single-use token for the QR code.
 * 
 * POST /api/branches/{branchId}/till/issue-receipt
 * 
 * Authentication:
 * - API key: Authorization: Bearer {api_key}
 * - Or restaurant_admin session (for testing via portal)
 * 
 * @example
 * ```bash
 * curl -X POST https://app.pickd.co/api/branches/tenant_123/till/issue-receipt \
 *   -H "Authorization: Bearer pk_live_abc123" \
 *   -H "Content-Type: application/json" \
 *   -d '{"receiptRef": "INV-001234", "issuedAt": "2026-01-27T12:30:00Z"}'
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { db } from '@/server/db';
import { mintReceiptToken, buildFeedbackUrl } from '@/server/till-slip';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';

// ============================================================
// TYPES
// ============================================================

interface IssueReceiptRequest {
  /** Receipt reference from POS (e.g., invoice number) */
  receiptRef: string;
  /** When the receipt was issued */
  issuedAt?: string;
  /** Optional metadata (table number, covers, etc.) */
  meta?: Record<string, unknown>;
}

interface IssueReceiptResponse {
  success: boolean;
  /** The secure token for the QR code URL */
  token?: string;
  /** Full URL to embed in QR code */
  qrUrl?: string;
  /** When the token expires */
  expiresAt?: string;
  /** Database record ID for tracking */
  receiptId?: string;
  /** Error information */
  error?: string;
  errorCode?: string;
}

// ============================================================
// AUTHENTICATION
// ============================================================

/**
 * Validate API key and return associated branch ID
 */
async function validateApiKey(
  apiKey: string, 
  branchId: string
): Promise<{ valid: boolean; error?: string }> {
  // API keys are prefixed with pk_live_ or pk_test_
  if (!apiKey.startsWith('pk_')) {
    return { valid: false, error: 'Invalid API key format' };
  }

  // Hash the API key to look up
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  // Look up the API key
  const apiKeyRecord = await db.apiKey.findFirst({
    where: {
      keyHash,
      tenantId: branchId,
      isActive: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    include: {
      tenant: {
        select: { id: true },
      },
    },
  });

  if (!apiKeyRecord) {
    return { valid: false, error: 'Invalid or expired API key' };
  }

  // Check permissions
  const permissions = apiKeyRecord.permissions as string[] || [];
  if (!permissions.includes('till:issue') && !permissions.includes('*')) {
    return { valid: false, error: 'API key does not have till:issue permission' };
  }

  // Update last used timestamp
  await db.apiKey.update({
    where: { id: apiKeyRecord.id },
    data: { lastUsedAt: new Date() },
  });

  return { valid: true };
}

/**
 * Check if user has admin access to branch via session
 */
async function checkSessionAccess(
  userId: string,
  branchId: string
): Promise<boolean> {
  // Get user's organization memberships
  const memberships = await db.membership.findMany({
    where: {
      userId,
      isActive: true,
      role: { in: ['OWNER', 'ADMIN', 'MANAGER'] },
    },
    select: { organizationId: true },
  });

  if (memberships.length === 0) {
    return false;
  }

  // Check if branch belongs to one of user's organizations
  const tenant = await db.tenant.findFirst({
    where: {
      id: branchId,
      organizationId: { in: memberships.map(m => m.organizationId) },
    },
  });

  return !!tenant;
}

// ============================================================
// RATE LIMITING
// ============================================================

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, limit: number = 100, windowMs: number = 60000): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count++;
  return true;
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

// ============================================================
// POST HANDLER
// ============================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ branchId: string }> }
): Promise<NextResponse<IssueReceiptResponse>> {
  try {
    const { branchId } = await params;

    // ============================================================
    // AUTHENTICATION
    // ============================================================

    const authHeader = request.headers.get('authorization');
    let authenticated = false;
    let authMethod = '';

    // Try API key authentication first
    if (authHeader?.startsWith('Bearer pk_')) {
      const apiKey = authHeader.replace('Bearer ', '');
      const keyResult = await validateApiKey(apiKey, branchId);
      
      if (!keyResult.valid) {
        return NextResponse.json({
          success: false,
          error: keyResult.error,
          errorCode: 'INVALID_API_KEY',
        }, { status: 401 });
      }
      
      authenticated = true;
      authMethod = 'api_key';
    }

    // Try session authentication as fallback
    if (!authenticated) {
      const session = await auth();
      
      if (session?.user) {
        const hasAccess = await checkSessionAccess(session.user.id, branchId);
        if (hasAccess) {
          authenticated = true;
          authMethod = 'session';
        }
      }
    }

    if (!authenticated) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized - provide API key or login as restaurant admin',
        errorCode: 'UNAUTHORIZED',
      }, { status: 401 });
    }

    // ============================================================
    // RATE LIMITING
    // ============================================================

    const rateLimitKey = `issue:${branchId}`;
    if (!checkRateLimit(rateLimitKey)) {
      return NextResponse.json({
        success: false,
        error: 'Rate limit exceeded. Maximum 100 requests per minute.',
        errorCode: 'RATE_LIMITED',
      }, { status: 429, headers: { 'Retry-After': '60' } });
    }

    // ============================================================
    // VALIDATE REQUEST
    // ============================================================

    const body: IssueReceiptRequest = await request.json();

    if (!body.receiptRef || typeof body.receiptRef !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'receiptRef is required and must be a string',
        errorCode: 'INVALID_REQUEST',
      }, { status: 400 });
    }

    // Sanitize receipt ref (remove whitespace, limit length)
    const receiptRef = body.receiptRef.trim().slice(0, 100);
    
    if (receiptRef.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'receiptRef cannot be empty',
        errorCode: 'INVALID_REQUEST',
      }, { status: 400 });
    }

    // Parse issuedAt or use current time
    let issuedAt = new Date();
    if (body.issuedAt) {
      const parsed = new Date(body.issuedAt);
      if (!isNaN(parsed.getTime())) {
        issuedAt = parsed;
      }
    }

    // ============================================================
    // VERIFY BRANCH
    // ============================================================

    const tenant = await db.tenant.findUnique({
      where: { id: branchId },
      select: { id: true, name: true },
    });

    if (!tenant) {
      return NextResponse.json({
        success: false,
        error: 'Branch not found',
        errorCode: 'INVALID_BRANCH',
      }, { status: 404 });
    }

    // ============================================================
    // MINT TOKEN
    // ============================================================

    try {
      const result = await mintReceiptToken(branchId, {
        receiptRef,
        meta: body.meta as Prisma.InputJsonValue,
      });

      // Log successful issuance
      console.log(`[Till Issue] Branch ${branchId}: Receipt ${receiptRef.slice(-4)} issued via ${authMethod}`);

      return NextResponse.json({
        success: true,
        token: result.token,
        qrUrl: buildFeedbackUrl(result.token, 'receipt'),
        expiresAt: result.expiresAt.toISOString(),
        receiptId: result.receiptId,
      });
    } catch (mintError) {
      const errorMessage = mintError instanceof Error ? mintError.message : 'Failed to mint token';
      
      // Determine error code
      let errorCode = 'MINT_FAILED';
      if (errorMessage.includes('already been used')) {
        errorCode = 'DUPLICATE_RECEIPT';
      } else if (errorMessage.includes('not found')) {
        errorCode = 'CHANNEL_INACTIVE';
      } else if (errorMessage.includes('not active')) {
        errorCode = 'CHANNEL_INACTIVE';
      }

      return NextResponse.json({
        success: false,
        error: errorMessage,
        errorCode,
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Error issuing receipt:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      errorCode: 'INTERNAL_ERROR',
    }, { status: 500 });
  }
}

// ============================================================
// GET HANDLER - Health check
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ branchId: string }> }
): Promise<NextResponse> {
  try {
    const { branchId } = await params;

    // Check if branch exists and channel is active
    const settings = await db.tillReviewSettings.findUnique({
      where: { tenantId: branchId },
      select: { isActive: true },
    });

    if (!settings) {
      return NextResponse.json({
        status: 'not_configured',
        message: 'Till slip channel not configured for this branch',
      });
    }

    return NextResponse.json({
      status: settings.isActive ? 'active' : 'inactive',
      endpoint: '/api/branches/{branchId}/till/issue-receipt',
      method: 'POST',
      authentication: ['Bearer API key', 'Session cookie'],
    });
  } catch (error) {
    console.error('Error checking status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
