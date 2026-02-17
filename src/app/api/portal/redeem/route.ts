/**
 * API Route: Staff Redemption Verification
 * 
 * Allows restaurant staff to verify and redeem discount codes
 * from Till Slip feedback submissions.
 * 
 * Security:
 * - Requires authentication
 * - Tenant isolation enforced
 * - Audit logging for all redemptions
 * 
 * POST: Verify and redeem a code
 * GET: Look up code details without redeeming
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { db } from '@/server/db';
import { logTillSlipAudit } from '@/server/till-slip/security';

// ============================================================
// HELPERS
// ============================================================

/**
 * Check if user has staff access to any tenant
 * Returns list of tenant IDs user can access
 */
async function getStaffTenants(userId: string): Promise<string[]> {
  // Get memberships where user has staff-level role
  const memberships = await db.membership.findMany({
    where: {
      userId,
      isActive: true,
      role: {
        in: ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'], // All roles that can redeem codes
      },
    },
    select: { organizationId: true },
  });
  
  if (memberships.length === 0) {
    return [];
  }

  // Get tenants (branches) for these organizations
  const tenants = await db.tenant.findMany({
    where: {
      organizationId: { in: memberships.map(m => m.organizationId) },
    },
    select: { id: true },
  });
  
  return tenants.map(t => t.id);
}

// ============================================================
// GET - Look up code details
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code')?.toUpperCase().trim();

    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    // Get tenants the user has access to
    const staffTenants = await getStaffTenants(session.user.id);
    if (staffTenants.length === 0) {
      return NextResponse.json({ error: 'Access denied - not a staff member' }, { status: 403 });
    }

    // Look up the submission by redemption code
    const submission = await db.tillReviewSubmission.findFirst({
      where: {
        redemptionCode: code,
        tenantId: { in: staffTenants },
      },
      include: {
        tenant: {
          select: { name: true },
        },
        receipt: {
          select: { receiptRef: true, issuedAt: true },
        },
      },
    });

    if (!submission) {
      return NextResponse.json({
        valid: false,
        error: 'CODE_NOT_FOUND',
        message: 'This code was not found or you do not have access to verify it.',
      });
    }

    // Check if already redeemed
    if (submission.incentiveRedeemed) {
      return NextResponse.json({
        valid: false,
        error: 'ALREADY_REDEEMED',
        message: 'This code has already been redeemed.',
        redeemedAt: submission.incentiveRedeemedAt?.toISOString(),
      });
    }

    // Check if expired
    if (submission.incentiveCodeExpiry && new Date() > submission.incentiveCodeExpiry) {
      return NextResponse.json({
        valid: false,
        error: 'CODE_EXPIRED',
        message: 'This code has expired.',
        expiredAt: submission.incentiveCodeExpiry.toISOString(),
      });
    }

    return NextResponse.json({
      valid: true,
      submission: {
        id: submission.id,
        redemptionCode: submission.redemptionCode,
        incentiveCode: submission.incentiveCode,
        createdAt: submission.createdAt.toISOString(),
        expiresAt: submission.incentiveCodeExpiry?.toISOString(),
        overallRating: submission.overallRating,
        tenantName: submission.tenant.name,
        receiptRef: submission.receipt.receiptRef?.slice(-4), // Last 4 chars only
        receiptDate: submission.receipt.issuedAt?.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error looking up code:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================
// POST - Redeem a code
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const code = body.code?.toUpperCase().trim();

    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    // Get tenants the user has access to
    const staffTenants = await getStaffTenants(session.user.id);
    if (staffTenants.length === 0) {
      return NextResponse.json({ error: 'Access denied - not a staff member' }, { status: 403 });
    }

    // Look up the submission
    const submission = await db.tillReviewSubmission.findFirst({
      where: {
        redemptionCode: code,
        tenantId: { in: staffTenants },
      },
      include: {
        tenant: { select: { name: true } },
        receipt: { select: { id: true, receiptRef: true } },
      },
    });

    if (!submission) {
      return NextResponse.json({
        success: false,
        error: 'CODE_NOT_FOUND',
        message: 'This code was not found or you do not have access to redeem it.',
      }, { status: 404 });
    }

    // Check if already redeemed
    if (submission.incentiveRedeemed) {
      return NextResponse.json({
        success: false,
        error: 'ALREADY_REDEEMED',
        message: 'This code has already been redeemed.',
        redeemedAt: submission.incentiveRedeemedAt?.toISOString(),
        redeemedBy: submission.incentiveRedeemedBy,
      }, { status: 400 });
    }

    // Check if expired
    if (submission.incentiveCodeExpiry && new Date() > submission.incentiveCodeExpiry) {
      return NextResponse.json({
        success: false,
        error: 'CODE_EXPIRED',
        message: 'This code has expired and cannot be redeemed.',
        expiredAt: submission.incentiveCodeExpiry.toISOString(),
      }, { status: 400 });
    }

    // Redeem the code
    const updatedSubmission = await db.tillReviewSubmission.update({
      where: { id: submission.id },
      data: {
        incentiveRedeemed: true,
        incentiveRedeemedAt: new Date(),
        incentiveRedeemedBy: session.user.id,
      },
    });

    // Also update the receipt status to REDEEMED
    await db.tillReceipt.update({
      where: { id: submission.receipt.id },
      data: { status: 'REDEEMED' },
    });

    // Audit log the redemption
    await logTillSlipAudit({
      event: 'TILL_CODE_REDEEMED',
      actorId: session.user.id,
      actorEmail: session.user.email || undefined,
      tenantId: submission.tenantId,
      resourceId: submission.id,
      resourceType: 'TillReviewSubmission',
      metadata: {
        redemptionCode: submission.redemptionCode,
        receiptRef: submission.receipt.receiptRef?.slice(-4),
        overallRating: submission.overallRating,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Code redeemed successfully!',
      redemption: {
        code: submission.redemptionCode,
        redeemedAt: updatedSubmission.incentiveRedeemedAt?.toISOString(),
        redeemedBy: session.user.name || session.user.email,
        tenantName: submission.tenant.name,
        receiptRef: submission.receipt.receiptRef?.slice(-4),
      },
    });
  } catch (error) {
    console.error('Error redeeming code:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
