import { describe, expect, it } from "vitest";

import { buildOperatorReadinessReport } from "@/lib/operator/readiness";

const localFilesReady = {
  auditedActionWrappers: true,
  authRoute: true,
  browserWriteActions: true,
  browserWriteControls: true,
  bootstrapScript: true,
  manualQaChecklist: true,
  operatorPage: true,
  promotionReadiness: true,
  reviewQueue: true
};

describe("operator readiness report", () => {
  it("reports local operator surfaces as ready but external auth and QA proof as blocked", () => {
    const report = buildOperatorReadinessReport({
      env: {},
      files: localFilesReady,
      generatedAt: new Date("2026-06-11T00:00:00.000Z")
    });

    expect(report.overall).toBe("blocked");
    expect(report.counts.ready).toBe(10);
    expect(report.worksheet.readyLocalArtifacts.map((item) => item.id)).toEqual([
      "operator-page",
      "auth-route",
      "review-queue",
      "audited-action-wrappers",
      "browser-write-control-gate",
      "browser-write-action-handlers",
      "promotion-readiness",
      "operator-bootstrap",
      "manual-qa-checklist"
    ]);
    expect(report.worksheet.readyEvidence.map((item) => item.id)).toEqual([
      "operator-write-gate"
    ]);
    expect(report.worksheet.blocked.map((item) => item.id)).toEqual([
      "operator-auth-config",
      "active-operator",
      "nonproduction-write-qa",
      "operator-flow-qa",
      "browser-write-controls-approval"
    ]);
    expect(report.worksheet.nextOperatorAction).toBe(
      "Configure database-backed GitHub OAuth in a non-production environment before manual operator-flow QA."
    );
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "operator-page",
          status: "ready"
        }),
        expect.objectContaining({
          id: "operator-auth-config",
          detail:
            "Missing operator auth variables: DATABASE_URL, AUTH_SECRET, AUTH_GITHUB_ID, AUTH_GITHUB_SECRET.",
          status: "blocked"
        }),
        expect.objectContaining({
          id: "active-operator",
          status: "blocked"
        }),
        expect.objectContaining({
          id: "operator-write-gate",
          status: "ready"
        })
      ])
    );
  });

  it("reports ready when local artifacts, auth configuration, and manual QA evidence are present", () => {
    const report = buildOperatorReadinessReport({
      env: {
        APEX_OPERATOR_ACTIVE_ACCOUNT_READY: "true",
        APEX_OPERATOR_BROWSER_WRITE_CONTROLS_APPROVED_AT: "2026-06-11T13:00:00Z",
        APEX_OPERATOR_FLOW_QA_REVIEWED_AT: "2026-06-11T12:00:00Z",
        APEX_OPERATOR_NONPROD_WRITE_QA_AT: "2026-06-11T11:00:00Z",
        AUTH_GITHUB_ID: "github-id",
        AUTH_GITHUB_SECRET: "github-secret-value",
        AUTH_SECRET: "auth-secret-value",
        DATABASE_URL: "postgresql://user:password@db.example.com/apex"
      },
      files: localFilesReady,
      generatedAt: new Date("2026-06-11T00:00:00.000Z")
    });

    const serialized = JSON.stringify(report);

    expect(report.overall).toBe("ready");
    expect(report.counts.blocked).toBe(0);
    expect(report.worksheet.blocked).toEqual([]);
    expect(report.worksheet.readyEvidence.map((item) => item.id)).toEqual([
      "operator-auth-config",
      "active-operator",
      "operator-write-gate",
      "nonproduction-write-qa",
      "operator-flow-qa",
      "browser-write-controls-approval"
    ]);
    expect(report.worksheet.nextOperatorAction).toBe(
      "Operator workflow evidence is ready; review launch readiness before enabling production writes."
    );
    expect(serialized).not.toContain("github-secret-value");
    expect(serialized).not.toContain("auth-secret-value");
    expect(serialized).not.toContain("password");
  });

  it("warns when the current environment has operator writes enabled", () => {
    const report = buildOperatorReadinessReport({
      env: {
        APEX_OPERATOR_ACTIVE_ACCOUNT_READY: "true",
        APEX_OPERATOR_BROWSER_WRITE_CONTROLS_APPROVED_AT: "2026-06-11T13:00:00Z",
        APEX_OPERATOR_FLOW_QA_REVIEWED_AT: "2026-06-11T12:00:00Z",
        APEX_OPERATOR_NONPROD_WRITE_QA_AT: "2026-06-11T11:00:00Z",
        APEX_OPERATOR_WRITES_ENABLED: "true",
        AUTH_GITHUB_ID: "github-id",
        AUTH_GITHUB_SECRET: "github-secret",
        AUTH_SECRET: "auth-secret",
        DATABASE_URL: "postgresql://db.example.com/apex"
      },
      files: localFilesReady,
      generatedAt: new Date("2026-06-11T00:00:00.000Z")
    });

    expect(report.overall).toBe("ready");
    expect(report.counts.warning).toBe(1);
    expect(report.worksheet.warnings.map((item) => item.id)).toEqual([
      "operator-write-gate"
    ]);
    expect(report.worksheet.nextOperatorAction).toBe(
      "Use this only for controlled non-production QA; keep public production writes disabled until launch approval."
    );
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "operator-write-gate",
          status: "warning"
        })
      ])
    );
  });

  it("blocks when required local operator artifacts are missing", () => {
    const report = buildOperatorReadinessReport({
      env: {
        APEX_OPERATOR_ACTIVE_ACCOUNT_READY: "true",
        APEX_OPERATOR_BROWSER_WRITE_CONTROLS_APPROVED_AT: "2026-06-11T13:00:00Z",
        APEX_OPERATOR_FLOW_QA_REVIEWED_AT: "2026-06-11T12:00:00Z",
        APEX_OPERATOR_NONPROD_WRITE_QA_AT: "2026-06-11T11:00:00Z",
        AUTH_GITHUB_ID: "github-id",
        AUTH_GITHUB_SECRET: "github-secret",
        AUTH_SECRET: "auth-secret",
        DATABASE_URL: "postgresql://db.example.com/apex"
      },
      files: {
        ...localFilesReady,
        auditedActionWrappers: false,
        authRoute: false,
        browserWriteActions: false,
        manualQaChecklist: false
      },
      generatedAt: new Date("2026-06-11T00:00:00.000Z")
    });

    expect(report.overall).toBe("blocked");
    expect(report.worksheet.blocked.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "audited-action-wrappers",
        "auth-route",
        "browser-write-action-handlers",
        "manual-qa-checklist"
      ])
    );
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "audited-action-wrappers",
          status: "blocked"
        }),
        expect.objectContaining({
          id: "auth-route",
          status: "blocked"
        }),
        expect.objectContaining({
          id: "browser-write-action-handlers",
          status: "blocked"
        }),
        expect.objectContaining({
          id: "manual-qa-checklist",
          status: "blocked"
        })
      ])
    );
  });
});
