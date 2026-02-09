/**
 * Ingestion Run Details API Route
 * 
 * GET /api/ingestion/runs/[id] - Get details of a specific ingestion run
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, getTenantAccess } from '@/lib/auth/config';
import { db } from '@/server/db';
import { getIngestionErrors } from '@/server/ingestion/ingestion-service';
import { logger } from '@/lib/logger';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/ingestion/runs/[id]
 * 
 * Get detailed information about an ingestion run
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get ingestion run with connector info
    const run = await db.ingestionRun.findUnique({
      where: { id },
      include: {
        connector: {
          select: {
            id: true,
            name: true,
            sourceType: true,
            tenantId: true,
            tenant: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!run) {
      return NextResponse.json({ error: 'Ingestion run not found' }, { status: 404 });
    }

    // Verify tenant access
    const tenantAccess = await getTenantAccess();
    if (!tenantAccess.allAccess && !tenantAccess.tenantIds.includes(run.connector.tenantId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get errors for this run
    const errors = await getIngestionErrors(id);

    // Calculate duration if completed
    let durationMs: number | null = null;
    if (run.startedAt && run.completedAt) {
      durationMs = run.completedAt.getTime() - run.startedAt.getTime();
    }

    return NextResponse.json({
      run: {
        id: run.id,
        status: run.status,
        runType: run.runType,
        
        // Stats
        reviewsFetched: run.reviewsFetched,
        reviewsCreated: run.reviewsCreated,
        reviewsUpdated: run.reviewsUpdated,
        reviewsSkipped: run.reviewsSkipped,
        duplicatesFound: run.duplicatesFound,
        errorCount: run.errorCount,
        
        // Timing
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        durationMs,
        
        // Error summary
        errorMessage: run.errorMessage,
        
        // Connector info
        connector: {
          id: run.connector.id,
          name: run.connector.name,
          sourceType: run.connector.sourceType,
          tenant: run.connector.tenant,
        },
        
        // Timestamps
        createdAt: run.createdAt,
      },
      errors,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get ingestion run');
    return NextResponse.json(
      { error: 'Failed to get ingestion run details' },
      { status: 500 }
    );
  }
}
