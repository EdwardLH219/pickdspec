'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, ArrowRight, Calculator, Sparkles, Tags, BarChart3 } from 'lucide-react';

interface ScoringResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: {
    reviewsProcessed: number;
    themesProcessed: number;
    themesExtracted: number;
    durationMs: number;
  } | null;
}

export function ScoringResultsModal({ isOpen, onClose, results }: ScoringResultsModalProps) {
  if (!results) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Scoring Complete
          </DialogTitle>
          <DialogDescription>
            Here's what happened during the scoring run
          </DialogDescription>
        </DialogHeader>

        {/* Pipeline Visualization */}
        <div className="space-y-6 py-4">
          {/* Step 1: Theme Extraction */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <Tags className="h-5 w-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium">1. Theme Extraction</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Analyzed review content for keywords related to Service, Food Quality, 
                Cleanliness, Value, Ambiance, and Wait Time.
              </p>
              <Badge variant="secondary" className="mt-2">
                {results.themesExtracted} theme tags created
              </Badge>
            </div>
          </div>

          <div className="flex justify-center">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>

          {/* Step 2: Review Scoring */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Calculator className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium">2. Review Scoring (Pick&apos;d Model)</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Each review scored using the weighted impact formula:
              </p>
              <Card className="mt-3 bg-muted/50">
                <CardContent className="p-4 space-y-3">
                  <div className="text-center py-2 bg-background rounded-md">
                    <code className="text-sm font-mono font-semibold">
                      W_r = S_r × W_time × W_source × W_engagement × W_confidence
                    </code>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-start gap-2 p-2 rounded bg-background">
                      <code className="font-mono font-semibold text-primary min-w-[80px]">S_r</code>
                      <div>
                        <span className="font-medium">Base Sentiment</span>
                        <span className="text-muted-foreground ml-1">(-1 to +1)</span>
                        <p className="text-muted-foreground mt-0.5">AI-analyzed sentiment, optionally blended with star rating</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-2 rounded bg-background">
                      <code className="font-mono font-semibold text-orange-600 min-w-[80px]">W_time</code>
                      <div>
                        <span className="font-medium">Time Weight</span>
                        <span className="text-muted-foreground ml-1">(0 to 1)</span>
                        <p className="text-muted-foreground mt-0.5">Exponential decay - newer reviews have more influence (half-life: 60 days)</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-2 rounded bg-background">
                      <code className="font-mono font-semibold text-blue-600 min-w-[80px]">W_source</code>
                      <div>
                        <span className="font-medium">Source Weight</span>
                        <span className="text-muted-foreground ml-1">(0.6 to 1.4)</span>
                        <p className="text-muted-foreground mt-0.5">Google/TripAdvisor: 1.2, Yelp: 1.0, Social: 0.8</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-2 rounded bg-background">
                      <code className="font-mono font-semibold text-green-600 min-w-[80px]">W_engage</code>
                      <div>
                        <span className="font-medium">Engagement Weight</span>
                        <span className="text-muted-foreground ml-1">(1.0 to 1.5)</span>
                        <p className="text-muted-foreground mt-0.5">Boosts reviews with high likes, replies, or helpful votes</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-2 rounded bg-background">
                      <code className="font-mono font-semibold text-purple-600 min-w-[80px]">W_conf</code>
                      <div>
                        <span className="font-medium">Confidence Weight</span>
                        <span className="text-muted-foreground ml-1">(0 to 1)</span>
                        <p className="text-muted-foreground mt-0.5">Rule-based quality check (short reviews, duplicates, spam)</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Badge variant="secondary" className="mt-2">
                {results.reviewsProcessed} reviews scored
              </Badge>
            </div>
          </div>

          <div className="flex justify-center">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>

          {/* Step 3: Theme Aggregation */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium">3. Theme Aggregation</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Combined review scores into theme-level metrics:
              </p>
              <Card className="mt-3 bg-muted/50">
                <CardContent className="p-4 space-y-3">
                  <div className="space-y-2">
                    <div className="p-2 bg-background rounded">
                      <div className="flex items-center gap-2">
                        <code className="font-mono font-semibold text-sm">S_theme = ΣW_r / Σ|W_r|</code>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Theme sentiment: sum of weighted impacts divided by sum of absolute impacts (-1 to +1)
                      </p>
                    </div>
                    <div className="p-2 bg-background rounded">
                      <div className="flex items-center gap-2">
                        <code className="font-mono font-semibold text-sm">Score_0-10 = 5 × (S_theme + 1)</code>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Converts sentiment to friendly 0-10 scale (5 = neutral, 10 = perfect)
                      </p>
                    </div>
                    <div className="p-2 bg-background rounded">
                      <div className="flex items-center gap-2">
                        <code className="font-mono font-semibold text-sm">Severity = |min(S_theme, 0)| × log(1 + mentions)</code>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Priority ranking for negative themes based on sentiment and volume
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Badge variant="secondary" className="mt-2">
                {results.themesProcessed} themes calculated
              </Badge>
            </div>
          </div>

          {/* Summary */}
          <div className="flex items-start gap-4 pt-4 border-t">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium">Ready for Dashboard</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your dashboard now shows updated sentiment scores, theme breakdowns, 
                and trend data. Completed in {(results.durationMs / 1000).toFixed(1)}s.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
