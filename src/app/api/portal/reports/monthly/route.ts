/**
 * Monthly Report API
 * GET: Returns comprehensive monthly report data for a tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { hasTenantAccess } from '@/server/auth/rbac';
import { db } from '@/server/db';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = request.nextUrl.searchParams.get('tenantId') || session.user.tenantAccess?.[0];
  
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
  }

  if (!hasTenantAccess(session.user, tenantId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Get tenant info
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      include: { organization: { select: { name: true } } },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Get the latest score run
    const latestRun = await db.scoreRun.findFirst({
      where: { tenantId, status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      select: { id: true, periodStart: true, periodEnd: true, completedAt: true },
    });

    // Calculate date range (last 30 days or from score run)
    const endDate = latestRun?.periodEnd || new Date();
    const startDate = latestRun?.periodStart || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get reviews in period
    const reviews = await db.review.findMany({
      where: {
        tenantId,
        reviewDate: { gte: startDate, lte: endDate },
      },
      include: {
        reviewThemes: {
          include: { theme: { select: { id: true, name: true, category: true } } },
        },
        reviewScores: latestRun ? {
          where: { scoreRunId: latestRun.id },
          take: 1,
        } : undefined,
      },
      orderBy: { reviewDate: 'desc' },
    });

    // Calculate KPIs
    const totalReviews = reviews.length;
    const reviewsWithRating = reviews.filter(r => r.rating);
    const avgRating = reviewsWithRating.length > 0
      ? reviewsWithRating.reduce((sum, r) => sum + (r.rating || 0), 0) / reviewsWithRating.length
      : 0;
    
    // Calculate sentiment from review scores
    const reviewsWithScores = reviews.filter(r => r.reviewScores && r.reviewScores.length > 0);
    const avgSentiment = reviewsWithScores.length > 0
      ? reviewsWithScores.reduce((sum, r) => sum + (r.reviewScores?.[0]?.baseSentiment || 0), 0) / reviewsWithScores.length
      : 0;
    // Convert to 0-10 scale
    const sentimentScore = ((avgSentiment + 1) / 2) * 10;

    // Response rate
    const respondedCount = reviews.filter(r => r.responseText).length;
    const responseRate = totalReviews > 0 ? Math.round((respondedCount / totalReviews) * 100) : 0;

    // Get theme scores if we have a score run
    const themeScores = latestRun ? await db.themeScore.findMany({
      where: { scoreRunId: latestRun.id },
      include: { theme: { select: { id: true, name: true, category: true } } },
      orderBy: { themeScore010: 'desc' },
    }) : [];

    // Format thematics
    const thematics = themeScores.map(ts => {
      // Map enum to frontend values
      let trend = 'neutral';
      if (ts.trendDirection === 'IMPROVING') trend = 'up';
      else if (ts.trendDirection === 'DECLINING') trend = 'down';
      
      return {
        themeId: ts.themeId,
        themeName: ts.theme.name,
        category: ts.theme.category,
        avgSentimentScore: ts.themeScore010,
        mentionCount: ts.mentionCount,
        positiveCount: ts.positiveCount,
        neutralCount: ts.neutralCount,
        negativeCount: ts.negativeCount,
        trend,
        trendPercentage: Math.round((ts.trendMagnitude || 0) * 100),
      };
    });

    // Generate TL;DR bullets
    const tldrBullets = generateTldrBullets(thematics, totalReviews, avgRating, sentimentScore);

    // Get quotes for "What People Love" and "What People Dislike"
    const positiveReviews = reviews
      .filter(r => r.reviewScores?.[0]?.baseSentiment > 0.3 && r.content)
      .slice(0, 4);
    const negativeReviews = reviews
      .filter(r => r.reviewScores?.[0]?.baseSentiment < -0.3 && r.content)
      .slice(0, 4);

    const whatPeopleLove = positiveReviews.map(r => {
      const topTheme = r.reviewThemes.find(rt => rt.sentiment === 'POSITIVE');
      return {
        theme: topTheme?.theme.name || 'General',
        quote: truncateQuote(r.content || '', 150),
        source: r.authorName || 'Anonymous',
      };
    });

    const whatPeopleDislike = negativeReviews.map(r => {
      const topTheme = r.reviewThemes.find(rt => rt.sentiment === 'NEGATIVE');
      return {
        theme: topTheme?.theme.name || 'General',
        quote: truncateQuote(r.content || '', 150),
        source: r.authorName || 'Anonymous',
      };
    });

    // Generate watch-outs (themes with low scores)
    const watchOuts = thematics
      .filter(t => t.avgSentimentScore < 5)
      .slice(0, 4)
      .map(t => `${t.themeName} is scoring ${t.avgSentimentScore.toFixed(1)}/10 with ${t.negativeCount} negative mentions`);

    // Generate practical tips based on issues
    const practicalTips = generatePracticalTips(thematics);

    // Review volume stats (use report period for consistency)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const [last30, last90, last365] = await Promise.all([
      db.review.count({ where: { tenantId, reviewDate: { gte: thirtyDaysAgo } } }),
      db.review.count({ where: { tenantId, reviewDate: { gte: ninetyDaysAgo } } }),
      db.review.count({ where: { tenantId, reviewDate: { gte: yearAgo } } }),
    ]);

    // Star distribution - use reviews with scores (same as dashboard)
    // This ensures consistency between dashboard and report
    const reviewScoresForRating = latestRun ? await db.reviewScore.findMany({
      where: { scoreRunId: latestRun.id },
      select: { 
        review: { select: { rating: true } }
      },
    }) : [];

    const ratingCounts = [5, 4, 3, 2, 1].map(rating => ({
      rating,
      count: reviewScoresForRating.filter(rs => rs.review.rating === rating).length,
    }));
    
    const totalRated = ratingCounts.reduce((sum, r) => sum + r.count, 0);
    const starDistribution = ratingCounts.map(({ rating, count }) => ({
      rating,
      count,
      percentage: totalRated > 0 ? Math.round((count / totalRated) * 100) : 0,
    }));

    return NextResponse.json({
      organization: { name: tenant.organization.name },
      branch: { name: tenant.name },
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      generatedAt: new Date().toISOString(),
      
      totalReviews,
      avgRating: Math.round(avgRating * 100) / 100,
      avgSentiment: Math.round(sentimentScore * 10) / 10,
      responseRate,
      
      tldrBullets,
      thematics,
      whatPeopleLove,
      whatPeopleDislike,
      watchOuts,
      practicalTips,
      
      signals: {
        last30Days: last30,
        last90Days: last90,
        last365Days: last365,
      },
      starDistribution,
    });
  } catch (error) {
    console.error('Error generating monthly report:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}

function truncateQuote(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

function generateTldrBullets(
  thematics: Array<{ themeName: string; avgSentimentScore: number; mentionCount: number }>,
  totalReviews: number,
  avgRating: number,
  avgSentiment: number
): string[] {
  const bullets: string[] = [];
  
  // Overall performance
  if (avgSentiment >= 7) {
    bullets.push(`Strong overall performance with a sentiment score of ${avgSentiment.toFixed(1)}/10.`);
  } else if (avgSentiment >= 5) {
    bullets.push(`Moderate performance with a sentiment score of ${avgSentiment.toFixed(1)}/10 - room for improvement.`);
  } else {
    bullets.push(`Performance needs attention. Average rating of ${avgRating.toFixed(1)}★ indicates significant issues.`);
  }
  
  // Top performer
  const topTheme = thematics[0];
  if (topTheme && topTheme.avgSentimentScore >= 7) {
    bullets.push(`${topTheme.themeName} is your strongest area at ${topTheme.avgSentimentScore.toFixed(1)}/10.`);
  }
  
  // Biggest concern
  const lowScorers = thematics.filter(t => t.avgSentimentScore < 5);
  if (lowScorers.length > 0) {
    const worst = lowScorers[lowScorers.length - 1];
    bullets.push(`${worst.themeName} needs immediate attention with only ${worst.avgSentimentScore.toFixed(1)}/10.`);
  }
  
  // Review volume
  if (totalReviews > 0) {
    bullets.push(`Based on ${totalReviews} reviews in this period.`);
  }
  
  return bullets.slice(0, 4);
}

function generatePracticalTips(
  thematics: Array<{ themeName: string; avgSentimentScore: number; category: string }>
): string[] {
  const tips: string[] = [];
  
  const lowThemes = thematics.filter(t => t.avgSentimentScore < 6);
  
  for (const theme of lowThemes.slice(0, 4)) {
    switch (theme.category) {
      case 'SERVICE':
        tips.push(`Review staffing levels and conduct service training to improve ${theme.themeName}.`);
        break;
      case 'PRODUCT':
        tips.push(`Schedule a menu review meeting to address ${theme.themeName} concerns.`);
        break;
      case 'CLEANLINESS':
        tips.push(`Increase cleaning frequency and implement checklists for ${theme.themeName}.`);
        break;
      case 'VALUE':
        tips.push(`Analyze pricing vs competitors and consider value-focused promotions.`);
        break;
      case 'AMBIANCE':
        tips.push(`Conduct a facility walkthrough to address ${theme.themeName} issues.`);
        break;
      default:
        tips.push(`Create an action plan to address ${theme.themeName} feedback.`);
    }
  }
  
  if (tips.length === 0) {
    tips.push('Continue monitoring customer feedback to maintain current performance.');
    tips.push('Consider implementing a customer loyalty program to boost engagement.');
  }
  
  return tips.slice(0, 4);
}
