/**
 * Portal API: Tenants
 * 
 * Get tenants the current user has access to.
 * 
 * RBAC: Returns only tenants user has access to
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { db } from '@/server/db';

/**
 * GET /api/portal/tenants
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Pick'd staff can see all tenants
    if (session.user.isPickdStaff) {
      const tenants = await db.tenant.findMany({
        where: { isActive: true },
        include: {
          organization: { select: { id: true, name: true } },
        },
        orderBy: { name: 'asc' },
      });

      return NextResponse.json({
        tenants: tenants.map(t => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          organizationId: t.organizationId,
          organizationName: t.organization.name,
        })),
      });
    }

    // Regular users - get tenants from their access list
    const tenantIds = session.user.tenantAccess;
    
    if (!tenantIds || tenantIds.length === 0) {
      return NextResponse.json({ tenants: [] });
    }

    const tenants = await db.tenant.findMany({
      where: {
        id: { in: tenantIds },
        isActive: true,
      },
      include: {
        organization: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      tenants: tenants.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        organizationId: t.organizationId,
        organizationName: t.organization.name,
      })),
    });

  } catch (error) {
    console.error('Error fetching tenants:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
