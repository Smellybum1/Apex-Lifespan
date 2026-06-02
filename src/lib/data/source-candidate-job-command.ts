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
  getSourceCandidateByDedupeKey,
  listSourceCandidateAcceptedReferenceMatches,
  listSourceCandidateReviewQueue,
  recordSourceCandidateDecision,
  summarizeSourceCandidateBacklog,
  type RecordSourceCandidateDecisionInput,
  type ReviewedSourceCandidateDecision,
  type SourceCandidateAcceptedReferenceMatches,
  type SourceCandidateBacklogSummary
} from "@/lib/data/source-candidates";
import type {
  Reference,
  SourceCandidate,
  SourceCandidateDecision,
  SourceCandidateSource
} from "@/lib/types";

export interface SourceCandidateJobCommandOptions
  extends SourceCandidateIngestionJobOptions {
  acceptedReferenceId?: string;
  candidateDetailDedupeKey?: string;
  candidateDecision?: SourceCandidateDecision;
  candidateClaimId?: string;
  candidateInterventionId?: string;
  candidateJobId?: string;
  candidateReferenceMatchesDedupeKey?: string;
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
  reviewCandidateDedupeKey?: string;
  reviewDecision?: ReviewedSourceCandidateDecision;
  reviewNote?: string;
  summary: boolean;
}

export interface SourceCandidateJobCommandIo {
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
}

export interface SourceCandidateJobCommandRunners {
  getCandidate?: (dedupeKey: string) => Promise<SourceCandidate | null>;
  listCandidates?: (options: {
    claimId?: string;
    decision?: SourceCandidateDecision;
    ingestionJobId?: string;
    interventionId?: string;
    limit?: number;
    source?: SourceCandidateSource;
  }) => Promise<SourceCandidate[]>;
  listJobs?: (
    options: SourceCandidateIngestionJobListOptions
  ) => Promise<SourceCandidateIngestionJobListItem[]>;
  listReferenceMatches?: (
    dedupeKey: string
  ) => Promise<SourceCandidateAcceptedReferenceMatches | null>;
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
  recordDecision?: (
    input: RecordSourceCandidateDecisionInput
  ) => Promise<SourceCandidate>;
  summarizeBacklog?: () => Promise<SourceCandidateBacklogSummary>;
}

const DEFAULT_JOB_LIMIT = 1;
const MAX_JOB_LIMIT = 25;
const MAX_METADATA_ARRAY_ITEMS = 8;
const MAX_METADATA_VALUE_LENGTH = 240;
const PRINTABLE_METADATA_KEYS = new Set([
  "abstractAvailable",
  "authors",
  "completionDate",
  "conditions",
  "doi",
  "enrollment",
  "enrollmentCount",
  "hasResults",
  "interventions",
  "journal",
  "lastUpdateDate",
  "phase",
  "primaryOutcomes",
  "publicationDate",
  "publicationTypes",
  "resultsFirstPostDate",
  "sponsor",
  "startDate",
  "status",
  "upstreamSource"
]);

export async function runSourceCandidateJobCommand(
  args: readonly string[] = process.argv.slice(2),
  io: SourceCandidateJobCommandIo = {},
  runners: SourceCandidateJobCommandRunners = {}
) {
  const stdout = io.stdout ?? console.log;
  const stderr = io.stderr ?? console.error;
  const getCandidate = runners.getCandidate ?? getSourceCandidateByDedupeKey;
  const listCandidates = runners.listCandidates ?? listSourceCandidateReviewQueue;
  const listJobs = runners.listJobs ?? listSourceCandidateIngestionJobs;
  const listReferenceMatches =
    runners.listReferenceMatches ?? listSourceCandidateAcceptedReferenceMatches;
  const queueJob = runners.queueJob ?? queueSourceCandidateIngestionJob;
  const recordDecision = runners.recordDecision ?? recordSourceCandidateDecision;
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
    if (options.candidateReferenceMatchesDedupeKey) {
      const matches = await listReferenceMatches(
        options.candidateReferenceMatchesDedupeKey
      );

      if (!matches) {
        stderr(
          `Source candidate not found: ${quote(
            options.candidateReferenceMatchesDedupeKey
          )}`
        );
        return 1;
      }

      stdout(formatSourceCandidateReferenceMatches(matches));
      return 0;
    }

    if (options.candidateDetailDedupeKey) {
      const candidate = await getCandidate(options.candidateDetailDedupeKey);

      if (!candidate) {
        stderr(
          `Source candidate not found: ${quote(options.candidateDetailDedupeKey)}`
        );
        return 1;
      }

      stdout(formatSourceCandidateDetail(candidate));
      return 0;
    }

    if (options.reviewDecision && options.reviewCandidateDedupeKey) {
      const candidate = await recordDecision({
        dedupeKey: options.reviewCandidateDedupeKey,
        decision: options.reviewDecision,
        acceptedReferenceId: options.acceptedReferenceId,
        reviewNote: options.reviewNote
      });

      stdout(formatReviewedSourceCandidate(candidate));
      return 0;
    }

    if (options.candidates) {
      const candidates = await listCandidates({
        decision: options.candidateDecision,
        claimId: options.candidateClaimId,
        ingestionJobId: options.candidateJobId,
        interventionId: options.candidateInterventionId,
        limit: options.candidatesLimit,
        source: options.candidateSource
      });

      stdout(formatSourceCandidateReviewQueue(candidates, options.candidateDecision));
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
  let candidateDecisionProvided = false;
  let candidateClaimIdProvided = false;
  let candidateInterventionIdProvided = false;
  let candidateJobIdProvided = false;
  let acceptedReferenceIdProvided = false;
  let limitProvided = false;
  let jobsLimitProvided = false;
  let reviewNoteProvided = false;
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

    if (arg === "--candidate-detail") {
      options.candidateDetailDedupeKey = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--candidate-reference-matches") {
      options.candidateReferenceMatchesDedupeKey = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--accept-candidate") {
      setCandidateReviewOption(
        options,
        "Accepted",
        readRequiredValue(args, index, arg)
      );
      index += 1;
      continue;
    }

    if (arg === "--reject-candidate") {
      setCandidateReviewOption(
        options,
        "Rejected",
        readRequiredValue(args, index, arg)
      );
      index += 1;
      continue;
    }

    if (arg === "--accepted-reference-id") {
      options.acceptedReferenceId = readRequiredValue(args, index, arg);
      acceptedReferenceIdProvided = true;
      index += 1;
      continue;
    }

    if (arg === "--review-note") {
      options.reviewNote = readRequiredValue(args, index, arg);
      reviewNoteProvided = true;
      index += 1;
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

    if (arg === "--candidate-decision") {
      options.candidateDecision = readCandidateDecision(
        readRequiredValue(args, index, arg)
      );
      candidateDecisionProvided = true;
      index += 1;
      continue;
    }

    if (arg === "--candidate-job-id") {
      options.candidateJobId = readRequiredValue(args, index, arg);
      candidateJobIdProvided = true;
      index += 1;
      continue;
    }

    if (arg === "--candidate-intervention-id") {
      options.candidateInterventionId = readRequiredValue(args, index, arg);
      candidateInterventionIdProvided = true;
      index += 1;
      continue;
    }

    if (arg === "--candidate-claim-id") {
      options.candidateClaimId = readRequiredValue(args, index, arg);
      candidateClaimIdProvided = true;
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

  if (options.candidateDetailDedupeKey && options.candidateReferenceMatchesDedupeKey) {
    throw new Error(
      "--candidate-reference-matches cannot be combined with --candidate-detail."
    );
  }

  if (options.candidateDetailDedupeKey && options.summary) {
    throw new Error("--candidate-detail cannot be combined with --summary.");
  }

  if (options.candidateDetailDedupeKey && options.candidates) {
    throw new Error("--candidate-detail cannot be combined with --candidates.");
  }

  if (
    options.candidateDetailDedupeKey &&
    hasCandidateListFilter({
      candidatesLimitProvided,
      candidateDecisionProvided,
      candidateJobIdProvided,
      candidateInterventionIdProvided,
      candidateClaimIdProvided,
      candidateSource: options.candidateSource
    })
  ) {
    throw new Error("Candidate-list filters cannot be combined with --candidate-detail.");
  }

  if (options.candidateDetailDedupeKey && options.reviewDecision) {
    throw new Error("--candidate-detail cannot be combined with review options.");
  }

  if (options.candidateDetailDedupeKey && options.jobs) {
    throw new Error("--candidate-detail cannot be combined with --jobs.");
  }

  if (options.candidateDetailDedupeKey && options.queueSource) {
    throw new Error("--candidate-detail cannot be combined with queue options.");
  }

  if (
    options.candidateDetailDedupeKey &&
    (options.region || options.interventionId || options.claimId)
  ) {
    throw new Error("--candidate-detail cannot be combined with queue metadata.");
  }

  if (
    options.candidateDetailDedupeKey &&
    (options.jobId || limitProvided || sourceLimitProvided)
  ) {
    throw new Error("--candidate-detail cannot be combined with run options.");
  }

  if (options.candidateReferenceMatchesDedupeKey && options.summary) {
    throw new Error("--candidate-reference-matches cannot be combined with --summary.");
  }

  if (options.candidateReferenceMatchesDedupeKey && options.candidates) {
    throw new Error("--candidate-reference-matches cannot be combined with --candidates.");
  }

  if (
    options.candidateReferenceMatchesDedupeKey &&
    hasCandidateListFilter({
      candidatesLimitProvided,
      candidateDecisionProvided,
      candidateJobIdProvided,
      candidateInterventionIdProvided,
      candidateClaimIdProvided,
      candidateSource: options.candidateSource
    })
  ) {
    throw new Error(
      "Candidate-list filters cannot be combined with --candidate-reference-matches."
    );
  }

  if (options.candidateReferenceMatchesDedupeKey && options.reviewDecision) {
    throw new Error(
      "--candidate-reference-matches cannot be combined with review options."
    );
  }

  if (options.candidateReferenceMatchesDedupeKey && options.jobs) {
    throw new Error("--candidate-reference-matches cannot be combined with --jobs.");
  }

  if (options.candidateReferenceMatchesDedupeKey && options.queueSource) {
    throw new Error(
      "--candidate-reference-matches cannot be combined with queue options."
    );
  }

  if (
    options.candidateReferenceMatchesDedupeKey &&
    (options.region || options.interventionId || options.claimId)
  ) {
    throw new Error(
      "--candidate-reference-matches cannot be combined with queue metadata."
    );
  }

  if (
    options.candidateReferenceMatchesDedupeKey &&
    (options.jobId || limitProvided || sourceLimitProvided)
  ) {
    throw new Error("--candidate-reference-matches cannot be combined with run options.");
  }

  if (acceptedReferenceIdProvided && options.reviewDecision !== "Accepted") {
    throw new Error("--accepted-reference-id requires --accept-candidate.");
  }

  if (reviewNoteProvided && !options.reviewDecision) {
    throw new Error("--review-note requires --accept-candidate or --reject-candidate.");
  }

  if (options.reviewDecision === "Accepted" && !options.acceptedReferenceId) {
    throw new Error("--accept-candidate requires --accepted-reference-id.");
  }

  if (options.reviewDecision && options.summary) {
    throw new Error("Review options cannot be combined with --summary.");
  }

  if (options.reviewDecision && options.candidates) {
    throw new Error("Review options cannot be combined with --candidates.");
  }

  if (
    options.reviewDecision &&
    hasCandidateListFilter({
      candidatesLimitProvided,
      candidateDecisionProvided,
      candidateJobIdProvided,
      candidateInterventionIdProvided,
      candidateClaimIdProvided,
      candidateSource: options.candidateSource
    })
  ) {
    throw new Error("Candidate-list filters cannot be combined with review options.");
  }

  if (options.reviewDecision && options.jobs) {
    throw new Error("Review options cannot be combined with --jobs.");
  }

  if (options.reviewDecision && options.queueSource) {
    throw new Error("Review options cannot be combined with queue options.");
  }

  if (options.reviewDecision && (options.region || options.interventionId || options.claimId)) {
    throw new Error("Review options cannot be combined with queue metadata.");
  }

  if (options.reviewDecision && (options.jobId || limitProvided || sourceLimitProvided)) {
    throw new Error("Review options cannot be combined with run options.");
  }

  if (
    hasCandidateListFilter({
      candidatesLimitProvided,
      candidateDecisionProvided,
      candidateJobIdProvided,
      candidateInterventionIdProvided,
      candidateClaimIdProvided,
      candidateSource: options.candidateSource
    }) &&
    !options.candidates
  ) {
    throw new Error(
      "Candidate-list filters require --candidates."
    );
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
    "  --candidate-detail <dedupe-key>   Print one source-candidate detail record.",
    "  --candidate-reference-matches <dedupe-key> Print curated reference ids eligible for candidate acceptance.",
    "  --accept-candidate <dedupe-key>   Mark a source candidate accepted.",
    "  --reject-candidate <dedupe-key>   Mark a source candidate rejected.",
    "  --accepted-reference-id <id>      Required curated reference id for --accept-candidate.",
    "  --review-note <note>              Human review note for accepted/rejected candidates.",
    "  --candidates                      Print pending source-candidate review queue rows.",
    "  --candidates-limit <count>        Candidate count for --candidates (default 25, max 50).",
    "  --candidate-source <source>       Candidate source: pubmed or clinical-trials.",
    "  --candidate-decision <decision>   Candidate decision: pending, accepted, or rejected.",
    "  --candidate-job-id <id>           Filter --candidates by ingestion job id.",
    "  --candidate-intervention-id <id>  Filter --candidates by intervention id.",
    "  --candidate-claim-id <id>         Filter --candidates by claim id.",
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

function formatReviewedSourceCandidate(candidate: SourceCandidate) {
  const parts = [
    `[${candidate.decision}] source-candidate`,
    candidate.source,
    candidate.region,
    `dedupe=${quote(candidate.dedupeKey)}`,
    `title=${quote(candidate.title)}`,
    `reviewStatus=${quote(candidate.reviewStatus)}`
  ];

  if (candidate.acceptedReferenceId) {
    parts.push(`acceptedReference=${candidate.acceptedReferenceId}`);
  }

  if (candidate.reviewNote) {
    parts.push(`note=${quote(candidate.reviewNote)}`);
  }

  return parts.join(" ");
}

function formatSourceCandidateDetail(candidate: SourceCandidate) {
  const lines = [
    "Source-candidate detail",
    `dedupe=${quote(candidate.dedupeKey)}`,
    `source=${quote(candidate.source)}`,
    `externalId=${quote(candidate.externalId)}`,
    `region=${quote(candidate.region)}`,
    `query=${quote(candidate.query)}`,
    `title=${quote(candidate.title)}`,
    `url=${candidate.url}`,
    `triage=${candidate.triageScore}/100`,
    `decision=${quote(candidate.decision)}`,
    `reviewStatus=${quote(candidate.reviewStatus)}`
  ];

  if (candidate.publishedYear !== undefined) {
    lines.push(`publishedYear=${candidate.publishedYear}`);
  }

  if (candidate.sourceType) {
    lines.push(`sourceType=${quote(candidate.sourceType)}`);
  }

  if (candidate.abstractAvailable !== undefined) {
    lines.push(`abstractAvailable=${candidate.abstractAvailable}`);
  }

  if (candidate.interventionId) {
    lines.push(`intervention=${candidate.interventionId}`);
  }

  if (candidate.claimId) {
    lines.push(`claim=${candidate.claimId}`);
  }

  if (candidate.ingestionJobId) {
    lines.push(`ingestionJob=${candidate.ingestionJobId}`);
  }

  if (candidate.acceptedReferenceId) {
    lines.push(`acceptedReference=${candidate.acceptedReferenceId}`);
  }

  if (candidate.reviewedAt) {
    lines.push(`reviewed=${candidate.reviewedAt}`);
  }

  if (candidate.reviewNote) {
    lines.push(`reviewNote=${quote(candidate.reviewNote)}`);
  }

  lines.push(formatStringList("triageReasons", candidate.triageReasons));

  const metadataLines = formatMetadata(candidate.metadata);

  if (metadataLines.length > 0) {
    lines.push("metadata:");
    lines.push(...metadataLines.map((line) => `  ${line}`));
  }

  return lines.join("\n");
}

function formatSourceCandidateReferenceMatches(
  matches: SourceCandidateAcceptedReferenceMatches
) {
  const heading = `Source-candidate accepted-reference matches: total=${matches.references.length} dedupe=${quote(matches.candidate.dedupeKey)}`;

  if (matches.references.length === 0) {
    return heading;
  }

  return [
    heading,
    ...matches.references.map(formatSourceCandidateReferenceMatch)
  ].join("\n");
}

function formatSourceCandidateReferenceMatch(reference: Reference) {
  const parts = [
    `- reference=${quote(reference.id)}`,
    `source=${quote(reference.source)}`,
    `title=${quote(reference.title)}`,
    `url=${reference.url}`
  ];

  if (reference.identifier) {
    parts.push(`identifier=${quote(reference.identifier)}`);
  }

  if (reference.year !== undefined) {
    parts.push(`year=${reference.year}`);
  }

  return parts.join(" ");
}

function formatSourceCandidateReviewQueue(
  candidates: SourceCandidate[],
  decision?: SourceCandidateDecision
) {
  const heading = decision && decision !== "Pending review"
    ? `Source-candidate review records: decision=${quote(decision)}`
    : "Source-candidate review queue";

  if (candidates.length === 0) {
    return `${heading}: total=0`;
  }

  return [
    `${heading}: total=${candidates.length}`,
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

  if (candidate.decision !== "Pending review") {
    parts.push(`decision=${quote(candidate.decision)}`);
  }

  if (candidate.reviewStatus !== "Unreviewed AI draft") {
    parts.push(`reviewStatus=${quote(candidate.reviewStatus)}`);
  }

  if (candidate.acceptedReferenceId) {
    parts.push(`acceptedReference=${candidate.acceptedReferenceId}`);
  }

  if (candidate.reviewedAt) {
    parts.push(`reviewed=${candidate.reviewedAt}`);
  }

  if (candidate.reviewNote) {
    parts.push(`note=${quote(candidate.reviewNote)}`);
  }

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

function formatStringList(label: string, values: string[]) {
  if (values.length === 0) {
    return `${label}: none`;
  }

  return [`${label}:`, ...values.map((value) => `  - ${quote(value)}`)].join("\n");
}

function formatMetadata(metadata: Record<string, unknown>) {
  return Object.entries(metadata)
    .filter(([key, value]) => PRINTABLE_METADATA_KEYS.has(key) && isPrintableMetadataValue(value))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${formatMetadataValue(value)}`);
}

function formatMetadataValue(value: unknown): string {
  if (Array.isArray(value)) {
    const visibleItems = value.slice(0, MAX_METADATA_ARRAY_ITEMS).map(formatMetadataScalar);
    const suffix =
      value.length > MAX_METADATA_ARRAY_ITEMS
        ? `, +${value.length - MAX_METADATA_ARRAY_ITEMS} more`
        : "";

    return quote(`${visibleItems.join(", ")}${suffix}`);
  }

  if (typeof value === "string") {
    return quote(formatMetadataScalar(value));
  }

  return formatMetadataScalar(value);
}

function isPrintableMetadataValue(value: unknown) {
  if (value === null) {
    return false;
  }

  if (["string", "number", "boolean"].includes(typeof value)) {
    return true;
  }

  return Array.isArray(value) && value.every((item) => item !== null && typeof item !== "object");
}

function formatMetadataScalar(value: unknown) {
  const text = String(value);

  if (text.length <= MAX_METADATA_VALUE_LENGTH) {
    return text;
  }

  return `${text.slice(0, MAX_METADATA_VALUE_LENGTH - 3)}...`;
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

function readCandidateDecision(value: string): SourceCandidateDecision {
  const normalised = value.trim().toLowerCase();

  if (normalised === "pending" || normalised === "pending-review") {
    return "Pending review";
  }

  if (normalised === "accepted") {
    return "Accepted";
  }

  if (normalised === "rejected") {
    return "Rejected";
  }

  throw new Error("--candidate-decision must be pending, accepted, or rejected.");
}

function hasCandidateListFilter({
  candidatesLimitProvided,
  candidateDecisionProvided,
  candidateJobIdProvided,
  candidateInterventionIdProvided,
  candidateClaimIdProvided,
  candidateSource
}: {
  candidatesLimitProvided: boolean;
  candidateDecisionProvided: boolean;
  candidateJobIdProvided: boolean;
  candidateInterventionIdProvided: boolean;
  candidateClaimIdProvided: boolean;
  candidateSource?: SourceCandidateSource;
}) {
  return Boolean(
    candidatesLimitProvided ||
      candidateSource ||
      candidateDecisionProvided ||
      candidateJobIdProvided ||
      candidateInterventionIdProvided ||
      candidateClaimIdProvided
  );
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

function setCandidateReviewOption(
  options: SourceCandidateJobCommandOptions,
  decision: ReviewedSourceCandidateDecision,
  dedupeKey: string
) {
  if (options.reviewDecision) {
    throw new Error("Only one source-candidate review option can be used at a time.");
  }

  options.reviewDecision = decision;
  options.reviewCandidateDedupeKey = dedupeKey;
}

function quote(value: string) {
  return JSON.stringify(value);
}
