# Pick'd Review Intelligence - Task Guide

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

**Default URL:** http://localhost:3000

---

## Pages & Routes

| Route | Page | Status |
|-------|------|--------|
| `/` | Landing redirect | Redirects to `/dashboard` |
| `/dashboard` | Dashboard | ✅ Complete |
| `/recommendations` | Recommendations | ✅ Complete |
| `/tasks` | Task Management | ✅ Complete |
| `/reports` | Reports (Review Explorer + Theme Breakdown) | ✅ Complete |
| `/reports/monthly` | Monthly Report Preview | ✅ Complete |
| `/account` | Account Settings (4 tabs) | ✅ Complete |

---

## What's Mocked

### Data Layer (`/src/lib/mock/`)
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

```
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
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/hooks/use-branch.tsx` | Global state for branch/date selection |
| `src/lib/mock/reviews.ts` | 120 deterministic reviews |
| `src/lib/data/dashboard.ts` | Metrics calculation logic |
| `src/lib/data/reports.ts` | Monthly report data aggregation |
| `src/lib/utils/export.ts` | CSV export utility |

---

## Development Notes

- All dates are anchored to `2026-01-27` for deterministic behavior
- Charts show warnings during SSR (safe to ignore)
- Mobile nav includes date range picker in sidebar drawer
- Print styles included on monthly report page
