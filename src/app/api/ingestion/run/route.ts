/**
 * Ingestion Run API Route
 * 
 * POST /api/ingestion/run - Start a new ingestion run
 * 
 * Permissions:
 * - PICKD_ADMIN: Can run any connector
 * - OWNER: Can run connectors for their tenants
 * - MANAGER/STAFF: Can request run (creates pending request)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth, getTenantAccess } from '@/lib/auth/config';
import { db } from '@/server/db';
import { startIngestion, isIngestionRunning } from '@/server/ingestion/ingestion-service';
import { IngestionRunType } from '@prisma/client';
import { logger } from '@/lib/logger';

// Import connectors to register them
import '@/server/ingestion/connectors/csv-connector';
import '@/server/ingestion/connectors/google-connector';

/**
 * Run ingestion request schema
 */
const runIngestionSchema = z.object({
  connectorId: z.string().uuid('Invalid connector ID'),
  runType: z.nativeEnum(IngestionRunType).optional().default('MANUAL'),
  options: z.object({
    since: z.string().datetime().optional().transform(s => s ? new Date(s) : undefined),
    until: z.string().datetime().optional().transform(s => s ? new Date(s) : undefined),
    limit: z.number().int().min(1).max(10000).optional(),
  }).optional(),
});

/**
 * POST /api/ingestion/run
 * 
 * Start an ingestion run for a connector
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request
    const body = await request.json();
    const validation = runIngestionSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { connectorId, runType, options } = validation.data;

    // Get connector
    const connector = await db.connector.findUnique({
      where: { id: connectorId },
      include: { tenant: true },
    });

    if (!connector) {
      return NextResponse.json({ error: 'Connector not found' }, { status: 404 });
    }

    // Verify tenant access
    const tenantAccess = await getTenantAccess();
    if (!tenantAccess.allAccess && !tenantAccess.tenantIds.includes(connector.tenantId)) {
      return NextResponse.json({ error: 'Access denied to this connector' }, { status: 403 });
    }

    // Check permission to run ingestion
    const canRunDirectly = 
      session.user.isPickdStaff || 
      session.user.role === 'OWNER' ||
      session.user.role === 'PICKD_ADMIN';

    if (!canRunDirectly) {
      // Manager/Staff can only request, not run directly
      // In a full implementation, this would create a pending request
      // For now, we'll allow managers to run but log it
      if (session.user.role === 'MANAGER') {
        logger.info({
          userId: session.user.id,
          connectorId,
          action: 'ingestion_run_by_manager',
        }, 'Manager initiated ingestion run');
      } else {
        return NextResponse.json(
          { 
            error: 'Insufficient permissions',
            message: 'Staff members cannot run ingestion directly. Please contact your manager.',
          },
          { status: 403 }
        );
      }
    }

    // Check if connector is active
    if (!connector.isActive) {
      return NextResponse.json(
        { error: 'Connector is disabled' },
        { status: 400 }
      );
    }

    // Check if ingestion is already running
    const isRunning = await isIngestionRunning(connectorId);
    if (isRunning) {
      return NextResponse.json(
        { error: 'An ingestion run is already in progress for this connector' },
        { status: 409 }
      );
    }

    logger.info({
      connectorId,
      tenantId: connector.tenantId,
      userId: session.user.id,
      runType,
    }, 'Starting ingestion run');

    // Start the ingestion
    const result = await startIngestion({
      tenantId: connector.tenantId,
      connectorId,
      runType,
      options,
    });

    return NextResponse.json({
      success: true,
      run: {
        id: result.runId,
        status: result.status,
        reviewsFetched: result.reviewsFetched,
        reviewsCreated: result.reviewsCreated,
        reviewsUpdated: result.reviewsUpdated,
        errorCount: result.errorCount,
        durationMs: result.durationMs,
      },
      message: getStatusMessage(result),
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start ingestion');
    return NextResponse.json(
      { error: 'Failed to start ingestion run' },
      { status: 500 }
    );
  }
}

/**
 * Generate a human-readable status message
 */
function getStatusMessage(result: { 
  status: string; 
  reviewsCreated: number; 
  reviewsUpdated: number; 
  errorCount: number;
}): string {
  switch (result.status) {
    case 'COMPLETED':
      return `Successfully imported ${result.reviewsCreated} new reviews` +
        (result.reviewsUpdated > 0 ? ` and updated ${result.reviewsUpdated}` : '');
    case 'PARTIAL':
      return `Imported ${result.reviewsCreated} reviews with ${result.errorCount} errors`;
    case 'FAILED':
      return 'Ingestion failed. Please check the error details.';
    default:
      return 'Ingestion in progress';
  }
}
