import { ReviewStatus as DbReviewStatus } from "@prisma/client";

import {
  extractAcceptedSourceCandidateStudy,
  getSourceCandidateByDedupeKey,
  getSourceCandidateCurationStatus,
  linkAcceptedSourceCandidateClaim,
  recordSourceCandidateDecision,
  type ExtractAcceptedSourceCandidateStudyInput,
  type LinkAcceptedSourceCandidateClaimInput,
  type RecordSourceCandidateDecisionInput
} from "@/lib/data/source-candidates";
import { prisma } from "@/lib/db/prisma";
import type { OperatorPrincipal, OperatorWriteEnv } from "@/lib/operator/authorization";
import { requireOperatorPermission } from "@/lib/operator/authorization";
import { recordOperatorAuditEvent } from "@/lib/operator/audit";
import { assessSourceCandidatePublicPromotion } from "@/lib/operator/curation-promotion";

export interface PromoteSourceCandidatePublicEvidenceInput {
  dedupeKey: string;
  promotedAt?: Date;
  promotionNote: string;
}

export interface PromotedSourceCandidatePublicEvidence {
  claim: {
    id: string;
    lastReviewedAt?: string;
    reviewStatus: "Human reviewed";
  };
  dedupeKey: string;
  referenceId: string;
  studyIds: string[];
}

export async function reviewSourceCandidateAsOperator(
  principal: OperatorPrincipal,
  input: RecordSourceCandidateDecisionInput,
  env?: OperatorWriteEnv
) {
  requireOperatorPermission(principal, "candidate:review", env);

  const before = await getSourceCandidateByDedupeKey(input.dedupeKey);
  const candidate = await recordSourceCandidateDecision(input);

  await recordOperatorAuditEvent(principal, {
    action: "sourceCandidate.reviewDecision",
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
      source: candidate.source
    },
    note: input.reviewNote,
    targetId: input.dedupeKey,
    targetType: "SourceCandidate"
  });

  return candidate;
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

  if (!assessment.ready || !assessment.publicPacket || !assessment.candidate?.claimId) {
    throw new Error(
      `Source candidate is not ready for public promotion: ${
        assessment.blockers[0] ?? "public packet is missing."
      }`
    );
  }

  const claimId = assessment.publicPacket.claimId;
  const before = await prisma.claim.findUnique({
    select: {
      id: true,
      lastReviewedAt: true,
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
  const claim = await prisma.claim.update({
    data: {
      lastReviewedAt: promotedAt,
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
    action: "sourceCandidate.publicEvidencePromotion",
    afterSummary: {
      claimId: claim.id,
      lastReviewedAt: claim.lastReviewedAt?.toISOString() ?? null,
      referenceId: assessment.publicPacket.referenceId,
      reviewStatus: claim.reviewStatus,
      studyIds: assessment.publicPacket.studyIds
    },
    beforeSummary: {
      claimId: before.id,
      lastReviewedAt: before.lastReviewedAt?.toISOString() ?? null,
      reviewStatus: before.reviewStatus
    },
    metadata: {
      candidateExternalId: assessment.candidate.externalId,
      candidateSource: assessment.candidate.source,
      publicSourcePacketReady: true
    },
    note: promotionNote,
    targetId: input.dedupeKey,
    targetType: "SourceCandidate"
  });

  return {
    claim: {
      id: claim.id,
      lastReviewedAt: claim.lastReviewedAt?.toISOString(),
      reviewStatus: "Human reviewed"
    },
    dedupeKey: input.dedupeKey,
    referenceId: assessment.publicPacket.referenceId,
    studyIds: assessment.publicPacket.studyIds
  };
}
