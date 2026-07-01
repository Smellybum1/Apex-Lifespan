import type { ScoreReadinessState } from "@/lib/score-readiness";
import { scoreBand } from "@/lib/scoring";
import type { EvidenceLabel } from "@/lib/types";

export interface ScoreBatchSummaryItem {
  compositeScore: number;
  finalLabel: EvidenceLabel;
  state?: ScoreReadinessState;
}

export interface ScoreBatchSummaryCount {
  count: number;
  label: string;
}

export interface ScoreBatchReviewSummary {
  bands: ScoreBatchSummaryCount[];
  defaultScoreReviewRows: number;
  directScoreRows: number;
  guardedLabelDrafts: number;
  labels: ScoreBatchSummaryCount[];
  nextAction: string;
  regulatoryConcernDrafts: number;
  scoreRange: {
    average: number;
    max: number;
    min: number;
  } | null;
  scoredRows: number;
  snapshotGapRows: number;
  sourceBlockedRows: number;
  totalRows: number;
  unclassifiedRows: number;
}

const GUARDED_LABELS = new Set<EvidenceLabel>([
  "Avoid / Not Recommended",
  "Regulatory Concern",
  "Requires Clinician Oversight",
  "Safety Concern"
]);

const DIRECT_SCORE_STATES = new Set<ScoreReadinessState>([
  "default_score_review",
  "ready_to_score"
]);

const BAND_ORDER = ["Strong", "Moderate", "Limited", "Weak"];

export function buildScoreBatchReviewSummary(
  items: ScoreBatchSummaryItem[]
): ScoreBatchReviewSummary {
  const labels = countBy(items.map((item) => item.finalLabel));
  const bands = countBy(
    items.map((item) => scoreBand(item.compositeScore)),
    (left, right) => BAND_ORDER.indexOf(left.label) - BAND_ORDER.indexOf(right.label)
  );
  const defaultScoreReviewRows = items.filter(
    (item) => item.state === "default_score_review"
  ).length;
  const sourceBlockedRows = items.filter((item) => item.state === "source_blocked").length;
  const snapshotGapRows = items.filter((item) => item.state === "snapshot_gap").length;
  const scoredRows = items.filter((item) => item.state === "scored").length;
  const unclassifiedRows = items.filter((item) => item.state === undefined).length;
  const directScoreRows = items.filter(
    (item) => item.state !== undefined && DIRECT_SCORE_STATES.has(item.state)
  ).length;
  const scores = items.map((item) => item.compositeScore);
  const regulatoryConcernDrafts = items.filter(
    (item) => item.finalLabel === "Regulatory Concern"
  ).length;
  const guardedLabelDrafts = items.filter((item) => GUARDED_LABELS.has(item.finalLabel)).length;

  return {
    bands,
    defaultScoreReviewRows,
    directScoreRows,
    guardedLabelDrafts,
    labels,
    nextAction: scoreBatchNextAction({
      directScoreRows,
      guardedLabelDrafts,
      regulatoryConcernDrafts,
      sourceBlockedRows,
      totalRows: items.length
    }),
    regulatoryConcernDrafts,
    scoreRange:
      scores.length > 0
        ? {
            average: roundOne(scores.reduce((total, score) => total + score, 0) / scores.length),
            max: Math.max(...scores),
            min: Math.min(...scores)
          }
        : null,
    scoredRows,
    snapshotGapRows,
    sourceBlockedRows,
    totalRows: items.length,
    unclassifiedRows
  };
}

export function formatScoreBatchReviewSummaryLines(summary: ScoreBatchReviewSummary) {
  return [
    "Batch review summary",
    `Direct score rows: ${summary.directScoreRows}` +
      (summary.defaultScoreReviewRows > 0
        ? ` (${summary.defaultScoreReviewRows} starter-score review)`
        : ""),
    `Source-blocked rows: ${summary.sourceBlockedRows}; snapshot gaps: ${summary.snapshotGapRows}; already scored: ${summary.scoredRows}.`,
    `Suggested labels: ${formatCounts(summary.labels)}`,
    `Score bands: ${formatCounts(summary.bands)}`,
    `Guardrail label drafts: ${summary.guardedLabelDrafts}` +
      (summary.regulatoryConcernDrafts > 0
        ? ` (${summary.regulatoryConcernDrafts} regulatory concern)`
        : ""),
    summary.scoreRange
      ? `Suggested score range: ${summary.scoreRange.min.toFixed(1)}-${summary.scoreRange.max.toFixed(1)}, average ${summary.scoreRange.average.toFixed(1)}.`
      : "Suggested score range: no rows.",
    `Next: ${summary.nextAction}`
  ];
}

export function formatScoreBatchSummaryCounts(counts: ScoreBatchSummaryCount[]) {
  return formatCounts(counts);
}

function countBy(
  values: string[],
  compare: (left: ScoreBatchSummaryCount, right: ScoreBatchSummaryCount) => number = compareCounts
) {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ count, label }))
    .sort(compare);
}

function compareCounts(left: ScoreBatchSummaryCount, right: ScoreBatchSummaryCount) {
  return right.count - left.count || left.label.localeCompare(right.label);
}

function formatCounts(counts: ScoreBatchSummaryCount[]) {
  return counts.length > 0
    ? counts.map((item) => `${item.label} ${item.count}`).join("; ")
    : "none";
}

function scoreBatchNextAction({
  directScoreRows,
  guardedLabelDrafts,
  regulatoryConcernDrafts,
  sourceBlockedRows,
  totalRows
}: {
  directScoreRows: number;
  guardedLabelDrafts: number;
  regulatoryConcernDrafts: number;
  sourceBlockedRows: number;
  totalRows: number;
}) {
  if (totalRows === 0) {
    return "No score rows are loaded for this batch.";
  }

  if (directScoreRows === 0 && sourceBlockedRows > 0) {
    return "Complete source extraction or source linking before treating these rows as scoreable.";
  }

  if (regulatoryConcernDrafts > 0) {
    return "Review regulatory/product-status caveats first and keep them separate from generic intervention evidence.";
  }

  if (guardedLabelDrafts > 0) {
    return "Review safety, clinician-oversight, or avoid labels before positive-benefit labels.";
  }

  return "Review citations and source extraction, then dry-run before applying any score update.";
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}
