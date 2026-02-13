-- CreateEnum
CREATE TYPE "CustomerSummaryPeriod" AS ENUM ('SIX_MONTHS', 'THREE_MONTHS', 'TWO_WEEKS');

-- CreateTable
CREATE TABLE "CustomerSummary" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodType" "CustomerSummaryPeriod" NOT NULL,
    "summary" TEXT NOT NULL,
    "reviewCount" INTEGER NOT NULL,
    "dateRangeFrom" TIMESTAMP(3) NOT NULL,
    "dateRangeTo" TIMESTAMP(3) NOT NULL,
    "themesIncluded" JSONB,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER,
    "totalTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerSummary_tenantId_idx" ON "CustomerSummary"("tenantId");

-- CreateIndex
CREATE INDEX "CustomerSummary_tenantId_periodType_idx" ON "CustomerSummary"("tenantId", "periodType");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerSummary_tenantId_periodType_key" ON "CustomerSummary"("tenantId", "periodType");

-- AddForeignKey
ALTER TABLE "CustomerSummary" ADD CONSTRAINT "CustomerSummary_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
