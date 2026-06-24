import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const schema = readFileSync(path.join(process.cwd(), "prisma", "schema.prisma"), "utf8");
const migration = readFileSync(
  path.join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260613193000_trial_alerts",
    "migration.sql"
  ),
  "utf8"
);

describe("trial alert schema", () => {
  it("adds persistent trial alerts without automatic evidence promotion", () => {
    expect(schema).toContain("enum TrialAlertKind");
    expect(schema).toContain("RESULTS_REVIEW_NEEDED");
    expect(schema).toContain("MISSING_RESULTS_FOLLOW_UP");
    expect(schema).toContain("MONITOR_ACTIVE_TRIAL");
    expect(schema).toContain("REGISTRY_STATUS_REVIEW");
    expect(schema).toContain("model TrialAlert");
    expect(schema).toContain("noAutoPromotion   Boolean          @default(true)");
    expect(schema).toContain("scoreHistoryId    String?");
    expect(schema).toContain("scoreHistory    ClaimScoreHistory?");
  });

  it("creates indexes and optional links for review workflow handoff", () => {
    expect(migration).toContain('CREATE TYPE "TrialAlertKind"');
    expect(migration).toContain('CREATE TABLE "TrialAlert"');
    expect(migration).toContain('"noAutoPromotion" BOOLEAN NOT NULL DEFAULT true');
    expect(migration).toContain(
      'CREATE INDEX "TrialAlert_scoreHistoryId_idx" ON "TrialAlert"("scoreHistoryId")'
    );
    expect(migration).toContain(
      'ALTER TABLE "TrialAlert" ADD CONSTRAINT "TrialAlert_scoreHistoryId_fkey"'
    );
  });
});
