import {
  IngestionStatus as DbIngestionStatus,
  SourceKind as DbSourceKind,
  type IngestionJob as DbIngestionJob,
  type Prisma
} from "@prisma/client";

import {
  ingestClinicalTrialSourceCandidates,
  ingestPubMedSourceCandidates,
  type SourceCandidateIngestionResult
} from "@/lib/data/source-candidate-ingestion";
import { prisma } from "@/lib/db/prisma";

type SupportedSourceCandidateJobSource =
  | typeof DbSourceKind.PUBMED
  | typeof DbSourceKind.CLINICALTRIALS_GOV;

type FinalIngestionStatus =
  | typeof DbIngestionStatus.SUCCEEDED
  | typeof DbIngestionStatus.FAILED
  | typeof DbIngestionStatus.SKIPPED;

export interface SourceCandidateIngestionJobOptions {
  clinicalTrialPageSize?: number;
  now?: () => Date;
  pubMedRetmax?: number;
}

export interface SourceCandidateIngestionJobRunResult {
  jobId: string;
  source: DbSourceKind;
  query: string;
  region: string;
  status: FinalIngestionStatus;
  recordsFound: number;
  recordsChanged: number;
  error?: string;
}

const SUPPORTED_SOURCE_CANDIDATE_JOB_SOURCES = [
  DbSourceKind.PUBMED,
  DbSourceKind.CLINICALTRIALS_GOV
] satisfies SupportedSourceCandidateJobSource[];
const MAX_NEXT_JOB_CLAIM_ATTEMPTS = 3;

export async function runNextSourceCandidateIngestionJob(
  options: SourceCandidateIngestionJobOptions = {}
): Promise<SourceCandidateIngestionJobRunResult | null> {
  const now = options.now ?? (() => new Date());

  for (let attempt = 0; attempt < MAX_NEXT_JOB_CLAIM_ATTEMPTS; attempt += 1) {
    const job = await prisma.ingestionJob.findFirst({
      where: {
        status: DbIngestionStatus.QUEUED,
        source: {
          in: SUPPORTED_SOURCE_CANDIDATE_JOB_SOURCES
        }
      },
      orderBy: [{ createdAt: "asc" }]
    });

    if (!job) {
      return null;
    }

    const claimed = await claimQueuedJob(job.id, now());

    if (claimed) {
      return runClaimedSourceCandidateIngestionJob(job, options, now);
    }
  }

  return null;
}

export async function runSourceCandidateIngestionJob(
  jobId: string,
  options: SourceCandidateIngestionJobOptions = {}
): Promise<SourceCandidateIngestionJobRunResult> {
  const job = await prisma.ingestionJob.findUnique({
    where: {
      id: jobId
    }
  });

  if (!job) {
    throw new Error(`Ingestion job not found: ${jobId}`);
  }

  if (job.status !== DbIngestionStatus.QUEUED) {
    throw new Error(`Ingestion job is not queued: ${jobId} has status ${job.status}.`);
  }

  const now = options.now ?? (() => new Date());
  const claimed = await claimQueuedJob(job.id, now());

  if (!claimed) {
    throw new Error(`Could not claim queued ingestion job: ${jobId}.`);
  }

  return runClaimedSourceCandidateIngestionJob(job, options, now);
}

async function runClaimedSourceCandidateIngestionJob(
  job: DbIngestionJob,
  options: SourceCandidateIngestionJobOptions,
  now: () => Date
) {
  if (!isSupportedSourceCandidateJobSource(job.source)) {
    return completeJob({
      job,
      completedAt: now(),
      status: DbIngestionStatus.SKIPPED,
      recordsFound: 0,
      recordsChanged: 0,
      error: `Source candidate ingestion is not implemented for ${job.source}.`
    });
  }

  try {
    const result = await runSupportedSourceCandidateJob(job, options);

    return completeJob({
      job,
      completedAt: now(),
      status: DbIngestionStatus.SUCCEEDED,
      recordsFound: result.candidates.length,
      recordsChanged: result.upsert.upserted,
      error: null
    });
  } catch (error) {
    return completeJob({
      job,
      completedAt: now(),
      status: DbIngestionStatus.FAILED,
      recordsFound: 0,
      recordsChanged: 0,
      error: normaliseErrorMessage(error)
    });
  }
}

async function runSupportedSourceCandidateJob(
  job: DbIngestionJob,
  options: SourceCandidateIngestionJobOptions
): Promise<SourceCandidateIngestionResult> {
  const context = sourceCandidateContext(job);

  switch (job.source) {
    case DbSourceKind.PUBMED:
      return ingestPubMedSourceCandidates({
        ...context,
        term: job.query,
        retmax: options.pubMedRetmax
      });
    case DbSourceKind.CLINICALTRIALS_GOV:
      return ingestClinicalTrialSourceCandidates({
        ...context,
        term: job.query,
        pageSize: options.clinicalTrialPageSize
      });
    default:
      throw new Error(`Unsupported source candidate ingestion source: ${job.source}`);
  }
}

function sourceCandidateContext(job: DbIngestionJob) {
  return {
    region: job.region,
    interventionId: readStringMetadata(job.metadata, "interventionId"),
    claimId: readStringMetadata(job.metadata, "claimId"),
    ingestionJobId: job.id
  };
}

async function claimQueuedJob(jobId: string, startedAt: Date) {
  const result = await prisma.ingestionJob.updateMany({
    where: {
      id: jobId,
      status: DbIngestionStatus.QUEUED
    },
    data: {
      status: DbIngestionStatus.RUNNING,
      startedAt,
      completedAt: null,
      recordsFound: 0,
      recordsChanged: 0,
      error: null
    }
  });

  return result.count === 1;
}

async function completeJob({
  job,
  completedAt,
  status,
  recordsFound,
  recordsChanged,
  error
}: {
  job: DbIngestionJob;
  completedAt: Date;
  status: FinalIngestionStatus;
  recordsFound: number;
  recordsChanged: number;
  error: string | null;
}): Promise<SourceCandidateIngestionJobRunResult> {
  await prisma.ingestionJob.update({
    where: {
      id: job.id
    },
    data: {
      status,
      completedAt,
      recordsFound,
      recordsChanged,
      error
    }
  });

  return {
    jobId: job.id,
    source: job.source,
    query: job.query,
    region: job.region,
    status,
    recordsFound,
    recordsChanged,
    error: error ?? undefined
  };
}

function isSupportedSourceCandidateJobSource(
  source: DbSourceKind
): source is SupportedSourceCandidateJobSource {
  return SUPPORTED_SOURCE_CANDIDATE_JOB_SOURCES.includes(
    source as SupportedSourceCandidateJobSource
  );
}

function readStringMetadata(metadata: Prisma.JsonValue | null, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return undefined;
  }

  const value = metadata[key];

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normaliseErrorMessage(error: unknown) {
  const message =
    error instanceof Error && error.message ? error.message : String(error);

  return message.slice(0, 1000);
}
