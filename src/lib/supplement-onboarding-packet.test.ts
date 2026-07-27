import { describe, expect, it } from "vitest";

import {
  buildDraftBatchSupplementOnboardingPacket,
  buildDraftSupplementOnboardingPacket,
  buildExistingBatchSupplementOnboardingPacket,
  buildExistingSupplementOnboardingPacket,
  summarizeSupplementOnboardingPacketReport,
  supplementOnboardingPacketReportToMarkdown
} from "@/lib/supplement-onboarding-packet";
import type { FullTextSourceInventoryItem } from "@/lib/full-text-source-readiness";
import type { Claim, EvidenceDashboardData, Intervention, Study } from "@/lib/types";

describe("supplement onboarding packet", () => {
  it("builds a one-command draft packet without performing writes", () => {
    const report = buildDraftSupplementOnboardingPacket({
      generatedAt: new Date("2026-06-13T10:00:00.000Z"),
      input: {
        category: "Vitamin/mineral",
        claimTemplateIds: ["sleep"],
        name: "Magnesium glycinate",
        product: {
          austNumber: "AUST L 123456",
          brand: "Example Brand",
          name: "Example Magnesium Glycinate",
          sourceUrl: "https://example.test/artg-product",
          sponsor: "Example Sponsor Pty Ltd"
        }
      }
    });
    const summary = summarizeSupplementOnboardingPacketReport(report);
    const markdown = supplementOnboardingPacketReportToMarkdown(report);

    expect(summary).toMatchObject({
      generatedAt: "2026-06-13T10:00:00.000Z",
      humanOwned: true,
      mode: "draft",
      noAutoPromotion: true,
      noAutoReview: true,
      noAutoWrite: true,
      noCandidateDecision: true,
      noConnectorApproval: true,
      noDatabaseWrite: true,
      noExtractionWrite: true,
      noFullTextFetch: true,
      readOnly: true,
      draft: {
        claimDrafts: 1,
        databaseImportStatus: "future-gated",
        importAssistantStatus: "manual-review-required",
        interventionId: "magnesium-glycinate",
        name: "Magnesium glycinate",
        reviewKitFiles: 8,
        seedCopyStatus: "review-required"
      }
    });
    expect(summary.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mode: "read-only",
          stage: "seed-diff"
        }),
        expect.objectContaining({
          mode: "local-file-write",
          stage: "review-kit"
        }),
        expect.objectContaining({
          mode: "explicit-write-after-review",
          stage: "source-queue"
        })
      ])
    );
    expect(markdown).toContain("No candidate decision: true");
    expect(markdown).toContain("Queue sources after reviewed seed/database record exists");
  });

  it("builds an existing supplement packet with status, review packet, source conviction, and full-text next action", () => {
    const report = buildExistingSupplementOnboardingPacket({
      data: dashboardData({
        australiaRegulatoryStatuses: [
          {
            checkedAt: "2026-06-12",
            evidenceRequirement: "Product-level status remains separate.",
            id: "creatine-au",
            interventionId: "creatine",
            kind: "Unknown",
            notes: "Ingredient-level only.",
            region: "AU",
            sourceUrl: "https://example.test/tga",
            status: "Ingredient-level context.",
            supplySummary: "Do not infer product authorisation."
          }
        ],
        claims: [
          claim({
            id: "creatine-strength",
            interventionId: "creatine",
            keyReferenceIds: ["ref-creatine"],
            reviewStatus: "Human reviewed"
          })
        ],
        interventions: [
          intervention({
            category: "Amino acid",
            id: "creatine",
            name: "Creatine",
            slug: "creatine"
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
        studies: [
          study({
            id: "study-creatine",
            intervention: "Creatine",
            referenceId: "ref-creatine",
            title: "Creatine and resistance training"
          })
        ]
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
            dedupeKey: "pubmed:creatine:28615996",
            interventionId: "creatine",
            reviewStatus: "HUMAN_REVIEWED",
            source: "PubMed",
            sourceReputationLabel: "high-repute",
            title: "Creatine and resistance training",
            triageRecommendation: "review-first"
          }
        ],
        jobs: [
          {
            claimId: "creatine-strength",
            interventionId: "creatine",
            status: "SUCCEEDED"
          }
        ]
      },
      supplementQuery: "creatine"
    });
    const summary = summarizeSupplementOnboardingPacketReport(report);

    expect(summary).toMatchObject({
      generatedAt: "2026-06-13T10:00:00.000Z",
      humanOwned: true,
      mode: "existing",
      noAutoPromotion: true,
      noAutoWrite: true,
      noCandidateDecision: true,
      noDatabaseWrite: true,
      noExtractionWrite: true,
      readOnly: true,
      existing: {
        dataSource: "database",
        packetCount: 1,
        supplementQuery: "creatine"
      }
    });
    expect(summary.existing?.packets).toEqual([
      expect.objectContaining({
        acceptedCandidates: 1,
        claimId: "creatine-strength",
        pendingCandidates: 0,
        promotionReady: true,
        sourcePacketStatus: "complete",
        supplementId: "creatine"
      })
    ]);
    expect(summary.existing?.sourceConvictionRubric.version).toBe("2026-06-13");
    expect(summary.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: 'npm run onboarding:review-packet -- --supplement "creatine" --summary',
          mode: "read-only",
          stage: "review-packet"
        }),
        expect.objectContaining({
          command: 'npm run onboarding:status -- --supplement "creatine" --summary',
          stage: "status"
        }),
        expect.objectContaining({
          command:
            "npm run onboarding:fulltext-sources -- --write-review-kit docs/codex/onboarding --all-sources",
          label: "Create all-source review kit",
          mode: "local-file-write",
          stage: "full-text"
        }),
        expect.objectContaining({
          command:
            "npm run onboarding:fulltext-sources -- --inventory-file docs/codex/onboarding/fulltext-source-inventory.local.json --progress --summary",
          label: "Check inventory progress",
          mode: "read-only",
          stage: "full-text"
        })
      ])
    );
  });

  it("flattens connector-prep kit follow-up commands for reviewed full-text inventories", () => {
    const report = buildExistingSupplementOnboardingPacket({
      data: dashboardData({
        claims: [
          claim({
            id: "creatine-strength",
            interventionId: "creatine",
            reviewStatus: "Human reviewed"
          })
        ],
        interventions: [
          intervention({
            category: "Amino acid",
            id: "creatine",
            name: "Creatine",
            slug: "creatine"
          })
        ]
      }),
      fullTextInventoryPath: "docs/codex/onboarding/fulltext-source-inventory.local.json",
      fullTextSourceInventory: [reviewedFullTextSource()],
      generatedAt: new Date("2026-06-13T10:00:00.000Z"),
      supplementQuery: "creatine"
    });
    const summary = summarizeSupplementOnboardingPacketReport(report);

    expect(summary.existing?.fullTextNextAction).toBe("open-connector-review");
    expect(summary.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command:
            'npm run onboarding:status -- --supplement "creatine" --fulltext-inventory-file "docs/codex/onboarding/fulltext-source-inventory.local.json" --summary',
          mode: "read-only",
          stage: "status"
        }),
        expect.objectContaining({
          command:
            "npm run onboarding:fulltext-sources -- --inventory-file docs/codex/onboarding/fulltext-source-inventory.local.json --write-connector-prep-kit docs/codex/onboarding",
          label: "Write connector prep kit",
          mode: "local-file-write",
          stage: "full-text"
        }),
        expect.objectContaining({
          command:
            "npm run onboarding:fulltext-fixture -- --fixture-dir docs/codex/onboarding/fulltext-fixtures --progress --summary",
          label: "Check fixture starter progress",
          mode: "read-only",
          stage: "full-text"
        }),
        expect.objectContaining({
          command:
            "npm run onboarding:fulltext-fixture -- --fixture-file docs/codex/onboarding/fulltext-fixtures/pmc-open-access.local.json --summary",
          label: "Validate local fixture starter",
          mode: "read-only",
          stage: "full-text"
        }),
        expect.objectContaining({
          command:
            "npm run onboarding:fulltext-fixture -- --fixture-file docs/codex/onboarding/fulltext-fixtures/pmc-open-access.local.json --extraction-draft --candidate-key <accepted-candidate-dedupe-key> --study-source-type randomized-controlled-trial --summary",
          label: "Preview fixture extraction draft",
          mode: "read-only",
          stage: "full-text"
        }),
        expect.objectContaining({
          command:
            "npm run onboarding:fulltext-sources -- --inventory-file docs/codex/onboarding/fulltext-source-inventory.local.json --connector-review --summary",
          label: "Review connector readiness",
          mode: "read-only",
          stage: "full-text"
        }),
        expect.objectContaining({
          command:
            "npm run onboarding:fulltext-sources -- --inventory-file docs/codex/onboarding/fulltext-source-inventory.local.json --write-connector-review docs/codex/onboarding/fulltext-connector-review.md",
          label: "Write connector review packet",
          mode: "local-file-write",
          stage: "full-text"
        }),
        expect.objectContaining({
          command:
            "npm run onboarding:fulltext-sources -- --inventory-file docs/codex/onboarding/fulltext-source-inventory.local.json --connector-approval-packet --summary",
          label: "Preview connector approval packet",
          mode: "read-only",
          stage: "full-text"
        }),
        expect.objectContaining({
          command:
            "npm run onboarding:fulltext-sources -- --inventory-file docs/codex/onboarding/fulltext-source-inventory.local.json --write-connector-approval-packet docs/codex/onboarding/fulltext-connector-approval-packet.md",
          label: "Write connector approval packet",
          mode: "local-file-write",
          stage: "full-text"
        })
      ])
    );
  });

  it("builds isolated draft batch packets", () => {
    const report = buildDraftBatchSupplementOnboardingPacket({
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
    const summary = summarizeSupplementOnboardingPacketReport(report);
    const markdown = supplementOnboardingPacketReportToMarkdown(report);

    expect(summary).toMatchObject({
      generatedAt: "2026-06-13T10:00:00.000Z",
      mode: "draft-batch",
      noAutoWrite: true,
      noCandidateDecision: true,
      noDatabaseWrite: true,
      readOnly: true,
      batch: {
        isolated: true,
        summary: {
          draftItems: 2,
          existingItems: 0,
          items: 2
        }
      }
    });
    expect(summary.batch?.items).toHaveLength(2);
    expect(summary.batch?.items[0]).toMatchObject({
      key: "magnesium-glycinate",
      mode: "draft",
      name: "Magnesium glycinate",
      packet: {
        draft: {
          interventionId: "magnesium-glycinate",
          name: "Magnesium glycinate"
        },
        mode: "draft"
      }
    });
    expect(summary.batch?.items[1]).toMatchObject({
      key: "zinc-picolinate",
      mode: "draft",
      name: "Zinc picolinate",
      packet: {
        draft: {
          interventionId: "zinc-picolinate",
          name: "Zinc picolinate"
        },
        mode: "draft"
      }
    });
    expect(summary.batch?.items[0]?.packet.nextAction).not.toContain(
      "Zinc picolinate"
    );
    expect(summary.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Magnesium glycinate: Review seed/database import plan"
        }),
        expect.objectContaining({
          label: "Zinc picolinate: Review seed/database import plan"
        })
      ])
    );
    expect(markdown).toContain("batch isolation: true");
    expect(markdown).toContain("Magnesium glycinate");
    expect(markdown).toContain("Zinc picolinate");
  });

  it("builds isolated existing supplement batch packets", () => {
    const report = buildExistingBatchSupplementOnboardingPacket({
      data: dashboardData({
        claims: [
          claim({
            id: "creatine-strength",
            interventionId: "creatine",
            keyReferenceIds: ["ref-creatine"],
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
            id: "vitamin-d",
            name: "Vitamin D",
            slug: "vitamin-d"
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
        studies: [
          study({
            id: "study-creatine",
            intervention: "Creatine",
            referenceId: "ref-creatine",
            title: "Creatine and resistance training"
          })
        ]
      }),
      generatedAt: new Date("2026-06-13T10:00:00.000Z"),
      supplements: [
        {
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
                sourceReputationLabel: "high-repute",
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
          },
          supplementQuery: "creatine"
        },
        {
          supplementQuery: "vitamin-d"
        }
      ]
    });
    const summary = summarizeSupplementOnboardingPacketReport(report);

    expect(summary).toMatchObject({
      generatedAt: "2026-06-13T10:00:00.000Z",
      mode: "existing-batch",
      noAutoReview: true,
      noAutoWrite: true,
      noDatabaseWrite: true,
      readOnly: true,
      batch: {
        isolated: true,
        summary: {
          draftItems: 0,
          existingItems: 2,
          items: 2
        }
      }
    });
    expect(summary.batch?.items.map((item) => item.name)).toEqual([
      "Creatine",
      "Vitamin D"
    ]);
    expect(summary.batch?.items[0]?.packet.existing?.supplementQuery).toBe(
      "creatine"
    );
    expect(summary.batch?.items[1]?.packet.existing?.supplementQuery).toBe(
      "vitamin-d"
    );
    expect(summary.batch?.items[0]?.packet.existing?.packets).toEqual([
      expect.objectContaining({
        claimId: "creatine-strength",
        supplementId: "creatine"
      })
    ]);
    expect(summary.batch?.items[1]?.packet.existing?.packets).toEqual([
      expect.objectContaining({
        claimId: "vitamin-d-deficiency",
        supplementId: "vitamin-d"
      })
    ]);
    expect(summary.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: 'npm run onboarding:status -- --supplement "creatine" --summary',
          label: "Creatine: Composite status"
        }),
        expect.objectContaining({
          command: 'npm run onboarding:status -- --supplement "vitamin-d" --summary',
          label: "Vitamin D: Composite status"
        }),
        expect.objectContaining({
          command:
            "npm run onboarding:fulltext-sources -- --write-review-kit docs/codex/onboarding --all-sources",
          label: "Create all-source review kit",
          mode: "local-file-write",
          stage: "full-text"
        }),
        expect.objectContaining({
          command:
            "npm run onboarding:fulltext-sources -- --inventory-file docs/codex/onboarding/fulltext-source-inventory.local.json --progress --summary",
          label: "Check inventory progress",
          mode: "read-only",
          stage: "full-text"
        })
      ])
    );
    expect(
      summary.commands.filter((command) => command.label === "Create all-source review kit")
    ).toHaveLength(1);
    expect(
      summary.commands.filter(
        (command) =>
          command.label === "Vitamin D: Create all-source review kit" ||
          command.label === "Creatine: Create all-source review kit"
      )
    ).toHaveLength(0);
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

function intervention(overrides: Partial<Intervention> = {}): Intervention {
  return {
    category: "Vitamin/mineral",
    commonForms: ["Capsule"],
    evidenceSummary: "Draft.",
    id: "magnesium",
    interactionSummary: "Draft.",
    lastReviewed: "2026-06-12",
    name: "Magnesium",
    regulatoryStatus: "Draft.",
    safetySummary: "Draft.",
    slug: "magnesium",
    synonyms: ["magnesium"],
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
