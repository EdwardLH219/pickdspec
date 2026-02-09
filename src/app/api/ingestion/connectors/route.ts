/**
 * Connectors API Routes
 * 
 * Manage data source connectors for a tenant.
 * 
 * GET  /api/ingestion/connectors - List connectors for current user's tenants
 * POST /api/ingestion/connectors - Create a new connector
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth, getTenantAccess } from '@/lib/auth/config';
import { db } from '@/server/db';
import { encrypt } from '@/server/ingestion/encryption';
import { getConnectorsForUI, getConnectorInfo } from '@/server/ingestion/connector-registry';
import { SourceType, SyncFrequency, ConnectorStatus } from '@prisma/client';
import { logger } from '@/lib/logger';
import { audit } from '@/server/audit/service';

// Import connectors to register them
import '@/server/ingestion/connectors/csv-connector';
import '@/server/ingestion/connectors/google-connector';

/**
 * GET /api/ingestion/connectors
 * 
 * List connectors for accessible tenants
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId');
    const includeAvailable = searchParams.get('includeAvailable') === 'true';

    // Get tenant access
    const tenantAccess = await getTenantAccess();

    // Build where clause
    const where: Record<string, unknown> = {};
    
    if (tenantId) {
      // Check access to specific tenant
      if (!tenantAccess.allAccess && !tenantAccess.tenantIds.includes(tenantId)) {
        return NextResponse.json({ error: 'Access denied to tenant' }, { status: 403 });
      }
      where.tenantId = tenantId;
    } else if (!tenantAccess.allAccess) {
      where.tenantId = { in: tenantAccess.tenantIds };
    }

    // Fetch connectors
    const connectors = await db.connector.findMany({
      where,
      include: {
        tenant: {
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: { reviews: true, ingestionRuns: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Build response
    const response: {
      connectors: Array<{
        id: string;
        sourceType: SourceType;
        name: string;
        status: ConnectorStatus;
        isActive: boolean;
        lastSyncedAt: Date | null;
        nextSyncAt: Date | null;
        syncFrequency: SyncFrequency;
        errorMessage: string | null;
        errorCount: number;
        tenant: { id: string; name: string; slug: string };
        reviewCount: number;
        runCount: number;
      }>;
      availableConnectors?: ReturnType<typeof getConnectorsForUI>;
    } = {
      connectors: connectors.map(c => ({
        id: c.id,
        sourceType: c.sourceType,
        name: c.name,
        status: c.status,
        isActive: c.isActive,
        lastSyncedAt: c.lastSyncedAt,
        nextSyncAt: c.nextSyncAt,
        syncFrequency: c.syncFrequency,
        errorMessage: c.errorMessage,
        errorCount: c.errorCount,
        tenant: c.tenant,
        reviewCount: c._count.reviews,
        runCount: c._count.ingestionRuns,
      })),
    };

    // Include available connector types if requested
    if (includeAvailable) {
      response.availableConnectors = getConnectorsForUI();
    }

    return NextResponse.json(response);
  } catch (error) {
    logger.error({ error }, 'Failed to list connectors');
    return NextResponse.json(
      { error: 'Failed to list connectors' },
      { status: 500 }
    );
  }
}

/**
 * Create connector request schema
 */
const createConnectorSchema = z.object({
  tenantId: z.string().uuid('Invalid tenant ID'),
  sourceType: z.nativeEnum(SourceType),
  name: z.string().min(1).max(100),
  externalId: z.string().optional(),
  externalUrl: z.string().url().optional(),
  syncFrequency: z.nativeEnum(SyncFrequency).optional().default('MANUAL'),
  config: z.object({
    credentials: z.object({
      accessToken: z.string().optional(),
      refreshToken: z.string().optional(),
      apiKey: z.string().optional(),
    }).optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
    columnMappings: z.object({
      externalId: z.string().optional(),
      rating: z.string().optional(),
      title: z.string().optional(),
      content: z.string(),
      authorName: z.string().optional(),
      reviewDate: z.string(),
      responseText: z.string().optional(),
      responseDate: z.string().optional(),
      dateFormat: z.string().optional(),
    }).optional(),
  }).optional(),
});

/**
 * POST /api/ingestion/connectors
 * 
 * Create a new connector
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only owners and managers can create connectors
    if (!['OWNER', 'MANAGER', 'PICKD_ADMIN'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to create connectors' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = createConnectorSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { tenantId, sourceType, name, externalId, externalUrl, syncFrequency, config } = validation.data;

    // Verify tenant access
    const tenantAccess = await getTenantAccess();
    if (!tenantAccess.allAccess && !tenantAccess.tenantIds.includes(tenantId)) {
      return NextResponse.json({ error: 'Access denied to tenant' }, { status: 403 });
    }

    // Check if connector already exists for this source type
    const existing = await db.connector.findFirst({
      where: { tenantId, sourceType },
    });

    if (existing) {
      return NextResponse.json(
        { error: `A ${sourceType} connector already exists for this branch` },
        { status: 409 }
      );
    }

    // Verify the connector type is supported
    const connectorInfo = getConnectorInfo(sourceType);
    if (!connectorInfo) {
      return NextResponse.json(
        { error: `Connector type ${sourceType} is not currently supported` },
        { status: 400 }
      );
    }

    // Encrypt configuration if provided
    const encryptedConfig = config ? encrypt(config) : undefined;

    // Create connector
    const connector = await db.connector.create({
      data: {
        tenantId,
        sourceType,
        name,
        externalId,
        externalUrl,
        externalConfig: encryptedConfig,
        syncFrequency,
        status: ConnectorStatus.PENDING,
        isActive: true,
      },
    });

    logger.info({
      connectorId: connector.id,
      tenantId,
      sourceType,
      userId: session.user.id,
    }, 'Connector created');

    // Audit log connector creation
    await audit.connectorCreated(session.user, connector.id, tenantId, sourceType, name);

    return NextResponse.json({
      success: true,
      connector: {
        id: connector.id,
        sourceType: connector.sourceType,
        name: connector.name,
        status: connector.status,
      },
    }, { status: 201 });
  } catch (error) {
    logger.error({ error }, 'Failed to create connector');
    return NextResponse.json(
      { error: 'Failed to create connector' },
      { status: 500 }
    );
  }
}
