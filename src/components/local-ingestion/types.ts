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
  safety: {
    minDelayMs: number;
  };
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
    parkedResearch: number;
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
export type LocalCandidateReviewAutomationAction = "accept" | "hold" | "reject";
export type LocalCandidateReviewAutomationStrategy = "strict" | "query-backed";
export type LocalCandidateReviewSignalKind =
  | "identity-mismatch"
  | "low-signal"
  | "park-research"
  | "spot-check";
export type LocalCandidateReviewSignalApplyAction =
  | "park-research"
  | "reject-mismatches";

export type LocalCandidateReviewBulkResponse = {
  accepted: number;
  errors: string[];
  rejected: number;
  /** Rows the relevance gate pulled out of a bulk accept. Counted in `rejected`. */
  relevanceGateVetoed: number;
  scanned: number;
  status: "completed" | "stopped-at-limit";
};

export type LocalCandidateReviewAutomationDecision = {
  action: LocalCandidateReviewAutomationAction;
  applied: boolean;
  classificationScore?: number;
  dedupeKey: string;
  error?: string;
  externalId: string;
  interventionName?: string;
  reasons: string[];
  source: LocalIngestionSource;
  sourceTypeSuggestion: string;
  title: string;
  triageScore: number;
};

export type LocalCandidateReviewAutomationResponse = {
  action: "auto-triage-maybe-useful";
  applied: boolean;
  counts: {
    accepted: number;
    appliedActions: number;
    errors: number;
    held: number;
    rejected: number;
    scanned: number;
  };
  decisions: LocalCandidateReviewAutomationDecision[];
  filters: LocalCandidateReviewResponse["filters"];
  message: string;
  status: "completed" | "stopped-at-limit";
  strategy: LocalCandidateReviewAutomationStrategy;
  updatedAt: string;
};

export type LocalCandidateReviewSignalSample = {
  dedupeKey: string;
  externalId: string;
  source: LocalIngestionSource;
  sourceTypeSuggestion: string;
  title: string;
  triageScore: number;
};

export type LocalCandidateReviewSignalDecision = LocalCandidateReviewSignalSample & {
  classificationScore?: number;
  dedupeKey: string;
  identityVisible: boolean;
  interventionId?: string;
  interventionName?: string;
  kind: LocalCandidateReviewSignalKind;
  lowScore: boolean;
  outcomeLabels: string[];
  outcomes: Array<{
    label: string;
    outcome: string;
    score: number;
  }>;
  priorityStudy: boolean;
  queryBacked: boolean;
  reasons: string[];
  sourcePointsElsewhere: boolean;
};

export type LocalCandidateReviewSignalSummary = {
  averageScore: number;
  count: number;
  identityVisibleCount: number;
  key: string;
  label: string;
  lowScoreCount: number;
  priorityStudyCount: number;
  queryBackedCount: number;
  samples: LocalCandidateReviewSignalSample[];
  sourcePointsElsewhereCount: number;
  topOutcomes: Array<{
    count: number;
    label: string;
  }>;
};

export type LocalCandidateReviewOutcomeSignal = {
  count: number;
  interventionCount: number;
  label: string;
  outcome: string;
  samples: LocalCandidateReviewSignalSample[];
};

export type LocalCandidateReviewSignalMiningResponse = {
  action: "mine-maybe-useful-signals";
  counts: {
    identityMismatch: number;
    interventionSignals: number;
    lowSignal: number;
    outcomeSignals: number;
    parkResearch: number;
    scanned: number;
    spotCheck: number;
  };
  decisions: LocalCandidateReviewSignalDecision[];
  filters: LocalCandidateReviewResponse["filters"];
  holdReasons: Array<{
    count: number;
    label: string;
  }>;
  interventions: LocalCandidateReviewSignalSummary[];
  message: string;
  outcomes: LocalCandidateReviewOutcomeSignal[];
  sourceTypes: Array<{
    count: number;
    label: string;
  }>;
  status: "completed" | "stopped-at-limit";
  updatedAt: string;
};

export type LocalCandidateReviewSignalApplyResponse = {
  action: "apply-mined-signals";
  counts: {
    errors: number;
    parked: number;
    rejected: number;
    scanned: number;
    skipped: number;
  };
  decisions: LocalCandidateReviewSignalDecision[];
  errors: string[];
  filters: LocalCandidateReviewResponse["filters"];
  message: string;
  signalAction: LocalCandidateReviewSignalApplyAction;
  status: "completed" | "stopped-at-limit";
  updatedAt: string;
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
  novelTopicLabels: string[];
  outcomeLabels: string[];
  processedAt?: string;
  source: LocalIngestionSource;
  sourceTypeSuggestion: string;
  title: string;
  topicLabels: string[];
  url: string;
};

export type LocalBenefitDiscoveryAction =
  | "draft-claim"
  | "link-existing-claim"
  | "park-lead"
  | "reject-cluster";
export type LocalBenefitDiscoveryAutomationAction = LocalBenefitDiscoveryAction | "hold";
export type LocalBenefitDiscoveryAutomationScope = "batch" | "all-eligible";
export type LocalBenefitDiscoveryAutomationStrategy =
  | "build-leads"
  | "link-existing"
  | "park-backlog";

export type LocalBenefitDiscoveryQueueResponse = {
  clusters: LocalBenefitDiscoveryCluster[];
  counts: {
    activeClusters: number;
    activeCandidates: number;
    decidedClusters: number;
    mismatchCandidates: number;
    parkedClusters: number;
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
  topicKey: string;
  topicLabel: string;
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
  topicKey: string;
  topicLabel: string;
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
    parkLeadClusters: number;
    rejectClusters: number;
    scannedClusters: number;
    skippedMismatchCandidates: number;
    linkedReferences: number;
  };
  decisions: LocalBenefitDiscoveryAutomationDecision[];
  limit: number;
  message: string;
  parkThreshold: number;
  rejectThreshold: number;
  scope: LocalBenefitDiscoveryAutomationScope;
  strategy: LocalBenefitDiscoveryAutomationStrategy;
  threshold: number;
  updatedAt: string;
};

export type LocalIdentityResolutionAction =
  | "confirm-target"
  | "reassign-intervention"
  | "reject-wrong-supplement"
  | "add-synonym";
export type LocalIdentityResolutionAutomationAction =
  | "confirm-target"
  | "reassign-intervention"
  | "reject-wrong-supplement"
  | "hold";
export type LocalIdentityResolutionAutomationScope = "batch" | "all-eligible";
export type LocalIdentityResolutionAutomationStrategy = "strict" | "source-led";

export type LocalIdentityResolutionCandidate = {
  dedupeKey: string;
  externalId: string;
  identityCautions: string[];
  interventionId: string;
  interventionName: string;
  matchedInterventions: Array<{
    hasAcceptedCandidate?: boolean;
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

export type LocalIdentityResolutionAutomationDecision = {
  action: LocalIdentityResolutionAutomationAction;
  applied: boolean;
  dedupeKey: string;
  error?: string;
  externalId: string;
  interventionId: string;
  interventionName: string;
  matchedInterventionId?: string;
  matchedInterventionName?: string;
  query: string;
  reasons: string[];
  source: LocalIngestionSource;
  title: string;
};

export type LocalIdentityResolutionAutomationResponse = {
  action: "auto-resolve";
  applied: boolean;
  counts: {
    appliedActions: number;
    confirmTarget: number;
    errors: number;
    hold: number;
    reassignIntervention: number;
    rejectWrongSupplement: number;
    scannedCandidates: number;
  };
  decisions: LocalIdentityResolutionAutomationDecision[];
  limit: number;
  message: string;
  scope: LocalIdentityResolutionAutomationScope;
  strategy: LocalIdentityResolutionAutomationStrategy;
  updatedAt: string;
};

export type LocalScoreFinalizationResponse = {
  action: "finalize-score-ready";
  applied: boolean;
  counts: {
    appliedUpdates: number;
    defaultScoreReview: number;
    errors: number;
    readyAfter: number;
    readyBefore: number;
    scanned: number;
    scoredPublicClaims: number;
    skippedNoChange: number;
    snapshotGaps: number;
    sourceBlocked: number;
    sourceBlockedWithoutNextAction: number;
    sourceBlockers: {
      extraction_pending: number;
      missing_sources: number;
      not_linked: number;
    };
  };
  decisions: Array<{
    applied: boolean;
    claimId: string;
    currentScoreLabel: string;
    error?: string;
    finalLabel?: string;
    interventionName?: string;
    outcome: string;
    reasons: string[];
    snapshotCreated?: boolean;
    suggestedScoreLabel?: string;
    updatedClaim?: boolean;
  }>;
  limit: number;
  message: string;
  repairSummary: {
    blockerBreakdown: Array<{
      claimCount: number;
      kind: string;
      label: string;
      nextAction: string;
      priority: number;
    }>;
    extractionBatchGroups: Array<{
      claimCount: number;
      claimLinks: number;
      highestPriority: number;
      intervention: {
        id: string;
        name: string;
        slug: string;
      } | null;
      key: string;
      nextAction: string;
      outcome: string;
      priority: number;
      referenceCount: number;
    }>;
    extractionPendingRows: number;
    extractionReadyReferenceGroups: number;
    identityWarningReferenceGroups: number;
    missingSourceRows: number;
    sourceBlockedRows: number;
    unlinkedRows: number;
  };
  updatedAt: string;
};

export type LocalClaimExpansionResponse = {
  action: "expand-claims";
  applied: boolean;
  counts: {
    claimCellsAfter: number;
    claimCellsBefore: number;
    claimsCreated: number;
    errors: number;
    groupsHeld: number;
    groupsScanned: number;
    heldIdentity: number;
    heldNoOutcome: number;
    heldRejectedDecision: number;
    linkedExistingClaims: number;
    linkedReferences: number;
    sourceCandidatesAfter: number;
    sourceCandidatesBefore: number;
    syncedClaims: number;
  };
  decisions: Array<{
    action: "draft-claim" | "link-existing-claim" | "hold";
    applied: boolean;
    candidateCount: number;
    claimCreated?: boolean;
    claimId?: string;
    error?: string;
    existingClaimCount: number;
    interventionName: string;
    linkedReferences: number;
    outcome: string;
    reason?: string;
    referenceCount: number;
  }>;
  limit: number;
  message: string;
  updatedAt: string;
};

export type LocalSourceWorkRepairResponse = {
  action: "repair-source-work";
  applied: boolean;
  counts: {
    draftedExtractions: number;
    errors: number;
    heldExistingMultiStudy: number;
    heldIdentityWarnings: number;
    heldNoCandidate: number;
    heldNoSourceText: number;
    identityWarningsCovered: number;
    scannedReferences: number;
    sourceBlockedAfter: number;
    sourceBlockedBefore: number;
    syncedClaims: number;
  };
  decisions: Array<{
    action: "draft-extraction" | "hold";
    applied: boolean;
    claimCount: number;
    error?: string;
    reason?: string;
    referenceId: string;
    referenceLabel: string;
    sourceType?: string;
    title: string;
  }>;
  limit: number;
  message: string;
  updatedAt: string;
};

export type DashboardMainTab =
  | "evidence-map"
  | "claim-details"
  | "candidate-review"
  | "local-ingestion"
  | "catalog-trust";

export const DASHBOARD_MAIN_TABS: Array<{ label: string; value: DashboardMainTab }> = [
  { label: "Evidence Guide", value: "evidence-map" },
  { label: "Evidence Notes", value: "claim-details" },
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
