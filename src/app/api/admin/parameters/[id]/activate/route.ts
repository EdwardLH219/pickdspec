/**
 * Admin API: Activate Parameter Version
 * 
 * RBAC: PICKD_ADMIN only
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { authorizePickdAdmin, AuthorizationError } from '@/server/auth/rbac';
import { db } from '@/server/db';
import { ParameterStatus } from '@prisma/client';
import { audit } from '@/server/audit/service';
import type { ParameterSet } from '@/server/parameters/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/parameters/[id]/activate
 * Publish a draft version and make it active
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    authorizePickdAdmin(session.user);
    
    const { id } = await params;
    
    // Get version to activate
    const version = await db.parameterSetVersion.findUnique({
      where: { id },
    });
    
    if (!version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }
    
    if (version.status === ParameterStatus.ACTIVE) {
      return NextResponse.json({ error: 'Version is already active' }, { status: 400 });
    }
    
    if (version.status === ParameterStatus.ARCHIVED) {
      return NextResponse.json({ error: 'Cannot activate archived versions' }, { status: 400 });
    }
    
    // Get current active version for changelog
    const currentActive = await db.parameterSetVersion.findFirst({
      where: { status: ParameterStatus.ACTIVE },
    });
    
    // Generate changelog if there's a previous version
    let changelog: Array<{ path: string; oldValue: unknown; newValue: unknown }> = [];
    if (currentActive) {
      const oldParams = currentActive.parameters as unknown as ParameterSet;
      const newParams = version.parameters as unknown as ParameterSet;
      changelog = generateChangelog(oldParams, newParams);
    }
    
    // Transaction: deactivate current, activate new
    const [archivedVersion, activatedVersion] = await db.$transaction([
      // Archive current active version (if exists)
      ...(currentActive ? [
        db.parameterSetVersion.update({
          where: { id: currentActive.id },
          data: { status: ParameterStatus.ARCHIVED },
        }),
      ] : []),
      
      // Activate new version
      db.parameterSetVersion.update({
        where: { id },
        data: {
          status: ParameterStatus.ACTIVE,
          activatedAt: new Date(),
          activatedById: session.user.id,
        },
        include: {
          createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
          activatedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      }),
    ]);
    
    const result = currentActive ? activatedVersion : archivedVersion;
    
    // Audit log the activation
    await audit.parameterPublished(
      session.user,
      id,
      version.name,
      currentActive?.id,
      changelog
    );
    
    return NextResponse.json({
      version: result,
      changelog,
      previousVersionId: currentActive?.id,
    });
    
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Error activating parameter version:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================
// HELPERS
// ============================================================

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
