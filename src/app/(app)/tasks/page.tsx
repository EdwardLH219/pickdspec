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
  DollarSign,
  Users,
  MousePointer,
  Repeat,
  Lightbulb,
  Sparkles,
  QrCode,
  Gift,
  Percent,
  BarChart3,
  LayoutList,
  Kanban,
  GripVertical,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from "recharts";

type StatusFilter = "all" | "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
type ViewMode = "list" | "kanban";

interface ValueRange {
  min: number;
  max: number;
  mid: number;
}

interface TaskEconomicImpact {
  revenueUpside: ValueRange | null;
  footfallUpside: { min: number; max: number } | null;
  impactDriver: 'ACQUISITION' | 'CONVERSION' | 'RETENTION';
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA';
  currency: string;
}

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
  economicImpact: TaskEconomicImpact | null;
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

interface TillMetrics {
  responseRate: {
    receiptsIssued: number;
    receiptsSubmitted: number;
    rate: number | null;
    ratePercent: number | null;
  };
  submissions: {
    total: number;
    avgRating: number | null;
    flaggedCount: number;
    flaggedRate: number;
  };
  incentives: {
    type: string;
    discountPercent: number | null;
    codesIssued: number;
    codesRedeemed: number;
    uptakeRate: number | null;
    uptakePercent: number | null;
  };
  channelStatus: {
    isActive: boolean;
    hasSettings: boolean;
  };
}

// Available source types for filtering impact data
const SOURCE_TYPES = [
  { id: 'all', label: 'All Sources', icon: BarChart3 },
  { id: 'GOOGLE', label: 'Google', icon: null },
  { id: 'HELLOPETER', label: 'HelloPeter', icon: null },
  { id: 'TILL_SLIP', label: 'Till Slip', icon: QrCode },
] as const;

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
  
  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  
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
  
  // Complete task dialog (for backdating)
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<Task | null>(null);
  const [completionDate, setCompletionDate] = useState<string>("");
  
  // Recalculate impact
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Timeline data for FixScore chart
  const [timelineData, setTimelineData] = useState<{
    timeline: Array<{ date: string; score: number; reviewCount: number; period: string }>;
    completionDate: string;
    stats: { preReviews: number; postReviews: number; preAvgScore: number | null; postAvgScore: number | null };
  } | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Till Slip metrics for impact view
  const [tillMetrics, setTillMetrics] = useState<TillMetrics | null>(null);
  const [tillMetricsLoading, setTillMetricsLoading] = useState(false);
  
  // Source filter for impact breakdown
  const [impactSourceFilter, setImpactSourceFilter] = useState<string>('all');

  // Fetch timeline data when viewing a completed task
  const fetchTimeline = async (taskId: string) => {
    setTimelineLoading(true);
    setTimelineData(null);
    try {
      const res = await fetch(`/api/portal/tasks/${taskId}/timeline`);
      if (res.ok) {
        const data = await res.json();
        if (data.timeline && data.timeline.length > 0) {
          setTimelineData(data);
        }
      }
    } catch (e) {
      console.error('Failed to fetch timeline:', e);
    } finally {
      setTimelineLoading(false);
    }
  };

  // Fetch Till Slip metrics for impact view
  const fetchTillMetrics = async () => {
    if (!selectedTenantId) return;
    
    setTillMetricsLoading(true);
    try {
      const res = await fetch(`/api/portal/till-metrics?tenantId=${selectedTenantId}&periodDays=30`);
      if (res.ok) {
        const data = await res.json();
        setTillMetrics(data);
      }
    } catch (e) {
      console.error('Failed to fetch till metrics:', e);
    } finally {
      setTillMetricsLoading(false);
    }
  };

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
  const updateTaskStatus = async (taskId: string, newStatus: string, customCompletedAt?: string) => {
    try {
      const body: { status: string; completedAt?: string } = { status: newStatus };
      if (newStatus === 'COMPLETED' && customCompletedAt) {
        body.completedAt = customCompletedAt;
      }
      
      const res = await fetch(`/api/portal/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const updatedTask = await res.json();
        // Update local state
        setTasks(prev => prev.map(t => 
          t.id === taskId 
            ? { ...t, status: newStatus, completedAt: updatedTask.completedAt || (newStatus === 'COMPLETED' ? new Date().toISOString() : t.completedAt) }
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

  // Open completion dialog with date picker
  const openCompleteDialog = (task: Task) => {
    setTaskToComplete(task);
    setCompletionDate(new Date().toISOString().split('T')[0]); // Default to today
    setCompleteDialogOpen(true);
  };

  // Handle task completion with date
  const handleCompleteWithDate = async () => {
    if (!taskToComplete) return;
    
    const completedAt = completionDate 
      ? new Date(completionDate + 'T12:00:00').toISOString() 
      : new Date().toISOString();
    
    await updateTaskStatus(taskToComplete.id, 'COMPLETED', completedAt);
    setCompleteDialogOpen(false);
    setTaskToComplete(null);
    setCompletionDate("");
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

  // Recalculate impact for a completed task
  const recalculateImpact = async (taskId: string) => {
    setIsRecalculating(true);
    try {
      const res = await fetch(`/api/portal/tasks/${taskId}/recalculate`, {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        toast.success('Impact recalculated', {
          description: `FixScore: ${data.fixScore.score.toFixed(2)}, ΔS: ${data.fixScore.deltaS.toFixed(3)}`,
        });
        // Refresh tasks to show updated FixScore
        const refreshRes = await fetch(`/api/portal/tasks?tenantId=${selectedTenantId}`);
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          setTasks(refreshData.tasks || []);
          // Update selected task if it's the one we recalculated
          const updatedTask = refreshData.tasks?.find((t: Task) => t.id === taskId);
          if (updatedTask) {
            setSelectedTask(updatedTask);
          }
        }
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to recalculate impact');
      }
    } catch {
      toast.error('Failed to recalculate impact');
    } finally {
      setIsRecalculating(false);
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

  // Get impact driver icon and label
  const getImpactDriverInfo = (driver: string) => {
    switch (driver) {
      case 'ACQUISITION':
        return { icon: Users, label: 'New Customer Acquisition', description: 'Affects visibility and first impressions' };
      case 'CONVERSION':
        return { icon: MousePointer, label: 'Online Conversion', description: 'Affects clicks to visits' };
      case 'RETENTION':
        return { icon: Repeat, label: 'Customer Retention', description: 'Affects repeat visits and word-of-mouth' };
      default:
        return { icon: Info, label: 'General Impact', description: '' };
    }
  };

  // Get confidence badge variant
  const getConfidenceBadge = (level: string) => {
    switch (level) {
      case 'HIGH':
        return { variant: 'default' as const, label: 'High' };
      case 'MEDIUM':
        return { variant: 'secondary' as const, label: 'Medium' };
      case 'LOW':
        return { variant: 'outline' as const, label: 'Low' };
      default:
        return { variant: 'outline' as const, label: 'N/A' };
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

        {/* View Toggle */}
        <div className="flex items-center border rounded-md">
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            className="rounded-r-none"
            onClick={() => setViewMode("list")}
          >
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "kanban" ? "secondary" : "ghost"}
            size="sm"
            className="rounded-l-none"
            onClick={() => setViewMode("kanban")}
          >
            <Kanban className="h-4 w-4" />
          </Button>
        </div>

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

      {/* Tasks View */}
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
      ) : viewMode === "kanban" ? (
        /* Kanban Board View */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Not Started Column */}
          <div 
            className="bg-gray-50 rounded-lg p-3 min-h-[500px]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const taskId = e.dataTransfer.getData('taskId');
              if (taskId) updateTaskStatus(taskId, 'PENDING');
            }}
          >
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
              <div className="w-2 h-2 rounded-full bg-gray-400" />
              <h3 className="font-semibold text-sm text-gray-700">Not Started</h3>
              <Badge variant="secondary" className="ml-auto text-xs">
                {tasks.filter(t => t.status === 'PENDING').length}
              </Badge>
            </div>
            <div className="space-y-2">
              {tasks.filter(t => t.status === 'PENDING').map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
                  className={`bg-white rounded-lg p-3 shadow-sm border border-gray-100 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${task.isOverdue ? 'border-l-2 border-l-red-500' : ''}`}
                >
                  <div className="flex items-start gap-2 mb-2">
                    <GripVertical className="h-4 w-4 text-gray-300 shrink-0 mt-0.5" />
                    <p className="font-medium text-sm line-clamp-2">{task.title}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2 ml-6">
                    {task.themeName && (
                      <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200 text-blue-700">
                        {task.themeName}
                      </Badge>
                    )}
                    {getPriorityBadge(task.priority)}
                  </div>
                  <div className="flex items-center justify-between ml-6">
                    {task.assignee ? (
                      <div className="flex items-center gap-1.5">
                        <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium text-primary">
                          {task.assignee.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs text-muted-foreground">{task.assignee.name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Unassigned</span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        setSelectedTask(task);
                        setDetailOpen(true);
                        setImpactSourceFilter('all');
                      }}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                  </div>
                  {task.dueDate && (
                    <div className={`text-xs mt-2 ml-6 ${task.isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                      Due: {new Date(task.dueDate).toLocaleDateString()}
                      {task.isOverdue && ' (Overdue)'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* In Progress Column */}
          <div 
            className="bg-blue-50/50 rounded-lg p-3 min-h-[500px]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const taskId = e.dataTransfer.getData('taskId');
              if (taskId) updateTaskStatus(taskId, 'IN_PROGRESS');
            }}
          >
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-blue-200">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <h3 className="font-semibold text-sm text-blue-700">In Progress</h3>
              <Badge variant="secondary" className="ml-auto text-xs bg-blue-100 text-blue-700">
                {tasks.filter(t => t.status === 'IN_PROGRESS').length}
              </Badge>
            </div>
            <div className="space-y-2">
              {tasks.filter(t => t.status === 'IN_PROGRESS').map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
                  className={`bg-white rounded-lg p-3 shadow-sm border border-blue-100 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${task.isOverdue ? 'border-l-2 border-l-red-500' : ''}`}
                >
                  <div className="flex items-start gap-2 mb-2">
                    <GripVertical className="h-4 w-4 text-gray-300 shrink-0 mt-0.5" />
                    <p className="font-medium text-sm line-clamp-2">{task.title}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2 ml-6">
                    {task.themeName && (
                      <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200 text-blue-700">
                        {task.themeName}
                      </Badge>
                    )}
                    {getPriorityBadge(task.priority)}
                  </div>
                  <div className="flex items-center justify-between ml-6">
                    {task.assignee ? (
                      <div className="flex items-center gap-1.5">
                        <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium text-primary">
                          {task.assignee.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs text-muted-foreground">{task.assignee.name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Unassigned</span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        setSelectedTask(task);
                        setDetailOpen(true);
                        setImpactSourceFilter('all');
                      }}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                  </div>
                  {task.dueDate && (
                    <div className={`text-xs mt-2 ml-6 ${task.isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                      Due: {new Date(task.dueDate).toLocaleDateString()}
                      {task.isOverdue && ' (Overdue)'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Done Column */}
          <div 
            className="bg-green-50/50 rounded-lg p-3 min-h-[500px]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const taskId = e.dataTransfer.getData('taskId');
              if (taskId) {
                const task = tasks.find(t => t.id === taskId);
                if (task && task.status !== 'COMPLETED') {
                  openCompleteDialog(task);
                }
              }
            }}
          >
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-green-200">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <h3 className="font-semibold text-sm text-green-700">Done</h3>
              <Badge variant="secondary" className="ml-auto text-xs bg-green-100 text-green-700">
                {tasks.filter(t => t.status === 'COMPLETED').length}
              </Badge>
            </div>
            <div className="space-y-2">
              {tasks.filter(t => t.status === 'COMPLETED').map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
                  className="bg-white rounded-lg p-3 shadow-sm border border-green-100 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-2 mb-2">
                    <GripVertical className="h-4 w-4 text-gray-300 shrink-0 mt-0.5" />
                    <p className="font-medium text-sm line-clamp-2">{task.title}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2 ml-6">
                    {task.themeName && (
                      <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200 text-blue-700">
                        {task.themeName}
                      </Badge>
                    )}
                    {getPriorityBadge(task.priority)}
                  </div>
                  <div className="flex items-center justify-between ml-6">
                    {task.assignee ? (
                      <div className="flex items-center gap-1.5">
                        <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium text-primary">
                          {task.assignee.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs text-muted-foreground">{task.assignee.name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Unassigned</span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        setSelectedTask(task);
                        setDetailOpen(true);
                        setImpactSourceFilter('all');
                        if (task.themeId) fetchTimeline(task.id);
                        fetchTillMetrics();
                      }}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                  </div>
                  {task.completedAt && (
                    <div className="text-xs mt-2 ml-6 text-green-600">
                      Completed: {new Date(task.completedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* List View */
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Theme</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Impact</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id} className={task.isOverdue ? 'bg-red-50' : ''}>
                  <TableCell>
                    <p className="font-medium">{task.title}</p>
                  </TableCell>
                  <TableCell>
                    {task.themeName ? (
                      <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700">{task.themeName}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {task.assignee ? (
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                          {task.assignee.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm">{task.assignee.name}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Unassigned</span>
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
                    {task.status === 'COMPLETED' && task.completedAt ? (
                      <span>{new Date(task.completedAt).toLocaleDateString()}</span>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
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
                          onClick={() => openCompleteDialog(task)}
                          title="Complete task"
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
                          setImpactSourceFilter('all');
                          // Fetch timeline for completed tasks with fixScore
                          if (task.status === 'COMPLETED' && task.themeId) {
                            fetchTimeline(task.id);
                          }
                          // Fetch Till Slip metrics for impact view
                          if (task.status === 'COMPLETED') {
                            fetchTillMetrics();
                          }
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
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
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
                    <CardTitle className="text-sm flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Impact Measurement
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => recalculateImpact(selectedTask.id)}
                        disabled={isRecalculating}
                      >
                        {isRecalculating ? (
                          <Clock className="h-4 w-4 animate-spin" />
                        ) : (
                          <span className="text-xs">Recalculate</span>
                        )}
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Source Filter Chips */}
                    <div className="mb-4">
                      <Label className="text-xs text-muted-foreground mb-2 block">Filter by Source</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {SOURCE_TYPES.map((source) => {
                          const isSelected = impactSourceFilter === source.id;
                          const Icon = source.icon;
                          return (
                            <button
                              key={source.id}
                              onClick={() => setImpactSourceFilter(source.id)}
                              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                                isSelected
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                              }`}
                            >
                              {Icon && <Icon className="h-3 w-3" />}
                              {source.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {!selectedTask.fixScore ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4 animate-pulse" />
                        <span>Calculating impact score...</span>
                      </div>
                    ) : selectedTask.fixScore.status === 'insufficient_data' ? (
                      <div className="space-y-3">
                        <div className="flex items-start gap-2 text-sm text-yellow-700 bg-yellow-50 p-3 rounded-lg">
                          <HelpCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium">Insufficient Data</p>
                            <p className="text-yellow-600 mt-1">
                              {selectedTask.fixScore.message}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Import more reviews and run scoring, then click Recalculate.
                        </p>
                      </div>
                    ) : selectedTask.fixScore.status === 'available' ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
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

                        {/* Till Slip Channel Metrics */}
                        {(impactSourceFilter === 'all' || impactSourceFilter === 'TILL_SLIP') && (
                          <div className="border-t pt-4 mt-4">
                            <div className="flex items-center gap-2 mb-3">
                              <QrCode className="h-4 w-4 text-purple-600" />
                              <span className="text-sm font-medium">Till Slip Channel</span>
                              {tillMetrics?.channelStatus.isActive && (
                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                  Active
                                </Badge>
                              )}
                            </div>
                            
                            {tillMetricsLoading ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                                <Clock className="h-4 w-4 animate-spin" />
                                Loading metrics...
                              </div>
                            ) : tillMetrics ? (
                              <div className="space-y-3">
                                {/* Response Rate */}
                                <div className="flex items-center justify-between bg-purple-50 rounded-lg p-2.5">
                                  <div className="flex items-center gap-2">
                                    <BarChart3 className="h-4 w-4 text-purple-600" />
                                    <div>
                                      <p className="text-sm font-medium">Response Rate</p>
                                      <p className="text-xs text-muted-foreground">
                                        {tillMetrics.responseRate.receiptsSubmitted} of {tillMetrics.responseRate.receiptsIssued} receipts
                                      </p>
                                    </div>
                                  </div>
                                  <span className="text-lg font-bold text-purple-700">
                                    {tillMetrics.responseRate.ratePercent !== null 
                                      ? `${tillMetrics.responseRate.ratePercent}%`
                                      : 'N/A'}
                                  </span>
                                </div>

                                {/* Incentive Uptake */}
                                {tillMetrics.incentives.type !== 'NONE' && (
                                  <div className="flex items-center justify-between bg-amber-50 rounded-lg p-2.5">
                                    <div className="flex items-center gap-2">
                                      {tillMetrics.incentives.type === 'DISCOUNT' ? (
                                        <Percent className="h-4 w-4 text-amber-600" />
                                      ) : (
                                        <Gift className="h-4 w-4 text-amber-600" />
                                      )}
                                      <div>
                                        <p className="text-sm font-medium">Incentive Uptake</p>
                                        <p className="text-xs text-muted-foreground">
                                          {tillMetrics.incentives.codesRedeemed} of {tillMetrics.incentives.codesIssued} codes redeemed
                                        </p>
                                      </div>
                                    </div>
                                    <span className="text-lg font-bold text-amber-700">
                                      {tillMetrics.incentives.uptakePercent !== null 
                                        ? `${tillMetrics.incentives.uptakePercent}%`
                                        : 'N/A'}
                                    </span>
                                  </div>
                                )}

                                {/* Submissions Summary */}
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="bg-gray-50 rounded p-2">
                                    <p className="text-muted-foreground">Total Submissions</p>
                                    <p className="font-semibold">{tillMetrics.submissions.total}</p>
                                  </div>
                                  <div className="bg-gray-50 rounded p-2">
                                    <p className="text-muted-foreground">Avg Rating</p>
                                    <p className="font-semibold">
                                      {tillMetrics.submissions.avgRating !== null 
                                        ? `${tillMetrics.submissions.avgRating}/5`
                                        : 'N/A'}
                                    </p>
                                  </div>
                                </div>

                                <p className="text-xs text-muted-foreground italic">
                                  Note: Till Slip metrics are informational only and do not affect sentiment scoring.
                                </p>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground py-2">
                                No Till Slip data available for this period.
                              </p>
                            )}
                          </div>
                        )}
                        
                        {/* Timeline Chart */}
                        {timelineLoading ? (
                          <div className="h-40 flex items-center justify-center">
                            <Clock className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : timelineData && timelineData.timeline.length > 0 ? (
                          <div className="mt-4">
                            <div className="text-xs text-muted-foreground mb-2">
                              Sentiment Timeline (Score 0-10)
                            </div>
                            <div className="h-44">
                              <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart 
                                  data={(() => {
                                    // Inject completion date marker if not already in timeline
                                    const timeline = [...timelineData.timeline];
                                    const completionDate = timelineData.completionDate;
                                    const hasCompletionDate = timeline.some(d => d.date === completionDate);
                                    if (!hasCompletionDate) {
                                      // Insert completion date at the right position
                                      const insertIndex = timeline.findIndex(d => d.date > completionDate);
                                      const marker = { date: completionDate, score: null as unknown as number, reviewCount: 0, period: 'marker' };
                                      if (insertIndex === -1) {
                                        timeline.push(marker);
                                      } else {
                                        timeline.splice(insertIndex, 0, marker);
                                      }
                                    }
                                    return timeline;
                                  })()}
                                  margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
                                >
                                  <defs>
                                    <linearGradient id="preGradient" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="postGradient" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                  <XAxis 
                                    dataKey="date" 
                                    tick={{ fontSize: 10 }}
                                    tickFormatter={(value) => {
                                      const d = new Date(value);
                                      return `${d.getMonth()+1}/${d.getDate()}`;
                                    }}
                                  />
                                  <YAxis 
                                    domain={[0, 10]} 
                                    tick={{ fontSize: 10 }}
                                    ticks={[0, 2.5, 5, 7.5, 10]}
                                  />
                                  <Tooltip 
                                    formatter={(value) => [typeof value === 'number' ? value.toFixed(1) : '0', 'Score']}
                                    labelFormatter={(label) => `Date: ${label}`}
                                  />
                                  {/* Task completion reference line */}
                                  <ReferenceLine 
                                    x={timelineData.completionDate} 
                                    stroke="#6366f1" 
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    label={{ 
                                      value: '⬇ Task Completed', 
                                      position: 'insideTopRight', 
                                      fontSize: 9,
                                      fill: '#6366f1',
                                      fontWeight: 600,
                                    }}
                                  />
                                  {/* Average lines */}
                                  {timelineData.stats.preAvgScore && (
                                    <ReferenceLine 
                                      y={timelineData.stats.preAvgScore} 
                                      stroke="#f59e0b" 
                                      strokeDasharray="3 3"
                                    />
                                  )}
                                  {timelineData.stats.postAvgScore && (
                                    <ReferenceLine 
                                      y={timelineData.stats.postAvgScore} 
                                      stroke="#22c55e" 
                                      strokeDasharray="3 3"
                                    />
                                  )}
                                  {/* Area fill based on period */}
                                  <Area
                                    type="monotone"
                                    dataKey="score"
                                    fill="url(#postGradient)"
                                    stroke="none"
                                  />
                                  {/* Line */}
                                  <Line 
                                    type="monotone" 
                                    dataKey="score" 
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    connectNulls
                                    dot={(props) => {
                                      const { cx, cy, payload } = props;
                                      // Don't show dot for the completion marker
                                      if (payload.period === 'marker' || !payload.score) {
                                        return <circle cx={0} cy={0} r={0} />;
                                      }
                                      const color = payload.period === 'pre' ? '#f59e0b' : '#22c55e';
                                      return (
                                        <circle 
                                          cx={cx} 
                                          cy={cy} 
                                          r={4} 
                                          fill={color}
                                          stroke="#fff"
                                          strokeWidth={1}
                                        />
                                      );
                                    }}
                                  />
                                </ComposedChart>
                              </ResponsiveContainer>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground mt-2">
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-amber-500" />
                                Pre: {timelineData.stats.preReviews} reviews
                                {timelineData.stats.preAvgScore && ` (avg: ${timelineData.stats.preAvgScore.toFixed(1)})`}
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                Post: {timelineData.stats.postReviews} reviews
                                {timelineData.stats.postAvgScore && ` (avg: ${timelineData.stats.postAvgScore.toFixed(1)})`}
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              )}

              {/* Economic Impact Panel */}
              {selectedTask.economicImpact && selectedTask.economicImpact.revenueUpside && (
                <Card className="bg-green-50/50 border-green-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      Revenue Impact
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Revenue Upside */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-muted-foreground">Potential Upside</span>
                      </div>
                      <span className="font-semibold text-green-600">
                        {formatRange(selectedTask.economicImpact.revenueUpside, selectedTask.economicImpact.currency)}
                        <span className="text-xs font-normal text-muted-foreground">/mo</span>
                      </span>
                    </div>
                    
                    {/* Impact Driver */}
                    {selectedTask.economicImpact.impactDriver && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Impact Driver</span>
                        <div className="flex items-center gap-1.5">
                          {(() => {
                            const info = getImpactDriverInfo(selectedTask.economicImpact!.impactDriver);
                            const Icon = info.icon;
                            return (
                              <>
                                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-sm">{info.label}</span>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                    
                    {/* Confidence */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Estimate Confidence</span>
                      <Badge variant={getConfidenceBadge(selectedTask.economicImpact.confidenceLevel).variant}>
                        {getConfidenceBadge(selectedTask.economicImpact.confidenceLevel).label}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Activation Suggestions */}
              {selectedTask.recommendationTitle && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-amber-500" />
                      Activation Suggestions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-muted-foreground mt-0.5">•</span>
                        <span>Brief your team on the specific issue from customer feedback</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-muted-foreground mt-0.5">•</span>
                        <span>Set clear success criteria and check back in 2 weeks</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-muted-foreground mt-0.5">•</span>
                        <span>Respond to recent negative reviews mentioning this issue</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-muted-foreground mt-0.5">•</span>
                        <span>Consider adding a feedback card to track improvement</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Quick Actions */}
              {selectedTask.status !== 'COMPLETED' && selectedTask.status !== 'CANCELLED' && (
                <div className="flex gap-2">
                  <Button onClick={() => {
                    setDetailOpen(false);
                    openCompleteDialog(selectedTask);
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

              {/* Generate Activations for completed tasks with positive impact */}
              {selectedTask.status === 'COMPLETED' && 
               selectedTask.fixScore?.status === 'available' && 
               (selectedTask.fixScore.deltaS ?? 0) > 0.1 && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground mb-2">
                    This task improved sentiment - generate marketing content to capitalize on it.
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/portal/activations', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ taskId: selectedTask.id }),
                        });
                        if (res.ok) {
                          const data = await res.json();
                          toast.success(`Generated ${data.drafts.length} activation drafts`, {
                            description: 'View them in the Activations page',
                          });
                        } else {
                          const error = await res.json();
                          toast.error(error.error || 'Failed to generate drafts');
                        }
                      } catch {
                        toast.error('Failed to generate activation drafts');
                      }
                    }}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Marketing Drafts
                  </Button>
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

      {/* Complete Task Dialog (with date picker) */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Task</DialogTitle>
            <DialogDescription>
              {taskToComplete?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="completionDate">Completion Date</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Set the date when this task was completed. Use a past date if backdating.
              </p>
              <Input
                id="completionDate"
                type="date"
                value={completionDate}
                onChange={(e) => setCompletionDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCompleteWithDate}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark Complete
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
