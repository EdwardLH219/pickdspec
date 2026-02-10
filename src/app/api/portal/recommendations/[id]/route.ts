/**
 * Single Recommendation API
 * 
 * GET: Get recommendation details
 * PATCH: Update recommendation status
 * DELETE: Delete recommendation
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { hasTenantAccess } from '@/server/auth/rbac';
import { updateRecommendationStatus } from '@/server/recommendations';
import { db } from '@/server/db';
import { RecommendationStatus } from '@prisma/client';
import { z } from 'zod';

const updateSchema = z.object({
  status: z.nativeEnum(RecommendationStatus),
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
  
  const recommendation = await db.recommendation.findUnique({
    where: { id },
    include: {
      theme: { select: { id: true, name: true, category: true } },
      tasks: {
        include: {
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
          fixScores: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
    },
  });

  if (!recommendation) {
    return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });
  }

  // Check tenant access
  if (!hasTenantAccess(session.user, recommendation.tenantId, 'read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(recommendation);
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

  // First get the recommendation to check tenant
  const existing = await db.recommendation.findUnique({
    where: { id },
    select: { tenantId: true },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });
  }

  if (!hasTenantAccess(session.user, existing.tenantId, 'write')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);

    const recommendation = await updateRecommendationStatus(
      id,
      data.status,
      session.user.id
    );

    return NextResponse.json(recommendation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('Error updating recommendation:', error);
    return NextResponse.json({ error: 'Failed to update recommendation' }, { status: 500 });
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

  const existing = await db.recommendation.findUnique({
    where: { id },
    select: { tenantId: true },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });
  }

  if (!hasTenantAccess(session.user, existing.tenantId, 'write')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await db.recommendation.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
