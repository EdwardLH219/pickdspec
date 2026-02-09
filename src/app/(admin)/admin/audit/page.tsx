/**
 * Audit Explorer Page
 * 
 * Review score breakdown with weights and reason codes.
 * PICKD_ADMIN only
 */

import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { db } from '@/server/db';
import { Search } from 'lucide-react';
import { AuditExplorerClient } from './components/audit-client';

export default async function AuditPage() {
  const session = await auth();
  
  if (!session?.user?.isPickdStaff || session.user.role !== 'PICKD_ADMIN') {
    redirect('/dashboard');
  }

  // Fetch recent score runs for filtering
  const rawScoreRuns = await db.scoreRun.findMany({
    where: { status: 'COMPLETED' },
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      tenant: { select: { id: true, name: true } },
    },
    orderBy: { completedAt: 'desc' },
    take: 50,
  });
  
  // Convert dates to strings for client component
  const scoreRuns = rawScoreRuns.map(run => ({
    id: run.id,
    periodStart: run.periodStart?.toISOString() ?? '',
    periodEnd: run.periodEnd?.toISOString() ?? '',
    tenant: run.tenant,
  }));

  // Fetch tenants
  const tenants = await db.tenant.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center gap-3 mb-8">
        <Search className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Audit Explorer</h1>
          <p className="text-muted-foreground">Inspect review scores, weights, and reason codes</p>
        </div>
      </div>

      <AuditExplorerClient scoreRuns={scoreRuns} tenants={tenants} />
    </div>
  );
}
