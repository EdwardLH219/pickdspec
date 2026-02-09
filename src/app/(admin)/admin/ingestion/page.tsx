/**
 * Admin Ingestion Management Page
 * 
 * Pick'd Admin only - for managing and running data ingestion across all tenants.
 */

import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { db } from '@/server/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Database, RefreshCw, Upload, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { ConnectorList } from './components/connector-list';
import { IngestionStats } from './components/ingestion-stats';

export default async function AdminIngestionPage() {
  const session = await auth();
  
  // Server-side authorization check
  if (!session?.user?.isPickdStaff || session.user.role !== 'PICKD_ADMIN') {
    redirect('/dashboard');
  }

  // Get overall stats
  const [
    connectorCount,
    runningCount,
    todayRuns,
    errorCount,
    recentRuns,
  ] = await Promise.all([
    db.connector.count(),
    db.ingestionRun.count({ where: { status: 'RUNNING' } }),
    db.ingestionRun.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
    db.connector.count({ where: { status: 'ERROR' } }),
    db.ingestionRun.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        connector: {
          select: {
            name: true,
            sourceType: true,
            tenant: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center gap-3 mb-8">
        <Database className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Ingestion Management</h1>
          <p className="text-muted-foreground">Manage data connectors and ingestion runs</p>
        </div>
        <Badge variant="default" className="ml-auto">PICKD_ADMIN</Badge>
      </div>

      {/* Stats Overview */}
      <IngestionStats
        connectorCount={connectorCount}
        runningCount={runningCount}
        todayRuns={todayRuns}
        errorCount={errorCount}
      />

      {/* Recent Runs */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Ingestion Runs
          </CardTitle>
          <CardDescription>
            Latest ingestion activity across all tenants
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No ingestion runs yet
            </p>
          ) : (
            <div className="space-y-2">
              {recentRuns.map(run => (
                <div
                  key={run.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {run.status === 'COMPLETED' && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                    {run.status === 'RUNNING' && (
                      <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
                    )}
                    {run.status === 'FAILED' && (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    {run.status === 'PARTIAL' && (
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                    )}
                    <div>
                      <p className="font-medium text-sm">
                        {run.connector.name}
                        <span className="text-muted-foreground font-normal">
                          {' '}({run.connector.tenant.name})
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {run.connector.sourceType} • {run.runType}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">
                      <span className="text-green-600">+{run.reviewsCreated}</span>
                      {run.reviewsUpdated > 0 && (
                        <span className="text-blue-600 ml-2">~{run.reviewsUpdated}</span>
                      )}
                      {run.errorCount > 0 && (
                        <span className="text-red-600 ml-2">!{run.errorCount}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTimeAgo(run.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connector List (Client Component) */}
      <div className="mt-6">
        <ConnectorList />
      </div>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
