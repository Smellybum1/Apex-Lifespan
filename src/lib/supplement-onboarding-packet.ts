import type { FullTextSourceInventoryItem } from "@/lib/full-text-source-readiness";
import {
  type SupplementOnboardingInput,
  type SupplementOnboardingPlan,
  buildSupplementOnboardingPlan
} from "@/lib/supplement-onboarding";
import {
  buildSupplementOnboardingImportAssistantReport,
  summarizeSupplementOnboardingImportAssistantReport,
  type SupplementOnboardingImportAssistantSummary
} from "@/lib/supplement-onboarding-import-assistant";
import {
  buildSupplementOnboardingReviewKit,
  type SupplementOnboardingReviewKit
} from "@/lib/supplement-onboarding-review-kit";
import {
  buildSupplementOnboardingReviewPacketReport,
  type SupplementOnboardingReviewPacketReport
} from "@/lib/supplement-onboarding-review-packet";
import {
  buildSupplementOnboardingSeedDiffReport,
  summarizeSupplementOnboardingSeedDiffReport,
  type SupplementOnboardingSeedDiffExistingData,
  type SupplementOnboardingSeedDiffSummary
} from "@/lib/supplement-onboarding-seed-diff";
import {
  buildSupplementOnboardingStatusReport,
  summarizeSupplementOnboardingStatusReport,
  type SupplementOnboardingStatusSummary
} from "@/lib/supplement-onboarding-status";
import type { SupplementOnboardingSourceSignals } from "@/lib/supplement-onboarding-readiness";
import type { EvidenceDashboardData } from "@/lib/types";

export type SupplementOnboardingPacketMode =
  | "draft"
  | "draft-batch"
  | "existing"
  | "existing-batch";

export type SupplementOnboardingBatchPacketItemStatus =
  | "blocked"
  | "ready"
  | "warning";

export interface SupplementOnboardingPacketCommand {
  command: string;
  label: string;
  mode: "explicit-write-after-review" | "local-file-write" | "read-only";
  stage:
    | "draft"
    | "full-text"
    | "import"
    | "next-action"
    | "quality"
    | "readiness"
    | "review-kit"
    | "review-packet"
    | "seed-diff"
    | "source-queue"
    | "status";
}

export interface SupplementOnboardingPacketReviewPacketSummary {
  generatedAt: string;
  packetCount: number;
  packets: Array<{
    acceptedCandidates: number;
    autopilotCurationDraftCommand?: string;
    autopilotNextAction: string;
    autopilotRecommendedCandidate?: string;
    autopilotStatus: string;
    claimId: string;
    decisionLabel: string;
    pendingCandidates: number;
    promotionReady: boolean;
    sourcePacketStatus: string;
    supplementId: string;
  }>;
  readOnly: true;
  unmatchedClaimId?: string;
  unmatchedSupplementQuery?: string;
}

export interface SupplementOnboardingDraftPacketSection {
  importAssistant: SupplementOnboardingImportAssistantSummary;
  plan: SupplementOnboardingPlan;
  reviewKit: {
    files: Array<Pick<SupplementOnboardingReviewKit["files"][number], "path" | "purpose" | "title">>;
    localFileWriteOnly: true;
    summary: SupplementOnboardingReviewKit["summary"];
  };
  seedDiff: SupplementOnboardingSeedDiffSummary;
}

export interface SupplementOnboardingExistingPacketSection {
  reviewPacket: SupplementOnboardingPacketReviewPacketSummary;
  status: SupplementOnboardingStatusSummary;
}

export interface SupplementOnboardingBatchPacketItem {
  key: string;
  mode: "draft" | "existing";
  name: string;
  nextAction: string;
  packet: SupplementOnboardingPacketSummary;
  status: SupplementOnboardingBatchPacketItemStatus;
}

export interface SupplementOnboardingBatchPacketSection {
  isolated: true;
  items: SupplementOnboardingBatchPacketItem[];
  summary: {
    blocked: number;
    draftItems: number;
    existingItems: number;
    items: number;
    ready: number;
    totalCommands: number;
    warning: number;
  };
}

export interface SupplementOnboardingPacketReport {
  batch?: SupplementOnboardingBatchPacketSection;
  commands: SupplementOnboardingPacketCommand[];
  draft?: SupplementOnboardingDraftPacketSection;
  existing?: SupplementOnboardingExistingPacketSection;
  generatedAt: string;
  humanOwned: true;
  mode: SupplementOnboardingPacketMode;
  nextAction: string;
  noAutoApproval: true;
  noAutoPromotion: true;
  noAutoReview: true;
  noAutoWrite: true;
  noCandidateDecision: true;
  noConnectorApproval: true;
  noDatabaseWrite: true;
  noExtractionWrite: true;
  noFullTextFetch: true;
  noPublicEvidenceRowsWritten: true;
  readOnly: true;
}

export interface SupplementOnboardingPacketSummary {
  batch?: SupplementOnboardingBatchPacketSection;
  commands: SupplementOnboardingPacketCommand[];
  draft?: {
    blockers: number;
    claimDrafts: number;
    databaseImportStatus: string;
    importAssistantStatus: string;
    interventionId: string;
    name: string;
    reviewKitFiles: number;
    seedCopyStatus: string;
    warnings: number;
  };
  existing?: {
    dataSource: EvidenceDashboardData["dataSource"];
    fullTextNextAction: SupplementOnboardingStatusSummary["fullText"]["nextAction"]["status"];
    packetCount: number;
    packets: SupplementOnboardingPacketReviewPacketSummary["packets"];
    quality: SupplementOnboardingStatusSummary["quality"];
    readiness: SupplementOnboardingStatusSummary["readiness"];
    scope: SupplementOnboardingStatusSummary["scope"];
    sourceConvictionRubric: SupplementOnboardingStatusSummary["sourceConvictionRubric"];
    supplementQuery?: string;
  };
  generatedAt: string;
  humanOwned: true;
  mode: SupplementOnboardingPacketMode;
  nextAction: string;
  noAutoApproval: true;
  noAutoPromotion: true;
  noAutoReview: true;
  noAutoWrite: true;
  noCandidateDecision: true;
  noConnectorApproval: true;
  noDatabaseWrite: true;
  noExtractionWrite: true;
  noFullTextFetch: true;
  noPublicEvidenceRowsWritten: true;
  readOnly: true;
}

const BOUNDARY_FLAGS = {
  humanOwned: true,
  noAutoApproval: true,
  noAutoPromotion: true,
  noAutoReview: true,
  noAutoWrite: true,
  noCandidateDecision: true,
  noConnectorApproval: true,
  noDatabaseWrite: true,
  noExtractionWrite: true,
  noFullTextFetch: true,
  noPublicEvidenceRowsWritten: true,
  readOnly: true
} as const;

const GLOBAL_BATCH_FULL_TEXT_COMMAND_LABELS = new Set([
  "Full-text source next action",
  "Create all-source review kit",
  "Create focused source review kit",
  "Check inventory progress",
  "Refresh next action",
  "Write connector prep kit",
  "Check fixture starter progress",
  "Validate local fixture starter",
  "Preview fixture extraction draft",
  "Review connector readiness",
  "Write connector review packet",
  "Preview connector implementation plan",
  "Write connector implementation plan",
  "Preview connector approval packet",
  "Write connector approval packet"
]);

export function buildDraftSupplementOnboardingPacket({
  existingSeedData,
  generatedAt = new Date(),
  input
}: {
  existingSeedData?: SupplementOnboardingSeedDiffExistingData;
  generatedAt?: Date;
  input: SupplementOnboardingInput;
}): SupplementOnboardingPacketReport {
  const plan = buildSupplementOnboardingPlan({
    ...input,
    generatedAt
  });
  const seedDiffReport = buildSupplementOnboardingSeedDiffReport({
    existingData: existingSeedData,
    generatedAt,
    plans: [plan]
  });
  const importAssistantReport = buildSupplementOnboardingImportAssistantReport({
    generatedAt,
    plans: [plan],
    seedDiffReport
  });
  const reviewKit = buildSupplementOnboardingReviewKit({
    generatedAt,
    plan,
    seedDiffReport
  });

  return {
    ...BOUNDARY_FLAGS,
    commands: draftPacketCommands(plan),
    draft: {
      importAssistant: summarizeSupplementOnboardingImportAssistantReport(
        importAssistantReport
      ),
      plan,
      reviewKit: {
        files: reviewKit.files.map((file) => ({
          path: file.path,
          purpose: file.purpose,
          title: file.title
        })),
        localFileWriteOnly: true,
        summary: reviewKit.summary
      },
      seedDiff: summarizeSupplementOnboardingSeedDiffReport(seedDiffReport)
    },
    generatedAt: generatedAt.toISOString(),
    mode: "draft",
    nextAction: importAssistantReport.nextAction
  };
}

export function buildExistingSupplementOnboardingPacket({
  data,
  fullTextInventoryPath,
  fullTextSourceInventory,
  generatedAt = new Date(),
  sourceSignals,
  supplementQuery
}: {
  data: EvidenceDashboardData;
  fullTextInventoryPath?: string;
  fullTextSourceInventory?: FullTextSourceInventoryItem[];
  generatedAt?: Date;
  sourceSignals?: SupplementOnboardingSourceSignals;
  supplementQuery: string;
}): SupplementOnboardingPacketReport {
  const statusReport = buildSupplementOnboardingStatusReport({
    data,
    fullTextInventoryPath,
    fullTextSourceInventory,
    generatedAt,
    sourceSignals,
    supplementQuery
  });
  const reviewPacket = buildSupplementOnboardingReviewPacketReport({
    data,
    generatedAt,
    sourceSignals,
    supplementQuery
  });
  const status = summarizeSupplementOnboardingStatusReport(statusReport);
  const reviewPacketSummary = summarizeReviewPacket(reviewPacket);

  return {
    ...BOUNDARY_FLAGS,
    commands: existingPacketCommands({
      fullTextInventoryPath,
      fullTextNextActionCommands: status.fullText.nextAction.commands,
      supplementQuery
    }),
    existing: {
      reviewPacket: reviewPacketSummary,
      status
    },
    generatedAt: generatedAt.toISOString(),
    mode: "existing",
    nextAction:
      status.nextAction ??
      reviewPacketSummary.packets[0]?.autopilotNextAction ??
      "Review the packet summary before any explicit operator-owned write."
  };
}

export function buildDraftBatchSupplementOnboardingPacket({
  existingSeedData,
  generatedAt = new Date(),
  inputs
}: {
  existingSeedData?: SupplementOnboardingSeedDiffExistingData;
  generatedAt?: Date;
  inputs: SupplementOnboardingInput[];
}): SupplementOnboardingPacketReport {
  if (inputs.length === 0) {
    throw new Error("Supplement onboarding packet batch requires at least one draft input.");
  }

  const itemSummaries = inputs.map((input) => {
    const report = buildDraftSupplementOnboardingPacket({
      existingSeedData,
      generatedAt,
      input
    });
    const packet = summarizeSupplementOnboardingPacketReport(report);

    return {
      key: packet.draft?.interventionId ?? input.name,
      mode: "draft" as const,
      name: packet.draft?.name ?? input.name,
      nextAction: packet.nextAction,
      packet,
      status: draftPacketItemStatus(packet)
    };
  });

  return {
    ...BOUNDARY_FLAGS,
    batch: buildBatchPacketSection(itemSummaries),
    commands: flattenBatchPacketCommands(itemSummaries),
    generatedAt: generatedAt.toISOString(),
    mode: "draft-batch",
    nextAction: batchNextAction(itemSummaries)
  };
}

export function buildExistingBatchSupplementOnboardingPacket({
  data,
  fullTextInventoryPath,
  fullTextSourceInventory,
  generatedAt = new Date(),
  supplements
}: {
  data: EvidenceDashboardData;
  fullTextInventoryPath?: string;
  fullTextSourceInventory?: FullTextSourceInventoryItem[];
  generatedAt?: Date;
  supplements: Array<{
    sourceSignals?: SupplementOnboardingSourceSignals;
    supplementQuery: string;
  }>;
}): SupplementOnboardingPacketReport {
  if (supplements.length === 0) {
    throw new Error(
      "Supplement onboarding packet batch requires at least one existing supplement query."
    );
  }

  const itemSummaries = supplements.map((item) => {
    const report = buildExistingSupplementOnboardingPacket({
      data,
      fullTextInventoryPath,
      fullTextSourceInventory,
      generatedAt,
      sourceSignals: item.sourceSignals,
      supplementQuery: item.supplementQuery
    });
    const packet = summarizeSupplementOnboardingPacketReport(report);
    const readinessName = packet.existing?.readiness.find(
      (readiness) => readiness.supplement
    )?.supplement;

    return {
      key: packet.existing?.supplementQuery ?? item.supplementQuery,
      mode: "existing" as const,
      name: readinessName ?? item.supplementQuery,
      nextAction: packet.nextAction,
      packet,
      status: existingPacketItemStatus(packet)
    };
  });

  return {
    ...BOUNDARY_FLAGS,
    batch: buildBatchPacketSection(itemSummaries),
    commands: flattenBatchPacketCommands(itemSummaries),
    generatedAt: generatedAt.toISOString(),
    mode: "existing-batch",
    nextAction: batchNextAction(itemSummaries)
  };
}

export function summarizeSupplementOnboardingPacketReport(
  report: SupplementOnboardingPacketReport
): SupplementOnboardingPacketSummary {
  return {
    ...BOUNDARY_FLAGS,
    ...(report.batch ? { batch: report.batch } : {}),
    commands: report.commands,
    ...(report.draft
      ? {
          draft: {
            blockers: report.draft.seedDiff.summary.blockedItems,
            claimDrafts: report.draft.plan.claimDrafts.length,
            databaseImportStatus:
              report.draft.importAssistant.items[0]?.databaseImportStatus ??
              "future-gated",
            importAssistantStatus:
              report.draft.importAssistant.items[0]?.status ?? "blocked",
            interventionId: report.draft.plan.interventionDraft.id,
            name: report.draft.plan.interventionDraft.name,
            reviewKitFiles: report.draft.reviewKit.summary.files,
            seedCopyStatus:
              report.draft.importAssistant.items[0]?.manualSeedCopyStatus ??
              "blocked",
            warnings: report.draft.seedDiff.summary.reviewRequiredItems
          }
        }
      : {}),
    ...(report.existing
      ? {
          existing: {
            dataSource: report.existing.status.dataSource,
            fullTextNextAction: report.existing.status.fullText.nextAction.status,
            packetCount: report.existing.reviewPacket.packetCount,
            packets: report.existing.reviewPacket.packets,
            quality: report.existing.status.quality,
            readiness: report.existing.status.readiness,
            scope: report.existing.status.scope,
            sourceConvictionRubric: report.existing.status.sourceConvictionRubric,
            supplementQuery: report.existing.status.supplementQuery
          }
        }
      : {}),
    generatedAt: report.generatedAt,
    mode: report.mode,
    nextAction: report.nextAction
  };
}

export function supplementOnboardingPacketReportToMarkdown(
  report: SupplementOnboardingPacketReport
) {
  const summary = summarizeSupplementOnboardingPacketReport(report);
  const lines = [
    "# Supplement Onboarding Packet",
    "",
    `Generated: ${summary.generatedAt}`,
    `Mode: ${summary.mode}`,
    `Read-only: ${summary.readOnly}`,
    `Human-owned: ${summary.humanOwned}`,
    `No auto-write: ${summary.noAutoWrite}`,
    `No database write: ${summary.noDatabaseWrite}`,
    `No candidate decision: ${summary.noCandidateDecision}`,
    `No extraction write: ${summary.noExtractionWrite}`,
    `No connector approval: ${summary.noConnectorApproval}`,
    `No full-text fetch: ${summary.noFullTextFetch}`,
    `No auto-review: ${summary.noAutoReview}`,
    `No auto-promotion: ${summary.noAutoPromotion}`,
    "",
    "## Summary",
    "",
    ...packetSummaryLines(summary),
    "",
    "## Commands",
    "",
    ...summary.commands.map(
      (command) =>
        `- ${command.label}: \`${command.command}\` (${command.mode}; ${command.stage})`
    ),
    "",
    "## Next Action",
    "",
    summary.nextAction,
    ""
  ];

  return `${lines.join("\n")}\n`;
}

function summarizeReviewPacket(
  report: SupplementOnboardingReviewPacketReport
): SupplementOnboardingPacketReviewPacketSummary {
  return {
    generatedAt: report.generatedAt,
    packetCount: report.packets.length,
    packets: report.packets.map((packet) => ({
      acceptedCandidates: packet.sourceCandidates.accepted.length,
      autopilotCurationDraftCommand:
        packet.candidateReviewAutopilot.curationDraftCommand,
      autopilotNextAction: packet.candidateReviewAutopilot.nextAction,
      autopilotRecommendedCandidate:
        packet.candidateReviewAutopilot.recommendedCandidate?.dedupeKey ??
        packet.candidateReviewAutopilot.recommendedCandidate?.title,
      autopilotStatus: packet.candidateReviewAutopilot.status,
      claimId: packet.claim.id,
      decisionLabel: packet.operatorDecision.label,
      pendingCandidates: packet.sourceCandidates.pendingReview.length,
      promotionReady: packet.promotionDiff.readyForPromotionReview,
      sourcePacketStatus: packet.sourcePacket.status,
      supplementId: packet.supplement.id
    })),
    readOnly: true,
    unmatchedClaimId: report.unmatchedClaimId,
    unmatchedSupplementQuery: report.unmatchedSupplementQuery
  };
}

function draftPacketCommands(
  plan: SupplementOnboardingPlan
): SupplementOnboardingPacketCommand[] {
  return [
    {
      command: `npm run onboarding:seed-diff -- --name ${quote(plan.interventionDraft.name)} --category ${quote(plan.interventionDraft.category ?? "<category>")} --summary`,
      label: "Review seed/database import plan",
      mode: "read-only",
      stage: "seed-diff"
    },
    {
      command: `npm run onboarding:import-assistant -- --name ${quote(plan.interventionDraft.name)} --category ${quote(plan.interventionDraft.category ?? "<category>")} --summary`,
      label: "Preview draft import assistant",
      mode: "read-only",
      stage: "import"
    },
    {
      command: `npm run onboarding:review-kit -- --name ${quote(plan.interventionDraft.name)} --category ${quote(plan.interventionDraft.category ?? "<category>")}`,
      label: "Write local review kit",
      mode: "local-file-write",
      stage: "review-kit"
    },
    {
      command: plan.queueAfterSeedCommands[0] ?? "npm run onboarding:queue-sources -- --supplement <supplement-id-or-slug>",
      label: "Queue sources after reviewed seed/database record exists",
      mode: "explicit-write-after-review",
      stage: "source-queue"
    },
    {
      command: "npm run onboarding:fulltext-sources -- --next --summary",
      label: "Check full-text source gate",
      mode: "read-only",
      stage: "full-text"
    }
  ];
}

function existingPacketCommands({
  fullTextInventoryPath,
  fullTextNextActionCommands,
  supplementQuery
}: {
  fullTextInventoryPath?: string;
  fullTextNextActionCommands?: SupplementOnboardingStatusSummary["fullText"]["nextAction"]["commands"];
  supplementQuery: string;
}): SupplementOnboardingPacketCommand[] {
  const supplementArg = quote(supplementQuery);
  const fullTextInventoryArg = fullTextInventoryPath
    ? ` --fulltext-inventory-file ${quote(fullTextInventoryPath)}`
    : "";
  const fullTextSourceArg = fullTextInventoryPath
    ? ` --inventory-file ${quote(fullTextInventoryPath)}`
    : "";

  return [
    {
      command: `npm run onboarding:status -- --supplement ${supplementArg}${fullTextInventoryArg} --summary`,
      label: "Composite status",
      mode: "read-only",
      stage: "status"
    },
    {
      command: `npm run onboarding:readiness -- --supplement ${supplementArg} --summary`,
      label: "Supplement readiness",
      mode: "read-only",
      stage: "readiness"
    },
    {
      command: `npm run onboarding:review-packet -- --supplement ${supplementArg} --summary`,
      label: "Review packet and source conviction",
      mode: "read-only",
      stage: "review-packet"
    },
    {
      command: `npm run onboarding:next -- --supplement ${supplementArg}${fullTextInventoryArg} --summary`,
      label: "Next action",
      mode: "read-only",
      stage: "next-action"
    },
    {
      command: `npm run onboarding:fulltext-sources --${fullTextSourceArg} --next --summary`,
      label: "Full-text source next action",
      mode: "read-only",
      stage: "full-text"
    },
    ...fullTextPacketFollowUpCommands(fullTextNextActionCommands)
  ];
}

function fullTextPacketFollowUpCommands(
  commands: SupplementOnboardingStatusSummary["fullText"]["nextAction"]["commands"] = []
): SupplementOnboardingPacketCommand[] {
  const includedCommandIds = new Set([
    "write-all-source-review-kit",
    "write-focused-source-review-kit",
    "check-inventory-progress",
    "refresh-next-action",
    "write-connector-prep-kit",
    "check-fixture-progress",
    "validate-fixture-starter",
    "draft-fixture-extraction",
    "connector-review-summary",
    "write-connector-review",
    "connector-plan-summary",
    "write-connector-plan",
    "connector-approval-packet-summary",
    "write-connector-approval-packet"
  ]);

  return commands
    .filter((command) => includedCommandIds.has(command.id))
    .map((command) => ({
      command: command.command,
      label: command.label,
      mode: command.mode,
      stage: "full-text" as const
    }));
}

function buildBatchPacketSection(
  items: SupplementOnboardingBatchPacketItem[]
): SupplementOnboardingBatchPacketSection {
  return {
    isolated: true,
    items,
    summary: {
      blocked: items.filter((item) => item.status === "blocked").length,
      draftItems: items.filter((item) => item.mode === "draft").length,
      existingItems: items.filter((item) => item.mode === "existing").length,
      items: items.length,
      ready: items.filter((item) => item.status === "ready").length,
      totalCommands: items.reduce(
        (total, item) => total + item.packet.commands.length,
        0
      ),
      warning: items.filter((item) => item.status === "warning").length
    }
  };
}

function flattenBatchPacketCommands(
  items: SupplementOnboardingBatchPacketItem[]
): SupplementOnboardingPacketCommand[] {
  const commands: SupplementOnboardingPacketCommand[] = [];
  const globalCommandKeys = new Set<string>();

  for (const item of items) {
    for (const command of item.packet.commands) {
      if (isGlobalBatchFullTextCommand(command)) {
        const key = `${command.stage}|${command.label}|${command.command}`;

        if (!globalCommandKeys.has(key)) {
          globalCommandKeys.add(key);
          commands.push(command);
        }

        continue;
      }

      commands.push({
        ...command,
        label: `${item.name}: ${command.label}`
      });
    }
  }

  return commands;
}

function isGlobalBatchFullTextCommand(command: SupplementOnboardingPacketCommand) {
  return (
    command.stage === "full-text" &&
    GLOBAL_BATCH_FULL_TEXT_COMMAND_LABELS.has(command.label)
  );
}

function batchNextAction(items: SupplementOnboardingBatchPacketItem[]) {
  const nextItem =
    items.find((item) => item.status === "blocked") ??
    items.find((item) => item.status === "warning") ??
    items[0];

  return nextItem
    ? `${nextItem.name}: ${nextItem.nextAction}`
    : "No batch packet items were generated.";
}

function draftPacketItemStatus(
  packet: SupplementOnboardingPacketSummary
): SupplementOnboardingBatchPacketItemStatus {
  if (!packet.draft) {
    return "blocked";
  }

  if (
    packet.draft.blockers > 0 ||
    packet.draft.importAssistantStatus === "blocked" ||
    packet.draft.seedCopyStatus === "blocked"
  ) {
    return "blocked";
  }

  if (
    packet.draft.warnings > 0 ||
    packet.draft.databaseImportStatus !== "ready"
  ) {
    return "warning";
  }

  return "ready";
}

function existingPacketItemStatus(
  packet: SupplementOnboardingPacketSummary
): SupplementOnboardingBatchPacketItemStatus {
  if (!packet.existing) {
    return "blocked";
  }

  if (
    packet.existing.readiness.some((item) => item.overall === "blocked") ||
    packet.existing.quality.blockedSupplements > 0
  ) {
    return "blocked";
  }

  if (
    packet.existing.readiness.some((item) => item.warningChecks > 0) ||
    packet.existing.quality.pendingCandidates > 0 ||
    packet.existing.quality.warningSupplements > 0
  ) {
    return "warning";
  }

  return "ready";
}

function packetSummaryLines(summary: SupplementOnboardingPacketSummary) {
  if (summary.batch) {
    return [
      `- batch isolation: ${summary.batch.isolated}`,
      `- items: ${summary.batch.summary.items}`,
      `- draft items: ${summary.batch.summary.draftItems}`,
      `- existing items: ${summary.batch.summary.existingItems}`,
      `- ready: ${summary.batch.summary.ready}`,
      `- warnings: ${summary.batch.summary.warning}`,
      `- blocked: ${summary.batch.summary.blocked}`,
      `- total item commands: ${summary.batch.summary.totalCommands}`,
      ...summary.batch.items.map(
        (item) => `- ${item.name}: ${item.status}; next: ${item.nextAction}`
      )
    ];
  }

  if (summary.draft) {
    return [
      `- supplement: ${summary.draft.name}`,
      `- intervention id: \`${summary.draft.interventionId}\``,
      `- draft claims: ${summary.draft.claimDrafts}`,
      `- seed copy: ${summary.draft.seedCopyStatus}`,
      `- database import: ${summary.draft.databaseImportStatus}`,
      `- import assistant: ${summary.draft.importAssistantStatus}`,
      `- review kit files: ${summary.draft.reviewKitFiles}`,
      `- blockers: ${summary.draft.blockers}`,
      `- warnings: ${summary.draft.warnings}`
    ];
  }

  if (summary.existing) {
    return [
      `- data source: ${summary.existing.dataSource}`,
      `- scope: ${summary.existing.scope}`,
      `- supplement query: ${summary.existing.supplementQuery ?? "all"}`,
      `- ready supplements: ${summary.existing.quality.readySupplements}`,
      `- blocked supplements: ${summary.existing.quality.blockedSupplements}`,
      `- pending candidates: ${summary.existing.quality.pendingCandidates}`,
      `- review packets: ${summary.existing.packetCount}`,
      `- full-text next: ${summary.existing.fullTextNextAction}`,
      `- source rubric: ${summary.existing.sourceConvictionRubric.version}`
    ];
  }

  return ["- no packet sections generated"];
}

function quote(value: string) {
  return JSON.stringify(value);
}
