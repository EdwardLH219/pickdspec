/**
 * Portal API: Dashboard Data
 * 
 * Returns KPIs and chart data based on the latest successful score_run
 * for the selected tenant/branch.
 * 
 * RBAC: User must have access to the requested tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { hasTenantAccess } from '@/server/auth/rbac';
import { db } from '@/server/db';

/**
 * GET /api/portal/dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    // Check tenant access
    if (!hasTenantAccess(session.user, tenantId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get the latest successful score run
    const latestRun = await db.scoreRun.findFirst({
      where: {
        tenantId,
        status: 'COMPLETED',
      },
      orderBy: { completedAt: 'desc' },
      select: {
        id: true,
        periodStart: true,
        periodEnd: true,
        completedAt: true,
        reviewsProcessed: true,
        themesProcessed: true,
      },
    });

    if (!latestRun) {
      return NextResponse.json({
        hasData: false,
        message: 'No completed score runs found',
        kpis: null,
        trends: null,
        themeScores: null,
      });
    }

    // Get KPIs from theme scores
    const themeScores = await db.themeScore.findMany({
      where: { scoreRunId: latestRun.id },
      include: {
        theme: { select: { id: true, name: true, category: true } },
      },
      orderBy: { severity: 'desc' },
    });

    // Calculate aggregate KPIs
    const avgSentiment = themeScores.length > 0
      ? themeScores.reduce((sum, ts) => sum + ts.themeScore010, 0) / themeScores.length
      : 5;
    
    const totalMentions = themeScores.reduce((sum, ts) => sum + ts.mentionCount, 0);
    const avgSeverity = themeScores.length > 0
      ? themeScores.reduce((sum, ts) => sum + ts.severity, 0) / themeScores.length
      : 0;

    // Get review count and average rating from reviews
    const reviewStats = await db.review.aggregate({
      where: {
        tenantId,
        reviewDate: {
          gte: latestRun.periodStart ?? undefined,
          lte: latestRun.periodEnd ?? undefined,
        },
      },
      _count: { id: true },
      _avg: { rating: true },
    });

    // Get sentiment distribution from review scores
    const reviewScores = await db.reviewScore.findMany({
      where: { scoreRunId: latestRun.id },
      select: { baseSentiment: true, weightedImpact: true },
    });

    const sentimentDistribution = {
      positive: reviewScores.filter(rs => rs.baseSentiment > 0.3).length,
      neutral: reviewScores.filter(rs => rs.baseSentiment >= -0.3 && rs.baseSentiment <= 0.3).length,
      negative: reviewScores.filter(rs => rs.baseSentiment < -0.3).length,
    };

    // Get source distribution
    const sourceStats = await db.review.groupBy({
      by: ['connectorId'],
      where: {
        tenantId,
        reviewDate: {
          gte: latestRun.periodStart ?? undefined,
          lte: latestRun.periodEnd ?? undefined,
        },
      },
      _count: { id: true },
    });

    // Enrich with connector info
    const connectorIds = sourceStats.map(s => s.connectorId);
    const connectors = await db.connector.findMany({
      where: { id: { in: connectorIds } },
      select: { id: true, sourceType: true, name: true },
    });

    const sourceDistribution = sourceStats.map(s => {
      const connector = connectors.find(c => c.id === s.connectorId);
      return {
        source: connector?.sourceType ?? 'UNKNOWN',
        sourceName: connector?.name ?? 'Unknown',
        count: s._count.id,
      };
    });

    // Format theme scores for frontend
    const formattedThemeScores = themeScores.map(ts => ({
      id: ts.id,
      themeId: ts.themeId,
      themeName: ts.theme.name,
      themeCategory: ts.theme.category,
      sentiment: ts.themeSentiment,
      score010: ts.themeScore010,
      mentions: ts.mentionCount,
      severity: ts.severity,
    }));

    return NextResponse.json({
      hasData: true,
      scoreRun: {
        id: latestRun.id,
        periodStart: latestRun.periodStart,
        periodEnd: latestRun.periodEnd,
        completedAt: latestRun.completedAt,
      },
      kpis: {
        avgSentiment: Math.round(avgSentiment * 10) / 10,
        avgRating: reviewStats._avg.rating ? Math.round(reviewStats._avg.rating * 10) / 10 : null,
        totalReviews: reviewStats._count.id,
        totalMentions,
        avgSeverity: Math.round(avgSeverity * 100) / 100,
        reviewsProcessed: latestRun.reviewsProcessed,
        themesProcessed: latestRun.themesProcessed,
      },
      sentimentDistribution,
      sourceDistribution,
      themeScores: formattedThemeScores,
    });

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: process.env.NODE_ENV === 'development' ? message : undefined 
    }, { status: 500 });
  }
}
