import {
  buildFullTextConnectorApprovalPacket,
  buildFullTextConnectorReviewDraft,
  buildFullTextSourceInventoryNextActionPlan,
  buildFullTextSourceInventoryProgressReport,
  buildFullTextSourceReadinessReport,
  summarizeFullTextConnectorApprovalPacket,
  summarizeFullTextConnectorReviewDraft,
  summarizeFullTextSourceInventoryNextActionPlan,
  summarizeFullTextSourceInventoryProgressReport,
  summarizeFullTextSourceReadinessReport,
  type FullTextSourceInventoryItem
} from "@/lib/full-text-source-readiness";
import {
  buildSupplementOnboardingNextActionReport,
  summarizeSupplementOnboardingNextActionReport,
  type SupplementOnboardingNextActionReport,
  type SupplementOnboardingNextActionStage,
  type SupplementOnboardingNextActionSummary
} from "@/lib/supplement-onboarding-next-action";
import {
  buildSupplementOnboardingQualityDashboard,
  summarizeSupplementOnboardingQualityDashboard,
  type SupplementOnboardingQualityPriorityItem,
  type SupplementOnboardingQualitySummary
} from "@/lib/supplement-onboarding-quality";
import type { SupplementOnboardingMonitorSummary } from "@/lib/supplement-onboarding-monitor";
import {
  buildSupplementOnboardingReadinessReport,
  summarizeSupplementOnboardingReadinessReport,
  type SupplementOnboardingReadinessSummary,
  type SupplementOnboardingSourceSignals
} from "@/lib/supplement-onboarding-readiness";
import type { EvidenceDashboardData } from "@/lib/types";

export interface SupplementOnboardingStatusCommand {
  command: string;
  label: string;
  stage:
    | "quality"
    | "next-action"
    | "readiness"
    | "full-text-source-gate"
    | "full-text-next-action"
    | "full-text-progress"
    | "full-text-connector-prep-kit"
    | "full-text-fixture"
    | "full-text-connector-review"
    | "full-text-connector-approval";
}

export interface SupplementOnboardingStatusFullText {
  connectorApproval: ReturnType<typeof summarizeFullTextConnectorApprovalPacket>;
  connectorReview: ReturnType<typeof summarizeFullTextConnectorReviewDraft>;
  nextAction: ReturnType<typeof summarizeFullTextSourceInventoryNextActionPlan>;
  progress: ReturnType<typeof summarizeFullTextSourceInventoryProgressReport>;
  readiness: ReturnType<typeof summarizeFullTextSourceReadinessReport>;
}

export type SupplementOnboardingWorkflowStepStatus =
  | "blocked"
  | "complete"
  | "current"
  | "pending";

export interface SupplementOnboardingWorkflowStep {
  blockers: number;
  command: string;
  detail: string;
  humanOwned: true;
  label: string;
  noAutoPromotion: true;
  noAutoWrite: true;
  readOnly: true;
  stage: SupplementOnboardingNextActionStage;
  status: SupplementOnboardingWorkflowStepStatus;
  supplements: number;
  warnings: number;
}

export interface SupplementOnboardingStatusReport {
  commands: SupplementOnboardingStatusCommand[];
  dataSource: EvidenceDashboardData["dataSource"];
  generatedAt: string;
  humanOwned: true;
  monitor: SupplementOnboardingMonitorSummary;
  nextAction: string;
  nextActions: SupplementOnboardingNextActionSummary;
  fullText: SupplementOnboardingStatusFullText;
  noAutoPromotion: true;
  noAutoWrite: true;
  priorityQueue: SupplementOnboardingQualityPriorityItem[];
  quality: SupplementOnboardingQualitySummary;
  readOnly: true;
  readiness: SupplementOnboardingReadinessSummary[];
  scope: "all" | "supplement";
  sourceConvictionRubric: SupplementOnboardingQualitySummary["sourceConvictionRubric"];
  supplementQuery?: string;
  workflow: SupplementOnboardingWorkflowStep[];
}

export interface SupplementOnboardingStatusSummary {
  commands: SupplementOnboardingStatusCommand[];
  dataSource: SupplementOnboardingStatusReport["dataSource"];
  fullText: SupplementOnboardingStatusFullText;
  fullTextSources: SupplementOnboardingQualitySummary["fullTextSources"];
  generatedAt: string;
  humanOwned: true;
  monitor: SupplementOnboardingMonitorSummary;
  nextAction: string;
  noAutoPromotion: true;
  noAutoWrite: true;
  priorityQueue: SupplementOnboardingQualityPriorityItem[];
  quality: {
    blockedSupplements: number;
    candidateReviewAutopilot: {
      blockedBySafety: number;
      nextAction: string;
      noAutoAccept: true;
      noAutoExtraction: true;
      noAutoPromotion: true;
      noAutoReject: true;
      readyNoPendingCandidates: number;
      recommendedCandidate?: NonNullable<
        SupplementOnboardingQualitySummary["rows"][number]["reviewPacketAutopilot"]["recommendedCandidate"]
      >;
      reviewPendingCandidate: number;
      summarizeLimitations: number;
    };
    pendingCandidates: number;
    promotionReadyClaims: number;
    readySupplements: number;
    reviewedClaims: number;
    sourceTracking: SupplementOnboardingQualitySummary["sourceTracking"];
    supplements: number;
    totalClaims: number;
    warningSupplements: number;
  };
  readOnly: true;
  readiness: Array<{
    blockedChecks: number;
    nextAction: string;
    overall: SupplementOnboardingReadinessSummary["overall"];
    slug?: string;
    supplement?: string;
    warningChecks: number;
  }>;
  scope: SupplementOnboardingStatusReport["scope"];
  sourceConvictionRubric: SupplementOnboardingQualitySummary["sourceConvictionRubric"];
  supplementQuery?: string;
  workflow: SupplementOnboardingWorkflowStep[];
}

export function buildSupplementOnboardingStatusReport({
  data,
  fullTextInventoryPath,
  fullTextSourceInventory,
  generatedAt = new Date(),
  sourceSignals,
  supplementQuery
}: {
  data: EvidenceDashboardData;
  fullTextInventoryPath?: string;
  fullTextSourceInventory?: FullTextSourceInventoryItem[];
  generatedAt?: Date;
  sourceSignals?: SupplementOnboardingSourceSignals;
  supplementQuery?: string;
}): SupplementOnboardingStatusReport {
  const dashboard = buildSupplementOnboardingQualityDashboard({
    data,
    fullTextInventoryPath,
    fullTextSourceInventory,
    generatedAt,
    sourceSignals
  });
  const quality = summarizeSupplementOnboardingQualityDashboard(dashboard);
  const fullText = buildStatusFullText({
    fullTextInventoryPath,
    fullTextSourceInventory,
    generatedAt
  });
  const nextActionReport = buildSupplementOnboardingNextActionReport({
    dashboard,
    supplementQuery
  });
  const nextActions = summarizeSupplementOnboardingNextActionReport(nextActionReport);
  const readinessQueries = readinessQueriesFor(dashboard.rows, supplementQuery);
  const readiness = readinessQueries.map((query) =>
    summarizeSupplementOnboardingReadinessReport(
      buildSupplementOnboardingReadinessReport({
        data,
        generatedAt,
        sourceSignals,
        supplementQuery: query
      })
    )
  );
  const priorityQueue = filterPriorityQueue(quality.priorityQueue, supplementQuery);
  const workflow = buildStatusWorkflow({
    nextActionReport,
    readiness,
    supplementQuery
  });
  const supplementReadinessAction = supplementQuery
    ? readiness.find((item) => item.overall === "blocked")?.nextAction
    : undefined;
  const nextAction =
    nextActions.rows[0]?.action ??
    supplementReadinessAction ??
    nextActions.globalActions[0]?.action ??
    readiness.find((item) => item.overall === "blocked")?.nextAction ??
    readiness[0]?.nextAction ??
    quality.nextAction;

  return {
    commands: statusCommands({
      fullTextInventoryPath,
      fullTextNextActionCommands: fullText.nextAction.commands,
      supplementQuery
    }),
    dataSource: data.dataSource,
    fullText,
    generatedAt: dashboard.generatedAt,
    humanOwned: true,
    monitor: quality.monitor,
    nextAction,
    nextActions,
    noAutoPromotion: true,
    noAutoWrite: true,
    priorityQueue,
    quality,
    readOnly: true,
    readiness,
    scope: supplementQuery ? "supplement" : "all",
    sourceConvictionRubric: quality.sourceConvictionRubric,
    supplementQuery,
    workflow
  };
}

export function summarizeSupplementOnboardingStatusReport(
  report: SupplementOnboardingStatusReport
): SupplementOnboardingStatusSummary {
  const candidateReviewAutopilot = summarizeStatusCandidateReviewAutopilot(
    report.quality.rows.map((row) => row.reviewPacketAutopilot)
  );

  return {
    commands: report.commands,
    dataSource: report.dataSource,
    fullText: report.fullText,
    fullTextSources: report.quality.fullTextSources,
    generatedAt: report.generatedAt,
    humanOwned: true,
    monitor: report.monitor,
    nextAction: report.nextAction,
    noAutoPromotion: true,
    noAutoWrite: true,
    priorityQueue: report.priorityQueue.slice(0, 6),
    quality: {
      blockedSupplements: report.quality.summary.blockedSupplements,
      candidateReviewAutopilot,
      pendingCandidates: report.quality.summary.pendingCandidates,
      promotionReadyClaims: report.quality.summary.promotionReadyClaims,
      readySupplements: report.quality.summary.readySupplements,
      reviewedClaims: report.quality.summary.reviewedClaims,
      sourceTracking: report.quality.sourceTracking,
      supplements: report.quality.summary.supplements,
      totalClaims: report.quality.summary.totalClaims,
      warningSupplements: report.quality.summary.warningSupplements
    },
    readOnly: true,
    readiness: report.readiness.map((item) => ({
      blockedChecks: item.blockedChecks.length,
      nextAction: item.nextAction,
      overall: item.overall,
      slug: item.supplement?.slug,
      supplement: item.supplement?.name,
      warningChecks: item.warningChecks.length
    })),
    scope: report.scope,
    sourceConvictionRubric: report.sourceConvictionRubric,
    supplementQuery: report.supplementQuery,
    workflow: report.workflow
  };
}

function summarizeStatusCandidateReviewAutopilot(
  rows: SupplementOnboardingQualitySummary["rows"][number]["reviewPacketAutopilot"][]
) {
  const actionable =
    rows.find((row) => row.blockedBySafety > 0) ??
    rows.find((row) => row.reviewPendingCandidate > 0) ??
    rows.find((row) => row.summarizeLimitations > 0) ??
    rows.find((row) => row.readyNoPendingCandidates > 0);

  return {
    blockedBySafety: rows.reduce((total, row) => total + row.blockedBySafety, 0),
    nextAction:
      actionable?.nextAction ??
      "Add claim scopes before candidate review autopilot can route source decisions.",
    noAutoAccept: true,
    noAutoExtraction: true,
    noAutoPromotion: true,
    noAutoReject: true,
    readyNoPendingCandidates: rows.reduce(
      (total, row) => total + row.readyNoPendingCandidates,
      0
    ),
    ...(actionable?.recommendedCandidate
      ? { recommendedCandidate: actionable.recommendedCandidate }
      : {}),
    reviewPendingCandidate: rows.reduce(
      (total, row) => total + row.reviewPendingCandidate,
      0
    ),
    summarizeLimitations: rows.reduce(
      (total, row) => total + row.summarizeLimitations,
      0
    )
  } as const;
}

function buildStatusFullText({
  fullTextInventoryPath,
  fullTextSourceInventory,
  generatedAt
}: {
  fullTextInventoryPath?: string;
  fullTextSourceInventory?: FullTextSourceInventoryItem[];
  generatedAt: Date;
}): SupplementOnboardingStatusFullText {
  const readiness = buildFullTextSourceReadinessReport({
    generatedAt,
    inventory: fullTextSourceInventory
  });
  const progress = buildFullTextSourceInventoryProgressReport({
    generatedAt,
    inventory: fullTextSourceInventory
  });
  const connectorReview = buildFullTextConnectorReviewDraft({
    generatedAt,
    inventory: fullTextSourceInventory
  });
  const connectorApproval = buildFullTextConnectorApprovalPacket({
    generatedAt,
    inventory: fullTextSourceInventory
  });
  const nextAction = buildFullTextSourceInventoryNextActionPlan({
    generatedAt,
    inventory: fullTextSourceInventory,
    inventoryFilePath: fullTextInventoryPath
  });

  return {
    connectorApproval: summarizeFullTextConnectorApprovalPacket(connectorApproval),
    connectorReview: summarizeFullTextConnectorReviewDraft(connectorReview),
    nextAction: summarizeFullTextSourceInventoryNextActionPlan(nextAction),
    progress: summarizeFullTextSourceInventoryProgressReport(progress),
    readiness: summarizeFullTextSourceReadinessReport(readiness)
  };
}

function readinessQueriesFor(
  rows: ReturnType<typeof buildSupplementOnboardingQualityDashboard>["rows"],
  supplementQuery?: string
) {
  const filteredRows = supplementQuery
    ? rows.filter((row) => rowMatchesSupplement(row, supplementQuery))
    : rows;

  if (filteredRows.length > 0) {
    return filteredRows.map((row) => row.supplement.id);
  }

  return supplementQuery ? [supplementQuery] : [];
}

function filterPriorityQueue(
  priorityQueue: SupplementOnboardingQualityPriorityItem[],
  supplementQuery?: string
) {
  if (!supplementQuery) {
    return priorityQueue;
  }

  const query = normalizeQuery(supplementQuery);

  return priorityQueue.filter((item) =>
    [item.id, item.slug, item.name].some((value) => normalizeQuery(value) === query)
  );
}

const WORKFLOW_STEP_DEFINITIONS: Array<{
  detail: string;
  label: string;
  stage: SupplementOnboardingNextActionStage;
}> = [
  {
    detail:
      "Database-backed source tracking must be available before queue and candidate-specific guidance is complete.",
    label: "Connect Source Tracking",
    stage: "source-tracking-gate"
  },
  {
    detail: "Create reviewed supplement identity and claim scopes before source discovery.",
    label: "Draft Claims",
    stage: "draft-claims"
  },
  {
    detail: "Preview claim-scoped source queue commands; writes remain separate and explicit.",
    label: "Queue Source Searches",
    stage: "queue-sources"
  },
  {
    detail: "Check scheduled ingestion readiness before any guarded ingestion apply.",
    label: "Run Source Ingestion",
    stage: "run-source-ingestion"
  },
  {
    detail: "Review pending candidates and keep accept/reject decisions operator-owned.",
    label: "Review Candidates",
    stage: "review-candidates"
  },
  {
    detail: "Fill structured extraction fields from accepted, traceable sources.",
    label: "Extract Studies",
    stage: "extract-studies"
  },
  {
    detail: "Review claim packets with citations, caveats, and uncertainty labels visible.",
    label: "Review Claim Packet",
    stage: "review-claim-packet"
  },
  {
    detail: "Run read-only promotion readiness before any audited public promotion action.",
    label: "Promotion Readiness",
    stage: "promotion-readiness"
  },
  {
    detail: "Ready means explicit promotion checks or monitoring are next; no automatic publish runs here.",
    label: "Ready For Explicit Promotion",
    stage: "ready"
  },
  {
    detail:
      "Review terms, access, rate/cache, retention, and derived-only export before any full-text connector.",
    label: "Full-Text Source Gate",
    stage: "full-text-source-gate"
  }
];

function buildStatusWorkflow({
  nextActionReport,
  readiness,
  supplementQuery
}: {
  nextActionReport: SupplementOnboardingNextActionReport;
  readiness: SupplementOnboardingReadinessSummary[];
  supplementQuery?: string;
}): SupplementOnboardingWorkflowStep[] {
  const missingSupplementReadiness =
    supplementQuery && nextActionReport.rows.length === 0
      ? readiness.find((item) => item.overall === "blocked")
      : undefined;
  const activeIndexes = [
    ...nextActionReport.rows.map((row) => workflowStageIndex(row.stage)),
    missingSupplementReadiness ? workflowStageIndex("draft-claims") : undefined
  ].filter((index): index is number => typeof index === "number" && index >= 0);
  const earliestActiveIndex =
    activeIndexes.length > 0 ? Math.min(...activeIndexes) : Number.POSITIVE_INFINITY;

  return WORKFLOW_STEP_DEFINITIONS.map((definition, index) => {
    const rows = nextActionReport.rows.filter((row) => row.stage === definition.stage);
    const globalAction = nextActionReport.globalActions.find(
      (action) => action.stage === definition.stage
    );
    const isMissingSupplementDraft =
      definition.stage === "draft-claims" && Boolean(missingSupplementReadiness);
    const blockers =
      rows.reduce((count, row) => count + row.blockers.length, 0) +
      (globalAction ? 1 : 0) +
      (isMissingSupplementDraft ? 1 : 0);
    const warnings = rows.reduce((count, row) => count + row.warnings.length, 0);
    const status = workflowStepStatus({
      blockers,
      earliestActiveIndex,
      globalActionPresent: Boolean(globalAction),
      index,
      isGlobalGate:
        definition.stage === "source-tracking-gate" ||
        definition.stage === "full-text-source-gate",
      isMissingSupplementDraft,
      rows
    });

    return {
      blockers,
      command:
        supplementQuery && rows[0]
          ? rows[0].command
          : globalAction?.command ??
            workflowStepCommand(definition.stage, supplementQuery),
      detail: workflowStepDetail({
        definitionDetail: definition.detail,
        globalAction: globalAction?.action,
        missingSupplementAction: isMissingSupplementDraft
          ? missingSupplementReadiness?.nextAction
          : undefined,
        rows,
        status
      }),
      humanOwned: true,
      label: definition.label,
      noAutoPromotion: true,
      noAutoWrite: true,
      readOnly: true,
      stage: definition.stage,
      status,
      supplements: rows.length,
      warnings
    };
  });
}

function workflowStepStatus({
  blockers,
  earliestActiveIndex,
  globalActionPresent,
  index,
  isGlobalGate,
  isMissingSupplementDraft,
  rows
}: {
  blockers: number;
  earliestActiveIndex: number;
  globalActionPresent: boolean;
  index: number;
  isGlobalGate: boolean;
  isMissingSupplementDraft: boolean;
  rows: SupplementOnboardingNextActionReport["rows"];
}): SupplementOnboardingWorkflowStepStatus {
  if (isGlobalGate) {
    return globalActionPresent ? "blocked" : "complete";
  }

  if (isMissingSupplementDraft) {
    return "blocked";
  }

  if (rows.length > 0) {
    return blockers > 0 ? "blocked" : "current";
  }

  if (index > earliestActiveIndex) {
    return "pending";
  }

  return "complete";
}

function workflowStepDetail({
  definitionDetail,
  globalAction,
  missingSupplementAction,
  rows,
  status
}: {
  definitionDetail: string;
  globalAction?: string;
  missingSupplementAction?: string;
  rows: SupplementOnboardingNextActionReport["rows"];
  status: SupplementOnboardingWorkflowStepStatus;
}) {
  if (missingSupplementAction) {
    return missingSupplementAction;
  }

  if (globalAction) {
    return globalAction;
  }

  if (rows.length > 0) {
    return `${rows.length} visible supplement(s) currently need this step. ${rows[0]?.action ?? definitionDetail}`;
  }

  if (status === "pending") {
    return `Pending until earlier onboarding stages are clear. ${definitionDetail}`;
  }

  return definitionDetail;
}

function workflowStepCommand(
  stage: SupplementOnboardingNextActionStage,
  supplementQuery?: string
) {
  const supplementArg = supplementQuery
    ? quote(supplementQuery)
    : "<supplement-id-or-slug>";

  if (stage === "source-tracking-gate") {
    return "npm run onboarding:quality -- --env-file <non-production-env-file> --summary";
  }

  if (stage === "draft-claims") {
    return supplementQuery
      ? `npm run onboard:supplement -- --name ${quote(supplementQuery)} --category <category>`
      : "npm run onboard:supplement -- --name <name> --category <category>";
  }

  if (stage === "queue-sources") {
    return `npm run onboarding:queue-sources -- --supplement ${supplementArg}`;
  }

  if (stage === "run-source-ingestion") {
    return "npm run ingest:scheduled-dry-run -- --summary";
  }

  if (stage === "review-candidates") {
    return "npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 10";
  }

  if (stage === "extract-studies" || stage === "review-claim-packet") {
    return `npm run onboarding:review-packet -- --supplement ${supplementArg}`;
  }

  if (stage === "promotion-readiness" || stage === "ready") {
    return "npm run promotion:readiness -- --summary";
  }

  return "npm run onboarding:fulltext-sources -- --summary";
}

function workflowStageIndex(stage: SupplementOnboardingNextActionStage) {
  return WORKFLOW_STEP_DEFINITIONS.findIndex((definition) => definition.stage === stage);
}

function rowMatchesSupplement(
  row: ReturnType<typeof buildSupplementOnboardingQualityDashboard>["rows"][number],
  supplementQuery: string
) {
  const query = normalizeQuery(supplementQuery);

  return [row.supplement.id, row.supplement.slug, row.supplement.name].some(
    (value) => normalizeQuery(value) === query
  );
}

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

function statusCommands({
  fullTextInventoryPath,
  fullTextNextActionCommands,
  supplementQuery
}: {
  fullTextInventoryPath?: string;
  fullTextNextActionCommands?: SupplementOnboardingStatusSummary["fullText"]["nextAction"]["commands"];
  supplementQuery?: string;
} = {}): SupplementOnboardingStatusCommand[] {
  const summaryArg = supplementQuery
    ? ` -- --supplement ${quote(supplementQuery)} --summary`
    : " -- --summary";
  const fullTextInventoryArg = fullTextInventoryPath
    ? `--inventory-file ${quote(fullTextInventoryPath)} `
    : "";
  const qualityFullTextInventoryArg = fullTextInventoryPath
    ? ` --fulltext-inventory-file ${quote(fullTextInventoryPath)}`
    : "";

  return [
    {
      command: `npm run onboarding:quality --${qualityFullTextInventoryArg} --summary`,
      label: "Quality dashboard summary",
      stage: "quality"
    },
    {
      command: `npm run onboarding:next${summaryArg}`,
      label: "Next read-only action",
      stage: "next-action"
    },
    {
      command: supplementQuery
        ? `npm run onboarding:readiness -- --supplement ${quote(supplementQuery)} --summary`
        : "npm run onboarding:readiness -- --supplement <supplement-id-or-slug> --summary",
      label: "Supplement readiness gate",
      stage: "readiness"
    },
    {
      command: `npm run onboarding:fulltext-sources -- ${fullTextInventoryArg}--summary`,
      label: "Full-text source gate",
      stage: "full-text-source-gate"
    },
    {
      command: `npm run onboarding:fulltext-sources -- ${fullTextInventoryArg}--next --summary`,
      label: "Full-text source next action",
      stage: "full-text-next-action"
    },
    {
      command: `npm run onboarding:fulltext-sources -- ${fullTextInventoryArg}--progress --summary`,
      label: "Full-text inventory progress",
      stage: "full-text-progress"
    },
    ...(fullTextInventoryPath
      ? [
          {
            command:
              `npm run onboarding:fulltext-sources -- ${fullTextInventoryArg}--write-connector-prep-kit docs/codex/onboarding`,
            label: "Full-text connector prep kit",
            stage: "full-text-connector-prep-kit" as const
          }
        ]
      : []),
    ...fullTextFixtureFollowUpStatusCommands(fullTextNextActionCommands),
    {
      command: `npm run onboarding:fulltext-sources -- ${fullTextInventoryArg}--connector-review --summary`,
      label: "Full-text connector-review draft",
      stage: "full-text-connector-review"
    },
    {
      command: `npm run onboarding:fulltext-sources -- ${fullTextInventoryArg}--connector-approval-packet --summary`,
      label: "Full-text connector approval packet",
      stage: "full-text-connector-approval"
    }
  ];
}

function fullTextFixtureFollowUpStatusCommands(
  commands: SupplementOnboardingStatusSummary["fullText"]["nextAction"]["commands"] = []
): SupplementOnboardingStatusCommand[] {
  return commands
    .filter((command) =>
      [
        "check-fixture-progress",
        "validate-fixture-starter",
        "draft-fixture-extraction"
      ].includes(command.id)
    )
    .map((command) => ({
      command: command.command,
      label: command.label,
      stage: "full-text-fixture" as const
    }));
}

function quote(value: string) {
  return JSON.stringify(value);
}
