import { describe, expect, it } from "vitest";

import {
  buildSupplementBrief,
  claimTier,
  classifyClaim,
  isNullFinding,
  outcomeTopic,
  readableCaveat,
  readableFinding,
  readableSafetySummary,
  readerScore,
  summarizeStudyMix,
  tierLabel
} from "@/lib/evidence-brief";
import { buildClaimSourcePacket } from "@/lib/source-packet";
import type {
  ClaimSourcePacket,
  ClaimSourcePacketCompleteness,
  EvidenceDepthSummary
} from "@/lib/source-packet";
import type {
  Claim,
  Intervention,
  Reference,
  SafetyAlert,
  ScoreSet,
  Study
} from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

function makeScores(overrides: Partial<ScoreSet> = {}): ScoreSet {
  return {
    evidenceDirectness: 8,
    evidenceRigor: 8,
    effectSize: 7,
    safety: 8,
    regulatoryRisk: 2,
    productQuality: 6,
    hypePenalty: 2,
    measurability: 8,
    ...overrides
  };
}

function makeClaim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: "claim-creatine-muscle",
    interventionId: "int-creatine",
    outcome: "Muscle/strength",
    claimText:
      "Creatine monohydrate increases lean body mass and improves performance in short, high-intensity efforts.",
    populationStudied: "Healthy trained and untrained adults aged 18-50.",
    doseFormStudied: "3-5 g/day creatine monohydrate, with or without a loading phase.",
    durationStudied: "4-12 weeks.",
    comparator: "Placebo plus resistance training.",
    evidenceGrade: "A",
    effectSize: "Roughly 1-2 kg additional lean mass over 8-12 weeks of training.",
    clinicalRelevance: "Meaningful for training outcomes, not for disease endpoints.",
    confidenceLevel: "High",
    safetyNotes: "Well tolerated at studied doses in healthy adults.",
    applicabilityNotes: "Best evidence is in resistance-trained adults.",
    summary:
      "Creatine monohydrate increases lean body mass and improves performance in short, high-intensity efforts when taken daily by trained adults. This is based on 24 linked articles and 31 extracted study rows (6 RCTs). Keep the conclusion scoped to the studied population, intervention form, comparator, and endpoint.",
    uncertainty:
      "Gains are smaller in people who already eat a high-protein diet. Uncertainty remains because current local confidence is High for this row. What would change the score: a larger registered trial in adults over 65.",
    doesNotProve: [],
    keyReferenceIds: ["REF-1", "REF-2"],
    scores: makeScores(),
    finalLabel: "Core Evidence-Based",
    momentum: "Stable",
    reviewStatus: "Human reviewed",
    lastUpdated: "2026-05-01",
    whatWouldChangeScore: "A large registered trial in older adults.",
    ...overrides
  };
}

function makeIntervention(overrides: Partial<Intervention> = {}): Intervention {
  return {
    id: "int-creatine",
    name: "Creatine monohydrate",
    slug: "creatine-monohydrate",
    synonyms: ["creatine"],
    category: "Ergogenic/performance supplement",
    commonForms: ["Powder", "Capsule"],
    regulatoryStatus: "Listed complementary medicine in Australia.",
    safetySummary: "Well tolerated at 3-5 g/day in healthy adults.",
    interactionSummary: "No clinically significant interactions captured.",
    evidenceSummary: "One of the best-studied sports supplements.",
    lastReviewed: "2026-05-01",
    ...overrides
  };
}

function makeStudy(overrides: Partial<Study> = {}): Study {
  return {
    id: "study-1",
    title: "Creatine supplementation and lean mass: a meta-analysis",
    year: 2023,
    source: "PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "1,842 participants across 34 trials",
    population: "Healthy adults undertaking resistance training",
    intervention: "3-5 g/day creatine monohydrate",
    outcomes: ["Lean body mass", "1RM strength"],
    adverseEvents: "No serious adverse events reported",
    fundingConflicts: "No industry funding declared",
    riskOfBias: "Low to moderate across included trials",
    referenceId: "REF-1",
    ...overrides
  };
}

function makeReference(overrides: Partial<Reference> = {}): Reference {
  return {
    id: "REF-1",
    title: "Creatine supplementation and lean mass",
    source: "PubMed",
    identifier: "12345678",
    year: 2023,
    url: "https://pubmed.ncbi.nlm.nih.gov/12345678/",
    ...overrides
  };
}

function makeEvidenceDepth(overrides: Partial<EvidenceDepthSummary> = {}): EvidenceDepthSummary {
  return {
    animalMechanisticStudies: 0,
    badges: [],
    caseReports: 0,
    clinicalTrialRecords: 0,
    directHumanTrials: 0,
    metaAnalyses: 0,
    observationalCohorts: 0,
    randomizedControlledTrials: 0,
    reviewPositionStandSources: 0,
    regulatorySafetyWarnings: 0,
    sourcePackets: 0,
    systematicReviews: 0,
    totalExtractedStudies: 0,
    ...overrides
  };
}

function makeCompleteness(
  overrides: Partial<ClaimSourcePacketCompleteness> = {}
): ClaimSourcePacketCompleteness {
  return {
    status: "complete",
    label: "Extraction complete",
    detail: "Every linked curated reference has at least one structured study extraction.",
    nextStep: "Keep source links reviewed as new evidence or regulatory updates appear.",
    totalReferences: 0,
    extractedReferences: 0,
    pendingReferences: 0,
    missingReferences: 0,
    ...overrides
  };
}

/** Hand-built packet for tier tests, where only `evidenceDepth` matters. */
function makePacket({
  studies = [],
  references = [],
  depth = {},
  completeness = {}
}: {
  studies?: Study[];
  references?: Reference[];
  depth?: Partial<EvidenceDepthSummary>;
  completeness?: Partial<ClaimSourcePacketCompleteness>;
} = {}): ClaimSourcePacket {
  return {
    referenceIds: references.map((reference) => reference.id),
    references,
    studies,
    pendingReferences: [],
    missingReferenceIds: [],
    completeness: makeCompleteness({
      status: "extraction_pending",
      label: "Extraction pending",
      totalReferences: references.length,
      pendingReferences: references.length,
      ...completeness
    }),
    evidenceDepth: makeEvidenceDepth(depth)
  };
}

/* -------------------------------------------------------------------------- */
/* classifyClaim                                                               */
/* -------------------------------------------------------------------------- */

describe("classifyClaim", () => {
  it("treats accepted-source-lead scaffolding as pipeline", () => {
    const claim = makeClaim({
      outcome: "Cognition",
      claimText:
        "Creatine monohydrate has accepted source leads for cognition that need structured evidence review."
    });

    expect(classifyClaim(claim)).toBe("pipeline");
  });

  it("treats a 'Manual review required' population as pipeline", () => {
    const claim = makeClaim({
      outcome: "Inflammation",
      claimText: "Creatine monohydrate may lower inflammatory markers.",
      populationStudied: "Manual review required"
    });

    expect(classifyClaim(claim)).toBe("pipeline");
  });

  it("treats anything filed under the safety outcome as safety context", () => {
    const claim = makeClaim({
      outcome: "Safety/adverse effects",
      claimText: "Creatine monohydrate is well tolerated at 3-5 g/day in healthy adults."
    });

    expect(classifyClaim(claim)).toBe("safety-context");
  });

  it("treats the generated tolerability boilerplate as safety context whatever the outcome", () => {
    const claim = makeClaim({
      outcome: "Muscle/strength",
      claimText:
        "General safety, tolerability, interaction, and product-quality profile for Creatine monohydrate."
    });

    expect(classifyClaim(claim)).toBe("safety-context");
  });

  it("treats an ordinary curated row as a conclusion", () => {
    expect(classifyClaim(makeClaim())).toBe("conclusion");
  });

  it("prefers pipeline over safety context when a safety row is still scaffolding", () => {
    const claim = makeClaim({
      outcome: "Safety/adverse effects",
      claimText:
        "Creatine monohydrate has accepted source leads for safety that need structured evidence review."
    });

    expect(classifyClaim(claim)).toBe("pipeline");
  });
});

/* -------------------------------------------------------------------------- */
/* readerScore                                                                 */
/* -------------------------------------------------------------------------- */

describe("readerScore", () => {
  it("returns a composite for a curated conclusion", () => {
    expect(readerScore(makeClaim(), "conclusion")).toBe(7.8);
  });

  it("returns null for pipeline and safety-context rows", () => {
    expect(readerScore(makeClaim(), "pipeline")).toBeNull();
    expect(readerScore(makeClaim(), "safety-context")).toBeNull();
  });

  it("returns null for an unreviewed very-low-confidence conclusion", () => {
    const claim = makeClaim({
      confidenceLevel: "Very low",
      reviewStatus: "Unreviewed AI draft"
    });

    expect(readerScore(claim, "conclusion")).toBeNull();
  });

  it("keeps the score when a very-low-confidence row was actually reviewed", () => {
    const claim = makeClaim({
      confidenceLevel: "Very low",
      reviewStatus: "Human reviewed"
    });

    expect(readerScore(claim, "conclusion")).toBe(7.8);
  });

  it("returns null when the effect size was never extracted", () => {
    expect(readerScore(makeClaim({ effectSize: "Unknown" }), "conclusion")).toBeNull();
    expect(
      readerScore(makeClaim({ effectSize: "Unknown until source review." }), "conclusion")
    ).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* readableFinding                                                             */
/* -------------------------------------------------------------------------- */

describe("readableFinding", () => {
  it("strips the appended pipeline sentences", () => {
    const claim = makeClaim({
      summary:
        "Whey protein helps X. This is based on 2 linked articles and 3 extracted study rows (1 RCT). Representative extracted text: something irrelevant. Keep the conclusion scoped to the studied population, intervention form, comparator, and endpoint.",
      effectSize: "Unknown",
      clinicalRelevance: "Not established."
    });

    expect(readableFinding(claim)).toBe("Whey protein helps X.");
  });

  it("keeps a full curated first sentence intact", () => {
    expect(readableFinding(makeClaim())).toBe(
      "Creatine monohydrate increases lean body mass and improves performance in short, high-intensity efforts when taken daily by trained adults."
    );
  });

  it("drops the '<Name> has local safety and tolerability context' boilerplate", () => {
    const claim = makeClaim({
      outcome: "Safety/adverse effects",
      summary:
        "Creatine monohydrate is well tolerated at 3 to 5 g per day in healthy adults, and the most common report is short-term weight gain from water retention. Creatine monohydrate has local safety and tolerability context attached to this claim. Safety evidence is kept separate from efficacy and does not prove product-level safety."
    });

    const finding = readableFinding(claim);

    expect(finding).toBe(
      "Creatine monohydrate is well tolerated at 3 to 5 g per day in healthy adults, and the most common report is short-term weight gain from water retention."
    );
    expect(finding).not.toContain("has local safety and tolerability context");
    expect(finding).not.toContain("Safety evidence is kept separate");
  });

  it("falls back to the claim text when every sentence was bookkeeping", () => {
    const claim = makeClaim({
      outcome: "Safety/adverse effects",
      claimText:
        "General safety, tolerability, interaction, and product-quality profile for Creatine monohydrate.",
      summary:
        "Creatine monohydrate has local safety and tolerability context attached to this claim. This is based on 12 linked articles and 9 extracted study rows. Safety evidence is kept separate from efficacy and does not prove product-level safety."
    });

    expect(readableFinding(claim)).toBe(
      "General safety, tolerability, interaction, and product-quality profile for Creatine monohydrate."
    );
  });

  it("appends the effect size when the surviving text is too short to be useful", () => {
    const claim = makeClaim({
      outcome: "Cardiovascular events",
      summary:
        "Cardiovascular prevention. This is based on 5 linked articles and 4 extracted study rows.",
      effectSize: "Roughly a 0.2 mmol/L LDL reduction at 2 g per day.",
      clinicalRelevance: "Modest but real at a population level."
    });

    expect(readableFinding(claim)).toBe(
      "Cardiovascular prevention. Roughly a 0.2 mmol/L LDL reduction at 2 g per day."
    );
  });

  it("falls back to clinical relevance when the effect size is a placeholder", () => {
    const claim = makeClaim({
      outcome: "Cardiovascular events",
      summary: "Cardiovascular prevention.",
      effectSize: "Unknown",
      clinicalRelevance: "Modest but real at a population level over many years"
    });

    expect(readableFinding(claim)).toBe(
      "Cardiovascular prevention. Modest but real at a population level over many years."
    );
  });

  it("drops an internal-voice clause but keeps the sentence around it", () => {
    const claim = makeClaim({
      outcome: "Sleep",
      summary:
        "Magnesium glycinate produced a small improvement in self-reported sleep quality in older adults with low intake; the dashboard should not frame this as a sleep benefit."
    });

    expect(readableFinding(claim)).toBe(
      "Magnesium glycinate produced a small improvement in self-reported sleep quality in older adults with low intake."
    );
  });

  it("adds nothing when neither detail is informative", () => {
    const claim = makeClaim({
      outcome: "Cardiovascular events",
      summary: "Cardiovascular prevention.",
      effectSize: "Unknown",
      clinicalRelevance: "Manual review required."
    });

    expect(readableFinding(claim)).toBe("Cardiovascular prevention.");
  });
});

/* -------------------------------------------------------------------------- */
/* readableCaveat                                                              */
/* -------------------------------------------------------------------------- */

describe("readableCaveat", () => {
  it("keeps only the claim-specific sentence", () => {
    const claim = makeClaim({
      uncertainty:
        "Gains are smaller in people who already eat a high-protein diet. Uncertainty remains because current local confidence is High for this row. What would change the score: a larger registered trial in adults over 65."
    });

    expect(readableCaveat(claim)).toBe(
      "Gains are smaller in people who already eat a high-protein diet."
    );
  });

  it("drops the generic claim-specific-boundaries recital", () => {
    const claim = makeClaim({
      uncertainty:
        "Effects were only measured in trained young men, not older adults. Population, dose/form, duration, comparator, product quality, and AU/TGA product status remain claim-specific boundaries."
    });

    expect(readableCaveat(claim)).toBe(
      "Effects were only measured in trained young men, not older adults."
    );
  });

  it("returns null when the whole uncertainty field is generated boilerplate", () => {
    const claim = makeClaim({
      uncertainty:
        "Uncertainty remains because local confidence is Moderate, and population, dose/form, duration, comparator, product quality, and AU/TGA product status remain claim-specific boundaries. What would change the score: a larger registered trial."
    });

    expect(readableCaveat(claim)).toBeNull();
  });

  it("returns null when there is no uncertainty text at all", () => {
    expect(readableCaveat(makeClaim({ uncertainty: undefined }))).toBeNull();
    expect(readableCaveat(makeClaim({ uncertainty: "" }))).toBeNull();
  });

  it("truncates very long caveats at a word boundary", () => {
    const claim = makeClaim({
      uncertainty:
        "Effects were measured only in resistance-trained men aged 18 to 35 who were already consuming more than 1.6 g of protein per kilogram of bodyweight per day, and the trials used supervised training programmes that most people do not follow, so the size of the benefit outside that setting is unclear."
    });

    const caveat = readableCaveat(claim);

    expect(caveat).not.toBeNull();
    expect(caveat as string).toMatch(/…$/);
    expect((caveat as string).length).toBeLessThanOrEqual(261);
  });
});

/* -------------------------------------------------------------------------- */
/* isNullFinding                                                               */
/* -------------------------------------------------------------------------- */

describe("isNullFinding", () => {
  it("flags a finding whose opening sentence reports an absence", () => {
    const claim = makeClaim({
      outcome: "Cognition",
      effectSize: "Unknown",
      clinicalRelevance: "Not established.",
      summary:
        "The local record does not yet support a settled cognition conclusion for Creatine monohydrate. This is based on 4 linked articles and 2 extracted study rows. The current claim should be treated as low-certainty or hypothesis-generating."
    });

    expect(isNullFinding(claim)).toBe(true);
  });

  it("does not flag a positive finding that merely ends with a 'does not establish' qualifier", () => {
    const claim = makeClaim({
      id: "claim-astaxanthin-skin",
      outcome: "Joint/tendon/skin",
      summary:
        "Astaxanthin improved skin moisture and elasticity in small randomised trials of adults taking 4 to 12 mg per day for 8 to 16 weeks. Effects were modest and measured with instrumented skin readings rather than patient-reported outcomes. The source does not establish joint or tendon benefit."
    });

    expect(isNullFinding(claim)).toBe(false);
  });

  it("does not flag a human-reviewed null opening followed by a substantive second sentence", () => {
    const claim = makeClaim({
      outcome: "Mortality/lifespan",
      reviewStatus: "Human reviewed",
      summary:
        "The local record does not yet support a settled lifespan conclusion for Creatine monohydrate. Reviewers noted two cohort studies reporting lower all-cause mortality among users, which is suggestive but not causal."
    });

    expect(isNullFinding(claim)).toBe(false);
  });

  it("still flags the same two-sentence shape when nobody has reviewed it", () => {
    const claim = makeClaim({
      outcome: "Mortality/lifespan",
      reviewStatus: "Unreviewed AI draft",
      summary:
        "The local record does not yet support a settled lifespan conclusion for Creatine monohydrate. Reviewers noted two cohort studies reporting lower all-cause mortality among users, which is suggestive but not causal."
    });

    expect(isNullFinding(claim)).toBe(true);
  });

  it("does not flag an ordinary curated conclusion", () => {
    expect(isNullFinding(makeClaim())).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* claimTier                                                                   */
/* -------------------------------------------------------------------------- */

describe("claimTier", () => {
  const richPacket = makePacket({
    depth: {
      totalExtractedStudies: 12,
      metaAnalyses: 2,
      randomizedControlledTrials: 6,
      directHumanTrials: 6
    }
  });

  it("returns caution for an adverse-direction claim", () => {
    const claim = makeClaim({
      id: "claim-caffeine-sleep",
      outcome: "Sleep",
      finalLabel: "Useful for Specific Use Case",
      summary:
        "Caffeine taken within six hours of bedtime can impair sleep onset and reduce total sleep time in healthy adults."
    });

    expect(claimTier(claim, richPacket)).toBe("caution");
  });

  it("returns caution for a Safety Concern label", () => {
    expect(claimTier(makeClaim({ finalLabel: "Safety Concern" }), richPacket)).toBe("caution");
  });

  it("returns caution for a Requires Clinician Oversight label", () => {
    expect(claimTier(makeClaim({ finalLabel: "Requires Clinician Oversight" }), richPacket)).toBe(
      "caution"
    );
  });

  it("returns strong for a reviewed Core Evidence-Based claim backed by trials", () => {
    expect(claimTier(makeClaim(), richPacket)).toBe("strong");
  });

  it("demotes to early when nothing has actually been extracted", () => {
    const emptyPacket = makePacket({ depth: { totalExtractedStudies: 0 } });

    expect(claimTier(makeClaim(), emptyPacket)).toBe("early");
    expect(claimTier(makeClaim(), undefined)).toBe("early");
  });

  it("trusts a completed snapshot packet that carries counts but no study rows", () => {
    const snapshotPacket = makePacket({
      depth: { totalExtractedStudies: 0 },
      completeness: {
        status: "complete",
        label: "Extraction complete",
        totalReferences: 9,
        extractedReferences: 9,
        pendingReferences: 0
      }
    });

    expect(claimTier(makeClaim(), snapshotPacket)).toBe("strong");
  });

  it("demotes a strong-by-confidence claim to good when no human trials were extracted", () => {
    const observationalPacket = makePacket({
      depth: { totalExtractedStudies: 4, observationalCohorts: 4 }
    });

    expect(
      claimTier(makeClaim({ finalLabel: "Useful for Specific Use Case" }), observationalPacket)
    ).toBe("good");
  });

  it("returns unclear for Insufficient Evidence", () => {
    expect(claimTier(makeClaim({ finalLabel: "Insufficient Evidence" }), richPacket)).toBe(
      "unclear"
    );
  });

  it("maps confidence to a tier for non-headline labels", () => {
    const base = { finalLabel: "Useful for Specific Use Case" } as const;

    expect(claimTier(makeClaim({ ...base, confidenceLevel: "Moderate" }), richPacket)).toBe("good");
    expect(claimTier(makeClaim({ ...base, confidenceLevel: "Low" }), richPacket)).toBe("early");
    expect(claimTier(makeClaim({ ...base, confidenceLevel: "Very low" }), richPacket)).toBe(
      "unclear"
    );
  });

  it("does not promote an unreviewed high-confidence claim past good", () => {
    const claim = makeClaim({
      finalLabel: "Useful for Specific Use Case",
      reviewStatus: "Unreviewed AI draft"
    });

    expect(claimTier(claim, richPacket)).toBe("good");
  });
});

/* -------------------------------------------------------------------------- */
/* summarizeStudyMix                                                           */
/* -------------------------------------------------------------------------- */

describe("summarizeStudyMix", () => {
  function metaAnalyses(count: number) {
    return Array.from({ length: count }, (_unused, index) =>
      makeStudy({ id: `meta-${index}`, sourceTypeTaxonomy: "meta-analysis" })
    );
  }

  it("returns null for an empty list", () => {
    expect(summarizeStudyMix([])).toBeNull();
  });

  it("pluralises meta-analysis correctly", () => {
    expect(summarizeStudyMix(metaAnalyses(23))).toBe("23 meta-analyses");
    expect(summarizeStudyMix(metaAnalyses(1))).toBe("1 meta-analysis");
  });

  it("pluralises randomised trials and animal studies", () => {
    const trials = Array.from({ length: 7 }, (_unused, index) =>
      makeStudy({
        id: `rct-${index}`,
        studyType: "Randomized controlled trial",
        sourceTypeTaxonomy: "RCT"
      })
    );
    const animals = Array.from({ length: 3 }, (_unused, index) =>
      makeStudy({ id: `animal-${index}`, studyType: "Animal study", sourceTypeTaxonomy: "animal study" })
    );

    expect(summarizeStudyMix(trials)).toBe("7 randomised trials");
    expect(summarizeStudyMix(animals)).toBe("3 animal studies");
    expect(summarizeStudyMix(animals.slice(0, 1))).toBe("1 animal study");
  });

  it("falls back to studyType when no taxonomy is recorded", () => {
    const study = makeStudy({ studyType: "Systematic review", sourceTypeTaxonomy: undefined });

    expect(summarizeStudyMix([study])).toBe("1 systematic review");
    expect(
      summarizeStudyMix([
        study,
        makeStudy({ id: "sr-2", studyType: "Systematic review", sourceTypeTaxonomy: undefined })
      ])
    ).toBe("2 systematic reviews");
  });

  it("ranks by count and keeps only the top three kinds", () => {
    const studies = [
      ...metaAnalyses(2),
      ...Array.from({ length: 5 }, (_unused, index) =>
        makeStudy({ id: `rct-${index}`, sourceTypeTaxonomy: "RCT" })
      ),
      ...Array.from({ length: 4 }, (_unused, index) =>
        makeStudy({ id: `obs-${index}`, sourceTypeTaxonomy: "observational study" })
      ),
      makeStudy({ id: "lab-1", sourceTypeTaxonomy: "in vitro/mechanistic" })
    ];

    expect(summarizeStudyMix(studies)).toBe(
      "5 randomised trials, 4 observational studies, 2 meta-analyses"
    );
  });
});

/* -------------------------------------------------------------------------- */
/* buildSupplementBrief                                                        */
/* -------------------------------------------------------------------------- */

describe("buildSupplementBrief", () => {
  const strongClaim = makeClaim();

  const pipelineCognitionClaim = makeClaim({
    id: "claim-creatine-cognition",
    outcome: "Cognition",
    claimText:
      "Creatine monohydrate has accepted source leads for cognition that need structured evidence review.",
    populationStudied: "Manual review required",
    confidenceLevel: "Very low",
    reviewStatus: "Unreviewed AI draft",
    finalLabel: "Speculative Watchlist",
    effectSize: "Unknown until source review.",
    keyReferenceIds: ["REF-C1", "REF-C2", "REF-C3"],
    summary: undefined,
    uncertainty: undefined
  });

  const safetyClaim = makeClaim({
    id: "claim-creatine-safety",
    outcome: "Safety/adverse effects",
    claimText:
      "General safety, tolerability, interaction, and product-quality profile for Creatine monohydrate.",
    finalLabel: "Conditional / Biomarker-Gated",
    summary:
      "Creatine monohydrate is well tolerated at 3 to 5 g per day in healthy adults, and the most common report is short-term weight gain from water retention. This is based on 12 linked articles and 9 extracted study rows.",
    uncertainty: undefined
  });

  const references = [
    makeReference({ id: "REF-1" }),
    makeReference({
      id: "REF-2",
      title: "Creatine and strength: a randomised trial",
      identifier: "22222222"
    })
  ];

  const studies = [
    makeStudy({ id: "study-meta", referenceId: "REF-1" }),
    makeStudy({
      id: "study-rct",
      title: "Creatine and 1RM strength: a randomised controlled trial",
      studyType: "Randomized controlled trial",
      sourceTypeTaxonomy: "RCT",
      sampleSize: "88 participants",
      population: "Resistance-trained men aged 18-35",
      intervention: "5 g/day creatine monohydrate",
      outcomes: ["1RM bench press"],
      riskOfBias: "Low",
      referenceId: "REF-2"
    })
  ];

  function strongPacket() {
    return buildClaimSourcePacket({
      claim: strongClaim,
      referencesById: new Map(references.map((reference) => [reference.id, reference])),
      studies
    });
  }

  function build(overrides: {
    intervention?: Intervention;
    claims?: Claim[];
    packets?: Map<string, ClaimSourcePacket>;
    safetyAlerts?: SafetyAlert[];
  } = {}) {
    return buildSupplementBrief({
      intervention: makeIntervention(),
      claims: [strongClaim, pipelineCognitionClaim, safetyClaim],
      packets: new Map([[strongClaim.id, strongPacket()]]),
      safetyAlerts: [],
      ...overrides
    });
  }

  it("routes a strong conclusion, a pipeline row and a safety row to the right buckets", () => {
    const brief = build();

    expect(brief.supported.map((verdict) => verdict.claimId)).toEqual([strongClaim.id]);
    expect(brief.supported[0].tier).toBe("strong");
    expect(brief.supported[0].topic).toBe("Muscle and strength");
    expect(brief.supported[0].studyMix).toBe("1 meta-analysis, 1 randomised trial");
    expect(brief.emerging).toHaveLength(0);
    expect(brief.cautions).toHaveLength(0);

    expect(brief.pending).toEqual([
      { outcome: "Cognition", topic: "Memory and thinking", referenceCount: 3 }
    ]);

    const rendered = [...brief.supported, ...brief.emerging, ...brief.cautions];
    expect(rendered.some((verdict) => verdict.outcome === "Safety/adverse effects")).toBe(false);

    expect(brief.verdict.tier).toBe("strong");
    expect(brief.verdict.label).toBe("Works for one specific thing");
    expect(brief.verdict.summary).toContain("solid evidence for muscle and strength");
    expect(brief.verdict.summary).toContain("1 other area");
  });

  it("keeps the curated safety note and drops the generated tolerability boilerplate", () => {
    const brief = build();

    expect(brief.safety.notes).toEqual([
      "Creatine monohydrate is well tolerated at 3 to 5 g per day in healthy adults, and the most common report is short-term weight gain from water retention."
    ]);

    const boilerplateOnly = build({
      claims: [
        strongClaim,
        makeClaim({
          ...safetyClaim,
          summary:
            "Creatine monohydrate has local safety and tolerability context attached to this claim. This is based on 12 linked articles and 9 extracted study rows. Safety evidence is kept separate from efficacy and does not prove product-level safety."
        })
      ]
    });

    expect(boilerplateOnly.safety.notes).toEqual([]);
  });

  it("does not list a pending outcome that a real conclusion already covers", () => {
    const pipelineMuscleClaim = makeClaim({
      id: "claim-creatine-muscle-scaffold",
      outcome: "Muscle/strength",
      claimText:
        "Creatine monohydrate has accepted source leads for muscle and strength that need structured evidence review.",
      keyReferenceIds: ["REF-M1"],
      summary: undefined,
      uncertainty: undefined
    });

    const brief = build({
      claims: [strongClaim, pipelineMuscleClaim, pipelineCognitionClaim]
    });

    expect(brief.pending.map((row) => row.outcome)).toEqual(["Cognition"]);
  });

  it("deduplicates repeated pipeline rows for the same outcome", () => {
    const brief = build({
      claims: [
        pipelineCognitionClaim,
        makeClaim({ ...pipelineCognitionClaim, id: "claim-creatine-cognition-2" })
      ]
    });

    expect(brief.pending).toHaveLength(1);
    expect(brief.verdict.tier).toBe("unclear");
    expect(brief.verdict.summary).toContain("Research on 1 other area");
  });

  it("summarises the shared evidence base across packets", () => {
    const brief = build();

    // REF-1 and REF-2 from the packet, plus the three unpacketed cognition
    // reference ids the claim rows still carry.
    expect(brief.evidenceBase).toEqual({
      referenceCount: 5,
      studyCount: 2,
      studyMix: "1 meta-analysis, 1 randomised trial",
      humanReviewedOutcomes: 1,
      totalOutcomes: 1
    });
    expect(brief.lastReviewed).toBe("2026-05-01");
    expect(brief.doesNotProve[0]).toContain("makes you live longer");
  });

  it("moves null findings out of the benefit lists and into 'does not prove'", () => {
    const nullLifespanClaim = makeClaim({
      id: "claim-creatine-lifespan",
      outcome: "Mortality/lifespan",
      reviewStatus: "Unreviewed AI draft",
      confidenceLevel: "Low",
      finalLabel: "Insufficient Evidence",
      effectSize: "Unknown",
      clinicalRelevance: "Not established.",
      summary:
        "The local record does not yet support a settled lifespan conclusion for Creatine monohydrate. This is based on 3 linked articles and 0 extracted study rows.",
      uncertainty: undefined
    });

    const brief = build({ claims: [strongClaim, nullLifespanClaim] });

    expect(brief.supported.map((verdict) => verdict.claimId)).toEqual([strongClaim.id]);
    expect(brief.emerging).toHaveLength(0);
    expect(brief.doesNotProve[0]).toBe(
      "The local record does not yet support a settled lifespan conclusion for Creatine monohydrate."
    );
  });

  it("flags peptides as clinician territory", () => {
    const brief = build({
      intervention: makeIntervention({
        id: "int-bpc-157",
        name: "BPC-157",
        slug: "bpc-157",
        category: "Peptide/biologic"
      })
    });

    expect(brief.safety.clinicianTerritory).toBe(true);
    expect(brief.verdict.tier).toBe("caution");
    expect(brief.verdict.label).toBe("Not a self-use supplement");
  });

  it("does not brand omega-3 prescription-only over a single Regulatory Concern claim", () => {
    const omega3 = makeIntervention({
      id: "int-omega-3",
      name: "Omega-3 (EPA/DHA)",
      slug: "omega-3",
      category: "Fatty acid"
    });
    const regulatoryClaim = makeClaim({
      id: "claim-omega3-triglycerides",
      interventionId: omega3.id,
      outcome: "LDL/ApoB/lipids",
      finalLabel: "Regulatory Concern",
      claimText: "High-dose EPA lowers triglycerides at prescription-strength doses.",
      summary:
        "High-dose EPA lowers triglycerides substantially, but the doses studied are only available as a prescription product in Australia. This is based on 9 linked articles and 6 extracted study rows.",
      uncertainty: undefined
    });

    const brief = build({
      intervention: omega3,
      claims: [regulatoryClaim],
      packets: new Map()
    });

    expect(brief.safety.clinicianTerritory).toBe(false);
    expect(brief.verdict.tier).not.toBe("caution");
  });

  it("does treat a regulatory-flagged watchlist drug as clinician territory", () => {
    const brief = build({
      intervention: makeIntervention({
        id: "int-rapamycin",
        name: "Rapamycin",
        slug: "rapamycin",
        category: "Drug/geroprotector watchlist"
      }),
      claims: [makeClaim({ finalLabel: "Regulatory Concern" })],
      packets: new Map()
    });

    expect(brief.safety.clinicianTerritory).toBe(true);
  });

  it("passes intervention safety fields and alerts straight through", () => {
    const alert: SafetyAlert = {
      id: "alert-1",
      interventionId: "int-creatine",
      region: "AU",
      source: "TGA",
      date: "2026-01-15",
      alertType: "Contamination",
      severity: "Moderate",
      summary: "Some imported products were found to contain undeclared stimulants.",
      url: "https://www.tga.gov.au/",
      lastChecked: "2026-05-01"
    };

    const brief = build({ safetyAlerts: [alert] });

    expect(brief.safety.summary).toBe("Well tolerated at 3-5 g/day in healthy adults.");
    expect(brief.safety.interactions).toBe("No clinically significant interactions captured.");
    expect(brief.safety.alerts).toEqual([alert]);

    const noInteractions = build({
      intervention: makeIntervention({ interactionSummary: "   " })
    });

    expect(noInteractions.safety.interactions).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* small helpers                                                               */
/* -------------------------------------------------------------------------- */

describe("readableSafetySummary", () => {
  it("replaces a pipeline to-do note with an honest gap statement", () => {
    expect(
      readableSafetySummary("Safety and adverse-event context is not reviewed yet.")
    ).toContain("Nobody has reviewed the safety evidence for this one yet");
  });

  it("leaves a curated safety summary alone", () => {
    const summary = "Well tolerated at 3-5 g/day in healthy adults.";

    expect(readableSafetySummary(summary)).toBe(summary);
  });
});

describe("outcomeTopic and tierLabel", () => {
  it("maps outcome areas to plain-language topics", () => {
    expect(outcomeTopic("Mortality/lifespan")).toBe("Living longer");
    expect(outcomeTopic("Glucose/insulin/HbA1c")).toBe("Blood sugar");
    expect(outcomeTopic("Safety/adverse effects")).toBe("Side effects");
  });

  it("labels each tier", () => {
    expect(tierLabel("strong")).toBe("Solid evidence");
    expect(tierLabel("caution")).toBe("Reason for caution");
    expect(tierLabel("unclear")).toBe("Too early to say");
  });
});
