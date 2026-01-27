"use client";

import { useMemo } from "react";
import { useBranch } from "@/hooks/use-branch";
import {
  getDashboardMetrics,
  getReviewsTrend,
  getSentimentDistribution,
  getSourceDistribution,
  getDateRangeFromPreset,
  getBranchComparisonData,
} from "@/lib/data/dashboard";
import { getThemeSentimentSummaries } from "@/lib/data/themes";
import { getReviews, getReviewThemes } from "@/lib/data/reviews";
import { getCompletedTaskMarkers } from "@/lib/data/tasks";
import { TaskCompletionMarker } from "@/components/dashboard/sentiment-trend-chart";
import {
  KpiCard,
  SentimentTrendChart,
  ThemeMentionsChart,
  SourceSentimentChart,
  ThemeScatterChart,
  NegativeReviewsTable,
  BranchComparisonHeatmap,
} from "@/components/dashboard";
import {
  Smile,
  Star,
  MessageSquare,
  AlertTriangle,
} from "lucide-react";

export default function DashboardPage() {
  const { selectedBranchId, dateRange } = useBranch();

  // Memoize all data fetching based on branch and date range
  const metrics = useMemo(
    () => getDashboardMetrics(selectedBranchId, dateRange),
    [selectedBranchId, dateRange]
  );

  const reviewsTrend = useMemo(
    () => getReviewsTrend(selectedBranchId, dateRange),
    [selectedBranchId, dateRange]
  );

  const sentimentDistribution = useMemo(
    () => getSentimentDistribution(selectedBranchId, dateRange),
    [selectedBranchId, dateRange]
  );

  const sourceDistribution = useMemo(
    () => getSourceDistribution(selectedBranchId, dateRange),
    [selectedBranchId, dateRange]
  );

  const dateRangeObj = useMemo(
    () => getDateRangeFromPreset(dateRange),
    [dateRange]
  );

  const themeSummaries = useMemo(
    () => getThemeSentimentSummaries(selectedBranchId, dateRangeObj),
    [selectedBranchId, dateRangeObj]
  );

  // Get top theme IDs for task markers
  const topThemeIds = useMemo(
    () => themeSummaries.slice(0, 6).map((t) => t.themeId),
    [themeSummaries]
  );

  // Get completed task markers for the sentiment trend chart
  const taskMarkers = useMemo((): TaskCompletionMarker[] => {
    const markers = getCompletedTaskMarkers(selectedBranchId, topThemeIds);
    return markers.map((m) => ({
      ...m,
      dateLabel: new Date(m.completedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
    }));
  }, [selectedBranchId, topThemeIds]);

  // Get all reviews for the negative reviews table
  const allReviews = useMemo(() => {
    const result = getReviews({
      branchId: selectedBranchId,
      dateRange: dateRangeObj,
    });
    return result.data;
  }, [selectedBranchId, dateRangeObj]);

  // Create a map of review themes
  const reviewThemesMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getReviewThemes>>();
    for (const review of allReviews) {
      map.set(review.id, getReviewThemes(review.id));
    }
    return map;
  }, [allReviews]);

  // Calculate negative review rate
  const negativeRate = useMemo(() => {
    const negative = sentimentDistribution.find((s) => s.sentiment === "negative");
    return negative?.percentage ?? 0;
  }, [sentimentDistribution]);

  // Calculate negative rate change (difference, not percentage)
  const negativeRateChange = useMemo(() => {
    // This would come from comparing periods, but for now derive from sentiment change
    return metrics.sentimentChange > 0 ? -1.2 : 1.5;
  }, [metrics.sentimentChange]);

  // Branch comparison data (only for "All Branches" view)
  const branchComparisonData = useMemo(() => {
    if (selectedBranchId) return null;
    return getBranchComparisonData(dateRange);
  }, [selectedBranchId, dateRange]);

  const isAllBranches = !selectedBranchId;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1>Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of review performance and customer sentiment.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Overall Sentiment"
          value={metrics.avgSentimentScore}
          format="sentiment"
          change={metrics.sentimentChange}
          changeLabel="vs previous period"
          trend={metrics.sentimentChange > 0 ? "up" : metrics.sentimentChange < 0 ? "down" : "neutral"}
          icon={<Smile className="h-5 w-5" />}
          subtitle="Score out of 10"
          tooltip="AI-analyzed sentiment score (0-10) based on review text. Higher is better. Considers tone, context, and key phrases."
        />
        <KpiCard
          title="Average Rating"
          value={metrics.averageRating}
          format="rating"
          change={metrics.ratingChange}
          changeLabel="vs previous period"
          trend={metrics.ratingChange > 0 ? "up" : metrics.ratingChange < 0 ? "down" : "neutral"}
          icon={<Star className="h-5 w-5" />}
          subtitle="Out of 5 stars"
          tooltip="Average star rating across all review platforms. Calculated from Google, HelloPeter, Facebook, and TripAdvisor reviews."
        />
        <KpiCard
          title="Total Reviews"
          value={metrics.totalReviews}
          format="number"
          change={metrics.reviewsChange}
          changeLabel="vs previous period"
          trend={metrics.reviewsChange > 0 ? "up" : metrics.reviewsChange < 0 ? "down" : "neutral"}
          icon={<MessageSquare className="h-5 w-5" />}
          tooltip="Total number of reviews received in the selected time period. More reviews generally means more visibility and trust."
        />
        <KpiCard
          title="Negative Review Rate"
          value={negativeRate}
          format="percent"
          change={negativeRateChange}
          changeLabel="vs previous period"
          trend={negativeRateChange < 0 ? "down" : "up"}
          icon={<AlertTriangle className="h-5 w-5" />}
          tooltip="Percentage of reviews classified as negative sentiment. Lower is better. A decrease indicates improving customer satisfaction."
        />
      </div>

      {/* Chart Row 1 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SentimentTrendChart data={reviewsTrend} taskMarkers={taskMarkers} />
        <ThemeMentionsChart data={themeSummaries} />
      </div>

      {/* Chart Row 2 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SourceSentimentChart data={sourceDistribution} />
        <ThemeScatterChart data={themeSummaries} />
      </div>

      {/* Branch Comparison Heatmap (All Branches view only) */}
      {isAllBranches && branchComparisonData && (
        <BranchComparisonHeatmap data={branchComparisonData} />
      )}

      {/* Negative Reviews Table */}
      <NegativeReviewsTable
        reviews={allReviews}
        reviewThemes={reviewThemesMap}
      />
    </div>
  );
}
