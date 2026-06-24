import { ReviewStatus as DbReviewStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type { OperatorPrincipal, OperatorWriteEnv } from "@/lib/operator/authorization";
import { requireOperatorPermission } from "@/lib/operator/authorization";
import { recordOperatorAuditEvent } from "@/lib/operator/audit";
import { recordClaimReviewArtifacts } from "@/lib/operator/claim-review-records";

export interface ReviewClaimPacketAsOperatorInput {
  approvalBasis?: ReviewClaimPacketApprovalBasis;
  claimId: string;
  reviewedAt?: Date;
  reviewNote: string;
}

export type ReviewClaimPacketApprovalBasis =
  | "codex-ai-review"
  | "human-reviewed-source-packet"
  | "owner-approved-ai-review";

export interface ReviewedClaimPacket {
  approvalBasis: ReviewClaimPacketApprovalBasis;
  claim: {
    id: string;
    lastReviewedAt?: string;
    reviewStatus: "AI reviewed" | "Human reviewed";
  };
  referenceIds: string[];
  studyIds: string[];
}

export interface ReviewClaimPacketsAsOperatorInput {
  approvalBasis?: ReviewClaimPacketApprovalBasis;
  claimIds: string[];
  reviewedAt?: Date;
  reviewNote: string;
}

export interface ReviewedClaimPacketBatch {
  approvalBasis: ReviewClaimPacketApprovalBasis;
  claimIds: string[];
  reviewed: ReviewedClaimPacket[];
}

export async function reviewClaimPacketAsOperator(
  principal: OperatorPrincipal,
  input: ReviewClaimPacketAsOperatorInput,
  env?: OperatorWriteEnv
): Promise<ReviewedClaimPacket> {
  requireOperatorPermission(principal, "evidence:promote", env);

  const claimId = input.claimId.trim();
  const reviewNote = input.reviewNote.trim();

  if (!claimId) {
    throw new Error("Claim id is required.");
  }

  if (!reviewNote) {
    throw new Error("Claim review note is required.");
  }

  const approvalBasis = input.approvalBasis ?? "codex-ai-review";
  const reviewStatus = reviewStatusForApprovalBasis(approvalBasis);
  const packet = await getClaimPacketForReview(claimId);

  if (!packet) {
    throw new Error(`Claim not found for review: ${claimId}.`);
  }

  if (packet.referenceIds.length === 0) {
    throw new Error("Claim source packet is not complete: no curated references linked.");
  }

  if (packet.referencesMissingExtraction.length > 0) {
    throw new Error(
      `Claim source packet is not complete: structured extraction missing for ${packet.referencesMissingExtraction.join(", ")}.`
    );
  }

  const reviewedAt = input.reviewedAt ?? new Date();
  const claim = await prisma.$transaction(async (tx) => {
    const updatedClaim = await tx.claim.update({
      data: {
        lastReviewedAt: reviewedAt,
        reviewStatus: reviewStatusToDb(reviewStatus)
      },
      select: {
        id: true,
        lastReviewedAt: true,
        reviewStatus: true
      },
      where: {
        id: claimId
      }
    });

    await recordClaimReviewArtifacts({
      changelog: {
        details: [
          isAiReview(approvalBasis)
            ? "Codex marked the claim source packet AI reviewed after checking linked references and structured extraction."
            : "A human operator marked the claim source packet reviewed after checking linked references and structured extraction.",
          "The review status update remains distinct from clinical guideline endorsement, qualified clinical review, product-level TGA/ARTG clearance, or individualized medical advice."
        ],
        interventionId: packet.claim.interventionId,
        publicImpact:
          isAiReview(approvalBasis)
            ? "Readers can distinguish this evidence card from unreviewed draft cards while seeing that review was AI-reviewed, not human-reviewed."
            : "Readers can distinguish this evidence card from unreviewed draft cards once the changelog entry is published.",
        title:
          isAiReview(approvalBasis)
            ? "AI-reviewed source packet recorded"
            : "Human-reviewed source packet recorded"
      },
      claim: packet.claim,
      client: tx,
      entityId: updatedClaim.id,
      entityType: "Claim",
      metadata: {
        completeSourcePacket: true,
        interventionId: packet.claim.interventionId,
        referenceIds: packet.referenceIds,
        studyIds: packet.studyIds,
        approvalBasis,
        noIndividualizedMedicalAdvice: true,
        noProductLevelTgaClearanceInferred: true,
        workflow:
          isAiReview(approvalBasis)
            ? "claimPacket.aiReview"
            : "claimPacket.humanReview"
      },
      note: reviewNote,
      principal,
      rationale:
        isAiReview(approvalBasis)
          ? `AI-reviewed claim packet: ${reviewNote}`
          : `Human-reviewed claim packet: ${reviewNote}`,
      reviewStatus: reviewStatusToDb(reviewStatus),
      reviewedAt
    });

    await recordOperatorAuditEvent(
      principal,
      {
        action:
          isAiReview(approvalBasis)
            ? "claimPacket.aiReview"
            : "claimPacket.humanReview",
        afterSummary: {
          claimId: updatedClaim.id,
          lastReviewedAt: updatedClaim.lastReviewedAt?.toISOString() ?? null,
          referenceIds: packet.referenceIds,
          reviewStatus: updatedClaim.reviewStatus,
          studyIds: packet.studyIds
        },
        beforeSummary: {
          claimId: packet.claim.id,
          lastReviewedAt: packet.claim.lastReviewedAt?.toISOString() ?? null,
          reviewStatus: packet.claim.reviewStatus
        },
        metadata: {
          approvalBasis,
          completeSourcePacket: true,
          interventionId: packet.claim.interventionId,
          noIndividualizedMedicalAdvice: true,
          noProductLevelTgaClearanceInferred: true
        },
        note: reviewNote,
        targetId: claimId,
        targetType: "Claim"
      },
      tx
    );

    return updatedClaim;
  });

  return {
    approvalBasis,
    claim: {
      id: claim.id,
      lastReviewedAt: claim.lastReviewedAt?.toISOString(),
      reviewStatus
    },
    referenceIds: packet.referenceIds,
    studyIds: packet.studyIds
  };
}

export async function reviewClaimPacketsAsOperator(
  principal: OperatorPrincipal,
  input: ReviewClaimPacketsAsOperatorInput,
  env?: OperatorWriteEnv
): Promise<ReviewedClaimPacketBatch> {
  const claimIds = Array.from(
    new Set(input.claimIds.map((claimId) => claimId.trim()).filter(Boolean))
  );

  if (claimIds.length === 0) {
    throw new Error("At least one claim id is required.");
  }

  const approvalBasis = input.approvalBasis ?? "codex-ai-review";
  const reviewed: ReviewedClaimPacket[] = [];

  for (const claimId of claimIds) {
    reviewed.push(
      await reviewClaimPacketAsOperator(
        principal,
        {
          approvalBasis,
          claimId,
          reviewedAt: input.reviewedAt,
          reviewNote: input.reviewNote
        },
        env
      )
    );
  }

  return {
    approvalBasis,
    claimIds,
    reviewed
  };
}

function isAiReview(approvalBasis: ReviewClaimPacketApprovalBasis) {
  return approvalBasis === "codex-ai-review" || approvalBasis === "owner-approved-ai-review";
}

function reviewStatusForApprovalBasis(
  approvalBasis: ReviewClaimPacketApprovalBasis
): "AI reviewed" | "Human reviewed" {
  return isAiReview(approvalBasis) ? "AI reviewed" : "Human reviewed";
}

function reviewStatusToDb(reviewStatus: "AI reviewed" | "Human reviewed") {
  return reviewStatus === "Human reviewed"
    ? DbReviewStatus.HUMAN_REVIEWED
    : DbReviewStatus.AI_REVIEWED;
}

async function getClaimPacketForReview(claimId: string) {
  const claim = await prisma.claim.findUnique({
    select: {
      id: true,
      evidenceDirectnessScore: true,
      evidenceRigorScore: true,
      effectSizeScore: true,
      finalLabel: true,
      hypePenalty: true,
      interventionId: true,
      lastReviewedAt: true,
      measurabilityScore: true,
      productQualityScore: true,
      regulatoryRiskScore: true,
      references: {
        select: {
          reference: {
            select: {
              id: true,
              studies: {
                select: {
                  id: true
                }
              }
            }
          },
          referenceId: true
        }
      },
      reviewStatus: true,
      safetyScore: true
    },
    where: {
      id: claimId
    }
  });

  if (!claim) {
    return null;
  }

  const referenceIds = claim.references.map((link) => link.referenceId).sort();
  const studyIds = claim.references
    .flatMap((link) => link.reference.studies.map((study) => study.id))
    .sort();
  const referencesMissingExtraction = claim.references
    .filter((link) => link.reference.studies.length === 0)
    .map((link) => link.referenceId)
    .sort();

  return {
    claim,
    referenceIds,
    referencesMissingExtraction,
    studyIds
  };
}
