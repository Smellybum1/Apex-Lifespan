import {
  buildSupplementOnboardingPlan,
  supplementOnboardingPlanToMarkdown,
  type SupplementOnboardingInput,
  type SupplementOnboardingPlan
} from "@/lib/supplement-onboarding";

export type SupplementOnboardingRehearsalStageStatus =
  | "ready"
  | "needs-review"
  | "waiting";

export interface SupplementOnboardingRehearsalStage {
  commands: string[];
  id:
    | "draft"
    | "guardrails"
    | "queue-preview"
    | "readiness-after-seed"
    | "review-packet-shell"
    | "next-action-after-seed";
  label: string;
  rationale: string[];
  status: SupplementOnboardingRehearsalStageStatus;
}

export type SupplementOnboardingRehearsalFrictionStatus =
  | "blocked"
  | "needs-review"
  | "ready";

export interface SupplementOnboardingRehearsalFrictionItem {
  id:
    | "claim-scope"
    | "guardrails"
    | "product-status"
    | "safety-watchlist"
    | "source-search-setup"
    | "full-text-gate";
  impact: number;
  label: string;
  nextAction: string;
  rationale: string;
  status: SupplementOnboardingRehearsalFrictionStatus;
}

export interface SupplementOnboardingRehearsalFrictionAssessment {
  items: SupplementOnboardingRehearsalFrictionItem[];
  maxScore: 100;
  readyItems: number;
  score: number;
  tier: "blocked" | "high" | "low" | "moderate";
}

export interface SupplementOnboardingRehearsalReport {
  boundaries: string[];
  friction: SupplementOnboardingRehearsalFrictionAssessment;
  generatedAt: string;
  humanOwned: true;
  nextAction: string;
  noAutoPromotion: true;
  noAutoReview: true;
  noAutoWrite: true;
  plan: SupplementOnboardingPlan;
  planMarkdown: string;
  readOnly: true;
  stages: SupplementOnboardingRehearsalStage[];
  summary: {
    blockingReviewItems: number;
    claimDrafts: number;
    guardrailWarnings: number;
    queueCommands: number;
    sourceQueries: number;
    stagesNeedingReview: number;
    watchlistSignals: number;
  };
}

export interface SupplementOnboardingRehearsalSummary {
  boundaries: string[];
  friction: SupplementOnboardingRehearsalFrictionAssessment;
  generatedAt: string;
  humanOwned: true;
  nextAction: string;
  noAutoPromotion: true;
  noAutoReview: true;
  noAutoWrite: true;
  readOnly: true;
  stages: Array<{
    commands: string[];
    id: SupplementOnboardingRehearsalStage["id"];
    label: string;
    status: SupplementOnboardingRehearsalStageStatus;
  }>;
  supplement: {
    category?: string;
    claimDrafts: string[];
    id: string;
    name: string;
    slug: string;
  };
  summary: SupplementOnboardingRehearsalReport["summary"];
}

export function buildSupplementOnboardingRehearsalReport(
  input: SupplementOnboardingInput
): SupplementOnboardingRehearsalReport {
  const plan = buildSupplementOnboardingPlan(input);
  const stages = rehearsalStages(plan);
  const friction = rehearsalFriction(plan);
  const summary = {
    blockingReviewItems: plan.blockingReviewItems.length,
    claimDrafts: plan.claimDrafts.length,
    guardrailWarnings: plan.guardrailWarnings.length,
    queueCommands: plan.queueAfterSeedCommands.length,
    sourceQueries: plan.sourceQueries.length,
    stagesNeedingReview: stages.filter((stage) => stage.status === "needs-review")
      .length,
    watchlistSignals: plan.safetyWatchlist.signals.length
  };

  return {
    boundaries: [
      "Read-only local rehearsal; no seed, database, source-candidate, review, extraction, or public evidence writes are performed.",
      "Queue commands are preview-only until rerun separately with an explicit write/apply path after reviewed seed or database records exist.",
      "Candidate review, claim linking, structured extraction, claim-packet review, and promotion remain separate operator-owned steps.",
      "No full-text capture, source-term approval, individualized medical advice, dosing guidance, or peptide sourcing/self-use guidance is generated."
    ],
    friction,
    generatedAt: plan.generatedAt,
    humanOwned: true,
    nextAction:
      plan.blockingReviewItems[0] ??
      plan.guardrailWarnings[0] ??
      "Review the draft packet, then add reviewed intervention and claim records before queueing sources.",
    noAutoPromotion: true,
    noAutoReview: true,
    noAutoWrite: true,
    plan,
    planMarkdown: supplementOnboardingPlanToMarkdown(plan),
    readOnly: true,
    stages,
    summary
  };
}

export function summarizeSupplementOnboardingRehearsalReport(
  report: SupplementOnboardingRehearsalReport
): SupplementOnboardingRehearsalSummary {
  return {
    boundaries: report.boundaries,
    friction: report.friction,
    generatedAt: report.generatedAt,
    humanOwned: true,
    nextAction: report.nextAction,
    noAutoPromotion: true,
    noAutoReview: true,
    noAutoWrite: true,
    readOnly: true,
    stages: report.stages.map((stage) => ({
      commands: stage.commands,
      id: stage.id,
      label: stage.label,
      status: stage.status
    })),
    supplement: {
      category: report.plan.interventionDraft.category,
      claimDrafts: report.plan.claimDrafts.map((claim) => claim.id),
      id: report.plan.interventionDraft.id,
      name: report.plan.interventionDraft.name,
      slug: report.plan.interventionDraft.slug
    },
    summary: report.summary
  };
}

export function supplementOnboardingRehearsalToMarkdown(
  report: SupplementOnboardingRehearsalReport
): string {
  return [
    `# Supplement Onboarding Rehearsal: ${report.plan.interventionDraft.name}`,
    "",
    `Generated: ${report.generatedAt}`,
    `Read-only: ${String(report.readOnly)}`,
    "",
    "## Summary",
    "",
    `- draft claims: ${report.summary.claimDrafts}`,
    `- source queries: ${report.summary.sourceQueries}`,
    `- queue commands: ${report.summary.queueCommands}`,
    `- blocking review items: ${report.summary.blockingReviewItems}`,
    `- guardrail warnings: ${report.summary.guardrailWarnings}`,
    `- watchlist signals: ${report.summary.watchlistSignals}`,
    `- friction score: ${report.friction.score}/${report.friction.maxScore} (${report.friction.tier})`,
    "",
    "## Friction Assessment",
    "",
    ...report.friction.items.map(
      (item) =>
        `- ${item.label}: ${item.status} (${item.impact} impact). ${item.rationale} Next: ${item.nextAction}`
    ),
    "",
    "## Boundaries",
    "",
    ...report.boundaries.map((boundary) => `- ${boundary}`),
    "",
    "## Rehearsal Stages",
    "",
    ...report.stages.flatMap((stage) => [
      `### ${stage.label}`,
      "",
      `Status: ${stage.status}`,
      "",
      "Rationale:",
      ...stage.rationale.map((item) => `- ${item}`),
      "",
      "Commands:",
      ...(stage.commands.length > 0
        ? stage.commands.map((command) => `- \`${command}\``)
        : ["- none"]),
      ""
    ]),
    "## Draft Packet",
    "",
    report.planMarkdown
  ].join("\n");
}

function rehearsalFriction(
  plan: SupplementOnboardingPlan
): SupplementOnboardingRehearsalFrictionAssessment {
  const blockedSafetySignals = plan.safetyWatchlist.signals.filter(
    (signal) => signal.severity === "blocked"
  ).length;
  const warningSafetySignals = plan.safetyWatchlist.signals.filter(
    (signal) => signal.severity === "warning"
  ).length;
  const items: SupplementOnboardingRehearsalFrictionItem[] = [
    {
      id: "claim-scope",
      impact: 25,
      label: "Claim scope",
      nextAction:
        plan.claimDrafts.length > 0
          ? "Review generated claim wording before source queueing."
          : "Add at least one claim template or custom claim before onboarding.",
      rationale:
        plan.claimDrafts.length > 0
          ? `${plan.claimDrafts.length} draft claim(s) are available.`
          : "No claim scope exists, so source queueing and packet review cannot be targeted.",
      status: plan.claimDrafts.length > 0 ? "ready" : "blocked"
    },
    {
      id: "guardrails",
      impact: 20,
      label: "Guardrails",
      nextAction:
        plan.blockingReviewItems.length > 0 || plan.guardrailWarnings.length > 0
          ? "Review blocker and warning text before seed copy or public wording."
          : "Continue to seed-diff review.",
      rationale: `${plan.blockingReviewItems.length} blocking review item(s) and ${plan.guardrailWarnings.length} warning(s) are present.`,
      status:
        plan.blockingReviewItems.length > 0 || plan.guardrailWarnings.length > 0
          ? "needs-review"
          : "ready"
    },
    {
      id: "safety-watchlist",
      impact: 20,
      label: "Safety/watchlist",
      nextAction:
        blockedSafetySignals > 0
          ? "Resolve blocked safety/watchlist signals before public wording or seed copy."
          : warningSafetySignals > 0
            ? "Review warning safety/watchlist signals and keep caveats visible."
            : "Continue with ordinary safety packet review.",
      rationale: `${blockedSafetySignals} blocked and ${warningSafetySignals} warning safety/watchlist signal(s) were found.`,
      status:
        blockedSafetySignals > 0
          ? "blocked"
          : warningSafetySignals > 0
            ? "needs-review"
            : "ready"
    },
    {
      id: "product-status",
      impact: 15,
      label: "AU/TGA product status",
      nextAction:
        plan.productStatusAssistant.gapAssessment.length > 0
          ? "Capture exact product-level AU/TGA evidence or keep status Unknown."
          : "Review exact product-level evidence before assigning confidence.",
      rationale: `${plan.productStatusAssistant.gapAssessment.length} product-status gap(s) remain.`,
      status:
        plan.productStatusAssistant.gapAssessment.length > 0 ? "needs-review" : "ready"
    },
    {
      id: "source-search-setup",
      impact: 15,
      label: "Source-search setup",
      nextAction:
        plan.sourceQueries.length > 0 && plan.queueAfterSeedCommands.length > 0
          ? "Run queue preview only after reviewed seed/database records exist."
          : "Add claim scopes so source queries and queue commands can be generated.",
      rationale: `${plan.sourceQueries.length} source query item(s) and ${plan.queueAfterSeedCommands.length} queue command(s) are available.`,
      status:
        plan.sourceQueries.length > 0 && plan.queueAfterSeedCommands.length > 0
          ? "ready"
          : "blocked"
    },
    {
      id: "full-text-gate",
      impact: 5,
      label: "Full-text source gate",
      nextAction:
        "Use the full-text source next-step planner before any connector or live-fetch work.",
      rationale:
        "Full-text capture remains a separate source-terms, fixture, connector, retention, and public-export review path.",
      status: "needs-review"
    }
  ];
  const score = items.reduce((total, item) => total + frictionPenalty(item), 0);

  return {
    items,
    maxScore: 100,
    readyItems: items.filter((item) => item.status === "ready").length,
    score,
    tier: items.some((item) => item.status === "blocked")
      ? "blocked"
      : score >= 60
        ? "high"
        : score >= 30
          ? "moderate"
          : "low"
  };
}

function frictionPenalty(item: SupplementOnboardingRehearsalFrictionItem) {
  if (item.status === "blocked") {
    return item.impact;
  }

  if (item.status === "needs-review") {
    return Math.ceil(item.impact / 2);
  }

  return 0;
}

function rehearsalStages(
  plan: SupplementOnboardingPlan
): SupplementOnboardingRehearsalStage[] {
  const slug = plan.interventionDraft.slug;

  return [
    {
      commands: [
        `npm run onboard:supplement -- --name ${quote(plan.interventionDraft.name)}${plan.interventionDraft.category ? ` --category ${quote(plan.interventionDraft.category)}` : ""} --json`
      ],
      id: "draft",
      label: "Draft supplement packet",
      rationale: [
        `${plan.claimDrafts.length} draft claim(s) and ${plan.sourceQueries.length} source query item(s) are generated.`,
        "This stage is local-only and does not add seed or database rows."
      ],
      status: plan.claimDrafts.length > 0 ? "ready" : "needs-review"
    },
    {
      commands: [],
      id: "guardrails",
      label: "Review blockers and guardrails",
      rationale: [
        `${plan.blockingReviewItems.length} blocking review item(s).`,
        `${plan.guardrailWarnings.length} guardrail warning(s).`,
        `${plan.safetyWatchlist.signals.length} safety/watchlist signal(s).`
      ],
      status:
        plan.blockingReviewItems.length > 0 ||
        plan.safetyWatchlist.signals.some((signal) => signal.severity === "blocked")
          ? "needs-review"
          : "ready"
    },
    {
      commands: plan.queueAfterSeedCommands,
      id: "queue-preview",
      label: "Preview claim-scoped source queueing",
      rationale: [
        "These commands should be run only after reviewed intervention and claim records exist.",
        "They queue source discovery only; they do not ingest, accept, extract, review, or promote evidence."
      ],
      status: "waiting"
    },
    {
      commands: [
        `npm run onboarding:readiness -- --supplement ${quote(slug)} --summary`,
        "npm run onboarding:quality -- --summary"
      ],
      id: "readiness-after-seed",
      label: "Run readiness after reviewed seed/database addition",
      rationale: [
        "Readiness checks intervention presence, claim scopes, source tracking, candidates, packets, and review state.",
        "Use --env-file for database-backed Preview/local environments."
      ],
      status: "waiting"
    },
    {
      commands: [`npm run onboarding:review-packet -- --supplement ${quote(slug)}`],
      id: "review-packet-shell",
      label: "Build review packet shell",
      rationale: [
        "The packet becomes meaningful once references, extractions, and source candidates exist.",
        "Generated packet wording stays review-required and does not publish public evidence."
      ],
      status: "waiting"
    },
    {
      commands: [`npm run onboarding:next -- --supplement ${quote(slug)} --summary`],
      id: "next-action-after-seed",
      label: "Ask for the next safest command",
      rationale: [
        "This routes the supplement to queueing, ingestion dry-run, candidate review, extraction, packet review, or promotion readiness.",
        "It remains read-only and does not add apply/write flags."
      ],
      status: "waiting"
    }
  ];
}

function quote(value: string) {
  return `"${value.replace(/"/g, '\\"')}"`;
}
