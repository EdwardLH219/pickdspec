import { mockThemes, mockReviewThemes, mockReviews } from "@/lib/mock";
import { Theme, ThemeSentimentSummary, DateRange } from "@/lib/types";

export function getThemes(branchId?: string | null): Theme[] {
  return mockThemes.filter(
    (theme) => theme.branchId === null || theme.branchId === branchId
  );
}

export function getThemeById(id: string): Theme | undefined {
  return mockThemes.find((t) => t.id === id);
}

export function getThemeSentimentSummaries(
  branchId?: string | null,
  dateRange?: DateRange
): ThemeSentimentSummary[] {
  // Get reviews in date range
  let reviews = mockReviews;
  if (branchId) {
    reviews = reviews.filter((r) => r.branchId === branchId);
  }
  if (dateRange) {
    reviews = reviews.filter(
      (r) => r.date >= dateRange.start && r.date <= dateRange.end
    );
  }

  const reviewIds = new Set(reviews.map((r) => r.id));

  // Get theme mentions for these reviews
  const relevantThemeMentions = mockReviewThemes.filter((rt) =>
    reviewIds.has(rt.reviewId)
  );

  // Aggregate by theme
  const themeMap = new Map<
    string,
    {
      mentions: typeof relevantThemeMentions;
      theme: Theme;
    }
  >();

  for (const mention of relevantThemeMentions) {
    const theme = mockThemes.find((t) => t.id === mention.themeId);
    if (!theme) continue;
    
    // Filter to themes relevant for this branch
    if (branchId && theme.branchId !== null && theme.branchId !== branchId) {
      continue;
    }

    if (!themeMap.has(mention.themeId)) {
      themeMap.set(mention.themeId, { mentions: [], theme });
    }
    themeMap.get(mention.themeId)!.mentions.push(mention);
  }

  // Calculate summaries
  const summaries: ThemeSentimentSummary[] = [];
  for (const [themeId, data] of themeMap) {
    const { mentions, theme } = data;
    const positiveCount = mentions.filter((m) => m.sentiment === "positive").length;
    const neutralCount = mentions.filter((m) => m.sentiment === "neutral").length;
    const negativeCount = mentions.filter((m) => m.sentiment === "negative").length;
    const avgScore =
      mentions.reduce((sum, m) => sum + m.sentimentScore, 0) / mentions.length;

    // Simulate trend (deterministic based on theme id)
    const trendValue = parseInt(themeId.split("-")[1]) % 3;
    const trend: "up" | "down" | "stable" =
      trendValue === 0 ? "up" : trendValue === 1 ? "down" : "stable";
    const trendPercentage =
      trend === "stable" ? 0 : (parseInt(themeId.split("-")[1]) % 20) + 5;

    summaries.push({
      themeId,
      themeName: theme.name,
      category: theme.category,
      mentionCount: mentions.length,
      avgSentimentScore: Math.round(avgScore * 10) / 10,
      positiveCount,
      neutralCount,
      negativeCount,
      trend,
      trendPercentage: trend === "down" ? -trendPercentage : trendPercentage,
    });
  }

  // Sort by mention count descending
  return summaries.sort((a, b) => b.mentionCount - a.mentionCount);
}
