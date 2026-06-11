import { describe, expect, it } from "vitest";

import {
  buildProductionReadinessReport,
  summarizeProductionReadinessCheck,
  summarizeProductionReadinessReport
} from "@/lib/production-readiness";

describe("production readiness report", () => {
  it("reports ready when managed database and required production secrets are configured", () => {
    const report = buildProductionReadinessReport({
      env: {
        APEX_DATA_SOURCE: "database",
        APEX_MIGRATION_REHEARSAL_PASSED_AT: "2026-06-11T00:00:00Z",
        AUTH_GITHUB_ID: "github-id",
        AUTH_GITHUB_SECRET: "github-oauth-value",
        AUTH_SECRET: "session-value",
        DATABASE_URL: "postgresql://user:dbpass@db.example.com:5432/apex?schema=public",
        NCBI_EMAIL: "operator@example.com",
        NCBI_TOOL: "apex-lifespan"
      },
      generatedAt: new Date("2026-06-11T00:00:00.000Z"),
      migrationDirectories: ["20260602032000_init", "20260611131000_operator_auth_foundation"],
      productionProvisioningChecklistExists: true,
      trackedEnvFiles: [],
      vercelCliAvailable: true,
      vercelProjectLinked: true
    });

    expect(report.overall).toBe("ready");
    expect(report.counts.blocked).toBe(0);
    expect(report.sanitizedDatabaseTarget).toBe("postgresql://db.example.com:5432/apex");
    expect(report.worksheet.blocked).toEqual([]);
    expect(report.worksheet.ready.map((item) => item.id)).toEqual([
      "database-url",
      "apex-data-source",
      "prisma-migrations",
      "production-provisioning-checklist",
      "migration-rehearsal",
      "vercel-project",
      "vercel-cli",
      "operator-auth-secrets",
      "local-only-sidecar-secrets",
      "tracked-env-files",
      "operator-write-flag",
      "ncbi-metadata"
    ]);
    expect(report.worksheet.nextOperatorAction).toBe(
      "Production provisioning evidence is ready; review launch readiness before migration."
    );
    expect(JSON.stringify(report)).not.toContain("github-oauth-value");
    expect(JSON.stringify(report)).not.toContain("session-value");
    expect(JSON.stringify(report)).not.toContain("user:dbpass");
  });

  it("keeps the local seed/demo environment blocked for fully-live production", () => {
    const report = buildProductionReadinessReport({
      env: {
        APEX_DATA_SOURCE: "seed",
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/apex_lifespan",
        NCBI_TOOL: "apex-lifespan"
      },
      generatedAt: new Date("2026-06-11T00:00:00.000Z"),
      migrationDirectories: ["20260602032000_init"],
      productionProvisioningChecklistExists: true,
      trackedEnvFiles: [],
      vercelCliAvailable: false,
      vercelProjectLinked: false
    });

    expect(report.overall).toBe("blocked");
    expect(report.worksheet.blocked.map((item) => item.id)).toEqual([
      "database-url",
      "apex-data-source",
      "migration-rehearsal",
      "vercel-project",
      "operator-auth-secrets"
    ]);
    expect(report.worksheet.warnings.map((item) => item.id)).toEqual([
      "vercel-cli",
      "ncbi-metadata"
    ]);
    expect(report.worksheet.nextOperatorAction).toBe(
      "Use a managed non-local PostgreSQL target before production migration rehearsal."
    );
    expect(report.worksheet.copySafeCommands).toEqual([
      {
        command: "npm run production:readiness",
        id: "production-readiness",
        label: "Refresh production readiness",
        mode: "read-only",
        purpose:
          "Recheck production database, secrets, and evidence gates without printing secret values."
      },
      {
        command: "npm run production:readiness -- --summary",
        id: "production-readiness-summary",
        label: "Refresh compact production summary",
        mode: "read-only",
        purpose:
          "Print production readiness counts, blockers, warnings, ready checks, and next action without dumping all checks."
      },
      {
        command: "npm run production:readiness -- --check <check-id>",
        id: "production-readiness-check",
        label: "Focus one production readiness check",
        mode: "read-only",
        purpose:
          "Print one production readiness check with its evidence keys and next action for dashboard setup."
      },
      {
        command: "npm run production:migration-rehearsal",
        id: "migration-rehearsal-plan",
        label: "Plan non-production migration rehearsal",
        mode: "read-only",
        purpose: "Dry-run the migration rehearsal plan before any managed database changes."
      },
      {
        command: "npm run production:migration-rehearsal -- --apply",
        id: "migration-rehearsal-apply",
        label: "Apply non-production migration rehearsal",
        mode: "explicit-apply",
        purpose:
          "Run only after confirming a non-production managed DATABASE_URL and APEX_MIGRATION_REHEARSAL_TARGET=non-production."
      },
      {
        command: "npm run db:validate",
        id: "database-schema-validate",
        label: "Validate Prisma schema",
        mode: "read-only",
        purpose: "Validate the committed Prisma schema before and after managed environment setup."
      },
      {
        command: "npm run launch:readiness",
        id: "launch-readiness",
        label: "Refresh aggregate launch readiness",
        mode: "read-only",
        purpose: "Recheck fully-live launch gates after production evidence changes."
      }
    ]);
    expect(report.checks).toEqual(
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
          id: "vercel-project",
          status: "blocked"
        }),
        expect.objectContaining({
          id: "migration-rehearsal",
          status: "blocked"
        }),
        expect.objectContaining({
          id: "operator-auth-secrets",
          status: "blocked"
        }),
        expect.objectContaining({
          id: "vercel-cli",
          status: "warning"
        })
      ])
    );
  });

  it("builds a compact production readiness summary without full report detail", () => {
    const report = buildProductionReadinessReport({
      env: {
        APEX_DATA_SOURCE: "seed",
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/apex_lifespan",
        NCBI_TOOL: "apex-lifespan"
      },
      generatedAt: new Date("2026-06-11T00:00:00.000Z"),
      migrationDirectories: ["20260602032000_init"],
      productionProvisioningChecklistExists: true,
      trackedEnvFiles: [],
      vercelCliAvailable: false,
      vercelProjectLinked: false
    });

    const summary = summarizeProductionReadinessReport(report);

    expect(summary).toMatchObject({
      counts: {
        blocked: 5,
        info: 0,
        ready: 5,
        warning: 2
      },
      generatedAt: "2026-06-11T00:00:00.000Z",
      humanOwned: true,
      nextAction: "Use a managed non-local PostgreSQL target before production migration rehearsal.",
      overall: "blocked",
      readOnly: true
    });
    expect(summary.blockedChecks.map((item) => item.id)).toEqual([
      "database-url",
      "apex-data-source",
      "migration-rehearsal",
      "vercel-project",
      "operator-auth-secrets"
    ]);
    expect(summary.readyChecks.map((item) => item.id)).toEqual([
      "prisma-migrations",
      "production-provisioning-checklist",
      "local-only-sidecar-secrets",
      "tracked-env-files",
      "operator-write-flag"
    ]);
    expect(summary.warningChecks.map((item) => item.id)).toEqual([
      "vercel-cli",
      "ncbi-metadata"
    ]);
    expect(summary).not.toHaveProperty("checks");
    expect(summary).not.toHaveProperty("worksheet");
    expect(JSON.stringify(summary)).not.toContain("postgres:postgres");
  });

  it("builds a focused read-only packet for one production readiness check", () => {
    expect(
      summarizeProductionReadinessCheck(
        {
          env: {
            APEX_DATA_SOURCE: "seed",
            DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/apex_lifespan"
          },
          generatedAt: new Date("2026-06-11T00:00:00.000Z"),
          migrationDirectories: ["20260602032000_init"],
          productionProvisioningChecklistExists: true,
          trackedEnvFiles: [],
          vercelCliAvailable: false,
          vercelProjectLinked: false
        },
        "database-url"
      )
    ).toEqual({
      availableCheckIds: [
        "database-url",
        "apex-data-source",
        "prisma-migrations",
        "production-provisioning-checklist",
        "migration-rehearsal",
        "vercel-project",
        "vercel-cli",
        "operator-auth-secrets",
        "local-only-sidecar-secrets",
        "tracked-env-files",
        "operator-write-flag",
        "ncbi-metadata"
      ],
      check: {
        detail: "DATABASE_URL points at local target postgresql://localhost:5432/apex_lifespan.",
        id: "database-url",
        label: "Managed database URL",
        nextAction: "Use a managed non-local PostgreSQL target before production migration rehearsal.",
        status: "blocked"
      },
      checkId: "database-url",
      found: true,
      humanOwned: true,
      nextAction: "Use a managed non-local PostgreSQL target before production migration rehearsal.",
      readOnly: true,
      relatedCommand: {
        command: "npm run production:readiness",
        id: "production-readiness",
        label: "Refresh production readiness",
        mode: "read-only",
        purpose:
          "Recheck production database, secrets, and evidence gates without printing secret values."
      },
      status: "blocked"
    });
  });

  it("reports missing focused production readiness checks without writes", () => {
    expect(
      summarizeProductionReadinessCheck(
        {
          env: {},
          generatedAt: new Date("2026-06-11T00:00:00.000Z"),
          migrationDirectories: ["20260602032000_init"],
          productionProvisioningChecklistExists: true,
          trackedEnvFiles: [],
          vercelCliAvailable: false,
          vercelProjectLinked: false
        },
        "missing-check"
      )
    ).toEqual({
      availableCheckIds: [
        "database-url",
        "apex-data-source",
        "prisma-migrations",
        "production-provisioning-checklist",
        "migration-rehearsal",
        "vercel-project",
        "vercel-cli",
        "operator-auth-secrets",
        "local-only-sidecar-secrets",
        "tracked-env-files",
        "operator-write-flag",
        "ncbi-metadata"
      ],
      check: null,
      checkId: "missing-check",
      found: false,
      humanOwned: true,
      nextAction:
        "No production readiness check matched this id; rerun npm run production:readiness to inspect valid check ids.",
      readOnly: true,
      relatedCommand: null,
      status: "not-found"
    });
  });

  it("accepts GitHub-imported Vercel project evidence without a local Vercel link", () => {
    const report = buildProductionReadinessReport({
      env: {
        APEX_DATA_SOURCE: "database",
        APEX_MIGRATION_REHEARSAL_PASSED_AT: "2026-06-11T00:00:00Z",
        APEX_VERCEL_PROJECT_CONFIGURED_AT: "2026-06-11T01:00:00Z",
        AUTH_GITHUB_ID: "github-id",
        AUTH_GITHUB_SECRET: "github-oauth-value",
        AUTH_SECRET: "session-value",
        DATABASE_URL: "postgresql://user:dbpass@db.example.com:5432/apex?schema=public",
        NCBI_EMAIL: "operator@example.com",
        NCBI_TOOL: "apex-lifespan"
      },
      generatedAt: new Date("2026-06-11T00:00:00.000Z"),
      migrationDirectories: ["20260602032000_init", "20260611131000_operator_auth_foundation"],
      productionProvisioningChecklistExists: true,
      trackedEnvFiles: [],
      vercelCliAvailable: false,
      vercelProjectLinked: false
    });

    expect(report.overall).toBe("ready");
    expect(report.counts.warning).toBe(1);
    expect(report.worksheet.ready).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidenceKeys: ["APEX_VERCEL_PROJECT_CONFIGURED_AT"],
          id: "vercel-project"
        })
      ])
    );
    expect(report.worksheet.warnings.map((item) => item.id)).toEqual(["vercel-cli"]);
  });

  it("accepts dashboard-managed Vercel database and auth evidence without local secret values", () => {
    const report = buildProductionReadinessReport({
      env: {
        APEX_MIGRATION_REHEARSAL_PASSED_AT: "2026-06-11T00:00:00Z",
        APEX_VERCEL_DATABASE_CONFIGURED_AT: "2026-06-11T02:00:00Z",
        APEX_VERCEL_DATABASE_MODE_CONFIGURED_AT: "2026-06-11T02:05:00Z",
        APEX_VERCEL_OPERATOR_AUTH_CONFIGURED_AT: "2026-06-11T02:10:00Z",
        APEX_VERCEL_PROJECT_CONFIGURED_AT: "2026-06-11T01:00:00Z",
        NCBI_EMAIL: "operator@example.com",
        NCBI_TOOL: "apex-lifespan"
      },
      generatedAt: new Date("2026-06-11T00:00:00.000Z"),
      migrationDirectories: ["20260602032000_init", "20260611131000_operator_auth_foundation"],
      productionProvisioningChecklistExists: true,
      trackedEnvFiles: [],
      vercelCliAvailable: false,
      vercelProjectLinked: false
    });

    expect(report.overall).toBe("ready");
    expect(report.counts.warning).toBe(1);
    expect(report.sanitizedDatabaseTarget).toBeUndefined();
    expect(report.worksheet.ready).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidenceKeys: ["APEX_VERCEL_DATABASE_CONFIGURED_AT"],
          id: "database-url"
        }),
        expect.objectContaining({
          evidenceKeys: ["APEX_VERCEL_DATABASE_MODE_CONFIGURED_AT"],
          id: "apex-data-source"
        }),
        expect.objectContaining({
          evidenceKeys: ["APEX_VERCEL_OPERATOR_AUTH_CONFIGURED_AT"],
          id: "operator-auth-secrets"
        })
      ])
    );
    expect(JSON.stringify(report)).not.toContain("dbpass");
    expect(JSON.stringify(report)).not.toContain("github-oauth-value");
    expect(JSON.stringify(report)).not.toContain("session-value");
  });

  it("blocks local-only sidecar variables and tracked private env files", () => {
    const report = buildProductionReadinessReport({
      env: {
        APEX_CODEX_REVIEW_TOKEN: "local-token",
        APEX_DATA_SOURCE: "database",
        AUTH_GITHUB_ID: "github-id",
        AUTH_GITHUB_SECRET: "github-secret",
        AUTH_SECRET: "auth-secret",
        DATABASE_URL: "postgresql://user:password@db.example.com/apex"
      },
      generatedAt: new Date("2026-06-11T00:00:00.000Z"),
      migrationDirectories: ["20260602032000_init"],
      productionProvisioningChecklistExists: true,
      trackedEnvFiles: [".env.production"],
      vercelCliAvailable: true,
      vercelProjectLinked: true
    });

    expect(report.overall).toBe("blocked");
    expect(report.worksheet.blocked.map((item) => item.id)).toEqual(
      expect.arrayContaining(["local-only-sidecar-secrets", "tracked-env-files"])
    );
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "local-only-sidecar-secrets",
          status: "blocked"
        }),
        expect.objectContaining({
          id: "tracked-env-files",
          status: "blocked"
        })
      ])
    );
    expect(JSON.stringify(report)).not.toContain("local-token");
    expect(JSON.stringify(report)).not.toContain("password");
  });

  it("blocks when the production provisioning checklist artifact is missing", () => {
    const report = buildProductionReadinessReport({
      env: {
        APEX_DATA_SOURCE: "database",
        APEX_MIGRATION_REHEARSAL_PASSED_AT: "2026-06-11T00:00:00Z",
        AUTH_GITHUB_ID: "github-id",
        AUTH_GITHUB_SECRET: "github-secret",
        AUTH_SECRET: "auth-secret",
        DATABASE_URL: "postgresql://user:password@db.example.com/apex"
      },
      generatedAt: new Date("2026-06-11T00:00:00.000Z"),
      migrationDirectories: ["20260602032000_init"],
      productionProvisioningChecklistExists: false,
      trackedEnvFiles: [],
      vercelCliAvailable: true,
      vercelProjectLinked: true
    });

    expect(report.overall).toBe("blocked");
    expect(report.worksheet.blocked).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "production-provisioning-checklist",
          nextAction:
            "Restore the operator-owned production provisioning checklist before running fully-live database setup."
        })
      ])
    );
  });
});
