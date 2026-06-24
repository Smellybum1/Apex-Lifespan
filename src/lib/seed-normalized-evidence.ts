import {
  findSeedIntegrityIssues,
  formatSeedIntegrityIssues,
  type SeedIntegrityIssue
} from "./seed-integrity";
import { compositeScore } from "./scoring";
import type { Claim, EvidenceLabel, Reference, ReviewStatus, ScoreSet, Study } from "./types";

export type SeedSourcePacketStatus = "NOT_LINKED" | "EXTRACTION_PENDING" | "COMPLETE";
export type SeedClaimStudyRelation = "SUPPORTS" | "SAFETY_REGULATORY";

export interface SeedSourcePacketRow {
  claimId: string;
  citationStatus: string;
  current: true;
  extractionNote: string;
  id: string;
  interventionId: string;
  reviewStatus: ReviewStatus;
  status: SeedSourcePacketStatus;
}

export interface SeedSourcePacketReferenceRow {
  citationStatus: string;
  extractionStatus: string;
  note: string;
  referenceId: string;
  sourcePacketId: string;
}

export interface SeedClaimStudyRow {
  claimId: string;
  note: string;
  relation: SeedClaimStudyRelation;
  relevanceScore: number;
  studyId: string;
}

export interface SeedClaimScoreSnapshotRow {
  claimId: string;
  compositeScore: number;
  computedAt?: string;
  finalLabel: EvidenceLabel;
  id: string;
  rationale: string;
  reviewStatus: ReviewStatus;
  scoreVersion: "v1";
  scores: ScoreSet;
}

export interface SeedNormalizedEvidenceRows {
  claimStudies: SeedClaimStudyRow[];
  scoreSnapshots: SeedClaimScoreSnapshotRow[];
  sourcePacketReferences: SeedSourcePacketReferenceRow[];
  sourcePackets: SeedSourcePacketRow[];
}

export interface SeedNormalizedEvidenceIntegrityInput {
  claims: Claim[];
  references: Reference[];
  rows: SeedNormalizedEvidenceRows;
  studies: Study[];
}

export interface PersistedSeedSourcePacketRow {
  citationStatus: string | null;
  claimId: string;
  current: boolean;
  extractionNote: string | null;
  id: string;
  interventionId: string | null;
  reviewStatus: PersistedReviewStatus | ReviewStatus;
  status: SeedSourcePacketStatus | string;
}

export interface PersistedSeedSourcePacketReferenceRow {
  citationStatus: string | null;
  extractionStatus: string | null;
  note: string | null;
  referenceId: string;
  sourcePacketId: string;
}

export interface PersistedSeedClaimStudyRow {
  claimId: string;
  note: string | null;
  relation: SeedClaimStudyRelation | string;
  relevanceScore: number;
  studyId: string;
}

export interface PersistedSeedClaimScoreSnapshotRow {
  claimId: string;
  compositeScore: number | string | { toString(): string };
  computedAt: Date | string;
  effectSizeScore: number;
  evidenceDirectnessScore: number;
  evidenceRigorScore: number;
  finalLabel: PersistedEvidenceLabel | EvidenceLabel;
  hypePenalty: number;
  id: string;
  measurabilityScore: number;
  productQualityScore: number;
  rationale: string | null;
  regulatoryRiskScore: number;
  reviewStatus: PersistedReviewStatus | ReviewStatus;
  safetyScore: number;
  scoreVersion: string;
}

export interface PersistedSeedNormalizedEvidenceRows {
  claimStudies: PersistedSeedClaimStudyRow[];
  scoreSnapshots: PersistedSeedClaimScoreSnapshotRow[];
  sourcePacketReferences: PersistedSeedSourcePacketReferenceRow[];
  sourcePackets: PersistedSeedSourcePacketRow[];
}

export type PersistedReviewStatus =
  | "AI_REVIEWED"
  | "HUMAN_REVIEWED"
  | "UNREVIEWED_AI_DRAFT";
export type PersistedEvidenceLabel =
  | "AVOID_NOT_RECOMMENDED"
  | "CONDITIONAL_BIOMARKER_GATED"
  | "CORE_EVIDENCE_BASED"
  | "INSUFFICIENT_EVIDENCE"
  | "REASONABLE_N_OF_1_EXPERIMENT"
  | "REGULATORY_CONCERN"
  | "REQUIRES_CLINICIAN_OVERSIGHT"
  | "SAFETY_CONCERN"
  | "SPECULATIVE_WATCHLIST"
  | "USEFUL_FOR_SPECIFIC_USE_CASE";

const SEED_CLAIM_STUDY_NOTE = "Seed relevance backfill from claim source packet.";

export function buildSeedNormalizedEvidenceRows({
  claims,
  studies
}: {
  claims: Claim[];
  studies: Study[];
}): SeedNormalizedEvidenceRows {
  const studiesByReferenceId = groupStudiesByReferenceId(studies);

  return {
    claimStudies: buildSeedClaimStudies({ claims, studiesByReferenceId }),
    scoreSnapshots: claims.map(seedClaimScoreSnapshot),
    sourcePacketReferences: claims.flatMap((claim) =>
      claim.keyReferenceIds.map((referenceId) =>
        seedSourcePacketReference({
          hasExtraction: Boolean(studiesByReferenceId.get(referenceId)?.length),
          claimId: claim.id,
          referenceId
        })
      )
    ),
    sourcePackets: claims.map((claim) =>
      seedSourcePacket({
        claim,
        extractedReferenceIds: extractedReferenceIdsForClaim({
          claim,
          studiesByReferenceId
        })
      })
    )
  };
}

export function rehydrateSeedNormalizedEvidenceRowsFromPersistedRows({
  expectedRows,
  persistedRows
}: {
  expectedRows: SeedNormalizedEvidenceRows;
  persistedRows: PersistedSeedNormalizedEvidenceRows;
}): SeedNormalizedEvidenceRows {
  const expectedClaimStudyKeys = new Set(expectedRows.claimStudies.map(seedClaimStudyKey));

  return {
    claimStudies: persistedRows.claimStudies
      .filter(
        (row) =>
          expectedClaimStudyKeys.has(seedClaimStudyKey(row)) ||
          row.note === SEED_CLAIM_STUDY_NOTE
      )
      .map(
        (row): SeedClaimStudyRow => ({
          claimId: row.claimId,
          note: row.note ?? "",
          relation: row.relation as SeedClaimStudyRelation,
          relevanceScore: row.relevanceScore,
          studyId: row.studyId
        })
      ),
    scoreSnapshots: persistedRows.scoreSnapshots
      .filter((snapshot) => snapshot.id.startsWith("seed-score-snapshot-"))
      .map(
        (snapshot): SeedClaimScoreSnapshotRow => ({
          claimId: snapshot.claimId,
          compositeScore: Number(snapshot.compositeScore),
          computedAt: seedDate(snapshot.computedAt),
          finalLabel: evidenceLabelFromPersisted(snapshot.finalLabel),
          id: snapshot.id,
          rationale: snapshot.rationale ?? "",
          reviewStatus: reviewStatusFromPersisted(snapshot.reviewStatus),
          scoreVersion: snapshot.scoreVersion as "v1",
          scores: {
            evidenceDirectness: snapshot.evidenceDirectnessScore,
            evidenceRigor: snapshot.evidenceRigorScore,
            effectSize: snapshot.effectSizeScore,
            safety: snapshot.safetyScore,
            regulatoryRisk: snapshot.regulatoryRiskScore,
            productQuality: snapshot.productQualityScore,
            hypePenalty: snapshot.hypePenalty,
            measurability: snapshot.measurabilityScore
          }
        })
      ),
    sourcePacketReferences: persistedRows.sourcePacketReferences
      .filter((reference) => reference.sourcePacketId.startsWith("seed-source-packet-"))
      .map(
        (reference): SeedSourcePacketReferenceRow => ({
          citationStatus: reference.citationStatus ?? "",
          extractionStatus: reference.extractionStatus ?? "",
          note: reference.note ?? "",
          referenceId: reference.referenceId,
          sourcePacketId: reference.sourcePacketId
        })
      ),
    sourcePackets: persistedRows.sourcePackets
      .filter((packet) => packet.id.startsWith("seed-source-packet-"))
      .map(
        (packet): SeedSourcePacketRow => ({
          claimId: packet.claimId,
          citationStatus: packet.citationStatus ?? "",
          current: packet.current as true,
          extractionNote: packet.extractionNote ?? "",
          id: packet.id,
          interventionId: packet.interventionId ?? "",
          reviewStatus: reviewStatusFromPersisted(packet.reviewStatus),
          status: packet.status as SeedSourcePacketStatus
        })
      )
  };
}

export function findSeedNormalizedEvidenceIntegrityIssues({
  claims,
  references,
  rows,
  studies
}: SeedNormalizedEvidenceIntegrityInput): SeedIntegrityIssue[] {
  const claimIds = claims.map((claim) => claim.id);
  const referenceIds = references.map((reference) => reference.id);
  const studyIds = studies.map((study) => study.id);
  const studiesByReferenceId = groupStudiesByReferenceId(studies);
  const expectedClaimStudies = buildSeedClaimStudies({
    claims,
    studiesByReferenceId
  });
  const expectedScoreSnapshots = claims.map(seedClaimScoreSnapshot);
  const expectedSourcePacketReferences = claims.flatMap((claim) =>
    claim.keyReferenceIds.map((referenceId) =>
      seedSourcePacketReference({
        claimId: claim.id,
        hasExtraction: Boolean(studiesByReferenceId.get(referenceId)?.length),
        referenceId
      })
    )
  );
  const expectedSourcePackets = claims.map((claim) =>
    seedSourcePacket({
      claim,
      extractedReferenceIds: extractedReferenceIdsForClaim({
        claim,
        studiesByReferenceId
      })
    })
  );

  return findSeedIntegrityIssues([
    {
      name: "Normalized SourcePacket",
      expectedIds: expectedSourcePackets.map((packet) => packet.id),
      actualIds: rows.sourcePackets.map((packet) => packet.id),
      seedOwnedPrefixes: ["seed-source-packet-"]
    },
    {
      name: "Normalized SourcePacket state",
      expectedIds: expectedSourcePackets.map(seedSourcePacketStateKey),
      actualIds: rows.sourcePackets.map(seedSourcePacketStateKey)
    },
    {
      name: "Normalized SourcePacket claim targets",
      expectedIds: rows.sourcePackets.map((packet) => packet.claimId),
      actualIds: claimIds,
      allowDuplicateExpectedIds: true
    },
    {
      name: "Normalized SourcePacket interventions",
      expectedIds: rows.sourcePackets.map(
        (packet) => `${packet.claimId}:${packet.interventionId}`
      ),
      actualIds: claims.map((claim) => `${claim.id}:${claim.interventionId}`)
    },
    {
      name: "Normalized SourcePacketReference",
      expectedIds: expectedSourcePacketReferences.map(seedSourcePacketReferenceKey),
      actualIds: rows.sourcePacketReferences.map(seedSourcePacketReferenceKey),
      seedOwnedPrefixes: ["seed-source-packet-"]
    },
    {
      name: "Normalized SourcePacketReference state",
      expectedIds: expectedSourcePacketReferences.map(seedSourcePacketReferenceStateKey),
      actualIds: rows.sourcePacketReferences.map(seedSourcePacketReferenceStateKey)
    },
    {
      name: "Normalized SourcePacketReference source-packet targets",
      expectedIds: rows.sourcePacketReferences.map((reference) => reference.sourcePacketId),
      actualIds: rows.sourcePackets.map((packet) => packet.id),
      allowDuplicateExpectedIds: true
    },
    {
      name: "Normalized SourcePacketReference reference targets",
      expectedIds: rows.sourcePacketReferences.map((reference) => reference.referenceId),
      actualIds: referenceIds,
      allowDuplicateExpectedIds: true
    },
    {
      name: "Normalized ClaimStudy",
      expectedIds: expectedClaimStudies.map(seedClaimStudyKey),
      actualIds: rows.claimStudies.map(seedClaimStudyKey),
      seedOwnedPrefixes: claimIds.map((claimId) => `${claimId}:`)
    },
    {
      name: "Normalized ClaimStudy values",
      expectedIds: expectedClaimStudies.map(seedClaimStudyValueKey),
      actualIds: rows.claimStudies.map(seedClaimStudyValueKey)
    },
    {
      name: "Normalized ClaimStudy claim targets",
      expectedIds: rows.claimStudies.map((row) => row.claimId),
      actualIds: claimIds,
      allowDuplicateExpectedIds: true
    },
    {
      name: "Normalized ClaimStudy study targets",
      expectedIds: rows.claimStudies.map((row) => row.studyId),
      actualIds: studyIds,
      allowDuplicateExpectedIds: true
    },
    {
      name: "Normalized ClaimScoreSnapshot",
      expectedIds: expectedScoreSnapshots.map((snapshot) => snapshot.id),
      actualIds: rows.scoreSnapshots.map((snapshot) => snapshot.id),
      seedOwnedPrefixes: ["seed-score-snapshot-"]
    },
    {
      name: "Normalized ClaimScoreSnapshot values",
      expectedIds: expectedScoreSnapshots.map(seedClaimScoreSnapshotValueKey),
      actualIds: rows.scoreSnapshots.map(seedClaimScoreSnapshotValueKey)
    },
    {
      name: "Normalized ClaimScoreSnapshot claim targets",
      expectedIds: rows.scoreSnapshots.map((snapshot) => snapshot.claimId),
      actualIds: claimIds,
      allowDuplicateExpectedIds: true
    }
  ]);
}

export function assertSeedNormalizedEvidenceRows(input: SeedNormalizedEvidenceIntegrityInput) {
  const issues = findSeedNormalizedEvidenceIntegrityIssues(input);

  if (issues.length > 0) {
    throw new Error(formatSeedIntegrityIssues(issues));
  }
}

export function seedSourcePacketId(claimId: string) {
  return `seed-source-packet-${claimId}`;
}

export function seedClaimScoreSnapshotId(claimId: string) {
  return `seed-score-snapshot-${claimId}-v1`;
}

export function seedClaimStudyKey(row: Pick<SeedClaimStudyRow, "claimId" | "studyId">) {
  return `${row.claimId}:${row.studyId}`;
}

export function seedSourcePacketReferenceKey(
  row: Pick<SeedSourcePacketReferenceRow, "referenceId" | "sourcePacketId">
) {
  return `${row.sourcePacketId}:${row.referenceId}`;
}

function buildSeedClaimStudies({
  claims,
  studiesByReferenceId
}: {
  claims: Claim[];
  studiesByReferenceId: Map<string, Study[]>;
}) {
  return claims.flatMap((claim) =>
    claim.keyReferenceIds.flatMap((referenceId) =>
      (studiesByReferenceId.get(referenceId) ?? []).map((study) =>
        seedClaimStudy({ claim, study })
      )
    )
  );
}

function groupStudiesByReferenceId(studies: Study[]) {
  const studiesByReferenceId = new Map<string, Study[]>();

  for (const study of studies) {
    const current = studiesByReferenceId.get(study.referenceId) ?? [];
    current.push(study);
    studiesByReferenceId.set(study.referenceId, current);
  }

  return studiesByReferenceId;
}

function extractedReferenceIdsForClaim({
  claim,
  studiesByReferenceId
}: {
  claim: Claim;
  studiesByReferenceId: Map<string, Study[]>;
}) {
  return new Set(
    claim.keyReferenceIds.filter((referenceId) => studiesByReferenceId.has(referenceId))
  );
}

function seedSourcePacket({
  claim,
  extractedReferenceIds
}: {
  claim: Claim;
  extractedReferenceIds: Set<string>;
}): SeedSourcePacketRow {
  return {
    claimId: claim.id,
    citationStatus: "Seed citations linked; human citation check remains explicit.",
    current: true,
    extractionNote:
      "Seed backfill mirrors curated reference links and structured extraction rows.",
    id: seedSourcePacketId(claim.id),
    interventionId: claim.interventionId,
    reviewStatus: claim.reviewStatus,
    status: seedSourcePacketStatus({
      extractedReferenceIds,
      referenceIds: claim.keyReferenceIds
    })
  };
}

function seedSourcePacketReference({
  claimId,
  hasExtraction,
  referenceId
}: {
  claimId: string;
  hasExtraction: boolean;
  referenceId: string;
}): SeedSourcePacketReferenceRow {
  return {
    citationStatus: "Seed citation link attached; human citation check remains explicit.",
    extractionStatus: hasExtraction ? "Complete" : "Extraction pending",
    note: "Seed backfill from claim key references.",
    referenceId,
    sourcePacketId: seedSourcePacketId(claimId)
  };
}

function seedClaimStudy({
  claim,
  study
}: {
  claim: Claim;
  study: Study;
}): SeedClaimStudyRow {
  return {
    claimId: claim.id,
    note: SEED_CLAIM_STUDY_NOTE,
    relation: seedClaimStudyRelation({ claim, study }),
    relevanceScore: seedClaimStudyRelation({ claim, study }) === "SAFETY_REGULATORY" ? 9 : 8,
    studyId: study.id
  };
}

function seedClaimScoreSnapshot(claim: Claim): SeedClaimScoreSnapshotRow {
  return {
    claimId: claim.id,
    compositeScore: compositeScore(claim.scores),
    computedAt: claim.lastUpdated,
    finalLabel: claim.finalLabel,
    id: seedClaimScoreSnapshotId(claim.id),
    rationale:
      "Seed baseline snapshot from curated claim component scores; human review status remains separate.",
    reviewStatus: claim.reviewStatus,
    scoreVersion: "v1",
    scores: claim.scores
  };
}

function seedSourcePacketStateKey(row: SeedSourcePacketRow) {
  return normalizedValueKey({
    claimId: row.claimId,
    current: row.current,
    id: row.id,
    interventionId: row.interventionId,
    reviewStatus: row.reviewStatus,
    status: row.status
  });
}

function seedSourcePacketReferenceStateKey(row: SeedSourcePacketReferenceRow) {
  return normalizedValueKey({
    citationStatus: row.citationStatus,
    extractionStatus: row.extractionStatus,
    referenceId: row.referenceId,
    sourcePacketId: row.sourcePacketId
  });
}

function seedClaimStudyValueKey(row: SeedClaimStudyRow) {
  return normalizedValueKey({
    claimId: row.claimId,
    relation: row.relation,
    relevanceScore: row.relevanceScore,
    studyId: row.studyId
  });
}

function seedClaimScoreSnapshotValueKey(row: SeedClaimScoreSnapshotRow) {
  return normalizedValueKey({
    claimId: row.claimId,
    compositeScore: row.compositeScore,
    computedAt: row.computedAt,
    effectSize: row.scores.effectSize,
    evidenceDirectness: row.scores.evidenceDirectness,
    evidenceRigor: row.scores.evidenceRigor,
    finalLabel: row.finalLabel,
    hypePenalty: row.scores.hypePenalty,
    id: row.id,
    measurability: row.scores.measurability,
    productQuality: row.scores.productQuality,
    regulatoryRisk: row.scores.regulatoryRisk,
    reviewStatus: row.reviewStatus,
    safety: row.scores.safety,
    scoreVersion: row.scoreVersion
  });
}

function seedDate(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const date = new Date(value);

  if (Number.isNaN(date.valueOf())) {
    return value.slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

function reviewStatusFromPersisted(reviewStatus: PersistedReviewStatus | ReviewStatus): ReviewStatus {
  if (reviewStatus === "HUMAN_REVIEWED") {
    return "Human reviewed";
  }

  if (reviewStatus === "AI_REVIEWED") {
    return "AI reviewed";
  }

  if (reviewStatus === "UNREVIEWED_AI_DRAFT") {
    return "Unreviewed AI draft";
  }

  return reviewStatus;
}

function evidenceLabelFromPersisted(label: PersistedEvidenceLabel | EvidenceLabel): EvidenceLabel {
  switch (label) {
    case "CORE_EVIDENCE_BASED":
      return "Core Evidence-Based";
    case "CONDITIONAL_BIOMARKER_GATED":
      return "Conditional / Biomarker-Gated";
    case "USEFUL_FOR_SPECIFIC_USE_CASE":
      return "Useful for Specific Use Case";
    case "REASONABLE_N_OF_1_EXPERIMENT":
      return "Reasonable N-of-1 Experiment";
    case "SPECULATIVE_WATCHLIST":
      return "Speculative Watchlist";
    case "SAFETY_CONCERN":
      return "Safety Concern";
    case "AVOID_NOT_RECOMMENDED":
      return "Avoid / Not Recommended";
    case "REQUIRES_CLINICIAN_OVERSIGHT":
      return "Requires Clinician Oversight";
    case "REGULATORY_CONCERN":
      return "Regulatory Concern";
    case "INSUFFICIENT_EVIDENCE":
      return "Insufficient Evidence";
    default:
      return label;
  }
}

function normalizedValueKey(values: Record<string, boolean | number | string | undefined>) {
  return Object.entries(values)
    .map(([key, value]) => `${key}=${value ?? ""}`)
    .join("|");
}

function seedSourcePacketStatus({
  extractedReferenceIds,
  referenceIds
}: {
  extractedReferenceIds: Set<string>;
  referenceIds: string[];
}): SeedSourcePacketStatus {
  if (referenceIds.length === 0) {
    return "NOT_LINKED";
  }

  return referenceIds.every((referenceId) => extractedReferenceIds.has(referenceId))
    ? "COMPLETE"
    : "EXTRACTION_PENDING";
}

function seedClaimStudyRelation({
  claim,
  study
}: {
  claim: Claim;
  study: Study;
}): SeedClaimStudyRelation {
  if (
    claim.outcome === "Safety/adverse effects" ||
    claim.finalLabel === "Regulatory Concern" ||
    study.studyType === "Regulatory safety warning"
  ) {
    return "SAFETY_REGULATORY";
  }

  return "SUPPORTS";
}
