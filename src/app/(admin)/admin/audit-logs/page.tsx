/**
 * Audit Logs Page
 * 
 * Admin-only view of system audit logs.
 * Shows all admin actions with filtering and search.
 */

import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { db } from '@/server/db';
import { ClipboardList } from 'lucide-react';
import { AuditLogsClient } from './components/audit-logs-client';

export default async function AuditLogsPage() {
  const session = await auth();
  
  if (!session?.user?.isPickdStaff || session.user.role !== 'PICKD_ADMIN') {
    redirect('/dashboard');
  }

  // Fetch filter options
  const [resourceTypes, actors, tenants] = await Promise.all([
    // Get unique resource types
    db.auditLog.findMany({
      select: { resourceType: true },
      distinct: ['resourceType'],
      orderBy: { resourceType: 'asc' },
    }),
    
    // Get actors who have performed actions
    db.auditLog.findMany({
      select: { 
        actorId: true,
        actorEmail: true,
      },
      distinct: ['actorId'],
      orderBy: { actorEmail: 'asc' },
      take: 100,
    }),
    
    // Get tenants
    db.tenant.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center gap-3 mb-8">
        <ClipboardList className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Audit Logs</h1>
          <p className="text-muted-foreground">
            Track all admin actions across the platform
          </p>
        </div>
      </div>

      <AuditLogsClient
        resourceTypes={resourceTypes.map(r => r.resourceType)}
        actors={actors.map(a => ({ id: a.actorId, email: a.actorEmail }))}
        tenants={tenants}
      />
    </div>
  );
}
