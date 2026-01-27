"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { FileText, BookOpen } from "lucide-react";

// SPEC.md content
const SPEC_CONTENT = `# Pick'd Review Intelligence - Specification

## Business Requirements → Prototype Mapping

---

## 1. Dashboard

**Requirement:** Board-ready analytics overview with KPIs and trends.

### KPI Cards
| Metric | Data Field | Calculation |
|--------|-----------|-------------|
| Overall Sentiment | \`avgSentimentScore\` | Average of \`review.sentimentScore\` (0-10) |
| Average Rating | \`averageRating\` | Average of \`review.rating\` (1-5 stars) |
| Total Reviews | \`totalReviews\` | Count of reviews in period |
| Negative Review Rate | \`negativeRate\` | % where \`sentiment === "negative"\` |

All KPIs show **change vs previous period** (same duration).

### Charts
| Chart | Type | X-Axis | Y-Axis | Data |
|-------|------|--------|--------|------|
| Sentiment Trend | Line | Week | Score (0-10) | \`reviewsTrend[]\` |
| Theme Mentions | Stacked Bar | Week | Count | Top 5 themes by mentions |
| Source Sentiment | Bar | Source | Avg Sentiment | \`sourceDistribution[]\` |
| Theme Scatter | Scatter | Mentions | Sentiment | \`themeSummaries[]\` (bubble size = mentions) |

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
| Date | \`review.date\` |
| Source | \`review.source\` |
| Rating | \`review.rating\` (star icons) |
| Themes | \`reviewThemes[].themeId\` (badges) |
| Excerpt | \`review.content\` (truncated) |

**Filters:** Branch selector, Date range (30d/90d/365d)

---

## 2. Recommendations

**Requirement:** AI-powered insights sorted by severity.

### Recommendation Card
| Field | Source | Display |
|-------|--------|---------|
| Title | \`recommendation.title\` | Heading |
| Severity | \`mentions × (10 - sentiment)\` | Badge (Critical/High/Medium/Low) |
| Linked Themes | \`recommendation.themeId\` | Chips |
| Impact | \`recommendation.impact\` | Text |
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
| Title | \`task.title\` | Click to select |
| Theme | \`task.themeId\` → \`theme.name\` | Badge |
| Status | \`task.status\` | Dropdown (Not Started/In Progress/Done/Cancelled) |
| Priority | \`task.priority\` | Badge color |
| Due Date | \`task.dueDate\` | Red if overdue |
| Assigned To | \`task.assignee\` | Text |
| Completed | \`task.completedAt\` | Date or "—" |

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
| Date | \`review.date\` | Yes |
| Source | \`review.source\` | No |
| Rating | \`review.rating\` | Yes |
| Sentiment | \`review.sentiment\` + \`sentimentScore\` | No |
| Themes | \`reviewThemes[]\` | No |
| Review | \`title\` + \`content\` (truncated) | No |
| Author | \`review.author\` | No |

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
| Branch Name | \`branch.name\` |
| Address | \`branch.address\` |
| City | \`branch.city\` |
| Status | \`branch.isActive\` |

**Modal Fields:** Name, Address, City, Google Place ID, HelloPeter ID, Facebook ID, TripAdvisor ID

### 5c. Users
| Column | Field |
|--------|-------|
| User | Avatar + \`user.name\` + \`user.email\` |
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

\`\`\`
Organization (1)
  └── Branch (n)
        └── Review (n)
              └── ReviewTheme (n) → Theme
        └── Recommendation (n) → Theme
              └── Task (n)
  └── User (n)
\`\`\`

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

Account section is **not filtered** by branch/date.`;

// TASK.md content
const TASK_CONTENT = `# Pick'd Review Intelligence - Task Guide

## Quick Start

\`\`\`bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
\`\`\`

**Default URL:** http://localhost:3000

---

## Pages & Routes

| Route | Page | Status |
|-------|------|--------|
| \`/\` | Landing redirect | Redirects to \`/dashboard\` |
| \`/dashboard\` | Dashboard | ✅ Complete |
| \`/recommendations\` | Recommendations | ✅ Complete |
| \`/tasks\` | Task Management | ✅ Complete |
| \`/reports\` | Reports (Review Explorer + Theme Breakdown) | ✅ Complete |
| \`/reports/monthly\` | Monthly Report Preview | ✅ Complete |
| \`/account\` | Account Settings (4 tabs) | ✅ Complete |

---

## What's Mocked

### Data Layer (\`/src/lib/mock/\`)
- **Organizations** - 1 org (Coastal Eats Restaurant Group)
- **Branches** - 2 branches (V&A Waterfront, Stellenbosch)
- **Reviews** - 120 deterministic reviews across 6 months
- **Sources** - Google, HelloPeter, Facebook, TripAdvisor
- **Themes** - 12 themes (8 global + 4 branch-specific)
- **Review-Theme mappings** - ~200 theme mentions
- **Recommendations** - 8 AI-generated recommendations
- **Tasks** - 12 tasks linked to recommendations
- **Users** - 6 mock users with roles

### Simulated Behaviors
- Branch/date filtering updates all charts and metrics
- Task status changes persist in local state
- "Add Task" creates tasks in local state
- "Create Tasks from Recommendation" generates tasks and navigates
- CSV export downloads real file with filtered data
- Account CRUD operations update local state
- Toast notifications on all actions

---

## What's NOT Implemented

| Feature | Status | Notes |
|---------|--------|-------|
| Authentication | ❌ | No login/logout, no session |
| Real API calls | ❌ | All data is mock, no backend |
| Database | ❌ | No persistence, state resets on refresh |
| Review scraping | ❌ | No actual review imports |
| AI/ML analysis | ❌ | Themes/sentiment are pre-computed mock |
| PDF export | ❌ | Button disabled, "Phase 2" tooltip |
| XLS export | ❌ | Button disabled, "Coming soon" tooltip |
| Email reports | ❌ | Not implemented |
| Real billing | ❌ | Subscription tab is UI-only |
| User invitations | ❌ | Modal works, no email sent |
| Custom date range picker | ❌ | Only presets (30d/90d/365d) |

---

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Components:** shadcn/ui (Radix primitives)
- **Charts:** Recharts
- **Tables:** TanStack Table v8
- **Toasts:** Sonner
- **Icons:** Lucide React

---

## Project Structure

\`\`\`
src/
├── app/
│   ├── (app)/              # Authenticated routes with shell
│   │   ├── layout.tsx      # Sidebar + Header + Toaster
│   │   ├── dashboard/
│   │   ├── recommendations/
│   │   ├── tasks/
│   │   ├── reports/
│   │   │   └── monthly/    # Monthly report preview
│   │   └── account/
│   └── layout.tsx          # Root layout
├── components/
│   ├── ui/                 # shadcn components
│   ├── layout/             # Sidebar, Header, etc.
│   ├── dashboard/          # KPI cards, charts
│   ├── recommendations/    # Recommendation cards
│   ├── tasks/              # Task table, modals
│   ├── reports/            # Review explorer, theme breakdown
│   └── account/            # Profile, branches, users tabs
├── hooks/
│   └── use-branch.tsx      # Branch & date range context
├── lib/
│   ├── mock/               # All mock data
│   ├── data/               # Data access functions
│   ├── types/              # TypeScript interfaces
│   └── utils/              # Helpers (export, cn)
\`\`\`

---

## Key Files

| File | Purpose |
|------|---------|
| \`src/hooks/use-branch.tsx\` | Global state for branch/date selection |
| \`src/lib/mock/reviews.ts\` | 120 deterministic reviews |
| \`src/lib/data/dashboard.ts\` | Metrics calculation logic |
| \`src/lib/data/reports.ts\` | Monthly report data aggregation |
| \`src/lib/utils/export.ts\` | CSV export utility |

---

## Development Notes

- All dates are anchored to \`2026-01-27\` for deterministic behavior
- Charts show warnings during SSR (safe to ignore)
- Mobile nav includes date range picker in sidebar drawer
- Print styles included on monthly report page`;

// Simple markdown renderer
function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let inTable = false;
  let tableRows: string[][] = [];

  const processInlineCode = (text: string) => {
    const parts = text.split(/(`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={i} className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
            {part.slice(1, -1)}
          </code>
        );
      }
      // Handle bold
      const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
      return boldParts.map((bp, j) => {
        if (bp.startsWith("**") && bp.endsWith("**")) {
          return <strong key={`${i}-${j}`}>{bp.slice(2, -2)}</strong>;
        }
        return bp;
      });
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre key={i} className="bg-muted p-4 rounded-lg overflow-x-auto text-sm font-mono my-3">
            {codeBlockContent.join("\n")}
          </pre>
        );
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Tables
    if (line.startsWith("|")) {
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      const cells = line.split("|").filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
      // Skip separator rows
      if (!cells[0]?.trim().match(/^[-:]+$/)) {
        tableRows.push(cells.map(c => c.trim()));
      }
      continue;
    } else if (inTable) {
      // End of table
      elements.push(
        <div key={i} className="overflow-x-auto my-3">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-muted/50">
                {tableRows[0]?.map((cell, j) => (
                  <th key={j} className="text-left p-2 font-medium">
                    {processInlineCode(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.slice(1).map((row, ri) => (
                <tr key={ri} className="border-b">
                  {row.map((cell, ci) => (
                    <td key={ci} className="p-2">
                      {processInlineCode(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
    }

    // Headers
    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="text-2xl font-bold mt-6 mb-4">
          {line.slice(2)}
        </h1>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-xl font-semibold mt-6 mb-3 pb-2 border-b">
          {line.slice(3)}
        </h2>
      );
      continue;
    }
    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-lg font-semibold mt-4 mb-2">
          {line.slice(4)}
        </h3>
      );
      continue;
    }
    if (line.startsWith("#### ")) {
      elements.push(
        <h4 key={i} className="text-base font-medium mt-3 mb-2">
          {line.slice(5)}
        </h4>
      );
      continue;
    }

    // Horizontal rule
    if (line === "---") {
      elements.push(<hr key={i} className="my-6 border-t" />);
      continue;
    }

    // List items
    if (line.startsWith("- ")) {
      elements.push(
        <li key={i} className="ml-4 mb-1 list-disc list-inside">
          {processInlineCode(line.slice(2))}
        </li>
      );
      continue;
    }

    // Empty lines
    if (line.trim() === "") {
      continue;
    }

    // Regular paragraphs
    elements.push(
      <p key={i} className="mb-2">
        {processInlineCode(line)}
      </p>
    );
  }

  // Handle remaining table
  if (inTable && tableRows.length > 0) {
    elements.push(
      <div key="final-table" className="overflow-x-auto my-3">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b bg-muted/50">
              {tableRows[0]?.map((cell, j) => (
                <th key={j} className="text-left p-2 font-medium">
                  {processInlineCode(cell)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.slice(1).map((row, ri) => (
              <tr key={ri} className="border-b">
                {row.map((cell, ci) => (
                  <td key={ci} className="p-2">
                    {processInlineCode(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return <>{elements}</>;
}

interface DocModalProps {
  type: "spec" | "task";
  trigger: React.ReactNode;
}

export function DocModal({ type, trigger }: DocModalProps) {
  const [open, setOpen] = useState(false);
  const content = type === "spec" ? SPEC_CONTENT : TASK_CONTENT;
  const title = type === "spec" ? "Specification" : "Task Guide";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {type === "spec" ? (
              <BookOpen className="h-5 w-5" />
            ) : (
              <FileText className="h-5 w-5" />
            )}
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 px-6 py-4" style={{ maxHeight: "calc(85vh - 73px)" }}>
          <div className="prose prose-sm max-w-none pb-4">
            <MarkdownContent content={content} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DocLinks() {
  return (
    <div className="flex items-center gap-3 text-xs">
      <DocModal
        type="spec"
        trigger={
          <Button variant="link" size="sm" className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground">
            <BookOpen className="h-3 w-3 mr-1" />
            Spec
          </Button>
        }
      />
      <span className="text-muted-foreground">·</span>
      <DocModal
        type="task"
        trigger={
          <Button variant="link" size="sm" className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground">
            <FileText className="h-3 w-3 mr-1" />
            Task Guide
          </Button>
        }
      />
    </div>
  );
}
