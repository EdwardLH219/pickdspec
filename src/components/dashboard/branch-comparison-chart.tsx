"use client";

import { Fragment } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Building2, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface BranchScore {
  score: number;
  sentiment: number;
  mentions: number;
}

interface ComparisonData {
  themeId: string;
  themeName: string;
  category: string;
  branchScores: Record<string, BranchScore>;
}

interface BranchSummary {
  id: string;
  name: string;
  avgScore: number;
  totalMentions: number;
  themeCount: number;
}

interface BranchComparisonChartProps {
  branches: BranchSummary[];
  comparison: ComparisonData[];
}

function getScoreColor(score: number): string {
  if (score >= 8) return "bg-emerald-500";
  if (score >= 6) return "bg-emerald-400";
  if (score >= 5) return "bg-amber-400";
  if (score >= 4) return "bg-orange-400";
  if (score >= 2) return "bg-rose-400";
  if (score > 0) return "bg-rose-500";
  return "bg-slate-200";
}

function getScoreBgLight(score: number): string {
  if (score >= 8) return "bg-emerald-50 border-emerald-200";
  if (score >= 6) return "bg-emerald-50 border-emerald-200";
  if (score >= 5) return "bg-amber-50 border-amber-200";
  if (score >= 4) return "bg-orange-50 border-orange-200";
  if (score >= 2) return "bg-rose-50 border-rose-200";
  if (score > 0) return "bg-rose-50 border-rose-200";
  return "bg-slate-50 border-slate-200";
}

function getScoreTextColor(score: number): string {
  if (score >= 8) return "text-emerald-700";
  if (score >= 6) return "text-emerald-600";
  if (score >= 5) return "text-amber-600";
  if (score >= 4) return "text-orange-600";
  if (score >= 2) return "text-rose-600";
  if (score > 0) return "text-rose-700";
  return "text-slate-400";
}

function getCategoryStyle(category: string): { bg: string; text: string; border: string } {
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    SERVICE: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    PRODUCT: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
    CLEANLINESS: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
    VALUE: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
    AMBIANCE: { bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-200" },
    LOCATION: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
    OTHER: { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" },
  };
  return styles[category] || styles.OTHER;
}

export function BranchComparisonChart({ branches, comparison }: BranchComparisonChartProps) {
  if (branches.length === 0 || comparison.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Branch Comparison
          </CardTitle>
          <CardDescription>Compare theme performance across branches</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No comparison data available. Run scoring on multiple branches to see comparison.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Find best performing branch
  const sortedBranches = [...branches].sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0));
  const bestBranch = sortedBranches[0];

  // Group comparison by category
  const groupedByCategory = comparison.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ComparisonData[]>);

  // Sort categories by importance
  const categoryOrder = ['SERVICE', 'PRODUCT', 'CLEANLINESS', 'VALUE', 'AMBIANCE', 'LOCATION', 'OTHER'];
  const sortedCategories = Object.keys(groupedByCategory).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  );

  return (
    <div className="space-y-6">
      {/* Branch Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {sortedBranches.map((branch, index) => {
          const isBest = index === 0 && (branch.avgScore ?? 0) > 0;
          return (
            <Card 
              key={branch.id} 
              className={cn(
                "relative overflow-hidden transition-all",
                isBest && "ring-2 ring-emerald-500 shadow-lg"
              )}
            >
              {isBest && (
                <div className="absolute top-0 right-0 bg-emerald-500 text-white text-xs px-2 py-1 rounded-bl-lg font-medium">
                  Best
                </div>
              )}
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{branch.name}</p>
                    <p className={cn(
                      "text-3xl font-bold mt-1",
                      getScoreTextColor(branch.avgScore ?? 0)
                    )}>
                      {(branch.avgScore ?? 0).toFixed(1)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Average Score
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold text-slate-700">
                      {branch.totalMentions ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Mentions
                    </p>
                  </div>
                </div>
                {/* Score bar */}
                <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={cn("h-full rounded-full transition-all", getScoreColor(branch.avgScore ?? 0))}
                    style={{ width: `${((branch.avgScore ?? 0) / 10) * 100}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detailed Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Theme Performance by Branch
          </CardTitle>
          <CardDescription>
            Detailed comparison of theme scores across all branches (0-10 scale, higher is better)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-3 px-4 font-semibold text-slate-700 w-[200px]">
                    Theme
                  </th>
                  {branches.map((branch) => (
                    <th 
                      key={branch.id} 
                      className="text-center py-3 px-4 font-semibold text-slate-700 min-w-[120px]"
                    >
                      {branch.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedCategories.map((category) => {
                  const categoryStyle = getCategoryStyle(category);
                  const themes = groupedByCategory[category];
                  
                  return (
                    <Fragment key={category}>
                      {/* Category Header */}
                      <tr className={cn("border-t-2", categoryStyle.border)}>
                        <td 
                          colSpan={branches.length + 1} 
                          className={cn("py-2 px-4", categoryStyle.bg)}
                        >
                          <span className={cn("text-sm font-semibold", categoryStyle.text)}>
                            {category}
                          </span>
                        </td>
                      </tr>
                      {/* Theme Rows */}
                      {themes.map((theme) => {
                        // Find best score for this theme
                        const scores = branches.map(b => ({
                          branchId: b.id,
                          ...theme.branchScores[b.id]
                        }));
                        const maxScore = Math.max(...scores.map(s => s?.score ?? 0));
                        
                        return (
                          <tr 
                            key={theme.themeId} 
                            className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                          >
                            <td className="py-3 px-4">
                              <span className="font-medium text-slate-700">{theme.themeName}</span>
                            </td>
                            {branches.map((branch) => {
                              const branchData = theme.branchScores[branch.id];
                              const score = branchData?.score ?? 0;
                              const mentions = branchData?.mentions ?? 0;
                              const isBestForTheme = score === maxScore && score > 0;
                              
                              return (
                                <td key={branch.id} className="py-3 px-4">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="flex justify-center">
                                          {mentions > 0 ? (
                                            <div 
                                              className={cn(
                                                "inline-flex items-center justify-center min-w-[60px] px-3 py-1.5 rounded-lg font-semibold text-sm border transition-all",
                                                getScoreBgLight(score),
                                                getScoreTextColor(score),
                                                isBestForTheme && "ring-2 ring-emerald-400 ring-offset-1"
                                              )}
                                            >
                                              {score.toFixed(1)}
                                              {isBestForTheme && (
                                                <TrendingUp className="w-3 h-3 ml-1 text-emerald-500" />
                                              )}
                                            </div>
                                          ) : (
                                            <div className="inline-flex items-center justify-center min-w-[60px] px-3 py-1.5 rounded-lg text-sm text-slate-400 bg-slate-50 border border-slate-200">
                                              —
                                            </div>
                                          )}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-[200px]">
                                        <div className="space-y-1">
                                          <p className="font-semibold">{branch.name}</p>
                                          <p className="text-xs">
                                            <span className="text-muted-foreground">Theme:</span> {theme.themeName}
                                          </p>
                                          <p className="text-xs">
                                            <span className="text-muted-foreground">Score:</span>{" "}
                                            <span className={getScoreTextColor(score)}>{score.toFixed(1)}/10</span>
                                          </p>
                                          <p className="text-xs">
                                            <span className="text-muted-foreground">Mentions:</span> {mentions}
                                          </p>
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t text-xs text-muted-foreground">
            <span className="font-medium">Score Guide:</span>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-emerald-500" />
              <span>Excellent (8-10)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-emerald-400" />
              <span>Good (6-8)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-amber-400" />
              <span>Average (5-6)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-orange-400" />
              <span>Below Avg (4-5)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-rose-500" />
              <span>Needs Work (0-4)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
