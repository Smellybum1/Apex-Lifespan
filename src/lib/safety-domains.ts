import type { AustraliaRegulatoryKind, AustraliaRegulatoryStatus, SafetyAlert } from "@/lib/types";

export type SafetyDomainId =
  | "clinical_safety"
  | "product_quality"
  | "regulatory_access"
  | "sport_eligibility";

export interface SafetyDomain {
  description: string;
  id: SafetyDomainId;
  label: string;
}

export interface SafetyDomainSummary extends SafetyDomain {
  alertCount: number;
  alertTypes: SafetyAlert["alertType"][];
  highestSeverity: SafetyAlert["severity"];
  regions: string[];
}

export interface SafetyDomainCoverage extends SafetyDomain {
  alertCount: number;
  alertTypes: SafetyAlert["alertType"][];
  regions: string[];
  status: "reviewed-alerts-captured" | "not-yet-captured";
  statusLabel: string;
}

export interface RegionalSafetyRegulatoryCoverage {
  australiaRegulatoryKinds: AustraliaRegulatoryKind[];
  australiaRegulatoryStatusCount: number;
  highestSafetySeverity?: SafetyAlert["severity"];
  highestSafetySeverityLabel: SafetyAlert["severity"] | "No reviewed safety alert";
  region: string;
  reviewScopeLabel: string;
  safetyAlertCount: number;
  safetyAlertTypes: SafetyAlert["alertType"][];
  scopeLabel:
    | "Safety alerts and AU/TGA records"
    | "Safety alerts only"
    | "AU/TGA records only"
    | "Not yet captured";
  status: "captured-records" | "not-yet-captured";
  statusLabel: "Captured records" | "Not yet captured in reviewed local records";
}

export interface RegionalSafetyDomainCell extends SafetyDomain {
  alertCount: number;
  alertTypes: SafetyAlert["alertType"][];
  highestSeverity?: SafetyAlert["severity"];
  highestSeverityLabel: SafetyAlert["severity"] | "No reviewed safety alert";
  status: "reviewed-alerts-captured" | "not-yet-captured";
  statusLabel: "Reviewed alerts captured" | "Not yet captured in reviewed alerts";
}

export interface RegionalSafetyDomainCoverage {
  alertCount: number;
  domains: RegionalSafetyDomainCell[];
  region: string;
  reviewScopeLabel: string;
  reviewedDomainCount: number;
  totalDomainCount: number;
}

export interface RegionalSafetyRegulatoryReviewGap {
  australiaRegulatoryKinds: AustraliaRegulatoryKind[];
  australiaRegulatoryStatusCount: number;
  capturedSafetyDomainLabels: string[];
  capturedSafetyDomains: SafetyDomainId[];
  missingSafetyDomainLabels: string[];
  missingSafetyDomains: SafetyDomainId[];
  nextAction: string;
  noClearanceInferred: true;
  region: string;
  reviewGapStatus:
    | "captured-all-safety-domains"
    | "captured-with-domain-gaps"
    | "not-yet-captured";
  reviewPriority:
    | "primary-lens-gap"
    | "captured-record-gap"
    | "unstarted-configured-scope"
    | "monitoring";
  reviewPriorityLabel: string;
  reviewScopeLabel: string;
  safetyAlertCount: number;
  scopeLabel: RegionalSafetyRegulatoryCoverage["scopeLabel"];
  status: RegionalSafetyRegulatoryCoverage["status"];
}

const SAFETY_DOMAINS: Record<SafetyDomainId, SafetyDomain> = {
  clinical_safety: {
    description:
      "Adverse-event, organ-system, interaction, or clinician-review signals captured in local evidence.",
    id: "clinical_safety",
    label: "Clinical safety"
  },
  product_quality: {
    description:
      "Product-quality signals such as contamination, adulteration, or mislabeling.",
    id: "product_quality",
    label: "Product quality"
  },
  regulatory_access: {
    description:
      "Regulatory access, prescription, approval, or compounding-context signals.",
    id: "regulatory_access",
    label: "Regulatory access"
  },
  sport_eligibility: {
    description:
      "Sport participation or prohibited-in-sport review signals when captured from a reviewed source.",
    id: "sport_eligibility",
    label: "Sport eligibility"
  }
};

const severityOrder: SafetyAlert["severity"][] = [
  "Low",
  "Moderate",
  "High",
  "Clinician review recommended",
  "Avoid"
];

const REGIONAL_REVIEW_SCOPES = [
  "Australia",
  "Canada",
  "European Union",
  "United Kingdom",
  "United States",
  "General"
];

const REVIEW_SCOPE_LABELS: Record<string, string> = {
  Australia: "Australia/TGA primary lens",
  Canada: "Configured Canadian review scope",
  "European Union": "Configured EU review scope",
  "United Kingdom": "Configured UK review scope",
  "United States": "Configured US review scope",
  General: "General or cross-region safety context"
};

const REGION_ALIASES: Record<string, string> = {
  au: "Australia",
  australia: "Australia",
  ca: "Canada",
  canada: "Canada",
  eu: "European Union",
  europe: "European Union",
  "european union": "European Union",
  general: "General",
  global: "General",
  international: "General",
  uk: "United Kingdom",
  "u.k.": "United Kingdom",
  "united kingdom": "United Kingdom",
  "great britain": "United Kingdom",
  gb: "United Kingdom",
  us: "United States",
  "u.s.": "United States",
  usa: "United States",
  "u.s.a.": "United States",
  "united states": "United States",
  "united states of america": "United States"
};

export function safetyDomainForAlertType(alertType: SafetyAlert["alertType"]): SafetyDomain {
  if (
    alertType === "Liver injury" ||
    alertType === "Kidney risk" ||
    alertType === "Drug interaction"
  ) {
    return SAFETY_DOMAINS.clinical_safety;
  }

  if (
    alertType === "Contamination" ||
    alertType === "Adulteration" ||
    alertType === "Mislabeling"
  ) {
    return SAFETY_DOMAINS.product_quality;
  }

  if (alertType === "Prohibited in sport") {
    return SAFETY_DOMAINS.sport_eligibility;
  }

  return SAFETY_DOMAINS.regulatory_access;
}

export function summarizeSafetyAlertsByDomain(
  alerts: SafetyAlert[]
): SafetyDomainSummary[] {
  const summariesByDomain = new Map<SafetyDomainId, SafetyDomainSummary>();

  for (const alert of alerts) {
    const domain = safetyDomainForAlertType(alert.alertType);
    const summary = summariesByDomain.get(domain.id) ?? {
      ...domain,
      alertCount: 0,
      alertTypes: [],
      highestSeverity: "Low",
      regions: []
    };

    summary.alertCount += 1;
    summary.alertTypes = uniqueSorted([...summary.alertTypes, alert.alertType]);
    summary.highestSeverity = highestSeverity(summary.highestSeverity, alert.severity);
    summary.regions = uniqueSorted([
      ...summary.regions,
      normalizeSafetyReviewRegion(alert.region)
    ]);
    summariesByDomain.set(domain.id, summary);
  }

  return Array.from(summariesByDomain.values()).sort(
    (left, right) =>
      severityRank(right.highestSeverity) - severityRank(left.highestSeverity) ||
      right.alertCount - left.alertCount ||
      left.label.localeCompare(right.label)
  );
}

export function summarizeSafetyDomainCoverage(alerts: SafetyAlert[]): SafetyDomainCoverage[] {
  const summariesByDomain = new Map(
    summarizeSafetyAlertsByDomain(alerts).map((summary) => [summary.id, summary])
  );

  return Object.values(SAFETY_DOMAINS).map((domain) => {
    const summary = summariesByDomain.get(domain.id);

    if (!summary) {
      return {
        ...domain,
        alertCount: 0,
        alertTypes: [],
        regions: [],
        status: "not-yet-captured",
        statusLabel: "Not yet captured in reviewed alerts"
      };
    }

    return {
      ...domain,
      alertCount: summary.alertCount,
      alertTypes: summary.alertTypes,
      regions: summary.regions,
      status: "reviewed-alerts-captured",
      statusLabel: "Reviewed alerts captured"
    };
  });
}

export function summarizeRegionalSafetyDomainCoverage(
  alerts: SafetyAlert[]
): RegionalSafetyDomainCoverage[] {
  const coverageByRegion = new Map<string, MutableRegionalSafetyDomainCoverage>(
    REGIONAL_REVIEW_SCOPES.map((region) => [region, emptyRegionalDomainCoverage(region)])
  );

  for (const alert of alerts) {
    const region = normalizeSafetyReviewRegion(alert.region);
    const coverage = coverageByRegion.get(region) ?? emptyRegionalDomainCoverage(region);
    const domain = safetyDomainForAlertType(alert.alertType);
    const domainCoverage =
      coverage.domainsById.get(domain.id) ?? emptyRegionalDomainCell(domain);

    coverage.alertCount += 1;
    domainCoverage.alertCount += 1;
    domainCoverage.alertTypes = uniqueSorted([
      ...domainCoverage.alertTypes,
      alert.alertType
    ]);
    domainCoverage.highestSeverity = domainCoverage.highestSeverity
      ? highestSeverity(domainCoverage.highestSeverity, alert.severity)
      : alert.severity;
    coverage.domainsById.set(domain.id, domainCoverage);
    coverageByRegion.set(region, coverage);
  }

  return Array.from(coverageByRegion.values())
    .map((coverage) => {
      const domains = Object.values(SAFETY_DOMAINS).map((domain) =>
        finalizeRegionalDomainCell(
          coverage.domainsById.get(domain.id) ?? emptyRegionalDomainCell(domain)
        )
      );

      return {
        alertCount: coverage.alertCount,
        domains,
        region: coverage.region,
        reviewScopeLabel: coverage.reviewScopeLabel,
        reviewedDomainCount: domains.filter(
          (domain) => domain.status === "reviewed-alerts-captured"
        ).length,
        totalDomainCount: domains.length
      };
    })
    .sort(
      (left, right) =>
        Number(right.alertCount > 0) - Number(left.alertCount > 0) ||
        right.reviewedDomainCount - left.reviewedDomainCount ||
        right.alertCount - left.alertCount ||
        reviewScopeRank(left.region) - reviewScopeRank(right.region) ||
        left.region.localeCompare(right.region)
    );
}

export function summarizeRegionalSafetyRegulatoryCoverage({
  australiaRegulatoryStatuses,
  safetyAlerts
}: {
  australiaRegulatoryStatuses: AustraliaRegulatoryStatus[];
  safetyAlerts: SafetyAlert[];
}): RegionalSafetyRegulatoryCoverage[] {
  const coverageByRegion = new Map<string, RegionalSafetyRegulatoryCoverage>(
    REGIONAL_REVIEW_SCOPES.map((region) => [region, emptyRegionalCoverage(region)])
  );

  for (const alert of safetyAlerts) {
    const region = normalizeSafetyReviewRegion(alert.region);
    const coverage = coverageByRegion.get(region) ?? emptyRegionalCoverage(region);

    coverage.safetyAlertCount += 1;
    coverage.safetyAlertTypes = uniqueSorted([...coverage.safetyAlertTypes, alert.alertType]);
    coverage.highestSafetySeverity = coverage.highestSafetySeverity
      ? highestSeverity(coverage.highestSafetySeverity, alert.severity)
      : alert.severity;
    coverageByRegion.set(region, coverage);
  }

  for (const status of australiaRegulatoryStatuses) {
    const region = normalizeSafetyReviewRegion(status.region);
    const coverage = coverageByRegion.get(region) ?? emptyRegionalCoverage(region);

    coverage.australiaRegulatoryStatusCount += 1;
    coverage.australiaRegulatoryKinds = uniqueSorted([
      ...coverage.australiaRegulatoryKinds,
      status.kind
    ]);
    coverageByRegion.set(region, coverage);
  }

  return Array.from(coverageByRegion.values())
    .map((coverage) => ({
      ...coverage,
      highestSafetySeverityLabel: regionalHighestSafetySeverityLabel(coverage),
      scopeLabel: regionalScopeLabel(coverage),
      status: regionalCoverageStatus(coverage),
      statusLabel: regionalCoverageStatusLabel(coverage)
    }))
    .sort(
      (left, right) =>
        Number(right.status === "captured-records") -
          Number(left.status === "captured-records") ||
        Number(right.scopeLabel === "Safety alerts and AU/TGA records") -
          Number(left.scopeLabel === "Safety alerts and AU/TGA records") ||
        right.australiaRegulatoryStatusCount - left.australiaRegulatoryStatusCount ||
        right.safetyAlertCount - left.safetyAlertCount ||
        reviewScopeRank(left.region) - reviewScopeRank(right.region) ||
        left.region.localeCompare(right.region)
  );
}

export function summarizeRegionalSafetyRegulatoryReviewGaps({
  australiaRegulatoryStatuses,
  safetyAlerts
}: {
  australiaRegulatoryStatuses: AustraliaRegulatoryStatus[];
  safetyAlerts: SafetyAlert[];
}): RegionalSafetyRegulatoryReviewGap[] {
  const domainCoverageByRegion = new Map(
    summarizeRegionalSafetyDomainCoverage(safetyAlerts).map((coverage) => [
      coverage.region,
      coverage
    ])
  );

  return summarizeRegionalSafetyRegulatoryCoverage({
    australiaRegulatoryStatuses,
    safetyAlerts
  }).map((coverage) => {
    const domainCoverage =
      domainCoverageByRegion.get(coverage.region) ??
      finalizeRegionalDomainCoverage(emptyRegionalDomainCoverage(coverage.region));
    const capturedDomains = domainCoverage.domains.filter(
      (domain) => domain.status === "reviewed-alerts-captured"
    );
    const missingDomains = domainCoverage.domains.filter(
      (domain) => domain.status === "not-yet-captured"
    );
    const reviewGapStatus = regionalReviewGapStatus({
      missingSafetyDomains: missingDomains.length,
      status: coverage.status
    });
    const reviewPriority = regionalReviewGapPriority({
      region: coverage.region,
      reviewGapStatus
    });

    return {
      australiaRegulatoryKinds: coverage.australiaRegulatoryKinds,
      australiaRegulatoryStatusCount: coverage.australiaRegulatoryStatusCount,
      capturedSafetyDomainLabels: capturedDomains.map((domain) => domain.label),
      capturedSafetyDomains: capturedDomains.map((domain) => domain.id),
      missingSafetyDomainLabels: missingDomains.map((domain) => domain.label),
      missingSafetyDomains: missingDomains.map((domain) => domain.id),
      nextAction: regionalReviewGapNextAction({
        missingDomainLabels: missingDomains.map((domain) => domain.label),
        region: coverage.region,
        reviewGapStatus
      }),
      noClearanceInferred: true,
      region: coverage.region,
      reviewGapStatus,
      reviewPriority,
      reviewPriorityLabel: regionalReviewGapPriorityLabel(reviewPriority),
      reviewScopeLabel: coverage.reviewScopeLabel,
      safetyAlertCount: coverage.safetyAlertCount,
      scopeLabel: coverage.scopeLabel,
      status: coverage.status
    };
  });
}

export function normalizeSafetyReviewRegion(region: string) {
  const trimmedRegion = region.trim();
  const normalizedRegion = trimmedRegion.toLowerCase();

  return REGION_ALIASES[normalizedRegion] ?? trimmedRegion;
}

export function formatSafetyAlertRegionLabel(region: string) {
  const trimmedRegion = region.trim();
  const reviewRegion = normalizeSafetyReviewRegion(trimmedRegion);

  return reviewRegion === trimmedRegion ? reviewRegion : `${reviewRegion} (${trimmedRegion})`;
}

type MutableRegionalSafetyDomainCoverage = Omit<
  RegionalSafetyDomainCoverage,
  "domains" | "reviewedDomainCount" | "totalDomainCount"
> & {
  domainsById: Map<SafetyDomainId, RegionalSafetyDomainCell>;
};

function emptyRegionalDomainCoverage(region: string): MutableRegionalSafetyDomainCoverage {
  return {
    alertCount: 0,
    domainsById: new Map(),
    region,
    reviewScopeLabel: reviewScopeLabelForRegion(region)
  };
}

function finalizeRegionalDomainCoverage(
  coverage: MutableRegionalSafetyDomainCoverage
): RegionalSafetyDomainCoverage {
  const domains = Object.values(SAFETY_DOMAINS).map((domain) =>
    finalizeRegionalDomainCell(
      coverage.domainsById.get(domain.id) ?? emptyRegionalDomainCell(domain)
    )
  );

  return {
    alertCount: coverage.alertCount,
    domains,
    region: coverage.region,
    reviewScopeLabel: coverage.reviewScopeLabel,
    reviewedDomainCount: domains.filter((domain) => domain.status === "reviewed-alerts-captured")
      .length,
    totalDomainCount: domains.length
  };
}

function emptyRegionalDomainCell(domain: SafetyDomain): RegionalSafetyDomainCell {
  return {
    ...domain,
    alertCount: 0,
    alertTypes: [],
    highestSeverityLabel: "No reviewed safety alert",
    status: "not-yet-captured",
    statusLabel: "Not yet captured in reviewed alerts"
  };
}

function finalizeRegionalDomainCell(
  domain: RegionalSafetyDomainCell
): RegionalSafetyDomainCell {
  const status =
    domain.alertCount > 0 ? "reviewed-alerts-captured" : "not-yet-captured";

  return {
    ...domain,
    highestSeverityLabel: domain.highestSeverity ?? "No reviewed safety alert",
    status,
    statusLabel:
      status === "reviewed-alerts-captured"
        ? "Reviewed alerts captured"
        : "Not yet captured in reviewed alerts"
  };
}

function emptyRegionalCoverage(region: string): RegionalSafetyRegulatoryCoverage {
  return {
    australiaRegulatoryKinds: [],
    australiaRegulatoryStatusCount: 0,
    highestSafetySeverityLabel: "No reviewed safety alert",
    region,
    reviewScopeLabel: reviewScopeLabelForRegion(region),
    safetyAlertCount: 0,
    safetyAlertTypes: [],
    scopeLabel: "Not yet captured",
    status: "not-yet-captured",
    statusLabel: "Not yet captured in reviewed local records"
  };
}

function regionalScopeLabel(
  coverage: Pick<
    RegionalSafetyRegulatoryCoverage,
    "australiaRegulatoryStatusCount" | "safetyAlertCount"
  >
): RegionalSafetyRegulatoryCoverage["scopeLabel"] {
  if (coverage.safetyAlertCount === 0 && coverage.australiaRegulatoryStatusCount === 0) {
    return "Not yet captured";
  }

  if (coverage.safetyAlertCount > 0 && coverage.australiaRegulatoryStatusCount > 0) {
    return "Safety alerts and AU/TGA records";
  }

  if (coverage.australiaRegulatoryStatusCount > 0) {
    return "AU/TGA records only";
  }

  return "Safety alerts only";
}

function regionalHighestSafetySeverityLabel(
  coverage: Pick<RegionalSafetyRegulatoryCoverage, "highestSafetySeverity">
): RegionalSafetyRegulatoryCoverage["highestSafetySeverityLabel"] {
  return coverage.highestSafetySeverity ?? "No reviewed safety alert";
}

function regionalCoverageStatus(
  coverage: Pick<
    RegionalSafetyRegulatoryCoverage,
    "australiaRegulatoryStatusCount" | "safetyAlertCount"
  >
): RegionalSafetyRegulatoryCoverage["status"] {
  return coverage.safetyAlertCount > 0 || coverage.australiaRegulatoryStatusCount > 0
    ? "captured-records"
    : "not-yet-captured";
}

function regionalCoverageStatusLabel(
  coverage: Pick<
    RegionalSafetyRegulatoryCoverage,
    "australiaRegulatoryStatusCount" | "safetyAlertCount"
  >
): RegionalSafetyRegulatoryCoverage["statusLabel"] {
  return regionalCoverageStatus(coverage) === "captured-records"
    ? "Captured records"
    : "Not yet captured in reviewed local records";
}

function regionalReviewGapStatus({
  missingSafetyDomains,
  status
}: {
  missingSafetyDomains: number;
  status: RegionalSafetyRegulatoryCoverage["status"];
}): RegionalSafetyRegulatoryReviewGap["reviewGapStatus"] {
  if (status === "not-yet-captured") {
    return "not-yet-captured";
  }

  return missingSafetyDomains > 0
    ? "captured-with-domain-gaps"
    : "captured-all-safety-domains";
}

function regionalReviewGapNextAction({
  missingDomainLabels,
  region,
  reviewGapStatus
}: {
  missingDomainLabels: string[];
  region: string;
  reviewGapStatus: RegionalSafetyRegulatoryReviewGap["reviewGapStatus"];
}) {
  if (reviewGapStatus === "not-yet-captured") {
    return `Capture reviewed region-specific safety or regulatory records for ${region}; absent records are review gaps, not clearance.`;
  }

  if (reviewGapStatus === "captured-with-domain-gaps") {
    return `Review missing safety domains for ${region}: ${missingDomainLabels.join(", ")}. Do not treat captured records as regional clearance.`;
  }

  return `Maintain review cadence for ${region}; all configured safety domains have reviewed local alerts, but this still is not product clearance.`;
}

function regionalReviewGapPriority({
  region,
  reviewGapStatus
}: {
  region: string;
  reviewGapStatus: RegionalSafetyRegulatoryReviewGap["reviewGapStatus"];
}): RegionalSafetyRegulatoryReviewGap["reviewPriority"] {
  if (reviewGapStatus === "captured-all-safety-domains") {
    return "monitoring";
  }

  if (region === "Australia") {
    return "primary-lens-gap";
  }

  if (reviewGapStatus === "captured-with-domain-gaps") {
    return "captured-record-gap";
  }

  return "unstarted-configured-scope";
}

function regionalReviewGapPriorityLabel(
  priority: RegionalSafetyRegulatoryReviewGap["reviewPriority"]
): RegionalSafetyRegulatoryReviewGap["reviewPriorityLabel"] {
  if (priority === "primary-lens-gap") {
    return "Primary AU/TGA review gap";
  }

  if (priority === "captured-record-gap") {
    return "Captured records need domain follow-up";
  }

  if (priority === "unstarted-configured-scope") {
    return "Configured scope not yet captured";
  }

  return "Current domain model captured; maintain review cadence";
}

function reviewScopeRank(region: string) {
  const index = REGIONAL_REVIEW_SCOPES.indexOf(region);

  return index === -1 ? REGIONAL_REVIEW_SCOPES.length : index;
}

function reviewScopeLabelForRegion(region: string) {
  return REVIEW_SCOPE_LABELS[region] ?? "Additional reviewed regional scope";
}

function highestSeverity(
  left: SafetyAlert["severity"],
  right: SafetyAlert["severity"]
): SafetyAlert["severity"] {
  return severityRank(right) > severityRank(left) ? right : left;
}

function severityRank(severity: SafetyAlert["severity"]) {
  return severityOrder.indexOf(severity);
}

function uniqueSorted<T extends string>(values: T[]) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}
