"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Theme, Review, ReviewTheme } from "@/lib/types";
import { getSourceById } from "@/lib/mock/sources";
import {
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Minus,
  Quote,
  Star,
  BarChart3,
} from "lucide-react";

interface ThemeBreakdownProps {
  themes: Theme[];
  reviews: Review[];
  reviewThemes: ReviewTheme[];
}

interface ThemeTrendPoint {
  week: string;
  weekLabel: string;
  mentions: number;
  avgSentiment: number;
}

export function ThemeBreakdown({
  themes,
  reviews,
  reviewThemes,
}: ThemeBreakdownProps) {
  const [selectedThemeId, setSelectedThemeId] = useState<string>(
    themes[0]?.id || ""
  );

  const selectedTheme = useMemo(
    () => themes.find((t) => t.id === selectedThemeId),
    [themes, selectedThemeId]
  );

  // Get theme statistics
  const themeStats = useMemo(() => {
    if (!selectedThemeId) return null;

    // Get all mentions of this theme
    const themeMentions = reviewThemes.filter(
      (rt) => rt.themeId === selectedThemeId
    );
    const reviewIds = new Set(themeMentions.map((rt) => rt.reviewId));
    const themeReviews = reviews.filter((r) => reviewIds.has(r.id));

    if (themeMentions.length === 0) {
      return {
        mentionCount: 0,
        avgSentiment: 0,
        positiveCount: 0,
        neutralCount: 0,
        negativeCount: 0,
        trend: "stable" as const,
        trendPercentage: 0,
      };
    }

    // Calculate stats
    const avgSentiment =
      themeMentions.reduce((sum, m) => sum + m.sentimentScore, 0) /
      themeMentions.length;

    const positiveCount = themeMentions.filter(
      (m) => m.sentiment === "positive"
    ).length;
    const neutralCount = themeMentions.filter(
      (m) => m.sentiment === "neutral"
    ).length;
    const negativeCount = themeMentions.filter(
      (m) => m.sentiment === "negative"
    ).length;

    // Calculate trend (compare last 2 weeks to previous 2 weeks)
    const sortedReviews = [...themeReviews].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const midpoint = Math.floor(sortedReviews.length / 2);
    const recentHalf = sortedReviews.slice(0, midpoint);
    const olderHalf = sortedReviews.slice(midpoint);

    let trend: "up" | "down" | "stable" = "stable";
    let trendPercentage = 0;

    if (recentHalf.length > 0 && olderHalf.length > 0) {
      const recentMentions = themeMentions.filter((m) =>
        recentHalf.some((r) => r.id === m.reviewId)
      );
      const olderMentions = themeMentions.filter((m) =>
        olderHalf.some((r) => r.id === m.reviewId)
      );

      const recentAvg =
        recentMentions.length > 0
          ? recentMentions.reduce((sum, m) => sum + m.sentimentScore, 0) /
            recentMentions.length
          : 0;
      const olderAvg =
        olderMentions.length > 0
          ? olderMentions.reduce((sum, m) => sum + m.sentimentScore, 0) /
            olderMentions.length
          : 0;

      const diff = recentAvg - olderAvg;
      if (Math.abs(diff) > 0.5) {
        trend = diff > 0 ? "up" : "down";
        trendPercentage = Math.abs(Math.round((diff / olderAvg) * 100));
      }
    }

    return {
      mentionCount: themeMentions.length,
      avgSentiment: Math.round(avgSentiment * 10) / 10,
      positiveCount,
      neutralCount,
      negativeCount,
      trend,
      trendPercentage,
    };
  }, [selectedThemeId, reviewThemes, reviews]);

  // Get trend data for chart
  const trendData = useMemo((): ThemeTrendPoint[] => {
    if (!selectedThemeId) return [];

    const themeMentions = reviewThemes.filter(
      (rt) => rt.themeId === selectedThemeId
    );
    const reviewIds = new Set(themeMentions.map((rt) => rt.reviewId));
    const themeReviews = reviews.filter((r) => reviewIds.has(r.id));

    // Group by week
    const weekMap = new Map<
      string,
      { mentions: number; sentimentSum: number }
    >();

    for (const review of themeReviews) {
      const reviewDate = new Date(review.date);
      const weekStart = new Date(reviewDate);
      weekStart.setDate(reviewDate.getDate() - reviewDate.getDay());
      const weekKey = weekStart.toISOString().split("T")[0];

      const mention = themeMentions.find((m) => m.reviewId === review.id);
      const sentimentScore = mention?.sentimentScore || review.sentimentScore;

      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, { mentions: 0, sentimentSum: 0 });
      }
      const data = weekMap.get(weekKey)!;
      data.mentions++;
      data.sentimentSum += sentimentScore;
    }

    // Convert to array
    const result: ThemeTrendPoint[] = [];
    for (const [week, data] of weekMap) {
      result.push({
        week,
        weekLabel: new Date(week).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        mentions: data.mentions,
        avgSentiment: Math.round((data.sentimentSum / data.mentions) * 10) / 10,
      });
    }

    return result.sort((a, b) => a.week.localeCompare(b.week));
  }, [selectedThemeId, reviewThemes, reviews]);

  // Get example quotes
  const exampleQuotes = useMemo(() => {
    if (!selectedThemeId) return [];

    const themeMentions = reviewThemes.filter(
      (rt) => rt.themeId === selectedThemeId
    );

    // Get a mix of sentiments
    const sorted = [...themeMentions].sort(
      (a, b) => b.sentimentScore - a.sentimentScore
    );

    const positive = sorted.find((m) => m.sentiment === "positive");
    const neutral = sorted.find((m) => m.sentiment === "neutral");
    const negative = sorted.reverse().find((m) => m.sentiment === "negative");

    const quotes = [positive, neutral, negative]
      .filter(Boolean)
      .map((mention) => {
        const review = reviews.find((r) => r.id === mention!.reviewId);
        return {
          excerpt: mention!.excerpt,
          sentiment: mention!.sentiment,
          sentimentScore: mention!.sentimentScore,
          rating: review?.rating || 0,
          source: review?.source || "google",
          date: review?.date || "",
        };
      });

    return quotes;
  }, [selectedThemeId, reviewThemes, reviews]);

  const getTrendIcon = () => {
    if (!themeStats) return null;
    switch (themeStats.trend) {
      case "up":
        return <TrendingUp className="h-5 w-5 text-emerald-500" />;
      case "down":
        return <TrendingDown className="h-5 w-5 text-rose-500" />;
      default:
        return <Minus className="h-5 w-5 text-gray-400" />;
    }
  };

  const getSentimentColor = (score: number) => {
    if (score >= 7) return "text-emerald-600";
    if (score >= 4) return "text-amber-600";
    return "text-rose-600";
  };

  if (themes.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-medium text-lg mb-1">No themes available</h3>
          <p className="text-muted-foreground text-center max-w-md">
            Theme data will appear here once reviews are analyzed.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Theme Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Select Theme:</span>
            <Select value={selectedThemeId} onValueChange={setSelectedThemeId}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select a theme" />
              </SelectTrigger>
              <SelectContent>
                {themes.map((theme) => (
                  <SelectItem key={theme.id} value={theme.id}>
                    <div className="flex items-center gap-2">
                      <span>{theme.name}</span>
                      <Badge variant="outline" className="text-xs font-normal">
                        {theme.category}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedTheme && themeStats && (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-100 p-2">
                    <MessageSquare className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">
                      {themeStats.mentionCount}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Total Mentions
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-purple-100 p-2">
                    <BarChart3 className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p
                      className={`text-2xl font-semibold ${getSentimentColor(
                        themeStats.avgSentiment
                      )}`}
                    >
                      {themeStats.avgSentiment}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Sentiment Score
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {getTrendIcon()}
                  <div>
                    <p className="text-2xl font-semibold">
                      {themeStats.trend === "stable"
                        ? "Stable"
                        : `${themeStats.trend === "up" ? "+" : "-"}${
                            themeStats.trendPercentage
                          }%`}
                    </p>
                    <p className="text-sm text-muted-foreground">Trend</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Sentiment Breakdown
                  </p>
                  <div className="flex gap-2">
                    <Badge className="bg-emerald-100 text-emerald-700">
                      {themeStats.positiveCount} pos
                    </Badge>
                    <Badge className="bg-amber-100 text-amber-700">
                      {themeStats.neutralCount} neu
                    </Badge>
                    <Badge className="bg-rose-100 text-rose-700">
                      {themeStats.negativeCount} neg
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Trend Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">
                Sentiment Trend for &ldquo;{selectedTheme.name}&rdquo;
              </CardTitle>
            </CardHeader>
            <CardContent>
              {trendData.length > 0 ? (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={trendData}
                      margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#e5e5e5"
                      />
                      <XAxis
                        dataKey="weekLabel"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#737373" }}
                        dy={10}
                      />
                      <YAxis
                        domain={[0, 10]}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#737373" }}
                        dx={-10}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "white",
                          border: "1px solid #e5e5e5",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                        formatter={(value, name) => {
                          if (name === "avgSentiment")
                            return [Number(value).toFixed(1), "Sentiment"];
                          return [value, "Mentions"];
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgSentiment"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        dot={{ fill: "#8b5cf6", r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                  No trend data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Example Quotes */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Quote className="h-4 w-4" />
                Example Quotes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {exampleQuotes.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-3">
                  {exampleQuotes.map((quote, idx) => {
                    const source = getSourceById(
                      quote.source as "google" | "hellopeter" | "facebook" | "tripadvisor"
                    );
                    const sentimentColors = {
                      positive: "border-emerald-200 bg-emerald-50",
                      neutral: "border-amber-200 bg-amber-50",
                      negative: "border-rose-200 bg-rose-50",
                    };
                    return (
                      <div
                        key={idx}
                        className={`rounded-lg border p-4 ${
                          sentimentColors[quote.sentiment as keyof typeof sentimentColors]
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge
                            className={
                              quote.sentiment === "positive"
                                ? "bg-emerald-100 text-emerald-700"
                                : quote.sentiment === "neutral"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-rose-100 text-rose-700"
                            }
                          >
                            {quote.sentiment}
                          </Badge>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{source.icon}</span>
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`h-3 w-3 ${
                                    star <= quote.rating
                                      ? "fill-amber-400 text-amber-400"
                                      : "fill-muted text-muted"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                        <p className="text-sm italic text-muted-foreground">
                          &ldquo;{quote.excerpt}&rdquo;
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Sentiment: {quote.sentimentScore.toFixed(1)}/10
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No quotes available for this theme
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
