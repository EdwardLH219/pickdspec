"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Shield,
  AlertTriangle,
  Check,
  X,
  Eye,
  Star,
  Calendar,
  Building,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Flag,
  CheckCircle2,
} from "lucide-react";

// ============================================================
// TYPES
// ============================================================

interface Submission {
  id: string;
  tenantId: string;
  tenantName: string;
  receiptId: string;
  receiptRef: string | null;
  overallRating: number;
  positiveThemes: string[];
  negativeThemes: string[];
  positiveDetail: string | null;
  negativeDetail: string | null;
  anythingElse: string | null;
  spamScore: number;
  isFlagged: boolean;
  hasReview: boolean;
  reviewId: string | null;
  incentiveCode: string | null;
  incentiveRedeemed: boolean;
  createdAt: string;
}

interface Tenant {
  id: string;
  name: string;
}

interface ModerationData {
  submissions: Submission[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: {
    total: number;
    flagged: number;
    unflagged: number;
  };
  tenants: Tenant[];
}

// ============================================================
// COMPONENT
// ============================================================

export default function ModerationPage() {
  // Data state
  const [data, setData] = useState<ModerationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter state
  const [filters, setFilters] = useState({
    tenantId: "",
    status: "flagged",
    page: 1,
  });

  // Detail modal state
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ============================================================
  // DATA FETCHING
  // ============================================================

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams();
      if (filters.tenantId) params.set('tenantId', filters.tenantId);
      params.set('status', filters.status);
      params.set('page', String(filters.page));

      const res = await fetch(`/api/admin/till-reviews?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');

      const responseData = await res.json();
      setData(responseData);
    } catch (error) {
      console.error('Error fetching moderation data:', error);
      toast.error('Failed to load moderation data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleAction = async (submissionId: string, action: 'approve' | 'reject' | 'unflag') => {
    setActionLoading(true);

    try {
      const res = await fetch('/api/admin/till-reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId, action }),
      });

      if (!res.ok) throw new Error('Action failed');

      toast.success(
        action === 'approve' ? 'Submission approved' :
        action === 'reject' ? 'Submission rejected' :
        'Submission unflagged'
      );

      // Refresh data
      fetchData(true);
      setSelectedSubmission(null);
    } catch (error) {
      console.error('Error performing action:', error);
      toast.error('Failed to perform action');
    } finally {
      setActionLoading(false);
    }
  };

  // ============================================================
  // RENDER HELPERS
  // ============================================================

  const getSpamScoreColor = (score: number) => {
    if (score >= 0.7) return 'text-red-600 bg-red-100';
    if (score >= 0.5) return 'text-amber-600 bg-amber-100';
    if (score >= 0.3) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const getRatingStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
      />
    ));
  };

  // ============================================================
  // LOADING STATE
  // ============================================================

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // ============================================================
  // MAIN RENDER
  // ============================================================

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            <Shield className="h-6 w-6" />
            Till Slip Moderation
          </h1>
          <p className="text-muted-foreground mt-1">
            Review and moderate flagged customer feedback submissions
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => fetchData(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <MessageSquare className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data?.stats.total || 0}</p>
                <p className="text-sm text-muted-foreground">Total Submissions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-lg">
                <Flag className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data?.stats.flagged || 0}</p>
                <p className="text-sm text-muted-foreground">Flagged for Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data?.stats.unflagged || 0}</p>
                <p className="text-sm text-muted-foreground">Clean Submissions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={filters.status}
                onValueChange={(v) => setFilters(f => ({ ...f, status: v, page: 1 }))}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flagged">Flagged</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tenant</Label>
              <Select
                value={filters.tenantId}
                onValueChange={(v) => setFilters(f => ({ ...f, tenantId: v, page: 1 }))}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All tenants" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All tenants</SelectItem>
                  {data?.tenants.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submissions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Submissions</CardTitle>
          <CardDescription>
            {data?.pagination.total || 0} submissions found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Spam Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Preview</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.submissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No submissions found
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.submissions.map((submission) => (
                    <TableRow key={submission.id}>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {new Date(submission.createdAt).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{submission.tenantName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-0.5">
                          {getRatingStars(submission.overallRating)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getSpamScoreColor(submission.spamScore)}>
                          {(submission.spamScore * 100).toFixed(0)}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {submission.isFlagged ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Flagged
                          </Badge>
                        ) : submission.hasReview ? (
                          <Badge className="bg-green-100 text-green-700">
                            <Check className="h-3 w-3 mr-1" />
                            Approved
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate text-sm text-muted-foreground">
                          {submission.positiveDetail || submission.negativeDetail || submission.anythingElse || (
                            <span className="italic">No text feedback</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedSubmission(submission)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {submission.isFlagged && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => handleAction(submission.id, 'approve')}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleAction(submission.id, 'reject')}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {data && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {data.pagination.page} of {data.pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
                  disabled={data.pagination.page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
                  disabled={data.pagination.page >= data.pagination.totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submission Details</DialogTitle>
            <DialogDescription>
              Review the full submission and take action
            </DialogDescription>
          </DialogHeader>

          {selectedSubmission && (
            <div className="space-y-6">
              {/* Meta Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Tenant</p>
                  <p className="font-medium">{selectedSubmission.tenantName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">
                    {new Date(selectedSubmission.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Receipt</p>
                  <p className="font-medium font-mono">
                    {selectedSubmission.receiptRef || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Spam Score</p>
                  <Badge className={getSpamScoreColor(selectedSubmission.spamScore)}>
                    {(selectedSubmission.spamScore * 100).toFixed(0)}%
                  </Badge>
                </div>
              </div>

              {/* Rating */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Rating</p>
                <div className="flex gap-1">
                  {getRatingStars(selectedSubmission.overallRating)}
                  <span className="ml-2 font-medium">{selectedSubmission.overallRating}/5</span>
                </div>
              </div>

              {/* Themes */}
              {selectedSubmission.positiveThemes.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                    <ThumbsUp className="h-4 w-4 text-green-500" />
                    Positive Themes
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedSubmission.positiveThemes.map(theme => (
                      <Badge key={theme} className="bg-green-100 text-green-700">
                        {theme}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedSubmission.negativeThemes.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                    <ThumbsDown className="h-4 w-4 text-amber-500" />
                    Negative Themes
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedSubmission.negativeThemes.map(theme => (
                      <Badge key={theme} className="bg-amber-100 text-amber-700">
                        {theme}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Text Feedback */}
              {selectedSubmission.positiveDetail && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Positive Details</p>
                  <p className="bg-green-50 p-3 rounded-lg text-sm">
                    {selectedSubmission.positiveDetail}
                  </p>
                </div>
              )}

              {selectedSubmission.negativeDetail && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Negative Details</p>
                  <p className="bg-amber-50 p-3 rounded-lg text-sm">
                    {selectedSubmission.negativeDetail}
                  </p>
                </div>
              )}

              {selectedSubmission.anythingElse && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Additional Comments</p>
                  <p className="bg-gray-50 p-3 rounded-lg text-sm">
                    {selectedSubmission.anythingElse}
                  </p>
                </div>
              )}

              {/* Incentive */}
              {selectedSubmission.incentiveCode && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Incentive Code</p>
                  <div className="flex items-center gap-2">
                    <code className="bg-gray-100 px-2 py-1 rounded font-mono">
                      {selectedSubmission.incentiveCode}
                    </code>
                    {selectedSubmission.incentiveRedeemed && (
                      <Badge className="bg-green-100 text-green-700">Redeemed</Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {selectedSubmission?.isFlagged && (
              <div className="flex gap-2 w-full">
                <Button
                  variant="outline"
                  onClick={() => setSelectedSubmission(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleAction(selectedSubmission.id, 'reject')}
                  disabled={actionLoading}
                  className="flex-1"
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <X className="h-4 w-4 mr-2" />
                  )}
                  Reject
                </Button>
                <Button
                  onClick={() => handleAction(selectedSubmission.id, 'approve')}
                  disabled={actionLoading}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Approve
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
