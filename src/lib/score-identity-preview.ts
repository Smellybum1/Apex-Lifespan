import {
  previewLocalIdentityResolutionActionsForCandidates,
  type LocalIdentityResolutionAutomationDecisionReadout
} from "@/lib/data/local-ingestion-control";
import { prisma } from "@/lib/db/prisma";
import type { ScoreWorklistRepairSummary } from "@/lib/score-worklist";

const CANDIDATE_KEY_B64_PREFIX = "candidate-key-b64:";

export const DEFAULT_SCORE_IDENTITY_WARNING_ACTION_PREVIEW_LIMIT = 8;

export type ScoreIdentityResolutionAction =
  LocalIdentityResolutionAutomationDecisionReadout["action"];
export type ScoreIdentityActionFilter =
  | ScoreIdentityResolutionAction
  | "actionable"
  | "all"
  | "unavailable";

type ScoreIdentityPreviewCandidateRow = {
  action: ScoreIdentityResolutionAction | "unavailable";
  candidate: {
    acceptedReferenceId: string | null;
    claimId: string | null;
    dedupeKey: string;
    externalId: string;
    interventionId: string | null;
    source: string;
    title: string;
    triageScore: number;
  };
  decision: LocalIdentityResolutionAutomationDecisionReadout | undefined;
};

export type ScoreIdentityActionCounts = Record<ScoreIdentityResolutionAction | "unavailable", number>;

export type ScoreIdentityWarningActionPreviewRow = {
  acceptedReferenceId: string | null;
  action: ScoreIdentityResolutionAction | "unavailable";
  actionLabel: string;
  claimId: string | null;
  dedupeKey: string;
  draftCommand: string;
  externalId: string;
  interventionId: string | null;
  matchedInterventionId?: string;
  matchedInterventionName?: string;
  reasons: string[];
  source: string;
  sourceLabel: string;
  title: string;
  triageScore: number;
};

export type ScoreIdentityWarningActionPreview = {
  acceptedCandidates: number;
  actionCounts: ScoreIdentityActionCounts;
  actionFilter: ScoreIdentityActionFilter;
  actionFilterLabel: string;
  hiddenByActionFilter: number;
  rawMatches: number;
  referenceLimit: number;
  rows: ScoreIdentityWarningActionPreviewRow[];
  scannedWarningReferences: number;
  totalWarningReferences: number;
  uniqueMatches: number;
};

export async function buildScoreIdentityWarningActionPreview(
  summary: ScoreWorklistRepairSummary,
  {
    actionFilter,
    referenceLimit
  }: {
    actionFilter: ScoreIdentityActionFilter;
    referenceLimit: number;
  }
): Promise<ScoreIdentityWarningActionPreview> {
  const warningReferenceIds = summary.pendingReferenceGroups
    .filter((group) => group.identityWarnings.length > 0)
    .map((group) => group.reference.id);
  const referenceIds = warningReferenceIds.slice(0, referenceLimit);

  if (referenceIds.length === 0) {
    return emptyScoreIdentityWarningActionPreview({
      actionFilter,
      referenceLimit,
      scannedWarningReferences: 0,
      totalWarningReferences: warningReferenceIds.length
    });
  }

  const candidates = await prisma.sourceCandidate.findMany({
    orderBy: [{ triageScore: "desc" }, { updatedAt: "desc" }],
    select: {
      acceptedReferenceId: true,
      claimId: true,
      dedupeKey: true,
      externalId: true,
      interventionId: true,
      source: true,
      title: true,
      triageScore: true
    },
    where: {
      acceptedReferenceId: {
        in: referenceIds
      },
      decision: "ACCEPTED"
    }
  });

  if (candidates.length === 0) {
    return emptyScoreIdentityWarningActionPreview({
      actionFilter,
      referenceLimit,
      scannedWarningReferences: referenceIds.length,
      totalWarningReferences: warningReferenceIds.length
    });
  }

  const identityDecisions = await sourceLedIdentityDecisionByCandidateKey(
    candidates.map((candidate) => candidate.dedupeKey)
  );
  const actionCounts = scoreIdentityActionCounts(candidates, identityDecisions);
  const previewRows: ScoreIdentityPreviewCandidateRow[] = candidates.map((candidate) => ({
    action: identityDecisions.get(candidate.dedupeKey)?.action ?? "unavailable",
    candidate,
    decision: identityDecisions.get(candidate.dedupeKey)
  }));
  const filteredRows = previewRows.filter((row) =>
    scoreIdentityActionMatchesFilter(row.action, actionFilter)
  );
  const displayRows = dedupeScoreIdentityPreviewRows(filteredRows);

  return {
    acceptedCandidates: candidates.length,
    actionCounts,
    actionFilter,
    actionFilterLabel: formatScoreIdentityActionFilterLabel(actionFilter),
    hiddenByActionFilter: previewRows.length - filteredRows.length,
    rawMatches: filteredRows.length,
    referenceLimit,
    rows: displayRows.map(scoreIdentityWarningActionPreviewRow),
    scannedWarningReferences: referenceIds.length,
    totalWarningReferences: warningReferenceIds.length,
    uniqueMatches: displayRows.length
  };
}

export function formatScoreIdentityWarningActionPreviewLines(
  preview: ScoreIdentityWarningActionPreview | undefined
) {
  const lines = [
    preview
      ? `Identity action preview (source-led, read-only; scanned ${preview.scannedWarningReferences}/${preview.totalWarningReferences} warning reference(s)):`
      : "Identity action preview (source-led, read-only):"
  ];

  if (!preview || preview.scannedWarningReferences === 0) {
    return [...lines, "No identity-warning references are visible in the current repair summary."];
  }

  if (preview.acceptedCandidates === 0) {
    return [
      ...lines,
      `${preview.scannedWarningReferences} scanned identity-warning reference(s) have no accepted source candidates attached.`
    ];
  }

  lines.push(
    `${preview.acceptedCandidates} accepted candidate(s) across ${preview.scannedWarningReferences} warning reference(s): ${formatScoreIdentityActionCounts(preview.actionCounts)}.`
  );
  if (preview.actionFilter !== "all") {
    lines.push(
      `Showing ${preview.uniqueMatches} unique candidate cleanup row(s) matching ${preview.actionFilterLabel}; ${preview.rawMatches} raw match(es), ${preview.hiddenByActionFilter} hidden by action filter.`
    );
  }
  lines.push(
    "Open a repair brief for candidate-level reasons; use the Candidate Review identity resolver to apply any cleanup."
  );

  if (preview.rows.length === 0) {
    return [
      ...lines,
      `No accepted candidate rows matched ${preview.actionFilterLabel} in the visible warning references.`
    ];
  }

  lines.push(...preview.rows.map(formatScoreIdentityWarningActionPreviewRow));

  return lines;
}

export function formatScoreIdentityActionCounts(counts: ScoreIdentityActionCounts) {
  return [
    `${counts["confirm-target"]} confirm`,
    `${counts["reassign-intervention"]} reassign`,
    `${counts["reject-wrong-supplement"]} reject`,
    `${counts.hold} hold`,
    `${counts.unavailable} unavailable`
  ].join(", ");
}

export function formatScoreIdentityActionFilterLabel(actionFilter: ScoreIdentityActionFilter) {
  switch (actionFilter) {
    case "actionable":
      return "actionable cleanup";
    case "all":
      return "all actions";
    case "confirm-target":
      return "confirm-target";
    case "reassign-intervention":
      return "reassign-intervention";
    case "reject-wrong-supplement":
      return "reject-wrong-supplement";
    case "hold":
      return "hold";
    case "unavailable":
      return "unavailable";
  }
}

function emptyScoreIdentityWarningActionPreview({
  actionFilter,
  referenceLimit,
  scannedWarningReferences,
  totalWarningReferences
}: {
  actionFilter: ScoreIdentityActionFilter;
  referenceLimit: number;
  scannedWarningReferences: number;
  totalWarningReferences: number;
}): ScoreIdentityWarningActionPreview {
  return {
    acceptedCandidates: 0,
    actionCounts: emptyScoreIdentityActionCounts(),
    actionFilter,
    actionFilterLabel: formatScoreIdentityActionFilterLabel(actionFilter),
    hiddenByActionFilter: 0,
    rawMatches: 0,
    referenceLimit,
    rows: [],
    scannedWarningReferences,
    totalWarningReferences,
    uniqueMatches: 0
  };
}

function scoreIdentityWarningActionPreviewRow({
  action,
  candidate,
  decision
}: ScoreIdentityPreviewCandidateRow): ScoreIdentityWarningActionPreviewRow {
  return {
    acceptedReferenceId: candidate.acceptedReferenceId,
    action,
    actionLabel: scoreIdentityActionLabel(decision),
    claimId: candidate.claimId,
    dedupeKey: safeScoreCandidateKey(candidate.dedupeKey),
    draftCommand: `npm run ingest:sources -- --candidate-curation-draft ${safeScoreCandidateKey(candidate.dedupeKey)}`,
    externalId: candidate.externalId,
    interventionId: candidate.interventionId,
    matchedInterventionId: decision?.matchedInterventionId,
    matchedInterventionName: decision?.matchedInterventionName,
    reasons: decision?.reasons ?? [],
    source: candidate.source,
    sourceLabel: scoreSourceKindLabel(candidate.source),
    title: candidate.title,
    triageScore: candidate.triageScore
  };
}

function formatScoreIdentityWarningActionPreviewRow(row: ScoreIdentityWarningActionPreviewRow) {
  const context = [
    row.interventionId ? `intervention ${row.interventionId}` : undefined,
    row.claimId ? `claim ${row.claimId}` : undefined
  ]
    .filter(Boolean)
    .join("; ");

  return [
    `- ${row.acceptedReferenceId}: ${row.sourceLabel} ${row.externalId}`,
    context ? ` (${context})` : "",
    ` - ${row.actionLabel}`
  ].join("");
}

function dedupeScoreIdentityPreviewRows(rows: ScoreIdentityPreviewCandidateRow[]) {
  const rowsByKey = new Map<string, ScoreIdentityPreviewCandidateRow>();

  for (const row of rows) {
    const key = [
      row.candidate.acceptedReferenceId,
      row.candidate.source,
      row.candidate.externalId,
      row.candidate.interventionId,
      row.candidate.claimId,
      row.action,
      row.decision?.matchedInterventionId ?? ""
    ].join("|");

    const existing = rowsByKey.get(key);

    if (!existing || row.candidate.triageScore > existing.candidate.triageScore) {
      rowsByKey.set(key, row);
    }
  }

  return Array.from(rowsByKey.values()).sort(
    (left, right) =>
      right.candidate.triageScore - left.candidate.triageScore ||
      (left.candidate.acceptedReferenceId ?? "").localeCompare(
        right.candidate.acceptedReferenceId ?? ""
      )
  );
}

function scoreIdentityActionMatchesFilter(
  action: ScoreIdentityResolutionAction | "unavailable",
  actionFilter: ScoreIdentityActionFilter
) {
  if (actionFilter === "all") {
    return true;
  }

  if (actionFilter === "actionable") {
    return (
      action === "confirm-target" ||
      action === "reassign-intervention" ||
      action === "reject-wrong-supplement"
    );
  }

  return action === actionFilter;
}

function scoreIdentityActionCounts(
  candidates: Array<{ dedupeKey: string }>,
  identityDecisions: Map<string, LocalIdentityResolutionAutomationDecisionReadout>
) {
  return candidates.reduce(
    (counts, candidate) => {
      const action = identityDecisions.get(candidate.dedupeKey)?.action ?? "unavailable";

      counts[action] += 1;
      return counts;
    },
    emptyScoreIdentityActionCounts()
  );
}

function emptyScoreIdentityActionCounts(): ScoreIdentityActionCounts {
  return {
    "confirm-target": 0,
    "reassign-intervention": 0,
    "reject-wrong-supplement": 0,
    hold: 0,
    unavailable: 0
  };
}

function scoreIdentityActionLabel(
  decision: LocalIdentityResolutionAutomationDecisionReadout | undefined
) {
  if (!decision) {
    return "identity preview unavailable";
  }

  if (decision.action === "reassign-intervention") {
    return `would reassign to ${decision.matchedInterventionName ?? decision.matchedInterventionId ?? "matched intervention"}`;
  }

  return `would ${decision.action.replaceAll("-", " ")}`;
}

async function sourceLedIdentityDecisionByCandidateKey(dedupeKeys: string[]) {
  const decisions = await previewLocalIdentityResolutionActionsForCandidates({
    dedupeKeys,
    strategy: "source-led"
  });

  return new Map(decisions.map((decision) => [decision.dedupeKey, decision]));
}

function safeScoreCandidateKey(dedupeKey: string) {
  return `${CANDIDATE_KEY_B64_PREFIX}${Buffer.from(dedupeKey, "utf8").toString("base64url")}`;
}

function scoreSourceKindLabel(source: string) {
  switch (source) {
    case "PUBMED":
      return "PubMed";
    case "CLINICALTRIALS_GOV":
      return "ClinicalTrials.gov";
    default:
      return source
        .toLowerCase()
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
  }
}
