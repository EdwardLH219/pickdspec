'use client';

/**
 * Ingestion Stats Component
 * 
 * Displays overview statistics for ingestion management.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, RefreshCw, Calendar, AlertCircle } from 'lucide-react';

interface IngestionStatsProps {
  connectorCount: number;
  runningCount: number;
  todayRuns: number;
  errorCount: number;
}

export function IngestionStats({
  connectorCount,
  runningCount,
  todayRuns,
  errorCount,
}: IngestionStatsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Total Connectors
          </CardTitle>
          <Database className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{connectorCount}</div>
          <p className="text-xs text-muted-foreground">
            Across all tenants
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Running Now
          </CardTitle>
          <RefreshCw className={`h-4 w-4 ${runningCount > 0 ? 'text-blue-500 animate-spin' : 'text-muted-foreground'}`} />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{runningCount}</div>
          <p className="text-xs text-muted-foreground">
            Active ingestion jobs
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Today&apos;s Runs
          </CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{todayRuns}</div>
          <p className="text-xs text-muted-foreground">
            Runs since midnight
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Error State
          </CardTitle>
          <AlertCircle className={`h-4 w-4 ${errorCount > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${errorCount > 0 ? 'text-red-500' : ''}`}>
            {errorCount}
          </div>
          <p className="text-xs text-muted-foreground">
            Connectors with errors
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
