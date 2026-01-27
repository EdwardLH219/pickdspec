# Pick'd Review Intelligence - Specification

## Business Requirements → Prototype Mapping

---

## 1. Dashboard

**Requirement:** Board-ready analytics overview with KPIs and trends.

### KPI Cards
| Metric | Data Field | Calculation |
|--------|-----------|-------------|
| Overall Sentiment | `avgSentimentScore` | Average of `review.sentimentScore` (0-10) |
| Average Rating | `averageRating` | Average of `review.rating` (1-5 stars) |
| Total Reviews | `totalReviews` | Count of reviews in period |
| Negative Review Rate | `negativeRate` | % where `sentiment === "negative"` |

All KPIs show **change vs previous period** (same duration).

### Charts
| Chart | Type | X-Axis | Y-Axis | Data |
|-------|------|--------|--------|------|
| Sentiment Trend | Line | Week | Score (0-10) | `reviewsTrend[]` |
| Theme Mentions | Stacked Bar | Week | Count | Top 5 themes by mentions |
| Source Sentiment | Bar | Source | Avg Sentiment | `sourceDistribution[]` |
| Theme Scatter | Scatter | Mentions | Sentiment | `themeSummaries[]` (bubble size = mentions) |

#### Sentiment Trend - Task Completion Markers
Vertical dashed lines overlaid on the Sentiment Trend chart showing when tasks (tied to top themes) were completed.

| Element | Description |
|---------|-------------|
| Marker Line | Purple dashed vertical line at completion date |
| Marker Icon | Triangle pointing down at top of chart |
| Legend Below | Chips showing task title + theme name |
| Filter | Only tasks linked to top 6 themes shown |

### Branch Comparison Heatmap (All Branches view only)
| Dimension | Content |
|-----------|---------|
| Rows | Branch names |
| Columns | Top 6 global themes |
| Cell Value | Negative mention rate (%) |
| Cell Color | Green (low) → Amber → Red (high) |
| Tooltip | Total mentions, Negative count, Avg sentiment |

Only displayed when "All Branches" is selected.

### Negative Reviews Table
| Column | Field |
|--------|-------|
| Date | `review.date` |
| Source | `review.source` |
| Rating | `review.rating` (star icons) |
| Themes | `reviewThemes[].themeId` (badges) |
| Excerpt | `review.content` (truncated) |

**Filters:** Branch selector, Date range (30d/90d/365d)

---

## 2. Recommendations

**Requirement:** AI-powered insights sorted by severity.

### Recommendation Card
| Field | Source | Display |
|-------|--------|---------|
| Title | `recommendation.title` | Heading |
| Severity | `mentions × (10 - sentiment)` | Badge (Critical/High/Medium/Low) |
| Linked Themes | `recommendation.themeId` | Chips |
| Impact | `recommendation.impact` | Text |
| Suggested Owner | Derived from category | Role badge |
| Evidence | Top 3 negative excerpts for theme | Expandable quotes |
| Suggested Actions | Generated from theme | Bullet list |

### Actions
- **Create Tasks:** Generates 2-5 tasks from recommendation
- **Status Filter:** Actionable / Completed / All

**Filters:** Branch selector, Date range, Status

---

## 3. Tasks

**Requirement:** Track action items with impact measurement.

### Task Table
| Column | Field | Interactive |
|--------|-------|-------------|
| Title | `task.title` | Click to select |
| Theme | `task.themeId` → `theme.name` | Badge |
| Status | `task.status` | Dropdown (Not Started/In Progress/Done/Cancelled) |
| Priority | `task.priority` | Badge color |
| Due Date | `task.dueDate` | Red if overdue |
| Assigned To | `task.assignee` | Text |
| Completed | `task.completedAt` | Date or "—" |

### Impact Tracking Panel
Shows for selected completed task:
- Theme sentiment trend (before/after completion)
- Line chart with completion date marker
- "Insufficient data" message if < 4 weeks post-completion

### Add Task Modal
| Field | Type | Required |
|-------|------|----------|
| Title | Text | Yes |
| Description | Textarea | No |
| Theme | Select | No |
| Recommendation | Select | No |
| Priority | Select (High/Medium/Low) | Yes |
| Due Date | Date | Yes |
| Assignee | Select | No |

**Filters:** Status, Theme, Assignee

---

## 4. Reports

### 4a. Review Explorer

**Requirement:** Power-user data exploration with export.

| Column | Field | Sortable |
|--------|-------|----------|
| Date | `review.date` | Yes |
| Source | `review.source` | No |
| Rating | `review.rating` | Yes |
| Sentiment | `review.sentiment` + `sentimentScore` | No |
| Themes | `reviewThemes[]` | No |
| Review | `title` + `content` (truncated) | No |
| Author | `review.author` | No |

### Filters
| Filter | Options |
|--------|---------|
| Search | Full-text on content/title/author |
| Source | All / Google / HelloPeter / Facebook / TripAdvisor |
| Rating | All / 5★ / 4★ / 3★ / 2★ / 1★ / 4-5★ / 1-2★ |
| Sentiment | All / Positive / Neutral / Negative |
| Theme | All / [Theme list] |

### Export
| Format | Status |
|--------|--------|
| CSV | ✅ Working (client-side download) |
| XLS | ❌ Disabled ("Coming soon") |
| PDF | ❌ Disabled ("Coming soon") |

---

### 4b. Theme Breakdown

**Requirement:** Deep-dive into individual themes.

| Section | Data |
|---------|------|
| Theme Selector | Dropdown of all themes |
| Stats | Mentions count, Avg sentiment, Trend direction |
| Trend Chart | Line chart of sentiment over time |
| Example Quotes | 5 review excerpts mentioning theme |

---

### 4c. Monthly Report Preview

**Requirement:** Print-ready executive summary.

| Section | Content |
|---------|---------|
| Header | Org name, Branch, Date range, Key metrics grid |
| TL;DR | 3-5 auto-generated bullet points |
| Theme Analysis | Table: Theme, Sentiment, Mentions, Trend, Summary |
| What People Love | Top 4 positive quotes with theme tags |
| What People Dislike | Top 4 negative quotes with theme tags |
| Watch-outs | Numbered list of issues |
| Practical Tips | Numbered list of recommendations |
| Signals | Review counts (30d/90d/365d) |
| Star Distribution | Progress bars for 1-5 stars |

**Actions:** Print button, Download PDF (disabled)

---

## 5. Account

### 5a. Organization Profile
| Field | Editable |
|-------|----------|
| Organization Name | Yes |
| Industry | No (read-only) |
| Organization ID | No (read-only) |
| Contact Email | No (read-only) |
| Contact Phone | No (read-only) |
| Timezone | Yes (dropdown) |
| Language | Yes (dropdown) |

### 5b. Branches
| Column | Field |
|--------|-------|
| Branch Name | `branch.name` |
| Address | `branch.address` |
| City | `branch.city` |
| Status | `branch.isActive` |

**Modal Fields:** Name, Address, City, Google Place ID, HelloPeter ID, Facebook ID, TripAdvisor ID

### 5c. Users
| Column | Field |
|--------|-------|
| User | Avatar + `user.name` + `user.email` |
| Role | Dropdown (Admin/Manager/Viewer) |
| Branch Access | Badges or "All Branches" |
| Status | Active/Pending |

**Invite Modal:** Name, Email, Role, Branch access (multi-select)

### 5d. Subscription
| Section | Content |
|---------|---------|
| Current Plan | Name, price, billing date |
| Usage Meters | Seats, Branches, Reviews/month (progress bars) |
| Features | Checklist of included features |
| Plan Comparison | 3-column grid (Starter/Professional/Enterprise) |
| Billing History | Placeholder link |

---

## Data Model Summary

```
Organization (1)
  └── Branch (n)
        └── Review (n)
              └── ReviewTheme (n) → Theme
        └── Recommendation (n) → Theme
              └── Task (n)
  └── User (n)
```

### Key Relationships
- Reviews belong to a Branch and Source
- Themes can be global (null branchId) or branch-specific
- ReviewThemes link reviews to themes with per-mention sentiment
- Recommendations link to one theme
- Tasks can link to a recommendation and/or theme
- Users can have access to all branches or specific ones

---

## Filter Inheritance

Global filters in header apply to:
- Dashboard (all charts and KPIs)
- Recommendations (list filtering)
- Tasks (list filtering)
- Reports (Review Explorer, Theme Breakdown)
- Monthly Report (data aggregation)

Account section is **not filtered** by branch/date.
