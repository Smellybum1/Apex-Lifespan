import {
  summarizeAustraliaRegulatoryVerification,
  type AustraliaRegulatoryVerificationSummary
} from "@/lib/australia-regulatory-verification";
import { summarizeReviewStatus } from "@/lib/review-summary";
import { summarizeClaimSourcePackets } from "@/lib/source-packet";
import type { EvidenceDashboardData } from "@/lib/types";

export interface CatalogTrustSummary {
  australia: {
    interventionCoverage: string;
    interventionLevelStatuses: number;
    productExactStatusCount: number;
    productLevelStatuses: number;
    productMissingStatusCount: number;
    productUnknownStatusCount: number;
    staleStatusCount: number;
  };
  claims: {
    humanReviewed: number;
    sourcePacketsComplete: number;
    sourcePacketsTotal: number;
    total: number;
    unreviewedDrafts: number;
  };
  dataSource: EvidenceDashboardData["dataSource"];
  interventions: {
    total: number;
  };
  nextActions: string[];
  previewAttentionItems: string[];
  products: {
    total: number;
  };
  references: {
    extracted: number;
    total: number;
  };
  trials: {
    nctIdFormat: number;
    resultsPosted: number;
    searchOnly: number;
    total: number;
  };
}

export function buildCatalogTrustSummary(data: EvidenceDashboardData): CatalogTrustSummary {
  const reviewSummary = summarizeReviewStatus(data.claims);
  const sourcePacketSummary = summarizeClaimSourcePackets({
    claims: data.claims,
    referencesById: new Map(data.references.map((reference) => [reference.id, reference])),
    studies: data.studies
  });
  const australiaSummary = summarizeAustraliaRegulatoryVerification(data);
  const nctIdFormat = data.trialWatchItems.filter((trial) => isNctIdFormat(trial.nctId)).length;
  const searchOnly = data.trialWatchItems.length - nctIdFormat;
  const productExactStatusCount = countExactProductStatuses(australiaSummary);
  const previewAttentionItems = buildPreviewAttentionItems({
    australiaSummary,
    data,
    nctIdFormat,
    productExactStatusCount,
    reviewSummary,
    searchOnly,
    sourcePacketSummary
  });

  return {
    australia: {
      interventionCoverage: `${australiaSummary.interventionLevelStatuses}/${data.interventions.length}`,
      interventionLevelStatuses: australiaSummary.interventionLevelStatuses,
      productExactStatusCount,
      productLevelStatuses: australiaSummary.productLevelStatuses,
      productMissingStatusCount: australiaSummary.productsMissingStatus.length,
      productUnknownStatusCount: australiaSummary.unknownProductStatusIds.length,
      staleStatusCount: australiaSummary.staleStatusIds.length
    },
    claims: {
      humanReviewed: reviewSummary.humanReviewed,
      sourcePacketsComplete: sourcePacketSummary.completeClaims,
      sourcePacketsTotal: sourcePacketSummary.totalClaims,
      total: data.claims.length,
      unreviewedDrafts: reviewSummary.unreviewedDrafts
    },
    dataSource: data.dataSource,
    interventions: {
      total: data.interventions.length
    },
    nextActions: buildNextActions({
      data,
      previewAttentionItems,
      productExactStatusCount,
      searchOnly
    }),
    previewAttentionItems,
    products: {
      total: data.productSignals.length
    },
    references: {
      extracted: sourcePacketSummary.extractedReferences,
      total: sourcePacketSummary.totalReferences
    },
    trials: {
      nctIdFormat,
      resultsPosted: data.trialWatchItems.filter((trial) => trial.resultsPosted).length,
      searchOnly,
      total: data.trialWatchItems.length
    }
  };
}

export function isNctIdFormat(value: string | undefined) {
  return /^NCT\d{8}$/.test(value ?? "");
}

export function formatCatalogTrustSummaryLines(summary: CatalogTrustSummary) {
  return [
    `Data source: ${summary.dataSource}`,
    `Interventions: ${summary.interventions.total}`,
    `Claims: ${summary.claims.total} (${summary.claims.humanReviewed} human reviewed, ${summary.claims.unreviewedDrafts} AI drafts)`,
    `Source packets: ${summary.claims.sourcePacketsComplete}/${summary.claims.sourcePacketsTotal} complete`,
    `Linked references extracted: ${summary.references.extracted}/${summary.references.total}`,
    `Trial leads: ${summary.trials.total} (${summary.trials.nctIdFormat} NCT IDs attached, ${summary.trials.searchOnly} search-only, ${summary.trials.resultsPosted} with posted results)`,
    `AU/TGA intervention rows: ${summary.australia.interventionCoverage}`,
    `Product AU/TGA: ${summary.australia.productExactStatusCount}/${summary.products.total} exact product statuses, ${summary.australia.productUnknownStatusCount} unknown, ${summary.australia.productMissingStatusCount} missing`,
    summary.previewAttentionItems.length > 0
      ? `Before preview: ${summary.previewAttentionItems.join(" | ")}`
      : "Before preview: no automated catalog blockers found; still do a human spot check."
  ];
}

function countExactProductStatuses(summary: AustraliaRegulatoryVerificationSummary) {
  return summary.productVerifications.filter((verification) => {
    const status = verification.status;
    return verification.state === "Verified" && Boolean(status?.austNumber || status?.artgId);
  }).length;
}

function buildPreviewAttentionItems({
  australiaSummary,
  data,
  nctIdFormat,
  productExactStatusCount,
  reviewSummary,
  searchOnly,
  sourcePacketSummary
}: {
  australiaSummary: AustraliaRegulatoryVerificationSummary;
  data: EvidenceDashboardData;
  nctIdFormat: number;
  productExactStatusCount: number;
  reviewSummary: ReturnType<typeof summarizeReviewStatus>;
  searchOnly: number;
  sourcePacketSummary: ReturnType<typeof summarizeClaimSourcePackets>;
}) {
  const items: string[] = [];

  if (reviewSummary.unreviewedDrafts > 0) {
    items.push(`${reviewSummary.unreviewedDrafts} claims still need human review`);
  }

  if (sourcePacketSummary.completeClaims < sourcePacketSummary.totalClaims) {
    items.push(
      `${sourcePacketSummary.totalClaims - sourcePacketSummary.completeClaims} source packets need extraction`
    );
  }

  if (searchOnly > 0) {
    items.push(`${searchOnly} trial leads need NCT ID selection or search-only labeling`);
  }

  if (data.trialWatchItems.length > 0 && nctIdFormat === 0) {
    items.push("trial watcher has no NCT ID-format records");
  }

  if (data.productSignals.length > 0 && productExactStatusCount < data.productSignals.length) {
    items.push(
      `${data.productSignals.length - productExactStatusCount} product profiles need exact AU/TGA product status`
    );
  }

  if (australiaSummary.staleStatusIds.length > 0) {
    items.push(`${australiaSummary.staleStatusIds.length} AU/TGA rows need date refresh`);
  }

  return items;
}

function buildNextActions({
  data,
  previewAttentionItems,
  productExactStatusCount,
  searchOnly
}: {
  data: EvidenceDashboardData;
  previewAttentionItems: string[];
  productExactStatusCount: number;
  searchOnly: number;
}) {
  if (previewAttentionItems.length === 0) {
    return ["Run a human spot check on representative intervention pages before preview promotion."];
  }

  const actions: string[] = [];

  if (searchOnly > 0) {
    actions.push("Verify search-only trial leads against ClinicalTrials.gov and attach NCT IDs where appropriate.");
  }

  if (data.productSignals.length > 0 && productExactStatusCount < data.productSignals.length) {
    actions.push("Capture exact product label, AUST/ARTG identifier or absence evidence, sponsor, and source URL before raising product-level AU confidence.");
  }

  if (actions.length === 0) {
    actions.push(previewAttentionItems[0]);
  }

  return actions;
}
