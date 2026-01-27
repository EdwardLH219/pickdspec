"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { ReviewTrendPoint } from "@/lib/types";

export interface TaskCompletionMarker {
  id: string;
  title: string;
  themeName: string;
  completedAt: string; // ISO date
  dateLabel: string; // Formatted to match x-axis
}

interface SentimentTrendChartProps {
  data: ReviewTrendPoint[];
  taskMarkers?: TaskCompletionMarker[];
}

// Custom label component for task markers
function TaskMarkerLabel({ 
  viewBox, 
  marker 
}: { 
  viewBox?: { x?: number; y?: number }; 
  marker: TaskCompletionMarker;
}) {
  const x = viewBox?.x ?? 0;
  
  return (
    <g>
      {/* Triangle marker at top */}
      <polygon
        points={`${x - 6},8 ${x + 6},8 ${x},18`}
        fill="#8b5cf6"
        className="cursor-pointer"
      />
      {/* Small circle at bottom connecting to line */}
      <circle
        cx={x}
        cy={18}
        r={3}
        fill="#8b5cf6"
      />
    </g>
  );
}

export function SentimentTrendChart({ data, taskMarkers = [] }: SentimentTrendChartProps) {
  // Format date for display
  const formattedData = data.map((point) => ({
    ...point,
    dateLabel: new Date(point.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  }));

  // Get the set of date labels in the data for matching
  const dateLabels = new Set(formattedData.map(d => d.dateLabel));
  
  // Filter markers to only those within our data range
  const visibleMarkers = taskMarkers.filter(m => dateLabels.has(m.dateLabel));

  return (
    <Card className="col-span-1">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center">
          Sentiment Trend
          <InfoTooltip content="Tracks weekly sentiment score (0-10) and star rating (0-5) over time. Purple markers indicate when tasks linked to top themes were completed." />
        </CardTitle>
        {visibleMarkers.length > 0 && (
          <CardDescription className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-violet-500" />
              Task completed
            </span>
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={formattedData}
              margin={{ top: 20, right: 10, left: -10, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e5e5e5"
              />
              <XAxis
                dataKey="dateLabel"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#737373" }}
                dy={10}
              />
              <YAxis
                yAxisId="sentiment"
                domain={[0, 10]}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#737373" }}
                dx={-10}
              />
              <YAxis
                yAxisId="rating"
                orientation="right"
                domain={[0, 5]}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#737373" }}
                dx={10}
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
                  if (name === "avgSentiment") return [numValue.toFixed(1), "Sentiment"];
                  if (name === "avgRating") return [numValue.toFixed(2), "Rating"];
                  return [numValue, name];
                }}
              />
              <Legend
                verticalAlign="top"
                height={36}
                formatter={(value) => {
                  if (value === "avgSentiment") return "Sentiment (0-10)";
                  if (value === "avgRating") return "Rating (0-5)";
                  return value;
                }}
              />
              
              {/* Task Completion Markers */}
              {visibleMarkers.map((marker) => (
                <ReferenceLine
                  key={marker.id}
                  x={marker.dateLabel}
                  yAxisId="sentiment"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  label={<TaskMarkerLabel marker={marker} />}
                />
              ))}
              
              <Line
                yAxisId="sentiment"
                type="monotone"
                dataKey="avgSentiment"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: "#3b82f6", r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                yAxisId="rating"
                type="monotone"
                dataKey="avgRating"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: "#10b981", r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {/* Task Markers Legend */}
        {visibleMarkers.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Completed Tasks
            </p>
            <div className="flex flex-wrap gap-2">
              {visibleMarkers.map((marker) => (
                <div
                  key={marker.id}
                  className="inline-flex items-center gap-1.5 text-xs bg-violet-50 text-violet-700 px-2 py-1 rounded-md"
                  title={`${marker.title} (${marker.themeName})`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                  <span className="font-medium truncate max-w-[120px]">
                    {marker.title}
                  </span>
                  <span className="text-violet-500">·</span>
                  <span className="text-violet-600 truncate max-w-[80px]">
                    {marker.themeName}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SentimentTrendChartSkeleton() {
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
