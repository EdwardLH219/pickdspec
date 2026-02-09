"use client";

import { useEffect, useState } from "react";
import { useBranch } from "@/hooks/use-branch";
import {
  KpiCard,
} from "@/components/dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Smile,
  Star,
  MessageSquare,
  AlertTriangle,
  RefreshCw,
  Calendar,
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
  };
  sentimentDistribution?: {
    positive: number;
    neutral: number;
    negative: number;
  };
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
  }>;
}

export default function DashboardPage() {
  const { selectedTenantId, selectedTenant, isLoading: branchLoading } = useBranch();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch dashboard data when tenant changes
  useEffect(() => {
    async function fetchDashboard() {
      if (!selectedTenantId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/portal/dashboard?tenantId=${selectedTenantId}`);
        if (res.ok) {
          const dashboardData = await res.json();
          setData(dashboardData);
        } else {
          const err = await res.json();
          setError(err.error || 'Failed to load dashboard');
        }
      } catch (err) {
        setError('Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    }

    fetchDashboard();
  }, [selectedTenantId]);

  // Calculate negative rate from distribution
  const negativeRate = data?.sentimentDistribution
    ? Math.round((data.sentimentDistribution.negative / 
        (data.sentimentDistribution.positive + data.sentimentDistribution.neutral + data.sentimentDistribution.negative || 1)) * 100)
    : 0;


  if (branchLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1>Dashboard</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!selectedTenantId) {
    return (
      <div className="space-y-6">
        <div>
          <h1>Dashboard</h1>
          <p className="text-muted-foreground">Select a branch to view dashboard</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Please select a branch from the dropdown above.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1>Dashboard</h1>
          <p className="text-muted-foreground">
            {selectedTenant?.name || 'Loading...'}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1>Dashboard</h1>
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
          <h1>Dashboard</h1>
          <p className="text-muted-foreground">{selectedTenant?.name}</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <RefreshCw className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-medium text-lg mb-2">No Data Yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {data?.message || 'No completed score runs found. Data will appear here once reviews are processed.'}
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
          <h1>Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of review performance and customer sentiment.
          </p>
        </div>
        {data.scoreRun && (
          <div className="text-sm text-muted-foreground text-right">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>
                {new Date(data.scoreRun.periodStart).toLocaleDateString()} - {new Date(data.scoreRun.periodEnd).toLocaleDateString()}
              </span>
            </div>
            <div className="text-xs">
              Last updated: {new Date(data.scoreRun.completedAt).toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Overall Sentiment"
          value={data.kpis?.avgSentiment ?? 5}
          format="sentiment"
          change={0}
          changeLabel="score out of 10"
          trend="neutral"
          icon={<Smile className="h-5 w-5" />}
          subtitle="AI-analyzed sentiment"
          tooltip="AI-analyzed sentiment score (0-10) based on review text. Higher is better."
        />
        <KpiCard
          title="Average Rating"
          value={data.kpis?.avgRating ?? 0}
          format="rating"
          change={0}
          changeLabel="out of 5 stars"
          trend="neutral"
          icon={<Star className="h-5 w-5" />}
          subtitle="Star rating average"
          tooltip="Average star rating across all review platforms."
        />
        <KpiCard
          title="Total Reviews"
          value={data.kpis?.totalReviews ?? 0}
          format="number"
          change={0}
          changeLabel="in period"
          trend="neutral"
          icon={<MessageSquare className="h-5 w-5" />}
          tooltip="Total number of reviews in the scoring period."
        />
        <KpiCard
          title="Negative Review Rate"
          value={negativeRate}
          format="percent"
          change={0}
          changeLabel="of total"
          trend="neutral"
          icon={<AlertTriangle className="h-5 w-5" />}
          tooltip="Percentage of reviews classified as negative sentiment. Lower is better."
        />
      </div>

      {/* Sentiment Distribution */}
      {data.sentimentDistribution && (
        <Card>
          <CardHeader>
            <CardTitle>Sentiment Distribution</CardTitle>
            <CardDescription>Breakdown of review sentiments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">Positive</span>
                  <Badge variant="default">{data.sentimentDistribution.positive}</Badge>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 rounded-full"
                    style={{ 
                      width: `${(data.sentimentDistribution.positive / (data.kpis?.reviewsProcessed || 1)) * 100}%` 
                    }}
                  />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">Neutral</span>
                  <Badge variant="secondary">{data.sentimentDistribution.neutral}</Badge>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-yellow-500 rounded-full"
                    style={{ 
                      width: `${(data.sentimentDistribution.neutral / (data.kpis?.reviewsProcessed || 1)) * 100}%` 
                    }}
                  />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">Negative</span>
                  <Badge variant="destructive">{data.sentimentDistribution.negative}</Badge>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-red-500 rounded-full"
                    style={{ 
                      width: `${(data.sentimentDistribution.negative / (data.kpis?.reviewsProcessed || 1)) * 100}%` 
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Source Distribution */}
      {data.sourceDistribution && data.sourceDistribution.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Reviews by Source</CardTitle>
            <CardDescription>Distribution of reviews across platforms</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.sourceDistribution.map(source => {
                const total = data.sourceDistribution?.reduce((sum, s) => sum + s.count, 0) || 1;
                const percentage = Math.round((source.count / total) * 100);
                return (
                  <div key={source.source} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{source.sourceName || source.source}</span>
                      <span className="text-muted-foreground">{source.count} reviews ({percentage}%)</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Theme Scores Table */}
      {data.themeScores && data.themeScores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Theme Analysis</CardTitle>
            <CardDescription>Sentiment scores by theme, sorted by severity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.themeScores.map(theme => (
                <div key={theme.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div 
                      className={`w-2 h-8 rounded-full ${
                        theme.score010 >= 7 ? 'bg-green-500' : 
                        theme.score010 >= 4 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                    />
                    <div>
                      <p className="font-medium">{theme.themeName}</p>
                      <p className="text-xs text-muted-foreground">{theme.themeCategory}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-right">
                      <p className="font-medium">{theme.score010.toFixed(1)}</p>
                      <p className="text-xs text-muted-foreground">Score</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{theme.mentions}</p>
                      <p className="text-xs text-muted-foreground">Mentions</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{theme.severity.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Severity</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
