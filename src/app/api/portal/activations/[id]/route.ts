/**
 * Activation Draft Detail API
 * 
 * GET: Get single draft
 * PATCH: Update draft status
 * DELETE: Delete draft
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { hasTenantAccess } from '@/server/auth/rbac';
import { db } from '@/server/db';
import { ActivationDraftStatus } from '@prisma/client';
import { z } from 'zod';

const updateDraftSchema = z.object({
  status: z.nativeEnum(ActivationDraftStatus).optional(),
  publishNotes: z.string().optional(),
  content: z.string().optional(),
  title: z.string().optional(),
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

  const draft = await db.activationDraft.findUnique({
    where: { id },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          completedAt: true,
          impactNotes: true,
        },
      },
      theme: {
        select: {
          id: true,
          name: true,
          category: true,
        },
      },
      tenant: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }

  if (!hasTenantAccess(session.user, draft.tenantId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    draft: {
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
      tenant: draft.tenant,
    },
  });
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

  // Get existing draft
  const existing = await db.activationDraft.findUnique({
    where: { id },
    select: { tenantId: true, status: true },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }

  if (!hasTenantAccess(session.user, existing.tenantId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const updates = updateDraftSchema.parse(body);

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (updates.status !== undefined) {
      updateData.status = updates.status;
      
      // If marking as published, record the publish details
      if (updates.status === 'MARKED_PUBLISHED') {
        updateData.publishedAt = new Date();
        updateData.publishedBy = session.user.id;
      }
    }

    if (updates.publishNotes !== undefined) {
      updateData.publishNotes = updates.publishNotes;
    }

    if (updates.content !== undefined) {
      updateData.content = updates.content;
    }

    if (updates.title !== undefined) {
      updateData.title = updates.title;
    }

    const updated = await db.activationDraft.update({
      where: { id },
      data: updateData,
      include: {
        task: { select: { id: true, title: true } },
        theme: { select: { id: true, name: true, category: true } },
      },
    });

    return NextResponse.json({
      success: true,
      draft: {
        id: updated.id,
        draftType: updated.draftType,
        title: updated.title,
        content: updated.content,
        status: updated.status,
        publishedAt: updated.publishedAt?.toISOString() || null,
        publishNotes: updated.publishNotes,
        updatedAt: updated.updatedAt.toISOString(),
        task: updated.task,
        theme: updated.theme,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: error.issues }, { status: 400 });
    }
    console.error('Failed to update activation draft:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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

  const existing = await db.activationDraft.findUnique({
    where: { id },
    select: { tenantId: true },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }

  if (!hasTenantAccess(session.user, existing.tenantId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await db.activationDraft.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
