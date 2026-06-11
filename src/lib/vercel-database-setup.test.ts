import { describe, expect, it } from "vitest";

import {
  buildVercelDatabaseSetupPlan,
  runVercelDatabaseSetup,
  type VercelDatabaseSetupCommandResult
} from "./vercel-database-setup";

const managedDatabaseUrl = "postgresql://user:password@ep-example.neon.tech/apex?sslmode=require";

describe("Vercel database setup", () => {
  it("skips local builds", () => {
    const plan = buildVercelDatabaseSetupPlan({
      env: {
        APEX_DATA_SOURCE: "database",
        DATABASE_URL: managedDatabaseUrl
      }
    });

    expect(plan.status).toBe("skipped");
    expect(plan.shouldRun).toBe(false);
  });

  it("blocks Vercel database mode without a managed database URL", () => {
    const plan = buildVercelDatabaseSetupPlan({
      env: {
        APEX_DATA_SOURCE: "database",
        VERCEL: "1",
        VERCEL_ENV: "preview"
      }
    });

    expect(plan.status).toBe("blocked");
    expect(plan.checks).toContainEqual({
      id: "database-url",
      status: "blocked",
      detail: "DATABASE_URL is not configured."
    });
  });

  it("blocks local database targets in Vercel database mode", () => {
    const plan = buildVercelDatabaseSetupPlan({
      env: {
        APEX_DATA_SOURCE: "database",
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/apex",
        VERCEL: "1",
        VERCEL_ENV: "preview"
      }
    });

    expect(plan.status).toBe("blocked");
    expect(plan.sanitizedDatabaseTarget).toBe("postgresql://localhost:5432/apex");
  });

  it("runs migrations and seed data for preview database mode", () => {
    const calls: string[] = [];
    const result = runVercelDatabaseSetup({
      context: {
        env: {
          APEX_DATA_SOURCE: "database",
          DATABASE_URL: managedDatabaseUrl,
          VERCEL: "1",
          VERCEL_ENV: "preview"
        }
      },
      runner: successfulRunner(calls)
    });

    expect(result.status).toBe("ready");
    expect(result.executed).toBe(true);
    expect(result.shouldSeedPreview).toBe(true);
    expect(result.shouldSyncOperatorQaFixture).toBe(true);
    expect(calls).toEqual([
      "npx prisma migrate deploy",
      "npx tsx prisma/seed.ts",
      "npx tsx scripts/operator-qa-fixture.ts"
    ]);
  });

  it("runs migrations without seed data for production database mode", () => {
    const calls: string[] = [];
    const result = runVercelDatabaseSetup({
      context: {
        env: {
          APEX_DATA_SOURCE: "database",
          DATABASE_URL: managedDatabaseUrl,
          VERCEL: "1",
          VERCEL_ENV: "production"
        }
      },
      runner: successfulRunner(calls)
    });

    expect(result.status).toBe("ready");
    expect(result.executed).toBe(true);
    expect(result.shouldSeedPreview).toBe(false);
    expect(result.shouldSyncOperatorQaFixture).toBe(false);
    expect(calls).toEqual(["npx prisma migrate deploy"]);
  });
});

function successfulRunner(calls: string[]) {
  return (command: string, args: readonly string[]): VercelDatabaseSetupCommandResult => {
    const label = [command, ...args].join(" ");
    calls.push(label);

    return {
      command: label,
      exitCode: 0,
      ok: true
    };
  };
}
