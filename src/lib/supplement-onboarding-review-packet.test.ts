import { describe, expect, it } from "vitest";

import { buildSupplementOnboardingReviewPacketReport } from "@/lib/supplement-onboarding-review-packet";
import type { Claim, EvidenceDashboardData, Intervention, Study } from "@/lib/types";

describe("supplement onboarding review packet", () => {
  it("builds a compact claim packet with curated sources and best-first candidates", () => {
    const report = buildSupplementOnboardingReviewPacketReport({
      claimId: "magnesium-sleep",
      data: dashboardData({
        australiaRegulatoryStatuses: [
          {
            checkedAt: "2026-06-12",
            evidenceRequirement: "Product-level status still required.",
            id: "magnesium-au",
            interventionId: "magnesium",
            kind: "Unknown",
            notes: "Ingredient-level only.",
            region: "AU",
            sourceUrl: "https://example.test/tga",
            status: "Product-level status unverified.",
            supplySummary: "Do not infer product authorisation."
          }
        ],
        claims: [
          claim({
            id: "magnesium-sleep",
            keyReferenceIds: ["ref-magnesium"],
            outcome: "Sleep",
            reviewStatus: "Human reviewed"
          })
        ],
        interventions: [intervention()],
        references: [
          {
            id: "ref-magnesium",
            identifier: "PMID: 123",
            source: "PubMed",
            title: "Magnesium sleep review",
            url: "https://pubmed.ncbi.nlm.nih.gov/123/",
            year: 2026
          }
        ],
        studies: [
          study({
            adverseEvents:
              "Reviewed adverse events and tolerability caveats for the packet.",
            id: "study-magnesium",
            referenceId: "ref-magnesium",
            title: "Magnesium sleep review"
          })
        ]
      }),
      generatedAt: new Date("2026-06-12T10:00:00Z"),
      sourceSignals: {
        candidates: [
          sourceCandidate({
            acceptedReferenceId: "ref-magnesium",
            convictionLabel: "High",
            convictionScore: 88,
            decision: "ACCEPTED",
            dedupeKey: "pubmed|au|magnesium|123",
            externalId: "123",
            sourceReputationLabel: "high-repute",
            title: "Magnesium sleep review",
            triageRationale: [
              "high-repute source with high conviction (88/100).",
              "Strong traceability and relevance signals make this a first-pass review candidate."
            ],
            triageRecommendation: "review-first"
          }),
          sourceCandidate({
            convictionLabel: "Moderate",
            convictionScore: 60,
            decision: "PENDING_REVIEW",
            dedupeKey: "clinicaltrials.gov|au|magnesium|nct123",
            externalId: "NCT123",
            sourceReputationLabel: "moderate-repute",
            source: "ClinicalTrials.gov",
            title: "Magnesium sleep trial",
            triageRationale: [
              "moderate-repute source with moderate conviction (60/100).",
              "Moderate support; confirm claim fit and study details after stronger candidates."
            ],
            triageRecommendation: "review-after-stronger-sources"
          }),
          sourceCandidate({
            convictionLabel: "Low",
            convictionLimitations: ["title/query overlap is weak"],
            convictionScore: 40,
            decision: "REJECTED",
            dedupeKey: "pubmed|au|magnesium|weak",
            externalId: "999",
            title: "Unrelated mineral review",
            triageRationale: [
              "high-repute source with low conviction (40/100).",
              "Weak relevance or low conviction means this should not support the packet by itself."
            ],
            triageRecommendation: "hold-or-reject"
          })
        ]
      },
      supplementQuery: "magnesium"
    });

    expect(report).toMatchObject({
      generatedAt: "2026-06-12T10:00:00.000Z",
      readOnly: true
    });
    expect(report.packets).toHaveLength(1);
    expect(report.packets[0]).toMatchObject({
      claim: {
        id: "magnesium-sleep",
        reviewStatus: "Human reviewed"
      },
      operatorDecision: {
        candidateCounts: {
          accepted: 1,
          bestFirst: 3,
          holdOrReject: 1,
          lowerConvictionOrRejected: 1,
          limitationsOnly: 0,
          pendingReview: 1,
          reviewAfterStrongerSources: 1,
          reviewFirst: 1
        },
        label: "Needs candidate review",
        noAutoDecision: true,
        readOnly: true,
        recommendation: "needs-more-evidence"
      },
      candidateReviewAutopilot: {
        curationDraftCommand:
          'npm run ingest:sources -- --candidate-curation-draft "clinicaltrials.gov|au|magnesium|nct123"',
        nextAction:
          "Open the recommended candidate curation draft, then explicitly accept or reject it after source review.",
        noAutoAccept: true,
        noAutoExtraction: true,
        noAutoPromotion: true,
        noAutoReject: true,
        readOnly: true,
        recommendedCandidate: {
          dedupeKey: "clinicaltrials.gov|au|magnesium|nct123",
          score: 60,
          sourceReputationLabel: "moderate-repute",
          title: "Magnesium sleep trial",
          triageRecommendation: "review-after-stronger-sources"
        },
        status: "review-pending-candidate"
      },
      proposedPublicWording: {
        status: "review-required",
        uncertaintyLabel: "Very low confidence; Human reviewed."
      },
      promotionDiff: {
        auditMetadata: {
          noAutoPromotion: true,
          operatorPermission: "evidence:promote",
          targetId: "magnesium-sleep",
          targetType: "Claim"
        },
        blockers: [],
        dashboardCards: {
          citationCount: 1,
          confidenceLevel: "Very low",
          evidenceLabel: "Insufficient Evidence",
          extractionStatus: "Extraction complete"
        },
        publicClaimText: {
          changes: false,
          current: "Sleep support.",
          proposed: "Sleep support."
        },
        readyForPromotionReview: true,
        referenceLinks: {
          addedReferenceIds: [],
          currentReferenceIds: ["ref-magnesium"],
          proposedReferenceIds: ["ref-magnesium"],
          removedReferenceIds: []
        },
        uncertaintyLabels: {
          reviewStatus: {
            changes: false,
            current: "Human reviewed",
            proposed: "Human reviewed"
          }
        }
      },
      sourcePacket: {
        status: "complete",
        totalReferences: 1
      },
      safetyWatchlist: {
        acceptedPacketSignals: [
          expect.objectContaining({
            matchedTerms: expect.arrayContaining(["adverse events", "tolerability"]),
            referenceId: "ref-magnesium",
            severity: "warning",
            signalId: "adverse-event-context",
            sourceField: "adverseEvents",
            studyId: "study-magnesium"
          })
        ],
        nextAction:
          "Review accepted-packet safety signals before changing public caveats or promotion wording."
      },
      supplement: {
        id: "magnesium"
      }
    });
    expect(report.packets[0].curatedSources).toEqual([
      expect.objectContaining({
        extractionStatus: "extracted",
        reference: expect.objectContaining({ id: "ref-magnesium" }),
        studies: [
          expect.objectContaining({
            id: "study-magnesium",
            riskOfBias: "Reviewed."
          })
        ]
      })
    ]);
    expect(
      report.packets[0].sourceCandidates.bestFirst.map((candidate) => candidate.dedupeKey)
    ).toEqual([
      "pubmed|au|magnesium|123",
      "clinicaltrials.gov|au|magnesium|nct123",
      "pubmed|au|magnesium|weak"
    ]);
    expect(report.packets[0].sourceCandidates.bestFirst[0]).toMatchObject({
      sourceReputationLabel: "high-repute",
      triageRationale: expect.arrayContaining([
        "Strong traceability and relevance signals make this a first-pass review candidate."
      ]),
      triageRecommendation: "review-first"
    });
    expect(report.packets[0].sourceCandidates.accepted).toHaveLength(1);
    expect(report.packets[0].sourceCandidates.pendingReview).toHaveLength(1);
    expect(report.packets[0].sourceCandidates.lowerConvictionOrRejected).toEqual([
      expect.objectContaining({
        decision: "REJECTED",
        limitations: ["title/query overlap is weak"]
      })
    ]);
    expect(report.packets[0].promotionDiff.scoreChanges).toEqual(
      expect.arrayContaining([
        {
          changes: false,
          current: 1,
          metric: "evidenceDirectness",
          proposed: 1
        },
        {
          changes: false,
          current: 5,
          metric: "hypePenalty",
          proposed: 5
        }
      ])
    );
    expect(report.packets[0].caveats).toEqual(
      expect.arrayContaining([
        "AU/TGA product-level status is unknown or unverified; do not infer product authorisation.",
        "Accepted source packet contains safety/watchlist terms; keep safety caveats visible.",
        "Lower-conviction candidates should be summarized as limitations, not support.",
        "Unreviewed source candidates remain; inspect best-first candidates before promotion."
      ])
    );
    expect(report.packets[0].operatorDecision.nextActions).toEqual(
      expect.arrayContaining([
        "Review pending source candidates and record explicit accept/reject decisions.",
        "Summarize rejected or lower-conviction candidates as limitations."
      ])
    );
    expect(report.packets[0].candidateReviewAutopilot.rationale).toEqual(
      expect.arrayContaining([
        "Source conviction 60/100.",
        "Source reputation: moderate-repute.",
        "Triage recommendation: review-after-stronger-sources.",
        "Moderate support; confirm claim fit and study details after stronger candidates."
      ])
    );
  });

  it("blocks promotion diff when claim review or source extraction is incomplete", () => {
    const report = buildSupplementOnboardingReviewPacketReport({
      claimId: "magnesium-sleep",
      data: dashboardData({
        claims: [
          claim({
            id: "magnesium-sleep",
            keyReferenceIds: ["ref-magnesium"],
            reviewStatus: "Unreviewed AI draft"
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
        ]
      })
    });

    expect(report.packets[0].promotionDiff).toMatchObject({
      blockers: [
        "Add structured extraction for the pending references before treating this packet as complete.",
        "Claim packet must be human-reviewed before promotion review."
      ],
      readyForPromotionReview: false,
      uncertaintyLabels: {
        reviewStatus: {
          changes: true,
          current: "Unreviewed AI draft",
          proposed: "Human reviewed"
        }
      }
    });
    expect(report.packets[0].operatorDecision).toMatchObject({
      label: "Needs more evidence",
      recommendation: "needs-more-evidence",
      summary:
        "The packet is not ready for human review or promotion because evidence links, extraction, or review gates remain incomplete."
    });
  });

  it("flags blocked safety context as hold or reject decision support", () => {
    const report = buildSupplementOnboardingReviewPacketReport({
      claimId: "magnesium-sleep",
      data: dashboardData({
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
              "Reviewed adverse events mention injectable vial and reconstitution context.",
            referenceId: "ref-magnesium"
          })
        ]
      }),
      sourceSignals: {
        candidates: [
          sourceCandidate({
            acceptedReferenceId: "ref-magnesium",
            convictionLabel: "High",
            convictionScore: 88,
            decision: "ACCEPTED",
            title: "Magnesium sleep review"
          })
        ]
      }
    });

    expect(report.packets[0].safetyWatchlist.acceptedPacketSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "blocked",
          signalId: "peptide-administration-context"
        })
      ])
    );
    expect(report.packets[0].operatorDecision).toMatchObject({
      label: "Hold / reject until blocked safety context is resolved",
      recommendation: "hold-or-reject",
      summary:
        "Do not treat this packet as ready. Resolve blocked safety/regulatory context before accepting support or promoting public evidence."
    });
    expect(report.packets[0].candidateReviewAutopilot).toMatchObject({
      noAutoAccept: true,
      noAutoReject: true,
      status: "blocked-by-safety"
    });
  });

  it("marks complete accepted packets ready for explicit human review", () => {
    const report = buildSupplementOnboardingReviewPacketReport({
      claimId: "magnesium-sleep",
      data: dashboardData({
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
            referenceId: "ref-magnesium"
          })
        ]
      }),
      sourceSignals: {
        candidates: [
          sourceCandidate({
            acceptedReferenceId: "ref-magnesium",
            convictionLabel: "High",
            convictionScore: 88,
            decision: "ACCEPTED",
            title: "Magnesium sleep review"
          })
        ]
      }
    });

    expect(report.packets[0].operatorDecision).toMatchObject({
      label: "Ready for human packet review",
      recommendation: "ready-for-human-review",
      summary:
        "The packet is ready for explicit human packet review, with promotion still handled as a separate audited step."
    });
    expect(report.packets[0].operatorDecision.nextActions).toContain(
      "Review promotion diffs separately before any public promotion."
    );
    expect(report.packets[0].candidateReviewAutopilot).toMatchObject({
      noAutoAccept: true,
      noAutoPromotion: true,
      status: "ready-no-pending-candidates"
    });
  });

  it("reports unmatched claim or supplement inputs without mutating data", () => {
    expect(
      buildSupplementOnboardingReviewPacketReport({
        claimId: "missing-claim",
        data: dashboardData(),
        supplementQuery: "missing-supplement"
      })
    ).toMatchObject({
      packets: [],
      readOnly: true,
      unmatchedClaimId: "missing-claim",
      unmatchedSupplementQuery: "missing-supplement"
    });
  });
});

function dashboardData(
  overrides: Partial<EvidenceDashboardData> = {}
): EvidenceDashboardData {
  return {
    australiaRegulatoryStatuses: [],
    claims: [],
    dataSource: "seed",
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

function sourceCandidate(overrides: Record<string, unknown> = {}) {
  return {
    claimId: "magnesium-sleep",
    convictionLimitations: [],
    convictionPositiveFactors: ["PubMed-indexed biomedical source"],
    convictionUncertainty:
      "Source conviction is a review-priority signal, not an automatic evidence grade or human-review substitute.",
    decision: "PENDING_REVIEW",
    interventionId: "magnesium",
    reviewStatus: "UNREVIEWED_AI_DRAFT",
    source: "PubMed",
    ...overrides
  };
}
