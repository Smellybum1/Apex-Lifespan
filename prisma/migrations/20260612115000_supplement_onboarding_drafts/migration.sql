-- CreateEnum
CREATE TYPE "SupplementOnboardingDraftStatus" AS ENUM ('DRAFT', 'READY_FOR_REVIEW', 'ARCHIVED');

-- CreateTable
CREATE TABLE "SupplementOnboardingDraft" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "InterventionCategory",
    "region" TEXT NOT NULL DEFAULT 'AU',
    "status" "SupplementOnboardingDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "input" JSONB NOT NULL,
    "plan" JSONB NOT NULL,
    "guardrailWarnings" TEXT[],
    "blockingReviewItems" TEXT[],
    "createdByUserId" TEXT,
    "createdByEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplementOnboardingDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplementOnboardingDraft_slug_key" ON "SupplementOnboardingDraft"("slug");

-- CreateIndex
CREATE INDEX "SupplementOnboardingDraft_status_idx" ON "SupplementOnboardingDraft"("status");

-- CreateIndex
CREATE INDEX "SupplementOnboardingDraft_createdByUserId_idx" ON "SupplementOnboardingDraft"("createdByUserId");

-- CreateIndex
CREATE INDEX "SupplementOnboardingDraft_createdByEmail_idx" ON "SupplementOnboardingDraft"("createdByEmail");

-- CreateIndex
CREATE INDEX "SupplementOnboardingDraft_category_idx" ON "SupplementOnboardingDraft"("category");

-- CreateIndex
CREATE INDEX "SupplementOnboardingDraft_updatedAt_idx" ON "SupplementOnboardingDraft"("updatedAt");

-- AddForeignKey
ALTER TABLE "SupplementOnboardingDraft" ADD CONSTRAINT "SupplementOnboardingDraft_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
