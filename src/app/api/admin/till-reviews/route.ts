/**
 * API Route: Admin Till Review Moderation
 * 
 * Allows Pick'd admins to view and moderate flagged till slip submissions.
 * 
 * GET: List submissions with filtering
 * PATCH: Update submission status (approve/reject)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { db } from '@/server/db';

// ============================================================
// TYPES
// ============================================================

interface ModerationFilters {
  tenantId?: string;
  status?: 'all' | 'flagged' | 'pending' | 'approved' | 'rejected';
  dateFrom?: string;
  dateTo?: string;
  minSpamScore?: number;
  page?: number;
  limit?: number;
}

// ============================================================
// AUTHORIZATION
// ============================================================

async function checkAdminAccess() {
  const session = await auth();
  if (!session?.user?.isPickdStaff || session.user.role !== 'PICKD_ADMIN') {
    return null;
  }
  return session.user;
}

// ============================================================
// GET - List Submissions
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const user = await checkAdminAccess();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const filters: ModerationFilters = {
      tenantId: searchParams.get('tenantId') || undefined,
      status: (searchParams.get('status') as ModerationFilters['status']) || 'flagged',
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      minSpamScore: searchParams.get('minSpamScore') ? parseFloat(searchParams.get('minSpamScore')!) : undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '20'), 100),
    };

    // Build where clause
    const where: Record<string, unknown> = {};

    if (filters.tenantId) {
      where.tenantId = filters.tenantId;
    }

    if (filters.status === 'flagged') {
      where.isFlagged = true;
    } else if (filters.status === 'pending') {
      where.isFlagged = true;
      where.review = { is: null }; // Not yet reviewed
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        (where.createdAt as Record<string, Date>).gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        (where.createdAt as Record<string, Date>).lte = new Date(filters.dateTo);
      }
    }

    if (filters.minSpamScore !== undefined) {
      where.spamScore = { gte: filters.minSpamScore };
    }

    // Count total
    const total = await db.tillReviewSubmission.count({ where });

    // Fetch submissions with related data
    const submissions = await db.tillReviewSubmission.findMany({
      where,
      include: {
        tenant: {
          select: { id: true, name: true },
        },
        receipt: {
          select: { 
            id: true, 
            receiptRef: true, 
            receiptLastFour: true,
            status: true,
          },
        },
        review: {
          select: { id: true, qualityFlags: true },
        },
      },
      orderBy: [
        { isFlagged: 'desc' },
        { spamScore: 'desc' },
        { createdAt: 'desc' },
      ],
      skip: ((filters.page || 1) - 1) * (filters.limit || 20),
      take: filters.limit || 20,
    });

    // Get tenant list for filtering
    const tenants = await db.tenant.findMany({
      where: {
        tillReviewSubmissions: { some: {} },
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    // Calculate stats
    const stats = await db.tillReviewSubmission.groupBy({
      by: ['isFlagged'],
      _count: true,
    });

    const flaggedCount = stats.find(s => s.isFlagged)?._count || 0;
    const totalCount = stats.reduce((sum, s) => sum + s._count, 0);

    return NextResponse.json({
      submissions: submissions.map(s => ({
        id: s.id,
        tenantId: s.tenantId,
        tenantName: s.tenant.name,
        receiptId: s.receipt.id,
        receiptRef: s.receipt.receiptLastFour ? `****${s.receipt.receiptLastFour}` : null,
        overallRating: s.overallRating,
        positiveThemes: s.positiveThemes,
        negativeThemes: s.negativeThemes,
        positiveDetail: s.positiveDetail,
        negativeDetail: s.negativeDetail,
        anythingElse: s.anythingElse,
        spamScore: s.spamScore,
        isFlagged: s.isFlagged,
        hasReview: !!s.review,
        reviewId: s.review?.id,
        incentiveCode: s.incentiveCode,
        incentiveRedeemed: s.incentiveRedeemed,
        createdAt: s.createdAt,
      })),
      pagination: {
        page: filters.page || 1,
        limit: filters.limit || 20,
        total,
        totalPages: Math.ceil(total / (filters.limit || 20)),
      },
      stats: {
        total: totalCount,
        flagged: flaggedCount,
        unflagged: totalCount - flaggedCount,
      },
      tenants,
    });
  } catch (error) {
    console.error('Error fetching moderation data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch moderation data' },
      { status: 500 }
    );
  }
}

// ============================================================
// PATCH - Update Submission
// ============================================================

export async function PATCH(request: NextRequest) {
  try {
    const user = await checkAdminAccess();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { submissionId, action } = body;

    if (!submissionId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['approve', 'reject', 'unflag'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Get submission
    const submission = await db.tillReviewSubmission.findUnique({
      where: { id: submissionId },
      include: { review: true },
    });

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Handle actions
    if (action === 'approve' || action === 'unflag') {
      // Unflag the submission
      await db.tillReviewSubmission.update({
        where: { id: submissionId },
        data: { isFlagged: false },
      });

      // If no review exists, create one
      if (!submission.review) {
        const content = buildReviewContent(submission);
        await db.review.create({
          data: {
            tenantId: submission.tenantId,
            connectorId: null,
            externalReviewId: null,
            tillReviewSubmissionId: submission.id,
            rating: submission.overallRating,
            title: null,
            content,
            authorName: 'Receipt Feedback',
            reviewDate: submission.createdAt,
            detectedLanguage: 'en',
            textLength: content.length,
            qualityFlags: [],
            rawData: {
              source: 'till_slip',
              submissionId: submission.id,
              positiveThemes: submission.positiveThemes,
              negativeThemes: submission.negativeThemes,
              moderatedBy: user.id,
              moderatedAt: new Date().toISOString(),
            },
          },
        });
      } else {
        // Update existing review to remove flag
        await db.review.update({
          where: { id: submission.review.id },
          data: {
            qualityFlags: submission.review.qualityFlags.filter(f => f !== 'flagged_spam'),
          },
        });
      }

      return NextResponse.json({ success: true, action: 'approved' });
    }

    if (action === 'reject') {
      // Delete the review if it exists
      if (submission.review) {
        await db.review.delete({
          where: { id: submission.review.id },
        });
      }

      // Mark as permanently flagged (keep in DB for audit)
      await db.tillReviewSubmission.update({
        where: { id: submissionId },
        data: { 
          isFlagged: true,
          // Add rejection metadata
        },
      });

      return NextResponse.json({ success: true, action: 'rejected' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Error updating submission:', error);
    return NextResponse.json(
      { error: 'Failed to update submission' },
      { status: 500 }
    );
  }
}

// ============================================================
// HELPERS
// ============================================================

function buildReviewContent(submission: {
  positiveThemes: string[];
  negativeThemes: string[];
  positiveDetail: string | null;
  negativeDetail: string | null;
  anythingElse: string | null;
}): string {
  const parts: string[] = [];
  
  if (submission.positiveThemes.length > 0) {
    parts.push(`Highlights: ${submission.positiveThemes.join(', ')}.`);
  }
  
  if (submission.positiveDetail) {
    parts.push(submission.positiveDetail);
  }
  
  if (submission.negativeThemes.length > 0) {
    parts.push(`Could improve: ${submission.negativeThemes.join(', ')}.`);
  }
  
  if (submission.negativeDetail) {
    parts.push(submission.negativeDetail);
  }
  
  if (submission.anythingElse) {
    parts.push(submission.anythingElse);
  }
  
  return parts.join(' ').trim() || 'Feedback submitted via receipt QR code.';
}
