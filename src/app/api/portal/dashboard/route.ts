/**
 * Portal API: Dashboard Data
 * 
 * Returns KPIs, charts, and trend data based on the latest successful score_run
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
      select: { 
        baseSentiment: true, 
        weightedImpact: true,
        review: {
          select: { rating: true }
        }
      },
    });

    const sentimentDistribution = {
      positive: reviewScores.filter(rs => rs.baseSentiment > 0.3).length,
      neutral: reviewScores.filter(rs => rs.baseSentiment >= -0.3 && rs.baseSentiment <= 0.3).length,
      negative: reviewScores.filter(rs => rs.baseSentiment < -0.3).length,
    };

    // Rating distribution (1-5 stars)
    const ratingDistribution = [1, 2, 3, 4, 5].map(star => ({
      rating: star,
      count: reviewScores.filter(rs => rs.review.rating === star).length,
      label: `${star} Star${star !== 1 ? 's' : ''}`,
    }));

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

    // ===== TIME SERIES DATA =====
    // Get reviews with dates for trend analysis (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const reviewsWithScores = await db.review.findMany({
      where: {
        tenantId,
        reviewDate: { gte: ninetyDaysAgo },
      },
      select: {
        id: true,
        reviewDate: true,
        rating: true,
        reviewScores: {
          where: { scoreRunId: latestRun.id },
          select: { baseSentiment: true, weightedImpact: true },
          take: 1,
        },
      },
      orderBy: { reviewDate: 'asc' },
    });

    // Group by week for trend chart
    const weeklyTrends = getWeeklyTrends(reviewsWithScores);
    
    // Daily review volume for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dailyVolume = getDailyVolume(reviewsWithScores.filter(r => r.reviewDate >= thirtyDaysAgo));

    // Format theme scores for frontend with radar chart data
    const formattedThemeScores = themeScores.map(ts => ({
      id: ts.id,
      themeId: ts.themeId,
      themeName: ts.theme.name,
      themeCategory: ts.theme.category,
      sentiment: ts.themeSentiment,
      score010: ts.themeScore010,
      mentions: ts.mentionCount,
      severity: ts.severity,
      // For radar chart - normalize to 0-100
      radarScore: Math.round(ts.themeScore010 * 10),
    }));

    // Top issues (highest severity, negative themes)
    const topIssues = formattedThemeScores
      .filter(t => t.score010 < 6)
      .sort((a, b) => b.severity - a.severity)
      .slice(0, 5);

    // Best performing themes
    const topPerformers = [...formattedThemeScores]
      .sort((a, b) => b.score010 - a.score010)
      .slice(0, 5);

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
        // Sentiment health score (0-100)
        healthScore: Math.round(avgSentiment * 10),
      },
      sentimentDistribution,
      ratingDistribution,
      sourceDistribution,
      themeScores: formattedThemeScores,
      topIssues,
      topPerformers,
      // Time series data
      trends: {
        weekly: weeklyTrends,
        dailyVolume,
      },
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

// Helper to group reviews by week
function getWeeklyTrends(reviews: Array<{
  reviewDate: Date;
  rating: number | null;
  reviewScores: Array<{ baseSentiment: number; weightedImpact: number }>;
}>) {
  const weekMap = new Map<string, { 
    week: string;
    reviews: number;
    avgSentiment: number;
    avgRating: number;
    positive: number;
    negative: number;
    sentimentSum: number;
    ratingSum: number;
    ratingCount: number;
  }>();

  reviews.forEach(review => {
    const weekStart = getWeekStart(review.reviewDate);
    const weekKey = weekStart.toISOString().split('T')[0];
    
    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, {
        week: weekKey,
        reviews: 0,
        avgSentiment: 0,
        avgRating: 0,
        positive: 0,
        negative: 0,
        sentimentSum: 0,
        ratingSum: 0,
        ratingCount: 0,
      });
    }
    
    const data = weekMap.get(weekKey)!;
    data.reviews++;
    
    const sentiment = review.reviewScores[0]?.baseSentiment ?? 0;
    data.sentimentSum += sentiment;
    
    if (sentiment > 0.3) data.positive++;
    else if (sentiment < -0.3) data.negative++;
    
    if (review.rating !== null) {
      data.ratingSum += review.rating;
      data.ratingCount++;
    }
  });

  // Calculate averages and format
  return Array.from(weekMap.values())
    .map(w => ({
      week: w.week,
      weekLabel: formatWeekLabel(new Date(w.week)),
      reviews: w.reviews,
      avgSentiment: w.reviews > 0 ? Math.round((w.sentimentSum / w.reviews) * 100) / 100 : 0,
      avgRating: w.ratingCount > 0 ? Math.round((w.ratingSum / w.ratingCount) * 10) / 10 : null,
      positive: w.positive,
      negative: w.negative,
      // Convert sentiment to 0-10 scale for chart
      sentimentScore: w.reviews > 0 ? Math.round((((w.sentimentSum / w.reviews) + 1) / 2) * 10 * 10) / 10 : 5,
    }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

// Helper to get daily volume
function getDailyVolume(reviews: Array<{ reviewDate: Date }>) {
  const dayMap = new Map<string, number>();
  
  // Initialize last 30 days with 0
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toISOString().split('T')[0];
    dayMap.set(key, 0);
  }
  
  reviews.forEach(review => {
    const key = review.reviewDate.toISOString().split('T')[0];
    if (dayMap.has(key)) {
      dayMap.set(key, (dayMap.get(key) || 0) + 1);
    }
  });

  return Array.from(dayMap.entries())
    .map(([date, count]) => ({
      date,
      dateLabel: formatDayLabel(new Date(date)),
      reviews: count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
