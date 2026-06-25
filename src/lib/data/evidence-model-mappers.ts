import {
  ClaimStudyRelation as DbClaimStudyRelation,
  EvidenceLabel as DbEvidenceLabel,
  PublicChangelogKind as DbPublicChangelogKind,
  ReviewStatus as DbReviewStatus,
  ScoreChangeKind as DbScoreChangeKind,
  SourcePacketStatus as DbSourcePacketStatus,
  StudyType as DbStudyType
} from "@prisma/client";

import type { ChangelogEntryKind } from "@/lib/changelog";
import type {
  ClaimSourcePacketCompletenessStatus,
  EvidenceDepthSummary
} from "@/lib/source-packet";
import type { EvidenceLabel, ReviewStatus, ScoreSet } from "@/lib/types";

export const evidenceLabelFromDb: Record<DbEvidenceLabel, EvidenceLabel> = {
  CORE_EVIDENCE_BASED: "Core Evidence-Based",
  CONDITIONAL_BIOMARKER_GATED: "Conditional / Biomarker-Gated",
  USEFUL_FOR_SPECIFIC_USE_CASE: "Useful for Specific Use Case",
  REASONABLE_N_OF_1_EXPERIMENT: "Reasonable N-of-1 Experiment",
  SPECULATIVE_WATCHLIST: "Speculative Watchlist",
  SAFETY_CONCERN: "Safety Concern",
  AVOID_NOT_RECOMMENDED: "Avoid / Not Recommended",
  REQUIRES_CLINICIAN_OVERSIGHT: "Requires Clinician Oversight",
  REGULATORY_CONCERN: "Regulatory Concern",
  INSUFFICIENT_EVIDENCE: "Insufficient Evidence"
};

export const evidenceLabelToDb: Record<EvidenceLabel, DbEvidenceLabel> = {
  "Core Evidence-Based": "CORE_EVIDENCE_BASED",
  "Conditional / Biomarker-Gated": "CONDITIONAL_BIOMARKER_GATED",
  "Useful for Specific Use Case": "USEFUL_FOR_SPECIFIC_USE_CASE",
  "Reasonable N-of-1 Experiment": "REASONABLE_N_OF_1_EXPERIMENT",
  "Speculative Watchlist": "SPECULATIVE_WATCHLIST",
  "Safety Concern": "SAFETY_CONCERN",
  "Avoid / Not Recommended": "AVOID_NOT_RECOMMENDED",
  "Requires Clinician Oversight": "REQUIRES_CLINICIAN_OVERSIGHT",
  "Regulatory Concern": "REGULATORY_CONCERN",
  "Insufficient Evidence": "INSUFFICIENT_EVIDENCE"
};

export function mapReviewStatusFromDb(status: DbReviewStatus): ReviewStatus {
  return status === DbReviewStatus.HUMAN_REVIEWED ? "Human reviewed" : "Unreviewed AI draft";
}

export function mapReviewStatusToDb(status: ReviewStatus): DbReviewStatus {
  return status === "Human reviewed"
    ? DbReviewStatus.HUMAN_REVIEWED
    : DbReviewStatus.UNREVIEWED_AI_DRAFT;
}

export function scoreSetFromClaimFields(claim: {
  evidenceDirectnessScore: number;
  evidenceRigorScore: number;
  effectSizeScore: number;
  safetyScore: number;
  regulatoryRiskScore: number;
  productQualityScore: number;
  hypePenalty: number;
  measurabilityScore: number;
}): ScoreSet {
  return {
    evidenceDirectness: claim.evidenceDirectnessScore,
    evidenceRigor: claim.evidenceRigorScore,
    effectSize: claim.effectSizeScore,
    safety: claim.safetyScore,
    regulatoryRisk: claim.regulatoryRiskScore,
    productQuality: claim.productQualityScore,
    hypePenalty: claim.hypePenalty,
    measurability: claim.measurabilityScore
  };
}

export function sourcePacketStatusFromCompleteness(
  status: ClaimSourcePacketCompletenessStatus
): DbSourcePacketStatus {
  switch (status) {
    case "complete":
      return DbSourcePacketStatus.COMPLETE;
    case "extraction_pending":
      return DbSourcePacketStatus.EXTRACTION_PENDING;
    case "missing_sources":
      return DbSourcePacketStatus.MISSING_SOURCES;
    case "not_linked":
    default:
      return DbSourcePacketStatus.NOT_LINKED;
  }
}

export function sourcePacketCompletenessFromDb(
  status: DbSourcePacketStatus
): ClaimSourcePacketCompletenessStatus {
  switch (status) {
    case DbSourcePacketStatus.COMPLETE:
      return "complete";
    case DbSourcePacketStatus.EXTRACTION_PENDING:
    case DbSourcePacketStatus.NEEDS_UPDATE:
      return "extraction_pending";
    case DbSourcePacketStatus.MISSING_SOURCES:
      return "missing_sources";
    case DbSourcePacketStatus.NOT_LINKED:
    case DbSourcePacketStatus.RETIRED:
    default:
      return "not_linked";
  }
}

export function claimStudyRelationForStudyType(studyType: DbStudyType): DbClaimStudyRelation {
  if (studyType === DbStudyType.REGULATORY_SAFETY_WARNING) {
    return DbClaimStudyRelation.SAFETY_REGULATORY;
  }

  if (
    studyType === DbStudyType.META_ANALYSIS ||
    studyType === DbStudyType.SYSTEMATIC_REVIEW ||
    studyType === DbStudyType.RANDOMIZED_CONTROLLED_TRIAL
  ) {
    return DbClaimStudyRelation.SUPPORTS;
  }

  return DbClaimStudyRelation.UNREVIEWED_LEAD;
}

export function publicChangelogKindToDb(kind: ChangelogEntryKind): DbPublicChangelogKind {
  switch (kind) {
    case "Evidence card":
      return DbPublicChangelogKind.EVIDENCE_CARD;
    case "Scoring":
      return DbPublicChangelogKind.SCORING;
    case "Source search":
      return DbPublicChangelogKind.SOURCE_SEARCH;
    case "Operations":
      return DbPublicChangelogKind.OPERATIONS;
    case "Public trust":
    default:
      return DbPublicChangelogKind.METHODOLOGY;
  }
}

export function publicChangelogKindFromDb(kind: DbPublicChangelogKind): ChangelogEntryKind {
  switch (kind) {
    case DbPublicChangelogKind.EVIDENCE_CARD:
      return "Evidence card";
    case DbPublicChangelogKind.SCORING:
      return "Scoring";
    case DbPublicChangelogKind.SOURCE_SEARCH:
      return "Source search";
    case DbPublicChangelogKind.OPERATIONS:
      return "Operations";
    case DbPublicChangelogKind.SAFETY_REGULATORY:
    case DbPublicChangelogKind.PRODUCT_LABEL_ANALYZER:
    case DbPublicChangelogKind.METHODOLOGY:
    default:
      return "Public trust";
  }
}

export function formatScoreChangeKind(kind: DbScoreChangeKind): string {
  return kind
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function snapshotsEquivalent(
  left: ScoreSet & { finalLabel: EvidenceLabel; compositeScore: number },
  right: ScoreSet & { finalLabel: EvidenceLabel; compositeScore: number }
) {
  return (
    left.finalLabel === right.finalLabel &&
    left.compositeScore === right.compositeScore &&
    left.evidenceDirectness === right.evidenceDirectness &&
    left.evidenceRigor === right.evidenceRigor &&
    left.effectSize === right.effectSize &&
    left.safety === right.safety &&
    left.regulatoryRisk === right.regulatoryRisk &&
    left.productQuality === right.productQuality &&
    left.hypePenalty === right.hypePenalty &&
    left.measurability === right.measurability
  );
}

export type SerializedEvidenceDepthSummary = EvidenceDepthSummary;
