import { compositeScore } from "@/lib/scoring";
import {
  buildClaimSourcePacket,
  buildClaimSourcePacketFromSnapshot,
  type ClaimSourcePacket,
  type ClaimSourcePacketCompletenessStatus
} from "@/lib/source-packet";
import type { Claim, EvidenceDashboardData, EvidenceLabel, Intervention } from "@/lib/types";

const SOURCE_PACKET_REVIEW_EVIDENCE_GRADE = "Insufficient until source packets are reviewed.";
const DRAFT_LEAD_EVIDENCE_GRADE = "Draft lead";
const STARTER_LOOKING_COMPOSITE_SCORES = new Set(["2.1", "3.1"]);
const SCORE_READINESS_SOURCE_BLOCKER_ORDER: ScoreReadinessSourceBlockerStatus[] = [
  "extraction_pending",
  "missing_sources",
  "not_linked"
];
const SCORE_READINESS_SOURCE_BLOCKER_LABELS: Record<
  ScoreReadinessSourceBlockerStatus,
  string
> = {
  extraction_pending: "extraction pending",
  missing_sources: "missing source records",
  not_linked: "no curated sources"
};

export type ScoreReadinessState =
  | "default_score_review"
  | "ready_to_score"
  | "scored"
  | "snapshot_gap"
  | "source_blocked";

export type ScoreReadinessPriority = "High" | "Medium" | "Low";
export type ScoreReadinessSourceBlockerStatus = Exclude<
  ClaimSourcePacketCompletenessStatus,
  "complete"
>;

export type ScoreReadinessSourceBlockers = Record<ScoreReadinessSourceBlockerStatus, number>;

export type ScoreReadinessRow = {
  claim: Claim;
  currentScore: number | null;
  intervention?: Intervention;
  packet: ClaimSourcePacket;
  priority: number;
  priorityLabel: ScoreReadinessPriority;
  reasons: string[];
  state: ScoreReadinessState;
};

export type ScoreReadinessSummary = {
  defaultLookingPublicScores: number;
  goalAccountedClaims: number;
  goalUnaccountedClaims: number;
  sourceBlockedWithoutNextAction: number;
  sourceBlockedWithNextAction: number;
  readyToScore: number;
  scoredPublicClaims: number;
  snapshotGaps: number;
  sourceBlocked: number;
  sourceBlockers: ScoreReadinessSourceBlockers;
  totalClaims: number;
  workItems: number;
};

export function buildScoreReadinessRows(data: EvidenceDashboardData): ScoreReadinessRow[] {
  const referencesById = new Map(data.references.map((reference) => [reference.id, reference]));
  const sourcePacketSnapshotsByClaimId = new Map(
    (data.normalizedSourcePackets ?? []).map((packet) => [packet.claimId, packet])
  );
  const interventionsById = new Map(
    data.interventions.map((intervention) => [intervention.id, intervention])
  );
  const snapshotsByClaimId = new Map(
    (data.claimScoreSnapshots ?? []).map((snapshot) => [snapshot.claimId, snapshot])
  );
  const hasSnapshotInventory = data.claimScoreSnapshots !== undefined;
  const useSourcePacketSnapshots =
    data.references.length === 0 &&
    data.studies.length === 0 &&
    sourcePacketSnapshotsByClaimId.size > 0;

  return data.claims
    .map((claim) => {
      const packet = useSourcePacketSnapshots
        ? buildClaimSourcePacketFromSnapshot({
            claim,
            packet: sourcePacketSnapshotsByClaimId.get(claim.id),
            referencesById
          })
        : buildClaimSourcePacket({
            claim,
            referencesById,
            studies: data.studies
          });
      const currentScore = scoreReadinessCurrentScore(claim);
      const state = scoreReadinessState({
        claim,
        currentScore,
        hasSnapshotInventory,
        packet,
        snapshotExists: snapshotsByClaimId.has(claim.id)
      });
      const priority = scoreReadinessPriorityScore({ claim, currentScore, packet, state });

      return {
        claim,
        currentScore,
        intervention: interventionsById.get(claim.interventionId),
        packet,
        priority,
        priorityLabel: scoreReadinessPriorityLabel(priority),
        reasons: scoreReadinessReasons({
          claim,
          currentScore,
          hasSnapshotInventory,
          packet,
          snapshotExists: snapshotsByClaimId.has(claim.id),
          state
        }),
        state
      };
    })
    .sort((left, right) => {
      const priorityDelta = right.priority - left.priority;

      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      const leftName = left.intervention?.name ?? "";
      const rightName = right.intervention?.name ?? "";
      return leftName.localeCompare(rightName) || left.claim.outcome.localeCompare(right.claim.outcome);
    });
}

export function buildScoreReadinessSummary(
  rows: ScoreReadinessRow[]
): ScoreReadinessSummary {
  const workItems = rows.filter((row) => row.state !== "scored").length;
  const sourceBlockers = buildScoreReadinessSourceBlockers(rows);
  const scoredPublicClaims = rows.filter((row) => row.state === "scored").length;
  const sourceBlockedWithNextAction = rows.filter(
    (row) => row.state === "source_blocked" && scoreReadinessNextAction(row).trim()
  ).length;
  const sourceBlockedWithoutNextAction =
    rows.filter((row) => row.state === "source_blocked").length - sourceBlockedWithNextAction;
  const goalAccountedClaims = scoredPublicClaims + sourceBlockedWithNextAction;

  return {
    defaultLookingPublicScores: rows.filter((row) => row.state === "default_score_review").length,
    goalAccountedClaims,
    goalUnaccountedClaims: rows.length - goalAccountedClaims,
    readyToScore: rows.filter((row) => row.state === "ready_to_score").length,
    scoredPublicClaims,
    snapshotGaps: rows.filter((row) => row.state === "snapshot_gap").length,
    sourceBlocked: rows.filter((row) => row.state === "source_blocked").length,
    sourceBlockedWithoutNextAction,
    sourceBlockedWithNextAction,
    sourceBlockers,
    totalClaims: rows.length,
    workItems
  };
}

export function formatScoreReadinessSummaryLines(summary: ScoreReadinessSummary) {
  return [
    `Score readiness: ${summary.workItems}/${summary.totalClaims} claim(s) need scoring work`,
    `3B closure states: ${summary.goalAccountedClaims}/${summary.totalClaims} claim(s) scored or source-blocked with next action`,
    `Open scoring queues outside closure states: ready-to-score ${summary.readyToScore}; default-score review ${summary.defaultLookingPublicScores}; snapshot gaps ${summary.snapshotGaps}; source-blocked without next action ${summary.sourceBlockedWithoutNextAction}`,
    `Ready to score: ${summary.readyToScore}`,
    `Default-looking public scores: ${summary.defaultLookingPublicScores}`,
    `Source-blocked scoring rows: ${summary.sourceBlocked} (${formatScoreReadinessSourceBlockers(
      summary.sourceBlockers
    )})`,
    `Score snapshot gaps: ${summary.snapshotGaps}`,
    `Scored public cells: ${summary.scoredPublicClaims}`
  ];
}

export function formatScoreReadinessSourceBlockers(
  blockers: ScoreReadinessSourceBlockers
) {
  const parts = SCORE_READINESS_SOURCE_BLOCKER_ORDER
    .map((status) => ({
      count: blockers[status],
      label: SCORE_READINESS_SOURCE_BLOCKER_LABELS[status]
    }))
    .filter((part) => part.count > 0)
    .map((part) => `${part.label} ${part.count}`);

  return parts.length > 0 ? parts.join("; ") : "none";
}

export function isScorePlaceholderClaim(claim: Pick<Claim, "evidenceGrade">) {
  return (
    claim.evidenceGrade === DRAFT_LEAD_EVIDENCE_GRADE ||
    claim.evidenceGrade === SOURCE_PACKET_REVIEW_EVIDENCE_GRADE
  );
}

export function scoreReadinessCurrentScore(claim: Claim) {
  if (isScorePlaceholderClaim(claim)) {
    return null;
  }

  return compositeScore(claim.scores);
}

export function scoreReadinessStateLabel(state: ScoreReadinessState) {
  switch (state) {
    case "default_score_review":
      return "Default-looking score";
    case "ready_to_score":
      return "Ready to score";
    case "scored":
      return "Scored";
    case "snapshot_gap":
      return "Snapshot gap";
    case "source_blocked":
      return "Source-blocked";
  }
}

export function scoreReadinessNextAction(row: ScoreReadinessRow) {
  switch (row.state) {
    case "default_score_review":
      return "Review the linked source packet and replace the starter-looking public score with a claim-specific scoring rationale.";
    case "ready_to_score":
      return "Use the complete source packet to assign dimension scores, final label, and uncertainty language.";
    case "snapshot_gap":
      return "Capture a score snapshot so future score changes are auditable.";
    case "source_blocked":
      return row.packet.completeness.nextStep;
    case "scored":
      return "No immediate scoring action is required unless new sources or safety/regulatory context changes.";
  }
}

export function compareScoreReadinessForScoringPass(
  left: ScoreReadinessRow,
  right: ScoreReadinessRow
) {
  const phaseDelta =
    scoreReadinessScoringPassPhase(left.state) - scoreReadinessScoringPassPhase(right.state);

  if (phaseDelta !== 0) {
    return phaseDelta;
  }

  const priorityDelta = right.priority - left.priority;

  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  const leftName = left.intervention?.name ?? "";
  const rightName = right.intervention?.name ?? "";
  return leftName.localeCompare(rightName) || left.claim.outcome.localeCompare(right.claim.outcome);
}

export function selectScoreReadinessEditorRows(rows: ScoreReadinessRow[]) {
  const directScoreRows = rows
    .filter((row) => row.state === "default_score_review" || row.state === "ready_to_score")
    .sort(compareScoreReadinessForScoringPass);

  if (directScoreRows.length > 0) {
    return directScoreRows;
  }

  const workRows = rows
    .filter((row) => row.state !== "scored")
    .sort(compareScoreReadinessForScoringPass);

  if (workRows.length > 0) {
    return workRows.slice(0, 12);
  }

  return rows
    .filter((row) => row.state === "scored")
    .sort(compareScoreReadinessForScoringPass)
    .slice(0, 12);
}

export function scoreReadinessScoringPassPhase(state: ScoreReadinessState) {
  const phase: Record<ScoreReadinessState, number> = {
    default_score_review: 0,
    ready_to_score: 1,
    snapshot_gap: 2,
    source_blocked: 3,
    scored: 4
  };

  return phase[state];
}

function scoreReadinessState({
  claim,
  currentScore,
  hasSnapshotInventory,
  packet,
  snapshotExists
}: {
  claim: Claim;
  currentScore: number | null;
  hasSnapshotInventory: boolean;
  packet: ClaimSourcePacket;
  snapshotExists: boolean;
}): ScoreReadinessState {
  if (currentScore !== null && isStarterLookingCompositeScore(currentScore)) {
    return "default_score_review";
  }

  if (packet.completeness.status !== "complete") {
    return "source_blocked";
  }

  if (isScorePlaceholderClaim(claim)) {
    return "ready_to_score";
  }

  if (hasSnapshotInventory && !snapshotExists) {
    return "snapshot_gap";
  }

  return "scored";
}

function buildScoreReadinessSourceBlockers(
  rows: ScoreReadinessRow[]
): ScoreReadinessSourceBlockers {
  return rows.reduce<ScoreReadinessSourceBlockers>((counts, row) => {
    if (row.state !== "source_blocked" || row.packet.completeness.status === "complete") {
      return counts;
    }

    counts[row.packet.completeness.status] += 1;
    return counts;
  }, emptyScoreReadinessSourceBlockers());
}

function emptyScoreReadinessSourceBlockers(): ScoreReadinessSourceBlockers {
  return {
    extraction_pending: 0,
    missing_sources: 0,
    not_linked: 0
  };
}

function scoreReadinessPriorityScore({
  claim,
  currentScore,
  packet,
  state
}: {
  claim: Claim;
  currentScore: number | null;
  packet: ClaimSourcePacket;
  state: ScoreReadinessState;
}) {
  const stateScore: Record<ScoreReadinessState, number> = {
    default_score_review: 110,
    ready_to_score: 95,
    scored: 0,
    snapshot_gap: 55,
    source_blocked: 70
  };
  const labelWeight = scoreReadinessLabelWeight(claim.finalLabel);
  const sourceDepth =
    packet.evidenceDepth.metaAnalyses * 8 +
    packet.evidenceDepth.systematicReviews * 6 +
    packet.evidenceDepth.randomizedControlledTrials * 6 +
    packet.evidenceDepth.clinicalTrialRecords * 3;

  return Math.round(
    stateScore[state] +
      labelWeight +
      (isHumanReviewed(claim.reviewStatus) ? 18 : 8) +
      (currentScore === null ? 0 : currentScore * 2) +
      Math.min(18, sourceDepth) +
      Math.min(12, packet.completeness.totalReferences * 3)
  );
}

function scoreReadinessPriorityLabel(priority: number): ScoreReadinessPriority {
  if (priority >= 120) {
    return "High";
  }

  if (priority >= 85) {
    return "Medium";
  }

  return "Low";
}

function scoreReadinessReasons({
  claim,
  currentScore,
  hasSnapshotInventory,
  packet,
  snapshotExists,
  state
}: {
  claim: Claim;
  currentScore: number | null;
  hasSnapshotInventory: boolean;
  packet: ClaimSourcePacket;
  snapshotExists: boolean;
  state: ScoreReadinessState;
}) {
  const reasons = [scoreReadinessStateLabel(state)];

  if (currentScore !== null && isStarterLookingCompositeScore(currentScore)) {
    reasons.push(`${currentScore.toFixed(1)} matches starter-score pattern`);
  }

  if (packet.completeness.status === "complete") {
    reasons.push("source packet complete");
  } else {
    reasons.push(packet.completeness.label);
  }

  if (isScorePlaceholderClaim(claim)) {
    reasons.push("hidden from final score display");
  }

  if (hasSnapshotInventory && !snapshotExists) {
    reasons.push("no score snapshot recorded");
  }

  if (packet.evidenceDepth.metaAnalyses > 0 || packet.evidenceDepth.systematicReviews > 0) {
    reasons.push("review-level source extracted");
  }

  if (packet.evidenceDepth.randomizedControlledTrials > 0) {
    reasons.push("RCT extraction available");
  }

  if (!isHumanReviewed(claim.reviewStatus)) {
    reasons.push("pending human review");
  }

  return reasons;
}

function isStarterLookingCompositeScore(score: number) {
  return STARTER_LOOKING_COMPOSITE_SCORES.has(score.toFixed(1));
}

function scoreReadinessLabelWeight(label: EvidenceLabel) {
  if (label === "Core Evidence-Based") {
    return 22;
  }

  if (
    label === "Conditional / Biomarker-Gated" ||
    label === "Useful for Specific Use Case" ||
    label === "Safety Concern" ||
    label === "Requires Clinician Oversight" ||
    label === "Regulatory Concern"
  ) {
    return 16;
  }

  if (label === "Reasonable N-of-1 Experiment" || label === "Speculative Watchlist") {
    return 10;
  }

  return 4;
}

function isHumanReviewed(status: Claim["reviewStatus"]) {
  return status === "Human reviewed";
}
