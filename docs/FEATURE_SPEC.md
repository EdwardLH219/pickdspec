# Pick't Feature Specification V1

> **Pick't** is a review intelligence platform for restaurants that transforms customer feedback into actionable insights, measurable improvements, and revenue impact.

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Review Ingestion & Data Sources](#2-review-ingestion--data-sources)
3. [Scoring Engine](#3-scoring-engine)
4. [Recommendations Engine](#4-recommendations-engine)
5. [Economic Impact Analysis](#5-economic-impact-analysis)
6. [Task Management](#6-task-management)
7. [Task Impact Measurement (FixScore)](#7-task-impact-measurement-fixscore)
8. [Activation Drafts](#8-activation-drafts)
9. [Till Slip Feedback Channel](#9-till-slip-feedback-channel)
10. [Reports & Analytics](#10-reports--analytics)
11. [Multi-Tenancy & Access Control](#11-multi-tenancy--access-control)
12. [Data Model Overview](#12-data-model-overview)

---

## 1. Platform Overview

### 1.1 Purpose

Pick't helps restaurants:
- **Collect** reviews from multiple sources (Google, HelloPeter, Facebook, etc.)
- **Analyze** sentiment and extract themes using AI
- **Score** performance across key operational themes
- **Recommend** prioritized actions based on severity and economic impact
- **Track** task completion and measure improvement effectiveness
- **Activate** positive changes through marketing content generation

### 1.2 Key Differentiators

| Feature | Description |
|---------|-------------|
| **Weighted Scoring** | Time-decayed, source-weighted, engagement-adjusted scores |
| **Economic Impact** | Revenue-at-risk and upside calculations for each issue |
| **FixScore™** | Measures actual sentiment improvement after completing tasks |
| **Till Slip Channel** | Direct customer feedback via QR codes with incentives |
| **Activation Drafts** | AI-generated marketing content from improvements |

### 1.3 Core Workflow

```
Reviews → Scoring → Recommendations → Tasks → FixScore → Activations
   ↓          ↓            ↓            ↓          ↓           ↓
 Ingest    Analyze     Prioritize    Execute   Measure    Capitalize
```

### 1.4 Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Framework** | Next.js 16 (App Router) | Full-stack React framework with server components |
| **Language** | TypeScript | Type-safe development |
| **Database** | PostgreSQL | Primary data store |
| **ORM** | Prisma | Database access and migrations |
| **Authentication** | NextAuth.js | Multi-provider auth with session management |
| **AI/NLP** | OpenAI GPT-4o-mini, GPT-5-mini | Sentiment analysis, theme extraction, content generation |
| **UI Components** | shadcn/ui + Radix | Accessible, customizable component library |
| **Styling** | Tailwind CSS | Utility-first CSS framework |
| **Charts** | Recharts | Dashboard visualizations |
| **Animations** | Framer Motion | UI transitions and micro-interactions |
| **Deployment** | Vercel | Serverless hosting with edge functions |
| **File Storage** | Vercel Blob (planned) | File uploads and QR code storage |

#### Architecture Highlights:

- **Server Components**: Data fetching at the server level for performance
- **Server Actions**: Secure mutations without API routes where appropriate
- **Streaming**: Server-Sent Events (SSE) for live scoring progress
- **Multi-tenant**: Organization → Tenant hierarchy with row-level security
- **Extensible Connectors**: Plugin architecture for review source integrations

---

## 2. Review Ingestion & Data Sources

### 2.1 Supported Sources

| Source | Status | Method | Auto-Sync |
|--------|--------|--------|-----------|
| Google Reviews | ✅ Implemented | Google Takeout export (CSV/JSON) | Manual |
| Google via Outscraper | ✅ Implemented | Outscraper JSON export | Manual |
| CSV Import | ✅ Implemented | Generic CSV with column mapping | Manual |
| HelloPeter | 🔧 Schema Ready | TBD | TBD |
| Facebook | 🔧 Schema Ready | TBD | TBD |
| TripAdvisor | 🔧 Schema Ready | TBD | TBD |
| Till Slip | ✅ Implemented | QR code direct feedback | Real-time |

### 2.2 Ingestion Pipeline

```
Upload/Fetch → Parse → Normalize → Deduplicate → Store → Score
```

#### Key Features:
- **Connector Registry**: Extensible plugin architecture for data sources
- **Duplicate Detection**: Content hashing prevents duplicate reviews
- **Batch Processing**: 50 reviews per batch for performance
- **Error Tracking**: Individual errors logged with retry capability
- **Incremental Sync**: Only new/updated reviews processed

### 2.3 Review Data Model

Each review captures:
- **Core**: Rating (1-5), title, content, author, date
- **Source**: Connector type, external ID
- **Engagement**: Likes, replies, helpful count
- **NLP**: Language, AI-detected sentiment
- **Quality**: Flags for low confidence, duplicates, spam

---

## 3. Scoring Engine

### 3.1 Review-Level Scoring

Each review receives a **Weighted Impact Score (W_r)**:

```
W_r = S_r × W_time × W_source × W_engagement × W_confidence
```

#### Components:

| Weight | Formula | Range | Purpose |
|--------|---------|-------|---------|
| **S_r** (Sentiment) | OpenAI + rating blend | [-1, +1] | Base sentiment |
| **W_time** | e^(-λ × Δt) | (0, 1] | Recent reviews weighted higher |
| **W_source** | Platform lookup | [0.6, 1.4] | Source credibility |
| **W_engagement** | log(1 + likes + replies) | [1, 1.3] | Social proof |
| **W_confidence** | Rule-based | [0, 1] | Review quality |

#### Source Weights:
| Platform | Weight |
|----------|--------|
| Google | 1.20 |
| HelloPeter | 1.15 |
| TripAdvisor | 1.00 |
| Facebook | 0.90 |
| Website | 0.80 |
| Till Slip | 1.00 |

### 3.2 Theme Extraction

Themes extracted using:
1. **Primary**: OpenAI GPT-4o-mini with structured prompts
2. **Fallback**: Keyword matching for offline processing

#### Standard Themes:
| Theme | Category | Keywords (Sample) |
|-------|----------|-------------------|
| Service | SERVICE | waiter, staff, friendly, rude, attentive |
| Food Quality | PRODUCT | delicious, bland, fresh, stale, tasty |
| Cleanliness | CLEANLINESS | clean, dirty, spotless, grimy, hygiene |
| Value | VALUE | expensive, cheap, worth, overpriced |
| Ambiance | AMBIANCE | cozy, noisy, atmosphere, decor |
| Wait Time | SERVICE | slow, quick, waited, fast |

### 3.3 Theme Score Calculation

```
S_theme = ΣW_r / Σ|W_r|    (weighted average sentiment)
Score_0_10 = 5 × (S_theme + 1)    (normalized to 0-10)
```

#### Negative Volume Adjustment:
Penalizes themes with high negative volume even if average sentiment is positive:
```
adjusted_score = base_score - (negativeRatio² × strength × (base_score - 5))
```

#### Severity Ranking:
```
Severity = |min(S_theme, 0)| × log(1 + mentions)
```
Higher severity = more urgent attention needed.

### 3.4 Score Run Execution

1. Fetch reviews for date range
2. Score each review (S_r, weights)
3. Extract and score themes
4. Persist `ReviewScore` and `ThemeScore` records
5. Trigger recommendation generation
6. Calculate economic impacts

---

## 4. Recommendations Engine

### 4.1 Auto-Generation Logic

Recommendations generated from theme scores meeting thresholds:

| Severity | Score < | Non-Positive Mentions ≥ |
|----------|---------|-------------------------|
| CRITICAL | 5.0 | 10 |
| HIGH | 6.5 | 5 |
| MEDIUM | 7.5 | 3 |
| LOW | 8.5 | 2 |

### 4.2 Recommendation Content

Each recommendation includes:
- **Title**: Auto-generated (e.g., "Urgent: Address Critical Cleanliness Issues")
- **Description**: Score, mention count, sentiment summary
- **Suggested Actions**: Category-specific templates (3-4 actions)
- **Evidence Reviews**: Top 5 negative reviews for context
- **Economic Impact**: Revenue at risk and upside potential

### 4.3 Recommendation Lifecycle

```
OPEN → IN_PROGRESS → RESOLVED / DISMISSED
```

- **OPEN**: New recommendation, awaiting action
- **IN_PROGRESS**: Tasks created, work underway
- **RESOLVED**: All tasks completed, improvement verified
- **DISMISSED**: Manually dismissed (with reason)

---

## 5. Economic Impact Analysis

### 5.1 Revenue Impact Calculation

```
RevenueAtRisk = MonthlyRevenue × RatingImpact × Elasticity × ThemeWeight × SeverityMultiplier
```

#### Rating Impact by Severity:
| Severity | Rating Points Lost |
|----------|-------------------|
| CRITICAL | 1.5 |
| HIGH | 1.0 |
| MEDIUM | 0.5 |
| LOW | 0.25 |

### 5.2 Revenue Upside

```
RevenueUpside = RevenueAtRisk × MentionScaleFactor
```

Scale factor accounts for:
- Volume of negative mentions
- Ratio of negative to total mentions
- Potential improvement scope

### 5.3 Footfall Impact

```
FootfallAtRisk = CoversPerMonth × RatingImpact × ClickElasticity × ConversionRate × ThemeWeight
```

### 5.4 Confidence Levels

| Level | Data Quality Score | Meaning |
|-------|-------------------|---------|
| HIGH | ≥ 0.8 | Reliable estimates |
| MEDIUM | ≥ 0.5 | Reasonable estimates |
| LOW | ≥ 0.3 | Indicative only |
| INSUFFICIENT_DATA | < 0.3 | Cannot estimate |

### 5.5 Baseline Metrics Required

- Monthly covers
- Average spend per cover
- Seat capacity
- Operating hours/days
- Currency

---

## 6. Task Management

### 6.1 Task Sources

Tasks created from:
1. **Recommendations**: Auto-suggested actions
2. **Manual**: User-created tasks
3. **Templates**: Pre-defined action templates

### 6.2 Task Properties

| Property | Description |
|----------|-------------|
| Title | Task description |
| Theme | Associated operational theme |
| Priority | URGENT, HIGH, MEDIUM, LOW |
| Status | PENDING, IN_PROGRESS, COMPLETED, CANCELLED |
| Assignee | Team member responsible |
| Due Date | Target completion date |
| Economic Impact | Inherited from recommendation |

### 6.3 Task Views

#### List View:
- Filterable by status, theme, assignee
- Sortable columns
- Quick actions (complete, view details)

#### Kanban Board View:
- Columns: Not Started, In Progress, Done
- Drag-and-drop between columns
- Cards show: title, theme, priority, assignee
- Visual indicators for overdue tasks

### 6.4 Task Lifecycle

```
PENDING → IN_PROGRESS → COMPLETED
                     ↘ CANCELLED
```

When completed:
1. FixScore calculation triggered
2. Sentiment timeline analyzed
3. Economic impact measured
4. Activation drafts generated (if qualified)

---

## 7. Task Impact Measurement (FixScore)

### 7.1 Purpose

FixScore™ measures **actual sentiment improvement** after completing a task, providing closed-loop validation.

### 7.2 Calculation

```
FixScore = ΔS × log(1 + review_count) × Confidence
```

Where:
- **ΔS**: Change in theme sentiment (before vs. after completion)
- **review_count**: Number of reviews in measurement period
- **Confidence**: Based on sample size and data quality

### 7.3 Measurement Periods

- **Before Period**: 30 days prior to task completion
- **After Period**: 30 days after task completion
- **Comparison**: Weighted sentiment averages

### 7.4 Timeline Visualization

Dashboard shows:
- Weekly sentiment trend before/after completion
- Task completion marker
- Delta S (sentiment change)
- FixScore value

### 7.5 FixScore Interpretation

| FixScore | Interpretation |
|----------|----------------|
| > 0.3 | Significant improvement |
| 0.1 - 0.3 | Moderate improvement |
| 0 - 0.1 | Slight improvement |
| < 0 | No improvement / decline |

---

## 8. Activation Drafts

### 8.1 Purpose

Automatically generate marketing content to capitalize on improvements, turning operational wins into customer-facing messaging.

### 8.2 Trigger Criteria

Drafts generated when:
- Task completed with FixScore ≥ 0.05
- Sentiment improvement (ΔS) ≥ 0.1
- Task has associated theme

### 8.3 Draft Types

| Type | Purpose | Format |
|------|---------|--------|
| **GBP_POST** | Google Business Profile post | 150-250 chars, emojis, hashtags |
| **REVIEW_PROMPT** | Customer review request | 2-3 paragraphs, < 500 chars |
| **OFFER_SUGGESTION** | Promotional offer idea | Offer details + terms |

### 8.4 Content Generation

1. **Primary**: OpenAI GPT-4o-mini with brand-aware prompts
2. **Fallback**: Theme-specific templates with variable substitution

### 8.5 Draft Workflow

```
DRAFT → Edit (optional) → MARKED_PUBLISHED / ARCHIVED
```

- Copy content to clipboard for external use
- Track what was actually published
- Filter by status and type

---

## 9. Till Slip Feedback Channel

### 9.1 Overview

Direct feedback collection via QR codes printed on receipts, bypassing third-party review platforms.

### 9.2 Integration Options

| Option | Description | Complexity |
|--------|-------------|------------|
| **A: Pre-minted** | API call before printing, token in QR | Medium |
| **B: Deferred** | Signed URL, token minted on scan | Low |
| **C: Static QR** | One QR per branch, no receipt link | Lowest |

### 9.3 Customer Flow

1. Receive receipt with QR code
2. Scan QR → lands on feedback form
3. Rate experience (1-5 stars)
4. Select positive/negative themes
5. Add optional comments
6. Submit → receive incentive code (if configured)

### 9.4 Feedback Collected

| Field | Required | Description |
|-------|----------|-------------|
| Overall Rating | Yes | 1-5 stars |
| Positive Themes | No | Selected from configured list |
| Negative Themes | No | Selected from configured list |
| Positive Detail | No | Free text (max 2000 chars) |
| Negative Detail | No | Free text (max 2000 chars) |
| Contact Opt-in | No | Email for follow-up |

### 9.5 Incentive Types

| Type | Description | Output |
|------|-------------|--------|
| **DISCOUNT** | Percentage discount | 6-char redemption code |
| **PRIZE_DRAW** | Entry into prize draw | Entry number |
| **CUSTOM** | Custom message/offer | Custom display |
| **NONE** | No incentive | Thank you message |

### 9.6 Redemption Flow

1. Customer shows 6-character code
2. Staff enters code in portal
3. System verifies: valid, not expired, not redeemed
4. Staff confirms redemption
5. Code marked as redeemed with audit trail

### 9.7 Security Features

| Feature | Implementation |
|---------|----------------|
| Token Security | Cryptographic random, single-use |
| Rate Limiting | Per IP, per token, per tenant |
| Spam Detection | Heuristic scoring (text quality, patterns) |
| XSS Prevention | Input sanitization, escaping |
| IP Privacy | Hashed storage only |
| Audit Logging | All actions logged |

### 9.8 Channel Metrics

- **Response Rate**: Submissions / Receipts issued
- **Incentive Uptake**: Codes redeemed / Codes issued
- **Submission Quality**: Spam rate, completion rate
- **Rating Distribution**: Star rating breakdown

---

## 10. Reports & Analytics

### 10.1 Dashboard

#### KPIs:
- Average Sentiment Score (0-10)
- Average Star Rating
- Total Reviews
- Positive Rate (%)
- Health Score (0-100)

#### Charts:
- Sentiment Trend (weekly)
- Sentiment Distribution (pie)
- Rating Distribution (bar)
- Source Distribution (bar)
- Theme Radar (radar)
- Recent Negative Reviews (list)

#### Branch Comparison:
- Side-by-side metrics across branches
- Heatmap visualization
- Trend comparison

### 10.2 Review Explorer

- Full-text search across reviews
- Filter by: source, sentiment, theme, date range
- Sort by: date, rating, relevance
- CSV export capability
- Review detail modal with themes

### 10.3 Theme Breakdown

- Per-theme sentiment analysis
- Mention counts and trends
- Sentiment distribution (positive/neutral/negative)
- Evidence reviews per theme

### 10.4 Customer Summary

AI-generated summaries for periods:
- **2 Weeks**: Recent snapshot
- **3 Months**: Medium-term trends
- **6 Months**: Long-term analysis

Content includes:
- Executive summary
- Theme-by-theme breakdown
- What customers love/dislike
- Actionable recommendations
- Occasion suggestions

### 10.5 Monthly Report

Comprehensive monthly report with:
- Executive TL;DR bullets
- Theme analysis with trends
- "What People Love" section
- "What People Dislike" section
- Watch-outs and practical tips
- Statistics and signals
- Print/PDF export

---

## 11. Multi-Tenancy & Access Control

### 11.1 Hierarchy

```
Organization (Account)
    └── Tenant (Branch/Location)
            └── Users (via Membership)
```

### 11.2 User Roles

| Role | Scope | Permissions |
|------|-------|-------------|
| PICKD_ADMIN | Platform | Full platform access |
| PICKD_SUPPORT | Platform | Read-only support access |
| OWNER | Organization | Full organization access |
| MANAGER | Organization | Manage operations |
| STAFF | Organization | Limited operational access |

### 11.3 Branch Access Levels

| Level | Capabilities |
|-------|--------------|
| READ | View data only |
| WRITE | View and edit |
| ADMIN | Full branch management |

### 11.4 Subscription Tiers

| Tier | Features |
|------|----------|
| STARTER | Basic analytics |
| PROFESSIONAL | Full analytics + recommendations |
| ENTERPRISE | All features + API access |

---

## 12. Data Model Overview

### 12.1 Core Entities

```
Organization (1) ─┬─ (N) Tenant
                  └─ (N) Membership ─── (1) User

Tenant (1) ─┬─ (N) Connector
            ├─ (N) Review
            ├─ (N) Recommendation
            ├─ (N) Task
            ├─ (N) TillReviewSettings
            └─ (N) RestaurantBaselineMetrics

Review (1) ─┬─ (N) ReviewTheme
            ├─ (1) ReviewScore
            └─ (1) TillReviewSubmission (optional)

ScoreRun (1) ─┬─ (N) ReviewScore
              ├─ (N) ThemeScore
              └─ (N) EconomicImpactSnapshot

Recommendation (1) ─┬─ (N) Task
                    └─ (N) RecommendationEconomicImpact

Task (1) ─┬─ (1) FixScore
          └─ (N) ActivationDraft
```

### 12.2 Key Tables

| Table | Purpose | Records |
|-------|---------|---------|
| Review | Core review data | Per review |
| ReviewTheme | Theme associations | Per review-theme |
| ReviewScore | Calculated weights | Per review per run |
| ThemeScore | Aggregated scores | Per theme per run |
| Recommendation | Suggested actions | Per theme issue |
| Task | Actionable items | Per action |
| FixScore | Impact measurement | Per completed task |
| ActivationDraft | Marketing content | Per improvement |
| TillReceipt | QR code tokens | Per receipt |
| TillReviewSubmission | Direct feedback | Per submission |

### 12.3 Versioned Configurations

| Entity | Purpose |
|--------|---------|
| ParameterSetVersion | Scoring algorithm parameters |
| ThemeEconomicWeight | Economic impact weights |
| RuleSetVersion | Business rules |

---

## Appendix A: API Reference

### Portal APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/portal/dashboard` | GET | Dashboard data |
| `/api/portal/tasks` | GET/POST | Task management |
| `/api/portal/recommendations` | GET | Recommendations |
| `/api/portal/reviews` | GET | Review explorer |
| `/api/portal/reports/summary` | GET/POST | Customer summaries |
| `/api/portal/activations` | GET/POST | Activation drafts |
| `/api/portal/score/stream` | POST | Run scoring (SSE) |

### Ingestion APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ingestion/upload` | POST | Upload CSV/JSON |
| `/api/ingestion/run` | POST | Trigger ingestion |
| `/api/ingestion/connectors` | GET/POST | Manage connectors |

### Public APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/feedback/[token]` | GET/POST | Till slip feedback |
| `/api/branches/[id]/till/mint-on-visit` | GET | Deferred token |

---

## Appendix B: Scoring Formulas

### Review Sentiment
```
S_r = text_sentiment × (1 - blend) + rating_normalized × blend
rating_normalized = (rating - 3) / 2
```

### Time Weight
```
W_time = e^(-λ × Δt)
λ = ln(2) / H    (H = half-life in days)
```

### Theme Score
```
S_theme = ΣW_r / Σ|W_r|
Score_0_10 = 5 × (S_theme + 1)
```

### Severity
```
Severity = |min(S_theme, 0)| × log(1 + mentions)
```

### FixScore
```
FixScore = ΔS × log(1 + review_count) × Confidence
```

### Revenue at Risk
```
RevAtRisk = MonthlyRev × RatingImpact × Elasticity × ThemeWeight × SeverityMult
```

---

## Appendix C: Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React, TypeScript |
| Styling | Tailwind CSS, shadcn/ui |
| Charts | Recharts |
| Backend | Next.js API Routes, Server Actions |
| Database | PostgreSQL via Prisma ORM |
| Auth | NextAuth.js |
| AI | OpenAI GPT-4o-mini, GPT-5-mini |
| Deployment | Vercel |

---

*Document Version: 1.0*
*Last Updated: January 2026*
