/**
 * Portal API: Trigger Score Run
 * 
 * Simple endpoint to trigger theme extraction + scoring for a tenant.
 * RBAC: User must have access to the tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { hasTenantAccess } from '@/server/auth/rbac';
import { executeScoreRun } from '@/server/scoring/pipeline';
import { extractThemesForTenant } from '@/server/scoring/theme-extractor';
import { logger } from '@/lib/logger';

/**
 * POST /api/portal/score
 * Trigger theme extraction + score run for a tenant
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { tenantId } = body;

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    // Check tenant access
    if (!hasTenantAccess(session.user, tenantId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    logger.info({ tenantId, userId: session.user.id }, 'Triggering theme extraction + score run from portal');

    // Step 1: Extract themes from reviews
    const themeResult = await extractThemesForTenant(tenantId);
    logger.info({ 
      tenantId, 
      reviewsProcessed: themeResult.reviewsProcessed,
      themesExtracted: themeResult.themesExtracted,
    }, 'Theme extraction completed');

    // Step 2: Run scoring for the last year
    const periodEnd = new Date();
    const periodStart = new Date();
    periodStart.setFullYear(periodStart.getFullYear() - 1);

    const result = await executeScoreRun({
      tenantId,
      periodStart,
      periodEnd,
      triggeredById: session.user.id,
    });

    return NextResponse.json({
      success: true,
      scoreRunId: result.scoreRunId,
      reviewsProcessed: result.reviewsProcessed,
      themesProcessed: result.themesProcessed,
      themesExtracted: themeResult.themesExtracted,
      durationMs: result.durationMs,
    });

  } catch (error) {
    logger.error({ 
      error,
      errorMessage: error instanceof Error ? error.message : 'Unknown',
      errorStack: error instanceof Error ? error.stack : undefined,
    }, 'Error triggering score run');
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Full error:', error);
    return NextResponse.json(
      { error: 'Failed to run scoring', details: message },
      { status: 500 }
    );
  }
}
