import { describe, expect, it } from "vitest";

import {
  detectOutcomeArea,
  detectStudyDesign,
  evaluateRelevance,
  INTERVENTION_TRAP_RULES
} from "@/lib/relevance-gate";

const creatine = {
  name: "Creatine monohydrate",
  slug: "creatine-monohydrate",
  synonyms: ["creatine"]
};

const RCT = ["Journal Article", "Randomized Controlled Trial"];

describe("detectStudyDesign", () => {
  it("prefers the strongest design when a paper carries several types", () => {
    expect(
      detectStudyDesign(
        ["Journal Article", "Randomized Controlled Trial", "Meta-Analysis"],
        "PUBMED"
      )
    ).toBe("meta-analysis");
  });

  it("treats a registry record as a registered protocol even with no design fields", () => {
    expect(detectStudyDesign([], "CLINICALTRIALS_GOV")).toBe("clinical-trial-record");
  });

  it("resolves nothing for a bare journal article", () => {
    expect(detectStudyDesign(["Journal Article"], "PUBMED")).toBeUndefined();
  });
});

describe("detectOutcomeArea", () => {
  it("maps text onto a tracked outcome area", () => {
    expect(detectOutcomeArea("change in systolic blood pressure")).toBe("Blood pressure");
    expect(detectOutcomeArea("grip strength and lean mass")).toBe("Muscle/strength");
  });

  it("returns nothing when no tracked outcome is named", () => {
    expect(detectOutcomeArea("effect on toenail growth rate")).toBeUndefined();
  });
});

describe("evaluateRelevance", () => {
  it("accepts a titled RCT with a tracked outcome", () => {
    const result = evaluateRelevance({
      abstract: "Participants completed twelve weeks of resistance training.",
      intervention: creatine,
      publicationTypes: RCT,
      source: "PUBMED",
      title: "Creatine supplementation and lean mass in older adults"
    });

    expect(result.verdict).toBe("accept");
    expect(result.design).toBe("randomized-controlled-trial");
    expect(result.outcome).toBe("Muscle/strength");
  });

  it("rejects a paper that never names the intervention", () => {
    const result = evaluateRelevance({
      abstract: "Serum creatinine was measured at baseline and twelve weeks.",
      intervention: creatine,
      publicationTypes: RCT,
      source: "PUBMED",
      title: "Statin-associated myopathy: a randomised controlled trial"
    });

    expect(result.verdict).toBe("reject");
    expect(result.identity).toBeUndefined();
  });

  it("will not reject on a title-only miss when no abstract was stored", () => {
    // Roughly a third of on-target papers never name their intervention in the
    // title. Rejecting here would discard them for the catalog's missing
    // abstract rather than for anything about the paper.
    const result = evaluateRelevance({
      abstract: "",
      intervention: creatine,
      publicationTypes: RCT,
      source: "PUBMED",
      title: "Sports supplements and training outcomes: a systematic review"
    });

    expect(result.verdict).toBe("undecided");
    expect(result.reasons.join(" ")).toContain("no abstract is stored");
  });

  it("rejects a title-only miss once an abstract exists and also misses", () => {
    const result = evaluateRelevance({
      abstract: "Participants received a multi-ingredient pre-workout formula.",
      intervention: creatine,
      publicationTypes: RCT,
      source: "PUBMED",
      title: "Sports supplements and training outcomes: a systematic review"
    });

    expect(result.verdict).toBe("reject");
  });

  it("rejects the biomarker the supplement shares its name with", () => {
    const result = evaluateRelevance({
      abstract: "Creatine kinase was the primary endpoint.",
      intervention: creatine,
      publicationTypes: RCT,
      source: "PUBMED",
      title: "Creatine kinase as a marker of muscle damage after statin therapy"
    });

    expect(result.verdict).toBe("reject");
    expect(result.trapTerm).toBe("creatine kinase");
  });

  it("keeps a trial that measures the biomarker while giving the supplement", () => {
    const result = evaluateRelevance({
      abstract:
        "Creatine supplementation was given for eight weeks; creatine kinase was monitored for safety.",
      intervention: creatine,
      publicationTypes: RCT,
      source: "PUBMED",
      title: "Creatine supplementation and muscle strength: a randomised trial"
    });

    expect(result.verdict).toBe("accept");
    expect(result.reasons.join(" ")).toContain("measured rather than mistaken");
  });

  it("does not discard a case report, because that is how harms get published", () => {
    // Regression: case reports were rejected outright, which threw away
    // "Tongkat Ali-Induced Liver Injury" and "Acute kidney injury following
    // creatine loading". Stripping the harm signal while keeping the benefit
    // signal is the worst direction to be wrong in.
    const result = evaluateRelevance({
      abstract: "A 17-year-old presented with acute kidney injury after creatine loading.",
      intervention: creatine,
      publicationTypes: ["Case Reports"],
      source: "PUBMED",
      title: "Acute kidney injury with cast nephropathy following creatine loading"
    });

    expect(result.verdict).toBe("undecided");
    expect(result.design).toBe("case-report");
  });

  it("rejects a design that cannot support a claim about people", () => {
    const result = evaluateRelevance({
      abstract: "Mice received creatine for six weeks.",
      intervention: creatine,
      publicationTypes: ["Animal Study"],
      source: "PUBMED",
      title: "Creatine and muscle strength in aged mice"
    });

    expect(result.verdict).toBe("reject");
    expect(result.design).toBe("animal-study");
  });

  it("leaves an observational cohort undecided rather than discarding it", () => {
    // Rejecting outright would throw away most of the mortality literature,
    // which is overwhelmingly observational.
    const result = evaluateRelevance({
      abstract: "A prospective cohort followed for twelve years.",
      intervention: creatine,
      publicationTypes: ["Observational Study"],
      source: "PUBMED",
      title: "Creatine intake and all-cause mortality: a prospective cohort"
    });

    expect(result.verdict).toBe("undecided");
    expect(result.design).toBe("observational-cohort");
    expect(result.outcome).toBe("Mortality/lifespan");
  });

  it("will not accept on an abstract mention alone", () => {
    // The measured failure mode: a tirzepatide trial naming semaglutide as its
    // comparator is not semaglutide evidence.
    const result = evaluateRelevance({
      abstract: "Participants were randomised to tirzepatide or semaglutide.",
      intervention: { name: "Semaglutide", slug: "semaglutide", synonyms: [] },
      publicationTypes: RCT,
      source: "PUBMED",
      title: "Efficacy of tirzepatide in heart failure with preserved ejection fraction"
    });

    expect(result.verdict).toBe("undecided");
    expect(result.identity?.field).toBe("abstract");
  });

  it("stays undecided when no design resolves", () => {
    const result = evaluateRelevance({
      intervention: creatine,
      publicationTypes: ["Journal Article"],
      source: "PUBMED",
      title: "Creatine supplementation and lean mass"
    });

    expect(result.verdict).toBe("undecided");
  });

  it("stays undecided when the outcome is not one the catalog tracks", () => {
    const result = evaluateRelevance({
      intervention: creatine,
      publicationTypes: RCT,
      source: "PUBMED",
      title: "Creatine supplementation and toenail growth: a randomised trial"
    });

    expect(result.verdict).toBe("undecided");
    expect(result.outcome).toBeUndefined();
  });

  it("explains every verdict it reaches", () => {
    const result = evaluateRelevance({
      intervention: creatine,
      publicationTypes: RCT,
      source: "PUBMED",
      title: "Creatine supplementation and lean mass in older adults"
    });

    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.reasons.every((reason) => reason.trim().length > 0)).toBe(true);
  });

  it("covers the known contamination case with a trap rule", () => {
    expect(INTERVENTION_TRAP_RULES["creatine-monohydrate"].trapTerms).toContain(
      "creatine kinase"
    );
  });
});
