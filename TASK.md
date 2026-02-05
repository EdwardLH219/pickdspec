# Pick'd Review Intelligence V1 - Development Guide

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your database credentials

# Start PostgreSQL and Redis (via Docker)
docker compose up -d

# Push database schema
npm run db:push

# Run development server
npm run dev
```

**Default URL:** http://localhost:3000

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Next.js development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Create and run migrations |
| `npm run db:migrate:prod` | Run migrations in production |
| `npm run db:seed` | Seed the database |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:reset` | Reset database |

---

## Pages & Routes

| Route | Page | Status |
|-------|------|--------|
| `/` | Landing Page | ✅ Complete |
| `/login` | Login | ✅ UI Complete (mock auth) |
| `/register` | Register | ✅ UI Complete (mock auth) |
| `/dashboard` | Dashboard | ✅ UI Complete |
| `/recommendations` | Recommendations | ✅ UI Complete |
| `/tasks` | Task Management | ✅ UI Complete |
| `/reports` | Reports (Review Explorer + Theme Breakdown) | ✅ UI Complete |
| `/reports/monthly` | Monthly Report Preview | ✅ UI Complete |
| `/account` | Account Settings (4 tabs) | ✅ UI Complete |

---

## V1 Implementation Status

### Core Infrastructure
| Feature | Status | Notes |
|---------|--------|-------|
| Prisma Schema | ✅ Complete | All V1 data models defined |
| Environment Validation | ✅ Complete | Zod validation in `/src/lib/env.ts` |
| Logging | ✅ Complete | Pino logger in `/src/lib/logger.ts` |
| Error Boundary | ✅ Complete | React error boundary component |
| Server Auth Helpers | ✅ Complete | RBAC utilities in `/src/server/auth` |

### Authentication (TODO)
| Feature | Status | Notes |
|---------|--------|-------|
| NextAuth.js Setup | ❌ Pending | Will replace mock auth |
| Google OAuth | ❌ Pending | Via NextAuth Google provider |
| Email/Password | ❌ Pending | Via NextAuth Credentials |
| Session Management | ❌ Pending | NextAuth sessions |
| RBAC Middleware | ❌ Pending | Route protection |

### API Routes (TODO)
| Endpoint | Status | Notes |
|----------|--------|-------|
| `/api/auth/*` | ❌ Pending | NextAuth routes |
| `/api/v1/dashboard` | ❌ Pending | Dashboard data |
| `/api/v1/reviews` | ❌ Pending | Review CRUD |
| `/api/v1/themes` | ❌ Pending | Theme management |
| `/api/v1/recommendations` | ❌ Pending | Recommendation generation |
| `/api/v1/tasks` | ❌ Pending | Task CRUD |
| `/api/v1/reports` | ❌ Pending | Report generation |
| `/api/admin/*` | ❌ Pending | Admin-only routes |

### Workers (TODO)
| Worker | Status | Notes |
|--------|--------|-------|
| Ingestion Worker | ❌ Pending | Review scraping |
| Analysis Worker | ❌ Pending | NLP/sentiment analysis |
| Scoring Worker | ❌ Pending | Calculate scores using formulas |
| Report Worker | ❌ Pending | PDF generation |

---

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL (via Prisma)
- **Cache/Queue:** Redis (BullMQ)
- **Styling:** Tailwind CSS v4
- **Components:** shadcn/ui (Radix primitives)
- **Charts:** Recharts
- **Tables:** TanStack Table v8
- **Auth:** NextAuth.js (pending)
- **Logging:** Pino

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
│   ├── (public)/           # Public routes
│   │   ├── login/
│   │   ├── register/
│   │   └── page.tsx        # Landing page
│   └── layout.tsx          # Root layout
├── components/
│   ├── ui/                 # shadcn components
│   ├── layout/             # Sidebar, Header, etc.
│   ├── dashboard/          # KPI cards, charts
│   ├── recommendations/    # Recommendation cards
│   ├── tasks/              # Task table, modals
│   ├── reports/            # Review explorer, theme breakdown
│   ├── account/            # Profile, branches, users tabs
│   └── error-boundary.tsx  # Error boundary component
├── hooks/
│   └── use-branch.tsx      # Branch & date range context
├── lib/
│   ├── auth/               # Auth context (mock - TODO: NextAuth)
│   ├── data/               # Data access functions (mock)
│   ├── mock/               # Mock data (temporary)
│   ├── types/              # TypeScript interfaces
│   ├── utils/              # Helpers (export, cn)
│   ├── env.ts              # Environment validation
│   ├── logger.ts           # Pino logging utility
│   └── utils.ts            # CN utility
├── server/
│   ├── auth/               # Auth utilities (RBAC)
│   ├── db.ts               # Prisma client
│   └── index.ts            # Server exports
prisma/
├── schema.prisma           # V1 database schema
└── migrations/             # Database migrations
docs/
└── ARCHITECTURE_V1.md      # V1 architecture document
```

---

## Key Files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Complete V1 database schema |
| `prisma.config.ts` | Prisma configuration |
| `src/server/db.ts` | Prisma client singleton |
| `src/server/auth/index.ts` | RBAC permission helpers |
| `src/lib/env.ts` | Environment variable validation |
| `src/lib/logger.ts` | Structured logging utility |
| `docs/ARCHITECTURE_V1.md` | Full V1 architecture spec |
| `.env.local.example` | Environment template |

---

## Database Schema Overview

See `docs/ARCHITECTURE_V1.md` for complete data models.

**Core Tables:**
- `Organization` - Multi-tenant organizations
- `Tenant` - Branches/locations
- `User` - Users with RBAC roles
- `Review` - Reviews from various sources
- `Theme` - Review themes/topics
- `ReviewTheme` - Review-to-theme mappings

**Scoring Tables (Admin-only):**
- `ParameterSetVersion` - Scoring algorithm parameters
- `ScoreRun` - Score calculation runs
- `ReviewScore` - Per-review scores
- `ThemeScore` - Per-theme scores
- `FixScore` - Fix effectiveness tracking

**Action Tables:**
- `Recommendation` - AI-generated recommendations
- `Task` - Tasks for staff
- `AuditLog` - System audit trail

---

## Development Notes

- **Mock Auth:** Currently using mock authentication - any credentials work
- **Mock Data:** Frontend uses mock data in `/src/lib/mock/` and `/src/lib/data/`
- **Database:** Schema is ready, API routes need to be implemented
- **Charts:** May show SSR warnings (safe to ignore)
- **Print Styles:** Included on monthly report page
