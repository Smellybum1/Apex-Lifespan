import { IngestionStatus } from "@prisma/client";

import {
  listSourceCandidateIngestionJobs,
  summarizeSourceCandidateIngestionJobs
} from "@/lib/data/source-candidate-jobs";

export interface ScheduledIngestionDryRunOptions {
  maxJobsPerRun?: number;
}

export interface ScheduledIngestionDryRun {
  dryRun: true;
  maxJobsPerRun: number;
  nextAction: string;
  noAutoPromotion: true;
  queuedJobs: number;
  recentFailures: number;
  runningJobs: number;
  wouldRunJobs: number;
}

const DEFAULT_MAX_JOBS_PER_RUN = 1;
const MAX_SCHEDULER_JOBS_PER_RUN = 5;

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
    queuedJobs: queuedCount,
    recentFailures: failedJobs.length,
    runningJobs: runningCount,
    wouldRunJobs
  };
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
