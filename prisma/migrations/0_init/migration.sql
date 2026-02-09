-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('STARTER', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "AccessLevel" AS ENUM ('READ', 'WRITE', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PICKD_ADMIN', 'PICKD_SUPPORT', 'OWNER', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('GOOGLE', 'HELLOPETER', 'FACEBOOK', 'TRIPADVISOR', 'YELP', 'ZOMATO', 'OPENTABLE', 'WEBSITE', 'INSTAGRAM', 'TWITTER');

-- CreateEnum
CREATE TYPE "SyncFrequency" AS ENUM ('HOURLY', 'DAILY', 'WEEKLY', 'MANUAL');

-- CreateEnum
CREATE TYPE "ConnectorStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'ERROR', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "IngestionRunType" AS ENUM ('SCHEDULED', 'MANUAL', 'BACKFILL', 'RETRY');

-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "IngestionErrorType" AS ENUM ('API_ERROR', 'RATE_LIMIT', 'AUTH_FAILURE', 'PARSE_ERROR', 'VALIDATION_ERROR', 'DUPLICATE', 'TIMEOUT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ThemeCategory" AS ENUM ('SERVICE', 'PRODUCT', 'AMBIANCE', 'VALUE', 'CLEANLINESS', 'LOCATION', 'OTHER');

-- CreateEnum
CREATE TYPE "Sentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "ParameterStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RuleSetCategory" AS ENUM ('RECOMMENDATION', 'ALERT', 'SCORING', 'AUTOMATION');

-- CreateEnum
CREATE TYPE "RuleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ScoreRunType" AS ENUM ('SCHEDULED', 'MANUAL', 'RECALCULATION', 'PARAMETER_CHANGE');

-- CreateEnum
CREATE TYPE "ScoreRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "TrendDirection" AS ENUM ('IMPROVING', 'STABLE', 'DECLINING');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('INSUFFICIENT', 'LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "RecommendationSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "RecommendationCategory" AS ENUM ('URGENT_ISSUE', 'IMPROVEMENT', 'OPPORTUNITY', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('URGENT', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT', 'ACTIVATE', 'DEACTIVATE', 'TRIGGER', 'ACCESS');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'STARTER',
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Johannesburg',
    "googlePlaceId" TEXT,
    "hellopeterBusinessId" TEXT,
    "tripadvisorId" TEXT,
    "facebookPageId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "passwordHash" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isPickdStaff" BOOLEAN NOT NULL DEFAULT false,
    "tenantAccess" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "image" TEXT,
    "avatarUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'MEMBER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "invitedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchAccess" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accessLevel" "AccessLevel" NOT NULL DEFAULT 'READ',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BranchAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Connector" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "name" TEXT NOT NULL,
    "externalId" TEXT,
    "externalUrl" TEXT,
    "externalConfig" JSONB,
    "syncFrequency" "SyncFrequency" NOT NULL DEFAULT 'DAILY',
    "lastSyncedAt" TIMESTAMP(3),
    "nextSyncAt" TIMESTAMP(3),
    "status" "ConnectorStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "runType" "IngestionRunType" NOT NULL DEFAULT 'SCHEDULED',
    "status" "IngestionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewsFetched" INTEGER NOT NULL DEFAULT 0,
    "reviewsCreated" INTEGER NOT NULL DEFAULT 0,
    "reviewsUpdated" INTEGER NOT NULL DEFAULT 0,
    "reviewsSkipped" INTEGER NOT NULL DEFAULT 0,
    "duplicatesFound" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "paginationState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionError" (
    "id" TEXT NOT NULL,
    "ingestionRunId" TEXT NOT NULL,
    "errorType" "IngestionErrorType" NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT NOT NULL,
    "context" JSONB,
    "isRetryable" BOOLEAN NOT NULL DEFAULT true,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestionError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "externalReviewId" TEXT NOT NULL,
    "rating" INTEGER,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "authorName" TEXT,
    "authorId" TEXT,
    "reviewDate" TIMESTAMP(3) NOT NULL,
    "responseText" TEXT,
    "responseDate" TIMESTAMP(3),
    "respondedBy" TEXT,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "repliesCount" INTEGER NOT NULL DEFAULT 0,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "detectedLanguage" TEXT,
    "sentimentRaw" DOUBLE PRECISION,
    "contentHash" TEXT,
    "textLength" INTEGER,
    "duplicateSimilarity" DOUBLE PRECISION,
    "qualityFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Theme" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "category" "ThemeCategory" NOT NULL,
    "description" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "color" TEXT,
    "icon" TEXT,
    "matchingRules" JSONB,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Theme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewTheme" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "sentiment" "Sentiment" NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "excerpt" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewTheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParameterSetVersion" (
    "id" TEXT NOT NULL,
    "versionNumber" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parameters" JSONB NOT NULL,
    "status" "ParameterStatus" NOT NULL DEFAULT 'DRAFT',
    "activatedAt" TIMESTAMP(3),
    "activatedById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParameterSetVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleSet" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "RuleSetCategory" NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuleSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleSetVersion" (
    "id" TEXT NOT NULL,
    "ruleSetId" TEXT NOT NULL,
    "versionNumber" SERIAL NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "rules" JSONB NOT NULL,
    "status" "RuleStatus" NOT NULL DEFAULT 'DRAFT',
    "activatedAt" TIMESTAMP(3),
    "activatedById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuleSetVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "parameterVersionId" TEXT NOT NULL,
    "ruleSetVersionId" TEXT,
    "runType" "ScoreRunType" NOT NULL,
    "status" "ScoreRunStatus" NOT NULL DEFAULT 'PENDING',
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "reviewsProcessed" INTEGER NOT NULL DEFAULT 0,
    "themesProcessed" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "triggeredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewScore" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "scoreRunId" TEXT NOT NULL,
    "baseSentiment" DOUBLE PRECISION NOT NULL,
    "timeWeight" DOUBLE PRECISION NOT NULL,
    "sourceWeight" DOUBLE PRECISION NOT NULL,
    "engagementWeight" DOUBLE PRECISION NOT NULL,
    "confidenceWeight" DOUBLE PRECISION NOT NULL,
    "weightedImpact" DOUBLE PRECISION NOT NULL,
    "components" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThemeScore" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "scoreRunId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "mentionCount" INTEGER NOT NULL,
    "positiveCount" INTEGER NOT NULL,
    "neutralCount" INTEGER NOT NULL,
    "negativeCount" INTEGER NOT NULL,
    "sumWeightedImpact" DOUBLE PRECISION NOT NULL,
    "sumAbsWeightedImpact" DOUBLE PRECISION NOT NULL,
    "themeSentiment" DOUBLE PRECISION NOT NULL,
    "themeScore010" DOUBLE PRECISION NOT NULL,
    "severity" DOUBLE PRECISION NOT NULL,
    "trendDirection" "TrendDirection",
    "trendMagnitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThemeScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixScore" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "taskId" TEXT,
    "scoreRunId" TEXT NOT NULL,
    "baselineScore" DOUBLE PRECISION NOT NULL,
    "currentScore" DOUBLE PRECISION NOT NULL,
    "deltaS" DOUBLE PRECISION NOT NULL,
    "reviewCountPre" INTEGER NOT NULL,
    "reviewCountPost" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "confidenceLevel" "ConfidenceLevel" NOT NULL,
    "fixScore" DOUBLE PRECISION NOT NULL,
    "measurementStart" TIMESTAMP(3) NOT NULL,
    "measurementEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "themeId" TEXT,
    "severity" "RecommendationSeverity" NOT NULL,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'OPEN',
    "category" "RecommendationCategory" NOT NULL DEFAULT 'IMPROVEMENT',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "suggestedActions" JSONB NOT NULL DEFAULT '[]',
    "evidenceReviewIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "estimatedImpact" TEXT,
    "triggerReason" TEXT,
    "triggerThreshold" DOUBLE PRECISION,
    "autoGenerated" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "recommendationId" TEXT,
    "themeId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "assignedToId" TEXT,
    "dueDate" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "impactNotes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "actorRole" "UserRole" NOT NULL,
    "action" "AuditAction" NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "tenantId" TEXT,
    "organizationId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_slug_idx" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_subscriptionStatus_idx" ON "Organization"("subscriptionStatus");

-- CreateIndex
CREATE INDEX "Tenant_organizationId_idx" ON "Tenant"("organizationId");

-- CreateIndex
CREATE INDEX "Tenant_organizationId_isActive_idx" ON "Tenant"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "Tenant_googlePlaceId_idx" ON "Tenant"("googlePlaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_organizationId_slug_key" ON "Tenant"("organizationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_isPickdStaff_idx" ON "User"("isPickdStaff");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Membership_organizationId_idx" ON "Membership"("organizationId");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_organizationId_key" ON "Membership"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "BranchAccess_tenantId_idx" ON "BranchAccess"("tenantId");

-- CreateIndex
CREATE INDEX "BranchAccess_membershipId_idx" ON "BranchAccess"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "BranchAccess_membershipId_tenantId_key" ON "BranchAccess"("membershipId", "tenantId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Connector_tenantId_idx" ON "Connector"("tenantId");

-- CreateIndex
CREATE INDEX "Connector_tenantId_status_idx" ON "Connector"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Connector_status_nextSyncAt_idx" ON "Connector"("status", "nextSyncAt");

-- CreateIndex
CREATE UNIQUE INDEX "Connector_tenantId_sourceType_key" ON "Connector"("tenantId", "sourceType");

-- CreateIndex
CREATE INDEX "IngestionRun_tenantId_createdAt_idx" ON "IngestionRun"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "IngestionRun_connectorId_createdAt_idx" ON "IngestionRun"("connectorId", "createdAt");

-- CreateIndex
CREATE INDEX "IngestionRun_status_idx" ON "IngestionRun"("status");

-- CreateIndex
CREATE INDEX "IngestionError_ingestionRunId_idx" ON "IngestionError"("ingestionRunId");

-- CreateIndex
CREATE INDEX "IngestionError_errorType_idx" ON "IngestionError"("errorType");

-- CreateIndex
CREATE INDEX "Review_tenantId_reviewDate_idx" ON "Review"("tenantId", "reviewDate");

-- CreateIndex
CREATE INDEX "Review_tenantId_reviewDate_rating_idx" ON "Review"("tenantId", "reviewDate", "rating");

-- CreateIndex
CREATE INDEX "Review_connectorId_reviewDate_idx" ON "Review"("connectorId", "reviewDate");

-- CreateIndex
CREATE INDEX "Review_contentHash_idx" ON "Review"("contentHash");

-- CreateIndex
CREATE INDEX "Review_detectedLanguage_idx" ON "Review"("detectedLanguage");

-- CreateIndex
CREATE UNIQUE INDEX "Review_connectorId_externalReviewId_key" ON "Review"("connectorId", "externalReviewId");

-- CreateIndex
CREATE INDEX "Theme_organizationId_idx" ON "Theme"("organizationId");

-- CreateIndex
CREATE INDEX "Theme_isSystem_idx" ON "Theme"("isSystem");

-- CreateIndex
CREATE INDEX "Theme_category_idx" ON "Theme"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Theme_organizationId_name_key" ON "Theme"("organizationId", "name");

-- CreateIndex
CREATE INDEX "ReviewTheme_themeId_idx" ON "ReviewTheme"("themeId");

-- CreateIndex
CREATE INDEX "ReviewTheme_reviewId_sentiment_idx" ON "ReviewTheme"("reviewId", "sentiment");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewTheme_reviewId_themeId_key" ON "ReviewTheme"("reviewId", "themeId");

-- CreateIndex
CREATE INDEX "ParameterSetVersion_status_idx" ON "ParameterSetVersion"("status");

-- CreateIndex
CREATE INDEX "ParameterSetVersion_activatedAt_idx" ON "ParameterSetVersion"("activatedAt");

-- CreateIndex
CREATE INDEX "RuleSet_organizationId_idx" ON "RuleSet"("organizationId");

-- CreateIndex
CREATE INDEX "RuleSet_isSystem_idx" ON "RuleSet"("isSystem");

-- CreateIndex
CREATE INDEX "RuleSet_category_idx" ON "RuleSet"("category");

-- CreateIndex
CREATE UNIQUE INDEX "RuleSet_organizationId_name_key" ON "RuleSet"("organizationId", "name");

-- CreateIndex
CREATE INDEX "RuleSetVersion_ruleSetId_status_idx" ON "RuleSetVersion"("ruleSetId", "status");

-- CreateIndex
CREATE INDEX "RuleSetVersion_activatedAt_idx" ON "RuleSetVersion"("activatedAt");

-- CreateIndex
CREATE INDEX "ScoreRun_tenantId_createdAt_idx" ON "ScoreRun"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ScoreRun_tenantId_periodStart_periodEnd_idx" ON "ScoreRun"("tenantId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "ScoreRun_status_idx" ON "ScoreRun"("status");

-- CreateIndex
CREATE INDEX "ReviewScore_scoreRunId_idx" ON "ReviewScore"("scoreRunId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewScore_reviewId_scoreRunId_key" ON "ReviewScore"("reviewId", "scoreRunId");

-- CreateIndex
CREATE INDEX "ThemeScore_tenantId_scoreRunId_idx" ON "ThemeScore"("tenantId", "scoreRunId");

-- CreateIndex
CREATE INDEX "ThemeScore_tenantId_periodStart_periodEnd_idx" ON "ThemeScore"("tenantId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "ThemeScore_severity_idx" ON "ThemeScore"("severity" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ThemeScore_themeId_scoreRunId_key" ON "ThemeScore"("themeId", "scoreRunId");

-- CreateIndex
CREATE INDEX "FixScore_tenantId_themeId_idx" ON "FixScore"("tenantId", "themeId");

-- CreateIndex
CREATE INDEX "FixScore_tenantId_measurementStart_measurementEnd_idx" ON "FixScore"("tenantId", "measurementStart", "measurementEnd");

-- CreateIndex
CREATE INDEX "FixScore_taskId_idx" ON "FixScore"("taskId");

-- CreateIndex
CREATE INDEX "Recommendation_tenantId_status_idx" ON "Recommendation"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Recommendation_tenantId_createdAt_idx" ON "Recommendation"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Recommendation_severity_idx" ON "Recommendation"("severity");

-- CreateIndex
CREATE INDEX "Recommendation_category_idx" ON "Recommendation"("category");

-- CreateIndex
CREATE INDEX "Task_tenantId_status_idx" ON "Task"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Task_tenantId_dueDate_idx" ON "Task"("tenantId", "dueDate");

-- CreateIndex
CREATE INDEX "Task_tenantId_createdAt_idx" ON "Task"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Task_assignedToId_idx" ON "Task"("assignedToId");

-- CreateIndex
CREATE INDEX "Task_priority_idx" ON "Task"("priority");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_resourceType_resourceId_idx" ON "AuditLog"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchAccess" ADD CONSTRAINT "BranchAccess_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchAccess" ADD CONSTRAINT "BranchAccess_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connector" ADD CONSTRAINT "Connector_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionRun" ADD CONSTRAINT "IngestionRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionRun" ADD CONSTRAINT "IngestionRun_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "Connector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionError" ADD CONSTRAINT "IngestionError_ingestionRunId_fkey" FOREIGN KEY ("ingestionRunId") REFERENCES "IngestionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "Connector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Theme" ADD CONSTRAINT "Theme_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewTheme" ADD CONSTRAINT "ReviewTheme_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewTheme" ADD CONSTRAINT "ReviewTheme_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParameterSetVersion" ADD CONSTRAINT "ParameterSetVersion_activatedById_fkey" FOREIGN KEY ("activatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParameterSetVersion" ADD CONSTRAINT "ParameterSetVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleSet" ADD CONSTRAINT "RuleSet_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleSetVersion" ADD CONSTRAINT "RuleSetVersion_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "RuleSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleSetVersion" ADD CONSTRAINT "RuleSetVersion_activatedById_fkey" FOREIGN KEY ("activatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleSetVersion" ADD CONSTRAINT "RuleSetVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreRun" ADD CONSTRAINT "ScoreRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreRun" ADD CONSTRAINT "ScoreRun_parameterVersionId_fkey" FOREIGN KEY ("parameterVersionId") REFERENCES "ParameterSetVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreRun" ADD CONSTRAINT "ScoreRun_ruleSetVersionId_fkey" FOREIGN KEY ("ruleSetVersionId") REFERENCES "RuleSetVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreRun" ADD CONSTRAINT "ScoreRun_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewScore" ADD CONSTRAINT "ReviewScore_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewScore" ADD CONSTRAINT "ReviewScore_scoreRunId_fkey" FOREIGN KEY ("scoreRunId") REFERENCES "ScoreRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThemeScore" ADD CONSTRAINT "ThemeScore_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThemeScore" ADD CONSTRAINT "ThemeScore_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThemeScore" ADD CONSTRAINT "ThemeScore_scoreRunId_fkey" FOREIGN KEY ("scoreRunId") REFERENCES "ScoreRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixScore" ADD CONSTRAINT "FixScore_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixScore" ADD CONSTRAINT "FixScore_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixScore" ADD CONSTRAINT "FixScore_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixScore" ADD CONSTRAINT "FixScore_scoreRunId_fkey" FOREIGN KEY ("scoreRunId") REFERENCES "ScoreRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

