import { describe, expect, it } from "vitest";

import {
  buildProductionDatabaseConnectivityPlan,
  runProductionDatabaseConnectivityCheck
} from "@/lib/production-database-connectivity";

const managedEnv = {
  APEX_DATA_SOURCE: "database",
  DATABASE_URL: "postgresql://user:dbpass@db.example.com:5432/apex?schema=public"
} as const;

describe("production database connectivity", () => {
  it("blocks local database targets before probing", () => {
    const report = buildProductionDatabaseConnectivityPlan({
      env: {
        APEX_DATA_SOURCE: "auto",
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/apex_lifespan"
      },
      generatedAt: new Date("2026-06-24T00:00:00.000Z")
    });

    expect(report.overall).toBe("blocked");
    expect(report.probed).toBe(false);
    expect(report.sanitizedDatabaseTarget).toBe("postgresql://localhost:5432/apex_lifespan");
    expect(report.checks.map((check) => check.id)).toEqual(["database-url", "apex-data-source"]);
    expect(JSON.stringify(report)).not.toContain("postgres:postgres");
    expect(report.nextAction).toBe(
      "Use a managed non-local PostgreSQL target before production provisioning."
    );
  });

  it("requires database mode and a managed url before probing", () => {
    const report = buildProductionDatabaseConnectivityPlan({
      env: managedEnv,
      generatedAt: new Date("2026-06-24T00:00:00.000Z")
    });

    expect(report.overall).toBe("ready");
    expect(report.probed).toBe(false);
    expect(report.nextAction).toBe(
      "Run npm run production:connectivity -- --probe to verify Prisma can reach the managed database."
    );
  });

  it("reports a successful probe without leaking credentials", async () => {
    const report = await runProductionDatabaseConnectivityCheck({
      context: {
        env: managedEnv,
        generatedAt: new Date("2026-06-24T00:00:00.000Z")
      },
      probe: async () => ({ latencyMs: 42 })
    });

    expect(report.overall).toBe("ready");
    expect(report.probed).toBe(true);
    expect(report.latencyMs).toBe(42);
    expect(report.checks.at(-1)).toEqual(
      expect.objectContaining({
        id: "database-probe",
        status: "ready",
        detail: "Prisma reached the managed database in 42ms."
      })
    );
    expect(JSON.stringify(report)).not.toContain("dbpass");
  });

  it("sanitizes probe failures", async () => {
    const report = await runProductionDatabaseConnectivityCheck({
      context: {
        env: managedEnv
      },
      probe: async () => {
        throw new Error(
          "Invalid `prisma.$queryRaw()` invocation: password authentication failed for user secret-user"
        );
      }
    });

    expect(report.overall).toBe("blocked");
    expect(report.probed).toBe(true);
    expect(report.checks.at(-1)).toEqual(
      expect.objectContaining({
        id: "database-probe",
        status: "blocked",
        detail: "Prisma reached the server but authentication failed."
      })
    );
    expect(JSON.stringify(report)).not.toContain("secret-user");
  });
});
