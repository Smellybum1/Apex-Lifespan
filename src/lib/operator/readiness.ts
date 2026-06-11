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
  auditedActionWrappers: boolean;
  authRoute: boolean;
  bootstrapScript: boolean;
  manualQaChecklist: boolean;
  operatorPage: boolean;
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
}

const FILE_PATHS: Record<keyof OperatorReadinessFiles, string> = {
  auditedActionWrappers: "src/lib/operator/source-candidate-actions.ts",
  authRoute: "src/app/api/auth/[...nextauth]/route.ts",
  bootstrapScript: "scripts/operator-bootstrap.ts",
  manualQaChecklist: "docs/codex/operator-manual-qa-checklist.md",
  operatorPage: "src/app/operator/page.tsx",
  promotionReadiness: "src/lib/operator/curation-promotion.ts",
  reviewQueue: "src/lib/operator/review-queue.ts"
};

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
      id: "audited-action-wrappers",
      label: "Audited action wrappers",
      pathLabel: FILE_PATHS.auditedActionWrappers,
      present: files.auditedActionWrappers
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
    overall: counts.blocked > 0 ? "blocked" : "ready"
  };
}

export function readOperatorReadinessFiles(cwd = process.cwd()): OperatorReadinessFiles {
  return {
    auditedActionWrappers: existsSync(path.join(cwd, FILE_PATHS.auditedActionWrappers)),
    authRoute: existsSync(path.join(cwd, FILE_PATHS.authRoute)),
    bootstrapScript: existsSync(path.join(cwd, FILE_PATHS.bootstrapScript)),
    manualQaChecklist: existsSync(path.join(cwd, FILE_PATHS.manualQaChecklist)),
    operatorPage: existsSync(path.join(cwd, FILE_PATHS.operatorPage)),
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

  if (operatorAuthConfigured(env)) {
    return {
      id: "operator-auth-config",
      label: "Database-backed GitHub auth",
      status: "ready",
      detail: "Required operator auth variables are configured.",
      evidenceKeys: ["DATABASE_URL", "AUTH_SECRET", "AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET"]
    };
  }

  return {
    id: "operator-auth-config",
    label: "Database-backed GitHub auth",
    status: "blocked",
    detail: `Missing operator auth variables: ${missing.join(", ")}.`,
    evidenceKeys: ["DATABASE_URL", "AUTH_SECRET", "AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET"],
    nextAction:
      "Configure database-backed GitHub OAuth in a non-production environment before manual operator-flow QA."
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
