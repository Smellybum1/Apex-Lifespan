import { ReviewStatus as DbReviewStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type { OperatorPrincipal, OperatorWriteEnv } from "@/lib/operator/authorization";
import { requireOperatorPermission } from "@/lib/operator/authorization";
import { recordOperatorAuditEvent } from "@/lib/operator/audit";

export interface ReviewClaimPacketAsOperatorInput {
  claimId: string;
  reviewedAt?: Date;
  reviewNote: string;
}

export interface ReviewedClaimPacket {
  claim: {
    id: string;
    lastReviewedAt?: string;
    reviewStatus: "Human reviewed";
  };
  referenceIds: string[];
  studyIds: string[];
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
  const claim = await prisma.claim.update({
    data: {
      lastReviewedAt: reviewedAt,
      reviewStatus: DbReviewStatus.HUMAN_REVIEWED
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

  await recordOperatorAuditEvent(principal, {
    action: "claimPacket.humanReview",
    afterSummary: {
      claimId: claim.id,
      lastReviewedAt: claim.lastReviewedAt?.toISOString() ?? null,
      referenceIds: packet.referenceIds,
      reviewStatus: claim.reviewStatus,
      studyIds: packet.studyIds
    },
    beforeSummary: {
      claimId: packet.claim.id,
      lastReviewedAt: packet.claim.lastReviewedAt?.toISOString() ?? null,
      reviewStatus: packet.claim.reviewStatus
    },
    metadata: {
      completeSourcePacket: true,
      interventionId: packet.claim.interventionId
    },
    note: reviewNote,
    targetId: claimId,
    targetType: "Claim"
  });

  return {
    claim: {
      id: claim.id,
      lastReviewedAt: claim.lastReviewedAt?.toISOString(),
      reviewStatus: "Human reviewed"
    },
    referenceIds: packet.referenceIds,
    studyIds: packet.studyIds
  };
}

async function getClaimPacketForReview(claimId: string) {
  const claim = await prisma.claim.findUnique({
    select: {
      id: true,
      interventionId: true,
      lastReviewedAt: true,
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
      reviewStatus: true
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
