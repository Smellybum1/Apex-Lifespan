import {
  listSourceCandidateAcceptedReferenceMatches,
  listSourceCandidateCurationHandoff,
  listSourceCandidateReviewQueue,
  listSourceCandidateSiblings,
  type SourceCandidateAcceptedReferenceMatches,
  type SourceCandidateCurationStatus,
  type SourceCandidateSiblingMatchReason,
  type SourceCandidateSiblings
} from "@/lib/data/source-candidates";
import {
  assessSourceCandidateConviction,
  type SourceConvictionLabel,
  type SourceCandidateTriageRecommendation
} from "@/lib/source-conviction";
import type { SourceCandidate } from "@/lib/types";

export type OperatorCandidateAiReviewDecision =
  | "Accepted"
  | "Needs Codex inspection"
  | "Rejected";
export type OperatorCandidateConfidenceDisposition =
  | "recommend-accept"
  | "recommend-reject"
  | "needs-codex-inspection";

export interface OperatorReviewQueueRow {
  aiReview: {
    acceptedReferenceId?: string;
    approvalBlockers: string[];
    approvalEnabled: boolean;
    approvalNote: string;
    decision: OperatorCandidateAiReviewDecision;
    label: string;
    noAutoDecision: true;
    noAutoExtraction: true;
    noAutoPromotion: true;
    rationale: string[];
    reviewFocus: string[];
  };
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
  claimFit: {
    claimId?: string;
    confidence: "claim-scoped" | "intervention-scoped" | "query-only";
    interventionId?: string;
    label: string;
    query: string;
    rationale: string[];
    reviewCue: string;
  };
  confidencePolicy: {
    actionLabel: string;
    autoDecisionDisabledReason: string;
    disposition: OperatorCandidateConfidenceDisposition;
    explicitApprovalRequired: false;
    label: SourceConvictionLabel;
    noAutoAccept: true;
    noAutoDecision: true;
    noAutoReject: true;
    rationale: string[];
    score: number;
    thresholds: {
      highConfidenceAcceptAtLeast: 75;
      veryLowConfidenceRejectBelow: 35;
    };
    version: string;
  };
  curationStatus?: SourceCandidateCurationStatus["status"];
  dedupeKey: string;
  decision: SourceCandidate["decision"];
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
  reviewStage: {
    actionLabel: string;
    kind:
      | "candidate-decision"
      | "claim-link"
      | "study-extraction"
      | "public-source-packet"
      | "curation-blocker"
      | "reviewed";
    label: string;
    priority: number;
  };
  reviewStatus: SourceCandidate["reviewStatus"];
  siblingContext?: {
    candidateRows: Array<{
      decision: SourceCandidate["decision"];
      dedupeKey: string;
      matchReasons: SourceCandidateSiblingMatchReason[];
      title: string;
      triageScore: number;
    }>;
    duplicateIdentityRows: number;
    inspectedRows: number;
    matchReasons: SourceCandidateSiblingMatchReason[];
    mixedDecisionRows: number;
    noAutomaticCandidateDecision: true;
    noAutomaticExtractionWrite: true;
    noAutomaticPromotion: true;
    readOnly: true;
    relatedContextRows: number;
    reviewCue: string;
  };
  source: SourceCandidate["source"];
  title: string;
  trialAlert?: {
    detail: string;
    label: string;
    noAutoPromotion: true;
    noScoreChange: true;
  };
  triageReasons: string[];
  triageScore: number;
  url: string;
}

export interface OperatorReviewQueueSnapshot {
  pendingCount: number;
  rows: OperatorReviewQueueRow[];
}

const CONFIDENCE_POLICY_VERSION = "2026-06-14";
const VERY_LOW_CONFIDENCE_REJECT_BELOW = 35;
const HIGH_CONFIDENCE_ACCEPT_AT_LEAST = 75;

export async function getOperatorReviewQueueSnapshot(
  limit = 10
): Promise<OperatorReviewQueueSnapshot> {
  const scanLimit = Math.max(limit * 3, limit);
  const [pendingCandidates, curationStatuses] = await Promise.all([
    listSourceCandidateReviewQueue({ limit: scanLimit }),
    listSourceCandidateCurationHandoff({ limit })
  ]);
  const candidates = uniqueCandidates([
    ...pendingCandidates,
    ...curationStatuses.map((status) => status.candidate)
  ]);
  const acceptedReferenceMatches = await Promise.all(
    candidates.map((candidate) =>
      listSourceCandidateAcceptedReferenceMatches(candidate.dedupeKey)
    )
  );
  const siblingContexts = await Promise.all(
    candidates.map((candidate) => listSourceCandidateSiblings(candidate.dedupeKey, { limit: 10 }))
  );
  const curationByKey = new Map(
    curationStatuses.map((status) => [status.candidate.dedupeKey, status])
  );
  const referenceMatchesByKey = new Map(
    acceptedReferenceMatches
      .filter((match): match is SourceCandidateAcceptedReferenceMatches => Boolean(match))
      .map((match) => [match.candidate.dedupeKey, match])
  );
  const siblingContextByKey = new Map(
    siblingContexts
      .filter((siblings): siblings is SourceCandidateSiblings => Boolean(siblings))
      .map((siblings) => [siblings.target.dedupeKey, siblings])
  );
  const rows = candidates
    .map((candidate) =>
      operatorReviewQueueRow(
        candidate,
        curationByKey.get(candidate.dedupeKey),
        referenceMatchesByKey.get(candidate.dedupeKey),
        siblingContextByKey.get(candidate.dedupeKey)
      )
    )
    .sort(compareOperatorReviewQueueRows)
    .slice(0, limit);

  return {
    pendingCount: rows.length,
    rows
  };
}

export async function getOperatorReviewQueueSnapshotForIngestionJobs(
  ingestionJobIds: string[],
  limit = 10
): Promise<OperatorReviewQueueSnapshot> {
  const jobIds = uniqueNonEmptyStrings(ingestionJobIds);

  if (jobIds.length === 0) {
    return {
      pendingCount: 0,
      rows: []
    };
  }

  const [candidateGroups, curationStatusGroups] = await Promise.all([
    Promise.all(
      jobIds.map((ingestionJobId) =>
        listSourceCandidateReviewQueue({
          ingestionJobId,
          limit
        })
      )
    ),
    Promise.all(
      jobIds.map((ingestionJobId) =>
        listSourceCandidateCurationHandoff({
          ingestionJobId,
          limit
        })
      )
    )
  ]);
  const curationStatuses = curationStatusGroups.flat();
  const candidates = uniqueCandidates([
    ...candidateGroups.flat(),
    ...curationStatuses.map((status) => status.candidate)
  ]);
  const curationByKey = new Map(
    curationStatuses.map((status) => [status.candidate.dedupeKey, status])
  );
  const acceptedReferenceMatches = await Promise.all(
    candidates.map((candidate) =>
      listSourceCandidateAcceptedReferenceMatches(candidate.dedupeKey)
    )
  );
  const siblingContexts = await Promise.all(
    candidates.map((candidate) => listSourceCandidateSiblings(candidate.dedupeKey, { limit: 10 }))
  );
  const referenceMatchesByKey = new Map(
    acceptedReferenceMatches
      .filter((match): match is SourceCandidateAcceptedReferenceMatches => Boolean(match))
      .map((match) => [match.candidate.dedupeKey, match])
  );
  const siblingContextByKey = new Map(
    siblingContexts
      .filter((siblings): siblings is SourceCandidateSiblings => Boolean(siblings))
      .map((siblings) => [siblings.target.dedupeKey, siblings])
  );
  const rows = candidates
    .map((candidate) =>
      operatorReviewQueueRow(
        candidate,
        curationByKey.get(candidate.dedupeKey),
        referenceMatchesByKey.get(candidate.dedupeKey),
        siblingContextByKey.get(candidate.dedupeKey)
      )
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
  curationStatus?: SourceCandidateCurationStatus,
  acceptedReferenceMatches?: SourceCandidateAcceptedReferenceMatches,
  siblingContext?: SourceCandidateSiblings
): OperatorReviewQueueRow {
  const conviction = assessSourceCandidateConviction(candidate);
  const quotedDedupeKey = quote(candidate.dedupeKey);
  const aiReview = candidateAiReview({ acceptedReferenceMatches, candidate, conviction });
  const reviewStage = candidateReviewStage(candidate, curationStatus, aiReview);

  return {
    aiReview,
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
    claimFit: candidateClaimFit(candidate),
    confidencePolicy: candidateConfidencePolicy({ aiReview, conviction }),
    curationStatus: curationStatus?.status,
    dedupeKey: candidate.dedupeKey,
    decision: candidate.decision,
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
    reviewStage,
    reviewStatus: candidate.reviewStatus,
    siblingContext: candidateSiblingContext(siblingContext),
    source: candidate.source,
    title: candidate.title,
    trialAlert: sourceCandidateTrialAlert(candidate),
    triageReasons: candidate.triageReasons,
    triageScore: candidate.triageScore,
    url: candidate.url
  };
}

function candidateSiblingContext(
  siblings: SourceCandidateSiblings | undefined
): OperatorReviewQueueRow["siblingContext"] {
  const siblingRows = siblings?.siblings ?? [];
  const matchReasons = uniqueSiblingMatchReasons(
    siblingRows.flatMap((sibling) => sibling.matchReasons)
  );
  const duplicateIdentityRows = siblingRows.filter((sibling) =>
    sibling.matchReasons.includes("Same source/external id")
  ).length;
  const relatedContextRows = siblingRows.filter((sibling) =>
    sibling.matchReasons.some(
      (reason) =>
        reason === "Same query/region" ||
        reason === "Same intervention context" ||
        reason === "Same claim context"
    )
  ).length;
  const decisions = new Set([
    ...(siblings?.target ? [siblings.target.decision] : []),
    ...siblingRows.map((sibling) => sibling.candidate.decision)
  ]);
  const mixedDecisionRows = decisions.size > 1 ? siblingRows.length : 0;
  const reviewCue =
    duplicateIdentityRows > 0
      ? "Review duplicate identity rows together before changing any candidate decision."
      : relatedContextRows > 0
        ? "Review related query, intervention, or claim context before changing any candidate decision."
        : "No sibling rows were found in the bounded read-only inspection.";

  return {
    candidateRows: siblingRows.slice(0, 5).map((sibling) => ({
      decision: sibling.candidate.decision,
      dedupeKey: sibling.candidate.dedupeKey,
      matchReasons: sibling.matchReasons,
      title: sibling.candidate.title,
      triageScore: sibling.candidate.triageScore
    })),
    duplicateIdentityRows,
    inspectedRows: siblingRows.length,
    matchReasons,
    mixedDecisionRows,
    noAutomaticCandidateDecision: true,
    noAutomaticExtractionWrite: true,
    noAutomaticPromotion: true,
    readOnly: true,
    relatedContextRows,
    reviewCue
  };
}

function candidateClaimFit(candidate: SourceCandidate): OperatorReviewQueueRow["claimFit"] {
  if (candidate.claimId) {
    return {
      claimId: candidate.claimId,
      confidence: "claim-scoped",
      ...(candidate.interventionId ? { interventionId: candidate.interventionId } : {}),
      label: `Claim-scoped lead: ${candidate.claimId}`,
      query: candidate.query,
      rationale: [
        `Source discovery persisted claim ID ${candidate.claimId}.`,
        ...(candidate.interventionId
          ? [`Intervention context is ${candidate.interventionId}.`]
          : []),
        `Original source query: ${candidate.query}.`
      ],
      reviewCue:
        "Confirm the source title, external ID, and extracted source text fit this exact claim before accepting."
    };
  }

  if (candidate.interventionId) {
    return {
      confidence: "intervention-scoped",
      interventionId: candidate.interventionId,
      label: `Intervention-scoped lead: ${candidate.interventionId}`,
      query: candidate.query,
      rationale: [
        `Source discovery persisted intervention ID ${candidate.interventionId}.`,
        "No claim ID is attached to this candidate yet.",
        `Original source query: ${candidate.query}.`
      ],
      reviewCue:
        "Confirm which claim this source supports before accepting or linking a reviewed reference."
    };
  }

  return {
    confidence: "query-only",
    label: "Unscoped source lead",
    query: candidate.query,
    rationale: [
      "No persisted claim ID or intervention ID is attached to this candidate.",
      `Original source query: ${candidate.query}.`
    ],
    reviewCue:
      "Use the packet, siblings, and reference-match commands to establish claim fit before any decision."
  };
}

function candidateConfidencePolicy({
  aiReview,
  conviction
}: {
  aiReview: OperatorReviewQueueRow["aiReview"];
  conviction: ReturnType<typeof assessSourceCandidateConviction>;
}): OperatorReviewQueueRow["confidencePolicy"] {
  const veryLowConfidence =
    conviction.score < VERY_LOW_CONFIDENCE_REJECT_BELOW ||
    conviction.triageRecommendation === "hold-or-reject";
  const highConfidenceAccept =
    conviction.score >= HIGH_CONFIDENCE_ACCEPT_AT_LEAST &&
    conviction.triageRecommendation === "review-first" &&
    Boolean(aiReview.acceptedReferenceId);
  const disposition: OperatorCandidateConfidenceDisposition = veryLowConfidence
    ? "recommend-reject"
    : highConfidenceAccept
      ? "recommend-accept"
      : "needs-codex-inspection";

  return {
    actionLabel: confidencePolicyActionLabel(disposition),
    autoDecisionDisabledReason:
      "No blind background decision is made; Codex may apply an AI-reviewed decision with a source-backed audit note.",
    disposition,
    explicitApprovalRequired: false,
    label: conviction.label,
    noAutoAccept: true,
    noAutoDecision: true,
    noAutoReject: true,
    rationale: confidencePolicyRationale({ aiReview, conviction, disposition }),
    score: conviction.score,
    thresholds: {
      highConfidenceAcceptAtLeast: HIGH_CONFIDENCE_ACCEPT_AT_LEAST,
      veryLowConfidenceRejectBelow: VERY_LOW_CONFIDENCE_REJECT_BELOW
    },
    version: CONFIDENCE_POLICY_VERSION
  };
}

function confidencePolicyActionLabel(disposition: OperatorCandidateConfidenceDisposition) {
  if (disposition === "recommend-reject") {
    return "Recommend reject";
  }

  if (disposition === "recommend-accept") {
    return "Recommend accept";
  }

  return "Needs Codex inspection";
}

function confidencePolicyRationale({
  aiReview,
  conviction,
  disposition
}: {
  aiReview: OperatorReviewQueueRow["aiReview"];
  conviction: ReturnType<typeof assessSourceCandidateConviction>;
  disposition: OperatorCandidateConfidenceDisposition;
}) {
  const base = [
    `${conviction.score}/100 ${conviction.label.toLowerCase()} source confidence from rubric ${conviction.rubricVersion}.`
  ];

  if (disposition === "recommend-reject") {
    return [
      ...base,
      `Very-low confidence below ${VERY_LOW_CONFIDENCE_REJECT_BELOW}/100 or hold/reject triage; Codex may reject with an AI-reviewed audit note.`,
      "No blind background rejection is performed."
    ];
  }

  if (disposition === "recommend-accept") {
    return [
      ...base,
      `High confidence at or above ${HIGH_CONFIDENCE_ACCEPT_AT_LEAST}/100 with a matched reviewed reference (${aiReview.acceptedReferenceId}).`,
      "Codex may accept with an AI-reviewed audit note."
    ];
  }

  return [
    ...base,
    "Confidence is not enough for a shortcut; inspect source identity, claim fit, and siblings before applying a decision.",
    "No blind background decision is performed."
  ];
}

function candidateAiReview({
  acceptedReferenceMatches,
  candidate,
  conviction
}: {
  acceptedReferenceMatches?: SourceCandidateAcceptedReferenceMatches;
  candidate: SourceCandidate;
  conviction: ReturnType<typeof assessSourceCandidateConviction>;
}): OperatorReviewQueueRow["aiReview"] {
  const acceptedReferenceId =
    candidate.acceptedReferenceId ?? acceptedReferenceMatches?.references[0]?.id;
  const highConvictionAccept =
    conviction.triageRecommendation === "review-first" && Boolean(acceptedReferenceId);
  const lowConvictionReject = conviction.triageRecommendation === "hold-or-reject";
  const decision: OperatorCandidateAiReviewDecision = highConvictionAccept
    ? "Accepted"
    : lowConvictionReject
      ? "Rejected"
      : "Needs Codex inspection";
  const approvalBlockers = candidateAiReviewApprovalBlockers({
    acceptedReferenceId,
    candidate,
    decision
  });
  const approvalEnabled = approvalBlockers.length === 0 && decision !== "Needs Codex inspection";
  const rationale = [
    ...conviction.triageRationale,
    ...(acceptedReferenceId
      ? [`Matched reference candidate: ${acceptedReferenceId}.`]
      : ["No accepted-reference match is prefilled for an AI accept decision."])
  ];

  return {
    ...(acceptedReferenceId ? { acceptedReferenceId } : {}),
    approvalBlockers,
    approvalEnabled,
    approvalNote: candidateAiReviewApprovalNote({
      candidate,
      decision,
      rationale
    }),
    decision,
    label:
      decision === "Needs Codex inspection"
        ? "AI review needs Codex inspection"
        : `AI recommends ${decision.toLowerCase()}`,
    noAutoDecision: true,
    noAutoExtraction: true,
    noAutoPromotion: true,
    rationale,
    reviewFocus: [
      "Confirm source identity, external ID, title/query relevance, and claim fit before applying.",
      "Accepting only reviews the source candidate; it does not write extraction rows or promote public evidence.",
      "Rejecting should mean the candidate is not useful for this scoped source queue item."
    ]
  };
}

function candidateAiReviewApprovalBlockers({
  acceptedReferenceId,
  candidate,
  decision
}: {
  acceptedReferenceId?: string;
  candidate: SourceCandidate;
  decision: OperatorCandidateAiReviewDecision;
}) {
  const blockers: string[] = [];

  if (candidate.decision !== "Pending review") {
    blockers.push("Candidate is no longer pending review.");
  }

  if (decision === "Accepted" && !acceptedReferenceId) {
    blockers.push("Accept review needs a matched reference ID.");
  }

  if (decision === "Needs Codex inspection") {
    blockers.push("Codex did not produce an accept/reject decision; inspect this source before applying.");
  }

  return blockers;
}

function candidateAiReviewApprovalNote({
  candidate,
  decision,
  rationale
}: {
  candidate: SourceCandidate;
  decision: OperatorCandidateAiReviewDecision;
  rationale: string[];
}) {
  return [
    `Codex AI-reviewed candidate decision: ${decision}.`,
    `Candidate: ${candidate.source} ${candidate.externalId} - ${candidate.title}.`,
    `Rationale: ${rationale.slice(0, 3).join(" ")}`,
    "No extraction rows or public evidence promotion are approved by this action."
  ].join(" ");
}

function compareOperatorReviewQueueRows(
  left: OperatorReviewQueueRow,
  right: OperatorReviewQueueRow
) {
  return (
    right.reviewStage.priority - left.reviewStage.priority ||
    right.autopilot.priority - left.autopilot.priority ||
    right.autopilot.sourceConvictionScore - left.autopilot.sourceConvictionScore ||
    right.triageScore - left.triageScore ||
    left.title.localeCompare(right.title)
  );
}

function candidateReviewStage(
  candidate: SourceCandidate,
  curationStatus: SourceCandidateCurationStatus | undefined,
  aiReview: OperatorReviewQueueRow["aiReview"]
): OperatorReviewQueueRow["reviewStage"] {
  if (curationStatus?.status === "Public source packet ready") {
    return {
      actionLabel: "Review source packet for public inclusion",
      kind: "public-source-packet",
      label: "Public source packet review",
      priority: 6
    };
  }

  if (
    curationStatus?.status === "Accepted reference missing" ||
    curationStatus?.status === "Accepted reference mismatch"
  ) {
    return {
      actionLabel: curationStatus.nextAction,
      kind: "curation-blocker",
      label: curationStatus.status,
      priority: 5
    };
  }

  if (curationStatus?.status === "Claim link missing") {
    return {
      actionLabel: "Approve or reject the claim-link handoff",
      kind: "claim-link",
      label: "Claim-link review",
      priority: 5
    };
  }

  if (curationStatus?.status === "Extraction pending") {
    return {
      actionLabel: "Review and save structured extraction fields",
      kind: "study-extraction",
      label: "Extraction review",
      priority: 5
    };
  }

  if (candidate.decision === "Pending review") {
    return {
      actionLabel:
        aiReview.decision === "Needs Codex inspection"
          ? "Inspect packet before deciding"
          : `Apply or override: ${aiReview.decision}`,
      kind: "candidate-decision",
      label: "Candidate decision",
      priority: aiReview.approvalEnabled ? 4 : 3
    };
  }

  return {
    actionLabel:
      candidate.decision === "Accepted"
        ? "Candidate already accepted; continue curation only if needed"
        : "Candidate already rejected",
    kind: "reviewed",
    label: "Reviewed candidate",
    priority: 1
  };
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

function uniqueCandidates(candidates: SourceCandidate[]) {
  const byKey = new Map<string, SourceCandidate>();

  for (const candidate of candidates) {
    if (!byKey.has(candidate.dedupeKey)) {
      byKey.set(candidate.dedupeKey, candidate);
    }
  }

  return Array.from(byKey.values());
}

function uniqueNonEmptyStrings(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))
  );
}

function uniqueSiblingMatchReasons(
  values: SourceCandidateSiblingMatchReason[]
): SourceCandidateSiblingMatchReason[] {
  return Array.from(new Set(values));
}

function sourceCandidateTrialAlert(candidate: SourceCandidate) {
  if (candidate.source !== "ClinicalTrials.gov") {
    return undefined;
  }

  const label = metadataString(candidate.metadata, "trialAlertLabel");

  if (!label) {
    return undefined;
  }

  return {
    detail:
      metadataString(candidate.metadata, "trialAlertDetail") ??
      "ClinicalTrials.gov registry alert requires operator review before any evidence workflow.",
    label,
    noAutoPromotion: true as const,
    noScoreChange: true as const
  };
}

function metadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
