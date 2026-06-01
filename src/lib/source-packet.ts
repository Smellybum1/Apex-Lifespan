import type { Claim, Reference, Study } from "@/lib/types";

export interface ClaimSourcePacket {
  referenceIds: string[];
  references: Reference[];
  studies: Study[];
  pendingReferences: Reference[];
  missingReferenceIds: string[];
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
  const extractedReferenceIds = new Set(studiesForClaim.map((study) => study.referenceId));
  const pendingReferences = references.filter(
    (reference) => !extractedReferenceIds.has(reference.id)
  );
  const missingReferenceIds = referenceIds.filter(
    (referenceId) => !referencesById.has(referenceId)
  );

  return {
    referenceIds,
    references,
    studies: studiesForClaim,
    pendingReferences,
    missingReferenceIds
  };
}
