import { describe, expect, it } from "vitest";

import { buildProductionReadinessReport } from "@/lib/production-readiness";

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
