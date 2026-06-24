import {
  supplementOnboardingPlanToMarkdown,
  type SupplementOnboardingPlan
} from "@/lib/supplement-onboarding";
import {
  buildSupplementOnboardingImportAssistantReport,
  supplementOnboardingImportAssistantReportToMarkdown
} from "@/lib/supplement-onboarding-import-assistant";
import {
  supplementOnboardingSeedDiffReportToMarkdown,
  type SupplementOnboardingSeedDiffReport
} from "@/lib/supplement-onboarding-seed-diff";

export interface SupplementOnboardingReviewKitFile {
  content: string;
  path: string;
  purpose: string;
  title: string;
}

export interface SupplementOnboardingReviewKit {
  files: SupplementOnboardingReviewKitFile[];
  generatedAt: string;
  humanOwned: true;
  localFileWriteOnly: true;
  nextAction: string;
  noAutoPromotion: true;
  noAutoReview: true;
  noAutoWrite: true;
  noCandidateDecision: true;
  noDatabaseWrite: true;
  noExtractionWrite: true;
  noPublicEvidenceRowsWritten: true;
  readOnly: true;
  slug: string;
  summary: {
    blockers: number;
    claimDrafts: number;
    files: number;
    importPlanStatus: string;
    seedCopyStatus: string;
    warnings: number;
  };
}

export function buildSupplementOnboardingReviewKit({
  generatedAt = new Date(),
  plan,
  seedDiffReport
}: {
  generatedAt?: Date;
  plan: SupplementOnboardingPlan;
  seedDiffReport: SupplementOnboardingSeedDiffReport;
}): SupplementOnboardingReviewKit {
  const seedDiffItem = seedDiffReport.items.find(
    (item) => item.interventionId === plan.interventionDraft.id
  );

  if (!seedDiffItem) {
    throw new Error(
      `Seed diff report does not contain draft ${plan.interventionDraft.id}.`
    );
  }

  const slug = plan.interventionDraft.slug;
  const importAssistantReport = buildSupplementOnboardingImportAssistantReport({
    generatedAt,
    plans: [plan],
    seedDiffReport
  });
  const files: SupplementOnboardingReviewKitFile[] = [
    {
      content: indexMarkdown({
        generatedAt,
        plan,
        seedDiffReport,
        seedDiffItem
      }),
      path: `${slug}-review-kit/00-index.md`,
      purpose:
        "Read first; summarizes boundaries, generated files, current blockers, and the next safe action.",
      title: "Review Kit Index"
    },
    {
      content: supplementOnboardingPlanToMarkdown(plan),
      path: `${slug}-review-kit/01-draft.md`,
      purpose:
        "Draft supplement packet with claim scopes, guardrails, source searches, and handoff commands.",
      title: "Supplement Draft"
    },
    {
      content: supplementOnboardingSeedDiffReportToMarkdown(seedDiffReport),
      path: `${slug}-review-kit/02-seed-diff.md`,
      purpose:
        "Copy-review seed-data diff with collision checks and draft import plan.",
      title: "Seed Diff"
    },
    {
      content: handoffCommandsMarkdown(plan, seedDiffReport),
      path: `${slug}-review-kit/03-handoff-commands.md`,
      purpose:
        "Copy-safe follow-up commands for validation, readiness, source preview, and packet review.",
      title: "Handoff Commands"
    },
    {
      content: reviewPacketShellMarkdown(plan),
      path: `${slug}-review-kit/04-review-packet-shell.md`,
      purpose:
        "Per-claim review-packet command shell for after reviewed seed/database records exist.",
      title: "Review Packet Shell"
    },
    {
      content: productStatusMarkdown(plan),
      path: `${slug}-review-kit/05-product-status.md`,
      purpose:
        "AU/TGA product-status target, evidence checklist, confidence rules, and gap assessment.",
      title: "Product Status"
    },
    {
      content: fullTextNextMarkdown(plan),
      path: `${slug}-review-kit/06-fulltext-next.md`,
      purpose:
        "Full-text source gate next step; planning only, with no source or connector approval.",
      title: "Full-Text Source Next Step"
    },
    {
      content: supplementOnboardingImportAssistantReportToMarkdown(
        importAssistantReport
      ),
      path: `${slug}-review-kit/07-import-assistant.md`,
      purpose:
        "Draft-to-seed/database import assistant with planned records and future approvals.",
      title: "Import Assistant"
    }
  ];

  return {
    files,
    generatedAt: generatedAt.toISOString(),
    humanOwned: true,
    localFileWriteOnly: true,
    nextAction: seedDiffItem.importPlan.nextAction,
    noAutoPromotion: true,
    noAutoReview: true,
    noAutoWrite: true,
    noCandidateDecision: true,
    noDatabaseWrite: true,
    noExtractionWrite: true,
    noPublicEvidenceRowsWritten: true,
    readOnly: true,
    slug,
    summary: {
      blockers: seedDiffItem.blockers.length,
      claimDrafts: plan.claimDrafts.length,
      files: files.length,
      importPlanStatus: seedDiffItem.importPlan.status,
      seedCopyStatus: seedDiffItem.importPlan.seedCopy.status,
      warnings: seedDiffItem.warnings.length
    }
  };
}

function indexMarkdown({
  generatedAt,
  plan,
  seedDiffItem,
  seedDiffReport
}: {
  generatedAt: Date;
  plan: SupplementOnboardingPlan;
  seedDiffItem: SupplementOnboardingSeedDiffReport["items"][number];
  seedDiffReport: SupplementOnboardingSeedDiffReport;
}) {
  const lines = [
    `# ${plan.interventionDraft.name} Onboarding Review Kit`,
    "",
    `Generated: ${generatedAt.toISOString()}`,
    `Read-only: true`,
    `Human-owned: true`,
    `Local file write only: true`,
    `No auto-write: true`,
    `No database write: true`,
    `No public evidence rows written: true`,
    `No candidate decision: true`,
    `No extraction write: true`,
    `No auto-review: true`,
    `No auto-promotion: true`,
    "",
    "## Summary",
    "",
    `- intervention id: \`${plan.interventionDraft.id}\``,
    `- draft claims: ${plan.claimDrafts.length}`,
    `- seed-copy status: ${seedDiffItem.importPlan.seedCopy.status}`,
    `- import-plan status: ${seedDiffItem.importPlan.status}`,
    `- database import: ${seedDiffItem.importPlan.databaseImport.status}`,
    `- seed-diff blockers: ${seedDiffItem.blockers.length}`,
    `- seed-diff warnings: ${seedDiffItem.warnings.length}`,
    "",
    "## Files",
    "",
    "- `01-draft.md`: supplement draft packet.",
    "- `02-seed-diff.md`: copy-review seed-data diff and import plan.",
    "- `03-handoff-commands.md`: copy-safe follow-up commands.",
    "- `04-review-packet-shell.md`: per-claim review-packet command shell.",
    "- `05-product-status.md`: AU/TGA product-status review notes.",
    "- `06-fulltext-next.md`: full-text source gate next step.",
    "- `07-import-assistant.md`: draft-to-seed/database import assistant.",
    "",
    "## Boundaries",
    "",
    "- This kit does not edit seed data.",
    "- This kit does not create database intervention, claim, source-candidate, reference, study, AU/TGA, or public evidence rows.",
    "- This kit does not queue sources, accept or reject candidates, extract studies, mark claim packets reviewed, approve connectors, fetch full text, or promote evidence.",
    "- Database import remains not yet enabled and requires a separate authenticated, audited implementation review.",
    "",
    "## Next Action",
    "",
    seedDiffReport.nextAction,
    ""
  ];

  return `${lines.join("\n")}\n`;
}

function handoffCommandsMarkdown(
  plan: SupplementOnboardingPlan,
  seedDiffReport: SupplementOnboardingSeedDiffReport
) {
  const lines = [
    "# Handoff Commands",
    "",
    "These commands are copy-safe planning or validation commands. Review every command before running it; none are executed by this kit.",
    "",
    "## Draft Handoff",
    "",
    ...plan.handoffCommands.map(
      (command) =>
        `- ${command.label}: \`${command.command}\` (${command.mode}; ${command.purpose})`
    ),
    "",
    "## Seed-Diff Validation",
    "",
    ...seedDiffReport.validationCommands.map((command) => `- \`${command}\``),
    "",
    "## Source Queue After Reviewed Copy",
    "",
    ...listOrNone(plan.queueAfterSeedCommands.map((command) => `- \`${command}\``)),
    ""
  ];

  return `${lines.join("\n")}\n`;
}

function reviewPacketShellMarkdown(plan: SupplementOnboardingPlan) {
  const lines = [
    "# Review Packet Shell",
    "",
    "Run these only after reviewed seed/database records and source packets exist. These commands are read-only packet previews; they do not mark claims reviewed or promote public evidence.",
    "",
    ...plan.claimDrafts.flatMap((claim) => [
      `## ${claim.id}`,
      "",
      `- outcome: ${claim.outcome}`,
      `- draft claim: ${claim.claimText}`,
      `- command: \`npm run onboarding:review-packet -- --claim-id ${claim.id}\``,
      `- summary command: \`npm run onboarding:review-packet -- --claim-id ${claim.id} --summary\``,
      ""
    ])
  ];

  return `${lines.join("\n")}\n`;
}

function productStatusMarkdown(plan: SupplementOnboardingPlan) {
  const assistant = plan.productStatusAssistant;
  const lines = [
    "# AU/TGA Product Status",
    "",
    "Product-level AU/TGA status must come from exact product-level evidence. Do not infer ARTG/AUST status from generic intervention evidence.",
    "",
    "## Target",
    "",
    `- product name: ${assistant.target.name}`,
    `- brand: ${assistant.target.brand ?? "not supplied"}`,
    `- AUST number: ${assistant.target.austNumber ?? "not supplied"}`,
    `- ARTG id: ${assistant.target.artgId ?? "not supplied"}`,
    `- sponsor: ${assistant.target.sponsor ?? "not supplied"}`,
    `- source URL: ${assistant.target.sourceUrl ?? "not supplied"}`,
    "",
    "## Evidence Checklist",
    "",
    ...assistant.evidenceChecklist.map((item) => `- ${item}`),
    "",
    "## Confidence Rules",
    "",
    ...assistant.confidenceRules.map((item) => `- ${item.confidence}: ${item.rule}`),
    "",
    "## Gap Assessment",
    "",
    ...listOrNone(assistant.gapAssessment.map((item) => `- ${item}`)),
    "",
    "## Safe Search Terms",
    "",
    ...assistant.searchTerms.map((item) => `- ${item}`),
    ""
  ];

  return `${lines.join("\n")}\n`;
}

function fullTextNextMarkdown(plan: SupplementOnboardingPlan) {
  const lines = [
    "# Full-Text Source Next Step",
    "",
    "This section is planning-only. It does not approve source terms, approve a connector, fetch full text, store raw article text, write extraction fields, accept candidates, mark claim reviews, or promote evidence.",
    "",
    "## Recommended Command",
    "",
    "- `npm run onboarding:fulltext-sources -- --next --summary`",
    "",
    "## Claim Context",
    "",
    ...plan.claimDrafts.map((claim) => `- ${claim.id}: ${claim.claimText}`),
    "",
    "## Boundary Flags",
    "",
    "- no auto approval: true",
    "- no connector approval: true",
    "- no live fetch: true",
    "- no extraction write: true",
    "- no candidate decision: true",
    "- no promotion: true",
    ""
  ];

  return `${lines.join("\n")}\n`;
}

function listOrNone(values: string[]) {
  return values.length > 0 ? values : ["- none"];
}
