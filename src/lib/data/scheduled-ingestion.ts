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
  hostedCronReady: boolean;
  missingMetadata: string[];
  ncbiMetadataConfigured: boolean;
  noAutoPromotion: true;
  pubMedRetmaxCap: number;
  schedulerDefaultJobsPerRun: number;
  schedulerMaxJobsPerRun: number;
  sourcePolicy: "review-before-enable";
}

export type ScheduledIngestionJobRunner = (
  options: SourceCandidateIngestionJobOptions
) => Promise<SourceCandidateIngestionJobRunResult | null>;

const DEFAULT_MAX_JOBS_PER_RUN = 1;
const MAX_SCHEDULER_JOBS_PER_RUN = 5;
const SOURCE_RESULT_CAP = 20;
const REQUIRED_NCBI_METADATA_ENV = ["NCBI_TOOL", "NCBI_EMAIL"] as const;
const SCHEDULED_INGESTION_WRITES_ENV = "APEX_SCHEDULED_INGESTION_WRITES_ENABLED";

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

  return {
    automaticRetries: false,
    clinicalTrialsPageSizeCap: SOURCE_RESULT_CAP,
    hostedCronReady: ncbiMetadataConfigured,
    missingMetadata,
    ncbiMetadataConfigured,
    noAutoPromotion: true,
    pubMedRetmaxCap: SOURCE_RESULT_CAP,
    schedulerDefaultJobsPerRun: DEFAULT_MAX_JOBS_PER_RUN,
    schedulerMaxJobsPerRun: MAX_SCHEDULER_JOBS_PER_RUN,
    sourcePolicy: "review-before-enable"
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
