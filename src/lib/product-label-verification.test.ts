import { describe, expect, it } from "vitest";

import type { ParsedAustraliaRegulatoryIdentifierVerification } from "@/lib/australia-regulatory-verification";
import { buildProductLabelVerificationSummary } from "@/lib/product-label-verification";
import type { ProductSignal } from "@/lib/types";

const demoProduct: ProductSignal = {
  brand: "Demo profile",
  certifications: ["NSF Certified for Sport"],
  id: "seed-creatine-product",
  ingredients: ["Creatine monohydrate"],
  labelClaimRiskScore: 2,
  name: "Creatine monohydrate powder",
  proprietaryBlend: false,
  qualityScore: 8,
  region: "AU verification pending"
};

const reviewedProduct: ProductSignal = {
  brand: "Example Brand",
  certifications: [],
  id: "reviewed-product",
  ingredients: ["Magnesium glycinate"],
  labelClaimRiskScore: 3,
  name: "Magnesium Glycinate Plus",
  proprietaryBlend: false,
  qualityScore: 7,
  region: "AU"
};

describe("buildProductLabelVerificationSummary", () => {
  it("treats unmatched pasted label text as unverified", () => {
    expect(
      buildProductLabelVerificationSummary({
        labelText: "Creatine monohydrate 5 g\nNSF Certified for Sport",
        parsedProductIdentifierVerifications: [],
        productSignals: [demoProduct]
      })
    ).toEqual({
      detail:
        "No local product profile or product-level AUST identifier match was found for the pasted label.",
      evidence: ["Pasted label text is being analyzed as a standalone, unverified label."],
      nextAction:
        "Capture the exact product name, brand, label source, and product-level ARTG/AUST record before treating it as verified.",
      status: "pasted-label-only",
      statusLabel: "Pasted label only - not verified product recommendation"
    });
  });

  it("labels local demo product profile matches as demo-only", () => {
    expect(
      buildProductLabelVerificationSummary({
        labelText: "Creatine monohydrate powder\nCreatine monohydrate 5 g",
        parsedProductIdentifierVerifications: [],
        productSignals: [demoProduct]
      })
    ).toMatchObject({
      detail:
        "The pasted label matches a local demo product profile. Demo profiles are review fixtures, not verified product recommendations.",
      evidence: [
        "Pasted label text contains local demo product profile name Creatine monohydrate powder."
      ],
      matchedProductId: "seed-creatine-product",
      status: "local-demo-profile-match",
      statusLabel: "Local demo profile match - not verified product recommendation"
    });
  });

  it("labels local product profile matches with limited AU/TGA status as limited cues", () => {
    expect(
      buildProductLabelVerificationSummary({
        labelText: "Magnesium Glycinate Plus\nMagnesium glycinate 300 mg",
        parsedProductIdentifierVerifications: [],
        productAustraliaVerificationById: new Map([
          [
            "reviewed-product",
            {
              confidence: "Low",
              isStale: false,
              nextAction:
                "Keep the captured product-level source linked, but do not treat this status as verified Australian market authorisation or product efficacy evidence.",
              productBrand: "Example Brand",
              productId: "reviewed-product",
              productName: "Magnesium Glycinate Plus",
              state: "Captured",
              stateLabel: "Product-level status captured"
            }
          ]
        ]),
        productSignals: [reviewedProduct]
      })
    ).toEqual({
      detail:
        "The pasted label text resembles a local product profile by name, but the local product AU/TGA status is not currently verified. Treat this as a limited profile cue only.",
      evidence: [
        "Pasted label text contains local product profile name Magnesium Glycinate Plus.",
        "Local product status: Product-level status captured; AU confidence Low."
      ],
      matchedProductBrand: "Example Brand",
      matchedProductId: "reviewed-product",
      matchedProductName: "Magnesium Glycinate Plus",
      nextAction:
        "Keep the captured product-level source linked, but do not treat this status as verified Australian market authorisation or product efficacy evidence.",
      status: "local-product-profile-limited-match",
      statusLabel: "Local product profile match with limited AU/TGA status"
    });
  });

  it("labels local product-level AUST identifier matches as verification cues only", () => {
    const identifierMatch: ParsedAustraliaRegulatoryIdentifierVerification = {
      confidence: "Moderate",
      identifier: "123456",
      interventionStatusIds: [],
      kind: "AUST L",
      label: "AUST L 123456",
      matchState: "local-product-match",
      matchStateLabel: "Product-level local match",
      nextAction: "Review exact product record.",
      productBrand: "Example Brand",
      productId: "reviewed-product",
      productName: "Magnesium Glycinate Plus",
      productVerification: {
        confidence: "Moderate",
        isStale: false,
        nextAction:
          "Keep the product-level ARTG/AUST source linked and re-check it on the verification schedule.",
        productBrand: "Example Brand",
        productId: "reviewed-product",
        productName: "Magnesium Glycinate Plus",
        state: "Verified",
        stateLabel: "Product-level status verified"
      }
    };

    expect(
      buildProductLabelVerificationSummary({
        labelText: "Magnesium Glycinate Plus AUST L 123456",
        parsedProductIdentifierVerifications: [identifierMatch],
        productSignals: [reviewedProduct]
      })
    ).toEqual({
      detail:
        "A parsed AUST identifier matched a local product-level record. This is still a verification cue, not proof of product efficacy or a recommendation.",
      evidence: [
        "Parsed identifier AUST L 123456.",
        "Local product: Magnesium Glycinate Plus (Example Brand)."
      ],
      matchedProductBrand: "Example Brand",
      matchedProductId: "reviewed-product",
      matchedProductName: "Magnesium Glycinate Plus",
      nextAction:
        "Review the exact product label, sponsor, formulation, and current ARTG source before treating this pasted label as verified.",
      status: "local-product-aust-match",
      statusLabel: "Local product AUST identifier match"
    });
  });

  it("labels stale product-level AUST identifier matches as limited verification cues", () => {
    const identifierMatch: ParsedAustraliaRegulatoryIdentifierVerification = {
      confidence: "Very low",
      identifier: "123456",
      interventionStatusIds: [],
      kind: "AUST R",
      label: "AUST R 123456",
      matchState: "local-product-match",
      matchStateLabel: "Product-level local match",
      nextAction:
        "Re-check the product-level ARTG/AUST source before relying on this Australian regulatory status.",
      productBrand: "Example Brand",
      productId: "reviewed-product",
      productName: "Magnesium Glycinate Plus",
      productVerification: {
        confidence: "Very low",
        isStale: true,
        nextAction:
          "Re-check the product-level ARTG/AUST source before relying on this Australian regulatory status.",
        productBrand: "Example Brand",
        productId: "reviewed-product",
        productName: "Magnesium Glycinate Plus",
        state: "Stale",
        stateLabel: "Product-level status stale"
      }
    };

    expect(
      buildProductLabelVerificationSummary({
        labelText: "Magnesium Glycinate Plus AUST R 123456",
        parsedProductIdentifierVerifications: [identifierMatch],
        productSignals: [reviewedProduct]
      })
    ).toEqual({
      detail:
        "A parsed AUST identifier matched a local product-level record, but the local product status is not currently verified. Treat this as a limited verification cue, not proof of product efficacy or a recommendation.",
      evidence: [
        "Parsed identifier AUST R 123456.",
        "Local product: Magnesium Glycinate Plus (Example Brand).",
        "Local product status: Product-level status stale; AU confidence Very low."
      ],
      matchedProductBrand: "Example Brand",
      matchedProductId: "reviewed-product",
      matchedProductName: "Magnesium Glycinate Plus",
      nextAction:
        "Re-check the product-level ARTG/AUST source before relying on this Australian regulatory status.",
      status: "local-product-aust-limited-match",
      statusLabel: "Stale local product AUST match - re-check ARTG"
    });
  });

  it("labels intervention-only AUST identifier matches as not product verification", () => {
    const identifierMatch: ParsedAustraliaRegulatoryIdentifierVerification = {
      confidence: "Very low",
      identifier: "123456",
      interventionStatusIds: ["au-reg-magnesium-intervention"],
      kind: "AUST L",
      label: "AUST L 123456",
      matchState: "local-intervention-only-match",
      matchStateLabel: "Only intervention-level status matched",
      nextAction:
        "Do not treat this as product verification. Capture the exact product, sponsor, formulation, and product-level ARTG/AUST record before showing Australian regulatory confidence.",
      status: {
        checkedAt: "2026-06-11",
        evidenceRequirement:
          "Product-level ARTG source needed before any product regulatory confidence.",
        id: "au-reg-magnesium-intervention",
        interventionId: "magnesium-glycinate",
        kind: "AUST L",
        notes: "Fixture for intervention-only identifier matching.",
        region: "AU",
        sourceUrl: "https://www.tga.gov.au/",
        status: "Ingredient-level status example",
        supplySummary: "Intervention-level context only; not product supply status."
      }
    };

    expect(
      buildProductLabelVerificationSummary({
        labelText: "Magnesium Glycinate Plus AUST L 123456",
        parsedProductIdentifierVerifications: [identifierMatch],
        productSignals: [reviewedProduct]
      })
    ).toEqual({
      detail:
        "A parsed AUST identifier matched only local intervention-level Australian regulatory context. That does not verify the pasted product, sponsor, formulation, or market status.",
      evidence: [
        "Parsed identifier AUST L 123456.",
        "1 local intervention-level status record matched this identifier.",
        "Matched local context: AUST L - Ingredient-level status example."
      ],
      nextAction:
        "Do not treat this as product verification. Capture the exact product, sponsor, formulation, and product-level ARTG/AUST record before showing Australian regulatory confidence.",
      status: "local-intervention-aust-only-match",
      statusLabel: "Intervention-only AUST context - not product verification"
    });
  });

  it("surfaces unmatched parsed AUST identifiers before product-name profile cues", () => {
    const identifierMatch: ParsedAustraliaRegulatoryIdentifierVerification = {
      confidence: "Very low",
      identifier: "999999",
      interventionStatusIds: [],
      kind: "AUST R",
      label: "AUST R 999999",
      matchState: "unmatched-parsed-identifier",
      matchStateLabel: "Parsed only; no local product record",
      nextAction:
        "Parsed from label text only. Add a reviewed product-level ARTG/AUST record before showing Australian regulatory confidence."
    };

    expect(
      buildProductLabelVerificationSummary({
        labelText: "Magnesium Glycinate Plus AUST R 999999",
        parsedProductIdentifierVerifications: [identifierMatch],
        productSignals: [reviewedProduct]
      })
    ).toEqual({
      detail:
        "A parsed AUST identifier was visible on the pasted label, but no local product-level ARTG/AUST record matched it. This is label text only, not product verification.",
      evidence: [
        "Parsed identifier AUST R 999999.",
        "No local product-level AUST/ARTG record matched this identifier."
      ],
      nextAction:
        "Parsed from label text only. Add a reviewed product-level ARTG/AUST record before showing Australian regulatory confidence.",
      status: "unmatched-aust-identifier",
      statusLabel: "AUST identifier not matched locally - verify ARTG"
    });
  });
});
