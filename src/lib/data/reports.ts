import { mockReviews, mockReviewThemes, mockThemes, mockBranches, mockOrganization } from "@/lib/mock";
import { Branch, Review, ThemeSentimentSummary, RatingDistribution, DateRange } from "@/lib/types";
import { getThemeSentimentSummaries } from "./themes";
import { getDateRangeFromPreset, getRatingDistribution } from "./dashboard";

export interface MonthlyReportData {
  // Header
  organization: typeof mockOrganization;
  branch: Branch | null;
  dateRange: DateRange;
  generatedAt: string;
  
  // Summary metrics
  totalReviews: number;
  avgRating: number;
  avgSentiment: number;
  responseRate: number;
  
  // TL;DR bullets
  tldrBullets: string[];
  
  // Thematics
  thematics: ThemeSentimentSummary[];
  
  // What people love/dislike
  whatPeopleLove: { theme: string; quote: string; source: string }[];
  whatPeopleDislike: { theme: string; quote: string; source: string }[];
  
  // Watch-outs & Tips
  watchOuts: string[];
  practicalTips: string[];
  
  // Signals & Stats
  signals: {
    last30Days: number;
    last90Days: number;
    last365Days: number;
  };
  starDistribution: RatingDistribution[];
}

function getReviewCountForPeriod(branchId: string | null, days: number): number {
  const end = new Date("2026-01-27T23:59:59Z");
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  
  return mockReviews.filter(r => {
    const matchesBranch = !branchId || r.branchId === branchId;
    const matchesDate = r.date >= start.toISOString() && r.date <= end.toISOString();
    return matchesBranch && matchesDate;
  }).length;
}

function getQuotesForSentiment(
  branchId: string | null,
  dateRange: DateRange,
  sentiment: "positive" | "negative",
  limit: number = 3
): { theme: string; quote: string; source: string }[] {
  // Filter reviews
  let reviews = mockReviews.filter(r => {
    const matchesBranch = !branchId || r.branchId === branchId;
    const matchesDate = r.date >= dateRange.start && r.date <= dateRange.end;
    const matchesSentiment = r.sentiment === sentiment;
    return matchesBranch && matchesDate && matchesSentiment;
  });
  
  // Sort by sentiment score (highest for positive, lowest for negative)
  if (sentiment === "positive") {
    reviews = reviews.sort((a, b) => b.sentimentScore - a.sentimentScore);
  } else {
    reviews = reviews.sort((a, b) => a.sentimentScore - b.sentimentScore);
  }
  
  const quotes: { theme: string; quote: string; source: string }[] = [];
  
  for (const review of reviews.slice(0, limit * 2)) {
    // Get theme mentions for this review
    const themeMentions = mockReviewThemes.filter(rt => 
      rt.reviewId === review.id && rt.sentiment === sentiment
    );
    
    if (themeMentions.length > 0) {
      const mention = themeMentions[0];
      const theme = mockThemes.find(t => t.id === mention.themeId);
      
      if (theme && quotes.length < limit) {
        quotes.push({
          theme: theme.name,
          quote: `"${mention.excerpt}"`,
          source: review.source.charAt(0).toUpperCase() + review.source.slice(1),
        });
      }
    }
  }
  
  return quotes;
}

function generateTldrBullets(
  thematics: ThemeSentimentSummary[],
  totalReviews: number,
  avgRating: number,
  avgSentiment: number
): string[] {
  const bullets: string[] = [];
  
  // Overall performance
  if (avgRating >= 4.0) {
    bullets.push(`Strong overall performance with ${avgRating.toFixed(1)}★ average rating across ${totalReviews} reviews.`);
  } else if (avgRating >= 3.5) {
    bullets.push(`Moderate performance with ${avgRating.toFixed(1)}★ average rating. Room for improvement identified.`);
  } else {
    bullets.push(`Performance needs attention. Average rating of ${avgRating.toFixed(1)}★ indicates significant issues.`);
  }
  
  // Top strength
  const topPositive = thematics.find(t => t.avgSentimentScore >= 7);
  if (topPositive) {
    bullets.push(`"${topPositive.themeName}" is your top strength with ${topPositive.avgSentimentScore.toFixed(1)}/10 sentiment score.`);
  }
  
  // Top concern
  const topNegative = thematics.find(t => t.avgSentimentScore < 5);
  if (topNegative) {
    bullets.push(`"${topNegative.themeName}" requires immediate attention (${topNegative.avgSentimentScore.toFixed(1)}/10 sentiment).`);
  }
  
  // Trending
  const trendingUp = thematics.filter(t => t.trend === "up" && t.trendPercentage > 10);
  if (trendingUp.length > 0) {
    bullets.push(`Positive momentum: "${trendingUp[0].themeName}" mentions trending up ${trendingUp[0].trendPercentage}%.`);
  }
  
  const trendingDown = thematics.filter(t => t.trend === "down" && t.trendPercentage < -10);
  if (trendingDown.length > 0) {
    bullets.push(`Watch: "${trendingDown[0].themeName}" sentiment declining ${Math.abs(trendingDown[0].trendPercentage)}% vs prior period.`);
  }
  
  return bullets.slice(0, 5);
}

function generateWatchOuts(thematics: ThemeSentimentSummary[]): string[] {
  const watchOuts: string[] = [];
  
  // Low sentiment themes
  const lowSentiment = thematics.filter(t => t.avgSentimentScore < 5);
  for (const theme of lowSentiment.slice(0, 2)) {
    watchOuts.push(`${theme.themeName}: Sentiment score of ${theme.avgSentimentScore.toFixed(1)} is below target. ${theme.negativeCount} negative mentions this period.`);
  }
  
  // High negative ratio
  const highNegativeRatio = thematics.filter(t => 
    t.mentionCount >= 5 && (t.negativeCount / t.mentionCount) > 0.3
  );
  for (const theme of highNegativeRatio.slice(0, 2)) {
    const ratio = Math.round((theme.negativeCount / theme.mentionCount) * 100);
    if (!watchOuts.some(w => w.startsWith(theme.themeName))) {
      watchOuts.push(`${theme.themeName}: ${ratio}% of mentions are negative. Review operational processes.`);
    }
  }
  
  // Declining trends
  const declining = thematics.filter(t => t.trend === "down" && t.trendPercentage < -15);
  for (const theme of declining.slice(0, 1)) {
    if (!watchOuts.some(w => w.startsWith(theme.themeName))) {
      watchOuts.push(`${theme.themeName}: Declining trend (${theme.trendPercentage}%). Investigate recent changes.`);
    }
  }
  
  return watchOuts.slice(0, 4);
}

function generatePracticalTips(thematics: ThemeSentimentSummary[]): string[] {
  const tips: string[] = [];
  
  // Tips based on low-performing themes
  const lowPerformers = thematics.filter(t => t.avgSentimentScore < 6).slice(0, 3);
  
  const tipMap: Record<string, string> = {
    "Service Speed": "Implement order tracking and set service time targets. Consider adding staff during peak hours.",
    "Staff Friendliness": "Conduct customer service training sessions. Recognize staff who receive positive mentions.",
    "Cleanliness": "Increase cleaning frequency during service hours. Create a visible cleaning checklist.",
    "Value for Money": "Review portion sizes and pricing. Consider a value menu or lunch specials.",
    "Food Quality": "Audit supplier quality and review recipes. Implement quality checks before serving.",
    "Ambiance": "Review lighting, music volume, and temperature. Consider customer comfort in seating arrangements.",
    "Menu Variety": "Add seasonal specials and dietary options (vegetarian, gluten-free, etc.).",
    "Reservation & Booking": "Implement online booking. Send confirmation reminders and manage wait times proactively.",
  };
  
  for (const theme of lowPerformers) {
    const tip = tipMap[theme.themeName];
    if (tip) {
      tips.push(tip);
    }
  }
  
  // Generic improvement tips
  if (tips.length < 3) {
    tips.push("Respond to all negative reviews within 24 hours with a personalized message.");
    tips.push("Share positive reviews with staff to reinforce good behaviors.");
  }
  
  return tips.slice(0, 4);
}

export function getMonthlyReportData(branchId: string | null): MonthlyReportData {
  const dateRange = getDateRangeFromPreset("30d");
  const branch = branchId ? mockBranches.find(b => b.id === branchId) || null : null;
  
  // Get filtered reviews
  const reviews = mockReviews.filter(r => {
    const matchesBranch = !branchId || r.branchId === branchId;
    const matchesDate = r.date >= dateRange.start && r.date <= dateRange.end;
    return matchesBranch && matchesDate;
  });
  
  const totalReviews = reviews.length;
  const avgRating = totalReviews > 0 
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews 
    : 0;
  const avgSentiment = totalReviews > 0
    ? reviews.reduce((sum, r) => sum + r.sentimentScore, 0) / totalReviews
    : 0;
  const respondedCount = reviews.filter(r => r.responded).length;
  const responseRate = totalReviews > 0 ? (respondedCount / totalReviews) * 100 : 0;
  
  // Get thematics
  const thematics = getThemeSentimentSummaries(branchId, dateRange);
  
  return {
    organization: mockOrganization,
    branch,
    dateRange,
    generatedAt: new Date().toISOString(),
    
    totalReviews,
    avgRating: Math.round(avgRating * 100) / 100,
    avgSentiment: Math.round(avgSentiment * 10) / 10,
    responseRate: Math.round(responseRate),
    
    tldrBullets: generateTldrBullets(thematics, totalReviews, avgRating, avgSentiment),
    
    thematics,
    
    whatPeopleLove: getQuotesForSentiment(branchId, dateRange, "positive", 4),
    whatPeopleDislike: getQuotesForSentiment(branchId, dateRange, "negative", 4),
    
    watchOuts: generateWatchOuts(thematics),
    practicalTips: generatePracticalTips(thematics),
    
    signals: {
      last30Days: getReviewCountForPeriod(branchId, 30),
      last90Days: getReviewCountForPeriod(branchId, 90),
      last365Days: getReviewCountForPeriod(branchId, 365),
    },
    
    starDistribution: getRatingDistribution(branchId, "30d"),
  };
}
