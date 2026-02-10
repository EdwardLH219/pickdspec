/**
 * Recommendations API
 * 
 * GET: List recommendations for tenant
 * POST: Create manual recommendation
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { hasTenantAccess } from '@/server/auth/rbac';
import { db } from '@/server/db';
import { RecommendationSeverity, RecommendationStatus, RecommendationCategory, TaskStatus } from '@prisma/client';
import { z } from 'zod';

const createRecommendationSchema = z.object({
  themeId: z.string().optional(),
  severity: z.nativeEnum(RecommendationSeverity),
  category: z.nativeEnum(RecommendationCategory).default(RecommendationCategory.IMPROVEMENT),
  title: z.string().min(1),
  description: z.string().optional(),
  suggestedActions: z.array(z.string()).default([]),
  estimatedImpact: z.string().optional(),
});

// Map severity enum to priority for UI
const severityToPriority: Record<RecommendationSeverity, string> = {
  [RecommendationSeverity.CRITICAL]: 'HIGH',
  [RecommendationSeverity.HIGH]: 'HIGH',
  [RecommendationSeverity.MEDIUM]: 'MEDIUM',
  [RecommendationSeverity.LOW]: 'LOW',
};

// Map severity to numeric value for sorting
const severityToNumeric: Record<RecommendationSeverity, number> = {
  [RecommendationSeverity.CRITICAL]: 5,
  [RecommendationSeverity.HIGH]: 4,
  [RecommendationSeverity.MEDIUM]: 2,
  [RecommendationSeverity.LOW]: 1,
};

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse query params
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') || session.user.tenantAccess?.[0];
  
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
  }

  // Check access
  if (!hasTenantAccess(session.user, tenantId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const statusFilter = searchParams.get('status') as RecommendationStatus | null;
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  // Build where clause
  const where = {
    tenantId,
    ...(statusFilter && { status: statusFilter }),
  };

  // Get recommendations with related data
  const [recommendations, counts] = await Promise.all([
    db.recommendation.findMany({
      where,
      include: {
        theme: {
          select: { id: true, name: true, category: true },
        },
        tasks: {
          select: { id: true, status: true },
        },
      },
      orderBy: [
        { severity: 'asc' }, // CRITICAL first
        { createdAt: 'desc' },
      ],
      take: limit,
      skip: offset,
    }),
    // Get stats
    db.recommendation.groupBy({
      by: ['status', 'severity'],
      where: { tenantId },
      _count: true,
    }),
  ]);

  // Calculate stats
  const stats = {
    total: counts.reduce((sum, c) => sum + c._count, 0),
    byPriority: {
      high: counts
        .filter(c => c.severity === 'CRITICAL' || c.severity === 'HIGH')
        .reduce((sum, c) => sum + c._count, 0),
      medium: counts
        .filter(c => c.severity === 'MEDIUM')
        .reduce((sum, c) => sum + c._count, 0),
      low: counts
        .filter(c => c.severity === 'LOW')
        .reduce((sum, c) => sum + c._count, 0),
    },
    byStatus: {
      open: counts.filter(c => c.status === 'OPEN').reduce((sum, c) => sum + c._count, 0),
      inProgress: counts.filter(c => c.status === 'IN_PROGRESS').reduce((sum, c) => sum + c._count, 0),
      resolved: counts.filter(c => c.status === 'RESOLVED').reduce((sum, c) => sum + c._count, 0),
      dismissed: counts.filter(c => c.status === 'DISMISSED').reduce((sum, c) => sum + c._count, 0),
    },
  };

  // Get theme scores to enrich recommendations
  const themeIds = recommendations.map(r => r.themeId).filter(Boolean) as string[];
  const themeScores = themeIds.length > 0
    ? await db.themeScore.findMany({
        where: { themeId: { in: themeIds }, tenantId },
        orderBy: { createdAt: 'desc' },
        distinct: ['themeId'],
        select: {
          themeId: true,
          themeSentiment: true,
          themeScore010: true,
          severity: true,
          mentionCount: true,
          negativeCount: true,
          neutralCount: true,
        },
      })
    : [];

  const themeScoreMap = new Map(themeScores.map(ts => [ts.themeId, ts]));

  // Transform for frontend
  const transformed = recommendations.map(rec => {
    const themeScore = rec.themeId ? themeScoreMap.get(rec.themeId) : null;
    const taskCount = rec.tasks.length;
    const pendingTaskCount = rec.tasks.filter(t => 
      t.status === TaskStatus.PENDING || t.status === TaskStatus.IN_PROGRESS
    ).length;

    return {
      id: rec.id,
      themeId: rec.themeId || '',
      themeName: rec.theme?.name || 'General',
      themeCategory: rec.theme?.category || null,
      title: rec.title,
      description: rec.description,
      priority: severityToPriority[rec.severity],
      status: rec.status,
      severity: severityToNumeric[rec.severity],
      sentiment: themeScore?.themeSentiment ?? 0,
      score010: themeScore?.themeScore010 ?? 5,
      mentions: (themeScore?.negativeCount ?? 0) + (themeScore?.neutralCount ?? 0),
      suggestedActions: rec.suggestedActions as string[],
      estimatedImpact: rec.estimatedImpact,
      taskCount,
      pendingTaskCount,
      createdAt: rec.createdAt.toISOString(),
    };
  });

  return NextResponse.json({ recommendations: transformed, stats });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const tenantId = body.tenantId || session.user.tenantAccess?.[0];
    
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    // Check write access
    if (!hasTenantAccess(session.user, tenantId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = createRecommendationSchema.parse(body);

    const recommendation = await db.recommendation.create({
      data: {
        tenantId,
        themeId: data.themeId,
        severity: data.severity,
        category: data.category,
        title: data.title,
        description: data.description,
        suggestedActions: data.suggestedActions,
        estimatedImpact: data.estimatedImpact,
        autoGenerated: false,
      },
      include: {
        theme: { select: { id: true, name: true, category: true } },
      },
    });

    return NextResponse.json(recommendation, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('Error creating recommendation:', error);
    return NextResponse.json({ error: 'Failed to create recommendation' }, { status: 500 });
  }
}
