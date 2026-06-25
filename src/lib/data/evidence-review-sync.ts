import { ReviewEventType, ScoreChangeKind as DbScoreChangeKind } from "@prisma/client";

import { captureClaimScoreSnapshotById } from "@/lib/data/score-history";
import { recordReviewEvent } from "@/lib/data/review-events";
import { syncSourcePacketForClaim } from "@/lib/data/source-packets";
import type { OperatorPrincipal } from "@/lib/operator/authorization";

export interface RecordHumanClaimEvidenceReviewInput {
  claimId: string;
  eventType?: ReviewEventType;
  principal: OperatorPrincipal;
  reviewNote: string;
  reviewedAt?: Date;
  sourcePacketId?: string;
}

export async function recordHumanClaimEvidenceReview(
  input: RecordHumanClaimEvidenceReviewInput
) {
  const sync = await syncSourcePacketForClaim(input.claimId);
  const sourcePacketId = input.sourcePacketId ?? sync.sourcePacketId;

  await recordReviewEvent({
    actorEmail: input.principal.email,
    actorUserId: input.principal.userId,
    claimId: input.claimId,
    entityId: input.claimId,
    entityType: "Claim",
    eventType: input.eventType ?? ReviewEventType.HUMAN_REVIEWED,
    note: input.reviewNote,
    reviewStatus: "Human reviewed",
    sourcePacketId
  });

  const snapshot = await captureClaimScoreSnapshotById({
    changedByUserId: input.principal.userId,
    claimId: input.claimId,
    rationale: input.reviewNote,
    reason: DbScoreChangeKind.MANUAL_REVIEW
  });

  return {
    snapshot,
    sync
  };
}

export async function recordSourcePacketMutationReview(input: {
  claimId: string;
  note?: string;
  principal?: OperatorPrincipal;
  referenceId?: string;
  studyId?: string;
}) {
  const sync = await syncSourcePacketForClaim(input.claimId);

  if (input.principal) {
    await recordReviewEvent({
      actorEmail: input.principal.email,
      actorUserId: input.principal.userId,
      claimId: input.claimId,
      entityId: sync.sourcePacketId,
      entityType: "SourcePacket",
      eventType: ReviewEventType.SOURCE_PACKET_UPDATED,
      note: input.note,
      referenceId: input.referenceId,
      sourcePacketId: sync.sourcePacketId,
      studyId: input.studyId
    });
  }

  return sync;
}
