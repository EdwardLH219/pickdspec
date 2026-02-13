"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useBranch } from "@/hooks/use-branch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Search,
  PieChart,
  FileText,
  ArrowRight,
  Download,
  Filter,
  X,
  AlertTriangle,
  ExternalLink,
  Star,
  Users,
  RefreshCw,
  Clock,
  Calendar,
} from "lucide-react";

// Format source type for display
const formatSourceType = (source: string): string => {
  const sourceMap: Record<string, string> = {
    'GOOGLE': 'Google',
    'GOOGLE_OUTSCRAPER': 'Google (API)',
    'HELLOPETER': 'HelloPeter',
    'FACEBOOK': 'Facebook',
    'TRIPADVISOR': 'TripAdvisor',
    'YELP': 'Yelp',
    'ZOMATO': 'Zomato',
    'OPENTABLE': 'OpenTable',
    'WEBSITE': 'Website',
    'INSTAGRAM': 'Instagram',
    'TWITTER': 'Twitter',
  };
  return sourceMap[source] || source;
};

interface Review {
  id: string;
  content: string;
  rating: number | null;
  reviewDate: string;
  authorName: string | null;
  source: string;
  sourceName: string;
  externalUrl: string | null;
  sentiment: number | null;
  weightedImpact: number | null;
  themes: Array<{
    id: string;
    name: string;
    category: string;
    sentiment: string;
    confidence: number;
  }>;
  likesCount: number;
  repliesCount: number;
  helpfulCount: number;
}

interface ThemeBreakdownItem {
  id: string;
  name: string;
  category: string;
  description: string | null;
  reviewCount: number;
  score010: number;
  sentiment: number;
  mentions: number;
  severity: number;
  avgConfidence: number;
  sentimentDistribution: { positive: number; neutral: number; negative: number };
  sentimentPercentages: { positive: number; neutral: number; negative: number };
}

interface CustomerSummaryData {
  summary: string;
  reviewCount: number;
  dateRangeFrom: string;
  dateRangeTo: string;
  themesIncluded: string[];
  updatedAt: string;
}

type SummaryPeriod = 'SIX_MONTHS' | 'THREE_MONTHS' | 'TWO_WEEKS';

const PERIOD_LABELS: Record<SummaryPeriod, { title: string; description: string }> = {
  SIX_MONTHS: { title: '6 Months', description: 'Customer feedback over the last 6 months' },
  THREE_MONTHS: { title: '3 Months', description: 'Customer feedback over the last 3 months' },
  TWO_WEEKS: { title: '2 Weeks', description: 'Recent customer feedback from the last 2 weeks' },
};

export default function ReportsPage() {
  const { selectedTenantId, selectedTenant, isLoading: branchLoading, getDateRange } = useBranch();
  const searchParams = useSearchParams();
  
  // Review Explorer state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [totalReviews, setTotalReviews] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sentimentFilter, setSentimentFilter] = useState("all");
  const [themeFilter, setThemeFilter] = useState<string | null>(null);
  const [themeName, setThemeName] = useState<string | null>(null);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [reviewDetailOpen, setReviewDetailOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // Initialize filters from URL params
  useEffect(() => {
    const themeId = searchParams.get('themeId');
    const theme = searchParams.get('themeName');
    const sentiment = searchParams.get('sentiment');
    if (themeId) {
      setThemeFilter(themeId);
      setThemeName(theme);
    }
    if (sentiment && ['positive', 'neutral', 'negative', 'non-positive'].includes(sentiment)) {
      setSentimentFilter(sentiment);
    }
  }, [searchParams]);
  
  // Theme Breakdown state
  const [themes, setThemes] = useState<ThemeBreakdownItem[]>([]);
  const [themesLoading, setThemesLoading] = useState(false);
  const [themesError, setThemesError] = useState<string | null>(null);
  
  // Customer Summary state
  const [summaries, setSummaries] = useState<Record<SummaryPeriod, CustomerSummaryData | null>>({
    SIX_MONTHS: null,
    THREE_MONTHS: null,
    TWO_WEEKS: null,
  });
  const [summariesLoading, setSummariesLoading] = useState(false);
  const [summaryGenerating, setSummaryGenerating] = useState<SummaryPeriod | 'all' | null>(null);

  // Fetch reviews
  const fetchReviews = async () => {
    if (!selectedTenantId) return;

    setReviewsLoading(true);
    setReviewsError(null);

    try {
      const params = new URLSearchParams({ tenantId: selectedTenantId });
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      if (sentimentFilter !== "all") params.set("sentiment", sentimentFilter);
      if (searchQuery) params.set("search", searchQuery);
      if (themeFilter) params.set("themeId", themeFilter);

      const res = await fetch(`/api/portal/reviews?${params}`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
        setTotalReviews(data.total || 0);
      } else {
        const err = await res.json();
        setReviewsError(err.error || 'Failed to load reviews');
      }
    } catch {
      setReviewsError('Failed to load reviews');
    } finally {
      setReviewsLoading(false);
    }
  };

  // Fetch themes
  const fetchThemes = async () => {
    if (!selectedTenantId) return;

    setThemesLoading(true);
    setThemesError(null);

    try {
      const res = await fetch(`/api/portal/themes?tenantId=${selectedTenantId}`);
      if (res.ok) {
        const data = await res.json();
        setThemes(data.themes || []);
      } else {
        const err = await res.json();
        setThemesError(err.error || 'Failed to load themes');
      }
    } catch {
      setThemesError('Failed to load themes');
    } finally {
      setThemesLoading(false);
    }
  };

  // Fetch customer summaries
  const fetchSummaries = async () => {
    if (!selectedTenantId) return;

    setSummariesLoading(true);

    try {
      const res = await fetch(`/api/portal/reports/summary?tenantId=${selectedTenantId}`);
      if (res.ok) {
        const data = await res.json();
        setSummaries({
          SIX_MONTHS: data.summaries?.SIX_MONTHS || null,
          THREE_MONTHS: data.summaries?.THREE_MONTHS || null,
          TWO_WEEKS: data.summaries?.TWO_WEEKS || null,
        });
      }
    } catch {
      // Silently fail - summaries are optional
    } finally {
      setSummariesLoading(false);
    }
  };

  // Generate summaries
  const generateSummaries = async (period?: SummaryPeriod) => {
    if (!selectedTenantId) return;

    setSummaryGenerating(period || 'all');

    try {
      const res = await fetch('/api/portal/reports/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tenantId: selectedTenantId,
          period: period || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Update the summaries state
        setSummaries(prev => ({
          ...prev,
          ...(data.summaries || {}),
        }));
        toast.success('Summaries generated', {
          description: period 
            ? `Updated ${PERIOD_LABELS[period].title} summary`
            : 'All summaries have been refreshed',
        });
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to generate summaries');
      }
    } catch {
      toast.error('Failed to generate summaries');
    } finally {
      setSummaryGenerating(null);
    }
  };

  // Fetch data when tenant or theme filter changes
  useEffect(() => {
    if (selectedTenantId) {
      fetchReviews();
      fetchThemes();
      fetchSummaries();
    }
  }, [selectedTenantId, themeFilter]);

  // CSV Export
  const exportCSV = async () => {
    if (!selectedTenantId) return;

    setIsExporting(true);
    try {
      const params = new URLSearchParams({ 
        tenantId: selectedTenantId,
        format: 'csv',
      });
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      if (sentimentFilter !== "all") params.set("sentiment", sentimentFilter);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/portal/reviews?${params}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reviews-${selectedTenantId}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Export complete', { description: 'CSV file downloaded' });
      } else {
        toast.error('Export failed');
      }
    } catch {
      toast.error('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSourceFilter("all");
    setSentimentFilter("all");
    setThemeFilter(null);
    setThemeName(null);
    // Clear URL params
    window.history.replaceState({}, '', '/reports');
  };

  const hasActiveFilters = searchQuery || sourceFilter !== "all" || sentimentFilter !== "all" || themeFilter;

  const getSentimentBadge = (sentiment: number | null) => {
    if (sentiment === null) return <Badge variant="outline">Unknown</Badge>;
    if (sentiment > 0.3) return <Badge className="bg-green-600">Positive</Badge>;
    if (sentiment < -0.3) return <Badge variant="destructive">Negative</Badge>;
    return <Badge variant="secondary">Neutral</Badge>;
  };

  const renderStars = (rating: number | null) => {
    if (rating === null) return <span className="text-muted-foreground">-</span>;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <Star
            key={i}
            className={`h-3.5 w-3.5 ${i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
          />
        ))}
      </div>
    );
  };

  if (branchLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1>Reports</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!selectedTenantId) {
    return (
      <div className="space-y-6">
        <div>
          <h1>Reports</h1>
          <p className="text-muted-foreground">Select a branch to view reports</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Please select a branch from the dropdown above.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1>Reports</h1>
        <p className="text-muted-foreground">
          Explore and analyze your review data in detail.
        </p>
      </div>

      {/* Monthly Report Card */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-primary/10 p-3">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Monthly Report</h3>
              <p className="text-sm text-muted-foreground">
                View a comprehensive summary with insights and recommendations.
              </p>
            </div>
          </div>
          <Button asChild>
            <Link href="/reports/monthly">
              View Report
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="explorer" className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="explorer" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Review Explorer
          </TabsTrigger>
          <TabsTrigger value="themes" className="flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            Theme Breakdown
          </TabsTrigger>
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Customer Summary
          </TabsTrigger>
        </TabsList>

        {/* Review Explorer Tab */}
        <TabsContent value="explorer" className="space-y-4">
          {/* Theme Filter Banner */}
          {themeFilter && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PieChart className="h-4 w-4 text-primary" />
                    <span className="text-sm">
                      Showing {sentimentFilter !== 'all' ? <strong>{sentimentFilter}</strong> : ''} reviews mentioning: <strong>{themeName || 'Selected theme'}</strong>
                    </span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setThemeFilter(null);
                      setThemeName(null);
                      setSentimentFilter('all');
                      window.history.replaceState({}, '', '/reports');
                    }}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear filter
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Filters:</span>
                </div>

                <div className="flex-1 min-w-[200px] max-w-[300px]">
                  <Input
                    placeholder="Search reviews..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchReviews()}
                  />
                </div>

                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="GOOGLE">Google</SelectItem>
                    <SelectItem value="HELLOPETER">HelloPeter</SelectItem>
                    <SelectItem value="FACEBOOK">Facebook</SelectItem>
                    <SelectItem value="TRIPADVISOR">TripAdvisor</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Sentiment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sentiments</SelectItem>
                    <SelectItem value="positive">Positive</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="negative">Negative</SelectItem>
                    <SelectItem value="non-positive">Non-Positive</SelectItem>
                  </SelectContent>
                </Select>

                <Button onClick={fetchReviews} size="sm">
                  <Search className="h-4 w-4 mr-1" />
                  Search
                </Button>

                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}

                <div className="ml-auto flex items-center gap-2">
                  <Badge variant="outline" className="font-normal">
                    {totalReviews} reviews
                  </Badge>
                  <Button variant="outline" size="sm" onClick={exportCSV} disabled={isExporting}>
                    <Download className="h-4 w-4 mr-1" />
                    {isExporting ? 'Exporting...' : 'Export CSV'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reviews Table */}
          {reviewsLoading ? (
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ) : reviewsError ? (
            <Card className="border-destructive">
              <CardContent className="py-12 text-center">
                <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <p className="text-destructive">{reviewsError}</p>
              </CardContent>
            </Card>
          ) : reviews.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Search className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="font-medium text-lg mb-1">No reviews found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your filters or search query.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Review</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Sentiment</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviews.map((review) => (
                    <TableRow key={review.id}>
                      <TableCell className="max-w-md">
                        <div>
                          <p className="line-clamp-2 text-sm">{review.content}</p>
                          {review.authorName && (
                            <p className="text-xs text-muted-foreground mt-1">
                              by {review.authorName}
                            </p>
                          )}
                          {review.themes.length > 0 && (
                            <div className="flex gap-1 mt-2 flex-wrap">
                              {review.themes.slice(0, 3).map(theme => (
                                <Badge key={theme.id} variant="outline" className="text-xs">
                                  {theme.name}
                                </Badge>
                              ))}
                              {review.themes.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{review.themes.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{formatSourceType(review.source)}</Badge>
                      </TableCell>
                      <TableCell>{renderStars(review.rating)}</TableCell>
                      <TableCell>{getSentimentBadge(review.sentiment)}</TableCell>
                      <TableCell>
                        {new Date(review.reviewDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedReview(review);
                            setReviewDetailOpen(true);
                          }}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* Theme Breakdown Tab */}
        <TabsContent value="themes" className="space-y-4">
          {themesLoading ? (
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ) : themesError ? (
            <Card className="border-destructive">
              <CardContent className="py-12 text-center">
                <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <p className="text-destructive">{themesError}</p>
              </CardContent>
            </Card>
          ) : themes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <PieChart className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="font-medium text-lg mb-1">No theme data</h3>
                <p className="text-muted-foreground">
                  Theme analysis will appear here once reviews are processed.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {themes.map((theme) => (
                <Card key={theme.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{theme.name}</CardTitle>
                        <CardDescription>{theme.category}</CardDescription>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${
                          theme.score010 >= 7 ? 'text-green-600' :
                          theme.score010 >= 4 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {theme.score010.toFixed(1)}
                        </div>
                        <p className="text-xs text-muted-foreground">Score</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {theme.description && (
                      <p className="text-sm text-muted-foreground mb-4">{theme.description}</p>
                    )}
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-2xl font-semibold">{theme.mentions}</p>
                        <p className="text-xs text-muted-foreground">Mentions</p>
                      </div>
                      <div>
                        <p className="text-2xl font-semibold">{theme.severity.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">Severity</p>
                      </div>
                      <div>
                        <p className="text-2xl font-semibold">{(theme.avgConfidence * 100).toFixed(0)}%</p>
                        <p className="text-xs text-muted-foreground">Avg Confidence</p>
                      </div>
                      <div>
                        <p className="text-2xl font-semibold">{theme.reviewCount}</p>
                        <p className="text-xs text-muted-foreground">Reviews</p>
                      </div>
                    </div>

                    {/* Sentiment Distribution Bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Sentiment Distribution</span>
                        <span>
                          {theme.sentimentPercentages.positive}% / {theme.sentimentPercentages.neutral}% / {theme.sentimentPercentages.negative}%
                        </span>
                      </div>
                      <div className="flex h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-green-500"
                          style={{ width: `${theme.sentimentPercentages.positive}%` }}
                        />
                        <div 
                          className="bg-yellow-500"
                          style={{ width: `${theme.sentimentPercentages.neutral}%` }}
                        />
                        <div 
                          className="bg-red-500"
                          style={{ width: `${theme.sentimentPercentages.negative}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-green-600">Positive ({theme.sentimentDistribution.positive})</span>
                        <span className="text-yellow-600">Neutral ({theme.sentimentDistribution.neutral})</span>
                        <span className="text-red-600">Negative ({theme.sentimentDistribution.negative})</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Customer Summary Tab */}
        <TabsContent value="summary" className="space-y-4">
          {/* Header with Refresh All button */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">AI-Generated Customer Summaries</h3>
                  <p className="text-sm text-muted-foreground">
                    Summaries are generated from actual customer reviews using AI analysis
                  </p>
                </div>
                <Button
                  onClick={() => generateSummaries()}
                  disabled={summaryGenerating !== null}
                >
                  {summaryGenerating === 'all' ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh All
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {summariesLoading ? (
            <div className="space-y-4">
              {(['TWO_WEEKS', 'THREE_MONTHS', 'SIX_MONTHS'] as SummaryPeriod[]).map(period => (
                <Card key={period}>
                  <CardContent className="p-6">
                    <Skeleton className="h-24 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {(['TWO_WEEKS', 'THREE_MONTHS', 'SIX_MONTHS'] as SummaryPeriod[]).map(period => {
                const summary = summaries[period];
                const config = PERIOD_LABELS[period];
                
                return (
                  <Card key={period}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            {config.title}
                          </CardTitle>
                          <CardDescription>{config.description}</CardDescription>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => generateSummaries(period)}
                          disabled={summaryGenerating !== null}
                        >
                          {summaryGenerating === period ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {summary ? (
                        <div className="space-y-4">
                          {/* Summary Text */}
                          <div className="bg-muted/50 p-4 rounded-lg">
                            <p className="text-sm leading-relaxed">{summary.summary}</p>
                          </div>
                          
                          {/* Metadata */}
                          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              <span>{summary.reviewCount} reviews analyzed</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>
                                {new Date(summary.dateRangeFrom).toLocaleDateString()} - {new Date(summary.dateRangeTo).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>Updated {new Date(summary.updatedAt).toLocaleString()}</span>
                            </div>
                          </div>
                          
                          {/* Themes */}
                          {summary.themesIncluded && summary.themesIncluded.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {summary.themesIncluded.map(theme => (
                                <Badge key={theme} variant="outline" className="text-xs">
                                  {theme}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Users className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                          <p className="text-sm text-muted-foreground mb-3">
                            No summary generated yet for this period
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => generateSummaries(period)}
                            disabled={summaryGenerating !== null}
                          >
                            {summaryGenerating === period ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Generate Summary
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Review Detail Dialog */}
      <Dialog open={reviewDetailOpen} onOpenChange={setReviewDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Details</DialogTitle>
            <DialogDescription>
              {selectedReview?.source && formatSourceType(selectedReview.source)} • {selectedReview?.reviewDate && new Date(selectedReview.reviewDate).toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>
          
          {selectedReview && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {renderStars(selectedReview.rating)}
                {getSentimentBadge(selectedReview.sentiment)}
                {selectedReview.authorName && (
                  <span className="text-sm text-muted-foreground">
                    by {selectedReview.authorName}
                  </span>
                )}
              </div>
              
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm whitespace-pre-wrap">{selectedReview.content}</p>
              </div>

              {selectedReview.themes.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Themes</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedReview.themes.map(theme => (
                      <Badge key={theme.id} variant="outline">
                        {theme.name}
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({theme.sentiment.toLowerCase()})
                        </span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>👍 {selectedReview.likesCount} likes</span>
                <span>💬 {selectedReview.repliesCount} replies</span>
                <span>✓ {selectedReview.helpfulCount} helpful</span>
              </div>

              {selectedReview.externalUrl && (
                <Button variant="outline" asChild>
                  <a href={selectedReview.externalUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Original
                  </a>
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
