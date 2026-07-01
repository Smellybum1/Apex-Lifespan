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
  claim: {
    applicabilityNotes: string;
    claimText: string;
    clinicalRelevance: string;
    comparator: string;
    confidenceLevel: string;
    doseFormStudied: string;
    durationStudied: string;
    effectSize: string;
    evidenceGrade: string;
    populationStudied: string;
    reviewStatus: string;
    safetyNotes: string;
    whatWouldChangeScore: string;
  };
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
    source: string;
    title: string;
    url: string;
  }>;
  sourcePacket: {
    detail: string;
    evidenceDepthLabels: string[];
    extractedReferences: number;
    label: string;
    missingReferences: number;
    nextStep: string;
    pendingReferences: number;
    studies: Array<{
      adverseEvents: string;
      fundingConflicts: string;
      id: string;
      intervention: string;
      outcomes: string[];
      population: string;
      referenceId: string;
      riskOfBias: string;
      sampleSize: string;
      source: string;
      studyType: Study["studyType"];
      title: string;
      year: number;
    }>;
    totalReferences: number;
  };
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
  repairSummary: ScoreWorklistRepairSummary;
  rows: ScoreWorklistRow[];
  summary: ScoreReadinessSummary;
  totalMatchingRows: number;
}

export interface ScoreWorklistRepairSummary {
  extractionPendingRows: number;
  missingReferenceGroups: ScoreWorklistMissingReferenceGroup[];
  missingSourceRows: number;
  pendingReferenceGroups: ScoreWorklistPendingReferenceGroup[];
  sourceBlockedRows: number;
  unlinkedInterventionGroups: ScoreWorklistUnlinkedInterventionGroup[];
  unlinkedRows: number;
}

export interface ScoreWorklistPendingReferenceGroup {
  claimCount: number;
  interventions: Array<{
    claimCount: number;
    id: string;
    name: string;
    slug: string;
  }>;
  outcomes: string[];
  priority: number;
  reference: {
    id: string;
    label: string;
    source: string;
    title: string;
    url: string;
    year?: number;
  };
  sampleClaims: ScoreWorklistRepairSampleClaim[];
}

export interface ScoreWorklistMissingReferenceGroup {
  claimCount: number;
  outcomes: string[];
  priority: number;
  referenceId: string;
  sampleClaims: ScoreWorklistRepairSampleClaim[];
}

export interface ScoreWorklistUnlinkedInterventionGroup {
  claimCount: number;
  intervention: {
    id: string;
    name: string;
    slug: string;
  } | null;
  outcomes: string[];
  priority: number;
  sampleClaims: ScoreWorklistRepairSampleClaim[];
}

export interface ScoreWorklistRepairSampleClaim {
  claimId: string;
  interventionName: string;
  outcome: string;
  priorityLabel: string;
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
    repairSummary: buildScoreWorklistRepairSummary(matchingRows),
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
        claim: {
          applicabilityNotes: row.claim.applicabilityNotes,
          claimText: row.claim.claimText,
          clinicalRelevance: row.claim.clinicalRelevance,
          comparator: row.claim.comparator,
          confidenceLevel: row.claim.confidenceLevel,
          doseFormStudied: row.claim.doseFormStudied,
          durationStudied: row.claim.durationStudied,
          effectSize: row.claim.effectSize,
          evidenceGrade: row.claim.evidenceGrade,
          populationStudied: row.claim.populationStudied,
          reviewStatus: row.claim.reviewStatus,
          safetyNotes: row.claim.safetyNotes,
          whatWouldChangeScore: row.claim.whatWouldChangeScore
        },
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
          source: reference.source,
          title: reference.title,
          url: reference.url
        })),
        sourcePacket: {
          detail: row.packet.completeness.detail,
          evidenceDepthLabels: row.packet.evidenceDepth.badges.map((badge) => badge.label),
          extractedReferences: row.packet.completeness.extractedReferences,
          label: row.packet.completeness.label,
          missingReferences: row.packet.completeness.missingReferences,
          nextStep: row.packet.completeness.nextStep,
          pendingReferences: row.packet.completeness.pendingReferences,
          studies: studies.map(scoreWorklistStudyExtraction),
          totalReferences: row.packet.completeness.totalReferences
        },
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

export function buildScoreWorklistRepairSummary(
  rows: ScoreReadinessRow[]
): ScoreWorklistRepairSummary {
  const sourceBlockedRows = rows.filter((row) => row.state === "source_blocked");
  const extractionPendingRows = sourceBlockedRows.filter(
    (row) => row.packet.completeness.status === "extraction_pending"
  ).length;
  const missingSourceRows = sourceBlockedRows.filter(
    (row) => row.packet.completeness.status === "missing_sources"
  ).length;
  const unlinkedRows = sourceBlockedRows.filter(
    (row) => row.packet.completeness.status === "not_linked"
  ).length;

  return {
    extractionPendingRows,
    missingReferenceGroups: missingReferenceGroups(sourceBlockedRows),
    missingSourceRows,
    pendingReferenceGroups: pendingReferenceGroups(sourceBlockedRows),
    sourceBlockedRows: sourceBlockedRows.length,
    unlinkedInterventionGroups: unlinkedInterventionGroups(sourceBlockedRows),
    unlinkedRows
  };
}

export function formatScoreWorklistReportLines(report: ScoreWorklistReport) {
  return formatScoreWorklistReportLinesWithOptions(report);
}

export function formatScoreWorklistReportLinesWithOptions(
  report: ScoreWorklistReport,
  options: { detail?: boolean; repairSummary?: boolean; repairSummaryLimit?: number } = {}
) {
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
      ...(options.repairSummary
        ? ["", ...formatScoreWorklistRepairSummaryLines(report.repairSummary, options)]
        : []),
      "No score worklist rows match the current filters."
    ];
  }

  return [
    ...lines,
    ...(options.repairSummary
      ? ["", ...formatScoreWorklistRepairSummaryLines(report.repairSummary, options)]
      : []),
    "",
    ...report.rows.flatMap((row, index) => scoreWorklistRowLines(row, index, options))
  ];
}

export function formatScoreWorklistRepairSummaryLines(
  summary: ScoreWorklistRepairSummary,
  options: { repairSummaryLimit?: number } = {}
) {
  const limit = options.repairSummaryLimit ?? 8;
  const lines = [
    "Source repair summary",
    `Blocked rows: ${summary.sourceBlockedRows}; extraction pending: ${summary.extractionPendingRows}; missing source records: ${summary.missingSourceRows}; unlinked claims: ${summary.unlinkedRows}.`
  ];

  if (summary.sourceBlockedRows === 0) {
    return [...lines, "No source-blocked scoring rows match the current filters."];
  }

  if (summary.pendingReferenceGroups.length > 0) {
    lines.push("Top pending extraction references:");
    lines.push(
      ...summary.pendingReferenceGroups
        .slice(0, limit)
        .flatMap((group, index) => [
          `${index + 1}. ${group.reference.label} - unlocks ${group.claimCount} claim(s) across ${group.interventions.length} intervention(s)`,
          `   ${group.reference.title}`,
          `   Claims: ${formatRepairSampleClaims(group.sampleClaims)}`
        ])
    );
  }

  if (summary.missingReferenceGroups.length > 0) {
    lines.push("Top missing source records:");
    lines.push(
      ...summary.missingReferenceGroups
        .slice(0, limit)
        .flatMap((group, index) => [
          `${index + 1}. ${group.referenceId} - blocks ${group.claimCount} claim(s)`,
          `   Claims: ${formatRepairSampleClaims(group.sampleClaims)}`
        ])
    );
  }

  if (summary.unlinkedInterventionGroups.length > 0) {
    lines.push("Top unlinked claim groups:");
    lines.push(
      ...summary.unlinkedInterventionGroups
        .slice(0, limit)
        .flatMap((group, index) => [
          `${index + 1}. ${group.intervention?.name ?? "Unknown intervention"} - ${group.claimCount} claim(s) need curated references`,
          `   Outcomes: ${group.outcomes.slice(0, 5).join("; ")}`,
          `   Claims: ${formatRepairSampleClaims(group.sampleClaims)}`
        ])
    );
  }

  return lines;
}

function scoreWorklistRowLines(
  row: ScoreWorklistRow,
  index: number,
  options: { detail?: boolean }
) {
  const lines = [
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
  ].filter((line): line is string => Boolean(line));

  if (!options.detail) {
    return lines;
  }

  return [
    ...lines,
    `   Claim: ${row.claim.claimText}`,
    `   Boundary: ${row.claim.populationStudied}; ${row.claim.doseFormStudied}; ${row.claim.durationStudied}; comparator ${row.claim.comparator}.`,
    `   Current evidence text: ${row.claim.effectSize}; ${row.claim.clinicalRelevance}`,
    `   Safety/applicability: ${row.claim.safetyNotes} ${row.claim.applicabilityNotes}`,
    `   Source packet: ${row.sourcePacket.label}; ${row.sourcePacket.extractedReferences}/${row.sourcePacket.totalReferences} reference(s) extracted.`,
    `   Evidence depth: ${
      row.sourcePacket.evidenceDepthLabels.length > 0
        ? row.sourcePacket.evidenceDepthLabels.join("; ")
        : "No substantive extraction depth labels."
    }`,
    ...row.sourcePacket.studies.flatMap((study, studyIndex) => [
      `   Study ${studyIndex + 1}: ${study.studyType} ${study.year} - ${study.title}`,
      `      Population: ${study.population}`,
      `      Intervention: ${study.intervention}`,
      `      Outcomes: ${study.outcomes.join(", ")}`,
      `      Sample/results context: ${study.sampleSize}`,
      `      Safety: ${study.adverseEvents}`,
      `      Funding/conflicts: ${study.fundingConflicts}`,
      `      Bias/quality: ${study.riskOfBias}`
    ]),
    `   What would change score: ${row.claim.whatWouldChangeScore}`
  ];
}

function pendingReferenceGroups(
  rows: ScoreReadinessRow[]
): ScoreWorklistPendingReferenceGroup[] {
  const groups = new Map<
    string,
    {
      reference: Reference;
      rows: ScoreReadinessRow[];
    }
  >();

  for (const row of rows) {
    for (const reference of row.packet.pendingReferences) {
      const group = groups.get(reference.id) ?? {
        reference,
        rows: []
      };

      group.rows.push(row);
      groups.set(reference.id, group);
    }
  }

  return Array.from(groups.values())
    .map(({ reference, rows: groupRows }) => {
      const rowsForGroup = sortRepairRows(dedupeRepairRows(groupRows));

      return {
        claimCount: rowsForGroup.length,
        interventions: repairInterventionGroups(rowsForGroup),
        outcomes: uniqueSorted(rowsForGroup.map((row) => row.claim.outcome)),
        priority: repairPriority(rowsForGroup),
        reference: {
          id: reference.id,
          label: formatReferenceLabel(reference),
          source: reference.source,
          title: reference.title,
          url: reference.url,
          year: reference.year
        },
        sampleClaims: repairSampleClaims(rowsForGroup)
      };
    })
    .sort(compareRepairGroups);
}

function missingReferenceGroups(
  rows: ScoreReadinessRow[]
): ScoreWorklistMissingReferenceGroup[] {
  const groups = new Map<string, ScoreReadinessRow[]>();

  for (const row of rows) {
    for (const referenceId of row.packet.missingReferenceIds) {
      groups.set(referenceId, [...(groups.get(referenceId) ?? []), row]);
    }
  }

  return Array.from(groups.entries())
    .map(([referenceId, groupRows]) => {
      const rowsForGroup = sortRepairRows(dedupeRepairRows(groupRows));

      return {
        claimCount: rowsForGroup.length,
        outcomes: uniqueSorted(rowsForGroup.map((row) => row.claim.outcome)),
        priority: repairPriority(rowsForGroup),
        referenceId,
        sampleClaims: repairSampleClaims(rowsForGroup)
      };
    })
    .sort(compareRepairGroups);
}

function unlinkedInterventionGroups(
  rows: ScoreReadinessRow[]
): ScoreWorklistUnlinkedInterventionGroup[] {
  const groups = new Map<string, ScoreReadinessRow[]>();

  for (const row of rows) {
    if (row.packet.completeness.status !== "not_linked") {
      continue;
    }

    const key = row.intervention?.id ?? "unknown";
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return Array.from(groups.values())
    .map((groupRows) => {
      const rowsForGroup = sortRepairRows(dedupeRepairRows(groupRows));
      const intervention = rowsForGroup[0]?.intervention;

      return {
        claimCount: rowsForGroup.length,
        intervention: intervention
          ? {
              id: intervention.id,
              name: intervention.name,
              slug: intervention.slug
            }
          : null,
        outcomes: uniqueSorted(rowsForGroup.map((row) => row.claim.outcome)),
        priority: repairPriority(rowsForGroup),
        sampleClaims: repairSampleClaims(rowsForGroup)
      };
    })
    .sort(compareRepairGroups);
}

function repairInterventionGroups(rows: ScoreReadinessRow[]) {
  const groups = new Map<
    string,
    {
      claimCount: number;
      id: string;
      name: string;
      slug: string;
    }
  >();

  for (const row of rows) {
    if (!row.intervention) {
      continue;
    }

    const current = groups.get(row.intervention.id) ?? {
      claimCount: 0,
      id: row.intervention.id,
      name: row.intervention.name,
      slug: row.intervention.slug
    };

    current.claimCount += 1;
    groups.set(row.intervention.id, current);
  }

  return Array.from(groups.values()).sort(
    (left, right) => right.claimCount - left.claimCount || left.name.localeCompare(right.name)
  );
}

function repairSampleClaims(rows: ScoreReadinessRow[]): ScoreWorklistRepairSampleClaim[] {
  return rows.slice(0, 4).map((row) => ({
    claimId: row.claim.id,
    interventionName: row.intervention?.name ?? "Unknown intervention",
    outcome: row.claim.outcome,
    priorityLabel: row.priorityLabel
  }));
}

function formatRepairSampleClaims(samples: ScoreWorklistRepairSampleClaim[]) {
  return samples
    .map(
      (sample) =>
        `${sample.interventionName} / ${sample.outcome} (${sample.claimId}, ${sample.priorityLabel})`
    )
    .join("; ");
}

function sortRepairRows(rows: ScoreReadinessRow[]) {
  return [...rows].sort(
    (left, right) =>
      right.priority - left.priority ||
      (left.intervention?.name ?? "").localeCompare(right.intervention?.name ?? "") ||
      left.claim.outcome.localeCompare(right.claim.outcome)
  );
}

function dedupeRepairRows(rows: ScoreReadinessRow[]) {
  return Array.from(new Map(rows.map((row) => [row.claim.id, row])).values());
}

function repairPriority(rows: ScoreReadinessRow[]) {
  return rows.reduce((total, row) => total + row.priority, 0);
}

function compareRepairGroups(
  left:
    | ScoreWorklistPendingReferenceGroup
    | ScoreWorklistMissingReferenceGroup
    | ScoreWorklistUnlinkedInterventionGroup,
  right:
    | ScoreWorklistPendingReferenceGroup
    | ScoreWorklistMissingReferenceGroup
    | ScoreWorklistUnlinkedInterventionGroup
) {
  return right.claimCount - left.claimCount || right.priority - left.priority;
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
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

function scoreWorklistStudyExtraction(study: Study) {
  return {
    adverseEvents: study.adverseEvents,
    fundingConflicts: study.fundingConflicts,
    id: study.id,
    intervention: study.intervention,
    outcomes: study.outcomes,
    population: study.population,
    referenceId: study.referenceId,
    riskOfBias: study.riskOfBias,
    sampleSize: study.sampleSize,
    source: study.source,
    studyType: study.studyType,
    title: study.title,
    year: study.year
  };
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
