import { describe, expect, it } from "vitest";

import { selectLifespanEvidence } from "@/lib/lifespan-evidence";
import type {
  AustraliaRegulatoryStatus,
  Claim,
  EvidenceDashboardData,
  Intervention,
  Reference,
  Study,
  TrialWatchItem
} from "@/lib/types";

const baseScores: Claim["scores"] = {
  evidenceDirectness: 1,
  evidenceRigor: 1,
  effectSize: 1,
  safety: 5,
  regulatoryRisk: 1,
  productQuality: 1,
  hypePenalty: 8,
  measurability: 2
};

function intervention(
  id: string,
  category: Intervention["category"] = "Vitamin/mineral"
): Intervention {
  return {
    id,
    name: id,
    slug: id,
    synonyms: [],
    category,
    commonForms: [],
    regulatoryStatus: "Unknown",
    safetySummary: "Safety depends on the scoped use.",
    interactionSummary: "Interactions need review.",
    evidenceSummary: "Evidence is being reviewed.",
    lastReviewed: "2026-06-01"
  };
}

function claim(
  id: string,
  interventionId: string,
  outcome: Claim["outcome"],
  referenceIds: string[] = []
): Claim {
  return {
    id,
    interventionId,
    outcome,
    claimText: `${interventionId} research claim`,
    populationStudied: "Adults",
    doseFormStudied: "Not summarized",
    durationStudied: "Not summarized",
    comparator: "Not summarized",
    evidenceGrade: "Draft lead",
    effectSize: "Unclear",
    clinicalRelevance: "Unclear",
    confidenceLevel: "Very low",
    safetyNotes: "Safety review required.",
    applicabilityNotes: "Source relevance still needs review.",
    summary: `${interventionId} has a source lead, not a settled conclusion`,
    uncertainty: "The current record is too uncertain for a lifespan conclusion",
    keyReferenceIds: referenceIds,
    scores: baseScores,
    finalLabel: "Insufficient Evidence",
    momentum: "Stable",
    reviewStatus: "Unreviewed AI draft",
    lastUpdated: "2026-06-10",
    whatWouldChangeScore: "A direct replicated human outcome study."
  };
}

function reference(id: string): Reference {
  return {
    id,
    title: `${id} title`,
    source: "PubMed",
    url: `https://pubmed.ncbi.nlm.nih.gov/${id}`,
    year: 2026
  };
}

function study(
  id: string,
  referenceId: string,
  studyType: Study["studyType"]
): Study {
  return {
    id,
    title: `${id} study`,
    year: 2026,
    source: "PubMed",
    studyType,
    sampleSize: "Not summarized",
    population: "Not summarized",
    intervention: "Not summarized",
    outcomes: [],
    adverseEvents: "Not summarized",
    fundingConflicts: "Not summarized",
    riskOfBias: "Not summarized",
    referenceId
  };
}

function trial(id: string, interventionId: string): TrialWatchItem {
  return {
    id,
    interventionId,
    title: `${interventionId} randomized trial`,
    status: "Recruiting",
    phase: "Phase 2",
    enrollment: "40",
    lastUpdateDate: "2026-06-20",
    evidenceImpact: "Increasing",
    url: `https://clinicaltrials.gov/study/${id}`,
    registeredInterventions: [interventionId],
    resultsPosted: false
  };
}

function australiaStatus(
  id: string,
  interventionId: string,
  productId?: string
): AustraliaRegulatoryStatus {
  return {
    id,
    interventionId,
    productId,
    region: "AU",
    kind: "Unknown",
    status: "Not verified",
    supplySummary: "No generic supply conclusion.",
    evidenceRequirement: "Verify the exact product.",
    sourceUrl: "https://www.tga.gov.au/",
    checkedAt: "2026-06-01",
    notes: "Product status is not inferred."
  };
}

function fixture(): EvidenceDashboardData {
  const interventions = [
    intervention("human"),
    intervention("clock"),
    intervention("mouse"),
    intervention("source"),
    intervention("watch", "Drug/geroprotector watchlist"),
    intervention("peptide-linked", "Peptide/biologic"),
    intervention("peptide-unrelated", "Peptide/biologic"),
    intervention("ordinary")
  ];
  const claims = [
    claim("claim-human", "human", "Mortality/lifespan", ["ref-human"]),
    claim("claim-clock", "clock", "Biological aging clocks", ["ref-clock"]),
    claim("claim-mouse", "mouse", "Mortality/lifespan", ["ref-mouse"]),
    claim("claim-source", "source", "Mortality/lifespan"),
    claim("claim-peptide", "peptide-linked", "Mortality/lifespan")
  ];
  claims[0].reviewStatus = "Human reviewed";
  claims[1].reviewStatus = "Human reviewed";

  return {
    interventions,
    claims,
    references: [reference("ref-human"), reference("ref-clock"), reference("ref-mouse")],
    studies: [
      study("study-human", "ref-human", "Randomized controlled trial"),
      study("study-clock", "ref-clock", "Observational cohort"),
      study("study-mouse", "ref-mouse", "Animal study")
    ],
    trialWatchItems: [trial("NCT1", "human")],
    safetyAlerts: [],
    productSignals: [],
    australiaRegulatoryStatuses: [
      australiaStatus("au-intervention", "human"),
      australiaStatus("au-product", "human", "product-1")
    ],
    normalizedSourcePackets: [
      {
        claimId: "claim-human",
        current: true,
        extractedReferenceCount: 1,
        referenceIds: ["ref-human"],
        reviewStatus: "Unreviewed AI draft",
        sourcePacketId: "packet-human",
        status: "complete"
      }
    ],
    dataSource: "database"
  };
}

describe("selectLifespanEvidence", () => {
  it("scopes the collection without treating every peptide as lifespan research", () => {
    const result = selectLifespanEvidence(fixture());
    const ids = result.records.map((record) => record.intervention.id);

    expect(ids).toEqual(
      expect.arrayContaining(["human", "clock", "mouse", "source", "watch", "peptide-linked"])
    );
    expect(ids).not.toContain("peptide-unrelated");
    expect(ids).not.toContain("ordinary");
  });

  it("keeps human, biomarker, preclinical, watchlist, and source-work lanes distinct", () => {
    const result = selectLifespanEvidence(fixture());
    const stageById = new Map(
      result.records.map((record) => [record.intervention.id, record.stageId])
    );

    expect(stageById.get("human")).toBe("human-outcomes");
    expect(stageById.get("clock")).toBe("biomarkers");
    expect(stageById.get("mouse")).toBe("preclinical");
    expect(stageById.get("watch")).toBe("experimental-watchlist");
    expect(stageById.get("peptide-linked")).toBe("experimental-watchlist");
    expect(stageById.get("source")).toBe("source-leads");
  });

  it("preserves citation, review, trial, and intervention-level AU traceability", () => {
    const result = selectLifespanEvidence(fixture());
    const human = result.records.find((record) => record.intervention.id === "human");

    expect(human?.references.map((item) => item.id)).toEqual(["ref-human"]);
    expect(human?.studies.map((item) => item.id)).toEqual(["study-human"]);
    expect(human?.reviewStatus).toBe("Human reviewed");
    expect(human?.extractedSourceCount).toBe(1);
    expect(human?.trials).toHaveLength(1);
    expect(human?.australiaStatuses.map((status) => status.id)).toEqual(["au-intervention"]);
    expect(result.summary.activeTrials).toBe(1);
  });

  it("uses claim-specific result sources and does not upgrade a registry-only lifespan claim", () => {
    const data = fixture();
    data.interventions.push(intervention("mixed"));
    const mortality = claim(
      "claim-mixed-mortality",
      "mixed",
      "Mortality/lifespan",
      ["ref-mixed-registry"]
    );
    mortality.reviewStatus = "Human reviewed";
    const functionClaim = claim(
      "claim-mixed-function",
      "mixed",
      "Muscle/strength",
      ["ref-mixed-function"]
    );
    functionClaim.reviewStatus = "Human reviewed";
    functionClaim.confidenceLevel = "Moderate";
    data.claims.push(mortality, functionClaim);
    data.references.push(reference("ref-mixed-registry"), reference("ref-mixed-function"));
    data.studies.push(
      study("study-mixed-registry", "ref-mixed-registry", "Clinical trial record"),
      study("study-mixed-function", "ref-mixed-function", "Randomized controlled trial")
    );

    const record = selectLifespanEvidence(data).records.find(
      (candidate) => candidate.intervention.id === "mixed"
    );

    expect(record?.stageId).toBe("healthspan");
    expect(record?.primaryClaim?.id).toBe("claim-mixed-function");
    expect(record?.references.map((item) => item.id)).toEqual(["ref-mixed-function"]);
    expect(record?.studies.map((item) => item.id)).toEqual(["study-mixed-function"]);
  });

  it("keeps a human-reviewed registry protocol out of the human outcome lane", () => {
    const data = fixture();
    data.interventions.push(intervention("registry-only"));
    const registryClaim = claim(
      "claim-registry-only",
      "registry-only",
      "Mortality/lifespan",
      ["ref-registry-only"]
    );
    registryClaim.reviewStatus = "Human reviewed";
    data.claims.push(registryClaim);
    data.references.push(reference("ref-registry-only"));
    data.studies.push(
      study("study-registry-only", "ref-registry-only", "Clinical trial record")
    );

    const record = selectLifespanEvidence(data).records.find(
      (candidate) => candidate.intervention.id === "registry-only"
    );

    expect(record?.stageId).toBe("source-leads");
    expect(record?.studies.map((item) => item.studyType)).toEqual([
      "Clinical trial record"
    ]);
  });

  it("requires a lifespan anchor and a narrow function outcome for the healthspan lane", () => {
    const data = fixture();
    data.interventions.push(
      intervention("unanchored-function"),
      intervention("anchored-sleep")
    );
    const unanchored = claim(
      "claim-unanchored-function",
      "unanchored-function",
      "Muscle/strength",
      ["ref-unanchored-function"]
    );
    unanchored.reviewStatus = "Human reviewed";
    data.claims.push(unanchored);
    data.references.push(reference("ref-unanchored-function"));
    data.studies.push(
      study("study-unanchored-function", "ref-unanchored-function", "Randomized controlled trial")
    );

    const sleepAnchor = claim(
      "claim-anchored-sleep-lifespan",
      "anchored-sleep",
      "Mortality/lifespan"
    );
    const sleepClaim = claim(
      "claim-anchored-sleep",
      "anchored-sleep",
      "Sleep",
      ["ref-anchored-sleep"]
    );
    sleepClaim.reviewStatus = "Human reviewed";
    data.claims.push(sleepAnchor, sleepClaim);
    data.references.push(reference("ref-anchored-sleep"));
    data.studies.push(
      study("study-anchored-sleep", "ref-anchored-sleep", "Randomized controlled trial")
    );

    const result = selectLifespanEvidence(data);
    const ids = result.records.map((record) => record.intervention.id);

    expect(ids).not.toContain("unanchored-function");
    expect(
      result.records.find((record) => record.intervention.id === "anchored-sleep")?.stageId
    ).toBe("source-leads");
  });

  it("shows claim-linked animal evidence as preclinical before the category watchlist fallback", () => {
    const data = fixture();
    data.interventions.push(intervention("watch-animal", "Drug/geroprotector watchlist"));
    const animalClaim = claim(
      "claim-watch-animal",
      "watch-animal",
      "Mortality/lifespan",
      ["ref-watch-animal"]
    );
    data.claims.push(animalClaim);
    data.references.push(reference("ref-watch-animal"));
    data.studies.push(study("study-watch-animal", "ref-watch-animal", "Animal study"));

    const record = selectLifespanEvidence(data).records.find(
      (candidate) => candidate.intervention.id === "watch-animal"
    );

    expect(record?.stageId).toBe("preclinical");
  });

  it("keeps an animal-backed lifespan claim preclinical when another claim has an unreviewed human study", () => {
    const data = fixture();
    data.interventions.push(intervention("mixed-preclinical"));
    const animalClaim = claim(
      "claim-mixed-preclinical-lifespan",
      "mixed-preclinical",
      "Mortality/lifespan",
      ["ref-mixed-preclinical-animal"]
    );
    const functionClaim = claim(
      "claim-mixed-preclinical-function",
      "mixed-preclinical",
      "VO2 max/endurance",
      ["ref-mixed-preclinical-human"]
    );
    data.claims.push(animalClaim, functionClaim);
    data.references.push(
      reference("ref-mixed-preclinical-animal"),
      reference("ref-mixed-preclinical-human")
    );
    data.studies.push(
      study("study-mixed-preclinical-animal", "ref-mixed-preclinical-animal", "Animal study"),
      study(
        "study-mixed-preclinical-human",
        "ref-mixed-preclinical-human",
        "Randomized controlled trial"
      )
    );

    const record = selectLifespanEvidence(data).records.find(
      (candidate) => candidate.intervention.id === "mixed-preclinical"
    );

    expect(record?.stageId).toBe("preclinical");
    expect(record?.primaryClaim?.id).toBe("claim-mixed-preclinical-lifespan");
    expect(record?.references.map((item) => item.id)).toEqual([
      "ref-mixed-preclinical-animal"
    ]);
    expect(record?.studies.map((item) => item.id)).toEqual([
      "study-mixed-preclinical-animal"
    ]);
  });
});
