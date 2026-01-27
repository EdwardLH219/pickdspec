"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { BranchComparisonData } from "@/lib/data/dashboard";
import { Building2 } from "lucide-react";

interface BranchComparisonHeatmapProps {
  data: BranchComparisonData;
}

function getHeatmapColor(negativeRate: number): string {
  // Green (low negative) to Red (high negative)
  if (negativeRate === 0) return "bg-gray-100 text-gray-500";
  if (negativeRate <= 15) return "bg-emerald-100 text-emerald-800";
  if (negativeRate <= 25) return "bg-emerald-200 text-emerald-900";
  if (negativeRate <= 35) return "bg-amber-100 text-amber-800";
  if (negativeRate <= 50) return "bg-amber-200 text-amber-900";
  if (negativeRate <= 65) return "bg-orange-200 text-orange-900";
  if (negativeRate <= 80) return "bg-rose-200 text-rose-900";
  return "bg-rose-300 text-rose-950";
}

export function BranchComparisonHeatmap({ data }: BranchComparisonHeatmapProps) {
  const { branches, themes, cells } = data;

  if (branches.length === 0 || themes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Branch Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            No comparison data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Branch Comparison
            <InfoTooltip content="Compares negative mention rates across branches and themes. Lower percentages (green) are better. Hover cells for detailed counts and sentiment scores." />
          </CardTitle>
          <CardDescription>
            Negative mention rate by branch and theme (lower is better)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground w-[140px]">
                    Branch
                  </th>
                  {themes.map((theme) => (
                    <th
                      key={theme.id}
                      className="text-center py-2 px-2 font-medium text-muted-foreground min-w-[90px]"
                    >
                      <span className="text-xs leading-tight block">
                        {theme.name.length > 14
                          ? theme.name.substring(0, 12) + "..."
                          : theme.name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {branches.map((branch) => (
                  <tr key={branch.id} className="border-t">
                    <td className="py-2 px-3 font-medium">
                      {branch.name.length > 18
                        ? branch.name.substring(0, 16) + "..."
                        : branch.name}
                    </td>
                    {themes.map((theme) => {
                      const key = `${branch.id}-${theme.id}`;
                      const cell = cells.get(key);
                      
                      if (!cell || cell.totalMentions === 0) {
                        return (
                          <td key={theme.id} className="py-2 px-2">
                            <div className="flex items-center justify-center">
                              <span className="text-xs text-muted-foreground">—</span>
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td key={theme.id} className="py-2 px-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={`flex items-center justify-center rounded-md py-2 px-3 cursor-default transition-colors ${getHeatmapColor(
                                  cell.negativeRate
                                )}`}
                              >
                                <span className="font-semibold text-sm">
                                  {cell.negativeRate}%
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[200px]">
                              <div className="space-y-1">
                                <p className="font-semibold">
                                  {branch.name} × {theme.name}
                                </p>
                                <div className="text-xs space-y-0.5">
                                  <p>
                                    <span className="text-muted-foreground">Total mentions:</span>{" "}
                                    {cell.totalMentions}
                                  </p>
                                  <p>
                                    <span className="text-muted-foreground">Negative:</span>{" "}
                                    {cell.negativeMentions} ({cell.negativeRate}%)
                                  </p>
                                  <p>
                                    <span className="text-muted-foreground">Avg sentiment:</span>{" "}
                                    <span
                                      className={
                                        cell.avgSentiment >= 7
                                          ? "text-emerald-600"
                                          : cell.avgSentiment >= 5
                                          ? "text-amber-600"
                                          : "text-rose-600"
                                      }
                                    >
                                      {cell.avgSentiment.toFixed(1)}/10
                                    </span>
                                  </p>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="mt-4 pt-3 border-t flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span>Negative Rate:</span>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-emerald-100" />
              <span>Low</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-amber-200" />
              <span>Medium</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-rose-300" />
              <span>High</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

export function BranchComparisonHeatmapSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-64 mt-1" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Header row */}
          <div className="flex gap-2">
            <Skeleton className="h-6 w-[140px]" />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-[90px]" />
            ))}
          </div>
          {/* Data rows */}
          {Array.from({ length: 2 }).map((_, row) => (
            <div key={row} className="flex gap-2">
              <Skeleton className="h-10 w-[140px]" />
              {Array.from({ length: 6 }).map((_, col) => (
                <Skeleton key={col} className="h-10 w-[90px]" />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
