import type { ProductAustraliaRegulatoryVerification } from "@/lib/australia-regulatory-verification";
import type {
  Claim,
  ConfidenceLevel,
  EvidenceLabel,
  Intervention,
  ProductSignal,
  ReviewStatus
} from "@/lib/types";

export type ProductSpecificEfficacyStatus =
  | "product-specific-evidence-captured"
  | "ingredient-level-only"
  | "no-local-ingredient-match";

export type ProductSpecificEvidenceMatchQuality =
  | "exact-product-formulation"
  | "same-brand-different-formulation"
  | "ingredient-only";

export interface ProductSpecificEfficacyEvidence {
  claimId?: string;
  detail: string;
  id: string;
  matchQuality: ProductSpecificEvidenceMatchQuality;
  outcome: string;
  productId: string;
  reviewStatus: ReviewStatus;
  sourceLabel: string;
  sourceUrl: string;
}

export interface ProductIngredientEvidenceMapping {
  claimSummaries: ProductIngredientClaimSummary[];
  ingredient: string;
  interventionId?: string;
  interventionName?: string;
}

export interface ProductIngredientClaimSummary {
  claimId: string;
  confidenceLevel: ConfidenceLevel;
  doseFormStudied: string;
  finalLabel: EvidenceLabel;
  outcome: string;
  reviewStatus: string;
}

export interface ProductFormulationEvidenceMapping {
  ingredientLevelClaimCount: number;
  matchedIngredientCount: number;
  productId: string;
  productName: string;
  productSpecificEvidence: ProductSpecificEfficacyEvidence[];
  productSpecificEvidenceCount: number;
  readinessReasons: string[];
  status: ProductSpecificEfficacyStatus;
  statusLabel: string;
  mappedIngredients: ProductIngredientEvidenceMapping[];
  unmatchedIngredients: string[];
}

export function buildProductFormulationEvidenceMappings({
  claims,
  interventions,
  productSpecificEvidence = [],
  productAustraliaVerificationById,
  productSignals
}: {
  claims: Claim[];
  interventions: Intervention[];
  productSpecificEvidence?: ProductSpecificEfficacyEvidence[];
  productAustraliaVerificationById?: Map<string, ProductAustraliaRegulatoryVerification>;
  productSignals: ProductSignal[];
}): ProductFormulationEvidenceMapping[] {
  const interventionByName = buildInterventionNameMap(interventions);

  return productSignals.map((product) =>
    buildProductFormulationEvidenceMapping({
      claims,
      interventionByName,
      productSpecificEvidence: reviewedExactProductSpecificEvidenceForProduct(
        productSpecificEvidence,
        product.id
      ),
      product,
      verification: productAustraliaVerificationById?.get(product.id)
    })
  );
}

function buildProductFormulationEvidenceMapping({
  claims,
  interventionByName,
  productSpecificEvidence,
  product,
  verification
}: {
  claims: Claim[];
  interventionByName: Map<string, Intervention>;
  productSpecificEvidence: ProductSpecificEfficacyEvidence[];
  product: ProductSignal;
  verification?: ProductAustraliaRegulatoryVerification;
}): ProductFormulationEvidenceMapping {
  const mappedIngredients = product.ingredients.map((ingredient) => {
    const intervention = interventionByName.get(normalizeProductIngredientName(ingredient));
    const claimSummaries = intervention
      ? claims
          .filter((claim) => claim.interventionId === intervention.id)
          .map((claim) => ({
            claimId: claim.id,
            confidenceLevel: claim.confidenceLevel,
            doseFormStudied: claim.doseFormStudied,
            finalLabel: claim.finalLabel,
            outcome: claim.outcome,
            reviewStatus: claim.reviewStatus
          }))
      : [];

    return {
      claimSummaries,
      ingredient,
      ...(intervention
        ? {
            interventionId: intervention.id,
            interventionName: intervention.name
          }
        : {})
    };
  });
  const matchedIngredients = mappedIngredients.filter((mapping) => mapping.interventionId);
  const ingredientLevelClaimCount = mappedIngredients.reduce(
    (count, mapping) => count + mapping.claimSummaries.length,
    0
  );
  const productSpecificEvidenceCount = productSpecificEvidence.length;
  const status = productFormulationEvidenceStatus({
    ingredientLevelClaimCount,
    matchedIngredientCount: matchedIngredients.length,
    productSpecificEvidenceCount
  });

  return {
    ingredientLevelClaimCount,
    matchedIngredientCount: matchedIngredients.length,
    mappedIngredients,
    productId: product.id,
    productName: product.name,
    productSpecificEvidence,
    productSpecificEvidenceCount,
    readinessReasons: productEfficacyReadinessReasons({
      ingredientLevelClaimCount,
      productSpecificEvidenceCount,
      product,
      verification
    }),
    status,
    statusLabel: productFormulationEvidenceStatusLabel(status),
    unmatchedIngredients: mappedIngredients
      .filter((mapping) => !mapping.interventionId)
      .map((mapping) => mapping.ingredient)
  };
}

function buildInterventionNameMap(interventions: Intervention[]) {
  const interventionByName = new Map<string, Intervention>();

  interventions.forEach((intervention) => {
    [intervention.name, ...intervention.synonyms].forEach((name) => {
      interventionByName.set(normalizeProductIngredientName(name), intervention);
    });
  });

  return interventionByName;
}

function productEfficacyReadinessReasons({
  ingredientLevelClaimCount,
  productSpecificEvidenceCount,
  product,
  verification
}: {
  ingredientLevelClaimCount: number;
  productSpecificEvidenceCount: number;
  product: ProductSignal;
  verification?: ProductAustraliaRegulatoryVerification;
}) {
  const reasons =
    productSpecificEvidenceCount > 0
      ? [
          "Reviewed product-specific efficacy evidence is captured for this formulation; keep the linked source, exact formulation, and scoped claim visible.",
          "Product-specific efficacy evidence does not replace product-quality review, safety review, or AU/TGA authorization checks."
        ]
      : [
          "No reviewed product-specific efficacy evidence row is captured for this formulation.",
          "Matched ingredient claims do not prove product-level efficacy, product quality, dose/form match, or AU/TGA authorization."
        ];

  if (product.brand.toLowerCase() === "demo profile") {
    reasons.push("This is a demo product profile, not a verified product recommendation.");
  }

  if (!verification) {
    reasons.push("Product-level AU/TGA verification is not established in the local dataset.");
  } else if (verification.state === "Captured") {
    reasons.push(
      "Product-level AU/TGA status is captured, but it is not product-specific efficacy evidence or a verified product recommendation."
    );
  } else if (verification.state !== "Verified") {
    reasons.push("Product-level AU/TGA verification is not established in the local dataset.");
  }

  if (ingredientLevelClaimCount === 0) {
    reasons.push("No ingredient in this product profile maps to a local scoped claim yet.");
  }

  return reasons;
}

function productFormulationEvidenceStatus({
  ingredientLevelClaimCount,
  matchedIngredientCount,
  productSpecificEvidenceCount
}: {
  ingredientLevelClaimCount: number;
  matchedIngredientCount: number;
  productSpecificEvidenceCount: number;
}): ProductSpecificEfficacyStatus {
  if (productSpecificEvidenceCount > 0) {
    return "product-specific-evidence-captured";
  }

  return matchedIngredientCount > 0 || ingredientLevelClaimCount > 0
    ? "ingredient-level-only"
    : "no-local-ingredient-match";
}

function productFormulationEvidenceStatusLabel(status: ProductSpecificEfficacyStatus) {
  switch (status) {
    case "product-specific-evidence-captured":
      return "Product-specific evidence captured";
    case "ingredient-level-only":
      return "Ingredient-level evidence only";
    case "no-local-ingredient-match":
      return "No local ingredient evidence match";
  }
}

function reviewedExactProductSpecificEvidenceForProduct(
  evidenceRows: ProductSpecificEfficacyEvidence[],
  productId: string
) {
  return evidenceRows
    .filter(
      (row) =>
        row.productId === productId &&
        reviewStatusIsReviewed(row.reviewStatus) &&
        row.matchQuality === "exact-product-formulation"
    )
    .sort((left, right) => left.id.localeCompare(right.id));
}

function reviewStatusIsReviewed(reviewStatus: ReviewStatus) {
  return reviewStatus === "AI reviewed" || reviewStatus === "Human reviewed";
}

function normalizeProductIngredientName(name: string) {
  return name
    .toLowerCase()
    .replace(/\bvitamin\s+d3\b/g, "vitamin d")
    .replace(/\bcholecalciferol\b/g, "vitamin d")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
