import type {
  LocalAcceptedCandidateProcessingRunResponse,
  LocalAcceptedCandidateProcessingStatusResponse,
  LocalBenefitDiscoveryAutomationResponse,
  LocalBenefitDiscoveryAutomationScope,
  LocalBenefitDiscoveryAutomationStrategy,
  LocalBenefitDiscoveryQueueResponse,
  LocalCandidateReviewAutomationResponse,
  LocalCandidateReviewAutomationStrategy,
  LocalCandidateReviewBucket,
  LocalCandidateReviewBulkAction,
  LocalCandidateReviewBulkResponse,
  LocalCandidateReviewSourceFilter,
  LocalCandidateReviewStudyFilter,
  LocalClaimExpansionResponse,
  LocalIdentityResolutionAutomationResponse,
  LocalIdentityResolutionAutomationScope,
  LocalIdentityResolutionAutomationStrategy,
  LocalIngestionRunResponse,
  LocalIngestionStartResponse,
  LocalIngestionStatusReadout,
  LocalScoreFinalizationResponse,
  LocalSourceWorkRepairResponse
} from "@/components/local-ingestion/types";

export const LOCAL_ACCEPTED_PROCESSING_BATCH_SIZE = 50;
export const LOCAL_UPDATE_PIPELINE_ACCEPTED_BATCH_CAP = 120;

/**
 * `refresh` is the only UI-only stage: it re-reads derived views so the open
 * dashboard repaints. A headless run has nothing to repaint, so the runner
 * skips it unless the caller supplies the fetch operations.
 */
export const LOCAL_UPDATE_PIPELINE_STAGE_DEFINITIONS = [
  { id: "queue", label: "Queue searches" },
  { id: "accepted-processing", label: "Process accepted" },
  { id: "ingestion", label: "Ingest sources" },
  { id: "candidate-review", label: "Review candidates" },
  { id: "identity-resolution", label: "Resolve identity" },
  { id: "benefit-discovery", label: "Build leads" },
  { id: "claim-expansion", label: "Expand claims" },
  { id: "source-work-repair", label: "Extract sources" },
  { id: "score-finalization", label: "Score ready" },
  { id: "refresh", label: "Refresh views" }
] as const;

export type LocalUpdatePipelineStageId =
  (typeof LOCAL_UPDATE_PIPELINE_STAGE_DEFINITIONS)[number]["id"];

export type LocalUpdatePipelineStageStatus =
  | "pending"
  | "running"
  | "done"
  | "skipped"
  | "error";

export type LocalUpdatePipelineStage = {
  detail?: string;
  id: LocalUpdatePipelineStageId;
  label: string;
  status: LocalUpdatePipelineStageStatus;
};

export type LocalUpdatePipelineSettings = {
  leadThreshold: number;
  rejectThreshold: number;
  runDelayMs: number;
  sessionJobLimit: number;
};

/**
 * The seam that makes this pipeline headless-capable. The dashboard injects
 * implementations that POST to `/api/local-ingestion/*`; `scripts/pipeline-run.ts`
 * injects ones that call the data-layer functions directly, which is required
 * rather than merely faster — `guardLocalIngestionRequest` demands localhost
 * origin headers, so the HTTP path structurally needs a browser.
 */
export type LocalUpdatePipelineOperations = {
  fetchAcceptedCandidateProcessingStatus: () => Promise<LocalAcceptedCandidateProcessingStatusResponse>;
  fetchBenefitDiscoveryQueue: () => Promise<LocalBenefitDiscoveryQueueResponse>;
  fetchIngestionStatus: () => Promise<LocalIngestionStatusReadout>;
  postAcceptedCandidateProcessingRun: (
    limit: number
  ) => Promise<LocalAcceptedCandidateProcessingRunResponse>;
  postBenefitDiscoveryAutomation: (input: {
    apply: boolean;
    rejectThreshold: number;
    scope: LocalBenefitDiscoveryAutomationScope;
    strategy: LocalBenefitDiscoveryAutomationStrategy;
    threshold: number;
  }) => Promise<LocalBenefitDiscoveryAutomationResponse>;
  postCandidateReviewAutomation: (input: {
    apply: boolean;
    q: string;
    source: LocalCandidateReviewSourceFilter;
    strategy: LocalCandidateReviewAutomationStrategy;
    studyFilter: LocalCandidateReviewStudyFilter;
  }) => Promise<LocalCandidateReviewAutomationResponse>;
  postCandidateReviewBulkDecision: (input: {
    bucket: LocalCandidateReviewBucket;
    bulkAction: LocalCandidateReviewBulkAction;
    q: string;
    reviewNote: string;
    source: LocalCandidateReviewSourceFilter;
    studyFilter: LocalCandidateReviewStudyFilter;
  }) => Promise<LocalCandidateReviewBulkResponse>;
  postIdentityResolutionAutomation: (input: {
    apply: boolean;
    scope: LocalIdentityResolutionAutomationScope;
    strategy: LocalIdentityResolutionAutomationStrategy;
  }) => Promise<LocalIdentityResolutionAutomationResponse>;
  postClaimExpansion: (input: {
    apply: boolean;
    limit?: number;
  }) => Promise<LocalClaimExpansionResponse>;
  postIngestionRun: (limit: number, minDelayMs: number) => Promise<LocalIngestionRunResponse>;
  postIngestionStart: () => Promise<LocalIngestionStartResponse>;
  postIngestionSynonyms: () => Promise<LocalIngestionStartResponse>;
  postScoreFinalization: (input: {
    apply: boolean;
    limit?: number;
  }) => Promise<LocalScoreFinalizationResponse>;
  postSourceWorkRepair: (input: {
    apply: boolean;
    limit?: number;
  }) => Promise<LocalSourceWorkRepairResponse>;
};

export type LocalUpdatePipelineRunResult = {
  status: "completed" | "stopped";
};
