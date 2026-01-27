import { mockTasks, mockThemes, mockRecommendations, mockReviews, mockReviewThemes } from "@/lib/mock";
import { Task, TaskStatus, RecommendationPriority, Theme, Recommendation } from "@/lib/types";

export interface TaskFilters {
  branchId?: string | null;
  statuses?: TaskStatus[];
  priorities?: RecommendationPriority[];
  recommendationId?: string;
  themeId?: string;
  assignee?: string;
  dueBefore?: string;
  dueAfter?: string;
}

export interface TaskWithDetails extends Task {
  theme: Theme | null;
  recommendation: Recommendation | null;
}

export function getTasks(filters?: TaskFilters): Task[] {
  let results = [...mockTasks];

  if (filters) {
    if (filters.branchId !== undefined) {
      results = results.filter(
        (t) => t.branchId === null || t.branchId === filters.branchId
      );
    }
    if (filters.statuses && filters.statuses.length > 0) {
      results = results.filter((t) => filters.statuses!.includes(t.status));
    }
    if (filters.priorities && filters.priorities.length > 0) {
      results = results.filter((t) => filters.priorities!.includes(t.priority));
    }
    if (filters.recommendationId) {
      results = results.filter(
        (t) => t.recommendationId === filters.recommendationId
      );
    }
    if (filters.themeId) {
      results = results.filter((t) => t.themeId === filters.themeId);
    }
    if (filters.assignee) {
      results = results.filter((t) =>
        t.assignee.toLowerCase().includes(filters.assignee!.toLowerCase())
      );
    }
    if (filters.dueBefore) {
      results = results.filter((t) => t.dueDate <= filters.dueBefore!);
    }
    if (filters.dueAfter) {
      results = results.filter((t) => t.dueDate >= filters.dueAfter!);
    }
  }

  // Sort by status (pending/in_progress first), then by due date, then by priority
  const statusOrder = { pending: 0, in_progress: 1, completed: 2, cancelled: 3 };
  const priorityOrder = { high: 0, medium: 1, low: 2 };

  return results.sort((a, b) => {
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;

    const dateDiff =
      new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    if (dateDiff !== 0) return dateDiff;

    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

export function getTasksWithDetails(filters?: TaskFilters): TaskWithDetails[] {
  const tasks = getTasks(filters);
  
  return tasks.map((task) => ({
    ...task,
    theme: task.themeId ? mockThemes.find((t) => t.id === task.themeId) || null : null,
    recommendation: task.recommendationId 
      ? mockRecommendations.find((r) => r.id === task.recommendationId) || null 
      : null,
  }));
}

export function getTaskById(id: string): Task | undefined {
  return mockTasks.find((t) => t.id === id);
}

export function getTasksByRecommendation(recommendationId: string): Task[] {
  return mockTasks.filter((t) => t.recommendationId === recommendationId);
}

export function getTaskStats(branchId?: string | null) {
  const tasks = getTasks({ branchId });
  const now = new Date("2026-01-27");

  const overdue = tasks.filter(
    (t) =>
      (t.status === "pending" || t.status === "in_progress") &&
      new Date(t.dueDate) < now
  );

  const dueThisWeek = tasks.filter((t) => {
    if (t.status === "completed" || t.status === "cancelled") return false;
    const dueDate = new Date(t.dueDate);
    const weekFromNow = new Date(now);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    return dueDate >= now && dueDate <= weekFromNow;
  });

  return {
    total: tasks.length,
    byStatus: {
      pending: tasks.filter((t) => t.status === "pending").length,
      in_progress: tasks.filter((t) => t.status === "in_progress").length,
      completed: tasks.filter((t) => t.status === "completed").length,
      cancelled: tasks.filter((t) => t.status === "cancelled").length,
    },
    overdue: overdue.length,
    dueThisWeek: dueThisWeek.length,
    completionRate:
      tasks.length > 0
        ? Math.round(
            (tasks.filter((t) => t.status === "completed").length /
              tasks.length) *
              100
          )
        : 0,
  };
}

export function getUpcomingTasks(
  branchId?: string | null,
  limit: number = 5
): Task[] {
  const now = new Date("2026-01-27").toISOString();
  return getTasks({
    branchId,
    statuses: ["pending", "in_progress"],
    dueAfter: now,
  }).slice(0, limit);
}

export function getOverdueTasks(branchId?: string | null): Task[] {
  const now = new Date("2026-01-27").toISOString();
  return getTasks({
    branchId,
    statuses: ["pending", "in_progress"],
    dueBefore: now,
  });
}

// Get unique assignees from tasks
export function getUniqueAssignees(branchId?: string | null): string[] {
  const tasks = getTasks({ branchId });
  const assignees = new Set(tasks.map((t) => t.assignee));
  return Array.from(assignees).sort();
}

// Get themes that have tasks
export function getThemesWithTasks(branchId?: string | null): Theme[] {
  const tasks = getTasks({ branchId });
  const themeIds = new Set(tasks.filter((t) => t.themeId).map((t) => t.themeId!));
  return mockThemes.filter((t) => themeIds.has(t.id));
}

// Impact tracking: Get review mentions for a theme before/after a date
export interface ImpactDataPoint {
  week: string;
  mentions: number;
  avgSentiment: number;
  period: "before" | "after";
}

export function getThemeImpactData(
  themeId: string,
  completionDate: string,
  branchId?: string | null
): ImpactDataPoint[] {
  // Get all review theme mentions for this theme
  const themeMentions = mockReviewThemes.filter((rt) => rt.themeId === themeId);
  const reviewIds = new Set(themeMentions.map((rt) => rt.reviewId));
  
  // Get corresponding reviews
  let reviews = mockReviews.filter((r) => reviewIds.has(r.id));
  
  if (branchId) {
    reviews = reviews.filter((r) => r.branchId === branchId);
  }

  // Group by week
  const weekData = new Map<string, { mentions: number; sentimentSum: number; period: "before" | "after" }>();
  const completionTime = new Date(completionDate).getTime();

  for (const review of reviews) {
    const reviewDate = new Date(review.date);
    // Get start of week
    const weekStart = new Date(reviewDate);
    weekStart.setDate(reviewDate.getDate() - reviewDate.getDay());
    const weekKey = weekStart.toISOString().split("T")[0];
    
    const period = reviewDate.getTime() < completionTime ? "before" : "after";
    
    // Get sentiment score for this theme mention
    const mention = themeMentions.find((rt) => rt.reviewId === review.id);
    const sentimentScore = mention?.sentimentScore || review.sentimentScore;

    if (!weekData.has(weekKey)) {
      weekData.set(weekKey, { mentions: 0, sentimentSum: 0, period });
    }
    const data = weekData.get(weekKey)!;
    data.mentions++;
    data.sentimentSum += sentimentScore;
  }

  // Convert to array and sort by date
  const result: ImpactDataPoint[] = [];
  for (const [week, data] of weekData) {
    result.push({
      week,
      mentions: data.mentions,
      avgSentiment: Math.round((data.sentimentSum / data.mentions) * 10) / 10,
      period: data.period,
    });
  }

  return result.sort((a, b) => a.week.localeCompare(b.week));
}

// Check if we have enough data for impact tracking
export function hasEnoughImpactData(
  themeId: string,
  completionDate: string,
  branchId?: string | null
): boolean {
  const data = getThemeImpactData(themeId, completionDate, branchId);
  const beforeCount = data.filter((d) => d.period === "before").length;
  const afterCount = data.filter((d) => d.period === "after").length;
  return beforeCount >= 2 && afterCount >= 1;
}

// Get completed task markers for sentiment trend chart
export interface TaskMarkerData {
  id: string;
  title: string;
  themeName: string;
  completedAt: string;
}

export function getCompletedTaskMarkers(
  branchId?: string | null,
  topThemeIds?: string[]
): TaskMarkerData[] {
  // Get completed tasks
  const completedTasks = mockTasks.filter(
    (t) =>
      t.status === "completed" &&
      t.completedAt &&
      t.themeId &&
      (branchId === undefined || t.branchId === null || t.branchId === branchId)
  );

  // Filter to top themes if provided
  const filteredTasks = topThemeIds
    ? completedTasks.filter((t) => topThemeIds.includes(t.themeId!))
    : completedTasks;

  // Map to marker data
  return filteredTasks
    .map((task) => {
      const theme = mockThemes.find((t) => t.id === task.themeId);
      return {
        id: task.id,
        title: task.title,
        themeName: theme?.name || "Unknown Theme",
        completedAt: task.completedAt!,
      };
    })
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
}
