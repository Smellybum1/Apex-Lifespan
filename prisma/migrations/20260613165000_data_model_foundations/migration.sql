-- CreateEnum
CREATE TYPE "SourcePacketStatus" AS ENUM ('NOT_LINKED', 'EXTRACTION_PENDING', 'COMPLETE', 'MISSING_SOURCES', 'NEEDS_UPDATE', 'RETIRED');

-- CreateEnum
CREATE TYPE "ClaimStudyRelation" AS ENUM ('SUPPORTS', 'CONTRADICTS', 'MIXED', 'BACKGROUND', 'SAFETY_REGULATORY', 'UNREVIEWED_LEAD');

-- CreateEnum
CREATE TYPE "ScoreChangeKind" AS ENUM ('NEW_RCT', 'NEW_META_ANALYSIS', 'TRIAL_RESULT_POSTED', 'REGULATORY_WARNING', 'SAFETY_SIGNAL', 'CONTRADICTORY_EVIDENCE', 'BETTER_DOSE_FORM_EVIDENCE', 'PRODUCT_QUALITY_CONCERN', 'MANUAL_REVIEW', 'OTHER');

-- CreateEnum
CREATE TYPE "ReviewEventType" AS ENUM ('UNREVIEWED_EXTRACTION', 'CITATION_CHECKED', 'HUMAN_REVIEWED', 'NEEDS_UPDATE', 'RETIRED', 'SUPERSEDED', 'SOURCE_PACKET_UPDATED', 'CLAIM_SCORE_UPDATED');

-- CreateEnum
CREATE TYPE "PublicChangelogKind" AS ENUM ('EVIDENCE_CARD', 'SCORING', 'SOURCE_SEARCH', 'SAFETY_REGULATORY', 'PRODUCT_LABEL_ANALYZER', 'OPERATIONS', 'METHODOLOGY');

-- CreateTable
CREATE TABLE "SourcePacket" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "interventionId" TEXT,
    "status" "SourcePacketStatus" NOT NULL DEFAULT 'EXTRACTION_PENDING',
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'UNREVIEWED_AI_DRAFT',
    "citationStatus" TEXT,
    "extractionNote" TEXT,
    "reviewerNotes" TEXT,
    "current" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourcePacket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourcePacketReference" (
    "sourcePacketId" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "extractionStatus" TEXT,
    "citationStatus" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourcePacketReference_pkey" PRIMARY KEY ("sourcePacketId","referenceId")
);

-- CreateTable
CREATE TABLE "ClaimStudy" (
    "claimId" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "relation" "ClaimStudyRelation" NOT NULL DEFAULT 'UNREVIEWED_LEAD',
    "relevanceScore" INTEGER NOT NULL DEFAULT 5,
    "note" TEXT,
    "humanReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClaimStudy_pkey" PRIMARY KEY ("claimId","studyId")
);

-- CreateTable
CREATE TABLE "ClaimScoreSnapshot" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "scoreVersion" TEXT NOT NULL DEFAULT 'v1',
    "evidenceDirectnessScore" INTEGER NOT NULL,
    "evidenceRigorScore" INTEGER NOT NULL,
    "effectSizeScore" INTEGER NOT NULL,
    "safetyScore" INTEGER NOT NULL,
    "regulatoryRiskScore" INTEGER NOT NULL,
    "productQualityScore" INTEGER NOT NULL,
    "hypePenalty" INTEGER NOT NULL,
    "measurabilityScore" INTEGER NOT NULL,
    "compositeScore" DECIMAL(4,2) NOT NULL,
    "finalLabel" "EvidenceLabel" NOT NULL,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'UNREVIEWED_AI_DRAFT',
    "rationale" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimScoreSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimScoreHistory" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "previousSnapshotId" TEXT,
    "newSnapshotId" TEXT,
    "oldCompositeScore" DECIMAL(4,2),
    "newCompositeScore" DECIMAL(4,2),
    "oldLabel" "EvidenceLabel",
    "newLabel" "EvidenceLabel",
    "reason" "ScoreChangeKind" NOT NULL,
    "rationale" TEXT NOT NULL,
    "referenceId" TEXT,
    "changedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimScoreHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewEvent" (
    "id" TEXT NOT NULL,
    "eventType" "ReviewEventType" NOT NULL,
    "reviewStatus" "ReviewStatus",
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "claimId" TEXT,
    "sourcePacketId" TEXT,
    "referenceId" TEXT,
    "studyId" TEXT,
    "actorUserId" TEXT,
    "actorEmail" TEXT,
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicChangelogEntry" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "kind" "PublicChangelogKind" NOT NULL,
    "title" TEXT NOT NULL,
    "publicImpact" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "claimId" TEXT,
    "interventionId" TEXT,
    "scoreHistoryId" TEXT,
    "referenceId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicChangelogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SourcePacket_claimId_idx" ON "SourcePacket"("claimId");

-- CreateIndex
CREATE INDEX "SourcePacket_interventionId_idx" ON "SourcePacket"("interventionId");

-- CreateIndex
CREATE INDEX "SourcePacket_status_idx" ON "SourcePacket"("status");

-- CreateIndex
CREATE INDEX "SourcePacket_reviewStatus_idx" ON "SourcePacket"("reviewStatus");

-- CreateIndex
CREATE INDEX "SourcePacket_current_idx" ON "SourcePacket"("current");

-- CreateIndex
CREATE INDEX "SourcePacketReference_referenceId_idx" ON "SourcePacketReference"("referenceId");

-- CreateIndex
CREATE INDEX "ClaimStudy_studyId_idx" ON "ClaimStudy"("studyId");

-- CreateIndex
CREATE INDEX "ClaimStudy_relation_idx" ON "ClaimStudy"("relation");

-- CreateIndex
CREATE INDEX "ClaimScoreSnapshot_claimId_idx" ON "ClaimScoreSnapshot"("claimId");

-- CreateIndex
CREATE INDEX "ClaimScoreSnapshot_scoreVersion_idx" ON "ClaimScoreSnapshot"("scoreVersion");

-- CreateIndex
CREATE INDEX "ClaimScoreSnapshot_computedAt_idx" ON "ClaimScoreSnapshot"("computedAt");

-- CreateIndex
CREATE INDEX "ClaimScoreSnapshot_finalLabel_idx" ON "ClaimScoreSnapshot"("finalLabel");

-- CreateIndex
CREATE INDEX "ClaimScoreSnapshot_reviewStatus_idx" ON "ClaimScoreSnapshot"("reviewStatus");

-- CreateIndex
CREATE INDEX "ClaimScoreHistory_claimId_idx" ON "ClaimScoreHistory"("claimId");

-- CreateIndex
CREATE INDEX "ClaimScoreHistory_reason_idx" ON "ClaimScoreHistory"("reason");

-- CreateIndex
CREATE INDEX "ClaimScoreHistory_referenceId_idx" ON "ClaimScoreHistory"("referenceId");

-- CreateIndex
CREATE INDEX "ClaimScoreHistory_changedByUserId_idx" ON "ClaimScoreHistory"("changedByUserId");

-- CreateIndex
CREATE INDEX "ClaimScoreHistory_createdAt_idx" ON "ClaimScoreHistory"("createdAt");

-- CreateIndex
CREATE INDEX "ReviewEvent_eventType_idx" ON "ReviewEvent"("eventType");

-- CreateIndex
CREATE INDEX "ReviewEvent_reviewStatus_idx" ON "ReviewEvent"("reviewStatus");

-- CreateIndex
CREATE INDEX "ReviewEvent_entityType_entityId_idx" ON "ReviewEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ReviewEvent_claimId_idx" ON "ReviewEvent"("claimId");

-- CreateIndex
CREATE INDEX "ReviewEvent_sourcePacketId_idx" ON "ReviewEvent"("sourcePacketId");

-- CreateIndex
CREATE INDEX "ReviewEvent_referenceId_idx" ON "ReviewEvent"("referenceId");

-- CreateIndex
CREATE INDEX "ReviewEvent_studyId_idx" ON "ReviewEvent"("studyId");

-- CreateIndex
CREATE INDEX "ReviewEvent_actorUserId_idx" ON "ReviewEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "ReviewEvent_createdAt_idx" ON "ReviewEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PublicChangelogEntry_slug_key" ON "PublicChangelogEntry"("slug");

-- CreateIndex
CREATE INDEX "PublicChangelogEntry_date_idx" ON "PublicChangelogEntry"("date");

-- CreateIndex
CREATE INDEX "PublicChangelogEntry_kind_idx" ON "PublicChangelogEntry"("kind");

-- CreateIndex
CREATE INDEX "PublicChangelogEntry_claimId_idx" ON "PublicChangelogEntry"("claimId");

-- CreateIndex
CREATE INDEX "PublicChangelogEntry_interventionId_idx" ON "PublicChangelogEntry"("interventionId");

-- CreateIndex
CREATE INDEX "PublicChangelogEntry_scoreHistoryId_idx" ON "PublicChangelogEntry"("scoreHistoryId");

-- CreateIndex
CREATE INDEX "PublicChangelogEntry_referenceId_idx" ON "PublicChangelogEntry"("referenceId");

-- CreateIndex
CREATE INDEX "PublicChangelogEntry_publishedAt_idx" ON "PublicChangelogEntry"("publishedAt");

-- AddForeignKey
ALTER TABLE "SourcePacket" ADD CONSTRAINT "SourcePacket_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcePacket" ADD CONSTRAINT "SourcePacket_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "Intervention"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcePacketReference" ADD CONSTRAINT "SourcePacketReference_sourcePacketId_fkey" FOREIGN KEY ("sourcePacketId") REFERENCES "SourcePacket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcePacketReference" ADD CONSTRAINT "SourcePacketReference_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "Reference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimStudy" ADD CONSTRAINT "ClaimStudy_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimStudy" ADD CONSTRAINT "ClaimStudy_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimScoreSnapshot" ADD CONSTRAINT "ClaimScoreSnapshot_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimScoreHistory" ADD CONSTRAINT "ClaimScoreHistory_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimScoreHistory" ADD CONSTRAINT "ClaimScoreHistory_previousSnapshotId_fkey" FOREIGN KEY ("previousSnapshotId") REFERENCES "ClaimScoreSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimScoreHistory" ADD CONSTRAINT "ClaimScoreHistory_newSnapshotId_fkey" FOREIGN KEY ("newSnapshotId") REFERENCES "ClaimScoreSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimScoreHistory" ADD CONSTRAINT "ClaimScoreHistory_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "Reference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimScoreHistory" ADD CONSTRAINT "ClaimScoreHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewEvent" ADD CONSTRAINT "ReviewEvent_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewEvent" ADD CONSTRAINT "ReviewEvent_sourcePacketId_fkey" FOREIGN KEY ("sourcePacketId") REFERENCES "SourcePacket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewEvent" ADD CONSTRAINT "ReviewEvent_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "Reference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewEvent" ADD CONSTRAINT "ReviewEvent_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewEvent" ADD CONSTRAINT "ReviewEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicChangelogEntry" ADD CONSTRAINT "PublicChangelogEntry_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicChangelogEntry" ADD CONSTRAINT "PublicChangelogEntry_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "Intervention"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicChangelogEntry" ADD CONSTRAINT "PublicChangelogEntry_scoreHistoryId_fkey" FOREIGN KEY ("scoreHistoryId") REFERENCES "ClaimScoreHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicChangelogEntry" ADD CONSTRAINT "PublicChangelogEntry_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "Reference"("id") ON DELETE SET NULL ON UPDATE CASCADE;
