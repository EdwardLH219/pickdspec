"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Review, ReviewTheme } from "@/lib/types";
import { getSourceById } from "@/lib/mock/sources";
import { Star } from "lucide-react";

interface NegativeReviewsTableProps {
  reviews: Review[];
  reviewThemes: Map<string, ReviewTheme[]>;
}

export function NegativeReviewsTable({
  reviews,
  reviewThemes,
}: NegativeReviewsTableProps) {
  // Filter to negative reviews and sort by date
  const negativeReviews = reviews
    .filter((r) => r.sentiment === "negative")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getExcerpt = (content: string, maxLength: number = 80) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength).trim() + "...";
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-3.5 w-3.5 ${
              star <= rating
                ? "fill-amber-400 text-amber-400"
                : "fill-muted text-muted"
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center">
          Latest Negative Reviews
          <InfoTooltip content="Shows the 5 most recent reviews with negative sentiment. Use this to quickly identify and respond to unhappy customers." />
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {negativeReviews.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            No negative reviews in this period
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Date</TableHead>
                  <TableHead className="w-[100px]">Source</TableHead>
                  <TableHead className="w-[90px]">Rating</TableHead>
                  <TableHead className="w-[180px]">Themes</TableHead>
                  <TableHead>Excerpt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {negativeReviews.map((review) => {
                  const source = getSourceById(review.source);
                  const themes = reviewThemes.get(review.id) || [];

                  return (
                    <TableRow key={review.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(review.date)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span>{source.icon}</span>
                          <span className="text-sm">{source.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{renderStars(review.rating)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {themes.slice(0, 3).map((theme, idx) => (
                            <Badge
                              key={idx}
                              variant={
                                theme.sentiment === "negative"
                                  ? "destructive"
                                  : "secondary"
                              }
                              className="text-xs font-normal"
                            >
                              {theme.themeId
                                .replace("theme-", "T")
                                .substring(0, 6)}
                            </Badge>
                          ))}
                          {themes.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{themes.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <p className="text-sm text-muted-foreground truncate">
                          {getExcerpt(review.content)}
                        </p>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function NegativeReviewsTableSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
