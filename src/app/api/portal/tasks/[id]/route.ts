/**
 * Portal API: Task by ID
 * 
 * Update task status, mark complete, delete.
 * 
 * RBAC: User must have access to the tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { hasTenantAccess, hasPermission } from '@/server/auth/rbac';
import { db } from '@/server/db';
import { TaskStatus } from '@prisma/client';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/portal/tasks/[id]
 * Get task details with FixScore
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const task = await db.task.findUnique({
      where: { id },
      include: {
        theme: { select: { id: true, name: true, category: true } },
        recommendation: { 
          select: { 
            id: true, 
            title: true, 
            description: true,
            severity: true,
            suggestedActions: true,
          } 
        },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        fixScores: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            fixScore: true,
            deltaS: true,
            confidenceLevel: true,
            reviewCountPre: true,
            reviewCountPost: true,
            measurementStart: true,
            measurementEnd: true,
            createdAt: true,
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Check tenant access
    if (!hasTenantAccess(session.user, task.tenantId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({ task });

  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/portal/tasks/[id]
 * Update task (status, assignee, etc.)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permission
    if (!hasPermission(session.user.role, 'tasks', 'update')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, title, description, priority, dueDate, assignedToId } = body;

    // Get existing task
    const existing = await db.task.findUnique({
      where: { id },
      select: { tenantId: true, status: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Check tenant access
    if (!hasTenantAccess(session.user, existing.tenantId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (priority !== undefined) updateData.priority = priority;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (assignedToId !== undefined) updateData.assignedToId = assignedToId;
    
    if (status !== undefined) {
      updateData.status = status;
      // Set completedAt when marking complete
      if (status === 'COMPLETED' && existing.status !== 'COMPLETED') {
        updateData.completedAt = new Date();
      } else if (status !== 'COMPLETED' && existing.status === 'COMPLETED') {
        updateData.completedAt = null;
      }
    }

    const task = await db.task.update({
      where: { id },
      data: updateData,
      include: {
        theme: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return NextResponse.json({ task });

  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/portal/tasks/[id]
 * Delete a task
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permission
    if (!hasPermission(session.user.role, 'tasks', 'delete')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { id } = await params;

    // Get existing task
    const existing = await db.task.findUnique({
      where: { id },
      select: { tenantId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Check tenant access
    if (!hasTenantAccess(session.user, existing.tenantId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await db.task.delete({ where: { id } });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
