/**
 * Portal API: Theme Breakdown
 * 
 * Get theme analysis and sentiment breakdown.
 * 
 * RBAC: User must have access to the requested tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { hasTenantAccess } from '@/server/auth/rbac';
import { db } from '@/server/db';

/**
 * GET /api/portal/themes
 * Get theme breakdown with scores and review counts
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

    // Get tenant's organization for themes
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { organizationId: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Get latest score run
    const latestRun = await db.scoreRun.findFirst({
      where: { tenantId, status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      select: { id: true },
    });

    // Get themes with their scores from latest run
    const themes = await db.theme.findMany({
      where: {
        OR: [
          { isSystem: true },
          { organizationId: tenant.organizationId },
        ],
      },
      include: {
        themeScores: latestRun ? {
          where: { scoreRunId: latestRun.id },
          take: 1,
          select: {
            themeSentiment: true,
            themeScore010: true,
            mentionCount: true,
            severity: true,
            sumWeightedImpact: true,
            sumAbsWeightedImpact: true,
          },
        } : false,
        reviewThemes: {
          where: {
            review: { tenantId },
          },
          select: {
            sentiment: true,
            confidenceScore: true,
          },
        },
      },
    });

    // Calculate theme statistics
    const themeBreakdown = themes
      .filter(t => t.reviewThemes.length > 0 || (t.themeScores && t.themeScores.length > 0))
      .map(t => {
        const themeScore = t.themeScores?.[0];
        const reviewCount = t.reviewThemes.length;
        
        // Calculate sentiment distribution from review themes
        const sentimentCounts = {
          positive: t.reviewThemes.filter((rt: { sentiment: string }) => rt.sentiment === 'POSITIVE').length,
          neutral: t.reviewThemes.filter((rt: { sentiment: string }) => rt.sentiment === 'NEUTRAL').length,
          negative: t.reviewThemes.filter((rt: { sentiment: string }) => rt.sentiment === 'NEGATIVE').length,
        };
        
        const avgConfidence = reviewCount > 0
          ? t.reviewThemes.reduce((sum: number, rt: { confidenceScore: number }) => sum + rt.confidenceScore, 0) / reviewCount
          : 0;

        return {
          id: t.id,
          name: t.name,
          category: t.category,
          description: t.description,
          isSystemTheme: t.isSystem,
          reviewCount,
          score010: themeScore?.themeScore010 ?? 5,
          sentiment: themeScore?.themeSentiment ?? 0,
          mentions: themeScore?.mentionCount ?? reviewCount,
          severity: themeScore?.severity ?? 0,
          avgConfidence: Math.round(avgConfidence * 100) / 100,
          sentimentDistribution: sentimentCounts,
          sentimentPercentages: {
            positive: reviewCount > 0 ? Math.round((sentimentCounts.positive / reviewCount) * 100) : 0,
            neutral: reviewCount > 0 ? Math.round((sentimentCounts.neutral / reviewCount) * 100) : 0,
            negative: reviewCount > 0 ? Math.round((sentimentCounts.negative / reviewCount) * 100) : 0,
          },
        };
      })
      .sort((a, b) => b.mentions - a.mentions);

    // Calculate totals
    const totals = {
      totalThemes: themeBreakdown.length,
      totalMentions: themeBreakdown.reduce((sum, t) => sum + t.mentions, 0),
      avgScore: themeBreakdown.length > 0
        ? Math.round((themeBreakdown.reduce((sum, t) => sum + t.score010, 0) / themeBreakdown.length) * 10) / 10
        : 5,
      mostMentioned: themeBreakdown[0] || null,
      mostPositive: [...themeBreakdown].sort((a, b) => b.sentiment - a.sentiment)[0] || null,
      mostNegative: [...themeBreakdown].sort((a, b) => a.sentiment - b.sentiment)[0] || null,
    };

    // Group by category
    const byCategory = themeBreakdown.reduce((acc, theme) => {
      const cat = theme.category || 'OTHER';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(theme);
      return acc;
    }, {} as Record<string, typeof themeBreakdown>);

    return NextResponse.json({
      themes: themeBreakdown,
      byCategory,
      totals,
    });

  } catch (error) {
    console.error('Error fetching theme breakdown:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
