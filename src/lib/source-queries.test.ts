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

  it("falls back when intervention context is unavailable", () => {
    const queries = buildSourceSearchQueries({});

    expect(queries).toEqual({
      label: "Active claim",
      pubMedTerm: "healthspan intervention human evidence randomized trial systematic review",
      trialTerm: "healthspan intervention human evidence"
    });
  });
});
