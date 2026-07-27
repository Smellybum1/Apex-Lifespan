import type { FullTextSourceReadinessSummary } from "@/lib/full-text-source-readiness";
import type { SupplementOnboardingQualityRow } from "@/lib/supplement-onboarding-quality";
import type { EvidenceDashboardData } from "@/lib/types";

export type SupplementOnboardingMonitorStatus = "action-needed" | "ready" | "watch";

export type SupplementOnboardingMonitorIssueKind =
  | "extraction-gaps"
  | "full-text-gate-blocked"
  | "missing-product-status"
  | "onboarding-blockers"
  | "onboarding-warnings"
  | "pending-candidates"
  | "promotion-ready"
  | "safety-signals"
  | "source-tracking-unavailable"
  | "stale-review"
  | "unknown-product-status"
  | "unreviewed-claims";

export type SupplementOnboardingMonitorIssueSeverity = "blocked" | "info" | "warning";

export type SupplementOnboardingMonitorRefreshTier =
  | "high-attention"
  | "routine"
  | "watch";

export interface SupplementOnboardingMonitorIssue {
  command?: string;
  count?: number;
  detail: string;
  kind: SupplementOnboardingMonitorIssueKind;
  label: string;
  nextAction: string;
  severity: SupplementOnboardingMonitorIssueSeverity;
}

export interface SupplementOnboardingMonitorRefreshPolicy {
  intervalDays: number;
  rationale: string[];
  tier: SupplementOnboardingMonitorRefreshTier;
}

export interface SupplementOnboardingMonitorRow {
  humanOwned: true;
  issues: SupplementOnboardingMonitorIssue[];
  nextAction: string;
  noAutoPromotion: true;
  noAutoReview: true;
  noAutoWrite: true;
  noCandidateDecision: true;
  noDatabaseWrite: true;
  noExtractionWrite: true;
  noPublicEvidenceRowsWritten: true;
  oldestReviewEvidenceDate?: string;
  readOnly: true;
  refreshPolicy: SupplementOnboardingMonitorRefreshPolicy;
  reviewAgeDays?: number;
  staleAfterDays: number;
  status: SupplementOnboardingMonitorStatus;
  supplement: SupplementOnboardingQualityRow["supplement"];
}

export interface SupplementOnboardingMonitorDashboard {
  generatedAt: string;
  globalIssues: SupplementOnboardingMonitorIssue[];
  humanOwned: true;
  nextAction: string;
  noAutoPromotion: true;
  noAutoReview: true;
  noAutoWrite: true;
  noCandidateDecision: true;
  noDatabaseWrite: true;
  noExtractionWrite: true;
  noPublicEvidenceRowsWritten: true;
  readOnly: true;
  rows: SupplementOnboardingMonitorRow[];
  staleAfterDays: number;
  summary: SupplementOnboardingMonitorSummaryCounts;
}

export interface SupplementOnboardingMonitorSummary {
  generatedAt: string;
  globalIssues: SupplementOnboardingMonitorIssue[];
  humanOwned: true;
  nextAction: string;
  noAutoPromotion: true;
  noAutoReview: true;
  noAutoWrite: true;
  noCandidateDecision: true;
  noDatabaseWrite: true;
  noExtractionWrite: true;
  noPublicEvidenceRowsWritten: true;
  readOnly: true;
  rows: Array<{
    issueCount: number;
    issues: SupplementOnboardingMonitorIssue[];
    name: string;
    nextAction: string;
    refreshPolicy: SupplementOnboardingMonitorRefreshPolicy;
    reviewAgeDays?: number;
    slug: string;
    status: SupplementOnboardingMonitorStatus;
  }>;
  staleAfterDays: number;
  summary: SupplementOnboardingMonitorSummaryCounts;
}

export interface SupplementOnboardingMonitorSummaryCounts {
  actionNeededSupplements: number;
  extractionGapSupplements: number;
  fullTextGateBlocked: boolean;
  globalIssues: number;
  highAttentionCadenceSupplements: number;
  missingProductStatusSupplements: number;
  pendingCandidateSupplements: number;
  promotionReadySupplements: number;
  readySupplements: number;
  routineCadenceSupplements: number;
  safetySignalSupplements: number;
  sourceTrackingUnavailable: boolean;
  staleReviewSupplements: number;
  supplements: number;
  unknownProductStatusSupplements: number;
  unreviewedClaimSupplements: number;
  watchCadenceSupplements: number;
  watchSupplements: number;
}

export function buildSupplementOnboardingMonitorDashboard({
  data,
  fullTextSources,
  generatedAt = new Date(),
  qualityRows,
  sourceTracking,
  staleAfterDays = 365
}: {
  data: EvidenceDashboardData;
  fullTextSources: FullTextSourceReadinessSummary;
  generatedAt?: Date;
  qualityRows: SupplementOnboardingQualityRow[];
  sourceTracking: {
    status: "available" | "unavailable";
    unavailableReason?: string;
  };
  staleAfterDays?: number;
}): SupplementOnboardingMonitorDashboard {
  const globalIssues = globalMonitorIssues({
    fullTextSources,
    sourceTracking
  });
  const rows = qualityRows
    .map((row) =>
      monitorRowForSupplement({
        data,
        generatedAt,
        qualityRow: row,
        staleAfterDays
      })
    )
    .sort(compareMonitorRows);
  const summary = summarizeRows({
    globalIssues,
    rows
  });
  const nextAction = monitorNextAction({
    globalIssues,
    rows
  });

  return {
    generatedAt: generatedAt.toISOString(),
    globalIssues,
    humanOwned: true,
    nextAction,
    noAutoPromotion: true,
    noAutoReview: true,
    noAutoWrite: true,
    noCandidateDecision: true,
    noDatabaseWrite: true,
    noExtractionWrite: true,
    noPublicEvidenceRowsWritten: true,
    readOnly: true,
    rows,
    staleAfterDays,
    summary
  };
}

export function filterSupplementOnboardingMonitorDashboard(
  dashboard: SupplementOnboardingMonitorDashboard,
  supplementQuery?: string
): SupplementOnboardingMonitorDashboard {
  const query = normalizeQuery(supplementQuery);

  if (!query) {
    return dashboard;
  }

  const rows = dashboard.rows.filter((row) =>
    [row.supplement.id, row.supplement.slug, row.supplement.name].some(
      (value) => normalizeQuery(value) === query
    )
  );
  const summary = summarizeRows({
    globalIssues: dashboard.globalIssues,
    rows
  });

  return {
    ...dashboard,
    nextAction: monitorNextAction({
      emptySupplementQuery: supplementQuery,
      globalIssues: dashboard.globalIssues,
      rows
    }),
    rows,
    summary
  };
}

export function summarizeSupplementOnboardingMonitorDashboard(
  dashboard: SupplementOnboardingMonitorDashboard
): SupplementOnboardingMonitorSummary {
  return {
    generatedAt: dashboard.generatedAt,
    globalIssues: dashboard.globalIssues,
    humanOwned: true,
    nextAction: dashboard.nextAction,
    noAutoPromotion: true,
    noAutoReview: true,
    noAutoWrite: true,
    noCandidateDecision: true,
    noDatabaseWrite: true,
    noExtractionWrite: true,
    noPublicEvidenceRowsWritten: true,
    readOnly: true,
    rows: dashboard.rows.map((row) => ({
      issueCount: row.issues.length,
      issues: row.issues,
      name: row.supplement.name,
      nextAction: row.nextAction,
      refreshPolicy: row.refreshPolicy,
      ...(row.reviewAgeDays !== undefined ? { reviewAgeDays: row.reviewAgeDays } : {}),
      slug: row.supplement.slug,
      status: row.status
    })),
    staleAfterDays: dashboard.staleAfterDays,
    summary: dashboard.summary
  };
}

function monitorNextAction({
  emptySupplementQuery,
  globalIssues,
  rows
}: {
  emptySupplementQuery?: string;
  globalIssues: SupplementOnboardingMonitorIssue[];
  rows: SupplementOnboardingMonitorRow[];
}) {
  const firstRowWithIssue = rows.find((row) => row.issues.length > 0);

  if (globalIssues[0]) {
    return globalIssues[0].nextAction;
  }

  if (firstRowWithIssue) {
    return `${firstRowWithIssue.supplement.name}: ${firstRowWithIssue.issues[0]?.nextAction}`;
  }

  if (emptySupplementQuery) {
    return `No post-onboarding monitor row matched ${JSON.stringify(
      emptySupplementQuery
    )}; check the supplement id, slug, or name.`;
  }

  return "Continue periodic monitor checks; no post-onboarding maintenance issue is currently visible.";
}

function monitorRowForSupplement({
  data,
  generatedAt,
  qualityRow,
  staleAfterDays
}: {
  data: EvidenceDashboardData;
  generatedAt: Date;
  qualityRow: SupplementOnboardingQualityRow;
  staleAfterDays: number;
}): SupplementOnboardingMonitorRow {
  const supplement = data.interventions.find(
    (item) => item.id === qualityRow.supplement.id
  );
  const claims = data.claims.filter(
    (claim) => claim.interventionId === qualityRow.supplement.id
  );
  const regulatoryStatuses = data.australiaRegulatoryStatuses.filter(
    (status) => status.interventionId === qualityRow.supplement.id
  );
  const safetyAlerts = data.safetyAlerts.filter(
    (alert) => alert.interventionId === qualityRow.supplement.id
  );
  const refreshPolicy = refreshPolicyForSupplement({
    claims,
    qualityRow,
    regulatoryStatuses,
    safetyAlerts,
    staleAfterDays,
    supplement
  });
  const reviewEvidence = oldestReviewEvidenceDate([
    supplement?.lastReviewed,
    ...claims.map((claim) => claim.lastUpdated)
  ]);
  const reviewAgeDays =
    reviewEvidence === undefined
      ? undefined
      : daysBetween(new Date(reviewEvidence), generatedAt);
  const issues = sortIssues([
    ...staleReviewIssue({
      refreshPolicy,
      reviewAgeDays,
      supplementSlug: qualityRow.supplement.slug
    }),
    ...productStatusIssues({
      regulatoryStatuses,
      supplementSlug: qualityRow.supplement.slug
    }),
    ...qualityMaintenanceIssues(qualityRow)
  ]);
  const status = statusForIssues(issues);

  return {
    humanOwned: true,
    issues,
    nextAction:
      issues[0]?.nextAction ??
      "Keep this supplement in periodic source, safety, and product-status monitoring.",
    noAutoPromotion: true,
    noAutoReview: true,
    noAutoWrite: true,
    noCandidateDecision: true,
    noDatabaseWrite: true,
    noExtractionWrite: true,
    noPublicEvidenceRowsWritten: true,
    ...(reviewEvidence ? { oldestReviewEvidenceDate: reviewEvidence } : {}),
    readOnly: true,
    refreshPolicy,
    ...(reviewAgeDays !== undefined ? { reviewAgeDays } : {}),
    staleAfterDays: refreshPolicy.intervalDays,
    status,
    supplement: qualityRow.supplement
  };
}

function staleReviewIssue({
  refreshPolicy,
  reviewAgeDays,
  supplementSlug
}: {
  refreshPolicy: SupplementOnboardingMonitorRefreshPolicy;
  reviewAgeDays?: number;
  supplementSlug: string;
}): SupplementOnboardingMonitorIssue[] {
  if (reviewAgeDays === undefined || reviewAgeDays <= refreshPolicy.intervalDays) {
    return [];
  }

  return [
    {
      command: `npm run onboarding:status -- --supplement ${quote(supplementSlug)} --summary`,
      count: reviewAgeDays,
      detail: `Oldest visible review evidence is ${reviewAgeDays} day(s) old; this ${refreshPolicy.tier} packet uses a ${refreshPolicy.intervalDays}-day refresh interval.`,
      kind: "stale-review",
      label: "Review freshness",
      nextAction: "Run the onboarding status report and refresh stale review evidence if needed.",
      severity: "warning"
    }
  ];
}

function productStatusIssues({
  regulatoryStatuses,
  supplementSlug
}: {
  regulatoryStatuses: EvidenceDashboardData["australiaRegulatoryStatuses"];
  supplementSlug: string;
}): SupplementOnboardingMonitorIssue[] {
  if (regulatoryStatuses.length === 0) {
    return [
      {
        command: "npm run regulatory:review",
        detail:
          "No explicit AU/TGA product-status record is visible; product-level status must not be inferred from intervention evidence.",
        kind: "missing-product-status",
        label: "AU/TGA product status missing",
        nextAction:
          "Add or review an explicit AU/TGA Unknown/Unverified status before relying on product-level framing.",
        severity: "blocked"
      }
    ];
  }

  if (regulatoryStatuses.some((status) => status.kind === "Unknown")) {
    return [
      {
        command: `npm run onboarding:status -- --supplement ${quote(supplementSlug)} --summary`,
        count: regulatoryStatuses.filter((status) => status.kind === "Unknown").length,
        detail:
          "At least one AU/TGA status is explicitly Unknown; keep product-level authorization uncertainty visible.",
        kind: "unknown-product-status",
        label: "AU/TGA product status unknown",
        nextAction:
          "Review exact product identity and ARTG/AUST evidence before raising product-level regulatory confidence.",
        severity: "warning"
      }
    ];
  }

  return [];
}

function qualityMaintenanceIssues(
  row: SupplementOnboardingQualityRow
): SupplementOnboardingMonitorIssue[] {
  const supplementArg = quote(row.supplement.slug || row.supplement.id);
  const issues: SupplementOnboardingMonitorIssue[] = [];

  if (row.blockers.length > 0) {
    issues.push({
      command: `npm run onboarding:status -- --supplement ${supplementArg} --summary`,
      count: row.blockers.length,
      detail: row.blockers[0] ?? "Onboarding blockers remain.",
      kind: "onboarding-blockers",
      label: "Onboarding blockers",
      nextAction: row.nextAction,
      severity: "blocked"
    });
  }

  if (row.counts.pendingCandidates > 0) {
    issues.push({
      command:
        "npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 10",
      count: row.counts.pendingCandidates,
      detail: `${row.counts.pendingCandidates} pending source candidate(s) still need explicit accept/reject review.`,
      kind: "pending-candidates",
      label: "Pending source candidates",
      nextAction:
        "Review pending candidates in the operator-owned candidate queue; do not auto-accept or auto-reject.",
      severity: "warning"
    });
  }

  if (
    row.sourcePacket.extractionPendingClaims > 0 ||
    row.sourcePacket.pendingReferences > 0 ||
    row.sourcePacket.unlinkedClaims > 0
  ) {
    issues.push({
      command: `npm run onboarding:review-packet -- --supplement ${supplementArg}`,
      count:
        row.sourcePacket.extractionPendingClaims +
        row.sourcePacket.pendingReferences +
        row.sourcePacket.unlinkedClaims,
      detail:
        "Source packet links, references, or structured extraction fields are incomplete.",
      kind: "extraction-gaps",
      label: "Extraction gaps",
      nextAction:
        "Build the review packet and fill structured extraction gaps from traceable reviewed sources.",
      severity: "warning"
    });
  }

  if (row.counts.claims > row.counts.reviewedClaims) {
    issues.push({
      command: `npm run onboarding:review-packet -- --supplement ${supplementArg}`,
      count: row.counts.claims - row.counts.reviewedClaims,
      detail: `${row.counts.reviewedClaims}/${row.counts.claims} claim packet(s) are human-reviewed.`,
      kind: "unreviewed-claims",
      label: "Claim packet review",
      nextAction:
        "Review claim packets with citations, caveats, uncertainty labels, and safety context visible.",
      severity: "warning"
    });
  }

  if (row.counts.safetySignals > 0) {
    issues.push({
      command: `npm run onboarding:review-packet -- --supplement ${supplementArg}`,
      count: row.counts.safetySignals,
      detail: `${row.counts.safetySignals} accepted-packet safety/watchlist signal(s) need caveat review.`,
      kind: "safety-signals",
      label: "Safety caveat monitor",
      nextAction:
        "Review safety/watchlist caveats before any promotion or public wording update.",
      severity: "warning"
    });
  }

  if (row.warnings.length > 0) {
    issues.push({
      command: `npm run onboarding:status -- --supplement ${supplementArg} --summary`,
      count: row.warnings.length,
      detail: row.warnings[0] ?? "Onboarding warnings remain.",
      kind: "onboarding-warnings",
      label: "Onboarding warnings",
      nextAction: row.nextAction,
      severity: "warning"
    });
  }

  if (row.promotion.readyClaims > 0) {
    issues.push({
      command: "npm run promotion:readiness -- --summary",
      count: row.promotion.readyClaims,
      detail: `${row.promotion.readyClaims}/${row.promotion.totalClaims} claim(s) are ready for explicit promotion-readiness review.`,
      kind: "promotion-ready",
      label: "Promotion readiness",
      nextAction:
        "Run promotion readiness before any separate audited public-promotion action.",
      severity: "info"
    });
  }

  return issues;
}

function refreshPolicyForSupplement({
  claims,
  qualityRow,
  regulatoryStatuses,
  safetyAlerts,
  staleAfterDays,
  supplement
}: {
  claims: EvidenceDashboardData["claims"];
  qualityRow: SupplementOnboardingQualityRow;
  regulatoryStatuses: EvidenceDashboardData["australiaRegulatoryStatuses"];
  safetyAlerts: EvidenceDashboardData["safetyAlerts"];
  staleAfterDays: number;
  supplement?: EvidenceDashboardData["interventions"][number];
}): SupplementOnboardingMonitorRefreshPolicy {
  let intervalDays = staleAfterDays;
  let tier: SupplementOnboardingMonitorRefreshTier = "routine";
  const rationale = [
    `Routine reviewed supplement packets start with a ${staleAfterDays}-day refresh interval.`
  ];
  const applyPolicy = (
    nextTier: SupplementOnboardingMonitorRefreshTier,
    days: number,
    reason: string
  ) => {
    if (days < intervalDays) {
      intervalDays = days;
    }

    if (tierRank(nextTier) < tierRank(tier)) {
      tier = nextTier;
    }

    rationale.push(reason);
  };

  if (
    supplement?.category === "Peptide/biologic" ||
    supplement?.category === "Drug/geroprotector watchlist"
  ) {
    applyPolicy(
      "high-attention",
      90,
      "Peptide/biologic and geroprotector-watchlist categories refresh every 90 days."
    );
  }

  if (
    claims.some((claim) =>
      [
        "Avoid / Not Recommended",
        "Regulatory Concern",
        "Requires Clinician Oversight",
        "Safety Concern"
      ].includes(claim.finalLabel)
    )
  ) {
    applyPolicy(
      "high-attention",
      90,
      "Safety, regulatory-concern, avoid, or clinician-oversight labels refresh every 90 days."
    );
  }

  if (
    safetyAlerts.some((alert) =>
      ["Avoid", "Clinician review recommended", "High"].includes(alert.severity)
    ) ||
    qualityRow.counts.safetySignals > 0
  ) {
    applyPolicy(
      "high-attention",
      90,
      "Accepted safety/watchlist signals or high-severity alerts refresh every 90 days."
    );
  }

  if (
    regulatoryStatuses.length === 0 ||
    regulatoryStatuses.some((status) =>
      ["Not in ARTG", "Unknown", "Unapproved"].includes(status.kind)
    )
  ) {
    applyPolicy(
      "watch",
      180,
      "Missing, Unknown, unapproved, or Not in ARTG AU/TGA product-status records refresh every 180 days."
    );
  }

  if (
    qualityRow.counts.pendingCandidates > 0 ||
    qualityRow.counts.reviewedClaims < qualityRow.counts.claims
  ) {
    applyPolicy(
      "watch",
      180,
      "Pending source candidates or unreviewed claim packets refresh every 180 days."
    );
  }

  if (
    claims.some(
      (claim) =>
        claim.confidenceLevel === "Low" ||
        claim.confidenceLevel === "Very low" ||
        claim.finalLabel === "Insufficient Evidence" ||
        claim.finalLabel === "Speculative Watchlist" ||
        claim.momentum === "Conflicting" ||
        claim.momentum === "Safety concern emerging"
    )
  ) {
    applyPolicy(
      "watch",
      180,
      "Low-confidence, speculative, insufficient, conflicting, or safety-emerging claims refresh every 180 days."
    );
  }

  return {
    intervalDays,
    rationale: Array.from(new Set(rationale)),
    tier
  };
}

function globalMonitorIssues({
  fullTextSources,
  sourceTracking
}: {
  fullTextSources: FullTextSourceReadinessSummary;
  sourceTracking: {
    status: "available" | "unavailable";
    unavailableReason?: string;
  };
}): SupplementOnboardingMonitorIssue[] {
  const issues: SupplementOnboardingMonitorIssue[] = [];

  if (sourceTracking.status === "unavailable") {
    issues.push({
      command:
        "npm run onboarding:quality -- --env-file <non-production-env-file> --summary",
      detail:
        sourceTracking.unavailableReason ??
        "Database-backed source tracking is unavailable.",
      kind: "source-tracking-unavailable",
      label: "Source tracking gate",
      nextAction:
        "Rerun onboarding quality with a database env file before relying on queue and candidate maintenance signals.",
      severity: "warning"
    });
  }

  if (!fullTextSources.liveCaptureReady) {
    issues.push({
      command: "npm run onboarding:fulltext-sources -- --next --summary",
      count: fullTextSources.counts.blockedSources,
      detail: `${fullTextSources.counts.blockedSources} full-text source class(es) remain blocked; no live full-text connector is approved.`,
      kind: "full-text-gate-blocked",
      label: "Full-text source gate",
      nextAction:
        "Review source terms, access, retention, and derived-only export before any connector implementation.",
      severity: "warning"
    });
  }

  return sortIssues(issues);
}

function statusForIssues(
  issues: SupplementOnboardingMonitorIssue[]
): SupplementOnboardingMonitorStatus {
  if (issues.some((issue) => issue.severity === "blocked")) {
    return "action-needed";
  }

  if (issues.some((issue) => issue.severity === "warning")) {
    return "watch";
  }

  return "ready";
}

function summarizeRows({
  globalIssues,
  rows
}: {
  globalIssues: SupplementOnboardingMonitorIssue[];
  rows: SupplementOnboardingMonitorRow[];
}): SupplementOnboardingMonitorSummaryCounts {
  return rows.reduce(
    (summary, row) => {
      summary.supplements += 1;

      if (row.status === "action-needed") {
        summary.actionNeededSupplements += 1;
      } else if (row.status === "watch") {
        summary.watchSupplements += 1;
      } else {
        summary.readySupplements += 1;
      }

      if (row.refreshPolicy.tier === "high-attention") {
        summary.highAttentionCadenceSupplements += 1;
      } else if (row.refreshPolicy.tier === "watch") {
        summary.watchCadenceSupplements += 1;
      } else {
        summary.routineCadenceSupplements += 1;
      }

      if (row.issues.some((issue) => issue.kind === "stale-review")) {
        summary.staleReviewSupplements += 1;
      }

      if (row.issues.some((issue) => issue.kind === "missing-product-status")) {
        summary.missingProductStatusSupplements += 1;
      }

      if (row.issues.some((issue) => issue.kind === "unknown-product-status")) {
        summary.unknownProductStatusSupplements += 1;
      }

      if (row.issues.some((issue) => issue.kind === "pending-candidates")) {
        summary.pendingCandidateSupplements += 1;
      }

      if (row.issues.some((issue) => issue.kind === "extraction-gaps")) {
        summary.extractionGapSupplements += 1;
      }

      if (row.issues.some((issue) => issue.kind === "unreviewed-claims")) {
        summary.unreviewedClaimSupplements += 1;
      }

      if (row.issues.some((issue) => issue.kind === "safety-signals")) {
        summary.safetySignalSupplements += 1;
      }

      if (row.issues.some((issue) => issue.kind === "promotion-ready")) {
        summary.promotionReadySupplements += 1;
      }

      return summary;
    },
    {
      actionNeededSupplements: 0,
      extractionGapSupplements: 0,
      fullTextGateBlocked: globalIssues.some(
        (issue) => issue.kind === "full-text-gate-blocked"
      ),
      globalIssues: globalIssues.length,
      highAttentionCadenceSupplements: 0,
      missingProductStatusSupplements: 0,
      pendingCandidateSupplements: 0,
      promotionReadySupplements: 0,
      readySupplements: 0,
      routineCadenceSupplements: 0,
      safetySignalSupplements: 0,
      sourceTrackingUnavailable: globalIssues.some(
        (issue) => issue.kind === "source-tracking-unavailable"
      ),
      staleReviewSupplements: 0,
      supplements: 0,
      unknownProductStatusSupplements: 0,
      unreviewedClaimSupplements: 0,
      watchCadenceSupplements: 0,
      watchSupplements: 0
    }
  );
}

function tierRank(tier: SupplementOnboardingMonitorRefreshTier) {
  if (tier === "high-attention") {
    return 0;
  }

  if (tier === "watch") {
    return 1;
  }

  return 2;
}

function compareMonitorRows(
  left: SupplementOnboardingMonitorRow,
  right: SupplementOnboardingMonitorRow
) {
  return (
    statusRank(left.status) - statusRank(right.status) ||
    issueRank(left.issues[0]) - issueRank(right.issues[0]) ||
    right.issues.length - left.issues.length ||
    left.supplement.name.localeCompare(right.supplement.name)
  );
}

function statusRank(status: SupplementOnboardingMonitorStatus) {
  if (status === "action-needed") {
    return 0;
  }

  if (status === "watch") {
    return 1;
  }

  return 2;
}

function sortIssues(issues: SupplementOnboardingMonitorIssue[]) {
  return [...issues].sort(
    (left, right) =>
      issueRank(left) - issueRank(right) ||
      left.label.localeCompare(right.label)
  );
}

function issueRank(issue?: SupplementOnboardingMonitorIssue) {
  if (!issue) {
    return 3;
  }

  if (issue.severity === "blocked") {
    return 0;
  }

  if (issue.severity === "warning") {
    return 1;
  }

  return 2;
}

function oldestReviewEvidenceDate(values: Array<string | undefined>) {
  const parsed = values
    .map((value) => parseDate(value))
    .filter((value): value is Date => Boolean(value))
    .sort((left, right) => left.getTime() - right.getTime());

  return parsed[0]?.toISOString().slice(0, 10);
}

function parseDate(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function daysBetween(start: Date, end: Date) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay));
}

function quote(value: string) {
  return JSON.stringify(value);
}

function normalizeQuery(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}
