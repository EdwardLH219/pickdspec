/**
 * Single Task API
 * 
 * GET: Get task details (with FixScore history)
 * PATCH: Update task (triggers FixScore on completion)
 * DELETE: Delete task
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { hasTenantAccess } from '@/server/auth/rbac';
import { getTaskById, updateTask, deleteTask } from '@/server/recommendations';
import { db } from '@/server/db';
import { TaskStatus, TaskPriority } from '@prisma/client';
import { z } from 'zod';

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  assignedToId: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional().transform(v => v ? new Date(v) : v),
  impactNotes: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  
  const task = await getTaskById(id);

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  if (!hasTenantAccess(session.user, task.tenantId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(task);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Check task exists and tenant access
  const existing = await db.task.findUnique({
    where: { id },
    select: { tenantId: true },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  if (!hasTenantAccess(session.user, existing.tenantId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = updateTaskSchema.parse(body);

    const task = await updateTask(id, data, session.user.id);

    return NextResponse.json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('Error updating task:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const existing = await db.task.findUnique({
    where: { id },
    select: { tenantId: true },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  if (!hasTenantAccess(session.user, existing.tenantId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await deleteTask(id, session.user.id);

  return NextResponse.json({ success: true });
}
