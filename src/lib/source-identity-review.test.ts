import { describe, expect, it } from "vitest";

import { buildMultiSupplementSourceReview } from "@/lib/source-identity-review";
import type { Claim, EvidenceDashboardData, Intervention, Reference } from "@/lib/types";

function intervention(overrides: Partial<Intervention> & Pick<Intervention, "id" | "name" | "slug">): Intervention {
  return {
    category: "Botanical/herbal",
    commonForms: ["Capsule"],
    evidenceSummary: "Summary.",
    interactionSummary: "Interactions.",
    lastReviewed: "2026-01-01",
    regulatoryStatus: "Supplement.",
    safetySummary: "Safety.",
    synonyms: [],
    ...overrides
  };
}

function claim(overrides: Partial<Claim> & Pick<Claim, "id" | "interventionId" | "outcome">): Claim {
  return {
    applicabilityNotes: "Applies.",
    claimText: "Claim text.",
    clinicalRelevance: "Relevance.",
    comparator: "Placebo",
    confidenceLevel: "Low",
    doseFormStudied: "Capsule",
    durationStudied: "8 weeks",
    effectSize: "Small",
    evidenceGrade: "Draft lead",
    finalLabel: "Insufficient Evidence",
    keyReferenceIds: ["ref-shared"],
    lastUpdated: "2026-01-01",
    momentum: "Stable",
    populationStudied: "Adults",
    reviewStatus: "Unreviewed AI draft",
    safetyNotes: "Notes.",
    scores: {
      effectSize: 3,
      evidenceDirectness: 3,
      evidenceRigor: 3,
      hypePenalty: 3,
      measurability: 5,
      productQuality: 4,
      regulatoryRisk: 4,
      safety: 6
    },
    whatWouldChangeScore: "More evidence.",
    ...overrides
  };
}

function dashboardData(): EvidenceDashboardData {
  // A single shared reference whose title only names green tea / EGCG, linked to
  // both Green tea extract and Resveratrol claims that lack extraction.
  const sharedReference: Reference = {
    id: "ref-shared",
    source: "PubMed",
    title: "EGCG and green tea catechins for blood pressure: a systematic review",
    url: "https://pubmed.ncbi.nlm.nih.gov/40025969/",
    identifier: "PMID:40025969",
    year: 2025
  };

  return {
    australiaRegulatoryStatuses: [],
    claims: [
      claim({
        id: "green-tea-bp",
        interventionId: "green-tea-extract",
        outcome: "Blood pressure"
      }),
      claim({
        id: "resveratrol-bp",
        interventionId: "resveratrol",
        outcome: "Blood pressure"
      })
    ],
    dataSource: "seed",
    interventions: [
      intervention({
        id: "green-tea-extract",
        name: "Green tea extract",
        slug: "green-tea-extract",
        synonyms: ["EGCG", "green tea catechins"]
      }),
      intervention({
        id: "resveratrol",
        name: "Resveratrol",
        slug: "resveratrol",
        synonyms: ["trans-resveratrol"]
      })
    ],
    productSignals: [],
    references: [sharedReference],
    safetyAlerts: [],
    studies: [],
    trialWatchItems: []
  };
}

describe("buildMultiSupplementSourceReview", () => {
  it("flags the supplement named in the title as the likely subject and the other as manual", () => {
    const reviews = buildMultiSupplementSourceReview(dashboardData());

    expect(reviews).toHaveLength(1);

    const review = reviews[0];
    expect(review.reference.id).toBe("ref-shared");
    expect(review.supplementCount).toBe(2);
    expect(review.titleSupportedNames).toEqual(["Green tea extract"]);

    const greenTea = review.supplements.find((s) => s.interventionId === "green-tea-extract");
    const resveratrol = review.supplements.find((s) => s.interventionId === "resveratrol");

    expect(greenTea?.titleMentionsSupplement).toBe(true);
    expect(greenTea?.disposition).toBe("likely-subject");
    expect(resveratrol?.titleMentionsSupplement).toBe(false);
    expect(resveratrol?.disposition).toBe("needs-manual-check");

    expect(review.summary).toContain("The title names Green tea extract");
    expect(review.summary).toContain("Resveratrol");
    expect(review.summary).toContain("reassignment or rejection");
  });

  it("summarises the case where the title names none of the linked supplements", () => {
    const data = dashboardData();
    data.references[0].title = "Polyphenols for the prevention or management of preeclampsia";

    const reviews = buildMultiSupplementSourceReview(data);

    expect(reviews).toHaveLength(1);
    expect(reviews[0].titleSupportedNames).toEqual([]);
    expect(reviews[0].summary).toContain("names none of the 2 linked supplements");
  });

  it("does not treat a generic chemical-class term as identifying a supplement", () => {
    const data = dashboardData();
    // Green tea carries the class term "polyphenols" as a synonym, but the class
    // spans many supplements, so a paper titled only with the class term must not
    // name green tea as its subject.
    data.interventions[0].synonyms = ["green tea catechins", "polyphenols"];
    data.references[0].title =
      "Polyphenols for the prevention or management of preeclampsia: a systematic review";

    const reviews = buildMultiSupplementSourceReview(data);

    expect(reviews).toHaveLength(1);
    expect(reviews[0].titleSupportedNames).toEqual([]);
    expect(reviews[0].summary).toContain("names none of the 2 linked supplements");
  });

  it("does not review single-supplement references", () => {
    const data = dashboardData();
    data.claims = data.claims.filter((item) => item.interventionId === "green-tea-extract");

    const reviews = buildMultiSupplementSourceReview(data);

    expect(reviews).toHaveLength(0);
  });
});
