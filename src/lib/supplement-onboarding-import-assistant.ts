import type { SupplementOnboardingPlan } from "@/lib/supplement-onboarding";
import type {
  SupplementOnboardingDraftImportPlanStatus,
  SupplementOnboardingSeedDiffItem,
  SupplementOnboardingSeedDiffReport
} from "@/lib/supplement-onboarding-seed-diff";

export type SupplementOnboardingImportAssistantStatus =
  | "blocked"
  | "manual-review-required"
  | "manual-seed-copy-ready";

export type SupplementOnboardingImportAssistantRecordModel =
  | "AustraliaRegulatoryStatus"
  | "Claim"
  | "Intervention";

export type SupplementOnboardingImportAssistantFieldValue =
  | boolean
  | number
  | string
  | string[]
  | null;

export interface SupplementOnboardingImportAssistantPlannedRecord {
  fieldPreview: Record<string, SupplementOnboardingImportAssistantFieldValue>;
  id: string;
  model: SupplementOnboardingImportAssistantRecordModel;
  source: "supplement-onboarding-draft";
  status: "draft-only";
}

export interface SupplementOnboardingImportAssistantItem {
  blockers: string[];
  databaseImport: {
    auditAction: "supplementOnboarding.databaseImport";
    nextAction: string;
    noImportCommand: true;
    plannedRecords: SupplementOnboardingImportAssistantPlannedRecord[];
    requiredFutureGates: string[];
    status: "future-gated";
    supportedNow: false;
  };
  humanOwned: true;
  interventionId: string;
  manualSeedCopy: {
    nextAction: string;
    operations: SupplementOnboardingSeedDiffItem["operations"];
    status: SupplementOnboardingDraftImportPlanStatus;
    supportedNow: true;
    targetPath: "src/lib/seed-data.ts";
  };
  name: string;
  nextAction: string;
  noAutoPromotion: true;
  noAutoReview: true;
  noAutoWrite: true;
  noCandidateDecision: true;
  noDatabaseWrite: true;
  noExtractionWrite: true;
  noPublicEvidenceRowsWritten: true;
  publicPromotion: {
    noAutoPromotion: true;
    requiredPrerequisites: string[];
    status: "blocked-until-evidence-review";
    supportedNow: false;
  };
  readOnly: true;
  slug: string;
  status: SupplementOnboardingImportAssistantStatus;
  validationCommands: string[];
  warnings: string[];
}

export interface SupplementOnboardingImportAssistantReport {
  generatedAt: string;
  humanOwned: true;
  items: SupplementOnboardingImportAssistantItem[];
  nextAction: string;
  noAutoPromotion: true;
  noAutoReview: true;
  noAutoWrite: true;
  noCandidateDecision: true;
  noDatabaseWrite: true;
  noExtractionWrite: true;
  noPublicEvidenceRowsWritten: true;
  readOnly: true;
  summary: {
    blockedItems: number;
    databaseImportSupported: false;
    items: number;
    manualReviewRequiredItems: number;
    manualSeedCopyReadyItems: number;
    plannedDatabaseRecords: number;
    publicPromotionSupported: false;
  };
}

export interface SupplementOnboardingImportAssistantSummary {
  generatedAt: string;
  humanOwned: true;
  items: Array<{
    blockers: string[];
    databaseImportStatus: "future-gated";
    interventionId: string;
    manualSeedCopyStatus: SupplementOnboardingDraftImportPlanStatus;
    name: string;
    nextAction: string;
    plannedDatabaseRecords: number;
    publicPromotionStatus: "blocked-until-evidence-review";
    status: SupplementOnboardingImportAssistantStatus;
    warnings: string[];
  }>;
  nextAction: string;
  noAutoPromotion: true;
  noAutoReview: true;
  noAutoWrite: true;
  noCandidateDecision: true;
  noDatabaseWrite: true;
  noExtractionWrite: true;
  noPublicEvidenceRowsWritten: true;
  readOnly: true;
  summary: SupplementOnboardingImportAssistantReport["summary"];
}

const DATABASE_IMPORT_FUTURE_GATES = [
  "Authenticated operator database-import action with an explicit permission and browser-write control.",
  "Audited import event containing before/after summaries, source draft id, reviewed note, and no-public-promotion flags.",
  "Collision checks against current database intervention, claim, and AU/TGA status ids.",
  "Reviewed rollback plan for created draft intervention, claim, and AU/TGA rows.",
  "Validation that imported claims remain Unreviewed AI draft and cannot appear as human-reviewed public evidence."
];

const PUBLIC_PROMOTION_PREREQUISITES = [
  "Reviewed source packets with citation traceability.",
  "Explicit candidate accept/reject decisions where source candidates exist.",
  "Accepted reference linked to the claim.",
  "Structured study extraction reviewed and saved through the existing operator path.",
  "Claim packet explicitly marked human-reviewed.",
  "Separate audited promotion action after promotion readiness passes."
];

export function buildSupplementOnboardingImportAssistantReport({
  generatedAt = new Date(),
  plans,
  seedDiffReport
}: {
  generatedAt?: Date;
  plans: SupplementOnboardingPlan[];
  seedDiffReport: SupplementOnboardingSeedDiffReport;
}): SupplementOnboardingImportAssistantReport {
  if (plans.length === 0) {
    throw new Error("Supplement onboarding import assistant requires at least one plan.");
  }

  const items = plans.map((plan) =>
    importAssistantItemForPlan({
      plan,
      seedDiffItem: readSeedDiffItem(plan, seedDiffReport)
    })
  );
  const blockedItem = items.find((item) => item.status === "blocked");
  const reviewItem = items.find((item) => item.status === "manual-review-required");
  const nextAction =
    blockedItem?.nextAction ??
    reviewItem?.nextAction ??
    "Manual seed-copy review is ready; database import remains future-gated and public promotion remains blocked until evidence review.";

  return {
    generatedAt: generatedAt.toISOString(),
    humanOwned: true,
    items,
    nextAction,
    noAutoPromotion: true,
    noAutoReview: true,
    noAutoWrite: true,
    noCandidateDecision: true,
    noDatabaseWrite: true,
    noExtractionWrite: true,
    noPublicEvidenceRowsWritten: true,
    readOnly: true,
    summary: {
      blockedItems: items.filter((item) => item.status === "blocked").length,
      databaseImportSupported: false,
      items: items.length,
      manualReviewRequiredItems: items.filter(
        (item) => item.status === "manual-review-required"
      ).length,
      manualSeedCopyReadyItems: items.filter(
        (item) => item.status === "manual-seed-copy-ready"
      ).length,
      plannedDatabaseRecords: items.reduce(
        (total, item) => total + item.databaseImport.plannedRecords.length,
        0
      ),
      publicPromotionSupported: false
    }
  };
}

export function summarizeSupplementOnboardingImportAssistantReport(
  report: SupplementOnboardingImportAssistantReport
): SupplementOnboardingImportAssistantSummary {
  return {
    generatedAt: report.generatedAt,
    humanOwned: true,
    items: report.items.map((item) => ({
      blockers: item.blockers,
      databaseImportStatus: item.databaseImport.status,
      interventionId: item.interventionId,
      manualSeedCopyStatus: item.manualSeedCopy.status,
      name: item.name,
      nextAction: item.nextAction,
      plannedDatabaseRecords: item.databaseImport.plannedRecords.length,
      publicPromotionStatus: item.publicPromotion.status,
      status: item.status,
      warnings: item.warnings
    })),
    nextAction: report.nextAction,
    noAutoPromotion: true,
    noAutoReview: true,
    noAutoWrite: true,
    noCandidateDecision: true,
    noDatabaseWrite: true,
    noExtractionWrite: true,
    noPublicEvidenceRowsWritten: true,
    readOnly: true,
    summary: report.summary
  };
}

export function supplementOnboardingImportAssistantReportToMarkdown(
  report: SupplementOnboardingImportAssistantReport
) {
  const lines = [
    "# Supplement Onboarding Import Assistant",
    "",
    `Generated: ${report.generatedAt}`,
    `Read-only: ${report.readOnly}`,
    `Human-owned: ${report.humanOwned}`,
    `No auto-write: ${report.noAutoWrite}`,
    `No database write: ${report.noDatabaseWrite}`,
    `No public evidence rows written: ${report.noPublicEvidenceRowsWritten}`,
    `No candidate decision: ${report.noCandidateDecision}`,
    `No extraction write: ${report.noExtractionWrite}`,
    `No auto-review: ${report.noAutoReview}`,
    `No auto-promotion: ${report.noAutoPromotion}`,
    "",
    "## Summary",
    "",
    `- items: ${report.summary.items}`,
    `- blocked: ${report.summary.blockedItems}`,
    `- manual review required: ${report.summary.manualReviewRequiredItems}`,
    `- manual seed-copy ready: ${report.summary.manualSeedCopyReadyItems}`,
    `- planned database records: ${report.summary.plannedDatabaseRecords}`,
    `- database import supported: ${report.summary.databaseImportSupported}`,
    `- public promotion supported: ${report.summary.publicPromotionSupported}`,
    "",
    "## Items",
    "",
    ...report.items.flatMap(importAssistantItemMarkdown),
    "",
    "## Next Action",
    "",
    report.nextAction,
    ""
  ];

  return `${lines.join("\n")}\n`;
}

function importAssistantItemForPlan({
  plan,
  seedDiffItem
}: {
  plan: SupplementOnboardingPlan;
  seedDiffItem: SupplementOnboardingSeedDiffItem;
}): SupplementOnboardingImportAssistantItem {
  const status = importAssistantStatus(seedDiffItem.importPlan.status);
  const plannedRecords = plannedDatabaseRecords(plan, seedDiffItem);
  const nextAction =
    status === "blocked"
      ? seedDiffItem.importPlan.seedCopy.nextAction
      : status === "manual-review-required"
        ? "Complete manual copy review before seed copy. Database import remains future-gated."
        : "Manual seed copy is ready after review; database import remains future-gated.";

  return {
    blockers: seedDiffItem.blockers,
    databaseImport: {
      auditAction: "supplementOnboarding.databaseImport",
      nextAction: seedDiffItem.importPlan.databaseImport.nextAction,
      noImportCommand: true,
      plannedRecords,
      requiredFutureGates: DATABASE_IMPORT_FUTURE_GATES,
      status: "future-gated",
      supportedNow: false
    },
    humanOwned: true,
    interventionId: seedDiffItem.interventionId,
    manualSeedCopy: {
      nextAction: seedDiffItem.importPlan.seedCopy.nextAction,
      operations: seedDiffItem.operations,
      status: seedDiffItem.importPlan.seedCopy.status,
      supportedNow: true,
      targetPath: "src/lib/seed-data.ts"
    },
    name: seedDiffItem.name,
    nextAction,
    noAutoPromotion: true,
    noAutoReview: true,
    noAutoWrite: true,
    noCandidateDecision: true,
    noDatabaseWrite: true,
    noExtractionWrite: true,
    noPublicEvidenceRowsWritten: true,
    publicPromotion: {
      noAutoPromotion: true,
      requiredPrerequisites: PUBLIC_PROMOTION_PREREQUISITES,
      status: "blocked-until-evidence-review",
      supportedNow: false
    },
    readOnly: true,
    slug: seedDiffItem.slug,
    status,
    validationCommands: seedDiffItem.importPlan.validationCommands,
    warnings: seedDiffItem.warnings
  };
}

function readSeedDiffItem(
  plan: SupplementOnboardingPlan,
  seedDiffReport: SupplementOnboardingSeedDiffReport
) {
  const item = seedDiffReport.items.find(
    (candidate) => candidate.interventionId === plan.interventionDraft.id
  );

  if (!item) {
    throw new Error(
      `Seed diff report does not contain draft ${plan.interventionDraft.id}.`
    );
  }

  return item;
}

function importAssistantStatus(
  status: SupplementOnboardingDraftImportPlanStatus
): SupplementOnboardingImportAssistantStatus {
  if (status === "blocked") {
    return "blocked";
  }

  if (status === "review-required") {
    return "manual-review-required";
  }

  return "manual-seed-copy-ready";
}

function plannedDatabaseRecords(
  plan: SupplementOnboardingPlan,
  seedDiffItem: SupplementOnboardingSeedDiffItem
): SupplementOnboardingImportAssistantPlannedRecord[] {
  return [
    {
      fieldPreview: {
        australiaRegulatoryStatus: plan.interventionDraft.regulatoryStatus,
        category: plan.interventionDraft.category ?? null,
        commonForms: plan.interventionDraft.commonForms,
        evidenceSummary: plan.interventionDraft.evidenceSummary,
        interactionSummary: plan.interventionDraft.interactionSummary,
        lastReviewedAt: plan.interventionDraft.lastReviewed,
        name: plan.interventionDraft.name,
        regulatorySummary: plan.interventionDraft.regulatoryStatus,
        safetySummary: plan.interventionDraft.safetySummary,
        slug: plan.interventionDraft.slug,
        synonyms: plan.interventionDraft.synonyms
      },
      id: plan.interventionDraft.id,
      model: "Intervention",
      source: "supplement-onboarding-draft",
      status: "draft-only"
    },
    ...plan.claimDrafts.map((claim) => ({
      fieldPreview: {
        applicabilityNotes:
          "Draft onboarding claim. Do not treat as public evidence until reviewed.",
        claimText: claim.claimText,
        clinicalRelevance: "Not established until source review.",
        comparator: "Not reviewed yet.",
        confidenceLevel: "Very low",
        doseFormStudied:
          "Not reviewed yet; do not add dosing guidance without source review.",
        durationStudied: "Not reviewed yet.",
        effectSize: "Unknown until source review.",
        effectSizeScore: 1,
        evidenceDirectnessScore: 1,
        evidenceGrade: "Insufficient until source packets are reviewed.",
        evidenceRigorScore: 1,
        finalLabel: "Insufficient Evidence",
        hypePenalty: 5,
        interventionId: plan.interventionDraft.id,
        measurabilityScore: 3,
        momentum: "Stable",
        outcome: claim.outcome,
        populationStudied: "Not reviewed yet.",
        productQualityScore: 1,
        regulatoryRiskScore: 5,
        reviewStatus: claim.reviewStatus,
        safetyNotes: `${plan.interventionDraft.name} safety and interactions are not reviewed yet.`,
        safetyScore: 3,
        whatWouldChangeScore:
          "Reviewed human evidence with citation traceability, structured extraction, safety context, and AU/TGA product-level review where relevant."
      },
      id: claim.id,
      model: "Claim" as const,
      source: "supplement-onboarding-draft" as const,
      status: "draft-only" as const
    })),
    {
      fieldPreview: {
        checkedAt: plan.interventionDraft.lastReviewed,
        efficacyAssessed: false,
        evidenceRequirement: plan.regulatoryDraft.evidenceRequirement,
        interventionId: plan.interventionDraft.id,
        kind: plan.regulatoryDraft.kind,
        notes: plan.regulatoryDraft.notes,
        preMarketAssessment: false,
        region: plan.region,
        sourceUrl:
          "https://www.tga.gov.au/products/regulations-all-products/about-australian-register-therapeutic-goods-artg",
        status: plan.regulatoryDraft.status,
        supplySummary: plan.regulatoryDraft.supplySummary
      },
      id: seedDiffItem.regulatoryStatusId,
      model: "AustraliaRegulatoryStatus",
      source: "supplement-onboarding-draft",
      status: "draft-only"
    }
  ];
}

function importAssistantItemMarkdown(item: SupplementOnboardingImportAssistantItem) {
  return [
    `### ${item.name}`,
    "",
    `- status: ${item.status}`,
    `- intervention id: \`${item.interventionId}\``,
    `- manual seed copy: ${item.manualSeedCopy.status}; supported now: ${item.manualSeedCopy.supportedNow}`,
    `- database import: ${item.databaseImport.status}; supported now: ${item.databaseImport.supportedNow}`,
    `- public promotion: ${item.publicPromotion.status}; supported now: ${item.publicPromotion.supportedNow}`,
    `- planned database records: ${item.databaseImport.plannedRecords.length}`,
    `- no import command: ${item.databaseImport.noImportCommand}`,
    "",
    "Manual seed-copy operations:",
    ...item.manualSeedCopy.operations.map(
      (operation) =>
        `- ${operation.kind} ${operation.ids.map((id) => `\`${id}\``).join(", ")} to \`${operation.exportName}\` in \`${operation.targetPath}\``
    ),
    "",
    "Planned database records:",
    ...item.databaseImport.plannedRecords.map(
      (record) =>
        `- ${record.model} \`${record.id}\` (${record.status}; ${Object.keys(record.fieldPreview).length} fields previewed)`
    ),
    "",
    "Required future gates for database import:",
    ...item.databaseImport.requiredFutureGates.map((gate) => `- ${gate}`),
    "",
    "Public promotion prerequisites:",
    ...item.publicPromotion.requiredPrerequisites.map((gate) => `- ${gate}`),
    "",
    "Blockers:",
    ...markdownBullets(item.blockers),
    "",
    "Warnings:",
    ...markdownBullets(item.warnings),
    "",
    "Validation commands after any reviewed seed/database change:",
    ...item.validationCommands.map((command) => `- \`${command}\``),
    "",
    "Next action:",
    item.nextAction,
    ""
  ];
}

function markdownBullets(values: string[]) {
  return values.length > 0 ? values.map((value) => `- ${value}`) : ["- none"];
}
