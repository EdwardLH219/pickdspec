/**
 * Initialize Connectors API
 * 
 * Creates default connectors for a tenant that doesn't have any.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { db } from '@/server/db';
import { SourceType, SyncFrequency, ConnectorStatus } from '@prisma/client';

/**
 * POST /api/portal/connectors/initialize
 * 
 * Initialize default connectors for a tenant
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only owners and admins can initialize connectors
  if (!['OWNER', 'PICKD_ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { tenantId } = body;

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    // Check tenant access
    const userTenantAccess = session.user.tenantAccess || [];
    const hasAccess = session.user.isPickdStaff || userTenantAccess.includes(tenantId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if tenant exists
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      include: {
        connectors: {
          select: { sourceType: true },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Get existing source types for this tenant
    const existingSourceTypes = new Set(tenant.connectors.map(c => c.sourceType));

    // Define all connector configs
    const connectorConfigs: Array<{
      sourceType: SourceType;
      name: string;
      syncFrequency: SyncFrequency;
    }> = [
      { sourceType: SourceType.GOOGLE, name: 'Google Reviews', syncFrequency: SyncFrequency.MANUAL },
      { sourceType: SourceType.GOOGLE_OUTSCRAPER, name: 'Google (API)', syncFrequency: SyncFrequency.MANUAL },
      { sourceType: SourceType.HELLOPETER, name: 'HelloPeter', syncFrequency: SyncFrequency.MANUAL },
      { sourceType: SourceType.FACEBOOK, name: 'Facebook', syncFrequency: SyncFrequency.MANUAL },
      { sourceType: SourceType.TRIPADVISOR, name: 'TripAdvisor', syncFrequency: SyncFrequency.MANUAL },
      { sourceType: SourceType.YELP, name: 'Yelp', syncFrequency: SyncFrequency.MANUAL },
      { sourceType: SourceType.ZOMATO, name: 'Zomato', syncFrequency: SyncFrequency.MANUAL },
      { sourceType: SourceType.OPENTABLE, name: 'OpenTable', syncFrequency: SyncFrequency.MANUAL },
      { sourceType: SourceType.WEBSITE, name: 'CSV Import', syncFrequency: SyncFrequency.MANUAL },
      { sourceType: SourceType.INSTAGRAM, name: 'Instagram', syncFrequency: SyncFrequency.MANUAL },
      { sourceType: SourceType.TWITTER, name: 'Twitter/X', syncFrequency: SyncFrequency.MANUAL },
    ];

    // Filter to only create missing connectors
    const connectorsToCreate = connectorConfigs.filter(
      config => !existingSourceTypes.has(config.sourceType)
    );

    if (connectorsToCreate.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All connectors already exist',
        created: 0,
      });
    }

    // Create missing connectors
    await db.connector.createMany({
      data: connectorsToCreate.map(config => ({
        tenantId,
        sourceType: config.sourceType,
        name: config.name,
        syncFrequency: config.syncFrequency,
        status: ConnectorStatus.PENDING,
        isActive: true,
      })),
    });

    return NextResponse.json({
      success: true,
      message: `Created ${connectorsToCreate.length} connectors`,
      created: connectorsToCreate.length,
      connectors: connectorsToCreate.map(c => c.name),
    });
  } catch (error) {
    console.error('Initialize connectors error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize connectors' },
      { status: 500 }
    );
  }
}
