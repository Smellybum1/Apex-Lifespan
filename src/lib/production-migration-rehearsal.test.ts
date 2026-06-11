import { describe, expect, it } from "vitest";

import {
  buildProductionMigrationRehearsalPlan,
  runProductionMigrationRehearsal,
  type ProductionMigrationRehearsalCommandResult
} from "@/lib/production-migration-rehearsal";

const migrations = ["20260602032000_init", "20260611131000_operator_auth_foundation"];

describe("production migration rehearsal", () => {
  it("keeps local or seed-mode environments blocked", () => {
    const plan = buildProductionMigrationRehearsalPlan({
      env: {
        APEX_DATA_SOURCE: "seed",
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/apex_lifespan"
      },
      generatedAt: new Date("2026-06-11T00:00:00.000Z"),
      migrationDirectories: migrations
    });

    expect(plan.willRun).toBe(false);
    expect(plan.counts.blocked).toBe(3);
    expect(plan.sanitizedDatabaseTarget).toBe("postgresql://localhost:5432/apex_lifespan");
    expect(JSON.stringify(plan)).not.toContain("postgres:postgres");
    expect(plan.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "database-url",
          status: "blocked"
        }),
        expect.objectContaining({
          id: "apex-data-source",
          status: "blocked"
        }),
        expect.objectContaining({
          id: "rehearsal-target",
          status: "blocked"
        })
      ])
    );
  });

  it("dry-runs against a managed non-production target without executing commands", () => {
    const result = runProductionMigrationRehearsal({
      context: {
        env: readyEnv(),
        generatedAt: new Date("2026-06-11T00:00:00.000Z"),
        migrationDirectories: migrations
      },
      runner: () => {
        throw new Error("runner should not be called for dry-run");
      }
    });

    expect(result.executed).toBe(false);
    expect(result.willRun).toBe(false);
    expect(result.counts.blocked).toBe(0);
    expect(result.counts.warning).toBe(1);
    expect(result.commandResults).toEqual([]);
  });

  it("runs validate and deploy commands only with --apply and a non-production target", () => {
    const commands: string[] = [];
    const result = runProductionMigrationRehearsal({
      context: {
        apply: true,
        env: readyEnv(),
        generatedAt: new Date("2026-06-11T00:00:00.000Z"),
        migrationDirectories: migrations
      },
      runner: (command, args) => {
        commands.push([command, ...args].join(" "));

        return {
          command: [command, ...args].join(" "),
          exitCode: 0,
          ok: true
        };
      }
    });

    expect(result.executed).toBe(true);
    expect(result.willRun).toBe(true);
    expect(commands).toEqual(["npm run db:validate", "npm run db:migrate:deploy"]);
    expect(result.commandResults).toHaveLength(2);
  });

  it("stops after the first failed command without exposing command output", () => {
    const result = runProductionMigrationRehearsal({
      context: {
        apply: true,
        env: readyEnv(),
        generatedAt: new Date("2026-06-11T00:00:00.000Z"),
        migrationDirectories: migrations
      },
      runner: (command, args): ProductionMigrationRehearsalCommandResult => ({
        command: [command, ...args].join(" "),
        exitCode: 1,
        ok: false
      })
    });

    expect(result.executed).toBe(true);
    expect(result.commandResults).toEqual([
      {
        command: "npm run db:validate",
        exitCode: 1,
        ok: false
      }
    ]);
    expect(result.nextAction).toBe(
      "npm run db:validate failed with exit code 1; review local command output before any production migration."
    );
  });

  it("refuses production targets even when --apply is requested", () => {
    const result = runProductionMigrationRehearsal({
      context: {
        apply: true,
        env: {
          ...readyEnv(),
          APEX_MIGRATION_REHEARSAL_TARGET: "production"
        },
        generatedAt: new Date("2026-06-11T00:00:00.000Z"),
        migrationDirectories: migrations
      },
      runner: () => {
        throw new Error("runner should not be called for production target");
      }
    });

    expect(result.executed).toBe(false);
    expect(result.willRun).toBe(false);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "rehearsal-target",
          status: "blocked"
        })
      ])
    );
  });
});

function readyEnv() {
  return {
    APEX_DATA_SOURCE: "database",
    APEX_MIGRATION_REHEARSAL_TARGET: "non-production",
    DATABASE_URL: "postgresql://user:secret@staging-db.example.com:5432/apex?schema=public"
  };
}
