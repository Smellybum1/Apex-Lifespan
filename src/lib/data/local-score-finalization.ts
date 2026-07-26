import { ScoreChangeKind as DbScoreChangeKind } from "@prisma/client";

import { getEvidenceDashboardData } from "@/lib/data/dashboard";
import { applyUpdateClaimScore } from "@/lib/data/score-update";
import {
  buildScoreReadinessRows,
  buildScoreReadinessSummary
} from "@/lib/score-readiness";
import {
  buildScoreWorklistReport,
  type ScoreWorklistRepairSummary,
  type ScoreWorklistRow
} from "@/lib/score-worklist";
import { buildScoreUpdateDraft } from "@/lib/score-update-draft";

const LOCAL_SCORE_FINALIZATION_LIMIT_DEFAULT = 500;
const LOCAL_SCORE_FINALIZATION_LIMIT_MAX = 1000;

export type LocalScoreFinalizationInput = {
  apply?: boolean;
  limit?: number;
};

export type LocalScoreFinalizationDecision = {
  applied: boolean;
  claimId: string;
  currentScoreLabel: string;
  error?: string;
  finalLabel?: string;
  interventionName?: string;
  outcome: string;
  reasons: string[];
  snapshotCreated?: boolean;
  suggestedScoreLabel?: string;
  updatedClaim?: boolean;
};

export type LocalScoreFinalizationResponse = {
  action: "finalize-score-ready";
  applied: boolean;
  counts: {
    appliedUpdates: number;
    defaultScoreReview: number;
    errors: number;
    readyAfter: number;
    readyBefore: number;
    scanned: number;
    scoredPublicClaims: number;
    skippedNoChange: number;
    /** Rows with no conclusion of their own; scoring them would be meaningless. */
    skippedUnscorable: number;
    snapshotGaps: number;
    sourceBlocked: number;
    sourceBlockedWithoutNextAction: number;
    sourceBlockers: {
      extraction_pending: number;
      missing_sources: number;
      not_linked: number;
    };
  };
  decisions: LocalScoreFinalizationDecision[];
  limit: number;
  message: string;
  repairSummary: Pick<
    ScoreWorklistRepairSummary,
    | "blockerBreakdown"
    | "extractionBatchGroups"
    | "extractionPendingRows"
    | "extractionReadyReferenceGroups"
    | "identityWarningReferenceGroups"
    | "missingSourceRows"
    | "sourceBlockedRows"
    | "unlinkedRows"
  >;
  updatedAt: string;
};

export async function runLocalScoreFinalization(
  input: LocalScoreFinalizationInput = {}
): Promise<LocalScoreFinalizationResponse> {
  const limit = normaliseScoreFinalizationLimit(input.limit);
  const applied = input.apply === true;
  const beforeData = await getEvidenceDashboardData();
  const beforeWorklist = buildScoreWorklistReport(beforeData, {
    limit: Math.max(beforeData.claims.length, 1),
    state: "work"
  });
  const readyReport = buildScoreWorklistReport(beforeData, {
    limit,
    state: "ready_to_score"
  });
  const decisions: LocalScoreFinalizationDecision[] = [];
  let appliedUpdates = 0;
  let skippedNoChange = 0;

  // Placeholder and watchlist rows have no conclusion to score. They are not
  // failures — they are simply not scoring work — so they never enter the loop.
  const scorableRows = readyReport.rows.filter((row) => !row.suggestion.blockedReason);
  const unscorableRows = readyReport.rows.length - scorableRows.length;

  for (const row of scorableRows) {
    const decision = await scoreReadyDecision(row, applied);
    decisions.push(decision);

    if (decision.applied) {
      if (decision.updatedClaim || decision.snapshotCreated) {
        appliedUpdates += 1;
      } else {
        skippedNoChange += 1;
      }
    }
  }

  const afterData = await getEvidenceDashboardData();
  const afterSummary = buildScoreReadinessSummary(buildScoreReadinessRows(afterData));
  const errors = decisions.filter((decision) => decision.error).length;
  const readyBefore = readyReport.totalMatchingRows;

  return {
    action: "finalize-score-ready",
    applied,
    counts: {
      appliedUpdates,
      defaultScoreReview: afterSummary.defaultLookingPublicScores,
      errors,
      readyAfter: afterSummary.readyToScore,
      readyBefore,
      scanned: readyReport.rows.length,
      scoredPublicClaims: afterSummary.scoredPublicClaims,
      skippedNoChange,
      skippedUnscorable: unscorableRows,
      snapshotGaps: afterSummary.snapshotGaps,
      sourceBlocked: afterSummary.sourceBlocked,
      sourceBlockedWithoutNextAction: afterSummary.sourceBlockedWithoutNextAction,
      sourceBlockers: afterSummary.sourceBlockers
    },
    decisions,
    limit,
    message: scoreFinalizationMessage({
      applied,
      appliedUpdates,
      errors,
      readyAfter: afterSummary.readyToScore,
      readyBefore,
      scanned: readyReport.rows.length,
      skippedNoChange,
      sourceBlocked: afterSummary.sourceBlocked
    }),
    repairSummary: {
      blockerBreakdown: beforeWorklist.repairSummary.blockerBreakdown,
      extractionBatchGroups: beforeWorklist.repairSummary.extractionBatchGroups.slice(0, 5),
      extractionPendingRows: beforeWorklist.repairSummary.extractionPendingRows,
      extractionReadyReferenceGroups: beforeWorklist.repairSummary.extractionReadyReferenceGroups,
      identityWarningReferenceGroups: beforeWorklist.repairSummary.identityWarningReferenceGroups,
      missingSourceRows: beforeWorklist.repairSummary.missingSourceRows,
      sourceBlockedRows: beforeWorklist.repairSummary.sourceBlockedRows,
      unlinkedRows: beforeWorklist.repairSummary.unlinkedRows
    },
    updatedAt: new Date().toISOString()
  };
}

async function scoreReadyDecision(
  row: ScoreWorklistRow,
  applied: boolean
): Promise<LocalScoreFinalizationDecision> {
  const base = {
    claimId: row.claimId,
    currentScoreLabel: row.currentScoreLabel,
    interventionName: row.intervention?.name,
    outcome: row.outcome,
    reasons: row.reasons
  };

  try {
    const draft = buildScoreUpdateDraft(row);

    if (!applied) {
      return {
        ...base,
        applied: false,
        finalLabel: draft.finalLabel,
        suggestedScoreLabel: row.suggestion.compositeScoreLabel
      };
    }

    const result = await applyUpdateClaimScore({
      claimId: draft.claimId,
      finalLabel: draft.finalLabel,
      rationale: `${draft.rationale}\n\nApplied by the local UPDATE score-ready finalization pass. Kept as Unreviewed AI Draft; Human reviewed remains reserved for explicit human confirmation.`,
      reason: DbScoreChangeKind.OTHER,
      scores: draft.scores
    });

    return {
      ...base,
      applied: true,
      finalLabel: draft.finalLabel,
      snapshotCreated: result.result.created,
      suggestedScoreLabel: row.suggestion.compositeScoreLabel,
      updatedClaim: result.updatedClaim
    };
  } catch (error) {
    return {
      ...base,
      applied: false,
      error:
        error instanceof Error
          ? error.message
          : "Score-ready finalization failed for this claim."
    };
  }
}

function normaliseScoreFinalizationLimit(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return LOCAL_SCORE_FINALIZATION_LIMIT_DEFAULT;
  }

  return Math.min(
    LOCAL_SCORE_FINALIZATION_LIMIT_MAX,
    Math.max(1, Math.floor(value ?? LOCAL_SCORE_FINALIZATION_LIMIT_DEFAULT))
  );
}

function scoreFinalizationMessage({
  applied,
  appliedUpdates,
  errors,
  readyAfter,
  readyBefore,
  scanned,
  skippedNoChange,
  sourceBlocked
}: {
  applied: boolean;
  appliedUpdates: number;
  errors: number;
  readyAfter: number;
  readyBefore: number;
  scanned: number;
  skippedNoChange: number;
  sourceBlocked: number;
}) {
  const action = applied ? "Applied" : "Previewed";

  return `${action} ${appliedUpdates.toLocaleString()} score-ready update(s) from ${scanned.toLocaleString()} scanned / ${readyBefore.toLocaleString()} ready row(s); ${skippedNoChange.toLocaleString()} already current, ${errors.toLocaleString()} error(s). ${readyAfter.toLocaleString()} ready-to-score and ${sourceBlocked.toLocaleString()} source-blocked row(s) remain.`;
}
