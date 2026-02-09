/**
 * Admin API: Parameter Set Version by ID
 * 
 * RBAC: PICKD_ADMIN only
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { authorizePickdAdmin, AuthorizationError } from '@/server/auth/rbac';
import { db } from '@/server/db';
import { ParameterStatus } from '@prisma/client';
import { validateParameterSet, clampParameterSet } from '@/server/parameters/validation';
import type { ParameterSet } from '@/server/parameters/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/parameters/[id]
 * Get a specific parameter version
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    authorizePickdAdmin(session.user);
    
    const { id } = await params;
    
    const version = await db.parameterSetVersion.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        activatedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        scoreRuns: {
          orderBy: { startedAt: 'desc' },
          take: 10,
          select: {
            id: true,
            tenantId: true,
            status: true,
            startedAt: true,
            completedAt: true,
          },
        },
      },
    });
    
    if (!version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }
    
    return NextResponse.json({ version });
    
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Error fetching parameter version:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/parameters/[id]
 * Update a draft parameter version
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    authorizePickdAdmin(session.user);
    
    const { id } = await params;
    const body = await request.json();
    const { name, description, parameters } = body;
    
    // Get existing version
    const existing = await db.parameterSetVersion.findUnique({
      where: { id },
    });
    
    if (!existing) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }
    
    if (existing.status !== ParameterStatus.DRAFT) {
      return NextResponse.json({
        error: 'Only draft versions can be edited',
      }, { status: 400 });
    }
    
    // Update parameters if provided
    let updatedParams = existing.parameters as unknown as ParameterSet;
    let changelog: Array<{ path: string; oldValue: unknown; newValue: unknown }> = [];
    
    if (parameters) {
      const oldParams = existing.parameters as unknown as ParameterSet;
      updatedParams = deepMerge(oldParams, parameters);
      
      // Validate
      const validation = validateParameterSet(updatedParams);
      if (!validation.valid) {
        return NextResponse.json({
          error: 'Invalid parameters',
          details: validation.errors,
        }, { status: 400 });
      }
      
      // Clamp
      updatedParams = clampParameterSet(updatedParams);
      
      // Generate changelog
      changelog = generateChangelog(oldParams, updatedParams);
    }
    
    // Update version
    const version = await db.parameterSetVersion.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        description: description ?? existing.description,
        parameters: parameters ? JSON.parse(JSON.stringify(updatedParams)) : undefined,
      },
      include: {
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    
    return NextResponse.json({ version, changelog });
    
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Error updating parameter version:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/parameters/[id]
 * Delete a draft parameter version
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    authorizePickdAdmin(session.user);
    
    const { id } = await params;
    
    // Get existing version
    const existing = await db.parameterSetVersion.findUnique({
      where: { id },
    });
    
    if (!existing) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }
    
    if (existing.status !== ParameterStatus.DRAFT) {
      return NextResponse.json({
        error: 'Only draft versions can be deleted',
      }, { status: 400 });
    }
    
    await db.parameterSetVersion.delete({
      where: { id },
    });
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Error deleting parameter version:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================
// HELPERS
// ============================================================

function deepMerge(base: ParameterSet, override: Partial<ParameterSet>): ParameterSet {
  const result = JSON.parse(JSON.stringify(base)) as ParameterSet;
  
  function merge(target: Record<string, unknown>, source: Record<string, unknown>) {
    for (const key of Object.keys(source)) {
      const sourceValue = source[key];
      const targetValue = target[key];
      
      if (
        sourceValue !== null &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue !== null &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        merge(targetValue as Record<string, unknown>, sourceValue as Record<string, unknown>);
      } else if (sourceValue !== undefined) {
        target[key] = sourceValue;
      }
    }
  }
  
  merge(result as unknown as Record<string, unknown>, override as unknown as Record<string, unknown>);
  return result;
}

function generateChangelog(
  oldParams: ParameterSet,
  newParams: ParameterSet
): Array<{ path: string; oldValue: unknown; newValue: unknown }> {
  const changes: Array<{ path: string; oldValue: unknown; newValue: unknown }> = [];
  
  function compare(old: unknown, current: unknown, path: string) {
    if (old === current) return;
    
    if (
      typeof old === 'object' &&
      typeof current === 'object' &&
      old !== null &&
      current !== null &&
      !Array.isArray(old) &&
      !Array.isArray(current)
    ) {
      const allKeys = new Set([...Object.keys(old), ...Object.keys(current)]);
      for (const key of allKeys) {
        compare(
          (old as Record<string, unknown>)[key],
          (current as Record<string, unknown>)[key],
          path ? `${path}.${key}` : key
        );
      }
    } else {
      changes.push({ path, oldValue: old, newValue: current });
    }
  }
  
  compare(oldParams, newParams, '');
  return changes;
}
