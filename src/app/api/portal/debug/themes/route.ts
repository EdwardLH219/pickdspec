import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { db } from '@/server/db';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = request.nextUrl.searchParams.get('tenantId') || session.user.tenantAccess?.[0];
  
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant access' }, { status: 403 });
  }
  
  try {
    // Get all themes
    const themes = await db.theme.findMany({
      select: { id: true, name: true, category: true },
      orderBy: { name: 'asc' },
    });

    // Get review counts per theme
    const themeCounts: Record<string, number> = {};
    for (const theme of themes) {
      const count = await db.reviewTheme.count({ where: { themeId: theme.id } });
      themeCounts[theme.id] = count;
    }

    // Get recent reviews with their theme associations
    const recentReviews = await db.review.findMany({
      where: { 
        connector: { tenantId },
        reviewDate: { gte: new Date('2026-01-26') }
      },
      include: { 
        reviewThemes: { 
          include: { theme: { select: { id: true, name: true } } }
        }
      },
      orderBy: { reviewDate: 'desc' },
      take: 10,
    });

    // Get tasks with their themes
    const tasks = await db.task.findMany({
      where: { tenantId },
      include: { 
        theme: { select: { id: true, name: true } },
        fixScore: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return NextResponse.json({
      themes: themes.map(t => ({
        ...t,
        reviewCount: themeCounts[t.id] || 0,
      })),
      recentReviews: recentReviews.map(r => ({
        id: r.id,
        date: r.reviewDate,
        contentPreview: r.content?.slice(0, 100),
        themes: r.reviewThemes.map(rt => ({
          themeId: rt.themeId,
          themeName: rt.theme.name,
          sentiment: rt.sentiment,
        })),
      })),
      tasks: tasks.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        themeId: t.themeId,
        themeName: t.theme?.name,
        completedAt: t.completedAt,
        hasFixScore: !!t.fixScore,
        fixScore: t.fixScore ? {
          deltaS: t.fixScore.deltaS,
          confidence: t.fixScore.confidence,
          fixScore: t.fixScore.fixScore,
          reviewCountPre: t.fixScore.reviewCountPre,
          reviewCountPost: t.fixScore.reviewCountPost,
        } : null,
      })),
    });
  } catch (error) {
    console.error('Debug themes error:', error);
    return NextResponse.json({ error: 'Failed to fetch debug data' }, { status: 500 });
  }
}
