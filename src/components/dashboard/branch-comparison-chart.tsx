"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
  if (score >= 8) return "bg-green-500";
  if (score >= 6) return "bg-green-400";
  if (score >= 5) return "bg-yellow-400";
  if (score >= 4) return "bg-orange-400";
  if (score >= 2) return "bg-red-400";
  return "bg-red-500";
}

function getScoreTextColor(score: number): string {
  if (score >= 8) return "text-green-700";
  if (score >= 6) return "text-green-600";
  if (score >= 5) return "text-yellow-700";
  if (score >= 4) return "text-orange-700";
  return "text-red-700";
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    SERVICE: "bg-blue-100 text-blue-800",
    PRODUCT: "bg-purple-100 text-purple-800",
    CLEANLINESS: "bg-green-100 text-green-800",
    VALUE: "bg-yellow-100 text-yellow-800",
    AMBIANCE: "bg-pink-100 text-pink-800",
    LOCATION: "bg-orange-100 text-orange-800",
    OTHER: "bg-gray-100 text-gray-800",
  };
  return colors[category] || colors.OTHER;
}

export function BranchComparisonChart({ branches, comparison }: BranchComparisonChartProps) {
  if (branches.length === 0 || comparison.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Branch Comparison</CardTitle>
          <CardDescription>Compare theme performance across branches</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No comparison data available. Run scoring on multiple branches to see comparison.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group comparison by category
  const groupedByCategory = comparison.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ComparisonData[]>);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branch Performance Comparison</CardTitle>
        <CardDescription>
          Theme scores across all branches - higher is better (0-10 scale)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Branch Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {branches.map((branch) => (
            <div
              key={branch.id}
              className="p-4 rounded-lg border bg-card"
            >
              <div className="font-medium truncate">{branch.name}</div>
              <div className={cn("text-2xl font-bold", getScoreTextColor(branch.avgScore))}>
                {branch.avgScore.toFixed(1)}
              </div>
              <div className="text-xs text-muted-foreground">
                Avg Score · {branch.totalMentions} mentions
              </div>
            </div>
          ))}
        </div>

        {/* Heatmap Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 font-medium">Theme</th>
                {branches.map((branch) => (
                  <th key={branch.id} className="text-center py-2 px-3 font-medium min-w-[100px]">
                    {branch.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedByCategory).map(([category, themes]) => (
                <>
                  {/* Category Header Row */}
                  <tr key={`cat-${category}`} className="bg-muted/50">
                    <td colSpan={branches.length + 1} className="py-2 px-3">
                      <Badge variant="outline" className={getCategoryColor(category)}>
                        {category}
                      </Badge>
                    </td>
                  </tr>
                  {/* Theme Rows */}
                  {themes.map((theme) => (
                    <tr key={theme.themeId} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-3 font-medium">{theme.themeName}</td>
                      {branches.map((branch) => {
                        const branchData = theme.branchScores[branch.id];
                        const score = branchData?.score ?? 0;
                        const mentions = branchData?.mentions ?? 0;
                        
                        return (
                          <td key={branch.id} className="text-center py-2 px-3">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={cn(
                                      "inline-flex items-center justify-center w-12 h-8 rounded font-medium text-white cursor-default",
                                      mentions > 0 ? getScoreColor(score) : "bg-gray-200 text-gray-500"
                                    )}
                                  >
                                    {mentions > 0 ? score.toFixed(1) : "-"}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-xs">
                                    <div><strong>{branch.name}</strong></div>
                                    <div>Score: {score.toFixed(1)}/10</div>
                                    <div>Mentions: {mentions}</div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
          <span>Score Legend:</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-green-500"></div>
            <span>8-10</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-green-400"></div>
            <span>6-8</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-yellow-400"></div>
            <span>5-6</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-orange-400"></div>
            <span>4-5</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-red-400"></div>
            <span>2-4</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-red-500"></div>
            <span>0-2</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
