import {
  ReviewStatus as DbReviewStatus,
  StudyType as DbStudyType
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type { EvidenceDraftPacket } from "@/lib/operator/evidence-draft-packet";
import type { OperatorPrincipal, OperatorWriteEnv } from "@/lib/operator/authorization";
import { requireOperatorPermission } from "@/lib/operator/authorization";
import { recordOperatorAuditEvent } from "@/lib/operator/audit";
import { recordClaimReviewArtifacts } from "@/lib/operator/claim-review-records";

export interface ApplyApprovedEvidenceDraftInput {
  applyNote: string;
  approvalId: string;
  draft: EvidenceDraftPacket;
  reviewStatus?: "AI reviewed" | "Human reviewed";
  reviewedAt?: Date;
}

export interface AppliedApprovedEvidenceDraft {
  approvalId: string;
  changelogEntryId?: string;
  claimId: string;
  claimReference: {
    claimId: string;
    referenceId: string;
  };
  draftId: string;
  referenceId: string;
  reviewStatus: "AI reviewed" | "Human reviewed";
  scoreHistoryId?: string;
  scoreSnapshotId?: string;
  studyId: string;
}

export async function applyApprovedEvidenceDraftAsOperator(
  principal: OperatorPrincipal,
  input: ApplyApprovedEvidenceDraftInput,
  env?: OperatorWriteEnv
): Promise<AppliedApprovedEvidenceDraft> {
  requireOperatorPermission(principal, "curation:claim-link", env);
  requireOperatorPermission(principal, "curation:study-extraction", env);
  requireOperatorPermission(principal, "evidence:promote", env);

  const approvalId = requireText(input.approvalId, "Approval id is required.");
  const applyNote = requireText(input.applyNote, "Apply note is required.");
  const reviewedAt = input.reviewedAt ?? new Date();
  const reviewStatus = input.reviewStatus ?? "AI reviewed";
  const draft = input.draft;
  const claimId = requireText(
    draft.candidate.claimId,
    "Approved evidence draft requires a candidate claim id."
  );
  const referenceId = requireText(
    draft.candidate.acceptedReferenceId,
    "Approved evidence draft requires an accepted reference id."
  );

  assertDraftReadyForApprovedApply(draft);
  const studyInput = approvedStudyInputFromDraft(draft);

  return prisma.$transaction(async (tx) => {
    const [claim, reference, existingStudies] = await Promise.all([
      tx.claim.findUnique({
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
          reviewStatus: true,
          safetyScore: true
        },
        where: {
          id: claimId
        }
      }),
      tx.reference.findUnique({
        select: {
          id: true,
          identifier: true,
          source: true,
          title: true,
          url: true,
          year: true
        },
        where: {
          id: referenceId
        }
      }),
      tx.study.findMany({
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        select: {
          id: true
        },
        where: {
          referenceId
        }
      })
    ]);

    if (!claim) {
      throw new Error(`Approved evidence draft claim was not found: ${claimId}.`);
    }

    if (!reference) {
      throw new Error(
        `Approved evidence draft accepted reference was not found: ${referenceId}.`
      );
    }

    if (existingStudies.length > 1) {
      throw new Error(
        "Approved evidence draft reference has multiple study extractions; resolve manually before transaction apply."
      );
    }

    const claimReference = await tx.claimReference.upsert({
      create: {
        claimId,
        note: applyNote,
        referenceId,
        relevance: 5
      },
      update: {
        note: applyNote,
        relevance: 5
      },
      where: {
        claimId_referenceId: {
          claimId,
          referenceId
        }
      }
    });
    const studyData = {
      ...studyInput,
      pmid: draft.candidate.source === "PubMed" ? draft.candidate.externalId : undefined,
      nctId:
        draft.candidate.source === "ClinicalTrials.gov"
          ? draft.candidate.externalId
          : undefined,
      referenceId,
      source: draft.candidate.source,
      title: reference.title || draft.candidate.title,
      url: reference.url,
      year: reference.year ?? undefined
    };
    const study =
      existingStudies.length === 1
        ? await tx.study.update({
            data: studyData,
            where: {
              id: existingStudies[0].id
            }
          })
        : await tx.study.create({
            data: studyData
          });
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
    const artifacts = await recordClaimReviewArtifacts({
      changelog: {
        details: [
          "An approved evidence draft applied claim-reference, study extraction, review, score, audit, and unpublished changelog state in one transaction.",
          "Public changelog publication remains a separate execution control.",
          "Citation traceability, uncertainty labels, AU/TGA caveats, product-level boundaries, and no-medical-advice guardrails remain in force."
        ],
        interventionId: claim.interventionId,
        publicImpact:
          "Readers can see this claim as AI reviewed after a transaction-applied evidence draft once the changelog entry is published.",
        title: "Approved evidence draft applied"
      },
      claim,
      client: tx,
      entityId: draft.draftId,
      entityType: "EvidenceDraft",
      metadata: {
        approvalId,
        draftId: draft.draftId,
        noIndividualizedMedicalAdvice: true,
        noPeptideOperationalGuidance: true,
        noProductLevelTgaClearanceInferred: true,
        sourcePacketReadiness: draft.sourcePacketReadiness.status,
        targetTables: draft.publication.blockedWriteKinds,
        workflow: "evidenceDraft.applyApprovedDiff"
      },
      note: applyNote,
      principal,
      rationale: `Approved evidence draft apply: ${applyNote}`,
      referenceId,
      reviewStatus: reviewStatusToDb(reviewStatus),
      reviewedAt,
      studyId: study.id
    });

    await recordOperatorAuditEvent(
      principal,
      {
        action: "evidenceDraft.applyApprovedDiff",
        afterSummary: {
          claimId: updatedClaim.id,
          lastReviewedAt: updatedClaim.lastReviewedAt?.toISOString() ?? null,
          referenceId,
          reviewStatus: updatedClaim.reviewStatus,
          scoreHistoryId: artifacts.scoreHistory.id,
          scoreSnapshotId: artifacts.scoreSnapshot.id,
          studyId: study.id
        },
        beforeSummary: {
          claimId: claim.id,
          lastReviewedAt: claim.lastReviewedAt?.toISOString() ?? null,
          reviewStatus: claim.reviewStatus
        },
        metadata: {
          approvalId,
          changelogEntryId: artifacts.changelogEntry.id,
          noPublicChangelogPublication: true,
          sourcePacketReadiness: draft.sourcePacketReadiness.status
        },
        note: applyNote,
        targetId: draft.draftId,
        targetType: "EvidenceDraft"
      },
      tx
    );

    return {
      approvalId,
      changelogEntryId: artifacts.changelogEntry.id,
      claimId: updatedClaim.id,
      claimReference: {
        claimId: claimReference.claimId,
        referenceId: claimReference.referenceId
      },
      draftId: draft.draftId,
      referenceId,
      reviewStatus,
      scoreHistoryId: artifacts.scoreHistory.id,
      scoreSnapshotId: artifacts.scoreSnapshot.id,
      studyId: study.id
    };
  });
}

function assertDraftReadyForApprovedApply(draft: EvidenceDraftPacket) {
  if (draft.sourcePacketReadiness.status !== "complete-proposed-packet") {
    throw new Error(
      `Evidence draft is not ready for apply: source packet readiness is ${draft.sourcePacketReadiness.status}.`
    );
  }

  if (draft.blockers.length > 0) {
    throw new Error(
      `Evidence draft is not ready for apply: ${draft.blockers[0]?.label ?? "blockers remain."}`
    );
  }

  const unsafeField = draft.fields.find(
    (field) => field.status === "blocked" || field.status === "unknown"
  );

  if (unsafeField) {
    throw new Error(
      `Evidence draft is not ready for apply: ${unsafeField.label} is ${unsafeField.status}.`
    );
  }

  if (draft.candidate.decision !== "Accepted") {
    throw new Error("Evidence draft candidate must be accepted before apply.");
  }

  if (
    draft.candidate.reviewStatus !== "AI reviewed" &&
    draft.candidate.reviewStatus !== "Human reviewed"
  ) {
    throw new Error("Evidence draft candidate must be AI reviewed or Human reviewed.");
  }
}

function approvedStudyInputFromDraft(draft: EvidenceDraftPacket) {
  const requiredFields = {
    adverseEvents: requiredDraftFieldValue(draft, "study-extraction.adverseEvents"),
    fundingConflicts: requiredDraftFieldValue(
      draft,
      "study-extraction.fundingConflicts"
    ),
    interventionName: requiredDraftFieldValue(
      draft,
      "study-extraction.interventionName"
    ),
    outcomes: outcomesFromDraftField(draft),
    population: requiredDraftFieldValue(draft, "study-extraction.population"),
    riskOfBias: requiredDraftFieldValue(draft, "study-extraction.riskOfBias"),
    sampleSize: requiredDraftFieldValue(draft, "study-extraction.sampleSize"),
    sourceType: requiredStudyType(draft)
  };

  return {
    ...requiredFields,
    abstract: optionalDraftFieldValue(draft, "study-extraction.abstract"),
    dose: optionalDraftFieldValue(draft, "study-extraction.dose"),
    duration: optionalDraftFieldValue(draft, "study-extraction.duration"),
    mainResults: optionalDraftFieldValue(draft, "study-extraction.mainResults"),
    relevanceScore: 5
  };
}

function requiredDraftFieldValue(draft: EvidenceDraftPacket, fieldId: string) {
  const value = optionalDraftFieldValue(draft, fieldId);

  if (!value) {
    throw new Error(`Approved evidence draft requires ${fieldId}.`);
  }

  return value;
}

function optionalDraftFieldValue(draft: EvidenceDraftPacket, fieldId: string) {
  const field = draft.fields.find((candidate) => candidate.id === fieldId);
  const value = field?.value?.trim();

  return value ? value : undefined;
}

function outcomesFromDraftField(draft: EvidenceDraftPacket) {
  const value = requiredDraftFieldValue(draft, "study-extraction.outcomes");
  const parsed = value
    .split(/\n|;|\|/)
    .map((outcome) => outcome.trim())
    .filter(Boolean);

  if (parsed.length === 0) {
    throw new Error("Approved evidence draft requires study-extraction.outcomes.");
  }

  return parsed;
}

function requiredStudyType(draft: EvidenceDraftPacket) {
  const value = requiredDraftFieldValue(draft, "study-extraction.sourceType");

  if (Object.values(DbStudyType).includes(value as DbStudyType)) {
    return value as DbStudyType;
  }

  throw new Error(`Approved evidence draft has unsupported study source type: ${value}.`);
}

function reviewStatusToDb(reviewStatus: "AI reviewed" | "Human reviewed") {
  return reviewStatus === "Human reviewed"
    ? DbReviewStatus.HUMAN_REVIEWED
    : DbReviewStatus.AI_REVIEWED;
}

function requireText(value: string | undefined, message: string) {
  const trimmed = value?.trim();

  if (!trimmed) {
    throw new Error(message);
  }

  return trimmed;
}
