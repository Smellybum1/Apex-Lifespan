import { describe, expect, it } from "vitest";

import {
  buildSupplementOnboardingStatusReport,
  summarizeSupplementOnboardingStatusReport
} from "@/lib/supplement-onboarding-status";
import type { FullTextSourceInventoryItem } from "@/lib/full-text-source-readiness";
import type { Claim, EvidenceDashboardData, Intervention, Study } from "@/lib/types";

describe("supplement onboarding status report", () => {
  it("combines quality, priority, next-action, readiness, and full-text gates", () => {
    const report = buildSupplementOnboardingStatusReport({
      data: dashboardData({
        australiaRegulatoryStatuses: [
          {
            checkedAt: "2026-06-12",
            evidenceRequirement: "Product-level status remains separate.",
            id: "creatine-au",
            interventionId: "creatine",
            kind: "AUST L",
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
            id: "magnesium",
            name: "Magnesium",
            slug: "magnesium"
          }),
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
      generatedAt: new Date("2026-06-12T10:00:00Z"),
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
    const summary = summarizeSupplementOnboardingStatusReport(report);

    expect(report).toMatchObject({
      dataSource: "database",
      humanOwned: true,
      noAutoPromotion: true,
      noAutoWrite: true,
      priorityQueue: [
        expect.objectContaining({
          slug: "magnesium",
          tier: "blocked-setup"
        }),
        expect.objectContaining({
          slug: "creatine",
          tier: "promotion-review"
        })
      ],
      readOnly: true,
      scope: "all"
    });
    expect(summary).toMatchObject({
      commands: expect.arrayContaining([
        expect.objectContaining({
          command: "npm run onboarding:quality -- --summary",
          stage: "quality"
        }),
        expect.objectContaining({
          command: "npm run onboarding:next -- --summary",
          stage: "next-action"
        }),
        expect.objectContaining({
          command: "npm run onboarding:fulltext-sources -- --progress --summary",
          stage: "full-text-progress"
        }),
        expect.objectContaining({
          command: "npm run onboarding:fulltext-sources -- --next --summary",
          stage: "full-text-next-action"
        }),
        expect.objectContaining({
          command: "npm run onboarding:fulltext-sources -- --connector-review --summary",
          stage: "full-text-connector-review"
        }),
        expect.objectContaining({
          command:
            "npm run onboarding:fulltext-sources -- --connector-approval-packet --summary",
          stage: "full-text-connector-approval"
        })
      ]),
      fullText: {
        connectorApproval: {
          approvalGranted: false,
          noImplementationApproval: true,
          summary: {
            blockedSources: 2,
            holdSources: 1,
            readyForApprovalSources: 0,
            sources: 3
          }
        },
        connectorReview: {
          summary: {
            blockedSources: 2,
            holdSources: 1,
            readyForReviewSources: 0,
            sources: 3
          }
        },
        nextAction: {
          commands: expect.arrayContaining([
            expect.objectContaining({
              command:
                "npm run onboarding:fulltext-sources -- --write-review-kit docs/codex/onboarding --all-sources",
              id: "write-all-source-review-kit"
            }),
            expect.objectContaining({
              id: "write-focused-source-review-kit"
            })
          ]),
          status: "create-inventory-template"
        },
        progress: {
          summary: {
            notStartedSources: 3,
            readyForConnectorReviewSources: 0,
            sources: 3
          }
        },
        readiness: {
          counts: {
            blockedSources: 3,
            holdSources: 1,
            startHereSources: 1,
            sources: 3
          }
        }
      },
      nextAction: "Draft and review claim scopes before queueing source discovery.",
      quality: {
        blockedSupplements: 1,
        candidateReviewAutopilot: {
          blockedBySafety: 0,
          noAutoAccept: true,
          noAutoExtraction: true,
          noAutoPromotion: true,
          noAutoReject: true,
          readyNoPendingCandidates: 1,
          reviewPendingCandidate: 0,
          summarizeLimitations: 0
        },
        readySupplements: 1,
        supplements: 2
      },
      readiness: [
        expect.objectContaining({
          blockedChecks: expect.any(Number),
          overall: "blocked",
          slug: "magnesium"
        }),
        expect.objectContaining({
          overall: "ready",
          slug: "creatine"
        })
      ]
    });
    expect(summary.workflow).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "source-tracking-gate",
          status: "complete"
        }),
        expect.objectContaining({
          command: "npm run onboard:supplement -- --name <name> --category <category>",
          label: "Draft Claims",
          stage: "draft-claims",
          status: "blocked",
          supplements: 1
        }),
        expect.objectContaining({
          label: "Queue Source Searches",
          stage: "queue-sources",
          status: "pending"
        }),
        expect.objectContaining({
          label: "Ready For Explicit Promotion",
          stage: "ready",
          status: "current",
          supplements: 1
        }),
        expect.objectContaining({
          label: "Full-Text Source Gate",
          stage: "full-text-source-gate",
          status: "blocked"
        })
      ])
    );
  });

  it("carries recommended candidate packet previews into the status cockpit summary", () => {
    const report = buildSupplementOnboardingStatusReport({
      data: dashboardData({
        claims: [
          claim({
            id: "magnesium-sleep",
            interventionId: "magnesium"
          })
        ],
        interventions: [
          intervention({
            id: "magnesium",
            name: "Magnesium",
            slug: "magnesium"
          })
        ]
      }),
      sourceSignals: {
        candidates: [
          {
            claimId: "magnesium-sleep",
            convictionLabel: "High",
            convictionScore: 88,
            decision: "PENDING_REVIEW",
            dedupeKey: "pubmed:magnesium:123",
            interventionId: "magnesium",
            reviewStatus: "UNREVIEWED_AI_DRAFT",
            source: "PubMed",
            sourceReputationLabel: "high-repute",
            title: "Magnesium sleep trial",
            triageRecommendation: "review-first"
          }
        ],
        jobs: [
          {
            claimId: "magnesium-sleep",
            interventionId: "magnesium",
            status: "SUCCEEDED"
          }
        ]
      }
    });
    const summary = summarizeSupplementOnboardingStatusReport(report);

    expect(summary.quality.candidateReviewAutopilot).toMatchObject({
      noAutoAccept: true,
      noAutoExtraction: true,
      noAutoPromotion: true,
      noAutoReject: true,
      recommendedCandidate: {
        claimId: "magnesium-sleep",
        dedupeKey: "pubmed:magnesium:123",
        packetPreview: {
          candidateReviewPacketCommand:
            'npm run ingest:sources -- --candidate-review-packet "pubmed:magnesium:123"',
          curationStatusCommand:
            'npm run ingest:sources -- --candidate-curation-status "pubmed:magnesium:123"',
          noCandidateDecision: true,
          noExtractionWrite: true,
          noPromotion: true,
          readOnly: true,
          referenceMatchesCommand:
            'npm run ingest:sources -- --candidate-reference-matches "pubmed:magnesium:123"',
          siblingsCommand:
            'npm run ingest:sources -- --candidate-siblings "pubmed:magnesium:123"'
        }
      },
      reviewPendingCandidate: 1
    });
  });

  it("keeps a missing supplement query focused on the missing readiness gate", () => {
    const report = buildSupplementOnboardingStatusReport({
      data: dashboardData(),
      supplementQuery: "unknown-supplement"
    });
    const summary = summarizeSupplementOnboardingStatusReport(report);

    expect(summary).toMatchObject({
      nextAction:
        "Run npm run onboard:supplement to generate a draft, then add the reviewed intervention before source queueing.",
      priorityQueue: [],
      readiness: [
        {
          blockedChecks: 1,
          nextAction:
            "Run npm run onboard:supplement to generate a draft, then add the reviewed intervention before source queueing.",
          overall: "blocked",
          warningChecks: 0
        }
      ],
      scope: "supplement",
      supplementQuery: "unknown-supplement"
    });
    expect(summary.workflow).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command:
            'npm run onboard:supplement -- --name "unknown-supplement" --category <category>',
          detail:
            "Run npm run onboard:supplement to generate a draft, then add the reviewed intervention before source queueing.",
          stage: "draft-claims",
          status: "blocked",
          supplements: 0
        })
      ])
    );
  });

  it("includes reviewed full-text inventory progress and connector-review status", () => {
    const report = buildSupplementOnboardingStatusReport({
      data: dashboardData(),
      fullTextInventoryPath: "docs/codex/onboarding/fulltext-source-inventory.local.json",
      fullTextSourceInventory: [reviewedFullTextSource()],
      generatedAt: new Date("2026-06-12T10:00:00Z")
    });
    const summary = summarizeSupplementOnboardingStatusReport(report);

    expect(summary.fullText).toMatchObject({
      connectorReview: {
        noConnectorApproval: true,
        noLiveFetch: true,
        rows: [
          expect.objectContaining({
            connectorKey: "pmc-open-access",
            id: "pmc-open-access",
            reviewStatus: "ready-for-review"
          })
        ],
        summary: {
          blockedSources: 0,
          holdSources: 0,
          readyForReviewSources: 1,
          sources: 1
        }
      },
      connectorApproval: {
        approvalGranted: false,
        noImplementationApproval: true,
        rows: [
          expect.objectContaining({
            connectorKey: "pmc-open-access",
            id: "pmc-open-access",
            status: "ready-for-approval"
          })
        ],
        summary: {
          blockedSources: 0,
          holdSources: 0,
          readyForApprovalSources: 1,
          sources: 1
        }
      },
      nextAction: {
        inventoryFilePath: "docs/codex/onboarding/fulltext-source-inventory.local.json",
        selectedSource: {
          connectorReviewStatus: "ready-for-review",
          id: "pmc-open-access",
          progressStatus: "ready-for-connector-review"
        },
        status: "open-connector-review"
      },
      progress: {
        noAutoApproval: true,
        rows: [
          expect.objectContaining({
            completedRequiredFields: 14,
            id: "pmc-open-access",
            status: "ready-for-connector-review",
            totalRequiredFields: 14
          })
        ],
        summary: {
          readyForConnectorReviewSources: 1,
          sources: 1
        }
      },
      readiness: {
        liveCaptureReady: true,
        counts: {
          blockedSources: 0,
          liveApprovedSources: 1,
          sources: 1
        }
      }
    });
    expect(summary.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command:
            'npm run onboarding:quality -- --fulltext-inventory-file "docs/codex/onboarding/fulltext-source-inventory.local.json" --summary',
          stage: "quality"
        }),
        expect.objectContaining({
          command:
            'npm run onboarding:fulltext-sources -- --inventory-file "docs/codex/onboarding/fulltext-source-inventory.local.json" --progress --summary',
          stage: "full-text-progress"
        }),
        expect.objectContaining({
          command:
            'npm run onboarding:fulltext-sources -- --inventory-file "docs/codex/onboarding/fulltext-source-inventory.local.json" --next --summary',
          stage: "full-text-next-action"
        }),
        expect.objectContaining({
          command:
            'npm run onboarding:fulltext-sources -- --inventory-file "docs/codex/onboarding/fulltext-source-inventory.local.json" --write-connector-prep-kit docs/codex/onboarding',
          stage: "full-text-connector-prep-kit"
        }),
        expect.objectContaining({
          command:
            "npm run onboarding:fulltext-fixture -- --fixture-dir docs/codex/onboarding/fulltext-fixtures --progress --summary",
          stage: "full-text-fixture"
        }),
        expect.objectContaining({
          command:
            "npm run onboarding:fulltext-fixture -- --fixture-file docs/codex/onboarding/fulltext-fixtures/pmc-open-access.local.json --summary",
          stage: "full-text-fixture"
        }),
        expect.objectContaining({
          command:
            "npm run onboarding:fulltext-fixture -- --fixture-file docs/codex/onboarding/fulltext-fixtures/pmc-open-access.local.json --extraction-draft --candidate-key <accepted-candidate-dedupe-key> --study-source-type randomized-controlled-trial --summary",
          stage: "full-text-fixture"
        }),
        expect.objectContaining({
          command:
            'npm run onboarding:fulltext-sources -- --inventory-file "docs/codex/onboarding/fulltext-source-inventory.local.json" --connector-review --summary',
          stage: "full-text-connector-review"
        }),
        expect.objectContaining({
          command:
            'npm run onboarding:fulltext-sources -- --inventory-file "docs/codex/onboarding/fulltext-source-inventory.local.json" --connector-approval-packet --summary',
          stage: "full-text-connector-approval"
        })
      ])
    );
    expect(summary.workflow).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Full-Text Source Gate",
          stage: "full-text-source-gate",
          status: "complete"
        })
      ])
    );
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
