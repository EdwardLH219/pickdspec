/**
 * Score Runs Management Page
 * 
 * Trigger scoring runs with explicit ParameterSetVersion and date range, view run history.
 * PICKD_ADMIN only
 */

import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { db } from '@/server/db';
import { Activity } from 'lucide-react';
import { ScoreRunsClient } from './components/runs-client';

export default async function ScoreRunsPage() {
  const session = await auth();
  
  if (!session?.user?.isPickdStaff || session.user.role !== 'PICKD_ADMIN') {
    redirect('/dashboard');
  }

  // Fetch recent score runs
  const rawRuns = await db.scoreRun.findMany({
    include: {
      tenant: { select: { id: true, name: true } },
      parameterVersion: { select: { id: true, name: true, versionNumber: true } },
      ruleSetVersion: { select: { id: true, name: true, versionNumber: true } },
      triggeredBy: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
    orderBy: { startedAt: 'desc' },
    take: 50,
  });
  
  // Serialize for client component
  const runs = rawRuns.map(r => ({
    ...r,
    periodStart: r.periodStart?.toISOString() ?? '',
    periodEnd: r.periodEnd?.toISOString() ?? '',
    startedAt: r.startedAt?.toISOString() ?? null,
    completedAt: r.completedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    ruleSetVersion: r.ruleSetVersion ? {
      ...r.ruleSetVersion,
      name: r.ruleSetVersion.name ?? 'Unnamed',
    } : null,
  }));

  // Fetch tenants for dropdown
  const tenants = await db.tenant.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  // Fetch parameter versions for dropdown
  const parameterVersions = await db.parameterSetVersion.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true, versionNumber: true },
    orderBy: { versionNumber: 'desc' },
  });

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center gap-3 mb-8">
        <Activity className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Score Runs</h1>
          <p className="text-muted-foreground">Trigger and monitor scoring jobs</p>
        </div>
      </div>

      <ScoreRunsClient 
        initialRuns={runs} 
        tenants={tenants}
        parameterVersions={parameterVersions}
      />
    </div>
  );
}
