import { OutcomeArea as DbOutcomeArea, SourceKind } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  localAcceptedCandidateEvidenceTopicSuggestions,
  localCandidateReviewAutomationDecision,
  localCandidateReviewSignalDecision,
  localBenefitDiscoveryAutomationDecision,
  localBenefitDiscoveryInterventionContextMismatch,
  localIdentityResolutionAutomationDecision,
  type LocalBenefitDiscoveryClusterReadout,
  type LocalIdentityResolutionCandidateReadout
} from "@/lib/data/local-ingestion-control";

const interventionTerms = [
  {
    id: "omega-3",
    name: "Omega-3 EPA/DHA",
    terms: ["omega 3 epa dha", "fish oil"]
  },
  {
    id: "curcumin",
    name: "Curcumin",
    terms: ["curcumin", "turmeric"]
  },
  {
    id: "resveratrol",
    name: "Resveratrol",
    terms: ["resveratrol"]
  },
  {
    id: "green-tea-extract",
    name: "Green tea extract",
    terms: ["green tea extract", "egcg", "camellia sinensis"]
  },
  {
    id: "caffeine",
    name: "Caffeine",
    terms: ["caffeine"]
  },
  {
    id: "creatine",
    name: "Creatine monohydrate",
    terms: ["creatine monohydrate", "creatine"]
  },
  {
    id: "calcium",
    name: "Calcium",
    terms: ["calcium", "calcium carbonate", "calcium citrate"]
  },
  {
    id: "probiotic-blend",
    name: "Probiotic blend",
    terms: ["probiotic blend"]
  }
];

function candidate(
  input: Partial<LocalIdentityResolutionCandidateReadout> = {}
): LocalIdentityResolutionCandidateReadout {
  return {
    dedupeKey: "clinicaltrials|au|omega-3|NCT1",
    externalId: "NCT1",
    identityCautions: [],
    interventionId: "omega-3",
    interventionName: "Omega-3 EPA/DHA",
    matchedInterventions: [],
    mismatchReasons: ["Target supplement is not visible in captured title/source metadata."],
    query: "Omega-3 EPA/DHA",
    source: SourceKind.CLINICALTRIALS_GOV,
    sourceTypeSuggestion: "Clinical trial record",
    title: "Omega-3 fatty acids and inflammatory biomarkers",
    triageScore: 95,
    url: "https://example.test/NCT1",
    ...input
  };
}

function cluster(
  input: Partial<LocalBenefitDiscoveryClusterReadout> = {}
): LocalBenefitDiscoveryClusterReadout {
  return {
    candidateCount: 2,
    clusterKey: "lithium-orotate::COGNITION",
    existingClaims: [{ claimText: "Cognitive support.", id: "claim-1" }],
    interventionId: "lithium-orotate",
    interventionName: "Lithium Orotate",
    leadReasons: [
      "2 unique clean accepted reference(s).",
      "Can link into an existing claim area."
    ],
    mismatchCount: 0,
    novelCandidateCount: 0,
    outcome: DbOutcomeArea.COGNITION,
    outcomeLabel: "Cognition",
    rejectedCount: 0,
    score: 66,
    topicKey: "cognition-memory",
    topicLabel: "Cognition/memory",
    topSources: [],
    usableCandidateCount: 2,
    ...input
  };
}

function reviewCandidate(input: Record<string, unknown> = {}) {
  return {
    claimId: null,
    decision: "PENDING_REVIEW",
    dedupeKey: "pubmed|au|creatine|PMID1",
    discoveredAt: new Date("2026-06-01T00:00:00.000Z"),
    externalId: "PMID1",
    intervention: {
      name: "Creatine monohydrate",
      synonyms: ["creatine"]
    },
    interventionId: "creatine",
    metadata: {
      discoveryClassification: {
        bucket: "maybe-useful",
        cautions: [],
        label: "Maybe useful",
        reasons: ["Review candidate."],
        score: 62,
        version: "test"
      },
      publicationTypes: ["Systematic Review"]
    },
    publishedYear: 2025,
    query: "Creatine monohydrate systematic review human",
    reviewStatus: "UNREVIEWED_AI_DRAFT",
    source: SourceKind.PUBMED,
    sourceType: "Systematic Review",
    title: "Creatine supplementation and resistance training outcomes: a systematic review",
    triageScore: 80,
    url: "https://example.test/PMID1",
    ...input
  } as unknown as Parameters<typeof localCandidateReviewAutomationDecision>[0];
}

describe("localIdentityResolutionAutomationDecision", () => {
  it("confirms exact query-backed rows without competing supplement matches", () => {
    const decision = localIdentityResolutionAutomationDecision(
      candidate(),
      interventionTerms
    );

    expect(decision.action).toBe("confirm-target");
    expect(decision.reasons).toContain(
      "Search query contains the current supplement identity."
    );
  });

  it("holds exact query rows when captured metadata has no target identity signal", () => {
    const decision = localIdentityResolutionAutomationDecision(
      candidate({
        interventionId: "curcumin",
        interventionName: "Curcumin",
        query: "Curcumin",
        title: "Kansui dose escalation in treated participants"
      }),
      interventionTerms
    );

    expect(decision.action).toBe("hold");
    expect(decision.reasons.join(" ")).toContain(
      "Captured metadata does not have a loose current-supplement identity match."
    );
  });

  it("holds rows when the query names the target but metadata mentions another supplement", () => {
    const decision = localIdentityResolutionAutomationDecision(
      candidate({
        interventionId: "resveratrol",
        interventionName: "Resveratrol",
        matchedInterventions: [{ id: "curcumin", name: "Curcumin" }],
        query: "Resveratrol systematic review meta-analysis human",
        title: "Dietary polyphenols and metabolic biomarkers"
      }),
      interventionTerms
    );

    expect(decision.action).toBe("hold");
    expect(decision.reasons.join(" ")).toContain("Captured metadata also matches Curcumin.");
  });

  it("reassigns only when query and metadata agree on the same other supplement", () => {
    const decision = localIdentityResolutionAutomationDecision(
      candidate({
        interventionId: "resveratrol",
        interventionName: "Resveratrol",
        matchedInterventions: [{ id: "curcumin", name: "Curcumin" }],
        query: "Curcumin",
        title: "Curcumin and inflammatory biomarkers"
      }),
      interventionTerms
    );

    expect(decision.action).toBe("reassign-intervention");
    expect(decision.matchedInterventionId).toBe("curcumin");
  });

  it("source-led mode reassigns a clear captured-source match even when the query was off-target", () => {
    const decision = localIdentityResolutionAutomationDecision(
      candidate({
        interventionId: "resveratrol",
        interventionName: "Resveratrol",
        matchedInterventions: [{ id: "curcumin", name: "Curcumin" }],
        query: "Resveratrol systematic review meta-analysis human",
        title: "Curcumin and inflammatory biomarkers"
      }),
      interventionTerms,
      "source-led"
    );

    expect(decision.action).toBe("reassign-intervention");
    expect(decision.matchedInterventionId).toBe("curcumin");
  });

  it("source-led mode rejects wrong-supplement duplicates when the matched supplement already has the source", () => {
    const decision = localIdentityResolutionAutomationDecision(
      candidate({
        interventionId: "green-tea-extract",
        interventionName: "Green tea extract",
        matchedInterventions: [
          { hasAcceptedCandidate: true, id: "caffeine", name: "Caffeine" }
        ],
        query: "Green tea extract",
        title: "Caffeine extraction and quantification"
      }),
      interventionTerms,
      "source-led"
    );

    expect(decision.action).toBe("reject-wrong-supplement");
    expect(decision.matchedInterventionId).toBe("caffeine");
  });

  it("source-led mode rejects current rows with multiple competing matches and no safe reassignment", () => {
    const decision = localIdentityResolutionAutomationDecision(
      candidate({
        interventionId: "omega-3",
        interventionName: "Omega-3 EPA/DHA",
        matchedInterventions: [
          { id: "caffeine", name: "Caffeine" },
          { id: "creatine", name: "Creatine monohydrate" }
        ],
        query: "Omega-3 EPA/DHA systematic review meta-analysis human",
        title: "Sport supplementation in competitive swimmers"
      }),
      interventionTerms,
      "source-led"
    );

    expect(decision.action).toBe("reject-wrong-supplement");
    expect(decision.matchedInterventionId).toBeUndefined();
  });

  it("source-led mode rejects substantial rows with no current or tracked identity signal", () => {
    const decision = localIdentityResolutionAutomationDecision(
      candidate({
        interventionId: "curcumin",
        interventionName: "Curcumin",
        query: "Curcumin",
        title: "Kansui dose escalation in treated participants"
      }),
      interventionTerms,
      "source-led"
    );

    expect(decision.action).toBe("reject-wrong-supplement");
  });

  it("source-led mode does not treat split green and tea words as a green-tea identity", () => {
    const decision = localIdentityResolutionAutomationDecision(
      candidate({
        interventionId: "green-tea-extract",
        interventionName: "Green tea extract",
        matchedInterventions: [{ id: "caffeine", name: "Caffeine" }],
        query: "Green tea extract",
        title: "Caffeine extraction in the rise of smart and green techniques"
      }),
      interventionTerms,
      "source-led"
    );

    expect(decision.action).toBe("reassign-intervention");
    expect(decision.matchedInterventionId).toBe("caffeine");
  });

  it("source-led mode accepts strong singular/plural family identities", () => {
    const decision = localIdentityResolutionAutomationDecision(
      candidate({
        interventionId: "probiotic-blend",
        interventionName: "Probiotic blend",
        query: "Probiotic blend",
        title: "Probiotics as adjuvants to standard treatment"
      }),
      interventionTerms,
      "source-led"
    );

    expect(decision.action).toBe("confirm-target");
  });

  it("source-led mode rejects nutrient-name matches from non-supplement contexts", () => {
    const decision = localIdentityResolutionAutomationDecision(
      candidate({
        interventionId: "calcium",
        interventionName: "Calcium",
        query: "Calcium systematic review meta-analysis human",
        sourceIdentityText:
          "calcium channel blockers ranked highest for dementia prevention in older adults",
        title:
          "Impact of Different Antihypertensive Drug Classes on Incident Dementia in Older Adults"
      }),
      interventionTerms,
      "source-led"
    );

    expect(decision.action).toBe("reject-wrong-supplement");
    expect(decision.reasons.join(" ")).toContain("non-supplement source context");
  });
});

describe("localCandidateReviewAutomationDecision", () => {
  it("accepts priority maybe-useful rows with visible intervention identity", () => {
    const decision = localCandidateReviewAutomationDecision(reviewCandidate());

    expect(decision.action).toBe("accept");
    expect(decision.reasons.join(" ")).toContain("priority source type");
    expect(decision.reasons.join(" ")).toContain("visibly matches the intervention");
  });

  it("rejects low-score maybe-useful rows without priority type or identity signal", () => {
    const decision = localCandidateReviewAutomationDecision(
      reviewCandidate({
        intervention: {
          name: "Creatine monohydrate",
          synonyms: ["creatine"]
        },
        metadata: {
          discoveryClassification: {
            bucket: "maybe-useful",
            cautions: [],
            label: "Maybe useful",
            reasons: ["Weak candidate."],
            score: 44,
            version: "test"
          },
          publicationTypes: ["Editorial"]
        },
        sourceType: "Editorial",
        title: "Diet and healthy aging: an editorial overview",
        triageScore: 50
      })
    );

    expect(decision.action).toBe("reject");
  });

  it("holds maybe-useful rows when the source type is good but identity is not visible", () => {
    const decision = localCandidateReviewAutomationDecision(
      reviewCandidate({
        title: "Sports supplements and training outcomes: a systematic review"
      })
    );

    expect(decision.action).toBe("hold");
  });

  it("pass 2 accepts priority rows when the query backs the intervention identity", () => {
    const decision = localCandidateReviewAutomationDecision(
      reviewCandidate({
        title: "Sports supplements and training outcomes: a systematic review"
      }),
      "query-backed",
      interventionTerms
    );

    expect(decision.action).toBe("accept");
    expect(decision.reasons.join(" ")).toContain("Search query visibly names the intervention.");
  });

  it("pass 2 holds query-backed rows when captured source identity points elsewhere", () => {
    const decision = localCandidateReviewAutomationDecision(
      reviewCandidate({
        intervention: {
          name: "Green tea extract",
          synonyms: ["egcg"]
        },
        interventionId: "green-tea-extract",
        query: "Green tea extract systematic review human",
        title: "Caffeine extraction and quantification: a systematic review"
      }),
      "query-backed",
      interventionTerms
    );

    expect(decision.action).toBe("hold");
    expect(decision.reasons.join(" ")).toContain("points elsewhere");
  });
});

describe("localCandidateReviewSignalDecision", () => {
  it("mines query-backed priority rows as spot-check signals", () => {
    const decision = localCandidateReviewSignalDecision(
      reviewCandidate({
        title: "Sports supplements and training outcomes: a systematic review"
      }),
      interventionTerms
    );

    expect(decision.kind).toBe("spot-check");
    expect(decision.queryBacked).toBe(true);
    expect(decision.reasons.join(" ")).toContain("Worth a human spot-check");
  });

  it("mines rows that point at another supplement as identity mismatch signals", () => {
    const decision = localCandidateReviewSignalDecision(
      reviewCandidate({
        intervention: {
          name: "Green tea extract",
          synonyms: ["egcg"]
        },
        interventionId: "green-tea-extract",
        query: "Green tea extract systematic review human",
        title: "Caffeine extraction and quantification: a systematic review"
      }),
      interventionTerms
    );

    expect(decision.kind).toBe("identity-mismatch");
    expect(decision.sourcePointsElsewhere).toBe(true);
    expect(decision.reasons.join(" ")).toContain("Caffeine");
  });
});

describe("localAcceptedCandidateEvidenceTopicSuggestions", () => {
  it("finds popular claim-style topics beyond the legacy heatmap bucket", () => {
    const topics = localAcceptedCandidateEvidenceTopicSuggestions({
      metadata: {
        abstractText:
          "Ashwagandha supplementation reduced perceived stress and serum cortisol and improved sleep quality in adults."
      },
      query: "Ashwagandha systematic review human",
      sourceType: "Systematic Review",
      title: "Ashwagandha for stress, cortisol, and sleep quality"
    });

    expect(topics.map((topic) => topic.key)).toEqual(
      expect.arrayContaining(["stress-cortisol", "sleep-quality"])
    );
    expect(topics[0]).toMatchObject({
      key: "stress-cortisol",
      label: "Stress/cortisol"
    });
  });
});

describe("localBenefitDiscoveryInterventionContextMismatch", () => {
  it("flags calcium channel blocker and calcification contexts as non-supplement matches", () => {
    expect(
      localBenefitDiscoveryInterventionContextMismatch({
        interventionId: "calcium",
        sourceText: "coronary artery calcium and calcium channel blockers",
        targetTerms: ["calcium", "calcium carbonate", "calcium citrate"]
      })
    ).toContain("non-supplement source context");
  });

  it("keeps calcium supplementation contexts usable", () => {
    expect(
      localBenefitDiscoveryInterventionContextMismatch({
        interventionId: "calcium",
        sourceText: "calcium supplementation and vitamin d intake in randomized trials",
        targetTerms: ["calcium", "calcium carbonate", "calcium citrate"]
      })
    ).toBeUndefined();
  });
});

describe("localBenefitDiscoveryAutomationDecision", () => {
  it("link-existing strategy links near-threshold existing claim clusters", () => {
    const decision = localBenefitDiscoveryAutomationDecision(cluster(), 70, "link-existing");

    expect(decision.action).toBe("link-existing-claim");
  });

  it("link-existing strategy does not draft near-threshold novel clusters", () => {
    const decision = localBenefitDiscoveryAutomationDecision(
      cluster({
        clusterKey: "matcha::CARDIOVASCULAR_EVENTS",
        existingClaims: [],
        interventionId: "matcha",
        interventionName: "Matcha",
        novelCandidateCount: 2,
        outcome: DbOutcomeArea.CARDIOVASCULAR_EVENTS,
        outcomeLabel: "Cardiovascular events",
        score: 68
      }),
      70,
      "link-existing"
    );

    expect(decision.action).toBe("hold");
    expect(decision.leadReasons.join(" ")).toContain("does not draft novel claim areas");
  });

  it("park-backlog strategy parks middle-confidence novel leads", () => {
    const decision = localBenefitDiscoveryAutomationDecision(
      cluster({
        clusterKey: "matcha::CARDIOVASCULAR_EVENTS",
        existingClaims: [],
        interventionId: "matcha",
        interventionName: "Matcha",
        novelCandidateCount: 2,
        outcome: DbOutcomeArea.CARDIOVASCULAR_EVENTS,
        outcomeLabel: "Cardiovascular events",
        score: 68
      }),
      70,
      "park-backlog"
    );

    expect(decision.action).toBe("park-lead");
    expect(decision.leadReasons.join(" ")).toContain(
      "park for later source review without creating a claim"
    );
  });

  it("park-backlog strategy uses custom park and reject thresholds", () => {
    expect(
      localBenefitDiscoveryAutomationDecision(
        cluster({ score: 62 }),
        70,
        "park-backlog",
        {
          rejectThreshold: 55
        }
      ).action
    ).toBe("park-lead");

    expect(
      localBenefitDiscoveryAutomationDecision(
        cluster({ score: 54 }),
        70,
        "park-backlog",
        {
          rejectThreshold: 55
        }
      ).action
    ).toBe("reject-cluster");
  });

  it("park-backlog strategy leaves high-confidence leads for build/link mode", () => {
    const decision = localBenefitDiscoveryAutomationDecision(
      cluster({
        score: 74
      }),
      70,
      "park-backlog"
    );

    expect(decision.action).toBe("hold");
    expect(decision.leadReasons.join(" ")).toContain(
      "use build or link mode rather than parking"
    );
  });
});
