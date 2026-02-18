"use client";

import { useEffect, useState } from "react";
import { useBranch } from "@/hooks/use-branch";
import {
  KpiCard,
  ReviewVolumeChart,
  SentimentPieChart,
  RatingDistributionChart,
  ThemeRadarChart,
  WorstReviewsCard,
  HealthGauge,
  SourceDistributionChart,
  WeeklyComparisonChart,
  BranchComparisonChart,
} from "@/components/dashboard";
import {
  SentimentTrendChart as SentimentLineChart,
} from "@/components/dashboard/charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Smile,
  Star,
  MessageSquare,
  AlertTriangle,
  RefreshCw,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Target,
  Building2,
} from "lucide-react";

interface DashboardData {
  hasData: boolean;
  message?: string;
  scoreRun?: {
    id: string;
    periodStart: string;
    periodEnd: string;
    completedAt: string;
  };
  kpis?: {
    avgSentiment: number;
    avgRating: number | null;
    totalReviews: number;
    totalMentions: number;
    avgSeverity: number;
    reviewsProcessed: number;
    themesProcessed: number;
    healthScore: number;
  };
  sentimentDistribution?: {
    positive: number;
    neutral: number;
    negative: number;
  };
  ratingDistribution?: Array<{
    rating: number;
    count: number;
    label: string;
  }>;
  sourceDistribution?: Array<{
    source: string;
    sourceName: string;
    count: number;
  }>;
  themeScores?: Array<{
    id: string;
    themeId: string;
    themeName: string;
    themeCategory: string;
    sentiment: number;
    score010: number;
    mentions: number;
    severity: number;
    radarScore: number;
  }>;
  worstReviews?: Array<{
    id: string;
    content: string;
    rating: number | null;
    reviewDate: string | null;
    authorName: string;
    sourceType: string | null;
    themes: string[];
  }>;
  topPerformers?: Array<{
    themeName: string;
    score010: number;
    mentions: number;
  }>;
  trends?: {
    weekly: Array<{
      week: string;
      weekLabel: string;
      reviews: number;
      sentimentScore: number;
      avgRating: number | null;
      positive: number;
      negative: number;
    }>;
    dailyVolume: Array<{
      date: string;
      dateLabel: string;
      reviews: number;
    }>;
  };
}

interface CompletedTask {
  id: string;
  title: string;
  completedAt: string;
  themeName?: string;
}

interface ComparisonData {
  hasData: boolean;
  message?: string;
  branches: Array<{
    id: string;
    name: string;
    avgScore: number;
    totalMentions: number;
    themeCount: number;
  }>;
  themes: Array<{
    id: string;
    name: string;
    category: string;
  }>;
  comparison: Array<{
    themeId: string;
    themeName: string;
    category: string;
    branchScores: Record<string, { score: number; sentiment: number; mentions: number }>;
  }>;
}

export default function DashboardPage() {
  const { selectedTenantId, selectedTenant, isLoading: branchLoading, dateRange } = useBranch();
  const [data, setData] = useState<DashboardData | null>(null);
  const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([]);
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch comparison data when "All Branches" is selected
  useEffect(() => {
    async function fetchComparison() {
      if (selectedTenantId) {
        // A specific tenant is selected, skip comparison fetch
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/portal/dashboard/compare');
        if (res.ok) {
          const data = await res.json();
          setComparisonData(data);
        } else {
          const err = await res.json();
          setError(err.error || 'Failed to load comparison data');
        }
      } catch {
        setError('Failed to load comparison data');
      } finally {
        setIsLoading(false);
      }
    }

    fetchComparison();
  }, [selectedTenantId]);

  // Fetch dashboard data and completed tasks when tenant changes
  useEffect(() => {
    async function fetchDashboard() {
      if (!selectedTenantId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Calculate date range for filtering based on current dateRange value
        const end = new Date();
        const start = new Date();
        switch (dateRange) {
          case "30d":
            start.setDate(end.getDate() - 30);
            break;
          case "90d":
            start.setDate(end.getDate() - 90);
            break;
          case "365d":
            start.setFullYear(end.getFullYear() - 1);
            break;
          default:
            start.setDate(end.getDate() - 30);
        }
        const startDate = start.toISOString();
        const endDate = end.toISOString();
        
        // Fetch dashboard and tasks in parallel
        const [dashboardRes, tasksRes] = await Promise.all([
          fetch(`/api/portal/dashboard?tenantId=${selectedTenantId}&startDate=${startDate}&endDate=${endDate}`),
          fetch(`/api/portal/tasks?tenantId=${selectedTenantId}&status=COMPLETED`),
        ]);
        
        if (dashboardRes.ok) {
          const dashboardData = await dashboardRes.json();
          setData(dashboardData);
        } else {
          const err = await dashboardRes.json();
          setError(err.error || 'Failed to load dashboard');
        }
        
        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          setCompletedTasks(
            (tasksData.tasks || []).map((t: { id: string; title: string; completedAt: string; themeName?: string }) => ({
              id: t.id,
              title: t.title,
              completedAt: t.completedAt,
              themeName: t.themeName,
            }))
          );
        }
      } catch {
        setError('Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    }

    fetchDashboard();
  }, [selectedTenantId, dateRange]);

  // Calculate metrics
  const negativeRate = data?.sentimentDistribution
    ? Math.round((data.sentimentDistribution.negative / 
        (data.sentimentDistribution.positive + data.sentimentDistribution.neutral + data.sentimentDistribution.negative || 1)) * 100)
    : 0;

  const positiveRate = data?.sentimentDistribution
    ? Math.round((data.sentimentDistribution.positive / 
        (data.sentimentDistribution.positive + data.sentimentDistribution.neutral + data.sentimentDistribution.negative || 1)) * 100)
    : 0;

  // Calculate week-over-week changes from trend data
  const getChanges = () => {
    const defaults = { 
      sentiment: { change: 0, direction: 'neutral' as const },
      rating: { change: 0, direction: 'neutral' as const },
      reviews: { change: 0, direction: 'neutral' as const },
      positive: { change: 0, direction: 'neutral' as const },
    };
    
    if (!data?.trends?.weekly || data.trends.weekly.length < 2) return defaults;
    
    const [prev, current] = data.trends.weekly.slice(-2);
    if (!prev || !current) return defaults;
    
    // Sentiment change
    const sentimentChange = current.sentimentScore - prev.sentimentScore;
    const sentimentDir = sentimentChange > 0.2 ? 'up' : sentimentChange < -0.2 ? 'down' : 'neutral';
    
    // Rating change
    const prevRating = prev.avgRating ?? 0;
    const currRating = current.avgRating ?? 0;
    const ratingChange = currRating - prevRating;
    const ratingDir = ratingChange > 0.1 ? 'up' : ratingChange < -0.1 ? 'down' : 'neutral';
    
    // Reviews change (percentage)
    const reviewsChange = prev.reviews > 0 
      ? Math.round(((current.reviews - prev.reviews) / prev.reviews) * 100) 
      : 0;
    const reviewsDir = reviewsChange > 5 ? 'up' : reviewsChange < -5 ? 'down' : 'neutral';
    
    // Positive rate change
    const prevPositiveRate = prev.reviews > 0 ? (prev.positive / prev.reviews) * 100 : 0;
    const currPositiveRate = current.reviews > 0 ? (current.positive / current.reviews) * 100 : 0;
    const positiveChange = currPositiveRate - prevPositiveRate;
    const positiveDir = positiveChange > 2 ? 'up' : positiveChange < -2 ? 'down' : 'neutral';
    
    return {
      sentiment: { change: Math.round(sentimentChange * 10) / 10, direction: sentimentDir as 'up' | 'down' | 'neutral' },
      rating: { change: Math.round(ratingChange * 10) / 10, direction: ratingDir as 'up' | 'down' | 'neutral' },
      reviews: { change: reviewsChange, direction: reviewsDir as 'up' | 'down' | 'neutral' },
      positive: { change: Math.round(positiveChange * 10) / 10, direction: positiveDir as 'up' | 'down' | 'neutral' },
    };
  };

  const changes = getChanges();
  const trendDirection = changes.sentiment.direction;

  if (branchLoading) {
    return <DashboardSkeleton />;
  }

  if (!selectedTenantId) {
    // Show comparison view for "All Branches"
    if (isLoading) {
      return <DashboardSkeleton />;
    }

    if (error) {
      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              All Branches
            </p>
          </div>
          <Card className="border-destructive">
            <CardContent className="py-12 text-center">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            All Branches - Comparison View
          </p>
        </div>

        {comparisonData?.hasData ? (
          <BranchComparisonChart
            branches={comparisonData.branches}
            comparison={comparisonData.comparison}
          />
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {comparisonData?.message || 'No comparison data available. Run scoring on multiple branches to see comparison.'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">{selectedTenant?.name}</p>
        </div>
        <Card className="border-destructive">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data?.hasData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">{selectedTenant?.name}</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <RefreshCw className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-medium text-lg mb-2">No Data Yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {data?.message || 'Import reviews and run scoring to see your dashboard.'}
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              Go to <span className="font-medium">Data Sources</span> to import reviews and click <span className="font-medium">Run Scoring</span>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground flex items-center gap-2 mt-1">
            <Activity className="h-4 w-4" />
            Review Intelligence for {selectedTenant?.name}
          </p>
        </div>
        {data.scoreRun && (
          <div className="text-sm text-muted-foreground text-right bg-muted/50 px-4 py-2 rounded-lg">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">
                {new Date(data.scoreRun.periodStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(data.scoreRun.periodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <div className="text-xs mt-1">
              Updated: {new Date(data.scoreRun.completedAt).toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {/* Top Row: Health Gauge + KPI Cards */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-5">
        {/* Health Gauge - Prominent */}
        <div className="lg:col-span-1">
          <HealthGauge 
            score={data.kpis?.healthScore ?? 50} 
            label="Overall Health"
          />
        </div>

        {/* KPI Cards */}
        <div className="lg:col-span-4 grid gap-4 grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Sentiment Score"
            value={data.kpis?.avgSentiment ?? 5}
            format="sentiment"
            change={changes.sentiment.change}
            changeLabel="vs last week"
            trend={changes.sentiment.direction}
            icon={
              changes.sentiment.direction === 'up' ? <TrendingUp className="h-5 w-5 text-green-500" /> :
              changes.sentiment.direction === 'down' ? <TrendingDown className="h-5 w-5 text-red-500" /> :
              <Minus className="h-5 w-5 text-yellow-500" />
            }
            subtitle="AI-analyzed"
            tooltip="AI-analyzed sentiment score based on review content (0-10 scale)"
          />
          <KpiCard
            title="Star Rating"
            value={data.kpis?.avgRating ?? 0}
            format="rating"
            change={changes.rating.change}
            changeLabel="vs last week"
            trend={changes.rating.direction}
            icon={
              changes.rating.direction === 'up' ? <TrendingUp className="h-5 w-5 text-green-500" /> :
              changes.rating.direction === 'down' ? <TrendingDown className="h-5 w-5 text-red-500" /> :
              <Star className="h-5 w-5 text-yellow-500" />
            }
            subtitle="Out of 5"
            tooltip="Average star rating across all reviews"
          />
          <KpiCard
            title="Total Reviews"
            value={data.kpis?.totalReviews ?? 0}
            format="number"
            change={changes.reviews.change}
            changeLabel="% vs last week"
            trend={changes.reviews.direction}
            icon={<MessageSquare className="h-5 w-5 text-blue-500" />}
            tooltip="Total reviews analyzed in scoring period"
          />
          <KpiCard
            title="Positive Rate"
            value={positiveRate}
            format="percent"
            change={changes.positive.change}
            changeLabel="vs last week"
            trend={changes.positive.direction}
            icon={<Smile className="h-5 w-5 text-green-500" />}
            tooltip={`${data.sentimentDistribution?.positive ?? 0} positive out of ${data.kpis?.totalReviews ?? 0} reviews`}
          />
        </div>
      </div>

      {/* Tabs for Different Views */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="themes">Themes</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Row 1: Sentiment Trend + Issues */}
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
            {/* Sentiment Trend - Takes 2/3 */}
            <div className="lg:col-span-2">
              {data.trends?.weekly && data.trends.weekly.length > 0 ? (
                <SentimentLineChart data={data.trends.weekly} completedTasks={completedTasks} />
              ) : (
                <Card className="h-full">
                  <CardContent className="flex items-center justify-center h-[300px]">
                    <p className="text-muted-foreground">Need more data for trends</p>
                  </CardContent>
                </Card>
              )}
            </div>
            {/* Worst Recent Reviews */}
            <div className="lg:col-span-1">
              <WorstReviewsCard reviews={data.worstReviews ?? []} />
            </div>
          </div>

          {/* Row 2: Distribution Charts */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            <SentimentPieChart 
              positive={data.sentimentDistribution?.positive ?? 0}
              neutral={data.sentimentDistribution?.neutral ?? 0}
              negative={data.sentimentDistribution?.negative ?? 0}
            />
            <RatingDistributionChart data={data.ratingDistribution ?? []} />
            <SourceDistributionChart data={data.sourceDistribution ?? []} />
          </div>

          {/* Top Performers Card */}
          {data.topPerformers && data.topPerformers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-green-500" />
                  Top Performing Areas
                </CardTitle>
                <CardDescription>Your strongest themes based on customer feedback</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {data.topPerformers.slice(0, 5).map((theme, idx) => (
                    <Badge 
                      key={theme.themeName}
                      variant={idx === 0 ? "default" : "secondary"}
                      className="text-sm py-1.5 px-3"
                    >
                      <span className="font-medium">{theme.themeName}</span>
                      <span className="ml-2 opacity-70">{theme.score010.toFixed(1)}/10</span>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            {data.trends?.weekly && (
              <SentimentLineChart data={data.trends.weekly} completedTasks={completedTasks} />
            )}
            {data.trends?.weekly && (
              <WeeklyComparisonChart data={data.trends.weekly} />
            )}
          </div>
          {data.trends?.dailyVolume && (
            <ReviewVolumeChart data={data.trends.dailyVolume} />
          )}
        </TabsContent>

        {/* Themes Tab */}
        <TabsContent value="themes" className="space-y-4">
          {/* Theme Radar Chart */}
          {data.themeScores && data.themeScores.length >= 3 && (
            <ThemeRadarChart data={data.themeScores} />
          )}

          {/* Theme Scores Table */}
          {data.themeScores && data.themeScores.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>All Theme Scores</CardTitle>
                <CardDescription>Detailed breakdown by theme, sorted by severity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.themeScores.map(theme => (
                    <div 
                      key={theme.id} 
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className={`w-2 h-10 rounded-full ${
                            theme.score010 >= 7 ? 'bg-green-500' : 
                            theme.score010 >= 4 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                        />
                        <div>
                          <p className="font-medium">{theme.themeName}</p>
                          <p className="text-xs text-muted-foreground">{theme.themeCategory}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-8 text-sm">
                        <div className="text-center">
                          <div className={`text-lg font-bold ${
                            theme.score010 >= 7 ? 'text-green-600' : 
                            theme.score010 >= 4 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {theme.score010.toFixed(1)}
                          </div>
                          <p className="text-xs text-muted-foreground">Score</p>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold">{theme.mentions}</div>
                          <p className="text-xs text-muted-foreground">Mentions</p>
                        </div>
                        <div className="text-center w-16">
                          <div className="text-sm font-medium text-muted-foreground">
                            {theme.severity > 0 ? theme.severity.toFixed(2) : '—'}
                          </div>
                          <p className="text-xs text-muted-foreground">Severity</p>
                        </div>
                        <div className="w-24">
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${
                                theme.score010 >= 7 ? 'bg-green-500' : 
                                theme.score010 >= 4 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${theme.score010 * 10}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-4">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {/* Score Run Info */}
            <Card>
              <CardHeader>
                <CardTitle>Scoring Details</CardTitle>
                <CardDescription>Information about the latest score run</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Reviews Processed</p>
                    <p className="text-2xl font-bold">{data.kpis?.reviewsProcessed ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Themes Analyzed</p>
                    <p className="text-2xl font-bold">{data.kpis?.themesProcessed ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Mentions</p>
                    <p className="text-2xl font-bold">{data.kpis?.totalMentions ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Severity</p>
                    <p className="text-2xl font-bold">{(data.kpis?.avgSeverity ?? 0).toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sentiment Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Sentiment Breakdown</CardTitle>
                <CardDescription>Detailed sentiment distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-green-500" />
                      <span>Positive Reviews</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-green-600">
                        {data.sentimentDistribution?.positive ?? 0}
                      </span>
                      <span className="text-muted-foreground">({positiveRate}%)</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-yellow-500" />
                      <span>Neutral Reviews</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-yellow-600">
                        {data.sentimentDistribution?.neutral ?? 0}
                      </span>
                      <span className="text-muted-foreground">
                        ({100 - positiveRate - negativeRate}%)
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-red-500" />
                      <span>Negative Reviews</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-red-600">
                        {data.sentimentDistribution?.negative ?? 0}
                      </span>
                      <span className="text-muted-foreground">({negativeRate}%)</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Loading skeleton component
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-5">
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-[160px] w-full" />
          </CardContent>
        </Card>
        <div className="lg:col-span-4 grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
