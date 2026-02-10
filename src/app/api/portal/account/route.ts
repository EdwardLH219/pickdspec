/**
 * Account API
 * GET: Returns organization and user account data
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { db } from '@/server/db';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get user with organization
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            subscriptionTier: true,
            subscriptionStatus: true,
            settings: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get tenants (branches) for the organization
    const tenants = user.organization ? await db.tenant.findMany({
      where: { organizationId: user.organization.id },
      select: {
        id: true,
        name: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    }) : [];

    // Get team members for the organization
    const teamMembers = user.organization ? await db.user.findMany({
      where: { organizationId: user.organization.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { firstName: 'asc' },
    }) : [];

    return NextResponse.json({
      organization: user.organization,
      tenants,
      teamMembers,
      currentUser: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Error fetching account data:', error);
    return NextResponse.json({ error: 'Failed to fetch account data' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { organizationName } = body;

    // Get user's organization
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    // Update organization name
    const updated = await db.organization.update({
      where: { id: user.organizationId },
      data: { name: organizationName },
      select: { id: true, name: true },
    });

    return NextResponse.json({ organization: updated });
  } catch (error) {
    console.error('Error updating account:', error);
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
  }
}
