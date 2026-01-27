"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
  Cell,
} from "recharts";
import { ThemeSentimentSummary } from "@/lib/types";

interface ThemeScatterChartProps {
  data: ThemeSentimentSummary[];
}

const CATEGORY_COLORS: Record<string, string> = {
  service: "#3b82f6",
  product: "#10b981",
  ambiance: "#8b5cf6",
  value: "#f59e0b",
  cleanliness: "#06b6d4",
  other: "#737373",
};

export function ThemeScatterChart({ data }: ThemeScatterChartProps) {
  const chartData = data.map((theme) => ({
    name: theme.themeName,
    mentions: theme.mentionCount,
    sentiment: theme.avgSentimentScore,
    category: theme.category,
    z: Math.max(theme.mentionCount * 10, 100), // Bubble size
  }));

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: typeof chartData[0] }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border bg-white p-3 shadow-md">
          <p className="font-medium">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            Sentiment: <span className="font-medium">{data.sentiment.toFixed(1)}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Mentions: <span className="font-medium">{data.mentions}</span>
          </p>
          <p className="text-sm text-muted-foreground capitalize">
            Category: <span className="font-medium">{data.category}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="col-span-1">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center">
          Theme Analysis
          <InfoTooltip content="Plots themes by mention count (x-axis) vs sentiment score (y-axis). Bubble size reflects volume. Themes in lower-right need attention (many mentions, low sentiment)." />
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart
              margin={{ top: 10, right: 10, left: -10, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis
                type="number"
                dataKey="mentions"
                name="Mentions"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#737373" }}
                label={{
                  value: "Mentions",
                  position: "insideBottom",
                  offset: -10,
                  fontSize: 11,
                  fill: "#737373",
                }}
              />
              <YAxis
                type="number"
                dataKey="sentiment"
                name="Sentiment"
                domain={[0, 10]}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#737373" }}
                dx={-10}
                label={{
                  value: "Sentiment",
                  angle: -90,
                  position: "insideLeft",
                  offset: 20,
                  fontSize: 11,
                  fill: "#737373",
                }}
              />
              <ZAxis type="number" dataKey="z" range={[100, 500]} />
              <Tooltip content={<CustomTooltip />} />
              <Scatter data={chartData}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={CATEGORY_COLORS[entry.category] || "#737373"}
                    fillOpacity={0.7}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        {/* Category legend */}
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          {Object.entries(CATEGORY_COLORS)
            .filter(([cat]) => chartData.some((d) => d.category === cat))
            .map(([category, color]) => (
              <div key={category} className="flex items-center gap-1.5">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs capitalize text-muted-foreground">
                  {category}
                </span>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ThemeScatterChartSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="h-5 w-28 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent>
        <div className="h-[280px] animate-pulse rounded bg-muted" />
      </CardContent>
    </Card>
  );
}
