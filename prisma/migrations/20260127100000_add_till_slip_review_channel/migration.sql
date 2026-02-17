-- Add TILL_SLIP to SourceType enum
ALTER TYPE "SourceType" ADD VALUE 'TILL_SLIP';

-- CreateEnum: TillIncentiveType
CREATE TYPE "TillIncentiveType" AS ENUM ('NONE', 'DISCOUNT', 'PRIZE_DRAW', 'CUSTOM');

-- CreateEnum: TillReceiptStatus
CREATE TYPE "TillReceiptStatus" AS ENUM ('ISSUED', 'SUBMITTED', 'REDEEMED', 'EXPIRED');

-- CreateTable: TillReviewSettings
CREATE TABLE "TillReviewSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "shortCode" TEXT NOT NULL,
    "incentiveType" "TillIncentiveType" NOT NULL DEFAULT 'NONE',
    "incentiveTitle" TEXT,
    "incentiveDescription" TEXT,
    "discountPercent" INTEGER,
    "discountTerms" TEXT,
    "prizeDrawTitle" TEXT,
    "prizeDrawDescription" TEXT,
    "prizeDrawTerms" TEXT,
    "headerColor" TEXT,
    "accentColor" TEXT,
    "logoUrl" TEXT,
    "tokenExpiryDays" INTEGER NOT NULL DEFAULT 30,
    "allowRepeatSubmissions" BOOLEAN NOT NULL DEFAULT false,
    "requireReceiptNumber" BOOLEAN NOT NULL DEFAULT false,
    "redirectToGoogleReview" BOOLEAN NOT NULL DEFAULT true,
    "googleReviewUrl" TEXT,
    "themeOptions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TillReviewSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TillReceipt
CREATE TABLE "TillReceipt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "settingsId" TEXT NOT NULL,
    "receiptRef" TEXT,
    "receiptRefHash" TEXT,
    "receiptLastFour" TEXT,
    "token" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "TillReceiptStatus" NOT NULL DEFAULT 'ISSUED',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TillReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TillReviewSubmission
CREATE TABLE "TillReviewSubmission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "overallRating" INTEGER NOT NULL,
    "positiveThemes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "negativeThemes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "positiveDetail" TEXT,
    "negativeDetail" TEXT,
    "anythingElse" TEXT,
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "contactOptIn" BOOLEAN NOT NULL DEFAULT false,
    "contactEmail" TEXT,
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "deviceFingerprint" TEXT,
    "spamScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "incentiveCode" TEXT,
    "incentiveCodeExpiry" TIMESTAMP(3),
    "incentiveRedeemed" BOOLEAN NOT NULL DEFAULT false,
    "incentiveRedeemedAt" TIMESTAMP(3),
    "incentiveRedeemedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TillReviewSubmission_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Review (make connectorId optional, add tillReviewSubmissionId)
ALTER TABLE "Review" ALTER COLUMN "connectorId" DROP NOT NULL;
ALTER TABLE "Review" ALTER COLUMN "externalReviewId" DROP NOT NULL;
ALTER TABLE "Review" ADD COLUMN "tillReviewSubmissionId" TEXT;

-- CreateIndexes: TillReviewSettings
CREATE UNIQUE INDEX "TillReviewSettings_shortCode_key" ON "TillReviewSettings"("shortCode");
CREATE UNIQUE INDEX "TillReviewSettings_tenantId_key" ON "TillReviewSettings"("tenantId");
CREATE INDEX "TillReviewSettings_shortCode_idx" ON "TillReviewSettings"("shortCode");
CREATE INDEX "TillReviewSettings_tenantId_isActive_idx" ON "TillReviewSettings"("tenantId", "isActive");

-- CreateIndexes: TillReceipt
CREATE UNIQUE INDEX "TillReceipt_token_key" ON "TillReceipt"("token");
CREATE UNIQUE INDEX "TillReceipt_tokenHash_key" ON "TillReceipt"("tokenHash");
CREATE INDEX "TillReceipt_tenantId_status_idx" ON "TillReceipt"("tenantId", "status");
CREATE INDEX "TillReceipt_settingsId_status_idx" ON "TillReceipt"("settingsId", "status");
CREATE INDEX "TillReceipt_token_idx" ON "TillReceipt"("token");
CREATE INDEX "TillReceipt_tokenHash_idx" ON "TillReceipt"("tokenHash");
CREATE INDEX "TillReceipt_tenantId_receiptRefHash_idx" ON "TillReceipt"("tenantId", "receiptRefHash");
CREATE INDEX "TillReceipt_expiresAt_idx" ON "TillReceipt"("expiresAt");

-- CreateIndexes: TillReviewSubmission
CREATE UNIQUE INDEX "TillReviewSubmission_receiptId_key" ON "TillReviewSubmission"("receiptId");
CREATE INDEX "TillReviewSubmission_tenantId_createdAt_idx" ON "TillReviewSubmission"("tenantId", "createdAt");
CREATE INDEX "TillReviewSubmission_receiptId_idx" ON "TillReviewSubmission"("receiptId");
CREATE INDEX "TillReviewSubmission_incentiveCode_idx" ON "TillReviewSubmission"("incentiveCode");
CREATE INDEX "TillReviewSubmission_tenantId_isFlagged_idx" ON "TillReviewSubmission"("tenantId", "isFlagged");
CREATE INDEX "TillReviewSubmission_deviceFingerprint_idx" ON "TillReviewSubmission"("deviceFingerprint");

-- CreateIndex: Review.tillReviewSubmissionId
CREATE UNIQUE INDEX "Review_tillReviewSubmissionId_key" ON "Review"("tillReviewSubmissionId");
CREATE INDEX "Review_tillReviewSubmissionId_idx" ON "Review"("tillReviewSubmissionId");

-- AddForeignKey: TillReviewSettings
ALTER TABLE "TillReviewSettings" ADD CONSTRAINT "TillReviewSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: TillReceipt
ALTER TABLE "TillReceipt" ADD CONSTRAINT "TillReceipt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TillReceipt" ADD CONSTRAINT "TillReceipt_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "TillReviewSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: TillReviewSubmission
ALTER TABLE "TillReviewSubmission" ADD CONSTRAINT "TillReviewSubmission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TillReviewSubmission" ADD CONSTRAINT "TillReviewSubmission_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "TillReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Review.tillReviewSubmissionId
ALTER TABLE "Review" ADD CONSTRAINT "Review_tillReviewSubmissionId_fkey" FOREIGN KEY ("tillReviewSubmissionId") REFERENCES "TillReviewSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
