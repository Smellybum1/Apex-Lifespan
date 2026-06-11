import { describe, expect, it } from "vitest";

import { analyzeLabel, compositeScore, scoreBand } from "@/lib/scoring";
import { references } from "@/lib/seed-data";
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
    expect(findings[0]).toMatchObject({ sourceLabel: "Heuristic check" });
  });

  it("flags peptide guardrails and hype language", () => {
    const findings = analyzeLabel("BPC-157 peptide blend repairs DNA and extends lifespan with no side effects");

    expect(findings.map((finding) => finding.id)).toEqual(
      expect.arrayContaining(["peptide-guardrail", "hype-language"])
    );
  });

  it("adds AU/TGA caution for research-use injectable peptides", () => {
    const findings = analyzeLabel(
      "BPC-157 peptide vial, lyophilized, research use only, not for human consumption"
    );

    expect(findings.map((finding) => finding.id)).toEqual(
      expect.arrayContaining(["peptide-guardrail", "research-use-or-injectable-peptide"])
    );
    expect(findings.find((finding) => finding.id === "research-use-or-injectable-peptide"))
      .toMatchObject({
        level: "high",
        sourceLabel: "TGA peptide warning"
      });
  });

  it("flags unresolved AUST status without flagging visible AUST numbers as missing", () => {
    expect(analyzeLabel("Joint repair therapeutic capsules - AUST number pending").map((finding) => finding.id))
      .toEqual(expect.arrayContaining(["aust-number-unresolved"]));

    expect(analyzeLabel("Joint support medicine AUST L 123456").map((finding) => finding.id))
      .not.toContain("aust-number-not-visible");
  });

  it("keeps TGA AUST label findings linked to the curated seed reference", () => {
    const austReference = references.find((reference) => reference.id === "tga-aust-numbers");
    const findings = analyzeLabel("Joint repair therapeutic capsules - AUST number pending");

    expect(austReference).toBeDefined();
    expect(findings.find((finding) => finding.id === "aust-number-unresolved")).toMatchObject({
      sourceLabel: "TGA AUST numbers",
      sourceUrl: austReference?.url
    });
  });

  it("distinguishes TGA approval overclaims from approval negation", () => {
    expect(analyzeLabel("TGA approved peptide for injury repair").map((finding) => finding.id))
      .toEqual(expect.arrayContaining(["tga-approval-overclaim"]));

    const negatedClaims = [
      "This product is not TGA approved",
      "This product isn't TGA approved",
      "This product isn\u2019t TGA approved",
      "This product isnt TGA approved",
      "This product is not yet ARTG listed",
      "This product is never ARTG certified"
    ];

    for (const claim of negatedClaims) {
      expect(analyzeLabel(claim).map((finding) => finding.id))
        .not.toContain("tga-approval-overclaim");
    }
  });

  it("shows provenance for sourced and heuristic label findings", () => {
    const findings = analyzeLabel(
      "Vitamin D 10,000 IU proprietary blend detox formula, NSF Certified for Sport"
    );

    expect(findings.every((finding) => Boolean(finding.sourceLabel))).toBe(true);
    expect(findings.find((finding) => finding.id === "high-vitamin-d")).toMatchObject({
      sourceLabel: "NIH ODS vitamin D",
      sourceUrl: "https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/"
    });
    const proprietaryBlendFinding = findings.find(
      (finding) => finding.id === "proprietary-blend"
    );
    const hypeFinding = findings.find((finding) => finding.id === "hype-language");

    expect(proprietaryBlendFinding).toMatchObject({ sourceLabel: "Heuristic check" });
    expect(proprietaryBlendFinding).not.toHaveProperty("sourceUrl");
    expect(hypeFinding).toMatchObject({ sourceLabel: "Heuristic check" });
    expect(hypeFinding).not.toHaveProperty("sourceUrl");
  });
});
