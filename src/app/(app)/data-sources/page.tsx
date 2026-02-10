/**
 * Data Sources Page
 * 
 * Restaurant owners can manage their review data connectors.
 * Managers can view connectors and request ingestion runs.
 */

import { auth, getTenantAccess } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { db } from '@/server/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database, RefreshCw, CheckCircle2, AlertCircle, Clock, Play } from 'lucide-react';
import { DataSourceActions } from './components/data-source-actions';
import { RunScoringButton } from './components/run-scoring-button';
import { InitializeConnectorsButton } from './components/initialize-connectors-button';

export default async function DataSourcesPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect('/login');
  }

  // Only owners and managers can access this page
  if (!['OWNER', 'MANAGER', 'PICKD_ADMIN'].includes(session.user.role)) {
    redirect('/dashboard');
  }

  // Get tenant access
  const tenantAccess = await getTenantAccess();

  // Fetch connectors for accessible tenants
  const connectors = await db.connector.findMany({
    where: tenantAccess.allAccess ? {} : { tenantId: { in: tenantAccess.tenantIds } },
    include: {
      tenant: {
        select: { id: true, name: true },
      },
      _count: {
        select: { reviews: true, ingestionRuns: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Get recent ingestion runs
  const recentRuns = await db.ingestionRun.findMany({
    where: tenantAccess.allAccess 
      ? {} 
      : { tenantId: { in: tenantAccess.tenantIds } },
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      connector: {
        select: { name: true, sourceType: true },
      },
    },
  });

  const isOwner = session.user.role === 'OWNER' || session.user.role === 'PICKD_ADMIN';

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-8">
        <Database className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Data Sources</h1>
          <p className="text-muted-foreground">Manage your review data connections</p>
        </div>
      </div>

      {/* Connectors */}
      <div className="space-y-4 mb-8">
        <h2 className="text-xl font-semibold">Connected Sources</h2>
        
        {connectors.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Database className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center mb-4">
                No data sources connected yet.
              </p>
              {isOwner && tenantAccess.tenantIds.length > 0 && (
                <InitializeConnectorsButton tenantId={tenantAccess.tenantIds[0]} />
              )}
              {!isOwner && (
                <p className="text-sm text-muted-foreground">
                  Contact your administrator to set up review imports.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {connectors.map(connector => (
              <Card key={connector.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 pt-1">
                        {connector.status === 'ACTIVE' && (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        )}
                        {connector.status === 'PENDING' && (
                          <Clock className="h-5 w-5 text-yellow-500" />
                        )}
                        {connector.status === 'ERROR' && (
                          <AlertCircle className="h-5 w-5 text-red-500" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium">{connector.name}</h3>
                          <Badge variant="outline">{connector.sourceType}</Badge>
                          <Badge variant={connector.isActive ? 'default' : 'secondary'}>
                            {connector.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {connector.tenant.name}
                        </p>
                        {connector.errorMessage && (
                          <p className="text-sm text-red-500 mt-2">
                            Error: {connector.errorMessage}
                          </p>
                        )}
                        <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
                          <span>{connector._count.reviews} reviews</span>
                          <span>{connector._count.ingestionRuns} imports</span>
                          {connector.lastSyncedAt && (
                            <span>Last sync: {formatDate(connector.lastSyncedAt)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <DataSourceActions 
                      connector={{
                        id: connector.id,
                        name: connector.name,
                        sourceType: connector.sourceType,
                        isActive: connector.isActive,
                      }}
                      isOwner={isOwner}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Run Scoring */}
      {connectors.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Process Reviews
            </CardTitle>
            <CardDescription>
              Run the scoring pipeline to analyze imported reviews
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Get unique tenants */}
              {Array.from(new Set(connectors.map(c => c.tenant.id))).map(tenantId => {
                const tenant = connectors.find(c => c.tenant.id === tenantId)?.tenant;
                if (!tenant) return null;
                return (
                  <div key={tenantId} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="font-medium">{tenant.name}</span>
                    <RunScoringButton tenantId={tenantId} tenantName={tenant.name} />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Recent Import Activity
          </CardTitle>
          <CardDescription>
            Latest data import runs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No import activity yet
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
                      <p className="font-medium text-sm">{run.connector.name}</p>
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

      {/* Help Text */}
      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="font-medium mb-2">How to Import Reviews</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>
            <strong>Google Reviews:</strong> Export from Google Takeout, then upload the CSV file
          </li>
          <li>
            <strong>CSV Import:</strong> Prepare a CSV with columns: Review, Date, Rating, Author
          </li>
          {!isOwner && (
            <li className="text-amber-600">
              Note: As a manager, you can upload files but cannot modify connector settings
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
