'use client';

/**
 * Audit Explorer Client Component
 * 
 * Interactive UI for exploring review scores and their breakdowns
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  RefreshCw,
  Eye,
  Star,
  Clock,
  Globe,
  Users,
  Shield,
  ThumbsUp,
  MessageSquare,
  HelpCircle,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface ScoreRun {
  id: string;
  periodStart: string;
  periodEnd: string;
  tenant: { id: string; name: string };
}

interface Tenant {
  id: string;
  name: string;
}

interface ReviewScore {
  id: string;
  reviewId: string;
  scoreRunId: string;
  baseSentiment: number;
  timeWeight: number;
  sourceWeight: number;
  engagementWeight: number;
  confidenceWeight: number;
  weightedImpact: number;
  components: {
    baseSentiment?: {
      score: number;
      modelVersion: string;
      rawScore: number;
      ratingBlended: boolean;
      confidence: number;
    };
    timeWeight?: {
      value: number;
      daysDelta: number;
      halfLifeDays: number;
    };
    sourceWeight?: {
      value: number;
      sourceType: string;
      rawWeight: number;
      clamped: boolean;
    };
    engagementWeight?: {
      value: number;
      enabled: boolean;
      rawValue: number;
      capped: boolean;
      engagement: { likes: number; replies: number; helpful: number };
    };
    confidenceWeight?: {
      value: number;
      ruleId: string | null;
      reasonCode: string;
      matchedConditions: unknown[];
    };
  };
  review: {
    id: string;
    content: string;
    rating: number | null;
    reviewDate: string;
    authorName: string | null;
    source: string;
    sourceName: string;
    likesCount: number;
    repliesCount: number;
    helpfulCount: number;
  };
  themes: Array<{
    id: string;
    name: string;
    sentiment: string;
    confidenceScore: number;
  }>;
  scoreRun: {
    id: string;
    periodStart: string;
    periodEnd: string;
    parameterVersionId: string | null;
    ruleSetVersionId: string | null;
  };
}

interface Props {
  scoreRuns: ScoreRun[];
  tenants: Tenant[];
}

export function AuditExplorerClient({ scoreRuns, tenants }: Props) {
  const [scores, setScores] = useState<ReviewScore[]>([]);
  const [selectedScore, setSelectedScore] = useState<ReviewScore | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  
  // Filters
  const [filterTenantId, setFilterTenantId] = useState<string>('all');
  const [filterScoreRunId, setFilterScoreRunId] = useState<string>('all');
  const [confidenceRange, setConfidenceRange] = useState<[number, number]>([0, 1]);
  const [sortBy, setSortBy] = useState<string>('weightedImpact');
  const [sortOrder, setSortOrder] = useState<string>('desc');

  const search = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterTenantId !== 'all') params.set('tenantId', filterTenantId);
      if (filterScoreRunId !== 'all') params.set('scoreRunId', filterScoreRunId);
      params.set('minConfidence', confidenceRange[0].toString());
      params.set('maxConfidence', confidenceRange[1].toString());
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);
      
      const res = await fetch(`/api/admin/audit?${params}`);
      if (res.ok) {
        const data = await res.json();
        setScores(data.scores);
        setTotal(data.total);
      } else {
        toast.error('Failed to fetch scores');
      }
    } catch (error) {
      toast.error('Failed to fetch scores');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  const formatNumber = (num: number, decimals: number = 3) =>
    num.toFixed(decimals);

  const getSentimentColor = (sentiment: number) => {
    if (sentiment > 0.3) return 'text-green-600';
    if (sentiment < -0.3) return 'text-red-600';
    return 'text-yellow-600';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'default';
    if (confidence >= 0.6) return 'secondary';
    return 'outline';
  };

  const filteredRuns = scoreRuns.filter(
    run => filterTenantId === 'all' || run.tenant.id === filterTenantId
  );

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label>Tenant</Label>
              <Select value={filterTenantId} onValueChange={setFilterTenantId}>
                <SelectTrigger>
                  <SelectValue placeholder="All tenants" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tenants</SelectItem>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Score Run</Label>
              <Select value={filterScoreRunId} onValueChange={setFilterScoreRunId}>
                <SelectTrigger>
                  <SelectValue placeholder="All runs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All runs</SelectItem>
                  {filteredRuns.map((run) => (
                    <SelectItem key={run.id} value={run.id}>
                      {run.tenant.name}: {formatDate(run.periodStart)} - {formatDate(run.periodEnd)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Sort By</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weightedImpact">Weighted Impact</SelectItem>
                  <SelectItem value="baseSentiment">Base Sentiment</SelectItem>
                  <SelectItem value="confidenceWeight">Confidence</SelectItem>
                  <SelectItem value="timeWeight">Time Weight</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Order</Label>
              <Select value={sortOrder} onValueChange={setSortOrder}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Descending</SelectItem>
                  <SelectItem value="asc">Ascending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4">
            <Label>Confidence Range: {confidenceRange[0].toFixed(2)} - {confidenceRange[1].toFixed(2)}</Label>
            <Slider
              value={confidenceRange}
              onValueChange={(value: number[]) => setConfidenceRange([value[0], value[1]])}
              min={0}
              max={1}
              step={0.05}
              className="mt-2"
            />
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={search} disabled={isLoading}>
              {isLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
          <CardDescription>
            {total} review scores found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Score</TableHead>
                <TableHead>Review</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>S_r</TableHead>
                <TableHead>W_time</TableHead>
                <TableHead>W_src</TableHead>
                <TableHead>W_eng</TableHead>
                <TableHead>W_conf</TableHead>
                <TableHead>W_r</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scores.map((score) => (
                <TableRow key={score.id}>
                  <TableCell>
                    {score.review.rating && (
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span>{score.review.rating}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs truncate">
                      {score.review.content.substring(0, 80)}...
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {score.review.authorName || 'Anonymous'} • {formatDate(score.review.reviewDate)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{score.review.source}</Badge>
                  </TableCell>
                  <TableCell className={getSentimentColor(score.baseSentiment)}>
                    {formatNumber(score.baseSentiment)}
                  </TableCell>
                  <TableCell>{formatNumber(score.timeWeight)}</TableCell>
                  <TableCell>{formatNumber(score.sourceWeight)}</TableCell>
                  <TableCell>{formatNumber(score.engagementWeight)}</TableCell>
                  <TableCell>
                    <Badge variant={getConfidenceColor(score.confidenceWeight) as 'default' | 'secondary' | 'outline'}>
                      {formatNumber(score.confidenceWeight)}
                    </Badge>
                  </TableCell>
                  <TableCell className={`font-bold ${getSentimentColor(score.weightedImpact)}`}>
                    {formatNumber(score.weightedImpact)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedScore(score)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {scores.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    No scores found. Adjust filters and search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Score Detail Dialog */}
      <Dialog open={!!selectedScore} onOpenChange={() => setSelectedScore(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Score Breakdown</DialogTitle>
            <DialogDescription>
              Full analysis of review scoring components
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[600px]">
            {selectedScore && (
              <div className="space-y-6 p-1">
                {/* Review Content */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Review Content
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap">{selectedScore.review.content}</p>
                    <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
                      {selectedScore.review.rating && (
                        <span className="flex items-center gap-1">
                          <Star className="h-4 w-4" /> {selectedScore.review.rating}/5
                        </span>
                      )}
                      <span>{selectedScore.review.authorName || 'Anonymous'}</span>
                      <span>{formatDate(selectedScore.review.reviewDate)}</span>
                      <Badge variant="outline">{selectedScore.review.source}</Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Score Components */}
                <Accordion type="multiple" defaultValue={['sentiment', 'time', 'source', 'engagement', 'confidence']}>
                  {/* Base Sentiment */}
                  <AccordionItem value="sentiment">
                    <AccordionTrigger>
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4" />
                        <span>Base Sentiment (S_r)</span>
                        <Badge className="ml-2">{formatNumber(selectedScore.baseSentiment)}</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>Raw Score: {formatNumber(selectedScore.components.baseSentiment?.rawScore || 0)}</div>
                        <div>Model: {selectedScore.components.baseSentiment?.modelVersion}</div>
                        <div>Rating Blended: {selectedScore.components.baseSentiment?.ratingBlended ? 'Yes' : 'No'}</div>
                        <div>Confidence: {formatNumber(selectedScore.components.baseSentiment?.confidence || 0)}</div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Time Weight */}
                  <AccordionItem value="time">
                    <AccordionTrigger>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>Time Weight (W_time)</span>
                        <Badge className="ml-2">{formatNumber(selectedScore.timeWeight)}</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>Days Since Review: {selectedScore.components.timeWeight?.daysDelta}</div>
                        <div>Half-life (days): {selectedScore.components.timeWeight?.halfLifeDays}</div>
                        <div>Formula: e^(-λ × Δt)</div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Source Weight */}
                  <AccordionItem value="source">
                    <AccordionTrigger>
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        <span>Source Weight (W_source)</span>
                        <Badge className="ml-2">{formatNumber(selectedScore.sourceWeight)}</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>Source Type: {selectedScore.components.sourceWeight?.sourceType}</div>
                        <div>Raw Weight: {formatNumber(selectedScore.components.sourceWeight?.rawWeight || 0)}</div>
                        <div>Clamped: {selectedScore.components.sourceWeight?.clamped ? 'Yes' : 'No'}</div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Engagement Weight */}
                  <AccordionItem value="engagement">
                    <AccordionTrigger>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>Engagement Weight (W_engagement)</span>
                        <Badge className="ml-2">{formatNumber(selectedScore.engagementWeight)}</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>Enabled: {selectedScore.components.engagementWeight?.enabled ? 'Yes' : 'No'}</div>
                        <div>Raw Value: {formatNumber(selectedScore.components.engagementWeight?.rawValue || 0)}</div>
                        <div>Capped: {selectedScore.components.engagementWeight?.capped ? 'Yes' : 'No'}</div>
                        <div className="col-span-2 flex gap-4 mt-2">
                          <span className="flex items-center gap-1">
                            <ThumbsUp className="h-4 w-4" />
                            {selectedScore.components.engagementWeight?.engagement?.likes || 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-4 w-4" />
                            {selectedScore.components.engagementWeight?.engagement?.replies || 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <HelpCircle className="h-4 w-4" />
                            {selectedScore.components.engagementWeight?.engagement?.helpful || 0}
                          </span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Confidence Weight */}
                  <AccordionItem value="confidence">
                    <AccordionTrigger>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        <span>Confidence Weight (W_confidence)</span>
                        <Badge className="ml-2">{formatNumber(selectedScore.confidenceWeight)}</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          <span className="font-medium">Reason Code:</span>
                          <Badge variant="outline">{selectedScore.components.confidenceWeight?.reasonCode}</Badge>
                        </div>
                        {selectedScore.components.confidenceWeight?.ruleId && (
                          <div>Rule ID: {selectedScore.components.confidenceWeight.ruleId}</div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {/* Final Calculation */}
                <Card className="bg-muted">
                  <CardHeader>
                    <CardTitle>Final Weighted Impact (W_r)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="font-mono text-lg">
                      W_r = S_r × W_time × W_source × W_engagement × W_confidence
                    </div>
                    <div className="font-mono text-lg mt-2">
                      W_r = {formatNumber(selectedScore.baseSentiment)} × {formatNumber(selectedScore.timeWeight)} × {formatNumber(selectedScore.sourceWeight)} × {formatNumber(selectedScore.engagementWeight)} × {formatNumber(selectedScore.confidenceWeight)}
                    </div>
                    <div className={`font-mono text-2xl font-bold mt-2 ${getSentimentColor(selectedScore.weightedImpact)}`}>
                      W_r = {formatNumber(selectedScore.weightedImpact)}
                    </div>
                  </CardContent>
                </Card>

                {/* Themes */}
                {selectedScore.themes.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Detected Themes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {selectedScore.themes.map((theme) => (
                          <Badge
                            key={theme.id}
                            variant={
                              theme.sentiment === 'POSITIVE' ? 'default' :
                              theme.sentiment === 'NEGATIVE' ? 'destructive' : 'secondary'
                            }
                          >
                            {theme.name} ({(theme.confidenceScore * 100).toFixed(0)}%)
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
