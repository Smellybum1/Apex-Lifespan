import { describe, expect, it } from "vitest";

import {
  buildSupplementOnboardingQualityDashboard,
  summarizeSupplementOnboardingQualityDashboard
} from "@/lib/supplement-onboarding-quality";
import type { Claim, EvidenceDashboardData, Intervention, Study } from "@/lib/types";

describe("supplement onboarding quality dashboard", () => {
  it("summarizes ready and blocked supplement onboarding states", () => {
    const report = buildSupplementOnboardingQualityDashboard({
      data: dashboardData({
        australiaRegulatoryStatuses: [
          {
            checkedAt: "2026-06-12",
            evidenceRequirement: "Reviewed product-level evidence required for product claims.",
            id: "magnesium-au",
            interventionId: "magnesium",
            kind: "AUST L",
            notes: "Ingredient-level status only.",
            region: "AU",
            sourceUrl: "https://example.test/tga",
            status: "Listed medicine ingredient context.",
            supplySummary: "Do not infer a specific product status."
          }
        ],
        claims: [
          claim({
            id: "magnesium-sleep",
            keyReferenceIds: ["ref-magnesium"],
            reviewStatus: "Human reviewed"
          })
        ],
        interventions: [
          intervention(),
          intervention({
            category: "Peptide/biologic",
            id: "example-peptide",
            name: "Example peptide",
            slug: "example-peptide"
          })
        ],
        references: [
          {
            id: "ref-magnesium",
            source: "PubMed",
            title: "Magnesium sleep review",
            url: "https://pubmed.ncbi.nlm.nih.gov/123/"
          }
        ],
        studies: [
          study({
            referenceId: "ref-magnesium"
          })
        ]
      }),
      generatedAt: new Date("2026-06-12T10:00:00Z"),
      sourceSignals: {
        candidates: [
          {
            acceptedReferenceId: "ref-magnesium",
            claimId: "magnesium-sleep",
            convictionLabel: "High",
            convictionScore: 88,
            decision: "ACCEPTED",
            interventionId: "magnesium",
            reviewStatus: "HUMAN_REVIEWED",
            source: "PubMed",
            title: "Magnesium sleep review"
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

    expect(report).toMatchObject({
      dataSource: "database",
      fullTextSources: {
        counts: {
          blockedSources: 3,
          dryRunSupportedSources: 1,
          liveApprovedSources: 0,
          sources: 3
        },
        fixtureContract: {
          derivedOnly: true,
          rawTextStored: false,
          status: "ready"
        },
        liveCaptureReady: false,
        readOnly: true
      },
      fullTextNextAction: {
        commands: expect.arrayContaining([
          expect.objectContaining({
            command:
              "npm run onboarding:fulltext-sources -- --write-review-kit docs/codex/onboarding --all-sources",
            id: "write-all-source-review-kit",
            mode: "local-file-write"
          }),
          expect.objectContaining({
            id: "write-focused-source-review-kit",
            mode: "local-file-write"
          })
        ]),
        noAutoApproval: true,
        noConnectorApproval: true,
        noLiveFetch: true,
        status: "create-inventory-template"
      },
      fullTextConnectorApproval: {
        approvalGranted: false,
        noImplementationApproval: true,
        summary: {
          blockedSources: 2,
          holdSources: 1,
          readyForApprovalSources: 0,
          sources: 3
        }
      },
      generatedAt: "2026-06-12T10:00:00.000Z",
      humanOwned: true,
      priorityQueue: [
        expect.objectContaining({
          action: "Add reviewed draft claim scopes before queueing source discovery.",
          blockers: 4,
          slug: "example-peptide",
          tier: "blocked-setup"
        }),
        expect.objectContaining({
          promotionReadyClaims: 1,
          slug: "magnesium",
          tier: "promotion-review"
        })
      ],
      readOnly: true,
      sourceTracking: {
        status: "available"
      },
      summary: {
        blockedSupplements: 1,
        candidates: 1,
        promotionReadyClaims: 1,
        readySupplements: 1,
        supplements: 2,
        totalClaims: 1
      }
    });
    expect(report.rows.map((row) => row.supplement.id)).toEqual([
      "example-peptide",
      "magnesium"
    ]);
    expect(report.rows[0]).toMatchObject({
      status: "blocked",
      states: {
        candidates: "missing",
        draft: "missing-claims",
        extraction: "missing",
        promotion: "blocked",
        queue: "missing",
        reviewPacket: "missing"
      }
    });
    expect(report.rows[0].blockers).toEqual(
      expect.arrayContaining([
        "Add reviewed draft claim scopes before queueing source discovery.",
        "Queue claim-scoped source discovery jobs.",
        "Run source discovery jobs until source candidates are available for review."
      ])
    );
    expect(report.rows[1]).toMatchObject({
      convictionDistribution: {
        high: 1
      },
      counts: {
        acceptedCandidates: 1,
        claims: 1,
        reviewedClaims: 1,
        sourceJobs: 1
      },
      promotion: {
        readyClaims: 1,
        totalClaims: 1
      },
      reviewPacketAutopilot: {
        noAutoAccept: true,
        noAutoExtraction: true,
        noAutoPromotion: true,
        noAutoReject: true,
        readyNoPendingCandidates: 1,
        reviewPendingCandidate: 0,
        summarizeLimitations: 0
      },
      reviewPacketDecision: {
        holdOrReject: 0,
        needsMoreEvidence: 0,
        readyForHumanReview: 1
      },
      status: "ready",
      states: {
        candidates: "found",
        draft: "reviewed",
        extraction: "complete",
        promotion: "ready",
        queue: "completed",
        reviewPacket: "complete"
      }
    });
  });

  it("adds read-only packet preview commands for the recommended candidate", () => {
    const summary = summarizeSupplementOnboardingQualityDashboard(
      buildSupplementOnboardingQualityDashboard({
        data: dashboardData({
          claims: [claim()],
          interventions: [intervention()]
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
      })
    );

    expect(summary.rows[0].reviewPacketAutopilot).toMatchObject({
      noAutoAccept: true,
      noAutoExtraction: true,
      noAutoPromotion: true,
      noAutoReject: true,
      recommendedCandidate: {
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

  it("keeps seed-mode source tracking unavailable as a warning, not an automatic write step", () => {
    const report = buildSupplementOnboardingQualityDashboard({
      data: dashboardData({
        australiaRegulatoryStatuses: [
          {
            checkedAt: "2026-06-12",
            evidenceRequirement: "Product-level status remains separate.",
            id: "magnesium-au",
            interventionId: "magnesium",
            kind: "Unknown",
            notes: "Ingredient-level only.",
            region: "AU",
            sourceUrl: "https://example.test/tga",
            status: "Unknown.",
            supplySummary: "Do not infer product authorisation."
          }
        ],
        claims: [
          claim({
            keyReferenceIds: ["ref-magnesium"],
            reviewStatus: "Human reviewed"
          })
        ],
        interventions: [intervention()],
        references: [
          {
            id: "ref-magnesium",
            source: "PubMed",
            title: "Magnesium sleep review",
            url: "https://pubmed.ncbi.nlm.nih.gov/123/"
          }
        ],
        studies: [study({ referenceId: "ref-magnesium" })]
      }),
      sourceSignals: {
        unavailableReason: "database-backed source tracking is unavailable in seed data mode"
      }
    });

    expect(report.rows[0]).toMatchObject({
      status: "warning",
      states: {
        candidates: "unavailable",
        queue: "unavailable"
      }
    });
    expect(report.rows[0].warnings).toEqual(
      expect.arrayContaining([
        "Source tracking unavailable: database-backed source tracking is unavailable in seed data mode",
        "AU/TGA status is explicitly Unknown; do not infer product-level authorisation."
      ])
    );

    expect(summarizeSupplementOnboardingQualityDashboard(report)).toMatchObject({
      priorityQueue: [
        expect.objectContaining({
          slug: "magnesium",
          tier: "warning-review"
        })
      ],
      readOnly: true,
      rows: [
        {
          blockers: [],
          name: "Magnesium",
          status: "warning"
        }
      ],
      summary: {
        warningSupplements: 1
      }
    });
  });

  it("surfaces accepted-packet safety signals as review warnings", () => {
    const report = buildSupplementOnboardingQualityDashboard({
      data: dashboardData({
        australiaRegulatoryStatuses: [
          {
            checkedAt: "2026-06-12",
            evidenceRequirement: "Reviewed product-level evidence required for product claims.",
            id: "magnesium-au",
            interventionId: "magnesium",
            kind: "AUST L",
            notes: "Ingredient-level status only.",
            region: "AU",
            sourceUrl: "https://example.test/tga",
            status: "Listed medicine ingredient context.",
            supplySummary: "Do not infer a specific product status."
          }
        ],
        claims: [
          claim({
            id: "magnesium-sleep",
            keyReferenceIds: ["ref-magnesium"],
            reviewStatus: "Human reviewed"
          })
        ],
        interventions: [intervention()],
        references: [
          {
            id: "ref-magnesium",
            source: "PubMed",
            title: "Magnesium sleep review",
            url: "https://pubmed.ncbi.nlm.nih.gov/123/"
          }
        ],
        studies: [
          study({
            adverseEvents:
              "Reviewed adverse events and bleeding caveats for packet review.",
            referenceId: "ref-magnesium"
          })
        ]
      }),
      sourceSignals: {
        candidates: [
          {
            acceptedReferenceId: "ref-magnesium",
            claimId: "magnesium-sleep",
            convictionLabel: "High",
            convictionScore: 88,
            decision: "ACCEPTED",
            interventionId: "magnesium",
            reviewStatus: "HUMAN_REVIEWED",
            source: "PubMed",
            title: "Magnesium sleep review"
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

    expect(report.rows[0]).toMatchObject({
      counts: {
        safetySignals: 2
      },
      status: "warning",
      warnings: [
        "2 accepted-packet safety/watchlist signal(s) need caveat review."
      ]
    });
    expect(report.priorityQueue[0]).toMatchObject({
      action: "Review accepted-packet safety/watchlist caveats before promotion.",
      safetySignals: 2,
      tier: "safety-caveat-review"
    });
    expect(report.summary).toMatchObject({
      safetySignals: 2,
      warningSupplements: 1
    });
  });

  it("warns instead of blocking when a complete packet predates source-candidate tracking", () => {
    const report = buildSupplementOnboardingQualityDashboard({
      data: dashboardData({
        australiaRegulatoryStatuses: [
          {
            checkedAt: "2026-06-12",
            evidenceRequirement: "Product-level status remains separate.",
            id: "magnesium-au",
            interventionId: "magnesium",
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
            keyReferenceIds: ["ref-magnesium"],
            reviewStatus: "Human reviewed"
          })
        ],
        interventions: [intervention()],
        references: [
          {
            id: "ref-magnesium",
            source: "PubMed",
            title: "Magnesium sleep review",
            url: "https://pubmed.ncbi.nlm.nih.gov/123/"
          }
        ],
        studies: [study({ referenceId: "ref-magnesium" })]
      }),
      sourceSignals: {
        candidates: [],
        jobs: []
      }
    });

    expect(report.rows[0]).toMatchObject({
      blockers: [],
      status: "warning",
      states: {
        candidates: "missing",
        queue: "missing",
        reviewPacket: "complete"
      }
    });
    expect(report.rows[0].warnings).toEqual(
      expect.arrayContaining([
        "No source discovery job history is visible; this packet may predate onboarding queueing.",
        "No source candidates are visible; this packet may predate source-candidate tracking."
      ])
    );
  });

  it("includes a reviewed user-owned full-text inventory in the quality summary", () => {
    const report = buildSupplementOnboardingQualityDashboard({
      data: dashboardData(),
      fullTextInventoryPath: "docs/codex/onboarding/fulltext-source-inventory.local.json",
      fullTextSourceInventory: [
        {
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
          id: "reviewed-source",
          label: "Reviewed source",
          liveFetchSupported: true,
          loginRequired: false,
          notes: "Reviewed fixture source.",
          policyUrl: "https://example.test/policy",
          privateDataRisk: false,
          rateLimit: "1 request/second",
          rawRetentionPolicy: "Local raw text deleted after extraction review.",
          reviewedAt: "2026-06-12",
          reviewedBy: "operator",
          sourceKind: "fixture",
          termsUrl: "https://example.test/terms"
        }
      ],
      generatedAt: new Date("2026-06-12T10:00:00Z")
    });

    expect(report.fullTextSources).toMatchObject({
      blocked: [],
      counts: {
        blockedSources: 0,
        dryRunSupportedSources: 1,
        liveApprovedSources: 1,
        sources: 1
      },
      liveCaptureReady: true,
      nextAction:
        "Approved full-text sources are ready for a separate, explicit connector implementation review."
    });
    expect(report.fullTextNextAction).toMatchObject({
      commands: expect.arrayContaining([
        expect.objectContaining({
          id: "connector-review-summary",
          mode: "read-only"
        }),
        expect.objectContaining({
          id: "write-connector-review",
          mode: "local-file-write"
        })
      ]),
      selectedSource: {
        connectorReviewStatus: "ready-for-review",
        progressStatus: "ready-for-connector-review"
      },
      status: "open-connector-review"
    });
    expect(summarizeSupplementOnboardingQualityDashboard(report)).toMatchObject({
      fullTextConnectorApproval: {
        approvalGranted: false,
        noImplementationApproval: true,
        summary: {
          readyForApprovalSources: 1
        }
      },
      fullTextNextAction: {
        noConnectorApproval: true,
        status: "open-connector-review"
      },
      fullTextSources: {
        liveCaptureReady: true,
        readOnly: true
      }
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
    claimText: "Sleep support.",
    clinicalRelevance: "Draft.",
    comparator: "Draft.",
    confidenceLevel: "Very low",
    doseFormStudied: "Draft.",
    durationStudied: "Draft.",
    effectSize: "Draft.",
    evidenceGrade: "Draft.",
    finalLabel: "Insufficient Evidence",
    id: "magnesium-sleep",
    interventionId: "magnesium",
    keyReferenceIds: [],
    lastUpdated: "2026-06-12",
    momentum: "Stable",
    outcome: "Sleep",
    populationStudied: "Draft.",
    reviewStatus: "Unreviewed AI draft",
    safetyNotes: "Safety caveats remain required.",
    scores: {
      effectSize: 1,
      evidenceDirectness: 1,
      evidenceRigor: 1,
      hypePenalty: 5,
      measurability: 3,
      productQuality: 1,
      regulatoryRisk: 5,
      safety: 3
    },
    whatWouldChangeScore: "Reviewed extraction and product status.",
    ...overrides
  };
}

function study(overrides: Partial<Study> = {}): Study {
  return {
    adverseEvents: "Reviewed.",
    fundingConflicts: "Reviewed.",
    id: "study-magnesium",
    intervention: "Magnesium",
    outcomes: ["Sleep"],
    population: "Adults",
    referenceId: "ref-magnesium",
    riskOfBias: "Reviewed.",
    sampleSize: "Reviewed.",
    source: "PubMed",
    studyType: "Systematic review",
    title: "Magnesium review",
    year: 2026,
    ...overrides
  };
}
