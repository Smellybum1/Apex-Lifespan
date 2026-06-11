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
  worksheet?: SourceCandidatePromotionWorksheet;
}

export interface SourceCandidatePromotionWorksheet {
  acceptedReferenceId?: string;
  candidateClaimId?: string;
  claimLink: {
    existingClaimIds: string[];
    nextAction: string;
    ready: boolean;
    targetClaimId?: string;
    targetReferenceId?: string;
  };
  curationStatus: SourceCandidateCurationStatus["status"];
  humanReviewRequired: true;
  nextHumanActions: string[];
  publicSourcePacketReady: boolean;
  readOnlyCommands: {
    candidateReviewPacket: string;
    curationDraft: string;
    curationStatus: string;
    dryRunPromotion: string;
    referenceMatches: string;
    siblings: string;
  };
  requiredEvidence: SourceCandidatePromotionEvidenceItem[];
  studyExtraction: {
    existingStudyIds: string[];
    nextAction: string;
    ready: boolean;
    targetReferenceId?: string;
  };
}

export interface SourceCandidatePromotionEvidenceItem {
  id: string;
  label: string;
  nextAction: string;
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

export interface SourceCandidatePromotionReadinessReport {
  generatedAt: string;
  humanOwned: true;
  readOnly: true;
  snapshot: SourceCandidatePromotionReadinessSnapshot;
  worksheet: SourceCandidatePromotionReadinessWorksheet;
}

export interface SourceCandidatePromotionReadinessSummary {
  blocked: SourceCandidatePromotionReadinessWorksheetItem[];
  counts: {
    blocked: number;
    ready: number;
    total: number;
  };
  generatedAt: string;
  humanOwned: true;
  nextAction: string;
  readOnly: true;
  ready: SourceCandidatePromotionReadinessWorksheetItem[];
}

export interface SourceCandidatePromotionReadinessReportOptions {
  generatedAt?: Date;
  limit?: number;
}

export interface SourceCandidatePromotionReadinessWorksheet {
  blocked: SourceCandidatePromotionReadinessWorksheetItem[];
  copySafeCommands: SourceCandidatePromotionReadinessCommand[];
  humanOwned: true;
  nextHumanAction: string;
  ready: SourceCandidatePromotionReadinessWorksheetItem[];
}

export interface SourceCandidatePromotionReadinessCommand {
  command: string;
  id: string;
  label: string;
  mode: "read-only";
  purpose: string;
}

export interface SourceCandidatePromotionReadinessWorksheetItem {
  blockers: string[];
  dedupeKey: string;
  externalId: string;
  label: string;
  nextAction: string;
  source: SourceCandidate["source"];
  status: SourceCandidateCurationStatus["status"];
}

export async function assessSourceCandidatePublicPromotion(
  dedupeKey: string
): Promise<SourceCandidatePromotionAssessment> {
  const status = await getSourceCandidateCurationStatus(dedupeKey);

  if (!status) {
    return blockedPromotion(["Source candidate not found."], undefined);
  }

  const blockers = sourceCandidatePromotionBlockers(status);
  const worksheet = sourceCandidatePromotionWorksheet(status);
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
    return blockedPromotion(blockers, candidate, worksheet);
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
    ready: true,
    worksheet
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

export async function buildSourceCandidatePromotionReadinessReport({
  generatedAt,
  limit = 5
}: SourceCandidatePromotionReadinessReportOptions = {}): Promise<SourceCandidatePromotionReadinessReport> {
  const snapshot = await getSourceCandidatePromotionReadinessSnapshot(limit);

  return {
    generatedAt: (generatedAt ?? new Date()).toISOString(),
    humanOwned: true,
    readOnly: true,
    snapshot,
    worksheet: sourceCandidatePromotionReadinessWorksheet(snapshot)
  };
}

export function summarizeSourceCandidatePromotionReadinessReport(
  report: SourceCandidatePromotionReadinessReport
): SourceCandidatePromotionReadinessSummary {
  return {
    blocked: report.worksheet.blocked,
    counts: {
      blocked: report.snapshot.blockedCount,
      ready: report.snapshot.readyCount,
      total: report.snapshot.total
    },
    generatedAt: report.generatedAt,
    humanOwned: true,
    nextAction: report.worksheet.nextHumanAction,
    readOnly: true,
    ready: report.worksheet.ready
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

function sourceCandidatePromotionReadinessWorksheet(
  snapshot: SourceCandidatePromotionReadinessSnapshot
): SourceCandidatePromotionReadinessWorksheet {
  const blocked = snapshot.rows
    .filter((row) => !row.ready)
    .map(sourceCandidatePromotionReadinessWorksheetItem);
  const ready = snapshot.rows
    .filter((row) => row.ready)
    .map(sourceCandidatePromotionReadinessWorksheetItem);

  return {
    blocked,
    copySafeCommands: sourceCandidatePromotionReadinessCopySafeCommands(),
    humanOwned: true,
    nextHumanAction:
      blocked[0]?.nextAction ??
      ready[0]?.nextAction ??
      "No accepted source-candidate promotion rows were found; review curation handoff before enabling promotion.",
    ready
  };
}

function sourceCandidatePromotionReadinessCopySafeCommands(): SourceCandidatePromotionReadinessCommand[] {
  return [
    {
      command: "npm run promotion:readiness",
      id: "promotion-readiness",
      label: "Refresh promotion readiness",
      mode: "read-only",
      purpose: "Summarize accepted source-candidate promotion blockers without writing public evidence."
    },
    {
      command: "npm run promotion:readiness -- --summary",
      id: "promotion-readiness-summary",
      label: "Refresh compact promotion summary",
      mode: "read-only",
      purpose:
        "Print accepted-candidate promotion counts, blockers, ready rows, and next action without dumping the full snapshot."
    },
    {
      command: "npm run promotion:dry-run -- --pmid <pmid>",
      id: "promotion-dry-run",
      label: "Dry-run one accepted PMID",
      mode: "read-only",
      purpose:
        "Inspect one accepted PubMed candidate's claim link, extraction, and public packet readiness."
    },
    {
      command: "npm run ingest:sources -- --candidate-curation-handoff",
      id: "candidate-curation-handoff",
      label: "Review curation handoff",
      mode: "read-only",
      purpose: "List accepted candidates and their curation handoff status without mutating decisions."
    },
    {
      command:
        "npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 10",
      id: "candidate-review-overview",
      label: "Review pending candidate overview",
      mode: "read-only",
      purpose: "Inspect pending source-candidate groups before any human review decisions."
    },
    {
      command: "npm run launch:readiness",
      id: "launch-readiness",
      label: "Refresh aggregate launch readiness",
      mode: "read-only",
      purpose: "Recheck fully-live launch gates after promotion evidence changes."
    }
  ];
}

function sourceCandidatePromotionReadinessWorksheetItem(
  row: SourceCandidatePromotionReadinessRow
): SourceCandidatePromotionReadinessWorksheetItem {
  return {
    blockers: row.blockers,
    dedupeKey: row.candidate.dedupeKey,
    externalId: row.candidate.externalId,
    label: row.candidate.title,
    nextAction: row.nextAction,
    source: row.candidate.source,
    status: row.status
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

function sourceCandidatePromotionWorksheet(
  status: SourceCandidateCurationStatus
): SourceCandidatePromotionWorksheet {
  const safeKey = safeCandidateKey(status.candidate.dedupeKey);
  const targetClaimId = status.candidate.claimId;
  const targetReferenceId = status.acceptedReferenceId;
  const existingClaimIds = status.claimLinks.map((link) => link.claimId);
  const existingStudyIds = status.studies.map((study) => study.id);
  const claimLinkReady = existingClaimIds.length > 0 || Boolean(status.candidateClaimLinked);
  const studyExtractionReady = existingStudyIds.length > 0;

  const claimLinkNextAction = claimLinkReady
    ? "Accepted reference is linked to the candidate claim."
    : "Human link the accepted reference to the candidate claim before promotion review.";
  const studyExtractionNextAction = studyExtractionReady
    ? "Structured study extraction is present for the accepted reference."
    : "Human add structured study extraction for the accepted reference before promotion review.";
  const nextHumanActions = [
    ...(claimLinkReady ? [] : [claimLinkNextAction]),
    ...(studyExtractionReady ? [] : [studyExtractionNextAction]),
    ...(status.publicSourcePacketReady
      ? []
      : ["Rerun promotion dry-run after claim link and extraction are complete."])
  ];

  if (nextHumanActions.length === 0) {
    nextHumanActions.push("Human review the ready public packet before any explicit promotion.");
  }

  return {
    acceptedReferenceId: targetReferenceId,
    candidateClaimId: targetClaimId,
    claimLink: {
      existingClaimIds,
      nextAction: claimLinkNextAction,
      ready: claimLinkReady,
      targetClaimId,
      targetReferenceId
    },
    curationStatus: status.status,
    humanReviewRequired: true,
    nextHumanActions,
    publicSourcePacketReady: status.publicSourcePacketReady,
    readOnlyCommands: {
      candidateReviewPacket: `npm run ingest:sources -- --candidate-review-packet ${safeKey}`,
      curationDraft: `npm run ingest:sources -- --candidate-curation-draft ${safeKey}`,
      curationStatus: `npm run ingest:sources -- --candidate-curation-status ${safeKey}`,
      dryRunPromotion: `npm run promotion:dry-run -- ${safeKey}`,
      referenceMatches: `npm run ingest:sources -- --candidate-reference-matches ${safeKey}`,
      siblings: `npm run ingest:sources -- --candidate-siblings ${safeKey}`
    },
    requiredEvidence: sourceCandidatePromotionRequiredEvidence({
      claimLinkNextAction,
      claimLinkReady,
      status,
      studyExtractionNextAction,
      studyExtractionReady
    }),
    studyExtraction: {
      existingStudyIds,
      nextAction: studyExtractionNextAction,
      ready: studyExtractionReady,
      targetReferenceId
    }
  };
}

function sourceCandidatePromotionRequiredEvidence({
  claimLinkNextAction,
  claimLinkReady,
  status,
  studyExtractionNextAction,
  studyExtractionReady
}: {
  claimLinkNextAction: string;
  claimLinkReady: boolean;
  status: SourceCandidateCurationStatus;
  studyExtractionNextAction: string;
  studyExtractionReady: boolean;
}): SourceCandidatePromotionEvidenceItem[] {
  const acceptedReferenceReady = Boolean(
    status.acceptedReferenceId &&
      status.acceptedReference?.title &&
      status.acceptedReference.url
  );

  return [
    {
      id: "candidate-accepted",
      label: "Candidate accepted",
      nextAction:
        status.candidate.decision === "Accepted"
          ? "Candidate is accepted."
          : "Accept the candidate only after human review and a matching curated reference.",
      ready: status.candidate.decision === "Accepted"
    },
    {
      id: "candidate-human-reviewed",
      label: "Candidate human review",
      nextAction:
        status.candidate.reviewStatus === "Human reviewed"
          ? "Candidate review status is Human reviewed."
          : "Record a human review decision before promotion review.",
      ready: status.candidate.reviewStatus === "Human reviewed"
    },
    {
      id: "accepted-reference-traceable",
      label: "Traceable accepted reference",
      nextAction: acceptedReferenceReady
        ? "Accepted reference has id, title, and URL."
        : "Attach a matching accepted reference with id, title, and URL.",
      ready: acceptedReferenceReady
    },
    {
      id: "claim-link",
      label: "Claim link",
      nextAction: claimLinkNextAction,
      ready: claimLinkReady
    },
    {
      id: "structured-extraction",
      label: "Structured extraction",
      nextAction: studyExtractionNextAction,
      ready: studyExtractionReady
    },
    {
      id: "public-source-packet-ready",
      label: "Public source packet readiness",
      nextAction: status.publicSourcePacketReady
        ? "Curation status reports publicSourcePacketReady=true."
        : "Rerun the dry run after claim link and structured extraction are complete.",
      ready: status.publicSourcePacketReady
    }
  ];
}

function safeCandidateKey(dedupeKey: string) {
  return `b64:${Buffer.from(dedupeKey, "utf8").toString("base64url")}`;
}

function blockedPromotion(
  blockers: string[],
  candidate: SourceCandidatePromotionAssessment["candidate"],
  worksheet?: SourceCandidatePromotionWorksheet
): SourceCandidatePromotionAssessment {
  return {
    blockers,
    candidate,
    dryRun: true,
    nextAction: blockers[0] ?? "Resolve promotion blockers.",
    ready: false,
    worksheet
  };
}
