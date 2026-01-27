"use client";

import { useMemo, useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useBranch } from "@/hooks/use-branch";
import {
  getTasksWithDetails,
  getTaskStats,
  getUniqueAssignees,
  getThemesWithTasks,
  TaskWithDetails,
} from "@/lib/data/tasks";
import { getRecommendations } from "@/lib/data/recommendations";
import { mockThemes } from "@/lib/mock";
import { TasksTable, AddTaskModal, ImpactTrackingPanel, NewTask } from "@/components/tasks";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaskStatus } from "@/lib/types";
import { toast } from "sonner";
import {
  Plus,
  ListTodo,
  Clock,
  CheckCircle,
  AlertTriangle,
  Filter,
  X,
} from "lucide-react";

type StatusFilterValue = "all" | TaskStatus;

// Separate component that handles the created query param and shows toast
function CreatedToastHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("created") === "true") {
      toast.success("Tasks created successfully", {
        description: "Tasks from recommendation have been added to your list.",
      });
      window.history.replaceState({}, "", "/tasks");
    }
  }, [searchParams]);

  return null;
}

function TasksContent() {
  const { selectedBranchId } = useBranch();

  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all");
  const [themeFilter, setThemeFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [selectedTask, setSelectedTask] = useState<TaskWithDetails | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [localTasks, setLocalTasks] = useState<TaskWithDetails[]>([]);

  // Fetch base tasks
  const baseTasks = useMemo(
    () => getTasksWithDetails({ branchId: selectedBranchId }),
    [selectedBranchId]
  );

  // Initialize local tasks from base tasks
  useEffect(() => {
    setLocalTasks(baseTasks);
  }, [baseTasks]);

  // Apply filters
  const filteredTasks = useMemo(() => {
    let result = localTasks;

    if (statusFilter !== "all") {
      result = result.filter((t) => t.status === statusFilter);
    }
    if (themeFilter !== "all") {
      result = result.filter((t) => t.themeId === themeFilter);
    }
    if (assigneeFilter !== "all") {
      result = result.filter((t) => t.assignee === assigneeFilter);
    }

    return result;
  }, [localTasks, statusFilter, themeFilter, assigneeFilter]);

  // Get filter options
  const themes = useMemo(
    () => getThemesWithTasks(selectedBranchId),
    [selectedBranchId]
  );

  const assignees = useMemo(
    () => getUniqueAssignees(selectedBranchId),
    [selectedBranchId]
  );

  const recommendations = useMemo(
    () => getRecommendations({ branchId: selectedBranchId }),
    [selectedBranchId]
  );

  // Stats
  const stats = useMemo(
    () => getTaskStats(selectedBranchId),
    [selectedBranchId]
  );

  // Handlers
  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    setLocalTasks((prev) =>
      prev.map((task) => {
        if (task.id === taskId) {
          return {
            ...task,
            status: newStatus,
            completedAt:
              newStatus === "completed"
                ? new Date("2026-01-27").toISOString()
                : newStatus === "pending" || newStatus === "in_progress"
                ? null
                : task.completedAt,
          };
        }
        return task;
      })
    );

    // Update selected task if it's the one being changed
    if (selectedTask?.id === taskId) {
      setSelectedTask((prev) =>
        prev
          ? {
              ...prev,
              status: newStatus,
              completedAt:
                newStatus === "completed"
                  ? new Date("2026-01-27").toISOString()
                  : newStatus === "pending" || newStatus === "in_progress"
                  ? null
                  : prev.completedAt,
            }
          : null
      );
    }
  };

  const handleMarkComplete = (taskId: string) => {
    handleStatusChange(taskId, "completed");
    toast.success("Task completed", {
      description: "Great work! The task has been marked as done.",
    });
  };

  const handleAddTask = (newTask: NewTask) => {
    const task: TaskWithDetails = {
      id: `task-${Date.now()}`,
      branchId: selectedBranchId,
      recommendationId: newTask.recommendationId,
      themeId: newTask.themeId,
      title: newTask.title,
      description: newTask.description,
      status: "pending",
      priority: newTask.priority,
      assignee: newTask.assignee || "Unassigned",
      dueDate: new Date(newTask.dueDate).toISOString(),
      completedAt: null,
      createdAt: new Date("2026-01-27").toISOString(),
      theme: newTask.themeId
        ? mockThemes.find((t) => t.id === newTask.themeId) || null
        : null,
      recommendation: newTask.recommendationId
        ? recommendations.find((r) => r.id === newTask.recommendationId) || null
        : null,
    };

    setLocalTasks((prev) => [task, ...prev]);
    toast.success("Task created", {
      description: `"${newTask.title}" has been added to your task list.`,
    });
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setThemeFilter("all");
    setAssigneeFilter("all");
  };

  const hasActiveFilters =
    statusFilter !== "all" || themeFilter !== "all" || assigneeFilter !== "all";

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1>Tasks</h1>
          <p className="text-muted-foreground">
            Track and manage action items from your review analysis.
          </p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
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
                <p className="text-2xl font-semibold">{stats.total}</p>
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
                <p className="text-2xl font-semibold">{stats.byStatus.in_progress}</p>
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
                <p className="text-2xl font-semibold">{stats.overdue}</p>
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
                <p className="text-2xl font-semibold">{stats.completionRate}%</p>
                <p className="text-sm text-muted-foreground">Completion Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left: Table */}
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filters:</span>
            </div>

            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilterValue)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Not Started</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Done</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
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

            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                {assignees.map((assignee) => (
                  <SelectItem key={assignee} value={assignee}>
                    {assignee}
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
                {filteredTasks.length} tasks
              </Badge>
            </div>
          </div>

          {/* Table */}
          <TasksTable
            tasks={filteredTasks}
            onStatusChange={handleStatusChange}
            onMarkComplete={handleMarkComplete}
            onSelectTask={setSelectedTask}
            selectedTaskId={selectedTask?.id}
          />
        </div>

        {/* Right: Impact Tracking Panel */}
        <div className="lg:sticky lg:top-24">
          <ImpactTrackingPanel task={selectedTask} branchId={selectedBranchId} />
        </div>
      </div>

      {/* Add Task Modal */}
      <AddTaskModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onSubmit={handleAddTask}
        themes={mockThemes}
        recommendations={recommendations}
        assignees={assignees}
      />
    </>
  );
}

export default function TasksPage() {
  return (
    <div className="space-y-6">
      {/* Toast handler for created query param */}
      <Suspense fallback={null}>
        <CreatedToastHandler />
      </Suspense>

      {/* Main content */}
      <TasksContent />
    </div>
  );
}
