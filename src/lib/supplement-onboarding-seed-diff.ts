import {
  supplementOnboardingPlanToSeedSnippet,
  type SupplementOnboardingPlan
} from "@/lib/supplement-onboarding";
import type { AustraliaRegulatoryStatus, Claim, Intervention } from "@/lib/types";

export type SupplementOnboardingSeedDiffStatus =
  | "blocked"
  | "ready-for-manual-review"
  | "review-required";

export interface SupplementOnboardingSeedDiffExistingData {
  australiaRegulatoryStatuses?: Pick<AustraliaRegulatoryStatus, "id">[];
  claims?: Pick<Claim, "id">[];
  interventions?: Pick<Intervention, "id">[];
}

export interface SupplementOnboardingSeedDiffOperation {
  exportName: "australiaRegulatoryStatuses" | "claims" | "interventions";
  ids: string[];
  kind: "add";
  targetPath: "src/lib/seed-data.ts";
}

export type SupplementOnboardingDraftImportPlanStatus =
  | "blocked"
  | "ready-for-manual-seed-copy"
  | "review-required";

export interface SupplementOnboardingDraftImportPlan {
  databaseImport: {
    nextAction: string;
    noImportCommand: true;
    requiredFutureGate: string;
    status: "future-gated";
    supportedNow: false;
  };
  nextAction: string;
  noAutoPromotion: true;
  noAutoWrite: true;
  noDatabaseWrite: true;
  noPublicEvidenceRowsWritten: true;
  recommendedPath: "manual-seed-copy" | "resolve-blockers";
  seedCopy: {
    nextAction: string;
    operations: SupplementOnboardingSeedDiffOperation[];
    reviewRequired: boolean;
    status: SupplementOnboardingDraftImportPlanStatus;
    targetPath: "src/lib/seed-data.ts";
  };
  status: SupplementOnboardingDraftImportPlanStatus;
  validationCommands: string[];
}

export interface SupplementOnboardingSeedDiffItem {
  blockers: string[];
  claimCount: number;
  claimIds: string[];
  importPlan: SupplementOnboardingDraftImportPlan;
  interventionId: string;
  name: string;
  operations: SupplementOnboardingSeedDiffOperation[];
  productStatusGapCount: number;
  queueCommandsAfterCopy: string[];
  regulatoryStatusId: string;
  reviewChecklist: string[];
  safetySignals: {
    blocked: number;
    warning: number;
  };
  slug: string;
  snippet: string;
  status: SupplementOnboardingSeedDiffStatus;
  targetPath: "src/lib/seed-data.ts";
  warnings: string[];
}

export interface SupplementOnboardingSeedDiffReport {
  generatedAt: string;
  humanOwned: true;
  items: SupplementOnboardingSeedDiffItem[];
  nextAction: string;
  noAutoPromotion: true;
  noAutoWrite: true;
  readOnly: true;
  summary: {
    blockedItems: number;
    claimDrafts: number;
    conflicts: number;
    items: number;
    readyForManualReview: number;
    reviewRequiredItems: number;
    safetyBlockedItems: number;
    targetPath: "src/lib/seed-data.ts";
  };
  validationCommands: string[];
}

export interface SupplementOnboardingSeedDiffSummary {
  generatedAt: string;
  humanOwned: true;
  items: Array<{
    blockers: string[];
    claimCount: number;
    importPlan: {
      databaseImportStatus: "future-gated";
      noAutoWrite: true;
      noDatabaseWrite: true;
      recommendedPath: "manual-seed-copy" | "resolve-blockers";
      seedCopyNextAction: string;
      seedCopyStatus: SupplementOnboardingDraftImportPlanStatus;
      status: SupplementOnboardingDraftImportPlanStatus;
    };
    interventionId: string;
    name: string;
    nextCommand?: string;
    status: SupplementOnboardingSeedDiffStatus;
    warnings: string[];
  }>;
  nextAction: string;
  noAutoPromotion: true;
  noAutoWrite: true;
  readOnly: true;
  summary: SupplementOnboardingSeedDiffReport["summary"];
  validationCommands: string[];
}

const TARGET_PATH = "src/lib/seed-data.ts" as const;

const REVIEW_CHECKLIST = [
  "Confirm category, synonyms, common forms, and claim scopes are reviewed before copying.",
  "Keep all draft claims as Unreviewed AI draft until source packets are complete and explicitly human-reviewed.",
  "Keep AU/TGA status Unknown unless exact product-level evidence has been reviewed.",
  "Run validation after copying and before any source-candidate queueing.",
  "Queue sources only through the separate claim-scoped source workflow after reviewed seed/database records exist."
];

const VALIDATION_COMMANDS = [
  "npm run db:validate",
  "npm run typecheck",
  "npm run test",
  "npm run build"
];

export function buildSupplementOnboardingSeedDiffReport({
  existingData,
  generatedAt = new Date(),
  plans
}: {
  existingData?: SupplementOnboardingSeedDiffExistingData;
  generatedAt?: Date;
  plans: SupplementOnboardingPlan[];
}): SupplementOnboardingSeedDiffReport {
  if (plans.length === 0) {
    throw new Error("Supplement onboarding seed diff requires at least one plan.");
  }

  const existing = existingIdSets(existingData);
  const items = plans.map((plan) => seedDiffItemForPlan(plan, existing));
  const summary = summarizeSeedDiffItems(items);
  const nextAction =
    items.find((item) => item.status === "blocked")?.blockers[0] ??
    "Review the seed diff snippets manually, copy accepted additions into src/lib/seed-data.ts, then run validation before queueing sources.";

  return {
    generatedAt: generatedAt.toISOString(),
    humanOwned: true,
    items,
    nextAction,
    noAutoPromotion: true,
    noAutoWrite: true,
    readOnly: true,
    summary,
    validationCommands: VALIDATION_COMMANDS
  };
}

export function summarizeSupplementOnboardingSeedDiffReport(
  report: SupplementOnboardingSeedDiffReport
): SupplementOnboardingSeedDiffSummary {
  return {
    generatedAt: report.generatedAt,
    humanOwned: true,
    items: report.items.map((item) => ({
      blockers: item.blockers,
      claimCount: item.claimCount,
      importPlan: {
        databaseImportStatus: item.importPlan.databaseImport.status,
        noAutoWrite: true,
        noDatabaseWrite: true,
        recommendedPath: item.importPlan.recommendedPath,
        seedCopyNextAction: item.importPlan.seedCopy.nextAction,
        seedCopyStatus: item.importPlan.seedCopy.status,
        status: item.importPlan.status
      },
      interventionId: item.interventionId,
      name: item.name,
      nextCommand: item.queueCommandsAfterCopy[0],
      status: item.status,
      warnings: item.warnings
    })),
    nextAction: report.nextAction,
    noAutoPromotion: true,
    noAutoWrite: true,
    readOnly: true,
    summary: report.summary,
    validationCommands: report.validationCommands
  };
}

export function supplementOnboardingSeedDiffReportToMarkdown(
  report: SupplementOnboardingSeedDiffReport
) {
  const lines = [
    "# Supplement Onboarding Seed Diff",
    "",
    `Generated: ${report.generatedAt}`,
    `Read-only: ${report.readOnly}`,
    `No auto-write: ${report.noAutoWrite}`,
    `No auto-promotion: ${report.noAutoPromotion}`,
    "",
    "## Summary",
    "",
    `- items: ${report.summary.items}`,
    `- blocked: ${report.summary.blockedItems}`,
    `- review required: ${report.summary.reviewRequiredItems}`,
    `- ready for manual review: ${report.summary.readyForManualReview}`,
    `- claim drafts: ${report.summary.claimDrafts}`,
    `- conflicts: ${report.summary.conflicts}`,
    `- safety-blocked items: ${report.summary.safetyBlockedItems}`,
    `- target path: \`${report.summary.targetPath}\``,
    "",
    "## Validation Commands",
    "",
    ...report.validationCommands.map((command) => `- \`${command}\``),
    "",
    "## Items",
    "",
    ...report.items.flatMap((item) => seedDiffItemMarkdown(item)),
    "",
    "## Next Action",
    "",
    report.nextAction,
    ""
  ];

  return `${lines.join("\n")}\n`;
}

function seedDiffItemForPlan(
  plan: SupplementOnboardingPlan,
  existing: ReturnType<typeof existingIdSets>
): SupplementOnboardingSeedDiffItem {
  const interventionId = plan.interventionDraft.id;
  const claimIds = plan.claimDrafts.map((claim) => claim.id);
  const regulatoryStatusId = `${interventionId}-au-status`;
  const blockedSafetySignals = plan.safetyWatchlist.signals.filter(
    (signal) => signal.severity === "blocked"
  ).length;
  const warningSafetySignals = plan.safetyWatchlist.signals.filter(
    (signal) => signal.severity === "warning"
  ).length;
  const conflicts = seedDiffConflicts({
    claimIds,
    existing,
    interventionId,
    regulatoryStatusId
  });
  const seedCopyBlockers = seedCopyBlockingReviewItems(plan.blockingReviewItems);
  const blockers = [
    ...seedCopyBlockers,
    ...conflicts,
    ...(blockedSafetySignals > 0
      ? [
          `${blockedSafetySignals} blocked safety/watchlist signal(s) must be resolved before copying seed data.`
        ]
      : [])
  ];
  const warnings = [
    ...plan.blockingReviewItems.filter((item) => !seedCopyBlockers.includes(item)),
    ...plan.guardrailWarnings,
    ...(plan.productStatusAssistant.gapAssessment.length > 0
      ? [
          `${plan.productStatusAssistant.gapAssessment.length} AU/TGA product-status gap(s) remain; keep regulatory kind Unknown until reviewed.`
        ]
      : []),
    ...(warningSafetySignals > 0
      ? [
          `${warningSafetySignals} safety/watchlist warning signal(s) require caveat review before public wording.`
        ]
      : [])
  ];
  const operations: SupplementOnboardingSeedDiffOperation[] = [
    {
      exportName: "interventions",
      ids: [interventionId],
      kind: "add",
      targetPath: TARGET_PATH
    },
    {
      exportName: "claims",
      ids: claimIds,
      kind: "add",
      targetPath: TARGET_PATH
    },
    {
      exportName: "australiaRegulatoryStatuses",
      ids: [regulatoryStatusId],
      kind: "add",
      targetPath: TARGET_PATH
    }
  ];
  const status = seedDiffStatus(blockers, warnings);
  const importPlanStatus = draftImportPlanStatus(status);

  return {
    blockers: uniqueNonEmpty(blockers),
    claimCount: claimIds.length,
    claimIds,
    importPlan: draftImportPlanForSeedDiffItem({
      operations,
      status: importPlanStatus,
      validationCommands: VALIDATION_COMMANDS
    }),
    interventionId,
    name: plan.interventionDraft.name,
    operations,
    productStatusGapCount: plan.productStatusAssistant.gapAssessment.length,
    queueCommandsAfterCopy: plan.queueAfterSeedCommands,
    regulatoryStatusId,
    reviewChecklist: REVIEW_CHECKLIST,
    safetySignals: {
      blocked: blockedSafetySignals,
      warning: warningSafetySignals
    },
    slug: plan.interventionDraft.slug,
    snippet: supplementOnboardingPlanToSeedSnippet(plan),
    status,
    targetPath: TARGET_PATH,
    warnings: uniqueNonEmpty(warnings)
  };
}

function draftImportPlanStatus(
  status: SupplementOnboardingSeedDiffStatus
): SupplementOnboardingDraftImportPlanStatus {
  if (status === "ready-for-manual-review") {
    return "ready-for-manual-seed-copy";
  }

  return status;
}

function draftImportPlanForSeedDiffItem({
  operations,
  status,
  validationCommands
}: {
  operations: SupplementOnboardingSeedDiffOperation[];
  status: SupplementOnboardingDraftImportPlanStatus;
  validationCommands: string[];
}): SupplementOnboardingDraftImportPlan {
  const blocked = status === "blocked";
  const reviewRequired = status === "review-required";
  const seedCopyNextAction = blocked
    ? "Resolve blockers before copying any draft records into seed data."
    : reviewRequired
      ? "Complete manual copy review, then copy accepted snippets into src/lib/seed-data.ts and run validation."
      : "Copy accepted snippets into src/lib/seed-data.ts, then run validation before source queueing.";

  return {
    databaseImport: {
      nextAction:
        "Keep saved operator drafts private for now; a future database import action must be separately implemented, operator-gated, audited, and reviewed before it can create intervention or claim rows.",
      noImportCommand: true,
      requiredFutureGate:
        "Explicit authenticated operator database-import implementation and review.",
      status: "future-gated",
      supportedNow: false
    },
    nextAction: blocked ? seedCopyNextAction : `${seedCopyNextAction} Database import remains future-gated.`,
    noAutoPromotion: true,
    noAutoWrite: true,
    noDatabaseWrite: true,
    noPublicEvidenceRowsWritten: true,
    recommendedPath: blocked ? "resolve-blockers" : "manual-seed-copy",
    seedCopy: {
      nextAction: seedCopyNextAction,
      operations,
      reviewRequired,
      status,
      targetPath: TARGET_PATH
    },
    status,
    validationCommands
  };
}

function seedCopyBlockingReviewItems(items: string[]) {
  return items.filter(
    (item) =>
      item !==
        "Review AU/TGA product-level status separately; do not infer AUST/ARTG status." &&
      item !== "Attach source packets and human review before public evidence promotion."
  );
}

function seedDiffStatus(blockers: string[], warnings: string[]) {
  if (blockers.length > 0) {
    return "blocked";
  }

  if (warnings.length > 0) {
    return "review-required";
  }

  return "ready-for-manual-review";
}

function seedDiffConflicts({
  claimIds,
  existing,
  interventionId,
  regulatoryStatusId
}: {
  claimIds: string[];
  existing: ReturnType<typeof existingIdSets>;
  interventionId: string;
  regulatoryStatusId: string;
}) {
  return [
    existing.interventionIds.has(interventionId)
      ? `Intervention id already exists in seed data: ${interventionId}.`
      : undefined,
    ...claimIds.map((claimId) =>
      existing.claimIds.has(claimId)
        ? `Claim id already exists in seed data: ${claimId}.`
        : undefined
    ),
    existing.australiaRegulatoryStatusIds.has(regulatoryStatusId)
      ? `AU/TGA status id already exists in seed data: ${regulatoryStatusId}.`
      : undefined
  ].filter((item): item is string => Boolean(item));
}

function summarizeSeedDiffItems(items: SupplementOnboardingSeedDiffItem[]) {
  return {
    blockedItems: items.filter((item) => item.status === "blocked").length,
    claimDrafts: items.reduce((total, item) => total + item.claimCount, 0),
    conflicts: items.reduce(
      (total, item) =>
        total +
        item.blockers.filter((blocker) => blocker.includes("already exists in seed data")).length,
      0
    ),
    items: items.length,
    readyForManualReview: items.filter(
      (item) => item.status === "ready-for-manual-review"
    ).length,
    reviewRequiredItems: items.filter((item) => item.status === "review-required").length,
    safetyBlockedItems: items.filter((item) => item.safetySignals.blocked > 0).length,
    targetPath: TARGET_PATH
  };
}

function seedDiffItemMarkdown(item: SupplementOnboardingSeedDiffItem) {
  return [
    `### ${item.name}`,
    "",
    `- status: ${item.status}`,
    `- intervention id: \`${item.interventionId}\``,
    `- claim ids: ${item.claimIds.map((id) => `\`${id}\``).join(", ")}`,
    `- regulatory status id: \`${item.regulatoryStatusId}\``,
    `- target path: \`${item.targetPath}\``,
    `- safety signals: ${item.safetySignals.blocked} blocked, ${item.safetySignals.warning} warning`,
    `- product-status gaps: ${item.productStatusGapCount}`,
    "",
    "Operations:",
    ...item.operations.map(
      (operation) =>
        `- ${operation.kind} ${operation.ids.map((id) => `\`${id}\``).join(", ")} to \`${operation.exportName}\` in \`${operation.targetPath}\``
    ),
    "",
    "Draft import plan:",
    `- status: ${item.importPlan.status}`,
    `- recommended path: ${item.importPlan.recommendedPath}`,
    `- seed copy: ${item.importPlan.seedCopy.status} - ${item.importPlan.seedCopy.nextAction}`,
    `- database import: ${item.importPlan.databaseImport.status}; supported now: ${item.importPlan.databaseImport.supportedNow}`,
    `- no auto-write: ${item.importPlan.noAutoWrite}`,
    `- no database write: ${item.importPlan.noDatabaseWrite}`,
    `- no public evidence rows written: ${item.importPlan.noPublicEvidenceRowsWritten}`,
    `- no auto-promotion: ${item.importPlan.noAutoPromotion}`,
    `- database next action: ${item.importPlan.databaseImport.nextAction}`,
    "",
    "Blockers:",
    ...markdownBullets(item.blockers),
    "",
    "Warnings:",
    ...markdownBullets(item.warnings),
    "",
    "Review checklist:",
    ...markdownBullets(item.reviewChecklist),
    "",
    "Queue commands after reviewed copy and validation:",
    ...item.queueCommandsAfterCopy.map((command) => `- \`${command}\``),
    "",
    "Seed snippet:",
    "",
    "```ts",
    item.snippet.trimEnd(),
    "```",
    ""
  ];
}

function existingIdSets(existingData: SupplementOnboardingSeedDiffExistingData = {}) {
  return {
    australiaRegulatoryStatusIds: new Set(
      (existingData.australiaRegulatoryStatuses ?? []).map((status) => status.id)
    ),
    claimIds: new Set((existingData.claims ?? []).map((claim) => claim.id)),
    interventionIds: new Set(
      (existingData.interventions ?? []).map((intervention) => intervention.id)
    )
  };
}

function markdownBullets(values: string[]) {
  return values.length > 0 ? values.map((value) => `- ${value}`) : ["- none"];
}

function uniqueNonEmpty(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
