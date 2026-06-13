import { describe, expect, it } from "vitest";

import {
  buildSupplementOnboardingReadinessReport,
  summarizeSupplementOnboardingReadinessReport,
  type SupplementOnboardingSourceCandidateSignal
} from "@/lib/supplement-onboarding-readiness";
import type { Claim, EvidenceDashboardData, Intervention } from "@/lib/types";

describe("supplement onboarding readiness", () => {
  it("blocks when the supplement is not present", () => {
    const report = buildSupplementOnboardingReadinessReport({
      data: dashboardData(),
      generatedAt: new Date("2026-06-12T10:00:00Z"),
      supplementQuery: "magnesium"
    });

    expect(report.overall).toBe("blocked");
    expect(report.checks[0]).toMatchObject({
      id: "intervention-present",
      status: "blocked"
    });
  });

  it("reports early onboarding blockers for a supplement with draft claims", () => {
    const report = buildSupplementOnboardingReadinessReport({
      data: dashboardData({
        claims: [
          claim({
            id: "magnesium-sleep",
            outcome: "Sleep",
            reviewStatus: "Unreviewed AI draft"
          })
        ],
        interventions: [intervention()]
      }),
      generatedAt: new Date("2026-06-12T10:00:00Z"),
      sourceSignals: {
        unavailableReason: "seed mode"
      },
      supplementQuery: "magnesium"
    });
    const summary = summarizeSupplementOnboardingReadinessReport(report);

    expect(summary.counts.blocked).toBeGreaterThan(0);
    expect(summary.warningChecks.map((check) => check.id)).toEqual(
      expect.arrayContaining(["source-jobs", "source-candidates"])
    );
    expect(summary.blockedChecks.map((check) => check.id)).toEqual(
      expect.arrayContaining(["au-tga-status", "source-packets", "human-review"])
    );
  });

  it("passes when claims are reviewed, source packets complete, and source work exists", () => {
    const report = buildSupplementOnboardingReadinessReport({
      data: dashboardData({
        australiaRegulatoryStatuses: [
          {
            checkedAt: "2026-06-12",
            evidenceRequirement: "Reviewed product-level status separately.",
            id: "magnesium-au",
            interventionId: "magnesium",
            kind: "AUST L",
            notes: "Reviewed.",
            region: "AU",
            sourceUrl: "https://example.test",
            status: "Listed product evidence attached.",
            supplySummary: "Product-level evidence reviewed."
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
            source: "PubMed",
            title: "Magnesium review",
            url: "https://pubmed.ncbi.nlm.nih.gov/1/"
          }
        ],
        studies: [
          {
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
            year: 2026
          }
        ]
      }),
      generatedAt: new Date("2026-06-12T10:00:00Z"),
      sourceSignals: {
        candidates: [
          {
            claimId: "magnesium-sleep",
            convictionLabel: "High",
            convictionLimitations: [],
            convictionPositiveFactors: ["PubMed-indexed biomedical source"],
            convictionScore: 84,
            convictionUncertainty:
              "Source conviction is a review-priority signal, not an automatic evidence grade or human-review substitute.",
            dedupeKey: "pubmed|au|magnesium|123",
            decision: "ACCEPTED",
            externalId: "123",
            interventionId: "magnesium",
            reviewStatus: "HUMAN_REVIEWED",
            sourceReputationLabel: "high-repute",
            source: "PubMed",
            title: "Magnesium review",
            triageRationale: [
              "high-repute source with high conviction (84/100).",
              "Strong traceability and relevance signals make this a first-pass review candidate."
            ],
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
      },
      supplementQuery: "magnesium"
    });

    expect(report.overall).toBe("ready");
    expect(report.checks.find((check) => check.id === "source-candidates")?.detail).toContain(
      "average source conviction 84/100"
    );
    expect(report.checks.find((check) => check.id === "source-candidates")?.detail).toContain(
      "top cluster 84/100 High PubMed"
    );
    expect(report.sourceConviction).toMatchObject({
      averageScore: 84,
      candidates: [
        {
          label: "High",
          positiveFactors: ["PubMed-indexed biomedical source"],
          score: 84,
          sourceReputationLabel: "high-repute",
          triageRecommendation: "review-first"
        }
      ]
    });
    expect(report.sourceConviction?.clusters).toEqual([
      expect.objectContaining({
        candidateCount: 1,
        claimIds: ["magnesium-sleep"],
        clusterKey: "pubmed|external-id|123",
        label: "High",
        nextAction:
          "Review this cluster first for possible accepted-reference matching; confirmation is still explicit.",
        score: 84,
        triageRecommendation: "review-first"
      })
    ]);
  });

  it("clusters duplicate source identities and ranks highest-conviction clusters first", () => {
    const report = buildSupplementOnboardingReadinessReport({
      data: dashboardData({
        claims: [
          claim({
            id: "magnesium-sleep",
            outcome: "Sleep"
          })
        ],
        interventions: [intervention()]
      }),
      generatedAt: new Date("2026-06-12T10:00:00Z"),
      sourceSignals: {
        candidates: [
          sourceCandidate({
            convictionLabel: "Moderate",
            convictionScore: 60,
            dedupeKey: "pubmed|au|magnesium|123|sleep",
            externalId: "123",
            title: "Magnesium sleep review"
          }),
          sourceCandidate({
            convictionLabel: "Low",
            convictionScore: 42,
            dedupeKey: "pubmed|au|magnesium|123|safety",
            externalId: "123",
            title: "Magnesium sleep review"
          }),
          sourceCandidate({
            convictionLabel: "High",
            convictionScore: 88,
            dedupeKey: "pubmed|au|magnesium|999",
            externalId: "999",
            title: "Magnesium systematic review"
          }),
          sourceCandidate({
            convictionLabel: "Very low",
            convictionScore: 30,
            dedupeKey: "pubmed|au|magnesium|pilot",
            externalId: undefined,
            title: "Magnesium pilot registry"
          }),
          sourceCandidate({
            convictionLabel: "Very low",
            convictionScore: 25,
            dedupeKey: "clinicaltrials.gov|au|magnesium|pilot",
            externalId: undefined,
            source: "ClinicalTrials.gov",
            title: "Magnesium pilot registry"
          })
        ],
        jobs: []
      },
      supplementQuery: "magnesium"
    });

    expect(report.sourceConviction?.candidates.map((candidate) => candidate.score)).toEqual([
      88,
      60,
      42,
      30,
      25
    ]);
    expect(report.sourceConviction?.clusters).toEqual([
      expect.objectContaining({
        candidateCount: 1,
        clusterKey: "pubmed|external-id|999",
        label: "High",
        score: 88
      }),
      expect.objectContaining({
        candidateCount: 2,
        clusterKey: "pubmed|external-id|123",
        label: "Moderate",
        score: 60
      }),
      expect.objectContaining({
        candidateCount: 2,
        clusterKey: "title|magnesium pilot registry",
        score: 30
      })
    ]);
  });

  it("clusters high-similarity title variants without merging different topics", () => {
    const report = buildSupplementOnboardingReadinessReport({
      data: dashboardData({
        claims: [
          claim({
            id: "magnesium-sleep",
            outcome: "Sleep"
          })
        ],
        interventions: [intervention()]
      }),
      generatedAt: new Date("2026-06-12T10:00:00Z"),
      sourceSignals: {
        candidates: [
          sourceCandidate({
            convictionLabel: "Moderate",
            convictionScore: 68,
            dedupeKey: "pubmed|au|magnesium|sleep-rct",
            externalId: undefined,
            title:
              "Magnesium supplementation for sleep in older adults: randomized controlled trial"
          }),
          sourceCandidate({
            convictionLabel: "Low",
            convictionScore: 44,
            dedupeKey: "clinicaltrials.gov|au|magnesium|sleep-rct",
            externalId: undefined,
            source: "ClinicalTrials.gov",
            title:
              "Magnesium for sleep in older adults randomized controlled trial"
          }),
          sourceCandidate({
            convictionLabel: "Low",
            convictionScore: 40,
            dedupeKey: "pubmed|au|magnesium|blood-pressure",
            externalId: undefined,
            title: "Magnesium and blood pressure randomized controlled trial"
          })
        ],
        jobs: []
      },
      supplementQuery: "magnesium"
    });

    expect(report.sourceConviction?.clusters).toEqual([
      expect.objectContaining({
        candidateCount: 2,
        clusterKey:
          "title-fuzzy|adult controlled magnesium older randomized sleep trial",
        limitations: [
          "Fuzzy title cluster; confirm duplicate identity before accepting."
        ],
        matchKind: "fuzzy-title",
        score: 68,
        titleVariants: [
          "Magnesium for sleep in older adults randomized controlled trial",
          "Magnesium supplementation for sleep in older adults: randomized controlled trial"
        ]
      }),
      expect.objectContaining({
        candidateCount: 1,
        clusterKey:
          "title|magnesium and blood pressure randomized controlled trial",
        matchKind: "exact-title",
        score: 40
      })
    ]);
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
    applicabilityNotes: "Draft.",
    claimText: "Draft claim.",
    clinicalRelevance: "Draft.",
    comparator: "Draft.",
    confidenceLevel: "Very low",
    doseFormStudied: "Draft.",
    durationStudied: "Draft.",
    effectSize: "Draft.",
    evidenceGrade: "Draft.",
    finalLabel: "Insufficient Evidence",
    id: "magnesium-safety",
    interventionId: "magnesium",
    keyReferenceIds: [],
    lastUpdated: "2026-06-12",
    momentum: "Stable",
    outcome: "Safety/adverse effects",
    populationStudied: "Draft.",
    reviewStatus: "Unreviewed AI draft",
    safetyNotes: "Draft.",
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
    whatWouldChangeScore: "Review.",
    ...overrides
  };
}

function sourceCandidate(
  overrides: Partial<SupplementOnboardingSourceCandidateSignal> = {}
): SupplementOnboardingSourceCandidateSignal {
  return {
    claimId: "magnesium-sleep",
    convictionLimitations: [],
    convictionPositiveFactors: [],
    decision: "PENDING_REVIEW",
    interventionId: "magnesium",
    reviewStatus: "UNREVIEWED",
    source: "PubMed",
    ...overrides
  };
}
