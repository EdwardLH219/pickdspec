"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  RecommendationWithDetails,
  generateTasksFromRecommendation,
  GeneratedTask,
} from "@/lib/data/recommendations";
import {
  AlertTriangle,
  TrendingUp,
  User,
  Quote,
  CheckCircle2,
  ArrowRight,
  Star,
  Loader2,
} from "lucide-react";
import { getSourceById } from "@/lib/mock/sources";

interface RecommendationCardProps {
  recommendation: RecommendationWithDetails;
  onTasksCreated?: (tasks: GeneratedTask[]) => void;
}

export function RecommendationCard({
  recommendation,
  onTasksCreated,
}: RecommendationCardProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-rose-100 text-rose-700 border-rose-200";
      case "medium":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "low":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new":
        return "bg-blue-100 text-blue-700";
      case "in_progress":
        return "bg-purple-100 text-purple-700";
      case "completed":
        return "bg-emerald-100 text-emerald-700";
      case "dismissed":
        return "bg-gray-100 text-gray-500";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getSeverityLabel = (severity: number) => {
    if (severity >= 50) return "Critical";
    if (severity >= 30) return "High";
    if (severity >= 15) return "Medium";
    return "Low";
  };

  const getSeverityColor = (severity: number) => {
    if (severity >= 50) return "text-rose-600";
    if (severity >= 30) return "text-orange-600";
    if (severity >= 15) return "text-amber-600";
    return "text-emerald-600";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const handleCreateTasks = async () => {
    setIsCreating(true);
    
    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 800));
    
    const tasks = generateTasksFromRecommendation(recommendation);
    
    if (onTasksCreated) {
      onTasksCreated(tasks);
    }
    
    // Navigate to tasks page
    router.push("/tasks?created=true");
  };

  return (
    <Card className="overflow-hidden">
      <Accordion type="single" collapsible>
        <AccordionItem value={recommendation.id} className="border-0">
          <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50">
            <div className="flex flex-1 flex-col items-start gap-3 text-left pr-4">
              {/* Top row: Title and badges */}
              <div className="flex flex-wrap items-center gap-2 w-full">
                <h3 className="font-semibold text-base">
                  {recommendation.title}
                </h3>
                <Badge
                  variant="outline"
                  className={getPriorityColor(recommendation.priority)}
                >
                  {recommendation.priority.charAt(0).toUpperCase() +
                    recommendation.priority.slice(1)}{" "}
                  Priority
                </Badge>
                <Badge className={getStatusColor(recommendation.status)}>
                  {recommendation.status.replace("_", " ").charAt(0).toUpperCase() +
                    recommendation.status.replace("_", " ").slice(1)}
                </Badge>
              </div>

              {/* Second row: Theme, severity, owner */}
              <div className="flex flex-wrap items-center gap-4 text-sm">
                {recommendation.theme && (
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="font-normal">
                      {recommendation.theme.name}
                    </Badge>
                  </div>
                )}
                <div
                  className={`flex items-center gap-1 ${getSeverityColor(
                    recommendation.severity
                  )}`}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="font-medium">
                    Severity: {recommendation.severity} (
                    {getSeverityLabel(recommendation.severity)})
                  </span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  <span>{recommendation.suggestedOwner}</span>
                </div>
              </div>

              {/* Third row: Impact */}
              <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4 mt-0.5 flex-shrink-0 text-emerald-600" />
                <span>{recommendation.impact}</span>
              </div>
            </div>
          </AccordionTrigger>

          <AccordionContent>
            <CardContent className="pt-0 pb-6 px-6">
              <Separator className="mb-6" />

              <div className="grid gap-6 lg:grid-cols-2">
                {/* Evidence Section */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Quote className="h-4 w-4 text-muted-foreground" />
                    Evidence ({recommendation.basedOnReviews} reviews analyzed)
                  </h4>
                  <div className="space-y-3">
                    {recommendation.evidence.length > 0 ? (
                      recommendation.evidence.map((evidence, idx) => {
                        const source = getSourceById(evidence.source as "google" | "hellopeter" | "facebook" | "tripadvisor");
                        return (
                          <div
                            key={idx}
                            className="rounded-lg border bg-muted/30 p-3"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span>{source.icon}</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(evidence.date)}
                                </span>
                              </div>
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={`h-3 w-3 ${
                                      star <= evidence.rating
                                        ? "fill-amber-400 text-amber-400"
                                        : "fill-muted text-muted"
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground italic">
                              &ldquo;{evidence.excerpt}&rdquo;
                            </p>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No review evidence available for current filters.
                      </p>
                    )}
                  </div>
                </div>

                {/* Suggested Actions Section */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    Suggested Actions
                  </h4>
                  <ul className="space-y-2 mb-6">
                    {recommendation.suggestedActions.map((action, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-sm"
                      >
                        <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 text-xs font-medium">
                          {idx + 1}
                        </div>
                        <div>
                          <span>{action.action}</span>
                          <span className="text-muted-foreground ml-1">
                            — {action.owner}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>

                  {recommendation.status !== "completed" &&
                    recommendation.status !== "dismissed" && (
                      <Button
                        onClick={handleCreateTasks}
                        disabled={isCreating}
                        className="w-full"
                      >
                        {isCreating ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating Tasks...
                          </>
                        ) : (
                          <>
                            Create {recommendation.suggestedActions.length} Tasks
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    )}
                </div>
              </div>
            </CardContent>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}

export function RecommendationCardSkeleton() {
  return (
    <Card>
      <div className="p-6 space-y-3">
        <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
        <div className="flex gap-2">
          <div className="h-5 w-20 animate-pulse rounded bg-muted" />
          <div className="h-5 w-16 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    </Card>
  );
}
