import {
  buildScoreReadinessRows,
  buildScoreReadinessSummary,
  compareScoreReadinessForScoringPass,
  formatScoreReadinessSummaryLines,
  scoreReadinessNextAction,
  scoreReadinessStateLabel,
  type ScoreReadinessRow,
  type ScoreReadinessState,
  type ScoreReadinessSummary
} from "@/lib/score-readiness";
import { buildClaimScoreSuggestion, type ClaimScoreSuggestion } from "@/lib/score-suggestions";
import { compositeScore, scoreBand } from "@/lib/scoring";
import type { EvidenceDashboardData, NormalizedSourcePacketRow, Reference, Study } from "@/lib/types";

export type ScoreWorklistStateFilter = ScoreReadinessState | "all" | "work";

export type ScoreWorklistDisposition =
  | "capture-snapshot"
  | "scored"
  | "score-now"
  | "source-blocked";

export interface BuildScoreWorklistOptions {
  includeScored?: boolean;
  intervention?: string;
  limit?: number;
  state?: ScoreWorklistStateFilter;
}

export interface ScoreWorklistRow {
  claimId: string;
  currentScore: number | null;
  currentScoreLabel: string;
  disposition: ScoreWorklistDisposition;
  intervention: {
    id: string;
    name: string;
    slug: string;
  } | null;
  nextAction: string;
  operatorHint: string;
  outcome: string;
  priority: number;
  priorityLabel: string;
  reasons: string[];
  references: Array<{
    id: string;
    label: string;
    title: string;
  }>;
  sourcePacketStatus: string;
  state: ScoreReadinessState;
  stateLabel: string;
  suggestion: ClaimScoreSuggestion & {
    compositeScore: number;
    compositeScoreLabel: string;
  };
}

export interface ScoreWorklistReport {
  appliedFilters: {
    includeScored: boolean;
    intervention?: string;
    limit: number;
    state: ScoreWorklistStateFilter;
  };
  hiddenRows: number;
  rows: ScoreWorklistRow[];
  summary: ScoreReadinessSummary;
  totalMatchingRows: number;
}

const DEFAULT_LIMIT = 12;

export function buildScoreWorklistReport(
  data: EvidenceDashboardData,
  options: BuildScoreWorklistOptions = {}
): ScoreWorklistReport {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const includeScored = options.includeScored ?? options.state === "all";
  const state = options.state ?? "work";
  const readinessRows = buildScoreReadinessRows(data);
  const summary = buildScoreReadinessSummary(readinessRows);
  const referenceById = new Map(data.references.map((reference) => [reference.id, reference]));
  const studiesByReferenceId = groupStudiesByReferenceId(data.studies);
  const sourcePacketByClaimId = new Map(
    (data.normalizedSourcePackets ?? [])
      .filter((packet) => packet.current)
      .map((packet) => [packet.claimId, packet])
  );
  const matchingRows = readinessRows
    .filter((row) => (includeScored ? true : row.state !== "scored"))
    .filter((row) => matchesStateFilter(row, state))
    .filter((row) => matchesInterventionFilter(row, options.intervention))
    .sort(compareScoreReadinessForScoringPass);

  return {
    appliedFilters: {
      includeScored,
      intervention: options.intervention,
      limit,
      state
    },
    hiddenRows: Math.max(matchingRows.length - limit, 0),
    rows: matchingRows.slice(0, limit).map((row) => {
      const references = row.claim.keyReferenceIds
        .map((referenceId) => referenceById.get(referenceId))
        .filter((reference): reference is Reference => Boolean(reference));
      const studies = references.flatMap(
        (reference) => studiesByReferenceId.get(reference.id) ?? []
      );
      const sourcePacket = sourcePacketFromReadinessRow(
        row,
        sourcePacketByClaimId.get(row.claim.id)
      );
      const suggestion = buildClaimScoreSuggestion({
        claim: row.claim,
        references,
        sourcePacket,
        studies
      });
      const suggestedComposite = compositeScore(suggestion.scores);

      return {
        claimId: row.claim.id,
        currentScore: row.currentScore,
        currentScoreLabel:
          row.currentScore === null
            ? "No final score"
            : `${row.currentScore.toFixed(1)} ${scoreBand(row.currentScore)}`,
        disposition: dispositionForReadinessState(row.state),
        intervention: row.intervention
          ? {
              id: row.intervention.id,
              name: row.intervention.name,
              slug: row.intervention.slug
            }
          : null,
        nextAction: scoreReadinessNextAction(row),
        operatorHint:
          "Open /operator > Score tools, review linked citations, then dry-run before applying any score update.",
        outcome: row.claim.outcome,
        priority: row.priority,
        priorityLabel: row.priorityLabel,
        reasons: row.reasons,
        references: references.map((reference) => ({
          id: reference.id,
          label: formatReferenceLabel(reference),
          title: reference.title
        })),
        sourcePacketStatus: row.packet.completeness.status,
        state: row.state,
        stateLabel: scoreReadinessStateLabel(row.state),
        suggestion: {
          ...suggestion,
          compositeScore: suggestedComposite,
          compositeScoreLabel: `${suggestedComposite.toFixed(1)} ${scoreBand(suggestedComposite)}`
        }
      };
    }),
    summary,
    totalMatchingRows: matchingRows.length
  };
}

export function formatScoreWorklistReportLines(report: ScoreWorklistReport) {
  const lines = [
    "Read-only local score worklist",
    ...formatScoreReadinessSummaryLines(report.summary),
    `Rows: ${report.rows.length}/${report.totalMatchingRows} shown` +
      (report.hiddenRows > 0 ? ` (${report.hiddenRows} hidden by limit)` : ""),
    "Order: score-review and ready-to-score rows first, then audit gaps, then source-blocked extraction."
  ];

  if (report.rows.length === 0) {
    return [
      ...lines,
      "No score worklist rows match the current filters."
    ];
  }

  return [
    ...lines,
    "",
    ...report.rows.flatMap((row, index) => [
      `${index + 1}. ${row.intervention?.name ?? "Unknown intervention"} / ${row.outcome}`,
      `   ${row.stateLabel} / ${row.priorityLabel} priority / ${row.currentScoreLabel}`,
      `   Suggested: ${row.suggestion.compositeScoreLabel}; ${row.suggestion.finalLabel}`,
      `   Action: ${row.nextAction}`,
      `   Reasons: ${row.reasons.slice(0, 4).join("; ")}`,
      `   Citations: ${
        row.references.length > 0
          ? row.references.slice(0, 3).map((reference) => reference.label).join("; ")
          : "none linked"
      }`,
      row.suggestion.warning ? `   Warning: ${row.suggestion.warning}` : undefined,
      `   Operator: ${row.operatorHint}`
    ].filter((line): line is string => Boolean(line)))
  ];
}

function groupStudiesByReferenceId(studies: Study[]) {
  const grouped = new Map<string, Study[]>();

  for (const study of studies) {
    const current = grouped.get(study.referenceId) ?? [];
    current.push(study);
    grouped.set(study.referenceId, current);
  }

  return grouped;
}

function sourcePacketFromReadinessRow(
  row: ScoreReadinessRow,
  normalizedPacket?: NormalizedSourcePacketRow
): NormalizedSourcePacketRow {
  return {
    claimId: row.claim.id,
    current: true,
    referenceIds: row.claim.keyReferenceIds,
    reviewStatus: row.claim.reviewStatus,
    sourcePacketId: normalizedPacket?.sourcePacketId ?? `derived-${row.claim.id}`,
    status: row.packet.completeness.status
  };
}

function matchesStateFilter(row: ScoreReadinessRow, state: ScoreWorklistStateFilter) {
  if (state === "all") {
    return true;
  }

  if (state === "work") {
    return row.state !== "scored";
  }

  return row.state === state;
}

function matchesInterventionFilter(row: ScoreReadinessRow, intervention: string | undefined) {
  if (!intervention) {
    return true;
  }

  const normalized = intervention.toLowerCase();
  return (
    row.intervention?.id.toLowerCase() === normalized ||
    row.intervention?.slug.toLowerCase() === normalized ||
    row.intervention?.name.toLowerCase().includes(normalized)
  );
}

function dispositionForReadinessState(state: ScoreReadinessState): ScoreWorklistDisposition {
  switch (state) {
    case "default_score_review":
    case "ready_to_score":
      return "score-now";
    case "snapshot_gap":
      return "capture-snapshot";
    case "source_blocked":
      return "source-blocked";
    case "scored":
      return "scored";
  }
}

function formatReferenceLabel(reference: Reference) {
  return [
    reference.source,
    reference.identifier,
    reference.year ? `${reference.year}` : undefined
  ]
    .filter(Boolean)
    .join(" ");
}
