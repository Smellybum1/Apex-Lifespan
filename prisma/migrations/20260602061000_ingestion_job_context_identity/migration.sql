-- Add first-class source-candidate ingestion job context.
ALTER TABLE "IngestionJob" ADD COLUMN "interventionId" TEXT;
ALTER TABLE "IngestionJob" ADD COLUMN "claimId" TEXT;

-- Preserve valid context from older metadata-backed jobs without trusting
-- malformed or stale metadata values enough to violate new foreign keys.
UPDATE "IngestionJob"
SET "interventionId" = trim("metadata"->>'interventionId')
WHERE jsonb_typeof("metadata"->'interventionId') = 'string'
  AND length(trim("metadata"->>'interventionId')) > 0
  AND EXISTS (
    SELECT 1
    FROM "Intervention"
    WHERE "Intervention"."id" = trim("IngestionJob"."metadata"->>'interventionId')
  );

UPDATE "IngestionJob"
SET "claimId" = trim("metadata"->>'claimId')
WHERE jsonb_typeof("metadata"->'claimId') = 'string'
  AND length(trim("metadata"->>'claimId')) > 0
  AND EXISTS (
    SELECT 1
    FROM "Claim"
    WHERE "Claim"."id" = trim("IngestionJob"."metadata"->>'claimId')
  );

-- Replace source/query/region-only identity with nullable-context-aware identity.
DROP INDEX "IngestionJob_source_query_region_key";

CREATE UNIQUE INDEX "IngestionJob_source_query_region_unscoped_key"
ON "IngestionJob"("source", "query", "region")
WHERE "interventionId" IS NULL AND "claimId" IS NULL;

CREATE UNIQUE INDEX "IngestionJob_source_query_region_intervention_key"
ON "IngestionJob"("source", "query", "region", "interventionId")
WHERE "interventionId" IS NOT NULL AND "claimId" IS NULL;

CREATE UNIQUE INDEX "IngestionJob_source_query_region_claim_key"
ON "IngestionJob"("source", "query", "region", "claimId")
WHERE "interventionId" IS NULL AND "claimId" IS NOT NULL;

CREATE UNIQUE INDEX "IngestionJob_source_query_region_context_key"
ON "IngestionJob"("source", "query", "region", "interventionId", "claimId")
WHERE "interventionId" IS NOT NULL AND "claimId" IS NOT NULL;

CREATE INDEX "IngestionJob_interventionId_idx" ON "IngestionJob"("interventionId");
CREATE INDEX "IngestionJob_claimId_idx" ON "IngestionJob"("claimId");

ALTER TABLE "IngestionJob" ADD CONSTRAINT "IngestionJob_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "Intervention"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IngestionJob" ADD CONSTRAINT "IngestionJob_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;
