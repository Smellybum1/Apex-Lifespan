import {
  listSourceCandidateCurationHandoff,
  listSourceCandidateReviewQueue,
  type SourceCandidateCurationStatus
} from "@/lib/data/source-candidates";
import {
  assessSourceCandidateConviction,
  type SourceCandidateTriageRecommendation
} from "@/lib/source-conviction";
import type { SourceCandidate } from "@/lib/types";

export interface OperatorReviewQueueRow {
  autopilot: {
    curationDraftCommand: string;
    nextAction: string;
    noAutoAccept: true;
    noAutoExtraction: true;
    noAutoPromotion: true;
    noAutoReject: true;
    priority: number;
    rationale: string[];
    recommendation: SourceCandidateTriageRecommendation;
    sourceConvictionScore: number;
    sourceReputationLabel: string;
  };
  curationStatus?: SourceCandidateCurationStatus["status"];
  dedupeKey: string;
  nextAction?: string;
  packetPreview: {
    candidateReviewPacketCommand: string;
    curationStatusCommand: string;
    noCandidateDecision: true;
    noExtractionWrite: true;
    noPromotion: true;
    readOnly: true;
    referenceMatchesCommand: string;
    siblingsCommand: string;
  };
  publicSourcePacketReady?: boolean;
  source: SourceCandidate["source"];
  title: string;
  triageReasons: string[];
  triageScore: number;
  url: string;
}

export interface OperatorReviewQueueSnapshot {
  pendingCount: number;
  rows: OperatorReviewQueueRow[];
}

export async function getOperatorReviewQueueSnapshot(
  limit = 10
): Promise<OperatorReviewQueueSnapshot> {
  const scanLimit = Math.max(limit * 3, limit);
  const [candidates, curationStatuses] = await Promise.all([
    listSourceCandidateReviewQueue({ limit: scanLimit }),
    listSourceCandidateCurationHandoff({ limit })
  ]);
  const curationByKey = new Map(
    curationStatuses.map((status) => [status.candidate.dedupeKey, status])
  );
  const rows = candidates
    .map((candidate) =>
      operatorReviewQueueRow(candidate, curationByKey.get(candidate.dedupeKey))
    )
    .sort(compareOperatorReviewQueueRows)
    .slice(0, limit);

  return {
    pendingCount: rows.length,
    rows
  };
}

function operatorReviewQueueRow(
  candidate: SourceCandidate,
  curationStatus?: SourceCandidateCurationStatus
): OperatorReviewQueueRow {
  const conviction = assessSourceCandidateConviction(candidate);
  const quotedDedupeKey = quote(candidate.dedupeKey);

  return {
    autopilot: {
      curationDraftCommand: `npm run ingest:sources -- --candidate-curation-draft ${quotedDedupeKey}`,
      nextAction: reviewQueueAutopilotNextAction(conviction.triageRecommendation),
      noAutoAccept: true,
      noAutoExtraction: true,
      noAutoPromotion: true,
      noAutoReject: true,
      priority: reviewQueueAutopilotPriority(conviction.triageRecommendation),
      rationale: conviction.triageRationale,
      recommendation: conviction.triageRecommendation,
      sourceConvictionScore: conviction.score,
      sourceReputationLabel: conviction.sourceReputationLabel
    },
    curationStatus: curationStatus?.status,
    dedupeKey: candidate.dedupeKey,
    nextAction: curationStatus?.nextAction,
    packetPreview: {
      candidateReviewPacketCommand: `npm run ingest:sources -- --candidate-review-packet ${quotedDedupeKey}`,
      curationStatusCommand: `npm run ingest:sources -- --candidate-curation-status ${quotedDedupeKey}`,
      noCandidateDecision: true,
      noExtractionWrite: true,
      noPromotion: true,
      readOnly: true,
      referenceMatchesCommand: `npm run ingest:sources -- --candidate-reference-matches ${quotedDedupeKey}`,
      siblingsCommand: `npm run ingest:sources -- --candidate-siblings ${quotedDedupeKey}`
    },
    publicSourcePacketReady: curationStatus?.publicSourcePacketReady,
    source: candidate.source,
    title: candidate.title,
    triageReasons: candidate.triageReasons,
    triageScore: candidate.triageScore,
    url: candidate.url
  };
}

function compareOperatorReviewQueueRows(
  left: OperatorReviewQueueRow,
  right: OperatorReviewQueueRow
) {
  return (
    right.autopilot.priority - left.autopilot.priority ||
    right.autopilot.sourceConvictionScore - left.autopilot.sourceConvictionScore ||
    right.triageScore - left.triageScore ||
    left.title.localeCompare(right.title)
  );
}

function reviewQueueAutopilotPriority(
  recommendation: SourceCandidateTriageRecommendation
) {
  if (recommendation === "review-first") {
    return 4;
  }

  if (recommendation === "review-after-stronger-sources") {
    return 3;
  }

  if (recommendation === "limitations-only") {
    return 2;
  }

  return 1;
}

function reviewQueueAutopilotNextAction(
  recommendation: SourceCandidateTriageRecommendation
) {
  if (recommendation === "review-first") {
    return "Review this candidate first for accepted-reference matching and claim fit.";
  }

  if (recommendation === "review-after-stronger-sources") {
    return "Review after higher-conviction candidates and confirm claim relevance before accepting.";
  }

  if (recommendation === "limitations-only") {
    return "Use as limitation or secondary context unless stronger reviewed evidence is unavailable.";
  }

  return "Hold or reject unless source review finds strong claim-scoped relevance.";
}

function quote(value: string) {
  return JSON.stringify(value);
}
