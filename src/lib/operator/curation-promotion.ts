import {
  getSourceCandidateCurationStatus,
  listSourceCandidateCurationHandoff,
  type SourceCandidateCurationStatus
} from "@/lib/data/source-candidates";
import type {
  SourceCandidate,
  SourceCandidateDecision,
  ReviewStatus
} from "@/lib/types";

export interface SourceCandidatePromotionAssessment {
  blockers: string[];
  candidate?: {
    acceptedReferenceId?: string;
    claimId?: string;
    decision: SourceCandidateDecision;
    dedupeKey: string;
    externalId: string;
    reviewStatus: ReviewStatus;
    source: SourceCandidate["source"];
    title: string;
  };
  dryRun: true;
  nextAction: string;
  publicPacket?: {
    claimId: string;
    referenceId: string;
    referenceUrl: string;
    studyIds: string[];
  };
  ready: boolean;
}

export interface SourceCandidatePromotionReadinessRow {
  blockers: string[];
  candidate: {
    acceptedReferenceId?: string;
    claimId?: string;
    decision: SourceCandidateDecision;
    dedupeKey: string;
    externalId: string;
    reviewStatus: ReviewStatus;
    source: SourceCandidate["source"];
    title: string;
  };
  nextAction: string;
  publicSourcePacketReady: boolean;
  ready: boolean;
  status: SourceCandidateCurationStatus["status"];
}

export interface SourceCandidatePromotionReadinessSnapshot {
  blockedCount: number;
  readyCount: number;
  rows: SourceCandidatePromotionReadinessRow[];
  total: number;
}

export async function assessSourceCandidatePublicPromotion(
  dedupeKey: string
): Promise<SourceCandidatePromotionAssessment> {
  const status = await getSourceCandidateCurationStatus(dedupeKey);

  if (!status) {
    return blockedPromotion(["Source candidate not found."], undefined);
  }

  const blockers = sourceCandidatePromotionBlockers(status);
  const candidate = {
    acceptedReferenceId: status.candidate.acceptedReferenceId,
    claimId: status.candidate.claimId,
    decision: status.candidate.decision,
    dedupeKey: status.candidate.dedupeKey,
    externalId: status.candidate.externalId,
    reviewStatus: status.candidate.reviewStatus,
    source: status.candidate.source,
    title: status.candidate.title
  };

  if (blockers.length > 0) {
    return blockedPromotion(blockers, candidate);
  }

  return {
    blockers: [],
    candidate,
    dryRun: true,
    nextAction: "Ready for explicit human promotion review.",
    publicPacket: {
      claimId: status.candidate.claimId as string,
      referenceId: status.acceptedReferenceId as string,
      referenceUrl: status.acceptedReference?.url as string,
      studyIds: status.studies.map((study) => study.id)
    },
    ready: true
  };
}

export async function getSourceCandidatePromotionReadinessSnapshot(
  limit = 5
): Promise<SourceCandidatePromotionReadinessSnapshot> {
  const statuses = await listSourceCandidateCurationHandoff({ limit });
  const rows = statuses.map(sourceCandidatePromotionReadinessRow);

  return {
    blockedCount: rows.filter((row) => !row.ready).length,
    readyCount: rows.filter((row) => row.ready).length,
    rows,
    total: rows.length
  };
}

function sourceCandidatePromotionReadinessRow(
  status: SourceCandidateCurationStatus
): SourceCandidatePromotionReadinessRow {
  const blockers = sourceCandidatePromotionBlockers(status);

  return {
    blockers,
    candidate: {
      acceptedReferenceId: status.candidate.acceptedReferenceId,
      claimId: status.candidate.claimId,
      decision: status.candidate.decision,
      dedupeKey: status.candidate.dedupeKey,
      externalId: status.candidate.externalId,
      reviewStatus: status.candidate.reviewStatus,
      source: status.candidate.source,
      title: status.candidate.title
    },
    nextAction: blockers[0] ?? "Ready for explicit human promotion review.",
    publicSourcePacketReady: status.publicSourcePacketReady,
    ready: blockers.length === 0,
    status: status.status
  };
}

function sourceCandidatePromotionBlockers(
  status: SourceCandidateCurationStatus
) {
  const blockers: string[] = [];

  if (status.candidate.decision !== "Accepted") {
    blockers.push("Candidate must be accepted by a human reviewer.");
  }

  if (status.candidate.reviewStatus !== "Human reviewed") {
    blockers.push("Candidate review status must be Human reviewed.");
  }

  if (!status.candidate.claimId) {
    blockers.push("Candidate must be linked to a claim.");
  }

  if (!status.acceptedReferenceId || !status.acceptedReference) {
    blockers.push("Accepted reference must be present and traceable.");
  } else {
    if (!status.acceptedReference.url) {
      blockers.push("Accepted reference must include a URL.");
    }

    if (!status.acceptedReference.title) {
      blockers.push("Accepted reference must include a title.");
    }
  }

  if (status.claimLinks.length === 0) {
    blockers.push("Accepted reference must be linked to the candidate claim.");
  }

  if (status.studies.length === 0) {
    blockers.push("Accepted reference must have a structured study extraction.");
  }

  if (!status.publicSourcePacketReady) {
    blockers.push("Curation status must report publicSourcePacketReady=true.");
  }

  return blockers;
}

function blockedPromotion(
  blockers: string[],
  candidate: SourceCandidatePromotionAssessment["candidate"]
): SourceCandidatePromotionAssessment {
  return {
    blockers,
    candidate,
    dryRun: true,
    nextAction: blockers[0] ?? "Resolve promotion blockers.",
    ready: false
  };
}
