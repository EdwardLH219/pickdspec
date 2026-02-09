'use client';

/**
 * Connector List Component
 * 
 * Displays all connectors with ability to run ingestion, view errors, and manage status.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Database, RefreshCw, Upload, Search, Filter, Play, AlertCircle, CheckCircle2, Clock, Eye, History, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Connector {
  id: string;
  sourceType: string;
  name: string;
  status: string;
  isActive: boolean;
  lastSyncedAt: string | null;
  nextSyncAt: string | null;
  syncFrequency: string;
  errorMessage: string | null;
  errorCount: number;
  tenant: { id: string; name: string; slug: string };
  reviewCount: number;
  runCount: number;
}

interface IngestionRunDetail {
  id: string;
  status: string;
  runType: string;
  reviewsFetched: number;
  reviewsCreated: number;
  reviewsUpdated: number;
  reviewsSkipped: number;
  errorCount: number;
  errorDetails: Array<{ type: string; message: string; reviewId?: string }> | null;
  durationMs: number | null;
  createdAt: string;
  completedAt: string | null;
}

interface IngestionResult {
  success: boolean;
  run?: {
    id: string;
    status: string;
    reviewsCreated: number;
    reviewsUpdated: number;
    errorCount: number;
    durationMs: number;
  };
  message: string;
  error?: string;
}

export function ConnectorList() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [runningConnectors, setRunningConnectors] = useState<Set<string>>(new Set());
  
  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<IngestionResult | null>(null);
  
  // Error/History dialog state
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [runHistory, setRunHistory] = useState<IngestionRunDetail[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedRun, setSelectedRun] = useState<IngestionRunDetail | null>(null);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);

  // Fetch connectors
  useEffect(() => {
    fetchConnectors();
  }, []);

  async function fetchConnectors() {
    try {
      const response = await fetch('/api/ingestion/connectors');
      if (response.ok) {
        const data = await response.json();
        setConnectors(data.connectors);
      }
    } catch (error) {
      console.error('Failed to fetch connectors:', error);
    } finally {
      setLoading(false);
    }
  }

  // Run ingestion
  async function runIngestion(connector: Connector) {
    setRunningConnectors(prev => new Set(prev).add(connector.id));
    
    try {
      const response = await fetch('/api/ingestion/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectorId: connector.id,
          runType: 'MANUAL',
        }),
      });

      const result: IngestionResult = await response.json();
      
      if (result.success) {
        toast.success('Ingestion completed', {
          description: result.run 
            ? `Created: ${result.run.reviewsCreated}, Updated: ${result.run.reviewsUpdated}${result.run.errorCount > 0 ? `, Errors: ${result.run.errorCount}` : ''}`
            : result.message,
        });
        await fetchConnectors();
      } else {
        toast.error('Ingestion failed', {
          description: result.error || result.message,
        });
      }
    } catch (error) {
      console.error('Failed to run ingestion:', error);
      toast.error('Failed to run ingestion');
    } finally {
      setRunningConnectors(prev => {
        const next = new Set(prev);
        next.delete(connector.id);
        return next;
      });
    }
  }

  // Fetch run history for a connector
  async function fetchRunHistory(connector: Connector) {
    setSelectedConnector(connector);
    setHistoryDialogOpen(true);
    setHistoryLoading(true);
    setRunHistory([]);
    
    try {
      const response = await fetch(`/api/ingestion/connectors/${connector.id}/runs`);
      if (response.ok) {
        const data = await response.json();
        setRunHistory(data.runs || []);
      }
    } catch (error) {
      console.error('Failed to fetch run history:', error);
      toast.error('Failed to fetch run history');
    } finally {
      setHistoryLoading(false);
    }
  }

  // View error details for a run
  function viewRunErrors(run: IngestionRunDetail) {
    setSelectedRun(run);
    setErrorDialogOpen(true);
  }

  // Handle file upload
  function openUploadDialog(connector: Connector) {
    setSelectedConnector(connector);
    setUploadFile(null);
    setUploadResult(null);
    setUploadDialogOpen(true);
  }

  async function handleUpload() {
    if (!selectedConnector || !uploadFile) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('connectorId', selectedConnector.id);

      // Add basic column mappings for CSV
      if (selectedConnector.sourceType === 'WEBSITE') {
        const mappings = {
          content: 'Review',
          reviewDate: 'Date',
          rating: 'Rating',
          authorName: 'Author',
          dateFormat: 'YYYY-MM-DD',
        };
        formData.append('columnMappings', JSON.stringify(mappings));
      }

      const response = await fetch('/api/ingestion/upload', {
        method: 'POST',
        body: formData,
      });

      const result: IngestionResult = await response.json();
      setUploadResult(result);

      if (result.success) {
        await fetchConnectors();
      }
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadResult({
        success: false,
        message: 'Upload failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setUploading(false);
    }
  }

  // Filter connectors
  const filteredConnectors = connectors.filter(connector => {
    const matchesSearch = 
      connector.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      connector.tenant.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = 
      statusFilter === 'all' ||
      connector.status.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            All Connectors
          </CardTitle>
          <CardDescription>
            Manage and run ingestion for all data connectors
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search connectors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Connector List */}
          {filteredConnectors.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No connectors found
            </p>
          ) : (
            <div className="space-y-3">
              {filteredConnectors.map(connector => (
                <div
                  key={connector.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">
                      {connector.status === 'ACTIVE' && (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      )}
                      {connector.status === 'PENDING' && (
                        <Clock className="h-5 w-5 text-yellow-500" />
                      )}
                      {connector.status === 'ERROR' && (
                        <AlertCircle className="h-5 w-5 text-red-500" />
                      )}
                      {connector.status === 'DISABLED' && (
                        <Database className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{connector.name}</p>
                        <Badge variant="outline" className="text-xs">
                          {connector.sourceType}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {connector.tenant.name}
                      </p>
                      {connector.errorMessage && (
                        <p className="text-xs text-red-500 mt-1">
                          {connector.errorMessage}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right text-sm">
                      <p className="font-medium">{connector.reviewCount} reviews</p>
                      <p className="text-muted-foreground text-xs">
                        {connector.runCount} runs
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-muted-foreground text-xs">
                        Last sync:
                      </p>
                      <p>
                        {connector.lastSyncedAt
                          ? formatDate(connector.lastSyncedAt)
                          : 'Never'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => fetchRunHistory(connector)}
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openUploadDialog(connector)}
                        disabled={!connector.isActive}
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        Upload
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => runIngestion(connector)}
                        disabled={!connector.isActive || runningConnectors.has(connector.id)}
                      >
                        {runningConnectors.has(connector.id) ? (
                          <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4 mr-1" />
                        )}
                        Run Now
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload File</DialogTitle>
            <DialogDescription>
              Upload a CSV or JSON file to import reviews for {selectedConnector?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="file">Select File</Label>
              <Input
                id="file"
                type="file"
                accept=".csv,.json,.txt"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Supported formats: CSV, JSON (max 10MB)
              </p>
            </div>

            {uploadResult && (
              <div className={`p-3 rounded-lg ${
                uploadResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                <p className="font-medium">
                  {uploadResult.success ? 'Upload Successful' : 'Upload Failed'}
                </p>
                <p className="text-sm">{uploadResult.message}</p>
                {uploadResult.run && (
                  <p className="text-sm mt-1">
                    Created: {uploadResult.run.reviewsCreated}, 
                    Updated: {uploadResult.run.reviewsUpdated}, 
                    Errors: {uploadResult.run.errorCount}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!uploadFile || uploading}
            >
              {uploading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload & Import
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Run History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Run History</DialogTitle>
            <DialogDescription>
              Ingestion history for {selectedConnector?.name}
            </DialogDescription>
          </DialogHeader>

          {historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : runHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No ingestion runs found
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead>Errors</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runHistory.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {run.status === 'COMPLETED' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                          {run.status === 'RUNNING' && <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />}
                          {run.status === 'FAILED' && <XCircle className="h-4 w-4 text-red-500" />}
                          {run.status === 'PARTIAL' && <AlertCircle className="h-4 w-4 text-yellow-500" />}
                          <Badge
                            variant={
                              run.status === 'COMPLETED' ? 'default' :
                              run.status === 'FAILED' ? 'destructive' :
                              run.status === 'RUNNING' ? 'secondary' : 'outline'
                            }
                          >
                            {run.status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{run.runType}</Badge>
                      </TableCell>
                      <TableCell className="text-green-600">+{run.reviewsCreated}</TableCell>
                      <TableCell className="text-blue-600">~{run.reviewsUpdated}</TableCell>
                      <TableCell>
                        {run.errorCount > 0 ? (
                          <span className="text-red-600 font-medium">{run.errorCount}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(run.createdAt)}
                      </TableCell>
                      <TableCell>
                        {run.errorCount > 0 && run.errorDetails && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewRunErrors(run)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Error Details Dialog */}
      <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Error Details
            </DialogTitle>
            <DialogDescription>
              {selectedRun?.errorCount} errors from run on {selectedRun ? formatDate(selectedRun.createdAt) : ''}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {selectedRun?.errorDetails?.map((error, index) => (
                <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="destructive">{error.type}</Badge>
                    {error.reviewId && (
                      <span className="text-xs text-muted-foreground">
                        Review: {error.reviewId.slice(0, 8)}...
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-red-700">{error.message}</p>
                </div>
              ))}
              {(!selectedRun?.errorDetails || selectedRun.errorDetails.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  No detailed error information available
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  
  return date.toLocaleDateString();
}
