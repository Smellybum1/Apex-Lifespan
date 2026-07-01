import {
  SourceCandidateDecision as DbSourceCandidateDecision,
  type Prisma,
  ReviewStatus as DbReviewStatus,
  SourceKind as DbSourceKind
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type {
  ScoreWorklistPendingReferenceGroup,
  ScoreWorklistRepairSummary
} from "@/lib/score-worklist";

const CANDIDATE_KEY_B64_PREFIX = "candidate-key-b64:";

export const DEFAULT_SCORE_EXTRACTION_CANDIDATE_PREVIEW_LIMIT = 8;

export type ScoreExtractionCandidatePreview = {
  acceptedCandidates: number;
  blockedCandidates: number;
  blockerCounts: ScoreExtractionCandidateBlockerCounts;
  referenceLimit: number;
  references: ScoreExtractionCandidateReferencePreview[];
  readyCandidates: number;
  scannedReferences: number;
  totalPendingReferences: number;
};

export type ScoreExtractionCandidateReferencePreview = {
  blockedCandidates: number;
  blockerCounts: ScoreExtractionCandidateBlockerCounts;
  candidateCount: number;
  candidates: ScoreExtractionCandidatePreviewRow[];
  claimCount: number;
  extractionGaps: string[];
  readyCandidates: number;
  reference: {
    id: string;
    label: string;
    title: string;
  };
  studyCount: number;
};

export type ScoreExtractionCandidatePreviewRow = {
  acceptedReferenceId: string | null;
  blockers: ScoreExtractionCandidateBlocker[];
  claimId: string | null;
  claimLinkReady: boolean;
  curationDraftCommand: string;
  dedupeKey: string;
  externalId: string;
  extractionReady: boolean;
  interventionId: string | null;
  nextAction: string;
  reviewStatus: string;
  sourceLabel: string;
  sourceTextStatus: string;
  sourceType: string;
  title: string;
  triageScore: number;
};

export type ScoreExtractionCandidateBlockerKind =
  | "claim-link-missing"
  | "claim-missing"
  | "context-mismatch"
  | "existing-extraction"
  | "identity-warning";

export type ScoreExtractionCandidateBlocker = {
  kind: ScoreExtractionCandidateBlockerKind;
  label: string;
};

export type ScoreExtractionCandidateBlockerCounts = Record<
  ScoreExtractionCandidateBlockerKind,
  number
>;

type AcceptedCandidate = {
  acceptedReferenceId: string | null;
  claimId: string | null;
  dedupeKey: string;
  externalId: string;
  interventionId: string | null;
  metadata: Prisma.JsonValue;
  reviewStatus: DbReviewStatus;
  source: DbSourceKind;
  sourceType: string | null;
  title: string;
  triageScore: number;
};

export async function buildScoreExtractionCandidatePreview(
  summary: ScoreWorklistRepairSummary,
  { referenceLimit }: { referenceLimit: number }
): Promise<ScoreExtractionCandidatePreview> {
  const referenceGroups = summary.pendingReferenceGroups.slice(0, referenceLimit);
  const referenceIds = referenceGroups.map((group) => group.reference.id);

  if (referenceIds.length === 0) {
    return {
      acceptedCandidates: 0,
      blockedCandidates: 0,
      blockerCounts: emptyScoreExtractionBlockerCounts(),
      referenceLimit,
      references: [],
      readyCandidates: 0,
      scannedReferences: 0,
      totalPendingReferences: summary.pendingReferenceGroups.length
    };
  }

  const [candidates, claimLinks, studyCounts] = await Promise.all([
    prisma.sourceCandidate.findMany({
      orderBy: [{ triageScore: "desc" }, { updatedAt: "desc" }],
      select: {
        acceptedReferenceId: true,
        claimId: true,
        dedupeKey: true,
        externalId: true,
        interventionId: true,
        metadata: true,
        reviewStatus: true,
        source: true,
        sourceType: true,
        title: true,
        triageScore: true
      },
      where: {
        acceptedReferenceId: {
          in: referenceIds
        },
        decision: DbSourceCandidateDecision.ACCEPTED
      }
    }),
    prisma.claimReference.findMany({
      select: {
        claimId: true,
        referenceId: true
      },
      where: {
        referenceId: {
          in: referenceIds
        }
      }
    }),
    prisma.study.groupBy({
      by: ["referenceId"],
      _count: {
        _all: true
      },
      where: {
        referenceId: {
          in: referenceIds
        }
      }
    })
  ]);
  const candidatesByReferenceId = groupCandidatesByReferenceId(candidates);
  const linkedClaimKeys = new Set(
    claimLinks.map((link) => `${link.referenceId}\u0000${link.claimId}`)
  );
  const studyCountByReferenceId = new Map(
    studyCounts
      .filter((group) => group.referenceId)
      .map((group) => [group.referenceId as string, group._count._all])
  );
  const references = referenceGroups.map((group) =>
    extractionCandidateReferencePreview({
      candidates: candidatesByReferenceId.get(group.reference.id) ?? [],
      group,
      linkedClaimKeys,
      studyCount: studyCountByReferenceId.get(group.reference.id) ?? 0
    })
  );
  const readyCandidates = references.reduce(
    (total, reference) => total + reference.readyCandidates,
    0
  );
  const blockedCandidates = references.reduce(
    (total, reference) => total + reference.blockedCandidates,
    0
  );

  return {
    acceptedCandidates: candidates.length,
    blockedCandidates,
    blockerCounts: scoreExtractionBlockerCounts(references),
    referenceLimit,
    references,
    readyCandidates,
    scannedReferences: referenceIds.length,
    totalPendingReferences: summary.pendingReferenceGroups.length
  };
}

export function formatScoreExtractionCandidatePreviewLines(
  preview: ScoreExtractionCandidatePreview | undefined
) {
  const lines = [
    preview
      ? `Extraction candidate preview (read-only; scanned ${preview.scannedReferences}/${preview.totalPendingReferences} pending reference(s)):`
      : "Extraction candidate preview (read-only):"
  ];

  if (!preview || preview.scannedReferences === 0) {
    return [...lines, "No pending extraction references are visible in the current repair summary."];
  }

  lines.push(
    `${preview.acceptedCandidates} accepted candidate(s) are attached to the scanned references: ${preview.readyCandidates} ready, ${preview.blockedCandidates} blocked. Use curation drafts before any extraction write.`
  );
  lines.push(`Blockers: ${formatScoreExtractionBlockerCounts(preview.blockerCounts)}.`);

  if (preview.references.length === 0) {
    return [...lines, "No extraction reference rows matched the current repair summary."];
  }

  lines.push(...preview.references.flatMap(formatScoreExtractionCandidateReferenceLines));

  return lines;
}

function formatScoreExtractionCandidateReferenceLines(
  reference: ScoreExtractionCandidateReferencePreview
) {
  const lines = [
    `- ${reference.reference.label}: ${reference.candidateCount} accepted candidate(s), ${reference.readyCandidates} ready, ${reference.blockedCandidates} blocked, ${reference.claimCount} claim(s), ${reference.studyCount} existing extraction(s).`,
    `  ${reference.reference.title}`,
    reference.extractionGaps.length > 0
      ? `  Gaps: ${reference.extractionGaps.join("; ")}`
      : undefined
  ].filter((line): line is string => Boolean(line));

  if (reference.candidates.length === 0) {
    return [
      ...lines,
      "  No accepted source candidate is attached to this reference; repair from the source record directly."
    ];
  }

  return [
    ...lines,
    ...reference.candidates.map((candidate) =>
      [
        `  - ${candidate.sourceLabel} ${candidate.externalId} triage ${candidate.triageScore}: ${candidate.extractionReady ? "ready" : "blocked"} - ${candidate.nextAction}`,
        `    ${candidate.reviewStatus}; ${candidate.sourceType}; ${candidate.sourceTextStatus}`,
        `    Draft: ${candidate.curationDraftCommand}`
      ].join("\n")
    )
  ];
}

function extractionCandidateReferencePreview({
  candidates,
  group,
  linkedClaimKeys,
  studyCount
}: {
  candidates: AcceptedCandidate[];
  group: ScoreWorklistPendingReferenceGroup;
  linkedClaimKeys: Set<string>;
  studyCount: number;
}): ScoreExtractionCandidateReferencePreview {
  const groupContext = scoreExtractionGroupContext(group);
  const candidateRows = candidates.map((candidate) =>
    extractionCandidatePreviewRow({
      candidate,
      claimLinkReady: Boolean(
        candidate.acceptedReferenceId &&
          candidate.claimId &&
          linkedClaimKeys.has(`${candidate.acceptedReferenceId}\u0000${candidate.claimId}`)
      ),
      contextMatchesGroup: scoreExtractionCandidateMatchesGroup(candidate, groupContext),
      identityWarningBlocked: group.identityWarnings.length > 0,
      studyCount
    })
  );
  const readyCandidates = candidateRows.filter((candidate) => candidate.extractionReady).length;
  const blockedCandidates = candidateRows.length - readyCandidates;

  return {
    blockedCandidates,
    blockerCounts: scoreExtractionBlockerCountsForRows(candidateRows),
    candidateCount: candidates.length,
    candidates: candidateRows.slice(0, 3),
    claimCount: group.claimCount,
    extractionGaps: group.extractionGaps.slice(0, 5).map((gap) => gap.gap),
    readyCandidates,
    reference: {
      id: group.reference.id,
      label: group.reference.label,
      title: group.reference.title
    },
    studyCount
  };
}

function extractionCandidatePreviewRow({
  candidate,
  claimLinkReady,
  contextMatchesGroup,
  identityWarningBlocked,
  studyCount
}: {
  candidate: AcceptedCandidate;
  claimLinkReady: boolean;
  contextMatchesGroup: boolean;
  identityWarningBlocked: boolean;
  studyCount: number;
}): ScoreExtractionCandidatePreviewRow {
  const hasClaimContext = Boolean(candidate.claimId);
  const blockers = extractionCandidateBlockers({
    claimLinkReady,
    contextMatchesGroup,
    hasClaimContext,
    identityWarningBlocked,
    studyCount
  });
  const extractionReady = blockers.length === 0;

  return {
    acceptedReferenceId: candidate.acceptedReferenceId,
    blockers,
    claimId: candidate.claimId,
    claimLinkReady,
    curationDraftCommand: `npm run ingest:sources -- --candidate-curation-draft ${safeCandidateKey(candidate.dedupeKey)}`,
    dedupeKey: safeCandidateKey(candidate.dedupeKey),
    externalId: candidate.externalId,
    extractionReady,
    interventionId: candidate.interventionId,
    nextAction: extractionCandidateNextAction({
      claimLinkReady,
      contextMatchesGroup,
      hasClaimContext,
      identityWarningBlocked,
      studyCount
    }),
    reviewStatus: reviewStatusLabel(candidate.reviewStatus),
    sourceLabel: sourceKindLabel(candidate.source),
    sourceTextStatus: sourceTextStatus(candidate.metadata),
    sourceType: candidate.sourceType ?? "Source type not captured",
    title: candidate.title,
    triageScore: candidate.triageScore
  };
}

function extractionCandidateNextAction({
  claimLinkReady,
  contextMatchesGroup,
  hasClaimContext,
  identityWarningBlocked,
  studyCount
}: {
  claimLinkReady: boolean;
  contextMatchesGroup: boolean;
  hasClaimContext: boolean;
  identityWarningBlocked: boolean;
  studyCount: number;
}) {
  if (identityWarningBlocked) {
    return "Resolve the score repair identity warning before structured extraction.";
  }

  if (!contextMatchesGroup) {
    return "Accepted candidate context does not match this score repair group; resolve identity or reassignment first.";
  }

  if (!hasClaimContext) {
    return "Attach or confirm the candidate claim before structured extraction.";
  }

  if (!claimLinkReady) {
    return "Link the accepted reference to the candidate claim before extraction.";
  }

  if (studyCount > 0) {
    return "Review existing extraction for claim fit and fill missing source-packet fields.";
  }

  return "Ready for operator-reviewed study extraction after source identity is confirmed.";
}

function extractionCandidateBlockers({
  claimLinkReady,
  contextMatchesGroup,
  hasClaimContext,
  identityWarningBlocked,
  studyCount
}: {
  claimLinkReady: boolean;
  contextMatchesGroup: boolean;
  hasClaimContext: boolean;
  identityWarningBlocked: boolean;
  studyCount: number;
}): ScoreExtractionCandidateBlocker[] {
  const blockers: ScoreExtractionCandidateBlocker[] = [];

  if (identityWarningBlocked) {
    blockers.push({
      kind: "identity-warning",
      label: "Score repair identity warning"
    });
  }

  if (!contextMatchesGroup) {
    blockers.push({
      kind: "context-mismatch",
      label: "Candidate context mismatch"
    });
  }

  if (!hasClaimContext) {
    blockers.push({
      kind: "claim-missing",
      label: "Candidate claim missing"
    });
  }

  if (hasClaimContext && !claimLinkReady) {
    blockers.push({
      kind: "claim-link-missing",
      label: "Claim link missing"
    });
  }

  if (studyCount > 0) {
    blockers.push({
      kind: "existing-extraction",
      label: "Existing extraction needs review"
    });
  }

  return blockers;
}

export function formatScoreExtractionBlockerCounts(
  counts: ScoreExtractionCandidateBlockerCounts
) {
  return [
    `identity ${counts["identity-warning"]}`,
    `context ${counts["context-mismatch"]}`,
    `claim ${counts["claim-missing"]}`,
    `claim-link ${counts["claim-link-missing"]}`,
    `existing extraction ${counts["existing-extraction"]}`
  ].join(", ");
}

function scoreExtractionBlockerCounts(
  references: ScoreExtractionCandidateReferencePreview[]
) {
  return references.reduce((counts, reference) => {
    for (const [kind, count] of Object.entries(reference.blockerCounts)) {
      counts[kind as ScoreExtractionCandidateBlockerKind] += count;
    }

    return counts;
  }, emptyScoreExtractionBlockerCounts());
}

function scoreExtractionBlockerCountsForRows(rows: ScoreExtractionCandidatePreviewRow[]) {
  return rows.reduce((counts, row) => {
    for (const blocker of row.blockers) {
      counts[blocker.kind] += 1;
    }

    return counts;
  }, emptyScoreExtractionBlockerCounts());
}

function emptyScoreExtractionBlockerCounts(): ScoreExtractionCandidateBlockerCounts {
  return {
    "claim-link-missing": 0,
    "claim-missing": 0,
    "context-mismatch": 0,
    "existing-extraction": 0,
    "identity-warning": 0
  };
}

function scoreExtractionGroupContext(group: ScoreWorklistPendingReferenceGroup) {
  return {
    claimIds: new Set(group.sampleClaims.map((sample) => sample.claimId)),
    hasCompleteClaimSample: group.claimCount <= group.sampleClaims.length,
    interventionIds: new Set(group.interventions.map((intervention) => intervention.id))
  };
}

function scoreExtractionCandidateMatchesGroup(
  candidate: AcceptedCandidate,
  groupContext: ReturnType<typeof scoreExtractionGroupContext>
) {
  if (!candidate.interventionId || !groupContext.interventionIds.has(candidate.interventionId)) {
    return false;
  }

  if (!candidate.claimId) {
    return false;
  }

  if (groupContext.hasCompleteClaimSample && !groupContext.claimIds.has(candidate.claimId)) {
    return false;
  }

  return true;
}

function groupCandidatesByReferenceId(candidates: AcceptedCandidate[]) {
  const groups = new Map<string, AcceptedCandidate[]>();

  for (const candidate of candidates) {
    if (!candidate.acceptedReferenceId) {
      continue;
    }

    const current = groups.get(candidate.acceptedReferenceId) ?? [];
    groups.set(candidate.acceptedReferenceId, [...current, candidate]);
  }

  return groups;
}

function sourceTextStatus(metadata: Prisma.JsonValue) {
  const record = metadataRecord(metadata);

  if (!record) {
    return "No source text metadata captured.";
  }

  if (typeof record.abstractText === "string" && record.abstractText.trim()) {
    return "Abstract text captured for prefill review.";
  }

  if (typeof record.briefSummary === "string" && record.briefSummary.trim()) {
    return "Registry brief summary captured for prefill review.";
  }

  return "No abstract or registry summary captured.";
}

function metadataRecord(value: Prisma.JsonValue): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function safeCandidateKey(dedupeKey: string) {
  return `${CANDIDATE_KEY_B64_PREFIX}${Buffer.from(dedupeKey, "utf8").toString("base64url")}`;
}

function reviewStatusLabel(status: DbReviewStatus) {
  switch (status) {
    case DbReviewStatus.HUMAN_REVIEWED:
      return "Human reviewed";
    case DbReviewStatus.UNREVIEWED_AI_DRAFT:
      return "Unreviewed AI draft";
  }
}

function sourceKindLabel(source: DbSourceKind) {
  switch (source) {
    case DbSourceKind.PUBMED:
      return "PubMed";
    case DbSourceKind.CLINICALTRIALS_GOV:
      return "ClinicalTrials.gov";
    default:
      return source
        .toLowerCase()
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
  }
}
