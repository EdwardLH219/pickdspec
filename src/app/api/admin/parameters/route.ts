/**
 * Admin API: Parameter Set Versions
 * 
 * RBAC: PICKD_ADMIN only
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { authorizePickdAdmin, AuthorizationError } from '@/server/auth/rbac';
import { db } from '@/server/db';
import { ParameterStatus } from '@prisma/client';
import { validateParameterSet, clampParameterSet } from '@/server/parameters/validation';
import { DEFAULT_PARAMETERS } from '@/server/parameters/defaults';
import { audit } from '@/server/audit/service';
import type { ParameterSet, PartialParameterSet } from '@/server/parameters/types';

/**
 * GET /api/admin/parameters
 * List all parameter versions
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    authorizePickdAdmin(session.user);
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as ParameterStatus | null;
    
    const versions = await db.parameterSetVersion.findMany({
      where: status ? { status } : undefined,
      include: {
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        activatedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
      orderBy: { versionNumber: 'desc' },
    });
    
    return NextResponse.json({ versions });
    
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Error fetching parameter versions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/parameters
 * Create a new parameter version (draft)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    authorizePickdAdmin(session.user);
    
    const body = await request.json();
    const { name, description, parameters, baseOnVersionId } = body;
    
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    
    // Get base parameters (from existing version or defaults)
    let baseParams: ParameterSet = DEFAULT_PARAMETERS;
    let changelog: Array<{ path: string; oldValue: unknown; newValue: unknown }> = [];
    
    if (baseOnVersionId) {
      const baseVersion = await db.parameterSetVersion.findUnique({
        where: { id: baseOnVersionId },
      });
      if (baseVersion?.parameters) {
        baseParams = baseVersion.parameters as unknown as ParameterSet;
      }
    }
    
    // Merge provided parameters with base
    let finalParams = baseParams;
    if (parameters) {
      finalParams = deepMerge(baseParams, parameters);
      
      // Generate changelog
      changelog = generateChangelog(baseParams, finalParams);
    }
    
    // Validate parameters
    const validation = validateParameterSet(finalParams);
    if (!validation.valid) {
      return NextResponse.json({
        error: 'Invalid parameters',
        details: validation.errors,
      }, { status: 400 });
    }
    
    // Clamp to valid ranges
    const clampedParams = clampParameterSet(finalParams);
    
    // Create draft version
    const version = await db.parameterSetVersion.create({
      data: {
        name,
        description,
        parameters: JSON.parse(JSON.stringify(clampedParams)),
        status: ParameterStatus.DRAFT,
        createdById: session.user.id,
      },
      include: {
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    
    // Audit log the creation
    await audit.parameterCreated(session.user, version.id, name, baseOnVersionId);
    
    return NextResponse.json({
      version,
      changelog,
      warnings: validation.warnings,
    }, { status: 201 });
    
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Error creating parameter version:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================
// HELPERS
// ============================================================

function deepMerge(base: ParameterSet, override: PartialParameterSet): ParameterSet {
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
