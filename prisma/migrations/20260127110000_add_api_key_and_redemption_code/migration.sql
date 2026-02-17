-- CreateTable: ApiKey (if not exists)
CREATE TABLE IF NOT EXISTS "ApiKey" (
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

-- CreateIndex: ApiKey (if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_keyHash_key" ON "ApiKey"("keyHash");
CREATE INDEX IF NOT EXISTS "ApiKey_tenantId_idx" ON "ApiKey"("tenantId");
CREATE INDEX IF NOT EXISTS "ApiKey_keyHash_idx" ON "ApiKey"("keyHash");
CREATE INDEX IF NOT EXISTS "ApiKey_isActive_expiresAt_idx" ON "ApiKey"("isActive", "expiresAt");

-- AddForeignKey: ApiKey (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ApiKey_tenantId_fkey') THEN
        ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AlterTable: TillReviewSubmission - Add redemptionCode (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'TillReviewSubmission' AND column_name = 'redemptionCode') THEN
        ALTER TABLE "TillReviewSubmission" ADD COLUMN "redemptionCode" TEXT;
    END IF;
END $$;

-- CreateIndex: TillReviewSubmission.redemptionCode (if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS "TillReviewSubmission_redemptionCode_key" ON "TillReviewSubmission"("redemptionCode");
CREATE INDEX IF NOT EXISTS "TillReviewSubmission_redemptionCode_idx" ON "TillReviewSubmission"("redemptionCode");
