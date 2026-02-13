/**
 * Portal API: Tenant Baseline Metrics
 * 
 * GET/PUT baseline metrics for a specific tenant.
 * Used for economic impact calculations.
 * 
 * RBAC: User must have access to the tenant (owner/manager)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { db } from '@/server/db';
import { z } from 'zod';
import { hasTenantAccess } from '@/server/auth/rbac';
import { recalculateEconomicImpactsForTenant } from '@/server/economic';

const baselineSchema = z.object({
  coversPerMonth: z.number().int().positive().nullable().optional(),
  averageSpendPerCover: z.number().positive().nullable().optional(),
  seatCapacity: z.number().int().positive().nullable().optional(),
  daysOpenPerWeek: z.number().int().min(1).max(7).nullable().optional(),
  servicesPerDay: z.number().int().min(1).max(5).nullable().optional(),
  averageTurnover: z.number().positive().nullable().optional(),
});

/**
 * GET /api/portal/tenants/[id]/baseline
 * Get baseline metrics for a tenant
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: tenantId } = await params;

    // Check access
    if (!session.user.isPickdStaff && !hasTenantAccess(session.user, tenantId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const metrics = await db.restaurantBaselineMetrics.findUnique({
      where: { tenantId },
      select: {
        id: true,
        coversPerMonth: true,
        averageSpendPerCover: true,
        seatCapacity: true,
        daysOpenPerWeek: true,
        servicesPerDay: true,
        averageTurnover: true,
        currency: true,
        dataSource: true,
        confidenceLevel: true,
        lastVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ metrics });
  } catch (error) {
    console.error('Error fetching baseline metrics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/portal/tenants/[id]/baseline
 * Update baseline metrics for a tenant
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: tenantId } = await params;

    // Check access - only owner/manager can update metrics
    if (!session.user.isPickdStaff && !hasTenantAccess(session.user, tenantId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only owners or Pick'd staff can update baseline metrics
    const userRole = session.user.role;
    if (!session.user.isPickdStaff && userRole !== 'OWNER' && userRole !== 'MANAGER') {
      return NextResponse.json(
        { error: 'Only owners or managers can update baseline metrics' },
        { status: 403 }
      );
    }

    // Verify tenant exists
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = baselineSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Upsert the baseline metrics
    const metrics = await db.restaurantBaselineMetrics.upsert({
      where: { tenantId },
      create: {
        tenantId,
        coversPerMonth: data.coversPerMonth,
        averageSpendPerCover: data.averageSpendPerCover,
        seatCapacity: data.seatCapacity,
        daysOpenPerWeek: data.daysOpenPerWeek,
        servicesPerDay: data.servicesPerDay,
        averageTurnover: data.averageTurnover,
        dataSource: 'manual',
        createdById: session.user.id,
        updatedById: session.user.id,
        lastVerifiedAt: new Date(),
      },
      update: {
        coversPerMonth: data.coversPerMonth,
        averageSpendPerCover: data.averageSpendPerCover,
        seatCapacity: data.seatCapacity,
        daysOpenPerWeek: data.daysOpenPerWeek,
        servicesPerDay: data.servicesPerDay,
        averageTurnover: data.averageTurnover,
        dataSource: 'manual',
        updatedById: session.user.id,
        lastVerifiedAt: new Date(),
      },
      select: {
        id: true,
        coversPerMonth: true,
        averageSpendPerCover: true,
        seatCapacity: true,
        daysOpenPerWeek: true,
        servicesPerDay: true,
        averageTurnover: true,
        currency: true,
        dataSource: true,
        lastVerifiedAt: true,
        updatedAt: true,
      },
    });

    // Recalculate economic impacts for existing recommendations with the new baseline data
    try {
      const economicResult = await recalculateEconomicImpactsForTenant(tenantId);
      console.log(`Recalculated economic impacts: ${economicResult.calculated} calculated, ${economicResult.skipped} skipped`);
    } catch (error) {
      console.error('Failed to recalculate economic impacts:', error);
      // Don't fail the request if recalculation fails
    }

    return NextResponse.json({ metrics });
  } catch (error) {
    console.error('Error updating baseline metrics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
