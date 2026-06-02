import {
  listSourceCandidateIngestionJobs,
  queueSourceCandidateIngestionJob,
  runNextSourceCandidateIngestionJob,
  runSourceCandidateIngestionJob,
  type QueueSourceCandidateIngestionJobInput,
  type QueuedSourceCandidateIngestionJob,
  type SourceCandidateIngestionJobListItem,
  type SourceCandidateIngestionJobListOptions,
  type SourceCandidateIngestionJobOptions,
  type SourceCandidateIngestionJobRunResult
} from "@/lib/data/source-candidate-jobs";
import {
  summarizeSourceCandidateBacklog,
  listSourceCandidateReviewQueue,
  type SourceCandidateBacklogSummary
} from "@/lib/data/source-candidates";
import type { SourceCandidate, SourceCandidateSource } from "@/lib/types";

export interface SourceCandidateJobCommandOptions
  extends SourceCandidateIngestionJobOptions {
  candidateSource?: SourceCandidateSource;
  candidates?: boolean;
  candidatesLimit?: number;
  claimId?: string;
  help: boolean;
  interventionId?: string;
  jobId?: string;
  jobs?: boolean;
  jobsLimit?: number;
  limit: number;
  queueQuery?: string;
  queueSource?: SourceCandidateSource;
  region?: string;
  summary: boolean;
}

export interface SourceCandidateJobCommandIo {
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
}

export interface SourceCandidateJobCommandRunners {
  listCandidates?: (options: {
    limit?: number;
    source?: SourceCandidateSource;
  }) => Promise<SourceCandidate[]>;
  listJobs?: (
    options: SourceCandidateIngestionJobListOptions
  ) => Promise<SourceCandidateIngestionJobListItem[]>;
  queueJob?: (
    input: QueueSourceCandidateIngestionJobInput
  ) => Promise<QueuedSourceCandidateIngestionJob>;
  runJobById?: (
    jobId: string,
    options: SourceCandidateIngestionJobOptions
  ) => Promise<SourceCandidateIngestionJobRunResult>;
  runNextJob?: (
    options: SourceCandidateIngestionJobOptions
  ) => Promise<SourceCandidateIngestionJobRunResult | null>;
  summarizeBacklog?: () => Promise<SourceCandidateBacklogSummary>;
}

const DEFAULT_JOB_LIMIT = 1;
const MAX_JOB_LIMIT = 25;

export async function runSourceCandidateJobCommand(
  args: readonly string[] = process.argv.slice(2),
  io: SourceCandidateJobCommandIo = {},
  runners: SourceCandidateJobCommandRunners = {}
) {
  const stdout = io.stdout ?? console.log;
  const stderr = io.stderr ?? console.error;
  const listCandidates = runners.listCandidates ?? listSourceCandidateReviewQueue;
  const listJobs = runners.listJobs ?? listSourceCandidateIngestionJobs;
  const queueJob = runners.queueJob ?? queueSourceCandidateIngestionJob;
  const runJobById = runners.runJobById ?? runSourceCandidateIngestionJob;
  const runNextJob = runners.runNextJob ?? runNextSourceCandidateIngestionJob;
  const summarizeBacklog = runners.summarizeBacklog ?? summarizeSourceCandidateBacklog;

  let options: SourceCandidateJobCommandOptions;

  try {
    options = parseSourceCandidateJobCommandArgs(args);
  } catch (error) {
    stderr(error instanceof Error ? error.message : String(error));
    stderr(commandUsage());
    return 1;
  }

  if (options.help) {
    stdout(commandUsage());
    return 0;
  }

  try {
    if (options.candidates) {
      const candidates = await listCandidates({
        limit: options.candidatesLimit,
        source: options.candidateSource
      });

      stdout(formatSourceCandidateReviewQueue(candidates));
      return 0;
    }

    if (options.jobs) {
      const jobs = await listJobs({
        limit: options.jobsLimit
      });

      stdout(formatSourceCandidateIngestionJobs(jobs));
      return 0;
    }

    if (options.queueSource && options.queueQuery) {
      const result = await queueJob({
        source: options.queueSource,
        query: options.queueQuery,
        region: options.region,
        interventionId: options.interventionId,
        claimId: options.claimId
      });

      stdout(formatQueuedSourceCandidateJob(result));
      return 0;
    }

    if (options.summary) {
      const summary = await summarizeBacklog();

      stdout(formatSourceCandidateBacklogSummary(summary));
      return 0;
    }

    const runnerOptions = sourceCandidateIngestionJobOptions(options);
    const results = options.jobId
      ? [await runJobById(options.jobId, runnerOptions)]
      : await runNextJobs(options.limit, runnerOptions, runNextJob);

    if (results.length === 0) {
      stdout("No queued PubMed or ClinicalTrials.gov source-candidate jobs found.");
      return 0;
    }

    for (const result of results) {
      stdout(formatSourceCandidateJobResult(result));
    }

    return results.some((result) => result.status === "FAILED") ? 1 : 0;
  } catch (error) {
    stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

export function parseSourceCandidateJobCommandArgs(
  args: readonly string[]
): SourceCandidateJobCommandOptions {
  const options: SourceCandidateJobCommandOptions = {
    help: false,
    limit: DEFAULT_JOB_LIMIT,
    summary: false
  };
  let candidatesLimitProvided = false;
  let limitProvided = false;
  let jobsLimitProvided = false;
  let sourceLimitProvided = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--job-id") {
      options.jobId = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--summary") {
      options.summary = true;
      continue;
    }

    if (arg === "--candidates") {
      options.candidates = true;
      continue;
    }

    if (arg === "--candidates-limit") {
      options.candidatesLimit = readPositiveInteger(args, index, arg, 50);
      candidatesLimitProvided = true;
      index += 1;
      continue;
    }

    if (arg === "--candidate-source") {
      options.candidateSource = readCandidateSource(readRequiredValue(args, index, arg));
      index += 1;
      continue;
    }

    if (arg === "--jobs") {
      options.jobs = true;
      continue;
    }

    if (arg === "--jobs-limit") {
      options.jobsLimit = readPositiveInteger(args, index, arg, 50);
      jobsLimitProvided = true;
      index += 1;
      continue;
    }

    if (arg === "--queue-pubmed") {
      setQueueOption(options, "PubMed", readRequiredValue(args, index, arg));
      index += 1;
      continue;
    }

    if (arg === "--queue-clinical-trials") {
      setQueueOption(
        options,
        "ClinicalTrials.gov",
        readRequiredValue(args, index, arg)
      );
      index += 1;
      continue;
    }

    if (arg === "--region") {
      options.region = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--intervention-id") {
      options.interventionId = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--claim-id") {
      options.claimId = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--limit") {
      options.limit = readPositiveInteger(args, index, arg, MAX_JOB_LIMIT);
      limitProvided = true;
      index += 1;
      continue;
    }

    if (arg === "--pubmed-retmax") {
      options.pubMedRetmax = readPositiveInteger(args, index, arg, 20);
      sourceLimitProvided = true;
      index += 1;
      continue;
    }

    if (arg === "--clinical-trial-page-size") {
      options.clinicalTrialPageSize = readPositiveInteger(args, index, arg, 20);
      sourceLimitProvided = true;
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  if (options.jobId && limitProvided) {
    throw new Error("--job-id runs exactly one job and cannot be combined with --limit.");
  }

  if ((candidatesLimitProvided || options.candidateSource) && !options.candidates) {
    throw new Error("--candidates-limit and --candidate-source require --candidates.");
  }

  if (options.candidates && options.summary) {
    throw new Error("--candidates cannot be combined with --summary.");
  }

  if (options.candidates && options.jobs) {
    throw new Error("--candidates cannot be combined with --jobs.");
  }

  if (options.candidates && options.queueSource) {
    throw new Error("--candidates is read-only and cannot be combined with queue options.");
  }

  if (options.candidates && (options.jobId || limitProvided || sourceLimitProvided)) {
    throw new Error("--candidates is read-only and cannot be combined with run options.");
  }

  if (jobsLimitProvided && !options.jobs) {
    throw new Error("--jobs-limit requires --jobs.");
  }

  if (options.jobs && options.summary) {
    throw new Error("--jobs cannot be combined with --summary.");
  }

  if (options.jobs && options.queueSource) {
    throw new Error("--jobs is read-only and cannot be combined with queue options.");
  }

  if (options.jobs && (options.jobId || limitProvided || sourceLimitProvided)) {
    throw new Error("--jobs is read-only and cannot be combined with run options.");
  }

  if (options.queueSource && options.summary) {
    throw new Error("--summary is read-only and cannot be combined with queue options.");
  }

  if (options.queueSource && (options.jobId || limitProvided || sourceLimitProvided)) {
    throw new Error("Queue options cannot be combined with run options.");
  }

  if (!options.queueSource && (options.region || options.interventionId || options.claimId)) {
    throw new Error("--region, --intervention-id, and --claim-id require a queue option.");
  }

  if (options.summary && (options.jobId || limitProvided || sourceLimitProvided)) {
    throw new Error("--summary is read-only and cannot be combined with run options.");
  }

  return options;
}

export function commandUsage() {
  return [
    "Usage: npm run ingest:sources -- [options]",
    "",
    "Options:",
    "  --job-id <id>                     Run one specific ingestion job.",
    "  --limit <count>                   Run up to count queued jobs (default 1, max 25).",
    "  --candidates                      Print pending source-candidate review queue rows.",
    "  --candidates-limit <count>        Candidate count for --candidates (default 25, max 50).",
    "  --candidate-source <source>       Candidate source: pubmed or clinical-trials.",
    "  --jobs                            Print recent source-candidate ingestion jobs.",
    "  --jobs-limit <count>              Recent job count for --jobs (default 10, max 50).",
    "  --queue-pubmed <term>             Queue a PubMed source-candidate job.",
    "  --queue-clinical-trials <term>    Queue a ClinicalTrials.gov source-candidate job.",
    "  --region <region>                 Region metadata for queued jobs (default AU).",
    "  --intervention-id <id>            Intervention metadata for queued jobs.",
    "  --claim-id <id>                   Claim metadata for queued jobs.",
    "  --pubmed-retmax <count>           PubMed result limit passed to NCBI (max 20).",
    "  --clinical-trial-page-size <count> ClinicalTrials.gov page size (max 20).",
    "  --summary                         Print read-only source-candidate backlog counts.",
    "  --help                            Show this help."
  ].join("\n");
}

function sourceCandidateIngestionJobOptions(
  options: SourceCandidateJobCommandOptions
): SourceCandidateIngestionJobOptions {
  return {
    clinicalTrialPageSize: options.clinicalTrialPageSize,
    pubMedRetmax: options.pubMedRetmax
  };
}

async function runNextJobs(
  limit: number,
  options: SourceCandidateIngestionJobOptions,
  runNextJob: NonNullable<SourceCandidateJobCommandRunners["runNextJob"]>
) {
  const results: SourceCandidateIngestionJobRunResult[] = [];

  for (let index = 0; index < limit; index += 1) {
    const result = await runNextJob(options);

    if (!result) {
      break;
    }

    results.push(result);
  }

  return results;
}

function formatSourceCandidateJobResult(result: SourceCandidateIngestionJobRunResult) {
  const parts = [
    `[${result.status}]`,
    result.jobId,
    result.source,
    result.region,
    quote(result.query),
    `found=${result.recordsFound}`,
    `changed=${result.recordsChanged}`
  ];

  if (result.error) {
    parts.push(`error=${result.error}`);
  }

  return parts.join(" ");
}

function formatQueuedSourceCandidateJob(result: QueuedSourceCandidateIngestionJob) {
  return [
    `[${result.status}]`,
    result.jobId,
    result.source,
    result.region,
    quote(result.query),
    `created=${result.created}`
  ].join(" ");
}

function formatSourceCandidateReviewQueue(candidates: SourceCandidate[]) {
  if (candidates.length === 0) {
    return "Source-candidate review queue: total=0";
  }

  return [
    `Source-candidate review queue: total=${candidates.length}`,
    ...candidates.map(formatSourceCandidateReviewQueueItem)
  ].join("\n");
}

function formatSourceCandidateReviewQueueItem(candidate: SourceCandidate) {
  const parts = [
    `- triage=${candidate.triageScore}/100`,
    candidate.source,
    candidate.region,
    `dedupe=${quote(candidate.dedupeKey)}`,
    `title=${quote(candidate.title)}`,
    `url=${candidate.url}`
  ];

  if (candidate.interventionId) {
    parts.push(`intervention=${candidate.interventionId}`);
  }

  if (candidate.claimId) {
    parts.push(`claim=${candidate.claimId}`);
  }

  return parts.join(" ");
}

function formatSourceCandidateIngestionJobs(jobs: SourceCandidateIngestionJobListItem[]) {
  if (jobs.length === 0) {
    return "Source-candidate ingestion jobs: total=0";
  }

  return [
    `Source-candidate ingestion jobs: total=${jobs.length}`,
    ...jobs.map(formatSourceCandidateIngestionJob)
  ].join("\n");
}

function formatSourceCandidateIngestionJob(job: SourceCandidateIngestionJobListItem) {
  const parts = [
    `- [${job.status}]`,
    job.jobId,
    job.source,
    job.region,
    quote(job.query),
    `found=${job.recordsFound}`,
    `changed=${job.recordsChanged}`,
    `updated=${job.updatedAt}`
  ];

  if (job.error) {
    parts.push(`error=${job.error}`);
  }

  return parts.join(" ");
}

function formatSourceCandidateBacklogSummary(summary: SourceCandidateBacklogSummary) {
  if (summary.total === 0) {
    return "Source-candidate backlog: total=0";
  }

  return [
    `Source-candidate backlog: total=${summary.total}`,
    ...summary.groups.map(
      (group) =>
        `- ${group.source} ${group.region} ${group.decision} / ${group.reviewStatus}: ${group.count}`
    )
  ].join("\n");
}

function readRequiredValue(args: readonly string[], index: number, option: string) {
  const value = args[index + 1];

  if (!value || value.startsWith("-")) {
    throw new Error(`${option} requires a value.`);
  }

  return value;
}

function readPositiveInteger(
  args: readonly string[],
  index: number,
  option: string,
  max: number
) {
  const value = readRequiredValue(args, index, option);
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue < 1) {
    throw new Error(`${option} must be a positive integer.`);
  }

  return Math.min(numberValue, max);
}

function readCandidateSource(value: string): SourceCandidateSource {
  const normalised = value.trim().toLowerCase();

  if (normalised === "pubmed") {
    return "PubMed";
  }

  if (
    normalised === "clinical-trials" ||
    normalised === "clinicaltrials" ||
    normalised === "clinicaltrials.gov"
  ) {
    return "ClinicalTrials.gov";
  }

  throw new Error("--candidate-source must be pubmed or clinical-trials.");
}

function setQueueOption(
  options: SourceCandidateJobCommandOptions,
  source: SourceCandidateSource,
  query: string
) {
  if (options.queueSource) {
    throw new Error("Only one queue option can be used at a time.");
  }

  options.queueSource = source;
  options.queueQuery = query;
}

function quote(value: string) {
  return `"${value.replace(/"/g, '\\"')}"`;
}
