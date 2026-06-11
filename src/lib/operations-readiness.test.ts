import { describe, expect, it } from "vitest";

import { buildOperationsReadinessReport } from "@/lib/operations-readiness";

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
