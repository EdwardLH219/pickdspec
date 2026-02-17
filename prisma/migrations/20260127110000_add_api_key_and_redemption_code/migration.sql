-- CreateTable: ApiKey
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: ApiKey
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");
CREATE INDEX "ApiKey_tenantId_idx" ON "ApiKey"("tenantId");
CREATE INDEX "ApiKey_keyHash_idx" ON "ApiKey"("keyHash");
CREATE INDEX "ApiKey_isActive_expiresAt_idx" ON "ApiKey"("isActive", "expiresAt");

-- AddForeignKey: ApiKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: TillReviewSubmission - Add redemptionCode
ALTER TABLE "TillReviewSubmission" ADD COLUMN "redemptionCode" TEXT;

-- CreateIndex: TillReviewSubmission.redemptionCode
CREATE UNIQUE INDEX "TillReviewSubmission_redemptionCode_key" ON "TillReviewSubmission"("redemptionCode");
CREATE INDEX "TillReviewSubmission_redemptionCode_idx" ON "TillReviewSubmission"("redemptionCode");
