import type {
  SupplementOnboardingQualityDashboard,
  SupplementOnboardingQualityRow,
  SupplementOnboardingQualityStatus
} from "@/lib/supplement-onboarding-quality";

export type SupplementOnboardingNextActionStage =
  | "draft-claims"
  | "queue-sources"
  | "run-source-ingestion"
  | "review-candidates"
  | "extract-studies"
  | "review-claim-packet"
  | "promotion-readiness"
  | "ready"
  | "source-tracking-gate"
  | "full-text-source-gate";

export interface SupplementOnboardingNextActionRow {
  action: string;
  blockers: string[];
  command: string;
  humanOwned: true;
  noAutoPromotion: true;
  noAutoWrite: true;
  priority: number;
  rationale: string[];
  readOnly: true;
  stage: SupplementOnboardingNextActionStage;
  status: SupplementOnboardingQualityStatus;
  supplement: SupplementOnboardingQualityRow["supplement"];
  warnings: string[];
}

export interface SupplementOnboardingGlobalNextAction {
  action: string;
  command: string;
  humanOwned: true;
  noAutoWrite: true;
  priority: number;
  rationale: string[];
  readOnly: true;
  stage: Extract<
    SupplementOnboardingNextActionStage,
    "source-tracking-gate" | "full-text-source-gate"
  >;
}

export interface SupplementOnboardingNextActionReport {
  dataSource: SupplementOnboardingQualityDashboard["dataSource"];
  generatedAt: string;
  globalActions: SupplementOnboardingGlobalNextAction[];
  humanOwned: true;
  nextAction: string;
  noAutoPromotion: true;
  noAutoWrite: true;
  readOnly: true;
  rows: SupplementOnboardingNextActionRow[];
  summary: {
    blocked: number;
    byStage: Record<SupplementOnboardingNextActionStage, number>;
    ready: number;
    supplements: number;
    warning: number;
  };
}

export interface SupplementOnboardingNextActionSummary {
  dataSource: SupplementOnboardingNextActionReport["dataSource"];
  generatedAt: string;
  globalActions: Array<{
    action: string;
    command: string;
    stage: SupplementOnboardingGlobalNextAction["stage"];
  }>;
  humanOwned: true;
  nextAction: string;
  noAutoPromotion: true;
  noAutoWrite: true;
  readOnly: true;
  rows: Array<{
    action: string;
    command: string;
    name: string;
    slug: string;
    stage: SupplementOnboardingNextActionStage;
    status: SupplementOnboardingQualityStatus;
  }>;
  summary: SupplementOnboardingNextActionReport["summary"];
}

export function buildSupplementOnboardingNextActionReport({
  dashboard,
  supplementQuery
}: {
  dashboard: SupplementOnboardingQualityDashboard;
  supplementQuery?: string;
}): SupplementOnboardingNextActionReport {
  const rows = filterRows(dashboard.rows, supplementQuery).map(nextActionForRow);
  const globalActions = globalNextActions(dashboard);
  const summary = summarizeRows(rows);
  const nextAction =
    rows.find((row) => row.status === "blocked")?.action ??
    rows.find((row) => row.status === "warning")?.action ??
    globalActions[0]?.action ??
    "All visible supplements are ready for explicit operator-owned promotion checks or monitoring.";

  return {
    dataSource: dashboard.dataSource,
    generatedAt: dashboard.generatedAt,
    globalActions,
    humanOwned: true,
    nextAction,
    noAutoPromotion: true,
    noAutoWrite: true,
    readOnly: true,
    rows,
    summary
  };
}

export function summarizeSupplementOnboardingNextActionReport(
  report: SupplementOnboardingNextActionReport
): SupplementOnboardingNextActionSummary {
  return {
    dataSource: report.dataSource,
    generatedAt: report.generatedAt,
    globalActions: report.globalActions.map((action) => ({
      action: action.action,
      command: action.command,
      stage: action.stage
    })),
    humanOwned: true,
    nextAction: report.nextAction,
    noAutoPromotion: true,
    noAutoWrite: true,
    readOnly: true,
    rows: report.rows.map((row) => ({
      action: row.action,
      command: row.command,
      name: row.supplement.name,
      slug: row.supplement.slug,
      stage: row.stage,
      status: row.status
    })),
    summary: report.summary
  };
}

function nextActionForRow(
  row: SupplementOnboardingQualityRow
): SupplementOnboardingNextActionRow {
  const slug = row.supplement.slug || row.supplement.id;

  if (row.states.draft === "missing-claims" || row.counts.claims === 0) {
    return actionRow(row, {
      action: "Draft and review claim scopes before queueing source discovery.",
      command: `npm run onboard:supplement -- --name ${quote(row.supplement.name)} --category ${quote(row.supplement.category)}`,
      priority: 10,
      rationale: [
        "No reviewed claim scope is visible for this supplement.",
        "Source discovery must stay claim-scoped."
      ],
      stage: "draft-claims"
    });
  }

  if (row.states.queue === "failed") {
    return actionRow(row, {
      action: "Triage failed source discovery jobs before treating onboarding as current.",
      command: "npm run ingest:scheduled-dry-run -- --summary",
      priority: 20,
      rationale: [
        "At least one source discovery job failed.",
        "Dry-run scheduled ingestion keeps retry review explicit."
      ],
      stage: "run-source-ingestion"
    });
  }

  if (row.states.queue === "missing") {
    return actionRow(row, {
      action: "Preview claim-scoped source queue commands.",
      command: `npm run onboarding:queue-sources -- --supplement ${quote(slug)}`,
      priority: 30,
      rationale: [
        "Claims exist, but no source discovery job history is visible.",
        "The queue helper is dry-run unless --apply is explicitly supplied."
      ],
      stage: "queue-sources"
    });
  }

  if (row.states.queue === "queued" || row.states.queue === "running") {
    return actionRow(row, {
      action: "Run a scheduled-ingestion dry run before any guarded ingestion apply.",
      command: "npm run ingest:scheduled-dry-run -- --summary",
      priority: 40,
      rationale: [
        "Queued or running source jobs are visible.",
        "The dry run checks hosted-readiness without accepting candidates or promoting evidence."
      ],
      stage: "run-source-ingestion"
    });
  }

  if (row.counts.pendingCandidates > 0) {
    return actionRow(row, {
      action: "Review pending source candidates in the operator-owned candidate queue.",
      command:
        "npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 10",
      priority: 50,
      rationale: [
        `${row.counts.pendingCandidates} pending candidate(s) remain.`,
        "Candidate accept/reject decisions stay explicit and human-owned."
      ],
      stage: "review-candidates"
    });
  }

  if (row.states.candidates === "missing" && row.states.queue === "completed") {
    return actionRow(row, {
      action: "Inspect source ingestion results because completed jobs have no visible candidates.",
      command: "npm run ingest:scheduled-dry-run -- --summary",
      priority: 55,
      rationale: [
        "Source jobs appear completed, but no candidates are visible.",
        "Dry-run inspection avoids creating or promoting evidence."
      ],
      stage: "run-source-ingestion"
    });
  }

  if (
    row.states.extraction !== "complete" ||
    row.sourcePacket.extractionPendingClaims > 0 ||
    row.sourcePacket.pendingReferences > 0
  ) {
    return actionRow(row, {
      action: "Build the review packet and fill structured extraction gaps.",
      command: `npm run onboarding:review-packet -- --supplement ${quote(slug)}`,
      priority: 60,
      rationale: [
        `${row.sourcePacket.extractionPendingClaims} claim(s) still have extraction gaps.`,
        "Structured extraction must precede claim packet review and promotion."
      ],
      stage: "extract-studies"
    });
  }

  if (row.states.reviewPacket !== "complete" || row.counts.reviewedClaims < row.counts.claims) {
    return actionRow(row, {
      action: "Review the claim packet after citation traceability and caveats are checked.",
      command: `npm run onboarding:review-packet -- --supplement ${quote(slug)}`,
      priority: 70,
      rationale: [
        `${row.counts.reviewedClaims}/${row.counts.claims} claim(s) are human-reviewed.`,
        "Public promotion stays blocked until packet review is explicit."
      ],
      stage: "review-claim-packet"
    });
  }

  if (row.promotion.blockedClaims > 0) {
    return actionRow(row, {
      action: "Resolve promotion blockers surfaced by the reviewed packet.",
      command: "npm run promotion:readiness -- --summary",
      priority: 80,
      rationale: [
        `${row.promotion.blockedClaims} claim(s) remain promotion-blocked.`,
        "Promotion readiness is read-only and does not publish evidence."
      ],
      stage: "promotion-readiness"
    });
  }

  return actionRow(row, {
    action: "Run promotion readiness before any explicit public promotion.",
    command: "npm run promotion:readiness -- --summary",
    priority: 90,
    rationale: [
      `${row.promotion.readyClaims}/${row.promotion.totalClaims} claim(s) are promotion-ready.`,
      "Final promotion remains a separate audited operator action."
    ],
    stage: "ready"
  });
}

function actionRow(
  row: SupplementOnboardingQualityRow,
  action: {
    action: string;
    command: string;
    priority: number;
    rationale: string[];
    stage: SupplementOnboardingNextActionStage;
  }
): SupplementOnboardingNextActionRow {
  return {
    ...action,
    blockers: row.blockers,
    humanOwned: true,
    noAutoPromotion: true,
    noAutoWrite: true,
    readOnly: true,
    status: row.status,
    supplement: row.supplement,
    warnings: row.warnings
  };
}

function globalNextActions(
  dashboard: SupplementOnboardingQualityDashboard
): SupplementOnboardingGlobalNextAction[] {
  const actions: SupplementOnboardingGlobalNextAction[] = [];

  if (dashboard.sourceTracking.status === "unavailable") {
    actions.push({
      action: "Rerun onboarding quality with a database env file for queue and candidate-specific next actions.",
      command:
        "npm run onboarding:quality -- --env-file <non-production-env-file> --summary",
      humanOwned: true,
      noAutoWrite: true,
      priority: 5,
      rationale: [
        dashboard.sourceTracking.unavailableReason ??
          "Database-backed source tracking is unavailable."
      ],
      readOnly: true,
      stage: "source-tracking-gate"
    });
  }

  if (!dashboard.fullTextSources.liveCaptureReady) {
    const topSource = dashboard.fullTextSources.reviewQueue[0];
    actions.push({
      action: "Review the full-text source gate before implementing any live full-text connector.",
      command: "npm run onboarding:fulltext-sources -- --summary",
      humanOwned: true,
      noAutoWrite: true,
      priority: 95,
      rationale: [
        `${dashboard.fullTextSources.counts.blockedSources} full-text source class(es) are blocked.`,
        topSource
          ? `Start with ${topSource.label} (${topSource.tier}, ${topSource.convictionScore}/100).`
          : undefined,
        "This gate is separate from source-candidate review and does not fetch full text."
      ].filter((item): item is string => Boolean(item)),
      readOnly: true,
      stage: "full-text-source-gate"
    });
  }

  return actions.sort((left, right) => left.priority - right.priority);
}

function summarizeRows(rows: SupplementOnboardingNextActionRow[]) {
  const byStage = emptyStageCounts();

  return rows.reduce(
    (summary, row) => {
      summary.supplements += 1;
      summary.byStage[row.stage] += 1;

      if (row.status === "ready") {
        summary.ready += 1;
      } else if (row.status === "warning") {
        summary.warning += 1;
      } else {
        summary.blocked += 1;
      }

      return summary;
    },
    {
      blocked: 0,
      byStage,
      ready: 0,
      supplements: 0,
      warning: 0
    }
  );
}

function emptyStageCounts(): Record<SupplementOnboardingNextActionStage, number> {
  return {
    "draft-claims": 0,
    "extract-studies": 0,
    "full-text-source-gate": 0,
    "promotion-readiness": 0,
    "queue-sources": 0,
    "ready": 0,
    "review-candidates": 0,
    "review-claim-packet": 0,
    "run-source-ingestion": 0,
    "source-tracking-gate": 0
  };
}

function filterRows(
  rows: SupplementOnboardingQualityRow[],
  supplementQuery?: string
) {
  const query = supplementQuery?.trim().toLowerCase();

  if (!query) {
    return rows;
  }

  return rows.filter((row) =>
    [row.supplement.id, row.supplement.slug, row.supplement.name].some(
      (value) => value.toLowerCase() === query
    )
  );
}

function quote(value: string) {
  return `"${value.replace(/"/g, '\\"')}"`;
}
