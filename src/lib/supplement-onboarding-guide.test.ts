import { describe, expect, it } from "vitest";

import type { FullTextSourceInventoryItem } from "@/lib/full-text-source-readiness";
import {
  buildSupplementOnboardingGuideReport,
  summarizeSupplementOnboardingGuideReport,
  supplementOnboardingGuideReportToMarkdown
} from "@/lib/supplement-onboarding-guide";
import {
  buildDraftBatchSupplementOnboardingPacket,
  buildDraftSupplementOnboardingPacket,
  buildExistingBatchSupplementOnboardingPacket,
  buildExistingSupplementOnboardingPacket
} from "@/lib/supplement-onboarding-packet";
import type { Claim, EvidenceDashboardData, Intervention, Study } from "@/lib/types";

describe("supplement onboarding guide", () => {
  it("recommends the first read-only review command for a draft supplement", () => {
    const packetReport = buildDraftSupplementOnboardingPacket({
      generatedAt: new Date("2026-06-13T10:00:00.000Z"),
      input: {
        category: "Vitamin/mineral",
        claimTemplateIds: ["sleep"],
        name: "Magnesium glycinate"
      }
    });
    const guide = buildSupplementOnboardingGuideReport({ packetReport });
    const summary = summarizeSupplementOnboardingGuideReport(guide);
    const markdown = supplementOnboardingGuideReportToMarkdown(guide);

    expect(summary).toMatchObject({
      generatedAt: "2026-06-13T10:00:00.000Z",
      humanOwned: true,
      mode: "draft",
      noAutoPromotion: true,
      noAutoReview: true,
      noAutoWrite: true,
      noCandidateDecision: true,
      noDatabaseWrite: true,
      noExtractionWrite: true,
      noFullTextFetch: true,
      readOnly: true,
      recommendedCommand: {
        label: "Review seed/database import plan",
        mode: "read-only",
        stage: "seed-diff",
        status: "recommended"
      },
      summary: {
        explicitWriteAfterReviewCommands: 1,
        localFileWriteCommands: 1,
        readOnlyCommands: 3,
        totalCommands: 5
      }
    });
    expect(summary.commandQueue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Queue sources after reviewed seed/database record exists",
          status: "explicit-write-after-review"
        })
      ])
    );
    expect(markdown).toContain("No database write: true");
    expect(markdown).toContain("Review seed/database import plan");
  });

  it("recommends connector prep when an existing supplement has reviewed full-text source inventory", () => {
    const packetReport = buildExistingSupplementOnboardingPacket({
      data: dashboardData(),
      fullTextInventoryPath: "docs/codex/onboarding/fulltext-source-inventory.local.json",
      fullTextSourceInventory: [reviewedFullTextSource()],
      generatedAt: new Date("2026-06-13T10:00:00.000Z"),
      supplementQuery: "creatine"
    });
    const guide = buildSupplementOnboardingGuideReport({ packetReport });
    const summary = summarizeSupplementOnboardingGuideReport(guide);

    expect(summary).toMatchObject({
      mode: "existing",
      noConnectorApproval: true,
      noExtractionWrite: true,
      noFullTextFetch: true,
      recommendedCommand: {
        label: "Write connector prep kit",
        mode: "local-file-write",
        stage: "full-text",
        status: "recommended"
      }
    });
    expect(summary.commandQueue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Check fixture starter progress",
          mode: "read-only",
          status: "read-only"
        }),
        expect.objectContaining({
          label: "Preview fixture extraction draft",
          mode: "read-only",
          status: "read-only"
        })
      ])
    );
  });

  it("recommends the all-source review kit when full-text inventory has not started", () => {
    const packetReport = buildExistingSupplementOnboardingPacket({
      data: dashboardData(),
      generatedAt: new Date("2026-06-13T10:00:00.000Z"),
      supplementQuery: "creatine"
    });
    const summary = summarizeSupplementOnboardingGuideReport(
      buildSupplementOnboardingGuideReport({ packetReport })
    );

    expect(summary).toMatchObject({
      mode: "existing",
      noAutoApproval: true,
      noConnectorApproval: true,
      noFullTextFetch: true,
      recommendedCommand: {
        label: "Create all-source review kit",
        mode: "local-file-write",
        stage: "full-text",
        status: "recommended"
      },
      summary: {
        explicitWriteAfterReviewCommands: 0,
        localFileWriteCommands: 2,
        readOnlyCommands: 7,
        totalCommands: 9
      }
    });
    expect(summary.commandQueue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Create focused source review kit",
          mode: "local-file-write",
          status: "local-file-write"
        }),
        expect.objectContaining({
          label: "Check inventory progress",
          mode: "read-only",
          status: "read-only"
        })
      ])
    );
  });

  it("keeps draft batch commands isolated and recommends the first seed review", () => {
    const packetReport = buildDraftBatchSupplementOnboardingPacket({
      generatedAt: new Date("2026-06-13T10:00:00.000Z"),
      inputs: [
        {
          category: "Vitamin/mineral",
          claimTemplateIds: ["sleep"],
          name: "Magnesium glycinate"
        },
        {
          category: "Vitamin/mineral",
          claimTemplateIds: ["safety"],
          name: "Zinc picolinate"
        }
      ]
    });
    const summary = summarizeSupplementOnboardingGuideReport(
      buildSupplementOnboardingGuideReport({ packetReport })
    );

    expect(summary).toMatchObject({
      mode: "draft-batch",
      noAutoWrite: true,
      noDatabaseWrite: true,
      noAutoReview: true,
      recommendedCommand: {
        label: "Magnesium glycinate: Review seed/database import plan",
        mode: "read-only",
        stage: "seed-diff",
        status: "recommended"
      },
      summary: {
        explicitWriteAfterReviewCommands: 2,
        localFileWriteCommands: 2,
        readOnlyCommands: 6,
        totalCommands: 10
      }
    });
    expect(summary.commandQueue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Zinc picolinate: Review seed/database import plan",
          status: "read-only"
        }),
        expect.objectContaining({
          label: "Magnesium glycinate: Queue sources after reviewed seed/database record exists",
          status: "explicit-write-after-review"
        })
      ])
    );
  });

  it("recommends batch connector prep when reviewed full-text inventory is available", () => {
    const packetReport = buildExistingBatchSupplementOnboardingPacket({
      data: dashboardData({
        claims: [
          claim({
            id: "creatine-strength",
            interventionId: "creatine",
            reviewStatus: "Human reviewed"
          }),
          claim({
            id: "vitamin-d-deficiency",
            interventionId: "vitamin-d",
            outcome: "Safety/adverse effects",
            reviewStatus: "Human reviewed"
          })
        ],
        interventions: [
          intervention({
            category: "Amino acid",
            id: "creatine",
            name: "Creatine",
            slug: "creatine"
          }),
          intervention({
            category: "Vitamin/mineral",
            id: "vitamin-d",
            name: "Vitamin D",
            slug: "vitamin-d"
          })
        ]
      }),
      fullTextInventoryPath: "docs/codex/onboarding/fulltext-source-inventory.local.json",
      fullTextSourceInventory: [reviewedFullTextSource()],
      generatedAt: new Date("2026-06-13T10:00:00.000Z"),
      supplements: [
        {
          supplementQuery: "creatine"
        },
        {
          supplementQuery: "vitamin-d"
        }
      ]
    });
    const summary = summarizeSupplementOnboardingGuideReport(
      buildSupplementOnboardingGuideReport({ packetReport })
    );

    expect(summary).toMatchObject({
      mode: "existing-batch",
      noConnectorApproval: true,
      noExtractionWrite: true,
      noFullTextFetch: true,
      recommendedCommand: {
        label: "Write connector prep kit",
        mode: "local-file-write",
        stage: "full-text",
        status: "recommended"
      }
    });
    expect(summary.commandQueue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Vitamin D: Composite status",
          mode: "read-only",
          status: "read-only"
        }),
        expect.objectContaining({
          label: "Write connector prep kit",
          mode: "local-file-write",
          status: "recommended"
        }),
        expect.objectContaining({
          label: "Check fixture starter progress",
          mode: "read-only",
          status: "read-only"
        }),
        expect.objectContaining({
          label: "Review connector readiness",
          mode: "read-only",
          status: "read-only"
        }),
        expect.objectContaining({
          label: "Preview connector approval packet",
          mode: "read-only",
          status: "read-only"
        })
      ])
    );
    expect(
      summary.commandQueue.filter((command) => command.label === "Write connector prep kit")
    ).toHaveLength(1);
    expect(
      summary.commandQueue.some((command) =>
        command.label.endsWith(": Write connector prep kit")
      )
    ).toBe(false);
    expect(
      summary.commandQueue.filter(
        (command) => command.label === "Preview connector approval packet"
      )
    ).toHaveLength(1);
    expect(
      summary.commandQueue.some((command) =>
        command.label.endsWith(": Preview connector approval packet")
      )
    ).toBe(false);
  });
});

function reviewedFullTextSource(): FullTextSourceInventoryItem {
  return {
    accessMethod: "api",
    allowedUse: "Open-access full-text capture for reviewed records only.",
    approval: {
      accessMethodReviewed: true,
      approvedForLiveFetch: true,
      approvedForPublicExport: true,
      approvedForStorage: true,
      derivedOnlyExportReviewed: true,
      rawRetentionReviewed: true,
      robotsOrApiPolicyReviewed: true,
      termsReviewed: true
    },
    authRequired: false,
    cacheTtl: "24h",
    captchaRisk: false,
    dryRunSupported: true,
    id: "pmc-open-access",
    label: "PubMed Central Open Access subset",
    liveFetchSupported: true,
    loginRequired: false,
    notes: "Reviewed open-access source.",
    policyUrl: "https://example.test/policy",
    privateDataRisk: false,
    rateLimit: "1 request/second",
    rawRetentionPolicy: "Local raw text deleted after extraction review.",
    reviewedAt: "2026-06-12",
    reviewedBy: "operator",
    sourceKind: "biomedical-literature",
    termsUrl: "https://example.test/terms"
  };
}

function dashboardData(
  overrides: Partial<EvidenceDashboardData> = {}
): EvidenceDashboardData {
  return {
    australiaRegulatoryStatuses: [],
    claims: [
      claim({
        id: "creatine-strength",
        interventionId: "creatine",
        reviewStatus: "Human reviewed"
      })
    ],
    dataSource: "seed",
    interventions: [
      intervention({
        id: "creatine",
        name: "Creatine",
        slug: "creatine"
      })
    ],
    productSignals: [],
    references: [],
    safetyAlerts: [],
    studies: [study()],
    trialWatchItems: [],
    ...overrides
  };
}

function intervention(overrides: Partial<Intervention> = {}): Intervention {
  return {
    category: "Amino acid",
    commonForms: ["Powder"],
    evidenceSummary: "Fixture evidence.",
    id: "creatine",
    interactionSummary: "Fixture interactions.",
    lastReviewed: "2026-06-13",
    name: "Creatine",
    regulatoryStatus: "Ingredient-level context.",
    safetySummary: "Fixture safety.",
    slug: "creatine",
    synonyms: ["creatine"],
    ...overrides
  };
}

function claim(overrides: Partial<Claim> = {}): Claim {
  return {
    applicabilityNotes: "Applies to reviewed population.",
    claimText: "Strength support.",
    clinicalRelevance: "Reviewed.",
    comparator: "Reviewed.",
    confidenceLevel: "Moderate",
    doseFormStudied: "Reviewed.",
    durationStudied: "Reviewed.",
    effectSize: "Reviewed.",
    evidenceGrade: "Reviewed.",
    finalLabel: "Useful for Specific Use Case",
    id: "creatine-strength",
    interventionId: "creatine",
    keyReferenceIds: [],
    lastUpdated: "2026-06-13",
    momentum: "Stable",
    outcome: "Muscle/strength",
    populationStudied: "Adults",
    reviewStatus: "Human reviewed",
    safetyNotes: "Safety caveats retained.",
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
    whatWouldChangeScore: "More reviewed evidence.",
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
