import {
  buildSupplementOnboardingNextActionReport,
  type SupplementOnboardingNextActionReport,
  type SupplementOnboardingNextActionStage
} from "@/lib/supplement-onboarding-next-action";
import type { OperatorOnboardingQualitySnapshot } from "@/lib/operator/onboarding-quality";
import type {
  SupplementOnboardingDraftReviewRow,
  SupplementOnboardingDraftReviewSnapshot
} from "@/lib/operator/supplement-onboarding-drafts";

export type OperatorGuidedOnboardingStage =
  | "batch-review-kit"
  | "full-text-fixture-extraction-draft"
  | "full-text-fixture-progress"
  | "full-text-fixture-validation"
  | "private-draft-review"
  | SupplementOnboardingNextActionStage;

export type OperatorGuidedOnboardingStepStatus =
  | "blocked"
  | "current"
  | "ready"
  | "waiting";

export interface OperatorGuidedOnboardingStep {
  action: string;
  command?: string;
  humanOwned: true;
  id: string;
  label: string;
  noAutoPromotion: true;
  noAutoReview: true;
  noAutoWrite: true;
  noCandidateDecision: true;
  noDatabaseWrite: true;
  noExtractionWrite: true;
  noPublicEvidenceRowsWritten: true;
  rationale: string[];
  readOnly: true;
  stage: OperatorGuidedOnboardingStage;
  status: OperatorGuidedOnboardingStepStatus;
  target: string;
}

export interface OperatorGuidedOnboardingWorkflowSnapshot {
  generatedAt: string;
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
  sourceReport: SupplementOnboardingNextActionReport;
  steps: OperatorGuidedOnboardingStep[];
  summary: {
    batchReviewKitSteps: number;
    blockedSteps: number;
    currentSteps: number;
    fixturePreviewSteps: number;
    privateDraftSteps: number;
    readySteps: number;
    steps: number;
    waitingSteps: number;
  };
}

export function buildOperatorGuidedOnboardingWorkflowSnapshot({
  generatedAt = new Date(),
  quality,
  savedDrafts
}: {
  generatedAt?: Date;
  quality: OperatorOnboardingQualitySnapshot;
  savedDrafts?: SupplementOnboardingDraftReviewSnapshot;
}): OperatorGuidedOnboardingWorkflowSnapshot {
  const sourceReport = buildSupplementOnboardingNextActionReport({
    dashboard: quality
  });
  const steps = [
    ...(savedDrafts?.rows ?? []).map(stepForSavedDraft),
    ...batchReviewKitSteps({
      quality,
      savedDrafts
    }),
    ...sourceReport.rows.map((row) => ({
      action: row.action,
      command: row.command,
      humanOwned: true,
      id: `source-${row.supplement.slug}-${row.stage}`,
      label: labelForStage(row.stage),
      noAutoPromotion: true,
      noAutoReview: true,
      noAutoWrite: true,
      noCandidateDecision: true,
      noDatabaseWrite: true,
      noExtractionWrite: true,
      noPublicEvidenceRowsWritten: true,
      rationale: row.rationale,
      readOnly: true,
      stage: row.stage,
      status: statusForNextActionRow(row.status),
      target: row.supplement.name
    }) satisfies OperatorGuidedOnboardingStep),
    ...sourceReport.globalActions.map((action) => ({
      action: action.action,
      command: action.command,
      humanOwned: true,
      id: `global-${action.stage}`,
      label: labelForStage(action.stage),
      noAutoPromotion: true,
      noAutoReview: true,
      noAutoWrite: true,
      noCandidateDecision: true,
      noDatabaseWrite: true,
      noExtractionWrite: true,
      noPublicEvidenceRowsWritten: true,
      rationale: action.rationale,
      readOnly: true,
      stage: action.stage,
      status: "waiting",
      target: "Global onboarding gate"
    }) satisfies OperatorGuidedOnboardingStep),
    ...fullTextFixturePreviewSteps(quality)
  ];
  const summary = summarizeSteps(steps);

  return {
    generatedAt: generatedAt.toISOString(),
    humanOwned: true,
    nextAction:
      steps.find((step) => step.status === "blocked")?.action ??
      steps.find((step) => step.status === "current")?.action ??
      sourceReport.nextAction,
    noAutoPromotion: true,
    noAutoReview: true,
    noAutoWrite: true,
    noCandidateDecision: true,
    noDatabaseWrite: true,
    noExtractionWrite: true,
    noPublicEvidenceRowsWritten: true,
    readOnly: true,
    sourceReport,
    steps,
    summary
  };
}

function batchReviewKitSteps({
  quality,
  savedDrafts
}: {
  quality: OperatorOnboardingQualitySnapshot;
  savedDrafts?: SupplementOnboardingDraftReviewSnapshot;
}): OperatorGuidedOnboardingStep[] {
  const privateDraftCount = savedDrafts?.summary.drafts ?? 0;
  const visibleSupplements = quality.rows.slice(0, 6);

  if (privateDraftCount < 2 && visibleSupplements.length < 2) {
    return [];
  }

  const supplementSlugs = visibleSupplements
    .map((row) => row.supplement.slug)
    .filter(Boolean);
  const existingPacketCommand =
    supplementSlugs.length >= 2
      ? `npm run onboarding:packet -- --supplements ${supplementSlugs.join(",")} --summary`
      : "npm run onboarding:packet -- --supplements <id-or-slug,id-or-slug> --summary";

  return [
    {
      action:
        "Create a local batch review-kit index before reviewing several supplement drafts together.",
      command:
        "npm run onboard:supplement -- --batch-file <reviewed-batch-json> --write-review-kit",
      humanOwned: true,
      id: "batch-review-kit",
      label: "Batch review kit",
      noAutoPromotion: true,
      noAutoReview: true,
      noAutoWrite: true,
      noCandidateDecision: true,
      noDatabaseWrite: true,
      noExtractionWrite: true,
      noPublicEvidenceRowsWritten: true,
      rationale: [
        `${privateDraftCount} private draft(s) and ${visibleSupplements.length} visible onboarding supplement(s) can be coordinated as a batch.`,
        "The command writes only local review artifacts after path preflight; it does not seed, import, queue, decide, extract, review, or promote.",
        `Existing-supplement packet preview: ${existingPacketCommand}`
      ],
      readOnly: true,
      stage: "batch-review-kit",
      status: privateDraftCount >= 2 ? "current" : "waiting",
      target: "Local batch review"
    }
  ];
}

function fullTextFixturePreviewSteps(
  quality: OperatorOnboardingQualitySnapshot
): OperatorGuidedOnboardingStep[] {
  const selectedSourceLabel =
    quality.fullTextNextAction.selectedSource?.label ?? "Full-text fixture starters";
  const steps: OperatorGuidedOnboardingStep[] = [];

  for (const command of quality.fullTextNextAction.commands) {
    if (command.id === "check-fixture-progress") {
      steps.push({
        action:
          "Check generated local fixture starter progress before validating individual fixtures.",
        command: command.command,
        humanOwned: true,
        id: "full-text-fixture-progress",
        label: "Fixture progress",
        noAutoPromotion: true,
        noAutoReview: true,
        noAutoWrite: true,
        noCandidateDecision: true,
        noDatabaseWrite: true,
        noExtractionWrite: true,
        noPublicEvidenceRowsWritten: true,
        rationale: [
          command.purpose,
          "The progress rollup reads local fixture files only and does not fetch full text."
        ],
        readOnly: true,
        stage: "full-text-fixture-progress" as const,
        status: "current" as const,
        target: selectedSourceLabel
      });
      continue;
    }

    if (command.id === "validate-fixture-starter") {
      steps.push({
        action:
          "Validate the generated local fixture starter after reviewed local values are filled.",
        command: command.command,
        humanOwned: true,
        id: "full-text-fixture-validation",
        label: "Fixture validation",
        noAutoPromotion: true,
        noAutoReview: true,
        noAutoWrite: true,
        noCandidateDecision: true,
        noDatabaseWrite: true,
        noExtractionWrite: true,
        noPublicEvidenceRowsWritten: true,
        rationale: [
          command.purpose,
          "The validator reports derived field shape without echoing raw excerpts."
        ],
        readOnly: true,
        stage: "full-text-fixture-validation" as const,
        status: "waiting" as const,
        target: selectedSourceLabel
      });
      continue;
    }

    if (command.id === "draft-fixture-extraction") {
      steps.push({
        action:
          "Preview extraction flags from reviewed local fixture fields before any operator write.",
        command: command.command,
        humanOwned: true,
        id: "full-text-fixture-extraction-draft",
        label: "Fixture extraction draft",
        noAutoPromotion: true,
        noAutoReview: true,
        noAutoWrite: true,
        noCandidateDecision: true,
        noDatabaseWrite: true,
        noExtractionWrite: true,
        noPublicEvidenceRowsWritten: true,
        rationale: [
          command.purpose,
          "The draft does not validate database state, decide candidates, write extraction rows, mark claim reviews, or promote evidence."
        ],
        readOnly: true,
        stage: "full-text-fixture-extraction-draft" as const,
        status: "waiting" as const,
        target: selectedSourceLabel
      });
    }
  }

  return steps;
}

function stepForSavedDraft(
  row: SupplementOnboardingDraftReviewRow
): OperatorGuidedOnboardingStep {
  const status =
    row.importPlan.status === "blocked"
      ? "blocked"
      : row.importPlan.status === "ready-for-manual-seed-copy"
        ? "ready"
        : "current";

  return {
    action: row.nextAction,
    command: `npm run onboarding:import-assistant -- --name ${quote(row.name)} --summary`,
    humanOwned: true,
    id: `draft-${row.slug}`,
    label: "Private draft review",
    noAutoPromotion: true,
    noAutoReview: true,
    noAutoWrite: true,
    noCandidateDecision: true,
    noDatabaseWrite: true,
    noExtractionWrite: true,
    noPublicEvidenceRowsWritten: true,
    rationale: [
      `${row.claimCount} draft claim(s), ${row.blockerCount} blocker(s), ${row.warningCount} warning(s).`,
      `Manual seed-copy status: ${row.importPlan.seedCopy.status}.`,
      "Database import remains not yet enabled and commandless."
    ],
    readOnly: true,
    stage: "private-draft-review",
    status,
    target: row.name
  };
}

function statusForNextActionRow(
  status: SupplementOnboardingNextActionReport["rows"][number]["status"]
): OperatorGuidedOnboardingStepStatus {
  if (status === "blocked") {
    return "blocked";
  }

  if (status === "warning") {
    return "current";
  }

  return "ready";
}

function labelForStage(stage: OperatorGuidedOnboardingStage) {
  const labels: Record<OperatorGuidedOnboardingStage, string> = {
    "batch-review-kit": "Batch review kit",
    "draft-claims": "Draft claim scopes",
    "extract-studies": "Extract studies",
    "full-text-fixture-extraction-draft": "Fixture extraction draft",
    "full-text-fixture-progress": "Fixture progress",
    "full-text-fixture-validation": "Fixture validation",
    "full-text-source-gate": "Full-text source gate",
    "private-draft-review": "Private draft review",
    "promotion-readiness": "Promotion readiness",
    "queue-sources": "Queue sources",
    ready: "Ready check",
    "review-candidates": "Review candidates",
    "review-claim-packet": "Review claim packet",
    "run-source-ingestion": "Run source ingestion",
    "source-tracking-gate": "Source tracking gate"
  };

  return labels[stage];
}

function summarizeSteps(steps: OperatorGuidedOnboardingStep[]) {
  return {
    batchReviewKitSteps: steps.filter((step) => step.stage === "batch-review-kit")
      .length,
    blockedSteps: steps.filter((step) => step.status === "blocked").length,
    currentSteps: steps.filter((step) => step.status === "current").length,
    fixturePreviewSteps: steps.filter((step) =>
      [
        "full-text-fixture-extraction-draft",
        "full-text-fixture-progress",
        "full-text-fixture-validation"
      ].includes(step.stage)
    ).length,
    privateDraftSteps: steps.filter((step) => step.stage === "private-draft-review")
      .length,
    readySteps: steps.filter((step) => step.status === "ready").length,
    steps: steps.length,
    waitingSteps: steps.filter((step) => step.status === "waiting").length
  };
}

function quote(value: string) {
  return `"${value.replace(/"/g, '\\"')}"`;
}
