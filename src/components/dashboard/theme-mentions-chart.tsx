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
  Legend,
} from "recharts";
import { ThemeSentimentSummary } from "@/lib/types";

interface ThemeMentionsChartProps {
  data: ThemeSentimentSummary[];
}

const COLORS = {
  positive: "#10b981",
  neutral: "#f59e0b",
  negative: "#ef4444",
};

export function ThemeMentionsChart({ data }: ThemeMentionsChartProps) {
  // Take top 5 themes
  const chartData = data.slice(0, 5).map((theme) => ({
    name: theme.themeName.length > 15 
      ? theme.themeName.substring(0, 15) + "..." 
      : theme.themeName,
    fullName: theme.themeName,
    positive: theme.positiveCount,
    neutral: theme.neutralCount,
    negative: theme.negativeCount,
    total: theme.mentionCount,
  }));

  return (
    <Card className="col-span-1">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center">
          Mentions by Theme
          <InfoTooltip content="Shows the top 5 most-mentioned themes, broken down by sentiment (positive, neutral, negative). Longer bars indicate more customer feedback on that topic." />
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke="#e5e5e5"
              />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#737373" }}
              />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#737373" }}
                width={100}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e5e5",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value, name) => [
                  value,
                  String(name).charAt(0).toUpperCase() + String(name).slice(1),
                ]}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0]) {
                    return payload[0].payload.fullName;
                  }
                  return label;
                }}
              />
              <Legend verticalAlign="top" height={36} />
              <Bar
                dataKey="positive"
                stackId="a"
                fill={COLORS.positive}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="neutral"
                stackId="a"
                fill={COLORS.neutral}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="negative"
                stackId="a"
                fill={COLORS.negative}
                radius={[4, 4, 4, 4]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function ThemeMentionsChartSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="h-5 w-36 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent>
        <div className="h-[280px] animate-pulse rounded bg-muted" />
      </CardContent>
    </Card>
  );
}
