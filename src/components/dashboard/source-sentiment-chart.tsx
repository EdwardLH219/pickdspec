"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { SourceDistribution } from "@/lib/types";

interface SourceSentimentChartProps {
  data: SourceDistribution[];
}

const SOURCE_COLORS: Record<string, string> = {
  google: "#4285F4",
  hellopeter: "#00A86B",
  facebook: "#1877F2",
  tripadvisor: "#00AF87",
};

export function SourceSentimentChart({ data }: SourceSentimentChartProps) {
  const chartData = data
    .filter((d) => d.count > 0)
    .map((source) => ({
      name: source.sourceName,
      source: source.source,
      rating: source.avgRating,
      reviews: source.count,
    }));

  return (
    <Card className="col-span-1">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center">
          Rating by Source
          <InfoTooltip content="Compares average star rating (0-5) across review platforms. Helps identify which sources have more satisfied or dissatisfied customers." />
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e5e5e5"
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#737373" }}
                dy={10}
              />
              <YAxis
                domain={[0, 5]}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#737373" }}
                dx={-10}
                ticks={[0, 1, 2, 3, 4, 5]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e5e5",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value, name) => {
                  const numValue = Number(value);
                  if (name === "rating") return [numValue.toFixed(2), "Avg Rating"];
                  return [numValue, String(name)];
                }}
                labelFormatter={(label) => label}
              />
              <Bar dataKey="rating" radius={[4, 4, 0, 0]} maxBarSize={60}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={SOURCE_COLORS[entry.source] || "#737373"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Source legend with review counts */}
        <div className="mt-2 flex flex-wrap justify-center gap-4">
          {chartData.map((source) => (
            <div key={source.source} className="flex items-center gap-1.5">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: SOURCE_COLORS[source.source] }}
              />
              <span className="text-xs text-muted-foreground">
                {source.reviews} reviews
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function SourceSentimentChartSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent>
        <div className="h-[280px] animate-pulse rounded bg-muted" />
      </CardContent>
    </Card>
  );
}
