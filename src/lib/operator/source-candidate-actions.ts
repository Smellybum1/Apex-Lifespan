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
import type { OperatorPrincipal, OperatorWriteEnv } from "@/lib/operator/authorization";
import { requireOperatorPermission } from "@/lib/operator/authorization";
import { recordOperatorAuditEvent } from "@/lib/operator/audit";

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
