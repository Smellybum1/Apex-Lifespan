import { existsSync } from "node:fs";
import path from "node:path";

export type OperationsReadinessStatus = "ready" | "blocked";

export interface OperationsReadinessCheck {
  detail: string;
  evidenceKeys?: string[];
  id: string;
  label: string;
  nextAction?: string;
  status: OperationsReadinessStatus;
}

export interface OperationsReadinessContext {
  env: Record<string, string | undefined>;
  files?: Partial<OperationsReadinessFiles>;
  generatedAt?: Date;
}

export interface OperationsReadinessFiles {
  healthEndpoint: boolean;
  operationsDrillChecklist: boolean;
  operationsRunbook: boolean;
  privacyPage: boolean;
  termsPage: boolean;
}

export interface OperationsReadinessReport {
  checks: OperationsReadinessCheck[];
  counts: Record<OperationsReadinessStatus, number>;
  generatedAt: string;
  overall: "ready" | "blocked";
  worksheet: OperationsReadinessWorksheet;
}

export type OperationsEvidenceReviewStatus = "blocked" | "not-found" | "ready";

export interface OperationsEvidenceReviewPacket {
  availableEvidenceIds: string[];
  check: OperationsReadinessCheck | null;
  evidenceId: string;
  found: boolean;
  humanOwned: true;
  nextAction: string;
  readOnly: true;
  relatedCommand: OperationsReadinessCommand | null;
  status: OperationsEvidenceReviewStatus;
}

export interface OperationsReadinessWorksheet {
  copySafeCommands: OperationsReadinessCommand[];
  humanOwned: true;
  missingExternalEvidence: OperationsEvidenceWorksheetItem[];
  nextEvidenceAction: string;
  readyExternalEvidence: OperationsEvidenceWorksheetItem[];
  readyLocalArtifacts: OperationsEvidenceWorksheetItem[];
}

export interface OperationsReadinessCommand {
  command: string;
  id: string;
  label: string;
  mode: "read-only";
  purpose: string;
}

export interface OperationsEvidenceWorksheetItem {
  evidenceKeys?: string[];
  id: string;
  label: string;
  nextAction?: string;
}

type MonitoringUrlCheck =
  | {
      ok: true;
      sanitizedUrl: string;
    }
  | {
      ok: false;
      reason: string;
    };

const DEFAULT_FILE_PATHS: Record<keyof OperationsReadinessFiles, string> = {
  healthEndpoint: "src/app/api/health/route.ts",
  operationsDrillChecklist: "docs/codex/operations-drill-checklist.md",
  operationsRunbook: "docs/codex/operations-runbook.md",
  privacyPage: "src/app/privacy/page.tsx",
  termsPage: "src/app/terms/page.tsx"
};

export function buildOperationsReadinessReport(
  context: OperationsReadinessContext
): OperationsReadinessReport {
  const files = {
    ...readOperationsReadinessFiles(),
    ...context.files
  };

  const checks: OperationsReadinessCheck[] = [
    localFileCheck({
      id: "privacy-page",
      label: "Privacy page",
      present: files.privacyPage,
      pathLabel: DEFAULT_FILE_PATHS.privacyPage
    }),
    localFileCheck({
      id: "terms-page",
      label: "Terms page",
      present: files.termsPage,
      pathLabel: DEFAULT_FILE_PATHS.termsPage
    }),
    localFileCheck({
      id: "operations-runbook",
      label: "Operations runbook",
      present: files.operationsRunbook,
      pathLabel: DEFAULT_FILE_PATHS.operationsRunbook
    }),
    localFileCheck({
      id: "operations-drill-checklist",
      label: "Operations drill checklist",
      present: files.operationsDrillChecklist,
      pathLabel: DEFAULT_FILE_PATHS.operationsDrillChecklist
    }),
    localFileCheck({
      id: "health-endpoint",
      label: "Public health endpoint",
      present: files.healthEndpoint,
      pathLabel: DEFAULT_FILE_PATHS.healthEndpoint
    }),
    uptimeMonitoringCheck(context.env),
    configuredFlagCheck({
      env: context.env,
      id: "error-monitoring",
      key: "APEX_ERROR_MONITORING_PROJECT",
      label: "Error monitoring",
      nextAction:
        "Configure server/API error monitoring and record the project identifier in APEX_ERROR_MONITORING_PROJECT."
    }),
    booleanFlagCheck({
      env: context.env,
      id: "deployment-alerts",
      key: "APEX_DEPLOYMENT_ALERTS_CONFIGURED",
      label: "Deployment alerts",
      nextAction: "Enable Vercel deployment failure alerts and set APEX_DEPLOYMENT_ALERTS_CONFIGURED=true."
    }),
    booleanFlagCheck({
      env: context.env,
      id: "scheduled-ingestion-alerts",
      key: "APEX_INGESTION_ALERTS_CONFIGURED",
      label: "Scheduled ingestion alerts",
      nextAction:
        "Configure hosted ingestion failure alerts before enabling unattended scheduled ingestion."
    }),
    booleanFlagCheck({
      env: context.env,
      id: "database-backups",
      key: "APEX_DATABASE_BACKUPS_CONFIGURED",
      label: "Database backups",
      nextAction: "Enable managed database backup/PITR coverage and set APEX_DATABASE_BACKUPS_CONFIGURED=true."
    }),
    timestampEvidenceCheck({
      env: context.env,
      id: "backup-restore-rehearsal",
      key: "APEX_BACKUP_RESTORE_REHEARSED_AT",
      label: "Backup restore rehearsal",
      nextAction:
        "Rehearse a restore into a non-production database and record the timestamp in APEX_BACKUP_RESTORE_REHEARSED_AT."
    }),
    timestampEvidenceCheck({
      env: context.env,
      id: "rollback-drill",
      key: "APEX_ROLLBACK_DRILL_REHEARSED_AT",
      label: "Rollback drill",
      nextAction:
        "Run an app/data rollback drill and record the timestamp in APEX_ROLLBACK_DRILL_REHEARSED_AT."
    }),
    timestampEvidenceCheck({
      env: context.env,
      id: "alert-test",
      key: "APEX_ALERT_TESTED_AT",
      label: "Alert test",
      nextAction: "Send or trigger a launch alert test and record the timestamp in APEX_ALERT_TESTED_AT."
    })
  ];
  const counts = countStatuses(checks);

  return {
    checks,
    counts,
    generatedAt: (context.generatedAt ?? new Date()).toISOString(),
    overall: counts.blocked > 0 ? "blocked" : "ready",
    worksheet: operationsReadinessWorksheet(checks)
  };
}

export function summarizeOperationsEvidenceReview(
  context: OperationsReadinessContext,
  evidenceId: string
): OperationsEvidenceReviewPacket {
  const report = buildOperationsReadinessReport(context);
  const check = report.checks.find((item) => item.id === evidenceId) ?? null;
  const availableEvidenceIds = report.checks.map((item) => item.id);

  if (!check) {
    return {
      availableEvidenceIds,
      check: null,
      evidenceId,
      found: false,
      humanOwned: true,
      nextAction:
        "No operations evidence item matched this id; rerun npm run operations:readiness to inspect valid evidence ids.",
      readOnly: true,
      relatedCommand: null,
      status: "not-found"
    };
  }

  return {
    availableEvidenceIds,
    check,
    evidenceId,
    found: true,
    humanOwned: true,
    nextAction:
      check.nextAction ??
      "This operations evidence item is ready; rerun aggregate launch readiness before changing scope.",
    readOnly: true,
    relatedCommand:
      report.worksheet.copySafeCommands.find(
        (command) => command.id === "operations-readiness"
      ) ?? null,
    status: check.status
  };
}

export function readOperationsReadinessFiles(
  cwd = process.cwd()
): OperationsReadinessFiles {
  return {
    healthEndpoint: existsSync(path.join(cwd, DEFAULT_FILE_PATHS.healthEndpoint)),
    operationsDrillChecklist: existsSync(
      path.join(cwd, DEFAULT_FILE_PATHS.operationsDrillChecklist)
    ),
    operationsRunbook: existsSync(path.join(cwd, DEFAULT_FILE_PATHS.operationsRunbook)),
    privacyPage: existsSync(path.join(cwd, DEFAULT_FILE_PATHS.privacyPage)),
    termsPage: existsSync(path.join(cwd, DEFAULT_FILE_PATHS.termsPage))
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
}): OperationsReadinessCheck {
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
    nextAction: `Restore or create ${pathLabel} before launch evidence review.`
  };
}

function uptimeMonitoringCheck(
  env: Record<string, string | undefined>
): OperationsReadinessCheck {
  const key = "APEX_UPTIME_MONITORING_URL";
  const value = readEnv(env, key);

  if (!value) {
    return missingEvidenceCheck({
      id: "uptime-monitoring",
      key,
      label: "Uptime monitoring",
      nextAction:
        "Configure uptime monitoring for /api/health and record its URL in APEX_UPTIME_MONITORING_URL."
    });
  }

  const parsedUrl = validateMonitoringUrl(value);

  if (!parsedUrl.ok) {
    return {
      id: "uptime-monitoring",
      label: "Uptime monitoring",
      status: "blocked",
      detail: parsedUrl.reason,
      evidenceKeys: [key],
      nextAction:
        "Record a sanitized http(s) uptime monitor URL without credentials, query strings, fragments, or local hosts."
    };
  }

  return {
    id: "uptime-monitoring",
    label: "Uptime monitoring",
    status: "ready",
    detail: `Uptime monitoring evidence is configured at ${parsedUrl.sanitizedUrl}.`,
    evidenceKeys: [key]
  };
}

function configuredFlagCheck({
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
}): OperationsReadinessCheck {
  if (readEnv(env, key)) {
    return {
      id,
      label,
      status: "ready",
      detail: `${key} is configured.`,
      evidenceKeys: [key]
    };
  }

  return missingEvidenceCheck({ id, key, label, nextAction });
}

function booleanFlagCheck({
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
}): OperationsReadinessCheck {
  if (readEnv(env, key)?.toLowerCase() === "true") {
    return {
      id,
      label,
      status: "ready",
      detail: `${key}=true.`,
      evidenceKeys: [key]
    };
  }

  return missingEvidenceCheck({ id, key, label, nextAction });
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
}): OperationsReadinessCheck {
  const value = readEnv(env, key);

  if (value) {
    return {
      id,
      label,
      status: "ready",
      detail: `${key} is recorded.`,
      evidenceKeys: [key]
    };
  }

  return missingEvidenceCheck({ id, key, label, nextAction });
}

function missingEvidenceCheck({
  id,
  key,
  label,
  nextAction
}: {
  id: string;
  key: string;
  label: string;
  nextAction: string;
}): OperationsReadinessCheck {
  return {
    id,
    label,
    status: "blocked",
    detail: `Missing operations evidence variable: ${key}.`,
    evidenceKeys: [key],
    nextAction
  };
}

function operationsReadinessWorksheet(
  checks: OperationsReadinessCheck[]
): OperationsReadinessWorksheet {
  const localArtifactIds = new Set([
    "privacy-page",
    "terms-page",
    "operations-runbook",
    "operations-drill-checklist",
    "health-endpoint"
  ]);
  const readyLocalArtifacts = checks
    .filter((check) => check.status === "ready" && localArtifactIds.has(check.id))
    .map(operationsEvidenceWorksheetItem);
  const externalEvidenceChecks = checks.filter((check) => !localArtifactIds.has(check.id));
  const missingExternalEvidence = externalEvidenceChecks
    .filter((check) => check.status === "blocked")
    .map(operationsEvidenceWorksheetItem);
  const readyExternalEvidence = externalEvidenceChecks
    .filter((check) => check.status === "ready")
    .map(operationsEvidenceWorksheetItem);

  return {
    copySafeCommands: operationsReadinessCopySafeCommands(),
    humanOwned: true,
    missingExternalEvidence,
    nextEvidenceAction:
      missingExternalEvidence[0]?.nextAction ??
      "All external operations evidence is recorded; review the launch readiness report.",
    readyExternalEvidence,
    readyLocalArtifacts
  };
}

function operationsReadinessCopySafeCommands(): OperationsReadinessCommand[] {
  return [
    {
      command: "npm run operations:readiness",
      id: "operations-readiness",
      label: "Refresh operations readiness",
      mode: "read-only",
      purpose:
        "Recheck local operations artifacts and external evidence variables without printing secret values."
    },
    {
      command: "npm run operations:readiness -- --evidence <evidence-id>",
      id: "operations-evidence-review",
      label: "Focus one operations evidence item",
      mode: "read-only",
      purpose:
        "Print one operations evidence check with its required key and next action for human setup."
    },
    {
      command: "npm run smoke:public-mvp -- <base-url>",
      id: "public-smoke",
      label: "Smoke public routes and health",
      mode: "read-only",
      purpose:
        "Verify public routes, security headers, anonymous operator boundary, live previews, and /api/health."
    },
    {
      command: "npm run production:readiness",
      id: "production-readiness",
      label: "Refresh production readiness",
      mode: "read-only",
      purpose:
        "Recheck production database, migration, Vercel, and secret evidence before backup or rollback drills."
    },
    {
      command: "npm run ingest:scheduled-dry-run",
      id: "scheduled-ingestion-dry-run",
      label: "Refresh scheduled ingestion dry run",
      mode: "read-only",
      purpose:
        "Recheck hosted-cron, scheduled-ingestion alert, retry policy, and no-auto-promotion readiness."
    },
    {
      command: "npm run launch:readiness",
      id: "launch-readiness",
      label: "Refresh aggregate launch readiness",
      mode: "read-only",
      purpose: "Recheck fully-live launch gates after operations evidence changes."
    }
  ];
}

function operationsEvidenceWorksheetItem(
  check: OperationsReadinessCheck
): OperationsEvidenceWorksheetItem {
  return {
    evidenceKeys: check.evidenceKeys,
    id: check.id,
    label: check.label,
    nextAction: check.nextAction
  };
}

function countStatuses(checks: OperationsReadinessCheck[]) {
  return checks.reduce(
    (counts, check) => ({
      ...counts,
      [check.status]: counts[check.status] + 1
    }),
    {
      ready: 0,
      blocked: 0
    } satisfies Record<OperationsReadinessStatus, number>
  );
}

function validateMonitoringUrl(value: string): MonitoringUrlCheck {
  const localHosts = new Set(["127.0.0.1", "::1", "localhost"]);
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return {
      ok: false,
      reason: "Uptime monitoring URL could not be parsed."
    };
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return {
      ok: false,
      reason: "Uptime monitoring URL must use http:// or https://."
    };
  }

  if (url.username || url.password || url.search || url.hash) {
    return {
      ok: false,
      reason:
        "Uptime monitoring URL must not include credentials, query strings, or fragments."
    };
  }

  if (localHosts.has(url.hostname.toLowerCase())) {
    return {
      ok: false,
      reason: "Uptime monitoring URL must target a non-local host."
    };
  }

  const pathLabel = url.pathname === "/" ? "" : url.pathname;

  return {
    ok: true,
    sanitizedUrl: `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}${pathLabel}`
  };
}

function readEnv(env: Record<string, string | undefined>, key: string) {
  const value = env[key];
  return value && value.trim() ? value.trim() : undefined;
}
