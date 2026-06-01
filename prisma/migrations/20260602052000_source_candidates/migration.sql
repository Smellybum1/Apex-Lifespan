-- CreateEnum
CREATE TYPE "SourceCandidateDecision" AS ENUM ('PENDING_REVIEW', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "SourceCandidate" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "source" "SourceKind" NOT NULL,
    "externalId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'AU',
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publishedYear" INTEGER,
    "sourceType" TEXT,
    "abstractAvailable" BOOLEAN,
    "triageScore" INTEGER NOT NULL DEFAULT 0,
    "triageReasons" TEXT[],
    "metadata" JSONB,
    "decision" "SourceCandidateDecision" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'UNREVIEWED_AI_DRAFT',
    "interventionId" TEXT,
    "claimId" TEXT,
    "ingestionJobId" TEXT,
    "acceptedReferenceId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SourceCandidate_dedupeKey_key" ON "SourceCandidate"("dedupeKey");

-- CreateIndex
CREATE INDEX "SourceCandidate_source_idx" ON "SourceCandidate"("source");

-- CreateIndex
CREATE INDEX "SourceCandidate_externalId_idx" ON "SourceCandidate"("externalId");

-- CreateIndex
CREATE INDEX "SourceCandidate_region_idx" ON "SourceCandidate"("region");

-- CreateIndex
CREATE INDEX "SourceCandidate_decision_idx" ON "SourceCandidate"("decision");

-- CreateIndex
CREATE INDEX "SourceCandidate_reviewStatus_idx" ON "SourceCandidate"("reviewStatus");

-- CreateIndex
CREATE INDEX "SourceCandidate_interventionId_idx" ON "SourceCandidate"("interventionId");

-- CreateIndex
CREATE INDEX "SourceCandidate_claimId_idx" ON "SourceCandidate"("claimId");

-- CreateIndex
CREATE INDEX "SourceCandidate_ingestionJobId_idx" ON "SourceCandidate"("ingestionJobId");

-- CreateIndex
CREATE INDEX "SourceCandidate_acceptedReferenceId_idx" ON "SourceCandidate"("acceptedReferenceId");

-- CreateIndex
CREATE INDEX "SourceCandidate_triageScore_idx" ON "SourceCandidate"("triageScore");

-- AddForeignKey
ALTER TABLE "SourceCandidate" ADD CONSTRAINT "SourceCandidate_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "Intervention"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceCandidate" ADD CONSTRAINT "SourceCandidate_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceCandidate" ADD CONSTRAINT "SourceCandidate_ingestionJobId_fkey" FOREIGN KEY ("ingestionJobId") REFERENCES "IngestionJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceCandidate" ADD CONSTRAINT "SourceCandidate_acceptedReferenceId_fkey" FOREIGN KEY ("acceptedReferenceId") REFERENCES "Reference"("id") ON DELETE SET NULL ON UPDATE CASCADE;
