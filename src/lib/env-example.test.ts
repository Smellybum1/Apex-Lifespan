import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe(".env.example", () => {
  it("documents fully-live readiness evidence variables", () => {
    const envExample = readFileSync(".env.example", "utf8");

    for (const key of [
      "APEX_OPERATOR_ACTIVE_ACCOUNT_READY",
      "APEX_OPERATOR_NONPROD_WRITE_QA_AT",
      "APEX_OPERATOR_FLOW_QA_REVIEWED_AT",
      "APEX_OPERATOR_BROWSER_WRITE_CONTROLS_APPROVED_AT",
      "APEX_MIGRATION_REHEARSAL_TARGET",
      "APEX_MIGRATION_REHEARSAL_PASSED_AT",
      "APEX_UPTIME_MONITORING_URL",
      "APEX_ERROR_MONITORING_PROJECT",
      "APEX_DEPLOYMENT_ALERTS_CONFIGURED",
      "APEX_DATABASE_BACKUPS_CONFIGURED",
      "APEX_BACKUP_RESTORE_REHEARSED_AT",
      "APEX_ROLLBACK_DRILL_REHEARSED_AT",
      "APEX_ALERT_TESTED_AT",
      "APEX_PUBLIC_SMOKE_PASSED_AT",
      "APEX_ADMIN_FLOW_SMOKE_PASSED_AT",
      "APEX_FULLY_LIVE_LAUNCH_APPROVED_AT",
      "APEX_POST_LAUNCH_REVIEW_SCHEDULED_AT"
    ]) {
      expect(envExample).toContain(key);
    }
  });
});
