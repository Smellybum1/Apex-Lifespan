import { IngestionStatus } from "@prisma/client";

import {
  listSourceCandidateIngestionJobs,
  runNextSourceCandidateIngestionJob,
  type SourceCandidateIngestionJobOptions,
  type SourceCandidateIngestionJobRunResult,
  summarizeSourceCandidateIngestionJobs
} from "@/lib/data/source-candidate-jobs";

export interface ScheduledIngestionDryRunOptions {
  env?: Record<string, string | undefined>;
  maxJobsPerRun?: number;
}

export interface ScheduledIngestionBatchOptions extends ScheduledIngestionDryRunOptions {
  apply?: boolean;
  runNextJob?: ScheduledIngestionJobRunner;
}

export interface ScheduledIngestionDryRun {
  dryRun: true;
  maxJobsPerRun: number;
  nextAction: string;
  noAutoPromotion: true;
  policy: ScheduledIngestionPolicyReview;
  queuedJobs: number;
  recentFailures: number;
  runningJobs: number;
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

export type ScheduledIngestionJobRunner = (
  options: SourceCandidateIngestionJobOptions
) => Promise<SourceCandidateIngestionJobRunResult | null>;

const DEFAULT_MAX_JOBS_PER_RUN = 1;
const MAX_SCHEDULER_JOBS_PER_RUN = 5;
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
  const [summary, runningJobs, queuedJobs, failedJobs] = await Promise.all([
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

  return {
    dryRun: true,
    maxJobsPerRun,
    nextAction: scheduledIngestionNextAction({
      failedCount,
      queuedCount,
      runningCount,
      wouldRunJobs
    }),
    noAutoPromotion: true,
    policy: scheduledIngestionPolicyReview(options.env),
    queuedJobs: queuedCount,
    recentFailures: failedJobs.length,
    runningJobs: runningCount,
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
