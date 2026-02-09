"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useBranch } from "@/hooks/use-branch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Lightbulb,
  AlertCircle,
  Clock,
  CheckCircle,
  Filter,
  Plus,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface Recommendation {
  id: string;
  themeId: string;
  themeName: string;
  themeCategory: string | null;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  severity: number;
  sentiment: number;
  score010: number;
  mentions: number;
  suggestedActions: string[] | null;
  estimatedImpact: string | null;
  taskCount: number;
  pendingTaskCount: number;
  createdAt: string;
}

interface Stats {
  total: number;
  byPriority: { high: number; medium: number; low: number };
  byStatus: { open: number; inProgress: number; resolved: number; dismissed: number };
}

type StatusFilter = "all" | "actionable" | "completed";

export default function RecommendationsPage() {
  const router = useRouter();
  const { selectedTenantId, selectedTenant, isLoading: branchLoading } = useBranch();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("actionable");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Create task dialog
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Fetch recommendations
  useEffect(() => {
    async function fetchRecommendations() {
      if (!selectedTenantId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const statusParam = statusFilter === "actionable" ? "&status=OPEN" : 
                           statusFilter === "completed" ? "&status=RESOLVED" : "";
        const res = await fetch(`/api/portal/recommendations?tenantId=${selectedTenantId}${statusParam}`);
        if (res.ok) {
          const data = await res.json();
          setRecommendations(data.recommendations || []);
          setStats(data.stats || null);
        } else {
          const err = await res.json();
          setError(err.error || 'Failed to load recommendations');
        }
      } catch (err) {
        setError('Failed to load recommendations');
      } finally {
        setIsLoading(false);
      }
    }

    fetchRecommendations();
  }, [selectedTenantId, statusFilter]);

  // Filter recommendations based on status
  const filteredRecommendations = recommendations.filter(rec => {
    if (statusFilter === "actionable") {
      return rec.status === "OPEN" || rec.status === "IN_PROGRESS";
    }
    if (statusFilter === "completed") {
      return rec.status === "RESOLVED" || rec.status === "DISMISSED";
    }
    return true;
  });

  // Create task handler
  const handleCreateTask = async () => {
    if (!selectedRec || !taskTitle.trim()) return;

    setIsCreating(true);
    try {
      const res = await fetch('/api/portal/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendationId: selectedRec.id,
          tasks: [{ title: taskTitle }],
        }),
      });

      if (res.ok) {
        toast.success('Task created', {
          description: 'View and manage in the Tasks page.',
        });
        setCreateTaskOpen(false);
        setTaskTitle("");
        router.push('/tasks?created=true');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to create task');
      }
    } catch {
      toast.error('Failed to create task');
    } finally {
      setIsCreating(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'destructive';
      case 'MEDIUM': return 'default';
      case 'LOW': return 'secondary';
      default: return 'outline';
    }
  };

  const getSeverityColor = (severity: number) => {
    if (severity >= 4) return 'text-red-600';
    if (severity >= 2) return 'text-yellow-600';
    return 'text-green-600';
  };

  if (branchLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1>Recommendations</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!selectedTenantId) {
    return (
      <div className="space-y-6">
        <div>
          <h1>Recommendations</h1>
          <p className="text-muted-foreground">Select a branch to view recommendations</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Please select a branch from the dropdown above.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1>Recommendations</h1>
        <p className="text-muted-foreground">
          AI-powered insights sorted by severity (mentions × negativity).
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2">
                <Lightbulb className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{stats?.total || 0}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-rose-100 p-2">
                <AlertCircle className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{stats?.byPriority.high || 0}</p>
                <p className="text-sm text-muted-foreground">High Priority</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-100 p-2">
                <Clock className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{stats?.byStatus.inProgress || 0}</p>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-100 p-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{stats?.byStatus.resolved || 0}</p>
                <p className="text-sm text-muted-foreground">Resolved</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filter:</span>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="actionable">Actionable</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Badge variant="outline" className="font-normal">
          {filteredRecommendations.length} items
        </Badge>
      </div>

      {/* Recommendations List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="border-destructive">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : filteredRecommendations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Lightbulb className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-lg mb-1">No recommendations</h3>
            <p className="text-muted-foreground text-center max-w-md">
              {statusFilter === "actionable"
                ? "All recommendations have been addressed. Great job!"
                : statusFilter === "completed"
                ? "No completed recommendations yet."
                : "No recommendations available."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRecommendations.map((rec) => (
            <Card key={rec.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-1 h-12 rounded-full ${
                      rec.priority === 'HIGH' ? 'bg-red-500' :
                      rec.priority === 'MEDIUM' ? 'bg-yellow-500' : 'bg-green-500'
                    }`} />
                    <div>
                      <CardTitle className="text-lg">{rec.title}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">{rec.themeName}</Badge>
                        <span className={`font-medium ${getSeverityColor(rec.severity)}`}>
                          Severity: {rec.severity.toFixed(2)}
                        </span>
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getPriorityColor(rec.priority) as 'default' | 'destructive' | 'secondary' | 'outline'}>
                      {rec.priority}
                    </Badge>
                    {rec.taskCount > 0 && (
                      <Badge variant="secondary">
                        {rec.pendingTaskCount}/{rec.taskCount} tasks
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {rec.description && (
                  <p className="text-sm text-muted-foreground mb-4">{rec.description}</p>
                )}
                
                <div className="flex items-center gap-4 text-sm mb-4">
                  <div>
                    <span className="text-muted-foreground">Score:</span>{" "}
                    <span className="font-medium">{rec.score010.toFixed(1)}/10</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Mentions:</span>{" "}
                    <span className="font-medium">{rec.mentions}</span>
                  </div>
                </div>

                {/* Expandable actions */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
                  className="w-full justify-between"
                >
                  <span>Suggested Actions</span>
                  {expandedId === rec.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>

                {expandedId === rec.id && rec.suggestedActions && (
                  <div className="mt-3 pl-4 border-l-2 border-muted">
                    <ul className="space-y-2">
                      {(rec.suggestedActions as string[]).map((action, i) => (
                        <li key={i} className="text-sm text-muted-foreground">• {action}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex gap-2 mt-4">
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedRec(rec);
                      setTaskTitle(rec.title);
                      setCreateTaskOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Create Task
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Task Dialog */}
      <Dialog open={createTaskOpen} onOpenChange={setCreateTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
            <DialogDescription>
              Create a task from this recommendation to track progress.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Recommendation</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedRec?.title}
              </p>
            </div>
            <div>
              <Label htmlFor="taskTitle">Task Title</Label>
              <Input
                id="taskTitle"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Enter task title"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateTaskOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTask} disabled={isCreating || !taskTitle.trim()}>
              {isCreating ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
