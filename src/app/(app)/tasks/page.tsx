"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useBranch } from "@/hooks/use-branch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Plus,
  ListTodo,
  Clock,
  CheckCircle,
  AlertTriangle,
  Filter,
  X,
  Eye,
  TrendingUp,
  TrendingDown,
  HelpCircle,
  Info,
} from "lucide-react";

type StatusFilter = "all" | "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

interface Task {
  id: string;
  tenantId: string;
  themeId: string | null;
  themeName: string | null;
  themeCategory: string | null;
  recommendationId: string | null;
  recommendationTitle: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  assignee: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
  fixScore: {
    status: 'pending' | 'insufficient_data' | 'available';
    message: string | null;
    score: number | null;
    deltaS: number | null;
    confidence: string;
    calculatedAt: string;
  } | null;
  isOverdue: boolean;
}

interface Stats {
  total: number;
  byStatus: { pending: number; inProgress: number; completed: number; cancelled: number };
  overdue: number;
  completionRate: number;
}

interface Theme {
  id: string;
  name: string;
}

// Toast handler for created query param
function CreatedToastHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("created") === "true") {
      toast.success("Task created successfully");
      window.history.replaceState({}, "", "/tasks");
    }
  }, [searchParams]);

  return null;
}

function TasksContent() {
  const { selectedTenantId, selectedTenant, isLoading: branchLoading } = useBranch();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [themeFilter, setThemeFilter] = useState<string>("all");
  
  // Selected task for detail view
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  
  // Add task dialog
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Fetch tasks
  useEffect(() => {
    async function fetchTasks() {
      if (!selectedTenantId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ tenantId: selectedTenantId });
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (themeFilter !== "all") params.set("themeId", themeFilter);
        
        const res = await fetch(`/api/portal/tasks?${params}`);
        if (res.ok) {
          const data = await res.json();
          setTasks(data.tasks || []);
          setStats(data.stats || null);
          setThemes(data.themes || []);
        } else {
          const err = await res.json();
          setError(err.error || 'Failed to load tasks');
        }
      } catch {
        setError('Failed to load tasks');
      } finally {
        setIsLoading(false);
      }
    }

    fetchTasks();
  }, [selectedTenantId, statusFilter, themeFilter]);

  // Update task status
  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/portal/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        // Update local state
        setTasks(prev => prev.map(t => 
          t.id === taskId 
            ? { ...t, status: newStatus, completedAt: newStatus === 'COMPLETED' ? new Date().toISOString() : t.completedAt }
            : t
        ));
        toast.success(newStatus === 'COMPLETED' ? 'Task completed!' : 'Status updated');
      } else {
        toast.error('Failed to update task');
      }
    } catch {
      toast.error('Failed to update task');
    }
  };

  // Create new task
  const createTask = async () => {
    if (!selectedTenantId || !newTaskTitle.trim()) return;

    setIsCreating(true);
    try {
      const res = await fetch('/api/portal/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: selectedTenantId,
          title: newTaskTitle,
        }),
      });

      if (res.ok) {
        toast.success('Task created');
        setAddTaskOpen(false);
        setNewTaskTitle("");
        // Refresh tasks
        const refreshRes = await fetch(`/api/portal/tasks?tenantId=${selectedTenantId}`);
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          setTasks(data.tasks || []);
          setStats(data.stats || null);
        }
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

  const clearFilters = () => {
    setStatusFilter("all");
    setThemeFilter("all");
  };

  const hasActiveFilters = statusFilter !== "all" || themeFilter !== "all";

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return <Badge variant="secondary">Not Started</Badge>;
      case 'IN_PROGRESS': return <Badge variant="default">In Progress</Badge>;
      case 'COMPLETED': return <Badge className="bg-green-600">Done</Badge>;
      case 'CANCELLED': return <Badge variant="outline">Cancelled</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'HIGH': return <Badge variant="destructive">High</Badge>;
      case 'MEDIUM': return <Badge variant="default">Medium</Badge>;
      case 'LOW': return <Badge variant="secondary">Low</Badge>;
      default: return null;
    }
  };

  // Render FixScore status
  const renderFixScore = (task: Task) => {
    if (task.status !== 'COMPLETED' || !task.completedAt) {
      return null;
    }

    if (!task.fixScore) {
      return (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Calculating impact...</span>
        </div>
      );
    }

    if (task.fixScore.status === 'insufficient_data') {
      return (
        <div className="flex items-center gap-1 text-xs text-yellow-600">
          <Info className="h-3 w-3" />
          <span>Insufficient data</span>
        </div>
      );
    }

    if (task.fixScore.status === 'available' && task.fixScore.score !== null) {
      const isPositive = task.fixScore.deltaS !== null && task.fixScore.deltaS > 0;
      return (
        <div className={`flex items-center gap-1 text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          <span>Impact: {task.fixScore.score.toFixed(2)}</span>
        </div>
      );
    }

    return null;
  };

  if (branchLoading) {
    return (
      <>
        <div className="flex items-start justify-between">
          <div>
            <h1>Tasks</h1>
            <p className="text-muted-foreground">Loading...</p>
          </div>
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
      </>
    );
  }

  if (!selectedTenantId) {
    return (
      <>
        <div>
          <h1>Tasks</h1>
          <p className="text-muted-foreground">Select a branch to view tasks</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Please select a branch from the dropdown above.</p>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1>Tasks</h1>
          <p className="text-muted-foreground">
            Track and manage action items. Completed tasks show their impact score.
          </p>
        </div>
        <Button onClick={() => setAddTaskOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Task
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2">
                <ListTodo className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{stats?.total || 0}</p>
                <p className="text-sm text-muted-foreground">Total Tasks</p>
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
              <div className="rounded-lg bg-rose-100 p-2">
                <AlertTriangle className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{stats?.overdue || 0}</p>
                <p className="text-sm text-muted-foreground">Overdue</p>
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
                <p className="text-2xl font-semibold">{stats?.completionRate || 0}%</p>
                <p className="text-sm text-muted-foreground">Completion Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filters:</span>
        </div>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="PENDING">Not Started</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="COMPLETED">Done</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={themeFilter} onValueChange={setThemeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Theme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Themes</SelectItem>
            {themes.map((theme) => (
              <SelectItem key={theme.id} value={theme.id}>
                {theme.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}

        <div className="ml-auto">
          <Badge variant="outline" className="font-normal">
            {tasks.length} tasks
          </Badge>
        </div>
      </div>

      {/* Tasks Table */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-destructive">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ListTodo className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-lg mb-1">No tasks</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Create tasks from recommendations or add a new task manually.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Theme</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Impact</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id} className={task.isOverdue ? 'bg-red-50' : ''}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{task.title}</p>
                      {task.assignee && (
                        <p className="text-xs text-muted-foreground">
                          Assigned to: {task.assignee.name}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {task.themeName ? (
                      <Badge variant="outline">{task.themeName}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(task.status)}</TableCell>
                  <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                  <TableCell>
                    {task.dueDate ? (
                      <div className={task.isOverdue ? 'text-red-600 font-medium' : ''}>
                        {new Date(task.dueDate).toLocaleDateString()}
                        {task.isOverdue && <span className="text-xs ml-1">(Overdue)</span>}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {renderFixScore(task)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateTaskStatus(task.id, 'COMPLETED')}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedTask(task);
                          setDetailOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Task Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedTask?.title}</DialogTitle>
            <DialogDescription>
              {selectedTask?.themeName && `Theme: ${selectedTask.themeName}`}
            </DialogDescription>
          </DialogHeader>
          
          {selectedTask && (
            <div className="space-y-4">
              {selectedTask.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="text-sm mt-1">{selectedTask.description}</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedTask.status)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Priority</Label>
                  <div className="mt-1">{getPriorityBadge(selectedTask.priority)}</div>
                </div>
              </div>

              {/* FixScore Section */}
              {selectedTask.status === 'COMPLETED' && (
                <Card className="bg-muted/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Impact Measurement
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!selectedTask.fixScore ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4 animate-pulse" />
                        <span>Calculating impact score...</span>
                      </div>
                    ) : selectedTask.fixScore.status === 'insufficient_data' ? (
                      <div className="space-y-2">
                        <div className="flex items-start gap-2 text-sm text-yellow-700 bg-yellow-50 p-3 rounded-lg">
                          <HelpCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium">Insufficient Data</p>
                            <p className="text-yellow-600 mt-1">
                              {selectedTask.fixScore.message}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : selectedTask.fixScore.status === 'available' ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Fix Score</span>
                          <span className={`text-lg font-bold ${
                            (selectedTask.fixScore.score ?? 0) > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {selectedTask.fixScore.score?.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Sentiment Change (ΔS)</span>
                          <span className={`font-medium ${
                            (selectedTask.fixScore.deltaS ?? 0) > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {(selectedTask.fixScore.deltaS ?? 0) > 0 ? '+' : ''}
                            {selectedTask.fixScore.deltaS?.toFixed(3)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Confidence</span>
                          <Badge variant="outline">{selectedTask.fixScore.confidence}</Badge>
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              )}

              {/* Quick Actions */}
              {selectedTask.status !== 'COMPLETED' && selectedTask.status !== 'CANCELLED' && (
                <div className="flex gap-2">
                  <Button onClick={() => {
                    updateTaskStatus(selectedTask.id, 'COMPLETED');
                    setDetailOpen(false);
                  }}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark Complete
                  </Button>
                  {selectedTask.status === 'PENDING' && (
                    <Button variant="outline" onClick={() => {
                      updateTaskStatus(selectedTask.id, 'IN_PROGRESS');
                      setDetailOpen(false);
                    }}>
                      Start Task
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Task Dialog */}
      <Dialog open={addTaskOpen} onOpenChange={setAddTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
            <DialogDescription>
              Create a new task to track an action item.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="title">Task Title</Label>
              <Input
                id="title"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Enter task title"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTaskOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createTask} disabled={isCreating || !newTaskTitle.trim()}>
              {isCreating ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function TasksPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <CreatedToastHandler />
      </Suspense>
      <TasksContent />
    </div>
  );
}
