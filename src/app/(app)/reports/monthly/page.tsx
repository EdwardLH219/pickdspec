"use client";

import { useBranch } from "@/hooks/use-branch";
import { getMonthlyReportData } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Download,
  Star,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Minus,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  Lightbulb,
  BarChart3,
  Calendar,
  Building2,
  Printer,
} from "lucide-react";
import Link from "next/link";

export default function MonthlyReportPage() {
  const { selectedBranch } = useBranch();
  const reportData = getMonthlyReportData(selectedBranch?.id || null);
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <TooltipProvider>
      <div className="space-y-6 pb-12">
        {/* Navigation & Actions - Hidden in print */}
        <div className="flex items-center justify-between print:hidden">
          <Link
            href="/reports"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Reports
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button disabled>
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Coming in Phase 2</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* ===== REPORT CONTENT ===== */}
        <div className="report-container mx-auto max-w-4xl space-y-8 print:max-w-none print:space-y-6">
          
          {/* HEADER */}
          <header className="rounded-lg border bg-card p-6 print:border-2 print:border-gray-300">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Building2 className="h-4 w-4" />
                  <span>{reportData.organization.name}</span>
                </div>
                <h1 className="text-2xl font-bold">
                  Monthly Review Report
                </h1>
                <p className="text-lg text-muted-foreground mt-1">
                  {reportData.branch?.name || "All Branches"}
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 text-sm text-muted-foreground justify-end">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {formatDate(reportData.dateRange.start)} – {formatDate(reportData.dateRange.end)}
                  </span>
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Key Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-center gap-1 text-2xl font-bold">
                  <Star className="h-5 w-5 text-amber-500" />
                  {reportData.avgRating.toFixed(1)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Avg Rating</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">{reportData.avgSentiment.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground mt-1">Sentiment Score</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-center gap-1 text-2xl font-bold">
                  <MessageSquare className="h-5 w-5 text-blue-500" />
                  {reportData.totalReviews}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Total Reviews</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">{reportData.responseRate}%</div>
                <p className="text-xs text-muted-foreground mt-1">Response Rate</p>
              </div>
            </div>
          </header>

          {/* TL;DR SECTION */}
          <section className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              TL;DR - Executive Summary
            </h2>
            <ul className="space-y-2">
              {reportData.tldrBullets.map((bullet, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                  <span className="text-sm">{bullet}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* THEMATICS TABLE */}
          <section className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Theme Analysis</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium">Theme</th>
                    <th className="text-center py-2 px-2 font-medium">Sentiment</th>
                    <th className="text-center py-2 px-2 font-medium">Mentions</th>
                    <th className="text-center py-2 px-2 font-medium">Trend</th>
                    <th className="text-left py-2 px-2 font-medium hidden sm:table-cell">Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.thematics.slice(0, 8).map((theme) => {
                    const sentimentColor =
                      theme.avgSentimentScore >= 7
                        ? "text-emerald-600"
                        : theme.avgSentimentScore >= 5
                        ? "text-amber-600"
                        : "text-rose-600";

                    const TrendIcon =
                      theme.trend === "up"
                        ? TrendingUp
                        : theme.trend === "down"
                        ? TrendingDown
                        : Minus;

                    const trendColor =
                      theme.trend === "up"
                        ? "text-emerald-600"
                        : theme.trend === "down"
                        ? "text-rose-600"
                        : "text-gray-400";

                    return (
                      <tr key={theme.themeId} className="border-b last:border-0">
                        <td className="py-3 px-2">
                          <span className="font-medium">{theme.themeName}</span>
                          <Badge variant="outline" className="ml-2 text-xs hidden sm:inline-flex">
                            {theme.category}
                          </Badge>
                        </td>
                        <td className={`py-3 px-2 text-center font-semibold ${sentimentColor}`}>
                          {theme.avgSentimentScore.toFixed(1)}
                        </td>
                        <td className="py-3 px-2 text-center">
                          {theme.mentionCount}
                        </td>
                        <td className="py-3 px-2">
                          <div className={`flex items-center justify-center gap-1 ${trendColor}`}>
                            <TrendIcon className="h-4 w-4" />
                            <span className="text-xs">
                              {theme.trendPercentage > 0 ? "+" : ""}
                              {theme.trendPercentage}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-muted-foreground text-xs hidden sm:table-cell">
                          {theme.positiveCount} positive, {theme.neutralCount} neutral, {theme.negativeCount} negative
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* WHAT PEOPLE LOVE / DISLIKE */}
          <div className="grid md:grid-cols-2 gap-6 print:grid-cols-2">
            {/* What People Love */}
            <section className="rounded-lg border bg-card p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-emerald-700">
                <ThumbsUp className="h-5 w-5" />
                What People Love
              </h2>
              <div className="space-y-4">
                {reportData.whatPeopleLove.map((item, idx) => (
                  <div key={idx} className="border-l-2 border-emerald-500 pl-3">
                    <Badge variant="secondary" className="mb-1 text-xs">
                      {item.theme}
                    </Badge>
                    <p className="text-sm italic text-muted-foreground">{item.quote}</p>
                    <p className="text-xs text-muted-foreground mt-1">— {item.source}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* What People Dislike */}
            <section className="rounded-lg border bg-card p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-rose-700">
                <ThumbsDown className="h-5 w-5" />
                What People Dislike
              </h2>
              <div className="space-y-4">
                {reportData.whatPeopleDislike.map((item, idx) => (
                  <div key={idx} className="border-l-2 border-rose-500 pl-3">
                    <Badge variant="secondary" className="mb-1 text-xs">
                      {item.theme}
                    </Badge>
                    <p className="text-sm italic text-muted-foreground">{item.quote}</p>
                    <p className="text-xs text-muted-foreground mt-1">— {item.source}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* WATCH-OUTS & PRACTICAL TIPS */}
          <div className="grid md:grid-cols-2 gap-6 print:grid-cols-2">
            {/* Watch-outs */}
            <section className="rounded-lg border bg-card p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
                Watch-outs
              </h2>
              <ul className="space-y-3">
                {reportData.watchOuts.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-medium">
                      {idx + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
                {reportData.watchOuts.length === 0 && (
                  <p className="text-sm text-muted-foreground">No critical issues identified this period.</p>
                )}
              </ul>
            </section>

            {/* Practical Tips */}
            <section className="rounded-lg border bg-card p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-blue-700">
                <Lightbulb className="h-5 w-5" />
                Practical Tips
              </h2>
              <ul className="space-y-3">
                {reportData.practicalTips.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-medium">
                      {idx + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* SIGNALS & STATS */}
          <section className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Signals & Statistics</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {/* Review Volume */}
              <div>
                <h3 className="text-sm font-medium mb-3">Review Volume</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Last 30 days</span>
                    <span className="font-medium">{reportData.signals.last30Days} reviews</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Last 90 days</span>
                    <span className="font-medium">{reportData.signals.last90Days} reviews</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Last 365 days</span>
                    <span className="font-medium">{reportData.signals.last365Days} reviews</span>
                  </div>
                </div>
              </div>

              {/* Star Distribution */}
              <div>
                <h3 className="text-sm font-medium mb-3">Star Distribution (Last 30 Days)</h3>
                <div className="space-y-2">
                  {reportData.starDistribution.map((item) => (
                    <div key={item.rating} className="flex items-center gap-3">
                      <div className="flex items-center gap-1 w-12">
                        <span className="text-sm font-medium">{item.rating}</span>
                        <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                      </div>
                      <div className="flex-1">
                        <Progress
                          value={item.percentage}
                          className={`h-2 ${
                            item.rating >= 4
                              ? "[&>div]:bg-emerald-500"
                              : item.rating === 3
                              ? "[&>div]:bg-amber-500"
                              : "[&>div]:bg-rose-500"
                          }`}
                        />
                      </div>
                      <div className="w-16 text-right text-sm text-muted-foreground">
                        {item.count} ({item.percentage}%)
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* FOOTER */}
          <footer className="text-center text-xs text-muted-foreground pt-4 border-t">
            <p>
              Report generated by Pick&apos;d Review Intelligence on{" "}
              {new Date(reportData.generatedAt).toLocaleString("en-US", {
                dateStyle: "long",
                timeStyle: "short",
              })}
            </p>
            <p className="mt-1">
              © {new Date().getFullYear()} {reportData.organization.name}. All rights reserved.
            </p>
          </footer>
        </div>

        {/* Print Styles */}
        <style jsx global>{`
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            
            .print\\:hidden {
              display: none !important;
            }
            
            .report-container {
              padding: 0;
            }
            
            section {
              break-inside: avoid;
              page-break-inside: avoid;
            }
            
            h2 {
              break-after: avoid;
              page-break-after: avoid;
            }
            
            table {
              break-inside: avoid;
              page-break-inside: avoid;
            }
            
            /* Ensure borders print */
            .border {
              border-color: #e5e7eb !important;
            }
            
            /* Remove shadows for print */
            * {
              box-shadow: none !important;
            }
          }
        `}</style>
      </div>
    </TooltipProvider>
  );
}
