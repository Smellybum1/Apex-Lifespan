import { OperatorStatus, ReviewEventType, ScoreChangeKind as DbScoreChangeKind } from "@prisma/client";

import { applyUpdateClaimScore, dryRunUpdateClaimScore } from "@/lib/data/score-update";
import { recordReviewEvent } from "@/lib/data/review-events";
import type { OperatorPrincipal, OperatorWriteEnv } from "@/lib/operator/authorization";
import {
  canOperatorAccess,
  OperatorAuthorizationError,
  requireOperatorPermission
} from "@/lib/operator/authorization";
import { recordOperatorAuditEvent } from "@/lib/operator/audit";
import type { EvidenceLabel, ScoreSet } from "@/lib/types";

export interface UpdateClaimScoreAsOperatorInput {
  claimId: string;
  dryRun?: boolean;
  finalLabel: EvidenceLabel;
  rationale: string;
  scores: ScoreSet;
}

export async function updateClaimScoreAsOperator(
  principal: OperatorPrincipal,
  input: UpdateClaimScoreAsOperatorInput,
  env?: OperatorWriteEnv
) {
  if (input.dryRun) {
    requireOperatorScoreUpdateAccess(principal);
  } else {
    requireOperatorPermission(principal, "evidence:promote", env);
  }

  const payload = {
    claimId: input.claimId,
    finalLabel: input.finalLabel,
    rationale: input.rationale,
    reason: DbScoreChangeKind.MANUAL_REVIEW,
    scores: input.scores
  };

  if (input.dryRun) {
    return dryRunUpdateClaimScore(payload);
  }

  const result = await applyUpdateClaimScore({
    ...payload,
    changedByUserId: principal.userId
  });
  const changed = result.updatedClaim || result.result.created;

  if (changed) {
    await recordReviewEvent({
      actorEmail: principal.email,
      actorUserId: principal.userId,
      claimId: result.before.claimId,
      entityId: result.before.claimId,
      entityType: "Claim",
      eventType: ReviewEventType.CLAIM_SCORE_UPDATED,
      metadata: {
        createdSnapshot: result.result.created,
        updatedClaim: result.updatedClaim
      },
      note: result.before.rationale
    });
  }

  await recordOperatorAuditEvent(principal, {
    action: "claimScore.update",
    afterSummary: {
      claimId: result.before.claimId,
      compositeScore: result.before.next.compositeScore,
      created: result.result.created,
      finalLabel: result.before.next.finalLabel,
      historyId: result.result.historyId ?? null,
      snapshotId: result.result.snapshotId ?? null,
      updatedClaim: result.updatedClaim
    },
    beforeSummary: {
      claimId: result.before.claimId,
      compositeScore: result.before.current.compositeScore,
      finalLabel: result.before.current.finalLabel
    },
    note: result.before.rationale,
    targetId: result.before.claimId,
    targetType: "Claim"
  });

  return result;
}

function requireOperatorScoreUpdateAccess(principal: OperatorPrincipal | null | undefined) {
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
