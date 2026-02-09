/**
 * Portal API: Recommendations
 * 
 * Returns severity-ranked recommendations (from theme scores).
 * Allows creating tasks from recommendations.
 * 
 * RBAC: User must have access to the requested tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { hasTenantAccess, hasPermission } from '@/server/auth/rbac';
import { db } from '@/server/db';

/**
 * GET /api/portal/recommendations
 * Get severity-ranked recommendations based on theme scores
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const status = searchParams.get('status'); // OPEN, IN_PROGRESS, RESOLVED, DISMISSED

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    // Check tenant access
    if (!hasTenantAccess(session.user, tenantId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Build where clause
    const where: Record<string, unknown> = { tenantId };
    if (status) {
      where.status = status;
    }

    // Get recommendations with theme and task info
    const recommendations = await db.recommendation.findMany({
      where,
      include: {
        theme: { select: { id: true, name: true, category: true } },
        tasks: {
          select: {
            id: true,
            status: true,
            title: true,
          },
        },
      },
      orderBy: [
        { severity: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    // Map severity enum to numeric value for sorting
    const severityValue = (s: string) => {
      switch (s) {
        case 'CRITICAL': return 5;
        case 'HIGH': return 4;
        case 'MEDIUM': return 3;
        case 'LOW': return 2;
        default: return 1;
      }
    };

    // Calculate severity for sorting
    const rankedRecommendations = recommendations
      .map(rec => ({
        id: rec.id,
        tenantId: rec.tenantId,
        themeId: rec.themeId,
        themeName: rec.theme?.name ?? 'General',
        themeCategory: rec.theme?.category ?? null,
        title: rec.title,
        description: rec.description,
        priority: rec.severity, // Map severity to priority for frontend
        status: rec.status,
        severity: severityValue(rec.severity),
        sentiment: 0,
        score010: 5,
        mentions: 0,
        suggestedActions: rec.suggestedActions,
        estimatedImpact: rec.estimatedImpact,
        taskCount: rec.tasks.length,
        pendingTaskCount: rec.tasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS').length,
        createdAt: rec.createdAt,
        updatedAt: rec.updatedAt,
      }))
      .sort((a, b) => b.severity - a.severity);

    // Get stats
    const stats = {
      total: recommendations.length,
      byPriority: {
        high: recommendations.filter(r => r.severity === 'HIGH' || r.severity === 'CRITICAL').length,
        medium: recommendations.filter(r => r.severity === 'MEDIUM').length,
        low: recommendations.filter(r => r.severity === 'LOW').length,
      },
      byStatus: {
        open: recommendations.filter(r => r.status === 'OPEN').length,
        inProgress: recommendations.filter(r => r.status === 'IN_PROGRESS').length,
        resolved: recommendations.filter(r => r.status === 'RESOLVED').length,
        dismissed: recommendations.filter(r => r.status === 'DISMISSED').length,
      },
    };

    return NextResponse.json({
      recommendations: rankedRecommendations,
      stats,
    });

  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/portal/recommendations
 * Create tasks from a recommendation
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
    const { recommendationId, tasks } = body;

    if (!recommendationId || !tasks || !Array.isArray(tasks)) {
      return NextResponse.json({ error: 'recommendationId and tasks array required' }, { status: 400 });
    }

    // Get the recommendation
    const recommendation = await db.recommendation.findUnique({
      where: { id: recommendationId },
      select: { tenantId: true, themeId: true },
    });

    if (!recommendation) {
      return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });
    }

    // Check tenant access
    if (!hasTenantAccess(session.user, recommendation.tenantId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Create tasks
    const validPriorities = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as const;
    type TaskPriority = typeof validPriorities[number];
    
    const createdTasks = await db.$transaction(
      tasks.map((task: { title: string; description?: string; priority?: string; dueDate?: string; assignedToId?: string }) => {
        const priority = validPriorities.includes(task.priority as TaskPriority) 
          ? task.priority as TaskPriority
          : 'MEDIUM';
        return db.task.create({
          data: {
            tenantId: recommendation.tenantId,
            recommendationId,
            themeId: recommendation.themeId,
            title: task.title,
            description: task.description,
            priority,
            dueDate: task.dueDate ? new Date(task.dueDate) : null,
            assignedToId: task.assignedToId,
            createdById: session.user.id,
            status: 'PENDING',
          },
        });
      })
    );

    // Update recommendation status to IN_PROGRESS
    await db.recommendation.update({
      where: { id: recommendationId },
      data: { status: 'IN_PROGRESS' },
    });

    return NextResponse.json({
      success: true,
      tasks: createdTasks,
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating tasks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
