/**
 * Activation Drafts API
 * 
 * GET: List activation drafts for tenant
 * POST: Generate drafts for a specific task
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { hasTenantAccess } from '@/server/auth/rbac';
import { db } from '@/server/db';
import { ActivationDraftStatus, ActivationDraftType } from '@prisma/client';
import { generateDraftsForTask } from '@/server/activations';
import { z } from 'zod';

const generateDraftsSchema = z.object({
  taskId: z.string().uuid(),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') || session.user.tenantAccess?.[0];
  
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
  }

  if (!hasTenantAccess(session.user, tenantId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Parse filters
  const statusFilter = searchParams.get('status') as ActivationDraftStatus | null;
  const typeFilter = searchParams.get('type') as ActivationDraftType | null;
  const taskId = searchParams.get('taskId') || undefined;
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  // Build where clause
  const where = {
    tenantId,
    ...(statusFilter && { status: statusFilter }),
    ...(typeFilter && { draftType: typeFilter }),
    ...(taskId && { taskId }),
  };

  // Fetch drafts with related data
  const [drafts, totalCount, statusCounts] = await Promise.all([
    db.activationDraft.findMany({
      where,
      include: {
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            completedAt: true,
          },
        },
        theme: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    db.activationDraft.count({ where }),
    db.activationDraft.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { status: true },
    }),
  ]);

  // Transform for response
  const transformed = drafts.map(draft => ({
    id: draft.id,
    tenantId: draft.tenantId,
    taskId: draft.taskId,
    themeId: draft.themeId,
    draftType: draft.draftType,
    title: draft.title,
    content: draft.content,
    metadata: draft.metadata,
    deltaS: draft.deltaS,
    fixScore: draft.fixScore,
    themeCategory: draft.themeCategory,
    status: draft.status,
    publishedAt: draft.publishedAt?.toISOString() || null,
    publishedBy: draft.publishedBy,
    publishNotes: draft.publishNotes,
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
    task: draft.task,
    theme: draft.theme,
  }));

  // Format status counts
  const counts = statusCounts.reduce((acc, { status, _count }) => {
    acc[status] = _count.status;
    return acc;
  }, {} as Record<string, number>);

  return NextResponse.json({
    drafts: transformed,
    pagination: {
      total: totalCount,
      limit,
      offset,
      hasMore: offset + drafts.length < totalCount,
    },
    statusCounts: {
      DRAFT: counts.DRAFT || 0,
      MARKED_PUBLISHED: counts.MARKED_PUBLISHED || 0,
      ARCHIVED: counts.ARCHIVED || 0,
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { taskId } = generateDraftsSchema.parse(body);

    // Get task to verify access
    const task = await db.task.findUnique({
      where: { id: taskId },
      select: { tenantId: true },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (!hasTenantAccess(session.user, task.tenantId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Generate drafts
    const result = await generateDraftsForTask(taskId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Fetch the created drafts
    const createdDrafts = await db.activationDraft.findMany({
      where: { id: { in: result.draftIds } },
      include: {
        task: { select: { id: true, title: true } },
        theme: { select: { id: true, name: true, category: true } },
      },
    });

    return NextResponse.json({
      success: true,
      drafts: createdDrafts.map(draft => ({
        id: draft.id,
        draftType: draft.draftType,
        title: draft.title,
        content: draft.content,
        metadata: draft.metadata,
        status: draft.status,
        createdAt: draft.createdAt.toISOString(),
        task: draft.task,
        theme: draft.theme,
      })),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: error.issues }, { status: 400 });
    }
    console.error('Failed to generate activation drafts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
