export type ProductionReadinessStatus = "ready" | "blocked" | "warning" | "info";

export interface ProductionReadinessCheck {
  detail: string;
  evidenceKeys?: string[];
  id: string;
  label: string;
  nextAction?: string;
  status: ProductionReadinessStatus;
}

export interface ProductionReadinessContext {
  env: Record<string, string | undefined>;
  generatedAt?: Date;
  migrationDirectories: string[];
  productionProvisioningChecklistExists: boolean;
  trackedEnvFiles: string[];
  vercelCliAvailable: boolean;
  vercelProjectLinked: boolean;
}

export interface ProductionReadinessReport {
  checks: ProductionReadinessCheck[];
  counts: Record<ProductionReadinessStatus, number>;
  generatedAt: string;
  latestMigration?: string;
  overall: "ready" | "blocked";
  sanitizedDatabaseTarget?: string;
  worksheet: ProductionProvisioningWorksheet;
}

export interface ProductionProvisioningWorksheet {
  blocked: ProductionProvisioningWorksheetItem[];
  humanOwned: true;
  nextOperatorAction: string;
  ready: ProductionProvisioningWorksheetItem[];
  warnings: ProductionProvisioningWorksheetItem[];
}

export interface ProductionProvisioningWorksheetItem {
  evidenceKeys?: string[];
  id: string;
  label: string;
  nextAction?: string;
}

const LOCAL_DATABASE_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);
const LOCAL_ONLY_ENV_KEYS = [
  "APEX_CODEX_THREAD_ID",
  "APEX_CODEX_REVIEW_TOKEN",
  "APEX_CODEX_REVIEW_PORT",
  "APEX_CODEX_REVIEW_ORIGINS"
];
const VERCEL_PROJECT_CONFIGURED_KEY = "APEX_VERCEL_PROJECT_CONFIGURED_AT";

export function buildProductionReadinessReport(
  context: ProductionReadinessContext
): ProductionReadinessReport {
  const databaseUrl = readEnv(context.env, "DATABASE_URL");
  const parsedDatabase = parseDatabaseUrl(databaseUrl);
  const latestMigration = context.migrationDirectories
    .filter(Boolean)
    .sort()
    .at(-1);
  const checks: ProductionReadinessCheck[] = [
    databaseUrlCheck(databaseUrl, parsedDatabase),
    dataSourceCheck(readEnv(context.env, "APEX_DATA_SOURCE")),
    migrationCheck(latestMigration),
    productionProvisioningChecklistCheck(context.productionProvisioningChecklistExists),
    migrationRehearsalCheck(readEnv(context.env, "APEX_MIGRATION_REHEARSAL_PASSED_AT")),
    vercelProjectCheck(
      context.vercelProjectLinked,
      readEnv(context.env, VERCEL_PROJECT_CONFIGURED_KEY)
    ),
    vercelCliCheck(context.vercelCliAvailable),
    operatorAuthCheck(context.env),
    localOnlySecretCheck(context.env),
    trackedEnvFileCheck(context.trackedEnvFiles),
    operatorWriteFlagCheck(readEnv(context.env, "APEX_OPERATOR_WRITES_ENABLED")),
    ncbiMetadataCheck(context.env)
  ];
  const counts = countStatuses(checks);

  return {
    checks,
    counts,
    generatedAt: (context.generatedAt ?? new Date()).toISOString(),
    latestMigration,
    overall: counts.blocked > 0 ? "blocked" : "ready",
    sanitizedDatabaseTarget: parsedDatabase.ok ? parsedDatabase.target : undefined,
    worksheet: productionProvisioningWorksheet(checks)
  };
}

function databaseUrlCheck(
  rawValue: string | undefined,
  parsed: ReturnType<typeof parseDatabaseUrl>
): ProductionReadinessCheck {
  if (!rawValue) {
    return {
      id: "database-url",
      label: "Managed database URL",
      status: "blocked",
      detail: "DATABASE_URL is not configured.",
      nextAction: "Configure a Neon/Vercel managed PostgreSQL DATABASE_URL in the target environment."
    };
  }

  if (!parsed.ok) {
    return {
      id: "database-url",
      label: "Managed database URL",
      status: "blocked",
      detail: parsed.reason,
      nextAction: "Replace DATABASE_URL with a valid postgresql:// or postgres:// connection string."
    };
  }

  if (parsed.isLocal) {
    return {
      id: "database-url",
      label: "Managed database URL",
      status: "blocked",
      detail: `DATABASE_URL points at local target ${parsed.target}.`,
      nextAction: "Use a managed non-local PostgreSQL target before production migration rehearsal."
    };
  }

  return {
    id: "database-url",
    label: "Managed database URL",
    status: "ready",
    detail: `DATABASE_URL is a non-local PostgreSQL target (${parsed.target}).`
  };
}

function dataSourceCheck(value: string | undefined): ProductionReadinessCheck {
  if (value === "database") {
    return {
      id: "apex-data-source",
      label: "Production data mode",
      status: "ready",
      detail: "APEX_DATA_SOURCE is set to database, so public reads fail closed if PostgreSQL is unavailable."
    };
  }

  return {
    id: "apex-data-source",
    label: "Production data mode",
    status: "blocked",
    detail: `APEX_DATA_SOURCE is ${value ? JSON.stringify(value) : "not configured"}.`,
    nextAction:
      "Set APEX_DATA_SOURCE=database for fully-live production after managed PostgreSQL is provisioned."
  };
}

function migrationCheck(latestMigration: string | undefined): ProductionReadinessCheck {
  if (latestMigration) {
    return {
      id: "prisma-migrations",
      label: "Committed migrations",
      status: "ready",
      detail: `Committed Prisma migrations are present; latest is ${latestMigration}.`
    };
  }

  return {
    id: "prisma-migrations",
    label: "Committed migrations",
    status: "blocked",
    detail: "No committed Prisma migration directories were found.",
    nextAction: "Create and review committed Prisma migrations before deploy-style migration rehearsal."
  };
}

function productionProvisioningChecklistCheck(exists: boolean): ProductionReadinessCheck {
  if (exists) {
    return {
      id: "production-provisioning-checklist",
      label: "Production provisioning checklist",
      status: "ready",
      detail: "docs/codex/production-provisioning-checklist.md is present."
    };
  }

  return {
    id: "production-provisioning-checklist",
    label: "Production provisioning checklist",
    status: "blocked",
    detail: "docs/codex/production-provisioning-checklist.md is missing.",
    nextAction:
      "Restore the operator-owned production provisioning checklist before running fully-live database setup."
  };
}

function migrationRehearsalCheck(value: string | undefined): ProductionReadinessCheck {
  const key = "APEX_MIGRATION_REHEARSAL_PASSED_AT";

  if (value) {
    return {
      evidenceKeys: [key],
      id: "migration-rehearsal",
      label: "Non-production migration rehearsal",
      status: "ready",
      detail: `${key} is recorded.`
    };
  }

  return {
    evidenceKeys: [key],
    id: "migration-rehearsal",
    label: "Non-production migration rehearsal",
    status: "blocked",
    detail: `Missing production evidence variable: ${key}.`,
    nextAction:
      "Run npm run production:migration-rehearsal against a non-production managed database and record APEX_MIGRATION_REHEARSAL_PASSED_AT after review."
  };
}

function vercelProjectCheck(
  vercelProjectLinked: boolean,
  githubImportConfiguredAt: string | undefined
): ProductionReadinessCheck {
  if (vercelProjectLinked) {
    return {
      id: "vercel-project",
      label: "Vercel project",
      status: "ready",
      detail: ".vercel/project.json is present in the local checkout."
    };
  }

  if (githubImportConfiguredAt) {
    return {
      evidenceKeys: [VERCEL_PROJECT_CONFIGURED_KEY],
      id: "vercel-project",
      label: "Vercel project",
      status: "ready",
      detail:
        "GitHub-imported Vercel project evidence is recorded; local CLI link is optional for dashboard-managed deployments."
    };
  }

  return {
    evidenceKeys: [VERCEL_PROJECT_CONFIGURED_KEY],
    id: "vercel-project",
    label: "Vercel project",
    status: "blocked",
    detail:
      ".vercel/project.json is not present and GitHub-imported Vercel project evidence is not recorded.",
    nextAction:
      "Confirm the GitHub-imported Vercel project in the Vercel dashboard, then record APEX_VERCEL_PROJECT_CONFIGURED_AT."
  };
}

function vercelCliCheck(vercelCliAvailable: boolean): ProductionReadinessCheck {
  return vercelCliAvailable
    ? {
        id: "vercel-cli",
        label: "Vercel CLI",
        status: "ready",
        detail: "vercel is available on PATH for local env/deploy checks."
      }
    : {
        id: "vercel-cli",
        label: "Vercel CLI",
        status: "warning",
        detail: "vercel is not available on PATH.",
        nextAction:
          "Install Vercel CLI or perform environment, deploy, and rollback checks through the Vercel dashboard."
      };
}

function operatorAuthCheck(env: Record<string, string | undefined>): ProductionReadinessCheck {
  const missing = ["AUTH_SECRET", "AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET"].filter(
    (key) => !readEnv(env, key)
  );

  if (missing.length === 0) {
    return {
      id: "operator-auth-secrets",
      label: "Operator auth secrets",
      status: "ready",
      detail: "GitHub OAuth and Auth.js secret variables are configured."
    };
  }

  return {
    id: "operator-auth-secrets",
    label: "Operator auth secrets",
    status: "blocked",
    detail: `Missing required operator auth variables: ${missing.join(", ")}.`,
    nextAction:
      "Configure GitHub OAuth and Auth.js secrets only in the managed hosting environment or local non-production QA environment."
  };
}

function localOnlySecretCheck(env: Record<string, string | undefined>): ProductionReadinessCheck {
  const configured = LOCAL_ONLY_ENV_KEYS.filter((key) => readEnv(env, key));

  if (configured.length === 0) {
    return {
      id: "local-only-sidecar-secrets",
      label: "Local-only sidecar secrets",
      status: "ready",
      detail: "No local Codex sidecar variables are configured in this environment."
    };
  }

  return {
    id: "local-only-sidecar-secrets",
    label: "Local-only sidecar secrets",
    status: "blocked",
    detail: `Local-only sidecar variables are configured: ${configured.join(", ")}.`,
    nextAction: "Remove Codex sidecar variables from public deploy environments."
  };
}

function trackedEnvFileCheck(trackedEnvFiles: string[]): ProductionReadinessCheck {
  if (trackedEnvFiles.length === 0) {
    return {
      id: "tracked-env-files",
      label: "Committed secret files",
      status: "ready",
      detail: "No private env files are tracked by git."
    };
  }

  return {
    id: "tracked-env-files",
    label: "Committed secret files",
    status: "blocked",
    detail: `Private env-like files are tracked: ${trackedEnvFiles.join(", ")}.`,
    nextAction: "Remove tracked private env files before production deployment."
  };
}

function operatorWriteFlagCheck(value: string | undefined): ProductionReadinessCheck {
  if (value?.toLowerCase() === "true") {
    return {
      id: "operator-write-flag",
      label: "Operator write flag",
      status: "warning",
      detail: "APEX_OPERATOR_WRITES_ENABLED is true in the current environment.",
      nextAction:
        "Keep operator writes disabled by default in production and enable only during controlled operator QA or reviewed operations."
    };
  }

  return {
    id: "operator-write-flag",
    label: "Operator write flag",
    status: "ready",
    detail: "Operator writes are not enabled by the current environment."
  };
}

function ncbiMetadataCheck(env: Record<string, string | undefined>): ProductionReadinessCheck {
  if (readEnv(env, "NCBI_TOOL") && readEnv(env, "NCBI_EMAIL")) {
    return {
      id: "ncbi-metadata",
      label: "NCBI request metadata",
      status: "ready",
      detail: "NCBI_TOOL and NCBI_EMAIL are configured for scheduled ingestion requests."
    };
  }

  return {
    id: "ncbi-metadata",
    label: "NCBI request metadata",
    status: "warning",
    detail: "NCBI_TOOL and/or NCBI_EMAIL are missing.",
    nextAction:
      "Configure NCBI metadata before enabling unattended PubMed ingestion jobs."
  };
}

function productionProvisioningWorksheet(
  checks: ProductionReadinessCheck[]
): ProductionProvisioningWorksheet {
  const blocked = checks
    .filter((check) => check.status === "blocked")
    .map(productionProvisioningWorksheetItem);
  const warnings = checks
    .filter((check) => check.status === "warning")
    .map(productionProvisioningWorksheetItem);
  const ready = checks
    .filter((check) => check.status === "ready")
    .map(productionProvisioningWorksheetItem);

  return {
    blocked,
    humanOwned: true,
    nextOperatorAction:
      blocked[0]?.nextAction ??
      warnings[0]?.nextAction ??
      "Production provisioning evidence is ready; review launch readiness before migration.",
    ready,
    warnings
  };
}

function productionProvisioningWorksheetItem(
  check: ProductionReadinessCheck
): ProductionProvisioningWorksheetItem {
  return {
    evidenceKeys: check.evidenceKeys,
    id: check.id,
    label: check.label,
    nextAction: check.nextAction
  };
}

function countStatuses(checks: ProductionReadinessCheck[]) {
  return checks.reduce(
    (counts, check) => ({
      ...counts,
      [check.status]: counts[check.status] + 1
    }),
    {
      ready: 0,
      blocked: 0,
      warning: 0,
      info: 0
    } satisfies Record<ProductionReadinessStatus, number>
  );
}

function parseDatabaseUrl(value: string | undefined):
  | {
      isLocal: boolean;
      ok: true;
      target: string;
    }
  | {
      ok: false;
      reason: string;
    } {
  if (!value) {
    return {
      ok: false,
      reason: "DATABASE_URL is not configured."
    };
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return {
      ok: false,
      reason: "DATABASE_URL could not be parsed."
    };
  }

  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    return {
      ok: false,
      reason: "DATABASE_URL must use postgres:// or postgresql://."
    };
  }

  const path = url.pathname === "/" ? "" : url.pathname;

  return {
    isLocal: LOCAL_DATABASE_HOSTS.has(url.hostname.toLowerCase()),
    ok: true,
    target: `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}${path}`
  };
}

function readEnv(env: Record<string, string | undefined>, key: string) {
  const value = env[key];
  return value && value.trim() ? value.trim() : undefined;
}
