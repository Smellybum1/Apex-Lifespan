import { describe, expect, it } from "vitest";

import { buildSourceSearchQueries } from "@/lib/source-queries";

describe("buildSourceSearchQueries", () => {
  it("builds PubMed and trial terms from the active intervention and claim outcome", () => {
    const queries = buildSourceSearchQueries({
      intervention: {
        name: "Creatine monohydrate",
        synonyms: ["creatine"]
      },
      claim: {
        outcome: "Muscle/strength",
        claimText: "Strength support"
      }
    });

    expect(queries).toEqual({
      label: "Creatine monohydrate - Muscle/strength",
      pubMedTerm:
        "Creatine monohydrate strength resistance training lean mass randomized trial systematic review",
      trialTerm: "Creatine monohydrate strength resistance training lean mass"
    });
  });

  it("uses outcome-specific clinical terms for cardiovascular claims", () => {
    const queries = buildSourceSearchQueries({
      intervention: {
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

    expect(queries).toEqual({
      label: "Vitamin D - Safety/adverse effects",
      pubMedTerm:
        "Vitamin D safety adverse effects deficiency low status randomized trial systematic review",
      trialTerm: "Vitamin D safety adverse effects deficiency low status"
    });
  });

  it("does not echo self-use peptide language into public source suggestions", () => {
    const queries = buildSourceSearchQueries({
      intervention: {
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

    expect(queries).toEqual({
      label: "Active claim",
      pubMedTerm: "healthspan intervention human evidence randomized trial systematic review",
      trialTerm: "healthspan intervention human evidence"
    });
  });
});
