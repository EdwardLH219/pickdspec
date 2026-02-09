/**
 * Rules Management Page
 * 
 * Edit JSON rules, versioning, diff view.
 * PICKD_ADMIN only
 */

import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { db } from '@/server/db';
import { Scale } from 'lucide-react';
import { RulesClient, type RuleSetVersion } from './components/rules-client';

export default async function RulesPage() {
  const session = await auth();
  
  if (!session?.user?.isPickdStaff || session.user.role !== 'PICKD_ADMIN') {
    redirect('/dashboard');
  }

  // Fetch rule set versions
  const rawVersions = await db.ruleSetVersion.findMany({
    include: {
      ruleSet: true,
      createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      activatedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
    orderBy: { versionNumber: 'desc' },
  });
  
  // Serialize for client component
  const versions = rawVersions.map(v => ({
    ...v,
    name: v.name ?? 'Unnamed',
    rules: v.rules as RuleSetVersion['rules'],
    status: v.status as 'DRAFT' | 'ACTIVE' | 'ARCHIVED',
    createdAt: v.createdAt.toISOString(),
    activatedAt: v.activatedAt?.toISOString() ?? null,
    ruleSet: {
      ...v.ruleSet,
      createdAt: v.ruleSet.createdAt.toISOString(),
      updatedAt: v.ruleSet.updatedAt.toISOString(),
    },
  }));

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center gap-3 mb-8">
        <Scale className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Rule Set Versions</h1>
          <p className="text-muted-foreground">Manage confidence and sufficiency rules</p>
        </div>
      </div>

      <RulesClient initialVersions={versions} />
    </div>
  );
}
