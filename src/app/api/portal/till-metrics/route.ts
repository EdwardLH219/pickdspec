/**
 * API Route: Till Slip Channel Metrics
 * 
 * Returns metrics for the Till Slip feedback channel:
 * - Response rate: submissions / receipts issued
 * - Incentive uptake: redeemed / submitted (by type)
 * - Submission trends over time
 * 
 * These metrics are informational and do NOT affect sentiment scoring formulas
 * unless explicitly configured by Pick'd admin.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { hasTenantAccess } from '@/server/auth/rbac';
import { db } from '@/server/db';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const periodDays = parseInt(searchParams.get('periodDays') || '30');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    // Check tenant access
    if (!hasTenantAccess(session.user, tenantId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - periodDays);

    // Get receipt counts by status
    const receiptStats = await db.tillReceipt.groupBy({
      by: ['status'],
      where: {
        tenantId,
        issuedAt: { gte: periodStart },
      },
      _count: true,
    });

    const totalReceipts = receiptStats.reduce((sum, s) => sum + s._count, 0);
    const submittedReceipts = receiptStats.find(s => s.status === 'SUBMITTED')?._count || 0;
    const redeemedReceipts = receiptStats.find(s => s.status === 'REDEEMED')?._count || 0;

    // Get submission counts
    const submissionStats = await db.tillReviewSubmission.aggregate({
      where: {
        tenantId,
        createdAt: { gte: periodStart },
      },
      _count: true,
      _avg: {
        overallRating: true,
        spamScore: true,
      },
    });

    // Get incentive redemption stats
    const incentiveStats = await db.tillReviewSubmission.groupBy({
      by: ['incentiveRedeemed'],
      where: {
        tenantId,
        createdAt: { gte: periodStart },
        incentiveCode: { not: null },
      },
      _count: true,
    });

    const totalWithIncentives = incentiveStats.reduce((sum, s) => sum + s._count, 0);
    const redeemedIncentives = incentiveStats.find(s => s.incentiveRedeemed === true)?._count || 0;

    // Get settings for incentive type
    const settings = await db.tillReviewSettings.findUnique({
      where: { tenantId },
      select: { 
        incentiveType: true, 
        isActive: true,
        discountPercent: true,
      },
    });

    // Get flagged submission count
    const flaggedCount = await db.tillReviewSubmission.count({
      where: {
        tenantId,
        createdAt: { gte: periodStart },
        isFlagged: true,
      },
    });

    // Get daily submission trend
    const submissions = await db.tillReviewSubmission.findMany({
      where: {
        tenantId,
        createdAt: { gte: periodStart },
      },
      select: {
        createdAt: true,
        overallRating: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by day
    const dailyTrend: Record<string, { count: number; ratingSum: number }> = {};
    submissions.forEach(s => {
      const day = s.createdAt.toISOString().split('T')[0];
      if (!dailyTrend[day]) {
        dailyTrend[day] = { count: 0, ratingSum: 0 };
      }
      dailyTrend[day].count++;
      dailyTrend[day].ratingSum += s.overallRating;
    });

    const trendData = Object.entries(dailyTrend).map(([date, data]) => ({
      date,
      submissions: data.count,
      avgRating: data.count > 0 ? data.ratingSum / data.count : null,
    }));

    // Calculate response rate
    const responseRate = totalReceipts > 0 
      ? (submittedReceipts + redeemedReceipts) / totalReceipts 
      : null;

    // Calculate incentive uptake rate
    const incentiveUptake = totalWithIncentives > 0 
      ? redeemedIncentives / totalWithIncentives 
      : null;

    return NextResponse.json({
      periodDays,
      periodStart: periodStart.toISOString(),
      
      // Response rate metrics
      responseRate: {
        receiptsIssued: totalReceipts,
        receiptsSubmitted: submittedReceipts + redeemedReceipts,
        rate: responseRate,
        ratePercent: responseRate !== null ? Math.round(responseRate * 100) : null,
      },

      // Submission metrics
      submissions: {
        total: submissionStats._count,
        avgRating: submissionStats._avg.overallRating 
          ? Math.round(submissionStats._avg.overallRating * 10) / 10 
          : null,
        flaggedCount,
        flaggedRate: submissionStats._count > 0 
          ? Math.round((flaggedCount / submissionStats._count) * 100) 
          : 0,
      },

      // Incentive metrics
      incentives: {
        type: settings?.incentiveType || 'NONE',
        discountPercent: settings?.discountPercent,
        codesIssued: totalWithIncentives,
        codesRedeemed: redeemedIncentives,
        uptakeRate: incentiveUptake,
        uptakePercent: incentiveUptake !== null ? Math.round(incentiveUptake * 100) : null,
      },

      // Channel status
      channelStatus: {
        isActive: settings?.isActive ?? false,
        hasSettings: !!settings,
      },

      // Trend data
      trend: trendData,
    });
  } catch (error) {
    console.error('Error fetching till metrics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
