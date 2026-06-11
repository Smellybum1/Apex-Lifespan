import { IngestionStatus } from "@prisma/client";

import {
  listSourceCandidateIngestionJobs,
  runNextSourceCandidateIngestionJob,
  type SourceCandidateIngestionJobOptions,
  type SourceCandidateIngestionJobListItem,
  type SourceCandidateIngestionJobRunResult,
  summarizeSourceCandidateIngestionJobs
} from "@/lib/data/source-candidate-jobs";
import {
  listSourceCandidateIdentityGroups,
  type SourceCandidateIdentityGroup
} from "@/lib/data/source-candidates";

export interface ScheduledIngestionDryRunOptions {
  env?: Record<string, string | undefined>;
  maxJobsPerRun?: number;
}

export interface ScheduledIngestionBatchOptions extends ScheduledIngestionDryRunOptions {
  apply?: boolean;
  runNextJob?: ScheduledIngestionJobRunner;
}

export interface ScheduledIngestionDryRun {
  dedupeReview: ScheduledIngestionDedupeReview;
  dryRun: true;
  failureReview: ScheduledIngestionFailureReview;
  maxJobsPerRun: number;
  nextAction: string;
  noAutoPromotion: true;
  policy: ScheduledIngestionPolicyReview;
  queuedJobs: number;
  recentFailures: number;
  runningJobs: number;
  worksheet: ScheduledIngestionWorksheet;
  wouldRunJobs: number;
}

export interface ScheduledIngestionBatchResult {
  applied: boolean;
  automaticRetries: false;
  blocked: boolean;
  blocker?: string;
  dryRun: boolean;
  executedJobs: SourceCandidateIngestionJobRunResult[];
  maxJobsPerRun: number;
  nextAction: string;
  noAutoPromotion: true;
  plan: ScheduledIngestionDryRun;
}

export interface ScheduledIngestionPolicyReview {
  automaticRetries: false;
  clinicalTrialsPageSizeCap: number;
  hostedCron: ScheduledIngestionHostedCronReview;
  hostedCronReady: boolean;
  missingMetadata: string[];
  ncbiMetadataConfigured: boolean;
  noAutoPromotion: true;
  pubMedRetmaxCap: number;
  schedulerDefaultJobsPerRun: number;
  schedulerMaxJobsPerRun: number;
  sourcePolicy: "review-before-enable";
}

export interface ScheduledIngestionHostedCronReview {
  approvalConfigured: boolean;
  databaseModeConfigured: boolean;
  ingestionAlertsConfigured: boolean;
  managedDatabaseUrlConfigured: boolean;
  missingEnv: string[];
  ready: boolean;
  scheduledWritesEnabled: boolean;
}

export interface ScheduledIngestionFailureReview {
  automaticRetries: false;
  failedJobsReviewed: number;
  items: ScheduledIngestionFailureReviewItem[];
  nextAction: string;
  retryAutomationReady: false;
}

export interface ScheduledIngestionFailureReviewItem {
  category: ScheduledIngestionFailureCategory;
  jobId: string;
  nextAction: string;
  region: string;
  retryDisposition: ScheduledIngestionRetryDisposition;
  source: SourceCandidateIngestionJobListItem["source"];
}

export interface ScheduledIngestionDedupeReview {
  duplicateIdentityGroups: number;
  items: ScheduledIngestionDedupeReviewItem[];
  nextAction: string;
}

export interface ScheduledIngestionDedupeReviewItem {
  acceptedCandidates: number;
  candidateCount: number;
  externalId: string;
  mixedDecision: boolean;
  nextAction: string;
  pendingCandidates: number;
  rejectedCandidates: number;
  reviewCommand: string;
  source: SourceCandidateIdentityGroup["source"];
}

export interface ScheduledIngestionWorksheet {
  blocked: ScheduledIngestionWorksheetItem[];
  humanOwned: true;
  nextOperatorAction: string;
  queuedWork: ScheduledIngestionWorksheetItem[];
  ready: ScheduledIngestionWorksheetItem[];
  warnings: ScheduledIngestionWorksheetItem[];
}

export interface ScheduledIngestionWorksheetItem {
  detail: string;
  evidenceKeys?: string[];
  id: string;
  label: string;
  nextAction?: string;
}

export type ScheduledIngestionFailureCategory =
  | "missing-configuration"
  | "rate-limited"
  | "unsupported-source"
  | "upstream-unavailable"
  | "unknown";

export type ScheduledIngestionRetryDisposition =
  | "do-not-retry-unsupported-source"
  | "fix-configuration-first"
  | "review-error-before-retry"
  | "wait-for-upstream-and-review";

export type ScheduledIngestionJobRunner = (
  options: SourceCandidateIngestionJobOptions
) => Promise<SourceCandidateIngestionJobRunResult | null>;

const DEFAULT_MAX_JOBS_PER_RUN = 1;
const MAX_SCHEDULER_JOBS_PER_RUN = 5;
const MAX_DEDUPE_REVIEW_GROUPS = 5;
const SOURCE_RESULT_CAP = 20;
const REQUIRED_NCBI_METADATA_ENV = ["NCBI_TOOL", "NCBI_EMAIL"] as const;
const SCHEDULED_INGESTION_WRITES_ENV = "APEX_SCHEDULED_INGESTION_WRITES_ENABLED";
const SCHEDULED_INGESTION_CRON_APPROVAL_ENV = "APEX_SCHEDULED_INGESTION_CRON_APPROVED";
const INGESTION_ALERTS_ENV = "APEX_INGESTION_ALERTS_CONFIGURED";
const LOCAL_DATABASE_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

export async function planScheduledSourceIngestionDryRun(
  options: ScheduledIngestionDryRunOptions = {}
): Promise<ScheduledIngestionDryRun> {
  const maxJobsPerRun = normaliseMaxJobsPerRun(options.maxJobsPerRun);
  const [summary, runningJobs, queuedJobs, failedJobs, duplicateIdentityGroups] = await Promise.all([
    summarizeSourceCandidateIngestionJobs(),
    listSourceCandidateIngestionJobs({
      limit: MAX_SCHEDULER_JOBS_PER_RUN,
      status: IngestionStatus.RUNNING
    }),
    listSourceCandidateIngestionJobs({
      limit: MAX_SCHEDULER_JOBS_PER_RUN,
      status: IngestionStatus.QUEUED
    }),
    listSourceCandidateIngestionJobs({
      limit: MAX_SCHEDULER_JOBS_PER_RUN,
      status: IngestionStatus.FAILED
    }),
    listSourceCandidateIdentityGroups({
      limit: MAX_DEDUPE_REVIEW_GROUPS
    })
  ]);
  const queuedCount = summary.groups
    .filter((group) => group.status === IngestionStatus.QUEUED)
    .reduce((total, group) => total + group.count, 0);
  const runningCount = summary.groups
    .filter((group) => group.status === IngestionStatus.RUNNING)
    .reduce((total, group) => total + group.count, 0);
  const failedCount = summary.groups
    .filter((group) => group.status === IngestionStatus.FAILED)
    .reduce((total, group) => total + group.count, 0);
  const wouldRunJobs = runningJobs.length > 0 ? 0 : Math.min(maxJobsPerRun, queuedJobs.length);
  const failureReview = scheduledIngestionFailureReview(failedJobs);
  const dedupeReview = scheduledIngestionDedupeReview(duplicateIdentityGroups);
  const nextAction = scheduledIngestionNextAction({
    failedCount,
    queuedCount,
    runningCount,
    wouldRunJobs
  });
  const policy = scheduledIngestionPolicyReview(options.env);

  return {
    dedupeReview,
    dryRun: true,
    failureReview,
    maxJobsPerRun,
    nextAction,
    noAutoPromotion: true,
    policy,
    queuedJobs: queuedCount,
    recentFailures: failedJobs.length,
    runningJobs: runningCount,
    worksheet: scheduledIngestionWorksheet({
      dedupeReview,
      failureReview,
      maxJobsPerRun,
      nextAction,
      policy,
      queuedCount,
      recentFailures: failedJobs.length,
      runningCount,
      wouldRunJobs
    }),
    wouldRunJobs
  };
}

export async function runScheduledSourceIngestionBatch(
  options: ScheduledIngestionBatchOptions = {}
): Promise<ScheduledIngestionBatchResult> {
  const env = options.env ?? process.env;
  const plan = await planScheduledSourceIngestionDryRun({
    env,
    maxJobsPerRun: options.maxJobsPerRun
  });
  const dryRunResult = {
    applied: false,
    automaticRetries: false,
    blocked: false,
    dryRun: true,
    executedJobs: [],
    maxJobsPerRun: plan.maxJobsPerRun,
    nextAction: plan.nextAction,
    noAutoPromotion: true,
    plan
  } satisfies ScheduledIngestionBatchResult;

  if (!options.apply) {
    return dryRunResult;
  }

  const blocker = scheduledIngestionApplyBlocker(plan, env);

  if (blocker) {
    return {
      ...dryRunResult,
      blocked: true,
      blocker,
      nextAction: blocker
    };
  }

  const runNextJob = options.runNextJob ?? runNextSourceCandidateIngestionJob;
  const executedJobs: SourceCandidateIngestionJobRunResult[] = [];

  for (let index = 0; index < plan.wouldRunJobs; index += 1) {
    const result = await runNextJob({
      clinicalTrialPageSize: SOURCE_RESULT_CAP,
      pubMedRetmax: SOURCE_RESULT_CAP
    });

    if (!result) {
      break;
    }

    executedJobs.push(result);
  }

  return {
    applied: true,
    automaticRetries: false,
    blocked: false,
    dryRun: false,
    executedJobs,
    maxJobsPerRun: plan.maxJobsPerRun,
    nextAction:
      executedJobs.length > 0
        ? `Scheduled run processed ${executedJobs.length} queued job(s).`
        : "No queued ingestion jobs were claimed.",
    noAutoPromotion: true,
    plan
  };
}

function scheduledIngestionFailureReview(
  failedJobs: SourceCandidateIngestionJobListItem[]
): ScheduledIngestionFailureReview {
  const items = failedJobs.map((job) => scheduledIngestionFailureReviewItem(job));

  return {
    automaticRetries: false,
    failedJobsReviewed: items.length,
    items,
    nextAction:
      items.length > 0
        ? "Review failed ingestion jobs and their categories before enabling any retry automation."
        : "No recent failed ingestion jobs need retry review.",
    retryAutomationReady: false
  };
}

function scheduledIngestionFailureReviewItem(
  job: SourceCandidateIngestionJobListItem
): ScheduledIngestionFailureReviewItem {
  const category = scheduledIngestionFailureCategory(job.error);
  const retryDisposition = retryDispositionForFailureCategory(category);

  return {
    category,
    jobId: job.jobId,
    nextAction: nextActionForFailureCategory(category),
    region: job.region,
    retryDisposition,
    source: job.source
  };
}

function scheduledIngestionFailureCategory(
  error: string | undefined
): ScheduledIngestionFailureCategory {
  const normalized = error?.toLowerCase() ?? "";

  if (
    normalized.includes("not configured") ||
    normalized.includes("environment variable") ||
    normalized.includes("database_url") ||
    normalized.includes("ncbi_tool") ||
    normalized.includes("ncbi_email")
  ) {
    return "missing-configuration";
  }

  if (
    normalized.includes("rate limit") ||
    normalized.includes("rate-limit") ||
    normalized.includes("too many requests") ||
    normalized.includes("429")
  ) {
    return "rate-limited";
  }

  if (normalized.includes("not implemented") || normalized.includes("unsupported")) {
    return "unsupported-source";
  }

  if (
    normalized.includes("unavailable") ||
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("fetch failed") ||
    normalized.includes("network") ||
    normalized.includes("econnreset")
  ) {
    return "upstream-unavailable";
  }

  return "unknown";
}

function retryDispositionForFailureCategory(
  category: ScheduledIngestionFailureCategory
): ScheduledIngestionRetryDisposition {
  switch (category) {
    case "missing-configuration":
      return "fix-configuration-first";
    case "rate-limited":
    case "upstream-unavailable":
      return "wait-for-upstream-and-review";
    case "unsupported-source":
      return "do-not-retry-unsupported-source";
    case "unknown":
      return "review-error-before-retry";
  }
}

function nextActionForFailureCategory(category: ScheduledIngestionFailureCategory) {
  switch (category) {
    case "missing-configuration":
      return "Fix missing configuration, then rerun a dry-run before any manual retry.";
    case "rate-limited":
      return "Review source rate limits and wait before any manual retry.";
    case "unsupported-source":
      return "Do not retry until the source implementation is reviewed.";
    case "upstream-unavailable":
      return "Confirm the upstream is healthy before any manual retry.";
    case "unknown":
      return "Inspect the failed job locally before deciding whether a manual retry is appropriate.";
  }
}

function scheduledIngestionPolicyReview(
  env: Record<string, string | undefined> = process.env
): ScheduledIngestionPolicyReview {
  const missingMetadata = REQUIRED_NCBI_METADATA_ENV.filter((key) => !env[key]?.trim());
  const ncbiMetadataConfigured = missingMetadata.length === 0;
  const hostedCron = scheduledIngestionHostedCronReview(env, missingMetadata);

  return {
    automaticRetries: false,
    clinicalTrialsPageSizeCap: SOURCE_RESULT_CAP,
    hostedCron,
    hostedCronReady: hostedCron.ready,
    missingMetadata,
    ncbiMetadataConfigured,
    noAutoPromotion: true,
    pubMedRetmaxCap: SOURCE_RESULT_CAP,
    schedulerDefaultJobsPerRun: DEFAULT_MAX_JOBS_PER_RUN,
    schedulerMaxJobsPerRun: MAX_SCHEDULER_JOBS_PER_RUN,
    sourcePolicy: "review-before-enable"
  };
}

function scheduledIngestionDedupeReview(
  groups: SourceCandidateIdentityGroup[]
): ScheduledIngestionDedupeReview {
  const items = groups.map(scheduledIngestionDedupeReviewItem);

  return {
    duplicateIdentityGroups: items.length,
    items,
    nextAction:
      items.length > 0
        ? "Review duplicate source identities before enabling unattended scheduled ingestion."
        : "No duplicate source identities found in the bounded scheduler dedupe review."
  };
}

function scheduledIngestionDedupeReviewItem(
  group: SourceCandidateIdentityGroup
): ScheduledIngestionDedupeReviewItem {
  const pendingCandidates = group.candidates.filter(
    (candidate) => candidate.decision === "Pending review"
  ).length;
  const acceptedCandidates = group.candidates.filter(
    (candidate) => candidate.decision === "Accepted"
  ).length;
  const rejectedCandidates = group.candidates.filter(
    (candidate) => candidate.decision === "Rejected"
  ).length;
  const mixedDecision =
    new Set(group.candidates.map((candidate) => candidate.decision)).size > 1;

  return {
    acceptedCandidates,
    candidateCount: group.candidates.length,
    externalId: group.externalId,
    mixedDecision,
    nextAction: mixedDecision
      ? "Compare accepted, rejected, and pending rows before any scheduled retry or review action."
      : "Compare duplicate-context rows before any scheduled retry or review action.",
    pendingCandidates,
    rejectedCandidates,
    reviewCommand: `npm run ingest:sources -- --candidates --candidate-duplicates --candidate-source ${sourceCandidateSourceCommandValue(group.source)} --candidate-external-id ${group.externalId}`,
    source: group.source
  };
}

function scheduledIngestionWorksheet({
  dedupeReview,
  failureReview,
  maxJobsPerRun,
  nextAction,
  policy,
  queuedCount,
  recentFailures,
  runningCount,
  wouldRunJobs
}: {
  dedupeReview: ScheduledIngestionDedupeReview;
  failureReview: ScheduledIngestionFailureReview;
  maxJobsPerRun: number;
  nextAction: string;
  policy: ScheduledIngestionPolicyReview;
  queuedCount: number;
  recentFailures: number;
  runningCount: number;
  wouldRunJobs: number;
}): ScheduledIngestionWorksheet {
  const ready: ScheduledIngestionWorksheetItem[] = [
    {
      id: "dry-run-support",
      label: "Dry-run support",
      detail: "Scheduled ingestion can report queue state without running writes."
    },
    {
      id: "source-rate-caps",
      label: "Source rate caps",
      detail: `PubMed retmax ${policy.pubMedRetmaxCap}, ClinicalTrials.gov pageSize ${policy.clinicalTrialsPageSizeCap}, max jobs per run ${maxJobsPerRun}.`
    },
    {
      id: "no-auto-promotion",
      label: "No automatic public promotion",
      detail: "Scheduled ingestion keeps source candidates separate from public evidence promotion."
    },
    {
      id: "automatic-retries-disabled",
      label: "Automatic retries disabled",
      detail: "Failed jobs stay human-reviewed until an explicit retry policy is approved."
    }
  ];
  const blocked: ScheduledIngestionWorksheetItem[] = [];
  const warnings: ScheduledIngestionWorksheetItem[] = [];

  if (policy.ncbiMetadataConfigured) {
    ready.push({
      evidenceKeys: ["NCBI_TOOL", "NCBI_EMAIL"],
      id: "ncbi-metadata",
      label: "NCBI request metadata",
      detail: "NCBI_TOOL and NCBI_EMAIL are configured."
    });
  } else {
    blocked.push({
      evidenceKeys: policy.missingMetadata,
      id: "ncbi-metadata",
      label: "NCBI request metadata",
      detail: `Missing NCBI metadata: ${policy.missingMetadata.join(", ")}.`,
      nextAction: `Configure missing NCBI metadata before unattended PubMed ingestion: ${policy.missingMetadata.join(", ")}.`
    });
  }

  if (policy.hostedCronReady) {
    ready.push({
      evidenceKeys: [
        "DATABASE_URL",
        "APEX_DATA_SOURCE=database",
        `${SCHEDULED_INGESTION_WRITES_ENV}=true`,
        `${INGESTION_ALERTS_ENV}=true`,
        `${SCHEDULED_INGESTION_CRON_APPROVAL_ENV}=true`,
        "NCBI_TOOL",
        "NCBI_EMAIL"
      ],
      id: "hosted-cron",
      label: "Hosted cron evidence",
      detail: "Managed database mode, scheduled write gate, alerts, approval, and NCBI metadata are configured."
    });
  } else {
    blocked.push({
      evidenceKeys: policy.hostedCron.missingEnv,
      id: "hosted-cron",
      label: "Hosted cron evidence",
      detail: `Missing hosted cron evidence: ${policy.hostedCron.missingEnv.join(", ")}.`,
      nextAction:
        "Configure hosted cron evidence only after production database, scheduled write gate, alerts, approval, and NCBI metadata are ready."
    });
  }

  if (!failureReview.retryAutomationReady) {
    blocked.push({
      id: "retry-policy",
      label: "Retry automation review",
      detail: "Automatic retry policy is not approved; failed jobs remain manual-review only.",
      nextAction:
        "Review failure categories and define an explicit retry policy before enabling retry automation."
    });
  }

  if (runningCount > 0) {
    blocked.push({
      id: "running-jobs",
      label: "Running ingestion jobs",
      detail: `${runningCount} ingestion job(s) are currently running.`,
      nextAction: "Wait for running ingestion jobs before starting another scheduled batch."
    });
  }

  if (recentFailures > 0) {
    warnings.push({
      id: "recent-failures",
      label: "Recent failed jobs",
      detail: `${recentFailures} recent failed ingestion job(s) need manual retry review.`,
      nextAction: failureReview.nextAction
    });
  }

  if (dedupeReview.duplicateIdentityGroups > 0) {
    warnings.push({
      id: "duplicate-source-identities",
      label: "Duplicate source identities",
      detail: `${dedupeReview.duplicateIdentityGroups} duplicate source identity group(s) need human review before unattended scheduled ingestion.`,
      nextAction: dedupeReview.nextAction
    });
  } else {
    ready.push({
      id: "dedupe-review",
      label: "Dedupe review",
      detail: "No duplicate source identities found in the bounded scheduler dedupe review."
    });
  }

  const queuedWork = [
    {
      id: "queued-jobs",
      label: "Queued ingestion jobs",
      detail: `${queuedCount} queued job(s); dry run would process ${wouldRunJobs}.`,
      nextAction
    }
  ];

  return {
    blocked,
    humanOwned: true,
    nextOperatorAction:
      blocked[0]?.nextAction ??
      warnings[0]?.nextAction ??
      queuedWork[0]?.nextAction ??
      "Scheduled ingestion evidence is ready; review launch readiness before enabling hosted cron.",
    queuedWork,
    ready,
    warnings
  };
}

function scheduledIngestionHostedCronReview(
  env: Record<string, string | undefined>,
  missingMetadata: readonly string[]
): ScheduledIngestionHostedCronReview {
  const databaseModeConfigured = readEnv(env, "APEX_DATA_SOURCE") === "database";
  const managedDatabaseUrlConfigured = isManagedPostgresUrl(readEnv(env, "DATABASE_URL"));
  const scheduledWritesEnabled = readEnv(env, SCHEDULED_INGESTION_WRITES_ENV) === "true";
  const ingestionAlertsConfigured = readEnv(env, INGESTION_ALERTS_ENV) === "true";
  const approvalConfigured = readEnv(env, SCHEDULED_INGESTION_CRON_APPROVAL_ENV) === "true";
  const missingEnv = [
    ...(managedDatabaseUrlConfigured ? [] : ["DATABASE_URL"]),
    ...(databaseModeConfigured ? [] : ["APEX_DATA_SOURCE=database"]),
    ...(scheduledWritesEnabled ? [] : [`${SCHEDULED_INGESTION_WRITES_ENV}=true`]),
    ...(ingestionAlertsConfigured ? [] : [`${INGESTION_ALERTS_ENV}=true`]),
    ...(approvalConfigured ? [] : [`${SCHEDULED_INGESTION_CRON_APPROVAL_ENV}=true`]),
    ...missingMetadata
  ];

  return {
    approvalConfigured,
    databaseModeConfigured,
    ingestionAlertsConfigured,
    managedDatabaseUrlConfigured,
    missingEnv,
    ready: missingEnv.length === 0,
    scheduledWritesEnabled
  };
}

function sourceCandidateSourceCommandValue(source: SourceCandidateIdentityGroup["source"]) {
  switch (source) {
    case "PubMed":
      return "pubmed";
    case "ClinicalTrials.gov":
      return "clinical-trials";
  }
}

function scheduledIngestionApplyBlocker(
  plan: ScheduledIngestionDryRun,
  env: Record<string, string | undefined>
) {
  if (env[SCHEDULED_INGESTION_WRITES_ENV] !== "true") {
    return `${SCHEDULED_INGESTION_WRITES_ENV}=true is required when --apply is used.`;
  }

  if (!plan.policy.ncbiMetadataConfigured) {
    return `NCBI metadata is required when --apply is used: ${plan.policy.missingMetadata.join(", ")}.`;
  }

  if (plan.runningJobs > 0) {
    return plan.nextAction;
  }

  return undefined;
}

function normaliseMaxJobsPerRun(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return DEFAULT_MAX_JOBS_PER_RUN;
  }

  return Math.min(
    MAX_SCHEDULER_JOBS_PER_RUN,
    Math.max(1, Math.trunc(value as number))
  );
}

function isManagedPostgresUrl(value: string | undefined) {
  if (!value) {
    return false;
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return false;
  }

  return (
    ["postgres:", "postgresql:"].includes(url.protocol) &&
    !LOCAL_DATABASE_HOSTS.has(url.hostname.toLowerCase())
  );
}

function scheduledIngestionNextAction({
  failedCount,
  queuedCount,
  runningCount,
  wouldRunJobs
}: {
  failedCount: number;
  queuedCount: number;
  runningCount: number;
  wouldRunJobs: number;
}) {
  if (runningCount > 0) {
    return "Wait for running ingestion jobs before starting another scheduled batch.";
  }

  if (wouldRunJobs > 0) {
    return `Scheduled run would process ${wouldRunJobs} queued job(s).`;
  }

  if (failedCount > 0) {
    return "Review failed ingestion jobs before queueing more scheduled work.";
  }

  if (queuedCount === 0) {
    return "No queued ingestion jobs are ready for a scheduled run.";
  }

  return "Review scheduler state before running ingestion.";
}

function readEnv(env: Record<string, string | undefined>, key: string) {
  const value = env[key];
  return value && value.trim() ? value.trim() : undefined;
}
