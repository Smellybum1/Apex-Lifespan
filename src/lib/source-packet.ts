import type { Claim, Reference, Study } from "@/lib/types";

export interface ClaimSourcePacket {
  referenceIds: string[];
  references: Reference[];
  studies: Study[];
  pendingReferences: Reference[];
  missingReferenceIds: string[];
  completeness: ClaimSourcePacketCompleteness;
}

export type ClaimSourcePacketCompletenessStatus =
  | "complete"
  | "extraction_pending"
  | "missing_sources"
  | "not_linked";

export interface ClaimSourcePacketCompleteness {
  status: ClaimSourcePacketCompletenessStatus;
  label: string;
  detail: string;
  totalReferences: number;
  extractedReferences: number;
  pendingReferences: number;
  missingReferences: number;
}

export function buildClaimSourcePacket({
  claim,
  referencesById,
  studies
}: {
  claim: Pick<Claim, "keyReferenceIds">;
  referencesById: Map<string, Reference>;
  studies: Study[];
}): ClaimSourcePacket {
  const referenceIds = Array.from(new Set(claim.keyReferenceIds));
  const referenceIdSet = new Set(referenceIds);
  const references = referenceIds
    .map((referenceId) => referencesById.get(referenceId))
    .filter((reference): reference is Reference => Boolean(reference));
  const studiesForClaim = studies.filter((study) => referenceIdSet.has(study.referenceId));
  const extractedReferenceIds = new Set(
    studiesForClaim
      .map((study) => study.referenceId)
      .filter((referenceId) => referencesById.has(referenceId))
  );
  const pendingReferences = references.filter(
    (reference) => !extractedReferenceIds.has(reference.id)
  );
  const missingReferenceIds = referenceIds.filter(
    (referenceId) => !referencesById.has(referenceId)
  );
  const completeness = summarizeClaimSourcePacket({
    referenceIds,
    extractedReferenceIds,
    pendingReferences,
    missingReferenceIds
  });

  return {
    referenceIds,
    references,
    studies: studiesForClaim,
    pendingReferences,
    missingReferenceIds,
    completeness
  };
}

function summarizeClaimSourcePacket({
  referenceIds,
  extractedReferenceIds,
  pendingReferences,
  missingReferenceIds
}: {
  referenceIds: string[];
  extractedReferenceIds: Set<string>;
  pendingReferences: Reference[];
  missingReferenceIds: string[];
}): ClaimSourcePacketCompleteness {
  const totalReferences = referenceIds.length;
  const pendingCount = pendingReferences.length;
  const missingCount = missingReferenceIds.length;
  const extractedCount = extractedReferenceIds.size;

  if (totalReferences === 0) {
    return {
      status: "not_linked",
      label: "No curated sources",
      detail: "This claim does not have curated reference links yet.",
      totalReferences,
      extractedReferences: extractedCount,
      pendingReferences: pendingCount,
      missingReferences: missingCount
    };
  }

  if (missingCount > 0) {
    return {
      status: "missing_sources",
      label: "Source records missing",
      detail: "One or more linked reference IDs are missing from the curated source records.",
      totalReferences,
      extractedReferences: extractedCount,
      pendingReferences: pendingCount,
      missingReferences: missingCount
    };
  }

  if (pendingCount > 0) {
    return {
      status: "extraction_pending",
      label: "Extraction pending",
      detail: "Curated references are linked, but at least one still needs a structured study extraction.",
      totalReferences,
      extractedReferences: extractedCount,
      pendingReferences: pendingCount,
      missingReferences: missingCount
    };
  }

  return {
    status: "complete",
    label: "Extraction complete",
    detail: "Every linked curated reference has at least one structured study extraction.",
    totalReferences,
    extractedReferences: extractedCount,
    pendingReferences: pendingCount,
    missingReferences: missingCount
  };
}
