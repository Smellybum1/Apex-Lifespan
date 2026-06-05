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

  it("normalises submitted live preview terms before storing request state", () => {
    expect(DASHBOARD_SOURCE).toContain(
      "normaliseLiveSourceSearchTerm"
    );
    expect(DASHBOARD_SOURCE.match(/const nextTerm = normaliseLiveSourceSearchTerm\(term\);/g))
      .toHaveLength(2);
  });

  it("uses public display fallback text for live preview errors", () => {
    expect(DASHBOARD_SOURCE).toContain(
      'setPubMedError(publicLiveSourceDisplayError("PubMed", error));'
    );
    expect(DASHBOARD_SOURCE).toContain(
      'setTrialError(publicLiveSourceDisplayError("ClinicalTrials.gov", error));'
    );
    expect(DASHBOARD_SOURCE).not.toContain(
      'setPubMedError(error instanceof Error ? error.message : "PubMed search failed.");'
    );
    expect(DASHBOARD_SOURCE).not.toContain(
      'error instanceof Error ? error.message : "ClinicalTrials.gov search failed."'
    );
  });

  it("normalises raw live preview API link terms", () => {
    expect(DASHBOARD_SOURCE).toContain(
      "const pubMedApiTerm = normaliseLiveSourceSearchTerm(submittedPubMedSearch?.term ?? pubMedTerm);"
    );
    expect(DASHBOARD_SOURCE).toContain(
      "const trialApiTerm = normaliseLiveSourceSearchTerm(submittedTrialSearch?.term ?? trialTerm);"
    );
    expect(DASHBOARD_SOURCE).toContain(
      "`/api/pubmed/search?term=${encodeURIComponent(pubMedApiTerm)}&retmax=5`"
    );
    expect(DASHBOARD_SOURCE).toContain(
      "`/api/trials/search?term=${encodeURIComponent(trialApiTerm)}&pageSize=5`"
    );
  });
});
