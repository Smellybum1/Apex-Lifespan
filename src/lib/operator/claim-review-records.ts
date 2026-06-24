import {
  type EvidenceLabel as DbEvidenceLabel,
  type Prisma,
  PublicChangelogKind as DbPublicChangelogKind,
  ReviewEventType as DbReviewEventType,
  ReviewStatus as DbReviewStatus,
  ScoreChangeKind as DbScoreChangeKind
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type { OperatorPrincipal } from "@/lib/operator/authorization";
import { compositeScore } from "@/lib/scoring";
import type { ScoreSet } from "@/lib/types";

type ClaimReviewArtifactClient = Pick<
  typeof prisma,
  "claimScoreHistory" | "claimScoreSnapshot" | "publicChangelogEntry" | "reviewEvent"
>;

type ClaimReviewArtifactStatus =
  | typeof DbReviewStatus.AI_REVIEWED
  | typeof DbReviewStatus.HUMAN_REVIEWED;

export interface ReviewableClaimScoreFields {
  evidenceDirectnessScore: number;
  evidenceRigorScore: number;
  effectSizeScore: number;
  finalLabel: DbEvidenceLabel;
  hypePenalty: number;
  id: string;
  measurabilityScore: number;
  productQualityScore: number;
  regulatoryRiskScore: number;
  safetyScore: number;
}

export interface RecordClaimReviewArtifactsInput {
  changelog: {
    details: string[];
    interventionId?: string;
    publicImpact: string;
    title: string;
  };
  claim: ReviewableClaimScoreFields;
  client?: ClaimReviewArtifactClient;
  entityId?: string;
  entityType: string;
  metadata?: Prisma.InputJsonValue;
  note: string;
  principal: OperatorPrincipal;
  rationale: string;
  referenceId?: string;
  reviewStatus?: ClaimReviewArtifactStatus;
  reviewedAt: Date;
  sourcePacketId?: string;
  studyId?: string;
}

export async function recordClaimReviewArtifacts({
  changelog,
  claim,
  client = prisma,
  entityId,
  entityType,
  metadata,
  note,
  principal,
  rationale,
  referenceId,
  reviewStatus = DbReviewStatus.HUMAN_REVIEWED,
  reviewedAt,
  sourcePacketId,
  studyId
}: RecordClaimReviewArtifactsInput) {
  const scores = claimScoreSet(claim);
  const previousSnapshot = await client.claimScoreSnapshot.findFirst({
    orderBy: [{ computedAt: "desc" }, { createdAt: "desc" }],
    select: {
      compositeScore: true,
      finalLabel: true,
      id: true
    },
    where: {
      claimId: claim.id
    }
  });

  const [reviewEvent, scoreSnapshot] = await Promise.all([
    client.reviewEvent.create({
      data: {
        actorEmail: principal.email,
        actorUserId: principal.userId,
        claimId: claim.id,
        createdAt: reviewedAt,
        entityId,
        entityType,
        eventType:
          reviewStatus === DbReviewStatus.AI_REVIEWED
            ? DbReviewEventType.AI_REVIEWED
            : DbReviewEventType.HUMAN_REVIEWED,
        metadata,
        note,
        referenceId,
        reviewStatus,
        sourcePacketId,
        studyId
      }
    }),
    client.claimScoreSnapshot.create({
      data: {
        claimId: claim.id,
        compositeScore: compositeScore(scores),
        computedAt: reviewedAt,
        evidenceDirectnessScore: claim.evidenceDirectnessScore,
        evidenceRigorScore: claim.evidenceRigorScore,
        effectSizeScore: claim.effectSizeScore,
        finalLabel: claim.finalLabel,
        hypePenalty: claim.hypePenalty,
        measurabilityScore: claim.measurabilityScore,
        productQualityScore: claim.productQualityScore,
        rationale,
        regulatoryRiskScore: claim.regulatoryRiskScore,
        reviewStatus,
        safetyScore: claim.safetyScore,
        scoreVersion: "v1"
      }
    })
  ]);
  const scoreHistory = await client.claimScoreHistory.create({
    data: {
      changedByUserId: principal.userId,
      claimId: claim.id,
      createdAt: reviewedAt,
      newCompositeScore: scoreSnapshot.compositeScore,
      newLabel: scoreSnapshot.finalLabel,
      newSnapshotId: scoreSnapshot.id,
      oldCompositeScore: previousSnapshot?.compositeScore ?? null,
      oldLabel: previousSnapshot?.finalLabel ?? null,
      previousSnapshotId: previousSnapshot?.id,
      rationale,
      reason: DbScoreChangeKind.MANUAL_REVIEW,
      referenceId
    }
  });
  const changelogEntry = await client.publicChangelogEntry.create({
    data: {
      claimId: claim.id,
      date: reviewedAt,
      details: changelog.details,
      interventionId: changelog.interventionId,
      kind: DbPublicChangelogKind.EVIDENCE_CARD,
      publicImpact: changelog.publicImpact,
      publishedAt: null,
      scoreHistoryId: scoreHistory.id,
      slug: `claim-review-${claim.id}-${scoreHistory.id}`,
      title: changelog.title
    }
  });

  return {
    changelogEntry,
    reviewEvent,
    scoreHistory,
    scoreSnapshot
  };
}

function claimScoreSet(claim: ReviewableClaimScoreFields): ScoreSet {
  return {
    evidenceDirectness: claim.evidenceDirectnessScore,
    evidenceRigor: claim.evidenceRigorScore,
    effectSize: claim.effectSizeScore,
    hypePenalty: claim.hypePenalty,
    measurability: claim.measurabilityScore,
    productQuality: claim.productQualityScore,
    regulatoryRisk: claim.regulatoryRiskScore,
    safety: claim.safetyScore
  };
}
