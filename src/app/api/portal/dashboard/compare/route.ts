/**
 * Dashboard Branch Comparison API
 * 
 * GET: Fetch theme scores comparison across all user's branches
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { db } from '@/server/db';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all tenants the user has access to
    let tenantIds: string[] = [];
    
    if (session.user.isPickdStaff) {
      // Pick'd staff can see all tenants
      const allTenants = await db.tenant.findMany({
        select: { id: true },
      });
      tenantIds = allTenants.map(t => t.id);
    } else {
      tenantIds = session.user.tenantAccess || [];
    }

    if (tenantIds.length === 0) {
      return NextResponse.json({ 
        hasData: false, 
        message: 'No branches available',
        branches: [],
        themes: [],
        comparison: [],
      });
    }

    // Get tenant details
    const tenants = await db.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true },
    });

    // Get the latest score run for each tenant
    const latestRuns = await db.scoreRun.findMany({
      where: {
        tenantId: { in: tenantIds },
        status: 'COMPLETED',
      },
      orderBy: { completedAt: 'desc' },
      distinct: ['tenantId'],
      select: {
        id: true,
        tenantId: true,
      },
    });

    if (latestRuns.length === 0) {
      return NextResponse.json({
        hasData: false,
        message: 'No scored data available for comparison',
        branches: tenants.map(t => ({ id: t.id, name: t.name })),
        themes: [],
        comparison: [],
      });
    }

    // Get theme scores for each tenant's latest run
    const themeScores = await db.themeScore.findMany({
      where: {
        scoreRunId: { in: latestRuns.map(r => r.id) },
      },
      include: {
        theme: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
        scoreRun: {
          select: {
            tenantId: true,
          },
        },
      },
    });

    // Get unique themes
    const themesMap = new Map<string, { id: string; name: string; category: string }>();
    themeScores.forEach(ts => {
      if (ts.theme && !themesMap.has(ts.theme.id)) {
        themesMap.set(ts.theme.id, {
          id: ts.theme.id,
          name: ts.theme.name,
          category: ts.theme.category,
        });
      }
    });
    const themes = Array.from(themesMap.values());

    // Build comparison data: for each theme, score per branch
    const comparison = themes.map(theme => {
      const branchScores: Record<string, { score: number; sentiment: number; mentions: number }> = {};
      
      tenants.forEach(tenant => {
        const score = themeScores.find(
          ts => ts.theme?.id === theme.id && ts.scoreRun.tenantId === tenant.id
        );
        
        if (score) {
          branchScores[tenant.id] = {
            score: score.score010,
            sentiment: score.avgSentiment,
            mentions: score.mentionCount,
          };
        } else {
          branchScores[tenant.id] = {
            score: 0,
            sentiment: 0,
            mentions: 0,
          };
        }
      });

      return {
        themeId: theme.id,
        themeName: theme.name,
        category: theme.category,
        branchScores,
      };
    });

    // Calculate overall scores per branch
    const branchSummaries = tenants.map(tenant => {
      const tenantScores = themeScores.filter(ts => ts.scoreRun.tenantId === tenant.id);
      const avgScore = tenantScores.length > 0
        ? tenantScores.reduce((sum, ts) => sum + ts.score010, 0) / tenantScores.length
        : 0;
      const totalMentions = tenantScores.reduce((sum, ts) => sum + ts.mentionCount, 0);
      
      return {
        id: tenant.id,
        name: tenant.name,
        avgScore: Math.round(avgScore * 10) / 10,
        totalMentions,
        themeCount: tenantScores.length,
      };
    });

    return NextResponse.json({
      hasData: true,
      branches: branchSummaries,
      themes: themes.sort((a, b) => a.name.localeCompare(b.name)),
      comparison: comparison.sort((a, b) => a.themeName.localeCompare(b.themeName)),
    });

  } catch (error) {
    console.error('Error fetching comparison data:', error);
    return NextResponse.json({ error: 'Failed to fetch comparison data' }, { status: 500 });
  }
}
