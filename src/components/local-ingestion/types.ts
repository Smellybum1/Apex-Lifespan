export type LocalIngestionJobStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "SKIPPED";
export type LocalIngestionSource = "PUBMED" | "CLINICALTRIALS_GOV";
export type LocalIngestionDecision = "PENDING_REVIEW" | "ACCEPTED" | "REJECTED";

export type LocalIngestionStatusReadout = {
  candidates: {
    counts: Record<LocalIngestionDecision, number>;
    recent: LocalIngestionCandidateReadout[];
    total: number;
  };
  queue: {
    counts: Record<LocalIngestionJobStatus, number>;
    recentJobs: LocalIngestionJobReadout[];
    total: number;
  };
  updatedAt: string;
};

export type LocalIngestionJobReadout = {
  claimId?: string;
  completedAt?: string;
  error?: string;
  interventionId?: string;
  jobId: string;
  query: string;
  recordsChanged: number;
  recordsFound: number;
  region: string;
  source: LocalIngestionSource;
  startedAt?: string;
  status: LocalIngestionJobStatus;
  updatedAt: string;
};

export type LocalIngestionCandidateReadout = {
  claimId?: string;
  decision: LocalIngestionDecision;
  discoveryClassification?: LocalIngestionDiscoveryClassificationReadout;
  discoveredAt: string;
  externalId: string;
  interventionId?: string;
  publishedYear?: number;
  query: string;
  reviewStatus: string;
  source: LocalIngestionSource;
  sourceType?: string;
  title: string;
  triageScore: number;
  url: string;
};

export type LocalIngestionDiscoveryClassificationReadout = {
  bucket: "likely-useful" | "maybe-useful" | "likely-noise";
  cautions: string[];
  label: string;
  reasons: string[];
  score: number;
};

export type LocalIngestionStartResponse = {
  deepeningCatchUp: LocalIngestionDeepeningCatchUpReadout;
  existingJobs: number;
  interventionCount: number;
  jobCount: number;
  newJobs: number;
  phase: "primary" | "synonym";
  sampleJobs: LocalIngestionQueuedJobReadout[];
  searchTermCount: number;
  status: LocalIngestionStatusReadout;
};

export type LocalIngestionDeepeningCatchUpReadout = {
  eligibleJobs: number;
  existingJobs: number;
  jobCount: number;
  newJobs: number;
  skippedJobs: number;
};

export type LocalIngestionQueuedJobReadout = {
  claimId?: string;
  created: boolean;
  interventionId?: string;
  jobId: string;
  query: string;
  region: string;
  source: LocalIngestionSource;
  status: LocalIngestionJobStatus;
};

export type LocalIngestionRunResponse = {
  hasMoreQueued: boolean;
  limit: number;
  processed: number;
  results: LocalIngestionRunJobResult[];
  status: LocalIngestionStatusReadout;
};

export type LocalIngestionRunJobResult = {
  deepening?: {
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
  };
  error?: string;
  jobId: string;
  query: string;
  recordsChanged: number;
  recordsFound: number;
  region: string;
  source: LocalIngestionSource;
  status: "SUCCEEDED" | "FAILED" | "SKIPPED";
};

export type LocalIngestionLogEntry = {
  detail?: string;
  id: string;
  level: "info" | "success" | "error";
  message: string;
  timestamp: string;
};

export type LocalCandidateReviewBucket =
  | "all"
  | "all-useful"
  | "likely-useful"
  | "maybe-useful"
  | "likely-noise"
  | "unclassified";
export type LocalCandidateReviewSourceFilter = "ALL" | LocalIngestionSource;
export type LocalCandidateReviewStudyFilter =
  | "all"
  | "reviews"
  | "trials"
  | "results-posted";

export type LocalCandidateReviewResponse = {
  candidates: LocalCandidateReviewCandidate[];
  counts: {
    all: number;
    allUseful: number;
    likelyNoise: number;
    likelyUseful: number;
    maybeUseful: number;
    unclassified: number;
  };
  filters: {
    bucket: LocalCandidateReviewBucket;
    interventionId?: string;
    limit: number;
    q?: string;
    source: LocalCandidateReviewSourceFilter;
    studyFilter: LocalCandidateReviewStudyFilter;
  };
  updatedAt: string;
};

export type LocalCandidateReviewCandidate = LocalIngestionCandidateReadout & {
  dedupeKey: string;
  interventionName?: string;
};

export type LocalCandidateReviewDecisionResponse = {
  candidate: LocalCandidateReviewCandidate;
};

export type LocalCandidateReviewBulkAction =
  | "accept-all"
  | "accept-likely-useful"
  | "reject-not-useful";

export type LocalCandidateReviewBulkResponse = {
  accepted: number;
  errors: string[];
  rejected: number;
  scanned: number;
  status: "completed" | "stopped-at-limit";
};

export type LocalAcceptedCandidateProcessingStatusResponse = {
  counts: {
    accepted: number;
    acceptedWithReference: number;
    claimLinked: number;
    missingReference: number;
    needsClaim: number;
    processed: number;
    unprocessed: number;
  };
  recent: LocalAcceptedCandidateProcessingResult[];
  updatedAt: string;
};

export type LocalAcceptedCandidateProcessingRunResponse = {
  errors: Array<{
    dedupeKey: string;
    error: string;
    title: string;
  }>;
  hasMore: boolean;
  limit: number;
  processed: number;
  results: LocalAcceptedCandidateProcessingResult[];
  status: LocalAcceptedCandidateProcessingStatusResponse;
};

export type LocalAcceptedCandidateProcessingResult = {
  acceptedReferenceId?: string;
  claimId?: string;
  dedupeKey: string;
  externalId: string;
  interventionName?: string;
  linkedClaim: boolean;
  nextAction: string;
  novelOutcomeLabels: string[];
  outcomeLabels: string[];
  processedAt?: string;
  source: LocalIngestionSource;
  sourceTypeSuggestion: string;
  title: string;
  url: string;
};

export type LocalBenefitDiscoveryAction =
  | "draft-claim"
  | "link-existing-claim"
  | "reject-cluster";
export type LocalBenefitDiscoveryAutomationAction = LocalBenefitDiscoveryAction | "hold";

export type LocalBenefitDiscoveryQueueResponse = {
  clusters: LocalBenefitDiscoveryCluster[];
  counts: {
    activeClusters: number;
    activeCandidates: number;
    decidedClusters: number;
    mismatchCandidates: number;
  };
  updatedAt: string;
};

export type LocalBenefitDiscoveryCluster = {
  candidateCount: number;
  clusterKey: string;
  existingClaims: Array<{
    claimText: string;
    id: string;
  }>;
  interventionId: string;
  interventionName: string;
  mismatchCount: number;
  novelCandidateCount: number;
  outcome: string;
  outcomeLabel: string;
  rejectedCount: number;
  leadReasons: string[];
  score: number;
  topSources: LocalBenefitDiscoverySource[];
  usableCandidateCount: number;
};

export type LocalBenefitDiscoverySource = {
  acceptedReferenceId?: string;
  dedupeKey: string;
  externalId: string;
  identityCautions: string[];
  mismatchReasons: string[];
  publishedYear?: number;
  source: LocalIngestionSource;
  sourceTypeSuggestion: string;
  title: string;
  triageScore: number;
  url: string;
};

export type LocalBenefitDiscoveryActionResponse = {
  action: LocalBenefitDiscoveryAction;
  affectedCandidates: number;
  claimCreated: boolean;
  claimId?: string;
  cluster: LocalBenefitDiscoveryCluster;
  linkedReferences: number;
  message: string;
};

export type LocalBenefitDiscoveryAutomationDecision = {
  action: LocalBenefitDiscoveryAutomationAction;
  applied: boolean;
  candidateCount: number;
  claimId?: string;
  clusterKey: string;
  error?: string;
  existingClaimCount: number;
  interventionName: string;
  leadReasons: string[];
  leadScore: number;
  linkedReferences: number;
  mismatchCount: number;
  outcomeLabel: string;
  usableCandidateCount: number;
};

export type LocalBenefitDiscoveryAutomationResponse = {
  action: "auto-build";
  applied: boolean;
  counts: {
    appliedActions: number;
    draftClaims: number;
    errors: number;
    holdClusters: number;
    linkExistingClaims: number;
    rejectClusters: number;
    scannedClusters: number;
    skippedMismatchCandidates: number;
    linkedReferences: number;
  };
  decisions: LocalBenefitDiscoveryAutomationDecision[];
  limit: number;
  message: string;
  threshold: number;
  updatedAt: string;
};

export type LocalIdentityResolutionAction =
  | "confirm-target"
  | "reassign-intervention"
  | "reject-wrong-supplement"
  | "add-synonym";

export type LocalIdentityResolutionCandidate = {
  dedupeKey: string;
  externalId: string;
  identityCautions: string[];
  interventionId: string;
  interventionName: string;
  matchedInterventions: Array<{
    id: string;
    name: string;
  }>;
  mismatchReasons: string[];
  publishedYear?: number;
  query: string;
  source: LocalIngestionSource;
  sourceTypeSuggestion: string;
  title: string;
  triageScore: number;
  url: string;
};

export type LocalIdentityResolutionQueueResponse = {
  candidates: LocalIdentityResolutionCandidate[];
  counts: {
    blockedCandidates: number;
  };
  interventions: Array<{
    id: string;
    name: string;
  }>;
  limit: number;
  updatedAt: string;
};

export type LocalIdentityResolutionActionResponse = {
  action: LocalIdentityResolutionAction;
  candidate?: LocalIdentityResolutionCandidate;
  message: string;
};

export type DashboardMainTab =
  | "evidence-map"
  | "claim-details"
  | "candidate-review"
  | "local-ingestion"
  | "catalog-trust";

export const DASHBOARD_MAIN_TABS: Array<{ label: string; value: DashboardMainTab }> = [
  { label: "Evidence Map", value: "evidence-map" },
  { label: "Claim Details", value: "claim-details" },
  { label: "Candidate Review", value: "candidate-review" },
  { label: "Local Ingestion", value: "local-ingestion" },
  { label: "Catalog Trust", value: "catalog-trust" }
];

export const LOCAL_DASHBOARD_TABS = new Set<DashboardMainTab>([
  "candidate-review",
  "local-ingestion"
]);

export const LOCAL_CANDIDATE_BUCKET_OPTIONS: Array<{
  label: string;
  value: LocalCandidateReviewBucket;
}> = [
  { label: "Likely useful", value: "likely-useful" },
  { label: "Maybe useful", value: "maybe-useful" },
  { label: "All useful", value: "all-useful" },
  { label: "Likely noise", value: "likely-noise" },
  { label: "Unclassified", value: "unclassified" },
  { label: "All pending", value: "all" }
];
