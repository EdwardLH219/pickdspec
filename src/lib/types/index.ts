// ============================================
// ORGANIZATION & BRANCHES
// ============================================

export interface Organization {
  id: string;
  name: string;
  industry: string;
  createdAt: string;
}

export interface Branch {
  id: string;
  organizationId: string;
  name: string;
  address: string;
  city: string;
  isActive: boolean;
}

// ============================================
// REVIEW SOURCES
// ============================================

export type ReviewSourceType = "google" | "hellopeter" | "facebook" | "tripadvisor";

export interface ReviewSource {
  id: ReviewSourceType;
  name: string;
  icon: string;
  color: string;
}

// ============================================
// REVIEWS
// ============================================

export interface Review {
  id: string;
  branchId: string;
  source: ReviewSourceType;
  rating: number; // 1-5
  title: string;
  content: string;
  author: string;
  date: string; // ISO date string
  responded: boolean;
  responseDate?: string;
  sentiment: "positive" | "neutral" | "negative";
  sentimentScore: number; // 0-10
}

// ============================================
// THEMES
// ============================================

export interface Theme {
  id: string;
  branchId: string | null; // null = global theme
  name: string;
  category: "service" | "product" | "ambiance" | "value" | "cleanliness" | "other";
  description: string;
}

export interface ReviewTheme {
  id: string;
  reviewId: string;
  themeId: string;
  sentiment: "positive" | "neutral" | "negative";
  sentimentScore: number; // 0-10
  excerpt: string; // The part of the review mentioning this theme
}

export interface ThemeSentimentSummary {
  themeId: string;
  themeName: string;
  category: Theme["category"];
  mentionCount: number;
  avgSentimentScore: number;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  trend: "up" | "down" | "stable";
  trendPercentage: number;
}

// ============================================
// RECOMMENDATIONS
// ============================================

export type RecommendationPriority = "high" | "medium" | "low";
export type RecommendationStatus = "new" | "in_progress" | "completed" | "dismissed";

export interface Recommendation {
  id: string;
  branchId: string | null; // null = all branches
  themeId: string;
  priority: RecommendationPriority;
  status: RecommendationStatus;
  category: string;
  title: string;
  description: string;
  impact: string;
  basedOnReviews: number; // count of reviews this is based on
  createdAt: string;
  updatedAt: string;
}

// ============================================
// TASKS
// ============================================

export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";

export interface Task {
  id: string;
  branchId: string | null;
  recommendationId: string | null;
  themeId: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: RecommendationPriority;
  assignee: string;
  dueDate: string;
  completedAt: string | null;
  createdAt: string;
}

// ============================================
// USERS
// ============================================

export type UserRole = "admin" | "manager" | "viewer";

export interface User {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: UserRole;
  branchIds: string[]; // empty = all branches access
  avatar?: string;
  isActive: boolean;
}

// ============================================
// DASHBOARD & METRICS
// ============================================

export interface DashboardMetrics {
  totalReviews: number;
  averageRating: number;
  responseRate: number;
  avgSentimentScore: number;
  // Changes from previous period
  reviewsChange: number;
  ratingChange: number;
  responseRateChange: number;
  sentimentChange: number;
}

export interface ReviewTrendPoint {
  date: string;
  count: number;
  avgRating: number;
  avgSentiment: number;
}

export interface RatingDistribution {
  rating: number;
  count: number;
  percentage: number;
}

export interface SentimentDistribution {
  sentiment: "positive" | "neutral" | "negative";
  count: number;
  percentage: number;
}

export interface SourceDistribution {
  source: ReviewSourceType;
  sourceName: string;
  count: number;
  percentage: number;
  avgRating: number;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  reviewsTrend: ReviewTrendPoint[];
  ratingDistribution: RatingDistribution[];
  sentimentDistribution: SentimentDistribution[];
  sourceDistribution: SourceDistribution[];
  topThemes: ThemeSentimentSummary[];
  recentReviews: Review[];
}

// ============================================
// FILTERS & QUERIES
// ============================================

export type DateRangePreset = "30d" | "90d" | "365d" | "custom";

export interface DateRange {
  start: string;
  end: string;
}

export interface ReviewFilters {
  branchId?: string | null;
  sources?: ReviewSourceType[];
  ratings?: number[];
  sentiments?: ("positive" | "neutral" | "negative")[];
  dateRange?: DateRange;
  responded?: boolean;
  search?: string;
  themeIds?: string[];
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SortParams {
  field: string;
  direction: "asc" | "desc";
}
