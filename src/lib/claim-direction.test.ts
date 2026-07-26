import { describe, expect, it } from "vitest";

import { claimEvidenceDirectionLabel, isAdverseDirectionClaim } from "@/lib/claim-direction";

describe("claim-direction", () => {
  it("flags root adverse-direction keywords", () => {
    expect(
      isAdverseDirectionClaim({
        summary: "The clearest conclusion is adverse for late-day dosing.",
        uncertainty: undefined
      })
    ).toBe(true);
  });

  it("flags conjugated adverse-direction keywords", () => {
    expect(
      isAdverseDirectionClaim({
        summary: "High doses worsened sleep continuity in most participants.",
        uncertainty: undefined
      })
    ).toBe(true);
    expect(
      isAdverseDirectionClaim({
        summary: undefined,
        uncertainty: "Evening use impairs sleep onset in sensitive individuals."
      })
    ).toBe(true);
    expect(
      isAdverseDirectionClaim({
        summary: "Some records describe disruption of circadian timing.",
        uncertainty: undefined
      })
    ).toBe(true);
  });

  it("does not flag harmless or neutral wording", () => {
    expect(
      isAdverseDirectionClaim({
        summary: "Generally considered harmless at studied doses.",
        uncertainty: undefined
      })
    ).toBe(false);
    expect(
      isAdverseDirectionClaim({
        summary: "Supports strength outcomes in trained adults.",
        uncertainty: "Effect sizes vary by training status."
      })
    ).toBe(false);
    expect(isAdverseDirectionClaim({ summary: undefined, uncertainty: undefined })).toBe(false);
  });

  it("keeps the curated sleep-benefit phrase trigger", () => {
    expect(
      isAdverseDirectionClaim({
        summary: undefined,
        uncertainty: "The dashboard should not frame this as a sleep benefit."
      })
    ).toBe(true);
  });

  it("returns the shared badge label only for adverse rows", () => {
    expect(
      claimEvidenceDirectionLabel({
        summary: "Caffeine can impair sleep timing.",
        uncertainty: undefined
      })
    ).toBe("Caution/adverse signal");
    expect(
      claimEvidenceDirectionLabel({
        summary: "Supports strength outcomes.",
        uncertainty: undefined
      })
    ).toBeNull();
  });
});
