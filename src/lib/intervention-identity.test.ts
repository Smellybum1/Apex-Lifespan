import { describe, expect, it } from "vitest";

import {
  containsIdentityTerm,
  findInterventionIdentityMatch,
  INTERVENTION_SYNONYM_EXPANSIONS,
  interventionIdentityTerms,
  normaliseForMatch
} from "@/lib/intervention-identity";

const creatine = {
  name: "Creatine monohydrate",
  slug: "creatine-monohydrate",
  synonyms: ["creatine", "creatine hydrate"]
};

describe("normaliseForMatch", () => {
  it("collapses the punctuation variants of a vitamin name onto one string", () => {
    expect(normaliseForMatch("Vitamin B12")).toBe("vitamin b 12");
    expect(normaliseForMatch("vitamin B-12")).toBe("vitamin b 12");
    expect(normaliseForMatch("Vitamin B(12)")).toBe("vitamin b 12");
  });

  it("collapses hyphenated and spaced numeric names", () => {
    expect(normaliseForMatch("omega-3")).toBe("omega 3");
    expect(normaliseForMatch("Omega 3")).toBe("omega 3");
    expect(normaliseForMatch("GLP-1")).toBe("glp 1");
  });

  it("transliterates Greek letters rather than dropping them", () => {
    expect(normaliseForMatch("β-Alanine")).toBe("beta alanine");
    expect(normaliseForMatch("Tβ4")).toBe("t beta 4");
  });
});

describe("containsIdentityTerm", () => {
  it("does not match a term buried inside a longer word", () => {
    expect(containsIdentityTerm("phosphocreatine kinetics", "creatine")).toBe(false);
    expect(containsIdentityTerm("serum creatinine clearance", "creatine")).toBe(false);
  });

  it("matches on a word boundary", () => {
    expect(containsIdentityTerm("oral creatine supplementation", "creatine")).toBe(true);
    expect(containsIdentityTerm("creatine", "creatine")).toBe(true);
  });

  it("tolerates a plural in the text", () => {
    expect(containsIdentityTerm("glp 1 receptor agonists", "glp 1 receptor agonist")).toBe(
      true
    );
    expect(containsIdentityTerm("green tea catechins", "green tea catechin")).toBe(true);
  });

  it("still requires a boundary either side of a pluralised match", () => {
    expect(containsIdentityTerm("microagonists", "agonist")).toBe(false);
  });

  it("matches an adjacent term the identity check cannot resolve alone", () => {
    // "creatine kinase" is a biomarker, not the supplement, but the boundary is
    // a space so identity alone cannot reject it. This is what trap terms are
    // for — asserted here so the limit is recorded rather than assumed away.
    expect(containsIdentityTerm("serum creatine kinase", "creatine")).toBe(true);
  });
});

describe("interventionIdentityTerms", () => {
  it("splits a name only where the separator means 'either substance'", () => {
    const terms = interventionIdentityTerms({
      name: "Lutein and Zeaxanthin",
      slug: "unmapped",
      synonyms: []
    });

    expect(terms).toContain("lutein");
    expect(terms).toContain("zeaxanthin");
    expect(terms).toContain("lutein and zeaxanthin");
  });

  it("splits on a slash and on a parenthetical abbreviation", () => {
    expect(
      interventionIdentityTerms({ name: "Glucosamine/chondroitin", synonyms: [] })
    ).toEqual(expect.arrayContaining(["glucosamine", "chondroitin"]));
    expect(
      interventionIdentityTerms({ name: "Trimethylglycine (TMG)", synonyms: [] })
    ).toEqual(expect.arrayContaining(["trimethylglycine", "tmg"]));
  });

  it("does not reduce a two-word substance to its class word", () => {
    const terms = interventionIdentityTerms({
      name: "Whey protein",
      slug: "unmapped",
      synonyms: []
    });

    expect(terms).toContain("whey protein");
    expect(terms).not.toContain("protein");
  });

  it("does not emit a standalone token that identifies nothing", () => {
    const terms = interventionIdentityTerms({
      name: "Green tea extract",
      slug: "unmapped",
      synonyms: []
    });

    expect(terms).not.toContain("green");
    expect(terms).not.toContain("extract");
  });

  it("emits whitespace tokens at broad breadth, for review surfaces only", () => {
    const strict = interventionIdentityTerms(
      { name: "Whey protein", slug: "unmapped", synonyms: [] },
      { breadth: "strict" }
    );
    const broad = interventionIdentityTerms(
      { name: "Whey protein", slug: "unmapped", synonyms: [] },
      { breadth: "broad" }
    );

    expect(strict).not.toContain("protein");
    expect(broad).toContain("protein");
  });

  it("drops generic class words that span interventions", () => {
    const terms = interventionIdentityTerms(
      { name: "Polyphenols", slug: "unmapped", synonyms: ["antioxidants"] },
      { breadth: "broad" }
    );

    expect(terms).not.toContain("polyphenols");
    expect(terms).not.toContain("antioxidants");
  });

  it("merges the curated expansion with the seeded synonyms rather than replacing them", () => {
    const terms = interventionIdentityTerms(creatine);

    expect(terms).toContain("creatine hydrate");
    expect(terms).toContain("creatine supplementation");
  });

  it("applies no expansion when the slug is unknown", () => {
    const withSlug = interventionIdentityTerms({
      name: "Curcumin",
      slug: "curcumin",
      synonyms: []
    });
    const withoutSlug = interventionIdentityTerms({ name: "Curcumin", synonyms: [] });

    expect(withSlug).toContain("turmeric");
    expect(withoutSlug).not.toContain("turmeric");
  });

  it("reports the most specific matching term first", () => {
    const terms = interventionIdentityTerms(creatine);
    const lengths = terms.map((term) => term.length);

    expect(lengths).toEqual([...lengths].sort((left, right) => right - left));
  });
});

describe("findInterventionIdentityMatch", () => {
  it("prefers the title, because a title names the subject and an abstract may only cite it", () => {
    const match = findInterventionIdentityMatch({
      abstract: "Participants also received magnesium.",
      intervention: creatine,
      title: "Creatine supplementation and lean mass"
    });

    expect(match).toEqual({ field: "title", matchedTerm: "creatine supplementation" });
  });

  it("falls back to the abstract and says so", () => {
    const match = findInterventionIdentityMatch({
      abstract: "Participants received oral creatine for eight weeks.",
      intervention: creatine,
      title: "Resistance training in older adults"
    });

    expect(match?.field).toBe("abstract");
  });

  it("returns nothing when the intervention is named nowhere", () => {
    expect(
      findInterventionIdentityMatch({
        abstract: "Serum creatinine was measured at baseline.",
        intervention: creatine,
        title: "Statin-associated myopathy: a randomised trial"
      })
    ).toBeUndefined();
  });

  it("recovers the omega-3 literature the seeded synonyms miss", () => {
    const omega3 = {
      name: "Omega-3 EPA/DHA",
      slug: "omega-3-epa-dha",
      synonyms: ["fish oil", "EPA", "DHA", "long-chain omega-3"]
    };

    expect(
      findInterventionIdentityMatch({
        intervention: omega3,
        title: "Effect of n-3 PUFA on cardiovascular outcomes"
      })?.field
    ).toBe("title");
  });

  it("does not treat a drug class as the drug", () => {
    const semaglutide = { name: "Semaglutide", slug: "semaglutide", synonyms: [] };

    expect(
      findInterventionIdentityMatch({
        intervention: semaglutide,
        title: "GLP-1 receptor agonists in Parkinson's disease: a systematic review"
      })
    ).toBeUndefined();
    expect(INTERVENTION_SYNONYM_EXPANSIONS.semaglutide).not.toContain(
      "glp-1 receptor agonist"
    );
  });

  it("handles a missing title and abstract without throwing", () => {
    expect(
      findInterventionIdentityMatch({ abstract: null, intervention: creatine, title: null })
    ).toBeUndefined();
  });
});
