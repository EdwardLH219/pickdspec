/**
 * Parameters Management Page
 * 
 * Create, edit, validate, publish parameter versions with changelog and diff view.
 * PICKD_ADMIN only
 */

import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { db } from '@/server/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings } from 'lucide-react';
import { ParametersClient } from './components/parameters-client';

export default async function ParametersPage() {
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
    ...v,
    parameters: v.parameters as Record<string, unknown>,
    createdAt: v.createdAt.toISOString(),
    activatedAt: v.activatedAt?.toISOString() ?? null,
    updatedAt: v.updatedAt.toISOString(),
  }));

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center gap-3 mb-8">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Parameter Versions</h1>
          <p className="text-muted-foreground">Manage scoring algorithm parameters</p>
        </div>
      </div>

      <ParametersClient initialVersions={versions} />
    </div>
  );
}
