import type { Claim, Reference, SourceTypeTaxonomy, Study } from "@/lib/types";

export interface ClaimSourcePacket {
  referenceIds: string[];
  references: Reference[];
  studies: Study[];
  pendingReferences: Reference[];
  missingReferenceIds: string[];
  completeness: ClaimSourcePacketCompleteness;
  evidenceDepth: EvidenceDepthSummary;
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
  nextStep: string;
  totalReferences: number;
  extractedReferences: number;
  pendingReferences: number;
  missingReferences: number;
}

export interface ClaimSourcePacketSummary {
  completeClaims: number;
  extractionPendingClaims: number;
  extractedReferences: number;
  missingReferences: number;
  missingSourceClaims: number;
  pendingReferences: number;
  totalClaims: number;
  totalReferences: number;
  unlinkedClaims: number;
}

export type EvidenceDepthBadgeKind =
  | "animal-mechanistic-only"
  | "case-report"
  | "clinical-trial-record"
  | "human-trials-none"
  | "meta-analysis"
  | "observational-cohort"
  | "regulatory-only"
  | "regulatory-warning-source"
  | "review-position-stand"
  | "rct"
  | "source-packet"
  | "systematic-review";

export interface EvidenceDepthBadge {
  detail: string;
  kind: EvidenceDepthBadgeKind;
  label: string;
}

export interface EvidenceDepthSummary {
  animalMechanisticStudies: number;
  caseReports: number;
  clinicalTrialRecords: number;
  directHumanTrials: number;
  metaAnalyses: number;
  observationalCohorts: number;
  randomizedControlledTrials: number;
  reviewPositionStandSources: number;
  regulatorySafetyWarnings: number;
  sourcePackets: number;
  systematicReviews: number;
  totalExtractedStudies: number;
  badges: EvidenceDepthBadge[];
}

export function buildClaimSourcePacket({
  claim,
  referencesById,
  studies
}: {
  claim: Pick<Claim, "keyReferenceIds" | "keyStudyIds">;
  referencesById: Map<string, Reference>;
  studies: Study[];
}): ClaimSourcePacket {
  const referenceIds = Array.from(new Set(claim.keyReferenceIds));
  const referenceIdSet = new Set(referenceIds);
  const references = referenceIds
    .map((referenceId) => referencesById.get(referenceId))
    .filter((reference): reference is Reference => Boolean(reference));
  const studyIdSet = new Set(claim.keyStudyIds ?? []);
  const studiesForClaim =
    studyIdSet.size > 0
      ? studies.filter(
          (study) => studyIdSet.has(study.id) && referenceIdSet.has(study.referenceId)
        )
      : studies.filter((study) => referenceIdSet.has(study.referenceId));
  const extractedReferenceIds = new Set(
    studiesForClaim
      .map((study) => study.referenceId)
      .filter((referenceId) => referenceIdSet.has(referenceId) && referencesById.has(referenceId))
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
  const evidenceDepth = summarizeEvidenceDepth({
    completeness,
    studies: studiesForClaim
  });

  return {
    referenceIds,
    references,
    studies: studiesForClaim,
    pendingReferences,
    missingReferenceIds,
    completeness,
    evidenceDepth
  };
}

export function summarizeEvidenceDepth({
  completeness,
  studies
}: {
  completeness: ClaimSourcePacketCompleteness;
  studies: Study[];
}): EvidenceDepthSummary {
  const taxonomyRows = studies.map(sourceTypeForStudy);
  const metaAnalyses = taxonomyRows.filter((sourceType) => sourceType === "meta-analysis").length;
  const systematicReviews = taxonomyRows.filter(
    (sourceType) => sourceType === "systematic review"
  ).length;
  const randomizedControlledTrials = studies.filter(
    (study, index) => taxonomyRows[index] === "RCT" && study.studyType !== "Clinical trial record"
  ).length;
  const observationalCohorts = taxonomyRows.filter(
    (sourceType) => sourceType === "observational study"
  ).length;
  const caseReports = taxonomyRows.filter((sourceType) => sourceType === "case report").length;
  const clinicalTrialRecords = studies.filter(
    (study) => study.studyType === "Clinical trial record"
  ).length;
  const regulatorySafetyWarnings = taxonomyRows.filter(
    (sourceType) => sourceType === "regulatory warning"
  ).length;
  const reviewPositionStandSources = taxonomyRows.filter((sourceType) =>
    ["narrative review", "position stand", "guideline"].includes(sourceType)
  ).length;
  const animalMechanisticStudies = taxonomyRows.filter((sourceType) =>
    ["animal study", "in vitro/mechanistic"].includes(sourceType)
  ).length;
  const totalExtractedStudies = studies.length;
  const directHumanTrials = randomizedControlledTrials + clinicalTrialRecords;
  const sourcePackets = completeness.totalReferences > 0 ? 1 : 0;
  const isRegulatoryOnly =
    totalExtractedStudies > 0 && regulatorySafetyWarnings === totalExtractedStudies;
  const isAnimalMechanisticOnly =
    totalExtractedStudies > 0 && animalMechanisticStudies === totalExtractedStudies;

  const badges: EvidenceDepthBadge[] = [
    {
      detail:
        sourcePackets > 0
          ? "This claim has a curated source packet linking references to extracted study or source records."
          : "No curated source packet is linked to this claim yet.",
      kind: "source-packet",
      label: `${sourcePackets} source ${sourcePackets === 1 ? "packet" : "packets"}`
    }
  ];

  if (randomizedControlledTrials > 0) {
    badges.push({
      detail: "Randomized controlled trial extractions are direct human intervention evidence.",
      kind: "rct",
      label: `${randomizedControlledTrials} RCT ${pluralize(randomizedControlledTrials, "row")} extracted`
    });
  }

  if (metaAnalyses > 0) {
    badges.push({
      detail: "Meta-analysis extractions summarize multiple studies and should stay citation-linked.",
      kind: "meta-analysis",
      label: `${metaAnalyses} ${metaAnalyses === 1 ? "meta-analysis" : "meta-analyses"} extracted`
    });
  }

  if (systematicReviews > 0) {
    badges.push({
      detail:
        "Verified systematic-review sources synthesize evidence across studies and should stay citation-linked.",
      kind: "systematic-review",
      label: `${systematicReviews} systematic ${pluralize(systematicReviews, "review")} extracted`
    });
  }

  if (reviewPositionStandSources > 0) {
    badges.push({
      detail:
        "Narrative reviews, guidelines, and position stands synthesize evidence but are not automatically systematic reviews.",
      kind: "review-position-stand",
      label: `${reviewPositionStandSources} review/position-stand ${pluralize(
        reviewPositionStandSources,
        "source"
      )} extracted`
    });
  }

  if (regulatorySafetyWarnings > 0) {
    badges.push({
      detail:
        "Regulatory warning sources are safety or product-status evidence; they do not establish clinical benefit.",
      kind: "regulatory-warning-source",
      label: `${regulatorySafetyWarnings} regulatory warning ${pluralize(
        regulatorySafetyWarnings,
        "source"
      )}`
    });
  }

  if (observationalCohorts > 0) {
    badges.push({
      detail: "Observational cohorts can support associations but are not randomized trials.",
      kind: "observational-cohort",
      label: `${observationalCohorts} observational ${pluralize(
        observationalCohorts,
        "cohort"
      )} extracted`
    });
  }

  if (caseReports > 0) {
    badges.push({
      detail: "Case reports are low-depth clinical signals and should not drive broad claims alone.",
      kind: "case-report",
      label: `${caseReports} case ${pluralize(caseReports, "report")} extracted`
    });
  }

  if (clinicalTrialRecords > 0) {
    badges.push({
      detail: "Clinical trial records are registry records, not necessarily completed results.",
      kind: "clinical-trial-record",
      label: `${clinicalTrialRecords} clinical trial ${pluralize(
        clinicalTrialRecords,
        "record"
      )} extracted`
    });
  }

  if (directHumanTrials === 0) {
    badges.push({
      detail:
        "No extracted individual human trial row is attached to this claim packet yet. This does not mean no human trials exist; reviews, guidelines, position stands, or regulatory sources may still be present.",
      kind: "human-trials-none",
      label: "0 individual human trial rows extracted"
    });
  }

  if (isRegulatoryOnly) {
    badges.push({
      detail: "All extracted records for this packet are regulatory or safety-warning sources.",
      kind: "regulatory-only",
      label: `${regulatorySafetyWarnings} regulatory-only ${pluralize(
        regulatorySafetyWarnings,
        "source"
      )}`
    });
  }

  if (isAnimalMechanisticOnly) {
    badges.push({
      detail:
        "All extracted records for this packet are animal or mechanistic sources; no direct human evidence is extracted.",
      kind: "animal-mechanistic-only",
      label: "Animal/mechanistic only"
    });
  }

  return {
    animalMechanisticStudies,
    badges,
    caseReports,
    clinicalTrialRecords,
    directHumanTrials,
    metaAnalyses,
    observationalCohorts,
    randomizedControlledTrials,
    reviewPositionStandSources,
    regulatorySafetyWarnings,
    sourcePackets,
    systematicReviews,
    totalExtractedStudies
  };
}

function sourceTypeForStudy(study: Study): SourceTypeTaxonomy {
  if (study.sourceTypeTaxonomy) {
    return study.sourceTypeTaxonomy;
  }

  switch (study.studyType) {
    case "Meta-analysis":
      return "meta-analysis";
    case "Systematic review":
      return "systematic review";
    case "Randomized controlled trial":
      return "RCT";
    case "Observational cohort":
      return "observational study";
    case "Case report":
      return "case report";
    case "Animal study":
      return "animal study";
    case "In vitro/mechanistic":
      return "in vitro/mechanistic";
    case "Regulatory safety warning":
      return "regulatory warning";
    case "Clinical trial record":
      return "RCT";
  }
}

export function summarizeClaimSourcePackets({
  claims,
  referencesById,
  studies
}: {
  claims: Array<Pick<Claim, "keyReferenceIds" | "keyStudyIds">>;
  referencesById: Map<string, Reference>;
  studies: Study[];
}): ClaimSourcePacketSummary {
  return claims.reduce<ClaimSourcePacketSummary>(
    (summary, claim) => {
      const packet = buildClaimSourcePacket({ claim, referencesById, studies });

      summary.totalClaims += 1;
      summary.totalReferences += packet.completeness.totalReferences;
      summary.extractedReferences += packet.completeness.extractedReferences;
      summary.pendingReferences += packet.completeness.pendingReferences;
      summary.missingReferences += packet.completeness.missingReferences;

      switch (packet.completeness.status) {
        case "complete":
          summary.completeClaims += 1;
          break;
        case "extraction_pending":
          summary.extractionPendingClaims += 1;
          break;
        case "missing_sources":
          summary.missingSourceClaims += 1;
          break;
        case "not_linked":
          summary.unlinkedClaims += 1;
          break;
      }

      return summary;
    },
    {
      completeClaims: 0,
      extractionPendingClaims: 0,
      extractedReferences: 0,
      missingReferences: 0,
      missingSourceClaims: 0,
      pendingReferences: 0,
      totalClaims: 0,
      totalReferences: 0,
      unlinkedClaims: 0
    }
  );
}

function pluralize(count: number, singular: string) {
  return count === 1 ? singular : `${singular}s`;
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
      nextStep: "Add curated reference links before treating this claim as source-backed.",
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
      nextStep: "Restore the missing curated source records before relying on this packet.",
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
      nextStep: "Add structured extraction for the pending references before treating this packet as complete.",
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
    nextStep: "Keep source links reviewed as new evidence or regulatory updates appear.",
    totalReferences,
    extractedReferences: extractedCount,
    pendingReferences: pendingCount,
    missingReferences: missingCount
  };
}
