import { mockReviews, mockReviewThemes } from "@/lib/mock";
import {
  Review,
  ReviewTheme,
  ReviewFilters,
  PaginatedResult,
  PaginationParams,
  SortParams,
} from "@/lib/types";

export function getReviews(
  filters?: ReviewFilters,
  pagination?: PaginationParams,
  sort?: SortParams
): PaginatedResult<Review> {
  let results = [...mockReviews];

  // Apply filters
  if (filters) {
    if (filters.branchId) {
      results = results.filter((r) => r.branchId === filters.branchId);
    }
    if (filters.sources && filters.sources.length > 0) {
      results = results.filter((r) => filters.sources!.includes(r.source));
    }
    if (filters.ratings && filters.ratings.length > 0) {
      results = results.filter((r) => filters.ratings!.includes(r.rating));
    }
    if (filters.sentiments && filters.sentiments.length > 0) {
      results = results.filter((r) => filters.sentiments!.includes(r.sentiment));
    }
    if (filters.dateRange) {
      results = results.filter(
        (r) =>
          r.date >= filters.dateRange!.start && r.date <= filters.dateRange!.end
      );
    }
    if (filters.responded !== undefined) {
      results = results.filter((r) => r.responded === filters.responded);
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      results = results.filter(
        (r) =>
          r.title.toLowerCase().includes(searchLower) ||
          r.content.toLowerCase().includes(searchLower) ||
          r.author.toLowerCase().includes(searchLower)
      );
    }
    if (filters.themeIds && filters.themeIds.length > 0) {
      const reviewIdsWithThemes = new Set(
        mockReviewThemes
          .filter((rt) => filters.themeIds!.includes(rt.themeId))
          .map((rt) => rt.reviewId)
      );
      results = results.filter((r) => reviewIdsWithThemes.has(r.id));
    }
  }

  // Apply sorting
  if (sort) {
    results.sort((a, b) => {
      const aVal = a[sort.field as keyof Review];
      const bVal = b[sort.field as keyof Review];
      if (aVal === undefined || bVal === undefined) return 0;
      if (aVal < bVal) return sort.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sort.direction === "asc" ? 1 : -1;
      return 0;
    });
  } else {
    // Default sort by date descending
    results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  // Apply pagination
  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 10;
  const total = results.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const paginatedData = results.slice(start, start + pageSize);

  return {
    data: paginatedData,
    total,
    page,
    pageSize,
    totalPages,
  };
}

export function getReviewById(id: string): Review | undefined {
  return mockReviews.find((r) => r.id === id);
}

export function getReviewThemes(reviewId: string): ReviewTheme[] {
  return mockReviewThemes.filter((rt) => rt.reviewId === reviewId);
}

export function getRecentReviews(
  branchId?: string | null,
  limit: number = 5
): Review[] {
  let reviews = [...mockReviews];
  if (branchId) {
    reviews = reviews.filter((r) => r.branchId === branchId);
  }
  return reviews
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
}
