import { describe, expect, it } from "vitest";

import {
  assessLabelProductQuality,
  analyzeLabel,
  compositeScore,
  confidenceWeightFromAiScore,
  confidenceWeightedScore,
  getClaimScoreRows,
  parseLabelCertifications,
  parseLabelDoseCues,
  parseLabelIngredients,
  parseLabelProductIdentifiers,
  scoreBand
} from "@/lib/scoring";
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

describe("confidenceWeightedScore", () => {
  it("dampens raw scores by AI evidence confidence without hiding low-confidence packets", () => {
    expect(confidenceWeightFromAiScore(17)).toBe(0.17);
    expect(confidenceWeightedScore(8.4, 17)).toBe(1.4);
    expect(confidenceWeightedScore(8.4, 95)).toBe(8);
    expect(confidenceWeightedScore(8.4, 140)).toBe(8.4);
    expect(confidenceWeightedScore(8.4, Number.NaN)).toBe(0);
  });
});

describe("getClaimScoreRows", () => {
  it("keeps the visible score breakdown aligned with the composite formula", () => {
    const rows = getClaimScoreRows({
      id: "claim",
      interventionId: "intervention",
      outcome: "Muscle/strength",
      claimText: "Claim.",
      finalLabel: "Insufficient Evidence",
      evidenceGrade: "Draft",
      confidenceLevel: "Low",
      scores: strongScores,
      keyReferenceIds: [],
      momentum: "Stable",
      effectSize: "Effect.",
      populationStudied: "Population.",
      doseFormStudied: "Dose.",
      durationStudied: "Duration.",
      comparator: "Comparator.",
      safetyNotes: "Safety.",
      applicabilityNotes: "Applicability.",
      clinicalRelevance: "Relevance.",
      whatWouldChangeScore: "More evidence.",
      reviewStatus: "Unreviewed AI draft",
      lastUpdated: "2026-06-13"
    });

    expect(rows.map((row) => row.label)).toEqual([
      "Directness",
      "Rigor",
      "Impact",
      "Safety",
      "Measurability",
      "Low regulatory risk",
      "Low hype risk"
    ]);
    expect(rows.find((row) => row.label === "Low regulatory risk")?.value).toBe(9);
    expect(rows.find((row) => row.label === "Low hype risk")?.value).toBe(8);
  });
});

describe("analyzeLabel", () => {
  it("parses label ingredients with normalized names and captured amounts", () => {
    expect(
      parseLabelIngredients(
        "Creatine Monohydrate 5 g\nVitamin D3 10,000 IU\nVitamin A 5,000 IU (as retinyl palmitate)\nVitamin E 400 IU (as d-alpha-tocopherol)\nFolate 680 mcg DFE (400 mcg folic acid)\nNiacin 16 mg NE\nNSF Certified for Sport"
      )
    ).toEqual([
      {
        amount: "5",
        amountMg: 5000,
        amountValue: 5,
        displayName: "Creatine Monohydrate",
        normalizedName: "creatine monohydrate",
        unit: "g"
      },
      {
        amount: "10,000",
        amountConversion: {
          basis: "Vitamin D IU converted using 1 IU = 0.025 mcg vitamin D.",
          caveat:
            "Use only for vitamin D label normalization; product efficacy and safety still require scoped evidence review.",
          sourceLabel: "NIH ODS/USDA DSID unit conversions",
          sourceUrl: "https://dsid.od.nih.gov/unit-conversions"
        },
        amountMg: 0.25,
        amountMetricUnit: "mg vitamin D",
        amountValue: 10000,
        displayName: "Vitamin D3",
        normalizedName: "vitamin d",
        unit: "IU"
      },
      {
        amount: "5,000",
        amountConversion: {
          basis: "Vitamin A IU converted using 1 IU retinol = 0.3 mcg RAE.",
          caveat:
            "Use only when the label source is retinol, retinyl acetate, retinyl palmitate, or preformed vitamin A; generic vitamin A IU still needs source-form review.",
          sourceLabel: "NIH ODS Vitamin A fact sheet",
          sourceUrl: "https://ods.od.nih.gov/factsheets/VitaminA-HealthProfessional/"
        },
        amountMg: 1.5,
        amountMetricUnit: "mg RAE",
        amountValue: 5000,
        displayName: "Vitamin A",
        normalizedName: "vitamin a",
        unit: "IU"
      },
      {
        amount: "400",
        amountConversion: {
          basis:
            "Vitamin E IU converted using 1 IU natural vitamin E = 0.67 mg alpha-tocopherol.",
          caveat:
            "Use only when the label source distinguishes natural/d-alpha or synthetic/dl-alpha/all-rac alpha-tocopherol; mixed tocopherols and tocotrienols need form-specific review.",
          sourceLabel: "NIH ODS Vitamin E fact sheet",
          sourceUrl: "https://ods.od.nih.gov/factsheets/VitaminE-HealthProfessional/"
        },
        amountMg: 268,
        amountMetricUnit: "mg alpha-tocopherol",
        amountValue: 400,
        displayName: "Vitamin E",
        normalizedName: "vitamin e",
        unit: "IU"
      },
      {
        amount: "680",
        amountConversion: {
          basis:
            "Folate DFE preserved as dietary folate equivalents; 1 mcg DFE = 1 mcg food folate or 0.6 mcg folic acid from fortified foods or supplements consumed with food.",
          caveat:
            "Use DFE only as an equivalent-unit label normalization; folic acid, food folate, and 5-MTHF comparisons still need form-specific review.",
          sourceLabel: "NIH ODS Folate fact sheet",
          sourceUrl: "https://ods.od.nih.gov/factsheets/Folate-HealthProfessional/"
        },
        amountMg: 0.68,
        amountMetricUnit: "mg DFE",
        amountUnitLabel: "mcg DFE",
        amountValue: 680,
        displayName: "Folate",
        normalizedName: "folate",
        unit: "mcg"
      },
      {
        amount: "16",
        amountConversion: {
          basis:
            "Niacin NE preserved as niacin equivalents; 1 NE = 1 mg niacin or 60 mg tryptophan.",
          caveat:
            "Use NE only as an equivalent-unit label normalization; product form, tolerability, and claim evidence still need scoped review.",
          sourceLabel: "NIH ODS Niacin fact sheet",
          sourceUrl: "https://ods.od.nih.gov/factsheets/Niacin-HealthProfessional/"
        },
        amountMg: 16,
        amountMetricUnit: "mg NE",
        amountUnitLabel: "mg NE",
        amountValue: 16,
        displayName: "Niacin",
        normalizedName: "niacin",
        unit: "mg"
      }
    ]);
  });

  it("carries proprietary blend context into parsed ingredient rows", () => {
    expect(
      parseLabelIngredients("Proprietary blend: Resveratrol 100 mg, Fisetin 50 mg")
    ).toEqual([
      {
        amount: "100",
        amountMg: 100,
        amountValue: 100,
        blendContext: "Proprietary blend",
        displayName: "Resveratrol",
        normalizedName: "resveratrol",
        unit: "mg"
      },
      {
        amount: "50",
        amountMg: 50,
        amountValue: 50,
        blendContext: "Proprietary blend",
        displayName: "Fisetin",
        normalizedName: "fisetin",
        unit: "mg"
      }
    ]);
  });

  it("normalizes metric label amounts and source-known vitamin IU without converting source-unknown IU", () => {
    const ingredients = parseLabelIngredients(
      "Creatine 2 g\nSelenium 250 mcg\nVitamin D 400 IU\nVitamin A 2,500 IU (retinol)\nVitamin E 100 IU (dl-alpha-tocopherol)\nFolate 680 mcg DFE (400 mcg folic acid)\nNiacin 16 mg NE"
    );

    expect(ingredients[0]).toMatchObject({ amountMg: 2000, amountValue: 2, unit: "g" });
    expect(ingredients[1]).toMatchObject({ amountMg: 0.25, amountValue: 250, unit: "mcg" });
    expect(ingredients[2]).toMatchObject({
      amountConversion: {
        basis: "Vitamin D IU converted using 1 IU = 0.025 mcg vitamin D.",
        sourceLabel: "NIH ODS/USDA DSID unit conversions"
      },
      amountMg: 0.01,
      amountMetricUnit: "mg vitamin D",
      amountValue: 400,
      normalizedName: "vitamin d",
      unit: "IU"
    });
    expect(parseLabelIngredients("Vitamin D3 25 mcg")[0]).toMatchObject({
      amountConversion: {
        basis: "Vitamin D mcg preserved as vitamin D for normalized metric display.",
        sourceLabel: "NIH ODS Vitamin D fact sheet"
      },
      amountMg: 0.025,
      amountMetricUnit: "mg vitamin D",
      amountValue: 25,
      normalizedName: "vitamin d",
      unit: "mcg"
    });
    expect(ingredients[3]).toMatchObject({
      amountConversion: {
        basis: "Vitamin A IU converted using 1 IU retinol = 0.3 mcg RAE.",
        sourceLabel: "NIH ODS Vitamin A fact sheet"
      },
      amountMg: 0.75,
      amountMetricUnit: "mg RAE",
      amountValue: 2500,
      normalizedName: "vitamin a",
      unit: "IU"
    });
    expect(ingredients[4]).toMatchObject({
      amountConversion: {
        basis:
          "Vitamin E IU converted using 1 IU synthetic vitamin E = 0.45 mg alpha-tocopherol.",
        sourceLabel: "NIH ODS Vitamin E fact sheet"
      },
      amountMg: 45,
      amountMetricUnit: "mg alpha-tocopherol",
      amountValue: 100,
      normalizedName: "vitamin e",
      unit: "IU"
    });
    expect(ingredients[5]).toMatchObject({
      amountConversion: {
        basis:
          "Folate DFE preserved as dietary folate equivalents; 1 mcg DFE = 1 mcg food folate or 0.6 mcg folic acid from fortified foods or supplements consumed with food.",
        sourceLabel: "NIH ODS Folate fact sheet"
      },
      amountMg: 0.68,
      amountMetricUnit: "mg DFE",
      amountUnitLabel: "mcg DFE",
      amountValue: 680,
      normalizedName: "folate",
      unit: "mcg"
    });
    expect(ingredients[6]).toMatchObject({
      amountConversion: {
        basis:
          "Niacin NE preserved as niacin equivalents; 1 NE = 1 mg niacin or 60 mg tryptophan.",
        sourceLabel: "NIH ODS Niacin fact sheet"
      },
      amountMg: 16,
      amountMetricUnit: "mg NE",
      amountUnitLabel: "mg NE",
      amountValue: 16,
      normalizedName: "niacin",
      unit: "mg"
    });
    expect(parseLabelIngredients("Vitamin A 900 mcg RAE")[0]).toMatchObject({
      amountConversion: {
        basis:
          "Vitamin A RAE preserved as retinol activity equivalents, the current vitamin A equivalent-unit label.",
        sourceLabel: "NIH ODS Vitamin A fact sheet"
      },
      amountMg: 0.9,
      amountMetricUnit: "mg RAE",
      amountUnitLabel: "mcg RAE",
      amountValue: 900,
      normalizedName: "vitamin a",
      unit: "mcg"
    });
    expect(parseLabelIngredients("Vitamin A 900 mcg")[0]).toMatchObject({
      amountMg: 0.9,
      amountValue: 900,
      normalizedName: "vitamin a",
      unit: "mcg"
    });
    expect(parseLabelIngredients("Vitamin A 900 mcg")[0]).not.toHaveProperty(
      "amountMetricUnit"
    );
    expect(parseLabelIngredients("Vitamin E 15 mg (as d-alpha-tocopherol)")[0])
      .toMatchObject({
        amountConversion: {
          basis:
            "Vitamin E alpha-tocopherol preserved as the NIH ODS vitamin E amount basis.",
          sourceLabel: "NIH ODS Vitamin E fact sheet"
        },
        amountMg: 15,
        amountMetricUnit: "mg alpha-tocopherol",
        amountUnitLabel: "mg alpha-tocopherol",
        amountValue: 15,
        normalizedName: "vitamin e",
        unit: "mg"
      });
    expect(parseLabelIngredients("Vitamin E 15 mg")[0]).toMatchObject({
      amountMg: 15,
      amountValue: 15,
      normalizedName: "vitamin e",
      unit: "mg"
    });
    expect(parseLabelIngredients("Vitamin E 15 mg")[0]).not.toHaveProperty(
      "amountMetricUnit"
    );
    expect(parseLabelIngredients("Vitamin A 5,000 IU")[0]).toMatchObject({
      amountValue: 5000,
      normalizedName: "vitamin a",
      unit: "IU"
    });
    expect(parseLabelIngredients("Vitamin A 5,000 IU")[0]).not.toHaveProperty("amountMg");
    expect(parseLabelIngredients("Beta-carotene 10,000 IU")[0]).toMatchObject({
      amountConversion: {
        basis:
          "Vitamin A IU converted using 1 IU supplemental beta-carotene = 0.3 mcg RAE.",
        sourceLabel: "NIH ODS Vitamin A fact sheet"
      },
      amountMg: 3,
      amountMetricUnit: "mg RAE",
      amountValue: 10000,
      normalizedName: "beta carotene",
      unit: "IU"
    });
    expect(parseLabelIngredients("Vitamin A 10,000 IU (as dietary beta-carotene from food)")[0])
      .toMatchObject({
        amountConversion: {
          basis:
            "Vitamin A IU converted using 1 IU dietary beta-carotene = 0.05 mcg RAE.",
          sourceLabel: "NIH ODS Vitamin A fact sheet"
        },
        amountMg: 0.5,
        amountMetricUnit: "mg RAE",
        amountValue: 10000,
        normalizedName: "vitamin a",
        unit: "IU"
      });
    expect(parseLabelIngredients("Vitamin A 40,000 IU (as dietary alpha-carotene from food)")[0])
      .toMatchObject({
        amountConversion: {
          basis:
            "Vitamin A IU converted using 1 IU dietary alpha-carotene or beta-cryptoxanthin = 0.025 mcg RAE.",
          sourceLabel: "NIH ODS Vitamin A fact sheet"
        },
        amountMg: 1,
        amountMetricUnit: "mg RAE",
        amountValue: 40000,
        normalizedName: "vitamin a",
        unit: "IU"
      });
    expect(parseLabelIngredients("Alpha-carotene 5,000 IU")[0]).toMatchObject({
      amountValue: 5000,
      normalizedName: "alpha carotene",
      unit: "IU"
    });
    expect(parseLabelIngredients("Alpha-carotene 5,000 IU")[0]).not.toHaveProperty(
      "amountMg"
    );
    expect(parseLabelIngredients("Vitamin E 400 IU")[0]).toMatchObject({
      amountValue: 400,
      normalizedName: "vitamin e",
      unit: "IU"
    });
    expect(parseLabelIngredients("Vitamin E 400 IU")[0]).not.toHaveProperty("amountMg");
    expect(parseLabelIngredients("Vitamin E 400 IU (mixed tocopherols)")[0])
      .not.toHaveProperty("amountMg");
    expect(parseLabelIngredients("Folate 680 mcg")[0]).toMatchObject({
      amountMg: 0.68,
      amountValue: 680,
      normalizedName: "folate",
      unit: "mcg"
    });
    expect(parseLabelIngredients("Folate 680 mcg")[0]).not.toHaveProperty("amountMetricUnit");
    expect(parseLabelIngredients("Niacin 16 mg")[0]).toMatchObject({
      amountMg: 16,
      amountValue: 16,
      normalizedName: "niacin",
      unit: "mg"
    });
    expect(parseLabelIngredients("Niacin 16 mg")[0]).not.toHaveProperty("amountMetricUnit");
  });

  it("captures visible AUST label identifiers without verifying product status", () => {
    expect(parseLabelProductIdentifiers("Joint support medicine AUST L(A) 123456"))
      .toEqual([
        {
          identifier: "123456",
          kind: "AUST L(A)",
          label: "AUST L(A) 123456"
        }
      ]);
  });

  it("captures recognized label certifications as product-quality cues", () => {
    expect(
      parseLabelCertifications(
        "NSF Certified for Sport\nInformed Sport\nUSP Verified\nHASTA Certified"
      )
    ).toEqual([
      {
        id: "nsf-certified-for-sport",
        label: "NSF Certified for Sport",
        note:
          "Treat as a product-quality and sport-contamination screening cue only after verifying the exact product certificate.",
        signal: "Sport-contamination screening"
      },
      {
        id: "informed-sport",
        label: "Informed Sport",
        note:
          "Treat as a sport-contamination screening cue only after verifying the exact product certificate.",
        signal: "Sport-contamination screening"
      },
      {
        id: "usp-verified",
        label: "USP Verified",
        note:
          "Treat as a product-quality verification cue only after verifying the exact product listing.",
        signal: "Product-quality verification"
      },
      {
        id: "hasta",
        label: "HASTA",
        note:
          "Treat as a sport-contamination screening cue only after verifying the exact product certificate.",
        signal: "Sport-contamination screening"
      }
    ]);
    expect(parseLabelCertifications("NSF Certified for Sport\nNSF Certified for Sport"))
      .toHaveLength(1);
    expect(parseLabelCertifications("No third-party testing shown")).toEqual([]);
  });

  it("assesses pasted-label product quality without merging efficacy or AU/TGA status", () => {
    expect(
      assessLabelProductQuality(
        "Creatine monohydrate 5 g\nVitamin D3 400 IU\nNSF Certified for Sport\nNo proprietary blend"
      )
    ).toEqual({
      caveats: [
        "This heuristic product-quality score only summarizes parsed label cues; verify exact product certificates, batch testing, manufacturing records, and label source before relying on it.",
        "Product quality, efficacy evidence, and AU/TGA/ARTG status remain separate."
      ],
      positiveSignals: [
        "Recognized certification signal captured: NSF Certified for Sport.",
        "All parsed ingredient rows include captured amounts."
      ],
      reviewFlags: [],
      score: 8,
      signal: "Higher quality signal"
    });

    expect(
      assessLabelProductQuality(
        "Proprietary blend: Magnesium glycinate 100 mg\nMagnesium glycinate 50 mg\nVitamin E 400 IU"
      )
    ).toMatchObject({
      positiveSignals: ["All parsed ingredient rows include captured amounts."],
      reviewFlags: expect.arrayContaining([
        "Proprietary blend language can obscure ingredient-level exposure.",
        "Duplicate ingredient rows need total-exposure review: Magnesium glycinate.",
        "1 parsed amount uses unsupported or unconverted non-metric units."
      ]),
      score: 2,
      signal: "Needs quality review"
    });

    expect(assessLabelProductQuality("")).toMatchObject({
      reviewFlags: ["No label text was provided for product-quality review."],
      score: 0,
      signal: "Needs quality review"
    });
  });

  it("does not flag a negated proprietary blend statement", () => {
    const findings = analyzeLabel("Creatine monohydrate 5 g\nNo proprietary blend\nNSF Certified for Sport");

    expect(findings.map((finding) => finding.id)).toEqual(["certification"]);
    expect(findings[0]).toMatchObject({ sourceLabel: "Heuristic check" });
    expect(findings[0]?.detail).toContain("NSF Certified for Sport");
  });

  it("flags duplicate ingredient listings without calculating use guidance", () => {
    const findings = analyzeLabel("Magnesium glycinate 100 mg\nMagnesium Glycinate 50 mg");

    expect(findings.find((finding) => finding.id === "duplicate-ingredient")).toMatchObject({
      level: "moderate",
      sourceLabel: "Heuristic check"
    });
    expect(findings.find((finding) => finding.id === "duplicate-ingredient")?.detail)
      .toContain("review total captured amounts");
  });

  it("flags non-metric units as amount-comparison caveats", () => {
    const findings = analyzeLabel("Vitamin E 400 IU");

    expect(findings.find((finding) => finding.id === "non-metric-unit")).toMatchObject({
      level: "low",
      sourceLabel: "Heuristic check"
    });
    expect(findings.find((finding) => finding.id === "non-metric-unit")?.detail)
      .toContain("not directly comparable with mg/g");
    expect(analyzeLabel("Vitamin D 400 IU").map((finding) => finding.id))
      .not.toContain("non-metric-unit");
  });

  it("flags serving-to-daily dose review when directions can change amount interpretation", () => {
    const findings = analyzeLabel(
      "Serving size: 2 capsules\nVitamin B6 6 mg per capsule\nTake 1 capsule twice daily"
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail:
            "Serving-size, per-unit, or daily-use text suggests ingredient amounts may need serving-basis or daily-dose review before comparing against upper limits or scoped claim doses.",
          id: "serving-dose-review",
          level: "low",
          sourceLabel: "Heuristic check"
        })
      ])
    );
    expect(analyzeLabel("Serving size: 1 scoop\nCreatine 5 g").map((finding) => finding.id))
      .not.toContain("serving-dose-review");
  });

  it("flags high vitamin D amounts from normalized parsed units", () => {
    expect(analyzeLabel("Vitamin D3 25 mcg").map((finding) => finding.id))
      .not.toContain("high-vitamin-d");

    for (const label of [
      "Vitamin D3 125 mcg",
      "Vitamin D 4,000 IU",
      "Vitamin D3 50 mcg\nCholecalciferol 60 mcg"
    ]) {
      const finding = analyzeLabel(label).find(
        (candidate) => candidate.id === "high-vitamin-d"
      );

      expect(finding).toMatchObject({
        detail:
          "Vitamin D amount is at or above the 100 mcg (4,000 IU) adult upper-limit threshold and needs review against total intake, age context, deficiency status, and safety limits.",
        level: "moderate",
        sourceLabel: "NIH ODS vitamin D",
        sourceUrl: "https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/"
      });
    }
  });

  it("flags high vitamin A only when the preformed or RAE review context is visible", () => {
    for (const label of [
      "Vitamin A 3,000 mcg RAE",
      "Vitamin A 10,000 IU (as retinyl palmitate)",
      "Vitamin A 3,000 mcg (as retinol)",
      "Vitamin A 1,500 mcg RAE\nRetinyl palmitate 1,500 mcg"
    ]) {
      const finding = analyzeLabel(label).find(
        (candidate) => candidate.id === "high-vitamin-a"
      );

      expect(finding).toMatchObject({
        detail:
          "Vitamin A amount is at or above the 3,000 mcg RAE adult upper-limit threshold for preformed vitamin A. Review the retinol/retinyl versus provitamin A split before treating the label as a safety match.",
        level: "moderate",
        sourceLabel: "NIH ODS vitamin A",
        sourceUrl: "https://ods.od.nih.gov/factsheets/VitaminA-HealthProfessional/"
      });
    }

    expect(analyzeLabel("Vitamin A 10,000 IU (as supplemental beta-carotene)")
      .map((finding) => finding.id))
      .not.toContain("high-vitamin-a");
    expect(analyzeLabel("Vitamin A 3,000 mcg RAE (as alpha-carotene)")
      .map((finding) => finding.id))
      .not.toContain("high-vitamin-a");
    expect(analyzeLabel("Vitamin A 3,000 mcg RAE (as beta-cryptoxanthin from food)")
      .map((finding) => finding.id))
      .not.toContain("high-vitamin-a");
    expect(analyzeLabel("Vitamin A 1,500 mcg\nVitamin A 1,600 mcg")
      .map((finding) => finding.id))
      .not.toContain("high-vitamin-a");
  });

  it("flags high vitamin E amounts from normalized parsed alpha-tocopherol units", () => {
    expect(analyzeLabel("Vitamin E 15 mg").map((finding) => finding.id))
      .not.toContain("high-vitamin-e");

    for (const label of [
      "Vitamin E 1,000 mg (as d-alpha-tocopherol)",
      "Vitamin E 1,500 IU (as d-alpha-tocopherol)",
      "Vitamin E 600 mg (as d-alpha-tocopherol)\nVitamin E 500 mg (as dl-alpha-tocopherol)"
    ]) {
      const finding = analyzeLabel(label).find(
        (candidate) => candidate.id === "high-vitamin-e"
      );

      expect(finding).toMatchObject({
        detail:
          "Vitamin E amount is at or above the 1,000 mg adult upper-limit threshold for supplemental alpha-tocopherol. Review the natural/synthetic, esterified, mixed tocopherol, and tocotrienol form before treating the label as a safety match.",
        level: "moderate",
        sourceLabel: "NIH ODS vitamin E",
        sourceUrl: "https://ods.od.nih.gov/factsheets/VitaminE-HealthProfessional/"
      });
    }
  });

  it("flags high vitamin C amounts from parsed supplemental label units", () => {
    expect(analyzeLabel("Vitamin C 500 mg").map((finding) => finding.id))
      .not.toContain("high-vitamin-c");

    for (const label of [
      "Vitamin C 2,000 mg",
      "Ascorbic acid 2 g",
      "Sodium ascorbate 1,000 mg\nCalcium ascorbate 1,000 mg"
    ]) {
      const finding = analyzeLabel(label).find(
        (candidate) => candidate.id === "high-vitamin-c"
      );

      expect(finding).toMatchObject({
        detail:
          "Vitamin C amount is at or above the 2,000 mg adult upper-limit threshold. Review total supplemental exposure, gastrointestinal tolerability, kidney-stone or renal context, iron-overload context, and vitamin C form before treating the label as a safety match.",
        level: "moderate",
        sourceLabel: "NIH ODS vitamin C",
        sourceUrl: "https://ods.od.nih.gov/factsheets/VitaminC-HealthProfessional/"
      });
    }
  });

  it("flags high folic acid only when synthetic-folate upper-limit context is visible", () => {
    for (const label of [
      "Folic Acid 1,000 mcg",
      "Folate 1,667 mcg DFE (1,000 mcg folic acid)",
      "Folic Acid 600 mcg\nFolic Acid 500 mcg",
      "Folate 850 mcg DFE (500 mcg folic acid)\nFolate 850 mcg DFE (500 mcg folic acid)"
    ]) {
      const finding = analyzeLabel(label).find(
        (candidate) => candidate.id === "high-folic-acid"
      );

      expect(finding).toMatchObject({
        detail:
          "Folic acid amount is at or above the 1,000 mcg adult upper-limit threshold for synthetic folate from supplements or fortified foods. Review total folic-acid exposure, vitamin B12 context, age/pregnancy context, medical-supervision context, and folate form before treating the label as a safety match.",
        level: "moderate",
        sourceLabel: "NIH ODS folate",
        sourceUrl: "https://ods.od.nih.gov/factsheets/Folate-HealthProfessional/"
      });
    }

    for (const label of [
      "Folate 680 mcg DFE (400 mcg folic acid)",
      "Folate 1,667 mcg DFE (as 5-MTHF)",
      "Folate 1,667 mcg DFE"
    ]) {
      expect(analyzeLabel(label).map((finding) => finding.id))
        .not.toContain("high-folic-acid");
    }
  });

  it("flags high niacin amounts from parsed supplemental label units", () => {
    expect(analyzeLabel("Niacin 16 mg NE").map((finding) => finding.id))
      .not.toContain("high-niacin");

    for (const label of [
      "Niacin 35 mg NE",
      "Niacinamide 50 mg",
      "Nicotinic acid 500 mg sustained release",
      "Niacinamide 20 mg\nNicotinic acid 20 mg"
    ]) {
      const finding = analyzeLabel(label).find(
        (candidate) => candidate.id === "high-niacin"
      );

      expect(finding).toMatchObject({
        detail:
          "Niacin amount is at or above the 35 mg adult upper-limit threshold for supplemental niacin. Review nicotinic-acid versus niacinamide/nicotinamide form, extended-release or flush-free wording, medical-supervision context, and total intake before treating the label as a safety match.",
        level: "moderate",
        sourceLabel: "NIH ODS niacin",
        sourceUrl: "https://ods.od.nih.gov/factsheets/Niacin-HealthProfessional/"
      });
    }

    expect(analyzeLabel("Nicotinamide riboside 300 mg").map((finding) => finding.id))
      .not.toContain("high-niacin");
  });

  it("flags mineral upper-limit review warnings from parsed metric units", () => {
    expect(analyzeLabel("Magnesium glycinate 200 mg").map((finding) => finding.id))
      .not.toContain("high-magnesium");
    expect(analyzeLabel("Zinc 15 mg").map((finding) => finding.id))
      .not.toContain("high-zinc");
    expect(analyzeLabel("Selenium 55 mcg").map((finding) => finding.id))
      .not.toContain("high-selenium");
    expect(analyzeLabel("Calcium citrate 1,200 mg").map((finding) => finding.id))
      .not.toContain("high-calcium");
    expect(analyzeLabel("Iron 18 mg").map((finding) => finding.id))
      .not.toContain("high-iron");
    expect(analyzeLabel("Copper 2 mg").map((finding) => finding.id))
      .not.toContain("high-copper");
    expect(analyzeLabel("Manganese 2 mg").map((finding) => finding.id))
      .not.toContain("high-manganese");
    expect(analyzeLabel("Molybdenum 45 mcg").map((finding) => finding.id))
      .not.toContain("high-molybdenum");
    expect(analyzeLabel("Phosphorus 700 mg").map((finding) => finding.id))
      .not.toContain("high-phosphorus");
    expect(analyzeLabel("Iodine 150 mcg").map((finding) => finding.id))
      .not.toContain("high-iodine");

    for (const label of [
      "Magnesium glycinate 350 mg",
      "Magnesium glycinate 200 mg\nMagnesium citrate 200 mg"
    ]) {
      expect(analyzeLabel(label)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            detail:
              "Magnesium amount is at or above the 350 mg adult upper-limit threshold for supplemental magnesium from dietary supplements or medications. Review total supplemental exposure, laxative/antacid context, kidney-risk context, and magnesium form before treating the label as a safety match.",
            id: "high-magnesium",
            level: "moderate",
            sourceLabel: "NIH ODS magnesium",
            sourceUrl: "https://ods.od.nih.gov/factsheets/Magnesium-HealthProfessional/"
          })
        ])
      );
    }
    expect(analyzeLabel("Zinc gluconate 40 mg")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail:
            "Zinc amount is at or above the 40 mg adult upper-limit threshold. Review total zinc exposure, denture-cream or lozenge context, copper-status context, duration, and zinc form before treating the label as a safety match.",
          id: "high-zinc",
          level: "moderate",
          sourceLabel: "NIH ODS zinc",
          sourceUrl: "https://ods.od.nih.gov/factsheets/Zinc-HealthProfessional/"
        })
      ])
    );
    expect(analyzeLabel("Zinc picolinate 25 mg\nZinc gluconate 20 mg")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail:
            "Zinc amount is at or above the 40 mg adult upper-limit threshold. Review total zinc exposure, denture-cream or lozenge context, copper-status context, duration, and zinc form before treating the label as a safety match.",
          id: "high-zinc",
          level: "moderate",
          sourceLabel: "NIH ODS zinc",
          sourceUrl: "https://ods.od.nih.gov/factsheets/Zinc-HealthProfessional/"
        })
      ])
    );
    expect(analyzeLabel("Selenomethionine 400 mcg")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail:
            "Selenium amount is at or above the 400 mcg adult upper-limit threshold. Review total intake, chronic-exposure context, selenium form, and toxicity-signal context before treating the label as a safety match.",
          id: "high-selenium",
          level: "moderate",
          sourceLabel: "NIH ODS selenium",
          sourceUrl: "https://ods.od.nih.gov/factsheets/Selenium-HealthProfessional/"
        })
      ])
    );
    expect(analyzeLabel("Selenium 200 mcg\nSelenomethionine 250 mcg")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail:
            "Selenium amount is at or above the 400 mcg adult upper-limit threshold. Review total intake, chronic-exposure context, selenium form, and toxicity-signal context before treating the label as a safety match.",
          id: "high-selenium",
          level: "moderate",
          sourceLabel: "NIH ODS selenium",
          sourceUrl: "https://ods.od.nih.gov/factsheets/Selenium-HealthProfessional/"
        })
      ])
    );
    expect(analyzeLabel("Calcium carbonate 2,000 mg")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail:
            "Calcium amount is at or above the 2,000 mg lower adult upper-limit threshold. Review total dietary plus supplemental calcium, age context, kidney-stone context, vitamin D co-exposure, and elemental-versus-compound amount before treating the label as a safety match.",
          id: "high-calcium",
          level: "moderate",
          sourceLabel: "NIH ODS calcium",
          sourceUrl: "https://ods.od.nih.gov/factsheets/Calcium-HealthProfessional/"
        })
      ])
    );
    expect(analyzeLabel("Calcium citrate 1,000 mg\nCalcium carbonate 1,200 mg")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail:
            "Calcium amount is at or above the 2,000 mg lower adult upper-limit threshold. Review total dietary plus supplemental calcium, age context, kidney-stone context, vitamin D co-exposure, and elemental-versus-compound amount before treating the label as a safety match.",
          id: "high-calcium",
          level: "moderate",
          sourceLabel: "NIH ODS calcium",
          sourceUrl: "https://ods.od.nih.gov/factsheets/Calcium-HealthProfessional/"
        })
      ])
    );
    expect(analyzeLabel("Iron 45 mg")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail:
            "Iron amount is at or above the 45 mg adult upper-limit threshold. Review elemental iron versus salt/compound amount, deficiency-treatment or medical-supervision context, iron-overload risk, medication interactions, and total intake before treating the label as a safety match.",
          id: "high-iron",
          level: "moderate",
          sourceLabel: "NIH ODS iron",
          sourceUrl: "https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/"
        })
      ])
    );
    expect(analyzeLabel("Ferrous sulfate 25 mg\nIron bisglycinate 25 mg")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail:
            "Iron amount is at or above the 45 mg adult upper-limit threshold. Review elemental iron versus salt/compound amount, deficiency-treatment or medical-supervision context, iron-overload risk, medication interactions, and total intake before treating the label as a safety match.",
          id: "high-iron",
          level: "moderate",
          sourceLabel: "NIH ODS iron",
          sourceUrl: "https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/"
        })
      ])
    );
    expect(analyzeLabel("Copper gluconate 10 mg")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail:
            "Copper amount is at or above the 10 mg adult upper-limit threshold. Review total copper exposure, copper form, liver-risk context, zinc co-exposure, and medical-supervision context before treating the label as a safety match.",
          id: "high-copper",
          level: "moderate",
          sourceLabel: "NIH ODS copper",
          sourceUrl: "https://ods.od.nih.gov/factsheets/Copper-HealthProfessional/"
        })
      ])
    );
    expect(analyzeLabel("Cupric sulfate 5 mg\nCopper glycinate 5 mg")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail:
            "Copper amount is at or above the 10 mg adult upper-limit threshold. Review total copper exposure, copper form, liver-risk context, zinc co-exposure, and medical-supervision context before treating the label as a safety match.",
          id: "high-copper",
          level: "moderate",
          sourceLabel: "NIH ODS copper",
          sourceUrl: "https://ods.od.nih.gov/factsheets/Copper-HealthProfessional/"
        })
      ])
    );
    expect(analyzeLabel("Manganese 11 mg")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail:
            "Manganese amount is at or above the 11 mg adult upper-limit threshold. Review total manganese exposure, liver-risk context, iron-status context, source form, and medical-supervision context before treating the label as a safety match.",
          id: "high-manganese",
          level: "moderate",
          sourceLabel: "NIH ODS manganese",
          sourceUrl: "https://ods.od.nih.gov/factsheets/Manganese-HealthProfessional/"
        })
      ])
    );
    expect(analyzeLabel("Manganese citrate 6 mg\nManganous sulfate 5 mg")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail:
            "Manganese amount is at or above the 11 mg adult upper-limit threshold. Review total manganese exposure, liver-risk context, iron-status context, source form, and medical-supervision context before treating the label as a safety match.",
          id: "high-manganese",
          level: "moderate",
          sourceLabel: "NIH ODS manganese",
          sourceUrl: "https://ods.od.nih.gov/factsheets/Manganese-HealthProfessional/"
        })
      ])
    );
    for (const label of [
      "Molybdenum 2,000 mcg",
      "Sodium molybdate 2 mg",
      "Molybdenum glycinate 1,000 mcg\nMolybdate 1,000 mcg"
    ]) {
      expect(analyzeLabel(label)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            detail:
              "Molybdenum amount is at or above the 2,000 mcg adult upper-limit threshold. Review total molybdenum exposure, supplement form such as molybdate, gout-like or uric-acid context, copper-status context, and medical-supervision context before treating the label as a safety match.",
            id: "high-molybdenum",
            level: "moderate",
            sourceLabel: "NIH ODS molybdenum",
            sourceUrl: "https://ods.od.nih.gov/factsheets/Molybdenum-HealthProfessional/"
          })
        ])
      );
    }
    for (const label of [
      "Phosphorus 3,000 mg",
      "Sodium phosphate 3 g",
      "Dipotassium phosphate 1,500 mg\nPhosphatidylserine 1,500 mg"
    ]) {
      expect(analyzeLabel(label)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            detail:
              "Phosphorus or phosphate-source amount is at or above the 3,000 mg lower adult upper-limit threshold. Review total dietary plus supplemental phosphorus, phosphate salt or additive context, kidney-risk context, calcium balance, and medical-supervision context before treating the label as a safety match.",
            id: "high-phosphorus",
            level: "moderate",
            sourceLabel: "NIH ODS phosphorus",
            sourceUrl: "https://ods.od.nih.gov/factsheets/Phosphorus-HealthProfessional/"
          })
        ])
      );
    }
    expect(analyzeLabel("Iodine 1,100 mcg")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail:
            "Parsed iodine or iodide-source amount is at or above the 1,100 mcg adult iodine upper-limit threshold. Verify elemental iodine when the label lists a salt, kelp, or seaweed source, then review total iodine exposure, thyroid context, pregnancy/lactation context, source variability, and medical-supervision context before treating the label as a safety match.",
          id: "high-iodine",
          level: "moderate",
          sourceLabel: "NIH ODS iodine",
          sourceUrl: "https://ods.od.nih.gov/factsheets/Iodine-HealthProfessional/"
        })
      ])
    );
    expect(analyzeLabel("Iodine 600 mcg\nIodine 600 mcg")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail:
            "Parsed iodine or iodide-source amount is at or above the 1,100 mcg adult iodine upper-limit threshold. Verify elemental iodine when the label lists a salt, kelp, or seaweed source, then review total iodine exposure, thyroid context, pregnancy/lactation context, source variability, and medical-supervision context before treating the label as a safety match.",
          id: "high-iodine",
          level: "moderate",
          sourceLabel: "NIH ODS iodine",
          sourceUrl: "https://ods.od.nih.gov/factsheets/Iodine-HealthProfessional/"
        })
      ])
    );
    expect(analyzeLabel("Potassium iodide 1.1 mg")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "high-iodine",
          level: "moderate",
          sourceLabel: "NIH ODS iodine"
        })
      ])
    );
    expect(analyzeLabel("Kelp iodine 600 mcg\nSodium iodide 600 mcg")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "high-iodine",
          level: "moderate",
          sourceLabel: "NIH ODS iodine"
        })
      ])
    );
  });

  it("parses serving and daily-dose direction cues without applying dose arithmetic", () => {
    expect(
      parseLabelDoseCues(
        "Serving size: 2 capsules\nVitamin B6 6 mg per capsule\nTake 1 capsule twice daily"
      )
    ).toEqual([
      {
        count: 2,
        id: "serving-size:serving size: 2 capsules",
        kind: "serving-size",
        label: "Serving size: 2 capsules",
        note:
          "Serving-size text was parsed as a cue only; ingredient amounts still need label-basis review before daily-dose comparison.",
        unit: "capsules"
      },
      {
        count: 1,
        dailyUnitCount: 2,
        id: "daily-directions:take 1 capsule twice daily",
        kind: "daily-directions",
        label: "Take 1 capsule twice daily",
        note:
          "Daily-use directions were parsed as a cue only; verify whether ingredient amounts are per unit, per serving, or per daily dose before safety or efficacy matching.",
        unit: "capsules"
      },
      {
        count: 1,
        id: "per-unit-amount:per capsule",
        kind: "per-unit-amount",
        label: "per capsule",
        note:
          "Per-unit amount language was parsed as a cue only; combine with serving directions before daily-dose or upper-limit review.",
        unit: "capsules"
      }
    ]);

    expect(parseLabelIngredients("Vitamin B6 6 mg per capsule")[0]).toMatchObject({
      amountMg: 6,
      normalizedName: "vitamin b6"
    });
  });

  it("flags high choline amounts from parsed metric label units", () => {
    expect(analyzeLabel("Choline 550 mg").map((finding) => finding.id))
      .not.toContain("high-choline");

    for (const label of [
      "Choline 3,500 mg",
      "Choline bitartrate 3.5 g",
      "Phosphatidylcholine 2,000 mg\nLecithin 1,500 mg"
    ]) {
      const finding = analyzeLabel(label).find(
        (candidate) => candidate.id === "high-choline"
      );

      expect(finding).toMatchObject({
        detail:
          "Choline or choline-source amount is at or above the 3,500 mg adult upper-limit threshold. Review total dietary plus supplemental choline, choline-equivalent versus compound amount, source form such as choline bitartrate, phosphatidylcholine, or lecithin, hypotension or liver-risk context, fishy-body-odor/TMAO context, and medical-supervision context before treating the label as a safety match.",
        level: "moderate",
        sourceLabel: "NIH ODS choline",
        sourceUrl: "https://ods.od.nih.gov/factsheets/Choline-HealthProfessional/"
      });
    }
  });

  it("flags vitamin B6 labels that need AU/TGA warning review", () => {
    expect(analyzeLabel("Vitamin B6 10 mg").map((finding) => finding.id))
      .not.toContain("vitamin-b6-tga-warning-review");

    for (const label of [
      "Vitamin B6 11 mg",
      "Pyridoxine hydrochloride 20 mg",
      "Pyridoxal 5-phosphate 15 mg",
      "Pyridoxamine 6 mg\nVitamin B6 5 mg"
    ]) {
      expect(analyzeLabel(label)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            detail:
              "Vitamin B6 amount is above the 10 mg TGA daily-dose label-warning threshold. Review pyridoxine/pyridoxal/pyridoxamine forms, total multi-product exposure, serving-to-daily-dose directions, neuropathy warning language, and product-level ARTG/AUST context before treating the label as Australia-ready.",
            id: "vitamin-b6-tga-warning-review",
            level: "moderate",
            sourceLabel: "TGA vitamin B6 safety update",
            sourceUrl:
              "https://www.tga.gov.au/news/safety-updates/medicines-containing-vitamin-b6-pyridoxine-pyridoxal-or-pyridoxamine"
          })
        ])
      );
    }
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
