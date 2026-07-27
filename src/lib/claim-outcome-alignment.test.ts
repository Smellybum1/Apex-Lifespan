import { describe, expect, it } from "vitest";

import { assessClaimOutcomeAlignment } from "@/lib/claim-outcome-alignment";
import type { ClaimSourcePacket } from "@/lib/source-packet";
import type { Claim, Study } from "@/lib/types";

function study(overrides: Partial<Study> = {}): Study {
  return {
    id: "study-1",
    mainResults: "",
    outcomes: [],
    sampleSize: "40",
    source: "PubMed",
    studyType: "Randomized controlled trial",
    title: "A trial",
    year: 2024,
    ...overrides
  } as unknown as Study;
}

function packetOf(studies: Study[]): ClaimSourcePacket {
  return { studies } as unknown as ClaimSourcePacket;
}

function claim(outcome: Claim["outcome"]): Claim {
  return { outcome } as unknown as Claim;
}

describe("assessClaimOutcomeAlignment", () => {
  it("confirms alignment when a study measured the claim's outcome", () => {
    const result = assessClaimOutcomeAlignment({
      claim: claim("Muscle/strength"),
      packet: packetOf([
        study({ outcomes: ["One-repetition-maximum strength", "Fat-free mass"] })
      ])
    });

    expect(result.verdict).toBe("aligned");
    expect(result.alignedStudies).toBe(1);
  });

  it("catches the whey-and-mortality shape: right supplement, wrong question", () => {
    const result = assessClaimOutcomeAlignment({
      claim: claim("Mortality/lifespan"),
      packet: packetOf([
        study({ outcomes: ["Number of participants with refeeding syndrome"] }),
        study({ title: "Whey protein concentrate and E. coli diarrhea", outcomes: ["Diarrhea score"] }),
        study({ outcomes: ["One-repetition-maximum strength", "Fat-free mass"] })
      ])
    });

    expect(result.verdict).toBe("unaligned");
    expect(result.alignedStudies).toBe(0);
  });

  it("ignores outcomes written from the claim itself", () => {
    // "Claim domain: X" is derived from the claim the study was linked to, not
    // extracted from the paper. Matching on it compares the claim to itself.
    const result = assessClaimOutcomeAlignment({
      claim: claim("Cognition"),
      packet: packetOf([
        study({ outcomes: ["Claim domain: Cognition; Sleep"], title: "A trial of grip strength" })
      ])
    });

    expect(result.verdict).toBe("unknown");
  });

  it("reports unknown rather than unaligned when nothing records what was measured", () => {
    const result = assessClaimOutcomeAlignment({
      claim: claim("Sleep"),
      packet: packetOf([study({ mainResults: "", outcomes: [] })])
    });

    expect(result.verdict).toBe("unknown");
    expect(result.reason).toContain("none recording what it measured");
  });

  it("reports unknown when there is no packet at all", () => {
    expect(assessClaimOutcomeAlignment({ claim: claim("Sleep") }).verdict).toBe("unknown");
  });

  it("falls back to main results when outcomes are absent", () => {
    const result = assessClaimOutcomeAlignment({
      claim: claim("Blood pressure"),
      packet: packetOf([
        study({ mainResults: "Systolic blood pressure fell by 4 mmHg versus placebo." })
      ])
    });

    expect(result.verdict).toBe("aligned");
  });

  it("matches the outcome area's own name, which extraction writes verbatim", () => {
    // Three magnesium studies record exactly `Sleep` as their outcome. Matching
    // only hand-written synonyms called that claim unaligned.
    const result = assessClaimOutcomeAlignment({
      claim: claim("Sleep"),
      packet: packetOf([study({ outcomes: ["Sleep"] })])
    });

    expect(result.verdict).toBe("aligned");
  });

  it("splits a compound outcome label into usable parts", () => {
    const result = assessClaimOutcomeAlignment({
      claim: claim("Glucose/insulin/HbA1c"),
      packet: packetOf([study({ outcomes: ["Fasting insulin"] })])
    });

    expect(result.verdict).toBe("aligned");
  });

  it("needs only one aligned study among several", () => {
    const result = assessClaimOutcomeAlignment({
      claim: claim("Sleep"),
      packet: packetOf([
        study({ outcomes: ["Grip strength"] }),
        study({ outcomes: ["Sleep quality index"] })
      ])
    });

    expect(result.verdict).toBe("aligned");
    expect(result.alignedStudies).toBe(1);
    expect(result.judgeableStudies).toBe(2);
  });
});
