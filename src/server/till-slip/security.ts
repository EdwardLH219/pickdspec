/**
 * Till Slip Security Utilities
 * 
 * Provides security functions for the Till Slip feedback channel:
 * - XSS sanitization for free text fields
 * - Input validation and sanitization
 * - Audit logging for security-relevant events
 * 
 * @module till-slip/security
 */

import { db } from '@/server/db';
import { Prisma } from '@prisma/client';

// ============================================================
// XSS SANITIZATION
// ============================================================

/**
 * HTML entities to escape for XSS prevention
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Dangerous patterns to strip from input
 */
const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // Script tags
  /javascript:/gi, // JavaScript protocol
  /on\w+\s*=/gi, // Event handlers (onclick, onerror, etc.)
  /data:/gi, // Data URLs (can contain scripts)
  /vbscript:/gi, // VBScript protocol
  /expression\s*\(/gi, // CSS expressions
  /url\s*\(/gi, // CSS url() - can be dangerous
];

/**
 * Sanitize a string to prevent XSS attacks
 * 
 * This function:
 * 1. Strips dangerous HTML/JS patterns
 * 2. Escapes HTML entities
 * 3. Removes null bytes and other dangerous characters
 * 4. Trims and normalizes whitespace
 * 
 * @param input - Raw user input
 * @param options - Sanitization options
 * @returns Sanitized string safe for storage and display
 * 
 * @example
 * ```ts
 * const safe = sanitizeText('<script>alert("xss")</script>Hello');
 * // Returns: "Hello"
 * 
 * const safe2 = sanitizeText('Great food & service!');
 * // Returns: "Great food &amp; service!"
 * ```
 */
export function sanitizeText(
  input: string | null | undefined,
  options: {
    maxLength?: number;
    allowNewlines?: boolean;
    escapeHtml?: boolean;
  } = {}
): string {
  if (input === null || input === undefined) {
    return '';
  }

  const { maxLength = 5000, allowNewlines = true, escapeHtml = true } = options;

  let sanitized = input;

  // 1. Remove null bytes and control characters (except newline/tab if allowed)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // 2. Strip dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // 3. Remove HTML tags entirely (we don't allow any HTML)
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // 4. Escape HTML entities if requested (for safe storage)
  if (escapeHtml) {
    sanitized = sanitized.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
  }

  // 5. Handle newlines
  if (!allowNewlines) {
    sanitized = sanitized.replace(/[\r\n]/g, ' ');
  } else {
    // Normalize line endings
    sanitized = sanitized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // Limit consecutive newlines
    sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
  }

  // 6. Normalize whitespace
  sanitized = sanitized.replace(/[ \t]+/g, ' ');
  
  // 7. Trim
  sanitized = sanitized.trim();

  // 8. Enforce max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }

  return sanitized;
}

/**
 * Sanitize an array of theme strings
 * 
 * Validates that themes are from allowed list and sanitizes any custom themes
 * 
 * @param themes - Array of theme strings from user
 * @param allowedThemes - List of valid theme options
 * @returns Sanitized array of valid themes
 */
export function sanitizeThemes(
  themes: string[] | null | undefined,
  allowedThemes: string[]
): string[] {
  if (!themes || !Array.isArray(themes)) {
    return [];
  }

  const allowedSet = new Set(allowedThemes.map(t => t.toLowerCase()));
  
  return themes
    .filter(theme => typeof theme === 'string')
    .map(theme => theme.trim())
    .filter(theme => theme.length > 0 && theme.length <= 100)
    .filter(theme => allowedSet.has(theme.toLowerCase()))
    .slice(0, 20); // Max 20 themes
}

/**
 * Validate and sanitize a rating value
 * 
 * @param rating - Rating from user input
 * @returns Valid rating between 1-5, or null if invalid
 */
export function sanitizeRating(rating: unknown): number | null {
  if (typeof rating !== 'number') {
    const parsed = parseInt(String(rating), 10);
    if (isNaN(parsed)) return null;
    rating = parsed;
  }
  
  const num = rating as number;
  if (num < 1 || num > 5 || !Number.isInteger(num)) {
    return null;
  }
  
  return num;
}

// ============================================================
// AUDIT LOGGING
// ============================================================

/**
 * Audit event types for Till Slip
 */
export type TillSlipAuditEvent = 
  | 'TILL_SETTINGS_CREATED'
  | 'TILL_SETTINGS_UPDATED'
  | 'TILL_SETTINGS_ENABLED'
  | 'TILL_SETTINGS_DISABLED'
  | 'TILL_INCENTIVE_CHANGED'
  | 'TILL_TOKEN_EXPIRY_CHANGED'
  | 'TILL_CODE_REDEEMED'
  | 'TILL_SUBMISSION_FLAGGED'
  | 'TILL_SUBMISSION_APPROVED'
  | 'TILL_SUBMISSION_REJECTED'
  | 'TILL_API_KEY_CREATED'
  | 'TILL_API_KEY_REVOKED'
  | 'TILL_RECEIPT_ISSUED'
  | 'TILL_BATCH_ISSUED';

/**
 * Audit log entry for Till Slip events
 */
export interface TillSlipAuditEntry {
  event: TillSlipAuditEvent;
  actorId: string;
  actorEmail?: string;
  tenantId: string;
  resourceId?: string;
  resourceType?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Log an audit event for Till Slip operations
 * 
 * Creates an audit trail for security-relevant events like:
 * - Settings changes
 * - Incentive redemptions
 * - Submission moderation
 * - API key management
 * 
 * @param entry - Audit log entry
 * @returns Created audit log record ID
 * 
 * @example
 * ```ts
 * await logTillSlipAudit({
 *   event: 'TILL_CODE_REDEEMED',
 *   actorId: userId,
 *   tenantId: branchId,
 *   resourceId: submissionId,
 *   metadata: { redemptionCode: 'A3K9M2' }
 * });
 * ```
 */
export async function logTillSlipAudit(entry: TillSlipAuditEntry): Promise<string> {
  try {
    // Get actor details if not provided
    let actorEmail = entry.actorEmail;
    let actorRole: string = 'STAFF';
    
    if (!actorEmail) {
      const user = await db.user.findUnique({
        where: { id: entry.actorId },
        select: { email: true, role: true },
      });
      actorEmail = user?.email || 'unknown';
      actorRole = user?.role || 'STAFF';
    }

    // Create audit log entry
    const auditLog = await db.auditLog.create({
      data: {
        actorId: entry.actorId,
        actorEmail,
        actorRole: actorRole as 'PICKD_ADMIN' | 'PICKD_SUPPORT' | 'OWNER' | 'MANAGER' | 'STAFF',
        action: mapEventToAction(entry.event),
        resourceType: entry.resourceType || 'TillSlipSettings',
        resourceId: entry.resourceId,
        tenantId: entry.tenantId,
        oldValue: entry.oldValue ? (entry.oldValue as Prisma.InputJsonValue) : undefined,
        newValue: entry.newValue ? (entry.newValue as Prisma.InputJsonValue) : undefined,
        metadata: {
          tillSlipEvent: entry.event,
          ...entry.metadata,
        } as Prisma.InputJsonValue,
        ipAddress: entry.ipAddress,
      },
    });

    return auditLog.id;
  } catch (error) {
    // Don't fail the main operation if audit logging fails
    console.error('[TillSlip Audit] Failed to log event:', entry.event, error);
    return '';
  }
}

/**
 * Map Till Slip event to generic audit action
 */
function mapEventToAction(event: TillSlipAuditEvent): 'CREATE' | 'UPDATE' | 'DELETE' | 'TRIGGER' | 'ACCESS' {
  switch (event) {
    case 'TILL_SETTINGS_CREATED':
    case 'TILL_API_KEY_CREATED':
    case 'TILL_RECEIPT_ISSUED':
    case 'TILL_BATCH_ISSUED':
      return 'CREATE';
    
    case 'TILL_SETTINGS_UPDATED':
    case 'TILL_SETTINGS_ENABLED':
    case 'TILL_SETTINGS_DISABLED':
    case 'TILL_INCENTIVE_CHANGED':
    case 'TILL_TOKEN_EXPIRY_CHANGED':
    case 'TILL_SUBMISSION_FLAGGED':
    case 'TILL_SUBMISSION_APPROVED':
    case 'TILL_SUBMISSION_REJECTED':
      return 'UPDATE';
    
    case 'TILL_API_KEY_REVOKED':
      return 'DELETE';
    
    case 'TILL_CODE_REDEEMED':
      return 'TRIGGER';
    
    default:
      return 'UPDATE';
  }
}

/**
 * Query audit logs for a tenant's Till Slip events
 * 
 * @param tenantId - Tenant ID to query
 * @param options - Query options
 * @returns Array of audit log entries
 */
export async function getTillSlipAuditLogs(
  tenantId: string,
  options: {
    limit?: number;
    offset?: number;
    eventTypes?: TillSlipAuditEvent[];
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<Array<{
  id: string;
  event: string;
  actorEmail: string;
  resourceId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}>> {
  const { limit = 50, offset = 0, eventTypes, startDate, endDate } = options;

  const logs = await db.auditLog.findMany({
    where: {
      tenantId,
      metadata: eventTypes ? {
        path: ['tillSlipEvent'],
        string_contains: eventTypes.length === 1 ? eventTypes[0] : undefined,
      } : {
        path: ['tillSlipEvent'],
        not: undefined,
      },
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
    select: {
      id: true,
      actorEmail: true,
      resourceId: true,
      metadata: true,
      createdAt: true,
    },
  });

  return logs.map(log => ({
    id: log.id,
    event: (log.metadata as Record<string, unknown>)?.tillSlipEvent as string || 'UNKNOWN',
    actorEmail: log.actorEmail,
    resourceId: log.resourceId,
    metadata: log.metadata as Record<string, unknown>,
    createdAt: log.createdAt,
  }));
}

// ============================================================
// TENANT ISOLATION
// ============================================================

/**
 * Verify tenant isolation for a resource
 * 
 * Ensures the resource belongs to the specified tenant.
 * Throws an error if isolation is violated.
 * 
 * @param resourceTenantId - Tenant ID of the resource
 * @param requestTenantId - Tenant ID from the request
 * @param resourceType - Type of resource for error message
 * 
 * @throws Error if tenant isolation is violated
 */
export function verifyTenantIsolation(
  resourceTenantId: string,
  requestTenantId: string,
  resourceType: string = 'resource'
): void {
  if (resourceTenantId !== requestTenantId) {
    console.error(`[Security] Tenant isolation violation: ${resourceType} belongs to ${resourceTenantId}, requested by ${requestTenantId}`);
    throw new Error('Access denied - resource does not belong to this tenant');
  }
}

/**
 * Check if a user has access to a tenant
 * 
 * @param userId - User ID to check
 * @param tenantId - Tenant ID to check access for
 * @returns True if user has access
 */
export async function checkTenantAccess(
  userId: string,
  tenantId: string
): Promise<boolean> {
  // Get the tenant to find its organization
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { organizationId: true },
  });

  if (!tenant) {
    return false;
  }

  // Check if user is a member of the organization
  const membership = await db.membership.findFirst({
    where: {
      userId,
      organizationId: tenant.organizationId,
      isActive: true,
    },
  });

  return !!membership;
}

// ============================================================
// INPUT VALIDATION
// ============================================================

/**
 * Validate receipt reference format
 * 
 * @param receiptRef - Receipt reference to validate
 * @returns Sanitized receipt reference or null if invalid
 */
export function validateReceiptRef(receiptRef: string | null | undefined): string | null {
  if (!receiptRef || typeof receiptRef !== 'string') {
    return null;
  }

  // Trim and limit length
  let sanitized = receiptRef.trim().slice(0, 100);

  // Remove any potentially dangerous characters
  sanitized = sanitized.replace(/[<>'"\\]/g, '');

  // Must have at least 1 character
  if (sanitized.length === 0) {
    return null;
  }

  return sanitized;
}

/**
 * Validate email format
 * 
 * @param email - Email to validate
 * @returns True if valid email format
 */
export function isValidEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}
