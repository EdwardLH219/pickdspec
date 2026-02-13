/**
 * Tasks API
 * 
 * GET: List tasks for tenant
 * POST: Create new task
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { hasTenantAccess } from '@/server/auth/rbac';
import { createTask } from '@/server/recommendations';
import { db } from '@/server/db';
import { TaskStatus, TaskPriority } from '@prisma/client';
import { z } from 'zod';

const createTaskSchema = z.object({
  recommendationId: z.string().optional(),
  themeId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  assignedToId: z.string().optional(),
  dueDate: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
});

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

  const statusFilter = searchParams.get('status') as TaskStatus | null;
  const themeIdFilter = searchParams.get('themeId') || undefined;
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  // Build where clause
  const where = {
    tenantId,
    ...(statusFilter && { status: statusFilter }),
    ...(themeIdFilter && themeIdFilter !== 'all' && { themeId: themeIdFilter }),
  };

  // Get tasks with related data
  const [tasks, statusCounts, themes] = await Promise.all([
    db.task.findMany({
      where,
      include: {
        theme: { select: { id: true, name: true, category: true } },
        recommendation: { select: { id: true, title: true, severity: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        fixScores: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            fixScore: true,
            deltaS: true,
            confidenceLevel: true,
            confidence: true,
            createdAt: true,
            reviewCountPre: true,
            reviewCountPost: true,
          },
        },
      },
      orderBy: [
        { priority: 'asc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
      take: limit,
      skip: offset,
    }),
    // Get stats by status
    db.task.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: true,
    }),
    // Get themes for filter dropdown (themes are organization-wide, not tenant-specific)
    db.theme.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  // Calculate stats
  const now = new Date();
  const overdueTasks = tasks.filter(t => 
    t.dueDate && 
    t.dueDate < now && 
    t.status !== TaskStatus.COMPLETED && 
    t.status !== TaskStatus.CANCELLED
  );

  const statusMap = new Map(statusCounts.map(s => [s.status, s._count]));
  const total = statusCounts.reduce((sum, s) => sum + s._count, 0);
  const completed = statusMap.get(TaskStatus.COMPLETED) || 0;

  const stats = {
    total,
    byStatus: {
      pending: statusMap.get(TaskStatus.PENDING) || 0,
      inProgress: statusMap.get(TaskStatus.IN_PROGRESS) || 0,
      completed,
      cancelled: statusMap.get(TaskStatus.CANCELLED) || 0,
    },
    overdue: overdueTasks.length,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
  };

  // Get economic impacts for recommendations linked to tasks
  const recIds = tasks
    .map(t => t.recommendationId)
    .filter((id): id is string => id !== null);
  
  const economicImpacts = recIds.length > 0
    ? await db.recommendationEconomicImpact.findMany({
        where: { recommendationId: { in: recIds } },
        orderBy: { createdAt: 'desc' },
        distinct: ['recommendationId'],
        select: {
          recommendationId: true,
          revenueAtRiskMin: true,
          revenueAtRiskMax: true,
          revenueAtRiskMid: true,
          revenueUpsideMin: true,
          revenueUpsideMax: true,
          revenueUpsideMid: true,
          footfallAtRiskMin: true,
          footfallAtRiskMax: true,
          footfallUpsideMin: true,
          footfallUpsideMax: true,
          impactDriver: true,
          confidenceLevel: true,
          dataQualityScore: true,
          currency: true,
        },
      })
    : [];

  const impactMap = new Map(economicImpacts.map(ei => [ei.recommendationId, ei]));

  // Transform tasks for frontend
  const transformed = tasks.map(task => {
    const isOverdue = !!(
      task.dueDate &&
      task.dueDate < now &&
      task.status !== TaskStatus.COMPLETED &&
      task.status !== TaskStatus.CANCELLED
    );

    const fixScore = task.fixScores[0];
    let fixScoreData = null;
    
    // Get economic impact from linked recommendation
    const economicImpact = task.recommendationId ? impactMap.get(task.recommendationId) : null;

    if (task.status === TaskStatus.COMPLETED) {
      if (!fixScore) {
        fixScoreData = {
          status: 'pending' as const,
          message: null,
          score: null,
          deltaS: null,
          confidence: 'LOW',
          calculatedAt: '',
        };
      } else {
        // Check if there's sufficient data based on review counts
        const preCount = fixScore.reviewCountPre;
        const postCount = fixScore.reviewCountPost;
        
        if (preCount < 3 || postCount < 3) {
          fixScoreData = {
            status: 'insufficient_data' as const,
            message: `Need more reviews. Pre: ${preCount}, Post: ${postCount} (min 3 each)`,
            score: fixScore.fixScore,
            deltaS: fixScore.deltaS,
            confidence: fixScore.confidenceLevel,
            calculatedAt: fixScore.createdAt.toISOString(),
          };
        } else {
          fixScoreData = {
            status: 'available' as const,
            message: null,
            score: fixScore.fixScore,
            deltaS: fixScore.deltaS,
            confidence: fixScore.confidenceLevel,
            calculatedAt: fixScore.createdAt.toISOString(),
          };
        }
      }
    }

    return {
      id: task.id,
      tenantId: task.tenantId,
      themeId: task.themeId,
      themeName: task.theme?.name || null,
      themeCategory: task.theme?.category || null,
      recommendationId: task.recommendationId,
      recommendationTitle: task.recommendation?.title || null,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate?.toISOString() || null,
      completedAt: task.completedAt?.toISOString() || null,
      createdAt: task.createdAt.toISOString(),
      assignee: task.assignedTo ? {
        id: task.assignedTo.id,
        name: `${task.assignedTo.firstName || ''} ${task.assignedTo.lastName || ''}`.trim() || task.assignedTo.email,
      } : null,
      createdBy: task.createdBy ? {
        id: task.createdBy.id,
        name: `${task.createdBy.firstName || ''} ${task.createdBy.lastName || ''}`.trim(),
      } : null,
      fixScore: fixScoreData,
      isOverdue,
      // Economic impact data from linked recommendation
      economicImpact: economicImpact ? {
        revenueUpside: economicImpact.revenueUpsideMin !== null ? {
          min: economicImpact.revenueUpsideMin,
          max: economicImpact.revenueUpsideMax,
          mid: economicImpact.revenueUpsideMid,
        } : null,
        footfallUpside: economicImpact.footfallUpsideMin !== null ? {
          min: economicImpact.footfallUpsideMin,
          max: economicImpact.footfallUpsideMax,
        } : null,
        impactDriver: economicImpact.impactDriver,
        confidenceLevel: economicImpact.confidenceLevel,
        currency: economicImpact.currency,
      } : null,
    };
  });

  return NextResponse.json({ tasks: transformed, stats, themes });
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

    if (!hasTenantAccess(session.user, tenantId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = createTaskSchema.parse(body);

    const task = await createTask({
      tenantId,
      ...data,
      createdById: session.user.id,
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('Error creating task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
