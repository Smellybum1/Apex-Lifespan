-- CreateEnum
CREATE TYPE "TrialAlertKind" AS ENUM ('RESULTS_REVIEW_NEEDED', 'MISSING_RESULTS_FOLLOW_UP', 'MONITOR_ACTIVE_TRIAL', 'REGISTRY_STATUS_REVIEW', 'LOW_PRIORITY_LEAD');

-- CreateEnum
CREATE TYPE "TrialAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "TrialAlert" (
    "id" TEXT NOT NULL,
    "kind" "TrialAlertKind" NOT NULL,
    "status" "TrialAlertStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "noAutoPromotion" BOOLEAN NOT NULL DEFAULT true,
    "trialId" TEXT,
    "nctId" TEXT,
    "interventionId" TEXT,
    "claimId" TEXT,
    "sourceCandidateId" TEXT,
    "referenceId" TEXT,
    "scoreHistoryId" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewerNotes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrialAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrialAlert_kind_idx" ON "TrialAlert"("kind");

-- CreateIndex
CREATE INDEX "TrialAlert_status_idx" ON "TrialAlert"("status");

-- CreateIndex
CREATE INDEX "TrialAlert_trialId_idx" ON "TrialAlert"("trialId");

-- CreateIndex
CREATE INDEX "TrialAlert_nctId_idx" ON "TrialAlert"("nctId");

-- CreateIndex
CREATE INDEX "TrialAlert_interventionId_idx" ON "TrialAlert"("interventionId");

-- CreateIndex
CREATE INDEX "TrialAlert_claimId_idx" ON "TrialAlert"("claimId");

-- CreateIndex
CREATE INDEX "TrialAlert_sourceCandidateId_idx" ON "TrialAlert"("sourceCandidateId");

-- CreateIndex
CREATE INDEX "TrialAlert_referenceId_idx" ON "TrialAlert"("referenceId");

-- CreateIndex
CREATE INDEX "TrialAlert_scoreHistoryId_idx" ON "TrialAlert"("scoreHistoryId");

-- CreateIndex
CREATE INDEX "TrialAlert_detectedAt_idx" ON "TrialAlert"("detectedAt");

-- AddForeignKey
ALTER TABLE "TrialAlert" ADD CONSTRAINT "TrialAlert_trialId_fkey" FOREIGN KEY ("trialId") REFERENCES "Trial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialAlert" ADD CONSTRAINT "TrialAlert_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "Intervention"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialAlert" ADD CONSTRAINT "TrialAlert_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialAlert" ADD CONSTRAINT "TrialAlert_sourceCandidateId_fkey" FOREIGN KEY ("sourceCandidateId") REFERENCES "SourceCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialAlert" ADD CONSTRAINT "TrialAlert_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "Reference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialAlert" ADD CONSTRAINT "TrialAlert_scoreHistoryId_fkey" FOREIGN KEY ("scoreHistoryId") REFERENCES "ClaimScoreHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
