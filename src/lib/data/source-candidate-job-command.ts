import { Buffer } from "node:buffer";

import {
  listSourceCandidateIngestionJobs,
  queueClaimSourceCandidateIngestionJobs,
  queueSourceCandidateIngestionJob,
  runNextSourceCandidateIngestionJob,
  runSourceCandidateIngestionJob,
  summarizeSourceCandidateIngestionJobs,
  type QueueClaimSourceCandidateIngestionJobsInput,
  type QueueSourceCandidateIngestionJobInput,
  type QueuedClaimSourceCandidateIngestionJobs,
  type QueuedSourceCandidateIngestionJob,
  type SourceCandidateIngestionJobListItem,
  type SourceCandidateIngestionJobListOptions,
  type SourceCandidateIngestionJobOptions,
  type SourceCandidateIngestionJobRunResult,
  type SourceCandidateIngestionJobSummary
} from "@/lib/data/source-candidate-jobs";
import {
  extractAcceptedSourceCandidateStudy,
  getSourceCandidateCurationDraft,
  getSourceCandidateCurationStatus,
  getSourceCandidateByDedupeKey,
  linkAcceptedSourceCandidateClaim,
  listSourceCandidateAcceptedReferenceMatches,
  listSourceCandidateCurationHandoff,
  listSourceCandidateIdentityGroups,
  listSourceCandidateReviewOverview,
  listSourceCandidateReviewQueue,
  listSourceCandidateSiblings,
  recordSourceCandidateDecision,
  summarizeSourceCandidateBacklog,
  summarizeSourceCandidateCurationHandoff,
  type ExtractAcceptedSourceCandidateStudyInput,
  type ExtractedSourceCandidateStudy,
  type LinkAcceptedSourceCandidateClaimInput,
  type LinkedSourceCandidateClaim,
  type RecordSourceCandidateDecisionInput,
  type ReviewedSourceCandidateDecision,
  type SourceCandidateAcceptedReferenceMatches,
  type SourceCandidateBacklogSummary,
  type SourceCandidateCurationDraft,
  type SourceCandidateCurationHandoffOptions,
  type SourceCandidateCurationHandoffSummary,
  type SourceCandidateCurationStatus,
  type SourceCandidateCurationStatusKind,
  type SourceCandidateIdentityGroup,
  type SourceCandidateReviewOverview,
  type SourceCandidateStudyExtractionSourceType,
  type SourceCandidateSiblingOptions,
  type SourceCandidateSiblings
} from "@/lib/data/source-candidates";
import type {
  Reference,
  SourceCandidate,
  SourceCandidateDecision,
  SourceCandidateSource
} from "@/lib/types";

const SOURCE_CANDIDATE_REVIEW_FLAG_CODES = [
  "broad-safety-query",
  "low-title-query-overlap"
] as const;
const SOURCE_CANDIDATE_DUPLICATE_IDENTITY_CAUTION =
  "Same source/external id appears in multiple candidate contexts; compare duplicate identity rows before accepting or rejecting any candidate.";

type SourceCandidateReviewFlagCode =
  (typeof SOURCE_CANDIDATE_REVIEW_FLAG_CODES)[number];

export interface SourceCandidateJobCommandOptions
  extends SourceCandidateIngestionJobOptions {
  acceptedReferenceId?: string;
  candidateCurationHandoff?: boolean;
  candidateCurationHandoffLimit?: number;
  candidateCurationHandoffStatus?: SourceCandidateCurationStatusKind;
  candidateCurationDraftDedupeKey?: string;
  candidateCurationStatusDedupeKey?: string;
  candidateDetailDedupeKey?: string;
  candidateDecision?: SourceCandidateDecision;
  candidateDuplicates?: boolean;
  candidateClaimMissing?: boolean;
  candidateClaimId?: string;
  candidateExternalId?: string;
  candidateInterventionMissing?: boolean;
  candidateInterventionId?: string;
  candidateJobId?: string;
  candidateReferenceMatchesDedupeKey?: string;
  candidateRegion?: string;
  candidateReviewFlag?: SourceCandidateReviewFlagCode;
  candidateReviewFlags?: boolean;
  candidateReviewFlagsLimit?: number;
  candidateReviewOverview?: boolean;
  candidateReviewOverviewLimit?: number;
  candidateReviewPacketDedupeKey?: string;
  candidateSiblingsDedupeKey?: string;
  candidateSiblingsLimit?: number;
  candidateSource?: SourceCandidateSource;
  candidates?: boolean;
  candidatesLimit?: number;
  claimId?: string;
  claimLinkNote?: string;
  claimLinkRelevance?: number;
  extractCandidateStudyDedupeKey?: string;
  help: boolean;
  interventionId?: string;
  jobId?: string;
  jobs?: boolean;
  jobsClaimId?: string;
  jobsInterventionId?: string;
  jobsLimit?: number;
  jobsRegion?: string;
  jobsSource?: SourceCandidateSource;
  jobsStatus?: SourceCandidateIngestionJobListOptions["status"];
  linkCandidateClaimDedupeKey?: string;
  limit: number;
  queueClaimSourcesClaimId?: string;
  queueQuery?: string;
  queueSource?: SourceCandidateSource;
  region?: string;
  reviewCandidateDedupeKey?: string;
  reviewDecision?: ReviewedSourceCandidateDecision;
  reviewNote?: string;
  runNextJobs?: boolean;
  studyAbstract?: string;
  studyAdverseEvents?: string;
  studyDose?: string;
  studyDuration?: string;
  studyFundingConflicts?: string;
  studyInterventionName?: string;
  studyMainResults?: string;
  studyOutcomes?: string[];
  studyPopulation?: string;
  studyRelevance?: number;
  studyRiskOfBias?: string;
  studySampleSize?: string;
  studySourceType?: SourceCandidateStudyExtractionSourceType;
  studyUpdateExisting?: boolean;
  summary: boolean;
}

export interface SourceCandidateJobCommandIo {
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
}

export interface SourceCandidateJobCommandRunners {
  getCurationDraft?: (
    dedupeKey: string
  ) => Promise<SourceCandidateCurationDraft | null>;
  extractCandidateStudy?: (
    input: ExtractAcceptedSourceCandidateStudyInput
  ) => Promise<ExtractedSourceCandidateStudy>;
  getCurationStatus?: (
    dedupeKey: string
  ) => Promise<SourceCandidateCurationStatus | null>;
  getCandidate?: (dedupeKey: string) => Promise<SourceCandidate | null>;
  listCurationHandoff?: (
    options: SourceCandidateCurationHandoffOptions
  ) => Promise<SourceCandidateCurationStatus[]>;
  listIdentityGroups?: (options: {
    claimId?: string;
    decision?: SourceCandidateDecision;
    externalId?: string;
    ingestionJobId?: string;
    interventionId?: string;
    limit?: number;
    source?: SourceCandidateSource;
  }) => Promise<SourceCandidateIdentityGroup[]>;
  listReviewOverview?: (options: {
    claimId?: string;
    ingestionJobId?: string;
    interventionId?: string;
    limit?: number;
    region?: string;
    source?: SourceCandidateSource;
  }) => Promise<SourceCandidateReviewOverview>;
  listCandidates?: (options: {
    claimId?: string;
    decision?: SourceCandidateDecision;
    externalId?: string;
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
  listSiblings?: (
    dedupeKey: string,
    options: SourceCandidateSiblingOptions
  ) => Promise<SourceCandidateSiblings | null>;
  linkCandidateClaim?: (
    input: LinkAcceptedSourceCandidateClaimInput
  ) => Promise<LinkedSourceCandidateClaim>;
  queueJob?: (
    input: QueueSourceCandidateIngestionJobInput
  ) => Promise<QueuedSourceCandidateIngestionJob>;
  queueClaimSources?: (
    input: QueueClaimSourceCandidateIngestionJobsInput
  ) => Promise<QueuedClaimSourceCandidateIngestionJobs>;
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
  summarizeCurationHandoff?: () => Promise<SourceCandidateCurationHandoffSummary>;
  summarizeJobs?: () => Promise<SourceCandidateIngestionJobSummary>;
}

interface SourceCandidateReviewPacket {
  candidate: SourceCandidate;
  referenceMatches: SourceCandidateAcceptedReferenceMatches;
  siblings: SourceCandidateSiblings;
}

const DEFAULT_JOB_LIMIT = 1;
const MAX_JOB_LIMIT = 25;
const MAX_METADATA_ARRAY_ITEMS = 8;
const MAX_METADATA_VALUE_LENGTH = 240;
const MIN_REVIEW_QUERY_TOKENS_FOR_OVERLAP_FLAG = 3;
const DEFAULT_REVIEW_GROUP_CANDIDATE_LIMIT = 10;
const SUMMARY_REVIEW_FLAG_GROUP_LIMIT = 50;
const reviewQueryTokenStopwords = new Set([
  "and",
  "clinical",
  "effects",
  "evidence",
  "for",
  "human",
  "humans",
  "of",
  "prevention",
  "randomised",
  "randomized",
  "review",
  "study",
  "systematic",
  "the",
  "trial",
  "trials",
  "with"
]);
const CANDIDATE_KEY_B64_PREFIX = "b64:";
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
  const extractCandidateStudy =
    runners.extractCandidateStudy ?? extractAcceptedSourceCandidateStudy;
  const getCurationDraft =
    runners.getCurationDraft ?? getSourceCandidateCurationDraft;
  const getCurationStatus =
    runners.getCurationStatus ?? getSourceCandidateCurationStatus;
  const getCandidate = runners.getCandidate ?? getSourceCandidateByDedupeKey;
  const listCurationHandoff =
    runners.listCurationHandoff ?? listSourceCandidateCurationHandoff;
  const listIdentityGroups =
    runners.listIdentityGroups ?? listSourceCandidateIdentityGroups;
  const listReviewOverview =
    runners.listReviewOverview ?? listSourceCandidateReviewOverview;
  const listCandidates = runners.listCandidates ?? listSourceCandidateReviewQueue;
  const listJobs = runners.listJobs ?? listSourceCandidateIngestionJobs;
  const listReferenceMatches =
    runners.listReferenceMatches ?? listSourceCandidateAcceptedReferenceMatches;
  const listSiblings = runners.listSiblings ?? listSourceCandidateSiblings;
  const linkCandidateClaim =
    runners.linkCandidateClaim ?? linkAcceptedSourceCandidateClaim;
  const queueJob = runners.queueJob ?? queueSourceCandidateIngestionJob;
  const queueClaimSources =
    runners.queueClaimSources ?? queueClaimSourceCandidateIngestionJobs;
  const recordDecision = runners.recordDecision ?? recordSourceCandidateDecision;
  const runJobById = runners.runJobById ?? runSourceCandidateIngestionJob;
  const runNextJob = runners.runNextJob ?? runNextSourceCandidateIngestionJob;
  const summarizeBacklog = runners.summarizeBacklog ?? summarizeSourceCandidateBacklog;
  const summarizeCurationHandoff =
    runners.summarizeCurationHandoff ?? summarizeSourceCandidateCurationHandoff;
  const summarizeJobs =
    runners.summarizeJobs ?? summarizeSourceCandidateIngestionJobs;

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
    if (options.candidateCurationHandoff) {
      const statuses = await listCurationHandoff({
        claimId: options.candidateClaimId,
        ...sourceCandidateMissingFilterOptions(options),
        ingestionJobId: options.candidateJobId,
        interventionId: options.candidateInterventionId,
        region: options.candidateRegion,
        source: options.candidateSource,
        status: options.candidateCurationHandoffStatus,
        limit: options.candidateCurationHandoffLimit
      });

      const duplicateIdentityCandidateCounts =
        await sourceCandidateDuplicateIdentityCandidateCountMap(
          statuses.map((status) => status.candidate),
          listSiblings
        );

      stdout(
        formatSourceCandidateCurationHandoff(statuses, {
          duplicateIdentityCandidateCounts
        })
      );
      return 0;
    }

    if (options.candidateCurationDraftDedupeKey) {
      const draft = await getCurationDraft(options.candidateCurationDraftDedupeKey);

      if (!draft) {
        stderr(
          `Source candidate not found: ${quote(options.candidateCurationDraftDedupeKey)}`
        );
        return 1;
      }

      stdout(
        formatSourceCandidateCurationDraft(draft, {
          duplicateIdentityCandidateCount:
            await sourceCandidateDuplicateIdentityCandidateCountForDedupeKey(
              draft.status.candidate.dedupeKey,
              listSiblings
            )
        })
      );
      return 0;
    }

    if (options.candidateCurationStatusDedupeKey) {
      const status = await getCurationStatus(options.candidateCurationStatusDedupeKey);

      if (!status) {
        stderr(
          `Source candidate not found: ${quote(
            options.candidateCurationStatusDedupeKey
          )}`
        );
        return 1;
      }

      stdout(
        formatSourceCandidateCurationStatus(status, {
          duplicateIdentityCandidateCount:
            await sourceCandidateDuplicateIdentityCandidateCountForDedupeKey(
              status.candidate.dedupeKey,
              listSiblings
            )
        })
      );
      return 0;
    }

    if (options.candidateReviewFlags) {
      const overview = await listReviewOverview({
        claimId: options.candidateClaimId,
        ...sourceCandidateMissingFilterOptions(options),
        ingestionJobId: options.candidateJobId,
        interventionId: options.candidateInterventionId,
        limit: options.candidateReviewFlagsLimit,
        region: options.candidateRegion,
        source: options.candidateSource
      });

      stdout(formatSourceCandidateReviewFlags(overview, options.candidateReviewFlag));
      return 0;
    }

    if (options.candidateReviewOverview) {
      const overview = await listReviewOverview({
        claimId: options.candidateClaimId,
        ...sourceCandidateMissingFilterOptions(options),
        ingestionJobId: options.candidateJobId,
        interventionId: options.candidateInterventionId,
        limit: options.candidateReviewOverviewLimit,
        region: options.candidateRegion,
        source: options.candidateSource
      });

      stdout(formatSourceCandidateReviewOverview(overview));
      return 0;
    }

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

      const siblings = await listSiblings(options.candidateReferenceMatchesDedupeKey, {});

      if (!siblings) {
        stderr(
          `Source candidate not found: ${quote(
            options.candidateReferenceMatchesDedupeKey
          )}`
        );
        return 1;
      }

      stdout(
        formatSourceCandidateReferenceMatches(matches, {
          duplicateIdentityCandidateCount:
            sourceCandidateSiblingDuplicateIdentityCount(siblings)
        })
      );
      return 0;
    }

    if (options.candidateReviewPacketDedupeKey) {
      const [candidate, referenceMatches, siblings] = await Promise.all([
        getCandidate(options.candidateReviewPacketDedupeKey),
        listReferenceMatches(options.candidateReviewPacketDedupeKey),
        listSiblings(options.candidateReviewPacketDedupeKey, {})
      ]);

      if (!candidate || !referenceMatches || !siblings) {
        stderr(
          `Source candidate not found: ${quote(options.candidateReviewPacketDedupeKey)}`
        );
        return 1;
      }

      stdout(
        formatSourceCandidateReviewPacket({
          candidate,
          referenceMatches,
          siblings
        })
      );
      return 0;
    }

    if (options.candidateSiblingsDedupeKey) {
      const siblings = await listSiblings(options.candidateSiblingsDedupeKey, {
        limit: options.candidateSiblingsLimit
      });

      if (!siblings) {
        stderr(
          `Source candidate not found: ${quote(options.candidateSiblingsDedupeKey)}`
        );
        return 1;
      }

      stdout(formatSourceCandidateSiblings(siblings));
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
      const candidate = await recordDecision(
        options.reviewDecision === "Accepted"
          ? {
              acceptedReferenceId: options.acceptedReferenceId!,
              dedupeKey: options.reviewCandidateDedupeKey,
              decision: "Accepted",
              reviewNote: options.reviewNote!
            }
          : {
              dedupeKey: options.reviewCandidateDedupeKey,
              decision: "Rejected",
              reviewNote: options.reviewNote!
            }
      );

      stdout(formatReviewedSourceCandidate(candidate));
      return 0;
    }

    if (options.linkCandidateClaimDedupeKey) {
      const result = await linkCandidateClaim({
        dedupeKey: options.linkCandidateClaimDedupeKey,
        note: options.claimLinkNote,
        relevance: options.claimLinkRelevance
      });

      stdout(formatLinkedSourceCandidateClaim(result));
      return 0;
    }

    if (options.extractCandidateStudyDedupeKey) {
      const result = await extractCandidateStudy({
        abstract: options.studyAbstract,
        adverseEvents: options.studyAdverseEvents ?? "",
        dedupeKey: options.extractCandidateStudyDedupeKey,
        dose: options.studyDose,
        duration: options.studyDuration,
        fundingConflicts: options.studyFundingConflicts ?? "",
        interventionName: options.studyInterventionName ?? "",
        mainResults: options.studyMainResults,
        outcomes: options.studyOutcomes ?? [],
        population: options.studyPopulation ?? "",
        relevance: options.studyRelevance,
        riskOfBias: options.studyRiskOfBias ?? "",
        sampleSize: options.studySampleSize ?? "",
        sourceType: options.studySourceType,
        updateExisting: options.studyUpdateExisting
      });

      stdout(formatExtractedSourceCandidateStudy(result));
      return 0;
    }

    if (options.candidates) {
      const candidateListOptions = {
        decision: options.candidateDecision,
        claimId: options.candidateClaimId,
        ...sourceCandidateMissingFilterOptions(options),
        externalId: options.candidateExternalId,
        ingestionJobId: options.candidateJobId,
        interventionId: options.candidateInterventionId,
        limit: options.candidatesLimit,
        region: options.candidateRegion,
        source: options.candidateSource
      };

      if (options.candidateDuplicates) {
        const groups = await listIdentityGroups(candidateListOptions);

        stdout(formatSourceCandidateIdentityGroups(groups, options.candidateDecision));
        return 0;
      }

      const candidates = await listCandidates(candidateListOptions);

      stdout(formatSourceCandidateReviewQueue(candidates, options.candidateDecision));
      return 0;
    }

    if (options.jobs) {
      const listJobOptions: SourceCandidateIngestionJobListOptions = {
        limit: options.jobsLimit
      };

      if (options.jobsClaimId) {
        listJobOptions.claimId = options.jobsClaimId;
      }

      if (options.jobsInterventionId) {
        listJobOptions.interventionId = options.jobsInterventionId;
      }

      if (options.jobsRegion) {
        listJobOptions.region = options.jobsRegion;
      }

      if (options.jobsSource) {
        listJobOptions.source = options.jobsSource;
      }

      if (options.jobsStatus) {
        listJobOptions.status = options.jobsStatus;
      }

      const jobs = await listJobs(listJobOptions);

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

    if (options.queueClaimSourcesClaimId) {
      const result = await queueClaimSources({
        claimId: options.queueClaimSourcesClaimId,
        region: options.region
      });

      stdout(formatQueuedClaimSourceCandidateJobs(result));
      return 0;
    }

    if (options.summary) {
      const [
        jobSummary,
        backlogSummary,
        curationHandoffSummary,
        reviewOverview
      ] = await Promise.all([
        summarizeJobs(),
        summarizeBacklog(),
        summarizeCurationHandoff(),
        listReviewOverview({ limit: SUMMARY_REVIEW_FLAG_GROUP_LIMIT })
      ]);

      stdout(
        formatSourceCandidateWorkflowSummary(
          jobSummary,
          backlogSummary,
          curationHandoffSummary,
          reviewOverview
        )
      );
      return 0;
    }

    if (options.jobId || options.runNextJobs) {
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
    }

    stdout(commandUsage());
    return 0;
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
  let candidateClaimMissingProvided = false;
  let candidateExternalIdProvided = false;
  let candidateInterventionIdProvided = false;
  let candidateInterventionMissingProvided = false;
  let candidateJobIdProvided = false;
  let candidateCurationHandoffLimitProvided = false;
  let candidateCurationHandoffStatusProvided = false;
  let candidateRegionProvided = false;
  let candidateReviewFlagProvided = false;
  let candidateReviewFlagsLimitProvided = false;
  let candidateReviewOverviewLimitProvided = false;
  let candidateSiblingsLimitProvided = false;
  let acceptedReferenceIdProvided = false;
  let claimLinkNoteProvided = false;
  let claimLinkRelevanceProvided = false;
  let limitProvided = false;
  let jobsClaimIdProvided = false;
  let jobsInterventionIdProvided = false;
  let jobsLimitProvided = false;
  let jobsRegionProvided = false;
  let jobsSourceProvided = false;
  let jobsStatusProvided = false;
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

    if (arg === "--run-next") {
      options.runNextJobs = true;
      continue;
    }

    if (arg === "--summary") {
      options.summary = true;
      continue;
    }

    if (arg === "--candidate-detail") {
      options.candidateDetailDedupeKey = readCandidateKeyValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--candidate-curation-status") {
      options.candidateCurationStatusDedupeKey = readCandidateKeyValue(
        args,
        index,
        arg
      );
      index += 1;
      continue;
    }

    if (arg === "--candidate-curation-draft") {
      options.candidateCurationDraftDedupeKey = readCandidateKeyValue(
        args,
        index,
        arg
      );
      index += 1;
      continue;
    }

    if (arg === "--candidate-curation-handoff") {
      options.candidateCurationHandoff = true;
      continue;
    }

    if (arg === "--candidate-curation-handoff-limit") {
      options.candidateCurationHandoffLimit = readPositiveInteger(
        args,
        index,
        arg,
        50
      );
      candidateCurationHandoffLimitProvided = true;
      index += 1;
      continue;
    }

    if (arg === "--candidate-curation-handoff-status") {
      options.candidateCurationHandoffStatus = readCurationHandoffStatus(
        readRequiredValue(args, index, arg)
      );
      candidateCurationHandoffStatusProvided = true;
      index += 1;
      continue;
    }

    if (arg === "--candidate-reference-matches") {
      options.candidateReferenceMatchesDedupeKey = readCandidateKeyValue(
        args,
        index,
        arg
      );
      index += 1;
      continue;
    }

    if (arg === "--candidate-review-flags") {
      options.candidateReviewFlags = true;
      continue;
    }

    if (arg === "--candidate-review-flag") {
      options.candidateReviewFlag = readCandidateReviewFlag(
        readRequiredValue(args, index, arg)
      );
      candidateReviewFlagProvided = true;
      index += 1;
      continue;
    }

    if (arg === "--candidate-review-flags-limit") {
      options.candidateReviewFlagsLimit = readPositiveInteger(args, index, arg, 50);
      candidateReviewFlagsLimitProvided = true;
      index += 1;
      continue;
    }

    if (arg === "--candidate-review-overview") {
      options.candidateReviewOverview = true;
      continue;
    }

    if (arg === "--candidate-review-overview-limit") {
      options.candidateReviewOverviewLimit = readPositiveInteger(args, index, arg, 50);
      candidateReviewOverviewLimitProvided = true;
      index += 1;
      continue;
    }

    if (arg === "--candidate-review-packet") {
      options.candidateReviewPacketDedupeKey = readCandidateKeyValue(
        args,
        index,
        arg
      );
      index += 1;
      continue;
    }

    if (arg === "--candidate-siblings") {
      options.candidateSiblingsDedupeKey = readCandidateKeyValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--candidate-siblings-limit") {
      options.candidateSiblingsLimit = readPositiveInteger(args, index, arg, 50);
      candidateSiblingsLimitProvided = true;
      index += 1;
      continue;
    }

    if (arg === "--accept-candidate") {
      setCandidateReviewOption(
        options,
        "Accepted",
        readCandidateKeyValue(args, index, arg)
      );
      index += 1;
      continue;
    }

    if (arg === "--reject-candidate") {
      setCandidateReviewOption(
        options,
        "Rejected",
        readCandidateKeyValue(args, index, arg)
      );
      index += 1;
      continue;
    }

    if (arg === "--link-candidate-claim") {
      options.linkCandidateClaimDedupeKey = readCandidateKeyValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--extract-candidate-study") {
      options.extractCandidateStudyDedupeKey = readCandidateKeyValue(
        args,
        index,
        arg
      );
      index += 1;
      continue;
    }

    if (arg === "--study-source-type") {
      options.studySourceType = readStudySourceType(readRequiredValue(args, index, arg));
      index += 1;
      continue;
    }

    if (arg === "--study-sample-size") {
      options.studySampleSize = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--study-population") {
      options.studyPopulation = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--study-intervention-name") {
      options.studyInterventionName = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--study-outcome") {
      options.studyOutcomes = [
        ...(options.studyOutcomes ?? []),
        readRequiredValue(args, index, arg)
      ];
      index += 1;
      continue;
    }

    if (arg === "--study-adverse-events") {
      options.studyAdverseEvents = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--study-funding-conflicts") {
      options.studyFundingConflicts = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--study-risk-of-bias") {
      options.studyRiskOfBias = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--study-dose") {
      options.studyDose = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--study-duration") {
      options.studyDuration = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--study-main-results") {
      options.studyMainResults = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--study-abstract") {
      options.studyAbstract = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--study-relevance") {
      options.studyRelevance = readPositiveInteger(args, index, arg, 5);
      index += 1;
      continue;
    }

    if (arg === "--update-existing-study") {
      options.studyUpdateExisting = true;
      continue;
    }

    if (arg === "--claim-link-note") {
      options.claimLinkNote = readRequiredValue(args, index, arg);
      claimLinkNoteProvided = true;
      index += 1;
      continue;
    }

    if (arg === "--claim-link-relevance") {
      options.claimLinkRelevance = readPositiveInteger(args, index, arg, 5);
      claimLinkRelevanceProvided = true;
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

    if (arg === "--candidate-region") {
      options.candidateRegion = readRequiredValue(args, index, arg).toUpperCase();
      candidateRegionProvided = true;
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

    if (arg === "--candidate-duplicates") {
      options.candidateDuplicates = true;
      continue;
    }

    if (arg === "--candidate-job-id") {
      options.candidateJobId = readRequiredValue(args, index, arg);
      candidateJobIdProvided = true;
      index += 1;
      continue;
    }

    if (arg === "--candidate-external-id") {
      options.candidateExternalId = readRequiredValue(args, index, arg);
      candidateExternalIdProvided = true;
      index += 1;
      continue;
    }

    if (arg === "--candidate-intervention-id") {
      options.candidateInterventionId = readRequiredValue(args, index, arg);
      candidateInterventionIdProvided = true;
      index += 1;
      continue;
    }

    if (arg === "--candidate-intervention-missing") {
      options.candidateInterventionMissing = true;
      candidateInterventionMissingProvided = true;
      continue;
    }

    if (arg === "--candidate-claim-id") {
      options.candidateClaimId = readRequiredValue(args, index, arg);
      candidateClaimIdProvided = true;
      index += 1;
      continue;
    }

    if (arg === "--candidate-claim-missing") {
      options.candidateClaimMissing = true;
      candidateClaimMissingProvided = true;
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

    if (arg === "--jobs-source") {
      options.jobsSource = readJobSource(readRequiredValue(args, index, arg));
      jobsSourceProvided = true;
      index += 1;
      continue;
    }

    if (arg === "--jobs-region") {
      options.jobsRegion = readRequiredValue(args, index, arg);
      jobsRegionProvided = true;
      index += 1;
      continue;
    }

    if (arg === "--jobs-intervention-id") {
      options.jobsInterventionId = readRequiredValue(args, index, arg);
      jobsInterventionIdProvided = true;
      index += 1;
      continue;
    }

    if (arg === "--jobs-claim-id") {
      options.jobsClaimId = readRequiredValue(args, index, arg);
      jobsClaimIdProvided = true;
      index += 1;
      continue;
    }

    if (arg === "--jobs-status") {
      options.jobsStatus = readJobStatus(readRequiredValue(args, index, arg));
      jobsStatusProvided = true;
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

    if (arg === "--queue-claim-sources") {
      setQueueClaimSourcesOption(options, readRequiredValue(args, index, arg));
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

  if (options.runNextJobs && options.jobId) {
    throw new Error("--run-next cannot be combined with --job-id.");
  }

  const runOptionProvided =
    options.runNextJobs || Boolean(options.jobId) || limitProvided || sourceLimitProvided;

  if (candidateCurationHandoffLimitProvided && !options.candidateCurationHandoff) {
    throw new Error(
      "--candidate-curation-handoff-limit requires --candidate-curation-handoff."
    );
  }

  if (candidateCurationHandoffStatusProvided && !options.candidateCurationHandoff) {
    throw new Error(
      "--candidate-curation-handoff-status requires --candidate-curation-handoff."
    );
  }

  if (candidateReviewFlagsLimitProvided && !options.candidateReviewFlags) {
    throw new Error("--candidate-review-flags-limit requires --candidate-review-flags.");
  }

  if (candidateReviewFlagProvided && !options.candidateReviewFlags) {
    throw new Error("--candidate-review-flag requires --candidate-review-flags.");
  }

  if (candidateReviewOverviewLimitProvided && !options.candidateReviewOverview) {
    throw new Error("--candidate-review-overview-limit requires --candidate-review-overview.");
  }

  if (candidateSiblingsLimitProvided && !options.candidateSiblingsDedupeKey) {
    throw new Error("--candidate-siblings-limit requires --candidate-siblings.");
  }

  if (claimLinkNoteProvided && !options.linkCandidateClaimDedupeKey) {
    throw new Error("--claim-link-note requires --link-candidate-claim.");
  }

  if (claimLinkRelevanceProvided && !options.linkCandidateClaimDedupeKey) {
    throw new Error("--claim-link-relevance requires --link-candidate-claim.");
  }

  if (hasStudyExtractionOptions(options) && !options.extractCandidateStudyDedupeKey) {
    throw new Error("Study extraction options require --extract-candidate-study.");
  }

  if (options.candidateReviewOverview && options.reviewDecision) {
    throw new Error("--candidate-review-overview cannot be combined with review options.");
  }

  if (options.candidateReviewOverview && options.linkCandidateClaimDedupeKey) {
    throw new Error(
      "--candidate-review-overview cannot be combined with --link-candidate-claim."
    );
  }

  if (options.candidateReviewOverview && options.extractCandidateStudyDedupeKey) {
    throw new Error(
      "--candidate-review-overview cannot be combined with --extract-candidate-study."
    );
  }

  if (options.candidateReviewFlags && options.reviewDecision) {
    throw new Error("--candidate-review-flags cannot be combined with review options.");
  }

  if (options.candidateReviewFlags && options.linkCandidateClaimDedupeKey) {
    throw new Error(
      "--candidate-review-flags cannot be combined with --link-candidate-claim."
    );
  }

  if (options.candidateReviewFlags && options.extractCandidateStudyDedupeKey) {
    throw new Error(
      "--candidate-review-flags cannot be combined with --extract-candidate-study."
    );
  }

  if (options.extractCandidateStudyDedupeKey) {
    if (!options.studySampleSize?.trim()) {
      throw new Error("Study extraction requires --study-sample-size.");
    }

    if (!options.studyPopulation?.trim()) {
      throw new Error("Study extraction requires --study-population.");
    }

    if (!options.studyInterventionName?.trim()) {
      throw new Error("Study extraction requires --study-intervention-name.");
    }

    if (!options.studyOutcomes?.some((outcome) => outcome.trim())) {
      throw new Error("Study extraction requires at least one --study-outcome.");
    }

    if (!options.studyAdverseEvents?.trim()) {
      throw new Error("Study extraction requires --study-adverse-events.");
    }

    if (!options.studyFundingConflicts?.trim()) {
      throw new Error("Study extraction requires --study-funding-conflicts.");
    }

    if (!options.studyRiskOfBias?.trim()) {
      throw new Error("Study extraction requires --study-risk-of-bias.");
    }
  }

  if (options.candidateCurationHandoff && options.candidateDetailDedupeKey) {
    throw new Error(
      "--candidate-curation-handoff cannot be combined with --candidate-detail."
    );
  }

  if (options.candidateCurationHandoff && options.candidateCurationStatusDedupeKey) {
    throw new Error(
      "--candidate-curation-handoff cannot be combined with --candidate-curation-status."
    );
  }

  if (options.candidateCurationHandoff && options.candidateCurationDraftDedupeKey) {
    throw new Error(
      "--candidate-curation-handoff cannot be combined with --candidate-curation-draft."
    );
  }

  if (options.candidateCurationHandoff && options.candidateReferenceMatchesDedupeKey) {
    throw new Error(
      "--candidate-curation-handoff cannot be combined with --candidate-reference-matches."
    );
  }

  if (options.candidateCurationHandoff && options.candidateReviewPacketDedupeKey) {
    throw new Error(
      "--candidate-curation-handoff cannot be combined with --candidate-review-packet."
    );
  }

  if (options.candidateCurationHandoff && options.candidateSiblingsDedupeKey) {
    throw new Error(
      "--candidate-curation-handoff cannot be combined with --candidate-siblings."
    );
  }

  if (options.candidateCurationHandoff && options.summary) {
    throw new Error("--candidate-curation-handoff cannot be combined with --summary.");
  }

  if (options.candidateCurationHandoff && options.candidates) {
    throw new Error("--candidate-curation-handoff cannot be combined with --candidates.");
  }

  if (options.candidateCurationHandoff && candidatesLimitProvided) {
    throw new Error(
      "--candidates-limit cannot be combined with --candidate-curation-handoff."
    );
  }

  if (options.candidateCurationHandoff && candidateDecisionProvided) {
    throw new Error(
      "--candidate-decision cannot be combined with --candidate-curation-handoff."
    );
  }

  if (options.candidateCurationHandoff && candidateExternalIdProvided) {
    throw new Error(
      "--candidate-external-id cannot be combined with --candidate-curation-handoff."
    );
  }

  if (options.candidateClaimId && options.candidateClaimMissing) {
    throw new Error(
      "--candidate-claim-missing cannot be combined with --candidate-claim-id."
    );
  }

  if (options.candidateInterventionId && options.candidateInterventionMissing) {
    throw new Error(
      "--candidate-intervention-missing cannot be combined with --candidate-intervention-id."
    );
  }

  if (options.candidateCurationHandoff && options.reviewDecision) {
    throw new Error(
      "--candidate-curation-handoff cannot be combined with review options."
    );
  }

  if (options.candidateCurationHandoff && options.linkCandidateClaimDedupeKey) {
    throw new Error(
      "--candidate-curation-handoff cannot be combined with --link-candidate-claim."
    );
  }

  if (options.candidateCurationHandoff && options.jobs) {
    throw new Error("--candidate-curation-handoff cannot be combined with --jobs.");
  }

  if (options.candidateCurationHandoff && hasQueueOption(options)) {
    throw new Error(
      "--candidate-curation-handoff cannot be combined with queue options."
    );
  }

  if (
    options.candidateCurationHandoff &&
    (options.region || options.interventionId || options.claimId)
  ) {
    throw new Error(
      "--candidate-curation-handoff cannot be combined with queue metadata."
    );
  }

  if (
    options.candidateCurationHandoff &&
    runOptionProvided
  ) {
    throw new Error("--candidate-curation-handoff cannot be combined with run options.");
  }

  if (options.candidateDetailDedupeKey && options.candidateCurationStatusDedupeKey) {
    throw new Error(
      "--candidate-curation-status cannot be combined with --candidate-detail."
    );
  }

  if (options.candidateDetailDedupeKey && options.candidateCurationDraftDedupeKey) {
    throw new Error(
      "--candidate-curation-draft cannot be combined with --candidate-detail."
    );
  }

  if (options.candidateDetailDedupeKey && options.candidateReferenceMatchesDedupeKey) {
    throw new Error(
      "--candidate-reference-matches cannot be combined with --candidate-detail."
    );
  }

  if (options.candidateDetailDedupeKey && options.candidateSiblingsDedupeKey) {
    throw new Error("--candidate-siblings cannot be combined with --candidate-detail.");
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
      candidateExternalIdProvided,
      candidateJobIdProvided,
      candidateInterventionIdProvided,
      candidateInterventionMissingProvided,
      candidateClaimIdProvided,
      candidateClaimMissingProvided,
      candidateRegionProvided,
      candidateSource: options.candidateSource
    })
  ) {
    throw new Error("Candidate-list filters cannot be combined with --candidate-detail.");
  }

  if (options.candidateDetailDedupeKey && options.reviewDecision) {
    throw new Error("--candidate-detail cannot be combined with review options.");
  }

  if (options.candidateDetailDedupeKey && options.linkCandidateClaimDedupeKey) {
    throw new Error("--candidate-detail cannot be combined with --link-candidate-claim.");
  }

  if (options.candidateDetailDedupeKey && options.jobs) {
    throw new Error("--candidate-detail cannot be combined with --jobs.");
  }

  if (options.candidateDetailDedupeKey && hasQueueOption(options)) {
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
    runOptionProvided
  ) {
    throw new Error("--candidate-detail cannot be combined with run options.");
  }

  if (
    options.candidateCurationStatusDedupeKey &&
    options.candidateCurationDraftDedupeKey
  ) {
    throw new Error(
      "--candidate-curation-draft cannot be combined with --candidate-curation-status."
    );
  }

  if (
    options.candidateCurationStatusDedupeKey &&
    options.candidateReferenceMatchesDedupeKey
  ) {
    throw new Error(
      "--candidate-curation-status cannot be combined with --candidate-reference-matches."
    );
  }

  if (
    options.candidateCurationStatusDedupeKey &&
    options.candidateSiblingsDedupeKey
  ) {
    throw new Error(
      "--candidate-siblings cannot be combined with --candidate-curation-status."
    );
  }

  if (options.candidateCurationStatusDedupeKey && options.summary) {
    throw new Error("--candidate-curation-status cannot be combined with --summary.");
  }

  if (options.candidateCurationStatusDedupeKey && options.candidates) {
    throw new Error("--candidate-curation-status cannot be combined with --candidates.");
  }

  if (
    options.candidateCurationStatusDedupeKey &&
    hasCandidateListFilter({
      candidatesLimitProvided,
      candidateDecisionProvided,
      candidateExternalIdProvided,
      candidateJobIdProvided,
      candidateInterventionIdProvided,
      candidateInterventionMissingProvided,
      candidateClaimIdProvided,
      candidateClaimMissingProvided,
      candidateRegionProvided,
      candidateSource: options.candidateSource
    })
  ) {
    throw new Error(
      "Candidate-list filters cannot be combined with --candidate-curation-status."
    );
  }

  if (options.candidateCurationStatusDedupeKey && options.reviewDecision) {
    throw new Error(
      "--candidate-curation-status cannot be combined with review options."
    );
  }

  if (
    options.candidateCurationStatusDedupeKey &&
    options.linkCandidateClaimDedupeKey
  ) {
    throw new Error(
      "--candidate-curation-status cannot be combined with --link-candidate-claim."
    );
  }

  if (options.candidateCurationStatusDedupeKey && options.jobs) {
    throw new Error("--candidate-curation-status cannot be combined with --jobs.");
  }

  if (options.candidateCurationStatusDedupeKey && hasQueueOption(options)) {
    throw new Error(
      "--candidate-curation-status cannot be combined with queue options."
    );
  }

  if (
    options.candidateCurationStatusDedupeKey &&
    (options.region || options.interventionId || options.claimId)
  ) {
    throw new Error(
      "--candidate-curation-status cannot be combined with queue metadata."
    );
  }

  if (
    options.candidateCurationStatusDedupeKey &&
    runOptionProvided
  ) {
    throw new Error("--candidate-curation-status cannot be combined with run options.");
  }

  if (
    options.candidateCurationDraftDedupeKey &&
    options.candidateReferenceMatchesDedupeKey
  ) {
    throw new Error(
      "--candidate-curation-draft cannot be combined with --candidate-reference-matches."
    );
  }

  if (
    options.candidateCurationDraftDedupeKey &&
    options.candidateSiblingsDedupeKey
  ) {
    throw new Error(
      "--candidate-curation-draft cannot be combined with --candidate-siblings."
    );
  }

  if (options.candidateCurationDraftDedupeKey && options.summary) {
    throw new Error("--candidate-curation-draft cannot be combined with --summary.");
  }

  if (options.candidateCurationDraftDedupeKey && options.candidates) {
    throw new Error("--candidate-curation-draft cannot be combined with --candidates.");
  }

  if (
    options.candidateCurationDraftDedupeKey &&
    hasCandidateListFilter({
      candidatesLimitProvided,
      candidateDecisionProvided,
      candidateExternalIdProvided,
      candidateJobIdProvided,
      candidateInterventionIdProvided,
      candidateInterventionMissingProvided,
      candidateClaimIdProvided,
      candidateClaimMissingProvided,
      candidateRegionProvided,
      candidateSource: options.candidateSource
    })
  ) {
    throw new Error(
      "Candidate-list filters cannot be combined with --candidate-curation-draft."
    );
  }

  if (options.candidateCurationDraftDedupeKey && options.reviewDecision) {
    throw new Error("--candidate-curation-draft cannot be combined with review options.");
  }

  if (
    options.candidateCurationDraftDedupeKey &&
    options.linkCandidateClaimDedupeKey
  ) {
    throw new Error(
      "--candidate-curation-draft cannot be combined with --link-candidate-claim."
    );
  }

  if (options.candidateCurationDraftDedupeKey && options.jobs) {
    throw new Error("--candidate-curation-draft cannot be combined with --jobs.");
  }

  if (options.candidateCurationDraftDedupeKey && hasQueueOption(options)) {
    throw new Error("--candidate-curation-draft cannot be combined with queue options.");
  }

  if (
    options.candidateCurationDraftDedupeKey &&
    (options.region || options.interventionId || options.claimId)
  ) {
    throw new Error("--candidate-curation-draft cannot be combined with queue metadata.");
  }

  if (
    options.candidateCurationDraftDedupeKey &&
    runOptionProvided
  ) {
    throw new Error("--candidate-curation-draft cannot be combined with run options.");
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
      candidateExternalIdProvided,
      candidateJobIdProvided,
      candidateInterventionIdProvided,
      candidateInterventionMissingProvided,
      candidateClaimIdProvided,
      candidateClaimMissingProvided,
      candidateRegionProvided,
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

  if (
    options.candidateReferenceMatchesDedupeKey &&
    options.linkCandidateClaimDedupeKey
  ) {
    throw new Error(
      "--candidate-reference-matches cannot be combined with --link-candidate-claim."
    );
  }

  if (options.candidateReferenceMatchesDedupeKey && options.jobs) {
    throw new Error("--candidate-reference-matches cannot be combined with --jobs.");
  }

  if (options.candidateReferenceMatchesDedupeKey && hasQueueOption(options)) {
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
    runOptionProvided
  ) {
    throw new Error("--candidate-reference-matches cannot be combined with run options.");
  }

  if (
    options.candidateReferenceMatchesDedupeKey &&
    options.candidateSiblingsDedupeKey
  ) {
    throw new Error(
      "--candidate-siblings cannot be combined with --candidate-reference-matches."
    );
  }

  if (options.candidateReviewPacketDedupeKey && options.candidateDetailDedupeKey) {
    throw new Error(
      "--candidate-detail cannot be combined with --candidate-review-packet."
    );
  }

  if (
    options.candidateReviewPacketDedupeKey &&
    options.candidateCurationStatusDedupeKey
  ) {
    throw new Error(
      "--candidate-curation-status cannot be combined with --candidate-review-packet."
    );
  }

  if (
    options.candidateReviewPacketDedupeKey &&
    options.candidateCurationDraftDedupeKey
  ) {
    throw new Error(
      "--candidate-curation-draft cannot be combined with --candidate-review-packet."
    );
  }

  if (
    options.candidateReviewPacketDedupeKey &&
    options.candidateReferenceMatchesDedupeKey
  ) {
    throw new Error(
      "--candidate-reference-matches cannot be combined with --candidate-review-packet."
    );
  }

  if (options.candidateReviewPacketDedupeKey && options.candidateSiblingsDedupeKey) {
    throw new Error(
      "--candidate-siblings cannot be combined with --candidate-review-packet."
    );
  }

  if (options.candidateReviewPacketDedupeKey && options.summary) {
    throw new Error("--candidate-review-packet cannot be combined with --summary.");
  }

  if (options.candidateReviewPacketDedupeKey && options.candidates) {
    throw new Error("--candidate-review-packet cannot be combined with --candidates.");
  }

  if (
    options.candidateReviewPacketDedupeKey &&
    hasCandidateListFilter({
      candidatesLimitProvided,
      candidateDecisionProvided,
      candidateExternalIdProvided,
      candidateJobIdProvided,
      candidateInterventionIdProvided,
      candidateInterventionMissingProvided,
      candidateClaimIdProvided,
      candidateClaimMissingProvided,
      candidateRegionProvided,
      candidateSource: options.candidateSource
    })
  ) {
    throw new Error(
      "Candidate-list filters cannot be combined with --candidate-review-packet."
    );
  }

  if (options.candidateReviewPacketDedupeKey && options.reviewDecision) {
    throw new Error("--candidate-review-packet cannot be combined with review options.");
  }

  if (
    options.candidateReviewPacketDedupeKey &&
    options.linkCandidateClaimDedupeKey
  ) {
    throw new Error(
      "--candidate-review-packet cannot be combined with --link-candidate-claim."
    );
  }

  if (options.candidateReviewPacketDedupeKey && options.extractCandidateStudyDedupeKey) {
    throw new Error(
      "--candidate-review-packet cannot be combined with --extract-candidate-study."
    );
  }

  if (options.candidateReviewPacketDedupeKey && options.jobs) {
    throw new Error("--candidate-review-packet cannot be combined with --jobs.");
  }

  if (options.candidateReviewPacketDedupeKey && hasQueueOption(options)) {
    throw new Error("--candidate-review-packet cannot be combined with queue options.");
  }

  if (
    options.candidateReviewPacketDedupeKey &&
    (options.region || options.interventionId || options.claimId)
  ) {
    throw new Error("--candidate-review-packet cannot be combined with queue metadata.");
  }

  if (
    options.candidateReviewPacketDedupeKey &&
    runOptionProvided
  ) {
    throw new Error("--candidate-review-packet cannot be combined with run options.");
  }

  if (options.candidateSiblingsDedupeKey && options.summary) {
    throw new Error("--candidate-siblings cannot be combined with --summary.");
  }

  if (options.candidateSiblingsDedupeKey && options.candidates) {
    throw new Error("--candidate-siblings cannot be combined with --candidates.");
  }

  if (
    options.candidateSiblingsDedupeKey &&
    hasCandidateListFilter({
      candidatesLimitProvided,
      candidateDecisionProvided,
      candidateExternalIdProvided,
      candidateJobIdProvided,
      candidateInterventionIdProvided,
      candidateInterventionMissingProvided,
      candidateClaimIdProvided,
      candidateClaimMissingProvided,
      candidateRegionProvided,
      candidateSource: options.candidateSource
    })
  ) {
    throw new Error(
      "Candidate-list filters cannot be combined with --candidate-siblings."
    );
  }

  if (options.candidateSiblingsDedupeKey && options.reviewDecision) {
    throw new Error("--candidate-siblings cannot be combined with review options.");
  }

  if (options.candidateSiblingsDedupeKey && options.linkCandidateClaimDedupeKey) {
    throw new Error("--candidate-siblings cannot be combined with --link-candidate-claim.");
  }

  if (options.candidateSiblingsDedupeKey && options.jobs) {
    throw new Error("--candidate-siblings cannot be combined with --jobs.");
  }

  if (options.candidateSiblingsDedupeKey && hasQueueOption(options)) {
    throw new Error("--candidate-siblings cannot be combined with queue options.");
  }

  if (
    options.candidateSiblingsDedupeKey &&
    (options.region || options.interventionId || options.claimId)
  ) {
    throw new Error("--candidate-siblings cannot be combined with queue metadata.");
  }

  if (
    options.candidateSiblingsDedupeKey &&
    runOptionProvided
  ) {
    throw new Error("--candidate-siblings cannot be combined with run options.");
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

  if (options.reviewDecision === "Accepted" && !options.reviewNote?.trim()) {
    throw new Error("--accept-candidate requires --review-note.");
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
      candidateExternalIdProvided,
      candidateJobIdProvided,
      candidateInterventionIdProvided,
      candidateInterventionMissingProvided,
      candidateClaimIdProvided,
      candidateClaimMissingProvided,
      candidateRegionProvided,
      candidateSource: options.candidateSource
    })
  ) {
    throw new Error("Candidate-list filters cannot be combined with review options.");
  }

  if (options.reviewDecision && options.jobs) {
    throw new Error("Review options cannot be combined with --jobs.");
  }

  if (options.reviewDecision && hasQueueOption(options)) {
    throw new Error("Review options cannot be combined with queue options.");
  }

  if (options.reviewDecision && (options.region || options.interventionId || options.claimId)) {
    throw new Error("Review options cannot be combined with queue metadata.");
  }

  if (options.reviewDecision && runOptionProvided) {
    throw new Error("Review options cannot be combined with run options.");
  }

  if (options.reviewDecision && options.linkCandidateClaimDedupeKey) {
    throw new Error("Review options cannot be combined with --link-candidate-claim.");
  }

  if (options.reviewDecision === "Rejected" && !options.reviewNote?.trim()) {
    throw new Error("--reject-candidate requires --review-note.");
  }

  if (options.linkCandidateClaimDedupeKey && options.summary) {
    throw new Error("--link-candidate-claim cannot be combined with --summary.");
  }

  if (options.linkCandidateClaimDedupeKey && options.candidates) {
    throw new Error("--link-candidate-claim cannot be combined with --candidates.");
  }

  if (
    options.linkCandidateClaimDedupeKey &&
    hasCandidateListFilter({
      candidatesLimitProvided,
      candidateDecisionProvided,
      candidateExternalIdProvided,
      candidateJobIdProvided,
      candidateInterventionIdProvided,
      candidateInterventionMissingProvided,
      candidateClaimIdProvided,
      candidateClaimMissingProvided,
      candidateRegionProvided,
      candidateSource: options.candidateSource
    })
  ) {
    throw new Error(
      "Candidate-list filters cannot be combined with --link-candidate-claim."
    );
  }

  if (options.linkCandidateClaimDedupeKey && options.jobs) {
    throw new Error("--link-candidate-claim cannot be combined with --jobs.");
  }

  if (options.linkCandidateClaimDedupeKey && hasQueueOption(options)) {
    throw new Error("--link-candidate-claim cannot be combined with queue options.");
  }

  if (
    options.linkCandidateClaimDedupeKey &&
    (options.region || options.interventionId || options.claimId)
  ) {
    throw new Error("--link-candidate-claim cannot be combined with queue metadata.");
  }

  if (
    options.linkCandidateClaimDedupeKey &&
    runOptionProvided
  ) {
    throw new Error("--link-candidate-claim cannot be combined with run options.");
  }

  if (options.extractCandidateStudyDedupeKey && options.candidateCurationHandoff) {
    throw new Error(
      "--candidate-curation-handoff cannot be combined with --extract-candidate-study."
    );
  }

  if (options.extractCandidateStudyDedupeKey && options.candidateDetailDedupeKey) {
    throw new Error("--candidate-detail cannot be combined with --extract-candidate-study.");
  }

  if (
    options.extractCandidateStudyDedupeKey &&
    options.candidateCurationStatusDedupeKey
  ) {
    throw new Error(
      "--candidate-curation-status cannot be combined with --extract-candidate-study."
    );
  }

  if (
    options.extractCandidateStudyDedupeKey &&
    options.candidateCurationDraftDedupeKey
  ) {
    throw new Error(
      "--candidate-curation-draft cannot be combined with --extract-candidate-study."
    );
  }

  if (
    options.extractCandidateStudyDedupeKey &&
    options.candidateReferenceMatchesDedupeKey
  ) {
    throw new Error(
      "--candidate-reference-matches cannot be combined with --extract-candidate-study."
    );
  }

  if (options.extractCandidateStudyDedupeKey && options.candidateSiblingsDedupeKey) {
    throw new Error(
      "--candidate-siblings cannot be combined with --extract-candidate-study."
    );
  }

  if (options.extractCandidateStudyDedupeKey && options.summary) {
    throw new Error("--extract-candidate-study cannot be combined with --summary.");
  }

  if (options.extractCandidateStudyDedupeKey && options.candidates) {
    throw new Error("--extract-candidate-study cannot be combined with --candidates.");
  }

  if (
    options.extractCandidateStudyDedupeKey &&
    hasCandidateListFilter({
      candidatesLimitProvided,
      candidateDecisionProvided,
      candidateExternalIdProvided,
      candidateJobIdProvided,
      candidateInterventionIdProvided,
      candidateInterventionMissingProvided,
      candidateClaimIdProvided,
      candidateClaimMissingProvided,
      candidateRegionProvided,
      candidateSource: options.candidateSource
    })
  ) {
    throw new Error(
      "Candidate-list filters cannot be combined with --extract-candidate-study."
    );
  }

  if (options.extractCandidateStudyDedupeKey && options.reviewDecision) {
    throw new Error("Review options cannot be combined with --extract-candidate-study.");
  }

  if (options.extractCandidateStudyDedupeKey && options.linkCandidateClaimDedupeKey) {
    throw new Error(
      "--link-candidate-claim cannot be combined with --extract-candidate-study."
    );
  }

  if (options.extractCandidateStudyDedupeKey && options.jobs) {
    throw new Error("--extract-candidate-study cannot be combined with --jobs.");
  }

  if (options.extractCandidateStudyDedupeKey && hasQueueOption(options)) {
    throw new Error("--extract-candidate-study cannot be combined with queue options.");
  }

  if (
    options.extractCandidateStudyDedupeKey &&
    (options.region || options.interventionId || options.claimId)
  ) {
    throw new Error("--extract-candidate-study cannot be combined with queue metadata.");
  }

  if (
    options.extractCandidateStudyDedupeKey &&
    runOptionProvided
  ) {
    throw new Error("--extract-candidate-study cannot be combined with run options.");
  }

  if (
    hasCandidateListFilter({
      candidatesLimitProvided,
      candidateDecisionProvided,
      candidateExternalIdProvided,
      candidateJobIdProvided,
      candidateInterventionIdProvided,
      candidateInterventionMissingProvided,
      candidateClaimIdProvided,
      candidateClaimMissingProvided,
      candidateRegionProvided,
      candidateSource: options.candidateSource
    }) &&
    !options.candidates &&
    !options.candidateCurationHandoff &&
    !options.candidateReviewFlags &&
    !options.candidateReviewOverview
  ) {
    throw new Error(
      "Candidate-list filters require --candidates."
    );
  }

  if (options.candidateReviewFlags && options.candidateReviewOverview) {
    throw new Error(
      "--candidate-review-flags cannot be combined with --candidate-review-overview."
    );
  }

  if (options.candidateReviewFlags && options.candidateCurationHandoff) {
    throw new Error(
      "--candidate-review-flags cannot be combined with --candidate-curation-handoff."
    );
  }

  if (options.candidateReviewFlags && options.candidateDetailDedupeKey) {
    throw new Error("--candidate-review-flags cannot be combined with --candidate-detail.");
  }

  if (options.candidateReviewFlags && options.candidateCurationStatusDedupeKey) {
    throw new Error(
      "--candidate-review-flags cannot be combined with --candidate-curation-status."
    );
  }

  if (options.candidateReviewFlags && options.candidateCurationDraftDedupeKey) {
    throw new Error(
      "--candidate-review-flags cannot be combined with --candidate-curation-draft."
    );
  }

  if (options.candidateReviewFlags && options.candidateReferenceMatchesDedupeKey) {
    throw new Error(
      "--candidate-review-flags cannot be combined with --candidate-reference-matches."
    );
  }

  if (options.candidateReviewFlags && options.candidateReviewPacketDedupeKey) {
    throw new Error(
      "--candidate-review-flags cannot be combined with --candidate-review-packet."
    );
  }

  if (options.candidateReviewFlags && options.candidateSiblingsDedupeKey) {
    throw new Error(
      "--candidate-review-flags cannot be combined with --candidate-siblings."
    );
  }

  if (options.candidateReviewFlags && options.summary) {
    throw new Error("--candidate-review-flags cannot be combined with --summary.");
  }

  if (options.candidateReviewFlags && options.candidates) {
    throw new Error("--candidate-review-flags cannot be combined with --candidates.");
  }

  if (options.candidateReviewFlags && options.candidateDuplicates) {
    throw new Error(
      "--candidate-duplicates cannot be combined with --candidate-review-flags."
    );
  }

  if (options.candidateReviewFlags && candidatesLimitProvided) {
    throw new Error(
      "--candidates-limit cannot be combined with --candidate-review-flags."
    );
  }

  if (options.candidateReviewFlags && candidateDecisionProvided) {
    throw new Error(
      "--candidate-decision cannot be combined with --candidate-review-flags."
    );
  }

  if (options.candidateReviewFlags && candidateExternalIdProvided) {
    throw new Error(
      "--candidate-external-id cannot be combined with --candidate-review-flags."
    );
  }

  if (options.candidateReviewFlags && options.reviewDecision) {
    throw new Error("--candidate-review-flags cannot be combined with review options.");
  }

  if (options.candidateReviewFlags && options.linkCandidateClaimDedupeKey) {
    throw new Error(
      "--candidate-review-flags cannot be combined with --link-candidate-claim."
    );
  }

  if (options.candidateReviewFlags && options.extractCandidateStudyDedupeKey) {
    throw new Error(
      "--candidate-review-flags cannot be combined with --extract-candidate-study."
    );
  }

  if (options.candidateReviewFlags && options.jobs) {
    throw new Error("--candidate-review-flags cannot be combined with --jobs.");
  }

  if (options.candidateReviewFlags && hasQueueOption(options)) {
    throw new Error(
      "--candidate-review-flags cannot be combined with queue options."
    );
  }

  if (
    options.candidateReviewFlags &&
    (options.region || options.interventionId || options.claimId)
  ) {
    throw new Error(
      "--candidate-review-flags cannot be combined with queue metadata."
    );
  }

  if (
    options.candidateReviewFlags &&
    runOptionProvided
  ) {
    throw new Error("--candidate-review-flags cannot be combined with run options.");
  }

  if (options.candidateReviewOverview && options.candidateCurationHandoff) {
    throw new Error(
      "--candidate-review-overview cannot be combined with --candidate-curation-handoff."
    );
  }

  if (options.candidateReviewOverview && options.candidateDetailDedupeKey) {
    throw new Error("--candidate-review-overview cannot be combined with --candidate-detail.");
  }

  if (options.candidateReviewOverview && options.candidateCurationStatusDedupeKey) {
    throw new Error(
      "--candidate-review-overview cannot be combined with --candidate-curation-status."
    );
  }

  if (options.candidateReviewOverview && options.candidateCurationDraftDedupeKey) {
    throw new Error(
      "--candidate-review-overview cannot be combined with --candidate-curation-draft."
    );
  }

  if (options.candidateReviewOverview && options.candidateReferenceMatchesDedupeKey) {
    throw new Error(
      "--candidate-review-overview cannot be combined with --candidate-reference-matches."
    );
  }

  if (options.candidateReviewOverview && options.candidateReviewPacketDedupeKey) {
    throw new Error(
      "--candidate-review-overview cannot be combined with --candidate-review-packet."
    );
  }

  if (options.candidateReviewOverview && options.candidateSiblingsDedupeKey) {
    throw new Error(
      "--candidate-review-overview cannot be combined with --candidate-siblings."
    );
  }

  if (options.candidateReviewOverview && options.summary) {
    throw new Error("--candidate-review-overview cannot be combined with --summary.");
  }

  if (options.candidateReviewOverview && options.candidates) {
    throw new Error("--candidate-review-overview cannot be combined with --candidates.");
  }

  if (options.candidateReviewOverview && options.candidateDuplicates) {
    throw new Error(
      "--candidate-duplicates cannot be combined with --candidate-review-overview."
    );
  }

  if (options.candidateReviewOverview && candidatesLimitProvided) {
    throw new Error(
      "--candidates-limit cannot be combined with --candidate-review-overview."
    );
  }

  if (options.candidateReviewOverview && candidateDecisionProvided) {
    throw new Error(
      "--candidate-decision cannot be combined with --candidate-review-overview."
    );
  }

  if (options.candidateReviewOverview && candidateExternalIdProvided) {
    throw new Error(
      "--candidate-external-id cannot be combined with --candidate-review-overview."
    );
  }

  if (options.candidateReviewOverview && options.reviewDecision) {
    throw new Error("--candidate-review-overview cannot be combined with review options.");
  }

  if (options.candidateReviewOverview && options.linkCandidateClaimDedupeKey) {
    throw new Error(
      "--candidate-review-overview cannot be combined with --link-candidate-claim."
    );
  }

  if (options.candidateReviewOverview && options.extractCandidateStudyDedupeKey) {
    throw new Error(
      "--candidate-review-overview cannot be combined with --extract-candidate-study."
    );
  }

  if (options.candidateReviewOverview && options.jobs) {
    throw new Error("--candidate-review-overview cannot be combined with --jobs.");
  }

  if (options.candidateReviewOverview && hasQueueOption(options)) {
    throw new Error(
      "--candidate-review-overview cannot be combined with queue options."
    );
  }

  if (
    options.candidateReviewOverview &&
    (options.region || options.interventionId || options.claimId)
  ) {
    throw new Error(
      "--candidate-review-overview cannot be combined with queue metadata."
    );
  }

  if (
    options.candidateReviewOverview &&
    runOptionProvided
  ) {
    throw new Error("--candidate-review-overview cannot be combined with run options.");
  }

  if (options.candidateDuplicates && !options.candidates) {
    throw new Error("--candidate-duplicates requires --candidates.");
  }

  if (options.candidates && options.summary) {
    throw new Error("--candidates cannot be combined with --summary.");
  }

  if (options.candidates && options.jobs) {
    throw new Error("--candidates cannot be combined with --jobs.");
  }

  if (options.candidates && hasQueueOption(options)) {
    throw new Error("--candidates is read-only and cannot be combined with queue options.");
  }

  if (options.candidates && runOptionProvided) {
    throw new Error("--candidates is read-only and cannot be combined with run options.");
  }

  if (jobsLimitProvided && !options.jobs) {
    throw new Error("--jobs-limit requires --jobs.");
  }

  if (
    (jobsClaimIdProvided ||
      jobsInterventionIdProvided ||
      jobsRegionProvided ||
      jobsSourceProvided) &&
    !options.jobs
  ) {
    throw new Error("Job-list filters require --jobs.");
  }

  if (jobsStatusProvided && !options.jobs) {
    throw new Error("--jobs-status requires --jobs.");
  }

  if (options.jobs && options.summary) {
    throw new Error("--jobs cannot be combined with --summary.");
  }

  if (options.jobs && hasQueueOption(options)) {
    throw new Error("--jobs is read-only and cannot be combined with queue options.");
  }

  if (options.jobs && runOptionProvided) {
    throw new Error("--jobs is read-only and cannot be combined with run options.");
  }

  if (hasQueueOption(options) && options.summary) {
    throw new Error("--summary is read-only and cannot be combined with queue options.");
  }

  if (hasQueueOption(options) && runOptionProvided) {
    throw new Error("Queue options cannot be combined with run options.");
  }

  if (
    options.queueClaimSourcesClaimId &&
    (options.interventionId || options.claimId)
  ) {
    throw new Error(
      "--intervention-id and --claim-id cannot be combined with --queue-claim-sources."
    );
  }

  if (!hasQueueOption(options) && (options.region || options.interventionId || options.claimId)) {
    throw new Error("--region, --intervention-id, and --claim-id require a queue option.");
  }

  if (options.summary && runOptionProvided) {
    throw new Error("--summary is read-only and cannot be combined with run options.");
  }

  if (limitProvided && !options.runNextJobs) {
    throw new Error("--limit requires --run-next.");
  }

  if (sourceLimitProvided && !options.runNextJobs && !options.jobId) {
    throw new Error(
      "--pubmed-retmax and --clinical-trial-page-size require --run-next or --job-id."
    );
  }

  if (args.length === 0) {
    options.summary = true;
  }

  return options;
}

export function commandUsage() {
  return [
    "Usage: npm run ingest:sources -- [options]",
    "",
    "Options:",
    "  --job-id <id>                     Run one specific ingestion job.",
    "  --run-next                        Run queued PubMed/ClinicalTrials.gov jobs.",
    "  --limit <count>                   With --run-next, run up to count queued jobs (default 1, max 25).",
    "  --candidate-detail <dedupe-key>   Print one source-candidate detail record with review/curation hints.",
    "  --candidate-curation-draft <dedupe-key> Print read-only claim-link/study draft fields with command hints.",
    "  --candidate-curation-status <dedupe-key> Print curation handoff status, next action, and command hints.",
    "  --candidate-curation-handoff      Print accepted source-candidate curation handoff rows, next actions, and command hints.",
    "  --candidate-curation-handoff-limit <count> Handoff row count (default 25, max 50).",
    "  --candidate-curation-handoff-status <status> Filter handoff by missing-reference, reference-mismatch, candidate-claim-missing, claim-link-missing, extraction-pending, or ready.",
    "  --candidate-reference-matches <dedupe-key> Print accepted-reference matches and review/curation hints.",
    "  --candidate-review-flags        Print read-only flagged pending review groups with review/curation hints.",
    "  --candidate-review-flag <flag>  With --candidate-review-flags, filter by broad-safety-query or low-title-query-overlap.",
    "  --candidate-review-flags-limit <count> Review flag group count (default 25, max 50).",
    "  --candidate-review-overview     Print read-only pending review groups with review/curation hints.",
    "  --candidate-review-overview-limit <count> Review overview group count (default 25, max 50).",
    "  --candidate-review-packet <dedupe-key> Print detail, accepted-reference matches, sibling/duplicate context, and curation hints.",
    "  --candidate-siblings <dedupe-key> Print source-candidate siblings with match reasons and review/curation hints.",
    "  --candidate-siblings-limit <count> Sibling row count (default 25, max 50).",
    "  --accept-candidate <dedupe-key>   Mark a source candidate accepted.",
    "  --reject-candidate <dedupe-key>   Mark a source candidate rejected.",
    "  --accepted-reference-id <id>      Required curated reference id for --accept-candidate.",
    "  --review-note <note>              Human review note; required for --accept-candidate and --reject-candidate.",
    "  --link-candidate-claim <dedupe-key> Link an accepted candidate reference to its claim.",
    "  --claim-link-note <note>          Optional note for --link-candidate-claim.",
    "  --claim-link-relevance <1-5>      Optional relevance for --link-candidate-claim.",
    "  --extract-candidate-study <dedupe-key> Write structured Study extraction for an accepted, claim-linked candidate.",
    "  --study-source-type <type>        Optional study type override: meta-analysis, systematic-review, randomized-controlled-trial, observational-cohort, case-report, animal-study, in-vitro-mechanistic, clinical-trial-record, or regulatory-safety-warning.",
    "  --study-sample-size <text>        Required for --extract-candidate-study.",
    "  --study-population <text>         Required for --extract-candidate-study.",
    "  --study-intervention-name <text>  Required for --extract-candidate-study.",
    "  --study-outcome <text>            Required; repeat for multiple outcomes.",
    "  --study-adverse-events <text>     Required for --extract-candidate-study.",
    "  --study-funding-conflicts <text>  Required for --extract-candidate-study.",
    "  --study-risk-of-bias <text>       Required for --extract-candidate-study.",
    "  --study-dose <text>               Optional dose field for --extract-candidate-study.",
    "  --study-duration <text>           Optional duration field for --extract-candidate-study.",
    "  --study-main-results <text>       Optional main results field for --extract-candidate-study.",
    "  --study-abstract <text>           Optional abstract field for --extract-candidate-study.",
    "  --study-relevance <1-5>           Optional relevance score for --extract-candidate-study.",
    "  --update-existing-study           Update the one existing extraction for this accepted reference.",
    "  --candidates                      Print read-only source-candidate review rows with review/curation hints.",
    "  --candidates-limit <count>        Candidate count for --candidates (default 25, max 50).",
    "  <dedupe-key> also accepts emitted key=b64:... values for shell-safe reuse.",
    "  --candidate-source <source>       Filter candidates, overview, flags, or handoff by source: pubmed or clinical-trials.",
    "  --candidate-decision <decision>   Candidate decision: pending, accepted, or rejected.",
    "  --candidate-duplicates            With --candidates, print read-only duplicate source/external-id groups with review/curation hints.",
    "  --candidate-external-id <id>      Filter --candidates by source external id such as PMID or NCT id.",
    "  --candidate-job-id <id>           Filter candidates, overview, flags, or handoff by ingestion job id.",
    "  --candidate-intervention-id <id>  Filter candidates, overview, flags, or handoff by intervention id.",
    "  --candidate-intervention-missing  Filter candidates, overview, flags, or handoff to rows without intervention id.",
    "  --candidate-claim-id <id>         Filter candidates, overview, flags, or handoff by claim id.",
    "  --candidate-claim-missing         Filter candidates, overview, flags, or handoff to rows without claim id.",
    "  --candidate-region <region>       Filter candidates, overview, flags, or handoff by region.",
    "  --jobs                            Print recent source-candidate ingestion jobs with read-only hints.",
    "  --jobs-limit <count>              Recent job count for --jobs (default 10, max 50).",
    "  --jobs-source <source>            Filter --jobs by source: pubmed or clinical-trials.",
    "  --jobs-region <region>            Filter --jobs by region.",
    "  --jobs-intervention-id <id>       Filter --jobs by intervention id.",
    "  --jobs-claim-id <id>              Filter --jobs by claim id.",
    "  --jobs-status <status>            Filter --jobs by queued, running, succeeded, failed, or skipped.",
    "  --queue-pubmed <term>             Queue a PubMed source-candidate job.",
    "  --queue-clinical-trials <term>    Queue a ClinicalTrials.gov source-candidate job.",
    "  --queue-claim-sources <claim-id>  Queue PubMed and ClinicalTrials.gov jobs from claim context.",
    "  --region <region>                 Region metadata for queued jobs (default AU).",
    "  --intervention-id <id>            Intervention metadata for queued jobs.",
    "  --claim-id <id>                   Claim metadata for queued jobs.",
    "  --pubmed-retmax <count>           PubMed result limit passed to NCBI (max 20).",
    "  --clinical-trial-page-size <count> ClinicalTrials.gov page size (max 20).",
    "  --summary                         Print read-only workflow counts and next-command hints.",
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

function sourceCandidateMissingFilterOptions(options: SourceCandidateJobCommandOptions) {
  return {
    ...(options.candidateClaimMissing ? { claimIdMissing: true } : {}),
    ...(options.candidateInterventionMissing ? { interventionIdMissing: true } : {})
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
    `changed=${result.recordsChanged}`,
    ...formatSourceCandidateJobCommandHints(result)
  ];

  if (result.error) {
    parts.push(`error=${result.error}`);
  }

  return parts.join(" ");
}

function formatQueuedSourceCandidateJob(result: QueuedSourceCandidateIngestionJob) {
  const parts = [
    `[${result.status}]`,
    result.jobId,
    result.source,
    result.region,
    quote(result.query),
    `created=${result.created}`,
    ...formatSourceCandidateJobCommandHints(result)
  ];

  appendJobContext(parts, result);

  if (result.contextMismatchFields.length > 0) {
    parts.push(
      `requestedContextMismatch=${quote(result.contextMismatchFields.join(","))}`
    );
  }

  return parts.join(" ");
}

function formatQueuedClaimSourceCandidateJobs(
  result: QueuedClaimSourceCandidateIngestionJobs
) {
  return [
    `Claim source-candidate jobs: ${quote(result.label)} claim=${result.claimId} intervention=${result.interventionId} region=${result.region}`,
    ...result.jobs.map((job) => `- ${formatQueuedSourceCandidateJob(job)}`)
  ].join("\n");
}

function formatReviewedSourceCandidate(candidate: SourceCandidate) {
  const parts = [
    `[${candidate.decision}] source-candidate`,
    candidate.source,
    candidate.region,
    `dedupe=${quote(candidate.dedupeKey)}`,
    `key=${safeCandidateKey(candidate.dedupeKey)}`,
    `externalId=${quote(candidate.externalId)}`,
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

function formatLinkedSourceCandidateClaim(result: LinkedSourceCandidateClaim) {
  const parts = [
    "[CLAIM_LINKED] source-candidate",
    result.candidate.source,
    result.candidate.region,
    `dedupe=${quote(result.candidate.dedupeKey)}`,
    `key=${safeCandidateKey(result.candidate.dedupeKey)}`,
    `reference=${result.acceptedReference.id}`,
    `claim=${result.claimLink.claimId}`,
    `created=${result.created}`,
    `relevance=${result.claimLink.relevance}`,
    `status=${quote(result.status.status)}`,
    `publicSourcePacketReady=${result.status.publicSourcePacketReady}`,
    `nextAction=${quote(result.status.nextAction)}`
  ];

  if (result.claimLink.note) {
    parts.push(`note=${quote(result.claimLink.note)}`);
  }

  return parts.join(" ");
}

function formatExtractedSourceCandidateStudy(result: ExtractedSourceCandidateStudy) {
  const parts = [
    "[STUDY_EXTRACTED] source-candidate",
    result.candidate.source,
    result.candidate.region,
    `dedupe=${quote(result.candidate.dedupeKey)}`,
    `key=${safeCandidateKey(result.candidate.dedupeKey)}`,
    `reference=${result.acceptedReference.id}`,
    `study=${result.study.id}`,
    `created=${result.created}`,
    `status=${quote(result.status.status)}`,
    `publicSourcePacketReady=${result.status.publicSourcePacketReady}`,
    `nextAction=${quote(result.status.nextAction)}`,
    `title=${quote(result.study.title)}`
  ];

  if (result.candidate.claimId) {
    parts.push(`candidateClaim=${result.candidate.claimId}`);
  }

  if (result.study.year !== undefined) {
    parts.push(`year=${result.study.year}`);
  }

  return parts.join(" ");
}

function formatSourceCandidateDetail(
  candidate: SourceCandidate,
  options: { commandHints?: boolean } = {}
) {
  const reviewFlags = sourceCandidateReviewFlags(candidate);
  const lines = [
    "Source-candidate detail",
    `dedupe=${quote(candidate.dedupeKey)}`,
    `key=${safeCandidateKey(candidate.dedupeKey)}`,
    ...(options.commandHints === false
      ? []
      : formatSourceCandidateDetailCommandHints(candidate)),
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

  if (reviewFlags.length > 0) {
    const reviewFlagCodes = reviewFlags.map((flag) => flag.code);
    lines.push(
      ...formatSourceCandidateReviewFlagFields(
        "reviewFlags",
        reviewFlagCodes,
        sourceCandidateReviewFlagContext(candidate)
      )
    );
    lines.push(
      formatStringList(
        "reviewCautions",
        sourceCandidateReviewCautions(reviewFlags)
      )
    );
  }

  const metadataLines = formatMetadata(candidate.metadata);

  if (metadataLines.length > 0) {
    lines.push("metadata:");
    lines.push(...metadataLines.map((line) => `  ${line}`));
  }

  return lines.join("\n");
}

type SourceCandidateDrillInHint =
  | "packet"
  | "referenceMatches"
  | "siblings"
  | "groupList"
  | "curationStatus"
  | "curationDraft";

function formatSourceCandidateDetailCommandHints(candidate: SourceCandidate) {
  const key = safeCandidateKey(candidate.dedupeKey);

  return [
    "Source-candidate detail command hints",
    "safeReadOnly=true",
    ...formatSourceCandidateDrillInHints(candidate, key, [
      "packet",
      "referenceMatches",
      "siblings",
      "groupList",
      "curationStatus",
      "curationDraft"
    ])
  ];
}

function formatSourceCandidateReviewDrillInHints(
  candidate: SourceCandidate,
  key: string
) {
  return formatSourceCandidateDrillInHints(candidate, key, [
    "packet",
    "referenceMatches",
    "siblings",
    "curationStatus",
    "curationDraft"
  ]);
}

function formatSourceCandidateDrillInHints(
  candidate: SourceCandidate,
  key: string,
  hints: readonly SourceCandidateDrillInHint[]
) {
  return hints.map((hint) => formatSourceCandidateDrillInHint(candidate, key, hint));
}

function formatSourceCandidateDrillInHint(
  candidate: SourceCandidate,
  key: string,
  hint: SourceCandidateDrillInHint
) {
  switch (hint) {
    case "packet":
      return `packet=${quote(`--candidate-review-packet ${key}`)}`;
    case "referenceMatches":
      return `referenceMatches=${quote(`--candidate-reference-matches ${key}`)}`;
    case "siblings":
      return `siblings=${quote(`--candidate-siblings ${key}`)}`;
    case "groupList":
      return `groupList=${quote(formatSourceCandidateGroupListCommand(candidate))}`;
    case "curationStatus":
      return `curationStatus=${quote(`--candidate-curation-status ${key}`)}`;
    case "curationDraft":
      return `curationDraft=${quote(`--candidate-curation-draft ${key}`)}`;
  }
}

function formatSourceCandidateReviewPacket(packet: SourceCandidateReviewPacket) {
  return [
    "Source-candidate review packet",
    formatSourceCandidateReviewPacketCommandHints(packet),
    formatSourceCandidateDetail(packet.candidate, { commandHints: false }),
    formatSourceCandidateReferenceMatches(packet.referenceMatches),
    formatSourceCandidateSiblings(packet.siblings)
  ].join("\n\n");
}

function formatSourceCandidateReviewPacketCommandHints(
  packet: SourceCandidateReviewPacket
) {
  const candidate = packet.candidate;
  const key = safeCandidateKey(candidate.dedupeKey);
  const duplicateIdentityCount = sourceCandidateReviewPacketDuplicateIdentityCount(packet);
  const acceptedReferenceMatches = packet.referenceMatches.references.length;
  const reviewFlagCodes = sourceCandidateReviewFlagCodes(candidate);
  const lines = [
    "Source-candidate review command hints",
    "safeReadOnly=true",
    `detail=${quote(`--candidate-detail ${key}`)}`,
    ...formatSourceCandidateDrillInHints(candidate, key, [
      "referenceMatches",
      "siblings",
      "groupList",
      "curationStatus",
      "curationDraft"
    ])
  ];

  if (duplicateIdentityCount > 1) {
    lines.push(
      `duplicateIdentityCandidates=${duplicateIdentityCount}`,
      `duplicates=${quote(
        formatSourceCandidateDuplicateIdentityListCommand({
          externalId: candidate.externalId,
          limit: duplicateIdentityCount,
          source: candidate.source
        })
      )}`,
      `duplicateCaution=${quote(SOURCE_CANDIDATE_DUPLICATE_IDENTITY_CAUTION)}`
    );
  }

  if (reviewFlagCodes.length > 0) {
    lines.push(
      `reviewFlags=${quote(formatSourceCandidateReviewFlagsCommand())}`,
      `flagFocus=${quote(
        formatSourceCandidateReviewFlagsCommand(
          reviewFlagCodes[0],
          sourceCandidateReviewFlagContext(candidate)
        )
      )}`
    );
  }

  lines.push(
    "humanReviewedWritesRequireOperator=true",
    "acceptRequiresMatchingCuratedReference=true",
    `acceptedReferenceMatches=${acceptedReferenceMatches}`,
    `acceptReferenceReady=${acceptedReferenceMatches > 0}`,
    "reviewDecisionRequiresHumanNote=true",
    `acceptTemplate=${quote(
      `--accept-candidate ${key} --accepted-reference-id <reference-id> --review-note "Human-reviewed rationale."`
    )}`,
    `rejectTemplate=${quote(
      `--reject-candidate ${key} --review-note "Human-reviewed rationale."`
    )}`
  );

  return lines.join("\n");
}

function sourceCandidateReviewPacketDuplicateIdentityCount(
  packet: SourceCandidateReviewPacket
) {
  return sourceCandidateSiblingDuplicateIdentityCount(packet.siblings);
}

function sourceCandidateSiblingDuplicateIdentityCount(
  siblings: SourceCandidateSiblings
) {
  return 1 + siblings.siblings.filter((sibling) =>
    sibling.matchReasons.includes("Same source/external id")
  ).length;
}

async function sourceCandidateDuplicateIdentityCandidateCountForDedupeKey(
  dedupeKey: string,
  listSiblings: NonNullable<SourceCandidateJobCommandRunners["listSiblings"]>
) {
  const siblings = await listSiblings(dedupeKey, {});

  return siblings ? sourceCandidateSiblingDuplicateIdentityCount(siblings) : 1;
}

async function sourceCandidateDuplicateIdentityCandidateCountMap(
  candidates: SourceCandidate[],
  listSiblings: NonNullable<SourceCandidateJobCommandRunners["listSiblings"]>
) {
  const counts = await Promise.all(
    candidates.map(async (candidate) => [
      candidate.dedupeKey,
      await sourceCandidateDuplicateIdentityCandidateCountForDedupeKey(
        candidate.dedupeKey,
        listSiblings
      )
    ] as const)
  );

  return new Map(counts);
}

function formatSourceCandidateDuplicateIdentityFields(
  candidate: SourceCandidate,
  duplicateIdentityCandidateCount: number
) {
  if (duplicateIdentityCandidateCount <= 1) {
    return [];
  }

  return [
    `duplicateIdentityCandidates=${duplicateIdentityCandidateCount}`,
    `duplicates=${quote(
      formatSourceCandidateDuplicateIdentityListCommand({
        externalId: candidate.externalId,
        limit: duplicateIdentityCandidateCount,
        source: candidate.source
      })
    )}`,
    `duplicateCaution=${quote(SOURCE_CANDIDATE_DUPLICATE_IDENTITY_CAUTION)}`
  ];
}

function formatSourceCandidateCurationDraft(
  draft: SourceCandidateCurationDraft,
  options: { duplicateIdentityCandidateCount?: number } = {}
) {
  const status = draft.status;
  const candidate = status.candidate;
  const reviewFlagFields = sourceCandidateReviewFlagFields("reviewFlags", candidate);
  const lines = [
    "Source-candidate curation draft",
    "readOnly=true",
    `dedupe=${quote(candidate.dedupeKey)}`,
    `key=${safeCandidateKey(candidate.dedupeKey)}`,
    ...formatSourceCandidateCurationCommandHints(candidate, "draft"),
    `decision=${quote(candidate.decision)}`,
    `reviewStatus=${quote(candidate.reviewStatus)}`,
    `status=${quote(status.status)}`,
    `nextAction=${quote(status.nextAction)}`,
    `publicSourcePacketReady=${status.publicSourcePacketReady}`
  ];

  if (status.status === "Not accepted") {
    lines.push(
      "acceptRequiresMatchingCuratedReference=true",
      "reviewDecisionRequiresHumanNote=true"
    );
  }

  if (candidate.reviewedAt) {
    lines.push(`reviewed=${candidate.reviewedAt}`);
  }

  if (candidate.reviewNote) {
    lines.push(`note=${quote(candidate.reviewNote)}`);
  }

  lines.push(
    ...formatSourceCandidateDuplicateIdentityFields(
      candidate,
      options.duplicateIdentityCandidateCount ?? 1
    )
  );

  if (reviewFlagFields.length > 0) {
    lines.push(...reviewFlagFields);
  }

  if (status.acceptedReferenceId) {
    lines.push(`acceptedReference=${status.acceptedReferenceId}`);
  }

  if (status.acceptedReference) {
    lines.push(`acceptedReferenceTitle=${quote(status.acceptedReference.title)}`);
    lines.push(`acceptedReferenceUrl=${status.acceptedReference.url}`);
  }

  if (candidate.claimId) {
    lines.push(`candidateClaim=${candidate.claimId}`);
  }

  if (status.candidateClaimLinked !== undefined) {
    lines.push(`candidateClaimLinked=${status.candidateClaimLinked}`);
  }

  if (draft.claimLinkDraft) {
    lines.push("claimLinkDraft:");
    lines.push(`  reference=${draft.claimLinkDraft.referenceId}`);
    lines.push(`  claim=${draft.claimLinkDraft.claimId}`);
    lines.push(`  relevance=${draft.claimLinkDraft.relevance}`);
    lines.push(`  alreadyLinked=${draft.claimLinkDraft.alreadyLinked}`);
    lines.push(`  note=${quote(draft.claimLinkDraft.note)}`);
  } else {
    lines.push("claimLinkDraft: unavailable");
  }

  if (draft.studyExtractionDraft) {
    lines.push("studyExtractionDraft:");
    lines.push(`  reference=${draft.studyExtractionDraft.referenceId}`);
    lines.push(`  title=${quote(draft.studyExtractionDraft.title)}`);
    lines.push(`  source=${quote(draft.studyExtractionDraft.source)}`);
    lines.push(
      `  sourceTypeSuggestion=${quote(draft.studyExtractionDraft.sourceTypeSuggestion)}`
    );
    lines.push(`  alreadyExtracted=${draft.studyExtractionDraft.alreadyExtracted}`);
    lines.push(`  url=${draft.studyExtractionDraft.url}`);

    if (draft.studyExtractionDraft.year !== undefined) {
      lines.push(`  year=${draft.studyExtractionDraft.year}`);
    }

    if (draft.studyExtractionDraft.pmid) {
      lines.push(`  pmid=${draft.studyExtractionDraft.pmid}`);
    }

    if (draft.studyExtractionDraft.nctId) {
      lines.push(`  nctId=${draft.studyExtractionDraft.nctId}`);
    }

    if (draft.studyExtractionDraft.doi) {
      lines.push(`  doi=${quote(draft.studyExtractionDraft.doi)}`);
    }

    if (draft.studyExtractionDraft.abstractAvailable !== undefined) {
      lines.push(`  abstractAvailable=${draft.studyExtractionDraft.abstractAvailable}`);
    }

    lines.push(
      `  manualFields=${quote(draft.studyExtractionDraft.manualFields.join(", "))}`
    );

    if (draft.studyExtractionDraft.metadataFields.length > 0) {
      lines.push("  metadataFields:");
      lines.push(
        ...draft.studyExtractionDraft.metadataFields.map(
          (field) => `    ${field.label}=${quote(field.value)}`
        )
      );
    }
  } else {
    lines.push("studyExtractionDraft: unavailable");
  }

  return lines.join("\n");
}

function formatSourceCandidateCurationStatus(
  status: SourceCandidateCurationStatus,
  options: { duplicateIdentityCandidateCount?: number } = {}
) {
  const reviewFlagFields = sourceCandidateReviewFlagFields(
    "reviewFlags",
    status.candidate
  );
  const lines = [
    "Source-candidate curation status",
    `dedupe=${quote(status.candidate.dedupeKey)}`,
    `key=${safeCandidateKey(status.candidate.dedupeKey)}`,
    ...formatSourceCandidateCurationCommandHints(status.candidate, "status"),
    `decision=${quote(status.candidate.decision)}`,
    `reviewStatus=${quote(status.candidate.reviewStatus)}`,
    `status=${quote(status.status)}`,
    `nextAction=${quote(status.nextAction)}`,
    `publicSourcePacketReady=${status.publicSourcePacketReady}`
  ];

  if (status.status === "Not accepted") {
    lines.push(
      "acceptRequiresMatchingCuratedReference=true",
      "reviewDecisionRequiresHumanNote=true"
    );
  }

  if (status.candidate.reviewedAt) {
    lines.push(`reviewed=${status.candidate.reviewedAt}`);
  }

  if (status.candidate.reviewNote) {
    lines.push(`note=${quote(status.candidate.reviewNote)}`);
  }

  lines.push(
    ...formatSourceCandidateDuplicateIdentityFields(
      status.candidate,
      options.duplicateIdentityCandidateCount ?? 1
    )
  );

  if (reviewFlagFields.length > 0) {
    lines.push(...reviewFlagFields);
  }

  if (status.acceptedReferenceId) {
    lines.push(`acceptedReference=${status.acceptedReferenceId}`);
  }

  if (status.acceptedReference) {
    lines.push(`acceptedReferenceTitle=${quote(status.acceptedReference.title)}`);
    lines.push(`acceptedReferenceUrl=${status.acceptedReference.url}`);
  }

  if (status.candidate.claimId) {
    lines.push(`candidateClaim=${status.candidate.claimId}`);
  }

  if (status.candidateClaimLinked !== undefined) {
    lines.push(`candidateClaimLinked=${status.candidateClaimLinked}`);
  }

  lines.push(`claimLinks=${status.claimLinks.length}`);
  lines.push(`studies=${status.studies.length}`);

  if (status.claimLinks.length > 0) {
    lines.push("claimLinks:");
    lines.push(
      ...status.claimLinks.map((link) => `  ${formatCurationClaimLink(link)}`)
    );
  }

  if (status.studies.length > 0) {
    lines.push("studies:");
    lines.push(...status.studies.map((study) => `  ${formatCurationStudy(study)}`));
  }

  return lines.join("\n");
}

function formatSourceCandidateCurationCommandHints(
  candidate: SourceCandidate,
  surface: "draft" | "status"
) {
  const key = safeCandidateKey(candidate.dedupeKey);
  const pairedCurationCommand = surface === "draft"
    ? `--candidate-curation-status ${key}`
    : `--candidate-curation-draft ${key}`;

  return [
    ...formatSourceCandidateDrillInHints(candidate, key, [
      "packet",
      "referenceMatches",
      "siblings",
      "groupList"
    ]),
    `curation${surface === "draft" ? "Status" : "Draft"}=${quote(
      pairedCurationCommand
    )}`
  ];
}

function formatSourceCandidateCurationHandoff(
  statuses: SourceCandidateCurationStatus[],
  options: { duplicateIdentityCandidateCounts?: Map<string, number> } = {}
) {
  if (statuses.length === 0) {
    return "Source-candidate curation handoff: total=0";
  }

  return [
    `Source-candidate curation handoff: total=${statuses.length}`,
    ...statuses.map((status) =>
      formatSourceCandidateCurationHandoffItem(status, {
        duplicateIdentityCandidateCount:
          options.duplicateIdentityCandidateCounts?.get(status.candidate.dedupeKey)
      })
    )
  ].join("\n");
}

function formatSourceCandidateCurationHandoffItem(
  status: SourceCandidateCurationStatus,
  options: { duplicateIdentityCandidateCount?: number } = {}
) {
  const candidate = status.candidate;
  const reviewFlagFields = sourceCandidateReviewFlagFields("reviewFlags", candidate);
  const parts = [
    `- status=${quote(status.status)}`,
    `nextAction=${quote(status.nextAction)}`,
    `publicSourcePacketReady=${status.publicSourcePacketReady}`,
    candidate.source,
    candidate.region,
    `dedupe=${quote(candidate.dedupeKey)}`,
    `key=${safeCandidateKey(candidate.dedupeKey)}`,
    ...formatSourceCandidateCurationHandoffCommandHints(candidate),
    `title=${quote(candidate.title)}`
  ];

  if (reviewFlagFields.length > 0) {
    parts.push(...reviewFlagFields);
  }

  parts.push(
    ...formatSourceCandidateDuplicateIdentityFields(
      candidate,
      options.duplicateIdentityCandidateCount ?? 1
    )
  );

  if (status.acceptedReferenceId) {
    parts.push(`acceptedReference=${status.acceptedReferenceId}`);
  }

  if (candidate.reviewedAt) {
    parts.push(`reviewed=${candidate.reviewedAt}`);
  }

  if (candidate.reviewNote) {
    parts.push(`note=${quote(candidate.reviewNote)}`);
  }

  if (candidate.claimId) {
    parts.push(`candidateClaim=${candidate.claimId}`);
  }

  if (status.candidateClaimLinked !== undefined) {
    parts.push(`candidateClaimLinked=${status.candidateClaimLinked}`);
  }

  parts.push(`claimLinks=${status.claimLinks.length}`);
  parts.push(`studies=${status.studies.length}`);

  return parts.join(" ");
}

function formatSourceCandidateCurationHandoffCommandHints(
  candidate: SourceCandidate
) {
  const key = safeCandidateKey(candidate.dedupeKey);

  return formatSourceCandidateReviewDrillInHints(candidate, key);
}

function formatCurationClaimLink(
  link: SourceCandidateCurationStatus["claimLinks"][number]
) {
  const parts = [`- claim=${link.claimId}`, `relevance=${link.relevance}`];

  if (link.note) {
    parts.push(`note=${quote(link.note)}`);
  }

  return parts.join(" ");
}

function formatCurationStudy(status: SourceCandidateCurationStatus["studies"][number]) {
  const parts = [
    `- study=${status.id}`,
    `reference=${status.referenceId}`,
    `title=${quote(status.title)}`
  ];

  if (status.year !== undefined) {
    parts.push(`year=${status.year}`);
  }

  return parts.join(" ");
}

function formatSourceCandidateReferenceMatches(
  matches: SourceCandidateAcceptedReferenceMatches,
  options: { duplicateIdentityCandidateCount?: number } = {}
) {
  const heading = formatSourceCandidateReferenceMatchHeading(matches, options);

  if (matches.references.length === 0) {
    return [
      heading,
      formatSourceCandidateReferenceDraft(matches.candidate)
    ].join("\n");
  }

  return [
    heading,
    ...matches.references.map(formatSourceCandidateReferenceMatch)
  ].join("\n");
}

function formatSourceCandidateReferenceMatchHeading(
  matches: SourceCandidateAcceptedReferenceMatches,
  options: { duplicateIdentityCandidateCount?: number } = {}
) {
  const candidate = matches.candidate;
  const key = safeCandidateKey(candidate.dedupeKey);
  const reviewFlagFields = sourceCandidateReviewFlagFields("reviewFlags", candidate);
  const duplicateIdentityCandidateCount =
    options.duplicateIdentityCandidateCount ?? 1;
  const parts = [
    `Source-candidate accepted-reference matches: total=${matches.references.length}`,
    `dedupe=${quote(candidate.dedupeKey)}`,
    `key=${key}`,
    `candidate=${quote(candidate.title)}`,
    `source=${quote(candidate.source)}`,
    `externalId=${quote(candidate.externalId)}`,
    `url=${candidate.url}`,
    ...formatSourceCandidateDrillInHints(candidate, key, [
      "packet",
      "siblings",
      "groupList",
      "curationStatus",
      "curationDraft"
    ]),
    `decision=${quote(candidate.decision)}`,
    `reviewStatus=${quote(candidate.reviewStatus)}`
  ];

  parts.push(
    ...formatSourceCandidateDuplicateIdentityFields(
      candidate,
      duplicateIdentityCandidateCount
    )
  );

  if (reviewFlagFields.length > 0) {
    parts.push(...reviewFlagFields);
  }

  if (candidate.acceptedReferenceId) {
    parts.push(`acceptedReference=${candidate.acceptedReferenceId}`);
  }

  return parts.join(" ");
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

function formatSourceCandidateReferenceDraft(candidate: SourceCandidate) {
  const parts = [
    `- referenceDraft=${quote(sourceCandidateReferenceDraftId(candidate))}`,
    `source=${quote(candidate.source)}`,
    `identifier=${quote(sourceCandidateReferenceIdentifier(candidate))}`,
    `title=${quote(candidate.title)}`,
    `url=${candidate.url}`,
    'note="Draft only; verify before adding a curated reference."'
  ];

  if (candidate.publishedYear !== undefined) {
    parts.push(`year=${candidate.publishedYear}`);
  }

  return parts.join(" ");
}

function sourceCandidateReferenceDraftId(candidate: SourceCandidate) {
  const sourceSlug =
    candidate.source === "ClinicalTrials.gov" ? "clinicaltrials-gov" : "pubmed";
  const externalIdSlug = slugReferenceIdPart(candidate.externalId);

  return `ref-${sourceSlug}-${externalIdSlug || "candidate"}`;
}

function sourceCandidateReferenceIdentifier(candidate: SourceCandidate) {
  if (candidate.source === "PubMed") {
    return `PMID: ${candidate.externalId}`;
  }

  return candidate.externalId.toUpperCase();
}

function slugReferenceIdPart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatSourceCandidateSiblings(siblings: SourceCandidateSiblings) {
  const target = siblings.target;
  const targetKey = safeCandidateKey(target.dedupeKey);
  const targetReviewFlags = sourceCandidateReviewFlags(target);
  const headingParts = [
    `Source-candidate siblings: total=${siblings.siblings.length}`,
    `target=${quote(target.dedupeKey)}`,
    `targetKey=${targetKey}`,
    `targetPacket=${quote(`--candidate-review-packet ${targetKey}`)}`,
    `targetReferenceMatches=${quote(`--candidate-reference-matches ${targetKey}`)}`,
    `targetCurationStatus=${quote(`--candidate-curation-status ${targetKey}`)}`,
    `targetCurationDraft=${quote(`--candidate-curation-draft ${targetKey}`)}`,
    `candidate=${quote(target.title)}`,
    `source=${quote(target.source)}`,
    `externalId=${quote(target.externalId)}`,
    `query=${quote(target.query)}`,
    `region=${quote(target.region)}`,
    `decision=${quote(target.decision)}`,
    `reviewStatus=${quote(target.reviewStatus)}`
  ];

  if (target.interventionId) {
    headingParts.push(`intervention=${target.interventionId}`);
  }

  if (target.claimId) {
    headingParts.push(`claim=${target.claimId}`);
  }

  if (target.acceptedReferenceId) {
    headingParts.push(`acceptedReference=${target.acceptedReferenceId}`);
  }

  if (targetReviewFlags.length > 0) {
    headingParts.push(
      ...formatSourceCandidateReviewFields(
        "targetReviewFlags",
        targetReviewFlags,
        sourceCandidateReviewFlagContext(target)
      )
    );
  }

  const heading = headingParts.join(" ");

  if (siblings.siblings.length === 0) {
    return heading;
  }

  return [
    heading,
    ...siblings.siblings.map(formatSourceCandidateSibling)
  ].join("\n");
}

function formatSourceCandidateSibling(sibling: SourceCandidateSiblings["siblings"][number]) {
  const candidate = sibling.candidate;
  const reviewFlags = sourceCandidateReviewFlags(candidate);
  const key = safeCandidateKey(candidate.dedupeKey);
  const parts = [
    `- match=${quote(sibling.matchReasons.join(", "))}`,
    `triage=${candidate.triageScore}/100`,
    candidate.source,
    candidate.region,
    `dedupe=${quote(candidate.dedupeKey)}`,
    `key=${key}`,
    ...formatSourceCandidateDrillInHints(candidate, key, [
      "packet",
      "referenceMatches",
      "curationStatus",
      "curationDraft"
    ]),
    `externalId=${quote(candidate.externalId)}`,
    `query=${quote(candidate.query)}`,
    `title=${quote(candidate.title)}`,
    `url=${candidate.url}`,
    `decision=${quote(candidate.decision)}`,
    `reviewStatus=${quote(candidate.reviewStatus)}`
  ];

  if (reviewFlags.length > 0) {
    parts.push(
      ...formatSourceCandidateReviewFields(
        "reviewFlags",
        reviewFlags,
        sourceCandidateReviewFlagContext(candidate)
      )
    );
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

function formatSourceCandidateIdentityGroups(
  groups: SourceCandidateIdentityGroup[],
  decision?: SourceCandidateDecision
) {
  const heading = decision && decision !== "Pending review"
    ? `Source-candidate duplicate identities: decision=${quote(decision)}`
    : "Source-candidate duplicate identities";

  if (groups.length === 0) {
    return `${heading}: total=0`;
  }

  return [
    `${heading}: total=${groups.length}`,
    ...groups.flatMap(formatSourceCandidateIdentityGroup)
  ].join("\n");
}

function formatSourceCandidateIdentityGroup(group: SourceCandidateIdentityGroup) {
  const counts = sourceCandidateIdentityDecisionCounts(group.candidates);
  const title = group.candidates[0]?.title ?? "";
  const parts = [
    `- ${group.source}`,
    `externalId=${quote(group.externalId)}`,
    `candidates=${group.candidates.length}`,
    `pending=${counts.pending}`,
    `accepted=${counts.accepted}`,
    `rejected=${counts.rejected}`,
    `identityList=${quote(formatSourceCandidateIdentityGroupListCommand(group))}`,
    `duplicateCaution=${quote(SOURCE_CANDIDATE_DUPLICATE_IDENTITY_CAUTION)}`,
    `title=${quote(title)}`
  ];

  return [
    parts.join(" "),
    ...group.candidates.map(formatSourceCandidateIdentityGroupCandidate)
  ];
}

function formatSourceCandidateIdentityGroupCandidate(candidate: SourceCandidate) {
  const reviewFlags = sourceCandidateReviewFlags(candidate);
  const key = safeCandidateKey(candidate.dedupeKey);
  const parts = [
    "  -",
    `triage=${candidate.triageScore}/100`,
    `dedupe=${quote(candidate.dedupeKey)}`,
    `key=${key}`,
    ...formatSourceCandidateReviewDrillInHints(candidate, key),
    `groupList=${quote(formatSourceCandidateGroupListCommand(candidate))}`,
    `query=${quote(candidate.query)}`,
    `decision=${quote(candidate.decision)}`,
    `reviewStatus=${quote(candidate.reviewStatus)}`
  ];

  if (reviewFlags.length > 0) {
    parts.push(
      ...formatSourceCandidateReviewFields(
        "reviewFlags",
        reviewFlags,
        sourceCandidateReviewFlagContext(candidate)
      )
    );
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

  parts.push(
    `intervention=${candidate.interventionId ?? "none"}`,
    `claim=${candidate.claimId ?? "none"}`
  );

  if (candidate.ingestionJobId) {
    parts.push(`ingestionJob=${candidate.ingestionJobId}`);
  }

  return parts.join(" ");
}

function formatSourceCandidateIdentityGroupListCommand(
  group: SourceCandidateIdentityGroup
) {
  return formatSourceCandidateDuplicateIdentityListCommand({
    externalId: group.externalId,
    limit: group.candidates.length,
    source: group.source
  });
}

function sourceCandidateIdentityDecisionCounts(candidates: SourceCandidate[]) {
  return candidates.reduce(
    (counts, candidate) => {
      if (candidate.decision === "Accepted") {
        counts.accepted += 1;
      } else if (candidate.decision === "Rejected") {
        counts.rejected += 1;
      } else {
        counts.pending += 1;
      }

      return counts;
    },
    {
      accepted: 0,
      pending: 0,
      rejected: 0
    }
  );
}

function formatSourceCandidateReviewOverview(overview: SourceCandidateReviewOverview) {
  if (overview.groups.length === 0) {
    return "Source-candidate review overview: totalGroups=0 candidateCount=0";
  }

  const suffix = overview.groups.length < overview.totalGroups
    ? ` shown=${overview.groups.length}`
    : "";

  return [
    `Source-candidate review overview: totalGroups=${overview.totalGroups} candidateCount=${overview.candidateCount}${suffix}`,
    ...overview.groups.map(formatSourceCandidateReviewOverviewGroup)
  ].join("\n");
}

function formatSourceCandidateReviewFlags(
  overview: SourceCandidateReviewOverview,
  flag?: SourceCandidateReviewFlagCode
) {
  const groups = overview.groups.filter(
    (group) =>
      sourceCandidateReviewFlagCodes(group.topCandidate).some(
        (reviewFlag) => !flag || reviewFlag === flag
      )
  );
  const suffix = overview.groups.length < overview.totalGroups
    ? ` shown=${overview.groups.length}`
    : "";
  const heading =
    `Source-candidate review flags: totalGroups=${overview.totalGroups}` +
    ` candidateCount=${overview.candidateCount}${suffix}` +
    `${flag ? ` flag=${quote(flag)}` : ""}` +
    ` flaggedTopGroups=${groups.length}`;

  if (groups.length === 0) {
    return heading;
  }

  return [
    heading,
    ...groups.map((group) => formatSourceCandidateReviewFlagGroup(group, flag))
  ].join("\n");
}

function formatSourceCandidateReviewFlagGroup(
  group: SourceCandidateReviewOverview["groups"][number],
  requestedFlag?: SourceCandidateReviewFlagCode
) {
  const candidate = group.topCandidate;
  const key = safeCandidateKey(candidate.dedupeKey);
  const reviewFlags = sourceCandidateReviewFlags(candidate);
  const reviewFlagCodes = reviewFlags.map((reviewFlag) => reviewFlag.code);
  const focusFlag =
    requestedFlag && reviewFlagCodes.includes(requestedFlag)
      ? requestedFlag
      : reviewFlagCodes[0];
  const parts = [
    "-",
    `flags=${quote(reviewFlagCodes.join(", "))}`,
    `topReviewCautions=${quote(sourceCandidateReviewCautions(reviewFlags).join(" | "))}`,
    `flagFocus=${quote(
      formatSourceCandidateReviewFlagsCommand(
        focusFlag,
        sourceCandidateReviewFlagGroupContext(group)
      )
    )}`,
    `claim=${group.claimId ?? "none"}`,
    `intervention=${group.interventionId ?? "none"}`,
    group.source,
    group.region,
    `pending=${group.count}`,
    `topTriage=${group.topTriageScore}/100`,
    `topKey=${key}`,
    `topExternalId=${quote(candidate.externalId)}`
  ];

  if (group.topIdentityCandidateCount > 1) {
    parts.push(
      `topIdentityCandidates=${group.topIdentityCandidateCount}`,
      `duplicates=${quote(formatSourceCandidateReviewOverviewDuplicateListCommand(group))}`,
      `duplicateCaution=${quote(SOURCE_CANDIDATE_DUPLICATE_IDENTITY_CAUTION)}`
    );
  }

  parts.push(
    `topTitle=${quote(candidate.title)}`,
    `list=${quote(formatSourceCandidateReviewOverviewListCommand(group))}`,
    ...formatSourceCandidateReviewDrillInHints(candidate, key),
    `overview=${quote("--candidate-review-overview --candidate-review-overview-limit 10")}`
  );

  return parts.join(" ");
}

function formatSourceCandidateReviewOverviewGroup(
  group: SourceCandidateReviewOverview["groups"][number]
) {
  const candidate = group.topCandidate;
  const key = safeCandidateKey(candidate.dedupeKey);
  const reviewFlags = sourceCandidateReviewFlags(candidate);
  const reviewFlagCodes = reviewFlags.map((reviewFlag) => reviewFlag.code);
  const parts = [
    "-",
    `claim=${group.claimId ?? "none"}`,
    `intervention=${group.interventionId ?? "none"}`,
    group.source,
    group.region,
    `pending=${group.count}`,
    `topTriage=${group.topTriageScore}/100`,
    `topKey=${key}`,
    `topExternalId=${quote(candidate.externalId)}`
  ];

  if (group.topIdentityCandidateCount > 1) {
    parts.push(
      `topIdentityCandidates=${group.topIdentityCandidateCount}`,
      `duplicates=${quote(formatSourceCandidateReviewOverviewDuplicateListCommand(group))}`,
      `duplicateCaution=${quote(SOURCE_CANDIDATE_DUPLICATE_IDENTITY_CAUTION)}`
    );
  }

  if (reviewFlagCodes.length > 0) {
    parts.push(
      `topReviewFlags=${quote(reviewFlagCodes.join(", "))}`,
      `topReviewCautions=${quote(sourceCandidateReviewCautions(reviewFlags).join(" | "))}`,
      `flags=${quote(formatSourceCandidateReviewFlagsCommand())}`,
      `flagFocus=${quote(
        formatSourceCandidateReviewFlagsCommand(
          reviewFlagCodes[0],
          sourceCandidateReviewFlagGroupContext(group)
        )
      )}`
    );
  }

  parts.push(
    `topTitle=${quote(candidate.title)}`,
    `list=${quote(formatSourceCandidateReviewOverviewListCommand(group))}`,
    ...formatSourceCandidateReviewDrillInHints(candidate, key)
  );

  return parts.join(" ");
}

function formatSourceCandidateReviewOverviewListCommand(
  group: SourceCandidateReviewOverview["groups"][number]
) {
  return formatSourceCandidateContextListCommand({
    claimId: group.claimId,
    claimIdMissing: !group.claimId,
    interventionId: group.interventionId,
    interventionIdMissing: !group.interventionId,
    limit: Math.min(group.count, DEFAULT_REVIEW_GROUP_CANDIDATE_LIMIT),
    region: group.region,
    source: group.source
  });
}

function formatSourceCandidateReviewOverviewDuplicateListCommand(
  group: SourceCandidateReviewOverview["groups"][number]
) {
  return formatSourceCandidateDuplicateIdentityListCommand({
    externalId: group.topCandidate.externalId,
    limit: group.topIdentityCandidateCount,
    source: group.source
  });
}

function formatSourceCandidateDuplicateIdentityListCommand({
  externalId,
  limit,
  source
}: {
  externalId: string;
  limit: number;
  source: SourceCandidateSource;
}) {
  return [
    "--candidates",
    "--candidate-duplicates",
    "--candidate-source",
    sourceCandidateSourceCliValue(source),
    "--candidate-external-id",
    externalId,
    "--candidates-limit",
    String(Math.min(limit, DEFAULT_REVIEW_GROUP_CANDIDATE_LIMIT))
  ].join(" ");
}

function formatSourceCandidateGroupListCommand(candidate: SourceCandidate) {
  return formatSourceCandidateContextListCommand({
    claimId: candidate.claimId,
    claimIdMissing: !candidate.claimId,
    interventionId: candidate.interventionId,
    interventionIdMissing: !candidate.interventionId,
    limit: DEFAULT_REVIEW_GROUP_CANDIDATE_LIMIT,
    region: candidate.region,
    source: candidate.source
  });
}

function formatSourceCandidateContextListCommand({
  claimId,
  claimIdMissing,
  interventionId,
  interventionIdMissing,
  limit,
  region,
  source
}: {
  claimId?: string;
  claimIdMissing?: boolean;
  interventionId?: string;
  interventionIdMissing?: boolean;
  limit: number;
  region: string;
  source: SourceCandidateSource;
}) {
  const args = ["--candidates"];

  if (claimId) {
    args.push("--candidate-claim-id", claimId);
  } else if (claimIdMissing) {
    args.push("--candidate-claim-missing");
  }

  if (interventionId) {
    args.push("--candidate-intervention-id", interventionId);
  } else if (interventionIdMissing) {
    args.push("--candidate-intervention-missing");
  }

  args.push(
    "--candidate-region",
    region,
    "--candidate-source",
    sourceCandidateSourceCliValue(source),
    "--candidates-limit",
    String(limit)
  );

  return args.join(" ");
}

function sourceCandidateSourceCliValue(source: SourceCandidateSource) {
  return source === "ClinicalTrials.gov" ? "clinical-trials" : "pubmed";
}

function formatSourceCandidateReviewQueueItem(candidate: SourceCandidate) {
  const reviewFlags = sourceCandidateReviewFlags(candidate);
  const key = safeCandidateKey(candidate.dedupeKey);
  const parts = [
    `- triage=${candidate.triageScore}/100`,
    candidate.source,
    candidate.region,
    `dedupe=${quote(candidate.dedupeKey)}`,
    `key=${key}`,
    ...formatSourceCandidateReviewDrillInHints(candidate, key),
    `externalId=${quote(candidate.externalId)}`,
    `query=${quote(candidate.query)}`,
    `title=${quote(candidate.title)}`,
    `url=${candidate.url}`
  ];

  if (reviewFlags.length > 0) {
    parts.push(
      ...formatSourceCandidateReviewFields(
        "reviewFlags",
        reviewFlags,
        sourceCandidateReviewFlagContext(candidate)
      )
    );
  }

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

  if (candidate.ingestionJobId) {
    parts.push(`ingestionJob=${candidate.ingestionJobId}`);
  }

  if (candidate.interventionId) {
    parts.push(`intervention=${candidate.interventionId}`);
  }

  if (candidate.claimId) {
    parts.push(`claim=${candidate.claimId}`);
  }

  return parts.join(" ");
}

function sourceCandidateReviewFlagCodes(candidate: SourceCandidate) {
  return sourceCandidateReviewFlags(candidate).map((flag) => flag.code);
}

function sourceCandidateReviewCautions(
  reviewFlags: ReturnType<typeof sourceCandidateReviewFlags>
) {
  return reviewFlags.map((flag) => `${flag.code}: ${flag.message}`);
}

interface SourceCandidateReviewFlagCommandContext {
  claimId?: string;
  claimIdMissing?: boolean;
  interventionId?: string;
  interventionIdMissing?: boolean;
  region?: string;
  source?: SourceCandidateSource;
}

function sourceCandidateReviewFlagContext(
  candidate: SourceCandidate
): SourceCandidateReviewFlagCommandContext {
  return {
    claimId: candidate.claimId,
    claimIdMissing: !candidate.claimId,
    interventionId: candidate.interventionId,
    interventionIdMissing: !candidate.interventionId,
    region: candidate.region,
    source: candidate.source
  };
}

function sourceCandidateReviewFlagGroupContext(
  group: SourceCandidateReviewOverview["groups"][number]
): SourceCandidateReviewFlagCommandContext {
  return {
    claimId: group.claimId,
    claimIdMissing: !group.claimId,
    interventionId: group.interventionId,
    interventionIdMissing: !group.interventionId,
    region: group.region,
    source: group.source
  };
}

function sourceCandidateReviewFlagFields(label: string, candidate: SourceCandidate) {
  return formatSourceCandidateReviewFields(
    label,
    sourceCandidateReviewFlags(candidate),
    sourceCandidateReviewFlagContext(candidate)
  );
}

function formatSourceCandidateReviewFields(
  label: string,
  reviewFlags: ReturnType<typeof sourceCandidateReviewFlags>,
  context?: SourceCandidateReviewFlagCommandContext
) {
  return [
    ...formatSourceCandidateReviewFlagFields(
      label,
      reviewFlags.map((flag) => flag.code),
      context
    ),
    ...formatSourceCandidateReviewCautionFields(label, reviewFlags)
  ];
}

function formatSourceCandidateReviewFlagFields(
  label: string,
  reviewFlagCodes: readonly SourceCandidateReviewFlagCode[],
  context?: SourceCandidateReviewFlagCommandContext
) {
  if (reviewFlagCodes.length === 0) {
    return [];
  }

  return [
    `${label}=${quote(reviewFlagCodes.join(", "))}`,
    `flags=${quote(formatSourceCandidateReviewFlagsCommand())}`,
    `flagFocus=${quote(formatSourceCandidateReviewFlagsCommand(reviewFlagCodes[0], context))}`
  ];
}

function formatSourceCandidateReviewCautionFields(
  flagLabel: string,
  reviewFlags: ReturnType<typeof sourceCandidateReviewFlags>
) {
  const cautions = sourceCandidateReviewCautions(reviewFlags);

  if (cautions.length === 0) {
    return [];
  }

  return [
    `${sourceCandidateReviewCautionLabel(flagLabel)}=${quote(cautions.join(" | "))}`
  ];
}

function sourceCandidateReviewCautionLabel(flagLabel: string) {
  return flagLabel.endsWith("Flags")
    ? `${flagLabel.slice(0, -"Flags".length)}Cautions`
    : `${flagLabel}Cautions`;
}

function sourceCandidateReviewFlags(candidate: SourceCandidate) {
  if (!candidate.claimId) {
    return [];
  }

  const flags: { code: SourceCandidateReviewFlagCode; message: string }[] = [];
  const queryTokens = sourceCandidateReviewTokens(candidate.query);
  const titleTokens = sourceCandidateReviewTokens(candidate.title);

  if (sourceCandidateBroadSafetyQueryTokens(queryTokens)) {
    flags.push({
      code: "broad-safety-query",
      message:
        "Broad safety/adverse query; verify title, population, outcomes, and source identity against the candidate claim."
    });
  }

  if (
    queryTokens.length >= MIN_REVIEW_QUERY_TOKENS_FOR_OVERLAP_FLAG &&
    !sourceCandidateReviewTokensOverlap(queryTokens, titleTokens)
  ) {
    flags.push({
      code: "low-title-query-overlap",
      message:
        "Low title/query overlap; inspect the packet and siblings for off-claim or off-intervention matches."
    });
  }

  return flags;
}

function sourceCandidateBroadSafetyQueryTokens(tokens: string[]) {
  return tokens.includes("safety") && tokens.includes("adverse");
}

function sourceCandidateReviewTokens(value: string) {
  const seen = new Set<string>();

  return value
    .toLowerCase()
    .replace(/[^a-z0-9+-]+/g, " ")
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => {
      if (token.length < 3 || reviewQueryTokenStopwords.has(token) || seen.has(token)) {
        return false;
      }

      seen.add(token);
      return true;
    })
    .map(sourceCandidateReviewTokenRoot);
}

function sourceCandidateReviewTokensOverlap(
  queryTokens: string[],
  titleTokens: string[]
) {
  return queryTokens.some((queryToken) =>
    titleTokens.some((titleToken) =>
      queryToken === titleToken ||
      (queryToken.length >= 5 &&
        titleToken.length >= 5 &&
        (titleToken.includes(queryToken) || queryToken.includes(titleToken)))
    )
  );
}

function sourceCandidateReviewTokenRoot(token: string) {
  if (token.length > 8 && token.endsWith("emia")) {
    return token.slice(0, -4);
  }

  if (token.length > 5 && token.endsWith("ies")) {
    return `${token.slice(0, -3)}y`;
  }

  if (token.length > 5 && token.endsWith("es")) {
    return token.slice(0, -2);
  }

  if (token.length > 4 && token.endsWith("s")) {
    return token.slice(0, -1);
  }

  return token;
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
    `updated=${job.updatedAt}`,
    ...formatSourceCandidateJobCommandHints(job)
  ];

  appendJobContext(parts, job);

  if (job.error) {
    parts.push(`error=${job.error}`);
  }

  return parts.join(" ");
}

interface SourceCandidateJobCommandHintContext {
  claimId?: string;
  interventionId?: string;
  jobId: string;
  region: string;
  source: SourceCandidateIngestionJobListItem["source"];
  status: SourceCandidateIngestionJobListItem["status"];
}

function formatSourceCandidateJobCommandHints(
  job: SourceCandidateJobCommandHintContext
) {
  return [
    `candidates=${quote(formatSourceCandidateJobCandidatesCommand(job.jobId))}`,
    `contextJobs=${quote(formatSourceCandidateJobContextCommand(job))}`,
    `statusJobs=${quote(
      `--jobs --jobs-status ${formatSourceCandidateJobStatusValue(job.status)} --jobs-limit 10`
    )}`
  ];
}

function formatSourceCandidateJobCandidatesCommand(jobId: string) {
  return `--candidates --candidate-job-id ${jobId} --candidates-limit 10`;
}

function formatSourceCandidateJobContextCommand(
  job: SourceCandidateJobCommandHintContext
) {
  const parts = [
    "--jobs",
    "--jobs-source",
    formatSourceCandidateJobSourceValue(job.source),
    "--jobs-region",
    job.region
  ];

  if (job.interventionId) {
    parts.push("--jobs-intervention-id", job.interventionId);
  }

  if (job.claimId) {
    parts.push("--jobs-claim-id", job.claimId);
  }

  parts.push("--jobs-limit", "10");

  return parts.join(" ");
}

function formatSourceCandidateJobSourceValue(
  source: SourceCandidateIngestionJobListItem["source"]
) {
  switch (source) {
    case "PUBMED":
      return "pubmed";
    case "CLINICALTRIALS_GOV":
      return "clinical-trials";
  }
}

function formatSourceCandidateJobStatusValue(
  status: SourceCandidateIngestionJobListItem["status"]
) {
  switch (status) {
    case "QUEUED":
      return "queued";
    case "RUNNING":
      return "running";
    case "SUCCEEDED":
      return "succeeded";
    case "FAILED":
      return "failed";
    case "SKIPPED":
      return "skipped";
  }
}

function appendJobContext(
  parts: string[],
  job: Pick<QueuedSourceCandidateIngestionJob, "claimId" | "interventionId">
) {
  if (job.interventionId) {
    parts.push(`intervention=${job.interventionId}`);
  }

  if (job.claimId) {
    parts.push(`claim=${job.claimId}`);
  }
}

function formatSourceCandidateWorkflowSummary(
  jobSummary: SourceCandidateIngestionJobSummary,
  backlogSummary: SourceCandidateBacklogSummary,
  curationHandoffSummary: SourceCandidateCurationHandoffSummary,
  reviewOverview: SourceCandidateReviewOverview
) {
  return [
    formatSourceCandidateIngestionJobSummary(jobSummary),
    formatSourceCandidateBacklogSummary(backlogSummary),
    formatSourceCandidateCurationHandoffSummary(curationHandoffSummary),
    formatSourceCandidateReviewFlagSummary(reviewOverview),
    formatSourceCandidateWorkflowSummaryCommandHints()
  ].join("\n");
}

function formatSourceCandidateReviewFlagSummary(
  reviewOverview: SourceCandidateReviewOverview
) {
  const groups = sourceCandidateReviewFlagSummaryGroups(reviewOverview);
  const flaggedTopGroups = reviewOverview.groups.filter(
    (group) => sourceCandidateReviewFlagCodes(group.topCandidate).length > 0
  ).length;
  const heading =
    `Source-candidate review flag focus: totalGroups=${reviewOverview.totalGroups}` +
    ` candidateCount=${reviewOverview.candidateCount}` +
    ` flaggedTopGroups=${flaggedTopGroups}`;

  if (groups.length === 0) {
    return heading;
  }

  return [
    heading,
    ...groups.map(formatSourceCandidateReviewFlagSummaryGroup)
  ].join("\n");
}

function formatSourceCandidateReviewFlagSummaryGroup(
  group: ReturnType<typeof sourceCandidateReviewFlagSummaryGroups>[number]
) {
  const exampleGroup = group.exampleGroup;
  const candidate = exampleGroup.topCandidate;
  const caution = sourceCandidateReviewFlags(candidate).find(
    (reviewFlag) => reviewFlag.code === group.flag
  )?.message;
  const key = safeCandidateKey(candidate.dedupeKey);
  const drillInHints = formatSourceCandidateReviewDrillInHints(candidate, key)
    .map((hint) => ` ${hint}`)
    .join("");

  return (
    `- flag=${quote(group.flag)} topGroups=${group.topGroups}` +
    ` pendingInTopGroups=${group.pendingInTopGroups}` +
    ` topGroup=${quote(formatSourceCandidateReviewFlagSummaryGroupLabel(exampleGroup))}` +
    `${caution ? ` caution=${quote(caution)}` : ""}` +
    ` list=${quote(formatSourceCandidateReviewOverviewListCommand(exampleGroup))}` +
    drillInHints +
    ` flags=${quote(formatSourceCandidateReviewFlagsCommand(group.flag))}` +
    ` flagFocus=${quote(
      formatSourceCandidateReviewFlagsCommand(
        group.flag,
        sourceCandidateReviewFlagGroupContext(exampleGroup)
      )
    )}` +
    ` overview=${quote("--candidate-review-overview --candidate-review-overview-limit 10")}`
  );
}

function formatSourceCandidateReviewFlagsCommand(
  flag?: SourceCandidateReviewFlagCode,
  context?: SourceCandidateReviewFlagCommandContext
) {
  const parts = ["--candidate-review-flags"];

  if (flag) {
    parts.push("--candidate-review-flag", flag);
  }

  if (context?.claimId) {
    parts.push("--candidate-claim-id", context.claimId);
  } else if (context?.claimIdMissing) {
    parts.push("--candidate-claim-missing");
  }

  if (context?.interventionId) {
    parts.push("--candidate-intervention-id", context.interventionId);
  } else if (context?.interventionIdMissing) {
    parts.push("--candidate-intervention-missing");
  }

  if (context?.region) {
    parts.push("--candidate-region", context.region);
  }

  if (context?.source) {
    parts.push("--candidate-source", sourceCandidateSourceCliValue(context.source));
  }

  parts.push("--candidate-review-flags-limit", "10");

  return parts.join(" ");
}

function formatSourceCandidateReviewFlagSummaryGroupLabel(
  group: SourceCandidateReviewOverview["groups"][number]
) {
  return [
    group.claimId ?? "none",
    group.interventionId ?? "none",
    group.source,
    group.region
  ].join(" ");
}

function sourceCandidateReviewFlagSummaryGroups(
  reviewOverview: SourceCandidateReviewOverview
) {
  const groupsByFlag = new Map<
    string,
    {
      exampleGroup: SourceCandidateReviewOverview["groups"][number];
      flag: SourceCandidateReviewFlagCode;
      pendingInTopGroups: number;
      topGroups: number;
    }
  >();

  for (const group of reviewOverview.groups) {
    for (const flag of sourceCandidateReviewFlagCodes(group.topCandidate)) {
      let current = groupsByFlag.get(flag);

      if (!current) {
        current = {
          exampleGroup: group,
          flag,
          pendingInTopGroups: 0,
          topGroups: 0
        };
        groupsByFlag.set(flag, current);
      }

      current.pendingInTopGroups += group.count;
      current.topGroups += 1;
    }
  }

  return Array.from(groupsByFlag.values()).sort(
    (left, right) =>
      right.pendingInTopGroups - left.pendingInTopGroups ||
      right.topGroups - left.topGroups ||
      left.flag.localeCompare(right.flag)
  );
}

function formatSourceCandidateWorkflowSummaryCommandHints() {
  return [
    "Source-candidate read-only next commands",
    `reviewOverview=${quote("--candidate-review-overview --candidate-review-overview-limit 10")}`,
    `reviewFlags=${quote(formatSourceCandidateReviewFlagsCommand())}`,
    `duplicates=${quote("--candidates --candidate-duplicates")}`,
    `queuedJobs=${quote("--jobs --jobs-status queued")}`,
    `curationHandoff=${quote("--candidate-curation-handoff")}`
  ].join("\n");
}

function formatSourceCandidateIngestionJobSummary(
  summary: SourceCandidateIngestionJobSummary
) {
  if (summary.total === 0) {
    return "Source-candidate ingestion jobs: total=0";
  }

  return [
    `Source-candidate ingestion jobs: total=${summary.total}`,
    ...summary.groups.map(
      (group) => `- ${group.source} ${group.region} ${group.status}: ${group.count}`
    )
  ].join("\n");
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

function formatSourceCandidateCurationHandoffSummary(
  summary: SourceCandidateCurationHandoffSummary
) {
  if (summary.total === 0) {
    return "Source-candidate curation handoff: total=0";
  }

  return [
    `Source-candidate curation handoff: total=${summary.total}`,
    ...summary.groups.map(formatSourceCandidateCurationHandoffSummaryGroup)
  ].join("\n");
}

function formatSourceCandidateCurationHandoffSummaryGroup(
  group: SourceCandidateCurationHandoffSummary["groups"][number]
) {
  return [
    `- status=${quote(group.status)}`,
    `publicSourcePacketReady=${group.publicSourcePacketReady}:`,
    String(group.count),
    `handoff=${quote(formatSourceCandidateCurationHandoffStatusCommand(group.status))}`
  ].join(" ");
}

function formatSourceCandidateCurationHandoffStatusCommand(
  status: SourceCandidateCurationStatusKind
) {
  return `--candidate-curation-handoff --candidate-curation-handoff-status ${formatSourceCandidateCurationHandoffStatusValue(
    status
  )}`;
}

function formatSourceCandidateCurationHandoffStatusValue(
  status: SourceCandidateCurationStatusKind
) {
  switch (status) {
    case "Accepted reference missing":
      return "missing-reference";
    case "Accepted reference mismatch":
      return "reference-mismatch";
    case "Candidate claim missing":
      return "candidate-claim-missing";
    case "Claim link missing":
      return "claim-link-missing";
    case "Extraction pending":
      return "extraction-pending";
    case "Public source packet ready":
      return "ready";
  }
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

function readCandidateKeyValue(
  args: readonly string[],
  index: number,
  option: string
) {
  return decodeCandidateKeyValue(readRequiredValue(args, index, option), option);
}

function decodeCandidateKeyValue(value: string, option: string) {
  if (!value.startsWith(CANDIDATE_KEY_B64_PREFIX)) {
    return value;
  }

  const encoded = value.slice(CANDIDATE_KEY_B64_PREFIX.length);

  if (!encoded || !/^[A-Za-z0-9_-]+={0,2}$/.test(encoded)) {
    throw new Error(`${option} has an invalid b64 candidate key.`);
  }

  try {
    const decoded = Buffer.from(encoded, "base64url").toString("utf8");
    const normalisedInput = encoded.replace(/=+$/g, "");
    const normalisedRoundTrip = Buffer.from(decoded, "utf8").toString("base64url");

    if (!decoded || normalisedInput !== normalisedRoundTrip) {
      throw new Error("Candidate key did not round-trip.");
    }

    return decoded;
  } catch {
    throw new Error(`${option} has an invalid b64 candidate key.`);
  }
}

function safeCandidateKey(dedupeKey: string) {
  return `${CANDIDATE_KEY_B64_PREFIX}${Buffer.from(dedupeKey, "utf8").toString("base64url")}`;
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
  return readSourceCandidateSource(value, "--candidate-source");
}

function readJobSource(value: string): SourceCandidateSource {
  return readSourceCandidateSource(value, "--jobs-source");
}

function readSourceCandidateSource(
  value: string,
  option: "--candidate-source" | "--jobs-source"
): SourceCandidateSource {
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

  throw new Error(`${option} must be pubmed or clinical-trials.`);
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

function readJobStatus(
  value: string
): SourceCandidateIngestionJobListOptions["status"] {
  const normalised = value.trim().toLowerCase().replaceAll("_", "-");

  if (normalised === "queued") {
    return "QUEUED";
  }

  if (normalised === "running") {
    return "RUNNING";
  }

  if (normalised === "succeeded" || normalised === "success") {
    return "SUCCEEDED";
  }

  if (normalised === "failed" || normalised === "failure") {
    return "FAILED";
  }

  if (normalised === "skipped" || normalised === "skip") {
    return "SKIPPED";
  }

  throw new Error(
    "--jobs-status must be queued, running, succeeded, failed, or skipped."
  );
}

function readCurationHandoffStatus(value: string): SourceCandidateCurationStatusKind {
  const normalised = value.trim().toLowerCase();

  if (
    normalised === "accepted-reference-missing" ||
    normalised === "missing-reference" ||
    normalised === "reference-missing"
  ) {
    return "Accepted reference missing";
  }

  if (
    normalised === "accepted-reference-mismatch" ||
    normalised === "reference-mismatch" ||
    normalised === "mismatched-reference"
  ) {
    return "Accepted reference mismatch";
  }

  if (
    normalised === "candidate-claim-missing" ||
    normalised === "claim-context-missing" ||
    normalised === "unscoped-candidate"
  ) {
    return "Candidate claim missing";
  }

  if (normalised === "claim-link-missing" || normalised === "claim-missing") {
    return "Claim link missing";
  }

  if (
    normalised === "extraction-pending" ||
    normalised === "study-extraction-pending"
  ) {
    return "Extraction pending";
  }

  if (
    normalised === "ready" ||
    normalised === "public-source-packet-ready"
  ) {
    return "Public source packet ready";
  }

  throw new Error(
    "--candidate-curation-handoff-status must be missing-reference, reference-mismatch, candidate-claim-missing, claim-link-missing, extraction-pending, or ready."
  );
}

function readCandidateReviewFlag(value: string): SourceCandidateReviewFlagCode {
  const normalised = value.trim().toLowerCase();

  if (isSourceCandidateReviewFlagCode(normalised)) {
    return normalised;
  }

  throw new Error(
    "--candidate-review-flag must be broad-safety-query or low-title-query-overlap."
  );
}

function isSourceCandidateReviewFlagCode(
  value: string
): value is SourceCandidateReviewFlagCode {
  return SOURCE_CANDIDATE_REVIEW_FLAG_CODES.includes(
    value as SourceCandidateReviewFlagCode
  );
}

function readStudySourceType(value: string): SourceCandidateStudyExtractionSourceType {
  const normalised = value.trim().toLowerCase().replaceAll("_", "-");

  if (normalised === "meta-analysis") {
    return "META_ANALYSIS";
  }

  if (normalised === "systematic-review") {
    return "SYSTEMATIC_REVIEW";
  }

  if (
    normalised === "randomized-controlled-trial" ||
    normalised === "randomized-trial" ||
    normalised === "clinical-trial" ||
    normalised === "rct"
  ) {
    return "RANDOMIZED_CONTROLLED_TRIAL";
  }

  if (normalised === "observational-cohort" || normalised === "cohort") {
    return "OBSERVATIONAL_COHORT";
  }

  if (normalised === "case-report") {
    return "CASE_REPORT";
  }

  if (normalised === "animal-study") {
    return "ANIMAL_STUDY";
  }

  if (
    normalised === "in-vitro-mechanistic" ||
    normalised === "in-vitro" ||
    normalised === "mechanistic"
  ) {
    return "IN_VITRO_MECHANISTIC";
  }

  if (normalised === "clinical-trial-record" || normalised === "trial-record") {
    return "CLINICAL_TRIAL_RECORD";
  }

  if (
    normalised === "regulatory-safety-warning" ||
    normalised === "safety-warning"
  ) {
    return "REGULATORY_SAFETY_WARNING";
  }

  throw new Error(
    "--study-source-type must be meta-analysis, systematic-review, randomized-controlled-trial, observational-cohort, case-report, animal-study, in-vitro-mechanistic, clinical-trial-record, or regulatory-safety-warning."
  );
}

function hasCandidateListFilter({
  candidatesLimitProvided,
  candidateDecisionProvided,
  candidateExternalIdProvided,
  candidateJobIdProvided,
  candidateInterventionIdProvided,
  candidateInterventionMissingProvided,
  candidateClaimIdProvided,
  candidateClaimMissingProvided,
  candidateRegionProvided,
  candidateSource
}: {
  candidatesLimitProvided: boolean;
  candidateDecisionProvided: boolean;
  candidateExternalIdProvided: boolean;
  candidateJobIdProvided: boolean;
  candidateInterventionIdProvided: boolean;
  candidateInterventionMissingProvided?: boolean;
  candidateClaimIdProvided: boolean;
  candidateClaimMissingProvided?: boolean;
  candidateRegionProvided: boolean;
  candidateSource?: SourceCandidateSource;
}) {
  return Boolean(
    candidatesLimitProvided ||
      candidateSource ||
      candidateDecisionProvided ||
      candidateExternalIdProvided ||
      candidateJobIdProvided ||
      candidateInterventionIdProvided ||
      candidateInterventionMissingProvided ||
      candidateClaimIdProvided ||
      candidateClaimMissingProvided ||
      candidateRegionProvided
  );
}

function hasStudyExtractionOptions(options: SourceCandidateJobCommandOptions) {
  return Boolean(
    options.studyAbstract !== undefined ||
      options.studyAdverseEvents !== undefined ||
      options.studyDose !== undefined ||
      options.studyDuration !== undefined ||
      options.studyFundingConflicts !== undefined ||
      options.studyInterventionName !== undefined ||
      options.studyMainResults !== undefined ||
      options.studyOutcomes?.length ||
      options.studyPopulation !== undefined ||
      options.studyRelevance !== undefined ||
      options.studyRiskOfBias !== undefined ||
      options.studySampleSize !== undefined ||
      options.studySourceType !== undefined ||
      options.studyUpdateExisting
  );
}

function setQueueOption(
  options: SourceCandidateJobCommandOptions,
  source: SourceCandidateSource,
  query: string
) {
  if (hasQueueOption(options)) {
    throw new Error("Only one queue option can be used at a time.");
  }

  options.queueSource = source;
  options.queueQuery = query;
}

function setQueueClaimSourcesOption(
  options: SourceCandidateJobCommandOptions,
  claimId: string
) {
  if (hasQueueOption(options)) {
    throw new Error("Only one queue option can be used at a time.");
  }

  options.queueClaimSourcesClaimId = claimId;
}

function hasQueueOption(options: SourceCandidateJobCommandOptions) {
  return Boolean(options.queueSource || options.queueClaimSourcesClaimId);
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
