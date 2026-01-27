"use client";

import { useState, useMemo } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { Review, ReviewSourceType, Theme } from "@/lib/types";
import { getSourceById, reviewSources } from "@/lib/mock/sources";
import { exportToCSV } from "@/lib/utils/export";
import { toast } from "sonner";
import {
  Search,
  Download,
  FileSpreadsheet,
  FileText,
  ArrowUpDown,
  Star,
  ChevronLeft,
  ChevronRight,
  X,
  Filter,
} from "lucide-react";

interface ReviewExplorerProps {
  reviews: Review[];
  themes: Theme[];
  reviewThemesMap: Map<string, { themeId: string; themeName: string }[]>;
}

const PAGE_SIZES = [10, 25, 50, 100];

export function ReviewExplorer({
  reviews,
  themes,
  reviewThemesMap,
}: ReviewExplorerProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true },
  ]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [sentimentFilter, setSentimentFilter] = useState<string>("all");
  const [themeFilter, setThemeFilter] = useState<string>("all");

  // Apply filters
  const filteredReviews = useMemo(() => {
    let result = [...reviews];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.content.toLowerCase().includes(query) ||
          r.title.toLowerCase().includes(query) ||
          r.author.toLowerCase().includes(query)
      );
    }

    // Source filter
    if (sourceFilter !== "all") {
      result = result.filter((r) => r.source === sourceFilter);
    }

    // Rating filter
    if (ratingFilter !== "all") {
      const [min, max] = ratingFilter.split("-").map(Number);
      result = result.filter((r) => r.rating >= min && r.rating <= max);
    }

    // Sentiment filter
    if (sentimentFilter !== "all") {
      result = result.filter((r) => r.sentiment === sentimentFilter);
    }

    // Theme filter
    if (themeFilter !== "all") {
      result = result.filter((r) => {
        const reviewThemes = reviewThemesMap.get(r.id) || [];
        return reviewThemes.some((t) => t.themeId === themeFilter);
      });
    }

    return result;
  }, [reviews, searchQuery, sourceFilter, ratingFilter, sentimentFilter, themeFilter, reviewThemesMap]);

  // Pagination
  const totalPages = Math.ceil(filteredReviews.length / pageSize);
  const paginatedReviews = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredReviews.slice(start, start + pageSize);
  }, [filteredReviews, page, pageSize]);

  // Reset page when filters change
  const handleFilterChange = () => {
    setPage(1);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setSourceFilter("all");
    setRatingFilter("all");
    setSentimentFilter("all");
    setThemeFilter("all");
    setPage(1);
  };

  const hasActiveFilters =
    searchQuery ||
    sourceFilter !== "all" ||
    ratingFilter !== "all" ||
    sentimentFilter !== "all" ||
    themeFilter !== "all";

  // Export handlers
  const handleExportCSV = () => {
    exportToCSV(filteredReviews, "review_export");
    toast.success("Export downloaded", {
      description: `${filteredReviews.length} reviews exported to CSV`,
    });
  };

  // Table columns
  const columns: ColumnDef<Review>[] = [
    {
      accessorKey: "date",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-sm whitespace-nowrap">
          {new Date(row.getValue("date")).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      ),
    },
    {
      accessorKey: "source",
      header: "Source",
      cell: ({ row }) => {
        const source = getSourceById(row.getValue("source"));
        return (
          <div className="flex items-center gap-1.5">
            <span>{source.icon}</span>
            <span className="text-sm">{source.name}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "rating",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Rating
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const rating = row.getValue("rating") as number;
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
      },
    },
    {
      accessorKey: "sentiment",
      header: "Sentiment",
      cell: ({ row }) => {
        const sentiment = row.getValue("sentiment") as string;
        const score = row.original.sentimentScore;
        const colors = {
          positive: "bg-emerald-100 text-emerald-700",
          neutral: "bg-amber-100 text-amber-700",
          negative: "bg-rose-100 text-rose-700",
        };
        return (
          <div className="flex items-center gap-2">
            <Badge className={colors[sentiment as keyof typeof colors]}>
              {sentiment}
            </Badge>
            <span className="text-xs text-muted-foreground">{score.toFixed(1)}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "themes",
      header: "Themes",
      cell: ({ row }) => {
        const reviewThemes = reviewThemesMap.get(row.original.id) || [];
        if (reviewThemes.length === 0) {
          return <span className="text-muted-foreground text-sm">—</span>;
        }
        return (
          <div className="flex flex-wrap gap-1 max-w-[150px]">
            {reviewThemes.slice(0, 2).map((theme, idx) => (
              <Badge key={idx} variant="outline" className="text-xs font-normal">
                {theme.themeName.length > 12
                  ? theme.themeName.substring(0, 12) + "..."
                  : theme.themeName}
              </Badge>
            ))}
            {reviewThemes.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{reviewThemes.length - 2}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "content",
      header: "Review",
      cell: ({ row }) => (
        <div className="max-w-[300px]">
          <p className="font-medium text-sm truncate">{row.original.title}</p>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {row.original.content}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "author",
      header: "Author",
      cell: ({ row }) => (
        <span className="text-sm">{row.getValue("author")}</span>
      ),
    },
  ];

  const table = useReactTable({
    data: paginatedReviews,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
  });

  return (
    <div className="space-y-4">
      {/* Filters Row */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search reviews..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  handleFilterChange();
                }}
                className="pl-9"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
            </div>

            {/* Source Filter */}
            <Select
              value={sourceFilter}
              onValueChange={(v) => {
                setSourceFilter(v);
                handleFilterChange();
              }}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {reviewSources.map((source) => (
                  <SelectItem key={source.id} value={source.id}>
                    {source.icon} {source.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Rating Filter */}
            <Select
              value={ratingFilter}
              onValueChange={(v) => {
                setRatingFilter(v);
                handleFilterChange();
              }}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ratings</SelectItem>
                <SelectItem value="5-5">5 Stars</SelectItem>
                <SelectItem value="4-4">4 Stars</SelectItem>
                <SelectItem value="3-3">3 Stars</SelectItem>
                <SelectItem value="2-2">2 Stars</SelectItem>
                <SelectItem value="1-1">1 Star</SelectItem>
                <SelectItem value="4-5">4-5 Stars</SelectItem>
                <SelectItem value="1-2">1-2 Stars</SelectItem>
              </SelectContent>
            </Select>

            {/* Sentiment Filter */}
            <Select
              value={sentimentFilter}
              onValueChange={(v) => {
                setSentimentFilter(v);
                handleFilterChange();
              }}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Sentiment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sentiments</SelectItem>
                <SelectItem value="positive">Positive</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
                <SelectItem value="negative">Negative</SelectItem>
              </SelectContent>
            </Select>

            {/* Theme Filter */}
            <Select
              value={themeFilter}
              onValueChange={(v) => {
                setThemeFilter(v);
                handleFilterChange();
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Themes</SelectItem>
                {themes.map((theme) => (
                  <SelectItem key={theme.id} value={theme.id}>
                    {theme.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}

            {/* Export Buttons */}
            <div className="ml-auto flex items-center gap-2">
              <TooltipProvider>
                <Button variant="outline" size="sm" onClick={handleExportCSV}>
                  <Download className="h-4 w-4 mr-1.5" />
                  CSV
                </Button>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" disabled>
                      <FileSpreadsheet className="h-4 w-4 mr-1.5" />
                      XLS
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Coming soon</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" disabled>
                      <FileText className="h-4 w-4 mr-1.5" />
                      PDF
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Coming soon</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Info */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {paginatedReviews.length} of {filteredReviews.length} reviews
          {hasActiveFilters && ` (filtered from ${reviews.length} total)`}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center"
                >
                  <div className="flex flex-col items-center justify-center py-4">
                    <Search className="h-8 w-8 text-muted-foreground/50 mb-2" />
                    <p className="font-medium">No reviews found</p>
                    <p className="text-sm text-muted-foreground">
                      Try adjusting your search or filters.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page:</span>
          <Select
            value={pageSize.toString()}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages || 1}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
