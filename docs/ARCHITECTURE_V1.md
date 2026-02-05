# Pick'd Review Intelligence — V1 Architecture

> **Version:** 1.0  
> **Stack:** Next.js App Router + TypeScript + Tailwind + Prisma + PostgreSQL + BullMQ/Redis  
> **Last Updated:** February 2026

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Authorization Matrix](#2-authorization-matrix)
3. [Data Models](#3-data-models)
4. [Formula Calculations](#4-formula-calculations)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              PICK'D V1 ARCHITECTURE                              │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENTS                                        │
├─────────────────────────────────┬───────────────────────────────────────────────┤
│     RESTAURANT PORTAL           │           PICK'D ADMIN CONSOLE                │
│     (Multi-tenant SaaS)         │           (Internal Staff Only)               │
│  ┌───────────────────────┐      │      ┌───────────────────────────┐            │
│  │ • Dashboard           │      │      │ • Rules Engine Editor     │            │
│  │ • Reports             │      │      │ • Parameter Management    │            │
│  │ • Recommendations     │      │      │ • Tenant Management       │            │
│  │ • Tasks               │      │      │ • Score Run Monitoring    │            │
│  │ • Account Settings    │      │      │ • Audit Logs              │            │
│  └───────────────────────┘      │      │ • System Health           │            │
│  Role: owner | manager | staff  │      └───────────────────────────┘            │
│                                 │      Role: pickd_admin | pickd_support        │
└─────────────────────────────────┴───────────────────────────────────────────────┘
                    │                                      │
                    ▼                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            NEXT.JS APPLICATION                                   │
│                        (Vercel / Docker Deployment)                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────────┐  │
│  │   Route Handlers    │  │   Server Actions    │  │     Middleware          │  │
│  │   /api/v1/*         │  │   (mutations)       │  │  • Auth (NextAuth)      │  │
│  │                     │  │                     │  │  • RBAC enforcement     │  │
│  │  • /auth/*          │  │  • createTask()     │  │  • Tenant isolation     │  │
│  │  • /dashboard/*     │  │  • updateStatus()   │  │  • Rate limiting        │  │
│  │  • /reviews/*       │  │  • exportReport()   │  │  • Audit logging        │  │
│  │  • /reports/*       │  │                     │  │                         │  │
│  │  • /admin/* ←RBAC   │  │                     │  │                         │  │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────────┘  │
│                                      │                                          │
│  ┌───────────────────────────────────┴───────────────────────────────────────┐  │
│  │                         SERVICE LAYER                                      │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐  │  │
│  │  │ AuthService  │ │ TenantService│ │ ReviewService│ │ ScoringService   │  │  │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────────┘  │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐  │  │
│  │  │ ReportService│ │ TaskService  │ │ AdminService │ │ AuditService     │  │  │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                    │                                      │
                    ▼                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DATA & QUEUE LAYER                                  │
├────────────────────────────────────┬────────────────────────────────────────────┤
│           POSTGRESQL               │                 REDIS                       │
│           (via Prisma)             │              (BullMQ)                       │
│  ┌──────────────────────────────┐  │  ┌──────────────────────────────────────┐  │
│  │ • organizations              │  │  │ Queues:                              │  │
│  │ • tenants (branches)         │  │  │  • review.ingest                     │  │
│  │ • users + sessions           │  │  │  • review.analyze                    │  │
│  │ • reviews                    │  │  │  • score.calculate                   │  │
│  │ • themes                     │  │  │  • report.generate                   │  │
│  │ • parameter_set_versions     │  │  │  • notification.send                 │  │
│  │ • score_runs                 │  │  │                                      │  │
│  │ • review_scores              │  │  │ Cache:                               │  │
│  │ • theme_scores               │  │  │  • Dashboard aggregates              │  │
│  │ • fix_scores                 │  │  │  • Session data                      │  │
│  │ • recommendations            │  │  │  • Rate limit counters               │  │
│  │ • tasks                      │  │  │                                      │  │
│  │ • audit_logs                 │  │  └──────────────────────────────────────┘  │
│  └──────────────────────────────┘  │                                            │
└────────────────────────────────────┴────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              WORKER PROCESSES                                    │
│                      (Separate deployment / same codebase)                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                        INGESTION WORKER                                  │    │
│  │  • Poll Google Business API (scheduled)                                  │    │
│  │  • Poll HelloPeter API (scheduled)                                       │    │
│  │  • Deduplicate reviews                                                   │    │
│  │  • Queue for analysis                                                    │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                        ANALYSIS WORKER                                   │    │
│  │  • OpenAI sentiment analysis                                             │    │
│  │  • Theme extraction (NLP)                                                │    │
│  │  • Store results → queue for scoring                                     │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                        SCORING WORKER                                    │    │
│  │  • Load active ParameterSetVersion                                       │    │
│  │  • Calculate review_scores, theme_scores, fix_scores                     │    │
│  │  • Create score_run record                                               │    │
│  │  • Generate recommendations                                              │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                        REPORT WORKER                                     │    │
│  │  • Generate PDF reports (async)                                          │    │
│  │  • Email scheduled digests                                               │    │
│  │  • Archive to S3/R2                                                      │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL INTEGRATIONS                                  │
├──────────────────┬──────────────────┬──────────────────┬────────────────────────┤
│  Google Business │   HelloPeter     │     OpenAI       │   Email (Resend/SES)   │
│  Profile API     │   API            │   GPT-4 API      │                        │
└──────────────────┴──────────────────┴──────────────────┴────────────────────────┘
```

### Responsibilities Matrix

| Component | Responsibility |
|-----------|---------------|
| **Route Handlers** | REST API for dashboard, reviews, reports, tasks, account management |
| **Server Actions** | Mutations with built-in CSRF protection |
| **Middleware** | Auth verification, RBAC enforcement, tenant isolation, rate limiting |
| **Admin Routes** | Parameter management, rules engine UI, tenant admin (PICK'D STAFF ONLY) |
| **Ingestion Worker** | Fetch reviews from external APIs, deduplicate, store raw |
| **Analysis Worker** | NLP processing, sentiment scoring, theme extraction |
| **Scoring Worker** | Apply formulas from active ParameterSetVersion, calculate all scores |
| **Report Worker** | PDF generation, email delivery, S3 archival |

---

## 2. Authorization Matrix

### Role Hierarchy

```
PICK'D INTERNAL (is_pickd_staff = true)
├── pickd_admin    → Full system access, parameter editing, tenant management
├── pickd_support  → Read-only admin console, no parameter editing

RESTAURANT USERS (is_pickd_staff = false)
├── owner          → All tenant data, user management, billing
├── manager        → Dashboard, reports, tasks, limited settings
├── staff          → Dashboard view only, task completion
```

### Permission Matrix

| Resource | pickd_admin | pickd_support | owner | manager | staff |
|----------|:-----------:|:-------------:|:-----:|:-------:|:-----:|
| **Parameter Sets** | CRUD | Read | ❌ | ❌ | ❌ |
| **Score Runs (trigger)** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Score Runs (view)** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Audit Logs** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Tenant Management** | CRUD | Read | ❌ | ❌ | ❌ |
| **All Tenants Data** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Dashboard (own tenant)** | ✅ | ✅ | ✅ | ✅ | Read |
| **Reviews (own tenant)** | ✅ | ✅ | ✅ | ✅ | Read |
| **Tasks (own tenant)** | ✅ | ✅ | CRUD | CRUD | Update |
| **Reports (own tenant)** | ✅ | ✅ | ✅ | ✅ | Read |
| **Recommendations** | ✅ | ✅ | ✅ | ✅ | Read |
| **User Management (own org)** | ✅ | Read | CRUD | ❌ | ❌ |
| **Billing/Subscription** | ✅ | Read | ✅ | ❌ | ❌ |

### Enforcement Implementation

```typescript
// middleware.ts
export async function authorizeRequest(
  session: Session,
  resource: Resource,
  action: Action,
  tenantId?: string
) {
  // 1. Check if user is authenticated
  if (!session?.user) {
    throw new UnauthorizedError();
  }

  // 2. HARD SPLIT: Pick'd staff vs Restaurant users
  const isPickdStaff = session.user.isPickdStaff;
  const role = session.user.role;

  // 3. Admin-only resources (Parameter Sets, Score Runs, Audit Logs)
  const ADMIN_ONLY_RESOURCES = ['parameter_sets', 'score_runs', 'audit_logs', 'all_tenants'];
  if (ADMIN_ONLY_RESOURCES.includes(resource)) {
    if (!isPickdStaff) {
      throw new ForbiddenError('Access denied: Pick\'d staff only');
    }
    if (resource === 'parameter_sets' && action !== 'read' && role !== 'pickd_admin') {
      throw new ForbiddenError('Access denied: Admin only');
    }
  }

  // 4. Tenant isolation for restaurant users
  if (!isPickdStaff && tenantId) {
    const hasAccess = session.user.tenantAccess.includes(tenantId);
    if (!hasAccess) {
      throw new ForbiddenError('Tenant access denied');
    }
  }

  // 5. Role-based action check
  const allowed = checkPermission(role, resource, action);
  if (!allowed) {
    throw new ForbiddenError('Permission denied');
  }

  // 6. Audit log
  await auditLog({
    actorId: session.user.id,
    action,
    resource,
    resourceId: tenantId,
  });
}
```

---

## 3. Data Models

### Core Tenancy

```prisma
// === ORGANIZATION ===
model Organization {
  id                String   @id @default(uuid())
  name              String
  subscriptionTier  SubscriptionTier @default(STARTER)
  subscriptionStatus SubscriptionStatus @default(ACTIVE)
  settings          Json?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  tenants           Tenant[]
  users             User[]
  themes            Theme[]
}

enum SubscriptionTier {
  STARTER
  PROFESSIONAL
  ENTERPRISE
}

enum SubscriptionStatus {
  ACTIVE
  SUSPENDED
  CANCELLED
}

// === TENANT (Branch) ===
model Tenant {
  id                  String   @id @default(uuid())
  organizationId      String
  organization        Organization @relation(fields: [organizationId], references: [id])
  
  name                String
  address             String?
  city                String?
  country             String?
  timezone            String   @default("Africa/Johannesburg")
  
  googlePlaceId       String?
  hellopeterBusinessId String?
  
  isActive            Boolean  @default(true)
  
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  
  reviewSources       ReviewSource[]
  reviews             Review[]
  scoreRuns           ScoreRun[]
  themeScores         ThemeScore[]
  fixScores           FixScore[]
  recommendations     Recommendation[]
  tasks               Task[]
  
  @@index([organizationId])
}

// === USER ===
model User {
  id                String   @id @default(uuid())
  organizationId    String?  // Nullable for Pick'd staff
  organization      Organization? @relation(fields: [organizationId], references: [id])
  
  email             String   @unique
  passwordHash      String?
  firstName         String
  lastName          String
  
  role              UserRole
  isPickdStaff      Boolean  @default(false)  // HARD SPLIT
  tenantAccess      String[] @default([])     // UUIDs of accessible tenants
  
  googleId          String?  @unique
  avatarUrl         String?
  
  isActive          Boolean  @default(true)
  lastLoginAt       DateTime?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  // Relations
  createdParameterSets    ParameterSetVersion[] @relation("CreatedBy")
  activatedParameterSets  ParameterSetVersion[] @relation("ActivatedBy")
  triggeredScoreRuns      ScoreRun[]
  assignedTasks           Task[]    @relation("AssignedTo")
  createdTasks            Task[]    @relation("CreatedBy")
  auditLogs               AuditLog[]
  
  @@index([organizationId])
  @@index([email])
  @@index([isPickdStaff])
}

enum UserRole {
  // Pick'd Internal
  PICKD_ADMIN
  PICKD_SUPPORT
  // Restaurant Users
  OWNER
  MANAGER
  STAFF
}
```

### Reviews & Analysis

```prisma
// === REVIEW SOURCE ===
model ReviewSource {
  id            String   @id @default(uuid())
  tenantId      String
  tenant        Tenant   @relation(fields: [tenantId], references: [id])
  
  sourceType    SourceType
  externalId    String   // Platform-specific ID
  
  lastSyncedAt  DateTime?
  syncStatus    SyncStatus @default(ACTIVE)
  
  createdAt     DateTime @default(now())
  
  reviews       Review[]
  
  @@unique([tenantId, sourceType])
  @@index([tenantId])
}

enum SourceType {
  GOOGLE
  HELLOPETER
  FACEBOOK
  TRIPADVISOR
  YELP
  ZOMATO
  OPENTABLE
  WEBSITE
  INSTAGRAM
  TWITTER
}

enum SyncStatus {
  ACTIVE
  PAUSED
  ERROR
}

// === REVIEW ===
model Review {
  id                String   @id @default(uuid())
  tenantId          String
  tenant            Tenant   @relation(fields: [tenantId], references: [id])
  sourceId          String
  source            ReviewSource @relation(fields: [sourceId], references: [id])
  
  externalReviewId  String
  
  // Core data
  rating            Int?     // 1-5 (optional)
  title             String?
  content           String
  authorName        String?
  authorId          String?
  reviewDate        DateTime
  
  // Response tracking
  responseText      String?
  responseDate      DateTime?
  
  // Engagement metrics (for W_engagement)
  likesCount        Int      @default(0)
  repliesCount      Int      @default(0)
  helpfulCount      Int      @default(0)
  
  // NLP analysis
  detectedLanguage  String?
  
  // Duplicate detection
  contentHash       String?
  duplicateSimilarity Float?
  
  rawData           Json?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  reviewThemes      ReviewTheme[]
  reviewScores      ReviewScore[]
  
  @@unique([sourceId, externalReviewId])
  @@index([tenantId, reviewDate])
  @@index([contentHash])
}

// === THEME ===
model Theme {
  id              String   @id @default(uuid())
  organizationId  String?  // Nullable for system themes
  organization    Organization? @relation(fields: [organizationId], references: [id])
  
  name            String
  category        ThemeCategory
  description     String?
  keywords        String[] @default([])
  color           String?
  
  isSystem        Boolean  @default(false)
  isActive        Boolean  @default(true)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  reviewThemes    ReviewTheme[]
  themeScores     ThemeScore[]
  fixScores       FixScore[]
  recommendations Recommendation[]
  tasks           Task[]
  
  @@index([organizationId])
  @@index([isSystem])
}

enum ThemeCategory {
  SERVICE
  PRODUCT
  AMBIANCE
  VALUE
  CLEANLINESS
  OTHER
}

// === REVIEW-THEME MAPPING ===
model ReviewTheme {
  id              String   @id @default(uuid())
  reviewId        String
  review          Review   @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  themeId         String
  theme           Theme    @relation(fields: [themeId], references: [id])
  
  sentiment       Sentiment
  confidenceScore Float    // 0-1
  excerpt         String?
  
  createdAt       DateTime @default(now())
  
  @@unique([reviewId, themeId])
  @@index([themeId])
}

enum Sentiment {
  POSITIVE
  NEUTRAL
  NEGATIVE
}
```

### Scoring Engine (PICK'D ADMIN ONLY)

```prisma
// === PARAMETER SET VERSION ===
model ParameterSetVersion {
  id              String   @id @default(uuid())
  versionNumber   Int      @default(autoincrement())
  name            String
  description     String?
  
  parameters      Json     // See ParameterSet interface below
  
  status          ParameterStatus @default(DRAFT)
  activatedAt     DateTime?
  
  activatedById   String?
  activatedBy     User?    @relation("ActivatedBy", fields: [activatedById], references: [id])
  createdById     String
  createdBy       User     @relation("CreatedBy", fields: [createdById], references: [id])
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  scoreRuns       ScoreRun[]
  
  @@index([status])
  @@index([activatedAt])
}

enum ParameterStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}

// === SCORE RUN ===
model ScoreRun {
  id                  String   @id @default(uuid())
  tenantId            String
  tenant              Tenant   @relation(fields: [tenantId], references: [id])
  parameterVersionId  String
  parameterVersion    ParameterSetVersion @relation(fields: [parameterVersionId], references: [id])
  
  runType             ScoreRunType
  status              ScoreRunStatus @default(PENDING)
  
  reviewsProcessed    Int      @default(0)
  themesProcessed     Int      @default(0)
  
  startedAt           DateTime?
  completedAt         DateTime?
  errorMessage        String?
  
  triggeredById       String?
  triggeredBy         User?    @relation(fields: [triggeredById], references: [id])
  
  createdAt           DateTime @default(now())
  
  reviewScores        ReviewScore[]
  themeScores         ThemeScore[]
  fixScores           FixScore[]
  
  @@index([tenantId, createdAt])
  @@index([status])
}

enum ScoreRunType {
  SCHEDULED
  MANUAL
  RECALCULATION
  PARAMETER_CHANGE
}

enum ScoreRunStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}

// === REVIEW SCORE ===
model ReviewScore {
  id                String   @id @default(uuid())
  reviewId          String
  review            Review   @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  scoreRunId        String
  scoreRun          ScoreRun @relation(fields: [scoreRunId], references: [id], onDelete: Cascade)
  
  // Computed values
  baseSentiment     Float    // S_r: [-1, +1]
  timeWeight        Float    // W_time: (0, 1]
  sourceWeight      Float    // W_source: [0.6, 1.4]
  engagementWeight  Float    // W_engagement: [1, cap]
  confidenceWeight  Float    // W_confidence: [0, 1]
  weightedImpact    Float    // W_r: final score
  
  components        Json     // Full breakdown for audit
  
  createdAt         DateTime @default(now())
  
  @@unique([reviewId, scoreRunId])
  @@index([scoreRunId])
}

// === THEME SCORE ===
model ThemeScore {
  id                    String   @id @default(uuid())
  tenantId              String
  tenant                Tenant   @relation(fields: [tenantId], references: [id])
  themeId               String
  theme                 Theme    @relation(fields: [themeId], references: [id])
  scoreRunId            String
  scoreRun              ScoreRun @relation(fields: [scoreRunId], references: [id], onDelete: Cascade)
  
  periodStart           DateTime
  periodEnd             DateTime
  
  mentionCount          Int
  positiveCount         Int
  neutralCount          Int
  negativeCount         Int
  
  sumWeightedImpact     Float    // ΣW_r
  sumAbsWeightedImpact  Float    // Σ|W_r|
  
  themeSentiment        Float    // S_theme: [-1, +1]
  themeScore010         Float    // Score 0-10
  severity              Float    // Severity ranking
  
  trendDirection        TrendDirection?
  
  createdAt             DateTime @default(now())
  
  @@unique([themeId, scoreRunId])
  @@index([tenantId, scoreRunId])
  @@index([severity(sort: Desc)])
}

enum TrendDirection {
  IMPROVING
  STABLE
  DECLINING
}

// === FIX SCORE ===
model FixScore {
  id                    String   @id @default(uuid())
  tenantId              String
  tenant                Tenant   @relation(fields: [tenantId], references: [id])
  themeId               String
  theme                 Theme    @relation(fields: [themeId], references: [id])
  taskId                String?
  task                  Task?    @relation(fields: [taskId], references: [id])
  scoreRunId            String
  scoreRun              ScoreRun @relation(fields: [scoreRunId], references: [id], onDelete: Cascade)
  
  baselineScore         Float    // S_before
  currentScore          Float    // S_after
  deltaS                Float    // ΔS: [-2, +2]
  
  reviewCountPre        Int
  reviewCountPost       Int
  
  confidence            Float    // [0, 1]
  confidenceLevel       ConfidenceLevel
  
  fixScore              Float    // FixScore formula result
  
  measurementStart      DateTime
  measurementEnd        DateTime
  
  createdAt             DateTime @default(now())
  
  @@index([tenantId, themeId])
  @@index([taskId])
}

enum ConfidenceLevel {
  INSUFFICIENT
  LOW
  MEDIUM
  HIGH
}
```

### Recommendations & Tasks

```prisma
// === RECOMMENDATION ===
model Recommendation {
  id                String   @id @default(uuid())
  tenantId          String
  tenant            Tenant   @relation(fields: [tenantId], references: [id])
  themeId           String?
  theme             Theme?   @relation(fields: [themeId], references: [id])
  
  severity          RecommendationSeverity
  status            RecommendationStatus @default(OPEN)
  
  title             String
  description       String?
  suggestedActions  Json     // Array of action items
  evidenceReviewIds String[] // UUIDs of supporting reviews
  estimatedImpact   String?
  
  resolvedAt        DateTime?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  tasks             Task[]
  
  @@index([tenantId, status])
  @@index([severity])
}

enum RecommendationSeverity {
  CRITICAL
  HIGH
  MEDIUM
  LOW
}

enum RecommendationStatus {
  OPEN
  IN_PROGRESS
  RESOLVED
  DISMISSED
}

// === TASK ===
model Task {
  id                String   @id @default(uuid())
  tenantId          String
  tenant            Tenant   @relation(fields: [tenantId], references: [id])
  recommendationId  String?
  recommendation    Recommendation? @relation(fields: [recommendationId], references: [id])
  themeId           String?
  theme             Theme?   @relation(fields: [themeId], references: [id])
  
  title             String
  description       String?
  
  priority          TaskPriority @default(MEDIUM)
  status            TaskStatus @default(PENDING)
  
  assignedToId      String?
  assignedTo        User?    @relation("AssignedTo", fields: [assignedToId], references: [id])
  
  dueDate           DateTime?
  completedAt       DateTime?
  impactNotes       String?
  
  createdById       String
  createdBy         User     @relation("CreatedBy", fields: [createdById], references: [id])
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  fixScores         FixScore[]
  
  @@index([tenantId, status])
  @@index([assignedToId])
}

enum TaskPriority {
  URGENT
  HIGH
  MEDIUM
  LOW
}

enum TaskStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  CANCELLED
}
```

### Audit Log

```prisma
// === AUDIT LOG ===
model AuditLog {
  id            String   @id @default(uuid())
  
  actorId       String
  actor         User     @relation(fields: [actorId], references: [id])
  actorEmail    String
  actorRole     UserRole
  
  action        String   // e.g., "parameter_activated", "score_run_triggered"
  resourceType  String   // e.g., "parameter_set_version", "tenant"
  resourceId    String?
  
  oldValue      Json?
  newValue      Json?
  
  ipAddress     String?
  userAgent     String?
  
  createdAt     DateTime @default(now())
  
  @@index([actorId])
  @@index([action])
  @@index([resourceType])
  @@index([createdAt])
}
```

### Parameter Set JSON Schema

```typescript
interface ParameterSet {
  // === SENTIMENT MODEL ===
  sentiment: {
    model_version: string;              // e.g., "gpt-4-turbo-2024-04"
    use_star_rating: boolean;           // Blend star rating with text
    language_handling_mode: 'detect_only' | 'translate_then_score' | 'multilingual_model';
  };

  // === TIME DECAY ===
  time: {
    review_half_life_days: number;      // H (default: 60)
  };

  // === SOURCE WEIGHTS ===
  source: {
    weights: {
      google: number;                   // 1.15 - 1.30
      hellopeter: number;               // 1.00 - 1.20
      tripadvisor: number;              // 0.95 - 1.10
      facebook: number;                 // 0.80 - 1.00
      yelp: number;                     // 0.90 - 1.10
      zomato: number;                   // 0.90 - 1.10
      opentable: number;                // 0.85 - 1.00
      website: number;                  // 0.70 - 0.90
      instagram: number;                // 0.70 - 0.90
      twitter: number;                  // 0.60 - 0.85
    };
    min_weight: number;                 // 0.60
    max_weight: number;                 // 1.40
  };

  // === ENGAGEMENT ===
  engagement: {
    enabled_by_source: Record<string, boolean>;
    cap: number;                        // 1.30
  };

  // === CONFIDENCE ===
  confidence: {
    rules_version: string;
    min_text_length_chars: number;      // 20
    duplicate_similarity_threshold: number; // 0.85
    low_confidence_floor: number;       // 0.60
    vague_review_weight: number;        // 0.70
    duplicate_review_weight: number;    // 0.60
  };

  // === FIX TRACKING ===
  fix_tracking: {
    pre_window_days: number;            // 30
    post_window_days: number;           // 30
    min_reviews_for_inference: number;  // 5
    confidence_thresholds: {
      high: number;                     // 10 reviews
      medium: number;                   // 5 reviews
      low: number;                      // 2 reviews
    };
  };
}
```

---

## 4. Formula Calculations

### Formula Reference Table

| Formula | Symbol | Range | Section |
|---------|--------|-------|---------|
| Base Sentiment | S_r | [-1, +1] | A.3 |
| Time Weight | W_time | (0, 1] | A.4 |
| Source Weight | W_source | [0.6, 1.4] | A.5 |
| Engagement Weight | W_engagement | [1.0, cap] | A.6 |
| Confidence Weight | W_confidence | [0, 1] | A.7 |
| Weighted Review Impact | W_r | bounded | A.8 |
| Theme Sentiment | S_theme | [-1, +1] | B.9 |
| Theme Score (UI) | Score_0_10 | [0, 10] | B.10 |
| Severity | Severity | [0, ∞) | B.11 |
| Delta S | ΔS | [-2, +2] | C.12 |
| Fix Score | FixScore | float | C.13 |

### Implementation (TypeScript)

```typescript
// ============================================================
// SECTION A: REVIEW-LEVEL FORMULAS
// ============================================================

/**
 * A.3: Base Sentiment Score (S_r)
 * Computed by NLP model, returns value in [-1, +1]
 */
async function calculateBaseSentiment(
  content: string,
  rating: number | null,
  params: ParameterSet
): Promise<number> {
  // Call OpenAI or other NLP service
  const nlpScore = await sentimentModel.analyze(content, {
    model: params.sentiment.model_version,
    language: params.sentiment.language_handling_mode,
  });
  
  // Optionally blend with star rating
  if (params.sentiment.use_star_rating && rating !== null) {
    const ratingNormalized = (rating - 3) / 2; // Convert 1-5 to [-1, +1]
    return (nlpScore * 0.7) + (ratingNormalized * 0.3);
  }
  
  return nlpScore;
}

/**
 * A.4: Time Weight (W_time)
 * Formula: W_time = e^(-λ × Δt) where λ = ln(2)/H
 */
function calculateTimeWeight(
  reviewDate: Date,
  asOfDate: Date,
  halfLifeDays: number
): number {
  const daysDelta = Math.floor(
    (asOfDate.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const lambda = Math.log(2) / halfLifeDays;
  return Math.exp(-lambda * daysDelta);
}

/**
 * A.5: Source Weight (W_source)
 * Formula: W_source = source_weight[source], clamped to [min, max]
 */
function calculateSourceWeight(
  source: string,
  params: ParameterSet
): number {
  const weight = params.source.weights[source.toLowerCase()] ?? 1.0;
  return Math.max(
    params.source.min_weight,
    Math.min(params.source.max_weight, weight)
  );
}

/**
 * A.6: Engagement Weight (W_engagement)
 * Formula: W_engagement = min(1 + log(1 + likes + replies), cap)
 */
function calculateEngagementWeight(
  likes: number,
  replies: number,
  source: string,
  params: ParameterSet
): number {
  // Check if engagement is enabled for this source
  if (!params.engagement.enabled_by_source[source.toLowerCase()]) {
    return 1.0;
  }
  
  const rawWeight = 1 + Math.log(1 + likes + replies);
  return Math.min(rawWeight, params.engagement.cap);
}

/**
 * A.7: Confidence Weight (W_confidence)
 * Rules-based calculation
 */
function calculateConfidenceWeight(
  content: string,
  duplicateSimilarity: number | null,
  params: ParameterSet
): number {
  // Rule 1: Vague/short review
  if (content.length < params.confidence.min_text_length_chars) {
    return params.confidence.vague_review_weight;
  }
  
  // Rule 2: Suspected duplicate
  if (
    duplicateSimilarity !== null &&
    duplicateSimilarity > params.confidence.duplicate_similarity_threshold
  ) {
    return params.confidence.duplicate_review_weight;
  }
  
  // Default: full confidence
  return 1.0;
}

/**
 * A.8: Weighted Review Impact (W_r)
 * Formula: W_r = S_r × W_time × W_source × W_engagement × W_confidence
 */
function calculateWeightedImpact(
  baseSentiment: number,
  timeWeight: number,
  sourceWeight: number,
  engagementWeight: number,
  confidenceWeight: number
): number {
  return baseSentiment * timeWeight * sourceWeight * engagementWeight * confidenceWeight;
}

// ============================================================
// SECTION B: THEME-LEVEL FORMULAS
// ============================================================

/**
 * B.9: Theme Sentiment (S_theme)
 * Formula: S_theme = ΣW_r / Σ|W_r|
 */
function calculateThemeSentiment(weightedImpacts: number[]): number {
  if (weightedImpacts.length === 0) return 0;
  
  const sum = weightedImpacts.reduce((a, b) => a + b, 0);
  const absSum = weightedImpacts.reduce((a, b) => a + Math.abs(b), 0);
  
  if (absSum === 0) return 0;
  return sum / absSum;
}

/**
 * B.10: Theme Score for UI (0-10)
 * Formula: Score_0_10 = 5 × (S_theme + 1)
 */
function calculateThemeScore010(themeSentiment: number): number {
  return 5 * (themeSentiment + 1);
}

/**
 * B.11: Severity Ranking
 * Formula: Severity = |min(S_theme, 0)| × log(1 + mentions)
 */
function calculateSeverity(themeSentiment: number, mentions: number): number {
  const negativePart = Math.abs(Math.min(themeSentiment, 0));
  return negativePart * Math.log(1 + mentions);
}

// ============================================================
// SECTION C: REMEDIAL ACTION TRACKING
// ============================================================

/**
 * C.12: Pre/Post Change (ΔS)
 * Formula: ΔS = S_after - S_before
 */
function calculateDeltaS(scoreBefore: number, scoreAfter: number): number {
  return scoreAfter - scoreBefore;
}

/**
 * C.13: Fix Effectiveness Score
 * Formula: FixScore = ΔS × log(1 + review_count) × Confidence
 */
function calculateFixScore(
  deltaS: number,
  reviewCount: number,
  confidence: number
): number {
  return deltaS * Math.log(1 + reviewCount) * confidence;
}

/**
 * Determine confidence level based on review count
 */
function getConfidenceLevel(
  reviewCount: number,
  params: ParameterSet
): { level: ConfidenceLevel; value: number } {
  const thresholds = params.fix_tracking.confidence_thresholds;
  
  if (reviewCount >= thresholds.high) {
    return { level: 'HIGH', value: 1.0 };
  }
  if (reviewCount >= thresholds.medium) {
    return { level: 'MEDIUM', value: 0.7 };
  }
  if (reviewCount >= thresholds.low) {
    return { level: 'LOW', value: 0.4 };
  }
  return { level: 'INSUFFICIENT', value: 0 };
}
```

### SQL Aggregation Queries

```sql
-- Theme Score Aggregation (after review scores are stored)
SELECT 
  rt.theme_id,
  COUNT(*) as mention_count,
  COUNT(*) FILTER (WHERE rt.sentiment = 'POSITIVE') as positive_count,
  COUNT(*) FILTER (WHERE rt.sentiment = 'NEUTRAL') as neutral_count,
  COUNT(*) FILTER (WHERE rt.sentiment = 'NEGATIVE') as negative_count,
  
  SUM(rs.weighted_impact) as sum_wr,
  SUM(ABS(rs.weighted_impact)) as sum_abs_wr,
  
  -- S_theme = ΣW_r / Σ|W_r|
  CASE 
    WHEN SUM(ABS(rs.weighted_impact)) = 0 THEN 0
    ELSE SUM(rs.weighted_impact) / SUM(ABS(rs.weighted_impact))
  END as theme_sentiment,
  
  -- Score_0_10 = 5 × (S_theme + 1)
  5 * (1 + CASE 
    WHEN SUM(ABS(rs.weighted_impact)) = 0 THEN 0
    ELSE SUM(rs.weighted_impact) / SUM(ABS(rs.weighted_impact))
  END) as theme_score_010,
  
  -- Severity = |min(S_theme, 0)| × log(1 + mentions)
  ABS(LEAST(
    CASE 
      WHEN SUM(ABS(rs.weighted_impact)) = 0 THEN 0
      ELSE SUM(rs.weighted_impact) / SUM(ABS(rs.weighted_impact))
    END,
    0
  )) * LN(1 + COUNT(*)) as severity

FROM review_scores rs
JOIN review_themes rt ON rs.review_id = rt.review_id
WHERE rs.score_run_id = $1
GROUP BY rt.theme_id
ORDER BY severity DESC;
```

```sql
-- Fix Score Calculation (before/after comparison)
WITH before_period AS (
  SELECT 
    rt.theme_id,
    CASE 
      WHEN SUM(ABS(rs.weighted_impact)) = 0 THEN 0
      ELSE SUM(rs.weighted_impact) / SUM(ABS(rs.weighted_impact))
    END as sentiment,
    COUNT(*) as review_count
  FROM review_scores rs
  JOIN reviews r ON rs.review_id = r.id
  JOIN review_themes rt ON r.id = rt.review_id
  WHERE r.review_date BETWEEN $1 AND $2  -- pre_window
    AND rt.theme_id = $3
  GROUP BY rt.theme_id
),
after_period AS (
  SELECT 
    rt.theme_id,
    CASE 
      WHEN SUM(ABS(rs.weighted_impact)) = 0 THEN 0
      ELSE SUM(rs.weighted_impact) / SUM(ABS(rs.weighted_impact))
    END as sentiment,
    COUNT(*) as review_count
  FROM review_scores rs
  JOIN reviews r ON rs.review_id = r.id
  JOIN review_themes rt ON r.id = rt.review_id
  WHERE r.review_date BETWEEN $4 AND $5  -- post_window
    AND rt.theme_id = $3
  GROUP BY rt.theme_id
)
SELECT 
  b.sentiment as baseline_score,
  a.sentiment as current_score,
  (a.sentiment - b.sentiment) as delta_s,
  b.review_count as review_count_pre,
  a.review_count as review_count_post,
  -- FixScore = ΔS × log(1 + review_count) × Confidence
  (a.sentiment - b.sentiment) * LN(1 + a.review_count) as fix_score_raw
FROM before_period b
CROSS JOIN after_period a;
```

---

## Appendix: Default Parameter Values

```json
{
  "sentiment": {
    "model_version": "gpt-4-turbo",
    "use_star_rating": true,
    "language_handling_mode": "multilingual_model"
  },
  "time": {
    "review_half_life_days": 60
  },
  "source": {
    "weights": {
      "google": 1.20,
      "hellopeter": 1.15,
      "tripadvisor": 1.00,
      "facebook": 0.90,
      "yelp": 1.00,
      "zomato": 1.00,
      "opentable": 0.90,
      "website": 0.80,
      "instagram": 0.80,
      "twitter": 0.70
    },
    "min_weight": 0.60,
    "max_weight": 1.40
  },
  "engagement": {
    "enabled_by_source": {
      "google": true,
      "facebook": true,
      "tripadvisor": true,
      "hellopeter": false,
      "yelp": true
    },
    "cap": 1.30
  },
  "confidence": {
    "rules_version": "1.0.0",
    "min_text_length_chars": 20,
    "duplicate_similarity_threshold": 0.85,
    "low_confidence_floor": 0.60,
    "vague_review_weight": 0.70,
    "duplicate_review_weight": 0.60
  },
  "fix_tracking": {
    "pre_window_days": 30,
    "post_window_days": 30,
    "min_reviews_for_inference": 5,
    "confidence_thresholds": {
      "high": 10,
      "medium": 5,
      "low": 2
    }
  }
}
```
