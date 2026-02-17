/**
 * API Route: Till Slip Review Settings
 * 
 * Manages the configuration for receipt QR code feedback collection
 * for a specific branch (tenant).
 * 
 * GET: Fetch current settings
 * PUT: Update settings (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { db } from '@/server/db';
import { hasTenantAccess } from '@/server/auth/rbac';
import { logTillSlipAudit, type TillSlipAuditEvent } from '@/server/till-slip/security';
import { TillIncentiveType } from '@prisma/client';
import crypto from 'crypto';

// ============================================================
// TYPES
// ============================================================

interface TillSettingsUpdate {
  isActive?: boolean;
  incentiveType?: TillIncentiveType;
  incentiveTitle?: string | null;
  incentiveDescription?: string | null;
  discountPercent?: number | null;
  discountTerms?: string | null;
  prizeDrawTitle?: string | null;
  prizeDrawDescription?: string | null;
  prizeDrawTerms?: string | null;
  headerColor?: string | null;
  accentColor?: string | null;
  tokenExpiryDays?: number;
  requireReceiptNumber?: boolean;
  redirectToGoogleReview?: boolean;
  googleReviewUrl?: string | null;
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Generate a unique short code for the branch
 */
function generateShortCode(tenantSlug: string): string {
  const randomPart = crypto.randomBytes(3).toString('hex').substring(0, 4);
  const slugPart = tenantSlug.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toLowerCase();
  return `${slugPart}-${randomPart}`;
}

/**
 * Check if user has admin access (can edit) or just view access
 * OWNER in organization or PICKD_ADMIN can edit
 */
function canEditSettings(membershipRole: string | null, platformRole: string): boolean {
  // Pick'd admins can always edit
  if (platformRole === 'PICKD_ADMIN') return true;
  // Organization owners can edit
  return membershipRole === 'OWNER';
}

// Token expiry bounds (days)
const MIN_EXPIRY_DAYS = 1;
const MAX_EXPIRY_DAYS = 90;
const EXPIRY_PRESETS = [7, 14, 30, 60, 90];

// ============================================================
// GET - Fetch settings
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ branchId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { branchId } = await params;

    // Check tenant access
    if (!hasTenantAccess(session.user, branchId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch tenant info
    const tenant = await db.tenant.findUnique({
      where: { id: branchId },
      select: { 
        id: true, 
        name: true, 
        slug: true,
        googlePlaceId: true,
        organizationId: true,
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    // Fetch settings (may not exist yet)
    const settings = await db.tillReviewSettings.findFirst({
      where: { tenantId: branchId },
    });

    // Determine user permissions based on membership role
    // Get membership directly here to avoid extra DB lookup
    const membership = await db.membership.findFirst({
      where: {
        userId: session.user.id,
        organizationId: tenant.organizationId,
        isActive: true,
      },
      select: { role: true },
    });
    const membershipRole = membership?.role || null;
    const canEdit = canEditSettings(membershipRole, session.user.role);

    // Build Google Review URL suggestion if not set
    let suggestedGoogleReviewUrl: string | null = null;
    if (tenant.googlePlaceId) {
      suggestedGoogleReviewUrl = `https://search.google.com/local/writereview?placeid=${tenant.googlePlaceId}`;
    }

    return NextResponse.json({
      settings: settings ? {
        id: settings.id,
        isActive: settings.isActive,
        shortCode: settings.shortCode,
        incentiveType: settings.incentiveType,
        incentiveTitle: settings.incentiveTitle,
        incentiveDescription: settings.incentiveDescription,
        discountPercent: settings.discountPercent,
        discountTerms: settings.discountTerms,
        prizeDrawTitle: settings.prizeDrawTitle,
        prizeDrawDescription: settings.prizeDrawDescription,
        prizeDrawTerms: settings.prizeDrawTerms,
        headerColor: settings.headerColor,
        accentColor: settings.accentColor,
        tokenExpiryDays: settings.tokenExpiryDays,
        requireReceiptNumber: settings.requireReceiptNumber,
        redirectToGoogleReview: settings.redirectToGoogleReview,
        googleReviewUrl: settings.googleReviewUrl,
        createdAt: settings.createdAt,
        updatedAt: settings.updatedAt,
      } : null,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
      canEdit,
      expiryPresets: EXPIRY_PRESETS,
      suggestedGoogleReviewUrl,
    });
  } catch (error) {
    console.error('Error fetching till settings:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { 
        error: 'Failed to fetch settings',
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : String(error))
          : undefined
      },
      { status: 500 }
    );
  }
}

// ============================================================
// PUT - Update settings
// ============================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ branchId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { branchId } = await params;

    // Check tenant access
    if (!hasTenantAccess(session.user, branchId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch tenant info
    const tenant = await db.tenant.findUnique({
      where: { id: branchId },
      select: { id: true, slug: true, organizationId: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    // Check edit permissions based on membership role
    const membership = await db.membership.findFirst({
      where: {
        userId: session.user.id,
        organizationId: tenant.organizationId,
        isActive: true,
      },
      select: { role: true },
    });
    const membershipRole = membership?.role || null;
    if (!canEditSettings(membershipRole, session.user.role)) {
      return NextResponse.json(
        { error: 'Only owners can modify till slip settings' },
        { status: 403 }
      );
    }

    // Parse request body
    const body: TillSettingsUpdate = await request.json();

    // Validate token expiry bounds
    if (body.tokenExpiryDays !== undefined) {
      if (body.tokenExpiryDays < MIN_EXPIRY_DAYS || body.tokenExpiryDays > MAX_EXPIRY_DAYS) {
        return NextResponse.json(
          { error: `Token expiry must be between ${MIN_EXPIRY_DAYS} and ${MAX_EXPIRY_DAYS} days` },
          { status: 400 }
        );
      }
    }

    // Validate discount percent
    if (body.discountPercent !== undefined && body.discountPercent !== null) {
      if (body.discountPercent < 1 || body.discountPercent > 50) {
        return NextResponse.json(
          { error: 'Discount must be between 1% and 50%' },
          { status: 400 }
        );
      }
    }

    // Validate hex colors
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
    if (body.headerColor && !hexColorRegex.test(body.headerColor)) {
      return NextResponse.json({ error: 'Invalid header color format' }, { status: 400 });
    }
    if (body.accentColor && !hexColorRegex.test(body.accentColor)) {
      return NextResponse.json({ error: 'Invalid accent color format' }, { status: 400 });
    }

    // Fetch existing settings to track changes
    const existingSettings = await db.tillReviewSettings.findFirst({
      where: { tenantId: branchId },
    });

    const isCreating = !existingSettings;

    // Upsert settings
    const settings = await db.tillReviewSettings.upsert({
      where: { tenantId: branchId },
      create: {
        tenantId: branchId,
        shortCode: generateShortCode(tenant.slug),
        isActive: body.isActive ?? false,
        incentiveType: body.incentiveType ?? 'NONE',
        incentiveTitle: body.incentiveTitle ?? null,
        incentiveDescription: body.incentiveDescription ?? null,
        discountPercent: body.discountPercent ?? null,
        discountTerms: body.discountTerms ?? null,
        prizeDrawTitle: body.prizeDrawTitle ?? null,
        prizeDrawDescription: body.prizeDrawDescription ?? null,
        prizeDrawTerms: body.prizeDrawTerms ?? null,
        headerColor: body.headerColor ?? null,
        accentColor: body.accentColor ?? null,
        tokenExpiryDays: body.tokenExpiryDays ?? 7,
        requireReceiptNumber: body.requireReceiptNumber ?? false,
        redirectToGoogleReview: body.redirectToGoogleReview ?? true,
        googleReviewUrl: body.googleReviewUrl ?? null,
      },
      update: {
        isActive: body.isActive,
        incentiveType: body.incentiveType,
        incentiveTitle: body.incentiveTitle,
        incentiveDescription: body.incentiveDescription,
        discountPercent: body.discountPercent,
        discountTerms: body.discountTerms,
        prizeDrawTitle: body.prizeDrawTitle,
        prizeDrawDescription: body.prizeDrawDescription,
        prizeDrawTerms: body.prizeDrawTerms,
        headerColor: body.headerColor,
        accentColor: body.accentColor,
        tokenExpiryDays: body.tokenExpiryDays,
        requireReceiptNumber: body.requireReceiptNumber,
        redirectToGoogleReview: body.redirectToGoogleReview,
        googleReviewUrl: body.googleReviewUrl,
      },
    });

    // Determine the specific event type for audit logging
    let auditEvent: TillSlipAuditEvent = 'TILL_SETTINGS_UPDATED';
    if (isCreating) {
      auditEvent = 'TILL_SETTINGS_CREATED';
    } else if (body.isActive !== undefined && existingSettings && body.isActive !== existingSettings.isActive) {
      auditEvent = body.isActive ? 'TILL_SETTINGS_ENABLED' : 'TILL_SETTINGS_DISABLED';
    } else if (body.incentiveType !== undefined && existingSettings && body.incentiveType !== existingSettings.incentiveType) {
      auditEvent = 'TILL_INCENTIVE_CHANGED';
    } else if (body.tokenExpiryDays !== undefined && existingSettings && body.tokenExpiryDays !== existingSettings.tokenExpiryDays) {
      auditEvent = 'TILL_TOKEN_EXPIRY_CHANGED';
    }

    // Log the settings change
    await logTillSlipAudit({
      event: auditEvent,
      actorId: session.user.id,
      actorEmail: session.user.email || undefined,
      tenantId: branchId,
      resourceId: settings.id,
      resourceType: 'TillReviewSettings',
      oldValue: existingSettings ? {
        isActive: existingSettings.isActive,
        incentiveType: existingSettings.incentiveType,
        tokenExpiryDays: existingSettings.tokenExpiryDays,
        discountPercent: existingSettings.discountPercent,
      } : undefined,
      newValue: {
        isActive: settings.isActive,
        incentiveType: settings.incentiveType,
        tokenExpiryDays: settings.tokenExpiryDays,
        discountPercent: settings.discountPercent,
      },
    });

    return NextResponse.json({
      success: true,
      settings: {
        id: settings.id,
        isActive: settings.isActive,
        shortCode: settings.shortCode,
        incentiveType: settings.incentiveType,
        incentiveTitle: settings.incentiveTitle,
        incentiveDescription: settings.incentiveDescription,
        discountPercent: settings.discountPercent,
        discountTerms: settings.discountTerms,
        prizeDrawTitle: settings.prizeDrawTitle,
        prizeDrawDescription: settings.prizeDrawDescription,
        prizeDrawTerms: settings.prizeDrawTerms,
        headerColor: settings.headerColor,
        accentColor: settings.accentColor,
        tokenExpiryDays: settings.tokenExpiryDays,
        requireReceiptNumber: settings.requireReceiptNumber,
        redirectToGoogleReview: settings.redirectToGoogleReview,
        googleReviewUrl: settings.googleReviewUrl,
        createdAt: settings.createdAt,
        updatedAt: settings.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating till settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
