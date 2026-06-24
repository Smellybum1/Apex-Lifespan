export type ProductAnalyticsKpiArea =
  | "evidence_quality"
  | "ingestion_health"
  | "operator_workflow_health"
  | "public_usage"
  | "user_feedback";

export type ProductAnalyticsMetricKind = "driver" | "guardrail" | "primary";
export type ProductAnalyticsTargetDirection = "decrease" | "increase" | "maintain_zero";

export interface ProductAnalyticsKpiDefinition {
  allowedDimensions: string[];
  area: ProductAnalyticsKpiArea;
  cadence: "daily" | "weekly" | "post-launch-review";
  caveats: string[];
  calculation: string;
  decision: string;
  definition: string;
  forbiddenFields: string[];
  guardrailNotes: string[];
  id: string;
  kind: ProductAnalyticsMetricKind;
  label: string;
  owner: "evidence reviewer" | "operator" | "product operator";
  privacyClassification: "aggregate-only" | "derived-operational" | "public-backlog-metadata";
  sourceOfTruth: string;
  targetDirection: ProductAnalyticsTargetDirection;
}

export interface ProductAnalyticsKpiAreaSummary {
  area: ProductAnalyticsKpiArea;
  driverMetricIds: string[];
  guardrailMetricIds: string[];
  label: string;
  primaryMetricIds: string[];
}

export interface ProductAnalyticsMonitoringLink {
  command?: string;
  href?: string;
  id: string;
  label: string;
  mode: "read-only" | "requires-provider-setup";
}

export interface ProductAnalyticsPrivacyReview {
  aggregateOnly: true;
  blockers: string[];
  forbiddenFields: string[];
  notes: string[];
  publicRoutesReadOnly: true;
  status: "blocked" | "ready";
}

export interface ProductAnalyticsKpiFramework {
  areaSummaries: ProductAnalyticsKpiAreaSummary[];
  dashboardBlueprints: ProductAnalyticsDashboardBlueprint[];
  generatedAt: string;
  kpis: ProductAnalyticsKpiDefinition[];
  monitoringLinks: ProductAnalyticsMonitoringLink[];
  nextAction: string;
  privacyReview: ProductAnalyticsPrivacyReview;
}

export interface ProductAnalyticsKpiSummary {
  areaSummaries: ProductAnalyticsKpiAreaSummary[];
  dashboardBlueprints: ProductAnalyticsDashboardSummary[];
  generatedAt: string;
  kpiCount: number;
  monitoringLinks: ProductAnalyticsMonitoringLink[];
  nextAction: string;
  privacyReview: ProductAnalyticsPrivacyReview;
}

export interface ProductAnalyticsDashboardBlueprint {
  audience: "evidence reviewer" | "operator" | "product operator";
  cadence: "daily" | "weekly" | "post-launch-review";
  id: string;
  label: string;
  panels: ProductAnalyticsDashboardPanel[];
  privacyNotes: string[];
  sourceGaps: string[];
  status: "provider-neutral-ready" | "requires-provider-setup";
}

export interface ProductAnalyticsDashboardPanel {
  caveats: string[];
  decision: string;
  driverMetricIds: string[];
  guardrailMetricIds: string[];
  id: string;
  label: string;
  primaryMetricIds: string[];
  requiredSource: string;
  sourceStatus: "available-after-reviewed-export" | "requires-aggregate-provider";
}

export interface ProductAnalyticsDashboardSummary {
  id: string;
  label: string;
  panelCount: number;
  sourceGaps: string[];
  status: ProductAnalyticsDashboardBlueprint["status"];
}

export interface ProductAnalyticsAggregateRow {
  [key: string]: unknown;
  dimensions?: Record<string, unknown>;
  metricId?: string;
  periodEnd?: string;
  periodStart?: string;
  sourceLabel?: string;
  value?: unknown;
}

export interface ProductAnalyticsAggregateValidationIssue {
  field: string;
  message: string;
  metricId?: string;
  rowIndex?: number;
}

export interface ProductAnalyticsAggregateValidation {
  acceptedMetricIds: string[];
  issueCount: number;
  issues: ProductAnalyticsAggregateValidationIssue[];
  nextAction: string;
  rowCount: number;
  status: "blocked" | "ready";
}

export interface ProductAnalyticsAggregateMetricSchema {
  allowedDimensions: string[];
  area: ProductAnalyticsKpiArea;
  cadence: ProductAnalyticsKpiDefinition["cadence"];
  kind: ProductAnalyticsMetricKind;
  label: string;
  metricId: string;
  privacyClassification: ProductAnalyticsKpiDefinition["privacyClassification"];
  sourceStatus: ProductAnalyticsDashboardPanel["sourceStatus"];
  targetDirection: ProductAnalyticsTargetDirection;
}

export interface ProductAnalyticsAggregateSchema {
  aggregateOnly: true;
  allowedTopLevelFields: string[];
  forbiddenFields: string[];
  metrics: ProductAnalyticsAggregateMetricSchema[];
  nextAction: string;
  optionalTopLevelFields: string[];
  publicRoutesReadOnly: true;
  readOnly: true;
  requiredTopLevelFields: string[];
  sourceReviewRequired: true;
}

const REQUIRED_AREAS: ProductAnalyticsKpiArea[] = [
  "public_usage",
  "operator_workflow_health",
  "ingestion_health",
  "evidence_quality",
  "user_feedback"
];

const FORBIDDEN_ANALYTICS_FIELDS = [
  "email",
  "free_text_health_detail",
  "full_ip_address",
  "medical_question_text",
  "raw_label_upload",
  "raw_search_query",
  "session_replay",
  "user_id"
];

const ALLOWED_AGGREGATE_ROW_FIELDS = [
  "dimensions",
  "metricId",
  "periodEnd",
  "periodStart",
  "sourceLabel",
  "value"
];

export function buildProductAnalyticsKpiFramework({
  generatedAt = new Date()
}: {
  generatedAt?: Date;
} = {}): ProductAnalyticsKpiFramework {
  const kpis = productAnalyticsKpis();
  const dashboardBlueprints = productAnalyticsDashboardBlueprints();
  const privacyReview = buildPrivacyReview(kpis);

  return {
    areaSummaries: REQUIRED_AREAS.map((area) => areaSummary(area, kpis)),
    dashboardBlueprints,
    generatedAt: generatedAt.toISOString(),
    kpis,
    monitoringLinks: productAnalyticsMonitoringLinks(),
    nextAction:
      privacyReview.status === "ready"
        ? "Provider-neutral dashboard blueprints are ready; choose a privacy-preserving aggregate analytics source before connecting real public usage outputs."
        : "Resolve KPI privacy blockers before enabling product analytics.",
    privacyReview
  };
}

export function summarizeProductAnalyticsKpiFramework(
  framework: ProductAnalyticsKpiFramework
): ProductAnalyticsKpiSummary {
  return {
    areaSummaries: framework.areaSummaries,
    dashboardBlueprints: framework.dashboardBlueprints.map((blueprint) => ({
      id: blueprint.id,
      label: blueprint.label,
      panelCount: blueprint.panels.length,
      sourceGaps: blueprint.sourceGaps,
      status: blueprint.status
    })),
    generatedAt: framework.generatedAt,
    kpiCount: framework.kpis.length,
    monitoringLinks: framework.monitoringLinks,
    nextAction: framework.nextAction,
    privacyReview: framework.privacyReview
  };
}

export function validateProductAnalyticsAggregateRows(
  rows: ProductAnalyticsAggregateRow[],
  framework = buildProductAnalyticsKpiFramework()
): ProductAnalyticsAggregateValidation {
  const kpisById = new Map(framework.kpis.map((kpi) => [kpi.id, kpi]));
  const issues = rows.flatMap((row, rowIndex) =>
    validateProductAnalyticsAggregateRow({
      forbiddenFields: framework.privacyReview.forbiddenFields,
      kpisById,
      row,
      rowIndex
    })
  );
  const acceptedMetricIds = uniqueSorted(
    rows
      .map((row) => row.metricId)
      .filter((metricId): metricId is string => Boolean(metricId && kpisById.has(metricId)))
  );

  return {
    acceptedMetricIds,
    issueCount: issues.length,
    issues,
    nextAction:
      issues.length === 0
        ? "Aggregate rows match the provider-neutral KPI schema; source review is still required before connecting real outputs."
        : "Remove forbidden fields, undeclared payload fields or dimensions, malformed values, and invalid periods before connecting analytics outputs.",
    rowCount: rows.length,
    status: issues.length > 0 ? "blocked" : "ready"
  };
}

export function buildProductAnalyticsAggregateSchema(
  framework = buildProductAnalyticsKpiFramework()
): ProductAnalyticsAggregateSchema {
  const sourceStatusByMetric = aggregateSourceStatusByMetric(framework.dashboardBlueprints);

  return {
    aggregateOnly: true,
    allowedTopLevelFields: ALLOWED_AGGREGATE_ROW_FIELDS,
    forbiddenFields: framework.privacyReview.forbiddenFields,
    metrics: framework.kpis.map((kpi) => ({
      allowedDimensions: kpi.allowedDimensions,
      area: kpi.area,
      cadence: kpi.cadence,
      kind: kpi.kind,
      label: kpi.label,
      metricId: kpi.id,
      privacyClassification: kpi.privacyClassification,
      sourceStatus: sourceStatusByMetric.get(kpi.id) ?? "available-after-reviewed-export",
      targetDirection: kpi.targetDirection
    })),
    nextAction:
      "Use this schema to review provider-neutral aggregate exports before connecting analytics outputs; public usage metrics still require a privacy-preserving aggregate provider choice.",
    optionalTopLevelFields: ["dimensions", "periodEnd", "periodStart", "sourceLabel"],
    publicRoutesReadOnly: true,
    readOnly: true,
    requiredTopLevelFields: ["metricId", "value"],
    sourceReviewRequired: true
  };
}

function productAnalyticsKpis(): ProductAnalyticsKpiDefinition[] {
  return [
    {
      id: "public-qualified-evidence-sessions",
      label: "Qualified public evidence sessions",
      area: "public_usage",
      kind: "primary",
      definition:
        "Aggregate sessions that reach the dashboard or an intervention detail page and view at least one evidence, safety, regulatory, or source-packet surface.",
      calculation:
        "count_distinct_aggregate_sessions(route_group in dashboard/detail and evidence_surface_viewed=true)",
      sourceOfTruth:
        "Privacy-preserving aggregate analytics export after provider setup; public routes remain read-only.",
      allowedDimensions: ["route_group", "intervention_id", "surface_type", "week"],
      forbiddenFields: FORBIDDEN_ANALYTICS_FIELDS,
      privacyClassification: "aggregate-only",
      cadence: "weekly",
      owner: "product operator",
      targetDirection: "increase",
      decision:
        "Shows whether public users are reaching the evidence intelligence surfaces rather than only landing on static pages.",
      caveats: [
        "This is a proxy for engagement, not medical usefulness or evidence quality.",
        "Do not segment by individual, health condition, exact search phrase, or raw label text."
      ],
      guardrailNotes: [
        "Pair with feedback and safety/escalation metrics before treating traffic growth as product success."
      ]
    },
    {
      id: "public-detail-depth-rate",
      label: "Detail-depth rate",
      area: "public_usage",
      kind: "driver",
      definition:
        "Share of qualified public evidence sessions that open an intervention detail page or source packet panel.",
      calculation:
        "qualified_sessions_with_detail_or_source_packet / qualified_public_evidence_sessions",
      sourceOfTruth: "Aggregate analytics export and read-only route taxonomy.",
      allowedDimensions: ["route_group", "surface_type", "week"],
      forbiddenFields: FORBIDDEN_ANALYTICS_FIELDS,
      privacyClassification: "aggregate-only",
      cadence: "weekly",
      owner: "product operator",
      targetDirection: "increase",
      decision:
        "Helps diagnose whether users are drilling into traceability and uncertainty context.",
      caveats: ["Depth can rise because navigation is confusing; review feedback alongside this metric."],
      guardrailNotes: ["No session replay or per-user journey reconstruction."]
    },
    {
      id: "public-analytics-sensitive-field-incidents",
      label: "Sensitive analytics field incidents",
      area: "public_usage",
      kind: "guardrail",
      definition:
        "Any public analytics payload, dashboard export, or monitoring report that includes forbidden user-level, private health, raw search, raw label, or session-replay fields.",
      calculation:
        "count(public_analytics_payloads where field_name in forbidden_analytics_fields)",
      sourceOfTruth: "Analytics provider schema review and product analytics KPI privacy review.",
      allowedDimensions: ["surface_type", "field_category", "week"],
      forbiddenFields: FORBIDDEN_ANALYTICS_FIELDS,
      privacyClassification: "aggregate-only",
      cadence: "weekly",
      owner: "product operator",
      targetDirection: "maintain_zero",
      decision:
        "Confirms public usage measurement is not weakening privacy or medical-advice boundaries.",
      caveats: [
        "This guardrail should be checked before enabling a new analytics provider or dashboard."
      ],
      guardrailNotes: [
        "A non-zero value should pause public analytics expansion until the schema is corrected."
      ]
    },
    {
      id: "operator-review-throughput",
      label: "Operator review throughput",
      area: "operator_workflow_health",
      kind: "primary",
      definition:
        "Human-reviewed claim packets, source candidates, trial alerts, and changelog entries completed per week.",
      calculation:
        "count(review_events where eventType in human_reviewed/source_packet_updated/claim_score_updated and createdAt in week)",
      sourceOfTruth: "ReviewEvent, PublicChangelogEntry, TrialAlert, and operator audit aggregates.",
      allowedDimensions: ["entity_type", "review_status", "operator_role", "week"],
      forbiddenFields: FORBIDDEN_ANALYTICS_FIELDS,
      privacyClassification: "derived-operational",
      cadence: "weekly",
      owner: "operator",
      targetDirection: "increase",
      decision:
        "Shows whether the human-owned review loop is keeping pace with ingestion and roadmap expansion.",
      caveats: [
        "Throughput is not a quality metric; do not reward faster promotion without source traceability.",
        "Use roles or counts, not actor emails or user IDs, in reporting."
      ],
      guardrailNotes: [
        "Operator write events must remain gated by auth, global write enablement, and explicit reviewed actions."
      ]
    },
    {
      id: "operator-review-queue-age",
      label: "Median review queue age",
      area: "operator_workflow_health",
      kind: "driver",
      definition:
        "Median age in days of accepted-but-not-public-ready source candidates, open trial alerts, and draft changelog entries.",
      calculation:
        "median(days_between(now, createdAt) for open review work items)",
      sourceOfTruth: "SourceCandidate, TrialAlert, PublicChangelogEntry, and review queue aggregates.",
      allowedDimensions: ["work_item_type", "review_status", "week"],
      forbiddenFields: FORBIDDEN_ANALYTICS_FIELDS,
      privacyClassification: "derived-operational",
      cadence: "weekly",
      owner: "operator",
      targetDirection: "decrease",
      decision:
        "Highlights bottlenecks before stale review work weakens public evidence freshness.",
      caveats: ["A lower queue age is only good if source-packet quality gates remain intact."],
      guardrailNotes: ["Do not auto-promote candidates to improve queue age."]
    },
    {
      id: "operator-ungated-write-attempts",
      label: "Ungated write attempts",
      area: "operator_workflow_health",
      kind: "guardrail",
      definition:
        "Count of blocked browser/operator write attempts caused by missing auth, missing permission, disabled write controls, or missing explicit review input.",
      calculation:
        "count(operator_audit_events where result=blocked and reason in auth/permission/write-control/review-input)",
      sourceOfTruth: "Operator audit aggregates and browser write control logs.",
      allowedDimensions: ["blocked_reason", "work_item_type", "week"],
      forbiddenFields: FORBIDDEN_ANALYTICS_FIELDS,
      privacyClassification: "derived-operational",
      cadence: "weekly",
      owner: "operator",
      targetDirection: "maintain_zero",
      decision:
        "Confirms public-write safety boundaries are not being bypassed or repeatedly misused.",
      caveats: ["A few blocked attempts can reflect healthy fail-closed testing; annotate planned QA."],
      guardrailNotes: ["This metric must never expose actor identity in product analytics output."]
    },
    {
      id: "scheduled-ingestion-success-rate",
      label: "Scheduled ingestion success rate",
      area: "ingestion_health",
      kind: "primary",
      definition:
        "Share of scheduled ingestion runs that finish successfully without creating public evidence automatically.",
      calculation:
        "successful_scheduled_ingestion_jobs / scheduled_ingestion_jobs",
      sourceOfTruth: "IngestionJob aggregates and scheduled-ingestion dry-run/readiness reports.",
      allowedDimensions: ["source", "region", "job_status", "week"],
      forbiddenFields: FORBIDDEN_ANALYTICS_FIELDS,
      privacyClassification: "derived-operational",
      cadence: "daily",
      owner: "operator",
      targetDirection: "increase",
      decision:
        "Shows whether source discovery is healthy enough to support human review workflows.",
      caveats: [
        "Success means candidate discovery, not evidence validation.",
        "Scheduled ingestion must not create public evidence cards or score changes."
      ],
      guardrailNotes: ["No-auto-promotion remains the core guardrail."]
    },
    {
      id: "ingestion-review-lead-yield",
      label: "Review lead yield",
      area: "ingestion_health",
      kind: "driver",
      definition:
        "Share of discovered candidates that become accepted review leads after human triage.",
      calculation:
        "accepted_source_candidates / discovered_source_candidates",
      sourceOfTruth: "SourceCandidate status aggregates and curation review records.",
      allowedDimensions: ["source", "region", "candidate_status", "week"],
      forbiddenFields: FORBIDDEN_ANALYTICS_FIELDS,
      privacyClassification: "derived-operational",
      cadence: "weekly",
      owner: "evidence reviewer",
      targetDirection: "increase",
      decision:
        "Helps tune search queries and source lanes without treating raw discovery volume as success.",
      caveats: ["Low yield may be correct for broad safety/regulatory sweeps."],
      guardrailNotes: ["Do not suppress safety or regulatory leads merely to improve yield."]
    },
    {
      id: "ingestion-auto-promotion-incidents",
      label: "Auto-promotion incidents",
      area: "ingestion_health",
      kind: "guardrail",
      definition:
        "Any ingestion-created public claim, source packet, score snapshot, trial alert score link, or changelog publication without explicit human-owned review.",
      calculation: "count(ingestion_outputs where public_mutation=true and human_reviewed_gate=false)",
      sourceOfTruth: "IngestionJob, ReviewEvent, ClaimScoreHistory, TrialAlert, and audit aggregates.",
      allowedDimensions: ["source", "public_mutation_type", "week"],
      forbiddenFields: FORBIDDEN_ANALYTICS_FIELDS,
      privacyClassification: "derived-operational",
      cadence: "daily",
      owner: "operator",
      targetDirection: "maintain_zero",
      decision:
        "Protects the core evidence governance rule that ingestion produces leads, not public truth.",
      caveats: ["Should remain zero; investigate any non-zero value before expanding ingestion."],
      guardrailNotes: ["This is a launch safety blocker when non-zero."]
    },
    {
      id: "human-reviewed-source-packet-coverage",
      label: "Human-reviewed source packet coverage",
      area: "evidence_quality",
      kind: "primary",
      definition:
        "Share of public scoped claims with a current source packet, at least one citation-linked reference, and human-reviewed status.",
      calculation:
        "claims_with_current_human_reviewed_source_packet / public_claims",
      sourceOfTruth: "Claim, SourcePacket, SourcePacketReference, ClaimStudy, and ReviewEvent aggregates.",
      allowedDimensions: ["intervention_id", "outcome_area", "final_label", "week"],
      forbiddenFields: FORBIDDEN_ANALYTICS_FIELDS,
      privacyClassification: "derived-operational",
      cadence: "weekly",
      owner: "evidence reviewer",
      targetDirection: "increase",
      decision:
        "Measures whether public evidence is becoming more auditable claim by claim.",
      caveats: [
        "Coverage must distinguish unreviewed drafts from human-reviewed source packets.",
        "Do not collapse intervention-level evidence into product-level claims."
      ],
      guardrailNotes: [
        "Retain review status and citation traceability in every public-facing interpretation."
      ]
    },
    {
      id: "score-snapshot-freshness",
      label: "Score snapshot freshness",
      area: "evidence_quality",
      kind: "driver",
      definition:
        "Median age in days of the latest score snapshot for public scoped claims.",
      calculation: "median(days_between(now, latest_claim_score_snapshot.computedAt))",
      sourceOfTruth: "ClaimScoreSnapshot and ClaimScoreHistory aggregates.",
      allowedDimensions: ["intervention_id", "outcome_area", "final_label", "week"],
      forbiddenFields: FORBIDDEN_ANALYTICS_FIELDS,
      privacyClassification: "derived-operational",
      cadence: "weekly",
      owner: "evidence reviewer",
      targetDirection: "decrease",
      decision:
        "Shows where claims need review after new source packets, safety alerts, or trial results.",
      caveats: ["Freshness alone does not prove score correctness."],
      guardrailNotes: ["Score changes require reviewed evidence, not just new dates."]
    },
    {
      id: "uncited-public-claim-count",
      label: "Uncited public claim count",
      area: "evidence_quality",
      kind: "guardrail",
      definition:
        "Public claims that render without citation-linked references or without an explicit pending-extraction/missing-source state.",
      calculation:
        "count(public_claims where keyReferenceIds empty and no explicit source-packet pending/missing status)",
      sourceOfTruth: "Public dashboard data, intervention detail data, Claim, and SourcePacket aggregates.",
      allowedDimensions: ["intervention_id", "outcome_area", "week"],
      forbiddenFields: FORBIDDEN_ANALYTICS_FIELDS,
      privacyClassification: "derived-operational",
      cadence: "weekly",
      owner: "evidence reviewer",
      targetDirection: "maintain_zero",
      decision:
        "Protects citation traceability and evidence-depth wording.",
      caveats: ["Pending extraction can be acceptable when visibly labeled."],
      guardrailNotes: ["Non-zero uncited claims should block public expansion."]
    },
    {
      id: "feedback-actionable-triage-rate",
      label: "Actionable feedback triage rate",
      area: "user_feedback",
      kind: "primary",
      definition:
        "Share of public feedback issues triaged into accepted, not planned, or done within the review cadence.",
      calculation:
        "feedback_issues_triaged_within_cadence / feedback_issues_opened",
      sourceOfTruth: "Public GitHub issue metadata and post-launch review notes.",
      allowedDimensions: ["feedback_type", "triage_state", "week"],
      forbiddenFields: FORBIDDEN_ANALYTICS_FIELDS,
      privacyClassification: "public-backlog-metadata",
      cadence: "weekly",
      owner: "product operator",
      targetDirection: "increase",
      decision:
        "Shows whether public trust and usability feedback is being converted into owned decisions.",
      caveats: [
        "Use issue labels and state transitions; do not analyze private health details or raw issue body text."
      ],
      guardrailNotes: ["Feedback intake must not become medical-advice handling."]
    },
    {
      id: "feedback-source-correction-rate",
      label: "Source correction feedback rate",
      area: "user_feedback",
      kind: "driver",
      definition:
        "Share of feedback issues about broken citations, missing sources, evidence-depth confusion, or source metadata.",
      calculation:
        "source_or_citation_feedback_issues / feedback_issues_opened",
      sourceOfTruth: "Public GitHub issue labels and feedback template fields.",
      allowedDimensions: ["feedback_type", "triage_state", "week"],
      forbiddenFields: FORBIDDEN_ANALYTICS_FIELDS,
      privacyClassification: "public-backlog-metadata",
      cadence: "weekly",
      owner: "evidence reviewer",
      targetDirection: "decrease",
      decision:
        "Identifies whether users are finding evidence traceability gaps.",
      caveats: ["A temporary rise can be healthy after adding more feedback entry points."],
      guardrailNotes: ["Review source correction feedback before expanding intervention coverage."]
    },
    {
      id: "feedback-safety-boundary-escalations",
      label: "Safety-boundary feedback escalations",
      area: "user_feedback",
      kind: "guardrail",
      definition:
        "Feedback items that include urgent medical advice, private health information, peptide sourcing, compounding, injection, cycling, dosing, or self-administration requests.",
      calculation:
        "count(feedback_issues with safety_boundary_label=true, reported as metadata counts only)",
      sourceOfTruth: "Public GitHub issue labels and operator triage notes, summarized without body text.",
      allowedDimensions: ["feedback_type", "triage_state", "week"],
      forbiddenFields: FORBIDDEN_ANALYTICS_FIELDS,
      privacyClassification: "public-backlog-metadata",
      cadence: "post-launch-review",
      owner: "product operator",
      targetDirection: "maintain_zero",
      decision:
        "Shows when public messaging or intake guardrails need tightening.",
      caveats: [
        "Do not store, summarize, or quote private health details in analytics outputs.",
        "Escalation counts are for safety operations, not user profiling."
      ],
      guardrailNotes: ["Any urgent or individualized request should be routed out of product analytics."]
    }
  ];
}

function productAnalyticsDashboardBlueprints(): ProductAnalyticsDashboardBlueprint[] {
  return [
    {
      id: "public-evidence-usage",
      label: "Public Evidence Usage",
      audience: "product operator",
      cadence: "weekly",
      status: "requires-provider-setup",
      sourceGaps: [
        "Needs a privacy-preserving aggregate analytics provider before real public usage values can populate."
      ],
      privacyNotes: [
        "Use aggregate route, intervention, surface, and week dimensions only.",
        "Do not collect raw searches, raw label text, user identifiers, private health details, IP addresses, or session replay."
      ],
      panels: [
        {
          id: "public-evidence-engagement",
          label: "Evidence engagement",
          primaryMetricIds: ["public-qualified-evidence-sessions"],
          driverMetricIds: ["public-detail-depth-rate"],
          guardrailMetricIds: ["public-analytics-sensitive-field-incidents"],
          requiredSource: "Privacy-preserving aggregate public usage export.",
          sourceStatus: "requires-aggregate-provider",
          decision:
            "Decide whether public users are reaching evidence and traceability surfaces without weakening privacy boundaries.",
          caveats: [
            "Traffic and depth are usefulness proxies, not medical-value proof.",
            "Review feedback and citation guardrails before treating usage growth as success."
          ]
        }
      ]
    },
    {
      id: "operator-workflow-health",
      label: "Operator Workflow Health",
      audience: "operator",
      cadence: "weekly",
      status: "provider-neutral-ready",
      sourceGaps: [
        "Needs reviewed operational aggregate exports from review events, changelog entries, trial alerts, and operator audit logs."
      ],
      privacyNotes: [
        "Report role and work-item type aggregates only.",
        "Do not expose actor email, user id, or raw review notes in product analytics output."
      ],
      panels: [
        {
          id: "operator-review-flow",
          label: "Human-owned review flow",
          primaryMetricIds: ["operator-review-throughput"],
          driverMetricIds: ["operator-review-queue-age"],
          guardrailMetricIds: ["operator-ungated-write-attempts"],
          requiredSource: "ReviewEvent, PublicChangelogEntry, TrialAlert, and operator audit aggregates.",
          sourceStatus: "available-after-reviewed-export",
          decision:
            "Decide whether review throughput and queue age are healthy without bypassing auth or explicit execution controls.",
          caveats: [
            "Throughput is not evidence quality.",
            "Blocked write attempts can reflect healthy fail-closed QA when annotated."
          ]
        }
      ]
    },
    {
      id: "ingestion-health",
      label: "Ingestion Health",
      audience: "operator",
      cadence: "daily",
      status: "provider-neutral-ready",
      sourceGaps: [
        "Needs scheduled ingestion and source-candidate aggregate exports; ingestion remains leads-only."
      ],
      privacyNotes: [
        "Summarize by source, region, status, and week.",
        "Do not expose raw candidate abstracts or promote candidates through analytics."
      ],
      panels: [
        {
          id: "source-discovery-health",
          label: "Source discovery health",
          primaryMetricIds: ["scheduled-ingestion-success-rate"],
          driverMetricIds: ["ingestion-review-lead-yield"],
          guardrailMetricIds: ["ingestion-auto-promotion-incidents"],
          requiredSource: "IngestionJob, SourceCandidate, ReviewEvent, ClaimScoreHistory, TrialAlert, and audit aggregates.",
          sourceStatus: "available-after-reviewed-export",
          decision:
            "Decide whether source discovery is healthy enough to feed human review without creating public evidence automatically.",
          caveats: [
            "High discovery volume is not evidence validation.",
            "Auto-promotion incidents should remain zero before expansion."
          ]
        }
      ]
    },
    {
      id: "evidence-quality",
      label: "Evidence Quality",
      audience: "evidence reviewer",
      cadence: "weekly",
      status: "provider-neutral-ready",
      sourceGaps: [
        "Needs normalized claim, source-packet, score snapshot, and review-event aggregate exports after migration is available."
      ],
      privacyNotes: [
        "Use intervention, outcome, label, and week aggregates only.",
        "Keep citation traceability and review status visible in downstream dashboards."
      ],
      panels: [
        {
          id: "claim-auditability",
          label: "Claim auditability",
          primaryMetricIds: ["human-reviewed-source-packet-coverage"],
          driverMetricIds: ["score-snapshot-freshness"],
          guardrailMetricIds: ["uncited-public-claim-count"],
          requiredSource: "Claim, SourcePacket, SourcePacketReference, ClaimStudy, ClaimScoreSnapshot, ClaimScoreHistory, and ReviewEvent aggregates.",
          sourceStatus: "available-after-reviewed-export",
          decision:
            "Decide where public claims need source-packet review, score refresh, or citation repair before expansion.",
          caveats: [
            "Fresh score snapshots do not prove correctness.",
            "Pending extraction can be acceptable only when visibly labeled."
          ]
        }
      ]
    },
    {
      id: "feedback-and-boundaries",
      label: "Feedback And Boundaries",
      audience: "product operator",
      cadence: "post-launch-review",
      status: "provider-neutral-ready",
      sourceGaps: [
        "Needs public feedback issue metadata and operator triage labels; raw issue bodies stay out of analytics."
      ],
      privacyNotes: [
        "Use issue labels, state transitions, and metadata counts only.",
        "Do not store or summarize private health details, raw issue text, or individualized medical requests."
      ],
      panels: [
        {
          id: "feedback-trust-loop",
          label: "Feedback trust loop",
          primaryMetricIds: ["feedback-actionable-triage-rate"],
          driverMetricIds: ["feedback-source-correction-rate"],
          guardrailMetricIds: ["feedback-safety-boundary-escalations"],
          requiredSource: "Public GitHub issue label/state aggregates and post-launch review notes.",
          sourceStatus: "available-after-reviewed-export",
          decision:
            "Decide whether public feedback is being converted into owned source, trust, and boundary improvements.",
          caveats: [
            "Feedback counts are not user profiling.",
            "Safety-boundary escalations should tighten product messaging, not feed individualized advice."
          ]
        }
      ]
    }
  ];
}

function buildPrivacyReview(
  kpis: ProductAnalyticsKpiDefinition[]
): ProductAnalyticsPrivacyReview {
  const blockers = kpis.flatMap((kpi) =>
    missingPrivacyControls(kpi).map((blocker) => `${kpi.id}: ${blocker}`)
  );

  return {
    aggregateOnly: true,
    blockers,
    forbiddenFields: FORBIDDEN_ANALYTICS_FIELDS,
    notes: [
      "KPI definitions permit aggregate or derived operational metrics only.",
      "Public usage metrics require a privacy-preserving analytics provider before implementation.",
      "Feedback analytics use labels and state metadata only, not raw issue bodies or health details.",
      "Operator analytics use roles and work-item types, not actor emails or user IDs."
    ],
    publicRoutesReadOnly: true,
    status: blockers.length > 0 ? "blocked" : "ready"
  };
}

function missingPrivacyControls(kpi: ProductAnalyticsKpiDefinition) {
  const blockers: string[] = [];

  if (kpi.forbiddenFields.length === 0) {
    blockers.push("forbidden fields are not declared");
  }

  if (kpi.allowedDimensions.some((dimension) => FORBIDDEN_ANALYTICS_FIELDS.includes(dimension))) {
    blockers.push("allowed dimensions include a forbidden field");
  }

  if (!kpi.sourceOfTruth.trim()) {
    blockers.push("source of truth is missing");
  }

  if (!kpi.calculation.trim()) {
    blockers.push("calculation is missing");
  }

  return blockers;
}

function validateProductAnalyticsAggregateRow({
  forbiddenFields,
  kpisById,
  row,
  rowIndex
}: {
  forbiddenFields: string[];
  kpisById: Map<string, ProductAnalyticsKpiDefinition>;
  row: ProductAnalyticsAggregateRow;
  rowIndex: number;
}) {
  const issues: ProductAnalyticsAggregateValidationIssue[] = [];
  const metricId = row.metricId;
  const kpi = metricId ? kpisById.get(metricId) : undefined;
  const topLevelKeys = Object.keys(row);
  const dimensions =
    row.dimensions === undefined || isPlainRecord(row.dimensions) ? row.dimensions : {};
  const dimensionKeys = Object.keys(dimensions ?? {});
  const rowForbiddenFields = topLevelKeys.filter((field) => forbiddenFields.includes(field));
  const forbiddenDimensions = dimensionKeys.filter((field) => forbiddenFields.includes(field));
  const unknownTopLevelFields = topLevelKeys.filter(
    (field) =>
      !ALLOWED_AGGREGATE_ROW_FIELDS.includes(field) && !forbiddenFields.includes(field)
  );

  if (!metricId) {
    issues.push({
      field: "metricId",
      message: "Aggregate row is missing a KPI metricId.",
      rowIndex
    });
  } else if (!kpi) {
    issues.push({
      field: "metricId",
      message: "Aggregate row references an undeclared KPI metric.",
      metricId,
      rowIndex
    });
  }

  if (typeof row.value !== "number" || !Number.isFinite(row.value)) {
    issues.push({
      field: "value",
      message: "Aggregate row value must be a finite number.",
      ...(metricId ? { metricId } : {}),
      rowIndex
    });
  }

  for (const field of rowForbiddenFields) {
    issues.push({
      field,
      message: "Aggregate row includes a forbidden top-level analytics field.",
      ...(metricId ? { metricId } : {}),
      rowIndex
    });
  }

  for (const field of unknownTopLevelFields) {
    issues.push({
      field,
      message: "Aggregate row includes an undeclared top-level analytics field.",
      ...(metricId ? { metricId } : {}),
      rowIndex
    });
  }

  if (row.dimensions !== undefined && !isPlainRecord(row.dimensions)) {
    issues.push({
      field: "dimensions",
      message: "Aggregate row dimensions must be an object of scalar values.",
      ...(metricId ? { metricId } : {}),
      rowIndex
    });
  }

  for (const field of forbiddenDimensions) {
    issues.push({
      field: `dimensions.${field}`,
      message: "Aggregate row includes a forbidden analytics dimension.",
      ...(metricId ? { metricId } : {}),
      rowIndex
    });
  }

  for (const field of dimensionKeys) {
    const dimensionValue = dimensions?.[field];

    if (!isScalarAggregateDimensionValue(dimensionValue)) {
      issues.push({
        field: `dimensions.${field}`,
        message:
          "Aggregate dimension values must be strings, finite numbers, booleans, or null.",
        ...(metricId ? { metricId } : {}),
        rowIndex
      });
    }
  }

  for (const field of ["periodStart", "periodEnd"] as const) {
    if (row[field] !== undefined && !isValidDateOnlyString(row[field])) {
      issues.push({
        field,
        message: "Aggregate row period fields must be valid YYYY-MM-DD dates.",
        ...(metricId ? { metricId } : {}),
        rowIndex
      });
    }
  }

  if (
    isValidDateOnlyString(row.periodStart) &&
    isValidDateOnlyString(row.periodEnd) &&
    row.periodStart > row.periodEnd
  ) {
    issues.push({
      field: "periodStart",
      message: "Aggregate row periodStart must not be after periodEnd.",
      ...(metricId ? { metricId } : {}),
      rowIndex
    });
  }

  if (!kpi) {
    return issues;
  }

  for (const field of dimensionKeys) {
    if (!forbiddenFields.includes(field) && !kpi.allowedDimensions.includes(field)) {
      issues.push({
        field: `dimensions.${field}`,
        message: "Aggregate row includes a dimension not declared for this KPI.",
        metricId: kpi.id,
        rowIndex
      });
    }
  }

  return issues;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isScalarAggregateDimensionValue(value: unknown) {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function isValidDateOnlyString(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function areaSummary(
  area: ProductAnalyticsKpiArea,
  kpis: ProductAnalyticsKpiDefinition[]
): ProductAnalyticsKpiAreaSummary {
  const areaKpis = kpis.filter((kpi) => kpi.area === area);

  return {
    area,
    driverMetricIds: areaKpis.filter((kpi) => kpi.kind === "driver").map((kpi) => kpi.id),
    guardrailMetricIds: areaKpis
      .filter((kpi) => kpi.kind === "guardrail")
      .map((kpi) => kpi.id),
    label: areaLabel(area),
    primaryMetricIds: areaKpis.filter((kpi) => kpi.kind === "primary").map((kpi) => kpi.id)
  };
}

function areaLabel(area: ProductAnalyticsKpiArea) {
  const labels: Record<ProductAnalyticsKpiArea, string> = {
    evidence_quality: "Evidence quality",
    ingestion_health: "Ingestion health",
    operator_workflow_health: "Operator workflow health",
    public_usage: "Public usage",
    user_feedback: "User feedback"
  };

  return labels[area];
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function aggregateSourceStatusByMetric(blueprints: ProductAnalyticsDashboardBlueprint[]) {
  const statusByMetric = new Map<string, ProductAnalyticsDashboardPanel["sourceStatus"]>();

  for (const blueprint of blueprints) {
    for (const panel of blueprint.panels) {
      for (const metricId of [
        ...panel.primaryMetricIds,
        ...panel.driverMetricIds,
        ...panel.guardrailMetricIds
      ]) {
        const existing = statusByMetric.get(metricId);

        statusByMetric.set(
          metricId,
          existing === "requires-aggregate-provider" ||
            panel.sourceStatus === "requires-aggregate-provider"
            ? "requires-aggregate-provider"
            : "available-after-reviewed-export"
        );
      }
    }
  }

  return statusByMetric;
}

function productAnalyticsMonitoringLinks(): ProductAnalyticsMonitoringLink[] {
  return [
    {
      command: "npm run analytics:kpis -- --summary",
      id: "product-analytics-kpi-summary",
      label: "Refresh product analytics KPI summary",
      mode: "read-only"
    },
    {
      command: "npm run analytics:kpis -- --aggregate-schema",
      id: "product-analytics-aggregate-schema",
      label: "Print provider-neutral aggregate schema",
      mode: "read-only"
    },
    {
      command: "npm run analytics:kpis -- --validate-aggregate <aggregate-json-file>",
      id: "product-analytics-aggregate-validation",
      label: "Validate provider-neutral aggregate analytics export",
      mode: "read-only"
    },
    {
      command: "npm run analytics:kpis -- --privacy-review",
      id: "product-analytics-privacy-review",
      label: "Refresh product analytics privacy review",
      mode: "read-only"
    },
    {
      command: "npm run operations:readiness -- --summary",
      id: "operations-readiness-summary",
      label: "Refresh operations readiness summary",
      mode: "read-only"
    },
    {
      command: "npm run operator:readiness -- --summary",
      id: "operator-readiness-summary",
      label: "Refresh operator readiness summary",
      mode: "read-only"
    },
    {
      command: "npm run ingest:scheduled-dry-run",
      id: "scheduled-ingestion-dry-run",
      label: "Refresh scheduled ingestion dry run",
      mode: "read-only"
    },
    {
      href: "/feedback",
      id: "feedback-intake",
      label: "Review public feedback intake surface",
      mode: "read-only"
    },
    {
      id: "aggregate-analytics-provider",
      label: "Configure privacy-preserving aggregate analytics provider",
      mode: "requires-provider-setup"
    }
  ];
}
