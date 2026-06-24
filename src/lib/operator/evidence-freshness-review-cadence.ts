export type EvidenceFreshnessCategory =
  | "source-gap"
  | "candidate-review"
  | "review-packet"
  | "extraction-gap"
  | "publication-blocker";

export type EvidenceFreshnessCadenceStatus = "stale" | "due" | "watch" | "ready";

export interface EvidenceFreshnessInputRow {
  id: string;
  label: string;
  claimId?: string;
  interventionId?: string;
  interventionName?: string;
  ageDays?: number;
  staleAfterDays?: number;
  priority: number;
  blockers?: string[];
  nextChecks?: string[];
}

export interface EvidenceFreshnessReviewCadenceInput {
  sourceGaps?: EvidenceFreshnessInputRow[];
  candidateRows?: EvidenceFreshnessInputRow[];
  reviewPacketRows?: EvidenceFreshnessInputRow[];
  extractionGapRows?: EvidenceFreshnessInputRow[];
  publicationBlockerRows?: EvidenceFreshnessInputRow[];
  maxScheduleRows?: number;
}

export interface EvidenceFreshnessReviewScheduleRow {
  id: string;
  category: EvidenceFreshnessCategory;
  label: string;
  claimId: string | null;
  interventionId: string | null;
  interventionName: string | null;
  ageDays: number | null;
  staleAfterDays: number | null;
  priority: number;
  cadenceStatus: EvidenceFreshnessCadenceStatus;
  blockers: string[];
  nextChecks: string[];
  rollbackNotes: string[];
  verificationNotes: string[];
  boundaryNotes: string;
  writes: "none";
}

export interface EvidenceFreshnessReviewCadenceSummary {
  totalInputRows: number;
  scheduledRowCount: number;
  maxScheduleRows: number;
  byCategory: Record<EvidenceFreshnessCategory, number>;
  byCadenceStatus: Record<EvidenceFreshnessCadenceStatus, number>;
}

export interface EvidenceFreshnessReviewCadenceMonitor {
  readOnly: true;
  dryRun: true;
  noDatabaseWrite: true;
  noSourceQueueWrite: true;
  noCandidateDecision: true;
  noExtractionWrite: true;
  noClaimReviewWrite: true;
  noPublicEvidenceWrite: true;
  noPublicPromotion: true;
  writes: "none";
  nextAction: string;
  nextReviewSchedule: EvidenceFreshnessReviewScheduleRow[];
  approvalPacket: string;
  summary: EvidenceFreshnessReviewCadenceSummary;
}

const CATEGORIES: EvidenceFreshnessCategory[] = [
  "source-gap",
  "candidate-review",
  "review-packet",
  "extraction-gap",
  "publication-blocker"
];

const CADENCE_STATUSES: EvidenceFreshnessCadenceStatus[] = [
  "stale",
  "due",
  "watch",
  "ready"
];

const BOUNDARY_NOTE_TEXT =
  "This monitor is cadence and freshness only. It does not decide evidence quality, medical or regulatory meaning, source-rights approval, or public-promotion readiness.";

interface NormalizedRow extends EvidenceFreshnessInputRow {
  category: EvidenceFreshnessCategory;
}

export function buildEvidenceFreshnessReviewCadenceMonitor(
  input: EvidenceFreshnessReviewCadenceInput
): EvidenceFreshnessReviewCadenceMonitor {
  const normalizedRows = normalizeInputRows(input);
  const maxScheduleRows = clampMaxScheduleRows(input.maxScheduleRows);
  const scheduleRows = normalizedRows
    .map((row) => toScheduleRow(row))
    .sort(compareScheduleRows)
    .slice(0, maxScheduleRows);
  const nextAction = buildNextAction(scheduleRows);
  const summary = buildSummary(normalizedRows, scheduleRows, maxScheduleRows);

  return {
    readOnly: true,
    dryRun: true,
    noDatabaseWrite: true,
    noSourceQueueWrite: true,
    noCandidateDecision: true,
    noExtractionWrite: true,
    noClaimReviewWrite: true,
    noPublicEvidenceWrite: true,
    noPublicPromotion: true,
    writes: "none",
    nextAction,
    nextReviewSchedule: scheduleRows,
    approvalPacket: buildApprovalPacket(scheduleRows, summary),
    summary
  };
}

function normalizeInputRows(input: EvidenceFreshnessReviewCadenceInput): NormalizedRow[] {
  const rows: NormalizedRow[] = [];

  for (const row of input.sourceGaps ?? []) {
    rows.push({ ...row, category: "source-gap" });
  }
  for (const row of input.candidateRows ?? []) {
    rows.push({ ...row, category: "candidate-review" });
  }
  for (const row of input.reviewPacketRows ?? []) {
    rows.push({ ...row, category: "review-packet" });
  }
  for (const row of input.extractionGapRows ?? []) {
    rows.push({ ...row, category: "extraction-gap" });
  }
  for (const row of input.publicationBlockerRows ?? []) {
    rows.push({ ...row, category: "publication-blocker" });
  }

  return rows;
}

function clampMaxScheduleRows(maxScheduleRows?: number): number {
  const value = maxScheduleRows ?? 10;
  return Math.min(10, Math.max(5, value));
}

function resolveCadenceStatus(row: NormalizedRow): EvidenceFreshnessCadenceStatus {
  const blockers = row.blockers ?? [];
  const nextChecks = row.nextChecks ?? [];
  const ageKnown = typeof row.ageDays === "number";
  const staleThresholdKnown = typeof row.staleAfterDays === "number";

  if (ageKnown && staleThresholdKnown && row.ageDays! >= row.staleAfterDays!) {
    return "stale";
  }
  if (blockers.length > 0) {
    return "due";
  }
  if (nextChecks.length > 0 || !ageKnown) {
    return "watch";
  }
  return "ready";
}

function toScheduleRow(row: NormalizedRow): EvidenceFreshnessReviewScheduleRow {
  const cadenceStatus = resolveCadenceStatus(row);
  const blockers = [...(row.blockers ?? [])];
  const nextChecks = [...(row.nextChecks ?? [])];

  return {
    id: row.id,
    category: row.category,
    label: row.label,
    claimId: row.claimId ?? null,
    interventionId: row.interventionId ?? null,
    interventionName: row.interventionName ?? null,
    ageDays: typeof row.ageDays === "number" ? row.ageDays : null,
    staleAfterDays: typeof row.staleAfterDays === "number" ? row.staleAfterDays : null,
    priority: row.priority,
    cadenceStatus,
    blockers,
    nextChecks,
    rollbackNotes: [
      "No writes were performed by this monitor.",
      "Discard this schedule output without database, source-queue, extraction, claim-review, or public rollback."
    ],
    verificationNotes: [
      `Cadence status ${cadenceStatus} is a freshness/review timing signal only.`,
      `Category ${row.category} remains operator-owned for any downstream write decision.`
    ],
    boundaryNotes: BOUNDARY_NOTE_TEXT,
    writes: "none"
  };
}

function compareScheduleRows(
  left: EvidenceFreshnessReviewScheduleRow,
  right: EvidenceFreshnessReviewScheduleRow
): number {
  const statusDelta =
    CADENCE_STATUSES.indexOf(left.cadenceStatus) - CADENCE_STATUSES.indexOf(right.cadenceStatus);
  if (statusDelta !== 0) {
    return statusDelta;
  }

  if (left.priority !== right.priority) {
    return right.priority - left.priority;
  }

  const leftAge = left.ageDays;
  const rightAge = right.ageDays;
  if (leftAge === null && rightAge === null) {
    // fall through to category/id
  } else if (leftAge === null) {
    return 1;
  } else if (rightAge === null) {
    return -1;
  } else if (leftAge !== rightAge) {
    return rightAge - leftAge;
  }

  const categoryDelta =
    CATEGORIES.indexOf(left.category) - CATEGORIES.indexOf(right.category);
  if (categoryDelta !== 0) {
    return categoryDelta;
  }

  return left.id.localeCompare(right.id);
}

function buildNextAction(scheduleRows: EvidenceFreshnessReviewScheduleRow[]): string {
  if (scheduleRows.length === 0) {
    return "No evidence freshness review rows supplied; this read-only monitor performed no writes.";
  }

  const first = scheduleRows[0];
  return `Review ${first.label} (${first.category}, cadence ${first.cadenceStatus}) before any operator write approval.`;
}

function buildSummary(
  allRows: NormalizedRow[],
  scheduleRows: EvidenceFreshnessReviewScheduleRow[],
  maxScheduleRows: number
): EvidenceFreshnessReviewCadenceSummary {
  const byCategory = Object.fromEntries(
    CATEGORIES.map((category) => [
      category,
      scheduleRows.filter((row) => row.category === category).length
    ])
  ) as Record<EvidenceFreshnessCategory, number>;

  const byCadenceStatus = Object.fromEntries(
    CADENCE_STATUSES.map((status) => [
      status,
      scheduleRows.filter((row) => row.cadenceStatus === status).length
    ])
  ) as Record<EvidenceFreshnessCadenceStatus, number>;

  return {
    totalInputRows: allRows.length,
    scheduledRowCount: scheduleRows.length,
    maxScheduleRows,
    byCategory,
    byCadenceStatus
  };
}

function buildApprovalPacket(
  scheduleRows: EvidenceFreshnessReviewScheduleRow[],
  summary: EvidenceFreshnessReviewCadenceSummary
): string {
  const scheduleSection =
    scheduleRows.length === 0
      ? "- No rows scheduled."
      : scheduleRows
          .map((row) => {
            const scopeParts = [
              row.claimId ? `claim ${row.claimId}` : null,
              row.interventionName ? `intervention ${row.interventionName}` : null
            ].filter(Boolean);
            const scope = scopeParts.length > 0 ? scopeParts.join(", ") : "scope unavailable";
            const age =
              row.ageDays === null ? "age unavailable" : `${row.ageDays} day(s) since last review`;
            return `- ${row.id} (${row.category}, ${row.cadenceStatus}, priority ${row.priority}): ${row.label}; ${scope}; ${age}.`;
          })
          .join("\n");

  const requiredApprovals =
    scheduleRows.length === 0
      ? "- No operator approvals are implied by an empty cadence schedule."
      : [
          "- Source queue changes require explicit operator approval outside this monitor.",
          "- Candidate accept/reject decisions require explicit operator approval outside this monitor.",
          "- Extraction writes require explicit operator approval outside this monitor.",
          "- Claim review writes require explicit operator approval outside this monitor.",
          "- Public evidence or promotion writes require explicit operator approval outside this monitor."
        ].join("\n");

  return [
    "# Evidence Freshness And Review Cadence Monitor",
    "",
    "Read-only dry-run cadence monitor. Database, source-queue, candidate, extraction, claim-review, and public writes are not performed.",
    "",
    "## Next Review Schedule",
    "",
    scheduleSection,
    "",
    "## Boundary Notes",
    "",
    BOUNDARY_NOTE_TEXT,
    "Cadence and freshness signals do not decide evidence quality, medical or regulatory meaning, source-rights approval, or public-promotion readiness.",
    "",
    "## Rollback",
    "",
    "No writes were performed. Discard this monitor output without rollback.",
    "",
    "## Verification",
    "",
    "- readOnly: true",
    "- dryRun: true",
    "- noDatabaseWrite: true",
    "- noSourceQueueWrite: true",
    "- noCandidateDecision: true",
    "- noExtractionWrite: true",
    "- noClaimReviewWrite: true",
    "- noPublicEvidenceWrite: true",
    "- noPublicPromotion: true",
    "- writes: none",
    `- scheduledRowCount: ${summary.scheduledRowCount}`,
    `- maxScheduleRows: ${summary.maxScheduleRows}`,
    "",
    "## Required Approvals",
    "",
    requiredApprovals
  ].join("\n");
}
