import { mockRecommendations, mockReviews, mockReviewThemes, mockThemes } from "@/lib/mock";
import {
  Recommendation,
  RecommendationPriority,
  RecommendationStatus,
  Review,
  Theme,
  DateRange,
} from "@/lib/types";

export interface RecommendationFilters {
  branchId?: string | null;
  priorities?: RecommendationPriority[];
  statuses?: RecommendationStatus[];
  themeIds?: string[];
  dateRange?: DateRange;
}

export interface RecommendationEvidence {
  reviewId: string;
  excerpt: string;
  rating: number;
  date: string;
  source: string;
}

export interface SuggestedAction {
  action: string;
  owner: string;
}

export interface RecommendationWithDetails extends Recommendation {
  theme: Theme | null;
  severity: number; // mentions × negativity factor
  evidence: RecommendationEvidence[];
  suggestedActions: SuggestedAction[];
  suggestedOwner: string;
}

// Suggested actions templates based on theme category
const actionTemplates: Record<string, SuggestedAction[]> = {
  service: [
    { action: "Review staffing levels during peak hours", owner: "Operations Manager" },
    { action: "Implement customer service refresher training", owner: "HR Manager" },
    { action: "Create service quality checklist for daily briefings", owner: "Shift Supervisor" },
    { action: "Set up mystery shopper program to monitor improvements", owner: "Quality Manager" },
  ],
  product: [
    { action: "Schedule menu review meeting with head chef", owner: "General Manager" },
    { action: "Audit supplier quality and freshness standards", owner: "Procurement Manager" },
    { action: "Test new recipes with focus group", owner: "Head Chef" },
    { action: "Update food preparation SOPs", owner: "Kitchen Manager" },
  ],
  ambiance: [
    { action: "Conduct facility walkthrough assessment", owner: "Facilities Manager" },
    { action: "Review lighting and music settings", owner: "Operations Manager" },
    { action: "Get quotes for improvement projects", owner: "General Manager" },
    { action: "Survey customers on specific ambiance preferences", owner: "Marketing Manager" },
  ],
  value: [
    { action: "Analyze competitor pricing in the area", owner: "Marketing Manager" },
    { action: "Design value-focused menu options or combos", owner: "Head Chef" },
    { action: "Review portion sizes vs pricing", owner: "Operations Manager" },
    { action: "Create loyalty program or special offers", owner: "Marketing Manager" },
  ],
  cleanliness: [
    { action: "Increase cleaning frequency schedule", owner: "Operations Manager" },
    { action: "Conduct staff training on cleanliness standards", owner: "HR Manager" },
    { action: "Implement hourly cleaning checklists", owner: "Shift Supervisor" },
    { action: "Order additional cleaning supplies and equipment", owner: "Procurement Manager" },
  ],
  other: [
    { action: "Investigate root cause with team meeting", owner: "General Manager" },
    { action: "Create action plan with measurable targets", owner: "Operations Manager" },
    { action: "Monitor customer feedback for improvements", owner: "Customer Service Manager" },
  ],
};

// Owner role suggestions based on priority
const ownerByPriority: Record<RecommendationPriority, string> = {
  high: "General Manager",
  medium: "Operations Manager",
  low: "Shift Supervisor",
};

function getEvidenceForRecommendation(
  rec: Recommendation,
  branchId: string | null,
  dateRange?: DateRange
): RecommendationEvidence[] {
  // Find reviews that mention this theme
  const themeReviewIds = mockReviewThemes
    .filter((rt) => rt.themeId === rec.themeId)
    .map((rt) => rt.reviewId);

  let relevantReviews = mockReviews.filter((r) => themeReviewIds.includes(r.id));

  // Filter by branch
  if (branchId) {
    relevantReviews = relevantReviews.filter((r) => r.branchId === branchId);
  } else if (rec.branchId) {
    relevantReviews = relevantReviews.filter((r) => r.branchId === rec.branchId);
  }

  // Filter by date range
  if (dateRange) {
    relevantReviews = relevantReviews.filter(
      (r) => r.date >= dateRange.start && r.date <= dateRange.end
    );
  }

  // Prefer negative reviews for evidence
  relevantReviews.sort((a, b) => a.sentimentScore - b.sentimentScore);

  // Take top 3 and anonymize
  return relevantReviews.slice(0, 3).map((review) => {
    // Get the excerpt from theme mention if available
    const themeMention = mockReviewThemes.find(
      (rt) => rt.reviewId === review.id && rt.themeId === rec.themeId
    );

    return {
      reviewId: review.id,
      excerpt: themeMention?.excerpt || getAnonymizedExcerpt(review.content),
      rating: review.rating,
      date: review.date,
      source: review.source,
    };
  });
}

function getAnonymizedExcerpt(content: string): string {
  // Take first 150 chars and anonymize any names
  let excerpt = content.substring(0, 150);
  if (content.length > 150) excerpt += "...";
  return excerpt;
}

function getSuggestedActions(theme: Theme | null): SuggestedAction[] {
  const category = theme?.category || "other";
  const templates = actionTemplates[category] || actionTemplates.other;
  // Return 3-4 actions based on theme id for determinism
  const extraAction = theme ? (theme.id.charCodeAt(theme.id.length - 1) % 2) : 0;
  return templates.slice(0, 3 + extraAction);
}

function calculateSeverity(rec: Recommendation, branchId: string | null): number {
  // Get reviews for this theme
  const themeReviewIds = mockReviewThemes
    .filter((rt) => rt.themeId === rec.themeId)
    .map((rt) => rt.reviewId);

  let relevantReviews = mockReviews.filter((r) => themeReviewIds.includes(r.id));

  if (branchId) {
    relevantReviews = relevantReviews.filter((r) => r.branchId === branchId);
  } else if (rec.branchId) {
    relevantReviews = relevantReviews.filter((r) => r.branchId === rec.branchId);
  }

  const mentions = relevantReviews.length;
  const negativeCount = relevantReviews.filter((r) => r.sentiment === "negative").length;
  const negativityFactor = mentions > 0 ? (negativeCount / mentions) * 10 : 0;

  // Severity = mentions × negativity factor, with priority boost
  const priorityMultiplier = rec.priority === "high" ? 1.5 : rec.priority === "medium" ? 1.2 : 1;
  return Math.round(mentions * negativityFactor * priorityMultiplier);
}

export function getRecommendationsWithDetails(
  filters?: RecommendationFilters
): RecommendationWithDetails[] {
  let results = [...mockRecommendations];

  // Apply filters
  if (filters) {
    if (filters.branchId !== undefined) {
      results = results.filter(
        (r) => r.branchId === null || r.branchId === filters.branchId
      );
    }
    if (filters.priorities && filters.priorities.length > 0) {
      results = results.filter((r) => filters.priorities!.includes(r.priority));
    }
    if (filters.statuses && filters.statuses.length > 0) {
      results = results.filter((r) => filters.statuses!.includes(r.status));
    }
    if (filters.themeIds && filters.themeIds.length > 0) {
      results = results.filter((r) => filters.themeIds!.includes(r.themeId));
    }
  }

  // Enrich with details
  const enriched: RecommendationWithDetails[] = results.map((rec) => {
    const theme = mockThemes.find((t) => t.id === rec.themeId) || null;
    const severity = calculateSeverity(rec, filters?.branchId ?? null);
    const evidence = getEvidenceForRecommendation(rec, filters?.branchId ?? null, filters?.dateRange);
    const suggestedActions = getSuggestedActions(theme);
    const suggestedOwner = ownerByPriority[rec.priority];

    return {
      ...rec,
      theme,
      severity,
      evidence,
      suggestedActions,
      suggestedOwner,
    };
  });

  // Sort by severity (highest first)
  return enriched.sort((a, b) => b.severity - a.severity);
}

export function getRecommendations(
  filters?: RecommendationFilters
): Recommendation[] {
  let results = [...mockRecommendations];

  if (filters) {
    if (filters.branchId !== undefined) {
      results = results.filter(
        (r) => r.branchId === null || r.branchId === filters.branchId
      );
    }
    if (filters.priorities && filters.priorities.length > 0) {
      results = results.filter((r) => filters.priorities!.includes(r.priority));
    }
    if (filters.statuses && filters.statuses.length > 0) {
      results = results.filter((r) => filters.statuses!.includes(r.status));
    }
    if (filters.themeIds && filters.themeIds.length > 0) {
      results = results.filter((r) => filters.themeIds!.includes(r.themeId));
    }
  }

  // Sort by priority (high first), then by date
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return results.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function getRecommendationById(id: string): Recommendation | undefined {
  return mockRecommendations.find((r) => r.id === id);
}

export function getRecommendationsByTheme(themeId: string): Recommendation[] {
  return mockRecommendations.filter((r) => r.themeId === themeId);
}

export function getRecommendationStats(branchId?: string | null) {
  const recs = getRecommendations({ branchId });

  return {
    total: recs.length,
    byStatus: {
      new: recs.filter((r) => r.status === "new").length,
      in_progress: recs.filter((r) => r.status === "in_progress").length,
      completed: recs.filter((r) => r.status === "completed").length,
      dismissed: recs.filter((r) => r.status === "dismissed").length,
    },
    byPriority: {
      high: recs.filter((r) => r.priority === "high").length,
      medium: recs.filter((r) => r.priority === "medium").length,
      low: recs.filter((r) => r.priority === "low").length,
    },
  };
}

// Generate tasks from a recommendation
export interface GeneratedTask {
  title: string;
  description: string;
  priority: RecommendationPriority;
  assignee: string;
  dueDate: string;
  recommendationId: string;
  themeId: string;
}

export function generateTasksFromRecommendation(
  rec: RecommendationWithDetails
): GeneratedTask[] {
  const now = new Date("2026-01-27");
  
  return rec.suggestedActions.map((action, index) => {
    // Stagger due dates
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 7 * (index + 1));

    return {
      title: action.action,
      description: `Task generated from recommendation: "${rec.title}"`,
      priority: index === 0 ? rec.priority : "medium",
      assignee: action.owner,
      dueDate: dueDate.toISOString(),
      recommendationId: rec.id,
      themeId: rec.themeId,
    };
  });
}
