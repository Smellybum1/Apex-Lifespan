-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "InterventionCategory" AS ENUM ('VITAMIN_MINERAL', 'FATTY_ACID', 'AMINO_ACID', 'BOTANICAL_HERBAL', 'FIBER_PREBIOTIC_PROBIOTIC', 'ERGOGENIC_PERFORMANCE_SUPPLEMENT', 'NOOTROPIC', 'HORMONAL_ENDOCRINE_INTERVENTION', 'PEPTIDE_BIOLOGIC', 'DRUG_GEROPROTECTOR_WATCHLIST', 'FOOD_BEVERAGE');

-- CreateEnum
CREATE TYPE "OutcomeArea" AS ENUM ('MORTALITY_LIFESPAN', 'CARDIOVASCULAR_EVENTS', 'LDL_APOB_LIPIDS', 'BLOOD_PRESSURE', 'GLUCOSE_INSULIN_HBA1C', 'INFLAMMATION', 'COGNITION', 'SLEEP', 'MOOD_STRESS', 'MUSCLE_STRENGTH', 'VO2_MAX_ENDURANCE', 'JOINT_TENDON_SKIN', 'EYE_HEALTH', 'IMMUNE_RESPIRATORY', 'FERTILITY_HORMONES', 'BIOLOGICAL_AGING_CLOCKS', 'SAFETY_ADVERSE_EFFECTS');

-- CreateEnum
CREATE TYPE "EvidenceLabel" AS ENUM ('CORE_EVIDENCE_BASED', 'CONDITIONAL_BIOMARKER_GATED', 'USEFUL_FOR_SPECIFIC_USE_CASE', 'REASONABLE_N_OF_1_EXPERIMENT', 'SPECULATIVE_WATCHLIST', 'SAFETY_CONCERN', 'AVOID_NOT_RECOMMENDED', 'REQUIRES_CLINICIAN_OVERSIGHT', 'REGULATORY_CONCERN', 'INSUFFICIENT_EVIDENCE');

-- CreateEnum
CREATE TYPE "EvidenceMomentum" AS ENUM ('INCREASING', 'STABLE', 'CONFLICTING', 'WEAKENING', 'SAFETY_CONCERN_EMERGING');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('UNREVIEWED_AI_DRAFT', 'HUMAN_REVIEWED');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('HIGH', 'MODERATE', 'LOW', 'VERY_LOW');

-- CreateEnum
CREATE TYPE "StudyType" AS ENUM ('META_ANALYSIS', 'SYSTEMATIC_REVIEW', 'RANDOMIZED_CONTROLLED_TRIAL', 'OBSERVATIONAL_COHORT', 'CASE_REPORT', 'ANIMAL_STUDY', 'IN_VITRO_MECHANISTIC', 'CLINICAL_TRIAL_RECORD', 'REGULATORY_SAFETY_WARNING');

-- CreateEnum
CREATE TYPE "TrialStatus" AS ENUM ('RECRUITING', 'ACTIVE', 'COMPLETED', 'TERMINATED', 'RESULTS_PENDING');

-- CreateEnum
CREATE TYPE "SafetyAlertType" AS ENUM ('LIVER_INJURY', 'KIDNEY_RISK', 'CONTAMINATION', 'ADULTERATION', 'MISLABELING', 'PROHIBITED_IN_SPORT', 'PRESCRIPTION_ONLY', 'UNAPPROVED_THERAPEUTIC_GOOD', 'COMPOUNDING_RESTRICTION', 'DRUG_INTERACTION');

-- CreateEnum
CREATE TYPE "SafetySeverity" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'CLINICIAN_REVIEW_RECOMMENDED', 'AVOID');

-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('PUBMED', 'PUBMED_CENTRAL', 'CLINICALTRIALS_GOV', 'NIH_ODS', 'TGA', 'FDA', 'WADA', 'LIVERTOX', 'NCCIH', 'MEDLINEPLUS', 'PRODUCT_LABEL', 'ADMIN_ENTRY', 'OTHER');

-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AustraliaRegulatoryKind" AS ENUM ('AUST_L', 'AUST_LA', 'AUST_R', 'NOT_IN_ARTG', 'UNAPPROVED', 'EXEMPT', 'EXCLUDED', 'UNKNOWN');

-- CreateTable
CREATE TABLE "Intervention" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "synonyms" TEXT[],
    "category" "InterventionCategory" NOT NULL,
    "commonForms" TEXT[],
    "commonStudyDoses" TEXT[],
    "consumerProductDoseRanges" TEXT[],
    "regulatorySummary" TEXT NOT NULL,
    "australiaRegulatoryStatus" TEXT NOT NULL,
    "safetySummary" TEXT NOT NULL,
    "interactionSummary" TEXT NOT NULL,
    "evidenceSummary" TEXT NOT NULL,
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Intervention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "interventionId" TEXT NOT NULL,
    "outcome" "OutcomeArea" NOT NULL,
    "claimText" TEXT NOT NULL,
    "populationStudied" TEXT NOT NULL,
    "doseFormStudied" TEXT NOT NULL,
    "durationStudied" TEXT NOT NULL,
    "comparator" TEXT NOT NULL,
    "evidenceGrade" TEXT NOT NULL,
    "effectSize" TEXT NOT NULL,
    "clinicalRelevance" TEXT NOT NULL,
    "confidenceLevel" "ConfidenceLevel" NOT NULL,
    "safetyNotes" TEXT NOT NULL,
    "applicabilityNotes" TEXT NOT NULL,
    "evidenceDirectnessScore" INTEGER NOT NULL,
    "evidenceRigorScore" INTEGER NOT NULL,
    "effectSizeScore" INTEGER NOT NULL,
    "safetyScore" INTEGER NOT NULL,
    "regulatoryRiskScore" INTEGER NOT NULL,
    "productQualityScore" INTEGER NOT NULL,
    "hypePenalty" INTEGER NOT NULL,
    "measurabilityScore" INTEGER NOT NULL,
    "finalLabel" "EvidenceLabel" NOT NULL,
    "momentum" "EvidenceMomentum" NOT NULL,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'UNREVIEWED_AI_DRAFT',
    "summary" TEXT,
    "uncertainty" TEXT,
    "whatWouldChangeScore" TEXT NOT NULL,
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reference" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" "SourceKind" NOT NULL,
    "identifier" TEXT,
    "year" INTEGER,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimReference" (
    "claimId" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "relevance" INTEGER NOT NULL DEFAULT 5,
    "note" TEXT,

    CONSTRAINT "ClaimReference_pkey" PRIMARY KEY ("claimId","referenceId")
);

-- CreateTable
CREATE TABLE "Study" (
    "id" TEXT NOT NULL,
    "referenceId" TEXT,
    "title" TEXT NOT NULL,
    "year" INTEGER,
    "source" TEXT NOT NULL,
    "sourceType" "StudyType" NOT NULL,
    "pmid" TEXT,
    "pmcid" TEXT,
    "doi" TEXT,
    "nctId" TEXT,
    "url" TEXT,
    "abstract" TEXT,
    "sampleSize" TEXT NOT NULL,
    "population" TEXT NOT NULL,
    "interventionName" TEXT NOT NULL,
    "dose" TEXT,
    "duration" TEXT,
    "outcomes" TEXT[],
    "mainResults" TEXT,
    "adverseEvents" TEXT NOT NULL,
    "fundingConflicts" TEXT NOT NULL,
    "riskOfBias" TEXT NOT NULL,
    "relevanceScore" INTEGER NOT NULL DEFAULT 5,
    "extractedAbstract" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Study_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trial" (
    "id" TEXT NOT NULL,
    "interventionId" TEXT,
    "nctId" TEXT,
    "title" TEXT NOT NULL,
    "status" "TrialStatus" NOT NULL,
    "phase" TEXT NOT NULL,
    "enrollment" TEXT NOT NULL,
    "conditions" TEXT[],
    "interventions" TEXT[],
    "outcomes" TEXT[],
    "startDate" TIMESTAMP(3),
    "completionDate" TIMESTAMP(3),
    "lastUpdateDate" TIMESTAMP(3),
    "resultsPosted" BOOLEAN NOT NULL DEFAULT false,
    "evidenceImpact" "EvidenceMomentum" NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "interventionId" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "labelText" TEXT,
    "servingSize" TEXT,
    "ingredientsJson" JSONB NOT NULL,
    "proprietaryBlend" BOOLEAN NOT NULL DEFAULT false,
    "certificationsJson" JSONB NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'AU',
    "regulatoryNumber" TEXT,
    "qualityScore" INTEGER NOT NULL,
    "labelClaimRiskScore" INTEGER NOT NULL,
    "url" TEXT,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'UNREVIEWED_AI_DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyAlert" (
    "id" TEXT NOT NULL,
    "interventionId" TEXT,
    "region" TEXT NOT NULL DEFAULT 'AU',
    "agency" "SourceKind" NOT NULL,
    "date" TIMESTAMP(3),
    "alertType" "SafetyAlertType" NOT NULL,
    "severity" "SafetySeverity" NOT NULL,
    "summary" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafetyAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AustraliaRegulatoryStatus" (
    "id" TEXT NOT NULL,
    "interventionId" TEXT,
    "productId" TEXT,
    "referenceId" TEXT,
    "region" TEXT NOT NULL DEFAULT 'AU',
    "kind" "AustraliaRegulatoryKind" NOT NULL,
    "artgId" TEXT,
    "austNumber" TEXT,
    "sponsor" TEXT,
    "status" TEXT NOT NULL,
    "efficacyAssessed" BOOLEAN,
    "preMarketAssessment" BOOLEAN,
    "supplySummary" TEXT NOT NULL,
    "evidenceRequirement" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AustraliaRegulatoryStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceDocument" (
    "id" TEXT NOT NULL,
    "referenceId" TEXT,
    "source" "SourceKind" NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rawText" TEXT,
    "extractedSummary" TEXT,
    "checksum" TEXT,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'UNREVIEWED_AI_DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionJob" (
    "id" TEXT NOT NULL,
    "source" "SourceKind" NOT NULL,
    "status" "IngestionStatus" NOT NULL DEFAULT 'QUEUED',
    "query" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'AU',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "recordsFound" INTEGER NOT NULL DEFAULT 0,
    "recordsChanged" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Intervention_slug_key" ON "Intervention"("slug");

-- CreateIndex
CREATE INDEX "Intervention_category_idx" ON "Intervention"("category");

-- CreateIndex
CREATE INDEX "Intervention_name_idx" ON "Intervention"("name");

-- CreateIndex
CREATE INDEX "Claim_outcome_idx" ON "Claim"("outcome");

-- CreateIndex
CREATE INDEX "Claim_finalLabel_idx" ON "Claim"("finalLabel");

-- CreateIndex
CREATE INDEX "Claim_reviewStatus_idx" ON "Claim"("reviewStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_interventionId_outcome_claimText_key" ON "Claim"("interventionId", "outcome", "claimText");

-- CreateIndex
CREATE INDEX "Reference_source_idx" ON "Reference"("source");

-- CreateIndex
CREATE UNIQUE INDEX "Reference_url_key" ON "Reference"("url");

-- CreateIndex
CREATE INDEX "Study_sourceType_idx" ON "Study"("sourceType");

-- CreateIndex
CREATE INDEX "Study_pmid_idx" ON "Study"("pmid");

-- CreateIndex
CREATE INDEX "Study_nctId_idx" ON "Study"("nctId");

-- CreateIndex
CREATE UNIQUE INDEX "Trial_nctId_key" ON "Trial"("nctId");

-- CreateIndex
CREATE INDEX "Trial_status_idx" ON "Trial"("status");

-- CreateIndex
CREATE INDEX "Trial_evidenceImpact_idx" ON "Trial"("evidenceImpact");

-- CreateIndex
CREATE INDEX "Product_region_idx" ON "Product"("region");

-- CreateIndex
CREATE INDEX "Product_regulatoryNumber_idx" ON "Product"("regulatoryNumber");

-- CreateIndex
CREATE INDEX "Product_qualityScore_idx" ON "Product"("qualityScore");

-- CreateIndex
CREATE INDEX "SafetyAlert_region_idx" ON "SafetyAlert"("region");

-- CreateIndex
CREATE INDEX "SafetyAlert_agency_idx" ON "SafetyAlert"("agency");

-- CreateIndex
CREATE INDEX "SafetyAlert_severity_idx" ON "SafetyAlert"("severity");

-- CreateIndex
CREATE INDEX "AustraliaRegulatoryStatus_region_idx" ON "AustraliaRegulatoryStatus"("region");

-- CreateIndex
CREATE INDEX "AustraliaRegulatoryStatus_kind_idx" ON "AustraliaRegulatoryStatus"("kind");

-- CreateIndex
CREATE INDEX "AustraliaRegulatoryStatus_artgId_idx" ON "AustraliaRegulatoryStatus"("artgId");

-- CreateIndex
CREATE INDEX "AustraliaRegulatoryStatus_austNumber_idx" ON "AustraliaRegulatoryStatus"("austNumber");

-- CreateIndex
CREATE INDEX "AustraliaRegulatoryStatus_interventionId_idx" ON "AustraliaRegulatoryStatus"("interventionId");

-- CreateIndex
CREATE INDEX "AustraliaRegulatoryStatus_productId_idx" ON "AustraliaRegulatoryStatus"("productId");

-- Hand-authored partial unique indexes: PostgreSQL treats NULL values as distinct
-- in normal unique indexes, but AU regulatory status uniqueness depends on
-- product/intervention/ARTG presence.
CREATE UNIQUE INDEX "AustraliaRegulatoryStatus_intervention_current_key" ON "AustraliaRegulatoryStatus"("region", "interventionId", "kind") WHERE "interventionId" IS NOT NULL AND "productId" IS NULL AND "artgId" IS NULL;

CREATE UNIQUE INDEX "AustraliaRegulatoryStatus_product_current_key" ON "AustraliaRegulatoryStatus"("region", "productId", "kind") WHERE "productId" IS NOT NULL AND "interventionId" IS NULL AND "artgId" IS NULL;

CREATE UNIQUE INDEX "AustraliaRegulatoryStatus_region_artg_present_key" ON "AustraliaRegulatoryStatus"("region", "artgId") WHERE "artgId" IS NOT NULL;

CREATE UNIQUE INDEX "AustraliaRegulatoryStatus_region_aust_present_key" ON "AustraliaRegulatoryStatus"("region", "austNumber") WHERE "austNumber" IS NOT NULL;

-- CreateIndex
CREATE INDEX "SourceDocument_source_idx" ON "SourceDocument"("source");

-- CreateIndex
CREATE INDEX "SourceDocument_reviewStatus_idx" ON "SourceDocument"("reviewStatus");

-- CreateIndex
CREATE UNIQUE INDEX "SourceDocument_url_key" ON "SourceDocument"("url");

-- CreateIndex
CREATE INDEX "IngestionJob_source_idx" ON "IngestionJob"("source");

-- CreateIndex
CREATE INDEX "IngestionJob_status_idx" ON "IngestionJob"("status");

-- CreateIndex
CREATE INDEX "IngestionJob_region_idx" ON "IngestionJob"("region");

-- CreateIndex
CREATE UNIQUE INDEX "IngestionJob_source_query_region_key" ON "IngestionJob"("source", "query", "region");

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "Intervention"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimReference" ADD CONSTRAINT "ClaimReference_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimReference" ADD CONSTRAINT "ClaimReference_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "Reference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Study" ADD CONSTRAINT "Study_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "Reference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trial" ADD CONSTRAINT "Trial_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "Intervention"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "Intervention"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyAlert" ADD CONSTRAINT "SafetyAlert_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "Intervention"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AustraliaRegulatoryStatus" ADD CONSTRAINT "AustraliaRegulatoryStatus_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "Intervention"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AustraliaRegulatoryStatus" ADD CONSTRAINT "AustraliaRegulatoryStatus_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AustraliaRegulatoryStatus" ADD CONSTRAINT "AustraliaRegulatoryStatus_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "Reference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceDocument" ADD CONSTRAINT "SourceDocument_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "Reference"("id") ON DELETE SET NULL ON UPDATE CASCADE;
