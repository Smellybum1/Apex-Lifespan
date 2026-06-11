import type {
  AustraliaRegulatoryStatus,
  ConfidenceLevel,
  EvidenceDashboardData,
  ProductSignal
} from "@/lib/types";

export type ProductAustraliaRegulatoryVerificationState =
  | "Verified"
  | "Unknown"
  | "Stale"
  | "Missing";

export interface ProductAustraliaRegulatoryVerification {
  confidence: ConfidenceLevel;
  isStale: boolean;
  nextAction: string;
  productBrand: string;
  productId: string;
  productName: string;
  state: ProductAustraliaRegulatoryVerificationState;
  stateLabel: string;
  status?: AustraliaRegulatoryStatus;
}

export interface AustraliaRegulatoryVerificationSummary {
  confidenceCounts: Record<ConfidenceLevel, number>;
  interventionLevelStatuses: number;
  productVerifications: ProductAustraliaRegulatoryVerification[];
  productLevelStatuses: number;
  productsMissingStatus: string[];
  staleStatusIds: string[];
  unknownProductStatusIds: string[];
}

const DEFAULT_STALE_AFTER_DAYS = 180;

export function summarizeAustraliaRegulatoryVerification(
  data: Pick<EvidenceDashboardData, "australiaRegulatoryStatuses" | "productSignals">,
  {
    now = new Date(),
    staleAfterDays = DEFAULT_STALE_AFTER_DAYS
  }: {
    now?: Date;
    staleAfterDays?: number;
  } = {}
): AustraliaRegulatoryVerificationSummary {
  const productLevelStatuses = data.australiaRegulatoryStatuses.filter(
    (status) => status.productId
  );
  const productVerifications = buildProductAustraliaRegulatoryVerifications(data, {
    now,
    staleAfterDays
  });
  const confidenceCounts = productVerifications.reduce(
    (counts, verification) => ({
      ...counts,
      [verification.confidence]: counts[verification.confidence] + 1
    }),
    {
      High: 0,
      Moderate: 0,
      Low: 0,
      "Very low": 0
    } satisfies Record<ConfidenceLevel, number>
  );

  return {
    confidenceCounts,
    interventionLevelStatuses: data.australiaRegulatoryStatuses.filter(
      (status) => status.interventionId && !status.productId
    ).length,
    productVerifications,
    productLevelStatuses: productLevelStatuses.length,
    productsMissingStatus: productVerifications
      .filter((verification) => verification.state === "Missing")
      .map((verification) => verification.productId),
    staleStatusIds: staleRegulatoryStatusIds(
      data.australiaRegulatoryStatuses,
      now,
      staleAfterDays
    ),
    unknownProductStatusIds: productVerifications
      .filter((verification) => verification.status?.kind === "Unknown")
      .map((verification) => verification.status?.id ?? "")
      .filter(Boolean)
  };
}

export function buildProductAustraliaRegulatoryVerifications(
  data: Pick<EvidenceDashboardData, "australiaRegulatoryStatuses" | "productSignals">,
  {
    now = new Date(),
    staleAfterDays = DEFAULT_STALE_AFTER_DAYS
  }: {
    now?: Date;
    staleAfterDays?: number;
  } = {}
): ProductAustraliaRegulatoryVerification[] {
  const productStatusByProductId = new Map(
    data.australiaRegulatoryStatuses
      .filter((status) => status.productId)
      .map((status) => [status.productId as string, status])
  );

  return data.productSignals
    .map((product) =>
      buildProductAustraliaRegulatoryVerification({
        product,
        status: productStatusByProductId.get(product.id),
        now,
        staleAfterDays
      })
    )
    .sort((left, right) => left.productId.localeCompare(right.productId));
}

function buildProductAustraliaRegulatoryVerification({
  product,
  status,
  now,
  staleAfterDays
}: {
  product: ProductSignal;
  status?: AustraliaRegulatoryStatus;
  now: Date;
  staleAfterDays: number;
}): ProductAustraliaRegulatoryVerification {
  if (!status) {
    return {
      confidence: "Very low",
      isStale: false,
      nextAction:
        "Capture the exact product label, AUST number if shown, or ARTG search result before showing Australian regulatory confidence.",
      productBrand: product.brand,
      productId: product.id,
      productName: product.name,
      state: "Missing",
      stateLabel: "Product-level status missing"
    };
  }

  const isStale = isStaleRegulatoryStatus(status, now, staleAfterDays);
  const state = productVerificationState(status, isStale);

  return {
    confidence: productVerificationConfidence(status, state),
    isStale,
    nextAction: productVerificationNextAction(status, state),
    productBrand: product.brand,
    productId: product.id,
    productName: product.name,
    state,
    stateLabel: productVerificationStateLabel(state),
    status
  };
}

function staleRegulatoryStatusIds(
  statuses: AustraliaRegulatoryStatus[],
  now: Date,
  staleAfterDays: number
) {
  return statuses
    .filter((status) => isStaleRegulatoryStatus(status, now, staleAfterDays))
    .map((status) => status.id)
    .sort();
}

function isStaleRegulatoryStatus(
  status: AustraliaRegulatoryStatus,
  now: Date,
  staleAfterDays: number
) {
  const checkedAtMs = Date.parse(status.checkedAt);

  if (!Number.isFinite(checkedAtMs)) {
    return true;
  }

  const staleAfterMs = staleAfterDays * 24 * 60 * 60 * 1000;

  return now.getTime() - checkedAtMs > staleAfterMs;
}

function productVerificationState(
  status: AustraliaRegulatoryStatus,
  isStale: boolean
): ProductAustraliaRegulatoryVerificationState {
  if (isStale) {
    return "Stale";
  }

  if (status.kind === "Unknown") {
    return "Unknown";
  }

  return "Verified";
}

function productVerificationConfidence(
  status: AustraliaRegulatoryStatus,
  state: ProductAustraliaRegulatoryVerificationState
): ConfidenceLevel {
  if (state === "Missing" || state === "Unknown" || state === "Stale") {
    return "Very low";
  }

  if ((status.kind === "AUST L(A)" || status.kind === "AUST R") && hasProductIdentifier(status)) {
    return "High";
  }

  if (status.kind === "AUST L" && hasProductIdentifier(status)) {
    return "Moderate";
  }

  if (
    status.kind === "Not in ARTG" ||
    status.kind === "Unapproved" ||
    status.kind === "Exempt" ||
    status.kind === "Excluded"
  ) {
    return hasProductIdentifier(status) || status.artgId ? "Moderate" : "Low";
  }

  return "Low";
}

function hasProductIdentifier(status: AustraliaRegulatoryStatus) {
  return Boolean(status.austNumber || status.artgId);
}

function productVerificationNextAction(
  status: AustraliaRegulatoryStatus,
  state: ProductAustraliaRegulatoryVerificationState
) {
  if (state === "Stale") {
    return "Re-check the product-level ARTG/AUST source before relying on this Australian regulatory status.";
  }

  if (state === "Unknown") {
    return status.evidenceRequirement;
  }

  return "Keep the product-level ARTG/AUST source linked and re-check it on the verification schedule.";
}

function productVerificationStateLabel(state: ProductAustraliaRegulatoryVerificationState) {
  switch (state) {
    case "Missing":
      return "Product-level status missing";
    case "Stale":
      return "Product-level status stale";
    case "Unknown":
      return "Product-level status unknown";
    case "Verified":
      return "Product-level status verified";
  }
}
