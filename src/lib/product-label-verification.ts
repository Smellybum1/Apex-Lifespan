import type {
  ParsedAustraliaRegulatoryIdentifierVerification,
  ProductAustraliaRegulatoryVerification
} from "@/lib/australia-regulatory-verification";
import type { ProductSignal } from "@/lib/types";

export type ProductLabelVerificationStatus =
  | "local-intervention-aust-only-match"
  | "local-demo-profile-match"
  | "local-product-aust-match"
  | "local-product-aust-limited-match"
  | "local-product-profile-limited-match"
  | "local-product-profile-match"
  | "unmatched-aust-identifier"
  | "pasted-label-only";

export interface ProductLabelVerificationSummary {
  detail: string;
  evidence: string[];
  matchedProductBrand?: string;
  matchedProductId?: string;
  matchedProductName?: string;
  nextAction: string;
  status: ProductLabelVerificationStatus;
  statusLabel: string;
}

export function buildProductLabelVerificationSummary({
  labelText,
  parsedProductIdentifierVerifications,
  productAustraliaVerificationById,
  productSignals
}: {
  labelText: string;
  parsedProductIdentifierVerifications: ParsedAustraliaRegulatoryIdentifierVerification[];
  productAustraliaVerificationById?: Map<string, ProductAustraliaRegulatoryVerification>;
  productSignals: ProductSignal[];
}): ProductLabelVerificationSummary {
  const productAustMatch = parsedProductIdentifierVerifications.find(
    (verification) => verification.matchState === "local-product-match"
  );

  if (productAustMatch) {
    const matchedProduct = productAustMatch.productId
      ? productSignals.find((product) => product.id === productAustMatch.productId)
      : undefined;

    if (matchedProduct && isDemoProductSignal(matchedProduct)) {
      return demoProfileMatch(matchedProduct, [
        `Parsed identifier ${productAustMatch.label} matched a local demo product-status record.`
      ]);
    }

    if (productAustMatch.productVerification?.state !== "Verified") {
      const verification = productAustMatch.productVerification;

      return {
        detail:
          "A parsed AUST identifier matched a local product-level record, but the local product status is not currently verified. Treat this as a limited verification cue, not proof of product efficacy or a recommendation.",
        evidence: [
          `Parsed identifier ${productAustMatch.label}.`,
          productAustMatch.productName
            ? `Local product: ${productAustMatch.productName}${
                productAustMatch.productBrand ? ` (${productAustMatch.productBrand})` : ""
              }.`
            : "Local product record matched.",
          verification
            ? `Local product status: ${verification.stateLabel}; AU confidence ${verification.confidence}.`
            : "No current local product verification summary was available for this match."
        ],
        ...(productAustMatch.productBrand
          ? { matchedProductBrand: productAustMatch.productBrand }
          : {}),
        ...(productAustMatch.productId ? { matchedProductId: productAustMatch.productId } : {}),
        ...(productAustMatch.productName
          ? { matchedProductName: productAustMatch.productName }
          : {}),
        nextAction:
          verification?.nextAction ??
          "Review the exact product label, sponsor, formulation, and current ARTG source before treating this pasted label as verified.",
        status: "local-product-aust-limited-match",
        statusLabel: verification?.isStale
          ? "Stale local product AUST match - re-check ARTG"
          : "Limited local product AUST match - not verified"
      };
    }

    return {
      detail:
        "A parsed AUST identifier matched a local product-level record. This is still a verification cue, not proof of product efficacy or a recommendation.",
      evidence: [
        `Parsed identifier ${productAustMatch.label}.`,
        productAustMatch.productName
          ? `Local product: ${productAustMatch.productName}${
              productAustMatch.productBrand ? ` (${productAustMatch.productBrand})` : ""
            }.`
          : "Local product record matched."
      ],
      ...(productAustMatch.productBrand
        ? { matchedProductBrand: productAustMatch.productBrand }
        : {}),
      ...(productAustMatch.productId ? { matchedProductId: productAustMatch.productId } : {}),
      ...(productAustMatch.productName
        ? { matchedProductName: productAustMatch.productName }
        : {}),
      nextAction:
        "Review the exact product label, sponsor, formulation, and current ARTG source before treating this pasted label as verified.",
      status: "local-product-aust-match",
      statusLabel: "Local product AUST identifier match"
    };
  }

  const interventionOnlyAustMatch = parsedProductIdentifierVerifications.find(
    (verification) => verification.matchState === "local-intervention-only-match"
  );

  if (interventionOnlyAustMatch) {
    return {
      detail:
        "A parsed AUST identifier matched only local intervention-level Australian regulatory context. That does not verify the pasted product, sponsor, formulation, or market status.",
      evidence: [
        `Parsed identifier ${interventionOnlyAustMatch.label}.`,
        `${interventionOnlyAustMatch.interventionStatusIds.length} local intervention-level status ${
          interventionOnlyAustMatch.interventionStatusIds.length === 1 ? "record" : "records"
        } matched this identifier.`,
        ...(interventionOnlyAustMatch.status
          ? [
              `Matched local context: ${interventionOnlyAustMatch.status.kind} - ${interventionOnlyAustMatch.status.status}.`
            ]
          : [])
      ],
      nextAction: interventionOnlyAustMatch.nextAction,
      status: "local-intervention-aust-only-match",
      statusLabel: "Intervention-only AUST context - not product verification"
    };
  }

  const unmatchedAustIdentifier = parsedProductIdentifierVerifications.find(
    (verification) => verification.matchState === "unmatched-parsed-identifier"
  );

  if (unmatchedAustIdentifier) {
    return {
      detail:
        "A parsed AUST identifier was visible on the pasted label, but no local product-level ARTG/AUST record matched it. This is label text only, not product verification.",
      evidence: [
        `Parsed identifier ${unmatchedAustIdentifier.label}.`,
        "No local product-level AUST/ARTG record matched this identifier."
      ],
      nextAction: unmatchedAustIdentifier.nextAction,
      status: "unmatched-aust-identifier",
      statusLabel: "AUST identifier not matched locally - verify ARTG"
    };
  }

  const profileMatch = productSignals.find((product) =>
    normalizedContains(labelText, product.name)
  );

  if (profileMatch) {
    if (isDemoProductSignal(profileMatch)) {
      return demoProfileMatch(profileMatch, [
        `Pasted label text contains local demo product profile name ${profileMatch.name}.`
      ]);
    }

    const profileVerification = productAustraliaVerificationById?.get(profileMatch.id);

    if (profileVerification && profileVerification.state !== "Verified") {
      return {
        detail:
          "The pasted label text resembles a local product profile by name, but the local product AU/TGA status is not currently verified. Treat this as a limited profile cue only.",
        evidence: [
          `Pasted label text contains local product profile name ${profileMatch.name}.`,
          `Local product status: ${profileVerification.stateLabel}; AU confidence ${profileVerification.confidence}.`
        ],
        matchedProductBrand: profileMatch.brand,
        matchedProductId: profileMatch.id,
        matchedProductName: profileMatch.name,
        nextAction: profileVerification.nextAction,
        status: "local-product-profile-limited-match",
        statusLabel: "Local product profile match with limited AU/TGA status"
      };
    }

    return {
      detail:
        "The pasted label text resembles a local product profile by name. Treat this as a profile match cue only until the exact product source is reviewed.",
      evidence: [`Pasted label text contains local product profile name ${profileMatch.name}.`],
      matchedProductBrand: profileMatch.brand,
      matchedProductId: profileMatch.id,
      matchedProductName: profileMatch.name,
      nextAction:
        "Review the exact product label, brand, formulation, and product-level source before treating this as a verified product match.",
      status: "local-product-profile-match",
      statusLabel: "Local product profile text match"
    };
  }

  return {
    detail:
      "No local product profile or product-level AUST identifier match was found for the pasted label.",
    evidence: ["Pasted label text is being analyzed as a standalone, unverified label."],
    nextAction:
      "Capture the exact product name, brand, label source, and product-level ARTG/AUST record before treating it as verified.",
    status: "pasted-label-only",
    statusLabel: "Pasted label only - not verified product recommendation"
  };
}

function demoProfileMatch(
  product: ProductSignal,
  evidence: string[]
): ProductLabelVerificationSummary {
  return {
    detail:
      "The pasted label matches a local demo product profile. Demo profiles are review fixtures, not verified product recommendations.",
    evidence,
    matchedProductBrand: product.brand,
    matchedProductId: product.id,
    matchedProductName: product.name,
    nextAction:
      "Replace the demo fixture with an exact reviewed product record before treating this label as verified.",
    status: "local-demo-profile-match",
    statusLabel: "Local demo profile match - not verified product recommendation"
  };
}

function isDemoProductSignal(product: ProductSignal) {
  return product.brand.toLowerCase() === "demo profile";
}

function normalizedContains(text: string, candidate: string) {
  const normalizedText = normalizeProductLabelMatchText(text);
  const normalizedCandidate = normalizeProductLabelMatchText(candidate);

  return Boolean(normalizedCandidate) && normalizedText.includes(normalizedCandidate);
}

function normalizeProductLabelMatchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
