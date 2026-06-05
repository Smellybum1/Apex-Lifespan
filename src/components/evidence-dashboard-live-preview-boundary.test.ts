import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const DASHBOARD_SOURCE = readFileSync(
  path.join(process.cwd(), "src", "components", "evidence-dashboard.tsx"),
  "utf8"
);

describe("EvidenceDashboard live preview boundary", () => {
  it("does not allow browser caching for live PubMed preview fetches", () => {
    expect(DASHBOARD_SOURCE).toMatch(
      /fetch\(\s*`\/api\/pubmed\/search[\s\S]*?`\s*,\s*\{\s*signal: controller\.signal,\s*cache: "no-store"\s*\}/
    );
  });

  it("does not allow browser caching for live ClinicalTrials.gov preview fetches", () => {
    expect(DASHBOARD_SOURCE).toMatch(
      /fetch\(\s*`\/api\/trials\/search[\s\S]*?`\s*,\s*\{\s*signal: controller\.signal,\s*cache: "no-store"\s*\}/
    );
  });

  it("labels live preview score chips as review priority", () => {
    expect(DASHBOARD_SOURCE).toContain("Review priority {article.relevanceScore}/100");
    expect(DASHBOARD_SOURCE).toContain("Review priority {study.triageScore}/100");
    expect(DASHBOARD_SOURCE).not.toContain("Triage {article.relevanceScore}/100");
    expect(DASHBOARD_SOURCE).not.toContain("Triage {study.triageScore}/100");
  });
});
