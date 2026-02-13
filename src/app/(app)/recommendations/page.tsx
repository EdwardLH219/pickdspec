"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Calendar,
  User,
  ListChecks,
  TrendingDown,
  TrendingUp,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";

interface ValueRange {
  min: number;
  max: number;
  mid: number;
}

interface EconomicImpact {
  revenueAtRisk: ValueRange | null;
  revenueUpside: ValueRange | null;
  footfallAtRisk: { min: number; max: number } | null;
  footfallUpside: { min: number; max: number } | null;
  impactDriver: 'ACQUISITION' | 'CONVERSION' | 'RETENTION';
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA';
  dataQualityScore: number | null;
  currency: string;
}

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
  economicImpact: EconomicImpact | null;
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
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskAssigneeId, setTaskAssigneeId] = useState<string>("");
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  
  // Team members for assignment
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);

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

  // Fetch team members when tenant changes
  useEffect(() => {
    async function fetchTeamMembers() {
      if (!selectedTenantId) return;
      
      setLoadingTeam(true);
      try {
        const res = await fetch(`/api/portal/team?tenantId=${selectedTenantId}`);
        if (res.ok) {
          const data = await res.json();
          setTeamMembers(data.members || []);
        }
      } catch {
        // Silently fail - team members are optional
      } finally {
        setLoadingTeam(false);
      }
    }
    
    fetchTeamMembers();
  }, [selectedTenantId]);

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

  // Open create task dialog
  const openCreateTaskDialog = (rec: Recommendation) => {
    setSelectedRec(rec);
    setTaskTitle(rec.suggestedActions?.[0] || rec.title);
    setTaskDueDate("");
    setTaskAssigneeId("");
    setSelectedActions(rec.suggestedActions?.slice(0, 1) || []);
    setCreateTaskOpen(true);
  };

  // Toggle action selection
  const toggleAction = (action: string) => {
    setSelectedActions(prev => 
      prev.includes(action) 
        ? prev.filter(a => a !== action)
        : [...prev, action]
    );
    // Update task title to first selected action
    if (!selectedActions.includes(action)) {
      setTaskTitle(action);
    } else if (selectedActions.length > 1) {
      const remaining = selectedActions.filter(a => a !== action);
      setTaskTitle(remaining[0] || selectedRec?.title || "");
    }
  };

  // Create task handler
  const handleCreateTask = async () => {
    if (!selectedRec || !taskTitle.trim()) return;

    setIsCreating(true);
    try {
      // Create task(s) via the tasks API
      const tasksToCreate = selectedActions.length > 0 ? selectedActions : [taskTitle];
      
      for (let i = 0; i < tasksToCreate.length; i++) {
        const title = tasksToCreate[i];
        const res = await fetch('/api/portal/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: selectedTenantId,
            recommendationId: selectedRec.id,
            title,
            ...(taskDueDate && { dueDate: new Date(taskDueDate).toISOString() }),
            ...(taskAssigneeId && { assignedToId: taskAssigneeId }),
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error || `Failed to create task: ${title}`);
          setIsCreating(false);
          return;
        }
      }

      toast.success(tasksToCreate.length > 1 ? `${tasksToCreate.length} tasks created` : 'Task created', {
        description: 'View and manage in the Tasks page.',
      });
      setCreateTaskOpen(false);
      setTaskTitle("");
      setTaskDueDate("");
      setTaskAssigneeId("");
      setSelectedActions([]);
      router.push('/tasks?created=true');
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

  // Format currency for display
  const formatCurrency = (value: number, currency: string = 'ZAR') => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Format range for display
  const formatRange = (range: ValueRange | null, currency: string = 'ZAR') => {
    if (!range) return null;
    if (range.min === range.max) {
      return formatCurrency(range.mid, currency);
    }
    return `${formatCurrency(range.min, currency)} - ${formatCurrency(range.max, currency)}`;
  };

  // Get confidence badge variant
  const getConfidenceBadge = (level: string) => {
    switch (level) {
      case 'HIGH':
        return { variant: 'default' as const, label: 'High confidence' };
      case 'MEDIUM':
        return { variant: 'secondary' as const, label: 'Medium confidence' };
      case 'LOW':
        return { variant: 'outline' as const, label: 'Low confidence' };
      default:
        return { variant: 'outline' as const, label: 'Insufficient data' };
    }
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
                    <span className="text-muted-foreground">Issues:</span>{" "}
                    <Link 
                      href={`/reports?themeId=${rec.themeId}&themeName=${encodeURIComponent(rec.themeName)}&sentiment=non-positive`}
                      className="font-medium text-primary hover:underline"
                    >
                      {rec.mentions} reviews →
                    </Link>
                  </div>
                </div>

                {/* Economic Impact */}
                {rec.economicImpact && (rec.economicImpact.revenueAtRisk || rec.economicImpact.revenueUpside) && (
                  <div className="bg-muted/50 rounded-lg p-3 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        Estimated Impact
                      </span>
                      <Badge variant={getConfidenceBadge(rec.economicImpact.confidenceLevel).variant} className="text-xs">
                        {getConfidenceBadge(rec.economicImpact.confidenceLevel).label}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {rec.economicImpact.revenueAtRisk && (
                        <div className="flex items-start gap-2">
                          <TrendingDown className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-muted-foreground">Revenue at Risk</p>
                            <p className="font-semibold text-red-600">
                              {formatRange(rec.economicImpact.revenueAtRisk, rec.economicImpact.currency)}
                            </p>
                            <p className="text-xs text-muted-foreground">/month</p>
                          </div>
                        </div>
                      )}
                      {rec.economicImpact.revenueUpside && (
                        <div className="flex items-start gap-2">
                          <TrendingUp className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-muted-foreground">Revenue Upside</p>
                            <p className="font-semibold text-green-600">
                              {formatRange(rec.economicImpact.revenueUpside, rec.economicImpact.currency)}
                            </p>
                            <p className="text-xs text-muted-foreground">/month</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

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
                    onClick={() => openCreateTaskDialog(rec)}
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Create Task from Recommendation</DialogTitle>
            <DialogDescription>
              Select actions to create as tasks and assign to team members.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-5 py-4">
              {/* Recommendation Info */}
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{selectedRec?.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedRec?.themeName} • Score: {selectedRec?.score010.toFixed(1)}/10 •{" "}
                      <Link 
                        href={`/reports?themeId=${selectedRec?.themeId}&themeName=${encodeURIComponent(selectedRec?.themeName || '')}&sentiment=non-positive`}
                        className="text-primary hover:underline"
                        onClick={() => setCreateTaskOpen(false)}
                      >
                        {selectedRec?.mentions} reviews with issues →
                      </Link>
                    </p>
                    {/* Economic impact in dialog */}
                    {selectedRec?.economicImpact?.revenueUpside && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                        <TrendingUp className="h-3 w-3 text-green-500" />
                        <span className="text-xs">
                          <span className="text-muted-foreground">Potential upside: </span>
                          <span className="font-medium text-green-600">
                            {formatRange(selectedRec.economicImpact.revenueUpside, selectedRec.economicImpact.currency)}
                          </span>
                          <span className="text-muted-foreground">/mo</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Suggested Actions */}
              {selectedRec?.suggestedActions && selectedRec.suggestedActions.length > 0 && (
                <div>
                  <Label className="flex items-center gap-2 mb-3">
                    <ListChecks className="h-4 w-4" />
                    Suggested Actions
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Select one or more actions to create as tasks:
                  </p>
                  <div className="space-y-2">
                    {selectedRec.suggestedActions.map((action, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedActions.includes(action)
                            ? 'bg-primary/5 border-primary'
                            : 'bg-background hover:bg-muted/50'
                        }`}
                        onClick={() => toggleAction(action)}
                      >
                        <Checkbox
                          checked={selectedActions.includes(action)}
                          onCheckedChange={() => toggleAction(action)}
                          className="mt-0.5"
                        />
                        <span className="text-sm">{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom Task Title (shown if no actions selected) */}
              {selectedActions.length === 0 && (
                <div>
                  <Label htmlFor="taskTitle">Task Title</Label>
                  <Input
                    id="taskTitle"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="Enter task title"
                    className="mt-1.5"
                  />
                </div>
              )}

              {/* Due Date */}
              <div>
                <Label htmlFor="dueDate" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Due Date
                </Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="mt-1.5"
                />
              </div>

              {/* Assignee */}
              <div>
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Assign To
                </Label>
                <Select 
                  value={taskAssigneeId || "unassigned"} 
                  onValueChange={(v) => setTaskAssigneeId(v === "unassigned" ? "" : v)}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder={loadingTeam ? "Loading team..." : "Select team member"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name || member.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {teamMembers.length === 0 && !loadingTeam && (
                  <p className="text-xs text-muted-foreground mt-1">
                    No team members found. Add members in Account settings.
                  </p>
                )}
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setCreateTaskOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateTask} 
              disabled={isCreating || (selectedActions.length === 0 && !taskTitle.trim())}
            >
              {isCreating ? "Creating..." : selectedActions.length > 1 
                ? `Create ${selectedActions.length} Tasks` 
                : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
