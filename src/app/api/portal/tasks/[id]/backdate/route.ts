/**
 * Backdate task completion - for testing FixScore
 * POST: Updates the task's completedAt date
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { hasTenantAccess } from '@/server/auth/rbac';
import { db } from '@/server/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { completedAt } = body;

  if (!completedAt) {
    return NextResponse.json({ error: 'completedAt is required' }, { status: 400 });
  }

  // Get the task
  const task = await db.task.findUnique({
    where: { id },
    select: { id: true, tenantId: true },
  });

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  if (!hasTenantAccess(session.user, task.tenantId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const updated = await db.task.update({
    where: { id },
    data: { completedAt: new Date(completedAt) },
    select: { id: true, title: true, completedAt: true },
  });

  return NextResponse.json({
    success: true,
    task: updated,
    message: `Task completion backdated to ${updated.completedAt?.toISOString()}`,
  });
}
