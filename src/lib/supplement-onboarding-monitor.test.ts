import { describe, expect, it } from "vitest";

import { filterSupplementOnboardingMonitorDashboard } from "@/lib/supplement-onboarding-monitor";
import { buildSupplementOnboardingQualityDashboard } from "@/lib/supplement-onboarding-quality";
import type { Claim, EvidenceDashboardData, Intervention, Study } from "@/lib/types";

describe("supplement onboarding monitor", () => {
  it("flags stale review evidence, unknown AU/TGA status, and promotion-ready packets", () => {
    const dashboard = buildSupplementOnboardingQualityDashboard({
      data: dashboardData({
        australiaRegulatoryStatuses: [
          {
            checkedAt: "2025-01-01",
            evidenceRequirement: "Product-level status remains separate.",
            id: "creatine-au",
            interventionId: "creatine",
            kind: "Unknown",
            notes: "Ingredient-level only.",
            region: "AU",
            sourceUrl: "https://example.test/tga",
            status: "Unknown product-level status.",
            supplySummary: "Do not infer product authorisation."
          }
        ],
        claims: [
          claim({
            keyReferenceIds: ["ref-creatine"],
            lastUpdated: "2025-01-01",
            reviewStatus: "Human reviewed"
          })
        ],
        interventions: [
          intervention({
            lastReviewed: "2025-01-01"
          })
        ],
        references: [
          {
            id: "ref-creatine",
            source: "PubMed",
            title: "Creatine and resistance training",
            url: "https://pubmed.ncbi.nlm.nih.gov/28615996/"
          }
        ],
        studies: [study({ referenceId: "ref-creatine" })]
      }),
      generatedAt: new Date("2026-06-13T10:00:00.000Z"),
      sourceSignals: {
        candidates: [
          {
            acceptedReferenceId: "ref-creatine",
            claimId: "creatine-strength",
            convictionLabel: "High",
            convictionScore: 90,
            decision: "ACCEPTED",
            interventionId: "creatine",
            reviewStatus: "HUMAN_REVIEWED",
            source: "PubMed",
            title: "Creatine and resistance training"
          }
        ],
        jobs: [
          {
            claimId: "creatine-strength",
            interventionId: "creatine",
            status: "SUCCEEDED"
          }
        ]
      }
    });

    expect(dashboard.monitor).toMatchObject({
      globalIssues: [
        expect.objectContaining({
          kind: "full-text-gate-blocked"
        })
      ],
      humanOwned: true,
      noAutoPromotion: true,
      noAutoReview: true,
      noAutoWrite: true,
      readOnly: true,
      summary: {
        fullTextGateBlocked: true,
        highAttentionCadenceSupplements: 0,
        promotionReadySupplements: 1,
        routineCadenceSupplements: 0,
        staleReviewSupplements: 1,
        supplements: 1,
        unknownProductStatusSupplements: 1,
        watchCadenceSupplements: 1,
        watchSupplements: 1
      }
    });
    expect(dashboard.monitor.rows[0]).toMatchObject({
      noCandidateDecision: true,
      noDatabaseWrite: true,
      noExtractionWrite: true,
      noPublicEvidenceRowsWritten: true,
      refreshPolicy: {
        intervalDays: 180,
        tier: "watch"
      },
      reviewAgeDays: 528,
      staleAfterDays: 180,
      status: "watch",
      supplement: {
        slug: "creatine"
      }
    });
    expect(dashboard.monitor.rows[0].issues.map((issue) => issue.kind)).toEqual(
      expect.arrayContaining([
        "stale-review",
        "unknown-product-status",
        "onboarding-warnings",
        "promotion-ready"
      ])
    );
  });

  it("treats missing product status and incomplete onboarding as action-needed", () => {
    const dashboard = buildSupplementOnboardingQualityDashboard({
      data: dashboardData({
        claims: [claim()],
        interventions: [intervention()]
      }),
      generatedAt: new Date("2026-06-13T10:00:00.000Z"),
      sourceSignals: {
        candidates: [],
        jobs: []
      }
    });

    expect(dashboard.monitor.summary).toMatchObject({
      actionNeededSupplements: 1,
      missingProductStatusSupplements: 1,
      watchCadenceSupplements: 1
    });
    expect(dashboard.monitor.rows[0]).toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          command: "npm run regulatory:review",
          kind: "missing-product-status",
          severity: "blocked"
        }),
        expect.objectContaining({
          kind: "onboarding-blockers",
          severity: "blocked"
        })
      ]),
      status: "action-needed"
    });
  });

  it("filters a monitor dashboard by supplement id, slug, or name", () => {
    const dashboard = buildSupplementOnboardingQualityDashboard({
      data: dashboardData({
        australiaRegulatoryStatuses: [
          regulatoryStatus({
            id: "creatine-au",
            interventionId: "creatine"
          }),
          regulatoryStatus({
            id: "vitamin-d-au",
            interventionId: "vitamin-d"
          })
        ],
        claims: [
          claim({
            id: "creatine-strength",
            interventionId: "creatine",
            reviewStatus: "Human reviewed"
          }),
          claim({
            id: "vitamin-d-deficiency",
            interventionId: "vitamin-d",
            outcome: "Biological aging clocks",
            reviewStatus: "Human reviewed"
          })
        ],
        interventions: [
          intervention(),
          intervention({
            category: "Vitamin/mineral",
            id: "vitamin-d",
            name: "Vitamin D",
            slug: "vitamin-d",
            synonyms: ["cholecalciferol"]
          })
        ]
      }),
      sourceSignals: {
        candidates: [],
        jobs: []
      }
    });

    const byName = filterSupplementOnboardingMonitorDashboard(
      dashboard.monitor,
      "Vitamin D"
    );
    const bySlug = filterSupplementOnboardingMonitorDashboard(
      dashboard.monitor,
      "creatine"
    );

    expect(byName.rows.map((row) => row.supplement.slug)).toEqual(["vitamin-d"]);
    expect(byName.summary).toMatchObject({
      supplements: 1
    });
    expect(bySlug.rows.map((row) => row.supplement.slug)).toEqual(["creatine"]);
    expect(bySlug.summary).toMatchObject({
      supplements: 1
    });
  });

  it("uses a shorter high-attention refresh cadence for peptide and safety-sensitive packets", () => {
    const dashboard = buildSupplementOnboardingQualityDashboard({
      data: dashboardData({
        australiaRegulatoryStatuses: [
          {
            checkedAt: "2026-01-01",
            evidenceRequirement: "Regulatory concern remains explicit.",
            id: "bpc-au",
            interventionId: "bpc-157",
            kind: "Unapproved",
            notes: "No sourcing or self-use guidance.",
            region: "AU",
            sourceUrl: "https://example.test/tga",
            status: "Unapproved therapeutic good concern.",
            supplySummary: "Do not infer lawful consumer supply."
          }
        ],
        claims: [
          claim({
            confidenceLevel: "Very low",
            finalLabel: "Regulatory Concern",
            id: "bpc-157-injury-healing",
            interventionId: "bpc-157",
            keyReferenceIds: ["ref-bpc"],
            lastUpdated: "2026-01-01",
            outcome: "Joint/tendon/skin",
            reviewStatus: "Human reviewed"
          })
        ],
        interventions: [
          intervention({
            category: "Peptide/biologic",
            id: "bpc-157",
            lastReviewed: "2026-01-01",
            name: "BPC-157",
            slug: "bpc-157"
          })
        ],
        references: [
          {
            id: "ref-bpc",
            source: "TGA",
            title: "BPC-157 safety warning",
            url: "https://example.test/tga/bpc"
          }
        ],
        safetyAlerts: [
          {
            alertType: "Unapproved therapeutic good",
            date: "2026-01-01",
            id: "alert-bpc",
            interventionId: "bpc-157",
            lastChecked: "2026-01-01",
            region: "AU",
            severity: "High",
            source: "TGA",
            summary: "Unapproved peptide safety alert.",
            url: "https://example.test/tga/bpc"
          }
        ],
        studies: [
          study({
            adverseEvents: "Regulatory concern.",
            id: "study-bpc",
            intervention: "BPC-157",
            referenceId: "ref-bpc",
            source: "TGA",
            studyType: "Regulatory safety warning",
            title: "BPC-157 safety warning"
          })
        ]
      }),
      generatedAt: new Date("2026-06-13T10:00:00.000Z"),
      sourceSignals: {
        candidates: [
          {
            acceptedReferenceId: "ref-bpc",
            claimId: "bpc-157-injury-healing",
            convictionLabel: "High",
            convictionScore: 90,
            decision: "ACCEPTED",
            interventionId: "bpc-157",
            reviewStatus: "HUMAN_REVIEWED",
            source: "PubMed",
            title: "BPC-157 safety warning"
          }
        ],
        jobs: [
          {
            claimId: "bpc-157-injury-healing",
            interventionId: "bpc-157",
            status: "SUCCEEDED"
          }
        ]
      }
    });

    expect(dashboard.monitor.summary).toMatchObject({
      highAttentionCadenceSupplements: 1,
      staleReviewSupplements: 1
    });
    expect(dashboard.monitor.rows[0]).toMatchObject({
      refreshPolicy: {
        intervalDays: 90,
        tier: "high-attention"
      },
      reviewAgeDays: 163,
      staleAfterDays: 90
    });
    expect(dashboard.monitor.rows[0].refreshPolicy.rationale).toEqual(
      expect.arrayContaining([
        "Peptide/biologic and geroprotector-watchlist categories refresh every 90 days.",
        "Safety, regulatory-concern, avoid, or clinician-oversight labels refresh every 90 days.",
        "Accepted safety/watchlist signals or high-severity alerts refresh every 90 days."
      ])
    );
  });

  it("keeps database source-tracking gaps as global monitor warnings", () => {
    const dashboard = buildSupplementOnboardingQualityDashboard({
      data: dashboardData(),
      sourceSignals: {
        unavailableReason: "database-backed source tracking is unavailable in seed mode"
      }
    });

    expect(dashboard.monitor.globalIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command:
            "npm run onboarding:quality -- --env-file <non-production-env-file> --summary",
          kind: "source-tracking-unavailable",
          severity: "warning"
        })
      ])
    );
    expect(dashboard.monitor.summary).toMatchObject({
      sourceTrackingUnavailable: true
    });
  });
});

function dashboardData(
  overrides: Partial<EvidenceDashboardData> = {}
): EvidenceDashboardData {
  return {
    australiaRegulatoryStatuses: [],
    claims: [],
    dataSource: "database",
    interventions: [],
    productSignals: [],
    references: [],
    safetyAlerts: [],
    studies: [],
    trialWatchItems: [],
    ...overrides
  };
}

function regulatoryStatus(
  overrides: Partial<EvidenceDashboardData["australiaRegulatoryStatuses"][number]> = {}
): EvidenceDashboardData["australiaRegulatoryStatuses"][number] {
  return {
    checkedAt: "2026-06-12",
    evidenceRequirement: "Product-level evidence remains explicit.",
    id: "creatine-au",
    interventionId: "creatine",
    kind: "AUST L",
    notes: "Reviewed placeholder.",
    region: "AU",
    sourceUrl: "https://example.test/artg",
    status: "Listed medicine status reviewed.",
    supplySummary: "Product-level record only.",
    ...overrides
  };
}

function intervention(overrides: Partial<Intervention> = {}): Intervention {
  return {
    category: "Amino acid",
    commonForms: ["Powder"],
    evidenceSummary: "Draft.",
    id: "creatine",
    interactionSummary: "Draft.",
    lastReviewed: "2026-06-12",
    name: "Creatine",
    regulatoryStatus: "Draft.",
    safetySummary: "Draft.",
    slug: "creatine",
    synonyms: ["creatine"],
    ...overrides
  };
}

function claim(overrides: Partial<Claim> = {}): Claim {
  return {
    applicabilityNotes: "Applies only to reviewed population.",
    claimText: "Strength support.",
    clinicalRelevance: "Draft.",
    comparator: "Draft.",
    confidenceLevel: "Moderate",
    doseFormStudied: "Draft.",
    durationStudied: "Draft.",
    effectSize: "Draft.",
    evidenceGrade: "Draft.",
    finalLabel: "Useful for Specific Use Case",
    id: "creatine-strength",
    interventionId: "creatine",
    keyReferenceIds: [],
    lastUpdated: "2026-06-12",
    momentum: "Stable",
    outcome: "Muscle/strength",
    populationStudied: "Draft.",
    reviewStatus: "Unreviewed AI draft",
    safetyNotes: "Safety caveats remain required.",
    scores: {
      effectSize: 6,
      evidenceDirectness: 8,
      evidenceRigor: 8,
      hypePenalty: 2,
      measurability: 8,
      productQuality: 4,
      regulatoryRisk: 2,
      safety: 6
    },
    whatWouldChangeScore: "Reviewed extraction and product status.",
    ...overrides
  };
}

function study(overrides: Partial<Study> = {}): Study {
  return {
    adverseEvents: "Reviewed.",
    fundingConflicts: "Reviewed.",
    id: "study-creatine",
    intervention: "Creatine",
    outcomes: ["Strength"],
    population: "Adults",
    referenceId: "ref-creatine",
    riskOfBias: "Reviewed.",
    sampleSize: "Reviewed.",
    source: "PubMed",
    studyType: "Systematic review",
    title: "Creatine and resistance training",
    year: 2017,
    ...overrides
  };
}
