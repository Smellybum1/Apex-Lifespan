import { describe, expect, it } from "vitest";

import { buildSourceSearchQueries } from "@/lib/source-queries";

describe("buildSourceSearchQueries", () => {
  it("builds PubMed and trial terms from the active intervention and claim outcome", () => {
    const queries = buildSourceSearchQueries({
      intervention: {
        category: "Amino acid",
        name: "Creatine monohydrate",
        synonyms: ["creatine"]
      },
      claim: {
        outcome: "Muscle/strength",
        claimText: "Strength support"
      }
    });

    expect(queries).toMatchObject({
      label: "Creatine monohydrate - Muscle/strength",
      pubMedTerm:
        "Creatine monohydrate strength resistance training lean mass randomized trial systematic review",
      trialTerm: "Creatine monohydrate strength resistance training lean mass"
    });
    expect(queries.plans.map((plan) => plan.kind)).toEqual([
      "review-level",
      "human-trial",
      "trial-registry",
      "safety",
      "regulatory-review",
      "outcome-context",
      "category-context"
    ]);
    expect(queries.plans).toContainEqual(
      expect.objectContaining({
        bundleId: "core-evidence",
        bundleLabel: "Core evidence sweep",
        kind: "review-level",
        priority: 10,
        source: "PubMed",
        term:
          "Creatine monohydrate strength resistance training lean mass systematic review meta-analysis"
      })
    );
    expect(queries.plans).toContainEqual(
      expect.objectContaining({
        bundleId: "core-evidence",
        kind: "regulatory-review",
        source: "AU/TGA review",
        term: "Creatine monohydrate TGA ARTG AUST product status safety alert Australia"
      })
    );
    expect(queries.plans).toContainEqual(
      expect.objectContaining({
        bundleId: "outcome-context",
        bundleLabel: "Outcome-specific evidence bundle",
        kind: "outcome-context",
        source: "PubMed",
        term:
          "Creatine monohydrate resistance training strength lean mass placebo randomized trial"
      })
    );
    expect(queries.plans).toContainEqual(
      expect.objectContaining({
        bundleId: "category-context",
        bundleLabel: "Category-specific safety/context bundle",
        kind: "category-context",
        source: "PubMed",
        term:
          "Creatine monohydrate trained adults exercise performance renal safety tolerability"
      })
    );
  });

  it("uses outcome-specific clinical terms for cardiovascular claims", () => {
    const queries = buildSourceSearchQueries({
      intervention: {
        category: "Fatty acid",
        name: "Omega-3 EPA/DHA",
        synonyms: ["fish oil"]
      },
      claim: {
        outcome: "Cardiovascular events",
        claimText: "Cardiovascular prevention"
      }
    });

    expect(queries.pubMedTerm).toContain("cardiovascular events prevention");
    expect(queries.trialTerm).toBe("Omega-3 EPA/DHA cardiovascular events prevention");
    expect(queries.plans).toContainEqual(
      expect.objectContaining({
        bundleId: "category-context",
        term:
          "Omega-3 EPA/DHA EPA DHA formulation atrial fibrillation bleeding triglycerides product quality"
      })
    );
  });

  it("adds compact claim-specific anchors to broad outcome terms", () => {
    const queries = buildSourceSearchQueries({
      intervention: {
        name: "Vitamin D",
        synonyms: ["cholecalciferol"]
      },
      claim: {
        outcome: "Safety/adverse effects",
        claimText: "Correcting deficiency or low status."
      }
    });

    expect(queries).toMatchObject({
      label: "Vitamin D - Safety/adverse effects",
      pubMedTerm:
        "Vitamin D safety adverse effects deficiency low status randomized trial systematic review",
      trialTerm: "Vitamin D safety adverse effects deficiency low status"
    });
    expect(queries.plans).toContainEqual(
      expect.objectContaining({
        kind: "safety",
        source: "PubMed",
        term:
          "Vitamin D safety adverse effects interactions deficiency low status contraindications"
      })
    );
  });

  it("does not echo self-use peptide language into public source suggestions", () => {
    const queries = buildSourceSearchQueries({
      intervention: {
        category: "Peptide/biologic",
        name: "BPC-157",
        synonyms: ["body protection compound 157"]
      },
      claim: {
        outcome: "Joint/tendon/skin",
        claimText:
          "Injection dosing cycle with reconstitution, sterile water, vial sourcing, and soft-tissue healing"
      }
    });

    expect(queries.pubMedTerm).toBe(
      "BPC-157 injury healing tendon skin soft-tissue randomized trial systematic review"
    );
    expect(queries.trialTerm).toBe("BPC-157 injury healing tendon skin soft-tissue");
    expect(`${queries.pubMedTerm} ${queries.trialTerm}`.toLowerCase()).not.toMatch(
      /\b(injection|dosing|cycle|reconstitution|sterile|water|vial|sourcing)\b/
    );
    expect(
      queries.plans.map((plan) => plan.term).join(" ").toLowerCase()
    ).not.toMatch(/\b(injection|dosing|cycle|reconstitution|sterile|water|vial|sourcing)\b/);
    expect(queries.plans).toContainEqual(
      expect.objectContaining({
        bundleId: "category-context",
        term: "BPC-157 clinical trial adverse events regulatory safety review"
      })
    );
  });

  it("keeps ordinary clinical context when blocking preparation phrases", () => {
    const queries = buildSourceSearchQueries({
      intervention: {
        name: "Creatine monohydrate",
        synonyms: ["creatine"]
      },
      claim: {
        outcome: "Safety/adverse effects",
        claimText: "Water retention symptoms"
      }
    });

    expect(queries.pubMedTerm).toContain("water retention symptoms");
    expect(queries.trialTerm).toContain("water retention symptoms");
  });

  it("falls back when intervention context is unavailable", () => {
    const queries = buildSourceSearchQueries({});

    expect(queries).toMatchObject({
      label: "Active claim",
      pubMedTerm: "healthspan intervention human evidence randomized trial systematic review",
      trialTerm: "healthspan intervention human evidence"
    });
    expect(queries.plans).toHaveLength(5);
    expect(queries.plans.every((plan) => plan.bundleId === "core-evidence")).toBe(true);
  });
});
