import { ScoreChangeKind as DbScoreChangeKind, type Claim, type ClaimScoreHistory, type ClaimScoreSnapshot } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

import { prisma } from "@/lib/db/prisma";
import {
  evidenceLabelFromDb,
  evidenceLabelToDb,
  mapReviewStatusFromDb,
  scoreSetFromClaimFields,
  snapshotsEquivalent
} from "@/lib/data/evidence-model-mappers";
import { compositeScore } from "@/lib/scoring";
import type { ClaimScoreHistoryRow, ClaimScoreSnapshotRow, EvidenceLabel, ScoreSet } from "@/lib/types";

export interface CaptureClaimScoreSnapshotInput {
  changedByUserId?: string;
  claimId: string;
  force?: boolean;
  rationale: string;
  reason: DbScoreChangeKind;
  referenceId?: string;
}

export interface CaptureClaimScoreSnapshotResult {
  created: boolean;
  historyId?: string;
  snapshotId?: string;
}

type DbClaimForSnapshot = Pick<
  Claim,
  | "evidenceDirectnessScore"
  | "evidenceRigorScore"
  | "effectSizeScore"
  | "safetyScore"
  | "finalLabel"
  | "hypePenalty"
  | "id"
  | "measurabilityScore"
  | "productQualityScore"
  | "regulatoryRiskScore"
  | "reviewStatus"
>;

export async function getLatestClaimScoreSnapshot(
  claimId: string
): Promise<ClaimScoreSnapshot | null> {
  return prisma.claimScoreSnapshot.findFirst({
    orderBy: [{ computedAt: "desc" }, { createdAt: "desc" }],
    where: { claimId }
  });
}

export async function listLatestClaimScoreSnapshots(
  claimIds?: string[]
): Promise<ClaimScoreSnapshot[]> {
  const snapshots = await prisma.claimScoreSnapshot.findMany({
    orderBy: [{ computedAt: "desc" }, { createdAt: "desc" }],
    where: claimIds ? { claimId: { in: claimIds } } : undefined
  });
  const latestByClaim = new Map<string, ClaimScoreSnapshot>();

  for (const snapshot of snapshots) {
    if (!latestByClaim.has(snapshot.claimId)) {
      latestByClaim.set(snapshot.claimId, snapshot);
    }
  }

  return Array.from(latestByClaim.values());
}

export async function listClaimScoreHistory(
  claimIds?: string[],
  limit = 100
): Promise<ClaimScoreHistory[]> {
  return prisma.claimScoreHistory.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: limit,
    where: claimIds ? { claimId: { in: claimIds } } : undefined
  });
}

export function mapClaimScoreSnapshotRow(snapshot: ClaimScoreSnapshot): ClaimScoreSnapshotRow {
  return {
    claimId: snapshot.claimId,
    compositeScore: Number(snapshot.compositeScore),
    computedAt: snapshot.computedAt.toISOString(),
    finalLabel: evidenceLabelFromDb[snapshot.finalLabel],
    reviewStatus: mapReviewStatusFromDb(snapshot.reviewStatus),
    scores: scoreSetFromClaimFields(snapshot),
    scoreVersion: snapshot.scoreVersion,
    snapshotId: snapshot.id
  };
}

export function mapClaimScoreHistoryRow(history: ClaimScoreHistory): ClaimScoreHistoryRow {
  return {
    claimId: history.claimId,
    createdAt: history.createdAt.toISOString(),
    id: history.id,
    newCompositeScore:
      history.newCompositeScore === null || history.newCompositeScore === undefined
        ? undefined
        : Number(history.newCompositeScore),
    newLabel: history.newLabel ? evidenceLabelFromDb[history.newLabel] : undefined,
    oldCompositeScore:
      history.oldCompositeScore === null || history.oldCompositeScore === undefined
        ? undefined
        : Number(history.oldCompositeScore),
    oldLabel: history.oldLabel ? evidenceLabelFromDb[history.oldLabel] : undefined,
    rationale: history.rationale,
    reason: history.reason
  };
}

export async function captureClaimScoreSnapshot(
  claim: DbClaimForSnapshot,
  input: CaptureClaimScoreSnapshotInput
): Promise<CaptureClaimScoreSnapshotResult> {
  const scores = scoreSetFromClaimFields(claim);
  const finalLabel = evidenceLabelFromDb[claim.finalLabel];
  const composite = compositeScore(scores);
  const latest = await getLatestClaimScoreSnapshot(claim.id);

  if (
    latest &&
    !input.force &&
    snapshotsEquivalent(
      { ...scores, compositeScore: composite, finalLabel },
      {
        ...scoreSetFromClaimFields(latest),
        compositeScore: Number(latest.compositeScore),
        finalLabel: evidenceLabelFromDb[latest.finalLabel]
      }
    )
  ) {
    return { created: false, snapshotId: latest.id };
  }

  const snapshot = await prisma.claimScoreSnapshot.create({
    data: {
      claimId: claim.id,
      compositeScore: new Decimal(composite),
      computedAt: new Date(),
      effectSizeScore: claim.effectSizeScore,
      evidenceDirectnessScore: claim.evidenceDirectnessScore,
      evidenceRigorScore: claim.evidenceRigorScore,
      finalLabel: claim.finalLabel,
      hypePenalty: claim.hypePenalty,
      measurabilityScore: claim.measurabilityScore,
      productQualityScore: claim.productQualityScore,
      rationale: input.rationale,
      regulatoryRiskScore: claim.regulatoryRiskScore,
      reviewStatus: claim.reviewStatus,
      safetyScore: claim.safetyScore,
      scoreVersion: "v1"
    }
  });

  let historyId: string | undefined;

  if (
    latest &&
    (Number(latest.compositeScore) !== composite || latest.finalLabel !== claim.finalLabel)
  ) {
    const history = await prisma.claimScoreHistory.create({
      data: {
        changedByUserId: input.changedByUserId,
        claimId: claim.id,
        newCompositeScore: new Decimal(composite),
        newLabel: claim.finalLabel,
        newSnapshotId: snapshot.id,
        oldCompositeScore: latest.compositeScore,
        oldLabel: latest.finalLabel,
        previousSnapshotId: latest.id,
        rationale: input.rationale,
        reason: input.reason,
        referenceId: input.referenceId
      }
    });
    historyId = history.id;
  } else if (!latest) {
    const history = await prisma.claimScoreHistory.create({
      data: {
        changedByUserId: input.changedByUserId,
        claimId: claim.id,
        newCompositeScore: new Decimal(composite),
        newLabel: claim.finalLabel,
        newSnapshotId: snapshot.id,
        rationale: input.rationale,
        reason: input.reason,
        referenceId: input.referenceId
      }
    });
    historyId = history.id;
  }

  return { created: true, historyId, snapshotId: snapshot.id };
}

export async function captureClaimScoreSnapshotById(
  input: CaptureClaimScoreSnapshotInput
): Promise<CaptureClaimScoreSnapshotResult> {
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
    where: { id: input.claimId }
  });

  if (!claim) {
    throw new Error(`Claim not found for score snapshot: ${input.claimId}.`);
  }

  return captureClaimScoreSnapshot(claim, input);
}

export function claimScoresFromSnapshot(snapshot: ClaimScoreSnapshot): ScoreSet & {
  compositeScore: number;
  finalLabel: EvidenceLabel;
} {
  return {
    ...scoreSetFromClaimFields(snapshot),
    compositeScore: Number(snapshot.compositeScore),
    finalLabel: evidenceLabelFromDb[snapshot.finalLabel]
  };
}

export function evidenceLabelForClaimLabel(label: EvidenceLabel) {
  return evidenceLabelToDb[label];
}
