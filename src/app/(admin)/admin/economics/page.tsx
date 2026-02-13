/**
 * Economic Parameters Management Page
 * 
 * Edit theme economic weights with visual controls.
 * PICKD_ADMIN only
 */

import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { db } from '@/server/db';
import { DollarSign } from 'lucide-react';
import { EconomicsClient } from './components/economics-client';
import { DEFAULT_PARAMETERS } from '@/server/parameters/defaults';

export default async function EconomicsPage() {
  const session = await auth();
  
  if (!session?.user?.isPickdStaff || session.user.role !== 'PICKD_ADMIN') {
    redirect('/dashboard');
  }

  // Fetch parameter versions
  const rawVersions = await db.parameterSetVersion.findMany({
    include: {
      createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      activatedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      _count: { select: { scoreRuns: true } },
    },
    orderBy: { versionNumber: 'desc' },
  });
  
  // Serialize for client component
  const versions = rawVersions.map(v => ({
    id: v.id,
    versionNumber: v.versionNumber,
    name: v.name,
    description: v.description,
    parameters: v.parameters as Record<string, unknown>,
    status: v.status,
    createdAt: v.createdAt.toISOString(),
    activatedAt: v.activatedAt?.toISOString() ?? null,
    updatedAt: v.updatedAt.toISOString(),
    createdBy: v.createdBy,
    activatedBy: v.activatedBy,
    _count: v._count,
  }));

  // Get theme categories for the UI
  const themeCategories = ['PRODUCT', 'SERVICE', 'VALUE', 'AMBIANCE', 'CLEANLINESS', 'LOCATION', 'OTHER'];

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center gap-3 mb-8">
        <DollarSign className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Economic Parameters</h1>
          <p className="text-muted-foreground">Configure theme economic weights and elasticity ranges</p>
        </div>
      </div>

      <EconomicsClient 
        initialVersions={versions} 
        themeCategories={themeCategories}
        defaultParams={DEFAULT_PARAMETERS.economic}
      />
    </div>
  );
}
