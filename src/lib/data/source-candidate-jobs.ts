import {
  IngestionStatus as DbIngestionStatus,
  InterventionCategory as DbInterventionCategory,
  OutcomeArea as DbOutcomeArea,
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
import {
  assessPubMedDeepeningPage,
  DEFAULT_PUBMED_RETMAX,
  hasEnoughUsefulPubMedCandidates,
  normalisePubMedDeepeningCatchUpLimit,
  normalisePubMedRetmax,
  type PubMedDeepeningAssessment
} from "@/lib/source-discovery-policy";
import {
  buildInterventionDiscoverySearchQueries,
  buildSourceSearchQueries
} from "@/lib/source-queries";
import type { InterventionCategory, OutcomeArea, SourceCandidateSource } from "@/lib/types";

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
  deepening?: SourceCandidateIngestionJobDeepeningResult;
  jobId: string;
  source: DbSourceKind;
  query: string;
  region: string;
  status: FinalIngestionStatus;
  recordsFound: number;
  recordsChanged: number;
  error?: string;
}

export interface SourceCandidateIngestionJobDeepeningResult {
  candidateCount: number;
  maxResults: number;
  nextPageStart?: number;
  pageSize: number;
  pageStart: number;
  queued: boolean;
  reason: string;
  totalCount?: number;
  usefulCandidateCount: number;
  usefulRatio: number;
}

export interface QueuedPubMedDeepeningCatchUpJobs {
  eligibleJobs: number;
  existingJobs: number;
  jobCount: number;
  newJobs: number;
  sampleJobs: QueuedSourceCandidateIngestionJob[];
  skippedJobs: number;
}

export interface SourceCandidateIngestionJobListOptions {
  claimId?: string;
  interventionId?: string;
  limit?: number;
  region?: string;
  source?: SourceCandidateSource;
  status?: DbIngestionStatus;
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

export interface SourceCandidateIngestionJobSummaryGroup {
  count: number;
  region: string;
  source: DbSourceKind;
  status: DbIngestionStatus;
}

export interface SourceCandidateIngestionJobSummary {
  groups: SourceCandidateIngestionJobSummaryGroup[];
  total: number;
}

export interface QueueSourceCandidateIngestionJobInput {
  claimId?: string;
  discoveryPriority?: SourceCandidateDiscoveryPriority;
  fetchQuery?: string;
  interventionId?: string;
  pubMedRetstart?: number;
  query: string;
  region?: string;
  source: SourceCandidateSource;
}

export interface QueueClaimSourceCandidateIngestionJobsInput {
  claimId: string;
  region?: string;
}

export interface QueueInterventionSourceCandidateDiscoveryJobsInput {
  interventionId: string;
  region?: string;
  searchTerm?: string;
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

export interface QueuedClaimSourceCandidateIngestionJobs {
  claimId: string;
  interventionId: string;
  jobs: QueuedSourceCandidateIngestionJob[];
  label: string;
  pubMedTerm: string;
  pubMedTerms: string[];
  region: string;
  trialTerm: string;
}

export interface QueuedInterventionSourceCandidateDiscoveryJobs {
  interventionId: string;
  jobs: QueuedSourceCandidateIngestionJob[];
  label: string;
  pubMedTerms: string[];
  region: string;
  searchTerm: string;
  trialTerm: string;
}

export type SourceCandidateJobContextField = "interventionId" | "claimId";
export type SourceCandidateDiscoveryPriority = "supplement-name" | "pubmed-deepening";

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
const INGESTION_JOB_STATUS_ORDER = [
  DbIngestionStatus.QUEUED,
  DbIngestionStatus.RUNNING,
  DbIngestionStatus.SUCCEEDED,
  DbIngestionStatus.FAILED,
  DbIngestionStatus.SKIPPED
] satisfies DbIngestionStatus[];

const outcomeMap: Record<DbOutcomeArea, OutcomeArea> = {
  MORTALITY_LIFESPAN: "Mortality/lifespan",
  CARDIOVASCULAR_EVENTS: "Cardiovascular events",
  LDL_APOB_LIPIDS: "LDL/ApoB/lipids",
  BLOOD_PRESSURE: "Blood pressure",
  GLUCOSE_INSULIN_HBA1C: "Glucose/insulin/HbA1c",
  INFLAMMATION: "Inflammation",
  COGNITION: "Cognition",
  SLEEP: "Sleep",
  MOOD_STRESS: "Mood/stress",
  MUSCLE_STRENGTH: "Muscle/strength",
  VO2_MAX_ENDURANCE: "VO2 max/endurance",
  JOINT_TENDON_SKIN: "Joint/tendon/skin",
  EYE_HEALTH: "Eye health",
  IMMUNE_RESPIRATORY: "Immune/respiratory",
  FERTILITY_HORMONES: "Fertility/hormones",
  BIOLOGICAL_AGING_CLOCKS: "Biological aging clocks",
  SAFETY_ADVERSE_EFFECTS: "Safety/adverse effects"
};

const categoryMap: Record<DbInterventionCategory, InterventionCategory> = {
  VITAMIN_MINERAL: "Vitamin/mineral",
  FATTY_ACID: "Fatty acid",
  AMINO_ACID: "Amino acid",
  BOTANICAL_HERBAL: "Botanical/herbal",
  FIBER_PREBIOTIC_PROBIOTIC: "Fiber/prebiotic/probiotic",
  ERGOGENIC_PERFORMANCE_SUPPLEMENT: "Ergogenic/performance supplement",
  NOOTROPIC: "Nootropic",
  HORMONAL_ENDOCRINE_INTERVENTION: "Hormonal/endocrine intervention",
  PEPTIDE_BIOLOGIC: "Peptide/biologic",
  DRUG_GEROPROTECTOR_WATCHLIST: "Drug/geroprotector watchlist",
  FOOD_BEVERAGE: "Food/beverage"
};

export async function listSourceCandidateIngestionJobs(
  options: SourceCandidateIngestionJobListOptions = {}
): Promise<SourceCandidateIngestionJobListItem[]> {
  const source = options.source
    ? sourceKindFromSourceCandidateSource(options.source)
    : undefined;
  const where: Prisma.IngestionJobWhereInput = {
    source: source ?? {
      in: SUPPORTED_SOURCE_CANDIDATE_JOB_SOURCES
    }
  };
  const region = optionalTrimmedString(options.region)?.toUpperCase();
  const interventionId = optionalTrimmedString(options.interventionId);
  const claimId = optionalTrimmedString(options.claimId);

  if (options.status) {
    where.status = options.status;
  }

  if (region) {
    where.region = region;
  }

  if (interventionId) {
    where.interventionId = interventionId;
  }

  if (claimId) {
    where.claimId = claimId;
  }

  const jobs = await prisma.ingestionJob.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: normaliseJobListLimit(options.limit)
  });

  return jobs.map(mapJobListItem);
}

export async function summarizeSourceCandidateIngestionJobs(): Promise<SourceCandidateIngestionJobSummary> {
  const groupedJobs = await prisma.ingestionJob.groupBy({
    by: ["source", "status", "region"],
    where: {
      source: {
        in: SUPPORTED_SOURCE_CANDIDATE_JOB_SOURCES
      }
    },
    _count: {
      _all: true
    }
  });
  const groups = groupedJobs
    .map((group) => ({
      count: group._count._all,
      region: group.region,
      source: group.source,
      status: group.status
    }))
    .sort(compareJobSummaryGroups);

  return {
    groups,
    total: groups.reduce((total, group) => total + group.count, 0)
  };
}

export async function queueClaimSourceCandidateIngestionJobs(
  input: QueueClaimSourceCandidateIngestionJobsInput
): Promise<QueuedClaimSourceCandidateIngestionJobs> {
  const claimId = optionalTrimmedString(input.claimId);

  if (!claimId) {
    throw new Error("Claim id is required to queue claim source-candidate jobs.");
  }

  const claim = await prisma.claim.findUnique({
    where: {
      id: claimId
    },
    select: {
      claimText: true,
      id: true,
      outcome: true,
      intervention: {
        select: {
          id: true,
          category: true,
          name: true,
          synonyms: true
        }
      }
    }
  });

  if (!claim) {
    throw new Error(`Source-candidate ingestion job claim not found: ${claimId}.`);
  }

  const queries = buildSourceSearchQueries({
    claim: {
      claimText: claim.claimText,
      outcome: outcomeMap[claim.outcome]
    },
    intervention: {
      category: categoryMap[claim.intervention.category],
      name: claim.intervention.name,
      synonyms: claim.intervention.synonyms
    }
  });
  const region = normaliseRegion(input.region);
  const queueContext = {
    claimId: claim.id,
    interventionId: claim.intervention.id,
    region
  };

  const jobs: QueuedSourceCandidateIngestionJob[] = [];

  for (const pubMedTerm of queries.pubMedTerms) {
    jobs.push(
      await queueSourceCandidateIngestionJob({
        ...queueContext,
        source: "PubMed",
        query: pubMedTerm
      })
    );
  }

  jobs.push(
    await queueSourceCandidateIngestionJob({
      ...queueContext,
      source: "ClinicalTrials.gov",
      query: queries.trialTerm
    })
  );

  return {
    claimId: claim.id,
    interventionId: claim.intervention.id,
    jobs,
    label: queries.label,
    pubMedTerm: queries.pubMedTerm,
    pubMedTerms: queries.pubMedTerms,
    region,
    trialTerm: queries.trialTerm
  };
}

export async function queueInterventionSourceCandidateDiscoveryJobs(
  input: QueueInterventionSourceCandidateDiscoveryJobsInput
): Promise<QueuedInterventionSourceCandidateDiscoveryJobs> {
  const interventionId = optionalTrimmedString(input.interventionId);

  if (!interventionId) {
    throw new Error("Intervention id is required to queue intervention discovery jobs.");
  }

  const intervention = await prisma.intervention.findUnique({
    where: {
      id: interventionId
    },
    select: {
      id: true,
      category: true,
      name: true,
      synonyms: true
    }
  });

  if (!intervention) {
    throw new Error(`Source-candidate discovery intervention not found: ${interventionId}.`);
  }

  const searchTerm = interventionDiscoverySearchTerm(input.searchTerm, intervention);
  const queries = buildInterventionDiscoverySearchQueries({
    intervention: {
      category: categoryMap[intervention.category],
      name: searchTerm,
      synonyms: []
    }
  });
  const region = normaliseRegion(input.region);
  const queueContext = {
    interventionId: intervention.id,
    region
  };
  const jobs: QueuedSourceCandidateIngestionJob[] = [];

  for (const pubMedTerm of queries.pubMedTerms) {
    jobs.push(
      await queueSourceCandidateIngestionJob({
        ...queueContext,
        discoveryPriority: sourceCandidateDiscoveryPriority(pubMedTerm, searchTerm),
        source: "PubMed",
        query: pubMedTerm
      })
    );
  }

  jobs.push(
    await queueSourceCandidateIngestionJob({
      ...queueContext,
      source: "ClinicalTrials.gov",
      query: queries.trialTerm
    })
  );

  return {
    interventionId: intervention.id,
    jobs,
    label: queries.label,
    pubMedTerms: queries.pubMedTerms,
    region,
    searchTerm,
    trialTerm: queries.trialTerm
  };
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
        metadata: queueMetadata(requestedContext, {
          discoveryPriority: input.discoveryPriority,
          fetchQuery: input.fetchQuery,
          pubMedRetstart: input.pubMedRetstart
        })
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
    const job = await findNextQueuedSourceCandidateIngestionJob();

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

export async function queuePubMedDeepeningCatchUpJobs({
  limit,
  pageSize
}: {
  limit?: number;
  pageSize?: number;
} = {}): Promise<QueuedPubMedDeepeningCatchUpJobs> {
  const safePageSize = normalisePubMedRetmax(pageSize);
  const sourceJobs = await prisma.ingestionJob.findMany({
    where: {
      source: DbSourceKind.PUBMED,
      status: DbIngestionStatus.SUCCEEDED,
      recordsFound: {
        gte: safePageSize
      }
    },
    orderBy: [{ updatedAt: "desc" }],
    take: normalisePubMedDeepeningCatchUpLimit(limit)
  });
  const sampleJobs: QueuedSourceCandidateIngestionJob[] = [];
  let eligibleJobs = 0;
  let existingJobs = 0;
  let newJobs = 0;
  let skippedJobs = 0;

  for (const job of sourceJobs) {
    if (!isCatchUpPubMedDeepeningSourceJob(job)) {
      continue;
    }

    eligibleJobs += 1;

    const candidates = await prisma.sourceCandidate.findMany({
      where: {
        source: DbSourceKind.PUBMED,
        query: sourceCandidateJobFetchQuery(job),
        region: job.region,
        interventionId: optionalTrimmedString(job.interventionId) ?? null,
        claimId: optionalTrimmedString(job.claimId) ?? null
      },
      orderBy: [{ triageScore: "desc" }, { discoveredAt: "desc" }],
      take: safePageSize,
      select: {
        metadata: true,
        triageScore: true
      }
    });

    if (!hasEnoughUsefulPubMedCandidates(candidates)) {
      skippedJobs += 1;
      continue;
    }

    const queued = await queueSourceCandidateIngestionJob({
      claimId: optionalTrimmedString(job.claimId),
      discoveryPriority: "pubmed-deepening",
      fetchQuery: sourceCandidateJobFetchQuery(job),
      interventionId: optionalTrimmedString(job.interventionId),
      pubMedRetstart: safePageSize,
      query: pubMedDeepeningJobQuery(
        sourceCandidateJobFetchQuery(job),
        safePageSize,
        safePageSize
      ),
      region: job.region,
      source: "PubMed"
    });

    if (queued.created) {
      newJobs += 1;
    } else {
      existingJobs += 1;
    }

    if (sampleJobs.length < DEFAULT_JOB_LIST_LIMIT) {
      sampleJobs.push(queued);
    }
  }

  return {
    eligibleJobs,
    existingJobs,
    jobCount: newJobs + existingJobs,
    newJobs,
    sampleJobs,
    skippedJobs
  };
}

async function findNextQueuedSourceCandidateIngestionJob() {
  for (const priority of ["supplement-name", "pubmed-deepening"] as const) {
    const priorityJob = await prisma.ingestionJob.findFirst({
      where: {
        ...queuedSupportedSourceCandidateJobWhere(),
        metadata: {
          path: ["sourceCandidateDiscoveryPriority"],
          equals: priority
        }
      },
      orderBy: [{ createdAt: "asc" }]
    });

    if (priorityJob) {
      return priorityJob;
    }
  }

  return prisma.ingestionJob.findFirst({
    where: queuedSupportedSourceCandidateJobWhere(),
    orderBy: [{ createdAt: "asc" }]
  });
}

function queuedSupportedSourceCandidateJobWhere(): Prisma.IngestionJobWhereInput {
  return {
    status: DbIngestionStatus.QUEUED,
    source: {
      in: SUPPORTED_SOURCE_CANDIDATE_JOB_SOURCES
    }
  };
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
    const deepening = await maybeQueueSourceCandidateDeepeningJob(job, result, options);
    const completed = await completeJob({
      job,
      completedAt: now(),
      status: DbIngestionStatus.SUCCEEDED,
      recordsFound: result.candidates.length,
      recordsChanged: result.upsert.upserted,
      error: null
    });

    return {
      ...completed,
      ...(deepening ? { deepening } : {})
    };
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
        term: sourceCandidateJobFetchQuery(job),
        retmax: options.pubMedRetmax ?? DEFAULT_PUBMED_RETMAX,
        retstart: sourceCandidateJobPubMedRetstart(job)
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

async function maybeQueueSourceCandidateDeepeningJob(
  job: DbIngestionJob,
  result: SourceCandidateIngestionResult,
  options: SourceCandidateIngestionJobOptions
): Promise<SourceCandidateIngestionJobDeepeningResult | undefined> {
  if (job.source !== DbSourceKind.PUBMED || result.source !== "PubMed") {
    return undefined;
  }

  const assessment = pubMedDeepeningDecision(job, result, options);

  if (!assessment.shouldQueue) {
    return {
      ...pubMedDeepeningResultSummary(assessment),
      queued: false,
      reason: assessment.reason
    };
  }

  try {
    const nextJob = await queueSourceCandidateIngestionJob({
      claimId: optionalTrimmedString(job.claimId),
      discoveryPriority: "pubmed-deepening",
      fetchQuery: sourceCandidateJobFetchQuery(job),
      interventionId: optionalTrimmedString(job.interventionId),
      pubMedRetstart: assessment.nextPageStart,
      query: pubMedDeepeningJobQuery(
        sourceCandidateJobFetchQuery(job),
        assessment.nextPageStart,
        normalisePubMedRetmax(options.pubMedRetmax)
      ),
      region: job.region,
      source: "PubMed"
    });

    return {
      ...pubMedDeepeningResultSummary(assessment),
      nextPageStart: assessment.nextPageStart,
      queued: nextJob.created,
      reason: nextJob.created ? "queued next PubMed result page" : "next PubMed result page already exists"
    };
  } catch (error) {
    return {
      ...pubMedDeepeningResultSummary(assessment),
      queued: false,
      reason: `could not queue deeper PubMed page: ${normaliseErrorMessage(error)}`
    };
  }
}

function pubMedDeepeningDecision(
  job: DbIngestionJob,
  result: SourceCandidateIngestionResult,
  options: SourceCandidateIngestionJobOptions
): PubMedDeepeningAssessment {
  const pageSize = normalisePubMedRetmax(options.pubMedRetmax);
  const pageStart = result.pageStart ?? sourceCandidateJobPubMedRetstart(job);

  return assessPubMedDeepeningPage({
    candidates: result.candidates,
    pageSize,
    pageStart,
    totalCount: result.totalCount
  });
}

function pubMedDeepeningResultSummary(assessment: PubMedDeepeningAssessment) {
  return {
    candidateCount: assessment.candidateCount,
    maxResults: assessment.maxResults,
    pageSize: assessment.pageSize,
    pageStart: assessment.pageStart,
    ...(assessment.totalCount !== undefined ? { totalCount: assessment.totalCount } : {}),
    usefulCandidateCount: assessment.usefulCandidateCount,
    usefulRatio: assessment.usefulRatio
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

function interventionDiscoverySearchTerm(
  requestedSearchTerm: string | undefined,
  intervention: { name: string; synonyms: string[] }
) {
  const searchTerm = optionalTrimmedString(requestedSearchTerm);

  if (!searchTerm) {
    return intervention.name;
  }

  const allowedTerms = [intervention.name, ...intervention.synonyms].map(normaliseDiscoveryTerm);

  if (!allowedTerms.includes(normaliseDiscoveryTerm(searchTerm))) {
    throw new Error("Intervention discovery search term must be the intervention name or a saved synonym.");
  }

  return searchTerm;
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

function compareJobSummaryGroups(
  left: SourceCandidateIngestionJobSummaryGroup,
  right: SourceCandidateIngestionJobSummaryGroup
) {
  return (
    INGESTION_JOB_STATUS_ORDER.indexOf(left.status) -
      INGESTION_JOB_STATUS_ORDER.indexOf(right.status) ||
    sourceSummaryOrder(left.source) - sourceSummaryOrder(right.source) ||
    left.region.localeCompare(right.region)
  );
}

function sourceSummaryOrder(source: DbSourceKind) {
  const index = SUPPORTED_SOURCE_CANDIDATE_JOB_SOURCES.indexOf(
    source as SupportedSourceCandidateJobSource
  );

  return index === -1 ? SUPPORTED_SOURCE_CANDIDATE_JOB_SOURCES.length : index;
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

function normaliseDiscoveryTerm(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function sourceCandidateDiscoveryPriority(
  query: string,
  searchTerm: string
): SourceCandidateDiscoveryPriority | undefined {
  return normaliseDiscoveryTerm(query) === normaliseDiscoveryTerm(searchTerm)
    ? "supplement-name"
    : undefined;
}

function queueMetadata(
  context: SourceCandidateJobContext,
  options: {
    discoveryPriority?: SourceCandidateDiscoveryPriority;
    fetchQuery?: string;
    pubMedRetstart?: number;
  } = {}
) {
  return Object.fromEntries(
    [
      ["interventionId", context.interventionId],
      ["claimId", context.claimId],
      ["sourceCandidateDiscoveryPriority", options.discoveryPriority],
      ["sourceCandidateSearchTerm", optionalTrimmedString(options.fetchQuery)],
      ["pubMedRetstart", normaliseOptionalPubMedRetstart(options.pubMedRetstart)]
    ].filter(([, value]) => value !== undefined)
  ) as Prisma.InputJsonObject;
}

function normaliseOptionalPubMedRetstart(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.max(0, Math.trunc(value));
}

function sourceCandidateJobFetchQuery(job: DbIngestionJob) {
  return sourceCandidateJobMetadataString(job, "sourceCandidateSearchTerm") ?? job.query;
}

function sourceCandidateJobPubMedRetstart(job: DbIngestionJob) {
  return sourceCandidateJobMetadataNumber(job, "pubMedRetstart") ?? 0;
}

function sourceCandidateJobMetadataString(job: DbIngestionJob, key: string) {
  const value = sourceCandidateJobMetadata(job)[key];

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function sourceCandidateJobMetadataNumber(job: DbIngestionJob, key: string) {
  const value = sourceCandidateJobMetadata(job)[key];

  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : undefined;
}

function sourceCandidateJobMetadata(job: DbIngestionJob): Record<string, unknown> {
  if (!job.metadata || typeof job.metadata !== "object" || Array.isArray(job.metadata)) {
    return {};
  }

  return job.metadata as Record<string, unknown>;
}

function isCatchUpPubMedDeepeningSourceJob(job: DbIngestionJob) {
  return (
    sourceCandidateJobPubMedRetstart(job) === 0 &&
    sourceCandidateJobMetadataString(job, "sourceCandidateDiscoveryPriority") ===
      "supplement-name" &&
    !/\[PubMed results \d+-\d+\]/i.test(job.query)
  );
}

function pubMedDeepeningJobQuery(term: string, pageStart: number, pageSize: number) {
  const marker = `PubMed results ${pageStart + 1}-${pageStart + pageSize}`;
  const suffix = ` [${marker}]`;
  const normalizedTerm = normaliseQueueQuery(term);
  const maxTermLength = MAX_LIVE_SOURCE_TERM_LENGTH - suffix.length;
  const displayTerm =
    normalizedTerm.length > maxTermLength
      ? normalizedTerm.slice(0, Math.max(maxTermLength - 1, 1)).trim()
      : normalizedTerm;

  return normaliseQueueQuery(`${displayTerm}${suffix}`);
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
