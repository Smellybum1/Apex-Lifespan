import { describe, expect, it } from "vitest";

import { buildProductAustraliaRegulatoryVerifications } from "@/lib/australia-regulatory-verification";
import {
  buildProductFormulationEvidenceMappings,
  type ProductSpecificEfficacyEvidence
} from "@/lib/product-efficacy-mapping";
import {
  australiaRegulatoryStatuses,
  claims,
  interventions,
  productSignals
} from "@/lib/seed-data";

describe("product formulation efficacy mapping", () => {
  it("maps product ingredients to local scoped claims without promoting product-level efficacy", () => {
    const productAustraliaVerificationById = new Map(
      buildProductAustraliaRegulatoryVerifications(
        {
          australiaRegulatoryStatuses,
          productSignals
        },
        {
          now: new Date("2026-06-11T00:00:00.000Z")
        }
      ).map((verification) => [verification.productId, verification])
    );

    const mappings = buildProductFormulationEvidenceMappings({
      claims,
      interventions,
      productAustraliaVerificationById,
      productSignals
    });

    expect(mappings).toEqual([
      expect.objectContaining({
        ingredientLevelClaimCount: 2,
        matchedIngredientCount: 1,
        productId: "seed-creatine-product",
        productSpecificEvidence: [],
        productSpecificEvidenceCount: 0,
        status: "ingredient-level-only",
        statusLabel: "Ingredient-level evidence only",
        unmatchedIngredients: [],
        mappedIngredients: [
          expect.objectContaining({
            ingredient: "Creatine monohydrate",
            interventionId: "creatine",
            interventionName: "Creatine monohydrate",
            claimSummaries: [
              expect.objectContaining({
                claimId: "creatine-strength",
                finalLabel: "Core Evidence-Based",
                outcome: "Muscle/strength"
              }),
              expect.objectContaining({
                claimId: "creatine-lifespan",
                finalLabel: "Insufficient Evidence",
                outcome: "Mortality/lifespan"
              })
            ]
          })
        ]
      }),
      expect.objectContaining({
        ingredientLevelClaimCount: 7,
        matchedIngredientCount: 3,
        productId: "seed-blend-product",
        status: "ingredient-level-only",
        statusLabel: "Ingredient-level evidence only",
        unmatchedIngredients: ["Proprietary blend"],
        mappedIngredients: expect.arrayContaining([
          expect.objectContaining({
            ingredient: "Resveratrol",
            interventionId: "resveratrol",
            interventionName: "Resveratrol"
          }),
          expect.objectContaining({
            ingredient: "Fisetin",
            interventionId: "fisetin",
            interventionName: "Fisetin"
          }),
          expect.objectContaining({
            ingredient: "Quercetin",
            interventionId: "quercetin",
            interventionName: "Quercetin"
          })
        ])
      }),
      expect.objectContaining({
        ingredientLevelClaimCount: 8,
        matchedIngredientCount: 3,
        productId: "seed-sleep-support-product",
        status: "ingredient-level-only",
        statusLabel: "Ingredient-level evidence only",
        unmatchedIngredients: [],
        mappedIngredients: expect.arrayContaining([
          expect.objectContaining({
            ingredient: "Magnesium glycinate",
            interventionId: "magnesium-glycinate",
            interventionName: "Magnesium glycinate"
          }),
          expect.objectContaining({
            ingredient: "L-theanine",
            interventionId: "l-theanine",
            interventionName: "L-theanine"
          }),
          expect.objectContaining({
            ingredient: "Melatonin",
            interventionId: "melatonin",
            interventionName: "Melatonin"
          })
        ])
      })
    ]);
    expect(mappings[0]?.readinessReasons).toContain(
      "No reviewed product-specific efficacy evidence row is captured for this formulation."
    );
    expect(mappings[0]?.readinessReasons).toContain(
      "Matched ingredient claims do not prove product-level efficacy, product quality, dose/form match, or AU/TGA authorization."
    );
    expect(mappings[0]?.readinessReasons).toContain(
      "Product-level AU/TGA verification is not established in the local dataset."
    );
  });

  it("keeps captured product AU/TGA status separate from product-specific efficacy", () => {
    const productAustraliaVerificationById = new Map(
      buildProductAustraliaRegulatoryVerifications(
        {
          australiaRegulatoryStatuses: [
            {
              ...australiaRegulatoryStatuses.find(
                (status) => status.id === "au-reg-seed-creatine-product"
              )!,
              kind: "Not in ARTG",
              status: "Reviewed product-level ARTG search did not find a current entry"
            }
          ],
          productSignals
        },
        {
          now: new Date("2026-06-11T00:00:00.000Z")
        }
      ).map((verification) => [verification.productId, verification])
    );

    const [mapping] = buildProductFormulationEvidenceMappings({
      claims,
      interventions,
      productAustraliaVerificationById,
      productSignals: [productSignals[0]!]
    });

    expect(mapping).toMatchObject({
      productId: "seed-creatine-product",
      status: "ingredient-level-only",
      statusLabel: "Ingredient-level evidence only"
    });
    expect(mapping?.readinessReasons).toContain(
      "Product-level AU/TGA status is captured, but it is not product-specific efficacy evidence or a verified product recommendation."
    );
    expect(mapping?.readinessReasons).toContain(
      "Matched ingredient claims do not prove product-level efficacy, product quality, dose/form match, or AU/TGA authorization."
    );
  });

  it("promotes only reviewed exact-formulation rows into product-specific evidence mapping", () => {
    const productSpecificEvidence: ProductSpecificEfficacyEvidence[] = [
      {
        detail:
          "Exact product formulation was AI reviewed against a scoped strength claim in the local evidence packet.",
        id: "ai-reviewed-product-row",
        matchQuality: "exact-product-formulation",
        outcome: "Muscle/strength",
        productId: "seed-creatine-product",
        reviewStatus: "AI reviewed",
        sourceLabel: "AI reviewed product packet",
        sourceUrl: "https://example.test/ai-reviewed-product-packet"
      },
      {
        detail: "Draft row should stay out of public product-specific mapping.",
        id: "draft-product-row",
        matchQuality: "exact-product-formulation",
        outcome: "Muscle/strength",
        productId: "seed-creatine-product",
        reviewStatus: "Unreviewed AI draft",
        sourceLabel: "Draft product packet",
        sourceUrl: "https://example.test/draft-product-packet"
      },
      {
        detail: "Ingredient-only row should remain outside product-specific mapping.",
        id: "ingredient-only-row",
        matchQuality: "ingredient-only",
        outcome: "Muscle/strength",
        productId: "seed-creatine-product",
        reviewStatus: "Human reviewed",
        sourceLabel: "Ingredient packet",
        sourceUrl: "https://example.test/ingredient-packet"
      }
    ];

    const [mapping] = buildProductFormulationEvidenceMappings({
      claims,
      interventions,
      productSignals: [productSignals[0]!],
      productSpecificEvidence
    });

    expect(mapping).toMatchObject({
      productId: "seed-creatine-product",
      productSpecificEvidenceCount: 1,
      status: "product-specific-evidence-captured",
      statusLabel: "Product-specific evidence captured",
      productSpecificEvidence: [
        {
          id: "ai-reviewed-product-row",
          matchQuality: "exact-product-formulation",
          reviewStatus: "AI reviewed",
          sourceLabel: "AI reviewed product packet"
        }
      ]
    });
    expect(mapping?.readinessReasons).toContain(
      "Reviewed product-specific efficacy evidence is captured for this formulation; keep the linked source, exact formulation, and scoped claim visible."
    );
    expect(mapping?.readinessReasons).toContain(
      "Product-specific efficacy evidence does not replace product-quality review, safety review, or AU/TGA authorization checks."
    );
  });
});
