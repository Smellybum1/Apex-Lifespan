import { buildFullTextLocalFixtureTemplate } from "@/lib/full-text-fixture";

export type FullTextAccessMethod =
  | "api"
  | "bulk-download"
  | "publisher-page"
  | "manual-local-file"
  | "local-fixture";

export interface FullTextSourceApproval {
  accessMethodReviewed: boolean;
  approvedForLiveFetch: boolean;
  approvedForPublicExport: boolean;
  approvedForStorage: boolean;
  derivedOnlyExportReviewed: boolean;
  rawRetentionReviewed: boolean;
  robotsOrApiPolicyReviewed: boolean;
  termsReviewed: boolean;
}

export interface FullTextSourceInventoryItem {
  accessMethod: FullTextAccessMethod;
  allowedUse: string;
  approval: FullTextSourceApproval;
  authRequired: boolean;
  cacheTtl: string;
  captchaRisk: boolean;
  dryRunSupported: boolean;
  id: string;
  label: string;
  liveFetchSupported: boolean;
  loginRequired: boolean;
  notes: string;
  policyUrl: string;
  privateDataRisk: boolean;
  rateLimit: string;
  rawRetentionPolicy: string;
  reviewedAt: string;
  reviewedBy: string;
  sourceKind: string;
  termsUrl: string;
}

export interface FullTextSourceInventoryReviewField {
  field: keyof FullTextSourceInventoryItem | `approval.${keyof FullTextSourceApproval}`;
  label: string;
  requiredForLiveCapture: boolean;
  reviewPrompt: string;
}

export interface FullTextSourceInventoryTemplate {
  approvalDefaults: FullTextSourceApproval;
  generatedAt: string;
  humanOwned: true;
  nextAction: string;
  readOnly: true;
  reviewChecklist: FullTextSourceInventoryReviewField[];
  sources: FullTextSourceInventoryItem[];
}

export type FullTextSourceReadinessStatus = "ready" | "blocked";

export type FullTextSourceReputation = "high" | "moderate" | "low" | "manual-only";

export type FullTextSourceReviewTier =
  | "start-here"
  | "fixture-only"
  | "review-later"
  | "hold";

export interface FullTextSourceConviction {
  convictionScore: number;
  limitations: string[];
  missingRequiredFields: string[];
  positiveFactors: string[];
  reviewPriority: number;
  sourceReputation: FullTextSourceReputation;
  tier: FullTextSourceReviewTier;
}

export interface FullTextSourceReadinessRow {
  accessMethod: FullTextAccessMethod;
  blockers: string[];
  dryRunSupported: boolean;
  id: string;
  label: string;
  liveFetchSupported: boolean;
  nextAction: string;
  notes: string;
  sourceConviction: FullTextSourceConviction;
  sourceKind: string;
  status: FullTextSourceReadinessStatus;
  warnings: string[];
}

export interface FullTextFixtureContract {
  derivedOnly: true;
  fields: string[];
  nextAction: string;
  rawTextStored: false;
  status: "ready";
  supportedInput: "operator-local-fixture";
}

export interface FullTextSourceReadinessReport {
  fixtureContract: FullTextFixtureContract;
  generatedAt: string;
  humanOwned: true;
  liveCaptureReady: boolean;
  nextAction: string;
  readOnly: true;
  rows: FullTextSourceReadinessRow[];
  summary: {
    blockedSources: number;
    dryRunSupportedSources: number;
    holdSources: number;
    liveApprovedSources: number;
    startHereSources: number;
    sources: number;
  };
}

export interface FullTextSourceReviewQueueItem {
  convictionScore: number;
  id: string;
  label: string;
  limitations: string[];
  missingRequiredFields: string[];
  nextAction: string;
  positiveFactors: string[];
  reviewPriority: number;
  sourceReputation: FullTextSourceReputation;
  tier: FullTextSourceReviewTier;
}

export interface FullTextSourceReadinessSummary {
  blocked: Array<{
    blockers: string[];
    id: string;
    label: string;
    nextAction: string;
  }>;
  counts: FullTextSourceReadinessReport["summary"];
  fixtureContract: FullTextFixtureContract;
  generatedAt: string;
  liveCaptureReady: boolean;
  nextAction: string;
  readOnly: true;
  reviewQueue: FullTextSourceReviewQueueItem[];
}

export interface FullTextSourceReviewWorksheetField {
  complete: boolean;
  currentValue: boolean | string;
  field: FullTextSourceInventoryReviewField["field"];
  label: string;
  requiredForLiveCapture: boolean;
  reviewPrompt: string;
}

export interface FullTextSourceReviewWorksheet {
  generatedAt: string;
  humanOwned: true;
  limitations: string[];
  missingRequiredFields: string[];
  nextAction: string;
  noAutoApproval: true;
  noLiveFetch: true;
  positiveFactors: string[];
  readOnly: true;
  reviewFields: FullTextSourceReviewWorksheetField[];
  safeInventoryEntry: FullTextSourceInventoryItem;
  source: {
    convictionScore: number;
    id: string;
    label: string;
    reviewPriority: number;
    sourceReputation: FullTextSourceReputation;
    tier: FullTextSourceReviewTier;
  };
}

export type FullTextSourceReviewKitFileKind =
  | "inventory-template"
  | "review-kit-index"
  | "source-worksheet";

export interface FullTextSourceReviewKitFile {
  content: string;
  description: string;
  kind: FullTextSourceReviewKitFileKind;
  path: string;
}

export interface FullTextSourceReviewKit {
  files: FullTextSourceReviewKitFile[];
  generatedAt: string;
  humanOwned: true;
  nextAction: string;
  noAutoApproval: true;
  noConnectorApproval: true;
  noLiveFetch: true;
  outputDir: string;
  readOnly: true;
  source: FullTextSourceReviewWorksheet["source"];
  summary: {
    files: number;
    inventorySources: number;
    missingRequiredFields: number;
    reviewFields: number;
    sourceWorksheets: number;
  };
}

export type FullTextConnectorPrepKitFileKind =
  | "fixture-template"
  | "connector-prep-index"
  | "connector-review"
  | "connector-plan"
  | "connector-approval-packet";

export interface FullTextConnectorPrepKitFile {
  content: string;
  description: string;
  kind: FullTextConnectorPrepKitFileKind;
  path: string;
}

export interface FullTextConnectorPrepKit {
  approvalGranted: false;
  files: FullTextConnectorPrepKitFile[];
  generatedAt: string;
  humanOwned: true;
  nextAction: string;
  noAutoApproval: true;
  noConnectorApproval: true;
  noImplementationApproval: true;
  noLiveFetch: true;
  noNetworkFetch: true;
  outputDir: string;
  readOnly: true;
  summary: {
    blockedApprovalSources: number;
    blockedReviewSources: number;
    files: number;
    fixtureTemplates: number;
    holdApprovalSources: number;
    holdReviewSources: number;
    readyForApprovalSources: number;
    readyForFixtureDesignSources: number;
    readyForReviewSources: number;
    sources: number;
  };
}

export type FullTextSourceInventoryProgressStatus =
  | "not-started"
  | "in-progress"
  | "premature-approval"
  | "ready-for-connector-review";

export interface FullTextSourceInventoryProgressFieldChange {
  currentValue: boolean | string;
  field: FullTextSourceInventoryReviewField["field"];
  label: string;
  starterValue: boolean | string;
}

export interface FullTextSourceInventoryProgressRow {
  approvalWarnings: string[];
  changedFields: FullTextSourceInventoryProgressFieldChange[];
  completedRequiredFields: number;
  convictionScore: number;
  id: string;
  label: string;
  missingRequiredFields: string[];
  nextAction: string;
  readinessStatus: FullTextSourceReadinessStatus;
  sourceReputation: FullTextSourceReputation;
  status: FullTextSourceInventoryProgressStatus;
  tier: FullTextSourceReviewTier;
  totalRequiredFields: number;
}

export interface FullTextSourceInventoryProgressReport {
  generatedAt: string;
  humanOwned: true;
  liveCaptureReady: boolean;
  nextAction: string;
  noAutoApproval: true;
  noLiveFetch: true;
  readOnly: true;
  rows: FullTextSourceInventoryProgressRow[];
  summary: {
    changedSources: number;
    inProgressSources: number;
    notStartedSources: number;
    prematureApprovalSources: number;
    readyForConnectorReviewSources: number;
    sources: number;
  };
}

export type FullTextConnectorReviewDraftStatus = "blocked" | "hold" | "ready-for-review";

export interface FullTextConnectorReviewDraftRow {
  accessMethod: FullTextAccessMethod;
  approvalWarnings: string[];
  blockers: string[];
  connectorKey: string;
  dryRunSupported: boolean;
  id: string;
  implementationChecklist: string[];
  label: string;
  nextAction: string;
  policy: {
    allowedUse: string;
    cacheTtl: string;
    derivedOnlyPublicExport: boolean;
    policyUrl: string;
    publicRawTextExport: false;
    rateLimit: string;
    rawRetentionPolicy: string;
    termsUrl: string;
  };
  reviewStatus: FullTextConnectorReviewDraftStatus;
  sourceReputation: FullTextSourceReputation;
  tier: FullTextSourceReviewTier;
  validationCommands: string[];
}

export interface FullTextConnectorReviewDraft {
  generatedAt: string;
  humanOwned: true;
  nextAction: string;
  noAutoApproval: true;
  noConnectorApproval: true;
  noLiveFetch: true;
  readOnly: true;
  rows: FullTextConnectorReviewDraftRow[];
  summary: {
    blockedSources: number;
    holdSources: number;
    readyForReviewSources: number;
    sources: number;
  };
}

export type FullTextConnectorImplementationPlanStatus =
  | "blocked"
  | "ready-for-fixture-design";

export interface FullTextConnectorImplementationPlanRow {
  blockers: string[];
  connectorKey: string;
  dryRunSupported: boolean;
  guardrails: string[];
  id: string;
  implementationPhases: string[];
  label: string;
  nextAction: string;
  plannedFiles: string[];
  policy: FullTextConnectorReviewDraftRow["policy"];
  reviewStatus: FullTextConnectorReviewDraftStatus;
  status: FullTextConnectorImplementationPlanStatus;
  validationCommands: string[];
}

export interface FullTextConnectorImplementationPlan {
  generatedAt: string;
  humanOwned: true;
  nextAction: string;
  noAutoApproval: true;
  noConnectorApproval: true;
  noLiveFetch: true;
  noNetworkFetch: true;
  readOnly: true;
  rows: FullTextConnectorImplementationPlanRow[];
  summary: {
    blockedSources: number;
    readyForFixtureDesignSources: number;
    sources: number;
  };
}

export type FullTextConnectorApprovalPacketStatus =
  | "blocked"
  | "hold"
  | "ready-for-approval";

export interface FullTextConnectorApprovalItem {
  complete: boolean;
  detail: string;
  id: string;
  label: string;
}

export interface FullTextConnectorApprovalPacketRow {
  approvalGranted: false;
  approvalItems: FullTextConnectorApprovalItem[];
  blockers: string[];
  connectorKey: string;
  guardrails: string[];
  id: string;
  implementationStatus: FullTextConnectorImplementationPlanStatus;
  label: string;
  nextAction: string;
  operatorDecisionTemplate: string;
  plannedFiles: string[];
  policy: FullTextConnectorReviewDraftRow["policy"];
  reviewStatus: FullTextConnectorReviewDraftStatus;
  status: FullTextConnectorApprovalPacketStatus;
  validationCommands: string[];
}

export interface FullTextConnectorApprovalPacket {
  approvalGranted: false;
  generatedAt: string;
  humanOwned: true;
  nextAction: string;
  noAutoApproval: true;
  noConnectorApproval: true;
  noImplementationApproval: true;
  noLiveFetch: true;
  noNetworkFetch: true;
  readOnly: true;
  rows: FullTextConnectorApprovalPacketRow[];
  summary: {
    blockedSources: number;
    holdSources: number;
    readyForApprovalSources: number;
    sources: number;
  };
}

export type FullTextSourceInventoryNextActionStatus =
  | "create-inventory-template"
  | "continue-source-review"
  | "fix-premature-approval"
  | "hold-connector-automation"
  | "open-connector-review";

export interface FullTextSourceInventoryNextActionCommand {
  command: string;
  id: string;
  label: string;
  mode: "read-only" | "local-file-write";
  purpose: string;
}

export interface FullTextSourceInventoryNextActionPlan {
  commands: FullTextSourceInventoryNextActionCommand[];
  generatedAt: string;
  humanOwned: true;
  inventoryFilePath: string;
  inventoryFileProvided: boolean;
  nextAction: string;
  noAutoApproval: true;
  noConnectorApproval: true;
  noLiveFetch: true;
  readOnly: true;
  selectedSource?: {
    approvalWarnings: string[];
    connectorReviewStatus: FullTextConnectorReviewDraftStatus;
    convictionScore: number;
    id: string;
    label: string;
    missingRequiredFields: string[];
    progressStatus: FullTextSourceInventoryProgressStatus;
    sourceReputation: FullTextSourceReputation;
    tier: FullTextSourceReviewTier;
  };
  status: FullTextSourceInventoryNextActionStatus;
  summary: {
    blockedSources: number;
    changedSources: number;
    connectorReadyForReviewSources: number;
    inProgressSources: number;
    notStartedSources: number;
    prematureApprovalSources: number;
    readyForConnectorReviewSources: number;
    sources: number;
  };
}

export type FullTextSourceFixtureScenarioResult = "pass" | "fail";

export interface FullTextSourceFixtureScenarioRow {
  actualConnectorReviewStatus: FullTextConnectorReviewDraftStatus;
  actualProgressStatus: FullTextSourceInventoryProgressStatus;
  approvalWarnings: string[];
  connectorReadyForReview: boolean;
  convictionScore: number;
  description: string;
  expectedConnectorReviewStatus: FullTextConnectorReviewDraftStatus;
  expectedProgressStatus: FullTextSourceInventoryProgressStatus;
  id: string;
  label: string;
  liveCaptureReady: boolean;
  missingRequiredFields: string[];
  nextAction: string;
  result: FullTextSourceFixtureScenarioResult;
  tier: FullTextSourceReviewTier;
}

export interface FullTextSourceFixtureScenarioMatrix {
  generatedAt: string;
  humanOwned: true;
  nextAction: string;
  noAutoApproval: true;
  noConnectorApproval: true;
  noLiveFetch: true;
  readOnly: true;
  rows: FullTextSourceFixtureScenarioRow[];
  summary: {
    blockedScenarios: number;
    connectorReadyForReviewScenarios: number;
    failedScenarios: number;
    inProgressScenarios: number;
    passedScenarios: number;
    prematureApprovalScenarios: number;
    readyForConnectorReviewScenarios: number;
    scenarios: number;
  };
}

const DEFAULT_APPROVAL: FullTextSourceApproval = {
  accessMethodReviewed: false,
  approvedForLiveFetch: false,
  approvedForPublicExport: false,
  approvedForStorage: false,
  derivedOnlyExportReviewed: false,
  rawRetentionReviewed: false,
  robotsOrApiPolicyReviewed: false,
  termsReviewed: false
};

const DEFAULT_FULL_TEXT_SOURCE_INVENTORY_PATH =
  "docs/codex/onboarding/fulltext-source-inventory.local.json";
const DEFAULT_FULL_TEXT_CONNECTOR_REVIEW_PATH =
  "docs/codex/onboarding/fulltext-connector-review.md";
const DEFAULT_FULL_TEXT_CONNECTOR_PLAN_PATH =
  "docs/codex/onboarding/fulltext-connector-implementation-plan.md";
const DEFAULT_FULL_TEXT_CONNECTOR_APPROVAL_PACKET_PATH =
  "docs/codex/onboarding/fulltext-connector-approval-packet.md";
const DEFAULT_FULL_TEXT_REVIEW_KIT_DIR = "docs/codex/onboarding";

export const FULL_TEXT_SOURCE_INVENTORY_REVIEW_CHECKLIST: FullTextSourceInventoryReviewField[] = [
  {
    field: "termsUrl",
    label: "Terms URL",
    requiredForLiveCapture: true,
    reviewPrompt: "Link the source-specific terms of use or license before approving capture."
  },
  {
    field: "approval.termsReviewed",
    label: "Terms reviewed",
    requiredForLiveCapture: true,
    reviewPrompt: "Confirm the source-specific terms or license have been reviewed."
  },
  {
    field: "policyUrl",
    label: "Robots/API policy URL",
    requiredForLiveCapture: true,
    reviewPrompt: "Link the robots, API, or bulk-download policy that governs automated access."
  },
  {
    field: "approval.robotsOrApiPolicyReviewed",
    label: "Robots/API policy reviewed",
    requiredForLiveCapture: true,
    reviewPrompt: "Confirm automated access policy, robots policy, or API terms have been reviewed."
  },
  {
    field: "accessMethod",
    label: "Access method",
    requiredForLiveCapture: true,
    reviewPrompt: "Confirm whether access is through an API, bulk file, publisher page, or local fixture."
  },
  {
    field: "approval.accessMethodReviewed",
    label: "Access method reviewed",
    requiredForLiveCapture: true,
    reviewPrompt: "Confirm the selected access method is allowed for the source and intended use."
  },
  {
    field: "rateLimit",
    label: "Rate limit",
    requiredForLiveCapture: true,
    reviewPrompt: "Record the reviewed request cap or state why live fetch remains unsupported."
  },
  {
    field: "cacheTtl",
    label: "Cache TTL",
    requiredForLiveCapture: true,
    reviewPrompt: "Record how long raw fetch results may stay in local cache before deletion."
  },
  {
    field: "rawRetentionPolicy",
    label: "Raw retention policy",
    requiredForLiveCapture: true,
    reviewPrompt: "Describe whether raw text can be stored locally and when it must be deleted."
  },
  {
    field: "approval.rawRetentionReviewed",
    label: "Raw retention reviewed",
    requiredForLiveCapture: true,
    reviewPrompt: "Confirm the raw retention policy has been reviewed against source terms."
  },
  {
    field: "approval.derivedOnlyExportReviewed",
    label: "Derived-only export reviewed",
    requiredForLiveCapture: true,
    reviewPrompt: "Confirm public artifacts export only derived fields, summaries, and citations."
  },
  {
    field: "approval.approvedForStorage",
    label: "Local raw storage approved",
    requiredForLiveCapture: true,
    reviewPrompt: "Approve local raw-text storage only after retention and access terms are reviewed."
  },
  {
    field: "approval.approvedForLiveFetch",
    label: "Live fetch approved",
    requiredForLiveCapture: true,
    reviewPrompt: "Approve live fetch only after terms, policy, rate, cache, and retention are reviewed."
  },
  {
    field: "approval.approvedForPublicExport",
    label: "Public export approved",
    requiredForLiveCapture: true,
    reviewPrompt: "Approve only derived public export; never approve raw full-text publication."
  }
];

export const DEFAULT_FULL_TEXT_SOURCE_INVENTORY: FullTextSourceInventoryItem[] = [
  {
    accessMethod: "api",
    allowedUse:
      "Potential open-access biomedical full-text capture only after source terms, API policy, rate/cache policy, raw-retention policy, and derived-only export are reviewed.",
    approval: { ...DEFAULT_APPROVAL },
    authRequired: false,
    cacheTtl: "",
    captchaRisk: false,
    dryRunSupported: false,
    id: "pmc-open-access",
    label: "PubMed Central Open Access subset",
    liveFetchSupported: false,
    loginRequired: false,
    notes:
      "Candidate source for future full-text capture; no live connector is approved or implemented.",
    policyUrl: "",
    privateDataRisk: false,
    rateLimit: "",
    rawRetentionPolicy: "",
    reviewedAt: "",
    reviewedBy: "",
    sourceKind: "biomedical-literature",
    termsUrl: ""
  },
  {
    accessMethod: "publisher-page",
    allowedUse:
      "Publisher-hosted article pages must be reviewed per publisher before any automated access.",
    approval: { ...DEFAULT_APPROVAL },
    authRequired: false,
    cacheTtl: "",
    captchaRisk: true,
    dryRunSupported: false,
    id: "publisher-hosted-full-text",
    label: "Publisher-hosted full text",
    liveFetchSupported: false,
    loginRequired: false,
    notes:
      "Blocked by default because publishers differ in terms, robots policies, login requirements, and reuse rights.",
    policyUrl: "",
    privateDataRisk: false,
    rateLimit: "",
    rawRetentionPolicy: "",
    reviewedAt: "",
    reviewedBy: "",
    sourceKind: "publisher-literature",
    termsUrl: ""
  },
  {
    accessMethod: "manual-local-file",
    allowedUse:
      "Operator-provided local source packets may be used for fixture-shape dry runs only until original-source rights and retention rules are reviewed.",
    approval: { ...DEFAULT_APPROVAL },
    authRequired: false,
    cacheTtl: "no shared cache",
    captchaRisk: false,
    dryRunSupported: true,
    id: "operator-local-source-packet",
    label: "Operator-provided local source packet",
    liveFetchSupported: false,
    loginRequired: false,
    notes:
      "Useful for local fixture validation; does not approve raw full-text storage or public export.",
    policyUrl: "",
    privateDataRisk: true,
    rateLimit: "n/a",
    rawRetentionPolicy: "",
    reviewedAt: "",
    reviewedBy: "",
    sourceKind: "operator-local-fixture",
    termsUrl: ""
  }
];

export function buildFullTextSourceInventoryTemplate({
  generatedAt,
  inventory = DEFAULT_FULL_TEXT_SOURCE_INVENTORY
}: {
  generatedAt?: Date;
  inventory?: FullTextSourceInventoryItem[];
} = {}): FullTextSourceInventoryTemplate {
  return {
    approvalDefaults: { ...DEFAULT_APPROVAL },
    generatedAt: (generatedAt ?? new Date()).toISOString(),
    humanOwned: true,
    nextAction:
      "Fill one source entry with reviewed terms, access, rate/cache, retention, and approval evidence; then run onboarding:fulltext-sources against this inventory.",
    readOnly: true,
    reviewChecklist: FULL_TEXT_SOURCE_INVENTORY_REVIEW_CHECKLIST,
    sources: inventory.map(templateInventoryItem)
  };
}

export function buildFullTextSourceReadinessReport({
  generatedAt,
  inventory = DEFAULT_FULL_TEXT_SOURCE_INVENTORY
}: {
  generatedAt?: Date;
  inventory?: FullTextSourceInventoryItem[];
} = {}): FullTextSourceReadinessReport {
  const rows = inventory.map(fullTextSourceReadinessRow);
  const liveApprovedSources = rows.filter((row) => row.status === "ready").length;
  const blockedSources = rows.length - liveApprovedSources;
  const nextAction =
    rows.find((row) => row.status === "blocked")?.nextAction ??
    "Approved full-text sources are ready for a separate, explicit connector implementation review.";

  return {
    fixtureContract: fullTextFixtureContract(),
    generatedAt: (generatedAt ?? new Date()).toISOString(),
    humanOwned: true,
    liveCaptureReady: blockedSources === 0 && liveApprovedSources > 0,
    nextAction,
    readOnly: true,
    rows,
    summary: {
      blockedSources,
      dryRunSupportedSources: rows.filter((row) => row.dryRunSupported).length,
      holdSources: rows.filter((row) => row.sourceConviction.tier === "hold").length,
      liveApprovedSources,
      startHereSources: rows.filter((row) => row.sourceConviction.tier === "start-here")
        .length,
      sources: rows.length
    }
  };
}

export function summarizeFullTextSourceReadinessReport(
  report: FullTextSourceReadinessReport
): FullTextSourceReadinessSummary {
  return {
    blocked: report.rows
      .filter((row) => row.status === "blocked")
      .map((row) => ({
        blockers: row.blockers,
        id: row.id,
        label: row.label,
        nextAction: row.nextAction
      })),
    counts: report.summary,
    fixtureContract: report.fixtureContract,
    generatedAt: report.generatedAt,
    liveCaptureReady: report.liveCaptureReady,
    nextAction: report.nextAction,
    readOnly: true,
    reviewQueue: buildFullTextSourceReviewQueue(report.rows)
  };
}

export function parseFullTextSourceInventory(
  value: unknown
): FullTextSourceInventoryItem[] {
  const sourceList = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.sources)
      ? value.sources
      : undefined;

  if (!sourceList) {
    throw new Error("Full-text source inventory must be an array or { sources: [...] }.");
  }

  return sourceList.map(parseInventoryItem);
}

export function buildFullTextSourceReviewWorksheet({
  generatedAt,
  inventory = DEFAULT_FULL_TEXT_SOURCE_INVENTORY,
  sourceId
}: {
  generatedAt?: Date;
  inventory?: FullTextSourceInventoryItem[];
  sourceId?: string;
} = {}): FullTextSourceReviewWorksheet {
  const report = buildFullTextSourceReadinessReport({ generatedAt, inventory });
  const queue = buildFullTextSourceReviewQueue(report.rows);
  const selectedId = sourceId?.trim() || queue[0]?.id;

  if (!selectedId) {
    throw new Error("No full-text source inventory entries are available for worksheet review.");
  }

  const source = inventory.find((item) => item.id === selectedId);
  const row = report.rows.find((item) => item.id === selectedId);

  if (!source || !row) {
    throw new Error(`Unknown full-text source inventory id: ${selectedId}.`);
  }

  return {
    generatedAt: report.generatedAt,
    humanOwned: true,
    limitations: row.sourceConviction.limitations,
    missingRequiredFields: row.sourceConviction.missingRequiredFields,
    nextAction:
      "Fill the missing fields in a user-owned inventory file, keep approvals false until reviewed, then rerun onboarding:fulltext-sources with --inventory-file.",
    noAutoApproval: true,
    noLiveFetch: true,
    positiveFactors: row.sourceConviction.positiveFactors,
    readOnly: true,
    reviewFields: FULL_TEXT_SOURCE_INVENTORY_REVIEW_CHECKLIST.map((item) => ({
      complete: reviewFieldComplete(source, item.field),
      currentValue: reviewFieldValue(source, item.field),
      field: item.field,
      label: item.label,
      requiredForLiveCapture: item.requiredForLiveCapture,
      reviewPrompt: item.reviewPrompt
    })),
    safeInventoryEntry: templateInventoryItem(source),
    source: {
      convictionScore: row.sourceConviction.convictionScore,
      id: row.id,
      label: row.label,
      reviewPriority: row.sourceConviction.reviewPriority,
      sourceReputation: row.sourceConviction.sourceReputation,
      tier: row.sourceConviction.tier
    }
  };
}

export function fullTextSourceReviewWorksheetToMarkdown(
  worksheet: FullTextSourceReviewWorksheet
) {
  const lines = [
    "# Full-Text Source Review Worksheet",
    "",
    `Generated: ${worksheet.generatedAt}`,
    `Source: ${worksheet.source.label} (${worksheet.source.id})`,
    `Tier: ${worksheet.source.tier}`,
    `Source reputation: ${worksheet.source.sourceReputation}`,
    `Source-conviction score: ${worksheet.source.convictionScore}/100`,
    `Review priority: ${worksheet.source.reviewPriority}`,
    `Read-only: ${worksheet.readOnly}`,
    `No auto approval: ${worksheet.noAutoApproval}`,
    `No live fetch: ${worksheet.noLiveFetch}`,
    "",
    "## Next Action",
    "",
    worksheet.nextAction,
    "",
    "## Positive Factors",
    "",
    ...markdownList(worksheet.positiveFactors),
    "",
    "## Limitations",
    "",
    ...markdownList(worksheet.limitations),
    "",
    "## Missing Required Fields",
    "",
    ...markdownList(worksheet.missingRequiredFields),
    "",
    "## Review Checklist",
    "",
    "| Field | Current | Complete | Prompt |",
    "| --- | --- | --- | --- |",
    ...worksheet.reviewFields.map(
      (field) =>
        `| ${escapeMarkdownTableCell(field.label)} | ${escapeMarkdownTableCell(formatFieldValue(field.currentValue))} | ${field.complete ? "yes" : "no"} | ${escapeMarkdownTableCell(field.reviewPrompt)} |`
    ),
    "",
    "## Safe Inventory Starter",
    "",
    "Approvals stay false in this starter. Review and edit a user-owned inventory file before rerunning the gate.",
    "",
    "```json",
    JSON.stringify({ sources: [worksheet.safeInventoryEntry] }, null, 2),
    "```"
  ];

  return `${lines.join("\n")}\n`;
}

export function buildFullTextSourceReviewKit({
  generatedAt,
  includeAllSources = false,
  inventory = DEFAULT_FULL_TEXT_SOURCE_INVENTORY,
  outputDir = DEFAULT_FULL_TEXT_REVIEW_KIT_DIR,
  sourceId
}: {
  generatedAt?: Date;
  includeAllSources?: boolean;
  inventory?: FullTextSourceInventoryItem[];
  outputDir?: string;
  sourceId?: string;
} = {}): FullTextSourceReviewKit {
  if (includeAllSources && sourceId) {
    throw new Error("--all-sources review kits cannot be combined with a source id.");
  }

  const timestamp = generatedAt ?? new Date();
  const normalizedOutputDir = normalizeOutputDir(outputDir);
  const template = buildFullTextSourceInventoryTemplate({
    generatedAt: timestamp,
    inventory
  });
  const report = buildFullTextSourceReadinessReport({
    generatedAt: timestamp,
    inventory
  });
  const queue = buildFullTextSourceReviewQueue(report.rows);
  const worksheets = includeAllSources
    ? queue.map((item) =>
        buildFullTextSourceReviewWorksheet({
          generatedAt: timestamp,
          inventory,
          sourceId: item.id
        })
      )
    : [
        buildFullTextSourceReviewWorksheet({
          generatedAt: timestamp,
          inventory,
          sourceId
        })
      ];
  const firstWorksheet = worksheets[0];

  if (!firstWorksheet) {
    throw new Error("No full-text source inventory entries are available for review-kit generation.");
  }

  const inventoryPath = `${normalizedOutputDir}/fulltext-source-inventory.local.json`;
  const worksheetFiles = worksheets.map((worksheet) => ({
    content: fullTextSourceReviewWorksheetToMarkdown(worksheet),
    description: includeAllSources
      ? "Source review worksheet from the ranked full-text source queue; it does not approve live fetch or connector work."
      : "Focused source review worksheet for the highest-priority source; it does not approve live fetch or connector work.",
    kind: "source-worksheet" as const,
    path: `${normalizedOutputDir}/${inventoryWorksheetFileName(worksheet.source.id)}`,
    source: worksheet.source
  }));
  const indexPath = `${normalizedOutputDir}/fulltext-source-review-kit-index.md`;
  const indexFile = includeAllSources
    ? {
        content: fullTextSourceReviewKitIndexMarkdown({
          generatedAt: template.generatedAt,
          inventoryPath,
          report,
          worksheetFiles
        }),
        description:
          "Read-first index for the all-source full-text review kit; links every generated worksheet and keeps approvals false.",
        kind: "review-kit-index" as const,
        path: indexPath
      }
    : undefined;
  const files: FullTextSourceReviewKitFile[] = [
    {
      content: `${JSON.stringify(template, null, 2)}\n`,
      description:
        "Approval-false user-owned inventory starter; edit this file before rerunning the gate.",
      kind: "inventory-template",
      path: inventoryPath
    },
    ...(indexFile ? [indexFile] : []),
    ...worksheetFiles.map((file) => ({
      content: file.content,
      description: file.description,
      kind: file.kind,
      path: file.path
    }))
  ];
  const worksheetPath = worksheetFiles[0]?.path ?? indexPath;

  return {
    files,
    generatedAt: template.generatedAt,
    humanOwned: true,
    nextAction:
      includeAllSources
        ? `Review and edit ${inventoryPath}, using ${indexPath} and the generated source worksheets; then run onboarding:fulltext-sources with --inventory-file and --progress --summary.`
        : `Review and edit ${inventoryPath}, using ${worksheetPath} as the first checklist; then run onboarding:fulltext-sources with --inventory-file and --progress --summary.`,
    noAutoApproval: true,
    noConnectorApproval: true,
    noLiveFetch: true,
    outputDir: normalizedOutputDir,
    readOnly: true,
    source: firstWorksheet.source,
    summary: {
      files: files.length,
      inventorySources: template.sources.length,
      missingRequiredFields: worksheets.reduce(
        (total, worksheet) => total + worksheet.missingRequiredFields.length,
        0
      ),
      reviewFields: worksheets.reduce(
        (total, worksheet) => total + worksheet.reviewFields.length,
        0
      ),
      sourceWorksheets: worksheetFiles.length
    }
  };
}

function fullTextSourceReviewKitIndexMarkdown({
  generatedAt,
  inventoryPath,
  report,
  worksheetFiles
}: {
  generatedAt: string;
  inventoryPath: string;
  report: FullTextSourceReadinessReport;
  worksheetFiles: Array<{
    path: string;
    source: FullTextSourceReviewWorksheet["source"];
  }>;
}) {
  const lines = [
    "# Full-Text Source Review Kit Index",
    "",
    `Generated: ${generatedAt}`,
    `Read-only: ${report.readOnly}`,
    `Human-owned: ${report.humanOwned}`,
    `No auto approval: true`,
    `No connector approval: true`,
    `No live fetch: true`,
    "",
    "## Inventory Starter",
    "",
    `- \`${inventoryPath}\`: approval-false user-owned inventory starter.`,
    "",
    "## Source Worksheets",
    "",
    ...worksheetFiles.map(
      (file, index) =>
        `${index + 1}. ${file.source.label} (${file.source.id}) - \`${file.path}\` - ${file.source.tier}, ${file.source.convictionScore}/100`
    ),
    "",
    "## Boundaries",
    "",
    "- This kit writes local review artifacts only.",
    "- Approval fields remain false in the inventory starter.",
    "- It does not approve a source, approve a connector, enable live fetch, store raw full text, accept candidates, write extraction rows, mark claim reviews, or promote public evidence.",
    "",
    "## Next Action",
    "",
    "Fill reviewed terms, policy, access, rate/cache, retention, and derived-export fields in the user-owned inventory file; keep live-fetch approval false until a separate connector approval packet is explicitly reviewed.",
    ""
  ];

  return `${lines.join("\n")}\n`;
}

export function buildFullTextConnectorPrepKit({
  generatedAt,
  inventory = DEFAULT_FULL_TEXT_SOURCE_INVENTORY,
  inventoryFilePath = DEFAULT_FULL_TEXT_SOURCE_INVENTORY_PATH,
  outputDir = DEFAULT_FULL_TEXT_REVIEW_KIT_DIR
}: {
  generatedAt?: Date;
  inventory?: FullTextSourceInventoryItem[];
  inventoryFilePath?: string;
  outputDir?: string;
} = {}): FullTextConnectorPrepKit {
  const timestamp = generatedAt ?? new Date();
  const normalizedOutputDir = normalizeOutputDir(outputDir);
  const reviewDraft = buildFullTextConnectorReviewDraft({
    generatedAt: timestamp,
    inventory,
    inventoryFilePath
  });
  const implementationPlan = buildFullTextConnectorImplementationPlan({
    generatedAt: timestamp,
    inventory,
    inventoryFilePath
  });
  const approvalPacket = buildFullTextConnectorApprovalPacket({
    generatedAt: timestamp,
    inventory,
    inventoryFilePath
  });
  const indexPath = `${normalizedOutputDir}/fulltext-connector-prep-kit-index.md`;
  const reviewPath = `${normalizedOutputDir}/fulltext-connector-review.md`;
  const planPath = `${normalizedOutputDir}/fulltext-connector-implementation-plan.md`;
  const approvalPacketPath =
    `${normalizedOutputDir}/fulltext-connector-approval-packet.md`;
  const fixtureTemplateFiles = implementationPlan.rows
    .filter((row) => row.status === "ready-for-fixture-design")
    .map((row) => ({
      content: `${JSON.stringify(
        buildFullTextLocalFixtureTemplate({
          sourceId: row.id,
          title: `${row.label} local fixture starter`
        }),
        null,
        2
      )}\n`,
      description:
        "Blank local fixture starter for fixture-only parser-shape review; it is blocked until reviewed local values are filled.",
      kind: "fixture-template" as const,
      path: `${normalizedOutputDir}/fulltext-fixtures/${row.connectorKey}.local.json`,
      row
    }));
  const nextAction =
    approvalPacket.summary.readyForApprovalSources > 0
      ? `Review ${approvalPacketPath} for an explicit operator decision; this generated kit itself grants no connector, implementation, live-fetch, or network-fetch approval.`
      : approvalPacket.nextAction;
  const files: FullTextConnectorPrepKitFile[] = [
    {
      content: fullTextConnectorPrepKitIndexMarkdown({
        approvalPacket,
        approvalPacketPath,
        fixtureTemplateFiles,
        implementationPlan,
        indexPath,
        nextAction,
        planPath,
        reviewDraft,
        reviewPath
      }),
      description:
        "Read-first index for connector prep artifacts; it bundles review, fixture-first plan, and approval packet paths without granting approval.",
      kind: "connector-prep-index",
      path: indexPath
    },
    {
      content: fullTextConnectorReviewDraftToMarkdown(reviewDraft),
      description:
        "Connector design-review draft; it does not approve connector work or live fetch.",
      kind: "connector-review",
      path: reviewPath
    },
    {
      content: fullTextConnectorImplementationPlanToMarkdown(implementationPlan),
      description:
        "Fixture-first connector implementation plan; it does not approve implementation or network fetch.",
      kind: "connector-plan",
      path: planPath
    },
    {
      content: fullTextConnectorApprovalPacketToMarkdown(approvalPacket),
      description:
        "Explicit approval packet template; approval remains false until a separate operator decision.",
      kind: "connector-approval-packet",
      path: approvalPacketPath
    },
    ...fixtureTemplateFiles.map((file) => ({
      content: file.content,
      description: file.description,
      kind: file.kind,
      path: file.path
    }))
  ];

  return {
    approvalGranted: false,
    files,
    generatedAt: reviewDraft.generatedAt,
    humanOwned: true,
    nextAction,
    noAutoApproval: true,
    noConnectorApproval: true,
    noImplementationApproval: true,
    noLiveFetch: true,
    noNetworkFetch: true,
    outputDir: normalizedOutputDir,
    readOnly: true,
    summary: {
      blockedApprovalSources: approvalPacket.summary.blockedSources,
      blockedReviewSources: reviewDraft.summary.blockedSources,
      files: files.length,
      fixtureTemplates: fixtureTemplateFiles.length,
      holdApprovalSources: approvalPacket.summary.holdSources,
      holdReviewSources: reviewDraft.summary.holdSources,
      readyForApprovalSources: approvalPacket.summary.readyForApprovalSources,
      readyForFixtureDesignSources:
        implementationPlan.summary.readyForFixtureDesignSources,
      readyForReviewSources: reviewDraft.summary.readyForReviewSources,
      sources: reviewDraft.summary.sources
    }
  };
}

function fullTextConnectorPrepKitIndexMarkdown({
  approvalPacket,
  approvalPacketPath,
  fixtureTemplateFiles,
  implementationPlan,
  indexPath,
  nextAction,
  planPath,
  reviewDraft,
  reviewPath
}: {
  approvalPacket: FullTextConnectorApprovalPacket;
  approvalPacketPath: string;
  fixtureTemplateFiles: Array<{
    path: string;
    row: FullTextConnectorImplementationPlanRow;
  }>;
  implementationPlan: FullTextConnectorImplementationPlan;
  indexPath: string;
  nextAction: string;
  planPath: string;
  reviewDraft: FullTextConnectorReviewDraft;
  reviewPath: string;
}) {
  const lines = [
    "# Full-Text Connector Prep Kit Index",
    "",
    `Generated: ${reviewDraft.generatedAt}`,
    `Read-only: ${reviewDraft.readOnly}`,
    `Human-owned: ${reviewDraft.humanOwned}`,
    `Approval granted: ${approvalPacket.approvalGranted}`,
    `No auto approval: ${reviewDraft.noAutoApproval}`,
    `No connector approval: ${reviewDraft.noConnectorApproval}`,
    `No implementation approval: ${approvalPacket.noImplementationApproval}`,
    `No live fetch: ${reviewDraft.noLiveFetch}`,
    `No network fetch: ${implementationPlan.noNetworkFetch}`,
    "",
    "## Files",
    "",
    `- \`${indexPath}\`: this read-first index and boundary summary.`,
    `- \`${reviewPath}\`: connector design-review draft.`,
    `- \`${planPath}\`: fixture-first implementation plan.`,
    `- \`${approvalPacketPath}\`: explicit approval packet template.`,
    ...fixtureTemplateFiles.map(
      (file) =>
        `- \`${file.path}\`: blank local fixture starter for ${file.row.label} (${file.row.connectorKey}).`
    ),
    "",
    "## Rollup",
    "",
    `- Sources: ${reviewDraft.summary.sources}`,
    `- Ready for connector review: ${reviewDraft.summary.readyForReviewSources}`,
    `- Ready for fixture design: ${implementationPlan.summary.readyForFixtureDesignSources}`,
    `- Ready for explicit approval: ${approvalPacket.summary.readyForApprovalSources}`,
    `- Local fixture starters: ${fixtureTemplateFiles.length}`,
    `- Blocked connector reviews: ${reviewDraft.summary.blockedSources}`,
    `- Connector-review holds: ${reviewDraft.summary.holdSources}`,
    `- Blocked approval packets: ${approvalPacket.summary.blockedSources}`,
    `- Approval-packet holds: ${approvalPacket.summary.holdSources}`,
    "",
    "## Boundaries",
    "",
    "- This kit writes local connector prep artifacts only.",
    "- Local fixture starters are blank templates and remain blocked until reviewed local values and a short reviewed excerpt are added by an operator.",
    "- It does not approve a source, approve a connector, approve implementation, enable live fetch, make network requests, store raw full text, expose public raw text, accept candidates, write extraction rows, mark claim reviews, or promote public evidence.",
    "- Any connector or implementation decision must happen in a separate explicit operator review outside this generated kit.",
    "",
    "## Next Action",
    "",
    nextAction,
    ""
  ];

  return `${lines.join("\n")}\n`;
}

export function buildFullTextSourceInventoryProgressReport({
  generatedAt,
  inventory = DEFAULT_FULL_TEXT_SOURCE_INVENTORY,
  starterInventory = DEFAULT_FULL_TEXT_SOURCE_INVENTORY
}: {
  generatedAt?: Date;
  inventory?: FullTextSourceInventoryItem[];
  starterInventory?: FullTextSourceInventoryItem[];
} = {}): FullTextSourceInventoryProgressReport {
  const report = buildFullTextSourceReadinessReport({ generatedAt, inventory });
  const rows = report.rows.map((row) => {
    const source = requireInventorySource(inventory, row.id);
    const starter = starterForSource(source, starterInventory);
    const totalRequiredFields = FULL_TEXT_SOURCE_INVENTORY_REVIEW_CHECKLIST.filter(
      (item) => item.requiredForLiveCapture
    ).length;
    const completedRequiredFields = totalRequiredFields - row.sourceConviction.missingRequiredFields.length;
    const approvalWarnings = prematureApprovalWarnings(source);
    const changedFields = progressFieldChanges(source, starter);
    const status = inventoryProgressStatus({
      approvalWarnings,
      changedFields,
      missingRequiredFields: row.sourceConviction.missingRequiredFields,
      readinessStatus: row.status
    });

    return {
      approvalWarnings,
      changedFields,
      completedRequiredFields,
      convictionScore: row.sourceConviction.convictionScore,
      id: row.id,
      label: row.label,
      missingRequiredFields: row.sourceConviction.missingRequiredFields,
      nextAction: progressNextAction(status, row),
      readinessStatus: row.status,
      sourceReputation: row.sourceConviction.sourceReputation,
      status,
      tier: row.sourceConviction.tier,
      totalRequiredFields
    };
  });
  const summary = summarizeInventoryProgress(rows);

  return {
    generatedAt: report.generatedAt,
    humanOwned: true,
    liveCaptureReady: report.liveCaptureReady,
    nextAction:
      rows.find((row) => row.status === "premature-approval")?.nextAction ??
      rows.find((row) => row.status === "in-progress")?.nextAction ??
      rows.find((row) => row.status === "not-started")?.nextAction ??
      "Reviewed source entries are ready for a separate, explicit connector implementation review.",
    noAutoApproval: true,
    noLiveFetch: true,
    readOnly: true,
    rows,
    summary
  };
}

export function summarizeFullTextSourceInventoryProgressReport(
  report: FullTextSourceInventoryProgressReport
) {
  return {
    generatedAt: report.generatedAt,
    humanOwned: true,
    liveCaptureReady: report.liveCaptureReady,
    nextAction: report.nextAction,
    noAutoApproval: true,
    noLiveFetch: true,
    readOnly: true,
    rows: report.rows.map((row) => ({
      approvalWarnings: row.approvalWarnings,
      changedFields: row.changedFields.map((field) => field.label),
      completedRequiredFields: row.completedRequiredFields,
      id: row.id,
      label: row.label,
      missingRequiredFields: row.missingRequiredFields,
      nextAction: row.nextAction,
      status: row.status,
      tier: row.tier,
      totalRequiredFields: row.totalRequiredFields
    })),
    summary: report.summary
  };
}

export function buildFullTextConnectorReviewDraft({
  generatedAt,
  inventory = DEFAULT_FULL_TEXT_SOURCE_INVENTORY,
  inventoryFilePath = DEFAULT_FULL_TEXT_SOURCE_INVENTORY_PATH
}: {
  generatedAt?: Date;
  inventory?: FullTextSourceInventoryItem[];
  inventoryFilePath?: string;
} = {}): FullTextConnectorReviewDraft {
  const progress = buildFullTextSourceInventoryProgressReport({ generatedAt, inventory });
  const rows = progress.rows.map((progressRow) => {
    const source = requireInventorySource(inventory, progressRow.id);
    const reviewStatus = connectorReviewDraftStatus(progressRow, source);
    const blockers = connectorReviewBlockers(progressRow, source, reviewStatus);

    return {
      accessMethod: source.accessMethod,
      approvalWarnings: progressRow.approvalWarnings,
      blockers,
      connectorKey: connectorKeyForSource(source),
      dryRunSupported: source.dryRunSupported,
      id: source.id,
      implementationChecklist: connectorImplementationChecklist(source),
      label: source.label,
      nextAction: connectorReviewNextAction(reviewStatus, blockers),
      policy: {
        allowedUse: source.allowedUse,
        cacheTtl: source.cacheTtl,
        derivedOnlyPublicExport: true,
        policyUrl: source.policyUrl,
        publicRawTextExport: false as const,
        rateLimit: source.rateLimit,
        rawRetentionPolicy: source.rawRetentionPolicy,
        termsUrl: source.termsUrl
      },
      reviewStatus,
      sourceReputation: progressRow.sourceReputation,
      tier: progressRow.tier,
      validationCommands: [
        `npm run onboarding:fulltext-sources -- --inventory-file ${inventoryFilePath} --progress --summary`,
        "npm run test -- src/lib/full-text-source-readiness.test.ts",
        "npm run typecheck",
        "npm run build"
      ]
    };
  });
  const summary = summarizeConnectorReviewDraft(rows);

  return {
    generatedAt: progress.generatedAt,
    humanOwned: true,
    nextAction:
      rows.find((row) => row.reviewStatus === "blocked")?.nextAction ??
      rows.find((row) => row.reviewStatus === "hold")?.nextAction ??
      "Ready sources may enter a separate explicit connector design review; this draft grants no approval.",
    noAutoApproval: true,
    noConnectorApproval: true,
    noLiveFetch: true,
    readOnly: true,
    rows,
    summary
  };
}

export function summarizeFullTextConnectorReviewDraft(
  draft: FullTextConnectorReviewDraft
) {
  return {
    generatedAt: draft.generatedAt,
    humanOwned: true,
    nextAction: draft.nextAction,
    noAutoApproval: true,
    noConnectorApproval: true,
    noLiveFetch: true,
    readOnly: true,
    rows: draft.rows.map((row) => ({
      blockers: row.blockers,
      connectorKey: row.connectorKey,
      id: row.id,
      label: row.label,
      nextAction: row.nextAction,
      reviewStatus: row.reviewStatus,
      tier: row.tier
    })),
    summary: draft.summary
  };
}

export function buildFullTextConnectorImplementationPlan({
  generatedAt,
  inventory = DEFAULT_FULL_TEXT_SOURCE_INVENTORY,
  inventoryFilePath = DEFAULT_FULL_TEXT_SOURCE_INVENTORY_PATH
}: {
  generatedAt?: Date;
  inventory?: FullTextSourceInventoryItem[];
  inventoryFilePath?: string;
} = {}): FullTextConnectorImplementationPlan {
  const reviewDraft = buildFullTextConnectorReviewDraft({
    generatedAt,
    inventory,
    inventoryFilePath
  });
  const rows = reviewDraft.rows.map((row) => {
    const status: FullTextConnectorImplementationPlanStatus =
      row.reviewStatus === "ready-for-review"
        ? "ready-for-fixture-design"
        : "blocked";

    return {
      blockers:
        status === "blocked"
          ? uniqueNonEmpty([
              ...row.blockers,
              "Source must reach ready-for-review in the connector review draft before fixture design begins."
            ])
          : [],
      connectorKey: row.connectorKey,
      dryRunSupported: row.dryRunSupported,
      guardrails: connectorImplementationGuardrails(row),
      id: row.id,
      implementationPhases: connectorImplementationPhases(row, status),
      label: row.label,
      nextAction:
        status === "ready-for-fixture-design"
          ? "Create fixture-only parser and derived-field tests behind a non-public feature gate; do not add live network fetch in this plan."
          : row.nextAction,
      plannedFiles: connectorImplementationPlannedFiles(row),
      policy: row.policy,
      reviewStatus: row.reviewStatus,
      status,
      validationCommands: connectorImplementationValidationCommands(row, inventoryFilePath)
    };
  });
  const summary = summarizeConnectorImplementationPlanRows(rows);

  return {
    generatedAt: reviewDraft.generatedAt,
    humanOwned: true,
    nextAction:
      rows.find((row) => row.status === "ready-for-fixture-design")?.nextAction ??
      rows.find((row) => row.status === "blocked")?.nextAction ??
      "No connector implementation planning rows are available.",
    noAutoApproval: true,
    noConnectorApproval: true,
    noLiveFetch: true,
    noNetworkFetch: true,
    readOnly: true,
    rows,
    summary
  };
}

export function summarizeFullTextConnectorImplementationPlan(
  plan: FullTextConnectorImplementationPlan
) {
  return {
    generatedAt: plan.generatedAt,
    humanOwned: true,
    nextAction: plan.nextAction,
    noAutoApproval: true,
    noConnectorApproval: true,
    noLiveFetch: true,
    noNetworkFetch: true,
    readOnly: true,
    rows: plan.rows.map((row) => ({
      blockers: row.blockers,
      connectorKey: row.connectorKey,
      id: row.id,
      label: row.label,
      nextAction: row.nextAction,
      reviewStatus: row.reviewStatus,
      status: row.status
    })),
    summary: plan.summary
  };
}

export function buildFullTextConnectorApprovalPacket({
  generatedAt,
  inventory = DEFAULT_FULL_TEXT_SOURCE_INVENTORY,
  inventoryFilePath = DEFAULT_FULL_TEXT_SOURCE_INVENTORY_PATH
}: {
  generatedAt?: Date;
  inventory?: FullTextSourceInventoryItem[];
  inventoryFilePath?: string;
} = {}): FullTextConnectorApprovalPacket {
  const implementationPlan = buildFullTextConnectorImplementationPlan({
    generatedAt,
    inventory,
    inventoryFilePath
  });
  const rows = implementationPlan.rows.map((row) =>
    fullTextConnectorApprovalPacketRow(row, inventoryFilePath)
  );
  const summary = summarizeConnectorApprovalPacketRows(rows);

  return {
    approvalGranted: false,
    generatedAt: implementationPlan.generatedAt,
    humanOwned: true,
    nextAction:
      rows.find((row) => row.status === "ready-for-approval")?.nextAction ??
      rows.find((row) => row.status === "blocked")?.nextAction ??
      rows.find((row) => row.status === "hold")?.nextAction ??
      "No connector approval rows are available.",
    noAutoApproval: true,
    noConnectorApproval: true,
    noImplementationApproval: true,
    noLiveFetch: true,
    noNetworkFetch: true,
    readOnly: true,
    rows,
    summary
  };
}

export function summarizeFullTextConnectorApprovalPacket(
  packet: FullTextConnectorApprovalPacket
) {
  return {
    approvalGranted: false,
    generatedAt: packet.generatedAt,
    humanOwned: true,
    nextAction: packet.nextAction,
    noAutoApproval: true,
    noConnectorApproval: true,
    noImplementationApproval: true,
    noLiveFetch: true,
    noNetworkFetch: true,
    readOnly: true,
    rows: packet.rows.map((row) => ({
      approvalGranted: false,
      approvalItems: row.approvalItems.map((item) => ({
        complete: item.complete,
        detail: item.detail,
        id: item.id,
        label: item.label
      })),
      blockers: row.blockers,
      connectorKey: row.connectorKey,
      incompleteApprovalItems: row.approvalItems
        .filter((item) => !item.complete)
        .map((item) => item.label),
      implementationStatus: row.implementationStatus,
      id: row.id,
      label: row.label,
      nextAction: row.nextAction,
      operatorDecisionTemplate: row.operatorDecisionTemplate,
      reviewStatus: row.reviewStatus,
      status: row.status,
      validationCommands: row.validationCommands
    })),
    summary: packet.summary
  };
}

export function fullTextConnectorApprovalPacketToMarkdown(
  packet: FullTextConnectorApprovalPacket
) {
  const lines = [
    "# Full-Text Connector Approval Packet",
    "",
    `Generated: ${packet.generatedAt}`,
    `Read-only: ${packet.readOnly}`,
    `Approval granted: ${packet.approvalGranted}`,
    `No auto approval: ${packet.noAutoApproval}`,
    `No connector approval: ${packet.noConnectorApproval}`,
    `No implementation approval: ${packet.noImplementationApproval}`,
    `No live fetch: ${packet.noLiveFetch}`,
    `No network fetch: ${packet.noNetworkFetch}`,
    "",
    "## Summary",
    "",
    `Sources: ${packet.summary.sources}`,
    `Ready for explicit approval: ${packet.summary.readyForApprovalSources}`,
    `Blocked: ${packet.summary.blockedSources}`,
    `Hold: ${packet.summary.holdSources}`,
    "",
    "## Next Action",
    "",
    packet.nextAction,
    "",
    "## Source Approval Packets",
    ""
  ];

  for (const row of packet.rows) {
    lines.push(
      `### ${row.label}`,
      "",
      `Source id: ${row.id}`,
      `Connector key: ${row.connectorKey}`,
      `Status: ${row.status}`,
      `Review status: ${row.reviewStatus}`,
      `Implementation status: ${row.implementationStatus}`,
      `Approval granted: ${row.approvalGranted}`,
      `Public raw text export: ${row.policy.publicRawTextExport}`,
      "",
      "Policy:",
      `- Terms URL: ${row.policy.termsUrl || "-"}`,
      `- Robots/API policy URL: ${row.policy.policyUrl || "-"}`,
      `- Rate limit: ${row.policy.rateLimit || "-"}`,
      `- Cache TTL: ${row.policy.cacheTtl || "-"}`,
      `- Raw retention policy: ${row.policy.rawRetentionPolicy || "-"}`,
      `- Derived-only public export: ${row.policy.derivedOnlyPublicExport}`,
      "",
      "Approval Items:",
      "",
      "| Item | Complete | Detail |",
      "| --- | --- | --- |",
      ...row.approvalItems.map(
        (item) =>
          `| ${escapeMarkdownTableCell(item.label)} | ${item.complete ? "yes" : "no"} | ${escapeMarkdownTableCell(item.detail)} |`
      ),
      "",
      "Blockers:",
      "",
      ...markdownList(row.blockers),
      "",
      "Planned Files:",
      "",
      ...markdownList(row.plannedFiles),
      "",
      "Guardrails:",
      "",
      ...markdownList(row.guardrails),
      "",
      "Validation Commands:",
      "",
      ...markdownList(row.validationCommands),
      "",
      "Operator Decision Template:",
      "",
      row.operatorDecisionTemplate,
      "",
      "Next Action:",
      "",
      row.nextAction,
      ""
    );
  }

  return `${lines.join("\n")}\n`;
}

export function fullTextConnectorImplementationPlanToMarkdown(
  plan: FullTextConnectorImplementationPlan
) {
  const lines = [
    "# Full-Text Connector Implementation Plan",
    "",
    `Generated: ${plan.generatedAt}`,
    `Read-only: ${plan.readOnly}`,
    `No auto approval: ${plan.noAutoApproval}`,
    `No connector approval: ${plan.noConnectorApproval}`,
    `No live fetch: ${plan.noLiveFetch}`,
    `No network fetch: ${plan.noNetworkFetch}`,
    "",
    "## Summary",
    "",
    `Sources: ${plan.summary.sources}`,
    `Ready for fixture design: ${plan.summary.readyForFixtureDesignSources}`,
    `Blocked: ${plan.summary.blockedSources}`,
    "",
    "## Next Action",
    "",
    plan.nextAction,
    "",
    "## Source Plans",
    ""
  ];

  for (const row of plan.rows) {
    lines.push(
      `### ${row.label}`,
      "",
      `Source id: ${row.id}`,
      `Connector key: ${row.connectorKey}`,
      `Status: ${row.status}`,
      `Review status: ${row.reviewStatus}`,
      `Dry-run supported: ${row.dryRunSupported}`,
      `Public raw text export: ${row.policy.publicRawTextExport}`,
      "",
      "Blockers:",
      "",
      ...markdownList(row.blockers),
      "",
      "Implementation Phases:",
      "",
      ...markdownList(row.implementationPhases),
      "",
      "Planned Files:",
      "",
      ...markdownList(row.plannedFiles),
      "",
      "Guardrails:",
      "",
      ...markdownList(row.guardrails),
      "",
      "Validation Commands:",
      "",
      ...markdownList(row.validationCommands),
      "",
      "Next Action:",
      "",
      row.nextAction,
      ""
    );
  }

  return `${lines.join("\n")}\n`;
}

export function buildFullTextSourceInventoryNextActionPlan({
  generatedAt,
  inventory = DEFAULT_FULL_TEXT_SOURCE_INVENTORY,
  inventoryFilePath
}: {
  generatedAt?: Date;
  inventory?: FullTextSourceInventoryItem[];
  inventoryFilePath?: string;
} = {}): FullTextSourceInventoryNextActionPlan {
  const timestamp = generatedAt ?? new Date();
  const readiness = buildFullTextSourceReadinessReport({
    generatedAt: timestamp,
    inventory
  });
  const progress = buildFullTextSourceInventoryProgressReport({
    generatedAt: timestamp,
    inventory
  });
  const connectorReview = buildFullTextConnectorReviewDraft({
    generatedAt: timestamp,
    inventory
  });
  const inventoryPath =
    inventoryFilePath?.trim() || DEFAULT_FULL_TEXT_SOURCE_INVENTORY_PATH;
  const inventoryFileProvided = Boolean(inventoryFilePath?.trim());
  const progressRows = prioritizedInventoryProgressRows(
    progress.rows,
    readiness.rows
  );
  const selectedProgress = selectInventoryNextActionRow(
    progressRows,
    inventoryFileProvided
  );
  const selectedConnector = selectedProgress
    ? connectorReview.rows.find((row) => row.id === selectedProgress.id)
    : undefined;
  const status = inventoryNextActionStatus({
    connectorReviewStatus: selectedConnector?.reviewStatus,
    inventoryFileProvided,
    progressStatus: selectedProgress?.status
  });
  const nextAction = inventoryNextActionText({
    selectedConnector,
    selectedProgress,
    status
  });

  return {
    commands: inventoryNextActionCommands({
      inventoryPath,
      selectedSourceId: selectedProgress?.id,
      status
    }),
    generatedAt: progress.generatedAt,
    humanOwned: true,
    inventoryFilePath: inventoryPath,
    inventoryFileProvided,
    nextAction,
    noAutoApproval: true,
    noConnectorApproval: true,
    noLiveFetch: true,
    readOnly: true,
    selectedSource:
      selectedProgress && selectedConnector
        ? {
            approvalWarnings: selectedProgress.approvalWarnings,
            connectorReviewStatus: selectedConnector.reviewStatus,
            convictionScore: selectedProgress.convictionScore,
            id: selectedProgress.id,
            label: selectedProgress.label,
            missingRequiredFields: selectedProgress.missingRequiredFields,
            progressStatus: selectedProgress.status,
            sourceReputation: selectedProgress.sourceReputation,
            tier: selectedProgress.tier
          }
        : undefined,
    status,
    summary: {
      blockedSources: readiness.summary.blockedSources,
      changedSources: progress.summary.changedSources,
      connectorReadyForReviewSources: connectorReview.summary.readyForReviewSources,
      inProgressSources: progress.summary.inProgressSources,
      notStartedSources: progress.summary.notStartedSources,
      prematureApprovalSources: progress.summary.prematureApprovalSources,
      readyForConnectorReviewSources:
        progress.summary.readyForConnectorReviewSources,
      sources: progress.summary.sources
    }
  };
}

export function summarizeFullTextSourceInventoryNextActionPlan(
  plan: FullTextSourceInventoryNextActionPlan
) {
  return {
    commands: plan.commands,
    generatedAt: plan.generatedAt,
    humanOwned: true,
    inventoryFilePath: plan.inventoryFilePath,
    inventoryFileProvided: plan.inventoryFileProvided,
    nextAction: plan.nextAction,
    noAutoApproval: true,
    noConnectorApproval: true,
    noLiveFetch: true,
    readOnly: true,
    selectedSource: plan.selectedSource
      ? {
          approvalWarnings: plan.selectedSource.approvalWarnings,
          connectorReviewStatus: plan.selectedSource.connectorReviewStatus,
          id: plan.selectedSource.id,
          label: plan.selectedSource.label,
          missingRequiredFields: plan.selectedSource.missingRequiredFields,
          progressStatus: plan.selectedSource.progressStatus,
          tier: plan.selectedSource.tier
        }
      : undefined,
    status: plan.status,
    summary: plan.summary
  };
}

export function buildFullTextSourceFixtureScenarioMatrix({
  generatedAt
}: {
  generatedAt?: Date;
} = {}): FullTextSourceFixtureScenarioMatrix {
  const matrixGeneratedAt = (generatedAt ?? new Date()).toISOString();
  const scenarioGeneratedAt = new Date(matrixGeneratedAt);
  const rows = fullTextSourceFixtureScenarios().map((scenario) => {
    const readiness = buildFullTextSourceReadinessReport({
      generatedAt: scenarioGeneratedAt,
      inventory: scenario.inventory
    });
    const progress = buildFullTextSourceInventoryProgressReport({
      generatedAt: scenarioGeneratedAt,
      inventory: scenario.inventory
    });
    const connectorReview = buildFullTextConnectorReviewDraft({
      generatedAt: scenarioGeneratedAt,
      inventory: scenario.inventory
    });
    const progressRow = progress.rows[0];
    const connectorRow = connectorReview.rows[0];
    const actualProgressStatus = progressRow?.status ?? "not-started";
    const actualConnectorReviewStatus = connectorRow?.reviewStatus ?? "blocked";
    const result: FullTextSourceFixtureScenarioResult =
      actualProgressStatus === scenario.expectedProgressStatus &&
      actualConnectorReviewStatus === scenario.expectedConnectorReviewStatus
        ? "pass"
        : "fail";

    return {
      actualConnectorReviewStatus,
      actualProgressStatus,
      approvalWarnings: progressRow?.approvalWarnings ?? [],
      connectorReadyForReview: actualConnectorReviewStatus === "ready-for-review",
      convictionScore: progressRow?.convictionScore ?? 0,
      description: scenario.description,
      expectedConnectorReviewStatus: scenario.expectedConnectorReviewStatus,
      expectedProgressStatus: scenario.expectedProgressStatus,
      id: scenario.id,
      label: scenario.label,
      liveCaptureReady: readiness.liveCaptureReady,
      missingRequiredFields: progressRow?.missingRequiredFields ?? [],
      nextAction: progressRow?.nextAction ?? readiness.nextAction,
      result,
      tier: progressRow?.tier ?? "review-later"
    };
  });
  const summary = summarizeFixtureScenarioRows(rows);

  return {
    generatedAt: matrixGeneratedAt,
    humanOwned: true,
    nextAction:
      summary.failedScenarios > 0
        ? "Fix failing fixture scenarios before adding more full-text source automation."
        : "Fixture scenarios cover blocked, in-progress, premature-approval, and connector-review-ready paths without approving live source access.",
    noAutoApproval: true,
    noConnectorApproval: true,
    noLiveFetch: true,
    readOnly: true,
    rows,
    summary
  };
}

export function summarizeFullTextSourceFixtureScenarioMatrix(
  matrix: FullTextSourceFixtureScenarioMatrix
) {
  return {
    generatedAt: matrix.generatedAt,
    humanOwned: true,
    nextAction: matrix.nextAction,
    noAutoApproval: true,
    noConnectorApproval: true,
    noLiveFetch: true,
    readOnly: true,
    rows: matrix.rows.map((row) => ({
      actualConnectorReviewStatus: row.actualConnectorReviewStatus,
      actualProgressStatus: row.actualProgressStatus,
      approvalWarnings: row.approvalWarnings,
      expectedConnectorReviewStatus: row.expectedConnectorReviewStatus,
      expectedProgressStatus: row.expectedProgressStatus,
      id: row.id,
      label: row.label,
      missingRequiredFields: row.missingRequiredFields,
      nextAction: row.nextAction,
      result: row.result,
      tier: row.tier
    })),
    summary: matrix.summary
  };
}

export function fullTextConnectorReviewDraftToMarkdown(
  draft: FullTextConnectorReviewDraft
) {
  const lines = [
    "# Full-Text Connector Review Draft",
    "",
    `Generated: ${draft.generatedAt}`,
    `Read-only: ${draft.readOnly}`,
    `No auto approval: ${draft.noAutoApproval}`,
    `No connector approval: ${draft.noConnectorApproval}`,
    `No live fetch: ${draft.noLiveFetch}`,
    "",
    "## Summary",
    "",
    `- Sources: ${draft.summary.sources}`,
    `- Ready for review: ${draft.summary.readyForReviewSources}`,
    `- Blocked: ${draft.summary.blockedSources}`,
    `- Hold: ${draft.summary.holdSources}`,
    "",
    "## Next Action",
    "",
    draft.nextAction,
    "",
    "## Source Drafts"
  ];

  for (const row of draft.rows) {
    lines.push(
      "",
      `### ${row.label}`,
      "",
      `- Source id: ${row.id}`,
      `- Connector key: ${row.connectorKey}`,
      `- Review status: ${row.reviewStatus}`,
      `- Tier: ${row.tier}`,
      `- Access method: ${row.accessMethod}`,
      `- Dry-run supported: ${row.dryRunSupported}`,
      "",
      "Policy:",
      `- Terms URL: ${row.policy.termsUrl || "-"}`,
      `- Robots/API policy URL: ${row.policy.policyUrl || "-"}`,
      `- Rate limit: ${row.policy.rateLimit || "-"}`,
      `- Cache TTL: ${row.policy.cacheTtl || "-"}`,
      `- Raw retention policy: ${row.policy.rawRetentionPolicy || "-"}`,
      `- Derived-only public export: ${row.policy.derivedOnlyPublicExport}`,
      `- Public raw text export: ${row.policy.publicRawTextExport}`,
      "",
      "Blockers:",
      ...markdownList(row.blockers),
      "",
      "Approval Warnings:",
      ...markdownList(row.approvalWarnings),
      "",
      "Implementation Checklist:",
      ...markdownList(row.implementationChecklist),
      "",
      "Validation Commands:",
      ...markdownList(row.validationCommands),
      "",
      `Next action: ${row.nextAction}`
    );
  }

  return `${lines.join("\n")}\n`;
}

function parseInventoryItem(value: unknown): FullTextSourceInventoryItem {
  if (!isRecord(value)) {
    throw new Error("Full-text source inventory entries must be objects.");
  }

  return {
    accessMethod: parseAccessMethod(value.accessMethod),
    allowedUse: readString(value.allowedUse),
    approval: parseApproval(value.approval),
    authRequired: readBoolean(value.authRequired),
    cacheTtl: readString(value.cacheTtl),
    captchaRisk: readBoolean(value.captchaRisk),
    dryRunSupported: readBoolean(value.dryRunSupported),
    id: requireString(value.id, "source id"),
    label: requireString(value.label, "source label"),
    liveFetchSupported: readBoolean(value.liveFetchSupported),
    loginRequired: readBoolean(value.loginRequired),
    notes: readString(value.notes),
    policyUrl: readString(value.policyUrl),
    privateDataRisk: readBoolean(value.privateDataRisk),
    rateLimit: readString(value.rateLimit),
    rawRetentionPolicy: readString(value.rawRetentionPolicy),
    reviewedAt: readString(value.reviewedAt),
    reviewedBy: readString(value.reviewedBy),
    sourceKind: requireString(value.sourceKind, "source kind"),
    termsUrl: readString(value.termsUrl)
  };
}

function fullTextSourceReadinessRow(
  source: FullTextSourceInventoryItem
): FullTextSourceReadinessRow {
  const blockers = fullTextSourceBlockers(source);
  const sourceConviction = fullTextSourceConviction(source);
  const warnings = [
    source.authRequired ? "Authentication required; secrets/cookies must not be automated casually." : undefined,
    source.loginRequired ? "Login required; private or licensed access is not approved for automation." : undefined,
    source.captchaRisk ? "CAPTCHA or anti-automation risk requires manual review." : undefined,
    source.privateDataRisk ? "Private/local source packet risk; raw text must stay local and reviewed." : undefined
  ].filter((warning): warning is string => Boolean(warning));

  return {
    accessMethod: source.accessMethod,
    blockers,
    dryRunSupported: source.dryRunSupported,
    id: source.id,
    label: source.label,
    liveFetchSupported: source.liveFetchSupported,
    nextAction:
      blockers[0] ??
      "Source approval is complete; implement any live connector in a separate explicit review step.",
    notes: source.notes,
    sourceConviction,
    sourceKind: source.sourceKind,
    status: blockers.length === 0 ? "ready" : "blocked",
    warnings
  };
}

function buildFullTextSourceReviewQueue(
  rows: FullTextSourceReadinessRow[]
): FullTextSourceReviewQueueItem[] {
  return rows
    .map((row) => ({
      convictionScore: row.sourceConviction.convictionScore,
      id: row.id,
      label: row.label,
      limitations: row.sourceConviction.limitations,
      missingRequiredFields: row.sourceConviction.missingRequiredFields,
      nextAction: row.nextAction,
      positiveFactors: row.sourceConviction.positiveFactors,
      reviewPriority: row.sourceConviction.reviewPriority,
      sourceReputation: row.sourceConviction.sourceReputation,
      tier: row.sourceConviction.tier
    }))
    .sort(
      (left, right) =>
        left.reviewPriority - right.reviewPriority ||
        right.convictionScore - left.convictionScore ||
        left.label.localeCompare(right.label)
    );
}

function fullTextSourceConviction(
  source: FullTextSourceInventoryItem
): FullTextSourceConviction {
  const sourceReputation = sourceReputationFor(source);
  const tier = fullTextSourceReviewTier(source, sourceReputation);
  const missingRequiredFields = missingFullTextReviewFields(source);
  const positiveFactors: string[] = [];
  const limitations: string[] = [];
  let score = reputationScore(sourceReputation);

  if (sourceReputation === "high") {
    positiveFactors.push("High-repute biomedical, regulatory, registry, or government source class.");
  } else if (sourceReputation === "moderate") {
    positiveFactors.push("Recognizable source class, but source-specific rights still vary.");
  } else if (sourceReputation === "manual-only") {
    positiveFactors.push("Useful for operator-owned local fixture review.");
  } else {
    limitations.push("Source class reputation is not established in the onboarding policy.");
  }

  if (source.accessMethod === "api" || source.accessMethod === "bulk-download") {
    positiveFactors.push("API or bulk access is easier to review than page automation.");
    score += 20;
  } else if (source.accessMethod === "manual-local-file" || source.accessMethod === "local-fixture") {
    positiveFactors.push("Manual/local fixture path supports dry-run shape checks.");
    score += 8;
  } else {
    limitations.push("Publisher-page access varies by site and is not a default automation target.");
    score -= 15;
  }

  if (source.dryRunSupported) {
    positiveFactors.push("Dry-run support is available before any live connector work.");
    score += 10;
  }

  if (source.liveFetchSupported) {
    positiveFactors.push("Inventory marks live fetch as technically supported after review.");
    score += 5;
  } else {
    limitations.push("Live fetch support is not approved or implemented.");
  }

  score += reviewedFieldCount(source) * 3;
  score -= missingRequiredFields.length * 4;

  if (source.termsUrl && source.policyUrl) {
    positiveFactors.push("Terms and access-policy URLs are present for review.");
  }

  if (source.authRequired || source.loginRequired || source.captchaRisk) {
    limitations.push("Authentication, login, or anti-automation risk makes this a hold item.");
    score -= 25;
  }

  if (source.privateDataRisk) {
    limitations.push("Private/local data risk keeps raw text local and review-owned.");
    score -= 10;
  }

  if (missingRequiredFields.length > 0) {
    limitations.push(
      `${missingRequiredFields.length} required live-capture review field(s) remain incomplete.`
    );
  }

  return {
    convictionScore: clampScore(score),
    limitations: uniqueNonEmpty(limitations),
    missingRequiredFields,
    positiveFactors: uniqueNonEmpty(positiveFactors),
    reviewPriority: fullTextSourceReviewPriority(tier),
    sourceReputation,
    tier
  };
}

function sourceReputationFor(source: FullTextSourceInventoryItem): FullTextSourceReputation {
  const haystack = `${source.id} ${source.label} ${source.sourceKind}`.toLowerCase();

  if (
    haystack.includes("biomedical") ||
    haystack.includes("pubmed") ||
    haystack.includes("pmc") ||
    haystack.includes("clinicaltrials") ||
    haystack.includes("registry") ||
    haystack.includes("government") ||
    haystack.includes("regulatory")
  ) {
    return "high";
  }

  if (source.accessMethod === "manual-local-file" || source.accessMethod === "local-fixture") {
    return "manual-only";
  }

  if (haystack.includes("publisher") || haystack.includes("literature")) {
    return "moderate";
  }

  return "low";
}

function fullTextSourceReviewTier(
  source: FullTextSourceInventoryItem,
  reputation: FullTextSourceReputation
): FullTextSourceReviewTier {
  if (source.authRequired || source.loginRequired || source.captchaRisk) {
    return "hold";
  }

  if (source.accessMethod === "publisher-page") {
    return "hold";
  }

  if (source.dryRunSupported && reputation === "manual-only") {
    return "fixture-only";
  }

  if (
    reputation === "high" &&
    (source.accessMethod === "api" || source.accessMethod === "bulk-download") &&
    !source.privateDataRisk
  ) {
    return "start-here";
  }

  return "review-later";
}

function fullTextSourceReviewPriority(tier: FullTextSourceReviewTier) {
  if (tier === "start-here") {
    return 10;
  }

  if (tier === "fixture-only") {
    return 30;
  }

  if (tier === "review-later") {
    return 50;
  }

  return 90;
}

function reputationScore(reputation: FullTextSourceReputation) {
  if (reputation === "high") {
    return 55;
  }

  if (reputation === "moderate") {
    return 35;
  }

  if (reputation === "manual-only") {
    return 25;
  }

  return 15;
}

function missingFullTextReviewFields(source: FullTextSourceInventoryItem) {
  return FULL_TEXT_SOURCE_INVENTORY_REVIEW_CHECKLIST.filter(
    (item) => item.requiredForLiveCapture && !reviewFieldComplete(source, item.field)
  ).map((item) => item.label);
}

function reviewedFieldCount(source: FullTextSourceInventoryItem) {
  return FULL_TEXT_SOURCE_INVENTORY_REVIEW_CHECKLIST.filter((item) =>
    reviewFieldComplete(source, item.field)
  ).length;
}

function reviewFieldComplete(
  source: FullTextSourceInventoryItem,
  field: FullTextSourceInventoryReviewField["field"]
) {
  if (field.startsWith("approval.")) {
    const approvalField = field.slice("approval.".length) as keyof FullTextSourceApproval;
    return source.approval[approvalField] === true;
  }

  const inventoryField = field as keyof FullTextSourceInventoryItem;
  const value = source[inventoryField];

  return typeof value === "boolean" ? value : Boolean(readString(value));
}

function reviewFieldValue(
  source: FullTextSourceInventoryItem,
  field: FullTextSourceInventoryReviewField["field"]
) {
  if (field.startsWith("approval.")) {
    const approvalField = field.slice("approval.".length) as keyof FullTextSourceApproval;
    return source.approval[approvalField] === true;
  }

  const inventoryField = field as keyof FullTextSourceInventoryItem;
  const value = source[inventoryField];

  return typeof value === "boolean" ? value : readString(value);
}

function requireInventorySource(
  inventory: FullTextSourceInventoryItem[],
  id: string
) {
  const source = inventory.find((item) => item.id === id);

  if (!source) {
    throw new Error(`Full-text source inventory entry disappeared during progress review: ${id}.`);
  }

  return source;
}

function starterForSource(
  source: FullTextSourceInventoryItem,
  starterInventory: FullTextSourceInventoryItem[]
) {
  const starter = starterInventory.find((item) => item.id === source.id) ?? source;

  return templateInventoryItem(starter);
}

function progressFieldChanges(
  source: FullTextSourceInventoryItem,
  starter: FullTextSourceInventoryItem
): FullTextSourceInventoryProgressFieldChange[] {
  return FULL_TEXT_SOURCE_INVENTORY_REVIEW_CHECKLIST.map((item) => ({
    currentValue: reviewFieldValue(source, item.field),
    field: item.field,
    label: item.label,
    starterValue: reviewFieldValue(starter, item.field)
  })).filter((change) => !fieldValuesEqual(change.currentValue, change.starterValue));
}

function fieldValuesEqual(left: boolean | string, right: boolean | string) {
  return left === right;
}

function prematureApprovalWarnings(source: FullTextSourceInventoryItem) {
  const warnings: string[] = [];

  if (source.approval.approvedForLiveFetch && !source.liveFetchSupported) {
    warnings.push("Live fetch approval is true while liveFetchSupported is false.");
  }

  if (source.approval.approvedForStorage && !source.approval.rawRetentionReviewed) {
    warnings.push("Storage is approved before raw retention policy review is complete.");
  }

  if (source.approval.approvedForPublicExport && !source.approval.derivedOnlyExportReviewed) {
    warnings.push("Public export is approved before derived-only export review is complete.");
  }

  if (source.approval.approvedForLiveFetch && !source.approval.robotsOrApiPolicyReviewed) {
    warnings.push("Live fetch is approved before robots/API policy review is complete.");
  }

  if (
    (source.approval.approvedForLiveFetch ||
      source.approval.approvedForStorage ||
      source.approval.approvedForPublicExport) &&
    !source.approval.termsReviewed
  ) {
    warnings.push("One or more approvals are true before terms review is complete.");
  }

  if (
    source.approval.approvedForLiveFetch &&
    (source.authRequired || source.loginRequired || source.captchaRisk)
  ) {
    warnings.push("Live fetch is approved despite authentication, login, or anti-automation risk.");
  }

  return uniqueNonEmpty(warnings);
}

function inventoryProgressStatus({
  approvalWarnings,
  changedFields,
  missingRequiredFields,
  readinessStatus
}: {
  approvalWarnings: string[];
  changedFields: FullTextSourceInventoryProgressFieldChange[];
  missingRequiredFields: string[];
  readinessStatus: FullTextSourceReadinessStatus;
}): FullTextSourceInventoryProgressStatus {
  if (approvalWarnings.length > 0) {
    return "premature-approval";
  }

  if (readinessStatus === "ready" && missingRequiredFields.length === 0) {
    return "ready-for-connector-review";
  }

  if (changedFields.length > 0) {
    return "in-progress";
  }

  return "not-started";
}

function progressNextAction(
  status: FullTextSourceInventoryProgressStatus,
  row: FullTextSourceReadinessRow
) {
  if (status === "premature-approval") {
    return "Reset premature approvals or complete prerequisite reviews before connector planning.";
  }

  if (status === "ready-for-connector-review") {
    return "Ready for a separate, explicit connector implementation review; this report still does not fetch full text.";
  }

  if (status === "in-progress") {
    return row.sourceConviction.missingRequiredFields[0]
      ? `Continue source review: ${row.sourceConviction.missingRequiredFields[0]} is still missing.`
      : row.nextAction;
  }

  return "Start from the worksheet or template and fill reviewed terms, access, rate/cache, retention, and export evidence.";
}

function summarizeInventoryProgress(rows: FullTextSourceInventoryProgressRow[]) {
  return rows.reduce(
    (summary, row) => {
      summary.sources += 1;

      if (row.changedFields.length > 0) {
        summary.changedSources += 1;
      }

      if (row.status === "not-started") {
        summary.notStartedSources += 1;
      } else if (row.status === "in-progress") {
        summary.inProgressSources += 1;
      } else if (row.status === "premature-approval") {
        summary.prematureApprovalSources += 1;
      } else {
        summary.readyForConnectorReviewSources += 1;
      }

      return summary;
    },
    {
      changedSources: 0,
      inProgressSources: 0,
      notStartedSources: 0,
      prematureApprovalSources: 0,
      readyForConnectorReviewSources: 0,
      sources: 0
    }
  );
}

function connectorReviewDraftStatus(
  progressRow: FullTextSourceInventoryProgressRow,
  source: FullTextSourceInventoryItem
): FullTextConnectorReviewDraftStatus {
  if (progressRow.status === "premature-approval") {
    return "blocked";
  }

  if (
    progressRow.tier === "hold" ||
    source.accessMethod === "publisher-page" ||
    source.authRequired ||
    source.loginRequired ||
    source.captchaRisk
  ) {
    return "hold";
  }

  if (progressRow.status === "ready-for-connector-review") {
    return "ready-for-review";
  }

  return "blocked";
}

function connectorReviewBlockers(
  progressRow: FullTextSourceInventoryProgressRow,
  source: FullTextSourceInventoryItem,
  status: FullTextConnectorReviewDraftStatus
) {
  const blockers = [
    ...progressRow.missingRequiredFields.map((field) => `${field} is incomplete.`),
    ...progressRow.approvalWarnings
  ];

  if (status === "hold") {
    blockers.push(
      "Source is on hold for connector automation because access method, login/auth, or anti-automation risk needs separate review."
    );
  }

  if (status === "blocked" && progressRow.status !== "premature-approval") {
    blockers.push("Source inventory is not ready for connector review.");
  }

  if (!source.liveFetchSupported || !source.approval.approvedForLiveFetch) {
    blockers.push("Live fetch is not approved for implementation.");
  }

  return uniqueNonEmpty(blockers);
}

function connectorReviewNextAction(
  status: FullTextConnectorReviewDraftStatus,
  blockers: string[]
) {
  if (status === "ready-for-review") {
    return "Open a separate connector design review with this packet; do not enable live fetch from this draft alone.";
  }

  if (status === "hold") {
    return "Keep this source out of connector planning until access-policy and automation-risk review clears the hold.";
  }

  return blockers[0] ?? "Complete source inventory review before connector planning.";
}

function prioritizedInventoryProgressRows(
  rows: FullTextSourceInventoryProgressRow[],
  readinessRows: FullTextSourceReadinessRow[]
) {
  const queuePriority = new Map(
    buildFullTextSourceReviewQueue(readinessRows).map((row, index) => [
      row.id,
      index
    ])
  );

  return [...rows].sort((left, right) => {
    const leftRank = queuePriority.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = queuePriority.get(right.id) ?? Number.MAX_SAFE_INTEGER;

    return (
      inventoryProgressActionRank(left.status) -
        inventoryProgressActionRank(right.status) ||
      leftRank - rightRank ||
      right.convictionScore - left.convictionScore ||
      left.label.localeCompare(right.label)
    );
  });
}

function inventoryProgressActionRank(
  status: FullTextSourceInventoryProgressStatus
) {
  const ranks: Record<FullTextSourceInventoryProgressStatus, number> = {
    "premature-approval": 0,
    "in-progress": 1,
    "not-started": 2,
    "ready-for-connector-review": 3
  };

  return ranks[status];
}

function selectInventoryNextActionRow(
  rows: FullTextSourceInventoryProgressRow[],
  inventoryFileProvided: boolean
) {
  if (!inventoryFileProvided) {
    return rows.find((row) => row.status !== "ready-for-connector-review") ?? rows[0];
  }

  return (
    rows.find((row) => row.status === "premature-approval") ??
    rows.find((row) => row.status === "in-progress") ??
    rows.find((row) => row.status === "not-started") ??
    rows.find((row) => row.status === "ready-for-connector-review") ??
    rows[0]
  );
}

function inventoryNextActionStatus({
  connectorReviewStatus,
  inventoryFileProvided,
  progressStatus
}: {
  connectorReviewStatus?: FullTextConnectorReviewDraftStatus;
  inventoryFileProvided: boolean;
  progressStatus?: FullTextSourceInventoryProgressStatus;
}): FullTextSourceInventoryNextActionStatus {
  if (!inventoryFileProvided) {
    return "create-inventory-template";
  }

  if (progressStatus === "premature-approval") {
    return "fix-premature-approval";
  }

  if (
    progressStatus === "ready-for-connector-review" &&
    connectorReviewStatus === "ready-for-review"
  ) {
    return "open-connector-review";
  }

  if (
    progressStatus === "ready-for-connector-review" &&
    connectorReviewStatus === "hold"
  ) {
    return "hold-connector-automation";
  }

  return "continue-source-review";
}

function inventoryNextActionText({
  selectedConnector,
  selectedProgress,
  status
}: {
  selectedConnector?: FullTextConnectorReviewDraftRow;
  selectedProgress?: FullTextSourceInventoryProgressRow;
  status: FullTextSourceInventoryNextActionStatus;
}) {
  if (status === "create-inventory-template") {
    return "Create a user-owned full-text source inventory from the safe all-source review kit, then fill source worksheets before rerunning the gate.";
  }

  if (status === "fix-premature-approval") {
    return selectedProgress?.nextAction ??
      "Fix premature source approvals before connector planning.";
  }

  if (status === "open-connector-review") {
    return selectedConnector?.nextAction ??
      "Open a separate connector design review with this packet; do not enable live fetch from this draft alone.";
  }

  if (status === "hold-connector-automation") {
    return selectedConnector?.nextAction ??
      "Keep this source out of connector planning until access-policy and automation-risk review clears the hold.";
  }

  return selectedProgress?.nextAction ??
    "Continue source inventory review before connector planning.";
}

function inventoryNextActionCommands({
  inventoryPath,
  selectedSourceId,
  status
}: {
  inventoryPath: string;
  selectedSourceId?: string;
  status: FullTextSourceInventoryNextActionStatus;
}): FullTextSourceInventoryNextActionCommand[] {
  if (status === "create-inventory-template") {
    return [
      {
        command:
          `npm run onboarding:fulltext-sources -- --write-review-kit ${DEFAULT_FULL_TEXT_REVIEW_KIT_DIR} --all-sources`,
        id: "write-all-source-review-kit",
        label: "Create all-source review kit",
        mode: "local-file-write",
        purpose:
          "Write the approval-false inventory starter, review-kit index, and one worksheet per ranked source class without granting approval."
      },
      {
        command:
          `npm run onboarding:fulltext-sources -- --write-review-kit ${DEFAULT_FULL_TEXT_REVIEW_KIT_DIR} --source-id ${selectedSourceId ?? "pmc-open-access"}`,
        id: "write-focused-source-review-kit",
        label: "Create focused source review kit",
        mode: "local-file-write",
        purpose:
          "Write the approval-false inventory starter and one focused source worksheet without granting approval."
      },
      {
        command:
          `npm run onboarding:fulltext-sources -- --inventory-file ${inventoryPath} --progress --summary`,
        id: "check-inventory-progress",
        label: "Check inventory progress",
        mode: "read-only",
        purpose:
          "Recheck the edited inventory for missing fields and premature approvals."
      },
      {
        command:
          `npm run onboarding:fulltext-sources -- --inventory-file ${inventoryPath} --next --summary`,
        id: "refresh-next-action",
        label: "Refresh next action",
        mode: "read-only",
        purpose:
          "Recompute the safest next source-inventory step after the first source review edits."
      }
    ];
  }

  if (status === "open-connector-review") {
    const fixturePath =
      `${DEFAULT_FULL_TEXT_REVIEW_KIT_DIR}/fulltext-fixtures/${connectorKeyForSourceId(
        selectedSourceId ?? "pmc-open-access"
      )}.local.json`;

    return [
      {
        command:
          `npm run onboarding:fulltext-sources -- --inventory-file ${inventoryPath} --write-connector-prep-kit ${DEFAULT_FULL_TEXT_REVIEW_KIT_DIR}`,
        id: "write-connector-prep-kit",
        label: "Write connector prep kit",
        mode: "local-file-write",
        purpose:
          "Write the connector review, fixture-first plan, approval packet, and index without approving connector work or live fetch."
      },
      {
        command:
          `npm run onboarding:fulltext-fixture -- --fixture-dir ${DEFAULT_FULL_TEXT_REVIEW_KIT_DIR}/fulltext-fixtures --progress --summary`,
        id: "check-fixture-progress",
        label: "Check fixture starter progress",
        mode: "read-only",
        purpose:
          "Summarize generated local fixture starter states as blank, filled, extraction-draft-ready, or blocked without reading from live sources."
      },
      {
        command:
          `npm run onboarding:fulltext-fixture -- --fixture-file ${fixturePath} --summary`,
        id: "validate-fixture-starter",
        label: "Validate local fixture starter",
        mode: "read-only",
        purpose:
          "Check the generated local fixture starter after reviewed local values are filled; does not echo raw excerpts or write extraction rows."
      },
      {
        command:
          `npm run onboarding:fulltext-fixture -- --fixture-file ${fixturePath} --extraction-draft --candidate-key <accepted-candidate-dedupe-key> --study-source-type randomized-controlled-trial --summary`,
        id: "draft-fixture-extraction",
        label: "Preview fixture extraction draft",
        mode: "read-only",
        purpose:
          "Map reviewed local fixture fields into a command draft without deciding candidates, writing extraction rows, or promoting evidence."
      },
      {
        command:
          `npm run onboarding:fulltext-sources -- --inventory-file ${inventoryPath} --connector-review --summary`,
        id: "connector-review-summary",
        label: "Review connector readiness",
        mode: "read-only",
        purpose:
          "Confirm ready-for-review connector counts without approving a connector or fetching full text."
      },
      {
        command:
          `npm run onboarding:fulltext-sources -- --inventory-file ${inventoryPath} --write-connector-review ${DEFAULT_FULL_TEXT_CONNECTOR_REVIEW_PATH}`,
        id: "write-connector-review",
        label: "Write connector review packet",
        mode: "local-file-write",
        purpose:
          "Write the explicit connector design-review packet for separate implementation review."
      },
      {
        command:
          `npm run onboarding:fulltext-sources -- --inventory-file ${inventoryPath} --connector-plan --summary`,
        id: "connector-plan-summary",
        label: "Preview connector implementation plan",
        mode: "read-only",
        purpose:
          "Preview fixture-first implementation phases without approving a connector or live fetch."
      },
      {
        command:
          `npm run onboarding:fulltext-sources -- --inventory-file ${inventoryPath} --write-connector-plan ${DEFAULT_FULL_TEXT_CONNECTOR_PLAN_PATH}`,
        id: "write-connector-plan",
        label: "Write connector implementation plan",
        mode: "local-file-write",
        purpose:
          "Write the fixture-first, no-network implementation plan for separate engineering review."
      },
      {
        command:
          `npm run onboarding:fulltext-sources -- --inventory-file ${inventoryPath} --connector-approval-packet --summary`,
        id: "connector-approval-packet-summary",
        label: "Preview connector approval packet",
        mode: "read-only",
        purpose:
          "Preview explicit approval readiness without approving implementation, connector work, or live fetch."
      },
      {
        command:
          `npm run onboarding:fulltext-sources -- --inventory-file ${inventoryPath} --write-connector-approval-packet ${DEFAULT_FULL_TEXT_CONNECTOR_APPROVAL_PACKET_PATH}`,
        id: "write-connector-approval-packet",
        label: "Write connector approval packet",
        mode: "local-file-write",
        purpose:
          "Write the explicit fixture-only approval packet for operator decision without granting approval."
      },
      {
        command:
          "npm run test -- src/lib/full-text-source-readiness.test.ts",
        id: "full-text-source-tests",
        label: "Run source gate tests",
        mode: "read-only",
        purpose:
          "Verify blocked, in-progress, premature-approval, and ready connector review paths."
      }
    ];
  }

  const sourceId = selectedSourceId ?? "pmc-open-access";
  const firstCommand =
    status === "fix-premature-approval"
      ? {
          command:
            `npm run onboarding:fulltext-sources -- --inventory-file ${inventoryPath} --progress --summary`,
          id: "check-inventory-progress",
          label: "Inspect premature approvals",
          mode: "read-only" as const,
          purpose:
            "Show approval warnings so premature live/storage/public-export approvals can be reset or completed."
        }
      : {
          command:
            `npm run onboarding:fulltext-sources -- --inventory-file ${inventoryPath} --write-worksheet ${inventoryWorksheetPath(sourceId)} --source-id ${sourceId}`,
          id: "write-source-worksheet",
          label: "Write focused source worksheet",
          mode: "local-file-write" as const,
          purpose:
            "Write the next source checklist using the current user-owned inventory values."
        };

  return [
    firstCommand,
    {
      command:
        `npm run onboarding:fulltext-sources -- --inventory-file ${inventoryPath} --progress --summary`,
      id: "check-inventory-progress",
      label: "Check inventory progress",
      mode: "read-only",
      purpose:
        "Recheck missing fields, changed fields, and premature approvals after edits."
    },
    {
      command:
        `npm run onboarding:fulltext-sources -- --inventory-file ${inventoryPath} --next --summary`,
      id: "refresh-next-action",
      label: "Refresh next action",
      mode: "read-only",
      purpose:
        "Recompute the safest next source-inventory step after the current review item changes."
    }
  ];
}

function inventoryWorksheetPath(sourceId?: string) {
  return `${DEFAULT_FULL_TEXT_REVIEW_KIT_DIR}/${inventoryWorksheetFileName(sourceId)}`;
}

function inventoryWorksheetFileName(sourceId?: string) {
  const suffix = (sourceId ?? "pmc-open-access")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "source";

  return `fulltext-source-review-${suffix}.md`;
}

function normalizeOutputDir(outputDir: string) {
  const normalized = outputDir.trim().replace(/\\/g, "/").replace(/\/+$/g, "");

  return normalized || DEFAULT_FULL_TEXT_REVIEW_KIT_DIR;
}

function connectorKeyForSource(source: FullTextSourceInventoryItem) {
  return connectorKeyForSourceId(source.id);
}

function connectorKeyForSourceId(sourceId: string) {
  return sourceId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^$/, "full-text-source");
}

function connectorImplementationChecklist(source: FullTextSourceInventoryItem) {
  return [
    "Keep connector implementation behind an explicit non-public feature gate.",
    "Start with dry-run fixtures and parser-shape tests before any live request.",
    `Respect reviewed rate limit: ${source.rateLimit || "not supplied"}.`,
    `Respect reviewed cache TTL: ${source.cacheTtl || "not supplied"}.`,
    `Respect raw retention policy: ${source.rawRetentionPolicy || "not supplied"}.`,
    "Store raw full text only when storage approval and retention policy remain valid.",
    "Export only derived fields, summaries, citations, and extraction metadata to public artifacts.",
    "Never publish raw full text through public routes.",
    "Keep connector output separate from source-candidate acceptance, extraction, claim review, and promotion."
  ];
}

function connectorImplementationPhases(
  row: FullTextConnectorReviewDraftRow,
  status: FullTextConnectorImplementationPlanStatus
) {
  const phases = [
    "Phase 1: add synthetic/local fixture parsing tests only; no network requests.",
    "Phase 2: map source payloads into derived extraction targets, citation metadata, and traceability fields only.",
    "Phase 3: enforce reviewed cache TTL, raw-retention policy, and derived-only public export boundaries in tests.",
    "Phase 4: add a disabled-by-default connector facade behind an explicit non-public feature gate.",
    "Phase 5: require a separate operator approval and validation run before any live fetch path is implemented."
  ];

  if (status === "blocked") {
    return [
      "Blocked: complete source inventory and connector review before fixture parser design.",
      ...phases
    ];
  }

  if (!row.dryRunSupported) {
    return [
      "Add a synthetic fixture contract before implementation because dry-run support is not yet recorded.",
      ...phases
    ];
  }

  return phases;
}

function connectorImplementationPlannedFiles(
  row: FullTextConnectorReviewDraftRow
) {
  return [
    `src/lib/full-text/${row.connectorKey}.ts`,
    `src/lib/full-text/${row.connectorKey}.test.ts`,
    `docs/codex/onboarding/fulltext-fixtures/${row.connectorKey}.fixture.json`,
    `docs/codex/onboarding/fulltext-fixtures/${row.connectorKey}.derived.example.json`
  ];
}

function connectorImplementationGuardrails(
  row: FullTextConnectorReviewDraftRow
) {
  return [
    "Do not add live network fetch in the implementation plan.",
    "Do not approve or modify source terms, storage approval, live-fetch approval, or public-export approval.",
    "Do not expose raw full text through public routes, dashboard state, source packets, or generated reports.",
    `Public raw text export stays ${row.policy.publicRawTextExport}.`,
    "Keep parsed output derived-only: citation metadata, extraction targets, short operator notes, and traceability fields.",
    "Keep connector output separate from candidate acceptance, claim linking, structured extraction writes, claim-packet review, and promotion.",
    "Keep all code behind explicit operator-only or local-only gates until a later approval step."
  ];
}

function connectorImplementationValidationCommands(
  row: FullTextConnectorReviewDraftRow,
  inventoryFilePath = DEFAULT_FULL_TEXT_SOURCE_INVENTORY_PATH
) {
  return uniqueNonEmpty([
    `npm run onboarding:fulltext-sources -- --inventory-file ${inventoryFilePath} --connector-review --summary`,
    `npm run onboarding:fulltext-sources -- --inventory-file ${inventoryFilePath} --connector-plan --summary`,
    "npm run onboarding:fulltext-fixture -- --fixture-file docs/codex/onboarding/examples/fulltext-local-fixture.example.json --summary",
    ...row.validationCommands,
    "npm run lint"
  ]);
}

function fullTextConnectorApprovalPacketRow(
  row: FullTextConnectorImplementationPlanRow,
  inventoryFilePath = DEFAULT_FULL_TEXT_SOURCE_INVENTORY_PATH
): FullTextConnectorApprovalPacketRow {
  const approvalItems = connectorApprovalItems(row);
  const incompleteItems = approvalItems.filter((item) => !item.complete);
  const status = connectorApprovalPacketStatus(row, incompleteItems);
  const blockers = uniqueNonEmpty([
    ...row.blockers,
    ...incompleteItems.map((item) => `${item.label} is incomplete.`),
    ...(status === "hold"
      ? ["Source is on hold for connector automation; approval packet cannot advance."]
      : [])
  ]);

  return {
    approvalGranted: false,
    approvalItems,
    blockers,
    connectorKey: row.connectorKey,
    guardrails: connectorApprovalGuardrails(row),
    id: row.id,
    implementationStatus: row.status,
    label: row.label,
    nextAction: connectorApprovalNextAction(status, blockers),
    operatorDecisionTemplate: connectorApprovalDecisionTemplate(row, status),
    plannedFiles: row.plannedFiles,
    policy: row.policy,
    reviewStatus: row.reviewStatus,
    status,
    validationCommands: connectorApprovalValidationCommands(row, inventoryFilePath)
  };
}

function connectorApprovalItems(
  row: FullTextConnectorImplementationPlanRow
): FullTextConnectorApprovalItem[] {
  return [
    {
      complete: row.reviewStatus === "ready-for-review",
      detail: `Connector review status is ${row.reviewStatus}.`,
      id: "connector-review-ready",
      label: "Connector review ready"
    },
    {
      complete: row.status === "ready-for-fixture-design",
      detail: `Implementation plan status is ${row.status}.`,
      id: "fixture-design-ready",
      label: "Fixture-first implementation plan ready"
    },
    {
      complete: row.dryRunSupported,
      detail: row.dryRunSupported
        ? "Inventory records dry-run support before live connector work."
        : "Dry-run support is not recorded.",
      id: "dry-run-supported",
      label: "Dry-run support recorded"
    },
    {
      complete: Boolean(row.policy.termsUrl && row.policy.policyUrl),
      detail:
        row.policy.termsUrl && row.policy.policyUrl
          ? "Terms and robots/API policy URLs are recorded."
          : "Terms and robots/API policy URLs must both be recorded.",
      id: "terms-and-policy-recorded",
      label: "Terms and access policy recorded"
    },
    {
      complete: Boolean(
        row.policy.rateLimit &&
          row.policy.cacheTtl &&
          row.policy.rawRetentionPolicy
      ),
      detail:
        row.policy.rateLimit && row.policy.cacheTtl && row.policy.rawRetentionPolicy
          ? "Rate limit, cache TTL, and raw retention policy are recorded."
          : "Rate limit, cache TTL, and raw retention policy must all be recorded.",
      id: "rate-cache-retention-recorded",
      label: "Rate/cache/retention controls recorded"
    },
    {
      complete:
        row.policy.derivedOnlyPublicExport === true &&
        row.policy.publicRawTextExport === false,
      detail: `Derived-only public export is ${row.policy.derivedOnlyPublicExport}; public raw text export is ${row.policy.publicRawTextExport}.`,
      id: "derived-only-public-export",
      label: "Derived-only public export boundary"
    },
    {
      complete: row.validationCommands.length > 0,
      detail:
        row.validationCommands.length > 0
          ? `${row.validationCommands.length} validation command(s) recorded.`
          : "Validation commands are missing.",
      id: "validation-plan-recorded",
      label: "Validation plan recorded"
    },
    {
      complete: true,
      detail:
        "This packet is read-only and records no network fetch, no live fetch, and no connector approval.",
      id: "read-only-no-live-fetch",
      label: "Read-only/no-live-fetch boundary"
    }
  ];
}

function connectorApprovalPacketStatus(
  row: FullTextConnectorImplementationPlanRow,
  incompleteItems: FullTextConnectorApprovalItem[]
): FullTextConnectorApprovalPacketStatus {
  if (row.reviewStatus === "hold") {
    return "hold";
  }

  if (row.blockers.length === 0 && incompleteItems.length === 0) {
    return "ready-for-approval";
  }

  return "blocked";
}

function connectorApprovalNextAction(
  status: FullTextConnectorApprovalPacketStatus,
  blockers: string[]
) {
  if (status === "ready-for-approval") {
    return "Ready for an explicit operator approval decision for fixture-only connector implementation; this packet itself grants no approval.";
  }

  if (status === "hold") {
    return "Keep this source out of connector approval until the access-policy or automation-risk hold is cleared.";
  }

  return blockers[0] ?? "Complete connector review and fixture-first planning before approval.";
}

function connectorApprovalDecisionTemplate(
  row: FullTextConnectorImplementationPlanRow,
  status: FullTextConnectorApprovalPacketStatus
) {
  const decision =
    status === "ready-for-approval"
      ? "Approved for fixture-only implementation review"
      : "Not approved";

  return [
    `Decision: ${decision}`,
    `Source: ${row.label} (${row.id})`,
    `Connector key: ${row.connectorKey}`,
    "Scope: fixture-only parser and derived-field tests; no live network fetch.",
    "Public export: derived fields, citations, and traceability only; no raw full text.",
    "Operator note: <record reviewed rationale before implementation begins>"
  ].join("\n");
}

function connectorApprovalGuardrails(
  row: FullTextConnectorImplementationPlanRow
) {
  return uniqueNonEmpty([
    ...row.guardrails,
    "Approval packet output is not an approval record; a separate explicit operator decision is required.",
    "Any later live-fetch path requires a separate approval after fixture-only implementation validation.",
    "Do not use this packet to accept source candidates, write study extraction rows, mark claim packets reviewed, or promote public evidence."
  ]);
}

function connectorApprovalValidationCommands(
  row: FullTextConnectorImplementationPlanRow,
  inventoryFilePath = DEFAULT_FULL_TEXT_SOURCE_INVENTORY_PATH
) {
  return uniqueNonEmpty([
    ...row.validationCommands,
    `npm run onboarding:fulltext-sources -- --inventory-file ${inventoryFilePath} --connector-approval-packet --summary`,
    "npm run test -- src/lib/full-text-source-readiness.test.ts"
  ]);
}

function summarizeConnectorApprovalPacketRows(
  rows: FullTextConnectorApprovalPacketRow[]
) {
  return rows.reduce(
    (summary, row) => {
      summary.sources += 1;

      if (row.status === "ready-for-approval") {
        summary.readyForApprovalSources += 1;
      } else if (row.status === "hold") {
        summary.holdSources += 1;
      } else {
        summary.blockedSources += 1;
      }

      return summary;
    },
    {
      blockedSources: 0,
      holdSources: 0,
      readyForApprovalSources: 0,
      sources: 0
    }
  );
}

function summarizeConnectorImplementationPlanRows(
  rows: FullTextConnectorImplementationPlanRow[]
) {
  return rows.reduce(
    (summary, row) => {
      summary.sources += 1;

      if (row.status === "ready-for-fixture-design") {
        summary.readyForFixtureDesignSources += 1;
      } else {
        summary.blockedSources += 1;
      }

      return summary;
    },
    {
      blockedSources: 0,
      readyForFixtureDesignSources: 0,
      sources: 0
    }
  );
}

function summarizeConnectorReviewDraft(rows: FullTextConnectorReviewDraftRow[]) {
  return rows.reduce(
    (summary, row) => {
      summary.sources += 1;

      if (row.reviewStatus === "ready-for-review") {
        summary.readyForReviewSources += 1;
      } else if (row.reviewStatus === "hold") {
        summary.holdSources += 1;
      } else {
        summary.blockedSources += 1;
      }

      return summary;
    },
    {
      blockedSources: 0,
      holdSources: 0,
      readyForReviewSources: 0,
      sources: 0
    }
  );
}

interface FullTextSourceFixtureScenario {
  description: string;
  expectedConnectorReviewStatus: FullTextConnectorReviewDraftStatus;
  expectedProgressStatus: FullTextSourceInventoryProgressStatus;
  id: string;
  inventory: FullTextSourceInventoryItem[];
  label: string;
}

function fullTextSourceFixtureScenarios(): FullTextSourceFixtureScenario[] {
  return [
    {
      description:
        "Default open-access source class with no reviewed terms, policy, retention, or approval evidence.",
      expectedConnectorReviewStatus: "blocked",
      expectedProgressStatus: "not-started",
      id: "blocked-default",
      inventory: [fullTextScenarioSource({})],
      label: "Blocked default"
    },
    {
      description:
        "Terms, API policy, rate, and access method are partially reviewed, but retention and approval checks are still incomplete.",
      expectedConnectorReviewStatus: "blocked",
      expectedProgressStatus: "in-progress",
      id: "in-progress-reviewed-terms",
      inventory: [
        fullTextScenarioSource({
          approval: {
            accessMethodReviewed: true,
            robotsOrApiPolicyReviewed: true,
            termsReviewed: true
          },
          cacheTtl: "24h local cache while review is in progress",
          dryRunSupported: true,
          policyUrl: "https://example.test/policy",
          rateLimit: "1 request/second",
          reviewedAt: "2026-06-12",
          reviewedBy: "fixture-reviewer",
          termsUrl: "https://example.test/terms"
        })
      ],
      label: "In-progress reviewed terms"
    },
    {
      description:
        "Live fetch is approved before prerequisite terms, policy, and live support gates are complete.",
      expectedConnectorReviewStatus: "blocked",
      expectedProgressStatus: "premature-approval",
      id: "premature-live-approval",
      inventory: [
        fullTextScenarioSource({
          approval: {
            approvedForLiveFetch: true
          },
          dryRunSupported: true
        })
      ],
      label: "Premature live approval"
    },
    {
      description:
        "Synthetic reviewed source with complete review metadata and example.test URLs for connector-review rehearsal only.",
      expectedConnectorReviewStatus: "ready-for-review",
      expectedProgressStatus: "ready-for-connector-review",
      id: "ready-synthetic-reviewed",
      inventory: [
        fullTextScenarioSource({
          allowedUse:
            "Synthetic fixture only; no real source terms, live connector, raw-text capture, or public export approval.",
          approval: {
            accessMethodReviewed: true,
            approvedForLiveFetch: true,
            approvedForPublicExport: true,
            approvedForStorage: true,
            derivedOnlyExportReviewed: true,
            rawRetentionReviewed: true,
            robotsOrApiPolicyReviewed: true,
            termsReviewed: true
          },
          cacheTtl: "24h synthetic fixture cache",
          dryRunSupported: true,
          id: "synthetic-reviewed-open-access-source",
          label: "Synthetic reviewed open-access source",
          liveFetchSupported: true,
          notes:
            "Synthetic fixture source for exercising the ready path; not a real source approval.",
          policyUrl: "https://example.test/policy",
          rateLimit: "1 request/second synthetic fixture cap",
          rawRetentionPolicy:
            "Synthetic raw fixture text may stay local during parser tests and is deleted after review.",
          reviewedAt: "2026-06-12",
          reviewedBy: "fixture-reviewer",
          termsUrl: "https://example.test/terms"
        })
      ],
      label: "Ready synthetic reviewed"
    }
  ];
}

function fullTextScenarioSource(
  overrides: Omit<Partial<FullTextSourceInventoryItem>, "approval"> & {
    approval?: Partial<FullTextSourceApproval>;
  }
): FullTextSourceInventoryItem {
  const base = DEFAULT_FULL_TEXT_SOURCE_INVENTORY[0];

  if (!base) {
    throw new Error("Default full-text source inventory is empty.");
  }

  return {
    ...base,
    ...overrides,
    approval: {
      ...base.approval,
      ...overrides.approval
    }
  };
}

function summarizeFixtureScenarioRows(rows: FullTextSourceFixtureScenarioRow[]) {
  return rows.reduce(
    (summary, row) => {
      summary.scenarios += 1;

      if (row.result === "pass") {
        summary.passedScenarios += 1;
      } else {
        summary.failedScenarios += 1;
      }

      if (row.actualProgressStatus === "not-started") {
        summary.blockedScenarios += 1;
      } else if (row.actualProgressStatus === "in-progress") {
        summary.inProgressScenarios += 1;
      } else if (row.actualProgressStatus === "premature-approval") {
        summary.prematureApprovalScenarios += 1;
      } else {
        summary.readyForConnectorReviewScenarios += 1;
      }

      if (row.connectorReadyForReview) {
        summary.connectorReadyForReviewScenarios += 1;
      }

      return summary;
    },
    {
      blockedScenarios: 0,
      connectorReadyForReviewScenarios: 0,
      failedScenarios: 0,
      inProgressScenarios: 0,
      passedScenarios: 0,
      prematureApprovalScenarios: 0,
      readyForConnectorReviewScenarios: 0,
      scenarios: 0
    }
  );
}

function markdownList(values: string[]) {
  if (values.length === 0) {
    return ["- none"];
  }

  return values.map((value) => `- ${value}`);
}

function formatFieldValue(value: boolean | string) {
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return value || "-";
}

function escapeMarkdownTableCell(value: string) {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function fullTextSourceBlockers(source: FullTextSourceInventoryItem) {
  const blockers = [
    source.termsUrl ? undefined : "Terms URL is missing.",
    source.policyUrl ? undefined : "Robots/API policy URL is missing.",
    source.approval.termsReviewed ? undefined : "Terms of use are not reviewed.",
    source.approval.accessMethodReviewed
      ? undefined
      : "Access method is not reviewed.",
    source.approval.robotsOrApiPolicyReviewed
      ? undefined
      : "Robots/API policy is not reviewed.",
    source.rateLimit ? undefined : "Rate limit is missing.",
    source.cacheTtl ? undefined : "Cache TTL is missing.",
    source.rawRetentionPolicy ? undefined : "Raw retention policy is missing.",
    source.approval.rawRetentionReviewed
      ? undefined
      : "Raw retention policy is not reviewed.",
    source.approval.derivedOnlyExportReviewed
      ? undefined
      : "Derived-only export policy is not reviewed.",
    source.approval.approvedForStorage
      ? undefined
      : "Source is not approved for local raw-text storage.",
    source.approval.approvedForPublicExport
      ? undefined
      : "Source is not approved for public export.",
    source.liveFetchSupported && source.approval.approvedForLiveFetch
      ? undefined
      : "Live full-text fetch is not approved or supported."
  ].filter((blocker): blocker is string => Boolean(blocker));

  if (source.authRequired || source.loginRequired || source.captchaRisk) {
    blockers.push(
      "Authentication, login, or anti-automation risk blocks automation until explicitly reviewed."
    );
  }

  return blockers;
}

function uniqueNonEmpty(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function fullTextFixtureContract(): FullTextFixtureContract {
  return {
    derivedOnly: true,
    fields: [
      "sourceId",
      "sourceUrl",
      "capturedAt",
      "title",
      "textExcerpt",
      "derivedExtractionTargets",
      "reviewerNote"
    ],
    nextAction:
      "Use only synthetic or operator-provided local fixtures until a source inventory entry is fully reviewed.",
    rawTextStored: false,
    status: "ready",
    supportedInput: "operator-local-fixture"
  };
}

function parseApproval(value: unknown): FullTextSourceApproval {
  const record = isRecord(value) ? value : {};

  return {
    accessMethodReviewed: readBoolean(record.accessMethodReviewed),
    approvedForLiveFetch: readBoolean(record.approvedForLiveFetch),
    approvedForPublicExport: readBoolean(record.approvedForPublicExport),
    approvedForStorage: readBoolean(record.approvedForStorage),
    derivedOnlyExportReviewed: readBoolean(record.derivedOnlyExportReviewed),
    rawRetentionReviewed: readBoolean(record.rawRetentionReviewed),
    robotsOrApiPolicyReviewed: readBoolean(record.robotsOrApiPolicyReviewed),
    termsReviewed: readBoolean(record.termsReviewed)
  };
}

function templateInventoryItem(
  source: FullTextSourceInventoryItem
): FullTextSourceInventoryItem {
  return {
    ...source,
    approval: { ...DEFAULT_APPROVAL },
    liveFetchSupported: false,
    reviewedAt: "",
    reviewedBy: ""
  };
}

function parseAccessMethod(value: unknown): FullTextAccessMethod {
  const text = requireString(value, "access method");
  const allowed: FullTextAccessMethod[] = [
    "api",
    "bulk-download",
    "publisher-page",
    "manual-local-file",
    "local-fixture"
  ];

  if (!allowed.includes(text as FullTextAccessMethod)) {
    throw new Error(`Unsupported full-text access method: ${text}.`);
  }

  return text as FullTextAccessMethod;
}

function readBoolean(value: unknown) {
  return value === true;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function requireString(value: unknown, label: string) {
  const text = readString(value);

  if (!text) {
    throw new Error(`Full-text source inventory ${label} is required.`);
  }

  return text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && !Array.isArray(value) && typeof value === "object";
}
