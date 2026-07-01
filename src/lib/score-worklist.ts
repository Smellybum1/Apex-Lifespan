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

export interface ScoreWorklistReferenceRepairBrief {
  affectedClaims: ScoreWorklistReferenceRepairClaim[];
  extractionChecklist: string[];
  hiddenClaims: number;
  reference: {
    id: string;
    label: string;
    source: string;
    title: string;
    url: string;
    year?: number;
  } | null;
  referenceId: string;
  sourceTypeHint: string;
  statusCounts: {
    extractionPending: number;
    missingSources: number;
    notLinked: number;
  };
  studies: Array<{
    adverseEvents: string;
    fundingConflicts: string;
    id: string;
    intervention: string;
    outcomes: string[];
    population: string;
    riskOfBias: string;
    sampleSize: string;
    source: string;
    studyType: Study["studyType"];
    title: string;
    year: number;
  }>;
  totalAffectedClaims: number;
  writeGuardrails: string[];
}

export interface ScoreWorklistReferenceRepairClaim {
  claimId: string;
  claimText: string;
  currentScoreLabel: string;
  intervention: {
    id: string;
    name: string;
    slug: string;
  } | null;
  nextAction: string;
  outcome: string;
  priorityLabel: string;
  sourcePacketLabel: string;
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

export function buildScoreWorklistReferenceRepairBrief(
  data: EvidenceDashboardData,
  referenceId: string,
  options: { limit?: number } = {}
): ScoreWorklistReferenceRepairBrief {
  const normalizedReferenceId = referenceId.trim();

  if (!normalizedReferenceId) {
    throw new Error("Reference id is required for source repair brief.");
  }

  const reference = data.references.find((item) => item.id === normalizedReferenceId) ?? null;
  const affectedRows = sortRepairRows(
    buildScoreReadinessRows(data).filter(
      (row) =>
        row.state === "source_blocked" &&
        row.claim.keyReferenceIds.includes(normalizedReferenceId)
    )
  );
  const limit = options.limit ?? DEFAULT_LIMIT;
  const studies = data.studies
    .filter((study) => study.referenceId === normalizedReferenceId)
    .sort((left, right) => right.year - left.year || left.title.localeCompare(right.title));

  return {
    affectedClaims: affectedRows.slice(0, limit).map(referenceRepairClaim),
    extractionChecklist: REFERENCE_REPAIR_EXTRACTION_CHECKLIST,
    hiddenClaims: Math.max(affectedRows.length - limit, 0),
    reference: reference
      ? {
          id: reference.id,
          label: formatReferenceLabel(reference),
          source: reference.source,
          title: reference.title,
          url: reference.url,
          year: reference.year
        }
      : null,
    referenceId: normalizedReferenceId,
    sourceTypeHint: sourceTypeHintFromReference(reference),
    statusCounts: {
      extractionPending: affectedRows.filter(
        (row) => row.packet.completeness.status === "extraction_pending"
      ).length,
      missingSources: affectedRows.filter(
        (row) => row.packet.completeness.status === "missing_sources"
      ).length,
      notLinked: affectedRows.filter((row) => row.packet.completeness.status === "not_linked")
        .length
    },
    studies: studies.map(scoreWorklistStudyExtraction),
    totalAffectedClaims: affectedRows.length,
    writeGuardrails: REFERENCE_REPAIR_WRITE_GUARDRAILS
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
          `   Reference id: ${group.reference.id}`,
          `   ${group.reference.title}`,
          `   Brief: npx tsx scripts/local-score-worklist.ts --repair-reference ${group.reference.id}`,
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

export function formatScoreWorklistReferenceRepairBriefLines(
  brief: ScoreWorklistReferenceRepairBrief
) {
  const lines = [
    "Read-only score source repair brief",
    `Reference id: ${brief.referenceId}`,
    brief.reference
      ? `Reference: ${brief.reference.label} - ${brief.reference.title}`
      : "Reference: missing from curated source records",
    brief.reference ? `URL: ${brief.reference.url}` : undefined,
    `Source type hint: ${brief.sourceTypeHint}`,
    `Affected source-blocked claim cells: ${brief.totalAffectedClaims}` +
      (brief.hiddenClaims > 0 ? ` (${brief.hiddenClaims} hidden by limit)` : ""),
    `Status: extraction pending ${brief.statusCounts.extractionPending}; missing source records ${brief.statusCounts.missingSources}; unlinked ${brief.statusCounts.notLinked}.`
  ].filter((line): line is string => Boolean(line));

  if (brief.affectedClaims.length > 0) {
    lines.push("Affected claims:");
    lines.push(
      ...brief.affectedClaims.flatMap((claim, index) => [
        `${index + 1}. ${claim.intervention?.name ?? "Unknown intervention"} / ${claim.outcome} (${claim.claimId})`,
        `   ${claim.priorityLabel} priority / ${claim.currentScoreLabel} / ${claim.sourcePacketLabel}`,
        `   Claim: ${claim.claimText}`,
        `   Next: ${claim.nextAction}`
      ])
    );
  } else {
    lines.push("No source-blocked scoring rows currently depend on this reference.");
  }

  if (brief.studies.length > 0) {
    lines.push("Existing study rows for this reference:");
    lines.push(
      ...brief.studies.slice(0, 4).flatMap((study, index) => [
        `${index + 1}. ${study.studyType} ${study.year} - ${study.title}`,
        `   Population: ${study.population}`,
        `   Intervention: ${study.intervention}`,
        `   Outcomes: ${study.outcomes.join(", ")}`,
        `   Sample/results: ${study.sampleSize}`,
        `   Safety: ${study.adverseEvents}`,
        `   Funding/conflicts: ${study.fundingConflicts}`,
        `   Bias/quality: ${study.riskOfBias}`
      ])
    );

    if (brief.studies.length > 4) {
      lines.push(`${brief.studies.length - 4} more study row(s) hidden by display limit.`);
    }
  } else {
    lines.push("Existing study rows for this reference: none.");
  }

  lines.push("Extraction checklist:");
  lines.push(...brief.extractionChecklist.map((item) => `- ${item}`));
  lines.push("Write guardrails:");
  lines.push(...brief.writeGuardrails.map((item) => `- ${item}`));

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

const REFERENCE_REPAIR_EXTRACTION_CHECKLIST = [
  "Confirm source type from the source itself, not only the title.",
  "Extract analyzed sample size or registry enrollment/result status.",
  "Extract population, inclusion context, and whether it matches the scoped claim.",
  "Extract intervention form, dose/exposure context, comparator, and duration when available.",
  "Extract claim-relevant outcomes and main result direction without overclaiming.",
  "Extract adverse events/tolerability and note when safety is not assessed.",
  "Extract funding/conflicts and practical risk-of-bias or evidence-quality limits.",
  "Keep product-level AU/TGA clearance separate from generic intervention evidence."
];

const REFERENCE_REPAIR_WRITE_GUARDRAILS = [
  "This brief is read-only and does not write study rows, source packets, scores, or public evidence.",
  "Write extraction only after reviewing the source packet or accepted candidate details.",
  "Do not mark Human reviewed unless a human explicitly confirms it.",
  "Do not turn peptide or regulatory sources into sourcing, dosing, compounding, injection, cycling, or self-administration guidance."
];

function referenceRepairClaim(row: ScoreReadinessRow): ScoreWorklistReferenceRepairClaim {
  return {
    claimId: row.claim.id,
    claimText: row.claim.claimText,
    currentScoreLabel:
      row.currentScore === null
        ? "No final score"
        : `${row.currentScore.toFixed(1)} ${scoreBand(row.currentScore)}`,
    intervention: row.intervention
      ? {
          id: row.intervention.id,
          name: row.intervention.name,
          slug: row.intervention.slug
        }
      : null,
    nextAction: scoreReadinessNextAction(row),
    outcome: row.claim.outcome,
    priorityLabel: row.priorityLabel,
    sourcePacketLabel: row.packet.completeness.label
  };
}

function sourceTypeHintFromReference(reference: Reference | null) {
  if (!reference) {
    return "unknown; restore the missing curated source record first";
  }

  const title = reference.title.toLowerCase();

  if (title.includes("meta-analysis") || title.includes("meta analysis")) {
    return "meta-analysis or systematic review; verify exact source type";
  }

  if (title.includes("systematic review")) {
    return "systematic review; verify whether a meta-analysis is included";
  }

  if (title.includes("randomized") || title.includes("randomised")) {
    return "randomized controlled trial; verify trial design and result status";
  }

  if (reference.source.toLowerCase().includes("clinicaltrials")) {
    return "clinical trial record; verify whether results are posted";
  }

  if (title.includes("regulatory") || title.includes("warning") || title.includes("safety")) {
    return "regulatory or safety source; do not treat as benefit evidence";
  }

  if (title.includes("review")) {
    return "review source; verify whether narrative, systematic, guideline, or position stand";
  }

  return "unknown; verify source type before writing extraction";
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
