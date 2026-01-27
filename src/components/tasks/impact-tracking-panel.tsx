"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { TaskWithDetails, getThemeImpactData, hasEnoughImpactData } from "@/lib/data/tasks";
import { TrendingUp, TrendingDown, Info, BarChart3 } from "lucide-react";

interface ImpactTrackingPanelProps {
  task: TaskWithDetails | null;
  branchId: string | null;
}

export function ImpactTrackingPanel({ task, branchId }: ImpactTrackingPanelProps) {
  const impactData = useMemo(() => {
    if (!task?.themeId || !task.completedAt) return null;
    return getThemeImpactData(task.themeId, task.completedAt, branchId);
  }, [task, branchId]);

  const hasEnoughData = useMemo(() => {
    if (!task?.themeId || !task.completedAt) return false;
    return hasEnoughImpactData(task.themeId, task.completedAt, branchId);
  }, [task, branchId]);

  // Calculate before/after averages
  const stats = useMemo(() => {
    if (!impactData || impactData.length === 0) return null;

    const before = impactData.filter((d) => d.period === "before");
    const after = impactData.filter((d) => d.period === "after");

    if (before.length === 0 || after.length === 0) return null;

    const avgSentimentBefore =
      before.reduce((sum, d) => sum + d.avgSentiment, 0) / before.length;
    const avgSentimentAfter =
      after.reduce((sum, d) => sum + d.avgSentiment, 0) / after.length;

    const avgMentionsBefore =
      before.reduce((sum, d) => sum + d.mentions, 0) / before.length;
    const avgMentionsAfter =
      after.reduce((sum, d) => sum + d.mentions, 0) / after.length;

    return {
      sentimentBefore: Math.round(avgSentimentBefore * 10) / 10,
      sentimentAfter: Math.round(avgSentimentAfter * 10) / 10,
      sentimentChange: Math.round((avgSentimentAfter - avgSentimentBefore) * 10) / 10,
      mentionsBefore: Math.round(avgMentionsBefore * 10) / 10,
      mentionsAfter: Math.round(avgMentionsAfter * 10) / 10,
    };
  }, [impactData]);

  // Format data for chart
  const chartData = useMemo(() => {
    if (!impactData) return [];
    return impactData.map((d) => ({
      ...d,
      weekLabel: new Date(d.week).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
    }));
  }, [impactData]);

  // No task selected
  if (!task) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Impact Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Info className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              Select a completed task to see its impact on review sentiment.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Task not completed
  if (task.status !== "completed" || !task.completedAt) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Impact Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Info className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground max-w-xs">
              Impact tracking is available for completed tasks. Mark this task as
              complete to track its effect on reviews.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No theme linked
  if (!task.themeId || !task.theme) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Impact Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Info className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground max-w-xs">
              This task is not linked to a theme. Link tasks to themes to track
              their impact on related review mentions.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Not enough data
  if (!hasEnoughData || !stats) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Impact Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Badge variant="secondary">{task.theme.name}</Badge>
          </div>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Info className="h-10 w-10 text-blue-500/50 mb-3" />
            <p className="text-sm font-medium mb-1">Collecting Data</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Not enough review data yet to show impact. We need at least 2 weeks
              of data before completion and 1 week after to show trends.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show impact data
  const sentimentImproved = stats.sentimentChange > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Impact Tracking
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Theme badge */}
        <div>
          <Badge variant="secondary">{task.theme.name}</Badge>
        </div>

        {/* Stats summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground mb-1">Sentiment Change</p>
            <div className="flex items-center gap-2">
              {sentimentImproved ? (
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              ) : (
                <TrendingDown className="h-5 w-5 text-rose-500" />
              )}
              <span
                className={`text-xl font-semibold ${
                  sentimentImproved ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {stats.sentimentChange > 0 ? "+" : ""}
                {stats.sentimentChange}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.sentimentBefore} → {stats.sentimentAfter}
            </p>
          </div>

          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground mb-1">Avg Weekly Mentions</p>
            <div className="flex items-center gap-2">
              <span className="text-xl font-semibold">
                {stats.mentionsAfter}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              was {stats.mentionsBefore}/week
            </p>
          </div>
        </div>

        {/* Chart */}
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorBefore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorAfter" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis
                dataKey="weekLabel"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "#737373" }}
              />
              <YAxis
                domain={[0, 10]}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "#737373" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e5e5",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value) => [Number(value).toFixed(1), "Sentiment"]}
              />
              <ReferenceLine
                x={chartData.find((d) => d.period === "after")?.weekLabel}
                stroke="#10b981"
                strokeDasharray="3 3"
                label={{
                  value: "Completed",
                  position: "top",
                  fontSize: 10,
                  fill: "#10b981",
                }}
              />
              <Area
                type="monotone"
                dataKey="avgSentiment"
                stroke="#64748b"
                fill="url(#colorBefore)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Showing sentiment trend for &ldquo;{task.theme.name}&rdquo; mentions
        </p>
      </CardContent>
    </Card>
  );
}
