-- CreateTable
CREATE TABLE "ThemeEconomicWeight" (
    "id" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "revenueImpactWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "footfallImpactWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "conversionImpactWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "categoryMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "activatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activatedAt" TIMESTAMP(3),

    CONSTRAINT "ThemeEconomicWeight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantBaselineMetrics" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "coversPerMonth" INTEGER,
    "seatCapacity" INTEGER,
    "averageTurnover" DOUBLE PRECISION,
    "averageSpendPerCover" DOUBLE PRECISION,
    "averageOrderValue" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "daysOpenPerWeek" INTEGER DEFAULT 7,
    "servicesPerDay" INTEGER DEFAULT 2,
    "dataSource" TEXT,
    "confidenceLevel" DOUBLE PRECISION DEFAULT 0.8,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantBaselineMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelMetrics" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "searchViews" INTEGER,
    "mapViews" INTEGER,
    "websiteClicks" INTEGER,
    "directionsRequests" INTEGER,
    "phoneCalls" INTEGER,
    "messagesSent" INTEGER,
    "bookingsInitiated" INTEGER,
    "photoViews" INTEGER,
    "photoCount" INTEGER,
    "totalReviews" INTEGER,
    "averageRating" DOUBLE PRECISION,
    "newReviewsInPeriod" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'google_business_profile',
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EconomicImpactSnapshot" (
    "id" TEXT NOT NULL,
    "scoreRunId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "economicParameters" JSONB NOT NULL,
    "baselineMetrics" JSONB,
    "estimatedRevenueImpact" DOUBLE PRECISION,
    "estimatedFootfallImpact" INTEGER,
    "estimatedConversionImpact" DOUBLE PRECISION,
    "dataQualityScore" DOUBLE PRECISION,
    "confidenceLevel" TEXT,
    "themeImpacts" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EconomicImpactSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ThemeEconomicWeight_themeId_isActive_idx" ON "ThemeEconomicWeight"("themeId", "isActive");

-- CreateIndex
CREATE INDEX "ThemeEconomicWeight_isActive_idx" ON "ThemeEconomicWeight"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ThemeEconomicWeight_themeId_version_key" ON "ThemeEconomicWeight"("themeId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantBaselineMetrics_tenantId_key" ON "RestaurantBaselineMetrics"("tenantId");

-- CreateIndex
CREATE INDEX "RestaurantBaselineMetrics_tenantId_idx" ON "RestaurantBaselineMetrics"("tenantId");

-- CreateIndex
CREATE INDEX "ChannelMetrics_tenantId_idx" ON "ChannelMetrics"("tenantId");

-- CreateIndex
CREATE INDEX "ChannelMetrics_periodStart_periodEnd_idx" ON "ChannelMetrics"("periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelMetrics_tenantId_periodStart_periodEnd_source_key" ON "ChannelMetrics"("tenantId", "periodStart", "periodEnd", "source");

-- CreateIndex
CREATE UNIQUE INDEX "EconomicImpactSnapshot_scoreRunId_key" ON "EconomicImpactSnapshot"("scoreRunId");

-- CreateIndex
CREATE INDEX "EconomicImpactSnapshot_tenantId_idx" ON "EconomicImpactSnapshot"("tenantId");

-- CreateIndex
CREATE INDEX "EconomicImpactSnapshot_scoreRunId_idx" ON "EconomicImpactSnapshot"("scoreRunId");

-- AddForeignKey
ALTER TABLE "ThemeEconomicWeight" ADD CONSTRAINT "ThemeEconomicWeight_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThemeEconomicWeight" ADD CONSTRAINT "ThemeEconomicWeight_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThemeEconomicWeight" ADD CONSTRAINT "ThemeEconomicWeight_activatedById_fkey" FOREIGN KEY ("activatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantBaselineMetrics" ADD CONSTRAINT "RestaurantBaselineMetrics_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantBaselineMetrics" ADD CONSTRAINT "RestaurantBaselineMetrics_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantBaselineMetrics" ADD CONSTRAINT "RestaurantBaselineMetrics_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelMetrics" ADD CONSTRAINT "ChannelMetrics_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EconomicImpactSnapshot" ADD CONSTRAINT "EconomicImpactSnapshot_scoreRunId_fkey" FOREIGN KEY ("scoreRunId") REFERENCES "ScoreRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EconomicImpactSnapshot" ADD CONSTRAINT "EconomicImpactSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
