export type ProductionMigrationRehearsalStatus = "ready" | "blocked" | "warning";

export interface ProductionMigrationRehearsalCheck {
  detail: string;
  id: string;
  label: string;
  nextAction?: string;
  status: ProductionMigrationRehearsalStatus;
}

export interface ProductionMigrationRehearsalContext {
  apply?: boolean;
  env: Record<string, string | undefined>;
  generatedAt?: Date;
  migrationDirectories: string[];
}

export interface ProductionMigrationRehearsalCommandResult {
  command: string;
  exitCode: number;
  ok: boolean;
}

export interface ProductionMigrationRehearsalPlan {
  applyRequested: boolean;
  checks: ProductionMigrationRehearsalCheck[];
  counts: Record<ProductionMigrationRehearsalStatus, number>;
  generatedAt: string;
  latestMigration?: string;
  nextAction: string;
  rehearsalTarget?: string;
  sanitizedDatabaseTarget?: string;
  willRun: boolean;
}

export interface ProductionMigrationRehearsalResult extends ProductionMigrationRehearsalPlan {
  commandResults: ProductionMigrationRehearsalCommandResult[];
  executed: boolean;
}

export type ProductionMigrationRehearsalRunner = (
  command: string,
  args: readonly string[]
) => ProductionMigrationRehearsalCommandResult;

const LOCAL_DATABASE_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);
const REHEARSAL_TARGET_ENV = "APEX_MIGRATION_REHEARSAL_TARGET";
const REHEARSAL_TARGET = "non-production";

export function buildProductionMigrationRehearsalPlan(
  context: ProductionMigrationRehearsalContext
): ProductionMigrationRehearsalPlan {
  const databaseUrl = readEnv(context.env, "DATABASE_URL");
  const parsedDatabase = parseDatabaseUrl(databaseUrl);
  const latestMigration = context.migrationDirectories
    .filter(Boolean)
    .sort()
    .at(-1);
  const checks: ProductionMigrationRehearsalCheck[] = [
    databaseUrlCheck(databaseUrl, parsedDatabase),
    dataSourceCheck(readEnv(context.env, "APEX_DATA_SOURCE")),
    migrationCheck(latestMigration),
    rehearsalTargetCheck(readEnv(context.env, REHEARSAL_TARGET_ENV)),
    applyModeCheck(Boolean(context.apply))
  ];
  const counts = countStatuses(checks);
  const blocker = checks.find((check) => check.status === "blocked");
  const applyWarning = checks.find((check) => check.id === "apply-mode");

  return {
    applyRequested: Boolean(context.apply),
    checks,
    counts,
    generatedAt: (context.generatedAt ?? new Date()).toISOString(),
    latestMigration,
    nextAction:
      blocker?.nextAction ??
      applyWarning?.nextAction ??
      "Run npm run db:migrate:deploy against the approved non-production managed database.",
    rehearsalTarget: readEnv(context.env, REHEARSAL_TARGET_ENV),
    sanitizedDatabaseTarget: parsedDatabase.ok ? parsedDatabase.target : undefined,
    willRun: Boolean(context.apply) && counts.blocked === 0
  };
}

export function runProductionMigrationRehearsal({
  context,
  runner = defaultBlockedRunner
}: {
  context: ProductionMigrationRehearsalContext;
  runner?: ProductionMigrationRehearsalRunner;
}): ProductionMigrationRehearsalResult {
  const plan = buildProductionMigrationRehearsalPlan(context);
  const commandResults: ProductionMigrationRehearsalCommandResult[] = [];

  if (!plan.willRun) {
    return {
      ...plan,
      commandResults,
      executed: false
    };
  }

  for (const command of [
    ["npm", ["run", "db:validate"]],
    ["npm", ["run", "db:migrate:deploy"]]
  ] as const) {
    const result = runner(command[0], command[1]);
    commandResults.push(result);

    if (!result.ok) {
      return {
        ...plan,
        commandResults,
        executed: true,
        nextAction: `${result.command} failed with exit code ${result.exitCode}; review local command output before any production migration.`
      };
    }
  }

  return {
    ...plan,
    commandResults,
    executed: true,
    nextAction:
      "Non-production migration rehearsal completed; record APEX_MIGRATION_REHEARSAL_PASSED_AT only after reviewing the target and command results."
  };
}

function databaseUrlCheck(
  rawValue: string | undefined,
  parsed: ReturnType<typeof parseDatabaseUrl>
): ProductionMigrationRehearsalCheck {
  if (!rawValue) {
    return {
      id: "database-url",
      label: "Managed database URL",
      status: "blocked",
      detail: "DATABASE_URL is not configured.",
      nextAction: "Configure a non-production managed PostgreSQL DATABASE_URL."
    };
  }

  if (!parsed.ok) {
    return {
      id: "database-url",
      label: "Managed database URL",
      status: "blocked",
      detail: parsed.reason,
      nextAction: "Replace DATABASE_URL with a valid postgresql:// or postgres:// URL."
    };
  }

  if (parsed.isLocal) {
    return {
      id: "database-url",
      label: "Managed database URL",
      status: "blocked",
      detail: `DATABASE_URL points at local target ${parsed.target}.`,
      nextAction: "Use a managed non-local PostgreSQL target for migration rehearsal."
    };
  }

  return {
    id: "database-url",
    label: "Managed database URL",
    status: "ready",
    detail: `DATABASE_URL is a non-local PostgreSQL target (${parsed.target}).`
  };
}

function dataSourceCheck(value: string | undefined): ProductionMigrationRehearsalCheck {
  if (value === "database") {
    return {
      id: "apex-data-source",
      label: "Database mode",
      status: "ready",
      detail: "APEX_DATA_SOURCE=database is configured."
    };
  }

  return {
    id: "apex-data-source",
    label: "Database mode",
    status: "blocked",
    detail: `APEX_DATA_SOURCE is ${value ? JSON.stringify(value) : "not configured"}.`,
    nextAction: "Set APEX_DATA_SOURCE=database for migration rehearsal."
  };
}

function migrationCheck(latestMigration: string | undefined): ProductionMigrationRehearsalCheck {
  if (latestMigration) {
    return {
      id: "prisma-migrations",
      label: "Committed migrations",
      status: "ready",
      detail: `Latest committed migration is ${latestMigration}.`
    };
  }

  return {
    id: "prisma-migrations",
    label: "Committed migrations",
    status: "blocked",
    detail: "No committed Prisma migration directories were found.",
    nextAction: "Create and review committed migrations before rehearsal."
  };
}

function rehearsalTargetCheck(value: string | undefined): ProductionMigrationRehearsalCheck {
  if (value === REHEARSAL_TARGET) {
    return {
      id: "rehearsal-target",
      label: "Rehearsal target",
      status: "ready",
      detail: `${REHEARSAL_TARGET_ENV}=non-production.`
    };
  }

  if (value?.toLowerCase() === "production") {
    return {
      id: "rehearsal-target",
      label: "Rehearsal target",
      status: "blocked",
      detail: `${REHEARSAL_TARGET_ENV}=production is not allowed for rehearsal.`,
      nextAction: "Use a staging/preview managed database and set APEX_MIGRATION_REHEARSAL_TARGET=non-production."
    };
  }

  return {
    id: "rehearsal-target",
    label: "Rehearsal target",
    status: "blocked",
    detail: `${REHEARSAL_TARGET_ENV} is not configured.`,
    nextAction: "Set APEX_MIGRATION_REHEARSAL_TARGET=non-production after verifying the target is not production."
  };
}

function applyModeCheck(apply: boolean): ProductionMigrationRehearsalCheck {
  if (apply) {
    return {
      id: "apply-mode",
      label: "Apply mode",
      status: "ready",
      detail: "--apply was provided; commands can run if all blockers are resolved."
    };
  }

  return {
    id: "apply-mode",
    label: "Apply mode",
    status: "warning",
    detail: "Dry run only; no migration commands will run.",
    nextAction: "Review this plan, then rerun with --apply only against the approved non-production target."
  };
}

function countStatuses(checks: ProductionMigrationRehearsalCheck[]) {
  return checks.reduce(
    (counts, check) => ({
      ...counts,
      [check.status]: counts[check.status] + 1
    }),
    {
      blocked: 0,
      ready: 0,
      warning: 0
    } satisfies Record<ProductionMigrationRehearsalStatus, number>
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

function defaultBlockedRunner(): ProductionMigrationRehearsalCommandResult {
  return {
    command: "unconfigured-runner",
    exitCode: 1,
    ok: false
  };
}
