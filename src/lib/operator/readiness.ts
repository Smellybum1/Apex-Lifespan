import { existsSync } from "node:fs";
import path from "node:path";

import { operatorAuthConfigured, type OperatorAuthEnv } from "@/lib/operator/config";

export type OperatorReadinessStatus = "ready" | "blocked" | "warning";

export interface OperatorReadinessCheck {
  detail: string;
  evidenceKeys?: string[];
  id: string;
  label: string;
  nextAction?: string;
  status: OperatorReadinessStatus;
}

export interface OperatorReadinessFiles {
  auditTrail: boolean;
  auditedActionWrappers: boolean;
  authRoute: boolean;
  browserWriteActions: boolean;
  browserWriteControls: boolean;
  bootstrapScript: boolean;
  manualQaChecklist: boolean;
  operatorPage: boolean;
  operatorSmokeScript: boolean;
  promotionReadiness: boolean;
  reviewQueue: boolean;
}

export interface OperatorReadinessContext {
  env: OperatorAuthEnv & Record<string, string | undefined>;
  files?: Partial<OperatorReadinessFiles>;
  generatedAt?: Date;
}

export interface OperatorReadinessReport {
  checks: OperatorReadinessCheck[];
  counts: Record<OperatorReadinessStatus, number>;
  generatedAt: string;
  overall: "ready" | "blocked";
  worksheet: OperatorReadinessWorksheet;
}

export interface OperatorReadinessSummary {
  blockedChecks: OperatorReadinessWorksheetItem[];
  counts: Record<OperatorReadinessStatus, number>;
  generatedAt: string;
  humanOwned: true;
  nextAction: string;
  overall: "ready" | "blocked";
  readOnly: true;
  readyEvidence: OperatorReadinessWorksheetItem[];
  readyLocalArtifacts: OperatorReadinessWorksheetItem[];
  warningChecks: OperatorReadinessWorksheetItem[];
}

export type OperatorReadinessCheckReviewStatus =
  | OperatorReadinessStatus
  | "not-found";

export interface OperatorReadinessCheckReviewPacket {
  availableCheckIds: string[];
  check: OperatorReadinessCheck | null;
  checkId: string;
  found: boolean;
  humanOwned: true;
  nextAction: string;
  readOnly: true;
  relatedCommand: OperatorReadinessCommand | null;
  status: OperatorReadinessCheckReviewStatus;
}

export interface OperatorReadinessWorksheet {
  blocked: OperatorReadinessWorksheetItem[];
  copySafeCommands: OperatorReadinessCommand[];
  humanOwned: true;
  nextOperatorAction: string;
  readyEvidence: OperatorReadinessWorksheetItem[];
  readyLocalArtifacts: OperatorReadinessWorksheetItem[];
  warnings: OperatorReadinessWorksheetItem[];
}

export interface OperatorReadinessCommand {
  command: string;
  id: string;
  label: string;
  mode: "read-only" | "dry-run";
  purpose: string;
}

export interface OperatorReadinessWorksheetItem {
  evidenceKeys?: string[];
  id: string;
  label: string;
  nextAction?: string;
}

const FILE_PATHS: Record<keyof OperatorReadinessFiles, string> = {
  auditTrail: "src/lib/operator/audit-trail.ts",
  auditedActionWrappers: "src/lib/operator/source-candidate-actions.ts",
  authRoute: "src/app/api/auth/[...nextauth]/route.ts",
  browserWriteActions: "src/lib/operator/browser-write-actions.ts",
  browserWriteControls: "src/lib/operator/browser-write-controls.ts",
  bootstrapScript: "scripts/operator-bootstrap.ts",
  manualQaChecklist: "docs/codex/operator-manual-qa-checklist.md",
  operatorPage: "src/app/operator/page.tsx",
  operatorSmokeScript: "scripts/operator-smoke.ts",
  promotionReadiness: "src/lib/operator/curation-promotion.ts",
  reviewQueue: "src/lib/operator/review-queue.ts"
};
const VERCEL_DATABASE_CONFIGURED_KEY = "APEX_VERCEL_DATABASE_CONFIGURED_AT";
const VERCEL_OPERATOR_AUTH_CONFIGURED_KEY = "APEX_VERCEL_OPERATOR_AUTH_CONFIGURED_AT";

export function buildOperatorReadinessReport(
  context: OperatorReadinessContext
): OperatorReadinessReport {
  const files = {
    ...readOperatorReadinessFiles(),
    ...context.files
  };
  const checks: OperatorReadinessCheck[] = [
    localFileCheck({
      id: "operator-page",
      label: "Protected operator page",
      pathLabel: FILE_PATHS.operatorPage,
      present: files.operatorPage
    }),
    localFileCheck({
      id: "auth-route",
      label: "Auth route",
      pathLabel: FILE_PATHS.authRoute,
      present: files.authRoute
    }),
    localFileCheck({
      id: "review-queue",
      label: "Read-only review queue",
      pathLabel: FILE_PATHS.reviewQueue,
      present: files.reviewQueue
    }),
    localFileCheck({
      id: "audit-trail",
      label: "Read-only audit trail",
      pathLabel: FILE_PATHS.auditTrail,
      present: files.auditTrail
    }),
    localFileCheck({
      id: "audited-action-wrappers",
      label: "Audited action wrappers",
      pathLabel: FILE_PATHS.auditedActionWrappers,
      present: files.auditedActionWrappers
    }),
    localFileCheck({
      id: "browser-write-control-gate",
      label: "Browser write control gate",
      pathLabel: FILE_PATHS.browserWriteControls,
      present: files.browserWriteControls
    }),
    localFileCheck({
      id: "browser-write-action-handlers",
      label: "Browser write action handlers",
      pathLabel: FILE_PATHS.browserWriteActions,
      present: files.browserWriteActions
    }),
    localFileCheck({
      id: "promotion-readiness",
      label: "Promotion readiness snapshot",
      pathLabel: FILE_PATHS.promotionReadiness,
      present: files.promotionReadiness
    }),
    localFileCheck({
      id: "operator-bootstrap",
      label: "Local operator bootstrap",
      pathLabel: FILE_PATHS.bootstrapScript,
      present: files.bootstrapScript
    }),
    localFileCheck({
      id: "manual-qa-checklist",
      label: "Manual QA checklist",
      pathLabel: FILE_PATHS.manualQaChecklist,
      present: files.manualQaChecklist
    }),
    localFileCheck({
      id: "operator-smoke",
      label: "Operator smoke helper",
      pathLabel: FILE_PATHS.operatorSmokeScript,
      present: files.operatorSmokeScript
    }),
    authConfigurationCheck(context.env),
    booleanEvidenceCheck({
      env: context.env,
      id: "active-operator",
      key: "APEX_OPERATOR_ACTIVE_ACCOUNT_READY",
      label: "Seeded active operator",
      nextAction:
        "Bootstrap or verify at least one active operator account and record APEX_OPERATOR_ACTIVE_ACCOUNT_READY=true."
    }),
    currentWriteGateCheck(context.env),
    timestampEvidenceCheck({
      env: context.env,
      id: "nonproduction-write-qa",
      key: "APEX_OPERATOR_NONPROD_WRITE_QA_AT",
      label: "Non-production write QA",
      nextAction:
        "Run operator accept/reject, claim-link, extraction, and fail-closed checks in non-production, then record APEX_OPERATOR_NONPROD_WRITE_QA_AT."
    }),
    timestampEvidenceCheck({
      env: context.env,
      id: "operator-flow-qa",
      key: "APEX_OPERATOR_FLOW_QA_REVIEWED_AT",
      label: "Manual operator-flow QA",
      nextAction:
        "Complete docs/codex/operator-manual-qa-checklist.md, then record APEX_OPERATOR_FLOW_QA_REVIEWED_AT."
    }),
    timestampEvidenceCheck({
      env: context.env,
      id: "browser-write-controls-approval",
      key: "APEX_OPERATOR_BROWSER_WRITE_CONTROLS_APPROVED_AT",
      label: "Browser write controls approval",
      nextAction:
        "Approve browser write controls only after non-production audited write QA in docs/codex/operator-manual-qa-checklist.md, then record APEX_OPERATOR_BROWSER_WRITE_CONTROLS_APPROVED_AT."
    })
  ];
  const counts = countStatuses(checks);

  return {
    checks,
    counts,
    generatedAt: (context.generatedAt ?? new Date()).toISOString(),
    overall: counts.blocked > 0 ? "blocked" : "ready",
    worksheet: operatorReadinessWorksheet(checks)
  };
}

export function summarizeOperatorReadinessCheck(
  context: OperatorReadinessContext,
  checkId: string
): OperatorReadinessCheckReviewPacket {
  const report = buildOperatorReadinessReport(context);
  const check = report.checks.find((item) => item.id === checkId) ?? null;
  const availableCheckIds = report.checks.map((item) => item.id);

  if (!check) {
    return {
      availableCheckIds,
      check: null,
      checkId,
      found: false,
      humanOwned: true,
      nextAction:
        "No operator readiness check matched this id; rerun npm run operator:readiness to inspect valid check ids.",
      readOnly: true,
      relatedCommand: null,
      status: "not-found"
    };
  }

  return {
    availableCheckIds,
    check,
    checkId,
    found: true,
    humanOwned: true,
    nextAction:
      check.nextAction ??
      "This operator readiness check is ready; rerun aggregate launch readiness before changing scope.",
    readOnly: true,
    relatedCommand:
      report.worksheet.copySafeCommands.find(
        (command) => command.id === "operator-readiness"
      ) ?? null,
    status: check.status
  };
}

export function summarizeOperatorReadinessReport(
  report: OperatorReadinessReport
): OperatorReadinessSummary {
  return {
    blockedChecks: report.worksheet.blocked,
    counts: report.counts,
    generatedAt: report.generatedAt,
    humanOwned: true,
    nextAction: report.worksheet.nextOperatorAction,
    overall: report.overall,
    readOnly: true,
    readyEvidence: report.worksheet.readyEvidence,
    readyLocalArtifacts: report.worksheet.readyLocalArtifacts,
    warningChecks: report.worksheet.warnings
  };
}

export function readOperatorReadinessFiles(cwd = process.cwd()): OperatorReadinessFiles {
  return {
    auditTrail: existsSync(path.join(cwd, FILE_PATHS.auditTrail)),
    auditedActionWrappers: existsSync(path.join(cwd, FILE_PATHS.auditedActionWrappers)),
    authRoute: existsSync(path.join(cwd, FILE_PATHS.authRoute)),
    browserWriteActions: existsSync(path.join(cwd, FILE_PATHS.browserWriteActions)),
    browserWriteControls: existsSync(path.join(cwd, FILE_PATHS.browserWriteControls)),
    bootstrapScript: existsSync(path.join(cwd, FILE_PATHS.bootstrapScript)),
    manualQaChecklist: existsSync(path.join(cwd, FILE_PATHS.manualQaChecklist)),
    operatorPage: existsSync(path.join(cwd, FILE_PATHS.operatorPage)),
    operatorSmokeScript: existsSync(path.join(cwd, FILE_PATHS.operatorSmokeScript)),
    promotionReadiness: existsSync(path.join(cwd, FILE_PATHS.promotionReadiness)),
    reviewQueue: existsSync(path.join(cwd, FILE_PATHS.reviewQueue))
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
}): OperatorReadinessCheck {
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
    nextAction: `Restore or implement ${pathLabel} before operator-flow QA.`
  };
}

function authConfigurationCheck(env: OperatorReadinessContext["env"]): OperatorReadinessCheck {
  const missing = ["DATABASE_URL", "AUTH_SECRET", "AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET"].filter(
    (key) => !readEnv(env, key)
  );
  const vercelDatabaseConfiguredAt = readEnv(env, VERCEL_DATABASE_CONFIGURED_KEY);
  const vercelOperatorAuthConfiguredAt = readEnv(env, VERCEL_OPERATOR_AUTH_CONFIGURED_KEY);

  if (operatorAuthConfigured(env)) {
    return {
      id: "operator-auth-config",
      label: "Database-backed GitHub auth",
      status: "ready",
      detail: "Required operator auth variables are configured.",
      evidenceKeys: ["DATABASE_URL", "AUTH_SECRET", "AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET"]
    };
  }

  if (vercelDatabaseConfiguredAt && vercelOperatorAuthConfiguredAt) {
    return {
      id: "operator-auth-config",
      label: "Database-backed GitHub auth",
      status: "ready",
      detail:
        "Vercel dashboard database and operator auth evidence are recorded; secret values remain dashboard-managed.",
      evidenceKeys: [VERCEL_DATABASE_CONFIGURED_KEY, VERCEL_OPERATOR_AUTH_CONFIGURED_KEY]
    };
  }

  return {
    id: "operator-auth-config",
    label: "Database-backed GitHub auth",
    status: "blocked",
    detail: `Missing operator auth variables: ${missing.join(", ")}.`,
    evidenceKeys: [
      "DATABASE_URL",
      "AUTH_SECRET",
      "AUTH_GITHUB_ID",
      "AUTH_GITHUB_SECRET",
      VERCEL_DATABASE_CONFIGURED_KEY,
      VERCEL_OPERATOR_AUTH_CONFIGURED_KEY
    ],
    nextAction:
      "Configure database-backed GitHub OAuth in a non-production environment, or record APEX_VERCEL_DATABASE_CONFIGURED_AT and APEX_VERCEL_OPERATOR_AUTH_CONFIGURED_AT after dashboard review, before manual operator-flow QA."
  };
}

function booleanEvidenceCheck({
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
}): OperatorReadinessCheck {
  if (readEnv(env, key)?.toLowerCase() === "true") {
    return {
      id,
      label,
      status: "ready",
      detail: `${key}=true.`,
      evidenceKeys: [key]
    };
  }

  return {
    id,
    label,
    status: "blocked",
    detail: `Missing operator evidence variable: ${key}.`,
    evidenceKeys: [key],
    nextAction
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
}): OperatorReadinessCheck {
  if (readEnv(env, key)) {
    return {
      id,
      label,
      status: "ready",
      detail: `${key} is recorded.`,
      evidenceKeys: [key]
    };
  }

  return {
    id,
    label,
    status: "blocked",
    detail: `Missing operator evidence variable: ${key}.`,
    evidenceKeys: [key],
    nextAction
  };
}

function currentWriteGateCheck(env: Record<string, string | undefined>): OperatorReadinessCheck {
  if (readEnv(env, "APEX_OPERATOR_WRITES_ENABLED") === "true") {
    return {
      id: "operator-write-gate",
      label: "Current write gate",
      status: "warning",
      detail: "APEX_OPERATOR_WRITES_ENABLED=true in the current environment.",
      evidenceKeys: ["APEX_OPERATOR_WRITES_ENABLED"],
      nextAction:
        "Use this only for controlled non-production QA; keep public production writes disabled until launch approval."
    };
  }

  return {
    id: "operator-write-gate",
    label: "Current write gate",
    status: "ready",
    detail: "Operator writes are disabled in the current environment."
  };
}

function operatorReadinessWorksheet(
  checks: OperatorReadinessCheck[]
): OperatorReadinessWorksheet {
  const localArtifactIds = new Set([
    "operator-page",
    "auth-route",
    "review-queue",
    "audit-trail",
    "audited-action-wrappers",
    "browser-write-control-gate",
    "browser-write-action-handlers",
    "promotion-readiness",
    "operator-bootstrap",
    "manual-qa-checklist",
    "operator-smoke"
  ]);
  const blocked = checks
    .filter((check) => check.status === "blocked")
    .map(operatorReadinessWorksheetItem);
  const warnings = checks
    .filter((check) => check.status === "warning")
    .map(operatorReadinessWorksheetItem);
  const readyLocalArtifacts = checks
    .filter((check) => check.status === "ready" && localArtifactIds.has(check.id))
    .map(operatorReadinessWorksheetItem);
  const readyEvidence = checks
    .filter((check) => check.status === "ready" && !localArtifactIds.has(check.id))
    .map(operatorReadinessWorksheetItem);

  return {
    blocked,
    copySafeCommands: operatorReadinessCopySafeCommands(),
    humanOwned: true,
    nextOperatorAction:
      blocked[0]?.nextAction ??
      warnings[0]?.nextAction ??
      "Operator workflow evidence is ready; review launch readiness before enabling production writes.",
    readyEvidence,
    readyLocalArtifacts,
    warnings
  };
}

function operatorReadinessCopySafeCommands(): OperatorReadinessCommand[] {
  return [
    {
      command: "npm run operator:readiness",
      id: "operator-readiness",
      label: "Refresh operator readiness",
      mode: "read-only",
      purpose: "Recheck operator auth, local artifacts, and manual QA evidence without printing secret values."
    },
    {
      command: "npm run operator:readiness -- --summary",
      id: "operator-readiness-summary",
      label: "Refresh compact operator summary",
      mode: "read-only",
      purpose:
        "Print compact operator readiness counts, blockers, warnings, and the next action without dumping all checks."
    },
    {
      command: "npm run operator:readiness -- --check <check-id>",
      id: "operator-readiness-check",
      label: "Focus one operator readiness check",
      mode: "read-only",
      purpose:
        "Print one operator readiness check with its evidence keys and next action for auth or QA setup."
    },
    {
      command: "npm run operator:smoke -- <base-url>",
      id: "operator-smoke-closed",
      label: "Smoke anonymous operator boundary",
      mode: "read-only",
      purpose: "Verify /operator stays closed to anonymous users and does not expose review content."
    },
    {
      command: "npm run operator:smoke -- <base-url> --expect-auth-unavailable",
      id: "operator-smoke-auth-unavailable",
      label: "Smoke auth-unavailable operator boundary",
      mode: "read-only",
      purpose: "Verify an environment without auth secrets shows the closed auth-unavailable state."
    },
    {
      command: "npm run operator:smoke -- <base-url> --expect-auth-required",
      id: "operator-smoke-auth-required",
      label: "Smoke auth-required operator boundary",
      mode: "read-only",
      purpose: "Verify configured auth shows the closed sign-in-required state before operator login."
    },
    {
      command:
        'npm run operator:bootstrap -- --email operator@example.com --role REVIEWER --note "Non-production operator QA bootstrap"',
      id: "operator-bootstrap-plan",
      label: "Plan operator bootstrap",
      mode: "dry-run",
      purpose: "Preview a local operator account bootstrap plan without writing to the database."
    },
    {
      command: "npm run launch:readiness",
      id: "launch-readiness",
      label: "Refresh aggregate launch readiness",
      mode: "read-only",
      purpose: "Recheck fully-live launch gates after operator evidence changes."
    }
  ];
}

function operatorReadinessWorksheetItem(
  check: OperatorReadinessCheck
): OperatorReadinessWorksheetItem {
  return {
    evidenceKeys: check.evidenceKeys,
    id: check.id,
    label: check.label,
    nextAction: check.nextAction
  };
}

function countStatuses(checks: OperatorReadinessCheck[]) {
  return checks.reduce(
    (counts, check) => ({
      ...counts,
      [check.status]: counts[check.status] + 1
    }),
    {
      blocked: 0,
      ready: 0,
      warning: 0
    } satisfies Record<OperatorReadinessStatus, number>
  );
}

function readEnv(env: Record<string, string | undefined>, key: string) {
  const value = env[key];
  return value && value.trim() ? value.trim() : undefined;
}
