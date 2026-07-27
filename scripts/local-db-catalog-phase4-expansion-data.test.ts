import { describe, expect, it } from "vitest";

import {
  EXPANSION_REFERENCES,
  EXPANSION_STUDIES,
  referenceIdsForClaim
} from "./local-db-catalog-phase4-expansion-data";

describe("phase-4 expansion data", () => {
  it("keeps Astaxanthin claim mappings off unrelated PubMed records", () => {
    const astaxanthinReferences = EXPANSION_REFERENCES.filter((reference) =>
      reference.title.toLowerCase().includes("astaxanthin")
    );
    const astaxanthinPmids = astaxanthinReferences.map((reference) => reference.identifier);
    const astaxanthinStudyPmids = EXPANSION_STUDIES.filter(
      (study) => study.interventionName === "Astaxanthin"
    ).map((study) => study.pmid);

    expect(astaxanthinPmids).not.toContain("PMID: 28482226");
    expect(astaxanthinPmids).not.toContain("PMID: 35866336");
    expect(astaxanthinStudyPmids).not.toContain("28482226");
    expect(astaxanthinStudyPmids).not.toContain("35866336");
    expect(referenceIdsForClaim("astaxanthin", "SAFETY_ADVERSE_EFFECTS")).toEqual([
      "ref-pubmed-31788888"
    ]);
    expect(referenceIdsForClaim("astaxanthin", "JOINT_TENDON_SKIN")).toEqual([
      "ref-pubmed-34578794"
    ]);
    expect(referenceIdsForClaim("astaxanthin", "INFLAMMATION")).toEqual([
      "ref-pubmed-32755613"
    ]);
    expect(referenceIdsForClaim("astaxanthin", "EYE_HEALTH")).toEqual([
      "ref-pubmed-40014233"
    ]);
  });

  it("keeps Astaxanthin extraction rows substantive enough to unblock source packets", () => {
    const astaxanthinStudyPmids = new Set(["31788888", "32755613", "34578794", "40014233"]);
    const astaxanthinStudies = EXPANSION_STUDIES.filter((study) =>
      astaxanthinStudyPmids.has(study.pmid ?? "")
    );

    expect(astaxanthinStudies).toHaveLength(4);

    for (const study of astaxanthinStudies) {
      expect(study.sampleSize).not.toMatch(/see source record/i);
      expect(study.population).not.toMatch(/see source record/i);
      expect(study.riskOfBias).not.toMatch(/review design and heterogeneity/i);
      expect(study.mainResults).toBeTruthy();
    }
  });
});
