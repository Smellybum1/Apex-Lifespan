import { describe, expect, it } from "vitest";

import {
  buildCatalogTrustSummary,
  formatCatalogTrustSummaryLines,
  isNctIdFormat
} from "@/lib/catalog-trust";
import {
  australiaRegulatoryStatuses,
  claims,
  interventions,
  productSignals,
  references,
  safetyAlerts,
  studies,
  trialWatchItems
} from "@/lib/seed-data";
import type { EvidenceDashboardData } from "@/lib/types";

function seedDashboardData(): EvidenceDashboardData {
  return {
    australiaRegulatoryStatuses,
    claims,
    dataSource: "seed",
    interventions,
    productSignals,
    references,
    safetyAlerts,
    studies,
    trialWatchItems
  };
}

describe("catalog trust summary", () => {
  it("summarizes local catalog trust signals without inferring product status", () => {
    const summary = buildCatalogTrustSummary(seedDashboardData());

    expect(summary.claims).toMatchObject({
      humanReviewed: 0,
      sourcePacketsComplete: 9,
      sourcePacketsTotal: 9,
      total: 9,
      unreviewedDrafts: 9
    });
    expect(summary.australia.productExactStatusCount).toBe(0);
    expect(summary.australia.productUnknownStatusCount).toBe(2);
    expect(summary.previewAttentionItems).toEqual(
      expect.arrayContaining([
        "9 claims still need human review",
        "2 product profiles need exact AU/TGA product status"
      ])
    );
  });

  it("formats compact lines for local scripts", () => {
    const lines = formatCatalogTrustSummaryLines(buildCatalogTrustSummary(seedDashboardData()));

    expect(lines.join("\n")).toContain("Interventions: 6");
    expect(lines.join("\n")).toContain("Source packets: 9/9 complete");
    expect(lines.join("\n")).toContain("Product AU/TGA: 0/2 exact product statuses");
  });

  it("recognizes ClinicalTrials.gov NCT ID format without claiming live verification", () => {
    expect(isNctIdFormat("NCT01234567")).toBe(true);
    expect(isNctIdFormat("NCTSEED-CREATINE")).toBe(false);
    expect(isNctIdFormat(undefined)).toBe(false);
  });
});
