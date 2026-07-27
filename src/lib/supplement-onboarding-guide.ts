import {
  summarizeSupplementOnboardingPacketReport,
  type SupplementOnboardingPacketCommand,
  type SupplementOnboardingPacketReport,
  type SupplementOnboardingPacketSummary
} from "@/lib/supplement-onboarding-packet";

export type SupplementOnboardingGuideStepStatus =
  | "explicit-write-after-review"
  | "local-file-write"
  | "recommended"
  | "read-only";

export interface SupplementOnboardingGuideStep {
  command: string;
  label: string;
  mode: SupplementOnboardingPacketCommand["mode"];
  reason: string;
  stage: SupplementOnboardingPacketCommand["stage"];
  status: SupplementOnboardingGuideStepStatus;
}

export interface SupplementOnboardingGuideReport {
  commandQueue: SupplementOnboardingGuideStep[];
  generatedAt: string;
  humanOwned: true;
  mode: SupplementOnboardingPacketSummary["mode"];
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
  packet: SupplementOnboardingPacketSummary;
  readOnly: true;
  recommendedCommand?: SupplementOnboardingGuideStep;
  summary: {
    explicitWriteAfterReviewCommands: number;
    localFileWriteCommands: number;
    readOnlyCommands: number;
    totalCommands: number;
  };
}

const GUIDE_FLAGS = {
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

export function buildSupplementOnboardingGuideReport({
  packetReport
}: {
  packetReport: SupplementOnboardingPacketReport;
}): SupplementOnboardingGuideReport {
  const packet = summarizeSupplementOnboardingPacketReport(packetReport);
  const recommendedCommand = chooseRecommendedCommand(packet);
  const commandQueue = packet.commands.map((command) =>
    guideStep(command, recommendedCommand)
  );

  return {
    ...GUIDE_FLAGS,
    commandQueue,
    generatedAt: packet.generatedAt,
    mode: packet.mode,
    nextAction: packet.nextAction,
    packet,
    recommendedCommand: recommendedCommand
      ? guideStep(recommendedCommand, recommendedCommand)
      : undefined,
    summary: {
      explicitWriteAfterReviewCommands: packet.commands.filter(
        (command) => command.mode === "explicit-write-after-review"
      ).length,
      localFileWriteCommands: packet.commands.filter(
        (command) => command.mode === "local-file-write"
      ).length,
      readOnlyCommands: packet.commands.filter((command) => command.mode === "read-only")
        .length,
      totalCommands: packet.commands.length
    }
  };
}

export function summarizeSupplementOnboardingGuideReport(
  report: SupplementOnboardingGuideReport
) {
  return {
    commandQueue: report.commandQueue,
    generatedAt: report.generatedAt,
    humanOwned: true,
    mode: report.mode,
    nextAction: report.nextAction,
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
    readOnly: true,
    recommendedCommand: report.recommendedCommand,
    summary: report.summary
  };
}

export function supplementOnboardingGuideReportToMarkdown(
  report: SupplementOnboardingGuideReport
) {
  return [
    "# Supplement Onboarding Guide",
    "",
    `Generated: ${report.generatedAt}`,
    `Mode: ${report.mode}`,
    `Read-only: ${report.readOnly}`,
    `Human-owned: ${report.humanOwned}`,
    `No auto-write: ${report.noAutoWrite}`,
    `No database write: ${report.noDatabaseWrite}`,
    `No candidate decision: ${report.noCandidateDecision}`,
    `No extraction write: ${report.noExtractionWrite}`,
    `No connector approval: ${report.noConnectorApproval}`,
    `No full-text fetch: ${report.noFullTextFetch}`,
    `No auto-review: ${report.noAutoReview}`,
    `No auto-promotion: ${report.noAutoPromotion}`,
    "",
    "## Recommended Command",
    "",
    report.recommendedCommand
      ? `- ${report.recommendedCommand.label}: \`${report.recommendedCommand.command}\``
      : "- No command is currently recommended.",
    "",
    "## Command Queue",
    "",
    ...report.commandQueue.map(
      (step, index) =>
        `${index + 1}. ${step.label} (${step.status}): \`${step.command}\``
    ),
    "",
    "## Next Action",
    "",
    report.nextAction
  ].join("\n");
}

function chooseRecommendedCommand(
  packet: SupplementOnboardingPacketSummary
): SupplementOnboardingPacketCommand | undefined {
  if (packet.mode === "draft" || packet.mode === "draft-batch") {
    return firstCommandByStage(packet.commands, ["seed-diff", "import", "review-kit"]);
  }

  if (packet.mode === "existing" || packet.mode === "existing-batch") {
    const fullTextPrep = packet.commands.find(
      (command) =>
        command.stage === "full-text" &&
        commandLabelMatches(command.label, [
          "Create all-source review kit",
          "Write connector prep kit",
          "Check inventory progress",
          "Check fixture starter progress"
        ])
    );

    return (
      fullTextPrep ??
      firstCommandByStage(packet.commands, [
        "next-action",
        "review-packet",
        "status",
        "readiness"
      ])
    );
  }

  return packet.commands.find((command) => command.mode !== "explicit-write-after-review");
}

function commandLabelMatches(label: string, expectedLabels: string[]) {
  return expectedLabels.some(
    (expectedLabel) => label === expectedLabel || label.endsWith(`: ${expectedLabel}`)
  );
}

function firstCommandByStage(
  commands: SupplementOnboardingPacketCommand[],
  stages: SupplementOnboardingPacketCommand["stage"][]
) {
  return stages.flatMap((stage) => commands.filter((command) => command.stage === stage))[0];
}

function guideStep(
  command: SupplementOnboardingPacketCommand,
  recommendedCommand?: SupplementOnboardingPacketCommand
): SupplementOnboardingGuideStep {
  const recommended =
    recommendedCommand?.command === command.command &&
    recommendedCommand.label === command.label;

  return {
    command: command.command,
    label: command.label,
    mode: command.mode,
    reason: reasonForCommand(command, recommended),
    stage: command.stage,
    status: recommended ? "recommended" : command.mode
  };
}

function reasonForCommand(
  command: SupplementOnboardingPacketCommand,
  recommended: boolean
) {
  if (recommended) {
    return "Recommended next because it is the safest immediate step for this packet state.";
  }

  if (command.mode === "explicit-write-after-review") {
    return "Explicit write-after-review only; run after the prior reviewed gates are satisfied.";
  }

  if (command.mode === "local-file-write") {
    return "Local artifact write only; it does not change seed, database, candidate, review, or public evidence rows.";
  }

  return "Read-only preview or status check.";
}
