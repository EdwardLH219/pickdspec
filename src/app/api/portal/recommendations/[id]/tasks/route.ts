/**
 * Create Tasks from Recommendation API
 * 
 * POST: Create tasks from recommendation's suggested actions
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { hasTenantAccess } from '@/server/auth/rbac';
import { createTasksFromRecommendation } from '@/server/recommendations';
import { db } from '@/server/db';
import { z } from 'zod';

const createTasksSchema = z.object({
  assignedToId: z.string().optional(),
  dueDaysFromNow: z.number().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Check recommendation exists and tenant access
  const recommendation = await db.recommendation.findUnique({
    where: { id },
    select: { tenantId: true },
  });

  if (!recommendation) {
    return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });
  }

  if (!hasTenantAccess(session.user, recommendation.tenantId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const options = createTasksSchema.parse(body);

    const tasks = await createTasksFromRecommendation(
      id,
      session.user.id,
      options
    );

    return NextResponse.json({ tasks, count: tasks.length }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('Error creating tasks from recommendation:', error);
    return NextResponse.json({ error: 'Failed to create tasks' }, { status: 500 });
  }
}
