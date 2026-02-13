-- CreateEnum
CREATE TYPE "ImpactDriver" AS ENUM ('ACQUISITION', 'CONVERSION', 'RETENTION');

-- CreateEnum
CREATE TYPE "EconomicConfidenceLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT_DATA');

-- CreateTable
CREATE TABLE "RecommendationEconomicImpact" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "revenueAtRiskMin" DOUBLE PRECISION,
    "revenueAtRiskMax" DOUBLE PRECISION,
    "revenueAtRiskMid" DOUBLE PRECISION,
    "revenueUpsideMin" DOUBLE PRECISION,
    "revenueUpsideMax" DOUBLE PRECISION,
    "revenueUpsideMid" DOUBLE PRECISION,
    "footfallAtRiskMin" INTEGER,
    "footfallAtRiskMax" INTEGER,
    "footfallUpsideMin" INTEGER,
    "footfallUpsideMax" INTEGER,
    "impactDriver" "ImpactDriver" NOT NULL DEFAULT 'RETENTION',
    "impactDriverScore" DOUBLE PRECISION,
    "confidenceLevel" "EconomicConfidenceLevel" NOT NULL DEFAULT 'INSUFFICIENT_DATA',
    "dataQualityScore" DOUBLE PRECISION,
    "explainPayload" JSONB NOT NULL,
    "inputSeverity" TEXT NOT NULL,
    "inputMentionCount" INTEGER NOT NULL,
    "inputSentimentScore" DOUBLE PRECISION,
    "inputThemeScore010" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationEconomicImpact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecommendationEconomicImpact_tenantId_idx" ON "RecommendationEconomicImpact"("tenantId");

-- CreateIndex
CREATE INDEX "RecommendationEconomicImpact_snapshotId_idx" ON "RecommendationEconomicImpact"("snapshotId");

-- CreateIndex
CREATE INDEX "RecommendationEconomicImpact_recommendationId_idx" ON "RecommendationEconomicImpact"("recommendationId");

-- CreateIndex
CREATE INDEX "RecommendationEconomicImpact_confidenceLevel_idx" ON "RecommendationEconomicImpact"("confidenceLevel");

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationEconomicImpact_snapshotId_recommendationId_key" ON "RecommendationEconomicImpact"("snapshotId", "recommendationId");

-- AddForeignKey
ALTER TABLE "RecommendationEconomicImpact" ADD CONSTRAINT "RecommendationEconomicImpact_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "EconomicImpactSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationEconomicImpact" ADD CONSTRAINT "RecommendationEconomicImpact_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationEconomicImpact" ADD CONSTRAINT "RecommendationEconomicImpact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
