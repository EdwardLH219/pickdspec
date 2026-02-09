'use client';

/**
 * Score Runs Client Component
 * 
 * Trigger and monitor scoring jobs
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Play,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';

interface ScoreRun {
  id: string;
  tenantId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  runType: string;
  periodStart: string;
  periodEnd: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  reviewsProcessed: number | null;
  themesProcessed: number | null;
  errorMessage: string | null;
  tenant: { id: string; name: string };
  parameterVersion: { id: string; name: string; versionNumber: number } | null;
  ruleSetVersion: { id: string; name: string; versionNumber: number } | null;
  triggeredBy: { id: string; email: string; firstName: string | null; lastName: string | null } | null;
}

interface Tenant {
  id: string;
  name: string;
}

interface ParameterVersion {
  id: string;
  name: string;
  versionNumber: number;
}

interface Props {
  initialRuns: ScoreRun[];
  tenants: Tenant[];
  parameterVersions: ParameterVersion[];
}

export function ScoreRunsClient({ initialRuns, tenants, parameterVersions }: Props) {
  const [runs, setRuns] = useState<ScoreRun[]>(initialRuns);
  const [isTriggering, setIsTriggering] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [selectedParamVersion, setSelectedParamVersion] = useState<string>('');
  const [periodStart, setPeriodStart] = useState<string>('');
  const [periodEnd, setPeriodEnd] = useState<string>('');
  const [computeFixScores, setComputeFixScores] = useState(true);
  const [filterTenantId, setFilterTenantId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const refreshRuns = async () => {
    try {
      const params = new URLSearchParams();
      if (filterTenantId !== 'all') params.set('tenantId', filterTenantId);
      if (filterStatus !== 'all') params.set('status', filterStatus);
      
      const res = await fetch(`/api/admin/runs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs);
      }
    } catch (error) {
      console.error('Failed to refresh runs:', error);
    }
  };

  const triggerRun = async () => {
    if (!selectedTenantId || !periodStart || !periodEnd) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsTriggering(true);
    try {
      const res = await fetch('/api/admin/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: selectedTenantId,
          periodStart,
          periodEnd,
          parameterVersionId: selectedParamVersion || undefined,
          computeFixScores,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success('Score run queued', {
          description: `Job ID: ${data.jobId}`,
        });
        setSelectedTenantId('');
        setPeriodStart('');
        setPeriodEnd('');
        await refreshRuns();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to trigger run');
      }
    } catch (error) {
      toast.error('Failed to trigger run');
    } finally {
      setIsTriggering(false);
    }
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'FAILED': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'RUNNING': return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'PENDING': return <Clock className="h-4 w-4 text-yellow-500" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'default';
      case 'FAILED': return 'destructive';
      case 'RUNNING': return 'secondary';
      case 'PENDING': return 'outline';
      default: return 'outline';
    }
  };

  const filteredRuns = runs.filter(run => {
    if (filterTenantId !== 'all' && run.tenantId !== filterTenantId) return false;
    if (filterStatus !== 'all' && run.status !== filterStatus) return false;
    return true;
  });

  // Set default dates
  const setDefaultDates = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    
    setPeriodStart(start.toISOString().split('T')[0]);
    setPeriodEnd(end.toISOString().split('T')[0]);
  };

  return (
    <div className="space-y-6">
      {/* Trigger New Run */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Trigger New Score Run
          </CardTitle>
          <CardDescription>
            Run scoring for a tenant with specific parameters and date range
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label>Tenant *</Label>
              <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Period Start *</Label>
              <Input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>

            <div>
              <Label>Period End *</Label>
              <Input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>

            <div>
              <Label>Parameter Version</Label>
              <Select value={selectedParamVersion} onValueChange={setSelectedParamVersion}>
                <SelectTrigger>
                  <SelectValue placeholder="Active (default)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Active (default)</SelectItem>
                  {parameterVersions.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      v{v.versionNumber}: {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="fixscores"
                checked={computeFixScores}
                onCheckedChange={(checked) => setComputeFixScores(!!checked)}
              />
              <Label htmlFor="fixscores" className="font-normal">
                Compute FixScores for completed tasks
              </Label>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={setDefaultDates}>
              <Calendar className="h-4 w-4 mr-2" />
              Last 30 Days
            </Button>
            <Button onClick={triggerRun} disabled={isTriggering}>
              {isTriggering ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Trigger Run
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={filterTenantId} onValueChange={setFilterTenantId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All tenants" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tenants</SelectItem>
            {tenants.map((tenant) => (
              <SelectItem key={tenant.id} value={tenant.id}>
                {tenant.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="RUNNING">Running</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={refreshRuns}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Run History */}
      <Card>
        <CardHeader>
          <CardTitle>Run History</CardTitle>
          <CardDescription>
            {filteredRuns.length} runs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Reviews</TableHead>
                <TableHead>Themes</TableHead>
                <TableHead>Parameters</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRuns.map((run) => (
                <TableRow key={run.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(run.status)}
                      <Badge variant={getStatusColor(run.status) as 'default' | 'destructive' | 'secondary' | 'outline'}>
                        {run.status}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {run.tenant.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {new Date(run.periodStart).toLocaleDateString()} - {new Date(run.periodEnd).toLocaleDateString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    {run.startedAt ? formatDate(run.startedAt) : '-'}
                  </TableCell>
                  <TableCell>
                    {formatDuration(run.durationMs)}
                  </TableCell>
                  <TableCell>
                    {run.reviewsProcessed ?? '-'}
                  </TableCell>
                  <TableCell>
                    {run.themesProcessed ?? '-'}
                  </TableCell>
                  <TableCell>
                    {run.parameterVersion ? (
                      <span className="text-sm">v{run.parameterVersion.versionNumber}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">default</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filteredRuns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No score runs found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
