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
import { MAX_LIVE_SOURCE_TERM_LENGTH } from "@/lib/live-source-request";
import type { SourceCandidateSource } from "@/lib/types";

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

export interface SourceCandidateIngestionJobListOptions {
  limit?: number;
}

export interface SourceCandidateIngestionJobListItem {
  claimId?: string;
  completedAt?: string;
  createdAt: string;
  error?: string;
  interventionId?: string;
  jobId: string;
  query: string;
  recordsChanged: number;
  recordsFound: number;
  region: string;
  source: DbSourceKind;
  startedAt?: string;
  status: DbIngestionStatus;
  updatedAt: string;
}

export interface QueueSourceCandidateIngestionJobInput {
  claimId?: string;
  interventionId?: string;
  query: string;
  region?: string;
  source: SourceCandidateSource;
}

export interface QueuedSourceCandidateIngestionJob {
  claimId?: string;
  contextMismatchFields: SourceCandidateJobContextField[];
  created: boolean;
  interventionId?: string;
  jobId: string;
  query: string;
  region: string;
  source: DbSourceKind;
  status: DbIngestionStatus;
}

export type SourceCandidateJobContextField = "interventionId" | "claimId";

interface SourceCandidateJobContext {
  claimId?: string;
  interventionId?: string;
}

const SUPPORTED_SOURCE_CANDIDATE_JOB_SOURCES = [
  DbSourceKind.PUBMED,
  DbSourceKind.CLINICALTRIALS_GOV
] satisfies SupportedSourceCandidateJobSource[];
const MAX_NEXT_JOB_CLAIM_ATTEMPTS = 3;
const DEFAULT_JOB_LIST_LIMIT = 10;
const MAX_JOB_LIST_LIMIT = 50;
const DEFAULT_REGION = "AU";

export async function listSourceCandidateIngestionJobs(
  options: SourceCandidateIngestionJobListOptions = {}
): Promise<SourceCandidateIngestionJobListItem[]> {
  const jobs = await prisma.ingestionJob.findMany({
    where: {
      source: {
        in: SUPPORTED_SOURCE_CANDIDATE_JOB_SOURCES
      }
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: normaliseJobListLimit(options.limit)
  });

  return jobs.map(mapJobListItem);
}

export async function queueSourceCandidateIngestionJob(
  input: QueueSourceCandidateIngestionJobInput
): Promise<QueuedSourceCandidateIngestionJob> {
  const source = sourceKindFromSourceCandidateSource(input.source);
  const query = normaliseQueueQuery(input.query);
  const region = normaliseRegion(input.region);
  const requestedContext = queueContext(input);
  await validateQueueContext(requestedContext);
  const identityWhere = queueIdentityWhere({
    source,
    query,
    region,
    context: requestedContext
  });
  const existingJob = await prisma.ingestionJob.findFirst({
    where: identityWhere
  });

  if (existingJob) {
    return mapQueuedJob(existingJob, false, requestedContext);
  }

  let job: DbIngestionJob;

  try {
    job = await prisma.ingestionJob.create({
      data: {
        source,
        status: DbIngestionStatus.QUEUED,
        query,
        region,
        interventionId: requestedContext.interventionId,
        claimId: requestedContext.claimId,
        metadata: queueMetadata(requestedContext)
      }
    });
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) {
      throw error;
    }

    const racedJob = await prisma.ingestionJob.findFirst({
      where: identityWhere
    });

    if (!racedJob) {
      throw error;
    }

    return mapQueuedJob(racedJob, false, requestedContext);
  }

  return mapQueuedJob(job, true, requestedContext);
}

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
    interventionId: optionalTrimmedString(job.interventionId),
    claimId: optionalTrimmedString(job.claimId),
    ingestionJobId: job.id
  };
}

function sourceKindFromSourceCandidateSource(source: SourceCandidateSource) {
  switch (source) {
    case "PubMed":
      return DbSourceKind.PUBMED;
    case "ClinicalTrials.gov":
      return DbSourceKind.CLINICALTRIALS_GOV;
  }
}

function mapQueuedJob(
  job: DbIngestionJob,
  created: boolean,
  requestedContext: SourceCandidateJobContext
): QueuedSourceCandidateIngestionJob {
  const context = sourceCandidateJobContext(job);

  return {
    claimId: context.claimId,
    contextMismatchFields: created
      ? []
      : contextMismatchFields(context, requestedContext),
    created,
    interventionId: context.interventionId,
    jobId: job.id,
    query: job.query,
    region: job.region,
    source: job.source,
    status: job.status
  };
}

function mapJobListItem(job: DbIngestionJob): SourceCandidateIngestionJobListItem {
  const context = sourceCandidateJobContext(job);

  return {
    claimId: context.claimId,
    completedAt: dateToIso(job.completedAt),
    createdAt: job.createdAt.toISOString(),
    error: job.error ?? undefined,
    interventionId: context.interventionId,
    jobId: job.id,
    query: job.query,
    recordsChanged: job.recordsChanged,
    recordsFound: job.recordsFound,
    region: job.region,
    source: job.source,
    startedAt: dateToIso(job.startedAt),
    status: job.status,
    updatedAt: job.updatedAt.toISOString()
  };
}

function normaliseJobListLimit(limit: number | undefined) {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_JOB_LIST_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), MAX_JOB_LIST_LIMIT);
}

function dateToIso(value: Date | null) {
  return value?.toISOString();
}

function normaliseQueueQuery(query: string) {
  const normalised = query.replace(/\s+/g, " ").trim();

  if (!normalised) {
    throw new Error("Source-candidate ingestion job query is required.");
  }

  if (normalised.length > MAX_LIVE_SOURCE_TERM_LENGTH) {
    throw new Error(
      `Source-candidate ingestion job query must be ${MAX_LIVE_SOURCE_TERM_LENGTH} characters or fewer.`
    );
  }

  return normalised;
}

function normaliseRegion(region: string | undefined) {
  const normalised = (region ?? DEFAULT_REGION).trim().toUpperCase();

  if (!normalised) {
    throw new Error("Source-candidate ingestion job region is required.");
  }

  return normalised;
}

function queueMetadata(context: SourceCandidateJobContext) {
  return Object.fromEntries(
    [
      ["interventionId", context.interventionId],
      ["claimId", context.claimId]
    ].filter(([, value]) => value !== undefined)
  ) as Prisma.InputJsonObject;
}

function queueContext(input: QueueSourceCandidateIngestionJobInput) {
  return {
    interventionId: optionalTrimmedString(input.interventionId),
    claimId: optionalTrimmedString(input.claimId)
  };
}

async function validateQueueContext(context: SourceCandidateJobContext) {
  if (context.claimId) {
    const claim = await prisma.claim.findUnique({
      where: {
        id: context.claimId
      },
      select: {
        interventionId: true
      }
    });

    if (!claim) {
      throw new Error(
        `Source-candidate ingestion job claim not found: ${context.claimId}.`
      );
    }

    if (context.interventionId && claim.interventionId !== context.interventionId) {
      throw new Error(
        `Source-candidate ingestion job claim ${context.claimId} does not belong to intervention ${context.interventionId}.`
      );
    }

    return;
  }

  if (!context.interventionId) {
    return;
  }

  const intervention = await prisma.intervention.findUnique({
    where: {
      id: context.interventionId
    },
    select: {
      id: true
    }
  });

  if (!intervention) {
    throw new Error(
      `Source-candidate ingestion job intervention not found: ${context.interventionId}.`
    );
  }
}

function sourceCandidateJobContext(job: DbIngestionJob): SourceCandidateJobContext {
  return {
    interventionId: optionalTrimmedString(job.interventionId),
    claimId: optionalTrimmedString(job.claimId)
  };
}

function queueIdentityWhere({
  source,
  query,
  region,
  context
}: {
  context: SourceCandidateJobContext;
  query: string;
  region: string;
  source: DbSourceKind;
}): Prisma.IngestionJobWhereInput {
  return {
    source,
    query,
    region,
    interventionId: context.interventionId ?? null,
    claimId: context.claimId ?? null
  };
}

function contextMismatchFields(
  storedContext: SourceCandidateJobContext,
  requestedContext: SourceCandidateJobContext
): SourceCandidateJobContextField[] {
  return (["interventionId", "claimId"] as const).filter((field) => {
    const requestedValue = requestedContext[field];

    return requestedValue !== undefined && requestedValue !== storedContext[field];
  });
}

function optionalTrimmedString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
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

function normaliseErrorMessage(error: unknown) {
  const message =
    error instanceof Error && error.message ? error.message : String(error);

  return message.slice(0, 1000);
}

function isPrismaUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
