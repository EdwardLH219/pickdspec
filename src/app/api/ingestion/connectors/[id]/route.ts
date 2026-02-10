/**
 * Single Connector API Routes
 * 
 * GET    /api/ingestion/connectors/[id] - Get connector details
 * PATCH  /api/ingestion/connectors/[id] - Update connector
 * DELETE /api/ingestion/connectors/[id] - Delete connector
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth, getTenantAccess } from '@/lib/auth/config';
import { db } from '@/server/db';
import { encrypt, decryptJSON, isEncrypted, maskSecret } from '@/server/ingestion/encryption';
import { getIngestionHistory } from '@/server/ingestion/ingestion-service';
import { SyncFrequency, ConnectorStatus } from '@prisma/client';
import { logger } from '@/lib/logger';
import { audit } from '@/server/audit/service';

// Import connectors to register them
import '@/server/ingestion/connectors/csv-connector';
import '@/server/ingestion/connectors/google-connector';
import '@/server/ingestion/connectors/outscraper-connector';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/ingestion/connectors/[id]
 * 
 * Get connector details including recent runs
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const connector = await db.connector.findUnique({
      where: { id },
      include: {
        tenant: {
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: { reviews: true, ingestionRuns: true },
        },
      },
    });

    if (!connector) {
      return NextResponse.json({ error: 'Connector not found' }, { status: 404 });
    }

    // Verify tenant access
    const tenantAccess = await getTenantAccess();
    if (!tenantAccess.allAccess && !tenantAccess.tenantIds.includes(connector.tenantId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get recent ingestion runs
    const recentRuns = await getIngestionHistory(id, 5);

    // Mask sensitive config for non-admin users
    let configSummary: Record<string, unknown> | null = null;
    if (connector.externalConfig) {
      const configStr = connector.externalConfig as string;
      if (isEncrypted(configStr)) {
        const config = decryptJSON<Record<string, unknown>>(configStr);
        
        // Only show config structure, not actual secrets
        if (session.user.isPickdStaff) {
          // Admin can see masked secrets
          configSummary = maskConfig(config);
        } else {
          // Regular users see only non-sensitive info
          configSummary = {
            hasCredentials: !!config.credentials,
            hasColumnMappings: !!config.columnMappings,
          };
        }
      }
    }

    return NextResponse.json({
      connector: {
        id: connector.id,
        sourceType: connector.sourceType,
        name: connector.name,
        status: connector.status,
        isActive: connector.isActive,
        externalId: connector.externalId,
        externalUrl: connector.externalUrl,
        syncFrequency: connector.syncFrequency,
        lastSyncedAt: connector.lastSyncedAt,
        nextSyncAt: connector.nextSyncAt,
        errorMessage: connector.errorMessage,
        errorCount: connector.errorCount,
        tenant: connector.tenant,
        reviewCount: connector._count.reviews,
        runCount: connector._count.ingestionRuns,
        configSummary,
        createdAt: connector.createdAt,
        updatedAt: connector.updatedAt,
      },
      recentRuns,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get connector');
    return NextResponse.json(
      { error: 'Failed to get connector' },
      { status: 500 }
    );
  }
}

/**
 * Update connector request schema
 */
const updateConnectorSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  externalId: z.string().optional(),
  externalUrl: z.string().url().optional(),
  syncFrequency: z.nativeEnum(SyncFrequency).optional(),
  isActive: z.boolean().optional(),
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
 * PATCH /api/ingestion/connectors/[id]
 * 
 * Update connector settings
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const connector = await db.connector.findUnique({
      where: { id },
    });

    if (!connector) {
      return NextResponse.json({ error: 'Connector not found' }, { status: 404 });
    }

    // Verify tenant access
    const tenantAccess = await getTenantAccess();
    if (!tenantAccess.allAccess && !tenantAccess.tenantIds.includes(connector.tenantId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Parse and validate request
    const body = await request.json();
    const validation = updateConnectorSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { config, ...updateData } = validation.data;

    // Only admins and owners can modify credentials
    if (config?.credentials) {
      if (!['OWNER', 'PICKD_ADMIN'].includes(session.user.role)) {
        return NextResponse.json(
          { error: 'Only owners can modify connector credentials' },
          { status: 403 }
        );
      }
    }

    // Encrypt config if provided
    const dataToUpdate: Record<string, unknown> = { ...updateData };
    if (config) {
      // Merge with existing config
      let existingConfig: Record<string, unknown> = {};
      if (connector.externalConfig) {
        const configStr = connector.externalConfig as string;
        if (isEncrypted(configStr)) {
          existingConfig = decryptJSON<Record<string, unknown>>(configStr);
        }
      }
      
      const mergedConfig = {
        ...existingConfig,
        ...config,
        credentials: config.credentials ? {
          ...(existingConfig.credentials as Record<string, unknown> || {}),
          ...config.credentials,
        } : existingConfig.credentials,
      };
      
      dataToUpdate.externalConfig = encrypt(mergedConfig);
    }

    // Update connector
    const updated = await db.connector.update({
      where: { id },
      data: dataToUpdate,
    });

    logger.info({
      connectorId: id,
      userId: session.user.id,
      updates: Object.keys(updateData),
    }, 'Connector updated');

    // Audit log the update
    await audit.connectorUpdated(
      session.user,
      id,
      connector.tenantId,
      Object.keys(updateData)
    );

    return NextResponse.json({
      success: true,
      connector: {
        id: updated.id,
        sourceType: updated.sourceType,
        name: updated.name,
        status: updated.status,
        isActive: updated.isActive,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to update connector');
    return NextResponse.json(
      { error: 'Failed to update connector' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ingestion/connectors/[id]
 * 
 * Delete a connector and all associated data
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only owners and Pick'd admin can delete connectors
    if (!['OWNER', 'PICKD_ADMIN'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Only owners can delete connectors' },
        { status: 403 }
      );
    }

    const connector = await db.connector.findUnique({
      where: { id },
    });

    if (!connector) {
      return NextResponse.json({ error: 'Connector not found' }, { status: 404 });
    }

    // Verify tenant access
    const tenantAccess = await getTenantAccess();
    if (!tenantAccess.allAccess && !tenantAccess.tenantIds.includes(connector.tenantId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Delete connector (cascade will delete reviews and runs)
    await db.connector.delete({
      where: { id },
    });

    logger.info({
      connectorId: id,
      userId: session.user.id,
    }, 'Connector deleted');

    // Audit log the deletion
    await audit.connectorDeleted(
      session.user,
      id,
      connector.tenantId,
      connector.sourceType,
      connector.name
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Failed to delete connector');
    return NextResponse.json(
      { error: 'Failed to delete connector' },
      { status: 500 }
    );
  }
}

/**
 * Mask sensitive values in config object
 */
function maskConfig(config: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(config)) {
    if (key === 'credentials' && value && typeof value === 'object') {
      const creds: Record<string, string> = {};
      for (const [credKey, credValue] of Object.entries(value)) {
        if (typeof credValue === 'string') {
          creds[credKey] = maskSecret(credValue);
        }
      }
      result[key] = creds;
    } else if (typeof value === 'object' && value !== null) {
      result[key] = value; // Non-sensitive objects like columnMappings
    } else {
      result[key] = value;
    }
  }
  
  return result;
}
