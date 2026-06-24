import type { ScheduledIngestionDryRunSummary } from "@/lib/data/scheduled-ingestion";

export type EvidenceGapLeadPlanGateStatus = "blocked" | "ready" | "unverified" | "warning";

export interface EvidenceGapLeadPlanSourceDiscoveryPlan {
  rows: EvidenceGapLeadPlanSourceDiscoveryRow[];
}

export interface EvidenceGapLeadPlanSourceDiscoveryRow {
  claimId: string;
  interventionId: string;
  interventionName: string;
  lookupLinks: Array<{
    query: string;
    readOnly: true;
    source: "ClinicalTrials.gov" | "PubMed";
  }>;
  operatorQueueCommand: string;
  outcome: string;
  priority: number;
  region: "AU";
}

export interface EvidenceGapLeadFetchJob {
  claimId: string;
  command: string;
  interventionId: string;
  mode: "explicit-write-after-approval" | "read-only";
  query: string;
  region: "AU";
  source: "ClinicalTrials.gov" | "PubMed";
}

export interface EvidenceGapLeadPlanRow {
  claimId: string;
  interventionId: string;
  interventionName: string;
  outcome: string;
  priority: number;
  proposedJobs: EvidenceGapLeadFetchJob[];
  queueCommand: string;
  region: "AU";
}

export interface EvidenceGapLeadPlanGate {
  detail: string;
  id: string;
  label: string;
  nextAction?: string;
  status: EvidenceGapLeadPlanGateStatus;
}

export interface EvidenceGapLeadPlanCollectionHandoffPacket {
  actionLabel: string;
  claimCount: number;
  commandCount: number;
  copySafe: true;
  dryRun: true;
  format: "markdown";
  gateSummary: string;
  mode: "gap-lead-collection-dry-run";
  nextAction: string;
  noAutomaticCandidateDecision: true;
  noAutomaticExtractionWrite: true;
  noAutomaticIngestionRun: true;
  noAutomaticPromotion: true;
  noDatabaseWrite: true;
  noPublicEvidenceRowsWritten: true;
  noQueueWrite: true;
  queueCommands: string[];
  readOnly: true;
  requiredApprovals: string[];
  schedulerEvidence: "not-loaded" | "scheduled-ingestion-summary";
  selectionSummary: string;
  text: string;
  title: string;
  writes: "none";
}

export interface EvidenceGapLeadPlan {
  collectionHandoffPacket: EvidenceGapLeadPlanCollectionHandoffPacket;
  commands: EvidenceGapLeadPlanCommand[];
  dryRun: true;
  gates: EvidenceGapLeadPlanGate[];
  humanOwned: true;
  nextAction: string;
  noAutomaticCandidateDecision: true;
  noAutomaticExtractionWrite: true;
  noAutomaticIngestionRun: true;
  noAutomaticPromotion: true;
  noAutomaticQueueWrite: true;
  noPublicEvidenceRowsWritten: true;
  readOnly: true;
  rows: EvidenceGapLeadPlanRow[];
  scheduler: {
    gateEvidence: "not-loaded" | "scheduled-ingestion-summary";
    hostedCronReady: boolean;
    hostedRunGateReady: boolean;
    noAutoPromotion: true;
    queuedJobs?: number;
    retryAutomationReady: boolean;
    wouldRunJobs?: number;
  };
  selectionSummary: string;
  summary: {
    blockedGates: number;
    clinicalTrialsJobs: number;
    proposedClaims: number;
    proposedJobs: number;
    pubMedJobs: number;
    warningGates: number;
  };
}

export interface EvidenceGapLeadPlanCommand {
  command: string;
  id: string;
  label: string;
  mode: "dry-run" | "explicit-write-after-approval" | "read-only";
  purpose: string;
}

export interface BuildEvidenceGapLeadPlanOptions {
  maxClaims?: number;
  scheduledIngestion?: ScheduledIngestionDryRunSummary;
  sourceDiscoveryPlan: EvidenceGapLeadPlanSourceDiscoveryPlan;
}

const DEFAULT_GAP_LEAD_CLAIMS = 3;
const MAX_GAP_LEAD_CLAIMS = 5;

export function buildEvidenceGapLeadPlan({
  maxClaims = DEFAULT_GAP_LEAD_CLAIMS,
  scheduledIngestion,
  sourceDiscoveryPlan
}: BuildEvidenceGapLeadPlanOptions): EvidenceGapLeadPlan {
  const rows = selectEvidenceGapLeadRows(
    sourceDiscoveryPlan.rows,
    normaliseMaxClaims(maxClaims)
  ).map(evidenceGapLeadPlanRow);
  const gates = evidenceGapLeadPlanGates({ rows, scheduledIngestion });
  const blockedGates = gates.filter((gate) => gate.status === "blocked").length;
  const warningGates = gates.filter((gate) => gate.status === "warning").length;
  const proposedJobs = rows.flatMap((row) => row.proposedJobs);
  const pubMedJobs = proposedJobs.filter((job) => job.source === "PubMed").length;
  const clinicalTrialsJobs = proposedJobs.filter(
    (job) => job.source === "ClinicalTrials.gov"
  ).length;
  const commands = evidenceGapLeadPlanCommands(rows);
  const scheduler = {
    gateEvidence: scheduledIngestion
      ? ("scheduled-ingestion-summary" as const)
      : ("not-loaded" as const),
    hostedCronReady: scheduledIngestion?.hostedCronReady ?? false,
    hostedRunGateReady: scheduledIngestion?.hostedRunGateReady ?? false,
    noAutoPromotion: true as const,
    queuedJobs: scheduledIngestion?.counts.queuedJobs,
    retryAutomationReady: scheduledIngestion?.retryAutomationReady ?? false,
    wouldRunJobs: scheduledIngestion?.counts.wouldRunJobs
  };
  const selectionSummary = evidenceGapLeadSelectionSummary(rows);
  const nextAction =
    gates.find((gate) => gate.status === "blocked")?.nextAction ??
    gates.find((gate) => gate.status === "warning")?.nextAction ??
    (rows.length > 0
      ? "Review the proposed gap-to-lead batch, then explicitly approve queueing before any candidate-writing ingestion run."
      : "No source-discovery gaps are available for gap-to-lead planning.");

  return {
    collectionHandoffPacket: evidenceGapLeadPlanCollectionHandoffPacket({
      commands,
      gates,
      nextAction,
      rows,
      scheduler,
      selectionSummary
    }),
    commands,
    dryRun: true,
    gates,
    humanOwned: true,
    nextAction,
    noAutomaticCandidateDecision: true,
    noAutomaticExtractionWrite: true,
    noAutomaticIngestionRun: true,
    noAutomaticPromotion: true,
    noAutomaticQueueWrite: true,
    noPublicEvidenceRowsWritten: true,
    readOnly: true,
    rows,
    scheduler,
    selectionSummary,
    summary: {
      blockedGates,
      clinicalTrialsJobs,
      proposedClaims: rows.length,
      proposedJobs: proposedJobs.length,
      pubMedJobs,
      warningGates
    }
  };
}

function selectEvidenceGapLeadRows(
  rows: EvidenceGapLeadPlanSourceDiscoveryRow[],
  maxClaims: number
) {
  return rows
    .map((row, index) => ({ index, row }))
    .sort((left, right) => {
      const priorityDelta = right.row.priority - left.row.priority;

      return priorityDelta === 0 ? left.index - right.index : priorityDelta;
    })
    .slice(0, maxClaims)
    .map(({ row }) => row);
}

function evidenceGapLeadPlanRow(
  row: EvidenceGapLeadPlanSourceDiscoveryRow
): EvidenceGapLeadPlanRow {
  const proposedJobs = row.lookupLinks.map((link): EvidenceGapLeadFetchJob => ({
    claimId: row.claimId,
    command: row.operatorQueueCommand,
    interventionId: row.interventionId,
    mode: "explicit-write-after-approval",
    query: link.query,
    region: row.region,
    source: link.source
  }));

  return {
    claimId: row.claimId,
    interventionId: row.interventionId,
    interventionName: row.interventionName,
    outcome: row.outcome,
    priority: row.priority,
    proposedJobs,
    queueCommand: row.operatorQueueCommand,
    region: row.region
  };
}

function evidenceGapLeadPlanGates({
  rows,
  scheduledIngestion
}: {
  rows: EvidenceGapLeadPlanRow[];
  scheduledIngestion?: ScheduledIngestionDryRunSummary;
}): EvidenceGapLeadPlanGate[] {
  const gates: EvidenceGapLeadPlanGate[] = [
    {
      detail:
        rows.length > 0
          ? `${rows.length} claim gap(s) are selected for a dry-run lead-fetch plan.`
          : "No claim gaps are selected.",
      id: "claim-gaps",
      label: "Claim gaps selected",
      status: rows.length > 0 ? "ready" : "warning",
      nextAction:
        rows.length > 0
          ? undefined
          : "Refresh evidence coverage and source-discovery planning before queueing leads."
    },
    {
      detail:
        "Queueing source-candidate jobs writes local candidate lead records and must stay operator-approved.",
      id: "explicit-queue-approval",
      label: "Explicit queue approval",
      nextAction:
        "Ask an operator to approve a bounded source-lead collection run before any candidate-writing queue action.",
      status: "blocked"
    },
    {
      detail:
        "Candidate decisions, extraction writes, claim review, scoring, and public promotion remain outside this plan.",
      id: "no-auto-truth",
      label: "No automatic evidence truth",
      status: "ready"
    }
  ];

  if (!scheduledIngestion) {
    return [
      ...gates,
      {
        detail:
          "Scheduled ingestion dry-run evidence was not loaded into this packet, so NCBI metadata, hosted cron, retry policy, and duplicate-source review are unverified here.",
        id: "scheduled-ingestion-evidence",
        label: "Scheduled ingestion gate evidence",
        nextAction: "Run `npm run ingest:scheduled-dry-run -- --summary` before enabling any unattended lead fetching.",
        status: "blocked"
      }
    ];
  }

  return [
    ...gates,
    {
      detail: scheduledIngestion.hostedCronReady
        ? "Hosted cron evidence is ready in the scheduled-ingestion summary."
        : "Hosted cron evidence is not ready in the scheduled-ingestion summary.",
      id: "hosted-cron",
      label: "Hosted cron evidence",
      nextAction: scheduledIngestion.hostedCronReady
        ? undefined
        : "Review scheduled-ingestion blocked checks before any hosted lead-fetch loop.",
      status: scheduledIngestion.hostedCronReady ? "ready" : "blocked"
    },
    {
      detail: scheduledIngestion.hostedRunGateReady
        ? "Hosted-run gate is ready in the scheduled-ingestion summary."
        : "Hosted-run gate is not ready in the scheduled-ingestion summary.",
      id: "hosted-run-gate",
      label: "Hosted-run gate",
      status: scheduledIngestion.hostedRunGateReady ? "ready" : "blocked"
    },
    {
      detail: scheduledIngestion.retryAutomationReady
        ? "Retry automation evidence is ready in the scheduled-ingestion summary."
        : "Retry automation is not ready; failed jobs remain manual-review only.",
      id: "retry-policy",
      label: "Retry policy",
      nextAction: scheduledIngestion.retryAutomationReady
        ? undefined
        : "Review retry-policy evidence before unattended lead fetching.",
      status: scheduledIngestion.retryAutomationReady ? "ready" : "blocked"
    },
    {
      detail:
        scheduledIngestion.counts.duplicateIdentityGroups > 0
          ? `${scheduledIngestion.counts.duplicateIdentityGroups} duplicate source identity group(s) need review.`
          : "No duplicate source identity groups are reported in the scheduled-ingestion summary.",
      id: "duplicate-source-review",
      label: "Duplicate source review",
      nextAction:
        scheduledIngestion.counts.duplicateIdentityGroups > 0
          ? "Review duplicate source identities before unattended scheduled ingestion."
          : undefined,
      status:
        scheduledIngestion.counts.duplicateIdentityGroups > 0 ? "warning" : "ready"
    }
  ];
}

function evidenceGapLeadPlanCommands(
  rows: EvidenceGapLeadPlanRow[]
): EvidenceGapLeadPlanCommand[] {
  return [
    {
      command: "npm run ingest:scheduled-dry-run -- --summary",
      id: "scheduled-ingestion-summary",
      label: "Refresh scheduled ingestion gates",
      mode: "dry-run",
      purpose:
        "Check source metadata, hosted-run gates, retry policy, queue state, duplicate identities, and no-auto-promotion controls without running writes."
    },
    {
      command: "npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 10",
      id: "candidate-review-overview",
      label: "Inspect candidate review overview",
      mode: "read-only",
      purpose:
        "Review pending candidate groups before queueing more source leads."
    },
    ...rows.map((row): EvidenceGapLeadPlanCommand => ({
      command: row.queueCommand,
      id: `queue-${row.claimId}`,
      label: `Queue source leads for ${row.claimId}`,
      mode: "explicit-write-after-approval",
      purpose:
        "Creates source-candidate ingestion jobs only after operator approval; it does not accept/reject candidates, extract studies, review claims, or promote public evidence."
    }))
  ];
}

function evidenceGapLeadPlanCollectionHandoffPacket({
  commands,
  gates,
  nextAction,
  rows,
  scheduler,
  selectionSummary
}: {
  commands: EvidenceGapLeadPlanCommand[];
  gates: EvidenceGapLeadPlanGate[];
  nextAction: string;
  rows: EvidenceGapLeadPlanRow[];
  scheduler: EvidenceGapLeadPlan["scheduler"];
  selectionSummary: string;
}): EvidenceGapLeadPlanCollectionHandoffPacket {
  const queueCommands = commands
    .filter((command) => command.mode === "explicit-write-after-approval")
    .map((command) => command.command);
  const reviewCommands = commands.filter(
    (command) => command.mode !== "explicit-write-after-approval"
  );
  const requiredApprovals = [
    "explicit operator approval before queueing source-candidate jobs",
    "source/run gate evidence reviewed",
    "candidate decisions remain separate",
    "no extraction, claim review, scoring, changelog, or public evidence write"
  ];
  const gateSummary = [
    `${gates.filter((gate) => gate.status === "blocked").length} blocked`,
    `${gates.filter((gate) => gate.status === "warning").length} warning`,
    `${gates.filter((gate) => gate.status === "ready").length} ready`,
    "writes none"
  ].join("; ");
  const proposedJobs = rows.flatMap((row) => row.proposedJobs);
  const text = [
    "# Gap-to-Lead Collection Dry-Run Handoff",
    "",
    "- Copy safe: yes",
    "- Persistence: none",
    "- Secrets included: no",
    "- Local paths included: no",
    "- Writes: none",
    "- Database write: no",
    "- Queue write: no",
    "- Candidate decision write: no",
    "- Extraction write: no",
    "- Claim review write: no",
    "- Score/changelog/public evidence write: no",
    "",
    "## Batch",
    `- Claims selected: ${rows.length}`,
    `- Proposed jobs: ${proposedJobs.length}`,
    `- Selection: ${selectionSummary}`,
    `- Scheduler evidence: ${scheduler.gateEvidence}`,
    `- Check summary: ${gateSummary}`,
    `- Next action: ${nextAction}`,
    "",
    "## Required Approvals",
    ...requiredApprovals.map((approval) => `- ${approval}`),
    "",
    "## Readiness Checks",
    ...linesOrFallback(
      gates.map((gate) =>
        [
          `- ${gate.id}`,
          gate.status,
          gate.detail,
          gate.nextAction ? `next ${gate.nextAction}` : ""
        ].join("; ")
      ),
      "- No readiness checks are loaded."
    ),
    "",
    "## Review Commands",
    ...linesOrFallback(
      reviewCommands.map((command) =>
        `- ${command.label}: ${command.command} (${command.mode})`
      ),
      "- No review commands are loaded."
    ),
    "",
    "## Queue Commands Requiring Explicit Approval",
    ...linesOrFallback(
      rows.map((row) =>
        [
          `- ${row.claimId}`,
          `${row.interventionName} / ${row.outcome}`,
          `${row.proposedJobs.length} proposed job(s)`,
          row.queueCommand
        ].join("; ")
      ),
      "- No queue commands are loaded."
    ),
    "",
    "## Guardrails",
    "- This handoff is for reviewer/operator orientation only.",
    "- Queue commands may create source-candidate leads only after explicit operator approval.",
    "- Do not accept/reject candidates, write extraction rows, change claim review status, create score snapshots/history, publish changelog entries, or promote public evidence from this handoff."
  ].join("\n");

  return {
    actionLabel: "Copy gap-to-lead collection handoff",
    claimCount: rows.length,
    commandCount: commands.length,
    copySafe: true,
    dryRun: true,
    format: "markdown",
    gateSummary,
    mode: "gap-lead-collection-dry-run",
    nextAction,
    noAutomaticCandidateDecision: true,
    noAutomaticExtractionWrite: true,
    noAutomaticIngestionRun: true,
    noAutomaticPromotion: true,
    noDatabaseWrite: true,
    noPublicEvidenceRowsWritten: true,
    noQueueWrite: true,
    queueCommands,
    readOnly: true,
    requiredApprovals,
    schedulerEvidence: scheduler.gateEvidence,
    selectionSummary,
    text,
    title: "Gap-to-Lead Collection Dry-Run Handoff",
    writes: "none"
  };
}

function evidenceGapLeadSelectionSummary(rows: EvidenceGapLeadPlanRow[]) {
  return rows.length > 0
    ? `selected ${rows.length} highest-priority gap(s): ${rows
        .map((row) => `${row.claimId} priority ${row.priority}`)
        .join(" | ")}; writes none`
    : "No source-discovery gaps selected for lead-fetch planning; writes none";
}

function linesOrFallback(lines: string[], fallback: string) {
  return lines.length > 0 ? lines : [fallback];
}

function normaliseMaxClaims(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_GAP_LEAD_CLAIMS;
  }

  return Math.min(MAX_GAP_LEAD_CLAIMS, Math.max(1, Math.trunc(value)));
}
