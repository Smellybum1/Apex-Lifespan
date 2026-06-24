import { ReviewStatus as DbReviewStatus } from "@prisma/client";

import {
  confirmSourceCandidateHumanReview,
  extractAcceptedSourceCandidateStudy,
  getSourceCandidateByDedupeKey,
  getSourceCandidateCurationStatus,
  linkAcceptedSourceCandidateClaim,
  recordSourceCandidateDecision,
  type ConfirmSourceCandidateHumanReviewInput,
  type ExtractAcceptedSourceCandidateStudyInput,
  type LinkAcceptedSourceCandidateClaimInput,
  type RecordSourceCandidateDecisionInput
} from "@/lib/data/source-candidates";
import { prisma } from "@/lib/db/prisma";
import type { OperatorPrincipal, OperatorWriteEnv } from "@/lib/operator/authorization";
import { requireOperatorPermission } from "@/lib/operator/authorization";
import { recordOperatorAuditEvent } from "@/lib/operator/audit";
import { recordClaimReviewArtifacts } from "@/lib/operator/claim-review-records";
import { assessSourceCandidatePublicPromotion } from "@/lib/operator/curation-promotion";

export interface PromoteSourceCandidatePublicEvidenceInput {
  dedupeKey: string;
  promotedAt?: Date;
  promotionNote: string;
  reviewStatus?: "AI reviewed" | "Human reviewed";
}

export type SourceCandidateReviewApprovalBasis =
  | "codex-ai-candidate-review"
  | "manual-operator-review"
  | "owner-approved-ai-candidate-review";

export type ReviewSourceCandidateAsOperatorInput = RecordSourceCandidateDecisionInput & {
  aiReviewSummary?: string;
  approvalBasis?: SourceCandidateReviewApprovalBasis;
};

export interface PromotedSourceCandidatePublicEvidence {
  claim: {
    id: string;
    lastReviewedAt?: string;
    reviewStatus: "AI reviewed" | "Human reviewed";
  };
  dedupeKey: string;
  referenceId: string;
  studyIds: string[];
}

export async function reviewSourceCandidateAsOperator(
  principal: OperatorPrincipal,
  input: ReviewSourceCandidateAsOperatorInput,
  env?: OperatorWriteEnv
) {
  requireOperatorPermission(principal, "candidate:review", env);

  const before = await getSourceCandidateByDedupeKey(input.dedupeKey);
  const approvalBasis = input.approvalBasis ?? "codex-ai-candidate-review";
  const candidate = await recordSourceCandidateDecision(
    sourceCandidateDecisionInput({ ...input, approvalBasis })
  );

  await recordOperatorAuditEvent(principal, {
    action:
      approvalBasis === "codex-ai-candidate-review" ||
      approvalBasis === "owner-approved-ai-candidate-review"
        ? "sourceCandidate.aiReview"
        : "sourceCandidate.reviewDecision",
    afterSummary: {
      acceptedReferenceId: candidate.acceptedReferenceId ?? null,
      decision: candidate.decision,
      reviewStatus: candidate.reviewStatus
    },
    beforeSummary: before
      ? {
          acceptedReferenceId: before.acceptedReferenceId ?? null,
          decision: before.decision,
          reviewStatus: before.reviewStatus
        }
      : undefined,
    metadata: {
      ...(input.aiReviewSummary ? { aiReviewSummary: input.aiReviewSummary } : {}),
      approvalBasis,
      noExtractionWrite: true,
      noPromotion: true,
      source: candidate.source
    },
    note: input.reviewNote,
    targetId: input.dedupeKey,
    targetType: "SourceCandidate"
  });

  return candidate;
}

export async function confirmSourceCandidateHumanReviewAsOperator(
  principal: OperatorPrincipal,
  input: ConfirmSourceCandidateHumanReviewInput,
  env?: OperatorWriteEnv
) {
  requireOperatorPermission(principal, "candidate:review", env);

  const before = await getSourceCandidateByDedupeKey(input.dedupeKey);
  const candidate = await confirmSourceCandidateHumanReview(input);

  await recordOperatorAuditEvent(principal, {
    action: "sourceCandidate.humanReview",
    afterSummary: {
      acceptedReferenceId: candidate.acceptedReferenceId ?? null,
      decision: candidate.decision,
      reviewStatus: candidate.reviewStatus
    },
    beforeSummary: before
      ? {
          acceptedReferenceId: before.acceptedReferenceId ?? null,
          decision: before.decision,
          reviewStatus: before.reviewStatus
        }
      : undefined,
    metadata: {
      approvalBasis: "manual-operator-review",
      noExtractionWrite: true,
      noPromotion: true,
      source: candidate.source
    },
    note: input.reviewNote,
    targetId: input.dedupeKey,
    targetType: "SourceCandidate"
  });

  return candidate;
}

function sourceCandidateDecisionInput(
  input: ReviewSourceCandidateAsOperatorInput
): RecordSourceCandidateDecisionInput {
  if (input.decision === "Accepted") {
    return {
      acceptedReferenceId: input.acceptedReferenceId,
      decision: input.decision,
      dedupeKey: input.dedupeKey,
      reviewNote: input.reviewNote,
      reviewStatus: sourceCandidateReviewStatus(input.approvalBasis),
      ...(input.reviewedAt ? { reviewedAt: input.reviewedAt } : {})
    };
  }

  return {
    decision: input.decision,
    dedupeKey: input.dedupeKey,
    reviewNote: input.reviewNote,
    reviewStatus: sourceCandidateReviewStatus(input.approvalBasis),
    ...(input.reviewedAt ? { reviewedAt: input.reviewedAt } : {})
  };
}

function sourceCandidateReviewStatus(
  approvalBasis?: SourceCandidateReviewApprovalBasis
): "AI reviewed" | "Human reviewed" {
  return approvalBasis === "manual-operator-review" ? "Human reviewed" : "AI reviewed";
}

export async function linkSourceCandidateClaimAsOperator(
  principal: OperatorPrincipal,
  input: LinkAcceptedSourceCandidateClaimInput,
  env?: OperatorWriteEnv
) {
  requireOperatorPermission(principal, "curation:claim-link", env);

  const before = await getSourceCandidateCurationStatus(input.dedupeKey);
  const result = await linkAcceptedSourceCandidateClaim(input);

  await recordOperatorAuditEvent(principal, {
    action: "sourceCandidate.claimLink",
    afterSummary: {
      claimId: result.claimLink.claimId,
      created: result.created,
      publicSourcePacketReady: result.status.publicSourcePacketReady,
      status: result.status.status
    },
    beforeSummary: before
      ? {
          publicSourcePacketReady: before.publicSourcePacketReady,
          status: before.status
        }
      : undefined,
    note: input.note,
    targetId: input.dedupeKey,
    targetType: "SourceCandidate"
  });

  return result;
}

export async function extractSourceCandidateStudyAsOperator(
  principal: OperatorPrincipal,
  input: ExtractAcceptedSourceCandidateStudyInput,
  env?: OperatorWriteEnv
) {
  requireOperatorPermission(principal, "curation:study-extraction", env);

  const before = await getSourceCandidateCurationStatus(input.dedupeKey);
  const result = await extractAcceptedSourceCandidateStudy(input);

  await recordOperatorAuditEvent(principal, {
    action: "sourceCandidate.studyExtraction",
    afterSummary: {
      created: result.created,
      publicSourcePacketReady: result.status.publicSourcePacketReady,
      status: result.status.status,
      studyId: result.study.id
    },
    beforeSummary: before
      ? {
          publicSourcePacketReady: before.publicSourcePacketReady,
          status: before.status,
          studies: before.studies.length
        }
      : undefined,
    targetId: input.dedupeKey,
    targetType: "SourceCandidate"
  });

  return result;
}

export async function promoteSourceCandidatePublicEvidenceAsOperator(
  principal: OperatorPrincipal,
  input: PromoteSourceCandidatePublicEvidenceInput,
  env?: OperatorWriteEnv
): Promise<PromotedSourceCandidatePublicEvidence> {
  requireOperatorPermission(principal, "evidence:promote", env);

  const promotionNote = input.promotionNote.trim();

  if (!promotionNote) {
    throw new Error("Promotion note is required.");
  }

  const assessment = await assessSourceCandidatePublicPromotion(input.dedupeKey);
  const promotionCandidate = assessment.candidate;
  const publicPacket = assessment.publicPacket;
  const reviewStatus = input.reviewStatus ?? "AI reviewed";

  if (!assessment.ready || !publicPacket || !promotionCandidate?.claimId) {
    throw new Error(
      `Source candidate is not ready for public promotion: ${
        assessment.blockers[0] ?? "public packet is missing."
      }`
    );
  }

  const claimId = publicPacket.claimId;
  const before = await prisma.claim.findUnique({
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
      safetyScore: true,
      reviewStatus: true
    },
    where: {
      id: claimId
    }
  });

  if (!before) {
    throw new Error("Promotion target claim was not found.");
  }

  const promotedAt = input.promotedAt ?? new Date();
  const claim = await prisma.$transaction(async (tx) => {
    const updatedClaim = await tx.claim.update({
      data: {
        lastReviewedAt: promotedAt,
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
          reviewStatus === "Human reviewed"
            ? "A human operator promoted an accepted source candidate only after dry-run readiness reported a complete public source packet."
            : "Codex promoted an accepted source candidate as AI reviewed after dry-run readiness reported a complete public source packet.",
          "The promotion keeps source-candidate review, structured extraction, and public evidence status separate."
        ],
        interventionId: before.interventionId,
        publicImpact:
          "Readers can trace that a promoted source candidate changed a claim's public review status once the changelog entry is published.",
        title: "Source-candidate evidence promotion recorded"
      },
      claim: before,
      client: tx,
      entityId: updatedClaim.id,
      entityType: "Claim",
      metadata: {
        candidateExternalId: promotionCandidate.externalId,
        candidateSource: promotionCandidate.source,
        interventionId: before.interventionId,
        publicSourcePacketReady: true,
        sourceCandidateDedupeKey: input.dedupeKey,
        studyIds: publicPacket.studyIds,
        workflow: "sourceCandidate.publicEvidencePromotion"
      },
      note: promotionNote,
      principal,
      rationale: `Source-candidate public promotion: ${promotionNote}`,
      referenceId: publicPacket.referenceId,
      reviewStatus: reviewStatusToDb(reviewStatus),
      reviewedAt: promotedAt
    });

    await recordOperatorAuditEvent(
      principal,
      {
        action: "sourceCandidate.publicEvidencePromotion",
        afterSummary: {
          claimId: updatedClaim.id,
          lastReviewedAt: updatedClaim.lastReviewedAt?.toISOString() ?? null,
          referenceId: publicPacket.referenceId,
          reviewStatus: updatedClaim.reviewStatus,
          studyIds: publicPacket.studyIds
        },
        beforeSummary: {
          claimId: before.id,
          lastReviewedAt: before.lastReviewedAt?.toISOString() ?? null,
          reviewStatus: before.reviewStatus
        },
        metadata: {
          candidateExternalId: promotionCandidate.externalId,
          candidateSource: promotionCandidate.source,
          publicSourcePacketReady: true
        },
        note: promotionNote,
        targetId: input.dedupeKey,
        targetType: "SourceCandidate"
      },
      tx
    );

    return updatedClaim;
  });

  return {
    claim: {
      id: claim.id,
      lastReviewedAt: claim.lastReviewedAt?.toISOString(),
      reviewStatus
    },
    dedupeKey: input.dedupeKey,
    referenceId: publicPacket.referenceId,
    studyIds: publicPacket.studyIds
  };
}

function reviewStatusToDb(reviewStatus: "AI reviewed" | "Human reviewed") {
  return reviewStatus === "Human reviewed"
    ? DbReviewStatus.HUMAN_REVIEWED
    : DbReviewStatus.AI_REVIEWED;
}
