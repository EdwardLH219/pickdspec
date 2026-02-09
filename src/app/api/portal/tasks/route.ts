/**
 * Portal API: Tasks
 * 
 * Manage tasks, mark complete, view FixScore with "insufficient data" messaging.
 * 
 * RBAC: User must have access to the requested tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { hasTenantAccess, hasPermission } from '@/server/auth/rbac';
import { db } from '@/server/db';
import { TaskStatus } from '@prisma/client';

/**
 * GET /api/portal/tasks
 * Get tasks with FixScore data
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const status = searchParams.get('status') as TaskStatus | null;
    const themeId = searchParams.get('themeId');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    // Check tenant access
    if (!hasTenantAccess(session.user, tenantId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Build where clause
    const where: Record<string, unknown> = { tenantId };
    if (status) where.status = status;
    if (themeId) where.themeId = themeId;

    // Get tasks with related data
    const tasks = await db.task.findMany({
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
            id: true,
            fixScore: true,
            deltaS: true,
            confidenceLevel: true,
            createdAt: true,
          },
        },
      },
      orderBy: [
        { status: 'asc' },
        { priority: 'desc' },
        { dueDate: 'asc' },
      ],
    });

    // Format tasks with FixScore messaging
    const formattedTasks = tasks.map(task => {
      const latestFixScore = task.fixScores[0];
      let fixScoreStatus: 'pending' | 'insufficient_data' | 'available' = 'pending';
      let fixScoreMessage: string | null = null;

      if (task.status === 'COMPLETED' && task.completedAt) {
        if (latestFixScore) {
          if (latestFixScore.confidenceLevel === 'INSUFFICIENT') {
            fixScoreStatus = 'insufficient_data';
            fixScoreMessage = 'Not enough reviews in the measurement period to calculate impact. Check back after more reviews come in.';
          } else {
            fixScoreStatus = 'available';
          }
        } else {
          fixScoreStatus = 'pending';
          fixScoreMessage = 'Impact score is being calculated...';
        }
      }

      return {
        id: task.id,
        tenantId: task.tenantId,
        themeId: task.themeId,
        themeName: task.theme?.name ?? null,
        themeCategory: task.theme?.category ?? null,
        recommendationId: task.recommendationId,
        recommendationTitle: task.recommendation?.title ?? null,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        completedAt: task.completedAt,
        createdAt: task.createdAt,
        assignee: task.assignedTo 
          ? { 
              id: task.assignedTo.id, 
              name: `${task.assignedTo.firstName} ${task.assignedTo.lastName}`.trim() || task.assignedTo.email,
            }
          : null,
        createdBy: task.createdBy
          ? { id: task.createdBy.id, name: `${task.createdBy.firstName} ${task.createdBy.lastName}`.trim() }
          : null,
        fixScore: latestFixScore ? {
          status: fixScoreStatus,
          message: fixScoreMessage,
          score: fixScoreStatus === 'available' ? latestFixScore.fixScore : null,
          deltaS: fixScoreStatus === 'available' ? latestFixScore.deltaS : null,
          confidence: latestFixScore.confidenceLevel,
          calculatedAt: latestFixScore.createdAt,
        } : null,
        isOverdue: task.dueDate && task.status !== 'COMPLETED' && task.status !== 'CANCELLED' 
          ? new Date(task.dueDate) < new Date() 
          : false,
      };
    });

    // Get stats
    const stats = {
      total: tasks.length,
      byStatus: {
        pending: tasks.filter(t => t.status === 'PENDING').length,
        inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
        completed: tasks.filter(t => t.status === 'COMPLETED').length,
        cancelled: tasks.filter(t => t.status === 'CANCELLED').length,
      },
      overdue: formattedTasks.filter(t => t.isOverdue).length,
      completionRate: tasks.length > 0 
        ? Math.round((tasks.filter(t => t.status === 'COMPLETED').length / tasks.length) * 100)
        : 0,
    };

    // Get themes for filter dropdown
    const themesWithTasks = await db.theme.findMany({
      where: {
        tasks: { some: { tenantId } },
      },
      select: { id: true, name: true },
    });

    return NextResponse.json({
      tasks: formattedTasks,
      stats,
      themes: themesWithTasks,
    });

  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/portal/tasks
 * Create a new task
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permission
    if (!hasPermission(session.user.role, 'tasks', 'create')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const { tenantId, themeId, recommendationId, title, description, priority, dueDate, assignedToId } = body;

    if (!tenantId || !title) {
      return NextResponse.json({ error: 'tenantId and title are required' }, { status: 400 });
    }

    // Check tenant access
    if (!hasTenantAccess(session.user, tenantId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const validPriorities = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as const;
    type TaskPriority = typeof validPriorities[number];
    
    const taskPriority = validPriorities.includes(priority as TaskPriority) 
      ? priority as TaskPriority
      : 'MEDIUM';
    
    const task = await db.task.create({
      data: {
        tenantId,
        themeId,
        recommendationId,
        title,
        description,
        priority: taskPriority,
        dueDate: dueDate ? new Date(dueDate) : null,
        assignedToId,
        createdById: session.user.id,
        status: 'PENDING',
      },
      include: {
        theme: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return NextResponse.json({ task }, { status: 201 });

  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
