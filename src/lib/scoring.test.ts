import { describe, expect, it } from "vitest";

import { analyzeLabel, compositeScore, scoreBand } from "@/lib/scoring";
import type { ScoreSet } from "@/lib/types";

const strongScores: ScoreSet = {
  evidenceDirectness: 9,
  evidenceRigor: 9,
  effectSize: 7,
  safety: 8,
  regulatoryRisk: 1,
  productQuality: 4,
  hypePenalty: 2,
  measurability: 9
};

describe("compositeScore", () => {
  it("rewards direct, rigorous, safe, measurable claim evidence", () => {
    expect(compositeScore(strongScores)).toBe(8.4);
    expect(scoreBand(compositeScore(strongScores))).toBe("Strong");
  });

  it("penalizes high regulatory risk and hype", () => {
    const speculativeScores: ScoreSet = {
      ...strongScores,
      evidenceDirectness: 1,
      evidenceRigor: 2,
      effectSize: 2,
      safety: 2,
      regulatoryRisk: 9,
      hypePenalty: 9,
      measurability: 5
    };

    expect(compositeScore(speculativeScores)).toBe(1.8);
    expect(scoreBand(compositeScore(speculativeScores))).toBe("Weak");
  });
});

describe("analyzeLabel", () => {
  it("does not flag a negated proprietary blend statement", () => {
    const findings = analyzeLabel("Creatine monohydrate 5 g\nNo proprietary blend\nNSF Certified for Sport");

    expect(findings.map((finding) => finding.id)).toEqual(["certification"]);
  });

  it("flags peptide guardrails and hype language", () => {
    const findings = analyzeLabel("BPC-157 peptide blend repairs DNA and extends lifespan with no side effects");

    expect(findings.map((finding) => finding.id)).toEqual(
      expect.arrayContaining(["peptide-guardrail", "hype-language"])
    );
  });
});
