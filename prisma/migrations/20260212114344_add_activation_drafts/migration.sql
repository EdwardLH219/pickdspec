-- CreateEnum
CREATE TYPE "ActivationDraftType" AS ENUM ('GBP_POST', 'REVIEW_PROMPT', 'OFFER_SUGGESTION');

-- CreateEnum
CREATE TYPE "ActivationDraftStatus" AS ENUM ('DRAFT', 'MARKED_PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "ActivationDraft" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "draftType" "ActivationDraftType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "deltaS" DOUBLE PRECISION NOT NULL,
    "fixScore" DOUBLE PRECISION NOT NULL,
    "themeCategory" TEXT NOT NULL,
    "status" "ActivationDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "publishNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivationDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivationDraft_tenantId_status_idx" ON "ActivationDraft"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ActivationDraft_tenantId_draftType_idx" ON "ActivationDraft"("tenantId", "draftType");

-- CreateIndex
CREATE INDEX "ActivationDraft_taskId_idx" ON "ActivationDraft"("taskId");

-- CreateIndex
CREATE INDEX "ActivationDraft_themeId_idx" ON "ActivationDraft"("themeId");

-- AddForeignKey
ALTER TABLE "ActivationDraft" ADD CONSTRAINT "ActivationDraft_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivationDraft" ADD CONSTRAINT "ActivationDraft_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivationDraft" ADD CONSTRAINT "ActivationDraft_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE CASCADE ON UPDATE CASCADE;
