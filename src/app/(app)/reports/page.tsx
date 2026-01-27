"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useBranch } from "@/hooks/use-branch";
import { getDateRangeFromPreset } from "@/lib/data/dashboard";
import { getReviews, getReviewThemes } from "@/lib/data/reviews";
import { getThemes } from "@/lib/data/themes";
import { mockThemes, mockReviewThemes } from "@/lib/mock";
import { ReviewExplorer, ThemeBreakdown } from "@/components/reports";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, PieChart, FileText, ArrowRight } from "lucide-react";

export default function ReportsPage() {
  const { selectedBranchId, dateRange } = useBranch();

  const dateRangeObj = useMemo(
    () => getDateRangeFromPreset(dateRange),
    [dateRange]
  );

  // Get all reviews for the date range and branch
  const reviews = useMemo(() => {
    const result = getReviews({
      branchId: selectedBranchId,
      dateRange: dateRangeObj,
    });
    return result.data;
  }, [selectedBranchId, dateRangeObj]);

  // Get all reviews (for full dataset when no filters)
  const allReviews = useMemo(() => {
    const result = getReviews({
      branchId: selectedBranchId,
    });
    return result.data;
  }, [selectedBranchId]);

  // Get themes for the current branch
  const themes = useMemo(
    () => getThemes(selectedBranchId),
    [selectedBranchId]
  );

  // Create review themes map for quick lookup
  const reviewThemesMap = useMemo(() => {
    const map = new Map<string, { themeId: string; themeName: string }[]>();
    
    for (const review of allReviews) {
      const themes = mockReviewThemes
        .filter((rt) => rt.reviewId === review.id)
        .map((rt) => {
          const theme = mockThemes.find((t) => t.id === rt.themeId);
          return {
            themeId: rt.themeId,
            themeName: theme?.name || "Unknown",
          };
        });
      map.set(review.id, themes);
    }
    
    return map;
  }, [allReviews]);

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
              <h3 className="font-semibold">Monthly Report Preview</h3>
              <p className="text-sm text-muted-foreground">
                View a comprehensive summary with TL;DR, theme analysis, insights, and recommendations.
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
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="explorer" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Review Explorer
          </TabsTrigger>
          <TabsTrigger value="themes" className="flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            Theme Breakdown
          </TabsTrigger>
        </TabsList>

        <TabsContent value="explorer" className="space-y-4">
          <ReviewExplorer
            reviews={allReviews}
            themes={themes}
            reviewThemesMap={reviewThemesMap}
          />
        </TabsContent>

        <TabsContent value="themes" className="space-y-4">
          <ThemeBreakdown
            themes={themes}
            reviews={allReviews}
            reviewThemes={mockReviewThemes}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
