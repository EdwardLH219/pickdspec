"use client";

import { Card, CardContent } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  format?: "number" | "percent" | "rating" | "sentiment";
  tooltip?: string;
}

export function KpiCard({
  title,
  value,
  subtitle,
  change,
  changeLabel,
  icon,
  trend,
  format = "number",
  tooltip,
}: KpiCardProps) {
  const getTrendIcon = () => {
    if (!trend || trend === "neutral") {
      return <Minus className="h-3 w-3" />;
    }
    return trend === "up" ? (
      <TrendingUp className="h-3 w-3" />
    ) : (
      <TrendingDown className="h-3 w-3" />
    );
  };

  const getTrendColor = () => {
    if (!trend || trend === "neutral") return "text-muted-foreground";
    // For negative rate, down is good
    if (format === "percent" && title.toLowerCase().includes("negative")) {
      return trend === "down" ? "text-emerald-600" : "text-rose-600";
    }
    return trend === "up" ? "text-emerald-600" : "text-rose-600";
  };

  const formatValue = () => {
    if (typeof value === "string") return value;
    switch (format) {
      case "percent":
        return `${value.toFixed(1)}%`;
      case "rating":
        return value.toFixed(2);
      case "sentiment":
        return value.toFixed(1);
      default:
        return value.toLocaleString();
    }
  };

  const formatChange = () => {
    if (change === undefined) return null;
    const prefix = change > 0 ? "+" : "";
    if (format === "percent" || format === "rating" || format === "sentiment") {
      return `${prefix}${change.toFixed(1)}`;
    }
    return `${prefix}${change.toFixed(0)}%`;
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground flex items-center">
              {title}
              {tooltip && <InfoTooltip content={tooltip} />}
            </p>
            <p className="text-3xl font-semibold tracking-tight">
              {formatValue()}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {icon && (
            <div className="rounded-lg bg-muted p-2.5 text-muted-foreground">
              {icon}
            </div>
          )}
        </div>

        {change !== undefined && (
          <div className="mt-4 flex items-center gap-1.5">
            <div
              className={cn(
                "flex items-center gap-0.5 text-xs font-medium",
                getTrendColor()
              )}
            >
              {getTrendIcon()}
              <span>{formatChange()}</span>
            </div>
            {changeLabel && (
              <span className="text-xs text-muted-foreground">
                {changeLabel}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function KpiCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-3">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-8 w-20 animate-pulse rounded bg-muted" />
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}
