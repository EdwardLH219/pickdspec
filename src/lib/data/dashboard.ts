import { mockReviews, reviewSources } from "@/lib/mock";
import {
  DashboardData,
  DashboardMetrics,
  ReviewTrendPoint,
  RatingDistribution,
  SentimentDistribution,
  SourceDistribution,
  DateRange,
  DateRangePreset,
} from "@/lib/types";
import { getThemeSentimentSummaries } from "./themes";
import { getRecentReviews } from "./reviews";

// Helper to get date range from preset
export function getDateRangeFromPreset(preset: DateRangePreset): DateRange {
  const end = new Date("2026-01-27T23:59:59Z");
  const start = new Date(end);

  switch (preset) {
    case "30d":
      start.setDate(start.getDate() - 30);
      break;
    case "90d":
      start.setDate(start.getDate() - 90);
      break;
    case "365d":
      start.setDate(start.getDate() - 365);
      break;
    case "custom":
      // Default to 30 days for custom (would be set by date picker in real app)
      start.setDate(start.getDate() - 30);
      break;
  }

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

// Get previous period for comparison
function getPreviousPeriod(dateRange: DateRange): DateRange {
  const start = new Date(dateRange.start);
  const end = new Date(dateRange.end);
  const duration = end.getTime() - start.getTime();

  return {
    start: new Date(start.getTime() - duration).toISOString(),
    end: new Date(end.getTime() - duration).toISOString(),
  };
}

// Filter reviews by branch and date range
function filterReviews(branchId: string | null, dateRange: DateRange) {
  return mockReviews.filter((r) => {
    const matchesBranch = !branchId || r.branchId === branchId;
    const matchesDate = r.date >= dateRange.start && r.date <= dateRange.end;
    return matchesBranch && matchesDate;
  });
}

// Calculate metrics for a set of reviews
function calculateMetrics(reviews: typeof mockReviews): Omit<DashboardMetrics, "reviewsChange" | "ratingChange" | "responseRateChange" | "sentimentChange"> {
  if (reviews.length === 0) {
    return {
      totalReviews: 0,
      averageRating: 0,
      responseRate: 0,
      avgSentimentScore: 0,
    };
  }

  const totalReviews = reviews.length;
  const averageRating =
    reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;
  const respondedCount = reviews.filter((r) => r.responded).length;
  const responseRate = (respondedCount / totalReviews) * 100;
  const avgSentimentScore =
    reviews.reduce((sum, r) => sum + r.sentimentScore, 0) / totalReviews;

  return {
    totalReviews,
    averageRating: Math.round(averageRating * 100) / 100,
    responseRate: Math.round(responseRate * 10) / 10,
    avgSentimentScore: Math.round(avgSentimentScore * 10) / 10,
  };
}

// Calculate percentage change
function calcChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function getDashboardMetrics(
  branchId: string | null,
  dateRangePreset: DateRangePreset
): DashboardMetrics {
  const dateRange = getDateRangeFromPreset(dateRangePreset);
  const previousPeriod = getPreviousPeriod(dateRange);

  const currentReviews = filterReviews(branchId, dateRange);
  const previousReviews = filterReviews(branchId, previousPeriod);

  const current = calculateMetrics(currentReviews);
  const previous = calculateMetrics(previousReviews);

  return {
    ...current,
    reviewsChange: calcChange(current.totalReviews, previous.totalReviews),
    ratingChange: Math.round((current.averageRating - previous.averageRating) * 100) / 100,
    responseRateChange: Math.round((current.responseRate - previous.responseRate) * 10) / 10,
    sentimentChange: Math.round((current.avgSentimentScore - previous.avgSentimentScore) * 10) / 10,
  };
}

export function getReviewsTrend(
  branchId: string | null,
  dateRangePreset: DateRangePreset
): ReviewTrendPoint[] {
  const dateRange = getDateRangeFromPreset(dateRangePreset);
  const reviews = filterReviews(branchId, dateRange);

  // Group by week
  const weekMap = new Map<string, typeof reviews>();

  for (const review of reviews) {
    const date = new Date(review.date);
    // Get start of week (Sunday)
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split("T")[0];

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, []);
    }
    weekMap.get(weekKey)!.push(review);
  }

  // Convert to trend points
  const trendPoints: ReviewTrendPoint[] = [];
  for (const [date, weekReviews] of weekMap) {
    const avgRating =
      weekReviews.reduce((sum, r) => sum + r.rating, 0) / weekReviews.length;
    const avgSentiment =
      weekReviews.reduce((sum, r) => sum + r.sentimentScore, 0) /
      weekReviews.length;

    trendPoints.push({
      date,
      count: weekReviews.length,
      avgRating: Math.round(avgRating * 100) / 100,
      avgSentiment: Math.round(avgSentiment * 10) / 10,
    });
  }

  // Sort by date
  return trendPoints.sort((a, b) => a.date.localeCompare(b.date));
}

export function getRatingDistribution(
  branchId: string | null,
  dateRangePreset: DateRangePreset
): RatingDistribution[] {
  const dateRange = getDateRangeFromPreset(dateRangePreset);
  const reviews = filterReviews(branchId, dateRange);
  const total = reviews.length;

  const distribution: RatingDistribution[] = [5, 4, 3, 2, 1].map((rating) => {
    const count = reviews.filter((r) => r.rating === rating).length;
    return {
      rating,
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    };
  });

  return distribution;
}

export function getSentimentDistribution(
  branchId: string | null,
  dateRangePreset: DateRangePreset
): SentimentDistribution[] {
  const dateRange = getDateRangeFromPreset(dateRangePreset);
  const reviews = filterReviews(branchId, dateRange);
  const total = reviews.length;

  const sentiments: ("positive" | "neutral" | "negative")[] = [
    "positive",
    "neutral",
    "negative",
  ];

  return sentiments.map((sentiment) => {
    const count = reviews.filter((r) => r.sentiment === sentiment).length;
    return {
      sentiment,
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    };
  });
}

export function getSourceDistribution(
  branchId: string | null,
  dateRangePreset: DateRangePreset
): SourceDistribution[] {
  const dateRange = getDateRangeFromPreset(dateRangePreset);
  const reviews = filterReviews(branchId, dateRange);
  const total = reviews.length;

  return reviewSources.map((source) => {
    const sourceReviews = reviews.filter((r) => r.source === source.id);
    const count = sourceReviews.length;
    const avgRating =
      count > 0
        ? sourceReviews.reduce((sum, r) => sum + r.rating, 0) / count
        : 0;

    return {
      source: source.id,
      sourceName: source.name,
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
      avgRating: Math.round(avgRating * 100) / 100,
    };
  });
}

export function getDashboardData(
  branchId: string | null,
  dateRangePreset: DateRangePreset
): DashboardData {
  const dateRange = getDateRangeFromPreset(dateRangePreset);

  return {
    metrics: getDashboardMetrics(branchId, dateRangePreset),
    reviewsTrend: getReviewsTrend(branchId, dateRangePreset),
    ratingDistribution: getRatingDistribution(branchId, dateRangePreset),
    sentimentDistribution: getSentimentDistribution(branchId, dateRangePreset),
    sourceDistribution: getSourceDistribution(branchId, dateRangePreset),
    topThemes: getThemeSentimentSummaries(branchId, dateRange).slice(0, 6),
    recentReviews: getRecentReviews(branchId, 5),
  };
}

// Branch comparison heatmap data
export interface BranchThemeCell {
  branchId: string;
  branchName: string;
  themeId: string;
  themeName: string;
  totalMentions: number;
  negativeMentions: number;
  negativeRate: number; // 0-100
  avgSentiment: number; // 0-10
}

export interface BranchComparisonData {
  branches: { id: string; name: string }[];
  themes: { id: string; name: string }[];
  cells: Map<string, BranchThemeCell>; // key: `${branchId}-${themeId}`
}

export function getBranchComparisonData(
  dateRangePreset: DateRangePreset
): BranchComparisonData {
  const { mockBranches } = require("@/lib/mock");
  const { mockReviews, mockReviewThemes, mockThemes } = require("@/lib/mock");
  
  const dateRange = getDateRangeFromPreset(dateRangePreset);
  
  // Filter reviews by date range
  const reviews = mockReviews.filter(
    (r: { date: string }) => r.date >= dateRange.start && r.date <= dateRange.end
  );
  const reviewIds = new Set(reviews.map((r: { id: string }) => r.id));
  
  // Get relevant theme mentions
  const relevantMentions = mockReviewThemes.filter(
    (rt: { reviewId: string }) => reviewIds.has(rt.reviewId)
  );
  
  // Get top 6 themes by total mentions (global themes only for comparison)
  const globalThemes = mockThemes.filter((t: { branchId: string | null }) => t.branchId === null);
  const themeCountMap = new Map<string, number>();
  
  for (const mention of relevantMentions) {
    const theme = globalThemes.find((t: { id: string }) => t.id === mention.themeId);
    if (theme) {
      themeCountMap.set(mention.themeId, (themeCountMap.get(mention.themeId) || 0) + 1);
    }
  }
  
  const topThemeIds = Array.from(themeCountMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([id]) => id);
  
  const topThemes = topThemeIds.map((id) => {
    const theme = globalThemes.find((t: { id: string }) => t.id === id);
    return { id, name: theme?.name || id };
  });
  
  // Build cells map
  const cells = new Map<string, BranchThemeCell>();
  
  for (const branch of mockBranches) {
    const branchReviews = reviews.filter((r: { branchId: string }) => r.branchId === branch.id);
    const branchReviewIds = new Set(branchReviews.map((r: { id: string }) => r.id));
    
    for (const theme of topThemes) {
      const mentions = relevantMentions.filter(
        (rt: { reviewId: string; themeId: string }) => 
          branchReviewIds.has(rt.reviewId) && rt.themeId === theme.id
      );
      
      const totalMentions = mentions.length;
      const negativeMentions = mentions.filter(
        (m: { sentiment: string }) => m.sentiment === "negative"
      ).length;
      const negativeRate = totalMentions > 0 
        ? Math.round((negativeMentions / totalMentions) * 100) 
        : 0;
      const avgSentiment = totalMentions > 0
        ? Math.round(
            (mentions.reduce((sum: number, m: { sentimentScore: number }) => sum + m.sentimentScore, 0) / totalMentions) * 10
          ) / 10
        : 0;
      
      const key = `${branch.id}-${theme.id}`;
      cells.set(key, {
        branchId: branch.id,
        branchName: branch.name,
        themeId: theme.id,
        themeName: theme.name,
        totalMentions,
        negativeMentions,
        negativeRate,
        avgSentiment,
      });
    }
  }
  
  return {
    branches: mockBranches.map((b: { id: string; name: string }) => ({ id: b.id, name: b.name })),
    themes: topThemes,
    cells,
  };
}
