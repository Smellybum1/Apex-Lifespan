import { describe, expect, it } from "vitest";

import {
  formatSafetyAlertRegionLabel,
  normalizeSafetyReviewRegion,
  safetyDomainForAlertType,
  summarizeSafetyAlertsByDomain,
  summarizeSafetyDomainCoverage,
  summarizeRegionalSafetyDomainCoverage,
  summarizeRegionalSafetyRegulatoryCoverage,
  summarizeRegionalSafetyRegulatoryReviewGaps
} from "@/lib/safety-domains";
import { australiaRegulatoryStatuses, safetyAlerts } from "@/lib/seed-data";

describe("safety domain taxonomy", () => {
  it("maps captured alert types to stable safety domains", () => {
    expect(safetyDomainForAlertType("Kidney risk")).toMatchObject({
      id: "clinical_safety",
      label: "Clinical safety"
    });
    expect(safetyDomainForAlertType("Mislabeling")).toMatchObject({
      id: "product_quality",
      label: "Product quality"
    });
    expect(safetyDomainForAlertType("Prohibited in sport")).toMatchObject({
      id: "sport_eligibility",
      label: "Sport eligibility"
    });
    expect(safetyDomainForAlertType("Unapproved therapeutic good")).toMatchObject({
      id: "regulatory_access",
      label: "Regulatory access"
    });
  });

  it("summarizes seed safety alerts by domain without inventing new alerts", () => {
    const summaries = summarizeSafetyAlertsByDomain(safetyAlerts);

    expect(summaries).toEqual([
      {
        alertCount: 2,
        alertTypes: ["Compounding restriction", "Unapproved therapeutic good"],
        description:
          "Regulatory access, prescription, approval, or compounding-context signals.",
        highestSeverity: "Clinician review recommended",
        id: "regulatory_access",
        label: "Regulatory access",
        regions: ["Australia", "United States"]
      },
      {
        alertCount: 2,
        alertTypes: ["Drug interaction", "Kidney risk"],
        description:
          "Adverse-event, organ-system, interaction, or clinician-review signals captured in local evidence.",
        highestSeverity: "Moderate",
        id: "clinical_safety",
        label: "Clinical safety",
        regions: ["General"]
      }
    ]);
    expect(summaries.reduce((total, summary) => total + summary.alertCount, 0)).toBe(
      safetyAlerts.length
    );
  });

  it("reports safety-domain coverage gaps without inventing regional facts", () => {
    const coverage = summarizeSafetyDomainCoverage(safetyAlerts);

    expect(coverage).toEqual([
      expect.objectContaining({
        alertCount: 2,
        id: "clinical_safety",
        regions: ["General"],
        status: "reviewed-alerts-captured",
        statusLabel: "Reviewed alerts captured"
      }),
      expect.objectContaining({
        alertCount: 0,
        id: "product_quality",
        regions: [],
        status: "not-yet-captured",
        statusLabel: "Not yet captured in reviewed alerts"
      }),
      expect.objectContaining({
        alertCount: 2,
        id: "regulatory_access",
        regions: ["Australia", "United States"],
        status: "reviewed-alerts-captured",
        statusLabel: "Reviewed alerts captured"
      }),
      expect.objectContaining({
        alertCount: 0,
        id: "sport_eligibility",
        regions: [],
        status: "not-yet-captured",
        statusLabel: "Not yet captured in reviewed alerts"
      })
    ]);
    expect(coverage.reduce((total, summary) => total + summary.alertCount, 0)).toBe(
      safetyAlerts.length
    );
  });

  it("builds a regional safety-domain matrix without treating gaps as clearance", () => {
    const coverage = summarizeRegionalSafetyDomainCoverage(safetyAlerts);
    const australia = coverage.find((region) => region.region === "Australia");
    const canada = coverage.find((region) => region.region === "Canada");
    const general = coverage.find((region) => region.region === "General");

    expect(coverage).toHaveLength(6);
    expect(australia).toMatchObject({
      alertCount: 1,
      region: "Australia",
      reviewScopeLabel: "Australia/TGA primary lens",
      reviewedDomainCount: 1,
      totalDomainCount: 4
    });
    expect(australia?.domains).toEqual([
      expect.objectContaining({
        alertCount: 0,
        id: "clinical_safety",
        status: "not-yet-captured",
        statusLabel: "Not yet captured in reviewed alerts"
      }),
      expect.objectContaining({
        alertCount: 0,
        id: "product_quality",
        status: "not-yet-captured"
      }),
      expect.objectContaining({
        alertCount: 1,
        alertTypes: ["Unapproved therapeutic good"],
        highestSeverityLabel: "Clinician review recommended",
        id: "regulatory_access",
        status: "reviewed-alerts-captured"
      }),
      expect.objectContaining({
        alertCount: 0,
        id: "sport_eligibility",
        status: "not-yet-captured"
      })
    ]);
    expect(general).toMatchObject({
      alertCount: 2,
      reviewedDomainCount: 1,
      reviewScopeLabel: "General or cross-region safety context"
    });
    expect(general?.domains.find((domain) => domain.id === "clinical_safety")).toMatchObject({
      alertCount: 2,
      alertTypes: ["Drug interaction", "Kidney risk"],
      highestSeverityLabel: "Moderate",
      status: "reviewed-alerts-captured"
    });
    expect(canada).toMatchObject({
      alertCount: 0,
      region: "Canada",
      reviewedDomainCount: 0,
      totalDomainCount: 4
    });
    expect(canada?.domains.every((domain) => domain.status === "not-yet-captured")).toBe(
      true
    );
  });

  it("summarizes captured regional safety and AU/TGA regulatory scope", () => {
    const coverage = summarizeRegionalSafetyRegulatoryCoverage({
      australiaRegulatoryStatuses,
      safetyAlerts
    });

    expect(coverage).toEqual([
      {
        australiaRegulatoryKinds: ["Unapproved", "Unknown"],
        australiaRegulatoryStatusCount: australiaRegulatoryStatuses.length,
        highestSafetySeverity: "Clinician review recommended",
        highestSafetySeverityLabel: "Clinician review recommended",
        region: "Australia",
        reviewScopeLabel: "Australia/TGA primary lens",
        safetyAlertCount: 1,
        safetyAlertTypes: ["Unapproved therapeutic good"],
        scopeLabel: "Safety alerts and AU/TGA records",
        status: "captured-records",
        statusLabel: "Captured records"
      },
      {
        australiaRegulatoryKinds: [],
        australiaRegulatoryStatusCount: 0,
        highestSafetySeverity: "Moderate",
        highestSafetySeverityLabel: "Moderate",
        region: "General",
        reviewScopeLabel: "General or cross-region safety context",
        safetyAlertCount: 2,
        safetyAlertTypes: ["Drug interaction", "Kidney risk"],
        scopeLabel: "Safety alerts only",
        status: "captured-records",
        statusLabel: "Captured records"
      },
      {
        australiaRegulatoryKinds: [],
        australiaRegulatoryStatusCount: 0,
        highestSafetySeverity: "Clinician review recommended",
        highestSafetySeverityLabel: "Clinician review recommended",
        region: "United States",
        reviewScopeLabel: "Configured US review scope",
        safetyAlertCount: 1,
        safetyAlertTypes: ["Compounding restriction"],
        scopeLabel: "Safety alerts only",
        status: "captured-records",
        statusLabel: "Captured records"
      },
      {
        australiaRegulatoryKinds: [],
        australiaRegulatoryStatusCount: 0,
        highestSafetySeverityLabel: "No reviewed safety alert",
        region: "Canada",
        reviewScopeLabel: "Configured Canadian review scope",
        safetyAlertCount: 0,
        safetyAlertTypes: [],
        scopeLabel: "Not yet captured",
        status: "not-yet-captured",
        statusLabel: "Not yet captured in reviewed local records"
      },
      {
        australiaRegulatoryKinds: [],
        australiaRegulatoryStatusCount: 0,
        highestSafetySeverityLabel: "No reviewed safety alert",
        region: "European Union",
        reviewScopeLabel: "Configured EU review scope",
        safetyAlertCount: 0,
        safetyAlertTypes: [],
        scopeLabel: "Not yet captured",
        status: "not-yet-captured",
        statusLabel: "Not yet captured in reviewed local records"
      },
      {
        australiaRegulatoryKinds: [],
        australiaRegulatoryStatusCount: 0,
        highestSafetySeverityLabel: "No reviewed safety alert",
        region: "United Kingdom",
        reviewScopeLabel: "Configured UK review scope",
        safetyAlertCount: 0,
        safetyAlertTypes: [],
        scopeLabel: "Not yet captured",
        status: "not-yet-captured",
        statusLabel: "Not yet captured in reviewed local records"
      }
    ]);
    expect(
      coverage.reduce((total, summary) => total + summary.safetyAlertCount, 0)
    ).toBe(safetyAlerts.length);
    expect(
      coverage.reduce((total, summary) => total + summary.australiaRegulatoryStatusCount, 0)
    ).toBe(australiaRegulatoryStatuses.length);
  });

  it("builds region-specific safety/regulatory review gaps without inferring clearance", () => {
    const gaps = summarizeRegionalSafetyRegulatoryReviewGaps({
      australiaRegulatoryStatuses,
      safetyAlerts
    });

    expect(gaps).toEqual([
      expect.objectContaining({
        australiaRegulatoryStatusCount: australiaRegulatoryStatuses.length,
        capturedSafetyDomains: ["regulatory_access"],
        capturedSafetyDomainLabels: ["Regulatory access"],
        missingSafetyDomains: [
          "clinical_safety",
          "product_quality",
          "sport_eligibility"
        ],
        missingSafetyDomainLabels: [
          "Clinical safety",
          "Product quality",
          "Sport eligibility"
        ],
        noClearanceInferred: true,
        region: "Australia",
        reviewGapStatus: "captured-with-domain-gaps",
        reviewPriority: "primary-lens-gap",
        reviewPriorityLabel: "Primary AU/TGA review gap",
        safetyAlertCount: 1,
        scopeLabel: "Safety alerts and AU/TGA records",
        status: "captured-records"
      }),
      expect.objectContaining({
        capturedSafetyDomains: ["clinical_safety"],
        missingSafetyDomains: [
          "product_quality",
          "regulatory_access",
          "sport_eligibility"
        ],
        noClearanceInferred: true,
        region: "General",
        reviewGapStatus: "captured-with-domain-gaps",
        reviewPriority: "captured-record-gap",
        safetyAlertCount: 2,
        scopeLabel: "Safety alerts only",
        status: "captured-records"
      }),
      expect.objectContaining({
        capturedSafetyDomains: ["regulatory_access"],
        noClearanceInferred: true,
        region: "United States",
        reviewGapStatus: "captured-with-domain-gaps",
        reviewPriority: "captured-record-gap",
        safetyAlertCount: 1
      }),
      expect.objectContaining({
        capturedSafetyDomains: [],
        missingSafetyDomains: [
          "clinical_safety",
          "product_quality",
          "regulatory_access",
          "sport_eligibility"
        ],
        noClearanceInferred: true,
        region: "Canada",
        reviewGapStatus: "not-yet-captured",
        reviewPriority: "unstarted-configured-scope",
        reviewPriorityLabel: "Configured scope not yet captured",
        safetyAlertCount: 0,
        status: "not-yet-captured"
      }),
      expect.objectContaining({
        region: "European Union",
        reviewGapStatus: "not-yet-captured"
      }),
      expect.objectContaining({
        region: "United Kingdom",
        reviewGapStatus: "not-yet-captured"
      })
    ]);
    expect(gaps[0]?.nextAction).toContain("Do not treat captured records as regional clearance");
    expect(gaps.find((gap) => gap.region === "Canada")?.nextAction).toContain(
      "absent records are review gaps, not clearance"
    );
  });

  it("labels regional review gaps as monitoring only when all current domains are captured", () => {
    const completeAustraliaAlerts = [
      {
        id: "alert-au-clinical",
        alertType: "Kidney risk",
        date: "2026-06-13",
        interventionId: "creatine",
        lastChecked: "2026-06-13",
        region: "AU",
        severity: "Moderate",
        source: "Other",
        summary: "Synthetic reviewed regional-domain fixture.",
        url: "https://example.test/au-clinical"
      },
      {
        id: "alert-au-quality",
        alertType: "Mislabeling",
        date: "2026-06-13",
        interventionId: "creatine",
        lastChecked: "2026-06-13",
        region: "AU",
        severity: "Moderate",
        source: "Other",
        summary: "Synthetic reviewed regional-domain fixture.",
        url: "https://example.test/au-quality"
      },
      {
        id: "alert-au-regulatory",
        alertType: "Unapproved therapeutic good",
        date: "2026-06-13",
        interventionId: "bpc-157",
        lastChecked: "2026-06-13",
        region: "AU",
        severity: "Clinician review recommended",
        source: "TGA",
        summary: "Synthetic reviewed regional-domain fixture.",
        url: "https://example.test/au-regulatory"
      },
      {
        id: "alert-au-sport",
        alertType: "Prohibited in sport",
        date: "2026-06-13",
        interventionId: "bpc-157",
        lastChecked: "2026-06-13",
        region: "AU",
        severity: "High",
        source: "Other",
        summary: "Synthetic reviewed regional-domain fixture.",
        url: "https://example.test/au-sport"
      }
    ] satisfies typeof safetyAlerts;

    const australiaGap = summarizeRegionalSafetyRegulatoryReviewGaps({
      australiaRegulatoryStatuses: [],
      safetyAlerts: completeAustraliaAlerts
    }).find((gap) => gap.region === "Australia");

    expect(australiaGap).toMatchObject({
      capturedSafetyDomains: [
        "clinical_safety",
        "product_quality",
        "regulatory_access",
        "sport_eligibility"
      ],
      missingSafetyDomains: [],
      nextAction:
        "Maintain review cadence for Australia; all configured safety domains have reviewed local alerts, but this still is not product clearance.",
      noClearanceInferred: true,
      reviewGapStatus: "captured-all-safety-domains",
      reviewPriority: "monitoring",
      reviewPriorityLabel: "Current domain model captured; maintain review cadence",
      status: "captured-records"
    });
  });

  it("normalizes common region aliases into configured review scopes", () => {
    const aliasAlerts = [
      {
        id: "alert-us",
        alertType: "Mislabeling",
        date: "2026-06-13",
        interventionId: "creatine",
        lastChecked: "2026-06-13",
        region: "US",
        severity: "Moderate",
        source: "FDA",
        summary: "Synthetic reviewed region-alias fixture.",
        url: "https://example.test/us"
      },
      {
        id: "alert-uk",
        alertType: "Prescription-only",
        date: "2026-06-13",
        interventionId: "bpc-157",
        lastChecked: "2026-06-13",
        region: "UK",
        severity: "High",
        source: "Other",
        summary: "Synthetic reviewed region-alias fixture.",
        url: "https://example.test/uk"
      },
      {
        id: "alert-eu",
        alertType: "Adulteration",
        date: "2026-06-13",
        interventionId: "omega-3",
        lastChecked: "2026-06-13",
        region: "EU",
        severity: "Moderate",
        source: "Other",
        summary: "Synthetic reviewed region-alias fixture.",
        url: "https://example.test/eu"
      },
      {
        id: "alert-global",
        alertType: "Drug interaction",
        date: "2026-06-13",
        interventionId: "vitamin-d",
        lastChecked: "2026-06-13",
        region: "Global",
        severity: "Moderate",
        source: "Other",
        summary: "Synthetic reviewed region-alias fixture.",
        url: "https://example.test/global"
      }
    ] satisfies typeof safetyAlerts;
    const coverage = summarizeRegionalSafetyRegulatoryCoverage({
      australiaRegulatoryStatuses: [],
      safetyAlerts: aliasAlerts
    });

    expect(coverage.map((region) => region.region)).toEqual([
      "European Union",
      "United Kingdom",
      "United States",
      "General",
      "Australia",
      "Canada"
    ]);
    expect(coverage.find((region) => region.region === "United States")).toMatchObject({
      highestSafetySeverityLabel: "Moderate",
      safetyAlertCount: 1,
      safetyAlertTypes: ["Mislabeling"],
      status: "captured-records"
    });
    expect(coverage.find((region) => region.region === "United Kingdom")).toMatchObject({
      highestSafetySeverityLabel: "High",
      safetyAlertCount: 1,
      safetyAlertTypes: ["Prescription-only"],
      status: "captured-records"
    });
    expect(coverage.find((region) => region.region === "European Union")).toMatchObject({
      safetyAlertCount: 1,
      safetyAlertTypes: ["Adulteration"],
      status: "captured-records"
    });
    expect(coverage.find((region) => region.region === "General")).toMatchObject({
      safetyAlertCount: 1,
      safetyAlertTypes: ["Drug interaction"],
      status: "captured-records"
    });

    expect(summarizeSafetyAlertsByDomain(aliasAlerts)).toEqual([
      expect.objectContaining({
        alertTypes: ["Prescription-only"],
        id: "regulatory_access",
        regions: ["United Kingdom"]
      }),
      expect.objectContaining({
        alertTypes: ["Adulteration", "Mislabeling"],
        id: "product_quality",
        regions: ["European Union", "United States"]
      }),
      expect.objectContaining({
        alertTypes: ["Drug interaction"],
        id: "clinical_safety",
        regions: ["General"]
      })
    ]);

    expect(
      summarizeRegionalSafetyDomainCoverage(aliasAlerts).find(
        (region) => region.region === "United States"
      )
    ).toMatchObject({
      alertCount: 1,
      reviewedDomainCount: 1,
      domains: expect.arrayContaining([
        expect.objectContaining({
          alertTypes: ["Mislabeling"],
          id: "product_quality",
          status: "reviewed-alerts-captured"
        })
      ])
    });
  });

  it("formats raw region aliases without losing the captured source code", () => {
    expect(normalizeSafetyReviewRegion(" AU ")).toBe("Australia");
    expect(normalizeSafetyReviewRegion("United States")).toBe("United States");
    expect(formatSafetyAlertRegionLabel("US")).toBe("United States (US)");
    expect(formatSafetyAlertRegionLabel("United States")).toBe("United States");
  });
});
