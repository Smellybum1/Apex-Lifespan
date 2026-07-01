import { ScoreChangeKind as DbScoreChangeKind } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
  captureClaimScoreSnapshot,
  getLatestClaimScoreSnapshot,
  type CaptureClaimScoreSnapshotResult
} from "@/lib/data/score-history";
import {
  evidenceLabelFromDb,
  evidenceLabelToDb,
  scoreSetFromClaimFields,
  snapshotsEquivalent
} from "@/lib/data/evidence-model-mappers";
import {
  CLAIM_SCORE_FIELD_DEFINITIONS,
  EVIDENCE_LABEL_OPTIONS
} from "@/lib/score-fields";
import { compositeScore } from "@/lib/scoring";
import type { EvidenceLabel, ScoreSet } from "@/lib/types";

export { CLAIM_SCORE_FIELD_DEFINITIONS, EVIDENCE_LABEL_OPTIONS };

export interface UpdateClaimScoreInput {
  changedByUserId?: string;
  claimId: string;
  finalLabel: EvidenceLabel;
  rationale: string;
  reason?: DbScoreChangeKind;
  scores: ScoreSet;
}

export interface ClaimScoreState {
  compositeScore: number;
  finalLabel: EvidenceLabel;
  scores: ScoreSet;
}

export interface UpdateClaimScoreDryRun {
  claimId: string;
  current: ClaimScoreState;
  dryRun: true;
  next: ClaimScoreState;
  rationale: string;
  reason: DbScoreChangeKind;
  wouldCreateHistory: boolean;
  wouldCreateSnapshot: boolean;
  wouldUpdateClaim: boolean;
}

export interface ApplyClaimScoreUpdateResult {
  before: UpdateClaimScoreDryRun;
  result: CaptureClaimScoreSnapshotResult;
  updatedClaim: boolean;
}

const claimScoreUpdateSelect = {
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
} as const;

export async function dryRunUpdateClaimScore(
  input: UpdateClaimScoreInput
): Promise<UpdateClaimScoreDryRun> {
  const { preview } = await buildUpdateClaimScorePreview(input);
  return preview;
}

export async function applyUpdateClaimScore(
  input: UpdateClaimScoreInput
): Promise<ApplyClaimScoreUpdateResult> {
  const { dbFinalLabel, normalizedScores, preview, sourceClaim } =
    await buildUpdateClaimScorePreview(input);

  let claimForSnapshot = sourceClaim;

  if (preview.wouldUpdateClaim) {
    claimForSnapshot = await prisma.claim.update({
      data: {
        effectSizeScore: normalizedScores.effectSize,
        evidenceDirectnessScore: normalizedScores.evidenceDirectness,
        evidenceRigorScore: normalizedScores.evidenceRigor,
        finalLabel: dbFinalLabel,
        hypePenalty: normalizedScores.hypePenalty,
        measurabilityScore: normalizedScores.measurability,
        productQualityScore: normalizedScores.productQuality,
        regulatoryRiskScore: normalizedScores.regulatoryRisk,
        safetyScore: normalizedScores.safety
      },
      select: claimScoreUpdateSelect,
      where: { id: preview.claimId }
    });
  }

  const result = await captureClaimScoreSnapshot(claimForSnapshot, {
    changedByUserId: input.changedByUserId,
    claimId: preview.claimId,
    rationale: preview.rationale,
    reason: preview.reason
  });

  return {
    before: preview,
    result,
    updatedClaim: preview.wouldUpdateClaim
  };
}

async function buildUpdateClaimScorePreview(input: UpdateClaimScoreInput) {
  const claimId = input.claimId.trim();
  const rationale = input.rationale.trim();
  const normalizedScores = normalizeScoreSet(input.scores);
  const dbFinalLabel = evidenceLabelToDb[input.finalLabel];
  const reason = input.reason ?? DbScoreChangeKind.MANUAL_REVIEW;

  if (!claimId) {
    throw new Error("Claim id is required.");
  }

  if (!rationale) {
    throw new Error("Score update rationale is required.");
  }

  if (!dbFinalLabel) {
    throw new Error("finalLabel is not supported.");
  }

  const sourceClaim = await prisma.claim.findUnique({
    select: claimScoreUpdateSelect,
    where: { id: claimId }
  });

  if (!sourceClaim) {
    throw new Error(`Claim not found for score update: ${claimId}.`);
  }

  const currentScores = scoreSetFromClaimFields(sourceClaim);
  const currentFinalLabel = evidenceLabelFromDb[sourceClaim.finalLabel];
  const currentComposite = compositeScore(currentScores);
  const nextComposite = compositeScore(normalizedScores);
  const latest = await getLatestClaimScoreSnapshot(claimId);
  const next = {
    ...normalizedScores,
    compositeScore: nextComposite,
    finalLabel: input.finalLabel
  };
  const wouldCreateSnapshot =
    !latest ||
    !snapshotsEquivalent(next, {
      ...scoreSetFromClaimFields(latest),
      compositeScore: Number(latest.compositeScore),
      finalLabel: evidenceLabelFromDb[latest.finalLabel]
    });
  const wouldUpdateClaim =
    currentFinalLabel !== input.finalLabel ||
    CLAIM_SCORE_FIELD_DEFINITIONS.some(
      ({ key }) => currentScores[key] !== normalizedScores[key]
    );

  return {
    dbFinalLabel,
    normalizedScores,
    preview: {
      claimId,
      current: {
        compositeScore: currentComposite,
        finalLabel: currentFinalLabel,
        scores: currentScores
      },
      dryRun: true as const,
      next: {
        compositeScore: nextComposite,
        finalLabel: input.finalLabel,
        scores: normalizedScores
      },
      rationale,
      reason,
      wouldCreateHistory: wouldCreateSnapshot,
      wouldCreateSnapshot,
      wouldUpdateClaim
    },
    sourceClaim
  };
}

function normalizeScoreSet(scores: ScoreSet): ScoreSet {
  return CLAIM_SCORE_FIELD_DEFINITIONS.reduce((normalized, { key }) => {
    const value = scores[key];

    if (!Number.isInteger(value) || value < 0 || value > 10) {
      throw new Error(`${key} must be an integer from 0 to 10.`);
    }

    return {
      ...normalized,
      [key]: value
    };
  }, {} as ScoreSet);
}
