import { ScoreChangeKind as DbScoreChangeKind } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
  captureClaimScoreSnapshot,
  getLatestClaimScoreSnapshot
} from "@/lib/data/score-history";
import {
  evidenceLabelFromDb,
  scoreSetFromClaimFields,
  snapshotsEquivalent
} from "@/lib/data/evidence-model-mappers";
import { compositeScore } from "@/lib/scoring";
import type { EvidenceLabel } from "@/lib/types";

export interface RecomputeClaimScoreDryRun {
  claimId: string;
  current: {
    compositeScore: number;
    finalLabel: EvidenceLabel;
    scores: ReturnType<typeof scoreSetFromClaimFields>;
  };
  dryRun: true;
  rationale: string;
  reason: DbScoreChangeKind;
  wouldChange: boolean;
  wouldCreateHistory: boolean;
  wouldCreateSnapshot: boolean;
}

export async function dryRunRecomputeClaimScore(
  claimId: string,
  rationale = "Score recomputation dry-run.",
  reason: DbScoreChangeKind = DbScoreChangeKind.OTHER
): Promise<RecomputeClaimScoreDryRun> {
  const claim = await prisma.claim.findUnique({
    where: { id: claimId }
  });

  if (!claim) {
    throw new Error(`Claim not found for score recompute: ${claimId}.`);
  }

  const scores = scoreSetFromClaimFields(claim);
  const finalLabel = evidenceLabelFromDb[claim.finalLabel];
  const composite = compositeScore(scores);
  const latest = await getLatestClaimScoreSnapshot(claimId);
  const wouldCreateSnapshot =
    !latest ||
    !snapshotsEquivalent(
      { ...scores, compositeScore: composite, finalLabel },
      {
        ...scoreSetFromClaimFields(latest),
        compositeScore: Number(latest.compositeScore),
        finalLabel: evidenceLabelFromDb[latest.finalLabel]
      }
    );

  const wouldChange =
    !latest ||
    Number(latest.compositeScore) !== composite ||
    latest.finalLabel !== claim.finalLabel;

  return {
    claimId,
    current: {
      compositeScore: composite,
      finalLabel,
      scores
    },
    dryRun: true,
    rationale,
    reason,
    wouldChange,
    wouldCreateHistory: wouldChange && Boolean(latest),
    wouldCreateSnapshot
  };
}

export async function applyRecomputeClaimScore(
  claimId: string,
  rationale: string,
  reason: DbScoreChangeKind = DbScoreChangeKind.OTHER,
  changedByUserId?: string
) {
  const claim = await prisma.claim.findUnique({
    select: {
      effectSizeScore: true,
      evidenceDirectnessScore: true,
      evidenceRigorScore: true,
      finalLabel: true,
      hypePenalty: true,
      id: true,
      measurabilityScore: true,
      productQualityScore: true,
      regulatoryRiskScore: true,
      reviewStatus: true,
      safetyScore: true
    },
    where: { id: claimId }
  });

  if (!claim) {
    throw new Error(`Claim not found for score recompute: ${claimId}.`);
  }

  return captureClaimScoreSnapshot(claim, {
    changedByUserId,
    claimId,
    rationale,
    reason
  });
}
