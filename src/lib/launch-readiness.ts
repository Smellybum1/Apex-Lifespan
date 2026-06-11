import type { EvidenceCoverageSummary } from "@/lib/evidence-coverage";
import type { OperationsReadinessReport } from "@/lib/operations-readiness";
import type { SourceCandidatePromotionReadinessSnapshot } from "@/lib/operator/curation-promotion";
import type { OperatorReadinessReport } from "@/lib/operator/readiness";
import type { ProductionReadinessReport } from "@/lib/production-readiness";

export type LaunchReadinessStatus = "ready" | "blocked" | "warning";

export interface LaunchReadinessCheck {
  blockerIds?: string[];
  detail: string;
  evidenceKeys?: string[];
  id: string;
  label: string;
  nextAction?: string;
  status: LaunchReadinessStatus;
}

export interface LaunchReadinessEvidenceCoverage {
  dataSource: string;
  report?: EvidenceCoverageSummary;
  unavailable?: boolean;
}

export interface LaunchReadinessPromotion {
  snapshot?: SourceCandidatePromotionReadinessSnapshot;
  unavailable?: boolean;
}

export interface LaunchReadinessScheduledIngestion {
  hostedCronReady?: boolean;
  hostedRunGateReady?: boolean;
  missingEnv?: string[];
  noAutoPromotion?: boolean;
  retryAutomationReady?: boolean;
  unavailable?: boolean;
}

export interface LaunchReadinessFiles {
  launchChecklist: boolean;
  postLaunchReviewTemplate: boolean;
}

export interface LaunchReadinessContext {
  env: Record<string, string | undefined>;
  evidenceCoverage: LaunchReadinessEvidenceCoverage;
  files: LaunchReadinessFiles;
  generatedAt?: Date;
  operations: OperationsReadinessReport;
  operator: OperatorReadinessReport;
  production: ProductionReadinessReport;
  promotion: LaunchReadinessPromotion;
  scheduledIngestion: LaunchReadinessScheduledIngestion;
}

export interface LaunchReadinessReport {
  checks: LaunchReadinessCheck[];
  counts: Record<LaunchReadinessStatus, number>;
  generatedAt: string;
  nextAction: string;
  overall: "ready" | "blocked";
  worksheet: LaunchReadinessWorksheet;
}

export interface LaunchReadinessSummary {
  blockedGates: LaunchReadinessWorksheetItem[];
  counts: Record<LaunchReadinessStatus, number>;
  generatedAt: string;
  humanOwned: true;
  nextAction: string;
  overall: "ready" | "blocked";
  readOnly: true;
  readyGates: LaunchReadinessWorksheetItem[];
  warningGates: LaunchReadinessWorksheetItem[];
}

export interface LaunchReadinessWorksheet {
  blockedGates: LaunchReadinessWorksheetItem[];
  copySafeCommands: LaunchReadinessCommand[];
  humanOwned: true;
  nextLaunchAction: string;
  readyGates: LaunchReadinessWorksheetItem[];
  warningGates: LaunchReadinessWorksheetItem[];
}

export interface LaunchReadinessCommand {
  command: string;
  id: string;
  label: string;
  mode: "read-only";
  purpose: string;
}

export interface LaunchReadinessWorksheetItem {
  blockerIds?: string[];
  evidenceKeys?: string[];
  id: string;
  label: string;
  nextAction?: string;
}

const PUBLIC_SMOKE_KEY = "APEX_PUBLIC_SMOKE_PASSED_AT";
const ADMIN_FLOW_SMOKE_KEY = "APEX_ADMIN_FLOW_SMOKE_PASSED_AT";
const LAUNCH_APPROVAL_KEY = "APEX_FULLY_LIVE_LAUNCH_APPROVED_AT";
const POST_LAUNCH_REVIEW_KEY = "APEX_POST_LAUNCH_REVIEW_SCHEDULED_AT";
export const FULLY_LIVE_LAUNCH_CHECKLIST_PATH =
  "docs/codex/fully-live-launch-checklist.md";
export const POST_LAUNCH_REVIEW_TEMPLATE_PATH =
  "docs/codex/post-launch-review-template.md";

export function buildLaunchReadinessReport(
  context: LaunchReadinessContext
): LaunchReadinessReport {
  const checks: LaunchReadinessCheck[] = [
    localFileCheck({
      id: "fully-live-launch-checklist",
      label: "Fully-live launch checklist",
      pathLabel: FULLY_LIVE_LAUNCH_CHECKLIST_PATH,
      present: context.files.launchChecklist
    }),
    localFileCheck({
      id: "post-launch-review-template",
      label: "Post-launch review template",
      pathLabel: POST_LAUNCH_REVIEW_TEMPLATE_PATH,
      present: context.files.postLaunchReviewTemplate
    }),
    nestedReadinessCheck({
      id: "production-readiness",
      label: "Production data and secrets",
      report: context.production
    }),
    nestedReadinessCheck({
      id: "operator-readiness",
      label: "Authenticated operator workflow",
      report: context.operator
    }),
    nestedReadinessCheck({
      id: "operations-readiness",
      label: "Operations evidence",
      report: context.operations
    }),
    scheduledIngestionCheck(context.scheduledIngestion),
    promotionReadinessCheck(context.promotion),
    evidenceCoverageCheck(context.evidenceCoverage),
    timestampEvidenceCheck({
      env: context.env,
      id: "public-smoke",
      key: PUBLIC_SMOKE_KEY,
      label: "Public smoke",
      nextAction:
        "Run public smoke against the fully-live production URL and record APEX_PUBLIC_SMOKE_PASSED_AT."
    }),
    timestampEvidenceCheck({
      env: context.env,
      id: "admin-flow-smoke",
      key: ADMIN_FLOW_SMOKE_KEY,
      label: "Admin flow smoke",
      nextAction:
        "Smoke the authenticated operator flow in the launch environment and record APEX_ADMIN_FLOW_SMOKE_PASSED_AT."
    }),
    timestampEvidenceCheck({
      env: context.env,
      id: "launch-approval",
      key: LAUNCH_APPROVAL_KEY,
      label: "Launch approval",
      nextAction:
        "Approve the fully-live launch only after production data, operator, ingestion, operations, smoke, and rollback evidence are ready."
    }),
    timestampEvidenceCheck({
      env: context.env,
      id: "post-launch-review",
      key: POST_LAUNCH_REVIEW_KEY,
      label: "Post-launch review scheduled",
      nextAction:
        "Schedule the 24-48 hour post-launch review and record APEX_POST_LAUNCH_REVIEW_SCHEDULED_AT."
    })
  ];
  const counts = countStatuses(checks);
  const firstBlocked = checks.find((check) => check.status === "blocked");
  const nextAction =
    firstBlocked?.nextAction ??
    "All launch readiness gates are ready; proceed with the launch checklist.";

  return {
    checks,
    counts,
    generatedAt: (context.generatedAt ?? new Date()).toISOString(),
    nextAction,
    overall: counts.blocked > 0 ? "blocked" : "ready",
    worksheet: launchReadinessWorksheet(checks, nextAction)
  };
}

export function summarizeLaunchReadinessReport(
  report: LaunchReadinessReport
): LaunchReadinessSummary {
  return {
    blockedGates: report.worksheet.blockedGates,
    counts: report.counts,
    generatedAt: report.generatedAt,
    humanOwned: true,
    nextAction: report.nextAction,
    overall: report.overall,
    readOnly: true,
    readyGates: report.worksheet.readyGates,
    warningGates: report.worksheet.warningGates
  };
}

function localFileCheck({
  id,
  label,
  pathLabel,
  present
}: {
  id: string;
  label: string;
  pathLabel: string;
  present: boolean;
}): LaunchReadinessCheck {
  if (present) {
    return {
      id,
      label,
      status: "ready",
      detail: `${pathLabel} is present.`
    };
  }

  return {
    id,
    label,
    status: "blocked",
    detail: `${pathLabel} is missing.`,
    nextAction: `Create ${pathLabel} before launch approval.`
  };
}

function nestedReadinessCheck({
  id,
  label,
  report
}: {
  id: string;
  label: string;
  report: {
    checks: Array<{ id: string; status: string }>;
    counts: Record<string, number>;
    overall: string;
    worksheet?: {
      nextEvidenceAction?: string;
      nextOperatorAction?: string;
    };
  };
}): LaunchReadinessCheck {
  const blockedIds = report.checks
    .filter((check) => check.status === "blocked")
    .map((check) => check.id);
  const warningCount = report.counts.warning ?? 0;

  if (report.overall === "ready") {
    return {
      id,
      label,
      status: warningCount > 0 ? "warning" : "ready",
      detail:
        warningCount > 0
          ? `Nested report is ready with ${warningCount} warning(s).`
          : "Nested report is ready."
    };
  }

  return {
    blockerIds: blockedIds,
    id,
    label,
    status: "blocked",
    detail: `Nested report is blocked by ${blockedIds.length} check(s).`,
    nextAction:
      report.worksheet?.nextOperatorAction ??
      report.worksheet?.nextEvidenceAction ??
      `Resolve blocked ${label.toLowerCase()} checks before launch.`
  };
}

function scheduledIngestionCheck(
  scheduledIngestion: LaunchReadinessScheduledIngestion
): LaunchReadinessCheck {
  if (scheduledIngestion.unavailable) {
    return {
      id: "scheduled-ingestion",
      label: "Scheduled source ingestion",
      status: "blocked",
      detail: "Scheduled ingestion dry-run evidence is unavailable.",
      nextAction: "Run npm run ingest:scheduled-dry-run successfully before launch."
    };
  }

  const blockers = [
    ...(scheduledIngestion.hostedCronReady ? [] : ["hosted-cron"]),
    ...(scheduledIngestion.hostedRunGateReady ? [] : ["hosted-run-gate"]),
    ...(scheduledIngestion.retryAutomationReady ? [] : ["retry-policy"]),
    ...(scheduledIngestion.noAutoPromotion ? [] : ["no-auto-promotion"])
  ];

  if (blockers.length === 0) {
    return {
      id: "scheduled-ingestion",
      label: "Scheduled source ingestion",
      status: "ready",
      detail:
        "Hosted cron, hosted-run gate, retry policy, and no-auto-promotion evidence are ready."
    };
  }

  return {
    blockerIds: blockers,
    id: "scheduled-ingestion",
    label: "Scheduled source ingestion",
    status: "blocked",
    detail: `Scheduled ingestion is blocked by ${blockers.join(", ")}.`,
    nextAction:
      (scheduledIngestion.missingEnv?.length ?? 0) > 0
        ? `Configure scheduled ingestion evidence: ${scheduledIngestion.missingEnv?.join(", ")}.`
        : blockers.includes("hosted-run-gate")
          ? "Refresh scheduled ingestion dry-run and verify the hosted-run gate before launch."
        : "Review scheduled ingestion retry policy before launch."
  };
}

function promotionReadinessCheck(
  promotion: LaunchReadinessPromotion
): LaunchReadinessCheck {
  const snapshot = promotion.snapshot;

  if (!snapshot || promotion.unavailable) {
    return {
      id: "promotion-readiness",
      label: "Human-reviewed promotion",
      status: "blocked",
      detail: "Promotion readiness snapshot is unavailable.",
      nextAction: "Run promotion readiness from the operator/local database context before launch."
    };
  }

  if (snapshot.total > 0 && snapshot.blockedCount === 0) {
    return {
      id: "promotion-readiness",
      label: "Human-reviewed promotion",
      status: "ready",
      detail: `${snapshot.readyCount}/${snapshot.total} accepted candidate(s) are promotion-ready.`
    };
  }

  return {
    blockerIds: snapshot.rows.filter((row) => !row.ready).map((row) => row.candidate.dedupeKey),
    id: "promotion-readiness",
    label: "Human-reviewed promotion",
    status: "blocked",
    detail:
      snapshot.total === 0
        ? "No accepted candidate promotion snapshot rows were found."
        : `${snapshot.blockedCount}/${snapshot.total} accepted candidate(s) still have promotion blockers.`,
    nextAction:
      "Complete claim link, structured extraction, source-packet readiness, and human review before promotion."
  };
}

function evidenceCoverageCheck(
  evidenceCoverage: LaunchReadinessEvidenceCoverage
): LaunchReadinessCheck {
  const report = evidenceCoverage.report;

  if (!report || evidenceCoverage.unavailable) {
    return {
      id: "evidence-coverage",
      label: "Reviewed evidence coverage",
      status: "blocked",
      detail: "Evidence coverage summary is unavailable.",
      nextAction: "Run npm run coverage:review successfully before launch."
    };
  }

  const blockers = [
    ...(evidenceCoverage.dataSource === "database" ? [] : ["database-data-source"]),
    ...(report.humanReviewedClaims > 0 ? [] : ["human-reviewed-claims"]),
    ...(report.claimReviewBacklog.length === 0 ? [] : ["claim-review-backlog"]),
    ...(report.interventionGaps.length === 0 ? [] : ["intervention-gaps"])
  ];

  if (blockers.length === 0) {
    return {
      id: "evidence-coverage",
      label: "Reviewed evidence coverage",
      status: "ready",
      detail: `${report.humanReviewedClaims}/${report.totalClaims} claim(s) are human-reviewed with no intervention gaps.`
    };
  }

  return {
    blockerIds: blockers,
    id: "evidence-coverage",
    label: "Reviewed evidence coverage",
    status: "blocked",
    detail: `${report.humanReviewedClaims}/${report.totalClaims} claim(s) are human-reviewed; ${report.claimReviewBacklog.length} review backlog item(s), ${report.interventionGaps.length} intervention gap(s), data source ${evidenceCoverage.dataSource}.`,
    nextAction:
      "Complete human evidence review and database-backed coverage before treating coverage as launch-ready."
  };
}

function timestampEvidenceCheck({
  env,
  id,
  key,
  label,
  nextAction
}: {
  env: Record<string, string | undefined>;
  id: string;
  key: string;
  label: string;
  nextAction: string;
}): LaunchReadinessCheck {
  if (readEnv(env, key)) {
    return {
      evidenceKeys: [key],
      id,
      label,
      status: "ready",
      detail: `${key} is recorded.`
    };
  }

  return {
    evidenceKeys: [key],
    id,
    label,
    status: "blocked",
    detail: `Missing launch evidence variable: ${key}.`,
    nextAction
  };
}

function countStatuses(checks: LaunchReadinessCheck[]) {
  return checks.reduce(
    (counts, check) => ({
      ...counts,
      [check.status]: counts[check.status] + 1
    }),
    {
      blocked: 0,
      ready: 0,
      warning: 0
    } satisfies Record<LaunchReadinessStatus, number>
  );
}

function launchReadinessWorksheet(
  checks: LaunchReadinessCheck[],
  nextAction: string
): LaunchReadinessWorksheet {
  return {
    blockedGates: checks
      .filter((check) => check.status === "blocked")
      .map(launchReadinessWorksheetItem),
    copySafeCommands: launchReadinessCopySafeCommands(),
    humanOwned: true,
    nextLaunchAction: nextAction,
    readyGates: checks
      .filter((check) => check.status === "ready")
      .map(launchReadinessWorksheetItem),
    warningGates: checks
      .filter((check) => check.status === "warning")
      .map(launchReadinessWorksheetItem)
  };
}

function launchReadinessCopySafeCommands(): LaunchReadinessCommand[] {
  return [
    {
      command: "npm run launch:readiness",
      id: "launch-readiness",
      label: "Refresh aggregate launch readiness",
      mode: "read-only",
      purpose:
        "Recheck production, operator, operations, ingestion, promotion, coverage, smoke, and launch evidence gates."
    },
    {
      command: "npm run launch:readiness -- --summary",
      id: "launch-readiness-summary",
      label: "Refresh compact launch summary",
      mode: "read-only",
      purpose:
        "Print a compact launch status with counts, blocked gates, ready gates, and the next action."
    },
    {
      command: "npm run production:readiness",
      id: "production-readiness",
      label: "Refresh production readiness",
      mode: "read-only",
      purpose:
        "Recheck managed database, migration rehearsal, Vercel project, and secret evidence without printing secret values."
    },
    {
      command: "npm run operator:readiness",
      id: "operator-readiness",
      label: "Refresh operator readiness",
      mode: "read-only",
      purpose:
        "Recheck GitHub OAuth, active operator, manual QA, and browser-write-control evidence without enabling writes."
    },
    {
      command: "npm run operations:readiness",
      id: "operations-readiness",
      label: "Refresh operations readiness",
      mode: "read-only",
      purpose:
        "Recheck monitoring, alert, backup, restore, rollback, privacy, terms, and runbook evidence."
    },
    {
      command: "npm run ingest:scheduled-dry-run",
      id: "scheduled-ingestion-dry-run",
      label: "Refresh scheduled ingestion dry run",
      mode: "read-only",
      purpose:
        "Recheck hosted-cron, retry-policy, queue, dedupe, and no-auto-promotion readiness without running jobs."
    },
    {
      command: "npm run coverage:review",
      id: "coverage-review",
      label: "Refresh evidence coverage review",
      mode: "read-only",
      purpose:
        "Recheck human-reviewed coverage, review backlog, source-packet readiness, and intervention gaps."
    },
    {
      command: "npm run promotion:dry-run -- --pmid <pmid>",
      id: "promotion-dry-run",
      label: "Dry-run accepted candidate promotion",
      mode: "read-only",
      purpose:
        "Inspect promotion blockers for an accepted PubMed candidate before any explicit human promotion decision."
    },
    {
      command: "npm run smoke:public-mvp -- <fully-live-url>",
      id: "public-smoke",
      label: "Smoke fully-live public routes",
      mode: "read-only",
      purpose:
        "Verify the public URL, legal pages, security headers, health endpoint, and live-source preview guards."
    },
    {
      command: "npm run operator:smoke -- <fully-live-url>",
      id: "operator-anonymous-smoke",
      label: "Smoke anonymous operator boundary",
      mode: "read-only",
      purpose:
        "Verify anonymous visitors cannot see operator queues, audit content, promotion controls, or write controls."
    }
  ];
}

function launchReadinessWorksheetItem(
  check: LaunchReadinessCheck
): LaunchReadinessWorksheetItem {
  return {
    blockerIds: check.blockerIds,
    evidenceKeys: check.evidenceKeys,
    id: check.id,
    label: check.label,
    nextAction: check.nextAction
  };
}

function readEnv(env: Record<string, string | undefined>, key: string) {
  const value = env[key];
  return value && value.trim() ? value.trim() : undefined;
}
