import { describe, expect, it } from "vitest";

import { buildOperationsReadinessReport } from "@/lib/operations-readiness";

const localFilesReady = {
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
    expect(report.counts.ready).toBe(3);
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
        APEX_UPTIME_MONITORING_URL:
          "https://uptime.example.com/checks/apex-lifespan?token=private-token"
      },
      files: localFilesReady,
      generatedAt: new Date("2026-06-11T00:00:00.000Z")
    });

    const serialized = JSON.stringify(report);

    expect(report.overall).toBe("ready");
    expect(report.counts.blocked).toBe(0);
    expect(serialized).toContain("https://uptime.example.com/checks/apex-lifespan");
    expect(serialized).not.toContain("private-token");
    expect(serialized).not.toContain("private-sentry-project-key");
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
          id: "terms-page",
          status: "blocked"
        })
      ])
    );
  });
});
