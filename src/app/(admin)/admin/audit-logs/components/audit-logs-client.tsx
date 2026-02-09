"use client";

/**
 * Audit Logs Client Component
 * 
 * Interactive audit log viewer with filtering, search, and pagination.
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, 
  Filter, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  User,
  Globe,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface AuditLog {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  actor: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  tenantId: string | null;
  organizationId: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: string;
}

interface Props {
  resourceTypes: string[];
  actors: Array<{ id: string; email: string }>;
  tenants: Array<{ id: string; name: string }>;
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  UPDATE: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  ACTIVATE: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  DEACTIVATE: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  TRIGGER: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  LOGIN: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  LOGOUT: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
  EXPORT: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  IMPORT: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  ACCESS: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
};

const ACTIONS = [
  'CREATE', 'UPDATE', 'DELETE', 'ACTIVATE', 'DEACTIVATE',
  'TRIGGER', 'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT', 'ACCESS',
];

export function AuditLogsClient({ resourceTypes, actors, tenants }: Props) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  
  // Filters
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>('all');
  const [actorFilter, setActorFilter] = useState<string>('all');
  const [tenantFilter, setTenantFilter] = useState<string>('all');
  
  // Pagination
  const [page, setPage] = useState(0);
  const limit = 20;
  
  // Detail dialog
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', limit.toString());
      params.set('offset', (page * limit).toString());
      
      if (search) params.set('search', search);
      if (actionFilter !== 'all') params.set('action', actionFilter);
      if (resourceTypeFilter !== 'all') params.set('resourceType', resourceTypeFilter);
      if (actorFilter !== 'all') params.set('actorId', actorFilter);
      if (tenantFilter !== 'all') params.set('tenantId', tenantFilter);
      
      const res = await fetch(`/api/admin/audit-logs?${params}`);
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      
      const data = await res.json();
      setLogs(data.logs);
      setTotal(data.pagination.total);
    } catch (error) {
      toast.error('Failed to load audit logs');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, actionFilter, resourceTypeFilter, actorFilter, tenantFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchLogs();
  };

  const clearFilters = () => {
    setSearch('');
    setActionFilter('all');
    setResourceTypeFilter('all');
    setActorFilter('all');
    setTenantFilter('all');
    setPage(0);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear All
              </Button>
              <Button variant="outline" size="sm" onClick={fetchLogs}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email, resource, request ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button type="submit">Search</Button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {ACTIONS.map(action => (
                    <SelectItem key={action} value={action}>{action}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={resourceTypeFilter} onValueChange={setResourceTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Resource Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Resources</SelectItem>
                  {resourceTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={actorFilter} onValueChange={setActorFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Actor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {actors.map(actor => (
                    <SelectItem key={actor.id} value={actor.id}>{actor.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={tenantFilter} onValueChange={setTenantFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tenant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tenants</SelectItem>
                  {tenants.map(tenant => (
                    <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {isLoading ? 'Loading...' : `${total.toLocaleString()} audit logs`}
            </CardTitle>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No audit logs found matching your filters</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(log => (
                  <TableRow 
                    key={log.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedLog(log)}
                  >
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={ACTION_COLORS[log.action] || 'bg-gray-100'}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{log.resourceType}</div>
                      {log.resourceId && (
                        <div className="text-xs text-muted-foreground font-mono truncate max-w-[150px]">
                          {log.resourceId}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{log.actor.name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{log.actor.role}</div>
                    </TableCell>
                    <TableCell>
                      {log.tenantId ? (
                        <span className="text-sm">
                          {tenants.find(t => t.id === log.tenantId)?.name || log.tenantId}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        <FileText className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge className={ACTION_COLORS[selectedLog?.action || ''] || 'bg-gray-100'}>
                {selectedLog?.action}
              </Badge>
              <span>{selectedLog?.resourceType}</span>
            </DialogTitle>
            <DialogDescription>
              {selectedLog && new Date(selectedLog.createdAt).toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          
          {selectedLog && (
            <div className="space-y-6">
              {/* Actor Info */}
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Actor
                </h4>
                <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                  <div><strong>Name:</strong> {selectedLog.actor.name}</div>
                  <div><strong>Email:</strong> {selectedLog.actor.email}</div>
                  <div><strong>Role:</strong> {selectedLog.actor.role}</div>
                </div>
              </div>
              
              {/* Resource Info */}
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Resource
                </h4>
                <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                  <div><strong>Type:</strong> {selectedLog.resourceType}</div>
                  {selectedLog.resourceId && (
                    <div><strong>ID:</strong> <code className="text-xs">{selectedLog.resourceId}</code></div>
                  )}
                  {selectedLog.tenantId && (
                    <div><strong>Tenant:</strong> {tenants.find(t => t.id === selectedLog.tenantId)?.name || selectedLog.tenantId}</div>
                  )}
                </div>
              </div>
              
              {/* Request Info */}
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Request Context
                </h4>
                <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                  {selectedLog.requestId && (
                    <div><strong>Request ID:</strong> <code className="text-xs">{selectedLog.requestId}</code></div>
                  )}
                  {selectedLog.ipAddress && (
                    <div><strong>IP Address:</strong> {selectedLog.ipAddress}</div>
                  )}
                  {selectedLog.userAgent && (
                    <div className="break-all"><strong>User Agent:</strong> <span className="text-xs">{selectedLog.userAgent}</span></div>
                  )}
                </div>
              </div>
              
              {/* Metadata */}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Metadata</h4>
                  <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
              
              {/* Old/New Values */}
              {(selectedLog.oldValue || selectedLog.newValue) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedLog.oldValue && (
                    <div>
                      <h4 className="font-medium mb-2 text-red-600">Before</h4>
                      <pre className="bg-red-50 dark:bg-red-950 rounded-lg p-3 text-xs overflow-x-auto">
                        {JSON.stringify(selectedLog.oldValue, null, 2)}
                      </pre>
                    </div>
                  )}
                  {selectedLog.newValue && (
                    <div>
                      <h4 className="font-medium mb-2 text-green-600">After</h4>
                      <pre className="bg-green-50 dark:bg-green-950 rounded-lg p-3 text-xs overflow-x-auto">
                        {JSON.stringify(selectedLog.newValue, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
