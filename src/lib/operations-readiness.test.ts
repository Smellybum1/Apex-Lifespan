import { describe, expect, it } from "vitest";

import {
  buildOperationsReadinessReport,
  summarizeOperationsEvidenceReview
} from "@/lib/operations-readiness";

const localFilesReady = {
  healthEndpoint: true,
  operationsDrillChecklist: true,
  operationsRunbook: true,
  privacyPage: true,
  termsPage: true
};

describe("operations readiness report", () => {
  it("reports external operations evidence as blocked when local docs are present but proof is missing", () => {
    const report = buildOperationsReadinessReport({
      env: {},
      files: localFilesReady,
      generatedAt: new Date("2026-06-11T00:00:00.000Z")
    });

    expect(report.overall).toBe("blocked");
    expect(report.counts.ready).toBe(5);
    expect(report.worksheet.copySafeCommands).toEqual([
      {
        command: "npm run operations:readiness",
        id: "operations-readiness",
        label: "Refresh operations readiness",
        mode: "read-only",
        purpose:
          "Recheck local operations artifacts and external evidence variables without printing secret values."
      },
      {
        command: "npm run operations:readiness -- --evidence <evidence-id>",
        id: "operations-evidence-review",
        label: "Focus one operations evidence item",
        mode: "read-only",
        purpose:
          "Print one operations evidence check with its required key and next action for human setup."
      },
      {
        command: "npm run smoke:public-mvp -- <base-url>",
        id: "public-smoke",
        label: "Smoke public routes and health",
        mode: "read-only",
        purpose:
          "Verify public routes, security headers, anonymous operator boundary, live previews, and /api/health."
      },
      {
        command: "npm run production:readiness",
        id: "production-readiness",
        label: "Refresh production readiness",
        mode: "read-only",
        purpose:
          "Recheck production database, migration, Vercel, and secret evidence before backup or rollback drills."
      },
      {
        command: "npm run ingest:scheduled-dry-run",
        id: "scheduled-ingestion-dry-run",
        label: "Refresh scheduled ingestion dry run",
        mode: "read-only",
        purpose:
          "Recheck hosted-cron, scheduled-ingestion alert, retry policy, and no-auto-promotion readiness."
      },
      {
        command: "npm run launch:readiness",
        id: "launch-readiness",
        label: "Refresh aggregate launch readiness",
        mode: "read-only",
        purpose: "Recheck fully-live launch gates after operations evidence changes."
      }
    ]);
    expect(report.worksheet.readyLocalArtifacts.map((item) => item.id)).toEqual([
      "privacy-page",
      "terms-page",
      "operations-runbook",
      "operations-drill-checklist",
      "health-endpoint"
    ]);
    expect(report.worksheet.missingExternalEvidence).toHaveLength(8);
    expect(report.worksheet.missingExternalEvidence[0]).toEqual({
      evidenceKeys: ["APEX_UPTIME_MONITORING_URL"],
      id: "uptime-monitoring",
      label: "Uptime monitoring",
      nextAction:
        "Configure uptime monitoring for /api/health and record its URL in APEX_UPTIME_MONITORING_URL."
    });
    expect(report.worksheet.nextEvidenceAction).toBe(
      "Configure uptime monitoring for /api/health and record its URL in APEX_UPTIME_MONITORING_URL."
    );
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "privacy-page",
          status: "ready"
        }),
        expect.objectContaining({
          id: "uptime-monitoring",
          detail: "Missing operations evidence variable: APEX_UPTIME_MONITORING_URL.",
          status: "blocked"
        }),
        expect.objectContaining({
          id: "backup-restore-rehearsal",
          status: "blocked"
        }),
        expect.objectContaining({
          id: "rollback-drill",
          status: "blocked"
        })
      ])
    );
  });

  it("emits only read-only commands for operations handoff", () => {
    const report = buildOperationsReadinessReport({
      env: {},
      files: localFilesReady,
      generatedAt: new Date("2026-06-11T00:00:00.000Z")
    });
    const blockedWriteTokens = [
      "--apply",
      "--queue-",
      "--run-next",
      "--accept-candidate",
      "--reject-candidate",
      "--link-candidate-claim",
      "--extract-candidate-study"
    ];

    expect(report.worksheet.copySafeCommands).toHaveLength(6);
    expect(report.worksheet.copySafeCommands.every((item) => item.mode === "read-only")).toBe(
      true
    );
    expect(
      report.worksheet.copySafeCommands.some((item) =>
        blockedWriteTokens.some((token) => item.command.includes(token))
      )
    ).toBe(false);
  });

  it("reports ready when local artifacts and external proof placeholders are configured", () => {
    const report = buildOperationsReadinessReport({
      env: {
        APEX_ALERT_TESTED_AT: "2026-06-11T10:00:00Z",
        APEX_BACKUP_RESTORE_REHEARSED_AT: "2026-06-11T09:00:00Z",
        APEX_DATABASE_BACKUPS_CONFIGURED: "true",
        APEX_DEPLOYMENT_ALERTS_CONFIGURED: "true",
        APEX_ERROR_MONITORING_PROJECT: "private-sentry-project-key",
        APEX_INGESTION_ALERTS_CONFIGURED: "true",
        APEX_ROLLBACK_DRILL_REHEARSED_AT: "2026-06-11T11:00:00Z",
        APEX_UPTIME_MONITORING_URL: "https://uptime.example.com/checks/apex-lifespan"
      },
      files: localFilesReady,
      generatedAt: new Date("2026-06-11T00:00:00.000Z")
    });

    const serialized = JSON.stringify(report);

    expect(report.overall).toBe("ready");
    expect(report.counts.blocked).toBe(0);
    expect(report.worksheet.missingExternalEvidence).toEqual([]);
    expect(report.worksheet.readyExternalEvidence.map((item) => item.id)).toEqual([
      "uptime-monitoring",
      "error-monitoring",
      "deployment-alerts",
      "scheduled-ingestion-alerts",
      "database-backups",
      "backup-restore-rehearsal",
      "rollback-drill",
      "alert-test"
    ]);
    expect(report.worksheet.nextEvidenceAction).toBe(
      "All external operations evidence is recorded; review the launch readiness report."
    );
    expect(serialized).toContain("https://uptime.example.com/checks/apex-lifespan");
    expect(serialized).not.toContain("private-sentry-project-key");
  });

  it("blocks uptime monitor URLs that contain private URL material", () => {
    const report = buildOperationsReadinessReport({
      env: {
        APEX_ALERT_TESTED_AT: "2026-06-11T10:00:00Z",
        APEX_BACKUP_RESTORE_REHEARSED_AT: "2026-06-11T09:00:00Z",
        APEX_DATABASE_BACKUPS_CONFIGURED: "true",
        APEX_DEPLOYMENT_ALERTS_CONFIGURED: "true",
        APEX_ERROR_MONITORING_PROJECT: "configured",
        APEX_INGESTION_ALERTS_CONFIGURED: "true",
        APEX_ROLLBACK_DRILL_REHEARSED_AT: "2026-06-11T11:00:00Z",
        APEX_UPTIME_MONITORING_URL:
          "https://uptime.example.com/checks/apex-lifespan?token=private-token"
      },
      files: localFilesReady,
      generatedAt: new Date("2026-06-11T00:00:00.000Z")
    });

    const serialized = JSON.stringify(report);

    expect(report.overall).toBe("blocked");
    expect(report.worksheet.missingExternalEvidence).toEqual([
      expect.objectContaining({
        evidenceKeys: ["APEX_UPTIME_MONITORING_URL"],
        id: "uptime-monitoring",
        nextAction:
          "Record a sanitized http(s) uptime monitor URL without credentials, query strings, fragments, or local hosts."
      })
    ]);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail:
            "Uptime monitoring URL must not include credentials, query strings, or fragments.",
          id: "uptime-monitoring",
          status: "blocked"
        })
      ])
    );
    expect(serialized).not.toContain("private-token");
  });

  it("builds a focused read-only packet for one missing operations evidence item", () => {
    expect(
      summarizeOperationsEvidenceReview(
        {
          env: {},
          files: localFilesReady,
          generatedAt: new Date("2026-06-11T00:00:00.000Z")
        },
        "uptime-monitoring"
      )
    ).toEqual({
      availableEvidenceIds: [
        "privacy-page",
        "terms-page",
        "operations-runbook",
        "operations-drill-checklist",
        "health-endpoint",
        "uptime-monitoring",
        "error-monitoring",
        "deployment-alerts",
        "scheduled-ingestion-alerts",
        "database-backups",
        "backup-restore-rehearsal",
        "rollback-drill",
        "alert-test"
      ],
      check: {
        detail: "Missing operations evidence variable: APEX_UPTIME_MONITORING_URL.",
        evidenceKeys: ["APEX_UPTIME_MONITORING_URL"],
        id: "uptime-monitoring",
        label: "Uptime monitoring",
        nextAction:
          "Configure uptime monitoring for /api/health and record its URL in APEX_UPTIME_MONITORING_URL.",
        status: "blocked"
      },
      evidenceId: "uptime-monitoring",
      found: true,
      humanOwned: true,
      nextAction:
        "Configure uptime monitoring for /api/health and record its URL in APEX_UPTIME_MONITORING_URL.",
      readOnly: true,
      relatedCommand: {
        command: "npm run operations:readiness",
        id: "operations-readiness",
        label: "Refresh operations readiness",
        mode: "read-only",
        purpose:
          "Recheck local operations artifacts and external evidence variables without printing secret values."
      },
      status: "blocked"
    });
  });

  it("reports missing focused operations evidence packets without writes", () => {
    expect(
      summarizeOperationsEvidenceReview(
        {
          env: {},
          files: localFilesReady,
          generatedAt: new Date("2026-06-11T00:00:00.000Z")
        },
        "missing-evidence"
      )
    ).toEqual({
      availableEvidenceIds: [
        "privacy-page",
        "terms-page",
        "operations-runbook",
        "operations-drill-checklist",
        "health-endpoint",
        "uptime-monitoring",
        "error-monitoring",
        "deployment-alerts",
        "scheduled-ingestion-alerts",
        "database-backups",
        "backup-restore-rehearsal",
        "rollback-drill",
        "alert-test"
      ],
      check: null,
      evidenceId: "missing-evidence",
      found: false,
      humanOwned: true,
      nextAction:
        "No operations evidence item matched this id; rerun npm run operations:readiness to inspect valid evidence ids.",
      readOnly: true,
      relatedCommand: null,
      status: "not-found"
    });
  });

  it("blocks launch evidence when required local operations artifacts are missing", () => {
    const report = buildOperationsReadinessReport({
      env: {
        APEX_ALERT_TESTED_AT: "2026-06-11T10:00:00Z",
        APEX_BACKUP_RESTORE_REHEARSED_AT: "2026-06-11T09:00:00Z",
        APEX_DATABASE_BACKUPS_CONFIGURED: "true",
        APEX_DEPLOYMENT_ALERTS_CONFIGURED: "true",
        APEX_ERROR_MONITORING_PROJECT: "configured",
        APEX_INGESTION_ALERTS_CONFIGURED: "true",
        APEX_ROLLBACK_DRILL_REHEARSED_AT: "2026-06-11T11:00:00Z",
        APEX_UPTIME_MONITORING_URL: "https://uptime.example.com/checks/apex-lifespan"
      },
      files: {
        healthEndpoint: false,
        operationsDrillChecklist: false,
        operationsRunbook: false,
        privacyPage: true,
        termsPage: false
      },
      generatedAt: new Date("2026-06-11T00:00:00.000Z")
    });

    expect(report.overall).toBe("blocked");
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "operations-runbook",
          status: "blocked"
        }),
        expect.objectContaining({
          id: "operations-drill-checklist",
          status: "blocked"
        }),
        expect.objectContaining({
          id: "health-endpoint",
          status: "blocked"
        }),
        expect.objectContaining({
          id: "terms-page",
          status: "blocked"
        })
      ])
    );
  });
});
