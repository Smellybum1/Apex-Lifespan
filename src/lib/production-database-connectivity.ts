export type ProductionDatabaseConnectivityStatus = "ready" | "blocked";

export interface ProductionDatabaseConnectivityCheck {
  detail: string;
  id: string;
  label: string;
  nextAction?: string;
  status: ProductionDatabaseConnectivityStatus;
}

export interface ProductionDatabaseConnectivityContext {
  env: Record<string, string | undefined>;
  generatedAt?: Date;
}

export interface ProductionDatabaseConnectivityProbeResult {
  latencyMs: number;
}

export type ProductionDatabaseConnectivityProbe = () => Promise<ProductionDatabaseConnectivityProbeResult>;

export interface ProductionDatabaseConnectivityReport {
  checks: ProductionDatabaseConnectivityCheck[];
  counts: Record<ProductionDatabaseConnectivityStatus, number>;
  generatedAt: string;
  latencyMs?: number;
  nextAction: string;
  overall: "ready" | "blocked";
  probed: boolean;
  sanitizedDatabaseTarget?: string;
}

const LOCAL_DATABASE_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

export function buildProductionDatabaseConnectivityPlan(
  context: ProductionDatabaseConnectivityContext
): ProductionDatabaseConnectivityReport {
  const databaseUrl = readEnv(context.env, "DATABASE_URL");
  const parsedDatabase = parseDatabaseUrl(databaseUrl);
  const checks: ProductionDatabaseConnectivityCheck[] = [
    databaseUrlCheck(databaseUrl, parsedDatabase),
    dataSourceCheck(readEnv(context.env, "APEX_DATA_SOURCE"))
  ];
  const counts = countStatuses(checks);
  const blocker = checks.find((check) => check.status === "blocked");

  return {
    checks,
    counts,
    generatedAt: (context.generatedAt ?? new Date()).toISOString(),
    nextAction:
      blocker?.nextAction ??
      "Run npm run production:connectivity -- --probe to verify Prisma can reach the managed database.",
    overall: counts.blocked > 0 ? "blocked" : "ready",
    probed: false,
    sanitizedDatabaseTarget: parsedDatabase.ok ? parsedDatabase.target : undefined
  };
}

export async function runProductionDatabaseConnectivityCheck({
  context,
  probe
}: {
  context: ProductionDatabaseConnectivityContext;
  probe?: ProductionDatabaseConnectivityProbe;
}): Promise<ProductionDatabaseConnectivityReport> {
  const plan = buildProductionDatabaseConnectivityPlan(context);

  if (!probe || plan.overall === "blocked") {
    return plan;
  }

  try {
    const result = await probe();

    return {
      ...plan,
      checks: [
        ...plan.checks,
        {
          id: "database-probe",
          label: "Database probe",
          status: "ready",
          detail: `Prisma reached the managed database in ${Math.max(0, Math.round(result.latencyMs))}ms.`
        }
      ],
      counts: {
        ...plan.counts,
        ready: plan.counts.ready + 1
      },
      latencyMs: result.latencyMs,
      nextAction:
        "Managed database connectivity looks good; continue with npm run production:migration-rehearsal.",
      overall: "ready",
      probed: true
    };
  } catch (error) {
    const detail = sanitizeProbeError(error);

    return {
      ...plan,
      checks: [
        ...plan.checks,
        {
          id: "database-probe",
          label: "Database probe",
          status: "blocked",
          detail,
          nextAction:
            "Verify Neon/Vercel DATABASE_URL scope, credentials, IP allowlists, and that the database is running before retrying."
        }
      ],
      counts: {
        ...plan.counts,
        blocked: plan.counts.blocked + 1
      },
      nextAction:
        "Fix managed database connectivity before migration rehearsal or production database mode.",
      overall: "blocked",
      probed: true
    };
  }
}

function databaseUrlCheck(
  rawValue: string | undefined,
  parsed: ReturnType<typeof parseDatabaseUrl>
): ProductionDatabaseConnectivityCheck {
  if (!rawValue) {
    return {
      id: "database-url",
      label: "Managed database URL",
      status: "blocked",
      detail: "DATABASE_URL is not configured.",
      nextAction:
        "Configure a Neon/Vercel managed PostgreSQL DATABASE_URL in the target environment."
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
      nextAction: "Use a managed non-local PostgreSQL target before production provisioning."
    };
  }

  return {
    id: "database-url",
    label: "Managed database URL",
    status: "ready",
    detail: `DATABASE_URL is a non-local PostgreSQL target (${parsed.target}).`
  };
}

function dataSourceCheck(value: string | undefined): ProductionDatabaseConnectivityCheck {
  if (value === "database") {
    return {
      id: "apex-data-source",
      label: "Production data mode",
      status: "ready",
      detail: "APEX_DATA_SOURCE=database is configured for fail-closed public reads."
    };
  }

  return {
    id: "apex-data-source",
    label: "Production data mode",
    status: "blocked",
    detail: `APEX_DATA_SOURCE is ${value ? JSON.stringify(value) : "not configured"}.`,
    nextAction: "Set APEX_DATA_SOURCE=database for fully-live staging and production environments."
  };
}

function countStatuses(checks: ProductionDatabaseConnectivityCheck[]) {
  return checks.reduce(
    (counts, check) => ({
      ...counts,
      [check.status]: counts[check.status] + 1
    }),
    {
      blocked: 0,
      ready: 0
    } satisfies Record<ProductionDatabaseConnectivityStatus, number>
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

function sanitizeProbeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (/Environment variable not found:\s*DATABASE_URL/i.test(message)) {
    return "Prisma could not read DATABASE_URL.";
  }

  if (/Can't reach database server|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(message)) {
    return "Prisma could not reach the managed database server.";
  }

  if (/password authentication failed|authentication failed/i.test(message)) {
    return "Prisma reached the server but authentication failed.";
  }

  return "Prisma database probe failed.";
}
