import { ReviewEventType, ScoreChangeKind as DbScoreChangeKind, OperatorStatus } from "@prisma/client";

import { applyRecomputeClaimScore, dryRunRecomputeClaimScore } from "@/lib/data/score-recompute";
import { recordReviewEvent } from "@/lib/data/review-events";
import type { OperatorPrincipal, OperatorWriteEnv } from "@/lib/operator/authorization";
import {
  canOperatorAccess,
  OperatorAuthorizationError,
  requireOperatorPermission
} from "@/lib/operator/authorization";
import { recordOperatorAuditEvent } from "@/lib/operator/audit";

export interface RecomputeClaimScoreAsOperatorInput {
  claimId: string;
  dryRun?: boolean;
  rationale: string;
}

export async function recomputeClaimScoreAsOperator(
  principal: OperatorPrincipal,
  input: RecomputeClaimScoreAsOperatorInput,
  env?: OperatorWriteEnv
) {
  if (input.dryRun) {
    requireOperatorScoreRecomputeAccess(principal);
  } else {
    requireOperatorPermission(principal, "evidence:promote", env);
  }

  const claimId = input.claimId.trim();
  const rationale = input.rationale.trim();

  if (!claimId) {
    throw new Error("Claim id is required.");
  }

  if (!rationale) {
    throw new Error("Score recompute rationale is required.");
  }

  if (input.dryRun) {
    return dryRunRecomputeClaimScore(claimId, rationale, DbScoreChangeKind.MANUAL_REVIEW);
  }

  const before = await dryRunRecomputeClaimScore(claimId, rationale, DbScoreChangeKind.MANUAL_REVIEW);
  const result = await applyRecomputeClaimScore(
    claimId,
    rationale,
    DbScoreChangeKind.MANUAL_REVIEW,
    principal.userId
  );

  if (result.created) {
    await recordReviewEvent({
      actorEmail: principal.email,
      actorUserId: principal.userId,
      claimId,
      entityId: claimId,
      entityType: "Claim",
      eventType: ReviewEventType.CLAIM_SCORE_UPDATED,
      note: rationale
    });
  }

  await recordOperatorAuditEvent(principal, {
    action: "claimScore.recompute",
    afterSummary: {
      claimId,
      created: result.created,
      historyId: result.historyId ?? null,
      snapshotId: result.snapshotId ?? null,
      wouldChange: before.wouldChange
    },
    beforeSummary: {
      claimId,
      compositeScore: before.current.compositeScore,
      finalLabel: before.current.finalLabel
    },
    note: rationale,
    targetId: claimId,
    targetType: "Claim"
  });

  return {
    before,
    result
  };
}

function requireOperatorScoreRecomputeAccess(principal: OperatorPrincipal | null | undefined) {
  if (!principal) {
    throw new OperatorAuthorizationError("Operator authentication required.", 401);
  }

  if (principal.status !== OperatorStatus.ACTIVE) {
    throw new OperatorAuthorizationError("Operator access is disabled.", 403);
  }

  if (!canOperatorAccess(principal.role, "evidence:promote")) {
    throw new OperatorAuthorizationError("Operator role does not allow this action.", 403);
  }

  return principal;
}
