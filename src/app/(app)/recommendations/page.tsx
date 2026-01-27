"use client";

import { useMemo, useState } from "react";
import { useBranch } from "@/hooks/use-branch";
import { getDateRangeFromPreset } from "@/lib/data/dashboard";
import {
  getRecommendationsWithDetails,
  getRecommendationStats,
  GeneratedTask,
} from "@/lib/data/recommendations";
import { RecommendationCard } from "@/components/recommendations";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Lightbulb,
  AlertCircle,
  Clock,
  CheckCircle,
  Filter,
} from "lucide-react";

type StatusFilter = "all" | "actionable" | "completed";

export default function RecommendationsPage() {
  const { selectedBranchId, dateRange } = useBranch();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("actionable");

  const dateRangeObj = useMemo(
    () => getDateRangeFromPreset(dateRange),
    [dateRange]
  );

  const allRecommendations = useMemo(
    () =>
      getRecommendationsWithDetails({
        branchId: selectedBranchId,
        dateRange: dateRangeObj,
      }),
    [selectedBranchId, dateRangeObj]
  );

  const filteredRecommendations = useMemo(() => {
    if (statusFilter === "all") return allRecommendations;
    if (statusFilter === "actionable") {
      return allRecommendations.filter(
        (r) => r.status === "new" || r.status === "in_progress"
      );
    }
    if (statusFilter === "completed") {
      return allRecommendations.filter(
        (r) => r.status === "completed" || r.status === "dismissed"
      );
    }
    return allRecommendations;
  }, [allRecommendations, statusFilter]);

  const stats = useMemo(
    () => getRecommendationStats(selectedBranchId),
    [selectedBranchId]
  );

  const handleTasksCreated = (tasks: GeneratedTask[]) => {
    // In a real app, this would save to backend
    console.log("Tasks created:", tasks);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1>Recommendations</h1>
        <p className="text-muted-foreground">
          AI-powered insights to improve your review performance, sorted by
          severity.
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
                <p className="text-2xl font-semibold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">
                  Total Recommendations
                </p>
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
                <p className="text-2xl font-semibold">{stats.byPriority.high}</p>
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
                <p className="text-2xl font-semibold">
                  {stats.byStatus.in_progress}
                </p>
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
                <p className="text-2xl font-semibold">
                  {stats.byStatus.completed}
                </p>
                <p className="text-sm text-muted-foreground">Completed</p>
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

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Sorted by severity (mentions × negativity)</span>
          <Badge variant="outline" className="font-normal">
            {filteredRecommendations.length} items
          </Badge>
        </div>
      </div>

      {/* Recommendations List */}
      <div className="space-y-4">
        {filteredRecommendations.length > 0 ? (
          filteredRecommendations.map((recommendation) => (
            <RecommendationCard
              key={recommendation.id}
              recommendation={recommendation}
              onTasksCreated={handleTasksCreated}
            />
          ))
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Lightbulb className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-lg mb-1">No recommendations</h3>
              <p className="text-muted-foreground text-center max-w-md">
                {statusFilter === "actionable"
                  ? "All recommendations have been addressed. Great job!"
                  : statusFilter === "completed"
                  ? "No completed recommendations yet."
                  : "No recommendations available for the selected filters."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
