'use client';

/**
 * Dashboard Charts
 * 
 * Rich visualizations for the restaurant owner dashboard using Recharts.
 */

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Color palette
const COLORS = {
  primary: '#2563eb',
  positive: '#22c55e',
  neutral: '#eab308',
  negative: '#ef4444',
  muted: '#94a3b8',
  accent: '#8b5cf6',
  teal: '#14b8a6',
  orange: '#f97316',
  pink: '#ec4899',
};

const PIE_COLORS = [COLORS.positive, COLORS.neutral, COLORS.negative];
const THEME_COLORS = [COLORS.primary, COLORS.teal, COLORS.accent, COLORS.orange, COLORS.pink];

// ============================================================
// SENTIMENT TREND CHART
// ============================================================

interface TrendDataPoint {
  week: string;
  weekLabel: string;
  reviews: number;
  sentimentScore: number;
  avgRating: number | null;
  positive: number;
  negative: number;
}

interface CompletedTask {
  id: string;
  title: string;
  completedAt: string;
  themeName?: string;
}

interface SentimentTrendChartProps {
  data: TrendDataPoint[];
  completedTasks?: CompletedTask[];
}

export function SentimentTrendChart({ data, completedTasks = [] }: SentimentTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sentiment Trend</CardTitle>
          <CardDescription>No trend data available yet</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Find which week label a date falls into
  const findWeekForDate = (dateStr: string): string | null => {
    const taskDate = new Date(dateStr);
    // Extract just the date parts to avoid timezone issues
    const taskYear = taskDate.getFullYear();
    const taskMonth = taskDate.getMonth();
    const taskDay = taskDate.getDate();
    
    // Find the week that contains this date
    for (const weekData of data) {
      // weekData.week is the Monday (YYYY-MM-DD format from API)
      const weekStart = new Date(weekData.week);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6); // Sunday
      
      // Compare using date parts only (ignore time)
      const startYear = weekStart.getUTCFullYear();
      const startMonth = weekStart.getUTCMonth();
      const startDay = weekStart.getUTCDate();
      
      const endYear = weekEnd.getUTCFullYear();
      const endMonth = weekEnd.getUTCMonth();
      const endDay = weekEnd.getUTCDate();
      
      // Create comparable date values (YYYYMMDD as numbers)
      const taskValue = taskYear * 10000 + taskMonth * 100 + taskDay;
      const startValue = startYear * 10000 + startMonth * 100 + startDay;
      const endValue = endYear * 10000 + endMonth * 100 + endDay;
      
      if (taskValue >= startValue && taskValue <= endValue) {
        return weekData.weekLabel;
      }
    }
    return null;
  };

  // Get tasks that fall within the chart's date range with their matching week
  const tasksWithWeeks = completedTasks
    .filter(task => task.completedAt)
    .map(task => ({
      ...task,
      matchedWeek: findWeekForDate(task.completedAt),
    }))
    .filter(task => task.matchedWeek !== null);
  
  const tasksInRange = tasksWithWeeks;

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-primary" />
          Sentiment Trend
        </CardTitle>
        <CardDescription className="flex items-center justify-between">
          <span>Weekly sentiment score over time (0-10 scale)</span>
          {tasksInRange.length > 0 && (
            <span className="flex items-center gap-1 text-xs">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              {tasksInRange.length} task{tasksInRange.length !== 1 ? 's' : ''} completed
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="weekLabel" 
                tick={{ fontSize: 12 }}
                stroke="#64748b"
              />
              <YAxis 
                domain={[0, 10]} 
                tick={{ fontSize: 12 }}
                stroke="#64748b"
                tickFormatter={(value) => value.toFixed(0)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
                formatter={(value, name) => {
                  const numValue = typeof value === 'number' ? value : 0;
                  if (name === 'sentimentScore') return [numValue.toFixed(1), 'Sentiment Score'];
                  if (name === 'avgRating') return [numValue.toFixed(1), 'Avg Rating'];
                  return [numValue, name];
                }}
                labelFormatter={(label) => {
                  const weekTasks = tasksInRange.filter(t => t.matchedWeek === label);
                  if (weekTasks.length > 0) {
                    return `Week of ${label}\n✓ ${weekTasks.map(t => t.title).join(', ')}`;
                  }
                  return `Week of ${label}`;
                }}
              />
              <Legend />
              <ReferenceLine y={5} stroke="#94a3b8" strokeDasharray="5 5" label={{ value: 'Neutral', position: 'right', fill: '#94a3b8', fontSize: 10 }} />
              
              {/* Task completion markers */}
              {tasksInRange.map((task) => (
                <ReferenceLine
                  key={task.id}
                  x={task.matchedWeek!}
                  stroke="#22c55e"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  label={{
                    value: '✓',
                    position: 'top',
                    fill: '#22c55e',
                    fontSize: 14,
                    fontWeight: 'bold',
                  }}
                />
              ))}
              
              <Line
                type="monotone"
                dataKey="sentimentScore"
                stroke={COLORS.primary}
                strokeWidth={3}
                dot={{ r: 4, fill: COLORS.primary }}
                activeDot={{ r: 6, stroke: COLORS.primary, strokeWidth: 2, fill: 'white' }}
                name="Sentiment Score"
              />
              {data.some(d => d.avgRating !== null) && (
                <Line
                  type="monotone"
                  dataKey="avgRating"
                  stroke={COLORS.orange}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3, fill: COLORS.orange }}
                  name="Avg Rating (×2)"
                  // Scale rating (1-5) to match sentiment (0-10)
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// REVIEW VOLUME CHART
// ============================================================

interface VolumeDataPoint {
  date: string;
  dateLabel: string;
  reviews: number;
}

interface ReviewVolumeChartProps {
  data: VolumeDataPoint[];
}

export function ReviewVolumeChart({ data }: ReviewVolumeChartProps) {
  if (!data || data.length === 0) {
    return null;
  }

  const maxReviews = Math.max(...data.map(d => d.reviews), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review Activity</CardTitle>
        <CardDescription>Daily review volume (last 30 days)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis 
                dataKey="dateLabel" 
                tick={{ fontSize: 10 }}
                stroke="#64748b"
                interval={6}
              />
              <YAxis 
                tick={{ fontSize: 10 }}
                stroke="#64748b"
                domain={[0, Math.ceil(maxReviews * 1.2)]}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
                formatter={(value) => [value ?? 0, 'Reviews']}
              />
              <Area
                type="monotone"
                dataKey="reviews"
                stroke={COLORS.primary}
                strokeWidth={2}
                fill="url(#volumeGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// SENTIMENT DISTRIBUTION PIE CHART
// ============================================================

interface SentimentDistributionProps {
  positive: number;
  neutral: number;
  negative: number;
}

export function SentimentPieChart({ positive, neutral, negative }: SentimentDistributionProps) {
  const total = positive + neutral + negative;
  if (total === 0) return null;

  const data = [
    { name: 'Positive', value: positive, color: COLORS.positive },
    { name: 'Neutral', value: neutral, color: COLORS.neutral },
    { name: 'Negative', value: negative, color: COLORS.negative },
  ].filter(d => d.value > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sentiment Split</CardTitle>
        <CardDescription>Distribution of review sentiments</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[250px] flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
                formatter={(value) => [`${value ?? 0} reviews`, '']}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-6 mt-2">
          {data.map(item => (
            <div key={item.name} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-sm text-muted-foreground">{item.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// RATING DISTRIBUTION BAR CHART
// ============================================================

interface RatingDataPoint {
  rating: number;
  count: number;
  label: string;
}

interface RatingDistributionChartProps {
  data: RatingDataPoint[];
}

export function RatingDistributionChart({ data }: RatingDistributionChartProps) {
  if (!data || data.length === 0) return null;

  const getBarColor = (rating: number) => {
    if (rating >= 4) return COLORS.positive;
    if (rating === 3) return COLORS.neutral;
    return COLORS.negative;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rating Distribution</CardTitle>
        <CardDescription>Star rating breakdown</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} stroke="#64748b" />
              <YAxis 
                type="category" 
                dataKey="label" 
                tick={{ fontSize: 12 }}
                stroke="#64748b"
                width={60}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
                formatter={(value) => [`${value ?? 0} reviews`, '']}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.rating)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// THEME RADAR CHART
// ============================================================

interface ThemeScore {
  themeName: string;
  score010: number;
  radarScore: number;
  mentions: number;
}

interface ThemeRadarChartProps {
  data: ThemeScore[];
}

export function ThemeRadarChart({ data }: ThemeRadarChartProps) {
  if (!data || data.length < 3) return null;

  // Take top 8 themes by mentions for radar
  const radarData = data
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 8)
    .map(t => ({
      theme: t.themeName.length > 12 ? t.themeName.slice(0, 12) + '...' : t.themeName,
      fullName: t.themeName,
      score: t.radarScore,
      score010: t.score010,
    }));

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Theme Performance Radar</CardTitle>
        <CardDescription>Score comparison across key themes (0-100 scale)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis 
                dataKey="theme" 
                tick={{ fontSize: 11, fill: '#64748b' }}
              />
              <PolarRadiusAxis 
                angle={30} 
                domain={[0, 100]} 
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickCount={5}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
                formatter={(value, name, props) => {
                  const payload = props?.payload as { fullName?: string; score010?: number } | undefined;
                  return [`Score: ${payload?.score010?.toFixed(1) ?? '0'}/10`, payload?.fullName ?? ''];
                }}
              />
              <Radar
                name="Score"
                dataKey="score"
                stroke={COLORS.primary}
                fill={COLORS.primary}
                fillOpacity={0.3}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// TOP ISSUES BAR CHART
// ============================================================

interface IssueData {
  themeName: string;
  severity: number;
  score010: number;
  mentions: number;
}

interface TopIssuesChartProps {
  data: IssueData[];
}

export function TopIssuesChart({ data }: TopIssuesChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
            No Critical Issues
          </CardTitle>
          <CardDescription>All themes are performing well!</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const chartData = data.map(d => ({
    name: d.themeName.length > 15 ? d.themeName.slice(0, 15) + '...' : d.themeName,
    fullName: d.themeName,
    severity: Math.round(d.severity * 100) / 100,
    score: d.score010,
    mentions: d.mentions,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-600">
          <span className="inline-block w-3 h-3 rounded-full bg-red-500" />
          Priority Issues
        </CardTitle>
        <CardDescription>Areas needing attention (by severity)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} stroke="#64748b" />
              <YAxis 
                type="category" 
                dataKey="name" 
                tick={{ fontSize: 11 }}
                stroke="#64748b"
                width={100}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '12px',
                }}
                wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }}
                cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload[0]) return null;
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white border border-gray-200 rounded-lg p-2 shadow-lg text-xs">
                      <div className="font-medium text-gray-900">{data.fullName}</div>
                      <div className="text-red-600 mt-1">
                        Score: {data.score.toFixed(1)}/10
                      </div>
                      <div className="text-gray-500">
                        {data.mentions} mentions
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="severity" fill={COLORS.negative} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// HEALTH SCORE GAUGE
// ============================================================

interface HealthGaugeProps {
  score: number; // 0-100
  label?: string;
}

export function HealthGauge({ score, label = 'Health Score' }: HealthGaugeProps) {
  const getColor = (s: number) => {
    if (s >= 70) return COLORS.positive;
    if (s >= 40) return COLORS.neutral;
    return COLORS.negative;
  };

  const getLabel = (s: number) => {
    if (s >= 70) return 'Excellent';
    if (s >= 50) return 'Good';
    if (s >= 30) return 'Fair';
    return 'Needs Work';
  };

  const color = getColor(score);
  const statusLabel = getLabel(score);
  
  // SVG circular progress
  const size = 100;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="pb-4 px-4">
        <div className="flex items-center gap-4">
          {/* Circular Progress Ring */}
          <div className="relative flex-shrink-0">
            <svg width={size} height={size} className="transform -rotate-90">
              {/* Background circle */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth={strokeWidth}
              />
              {/* Progress circle */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className="transition-all duration-500 ease-out"
              />
            </svg>
            {/* Score in center */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold" style={{ color }}>{score}</span>
            </div>
          </div>
          
          {/* Status label */}
          <div className="flex flex-col">
            <span className="text-lg font-semibold">{statusLabel}</span>
            <span className="text-xs text-muted-foreground">out of 100</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// SOURCE DISTRIBUTION DONUT
// ============================================================

interface SourceData {
  source: string;
  sourceName: string;
  count: number;
}

interface SourceDistributionChartProps {
  data: SourceData[];
}

export function SourceDistributionChart({ data }: SourceDistributionChartProps) {
  if (!data || data.length === 0) return null;

  const total = data.reduce((sum, d) => sum + d.count, 0);
  const chartData = data.map((d, i) => ({
    name: d.sourceName,
    value: d.count,
    percentage: Math.round((d.count / total) * 100),
    color: THEME_COLORS[i % THEME_COLORS.length],
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review Sources</CardTitle>
        <CardDescription>Where your reviews come from</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
                formatter={(value, name, props) => {
                  const payload = props?.payload as { percentage?: number } | undefined;
                  return [
                    `${value ?? 0} reviews (${payload?.percentage ?? 0}%)`,
                    ''
                  ];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap justify-center gap-4 mt-2">
          {chartData.map(item => (
            <div key={item.name} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-muted-foreground">{item.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// WEEKLY COMPARISON CHART
// ============================================================

interface WeeklyComparisonProps {
  data: TrendDataPoint[];
}

export function WeeklyComparisonChart({ data }: WeeklyComparisonProps) {
  if (!data || data.length < 2) return null;

  const chartData = data.map(d => ({
    week: d.weekLabel,
    positive: d.positive,
    negative: d.negative,
    total: d.reviews,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Review Mix</CardTitle>
        <CardDescription>Positive vs negative reviews by week</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="#64748b" />
              <YAxis tick={{ fontSize: 11 }} stroke="#64748b" allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Bar dataKey="positive" stackId="a" fill={COLORS.positive} name="Positive" radius={[0, 0, 0, 0]} />
              <Bar dataKey="negative" stackId="a" fill={COLORS.negative} name="Negative" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
