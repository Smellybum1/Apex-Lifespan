export type VercelDatabaseSetupStatus = "blocked" | "ready" | "skipped";

export interface VercelDatabaseSetupCommandResult {
  command: string;
  exitCode: number;
  ok: boolean;
}

export interface VercelDatabaseSetupContext {
  env: Record<string, string | undefined>;
}

export interface VercelDatabaseSetupPlan {
  checks: Array<{
    detail: string;
    id: string;
    status: VercelDatabaseSetupStatus;
  }>;
  commands: string[];
  nextAction: string;
  sanitizedDatabaseTarget?: string;
  shouldRun: boolean;
  shouldSeedPreview: boolean;
  status: VercelDatabaseSetupStatus;
  targetEnvironment?: string;
}

export interface VercelDatabaseSetupResult extends VercelDatabaseSetupPlan {
  commandResults: VercelDatabaseSetupCommandResult[];
  executed: boolean;
}

export type VercelDatabaseSetupRunner = (
  command: string,
  args: readonly string[]
) => VercelDatabaseSetupCommandResult;

const LOCAL_DATABASE_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

export function buildVercelDatabaseSetupPlan(
  context: VercelDatabaseSetupContext
): VercelDatabaseSetupPlan {
  const vercelEnv = readEnv(context.env, "VERCEL_ENV");
  const dataSource = readEnv(context.env, "APEX_DATA_SOURCE");
  const databaseUrl = readEnv(context.env, "DATABASE_URL");
  const parsedDatabase = parseDatabaseUrl(databaseUrl);

  if (readEnv(context.env, "VERCEL") !== "1") {
    return skippedPlan("Not running in Vercel.");
  }

  if (dataSource !== "database") {
    return skippedPlan(`APEX_DATA_SOURCE is ${dataSource ? JSON.stringify(dataSource) : "not configured"}.`);
  }

  const checks = [
    {
      id: "target-environment",
      status: vercelEnv === "preview" || vercelEnv === "production" ? "ready" : "blocked",
      detail: vercelEnv
        ? `VERCEL_ENV=${vercelEnv}.`
        : "VERCEL_ENV is not configured."
    },
    databaseCheck(parsedDatabase)
  ] satisfies VercelDatabaseSetupPlan["checks"];
  const blocker = checks.find((check) => check.status === "blocked");

  if (blocker) {
    return {
      checks,
      commands: [],
      nextAction: "Fix the Vercel database environment before deploying database mode.",
      sanitizedDatabaseTarget: parsedDatabase.ok ? parsedDatabase.target : undefined,
      shouldRun: false,
      shouldSeedPreview: false,
      status: "blocked",
      targetEnvironment: vercelEnv
    };
  }

  const shouldSeedPreview = vercelEnv === "preview";
  const commands = ["npx prisma migrate deploy"];

  if (shouldSeedPreview) {
    commands.push("npx tsx prisma/seed.ts");
  }

  return {
    checks,
    commands,
    nextAction: shouldSeedPreview
      ? "Run preview migrations and load demo seed data into the non-production database."
      : "Run production migrations only; production evidence data import remains a separate human-reviewed step.",
    sanitizedDatabaseTarget: parsedDatabase.ok ? parsedDatabase.target : undefined,
    shouldRun: true,
    shouldSeedPreview,
    status: "ready",
    targetEnvironment: vercelEnv
  };
}

export function runVercelDatabaseSetup({
  context,
  runner
}: {
  context: VercelDatabaseSetupContext;
  runner: VercelDatabaseSetupRunner;
}): VercelDatabaseSetupResult {
  const plan = buildVercelDatabaseSetupPlan(context);
  const commandResults: VercelDatabaseSetupCommandResult[] = [];

  if (!plan.shouldRun) {
    return {
      ...plan,
      commandResults,
      executed: false
    };
  }

  for (const [command, args] of [
    ["npx", ["prisma", "migrate", "deploy"]],
    ...(plan.shouldSeedPreview ? [["npx", ["tsx", "prisma/seed.ts"]] as const] : [])
  ] as const) {
    const result = runner(command, args);
    commandResults.push(result);

    if (!result.ok) {
      return {
        ...plan,
        commandResults,
        executed: true,
        nextAction: `${result.command} failed with exit code ${result.exitCode}; review Vercel build logs.`
      };
    }
  }

  return {
    ...plan,
    commandResults,
    executed: true,
    nextAction: "Vercel database setup completed."
  };
}

function skippedPlan(reason: string): VercelDatabaseSetupPlan {
  return {
    checks: [
      {
        id: "skip",
        status: "skipped",
        detail: reason
      }
    ],
    commands: [],
    nextAction: "No Vercel database setup needed for this build.",
    shouldRun: false,
    shouldSeedPreview: false,
    status: "skipped"
  };
}

function databaseCheck(
  parsed: ReturnType<typeof parseDatabaseUrl>
): VercelDatabaseSetupPlan["checks"][number] {
  if (!parsed.ok) {
    return {
      id: "database-url",
      status: "blocked",
      detail: parsed.reason
    };
  }

  if (parsed.isLocal) {
    return {
      id: "database-url",
      status: "blocked",
      detail: `DATABASE_URL points at local target ${parsed.target}.`
    };
  }

  return {
    id: "database-url",
    status: "ready",
    detail: `DATABASE_URL is a non-local PostgreSQL target (${parsed.target}).`
  };
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
