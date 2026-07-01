import {
  ConfidenceLevel as DbConfidenceLevel,
  EvidenceLabel as DbEvidenceLabel,
  EvidenceMomentum as DbEvidenceMomentum,
  IngestionStatus as DbIngestionStatus,
  OutcomeArea as DbOutcomeArea,
  Prisma,
  ReviewStatus as DbReviewStatus,
  SourceCandidateDecision as DbSourceCandidateDecision,
  SourceKind as DbSourceKind
} from "@prisma/client";

import {
  listSourceCandidateIngestionJobs,
  queuePubMedDeepeningCatchUpJobs,
  queueInterventionSourceCandidateDiscoveryJobs,
  runNextSourceCandidateIngestionJob,
  summarizeSourceCandidateIngestionJobs,
  type QueuedPubMedDeepeningCatchUpJobs,
  type QueuedSourceCandidateIngestionJob,
  type SourceCandidateIngestionJobRunResult
} from "@/lib/data/source-candidate-jobs";
import {
  LOCAL_BENEFIT_DISCOVERY_AUTOMATION_ALL_MAX,
  LOCAL_BENEFIT_DISCOVERY_LIMIT_MAX,
  LOCAL_IDENTITY_RESOLUTION_AUTOMATION_ALL_MAX,
  LOCAL_RECENT_ITEM_LIMIT,
  LOCAL_REVIEW_BULK_BATCH_SIZE,
  LOCAL_REVIEW_BULK_MAX_CANDIDATES,
  normaliseAcceptedProcessingLimit,
  normaliseBenefitDiscoveryAutomationLimit,
  normaliseBenefitDiscoveryLimit,
  normaliseBenefitDiscoveryScoreThreshold,
  normaliseIdentityResolutionAutomationLimit,
  normaliseIdentityResolutionLimit,
  normaliseReviewLimit,
  normaliseRunLimit
} from "@/lib/data/local-ingestion-limits";
import {
  linkAcceptedSourceCandidateClaim,
  recordSourceCandidateDecision
} from "@/lib/data/source-candidates";
import { prisma } from "@/lib/db/prisma";
import {
  LOCAL_ACCEPTED_PROCESSING_METADATA_VERSION,
  readLocalAcceptedCandidateProcessingMetadata,
  readLocalBenefitDiscoveryDecisionMetadata,
  readLocalIdentityResolutionMetadata,
  readSourceCandidateDiscoveryClassification,
  SOURCE_CANDIDATE_METADATA_PATHS,
  sourceCandidateMetadataObject,
  sourceCandidateMetadataString,
  sourceCandidateMetadataStringArray,
  writeLocalAcceptedCandidateProcessingMetadata,
  writeLocalBenefitDiscoveryDecisionMetadata,
  writeLocalCandidateReviewDispositionMetadata,
  writeLocalIdentityResolutionMetadata,
  type LocalAcceptedCandidateProcessingOutcomeMetadata
} from "@/lib/source-candidate-metadata";

const LOCAL_SUPPORTED_SOURCES = [DbSourceKind.PUBMED, DbSourceKind.CLINICALTRIALS_GOV];
const LOCAL_CANDIDATE_REVIEW_SELECT = {
  claimId: true,
  decision: true,
  dedupeKey: true,
  discoveredAt: true,
  externalId: true,
  intervention: {
    select: {
      name: true,
      synonyms: true
    }
  },
  interventionId: true,
  metadata: true,
  publishedYear: true,
  query: true,
  reviewStatus: true,
  source: true,
  sourceType: true,
  title: true,
  triageScore: true,
  url: true
} satisfies Prisma.SourceCandidateSelect;
const LOCAL_ACCEPTED_CANDIDATE_PROCESS_SELECT = {
  acceptedReferenceId: true,
  claim: {
    select: {
      claimText: true,
      outcome: true
    }
  },
  claimId: true,
  dedupeKey: true,
  externalId: true,
  intervention: {
    select: {
      claims: {
        select: {
          outcome: true
        }
      },
      name: true
    }
  },
  interventionId: true,
  metadata: true,
  publishedYear: true,
  query: true,
  source: true,
  sourceType: true,
  title: true,
  triageScore: true,
  url: true
} satisfies Prisma.SourceCandidateSelect;
const LOCAL_BENEFIT_DISCOVERY_CANDIDATE_SELECT = {
  acceptedReferenceId: true,
  claimId: true,
  dedupeKey: true,
  decision: true,
  externalId: true,
  intervention: {
    select: {
      claims: {
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        select: {
          claimText: true,
          id: true,
          outcome: true
        }
      },
      id: true,
      name: true,
      synonyms: true
    }
  },
  interventionId: true,
  metadata: true,
  publishedYear: true,
  query: true,
  source: true,
  sourceType: true,
  title: true,
  triageScore: true,
  url: true
} satisfies Prisma.SourceCandidateSelect;
const LOCAL_BENEFIT_DISCOVERY_INTERVENTION_SELECT = {
  id: true,
  name: true,
  synonyms: true
} satisfies Prisma.InterventionSelect;
const LOCAL_ACCEPTED_OUTCOME_KEYWORDS: Array<{
  label: string;
  outcome: DbOutcomeArea;
  terms: string[];
}> = [
  {
    label: "Safety/adverse effects",
    outcome: DbOutcomeArea.SAFETY_ADVERSE_EFFECTS,
    terms: [
      "adverse",
      "safety",
      "toxicity",
      "tolerability",
      "side effect",
      "interaction",
      "liver",
      "kidney",
      "renal",
      "bleeding"
    ]
  },
  {
    label: "Eye health",
    outcome: DbOutcomeArea.EYE_HEALTH,
    terms: ["eye", "vision", "visual", "retinal", "retina", "macular", "dry eye", "myopia"]
  },
  {
    label: "Joint/tendon/skin",
    outcome: DbOutcomeArea.JOINT_TENDON_SKIN,
    terms: ["skin", "wrinkle", "dermal", "collagen", "joint", "tendon", "cartilage", "osteoarthritis"]
  },
  {
    label: "Immune/respiratory",
    outcome: DbOutcomeArea.IMMUNE_RESPIRATORY,
    terms: ["immune", "immunity", "respiratory", "infection", "cold", "influenza", "asthma", "lung"]
  },
  {
    label: "Fertility/hormones",
    outcome: DbOutcomeArea.FERTILITY_HORMONES,
    terms: [
      "fertility",
      "sperm",
      "testosterone",
      "estrogen",
      "hormone",
      "ovarian",
      "menopause",
      "pcos"
    ]
  },
  {
    label: "Cognition",
    outcome: DbOutcomeArea.COGNITION,
    terms: ["cognition", "cognitive", "memory", "attention", "executive", "brain", "neuro"]
  },
  {
    label: "Mood/stress",
    outcome: DbOutcomeArea.MOOD_STRESS,
    terms: ["mood", "stress", "anxiety", "depression", "cortisol", "resilience"]
  },
  {
    label: "Sleep",
    outcome: DbOutcomeArea.SLEEP,
    terms: ["sleep", "insomnia", "circadian", "melatonin"]
  },
  {
    label: "Muscle/strength",
    outcome: DbOutcomeArea.MUSCLE_STRENGTH,
    terms: ["muscle", "strength", "lean mass", "resistance training", "sarcopenia", "power"]
  },
  {
    label: "VO2 max/endurance",
    outcome: DbOutcomeArea.VO2_MAX_ENDURANCE,
    terms: ["vo2", "endurance", "aerobic", "exercise performance", "fatigue", "cycling", "running"]
  },
  {
    label: "LDL/ApoB/lipids",
    outcome: DbOutcomeArea.LDL_APOB_LIPIDS,
    terms: ["ldl", "apob", "apo b", "cholesterol", "triglyceride", "lipid"]
  },
  {
    label: "Blood pressure",
    outcome: DbOutcomeArea.BLOOD_PRESSURE,
    terms: ["blood pressure", "hypertension", "systolic", "diastolic", "vascular"]
  },
  {
    label: "Glucose/insulin/HbA1c",
    outcome: DbOutcomeArea.GLUCOSE_INSULIN_HBA1C,
    terms: ["glucose", "insulin", "hba1c", "glycemic", "diabetes", "metabolic syndrome"]
  },
  {
    label: "Inflammation",
    outcome: DbOutcomeArea.INFLAMMATION,
    terms: ["inflammation", "inflammatory", "crp", "cytokine", "tnf", "interleukin"]
  },
  {
    label: "Cardiovascular events",
    outcome: DbOutcomeArea.CARDIOVASCULAR_EVENTS,
    terms: ["cardiovascular", "coronary", "stroke", "heart failure", "myocardial", "mortality"]
  },
  {
    label: "Biological aging clocks",
    outcome: DbOutcomeArea.BIOLOGICAL_AGING_CLOCKS,
    terms: ["epigenetic clock", "biological age", "aging clock", "dna methylation", "telomere"]
  },
  {
    label: "Mortality/lifespan",
    outcome: DbOutcomeArea.MORTALITY_LIFESPAN,
    terms: ["lifespan", "longevity", "mortality", "survival", "all-cause"]
  }
];

const LOCAL_BENEFIT_DISCOVERY_CONTEXT_RULES: Record<
  string,
  {
    requireSupplementContext?: boolean;
    supplementTerms: string[];
    trapTerms: string[];
  }
> = {
  calcium: {
    requireSupplementContext: true,
    supplementTerms: [
      "calcium carbonate",
      "calcium citrate",
      "calcium supplementation",
      "calcium supplement",
      "calcium supplements",
      "calcium intake",
      "dietary calcium",
      "oral calcium"
    ],
    trapTerms: [
      "calcium antagonist",
      "calcium antagonists",
      "calcium assessment",
      "calcium channel blocker",
      "calcium channel blockers",
      "calcium score",
      "calcium scoring",
      "calcification",
      "calcified",
      "coronary artery calcium",
      "coronary calcium",
      "vascular calcification"
    ]
  },
  "folic-acid": {
    requireSupplementContext: true,
    supplementTerms: [
      "folic acid supplementation",
      "folate supplementation",
      "folic acid supplement",
      "folate supplement",
      "folic acid intake",
      "folate intake",
      "dietary folate",
      "methylfolate",
      "5 mthf"
    ],
    trapTerms: [
      "folate concentration",
      "folate concentrations",
      "folate deficiency",
      "folate level",
      "folate levels",
      "folate status",
      "serum folate"
    ]
  },
  iron: {
    requireSupplementContext: true,
    supplementTerms: [
      "ferrous bisglycinate",
      "ferrous sulfate",
      "iron intake",
      "iron supplement",
      "iron supplements",
      "iron supplementation",
      "oral iron"
    ],
    trapTerms: [
      "blood iron",
      "iron concentration",
      "iron concentrations",
      "iron level",
      "iron levels",
      "iron overload",
      "iron status",
      "serum iron"
    ]
  },
  magnesium: {
    requireSupplementContext: true,
    supplementTerms: [
      "dietary magnesium",
      "magnesium citrate",
      "magnesium glycinate",
      "magnesium intake",
      "magnesium oxide",
      "magnesium supplement",
      "magnesium supplements",
      "magnesium supplementation",
      "oral magnesium"
    ],
    trapTerms: [
      "blood magnesium",
      "magmaris",
      "magnesium alloy",
      "magnesium concentration",
      "magnesium concentrations",
      "magnesium level",
      "magnesium levels",
      "magnesium scaffold",
      "magnesium status",
      "serum magnesium"
    ]
  },
  "vitamin-b12": {
    requireSupplementContext: true,
    supplementTerms: [
      "b12 supplement",
      "b12 supplements",
      "b12 supplementation",
      "cobalamin supplementation",
      "cyanocobalamin",
      "methylcobalamin",
      "vitamin b12 intake",
      "vitamin b12 supplement",
      "vitamin b12 supplementation"
    ],
    trapTerms: [
      "b12 concentration",
      "b12 deficiency",
      "b12 level",
      "b12 levels",
      "b12 status",
      "serum b12",
      "serum vitamin b12",
      "vitamin b12 deficiency",
      "vitamin b12 level",
      "vitamin b12 levels",
      "vitamin b12 status"
    ]
  },
  "vitamin-c": {
    requireSupplementContext: true,
    supplementTerms: [
      "ascorbic acid supplementation",
      "dietary vitamin c",
      "oral vitamin c",
      "vitamin c intake",
      "vitamin c supplement",
      "vitamin c supplements",
      "vitamin c supplementation"
    ],
    trapTerms: [
      "plasma vitamin c",
      "serum vitamin c",
      "vitamin c concentration",
      "vitamin c concentrations",
      "vitamin c level",
      "vitamin c levels",
      "vitamin c status"
    ]
  },
  "vitamin-d": {
    requireSupplementContext: true,
    supplementTerms: [
      "cholecalciferol",
      "dietary vitamin d",
      "ergocalciferol",
      "oral vitamin d",
      "vitamin d intake",
      "vitamin d supplement",
      "vitamin d supplements",
      "vitamin d supplementation"
    ],
    trapTerms: [
      "25 oh d level",
      "25 oh d levels",
      "serum vitamin d",
      "vitamin d concentration",
      "vitamin d concentrations",
      "vitamin d deficiency",
      "vitamin d level",
      "vitamin d levels",
      "vitamin d status"
    ]
  },
  zinc: {
    requireSupplementContext: true,
    supplementTerms: [
      "dietary zinc",
      "oral zinc",
      "zinc citrate",
      "zinc gluconate",
      "zinc intake",
      "zinc picolinate",
      "zinc supplement",
      "zinc supplements",
      "zinc supplementation"
    ],
    trapTerms: [
      "blood zinc",
      "serum zinc",
      "zinc concentration",
      "zinc concentrations",
      "zinc finger",
      "zinc level",
      "zinc levels",
      "zinc status"
    ]
  }
};
const LOCAL_BENEFIT_DISCOVERY_EXISTING_LINK_SCORE_FLOOR = 65;
const LOCAL_BENEFIT_DISCOVERY_REJECT_SCORE_THRESHOLD_DEFAULT = 40;

type LocalIngestionJobCounts = Record<DbIngestionStatus, number>;
type LocalCandidateDecisionCounts = Record<DbSourceCandidateDecision, number>;
type LocalAcceptedCandidateProcessingBatchRow = {
  dedupeKey: string;
};
type LocalBenefitDiscoveryCandidate = Prisma.SourceCandidateGetPayload<{
  select: typeof LOCAL_BENEFIT_DISCOVERY_CANDIDATE_SELECT;
}>;
type LocalBenefitDiscoveryIdentityCandidate = {
  interventionId?: string | null;
  metadata: unknown;
  sourceType: string | null;
  title: string;
};
type LocalBenefitDiscoveryIntervention = Prisma.InterventionGetPayload<{
  select: typeof LOCAL_BENEFIT_DISCOVERY_INTERVENTION_SELECT;
}>;
type LocalBenefitDiscoveryClusterBuilder = {
  candidates: Array<{
    candidate: LocalBenefitDiscoveryCandidate;
    identityCautions: string[];
    mismatchReasons: string[];
    sourceTypeSuggestion: string;
  }>;
  clusterKey: string;
  existingClaims: Array<{
    claimText: string;
    id: string;
  }>;
  interventionId: string;
  interventionName: string;
  outcome: DbOutcomeArea;
  outcomeLabel: string;
  rejectedCount: number;
};

export interface LocalIngestionStatusReadout {
  candidates: {
    counts: LocalCandidateDecisionCounts;
    recent: LocalIngestionCandidateReadout[];
    total: number;
  };
  queue: {
    counts: LocalIngestionJobCounts;
    recentJobs: LocalIngestionJobReadout[];
    total: number;
  };
  updatedAt: string;
}

export interface LocalIngestionJobReadout {
  claimId?: string;
  completedAt?: string;
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

export interface LocalIngestionCandidateReadout {
  claimId?: string;
  decision: DbSourceCandidateDecision;
  discoveryClassification?: LocalIngestionDiscoveryClassificationReadout;
  discoveredAt: string;
  externalId: string;
  interventionId?: string;
  publishedYear?: number;
  query: string;
  reviewStatus: string;
  source: DbSourceKind;
  sourceType?: string;
  title: string;
  triageScore: number;
  url: string;
}

export interface LocalIngestionDiscoveryClassificationReadout {
  bucket: "likely-useful" | "maybe-useful" | "likely-noise";
  cautions: string[];
  label: string;
  reasons: string[];
  score: number;
}

export type LocalCandidateReviewBucket =
  | "all"
  | "all-useful"
  | "likely-useful"
  | "maybe-useful"
  | "likely-noise"
  | "unclassified";

export type LocalCandidateReviewStudyFilter =
  | "all"
  | "reviews"
  | "trials"
  | "results-posted";

export interface LocalCandidateReviewWorkbenchInput {
  bucket?: unknown;
  interventionId?: unknown;
  limit?: unknown;
  q?: unknown;
  source?: unknown;
  studyFilter?: unknown;
}

export interface LocalCandidateReviewWorkbenchReadout {
  candidates: LocalCandidateReviewCandidateReadout[];
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
    source: "ALL" | DbSourceKind;
    studyFilter: LocalCandidateReviewStudyFilter;
  };
  updatedAt: string;
}

export interface LocalCandidateReviewCandidateReadout extends LocalIngestionCandidateReadout {
  dedupeKey: string;
  interventionName?: string;
}

export interface LocalCandidateReviewDecisionInput {
  decision?: unknown;
  dedupeKey?: unknown;
  reviewNote?: unknown;
}

export interface LocalCandidateReviewDecisionReadout {
  candidate: LocalCandidateReviewCandidateReadout;
}

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

export interface LocalCandidateReviewBulkDecisionInput
  extends LocalCandidateReviewWorkbenchInput {
  bulkAction?: unknown;
  reviewNote?: unknown;
}

export interface LocalCandidateReviewBulkDecisionReadout {
  accepted: number;
  errors: string[];
  filters: LocalCandidateReviewWorkbenchReadout["filters"];
  rejected: number;
  scanned: number;
  status: "completed" | "stopped-at-limit";
}

export interface LocalCandidateReviewAutomationInput
  extends LocalCandidateReviewWorkbenchInput {
  action?: unknown;
  apply?: unknown;
  mode?: unknown;
  strategy?: unknown;
}

export interface LocalCandidateReviewAutomationDecisionReadout {
  action: LocalCandidateReviewAutomationAction;
  applied: boolean;
  classificationScore?: number;
  dedupeKey: string;
  error?: string;
  externalId: string;
  interventionName?: string;
  reasons: string[];
  source: DbSourceKind;
  sourceTypeSuggestion: string;
  title: string;
  triageScore: number;
}

export interface LocalCandidateReviewAutomationReadout {
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
  decisions: LocalCandidateReviewAutomationDecisionReadout[];
  filters: LocalCandidateReviewWorkbenchReadout["filters"];
  message: string;
  status: "completed" | "stopped-at-limit";
  strategy: LocalCandidateReviewAutomationStrategy;
  updatedAt: string;
}

export interface LocalCandidateReviewSignalMiningInput
  extends LocalCandidateReviewWorkbenchInput {
  action?: unknown;
  mode?: unknown;
}

export interface LocalCandidateReviewSignalApplyInput
  extends LocalCandidateReviewWorkbenchInput {
  action?: unknown;
  signalAction?: unknown;
}

export interface LocalCandidateReviewSignalSampleReadout {
  dedupeKey: string;
  externalId: string;
  source: DbSourceKind;
  sourceTypeSuggestion: string;
  title: string;
  triageScore: number;
}

export interface LocalCandidateReviewSignalDecisionReadout
  extends LocalCandidateReviewSignalSampleReadout {
  classificationScore?: number;
  dedupeKey: string;
  identityVisible: boolean;
  interventionId?: string;
  interventionName?: string;
  kind: LocalCandidateReviewSignalKind;
  lowScore: boolean;
  outcomes: Array<{
    label: string;
    outcome: DbOutcomeArea;
    score: number;
  }>;
  outcomeLabels: string[];
  priorityStudy: boolean;
  queryBacked: boolean;
  reasons: string[];
  sourcePointsElsewhere: boolean;
}

export interface LocalCandidateReviewSignalSummaryReadout {
  averageScore: number;
  count: number;
  identityVisibleCount: number;
  key: string;
  label: string;
  lowScoreCount: number;
  priorityStudyCount: number;
  queryBackedCount: number;
  samples: LocalCandidateReviewSignalSampleReadout[];
  sourcePointsElsewhereCount: number;
  topOutcomes: Array<{
    count: number;
    label: string;
  }>;
}

export interface LocalCandidateReviewOutcomeSignalReadout {
  count: number;
  interventionCount: number;
  label: string;
  outcome: DbOutcomeArea;
  samples: LocalCandidateReviewSignalSampleReadout[];
}

export interface LocalCandidateReviewSignalMiningReadout {
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
  decisions: LocalCandidateReviewSignalDecisionReadout[];
  filters: LocalCandidateReviewWorkbenchReadout["filters"];
  holdReasons: Array<{
    count: number;
    label: string;
  }>;
  interventions: LocalCandidateReviewSignalSummaryReadout[];
  message: string;
  outcomes: LocalCandidateReviewOutcomeSignalReadout[];
  sourceTypes: Array<{
    count: number;
    label: string;
  }>;
  status: "completed" | "stopped-at-limit";
  updatedAt: string;
}

export interface LocalCandidateReviewSignalApplyReadout {
  action: "apply-mined-signals";
  counts: {
    errors: number;
    parked: number;
    rejected: number;
    scanned: number;
    skipped: number;
  };
  decisions: LocalCandidateReviewSignalDecisionReadout[];
  errors: string[];
  filters: LocalCandidateReviewWorkbenchReadout["filters"];
  message: string;
  signalAction: LocalCandidateReviewSignalApplyAction;
  status: "completed" | "stopped-at-limit";
  updatedAt: string;
}

export interface LocalAcceptedCandidateProcessingStatusReadout {
  counts: {
    accepted: number;
    acceptedWithReference: number;
    claimLinked: number;
    missingReference: number;
    needsClaim: number;
    processed: number;
    unprocessed: number;
  };
  recent: LocalAcceptedCandidateProcessingResultReadout[];
  updatedAt: string;
}

export interface LocalAcceptedCandidateProcessingRunReadout {
  errors: Array<{
    dedupeKey: string;
    error: string;
    title: string;
  }>;
  hasMore: boolean;
  limit: number;
  processed: number;
  results: LocalAcceptedCandidateProcessingResultReadout[];
  status: LocalAcceptedCandidateProcessingStatusReadout;
}

export interface LocalAcceptedCandidateProcessingResultReadout {
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
  source: DbSourceKind;
  sourceTypeSuggestion: string;
  title: string;
  url: string;
}

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

export interface LocalBenefitDiscoveryQueueInput {
  includeDecided?: unknown;
  limit?: unknown;
  limitMax?: number;
}

export interface LocalBenefitDiscoveryQueueReadout {
  clusters: LocalBenefitDiscoveryClusterReadout[];
  counts: {
    activeClusters: number;
    activeCandidates: number;
    decidedClusters: number;
    mismatchCandidates: number;
    parkedClusters: number;
  };
  updatedAt: string;
}

export interface LocalBenefitDiscoveryClusterReadout {
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
  outcome: DbOutcomeArea;
  outcomeLabel: string;
  rejectedCount: number;
  leadReasons: string[];
  score: number;
  topSources: LocalBenefitDiscoverySourceReadout[];
  usableCandidateCount: number;
}

export interface LocalBenefitDiscoverySourceReadout {
  acceptedReferenceId?: string;
  dedupeKey: string;
  externalId: string;
  identityCautions: string[];
  mismatchReasons: string[];
  publishedYear?: number;
  source: DbSourceKind;
  sourceTypeSuggestion: string;
  title: string;
  triageScore: number;
  url: string;
}

export interface LocalBenefitDiscoveryActionInput {
  action?: unknown;
  clusterKey?: unknown;
}

export interface LocalBenefitDiscoveryActionReadout {
  action: LocalBenefitDiscoveryAction;
  affectedCandidates: number;
  claimCreated: boolean;
  claimId?: string;
  cluster: LocalBenefitDiscoveryClusterReadout;
  linkedReferences: number;
  message: string;
}

export interface LocalBenefitDiscoveryAutomationInput {
  action?: unknown;
  apply?: unknown;
  limit?: unknown;
  parkThreshold?: unknown;
  rejectThreshold?: unknown;
  scope?: unknown;
  strategy?: unknown;
  threshold?: unknown;
}

export interface LocalBenefitDiscoveryAutomationDecisionReadout {
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
}

export interface LocalBenefitDiscoveryAutomationReadout {
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
  decisions: LocalBenefitDiscoveryAutomationDecisionReadout[];
  limit: number;
  message: string;
  parkThreshold: number;
  rejectThreshold: number;
  scope: LocalBenefitDiscoveryAutomationScope;
  strategy: LocalBenefitDiscoveryAutomationStrategy;
  threshold: number;
  updatedAt: string;
}

export interface LocalIdentityResolutionQueueInput {
  limit?: unknown;
}

export interface LocalIdentityResolutionAutomationInput {
  action?: unknown;
  apply?: unknown;
  limit?: unknown;
  mode?: unknown;
  scope?: unknown;
  strategy?: unknown;
}

export interface LocalIdentityResolutionQueueReadout {
  candidates: LocalIdentityResolutionCandidateReadout[];
  counts: {
    blockedCandidates: number;
  };
  interventions: Array<{
    id: string;
    name: string;
  }>;
  limit: number;
  updatedAt: string;
}

export interface LocalIdentityResolutionCandidateReadout {
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
  source: DbSourceKind;
  sourceIdentityText?: string;
  sourceTypeSuggestion: string;
  title: string;
  triageScore: number;
  url: string;
}

export interface LocalIdentityResolutionActionInput {
  action?: unknown;
  dedupeKey?: unknown;
  interventionId?: unknown;
  synonym?: unknown;
}

export interface LocalIdentityResolutionAutomationDecisionReadout {
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
  source: DbSourceKind;
  title: string;
}

export interface LocalIdentityResolutionAutomationReadout {
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
  decisions: LocalIdentityResolutionAutomationDecisionReadout[];
  limit: number;
  message: string;
  scope: LocalIdentityResolutionAutomationScope;
  strategy: LocalIdentityResolutionAutomationStrategy;
  updatedAt: string;
}

export interface LocalIdentityResolutionActionReadout {
  action: LocalIdentityResolutionAction;
  candidate?: LocalIdentityResolutionCandidateReadout;
  message: string;
}

export interface LocalIngestionStartResult {
  deepeningCatchUp: QueuedPubMedDeepeningCatchUpJobs;
  existingJobs: number;
  interventionCount: number;
  jobCount: number;
  newJobs: number;
  phase: "primary" | "synonym";
  sampleJobs: LocalIngestionQueuedJobReadout[];
  searchTermCount: number;
  status: LocalIngestionStatusReadout;
}

export interface LocalIngestionQueuedJobReadout {
  claimId?: string;
  created: boolean;
  interventionId?: string;
  jobId: string;
  query: string;
  region: string;
  source: DbSourceKind;
  status: DbIngestionStatus;
}

export interface LocalIngestionRunResult {
  hasMoreQueued: boolean;
  limit: number;
  processed: number;
  results: SourceCandidateIngestionJobRunResult[];
  status: LocalIngestionStatusReadout;
}

export async function getLocalIngestionStatus(): Promise<LocalIngestionStatusReadout> {
  const [jobSummary, recentJobs, candidateGroups, recentCandidates] = await Promise.all([
    summarizeSourceCandidateIngestionJobs(),
    listSourceCandidateIngestionJobs({ limit: LOCAL_RECENT_ITEM_LIMIT }),
    prisma.sourceCandidate.groupBy({
      by: ["decision"],
      where: {
        source: {
          in: LOCAL_SUPPORTED_SOURCES
        }
      },
      _count: {
        _all: true
      }
    }),
    prisma.sourceCandidate.findMany({
      where: {
        source: {
          in: LOCAL_SUPPORTED_SOURCES
        }
      },
      orderBy: [{ discoveredAt: "desc" }, { updatedAt: "desc" }],
      take: LOCAL_RECENT_ITEM_LIMIT,
      select: {
        claimId: true,
        decision: true,
        discoveredAt: true,
        externalId: true,
        interventionId: true,
        metadata: true,
        publishedYear: true,
        query: true,
        reviewStatus: true,
        source: true,
        sourceType: true,
        title: true,
        triageScore: true,
        url: true
      }
    })
  ]);

  const jobCounts = emptyJobCounts();
  for (const group of jobSummary.groups) {
    jobCounts[group.status] += group.count;
  }

  const candidateCounts = emptyCandidateDecisionCounts();
  for (const group of candidateGroups) {
    candidateCounts[group.decision] += group._count._all;
  }

  return {
    candidates: {
      counts: candidateCounts,
      recent: recentCandidates.map((candidate) => ({
        claimId: candidate.claimId ?? undefined,
        decision: candidate.decision,
        discoveryClassification: readSourceCandidateDiscoveryClassification(candidate.metadata),
        discoveredAt: candidate.discoveredAt.toISOString(),
        externalId: candidate.externalId,
        interventionId: candidate.interventionId ?? undefined,
        publishedYear: candidate.publishedYear ?? undefined,
        query: candidate.query,
        reviewStatus: candidate.reviewStatus,
        source: candidate.source,
        sourceType: candidate.sourceType ?? undefined,
        title: candidate.title,
        triageScore: candidate.triageScore,
        url: candidate.url
      })),
      total: candidateGroups.reduce((total, group) => total + group._count._all, 0)
    },
    queue: {
      counts: jobCounts,
      recentJobs: recentJobs.map((job) => ({
        claimId: job.claimId,
        completedAt: job.completedAt,
        error: job.error,
        interventionId: job.interventionId,
        jobId: job.jobId,
        query: job.query,
        recordsChanged: job.recordsChanged,
        recordsFound: job.recordsFound,
        region: job.region,
        source: job.source,
        startedAt: job.startedAt,
        status: job.status,
        updatedAt: job.updatedAt
      })),
      total: jobSummary.total
    },
    updatedAt: new Date().toISOString()
  };
}

export async function getLocalCandidateReviewWorkbench(
  input: LocalCandidateReviewWorkbenchInput = {}
): Promise<LocalCandidateReviewWorkbenchReadout> {
  const filters = normaliseCandidateReviewFilters(input);
  const countBaseFilters = {
    ...filters,
    bucket: "all"
  } satisfies LocalCandidateReviewWorkbenchReadout["filters"];
  const [activeWhere, countBaseWhere, parkedResearchCount] = await Promise.all([
    localCandidateReviewActiveWhere(filters),
    localCandidateReviewActiveWhere(countBaseFilters),
    prisma.sourceCandidate.count({
      where: localCandidateReviewParkedResearchWhere({
        ...filters,
        bucket: "maybe-useful"
      })
    })
  ]);
  const [candidates, likelyUseful, maybeUseful, likelyNoise, unclassified, parkedResearch, all] =
    await Promise.all([
      prisma.sourceCandidate.findMany({
        where: activeWhere,
        orderBy: [{ triageScore: "desc" }, { discoveredAt: "desc" }],
        take: filters.limit,
        select: LOCAL_CANDIDATE_REVIEW_SELECT
      }),
      prisma.sourceCandidate.count({
        where: andLocalCandidateReviewWhere(
          countBaseWhere,
          localCandidateReviewBucketWhere("likely-useful")
        )
      }),
      prisma.sourceCandidate.count({
        where: andLocalCandidateReviewWhere(
          countBaseWhere,
          localCandidateReviewBucketWhere("maybe-useful")
        )
      }),
      prisma.sourceCandidate.count({
        where: andLocalCandidateReviewWhere(
          countBaseWhere,
          localCandidateReviewBucketWhere("likely-noise")
        )
      }),
      prisma.sourceCandidate.count({
        where: andLocalCandidateReviewWhere(
          countBaseWhere,
          localCandidateReviewBucketWhere("unclassified")
        )
      }),
      Promise.resolve(parkedResearchCount),
      prisma.sourceCandidate.count({
        where: countBaseWhere
      })
    ]);

  return {
    candidates: candidates.map(localCandidateReviewCandidateReadout),
    counts: {
      all,
      allUseful: likelyUseful + maybeUseful,
      likelyNoise,
      likelyUseful,
      maybeUseful,
      parkedResearch,
      unclassified
    },
    filters,
    updatedAt: new Date().toISOString()
  };
}

export async function recordLocalCandidateReviewDecision(
  input: LocalCandidateReviewDecisionInput
): Promise<LocalCandidateReviewDecisionReadout> {
  const dedupeKey = normaliseRequiredString(input.dedupeKey, "Candidate dedupe key is required.");
  const decision = normaliseCandidateReviewDecision(input.decision);
  const reviewNote =
    optionalString(input.reviewNote) ??
    (decision === "Accepted"
      ? "Accepted from local candidate review dashboard."
      : "Rejected from local candidate review dashboard.");
  const pendingCandidate = await prisma.sourceCandidate.findUnique({
    where: {
      dedupeKey
    }
  });

  if (!pendingCandidate || pendingCandidate.decision !== DbSourceCandidateDecision.PENDING_REVIEW) {
    throw new Error("Pending source candidate not found for review.");
  }

  if (decision === "Rejected") {
    await recordSourceCandidateDecision({
      decision,
      dedupeKey,
      reviewNote
    });

    return {
      candidate: await getLocalCandidateReviewReadoutByDedupeKey(dedupeKey)
    };
  }

  const reference = await prisma.reference.upsert({
    where: {
      url: pendingCandidate.url
    },
    create: {
      identifier: localCandidateReferenceIdentifier(pendingCandidate),
      source: pendingCandidate.source,
      title: pendingCandidate.title,
      url: pendingCandidate.url,
      year: pendingCandidate.publishedYear
    },
    update: {}
  });
  await recordSourceCandidateDecision({
    acceptedReferenceId: reference.id,
    decision,
    dedupeKey,
    reviewNote
  });

  return {
    candidate: await getLocalCandidateReviewReadoutByDedupeKey(dedupeKey)
  };
}

export async function recordLocalCandidateReviewBulkDecision(
  input: LocalCandidateReviewBulkDecisionInput
): Promise<LocalCandidateReviewBulkDecisionReadout> {
  const bulkAction = normaliseCandidateReviewBulkAction(input.bulkAction);
  const baseFilters = normaliseCandidateReviewFilters(input);
  const filters: LocalCandidateReviewWorkbenchReadout["filters"] = {
    ...baseFilters,
    bucket:
      bulkAction === "accept-all"
        ? baseFilters.bucket
        : bulkAction === "accept-likely-useful"
          ? "likely-useful"
          : "likely-noise",
    limit: LOCAL_REVIEW_BULK_BATCH_SIZE
  };
  const decision = bulkAction === "reject-not-useful" ? "Rejected" : "Accepted";
  const reviewNote =
    optionalString(input.reviewNote) ??
    (decision === "Accepted"
      ? "Bulk accepted from local candidate review dashboard after user click."
      : "Bulk rejected from local candidate review dashboard after user click.");
  const errors: string[] = [];
  const activeWhere = await localCandidateReviewActiveWhere(filters);
  let accepted = 0;
  let rejected = 0;
  let scanned = 0;

  while (scanned < LOCAL_REVIEW_BULK_MAX_CANDIDATES) {
    const candidates = await prisma.sourceCandidate.findMany({
      where: activeWhere,
      orderBy: [{ triageScore: "desc" }, { discoveredAt: "desc" }],
      take: LOCAL_REVIEW_BULK_BATCH_SIZE,
      select: {
        dedupeKey: true,
        externalId: true
      }
    });

    if (candidates.length === 0) {
      break;
    }

    let changedInBatch = 0;

    for (const candidate of candidates) {
      scanned += 1;

      try {
        await recordLocalCandidateReviewDecision({
          decision,
          dedupeKey: candidate.dedupeKey,
          reviewNote
        });

        changedInBatch += 1;

        if (decision === "Accepted") {
          accepted += 1;
        } else {
          rejected += 1;
        }
      } catch (error) {
        if (errors.length < 20) {
          errors.push(
            `${candidate.externalId}: ${
              error instanceof Error ? error.message : "Candidate review failed."
            }`
          );
        }
      }

      if (scanned >= LOCAL_REVIEW_BULK_MAX_CANDIDATES) {
        break;
      }
    }

    if (changedInBatch === 0 || candidates.length < LOCAL_REVIEW_BULK_BATCH_SIZE) {
      break;
    }
  }

  return {
    accepted,
    errors,
    filters,
    rejected,
    scanned,
    status:
      scanned >= LOCAL_REVIEW_BULK_MAX_CANDIDATES ? "stopped-at-limit" : "completed"
  };
}

export function isLocalCandidateReviewAutomationInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return false;
  }

  const record = input as Record<string, unknown>;

  return (
    optionalString(record.action) === "auto-triage-maybe-useful" ||
    optionalString(record.mode) === "auto-triage-maybe-useful"
  );
}

export function isLocalCandidateReviewSignalMiningInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return false;
  }

  const record = input as Record<string, unknown>;

  return (
    optionalString(record.action) === "mine-maybe-useful-signals" ||
    optionalString(record.mode) === "mine-maybe-useful-signals"
  );
}

export function isLocalCandidateReviewSignalApplyInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return false;
  }

  const record = input as Record<string, unknown>;

  return (
    optionalString(record.action) === "apply-mined-signals" ||
    optionalString(record.mode) === "apply-mined-signals"
  );
}

export async function runLocalCandidateReviewAutomation(
  input: LocalCandidateReviewAutomationInput
): Promise<LocalCandidateReviewAutomationReadout> {
  const apply = optionalBoolean(input.apply);
  const baseFilters = normaliseCandidateReviewFilters(input);
  const strategy = normaliseCandidateReviewAutomationStrategy(input.strategy);
  const filters: LocalCandidateReviewWorkbenchReadout["filters"] = {
    ...baseFilters,
    bucket: "maybe-useful",
    limit: LOCAL_REVIEW_BULK_BATCH_SIZE
  };
  const interventions =
    strategy === "query-backed"
      ? await prisma.intervention.findMany({
          select: LOCAL_BENEFIT_DISCOVERY_INTERVENTION_SELECT
        })
      : [];
  const interventionTerms = buildLocalBenefitDiscoveryInterventionTerms(interventions);
  const activeWhere = await localCandidateReviewActiveWhere(filters);
  const decisions: LocalCandidateReviewAutomationDecisionReadout[] = [];
  let scanned = 0;
  let stoppedAtLimit = false;

  while (scanned < LOCAL_REVIEW_BULK_MAX_CANDIDATES) {
    const candidates = await prisma.sourceCandidate.findMany({
      where: activeWhere,
      orderBy: [{ triageScore: "desc" }, { discoveredAt: "desc" }],
      skip: scanned,
      take: LOCAL_REVIEW_BULK_BATCH_SIZE,
      select: LOCAL_CANDIDATE_REVIEW_SELECT
    });

    if (candidates.length === 0) {
      break;
    }

    for (const candidate of candidates) {
      scanned += 1;
      const decision = localCandidateReviewAutomationDecision(
        candidate,
        strategy,
        interventionTerms
      );

      decisions.push(decision);

      if (scanned >= LOCAL_REVIEW_BULK_MAX_CANDIDATES) {
        stoppedAtLimit = true;
        break;
      }
    }

    if (candidates.length < LOCAL_REVIEW_BULK_BATCH_SIZE) {
      break;
    }
  }

  if (apply) {
    for (const decision of decisions) {
      if (decision.action === "hold") {
        continue;
      }

      try {
        await recordLocalCandidateReviewDecision({
          decision: decision.action === "accept" ? "Accepted" : "Rejected",
          dedupeKey: decision.dedupeKey,
          reviewNote:
            decision.action === "accept"
              ? "Auto-accepted maybe-useful candidate after conservative local review triage."
              : "Auto-rejected maybe-useful candidate after conservative local review triage."
        });
        decision.applied = true;
      } catch (error) {
        decision.error =
          error instanceof Error ? error.message : "Candidate auto-triage action failed.";
      }
    }
  }

  const counts = localCandidateReviewAutomationCounts(decisions);

  return {
    action: "auto-triage-maybe-useful",
    applied: apply,
    counts,
    decisions,
    filters,
    message: `Maybe-useful auto-triage ${apply ? "applied" : "preview"}: ${counts.accepted.toLocaleString()} accept, ${counts.rejected.toLocaleString()} reject, ${counts.held.toLocaleString()} hold from ${counts.scanned.toLocaleString()} scanned.`,
    status: stoppedAtLimit ? "stopped-at-limit" : "completed",
    strategy,
    updatedAt: new Date().toISOString()
  };
}

export function localCandidateReviewAutomationDecision(
  candidate: Prisma.SourceCandidateGetPayload<{
    select: typeof LOCAL_CANDIDATE_REVIEW_SELECT;
  }>,
  strategy: LocalCandidateReviewAutomationStrategy = "strict",
  interventionTerms: Array<{
    id: string;
    name: string;
    terms: string[];
  }> = []
): LocalCandidateReviewAutomationDecisionReadout {
  const classification = readSourceCandidateDiscoveryClassification(candidate.metadata);
  const sourceTypeSuggestion = localAcceptedCandidateSourceTypeSuggestion(candidate);
  const classificationScore = classification?.score;
  const priorityStudy = localCandidateReviewIsPriorityStudy(candidate, sourceTypeSuggestion);
  const identityVisible = localCandidateReviewInterventionIdentityVisible(candidate);
  const queryIdentityVisible = localCandidateReviewQueryIdentityVisible(candidate);
  const sourceMismatch =
    interventionTerms.length > 0
      ? localBenefitDiscoveryMismatch(candidate, interventionTerms)
      : undefined;
  const sourcePointsElsewhere = localCandidateReviewSourcePointsElsewhere(sourceMismatch);
  const weakClassification = (classificationScore ?? candidate.triageScore) < 55;
  const reasons: string[] = [];
  let action: LocalCandidateReviewAutomationAction = "hold";

  if (priorityStudy) {
    reasons.push(`${sourceTypeSuggestion} is a priority source type.`);
  } else {
    reasons.push(`${sourceTypeSuggestion} is not a priority review/trial source type.`);
  }

  if (identityVisible) {
    reasons.push("Captured title/source metadata visibly matches the intervention.");
  } else {
    reasons.push("Captured title/source metadata does not visibly match the intervention.");
  }

  if (strategy === "query-backed") {
    reasons.push(
      queryIdentityVisible
        ? "Search query visibly names the intervention."
        : "Search query does not visibly name the intervention."
    );

    if (sourcePointsElsewhere) {
      reasons.push("Captured source identity points elsewhere; hold for manual review.");
    }
  }

  if (classificationScore !== undefined) {
    reasons.push(`Classifier score ${classificationScore}.`);
  }

  if (
    priorityStudy &&
    (identityVisible ||
      (strategy === "query-backed" && queryIdentityVisible && !sourcePointsElsewhere)) &&
    !weakClassification
  ) {
    action = "accept";
    reasons.push("Safe to accept for downstream identity/benefit processing.");
  } else if (!priorityStudy && !identityVisible && weakClassification) {
    action = "reject";
    reasons.push("Low-priority maybe-useful row without direct identity signal.");
  } else {
    reasons.push("Ambiguous enough to keep for manual review.");
  }

  return {
    action,
    applied: false,
    classificationScore,
    dedupeKey: candidate.dedupeKey,
    externalId: candidate.externalId,
    interventionName: candidate.intervention?.name,
    reasons,
    source: candidate.source,
    sourceTypeSuggestion,
    title: candidate.title,
    triageScore: candidate.triageScore
  };
}

function localCandidateReviewAutomationCounts(
  decisions: LocalCandidateReviewAutomationDecisionReadout[]
): LocalCandidateReviewAutomationReadout["counts"] {
  return {
    accepted: decisions.filter((decision) => decision.action === "accept").length,
    appliedActions: decisions.filter((decision) => decision.applied).length,
    errors: decisions.filter((decision) => decision.error).length,
    held: decisions.filter((decision) => decision.action === "hold").length,
    rejected: decisions.filter((decision) => decision.action === "reject").length,
    scanned: decisions.length
  };
}

export async function runLocalCandidateReviewSignalMining(
  input: LocalCandidateReviewSignalMiningInput
): Promise<LocalCandidateReviewSignalMiningReadout> {
  const baseFilters = normaliseCandidateReviewFilters(input);
  const filters: LocalCandidateReviewWorkbenchReadout["filters"] = {
    ...baseFilters,
    bucket: "maybe-useful",
    limit: LOCAL_REVIEW_BULK_BATCH_SIZE
  };
  const interventions = await prisma.intervention.findMany({
    select: LOCAL_BENEFIT_DISCOVERY_INTERVENTION_SELECT
  });
  const interventionTerms = buildLocalBenefitDiscoveryInterventionTerms(interventions);
  const { decisions, stoppedAtLimit } = await listLocalCandidateReviewSignalDecisions(
    filters,
    interventionTerms
  );

  const counts = localCandidateReviewSignalCounts(decisions);

  return {
    action: "mine-maybe-useful-signals",
    counts,
    decisions: decisions.slice(0, 12),
    filters,
    holdReasons: localCandidateReviewSignalReasonCounts(decisions),
    interventions: localCandidateReviewSignalInterventionSummaries(decisions),
    message: `Held maybe-useful signal mining scanned ${counts.scanned.toLocaleString()} row(s): ${counts.spotCheck.toLocaleString()} spot-check, ${counts.parkResearch.toLocaleString()} research signal, ${counts.identityMismatch.toLocaleString()} identity mismatch, ${counts.lowSignal.toLocaleString()} low signal.`,
    outcomes: localCandidateReviewOutcomeSignalSummaries(decisions),
    sourceTypes: localCandidateReviewSignalSourceTypeCounts(decisions),
    status: stoppedAtLimit ? "stopped-at-limit" : "completed",
    updatedAt: new Date().toISOString()
  };
}

export async function runLocalCandidateReviewSignalApply(
  input: LocalCandidateReviewSignalApplyInput
): Promise<LocalCandidateReviewSignalApplyReadout> {
  const signalAction = normaliseCandidateReviewSignalApplyAction(input.signalAction);
  const baseFilters = normaliseCandidateReviewFilters(input);
  const filters: LocalCandidateReviewWorkbenchReadout["filters"] = {
    ...baseFilters,
    bucket: "maybe-useful",
    limit: LOCAL_REVIEW_BULK_BATCH_SIZE
  };
  const interventions = await prisma.intervention.findMany({
    select: LOCAL_BENEFIT_DISCOVERY_INTERVENTION_SELECT
  });
  const interventionTerms = buildLocalBenefitDiscoveryInterventionTerms(interventions);
  const { items, stoppedAtLimit } = await listLocalCandidateReviewSignalDecisions(
    filters,
    interventionTerms
  );
  const errors: string[] = [];
  let parked = 0;
  let rejected = 0;
  let skipped = 0;

  for (const item of items) {
    const shouldApply =
      signalAction === "reject-mismatches"
        ? item.decision.kind === "identity-mismatch"
        : item.decision.kind === "park-research";

    if (!shouldApply) {
      skipped += 1;
      continue;
    }

    try {
      if (signalAction === "reject-mismatches") {
        const result = await prisma.sourceCandidate.updateMany({
          where: {
            decision: DbSourceCandidateDecision.PENDING_REVIEW,
            dedupeKey: item.candidate.dedupeKey
          },
          data: {
            decision: DbSourceCandidateDecision.REJECTED,
            reviewedAt: new Date(),
            reviewNote:
              "Auto-rejected from held maybe-useful signal cleanup: captured source points at another intervention or context.",
            reviewStatus: DbReviewStatus.UNREVIEWED_AI_DRAFT
          }
        });

        if (result.count > 0) {
          rejected += 1;
        } else {
          skipped += 1;
        }
      } else {
        const result = await prisma.sourceCandidate.updateMany({
          where: {
            decision: DbSourceCandidateDecision.PENDING_REVIEW,
            dedupeKey: item.candidate.dedupeKey
          },
          data: {
            metadata: writeLocalCandidateReviewDispositionMetadata(item.candidate.metadata, {
              action: "park-mined-research",
              reason:
                "Parked from held maybe-useful signal mining as a research/backlog signal. No claim, reference, or heatmap score was created.",
              status: "parked-research"
            })
          }
        });

        if (result.count > 0) {
          parked += 1;
        } else {
          skipped += 1;
        }
      }
    } catch (error) {
      errors.push(
        `${item.candidate.externalId}: ${
          error instanceof Error ? error.message : "Signal cleanup action failed."
        }`
      );
    }
  }

  return {
    action: "apply-mined-signals",
    counts: {
      errors: errors.length,
      parked,
      rejected,
      scanned: items.length,
      skipped
    },
    decisions: items.map((item) => item.decision).slice(0, 12),
    errors,
    filters,
    message: localCandidateReviewSignalApplyMessage({
      errors: errors.length,
      parked,
      rejected,
      scanned: items.length,
      signalAction,
      skipped
    }),
    signalAction,
    status: stoppedAtLimit ? "stopped-at-limit" : "completed",
    updatedAt: new Date().toISOString()
  };
}

async function listLocalCandidateReviewSignalDecisions(
  filters: LocalCandidateReviewWorkbenchReadout["filters"],
  interventionTerms: Array<{
    id: string;
    name: string;
    terms: string[];
  }>
) {
  const items: Array<{
    candidate: Prisma.SourceCandidateGetPayload<{
      select: typeof LOCAL_CANDIDATE_REVIEW_SELECT;
    }>;
    decision: LocalCandidateReviewSignalDecisionReadout;
  }> = [];
  const activeWhere = await localCandidateReviewActiveWhere(filters);
  let scanned = 0;
  let stoppedAtLimit = false;

  while (scanned < LOCAL_REVIEW_BULK_MAX_CANDIDATES) {
    const candidates = await prisma.sourceCandidate.findMany({
      where: activeWhere,
      orderBy: [{ triageScore: "desc" }, { discoveredAt: "desc" }],
      skip: scanned,
      take: LOCAL_REVIEW_BULK_BATCH_SIZE,
      select: LOCAL_CANDIDATE_REVIEW_SELECT
    });

    if (candidates.length === 0) {
      break;
    }

    for (const candidate of candidates) {
      scanned += 1;
      items.push({
        candidate,
        decision: localCandidateReviewSignalDecision(candidate, interventionTerms)
      });

      if (scanned >= LOCAL_REVIEW_BULK_MAX_CANDIDATES) {
        stoppedAtLimit = true;
        break;
      }
    }

    if (candidates.length < LOCAL_REVIEW_BULK_BATCH_SIZE) {
      break;
    }
  }

  return {
    decisions: items.map((item) => item.decision),
    items,
    stoppedAtLimit
  };
}

export function localCandidateReviewSignalDecision(
  candidate: Prisma.SourceCandidateGetPayload<{
    select: typeof LOCAL_CANDIDATE_REVIEW_SELECT;
  }>,
  interventionTerms: Array<{
    id: string;
    name: string;
    terms: string[];
  }> = []
): LocalCandidateReviewSignalDecisionReadout {
  const classification = readSourceCandidateDiscoveryClassification(candidate.metadata);
  const sourceTypeSuggestion = localAcceptedCandidateSourceTypeSuggestion(candidate);
  const classificationScore = classification?.score;
  const score = classificationScore ?? candidate.triageScore;
  const priorityStudy = localCandidateReviewIsPriorityStudy(candidate, sourceTypeSuggestion);
  const identityVisible = localCandidateReviewInterventionIdentityVisible(candidate);
  const queryBacked = localCandidateReviewQueryIdentityVisible(candidate);
  const sourceMismatch =
    interventionTerms.length > 0
      ? localBenefitDiscoveryMismatch(candidate, interventionTerms)
      : undefined;
  const sourcePointsElsewhere = localCandidateReviewSourcePointsElsewhere(sourceMismatch);
  const outcomes = localAcceptedCandidateOutcomeSuggestions(candidate);
  const lowScore = score < 55;
  const reasons: string[] = [];
  let kind: LocalCandidateReviewSignalKind = "park-research";

  if (priorityStudy) {
    reasons.push(`${sourceTypeSuggestion} is a priority source type.`);
  } else {
    reasons.push(`${sourceTypeSuggestion} is not a priority review/trial source type.`);
  }

  if (identityVisible) {
    reasons.push("Captured source visibly names the intervention.");
  } else if (queryBacked) {
    reasons.push("Search query names the intervention, but captured source does not.");
  } else {
    reasons.push("Neither captured source nor query gives a strong intervention identity.");
  }

  if (sourcePointsElsewhere) {
    const otherMatches = sourceMismatch?.otherMatches.map((match) => match.name).join(", ");
    reasons.push(
      otherMatches
        ? `Captured source appears to point at ${otherMatches}.`
        : "Captured source appears to point away from the target intervention."
    );
  }

  if (outcomes.length > 0) {
    reasons.push(`Possible area signal: ${outcomes.map((outcome) => outcome.label).join(", ")}.`);
  }

  if (classificationScore !== undefined) {
    reasons.push(`Classifier score ${classificationScore}.`);
  }

  if (sourcePointsElsewhere) {
    kind = "identity-mismatch";
  } else if (priorityStudy && (identityVisible || queryBacked) && !lowScore) {
    kind = "spot-check";
    reasons.push("Worth a human spot-check before accepting or creating a lead.");
  } else if (lowScore && !identityVisible && !queryBacked) {
    kind = "low-signal";
    reasons.push("Likely safe to reject in a later low-signal cleanup pass.");
  } else {
    kind = "park-research";
    reasons.push("Useful as a research/backlog signal, not strong enough for automation.");
  }

  return {
    classificationScore,
    dedupeKey: candidate.dedupeKey,
    externalId: candidate.externalId,
    identityVisible,
    interventionId: candidate.interventionId ?? undefined,
    interventionName: candidate.intervention?.name,
    kind,
    lowScore,
    outcomeLabels: outcomes.map((outcome) => outcome.label),
    outcomes,
    priorityStudy,
    queryBacked,
    reasons,
    source: candidate.source,
    sourcePointsElsewhere,
    sourceTypeSuggestion,
    title: candidate.title,
    triageScore: candidate.triageScore
  };
}

function localCandidateReviewSignalCounts(
  decisions: LocalCandidateReviewSignalDecisionReadout[]
): LocalCandidateReviewSignalMiningReadout["counts"] {
  return {
    identityMismatch: decisions.filter((decision) => decision.kind === "identity-mismatch")
      .length,
    interventionSignals: new Set(
      decisions.map(
        (decision) => decision.interventionId ?? decision.interventionName ?? "unlinked"
      )
    ).size,
    lowSignal: decisions.filter((decision) => decision.kind === "low-signal").length,
    outcomeSignals: new Set(
      decisions
        .filter(localCandidateReviewOutcomeSignalEligible)
        .flatMap((decision) => decision.outcomes.map((outcome) => outcome.outcome))
    ).size,
    parkResearch: decisions.filter((decision) => decision.kind === "park-research").length,
    scanned: decisions.length,
    spotCheck: decisions.filter((decision) => decision.kind === "spot-check").length
  };
}

function localCandidateReviewSignalReasonCounts(
  decisions: LocalCandidateReviewSignalDecisionReadout[]
): LocalCandidateReviewSignalMiningReadout["holdReasons"] {
  const counts = new Map<string, number>();

  for (const decision of decisions) {
    counts.set(decision.kind, (counts.get(decision.kind) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([kind, count]) => ({
      count,
      label: localCandidateReviewSignalKindLabel(kind as LocalCandidateReviewSignalKind)
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function localCandidateReviewSignalInterventionSummaries(
  decisions: LocalCandidateReviewSignalDecisionReadout[]
): LocalCandidateReviewSignalSummaryReadout[] {
  const summaries = new Map<
    string,
    {
      count: number;
      identityVisibleCount: number;
      label: string;
      lowScoreCount: number;
      outcomeCounts: Map<string, number>;
      priorityStudyCount: number;
      queryBackedCount: number;
      samples: LocalCandidateReviewSignalSampleReadout[];
      scoreTotal: number;
      sourcePointsElsewhereCount: number;
    }
  >();

  for (const decision of decisions) {
    const key = decision.interventionId ?? decision.interventionName ?? "unlinked";
    const summary =
      summaries.get(key) ??
      {
        count: 0,
        identityVisibleCount: 0,
        label: decision.interventionName ?? "Unlinked intervention",
        lowScoreCount: 0,
        outcomeCounts: new Map<string, number>(),
        priorityStudyCount: 0,
        queryBackedCount: 0,
        samples: [],
        scoreTotal: 0,
        sourcePointsElsewhereCount: 0
      };

    summary.count += 1;
    summary.scoreTotal += decision.classificationScore ?? decision.triageScore;
    summary.identityVisibleCount += decision.identityVisible ? 1 : 0;
    summary.lowScoreCount += decision.lowScore ? 1 : 0;
    summary.priorityStudyCount += decision.priorityStudy ? 1 : 0;
    summary.queryBackedCount += decision.queryBacked ? 1 : 0;
    summary.sourcePointsElsewhereCount += decision.sourcePointsElsewhere ? 1 : 0;

    for (const label of decision.outcomeLabels) {
      summary.outcomeCounts.set(label, (summary.outcomeCounts.get(label) ?? 0) + 1);
    }

    localCandidateReviewPushSignalSample(summary.samples, decision);
    summaries.set(key, summary);
  }

  return Array.from(summaries.entries())
    .map(([key, summary]) => ({
      averageScore: Number((summary.scoreTotal / summary.count).toFixed(1)),
      count: summary.count,
      identityVisibleCount: summary.identityVisibleCount,
      key,
      label: summary.label,
      lowScoreCount: summary.lowScoreCount,
      priorityStudyCount: summary.priorityStudyCount,
      queryBackedCount: summary.queryBackedCount,
      samples: summary.samples,
      sourcePointsElsewhereCount: summary.sourcePointsElsewhereCount,
      topOutcomes: Array.from(summary.outcomeCounts.entries())
        .map(([label, count]) => ({ count, label }))
        .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
        .slice(0, 4)
    }))
    .sort(
      (left, right) =>
        right.count - left.count ||
        right.priorityStudyCount - left.priorityStudyCount ||
        left.label.localeCompare(right.label)
    )
    .slice(0, 12);
}

function localCandidateReviewOutcomeSignalSummaries(
  decisions: LocalCandidateReviewSignalDecisionReadout[]
): LocalCandidateReviewOutcomeSignalReadout[] {
  const summaries = new Map<
    DbOutcomeArea,
    {
      count: number;
      interventionIds: Set<string>;
      label: string;
      samples: LocalCandidateReviewSignalSampleReadout[];
    }
  >();

  for (const decision of decisions) {
    if (!localCandidateReviewOutcomeSignalEligible(decision)) {
      continue;
    }

    for (const outcome of decision.outcomes) {
      const summary =
        summaries.get(outcome.outcome) ??
        {
          count: 0,
          interventionIds: new Set<string>(),
          label: outcome.label,
          samples: []
        };

      summary.count += 1;

      if (decision.interventionId) {
        summary.interventionIds.add(decision.interventionId);
      }

      localCandidateReviewPushSignalSample(summary.samples, decision);
      summaries.set(outcome.outcome, summary);
    }
  }

  return Array.from(summaries.entries())
    .map(([outcome, summary]) => ({
      count: summary.count,
      interventionCount: summary.interventionIds.size,
      label: summary.label,
      outcome,
      samples: summary.samples
    }))
    .sort(
      (left, right) =>
        right.count - left.count ||
        right.interventionCount - left.interventionCount ||
        left.label.localeCompare(right.label)
    )
    .slice(0, 12);
}

function localCandidateReviewOutcomeSignalEligible(
  decision: LocalCandidateReviewSignalDecisionReadout
) {
  return decision.kind !== "identity-mismatch";
}

function localCandidateReviewSignalSourceTypeCounts(
  decisions: LocalCandidateReviewSignalDecisionReadout[]
): LocalCandidateReviewSignalMiningReadout["sourceTypes"] {
  const counts = new Map<string, number>();

  for (const decision of decisions) {
    counts.set(
      decision.sourceTypeSuggestion,
      (counts.get(decision.sourceTypeSuggestion) ?? 0) + 1
    );
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ count, label }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, 8);
}

function localCandidateReviewPushSignalSample(
  samples: LocalCandidateReviewSignalSampleReadout[],
  decision: LocalCandidateReviewSignalDecisionReadout
) {
  if (samples.length >= 3) {
    return;
  }

  const sampleKey = localCandidateReviewSignalSampleKey(decision);

  if (samples.some((sample) => localCandidateReviewSignalSampleKey(sample) === sampleKey)) {
    return;
  }

  samples.push({
    dedupeKey: decision.dedupeKey,
    externalId: decision.externalId,
    source: decision.source,
    sourceTypeSuggestion: decision.sourceTypeSuggestion,
    title: decision.title,
    triageScore: decision.triageScore
  });
}

function localCandidateReviewSignalSampleKey(
  sample: Pick<LocalCandidateReviewSignalSampleReadout, "externalId" | "source" | "title">
) {
  return `${sample.source}:${sample.externalId}:${sample.title}`;
}

function localCandidateReviewSourcePointsElsewhere(
  sourceMismatch:
    | {
        otherMatches: Array<unknown>;
        reasons: string[];
        targetVisible: boolean;
      }
    | undefined
) {
  return Boolean(
    sourceMismatch &&
      !sourceMismatch.targetVisible &&
      (sourceMismatch.otherMatches.length > 0 ||
        sourceMismatch.reasons.some(
          (reason) =>
            reason !== "Target supplement is not visible in captured title/source metadata."
        ))
  );
}

function localCandidateReviewSignalKindLabel(kind: LocalCandidateReviewSignalKind) {
  switch (kind) {
    case "identity-mismatch":
      return "Source points elsewhere";
    case "low-signal":
      return "Low signal";
    case "park-research":
      return "Research/backlog signal";
    case "spot-check":
      return "Worth spot-check";
  }
}

function localCandidateReviewSignalApplyMessage({
  errors,
  parked,
  rejected,
  scanned,
  signalAction,
  skipped
}: {
  errors: number;
  parked: number;
  rejected: number;
  scanned: number;
  signalAction: LocalCandidateReviewSignalApplyAction;
  skipped: number;
}) {
  if (signalAction === "reject-mismatches") {
    return `Mined mismatch cleanup scanned ${scanned.toLocaleString()} row(s): ${rejected.toLocaleString()} rejected, ${skipped.toLocaleString()} skipped, ${errors.toLocaleString()} error(s).`;
  }

  return `Mined research cleanup scanned ${scanned.toLocaleString()} row(s): ${parked.toLocaleString()} parked, ${skipped.toLocaleString()} skipped, ${errors.toLocaleString()} error(s).`;
}

export async function getLocalAcceptedCandidateProcessingStatus(): Promise<LocalAcceptedCandidateProcessingStatusReadout> {
  const acceptedWhere = localAcceptedCandidateWhere();
  const acceptedWithReferenceWhere = localAcceptedCandidateWhere({
    acceptedReferenceId: {
      not: null
    }
  });
  const processedWhere = localAcceptedCandidateProcessedWhere();
  const [
    accepted,
    acceptedWithReference,
    processed,
    needsClaim,
    claimLinked,
    recentProcessed
  ] = await Promise.all([
    prisma.sourceCandidate.count({
      where: acceptedWhere
    }),
    prisma.sourceCandidate.count({
      where: acceptedWithReferenceWhere
    }),
    prisma.sourceCandidate.count({
      where: processedWhere
    }),
    prisma.sourceCandidate.count({
      where: {
        ...acceptedWhere,
        AND: [
          {
            metadata: {
              path: [...SOURCE_CANDIDATE_METADATA_PATHS.acceptedProcessingVersion],
              equals: LOCAL_ACCEPTED_PROCESSING_METADATA_VERSION
            }
          },
          {
            metadata: {
              path: [...SOURCE_CANDIDATE_METADATA_PATHS.acceptedProcessingNeedsClaim],
              equals: true
            }
          }
        ]
      }
    }),
    prisma.sourceCandidate.count({
      where: localAcceptedCandidateWhere({
        acceptedReferenceId: {
          not: null
        },
        claimId: {
          not: null
        }
      })
    }),
    prisma.sourceCandidate.findMany({
      where: processedWhere,
      orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
      take: LOCAL_RECENT_ITEM_LIMIT,
      select: LOCAL_ACCEPTED_CANDIDATE_PROCESS_SELECT
    })
  ]);

  return {
    counts: {
      accepted,
      acceptedWithReference,
      claimLinked,
      missingReference: accepted - acceptedWithReference,
      needsClaim,
      processed,
      unprocessed: Math.max(acceptedWithReference - processed, 0)
    },
    recent: recentProcessed.map(localAcceptedCandidateProcessingReadout),
    updatedAt: new Date().toISOString()
  };
}

export async function runLocalAcceptedCandidateProcessingBatch(
  input: { limit?: unknown } = {}
): Promise<LocalAcceptedCandidateProcessingRunReadout> {
  const limit = normaliseAcceptedProcessingLimit(input.limit);
  const candidates = await listLocalAcceptedCandidateProcessingBatch(limit);
  const results: LocalAcceptedCandidateProcessingResultReadout[] = [];
  const errors: LocalAcceptedCandidateProcessingRunReadout["errors"] = [];

  for (const candidate of candidates) {
    try {
      results.push(await processLocalAcceptedCandidate(candidate));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Accepted candidate processing failed.";
      errors.push({
        dedupeKey: candidate.dedupeKey,
        error: message,
        title: candidate.title
      });
      results.push(await markLocalAcceptedCandidateProcessing(candidate, {
        error: message,
        linkedClaim: false
      }));
    }
  }

  const status = await getLocalAcceptedCandidateProcessingStatus();

  return {
    errors,
    hasMore: status.counts.unprocessed > 0,
    limit,
    processed: results.length,
    results,
    status
  };
}

export async function getLocalBenefitDiscoveryQueue(
  input: LocalBenefitDiscoveryQueueInput = {}
): Promise<LocalBenefitDiscoveryQueueReadout> {
  const limit = normaliseBenefitDiscoveryLimit(input.limit, input.limitMax);
  const includeDecided = optionalBoolean(input.includeDecided);
  const [candidates, interventions] = await Promise.all([
    prisma.sourceCandidate.findMany({
      where: localAcceptedCandidateWhere({
        acceptedReferenceId: {
          not: null
        }
      }),
      orderBy: [{ triageScore: "desc" }, { updatedAt: "desc" }],
      select: LOCAL_BENEFIT_DISCOVERY_CANDIDATE_SELECT
    }),
    prisma.intervention.findMany({
      select: LOCAL_BENEFIT_DISCOVERY_INTERVENTION_SELECT
    })
  ]);
  const interventionTerms = buildLocalBenefitDiscoveryInterventionTerms(interventions);
  const clustersByKey = new Map<string, LocalBenefitDiscoveryClusterBuilder>();
  const activeCandidateKeys = new Set<string>();
  const decidedClusterKeys = new Set<string>();
  const mismatchCandidates = new Set<string>();
  const parkedClusterKeys = new Set<string>();

  for (const candidate of candidates) {
    const processing = readLocalAcceptedCandidateProcessingMetadata(candidate.metadata);

    if (!processing || !processing.needsClaim || !candidate.interventionId || !candidate.intervention) {
      continue;
    }

    const decision = readLocalBenefitDiscoveryDecisionMetadata(candidate.metadata);

    if (decision) {
      decidedClusterKeys.add(decision.clusterKey);

      if (decision.status === "parked") {
        parkedClusterKeys.add(decision.clusterKey);
      }

      if (!includeDecided) {
        continue;
      }
    }

    const clusterOutcomes = localBenefitDiscoveryClusterOutcomes(candidate);

    for (const outcome of clusterOutcomes) {
      const clusterKey = localBenefitDiscoveryClusterKey({
        interventionId: candidate.interventionId,
        outcome
      });

      if (decision && decision.clusterKey !== clusterKey && !includeDecided) {
        continue;
      }

      const mismatch = localBenefitDiscoveryMismatch(candidate, interventionTerms);
      const cluster =
        clustersByKey.get(clusterKey) ??
        localBenefitDiscoveryClusterBuilder(candidate, outcome, clusterKey);

      cluster.candidates.push({
        candidate,
        identityCautions: mismatch.cautions,
        mismatchReasons: mismatch.reasons,
        sourceTypeSuggestion:
          processing.sourceTypeSuggestion ?? localAcceptedCandidateSourceTypeSuggestion(candidate)
      });

      if (decision?.status === "rejected") {
        cluster.rejectedCount += 1;
      }

      if (mismatch.reasons.length > 0) {
        mismatchCandidates.add(candidate.dedupeKey);
      }

      if (!decision) {
        activeCandidateKeys.add(candidate.dedupeKey);
      }

      clustersByKey.set(clusterKey, cluster);
    }
  }

  const clusters = Array.from(clustersByKey.values())
    .map(localBenefitDiscoveryClusterReadout)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.usableCandidateCount - left.usableCandidateCount ||
        left.interventionName.localeCompare(right.interventionName) ||
        left.outcomeLabel.localeCompare(right.outcomeLabel)
    );

  return {
    clusters: clusters.slice(0, limit),
    counts: {
      activeClusters: clusters.filter((cluster) => cluster.rejectedCount === 0).length,
      activeCandidates: activeCandidateKeys.size,
      decidedClusters: decidedClusterKeys.size,
      mismatchCandidates: mismatchCandidates.size,
      parkedClusters: parkedClusterKeys.size
    },
    updatedAt: new Date().toISOString()
  };
}

export async function recordLocalBenefitDiscoveryAction(
  input: LocalBenefitDiscoveryActionInput
): Promise<LocalBenefitDiscoveryActionReadout> {
  const action = normaliseBenefitDiscoveryAction(input.action);
  const clusterParts = parseBenefitDiscoveryClusterKey(
    normaliseRequiredString(input.clusterKey, "Benefit discovery cluster key is required.")
  );
  const cluster = await getLocalBenefitDiscoveryCluster(clusterParts);
  const usableCandidates = cluster.candidates.filter(
    (item) => item.mismatchReasons.length === 0 && item.candidate.acceptedReferenceId
  );

  if (action !== "park-lead" && action !== "reject-cluster" && usableCandidates.length === 0) {
    throw new Error("No non-mismatched accepted candidates are available for this cluster.");
  }

  if (action === "park-lead") {
    await markLocalBenefitDiscoveryCandidates(cluster.candidates, {
      action,
      clusterKey: cluster.clusterKey,
      status: "parked"
    });

    return {
      action,
      affectedCandidates: cluster.candidates.length,
      claimCreated: false,
      cluster: localBenefitDiscoveryClusterReadout(cluster),
      linkedReferences: 0,
      message: "Lead parked from the active benefit-discovery queue for later source review."
    };
  }

  if (action === "reject-cluster") {
    await markLocalBenefitDiscoveryCandidates(cluster.candidates, {
      action,
      clusterKey: cluster.clusterKey,
      status: "rejected"
    });

    return {
      action,
      affectedCandidates: cluster.candidates.length,
      claimCreated: false,
      cluster: localBenefitDiscoveryClusterReadout(cluster),
      linkedReferences: 0,
      message: "Cluster rejected from the local benefit-discovery queue."
    };
  }

  const claimResult =
    action === "draft-claim"
      ? await createLocalBenefitDiscoveryDraftClaim(cluster)
      : await findLocalBenefitDiscoveryExistingClaim(cluster);
  let linkedReferences = 0;

  for (const item of usableCandidates) {
    const acceptedReferenceId = item.candidate.acceptedReferenceId;

    if (!acceptedReferenceId) {
      continue;
    }

    await prisma.claimReference.upsert({
      where: {
        claimId_referenceId: {
          claimId: claimResult.claim.id,
          referenceId: acceptedReferenceId
        }
      },
      create: {
        claimId: claimResult.claim.id,
        note: `Accepted local benefit-discovery source ${item.candidate.externalId}: ${item.candidate.title}`,
        referenceId: acceptedReferenceId,
        relevance: 4
      },
      update: {
        note: `Accepted local benefit-discovery source ${item.candidate.externalId}: ${item.candidate.title}`,
        relevance: 4
      }
    });
    await prisma.sourceCandidate.update({
      where: {
        dedupeKey: item.candidate.dedupeKey
      },
      data: {
        claimId: claimResult.claim.id,
        metadata: writeLocalBenefitDiscoveryDecisionMetadata(item.candidate.metadata, {
          action,
          claimId: claimResult.claim.id,
          clusterKey: cluster.clusterKey,
          status: action === "draft-claim" ? "claim-drafted" : "linked-existing-claim"
        })
      }
    });
    linkedReferences += 1;
  }

  await markLocalBenefitDiscoveryCandidates(
    cluster.candidates.filter((item) => item.mismatchReasons.length > 0),
    {
      action,
      claimId: claimResult.claim.id,
      clusterKey: cluster.clusterKey,
      status: "skipped-mismatch"
    }
  );

  return {
    action,
    affectedCandidates: cluster.candidates.length,
    claimCreated: claimResult.created,
    claimId: claimResult.claim.id,
    cluster: localBenefitDiscoveryClusterReadout(cluster),
    linkedReferences,
    message:
      action === "draft-claim"
        ? `Draft claim ${claimResult.created ? "created" : "reused"} and ${linkedReferences.toLocaleString()} reference(s) linked.`
        : `${linkedReferences.toLocaleString()} reference(s) linked to existing claim.`
  };
}

export function isLocalBenefitDiscoveryAutomationInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return false;
  }

  const record = input as Record<string, unknown>;

  return optionalString(record.action) === "auto-build" || optionalString(record.mode) === "auto-build";
}

export async function runLocalBenefitDiscoveryAutomation(
  input: LocalBenefitDiscoveryAutomationInput
): Promise<LocalBenefitDiscoveryAutomationReadout> {
  const apply = optionalBoolean(input.apply);
  const limit = normaliseBenefitDiscoveryAutomationLimit(input.limit);
  const scope = normaliseBenefitDiscoveryAutomationScope(input.scope);
  const strategy = normaliseBenefitDiscoveryAutomationStrategy(input.strategy);
  const threshold = normaliseBenefitDiscoveryScoreThreshold(input.threshold);
  const rejectThreshold = normaliseBenefitDiscoveryRejectThreshold(
    input.rejectThreshold,
    threshold
  );
  const parkThreshold =
    strategy === "park-backlog"
      ? rejectThreshold
      : normaliseBenefitDiscoveryParkThreshold(input.parkThreshold, threshold);
  const scanLimit =
    scope === "all-eligible"
      ? LOCAL_BENEFIT_DISCOVERY_AUTOMATION_ALL_MAX
      : limit;
  const queue = await getLocalBenefitDiscoveryQueue({
    limit: scanLimit,
    limitMax: scanLimit
  });
  const decisions = queue.clusters.map((cluster) =>
    localBenefitDiscoveryAutomationDecision(cluster, threshold, strategy, {
      parkThreshold,
      rejectThreshold
    })
  );

  if (apply) {
    for (const decision of decisions) {
      if (decision.action === "hold") {
        continue;
      }

      try {
        const result = await recordLocalBenefitDiscoveryAction({
          action: decision.action,
          clusterKey: decision.clusterKey
        });

        decision.applied = true;
        decision.claimId = result.claimId;
        decision.linkedReferences = result.linkedReferences;
      } catch (error) {
        decision.error =
          error instanceof Error ? error.message : "Benefit discovery automation action failed.";
      }
    }
  }

  const counts = localBenefitDiscoveryAutomationCounts(decisions);
  const actionable =
    counts.draftClaims +
    counts.linkExistingClaims +
    counts.parkLeadClusters +
    counts.rejectClusters;

  return {
    action: "auto-build",
    applied: apply,
    counts,
    decisions,
    limit: scanLimit,
    message: apply
      ? `Auto-build applied ${counts.appliedActions.toLocaleString()} action(s), linked ${counts.linkedReferences.toLocaleString()} reference(s), and left ${counts.errors.toLocaleString()} error(s).`
      : `Auto-build preview found ${actionable.toLocaleString()} actionable cluster(s) at score ${threshold}.`,
    parkThreshold,
    rejectThreshold,
    scope,
    strategy,
    threshold,
    updatedAt: new Date().toISOString()
  };
}

export async function getLocalIdentityResolutionQueue(
  input: LocalIdentityResolutionQueueInput = {}
): Promise<LocalIdentityResolutionQueueReadout> {
  const limit = normaliseIdentityResolutionLimit(input.limit);
  const { blockedCandidates, interventions } = await getLocalIdentityResolutionCandidates();

  return {
    candidates: blockedCandidates.slice(0, limit),
    counts: {
      blockedCandidates: blockedCandidates.length
    },
    interventions: interventions.map((intervention) => ({
      id: intervention.id,
      name: intervention.name
    })),
    limit,
    updatedAt: new Date().toISOString()
  };
}

async function getLocalIdentityResolutionCandidates() {
  const [candidates, interventions] = await Promise.all([
    prisma.sourceCandidate.findMany({
      where: localAcceptedCandidateWhere({
        acceptedReferenceId: {
          not: null
        }
      }),
      orderBy: [{ triageScore: "desc" }, { updatedAt: "desc" }],
      select: LOCAL_BENEFIT_DISCOVERY_CANDIDATE_SELECT
    }),
    prisma.intervention.findMany({
      orderBy: [{ name: "asc" }],
      select: LOCAL_BENEFIT_DISCOVERY_INTERVENTION_SELECT
    })
  ]);
  const interventionTerms = buildLocalBenefitDiscoveryInterventionTerms(interventions);
  const blockedCandidates: LocalIdentityResolutionCandidateReadout[] = [];
  const acceptedSourceInterventionKeys = new Set(
    candidates
      .filter((candidate) => candidate.interventionId)
      .map((candidate) => localIdentityResolutionSourceInterventionKey(candidate))
  );

  for (const candidate of candidates) {
    const processing = readLocalAcceptedCandidateProcessingMetadata(candidate.metadata);
    const identityResolution = readLocalIdentityResolutionMetadata(candidate.metadata);

    if (
      !processing?.needsClaim ||
      !candidate.interventionId ||
      !candidate.intervention ||
      identityResolution?.status === "confirmed-target" ||
      identityResolution?.status === "rejected-wrong-supplement"
    ) {
      continue;
    }

    const mismatch = localBenefitDiscoveryMismatch(candidate, interventionTerms);

    if (mismatch.reasons.length === 0) {
      continue;
    }

    blockedCandidates.push(
      localIdentityResolutionCandidateReadout(
        candidate,
        mismatch,
        acceptedSourceInterventionKeys
      )
    );
  }

  return {
    blockedCandidates,
    interventions,
    interventionTerms
  };
}

export function isLocalIdentityResolutionAutomationInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return false;
  }

  const record = input as Record<string, unknown>;

  return optionalString(record.action) === "auto-resolve" || optionalString(record.mode) === "auto-resolve";
}

export async function runLocalIdentityResolutionAutomation(
  input: LocalIdentityResolutionAutomationInput
): Promise<LocalIdentityResolutionAutomationReadout> {
  const apply = optionalBoolean(input.apply);
  const limit = normaliseIdentityResolutionAutomationLimit(input.limit);
  const scope = normaliseIdentityResolutionAutomationScope(input.scope);
  const strategy = normaliseIdentityResolutionAutomationStrategy(input.strategy);
  const { blockedCandidates, interventionTerms } = await getLocalIdentityResolutionCandidates();
  const scanLimit =
    scope === "all-eligible"
      ? LOCAL_IDENTITY_RESOLUTION_AUTOMATION_ALL_MAX
      : limit;
  const decisions = blockedCandidates
    .slice(0, scanLimit)
    .map((candidate) =>
      localIdentityResolutionAutomationDecision(candidate, interventionTerms, strategy)
    );

  if (apply) {
    for (const decision of decisions) {
      if (decision.action === "hold") {
        continue;
      }

      try {
        await recordLocalIdentityResolutionAction({
          action: decision.action,
          dedupeKey: decision.dedupeKey,
          interventionId: decision.matchedInterventionId
        });
        decision.applied = true;
      } catch (error) {
        decision.error =
          error instanceof Error ? error.message : "Identity auto-resolution action failed.";
      }
    }
  }

  const counts = localIdentityResolutionAutomationCounts(decisions);
  const actionable =
    counts.confirmTarget + counts.reassignIntervention + counts.rejectWrongSupplement;

  return {
    action: "auto-resolve",
    applied: apply,
    counts,
    decisions,
    limit: scanLimit,
    message: apply
      ? `Identity auto-resolve applied ${counts.appliedActions.toLocaleString()} action(s) and left ${counts.errors.toLocaleString()} error(s).`
      : `Identity auto-resolve preview found ${actionable.toLocaleString()} actionable candidate(s).`,
    scope,
    strategy,
    updatedAt: new Date().toISOString()
  };
}

export async function recordLocalIdentityResolutionAction(
  input: LocalIdentityResolutionActionInput
): Promise<LocalIdentityResolutionActionReadout> {
  const action = normaliseIdentityResolutionAction(input.action);
  const dedupeKey = normaliseRequiredString(
    input.dedupeKey,
    "Identity-resolution candidate key is required."
  );
  const candidate = await prisma.sourceCandidate.findUnique({
    where: {
      dedupeKey
    },
    select: LOCAL_BENEFIT_DISCOVERY_CANDIDATE_SELECT
  });

  if (!candidate || candidate.decision !== DbSourceCandidateDecision.ACCEPTED) {
    throw new Error("Accepted source candidate was not found for identity resolution.");
  }

  if (!candidate.interventionId || !candidate.intervention) {
    throw new Error("Identity resolution requires a current intervention.");
  }

  if (action === "confirm-target") {
    await prisma.sourceCandidate.update({
      where: {
        dedupeKey
      },
      data: {
        metadata: writeLocalIdentityResolutionMetadata(candidate.metadata, {
          action,
          interventionId: candidate.interventionId,
          status: "confirmed-target"
        })
      }
    });

    return {
      action,
      message: `${candidate.intervention.name} identity confirmed for this source.`
    };
  }

  if (action === "reassign-intervention") {
    const interventionId = normaliseRequiredString(
      input.interventionId,
      "Target intervention is required."
    );
    const intervention = await prisma.intervention.findUnique({
      where: {
        id: interventionId
      },
      select: {
        id: true,
        name: true
      }
    });

    if (!intervention) {
      throw new Error("Target intervention was not found.");
    }

    await removeLocalIdentityResolutionClaimReference(candidate);
    await prisma.sourceCandidate.update({
      where: {
        dedupeKey
      },
      data: {
        claimId: null,
        interventionId: intervention.id,
        metadata: writeLocalIdentityResolutionMetadata(candidate.metadata, {
          action,
          interventionId: intervention.id,
          status: "confirmed-target"
        })
      }
    });

    return {
      action,
      message: `Source reassigned to ${intervention.name}.`
    };
  }

  if (action === "add-synonym") {
    const synonym = normaliseRequiredString(input.synonym, "Alias/synonym is required.");
    const intervention = await prisma.intervention.findUnique({
      where: {
        id: candidate.interventionId
      },
      select: {
        id: true,
        name: true,
        synonyms: true
      }
    });

    if (!intervention) {
      throw new Error("Current intervention was not found.");
    }

    const synonymKey = localBenefitDiscoveryTerm(synonym);
    const existingKeys = new Set(
      [intervention.name, ...intervention.synonyms].map(localBenefitDiscoveryTerm)
    );

    if (!existingKeys.has(synonymKey)) {
      await prisma.intervention.update({
        where: {
          id: intervention.id
        },
        data: {
          synonyms: {
            set: [...intervention.synonyms, synonym.trim()]
          }
        }
      });
    }

    await prisma.sourceCandidate.update({
      where: {
        dedupeKey
      },
      data: {
        metadata: writeLocalIdentityResolutionMetadata(candidate.metadata, {
          action,
          interventionId: intervention.id,
          status: "confirmed-target",
          synonym
        })
      }
    });

    return {
      action,
      message: existingKeys.has(synonymKey)
        ? `${intervention.name} already had that alias; source identity confirmed.`
        : `Added alias to ${intervention.name} and confirmed this source.`
    };
  }

  await removeLocalIdentityResolutionClaimReference(candidate);
  await prisma.sourceCandidate.update({
    where: {
      dedupeKey
    },
    data: {
      acceptedReferenceId: null,
      claimId: null,
      decision: DbSourceCandidateDecision.REJECTED,
      metadata: writeLocalIdentityResolutionMetadata(candidate.metadata, {
        action,
        interventionId: candidate.interventionId,
        status: "rejected-wrong-supplement"
      }),
      reviewNote: "Rejected by local identity resolver as wrong supplement.",
      reviewedAt: new Date()
    }
  });

  return {
    action,
    message: "Source rejected as the wrong supplement for this local candidate."
  };
}

async function removeLocalIdentityResolutionClaimReference(
  candidate: LocalBenefitDiscoveryCandidate
) {
  if (!candidate.acceptedReferenceId || !candidate.claimId) {
    return;
  }

  await prisma.claimReference.deleteMany({
    where: {
      claimId: candidate.claimId,
      referenceId: candidate.acceptedReferenceId
    }
  });
}

export async function startLocalIngestionDiscovery(): Promise<LocalIngestionStartResult> {
  const interventions = await prisma.intervention.findMany({
    orderBy: [{ name: "asc" }],
    select: {
      id: true
    }
  });
  const sampleJobs: LocalIngestionQueuedJobReadout[] = [];
  let newJobs = 0;
  let existingJobs = 0;
  let jobCount = 0;

  for (const intervention of interventions) {
    const queued = await queueInterventionSourceCandidateDiscoveryJobs({
      interventionId: intervention.id,
      region: "AU"
    });

    for (const job of queued.jobs) {
      jobCount += 1;
      if (job.created) {
        newJobs += 1;
      } else {
        existingJobs += 1;
      }

      if (sampleJobs.length < LOCAL_RECENT_ITEM_LIMIT) {
        sampleJobs.push(localQueuedJobReadout(job));
      }
    }
  }

  const deepeningCatchUp = await queuePubMedDeepeningCatchUpJobs({
    pageSize: 20
  });

  return {
    deepeningCatchUp,
    existingJobs,
    interventionCount: interventions.length,
    jobCount,
    newJobs,
    phase: "primary",
    sampleJobs,
    searchTermCount: interventions.length,
    status: await getLocalIngestionStatus()
  };
}

export async function startLocalIngestionSynonymDiscovery(): Promise<LocalIngestionStartResult> {
  const interventions = await prisma.intervention.findMany({
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      synonyms: true
    }
  });
  const sampleJobs: LocalIngestionQueuedJobReadout[] = [];
  let newJobs = 0;
  let existingJobs = 0;
  let jobCount = 0;
  let searchTermCount = 0;
  let interventionCount = 0;

  for (const intervention of interventions) {
    const synonymTerms = localIngestionSynonymSearchTerms(intervention);

    if (synonymTerms.length === 0) {
      continue;
    }

    interventionCount += 1;

    for (const searchTerm of synonymTerms) {
      searchTermCount += 1;
      const queued = await queueInterventionSourceCandidateDiscoveryJobs({
        interventionId: intervention.id,
        region: "AU",
        searchTerm
      });

      for (const job of queued.jobs) {
        jobCount += 1;
        if (job.created) {
          newJobs += 1;
        } else {
          existingJobs += 1;
        }

        if (sampleJobs.length < LOCAL_RECENT_ITEM_LIMIT) {
          sampleJobs.push(localQueuedJobReadout(job));
        }
      }
    }
  }

  const deepeningCatchUp = await queuePubMedDeepeningCatchUpJobs({
    pageSize: 20
  });

  return {
    deepeningCatchUp,
    existingJobs,
    interventionCount,
    jobCount,
    newJobs,
    phase: "synonym",
    sampleJobs,
    searchTermCount,
    status: await getLocalIngestionStatus()
  };
}

export async function runLocalIngestionBatch(input: {
  limit?: unknown;
} = {}): Promise<LocalIngestionRunResult> {
  const limit = normaliseRunLimit(input.limit);
  const results: SourceCandidateIngestionJobRunResult[] = [];

  for (let index = 0; index < limit; index += 1) {
    const result = await runNextSourceCandidateIngestionJob({
      clinicalTrialPageSize: 20,
      pubMedRetmax: 20
    });

    if (!result) {
      break;
    }

    results.push(result);
  }

  const [status, queuedCount] = await Promise.all([
    getLocalIngestionStatus(),
    prisma.ingestionJob.count({
      where: {
        source: {
          in: LOCAL_SUPPORTED_SOURCES
        },
        status: DbIngestionStatus.QUEUED
      }
    })
  ]);

  return {
    hasMoreQueued: queuedCount > 0,
    limit,
    processed: results.length,
    results,
    status
  };
}

async function listLocalAcceptedCandidateProcessingBatch(limit: number) {
  const rows = await prisma.$queryRaw<LocalAcceptedCandidateProcessingBatchRow[]>(
    Prisma.sql`
      SELECT "dedupeKey"
      FROM "SourceCandidate"
      WHERE "decision"::text = ${DbSourceCandidateDecision.ACCEPTED}
        AND "source"::text IN (${Prisma.join(LOCAL_SUPPORTED_SOURCES)})
        AND "acceptedReferenceId" IS NOT NULL
        AND COALESCE("metadata" #>> '{localAcceptedProcessing,version}', '') <> ${LOCAL_ACCEPTED_PROCESSING_METADATA_VERSION}
      ORDER BY "triageScore" DESC, "updatedAt" ASC, "id" ASC
      LIMIT ${limit}
    `
  );
  const dedupeKeys = rows.map((row) => row.dedupeKey);

  if (dedupeKeys.length === 0) {
    return [];
  }

  const candidates = await prisma.sourceCandidate.findMany({
    where: {
      dedupeKey: {
        in: dedupeKeys
      }
    },
    select: LOCAL_ACCEPTED_CANDIDATE_PROCESS_SELECT
  });
  const candidatesByKey = new Map(
    candidates.map((candidate) => [candidate.dedupeKey, candidate])
  );

  return dedupeKeys
    .map((dedupeKey) => candidatesByKey.get(dedupeKey))
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
}

function localBenefitDiscoveryClusterBuilder(
  candidate: LocalBenefitDiscoveryCandidate,
  outcome: DbOutcomeArea,
  clusterKey: string
): LocalBenefitDiscoveryClusterBuilder {
  return {
    candidates: [],
    clusterKey,
    existingClaims: (candidate.intervention?.claims ?? [])
      .filter((claim) => claim.outcome === outcome)
      .map((claim) => ({
        claimText: claim.claimText,
        id: claim.id
    })),
    interventionId: candidate.interventionId ?? "",
    interventionName: candidate.intervention?.name ?? "Unlinked intervention",
    outcome,
    outcomeLabel: localBenefitDiscoveryOutcomeLabel(outcome),
    rejectedCount: 0
  };
}

function localBenefitDiscoveryClusterReadout(
  cluster: LocalBenefitDiscoveryClusterBuilder
): LocalBenefitDiscoveryClusterReadout {
  const leadScore = localBenefitDiscoveryLeadScore(cluster);
  const topSources = cluster.candidates
    .map((item) => ({
      ...localBenefitDiscoverySourceReadout(item),
      weight: localBenefitDiscoverySourceWeight(item.sourceTypeSuggestion)
    }))
    .sort(
      (left, right) =>
        Number(left.mismatchReasons.length > 0) - Number(right.mismatchReasons.length > 0) ||
        right.weight - left.weight ||
        right.triageScore - left.triageScore ||
        (right.publishedYear ?? 0) - (left.publishedYear ?? 0)
    );
  const mismatchCount = cluster.candidates.filter(
    (item) => item.mismatchReasons.length > 0
  ).length;
  const usableCandidateCount = cluster.candidates.length - mismatchCount;

  return {
    candidateCount: cluster.candidates.length,
    clusterKey: cluster.clusterKey,
    existingClaims: cluster.existingClaims,
    interventionId: cluster.interventionId,
    interventionName: cluster.interventionName,
    mismatchCount,
    novelCandidateCount: cluster.existingClaims.length === 0 ? usableCandidateCount : 0,
    outcome: cluster.outcome,
    outcomeLabel: cluster.outcomeLabel,
    rejectedCount: cluster.rejectedCount,
    leadReasons: leadScore.reasons,
    score: leadScore.score,
    topSources: topSources.slice(0, 5).map((source) => ({
      acceptedReferenceId: source.acceptedReferenceId,
      dedupeKey: source.dedupeKey,
      externalId: source.externalId,
      identityCautions: source.identityCautions,
      mismatchReasons: source.mismatchReasons,
      publishedYear: source.publishedYear,
      source: source.source,
      sourceTypeSuggestion: source.sourceTypeSuggestion,
      title: source.title,
      triageScore: source.triageScore,
      url: source.url
    })),
    usableCandidateCount
  };
}

export function localBenefitDiscoveryAutomationDecision(
  cluster: LocalBenefitDiscoveryClusterReadout,
  threshold: number,
  strategy: LocalBenefitDiscoveryAutomationStrategy = "build-leads",
  options: {
    parkThreshold?: number;
    rejectThreshold?: number;
  } = {}
): LocalBenefitDiscoveryAutomationDecisionReadout {
  const mismatchRatio =
    cluster.candidateCount > 0 ? cluster.mismatchCount / cluster.candidateCount : 1;
  let action: LocalBenefitDiscoveryAutomationAction = "hold";
  const actionReasons: string[] = [];
  const existingLinkFloor = Math.max(
    LOCAL_BENEFIT_DISCOVERY_EXISTING_LINK_SCORE_FLOOR,
    threshold - 10
  );
  const rejectThreshold = normaliseBenefitDiscoveryRejectThreshold(
    options.rejectThreshold,
    threshold
  );
  if (cluster.usableCandidateCount === 0 || mismatchRatio >= 0.8) {
    action = "reject-cluster";
    actionReasons.push("Too little clean supplement-identity signal for a useful lead.");
  } else if (strategy === "park-backlog") {
    if (cluster.score >= threshold) {
      actionReasons.push(
        `Meets the ${threshold} lead-score threshold; use build or link mode rather than parking.`
      );
    } else if (cluster.score < rejectThreshold || mismatchRatio >= 0.5) {
      action = "reject-cluster";
      actionReasons.push(
        `Below the ${rejectThreshold} reject-below threshold or heavy mismatch load makes this noise for now.`
      );
    } else {
      action = "park-lead";
      actionReasons.push(
        `Lead score ${cluster.score} is between ${rejectThreshold} and ${threshold - 1}; park for later source review without creating a claim.`
      );
    }
  } else if (strategy === "link-existing") {
    if (cluster.existingClaims.length > 0 && cluster.score >= existingLinkFloor) {
      action = "link-existing-claim";
      actionReasons.push(
        `Existing-claim cleanup links clusters at score ${existingLinkFloor} or higher.`
      );
    } else {
      actionReasons.push(
        cluster.existingClaims.length > 0
          ? `Below the ${existingLinkFloor} existing-claim cleanup floor; keep for manual review.`
          : "Cleanup mode does not draft novel claim areas."
      );
    }
  } else if (cluster.score >= threshold) {
    action = cluster.existingClaims.length > 0 ? "link-existing-claim" : "draft-claim";
    actionReasons.push(`Meets the ${threshold} lead-score threshold.`);
  } else if (cluster.score < 40 || mismatchRatio >= 0.5) {
    action = "reject-cluster";
    actionReasons.push("Low score or heavy mismatch load makes this noise for now.");
  } else {
    actionReasons.push(`Below the ${threshold} auto-build threshold; keep for manual review.`);
  }

  return {
    action,
    applied: false,
    candidateCount: cluster.candidateCount,
    clusterKey: cluster.clusterKey,
    existingClaimCount: cluster.existingClaims.length,
    interventionName: cluster.interventionName,
    leadReasons: [...cluster.leadReasons.slice(0, 4), ...actionReasons].slice(0, 5),
    leadScore: cluster.score,
    linkedReferences: 0,
    mismatchCount: cluster.mismatchCount,
    outcomeLabel: cluster.outcomeLabel,
    usableCandidateCount: cluster.usableCandidateCount
  };
}

function localBenefitDiscoveryAutomationCounts(
  decisions: LocalBenefitDiscoveryAutomationDecisionReadout[]
): LocalBenefitDiscoveryAutomationReadout["counts"] {
  return {
    appliedActions: decisions.filter((decision) => decision.applied).length,
    draftClaims: decisions.filter((decision) => decision.action === "draft-claim").length,
    errors: decisions.filter((decision) => decision.error).length,
    holdClusters: decisions.filter((decision) => decision.action === "hold").length,
    linkExistingClaims: decisions.filter((decision) => decision.action === "link-existing-claim")
      .length,
    parkLeadClusters: decisions.filter((decision) => decision.action === "park-lead").length,
    rejectClusters: decisions.filter((decision) => decision.action === "reject-cluster").length,
    scannedClusters: decisions.length,
    skippedMismatchCandidates: decisions
      .filter((decision) => decision.action !== "hold")
      .reduce((total, decision) => total + decision.mismatchCount, 0),
    linkedReferences: decisions.reduce(
      (total, decision) => total + decision.linkedReferences,
      0
    )
  };
}

function localBenefitDiscoveryLeadScore(cluster: LocalBenefitDiscoveryClusterBuilder) {
  const candidateCount = cluster.candidates.length;
  const cleanCandidates = cluster.candidates.filter(
    (item) => item.mismatchReasons.length === 0 && item.candidate.acceptedReferenceId
  );
  const uniqueUsableCandidates = localBenefitDiscoveryUniqueAcceptedReferences(cleanCandidates);
  const usableReferenceCount = uniqueUsableCandidates.length;
  const mismatchCount = candidateCount - cleanCandidates.length;

  if (usableReferenceCount === 0) {
    return {
      reasons: ["No non-mismatched accepted references are available."],
      score: 0
    };
  }

  const weights = uniqueUsableCandidates.map((item) =>
    localBenefitDiscoverySourceWeight(item.sourceTypeSuggestion)
  );
  const bestWeight = Math.max(...weights);
  const bestSource = uniqueUsableCandidates.reduce((best, item) =>
    localBenefitDiscoverySourceWeight(item.sourceTypeSuggestion) >
    localBenefitDiscoverySourceWeight(best.sourceTypeSuggestion)
      ? item
      : best
  );
  const mismatchRatio = candidateCount > 0 ? mismatchCount / candidateCount : 1;
  const identityScore = Math.max(0, Math.round(30 * (1 - mismatchRatio)));
  const evidenceScore = Math.min(
    40,
    Math.round(bestWeight * 0.35) +
      Math.min(8, weights.filter((weight) => weight >= 70).length * 4) +
      Math.min(6, Math.max(0, usableReferenceCount - 1) * 2)
  );
  const traceabilityScore = Math.min(
    15,
    8 + Math.min(7, Math.max(0, usableReferenceCount - 1) * 2)
  );
  const corroborationScore = Math.min(10, Math.max(0, usableReferenceCount - 1) * 2);
  const claimContextScore = cluster.existingClaims.length > 0 ? 3 : 5;
  const mismatchPenalty =
    Math.round(mismatchRatio * 20) + (mismatchRatio > 0.5 ? 15 : 0);
  const weakEvidencePenalty = bestWeight < 55 ? 8 : 0;
  const score = clampLocalBenefitDiscoveryScore(
    identityScore +
      evidenceScore +
      traceabilityScore +
      corroborationScore +
      claimContextScore -
      mismatchPenalty -
      weakEvidencePenalty
  );
  const reasons = [
    `${usableReferenceCount.toLocaleString()} unique clean accepted reference(s).`,
    `${bestSource.sourceTypeSuggestion} is the strongest lead type.`,
    cluster.existingClaims.length > 0
      ? "Can link into an existing claim area."
      : "Novel claim area for this supplement."
  ];

  if (usableReferenceCount > 1) {
    reasons.push(`${usableReferenceCount.toLocaleString()} source(s) corroborate the area.`);
  }

  if (mismatchCount > 0) {
    reasons.push(
      `${mismatchCount.toLocaleString()} candidate(s) are withheld for identity checks.`
    );
  }

  return {
    reasons,
    score
  };
}

function clampLocalBenefitDiscoveryScore(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function localBenefitDiscoveryUniqueAcceptedReferences(
  candidates: LocalBenefitDiscoveryClusterBuilder["candidates"]
) {
  const seen = new Set<string>();
  const unique: LocalBenefitDiscoveryClusterBuilder["candidates"] = [];

  for (const item of candidates) {
    const key = item.candidate.acceptedReferenceId ?? item.candidate.dedupeKey;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(item);
  }

  return unique;
}

function localBenefitDiscoverySourceReadout({
  candidate,
  identityCautions,
  mismatchReasons,
  sourceTypeSuggestion
}: LocalBenefitDiscoveryClusterBuilder["candidates"][number]): LocalBenefitDiscoverySourceReadout {
  return {
    acceptedReferenceId: candidate.acceptedReferenceId ?? undefined,
    dedupeKey: candidate.dedupeKey,
    externalId: candidate.externalId,
    identityCautions,
    mismatchReasons,
    publishedYear: candidate.publishedYear ?? undefined,
    source: candidate.source,
    sourceTypeSuggestion,
    title: candidate.title,
    triageScore: candidate.triageScore,
    url: candidate.url
  };
}

function localIdentityResolutionCandidateReadout(
  candidate: LocalBenefitDiscoveryCandidate,
  mismatch: ReturnType<typeof localBenefitDiscoveryMismatch>,
  acceptedSourceInterventionKeys = new Set<string>()
): LocalIdentityResolutionCandidateReadout {
  const processing = readLocalAcceptedCandidateProcessingMetadata(candidate.metadata);

  return {
    dedupeKey: candidate.dedupeKey,
    externalId: candidate.externalId,
    identityCautions: mismatch.cautions,
    interventionId: candidate.interventionId ?? "",
    interventionName: candidate.intervention?.name ?? "Unlinked intervention",
    matchedInterventions: mismatch.otherMatches.map((match) => ({
      ...match,
      hasAcceptedCandidate: acceptedSourceInterventionKeys.has(
        localIdentityResolutionSourceInterventionKey(candidate, match.id)
      )
    })),
    mismatchReasons: mismatch.reasons,
    publishedYear: candidate.publishedYear ?? undefined,
    query: candidate.query,
    source: candidate.source,
    sourceIdentityText: localBenefitDiscoverySourceIdentityText(candidate),
    sourceTypeSuggestion:
      processing?.sourceTypeSuggestion ?? localAcceptedCandidateSourceTypeSuggestion(candidate),
    title: candidate.title,
    triageScore: candidate.triageScore,
    url: candidate.url
  };
}

function localIdentityResolutionSourceInterventionKey(
  candidate: Pick<LocalBenefitDiscoveryCandidate, "externalId" | "interventionId" | "source">,
  interventionId = candidate.interventionId
) {
  return `${candidate.source}:${candidate.externalId}:${interventionId ?? ""}`;
}

export function localIdentityResolutionAutomationDecision(
  candidate: LocalIdentityResolutionCandidateReadout,
  interventionTerms: Array<{
    id: string;
    name: string;
    terms: string[];
  }>,
  strategy: LocalIdentityResolutionAutomationStrategy = "strict"
): LocalIdentityResolutionAutomationDecisionReadout {
  const queryText = localBenefitDiscoveryTerm(candidate.query);
  const targetTerms =
    interventionTerms.find((intervention) => intervention.id === candidate.interventionId)
      ?.terms ?? [];
  const queryHasTarget = targetTerms.some((term) =>
    localBenefitDiscoveryContainsTerm(queryText, term)
  );
  const sourceText =
    candidate.sourceIdentityText ?? localBenefitDiscoveryTerm(candidate.title);
  const titleText = localBenefitDiscoveryTerm(candidate.title);
  const targetNotVisible = candidate.mismatchReasons.some((reason) =>
    reason.includes("Target supplement is not visible")
  );
  const sourceContextMismatch = localBenefitDiscoveryInterventionContextMismatch({
    interventionId: candidate.interventionId,
    sourceText,
    targetTerms
  });
  const sourceHasTargetIdentity =
    !sourceContextMismatch &&
    targetTerms.some((term) => localIdentityResolutionContainsLooseTerm(sourceText, term));
  const queryOtherMatches = interventionTerms
    .filter((intervention) => intervention.id !== candidate.interventionId)
    .filter((intervention) =>
      intervention.terms.some((term) => localBenefitDiscoveryContainsTerm(queryText, term))
    )
    .map((intervention) => ({
      id: intervention.id,
      name: intervention.name
    }));
  const matchedIntervention =
    candidate.matchedInterventions.length === 1 ? candidate.matchedInterventions[0] : undefined;
  const queryMatchedIntervention = matchedIntervention
    ? queryOtherMatches.find((intervention) => intervention.id === matchedIntervention.id)
    : undefined;
  let action: LocalIdentityResolutionAutomationAction = "hold";
  let matchedInterventionId: string | undefined;
  let matchedInterventionName: string | undefined;
  const reasons: string[] = [];
  const currentIdentityMissingReason =
    sourceContextMismatch ?? "Current supplement identity is not visible in captured metadata.";

  if (
    queryHasTarget &&
    sourceHasTargetIdentity &&
    queryOtherMatches.length === 0 &&
    candidate.matchedInterventions.length === 0
  ) {
    action = "confirm-target";
    reasons.push("Search query contains the current supplement identity.");
    reasons.push("Captured metadata has a loose current-supplement identity match.");
    reasons.push("Captured metadata has no competing tracked supplement match.");
  } else if (!queryHasTarget && queryMatchedIntervention) {
    action = "reassign-intervention";
    matchedInterventionId = queryMatchedIntervention.id;
    matchedInterventionName = queryMatchedIntervention.name;
    reasons.push(`Search query and captured metadata both point to ${matchedInterventionName}.`);
    reasons.push("Current supplement identity is not visible in the query or metadata.");
  } else if (
    strategy === "source-led" &&
    !targetNotVisible &&
    sourceHasTargetIdentity &&
    localIdentityResolutionOnlyFamilyOverlap(candidate, queryText)
  ) {
    action = "confirm-target";
    reasons.push("Captured metadata has a loose current-supplement identity match.");
    reasons.push("Competing match is a broader family/name overlap.");
  } else if (strategy === "source-led" && (targetNotVisible || !sourceHasTargetIdentity)) {
    const dominantMatch = localIdentityResolutionDominantMatch({
      candidate,
      interventionTerms,
      sourceText,
      titleText
    });

    if (dominantMatch) {
      matchedInterventionId = dominantMatch.id;
      matchedInterventionName = dominantMatch.name;
      if (dominantMatch.hasAcceptedCandidate) {
        action = "reject-wrong-supplement";
        reasons.push(
          `${dominantMatch.name} already has this accepted source; reject the current duplicate wrong-supplement row.`
        );
        reasons.push(currentIdentityMissingReason);
      } else {
        action = "reassign-intervention";
        reasons.push(
          `Captured source text points more strongly to ${dominantMatch.name} than the current supplement.`
        );
        reasons.push(currentIdentityMissingReason);
      }
    } else if (
      candidate.matchedInterventions.length > 0 &&
      localIdentityResolutionHasSubstantialSourceText(sourceText)
    ) {
      action = "reject-wrong-supplement";
      reasons.push(currentIdentityMissingReason);
      reasons.push(
        "Multiple or ambiguous tracked supplement matches are present, so no safe reassignment target was chosen."
      );
    } else if (
      candidate.matchedInterventions.length === 0 &&
      localIdentityResolutionHasSubstantialSourceText(sourceText)
    ) {
      action = "reject-wrong-supplement";
      reasons.push(currentIdentityMissingReason);
      reasons.push("No tracked supplement match is strong enough for reassignment.");
    } else {
      reasons.push(currentIdentityMissingReason);
      reasons.push("Hold for manual identity review.");
    }
  } else {
    if (queryHasTarget) {
      reasons.push("Search query contains the current supplement identity.");
    } else {
      reasons.push("Search query does not confirm the current supplement identity.");
    }

    if (!sourceHasTargetIdentity) {
      reasons.push(
        sourceContextMismatch ??
          "Captured metadata does not have a loose current-supplement identity match."
      );
    }

    if (candidate.matchedInterventions.length > 0) {
      reasons.push(
        `Captured metadata also matches ${candidate.matchedInterventions
          .map((intervention) => intervention.name)
          .join(", ")}.`
      );
    }

    if (queryOtherMatches.length > 0) {
      reasons.push(
        `Search query also matches ${queryOtherMatches
          .map((intervention) => intervention.name)
          .join(", ")}.`
      );
    }

    reasons.push("Hold for manual identity review.");
  }

  return {
    action,
    applied: false,
    dedupeKey: candidate.dedupeKey,
    externalId: candidate.externalId,
    interventionId: candidate.interventionId,
    interventionName: candidate.interventionName,
    matchedInterventionId,
    matchedInterventionName,
    query: candidate.query,
    reasons,
    source: candidate.source,
    title: candidate.title
  };
}

function localIdentityResolutionAutomationCounts(
  decisions: LocalIdentityResolutionAutomationDecisionReadout[]
): LocalIdentityResolutionAutomationReadout["counts"] {
  return {
    appliedActions: decisions.filter((decision) => decision.applied).length,
    confirmTarget: decisions.filter((decision) => decision.action === "confirm-target").length,
    errors: decisions.filter((decision) => decision.error).length,
    hold: decisions.filter((decision) => decision.action === "hold").length,
    reassignIntervention: decisions.filter(
      (decision) => decision.action === "reassign-intervention"
    ).length,
    rejectWrongSupplement: decisions.filter(
      (decision) => decision.action === "reject-wrong-supplement"
    ).length,
    scannedCandidates: decisions.length
  };
}

function localIdentityResolutionOnlyFamilyOverlap(
  candidate: LocalIdentityResolutionCandidateReadout,
  queryText: string
) {
  return (
    candidate.matchedInterventions.length > 0 &&
    candidate.matchedInterventions.every((match) => {
      const matchName = localBenefitDiscoveryTerm(match.name);

      return (
        matchName.length >= 4 &&
        (localBenefitDiscoveryContainsTerm(queryText, matchName) ||
          queryText.replace(/\s+/g, "").includes(matchName.replace(/\s+/g, "")))
      );
    })
  );
}

function localIdentityResolutionDominantMatch({
  candidate,
  interventionTerms,
  sourceText,
  titleText
}: {
  candidate: LocalIdentityResolutionCandidateReadout;
  interventionTerms: Array<{
    id: string;
    name: string;
    terms: string[];
  }>;
  sourceText: string;
  titleText: string;
}) {
  const scoredMatches = candidate.matchedInterventions
    .map((match) => {
      const terms =
        interventionTerms.find((intervention) => intervention.id === match.id)?.terms ?? [];
      const titleScore = terms.some((term) =>
        localIdentityResolutionContainsLooseTerm(titleText, term)
      )
        ? 6
        : 0;
      const sourceScore = terms.some((term) =>
        localIdentityResolutionContainsLooseTerm(sourceText, term)
      )
        ? 3
        : 0;

      return {
        ...match,
        score: titleScore + sourceScore
      };
    })
    .filter((match) => match.score >= 3)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));

  if (scoredMatches.length === 0) {
    return undefined;
  }

  const [best, second] = scoredMatches;

  if (second && best.score - second.score < 3) {
    return undefined;
  }

  return {
    id: best.id,
    hasAcceptedCandidate: best.hasAcceptedCandidate,
    name: best.name
  };
}

function localIdentityResolutionHasSubstantialSourceText(sourceText: string) {
  return sourceText
    .split(" ")
    .filter((token) => token.length >= 4 && !LOCAL_IDENTITY_GENERIC_TOKENS.has(token)).length >= 3;
}

async function getLocalBenefitDiscoveryCluster({
  interventionId,
  outcome
}: {
  interventionId: string;
  outcome: DbOutcomeArea;
}) {
  const readout = await getLocalBenefitDiscoveryQueue({
    includeDecided: false,
    limit: LOCAL_BENEFIT_DISCOVERY_LIMIT_MAX
  });
  const clusterKey = localBenefitDiscoveryClusterKey({ interventionId, outcome });
  const [candidateRows, interventions] = await Promise.all([
    prisma.sourceCandidate.findMany({
      where: localAcceptedCandidateWhere({
        acceptedReferenceId: {
          not: null
        },
        interventionId
      }),
      orderBy: [{ triageScore: "desc" }, { updatedAt: "desc" }],
      select: LOCAL_BENEFIT_DISCOVERY_CANDIDATE_SELECT
    }),
    prisma.intervention.findMany({
      select: LOCAL_BENEFIT_DISCOVERY_INTERVENTION_SELECT
    })
  ]);
  const knownCluster = readout.clusters.find((cluster) => cluster.clusterKey === clusterKey);
  const interventionTerms = buildLocalBenefitDiscoveryInterventionTerms(interventions);
  let builder: LocalBenefitDiscoveryClusterBuilder | undefined;

  for (const candidate of candidateRows) {
    const processing = readLocalAcceptedCandidateProcessingMetadata(candidate.metadata);
    const decision = readLocalBenefitDiscoveryDecisionMetadata(candidate.metadata);

    if (!processing?.needsClaim || decision || !candidate.interventionId || !candidate.intervention) {
      continue;
    }

    if (!localBenefitDiscoveryClusterOutcomes(candidate).includes(outcome)) {
      continue;
    }

    const mismatch = localBenefitDiscoveryMismatch(candidate, interventionTerms);
    builder ??= localBenefitDiscoveryClusterBuilder(candidate, outcome, clusterKey);
    builder.candidates.push({
      candidate,
      identityCautions: mismatch.cautions,
      mismatchReasons: mismatch.reasons,
      sourceTypeSuggestion:
        processing.sourceTypeSuggestion ?? localAcceptedCandidateSourceTypeSuggestion(candidate)
    });
  }

  if (!builder || builder.candidates.length === 0) {
    throw new Error(
      knownCluster
        ? "Benefit discovery cluster has already been decided."
        : "Benefit discovery cluster was not found."
    );
  }

  return builder;
}

async function createLocalBenefitDiscoveryDraftClaim(
  cluster: LocalBenefitDiscoveryClusterBuilder
) {
  const claimText = `${cluster.interventionName} has accepted source leads for ${cluster.outcomeLabel.toLowerCase()} that need structured evidence review.`;
  const existingClaim = await prisma.claim.findUnique({
    where: {
      interventionId_outcome_claimText: {
        claimText,
        interventionId: cluster.interventionId,
        outcome: cluster.outcome
      }
    }
  });
  const claim =
    existingClaim ??
    (await prisma.claim.create({
      data: {
        applicabilityNotes:
          "Local discovery draft only. Verify population, dose/form, comparator, outcome, and source quality before public wording.",
        claimText,
        clinicalRelevance:
          "Unknown until the accepted sources are reviewed and structured extraction is completed.",
        comparator: "Manual review required",
        confidenceLevel: DbConfidenceLevel.VERY_LOW,
        doseFormStudied: "Manual review required",
        durationStudied: "Manual review required",
        effectSize: "Unknown",
        effectSizeScore: 1,
        evidenceDirectnessScore: 2,
        evidenceGrade: "Draft lead",
        evidenceRigorScore: 2,
        finalLabel: DbEvidenceLabel.INSUFFICIENT_EVIDENCE,
        hypePenalty: 2,
        interventionId: cluster.interventionId,
        measurabilityScore: 4,
        momentum: DbEvidenceMomentum.STABLE,
        outcome: cluster.outcome,
        populationStudied: "Manual review required",
        productQualityScore: 3,
        regulatoryRiskScore: 5,
        reviewStatus: "UNREVIEWED_AI_DRAFT",
        safetyNotes:
          "Safety and interaction evidence were not reviewed by this draft action.",
        safetyScore: 5,
        summary:
          "Draft local discovery claim created from accepted source candidates. Not medical advice and not a reviewed evidence conclusion.",
        uncertainty:
          "Candidate clustering is heuristic; source relevance, intervention identity, and outcome fit require review.",
        whatWouldChangeScore:
          "Review top accepted sources, extract structured study fields, confirm intervention identity, and update scores only after source review."
      }
    }));

  return {
    claim,
    created: !existingClaim
  };
}

async function findLocalBenefitDiscoveryExistingClaim(
  cluster: LocalBenefitDiscoveryClusterBuilder
) {
  const claim = await prisma.claim.findFirst({
    where: {
      interventionId: cluster.interventionId,
      outcome: cluster.outcome
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }]
  });

  if (!claim) {
    throw new Error("No existing claim exists for this supplement and benefit area.");
  }

  return {
    claim,
    created: false
  };
}

async function markLocalBenefitDiscoveryCandidates(
  candidates: LocalBenefitDiscoveryClusterBuilder["candidates"],
  input: {
    action: LocalBenefitDiscoveryAction;
    claimId?: string;
    clusterKey: string;
    status:
      | "claim-drafted"
      | "linked-existing-claim"
      | "parked"
      | "rejected"
      | "skipped-mismatch";
  }
) {
  for (const item of candidates) {
    await prisma.sourceCandidate.update({
      where: {
        dedupeKey: item.candidate.dedupeKey
      },
      data: {
        metadata: writeLocalBenefitDiscoveryDecisionMetadata(item.candidate.metadata, input)
      }
    });
  }
}

async function processLocalAcceptedCandidate(
  candidate: Prisma.SourceCandidateGetPayload<{
    select: typeof LOCAL_ACCEPTED_CANDIDATE_PROCESS_SELECT;
  }>
) {
  let linkedClaim = false;

  if (candidate.claimId) {
    await linkAcceptedSourceCandidateClaim({
      dedupeKey: candidate.dedupeKey,
      note: `Accepted local source candidate ${candidate.externalId}: ${candidate.title}`,
      relevance: 5
    });
    linkedClaim = true;
  }

  return markLocalAcceptedCandidateProcessing(candidate, {
    linkedClaim
  });
}

async function markLocalAcceptedCandidateProcessing(
  candidate: Prisma.SourceCandidateGetPayload<{
    select: typeof LOCAL_ACCEPTED_CANDIDATE_PROCESS_SELECT;
  }>,
  options: {
    error?: string;
    linkedClaim: boolean;
  }
): Promise<LocalAcceptedCandidateProcessingResultReadout> {
  const outcomeSuggestions = localAcceptedCandidateOutcomeSuggestions(candidate);
  const knownOutcomes = new Set(candidate.intervention?.claims.map((claim) => claim.outcome));
  const novelOutcomes = outcomeSuggestions.filter(
    (suggestion) => !knownOutcomes.has(suggestion.outcome)
  );
  const processedAt = new Date().toISOString();
  const sourceTypeSuggestion = localAcceptedCandidateSourceTypeSuggestion(candidate);
  const nextAction = localAcceptedCandidateNextAction({
    candidate,
    error: options.error,
    linkedClaim: options.linkedClaim,
    novelOutcomeLabels: novelOutcomes.map((suggestion) => suggestion.label),
    outcomeLabels: outcomeSuggestions.map((suggestion) => suggestion.label)
  });
  const processing = {
    error: options.error,
    linkedClaim: options.linkedClaim,
    needsClaim: !candidate.claimId,
    nextAction,
    novelOutcomes: novelOutcomes.map((suggestion) => ({
      label: suggestion.label,
      outcome: suggestion.outcome
    })),
    outcomeSuggestions: outcomeSuggestions.map((suggestion) => ({
      label: suggestion.label,
      outcome: suggestion.outcome,
      score: suggestion.score
    })),
    processedAt,
    referenceId: candidate.acceptedReferenceId,
    sourceTypeSuggestion,
  };

  const updated = await prisma.sourceCandidate.update({
    where: {
      dedupeKey: candidate.dedupeKey
    },
    data: {
      metadata: writeLocalAcceptedCandidateProcessingMetadata(candidate.metadata, processing)
    },
    select: LOCAL_ACCEPTED_CANDIDATE_PROCESS_SELECT
  });

  return localAcceptedCandidateProcessingReadout(updated);
}

function localQueuedJobReadout(
  job: QueuedSourceCandidateIngestionJob
): LocalIngestionQueuedJobReadout {
  return {
    claimId: job.claimId,
    created: job.created,
    interventionId: job.interventionId,
    jobId: job.jobId,
    query: job.query,
    region: job.region,
    source: job.source,
    status: job.status
  };
}

function localCandidateReviewCandidateReadout(
  candidate: Prisma.SourceCandidateGetPayload<{
    select: typeof LOCAL_CANDIDATE_REVIEW_SELECT;
  }>
): LocalCandidateReviewCandidateReadout {
  return {
    claimId: candidate.claimId ?? undefined,
    decision: candidate.decision,
    dedupeKey: candidate.dedupeKey,
    discoveryClassification: readSourceCandidateDiscoveryClassification(candidate.metadata),
    discoveredAt: candidate.discoveredAt.toISOString(),
    externalId: candidate.externalId,
    interventionId: candidate.interventionId ?? undefined,
    interventionName: candidate.intervention?.name,
    publishedYear: candidate.publishedYear ?? undefined,
    query: candidate.query,
    reviewStatus: candidate.reviewStatus,
    source: candidate.source,
    sourceType: candidate.sourceType ?? undefined,
    title: candidate.title,
    triageScore: candidate.triageScore,
    url: candidate.url
  };
}

async function getLocalCandidateReviewReadoutByDedupeKey(
  dedupeKey: string
): Promise<LocalCandidateReviewCandidateReadout> {
  const candidate = await prisma.sourceCandidate.findUnique({
    where: {
      dedupeKey
    },
    select: LOCAL_CANDIDATE_REVIEW_SELECT
  });

  if (!candidate) {
    throw new Error("Reviewed source candidate could not be reloaded.");
  }

  return localCandidateReviewCandidateReadout(candidate);
}

function localAcceptedCandidateProcessingReadout(
  candidate: Prisma.SourceCandidateGetPayload<{
    select: typeof LOCAL_ACCEPTED_CANDIDATE_PROCESS_SELECT;
  }>
): LocalAcceptedCandidateProcessingResultReadout {
  const processing = readLocalAcceptedCandidateProcessingMetadata(candidate.metadata);
  const outcomeSuggestions = localAcceptedCandidateOutcomeSuggestions(candidate);
  const knownOutcomes = new Set(candidate.intervention?.claims.map((claim) => claim.outcome));
  const novelOutcomeLabels = outcomeSuggestions
    .filter((suggestion) => !knownOutcomes.has(suggestion.outcome))
    .map((suggestion) => suggestion.label);
  const outcomeLabels = processing?.outcomeLabels ?? outcomeSuggestions.map((item) => item.label);

  return {
    acceptedReferenceId: candidate.acceptedReferenceId ?? undefined,
    claimId: candidate.claimId ?? undefined,
    dedupeKey: candidate.dedupeKey,
    externalId: candidate.externalId,
    interventionName: candidate.intervention?.name,
    linkedClaim: processing?.linkedClaim ?? Boolean(candidate.claimId),
    nextAction:
      processing?.nextAction ??
      localAcceptedCandidateNextAction({
        candidate,
        linkedClaim: Boolean(candidate.claimId),
        novelOutcomeLabels,
        outcomeLabels
      }),
    novelOutcomeLabels: processing?.novelOutcomeLabels ?? novelOutcomeLabels,
    outcomeLabels,
    processedAt: processing?.processedAt,
    source: candidate.source,
    sourceTypeSuggestion:
      processing?.sourceTypeSuggestion ?? localAcceptedCandidateSourceTypeSuggestion(candidate),
    title: candidate.title,
    url: candidate.url
  };
}

function localBenefitDiscoveryClusterOutcomes(
  candidate: LocalBenefitDiscoveryCandidate
): DbOutcomeArea[] {
  const processing = readLocalAcceptedCandidateProcessingMetadata(candidate.metadata);

  if (!processing) {
    return [];
  }

  const novelOutcomes = localBenefitDiscoveryOutcomeValues(processing.novelOutcomes);

  if (novelOutcomes.length > 0) {
    return novelOutcomes.slice(0, 3);
  }

  return localBenefitDiscoveryOutcomeValues(processing.outcomeSuggestions).slice(0, 2);
}

function localBenefitDiscoveryOutcomeValues(
  value: LocalAcceptedCandidateProcessingOutcomeMetadata[]
): DbOutcomeArea[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => {
          return normaliseDbOutcomeArea(item.outcome);
        })
        .filter((item): item is DbOutcomeArea => Boolean(item))
    )
  );
}

function normaliseDbOutcomeArea(value: unknown): DbOutcomeArea | undefined {
  return typeof value === "string" && value in DbOutcomeArea
    ? (value as DbOutcomeArea)
    : undefined;
}

function buildLocalBenefitDiscoveryInterventionTerms(
  interventions: LocalBenefitDiscoveryIntervention[]
) {
  return interventions.map((intervention) => ({
    id: intervention.id,
    name: intervention.name,
    terms: Array.from(
      new Set([intervention.name, ...intervention.synonyms].map(localBenefitDiscoveryTerm))
    ).filter((term) => term.length >= 3)
  }));
}

function localBenefitDiscoveryMismatch(
  candidate: LocalBenefitDiscoveryIdentityCandidate,
  interventionTerms: Array<{
    id: string;
    name: string;
    terms: string[];
  }>
) {
  const targetTerms = interventionTerms.find(
    (intervention) => intervention.id === candidate.interventionId
  );
  const identityResolution = readLocalIdentityResolutionMetadata(candidate.metadata);
  const sourceText = localBenefitDiscoverySourceIdentityText(candidate);
  const targetTermValues = targetTerms?.terms ?? [];
  const contextMismatch = localBenefitDiscoveryInterventionContextMismatch({
    interventionId: candidate.interventionId,
    sourceText,
    targetTerms: targetTermValues
  });
  const targetVisible =
    !contextMismatch &&
    (identityResolution?.status === "confirmed-target" ||
      Boolean(targetTermValues.some((term) => localBenefitDiscoveryContainsTerm(sourceText, term))));
  const otherMatches = interventionTerms
    .filter((intervention) => intervention.id !== candidate.interventionId)
    .filter((intervention) =>
      intervention.terms.some((term) => localBenefitDiscoveryContainsTerm(sourceText, term))
    )
    .map((intervention) => ({
      id: intervention.id,
      name: intervention.name
    }))
    .slice(0, 3);
  const cautions: string[] = [];
  const reasons: string[] = [];

  if (contextMismatch) {
    reasons.push(contextMismatch);
  } else if (!targetVisible) {
    reasons.push("Target supplement is not visible in captured title/source metadata.");
  }

  if (otherMatches.length > 0) {
    const names = otherMatches.map((intervention) => intervention.name).join(", ");

    if (targetVisible) {
      cautions.push(`Also mentions tracked intervention(s): ${names}.`);
    } else {
      reasons.push(`Captured source appears to mention: ${names}.`);
    }
  }

  return {
    cautions,
    otherMatches,
    reasons,
    targetVisible
  };
}

function localBenefitDiscoverySourceIdentityText(candidate: LocalBenefitDiscoveryIdentityCandidate) {
  const metadata = sourceCandidateMetadataObject(candidate.metadata);
  const parts = [
    candidate.title,
    candidate.sourceType,
    sourceCandidateMetadataString(metadata, "abstractText"),
    sourceCandidateMetadataString(metadata, "briefSummary"),
    ...sourceCandidateMetadataStringArray(metadata.conditions),
    ...sourceCandidateMetadataStringArray(metadata.interventions),
    ...sourceCandidateMetadataStringArray(metadata.primaryOutcomes)
  ].filter((value): value is string => Boolean(value));

  return localBenefitDiscoveryTerm(parts.join(" "));
}

function localBenefitDiscoveryTerm(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function localBenefitDiscoveryContainsTerm(sourceText: string, term: string) {
  if (!term) {
    return false;
  }

  return ` ${sourceText} `.includes(` ${term} `);
}

export function localBenefitDiscoveryInterventionContextMismatch({
  interventionId,
  sourceText,
  targetTerms
}: {
  interventionId?: string | null;
  sourceText: string;
  targetTerms?: string[];
}) {
  if (!interventionId) {
    return undefined;
  }

  const rule = LOCAL_BENEFIT_DISCOVERY_CONTEXT_RULES[interventionId];

  if (!rule) {
    return undefined;
  }

  const normalizedSourceText = localBenefitDiscoveryTerm(sourceText);
  const normalizedTargetTerms = (targetTerms ?? [])
    .map(localBenefitDiscoveryTerm)
    .filter((term) => term.length > 0);
  const targetVisible = normalizedTargetTerms.some((term) =>
    localBenefitDiscoveryContainsTerm(normalizedSourceText, term)
  );

  if (!targetVisible) {
    return undefined;
  }

  const supplementContext = localBenefitDiscoveryHasSupplementContext(
    normalizedSourceText,
    normalizedTargetTerms,
    rule.supplementTerms
  );
  const trapTerm = rule.trapTerms
    .map(localBenefitDiscoveryTerm)
    .find((term) => localBenefitDiscoveryContainsTerm(normalizedSourceText, term));

  if (trapTerm && !supplementContext) {
    return `Target supplement term appears in a non-supplement source context: ${trapTerm}.`;
  }

  if (rule.requireSupplementContext && !supplementContext) {
    return "Target supplement term appears without supplementation, intake, or formulation context.";
  }

  return undefined;
}

function localBenefitDiscoveryHasSupplementContext(
  sourceText: string,
  targetTerms: string[],
  supplementTerms: string[]
) {
  if (
    supplementTerms
      .map(localBenefitDiscoveryTerm)
      .some((term) => localBenefitDiscoveryContainsTerm(sourceText, term))
  ) {
    return true;
  }

  return localBenefitDiscoveryHasNearbySupplementContext(sourceText, targetTerms);
}

function localBenefitDiscoveryHasNearbySupplementContext(
  sourceText: string,
  targetTerms: string[]
) {
  const tokens = sourceText.split(" ").filter(Boolean);
  const contextTokens = new Set([
    "administered",
    "administration",
    "dietary",
    "dose",
    "doses",
    "dosing",
    "ingested",
    "ingestion",
    "intake",
    "oral",
    "supplement",
    "supplemental",
    "supplementation",
    "supplements"
  ]);

  for (const targetTerm of targetTerms) {
    const targetTokens = targetTerm.split(" ").filter(Boolean);

    if (targetTokens.length === 0) {
      continue;
    }

    for (let index = 0; index <= tokens.length - targetTokens.length; index += 1) {
      if (!targetTokens.every((token, offset) => tokens[index + offset] === token)) {
        continue;
      }

      const start = Math.max(0, index - 4);
      const end = Math.min(tokens.length, index + targetTokens.length + 5);

      if (tokens.slice(start, end).some((token) => contextTokens.has(token))) {
        return true;
      }
    }
  }

  return false;
}

function localIdentityResolutionContainsLooseTerm(sourceText: string, term: string) {
  if (localBenefitDiscoveryContainsTerm(sourceText, term)) {
    return true;
  }

  const compactSource = sourceText.replace(/\s+/g, "");
  const compactTerm = term.replace(/\s+/g, "");

  if (compactTerm.length >= 4 && compactSource.includes(compactTerm)) {
    return true;
  }

  if (
    localBenefitDiscoveryContainsTerm(sourceText, "omega") &&
    localBenefitDiscoveryContainsTerm(sourceText, "3") &&
    localBenefitDiscoveryContainsTerm(term, "omega") &&
    localBenefitDiscoveryContainsTerm(term, "3")
  ) {
    return true;
  }

  const tokens = term
    .split(" ")
    .filter((token) => token.length > 1 && !LOCAL_IDENTITY_GENERIC_TOKENS.has(token));

  if (tokens.length === 1 && localIdentityResolutionContainsTokenVariant(sourceText, tokens[0])) {
    return true;
  }

  if (
    tokens.length >= 2 &&
    tokens.every((token) => token.length >= 5) &&
    tokens.every((token) => localIdentityResolutionContainsTokenVariant(sourceText, token))
  ) {
    return true;
  }

  if (
    term.includes(" and ") &&
    tokens.some((token) => token.length >= 5 && localBenefitDiscoveryContainsTerm(sourceText, token))
  ) {
    return true;
  }

  return false;
}

function localIdentityResolutionContainsTokenVariant(sourceText: string, token: string) {
  return (
    token.length >= 6 &&
    (localBenefitDiscoveryContainsTerm(sourceText, token) ||
      localBenefitDiscoveryContainsTerm(sourceText, `${token}s`) ||
      (token.endsWith("s") &&
        localBenefitDiscoveryContainsTerm(sourceText, token.slice(0, -1))))
  );
}

const LOCAL_IDENTITY_GENERIC_TOKENS = new Set([
  "acid",
  "acids",
  "and",
  "blend",
  "extract",
  "protein",
  "proteins",
  "supplement",
  "supplementation"
]);

function localBenefitDiscoverySourceWeight(sourceTypeSuggestion: string) {
  const sourceType = sourceTypeSuggestion.toLowerCase();

  if (sourceType.includes("meta-analysis")) {
    return 90;
  }

  if (sourceType.includes("systematic")) {
    return 80;
  }

  if (sourceType.includes("randomized")) {
    return 70;
  }

  if (sourceType.includes("clinical trial")) {
    return 55;
  }

  if (sourceType.includes("observational")) {
    return 35;
  }

  return 20;
}

function localBenefitDiscoveryOutcomeLabel(outcome: DbOutcomeArea) {
  return (
    LOCAL_ACCEPTED_OUTCOME_KEYWORDS.find((item) => item.outcome === outcome)?.label ??
    outcome.replace(/_/g, " ").toLowerCase()
  );
}

function localBenefitDiscoveryClusterKey({
  interventionId,
  outcome
}: {
  interventionId: string | null;
  outcome: DbOutcomeArea;
}) {
  return `${interventionId ?? ""}::${outcome}`;
}

function parseBenefitDiscoveryClusterKey(clusterKey: string) {
  const [interventionId, outcomeValue] = clusterKey.split("::");
  const outcome = normaliseDbOutcomeArea(outcomeValue);

  if (!interventionId || !outcome) {
    throw new Error("Benefit discovery cluster key is invalid.");
  }

  return {
    interventionId,
    outcome
  };
}

function localAcceptedCandidateWhere(
  extra: Prisma.SourceCandidateWhereInput = {}
): Prisma.SourceCandidateWhereInput {
  return {
    decision: DbSourceCandidateDecision.ACCEPTED,
    source: {
      in: LOCAL_SUPPORTED_SOURCES
    },
    ...extra
  };
}

function localAcceptedCandidateProcessedWhere(): Prisma.SourceCandidateWhereInput {
  return localAcceptedCandidateWhere({
    metadata: {
      path: ["localAcceptedProcessing", "version"],
      equals: LOCAL_ACCEPTED_PROCESSING_METADATA_VERSION
    }
  });
}

function localAcceptedCandidateOutcomeSuggestions(candidate: {
  metadata: unknown;
  query: string;
  sourceType: string | null;
  title: string;
}) {
  const searchableText = localAcceptedCandidateSearchableText(candidate);

  return LOCAL_ACCEPTED_OUTCOME_KEYWORDS.map((entry) => ({
    label: entry.label,
    outcome: entry.outcome,
    score: entry.terms.reduce(
      (score, term) => score + (searchableText.includes(term) ? 1 : 0),
      0
    )
  }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label))
    .slice(0, 4);
}

function localAcceptedCandidateSearchableText(candidate: {
  metadata: unknown;
  query: string;
  sourceType: string | null;
  title: string;
}) {
  const metadata = sourceCandidateMetadataObject(candidate.metadata);
  const parts = [
    candidate.title,
    candidate.query,
    candidate.sourceType,
    sourceCandidateMetadataString(metadata, "abstractText"),
    sourceCandidateMetadataString(metadata, "briefSummary"),
    ...sourceCandidateMetadataStringArray(metadata.authors),
    ...sourceCandidateMetadataStringArray(metadata.conditions),
    ...sourceCandidateMetadataStringArray(metadata.primaryOutcomes),
    ...sourceCandidateMetadataStringArray(metadata.publicationTypes)
  ].filter((value): value is string => Boolean(value));

  return parts.join(" ").toLowerCase();
}

function localAcceptedCandidateSourceTypeSuggestion(candidate: {
  source: DbSourceKind;
  sourceType: string | null;
  metadata: unknown;
}) {
  if (candidate.source === DbSourceKind.CLINICALTRIALS_GOV) {
    return "Clinical trial record";
  }

  const metadata = sourceCandidateMetadataObject(candidate.metadata);
  const sourceText = [
    candidate.sourceType,
    ...sourceCandidateMetadataStringArray(metadata.publicationTypes)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (sourceText.includes("meta-analysis")) {
    return "Meta-analysis";
  }

  if (sourceText.includes("systematic review")) {
    return "Systematic review";
  }

  if (sourceText.includes("randomized") || sourceText.includes("clinical trial")) {
    return "Randomized controlled trial";
  }

  if (sourceText.includes("review")) {
    return "Review";
  }

  if (sourceText.includes("observational") || sourceText.includes("cohort")) {
    return "Observational study";
  }

  return "Manual source-type review";
}

function localAcceptedCandidateNextAction({
  candidate,
  error,
  linkedClaim,
  novelOutcomeLabels,
  outcomeLabels
}: {
  candidate: {
    claimId: string | null;
  };
  error?: string;
  linkedClaim: boolean;
  novelOutcomeLabels: string[];
  outcomeLabels: string[];
}) {
  if (error) {
    return `Manual cleanup needed: ${error}`;
  }

  if (linkedClaim) {
    return "Claim reference linked; extract structured study fields after source review.";
  }

  if (candidate.claimId) {
    return "Candidate already has a scoped claim; retry claim-reference linking.";
  }

  if (novelOutcomeLabels.length > 0) {
    return `Draft or link claim for novel benefit area: ${novelOutcomeLabels.join(", ")}.`;
  }

  if (outcomeLabels.length > 0) {
    return `Link to an existing claim or draft a more specific claim: ${outcomeLabels.join(", ")}.`;
  }

  return "Review title/abstract to choose the best claim or outcome area.";
}

function normaliseCandidateReviewFilters(
  input: LocalCandidateReviewWorkbenchInput
): LocalCandidateReviewWorkbenchReadout["filters"] {
  return {
    bucket: normaliseCandidateReviewBucket(input.bucket),
    interventionId: optionalString(input.interventionId),
    limit: normaliseReviewLimit(input.limit),
    q: optionalString(input.q),
    source: normaliseCandidateReviewSource(input.source),
    studyFilter: normaliseCandidateReviewStudyFilter(input.studyFilter)
  };
}

function localCandidateReviewWhere(
  filters: LocalCandidateReviewWorkbenchReadout["filters"]
): Prisma.SourceCandidateWhereInput {
  const where: Prisma.SourceCandidateWhereInput = {
    decision: DbSourceCandidateDecision.PENDING_REVIEW,
    source:
      filters.source === "ALL"
        ? {
            in: LOCAL_SUPPORTED_SOURCES
          }
        : filters.source
  };
  const andFilters = [
    localCandidateReviewBucketWhere(filters.bucket),
    localCandidateReviewStudyFilterWhere(filters.studyFilter),
    localCandidateReviewSearchWhere(filters.q)
  ].filter((filter): filter is Prisma.SourceCandidateWhereInput =>
    Boolean(filter && Object.keys(filter).length > 0)
  );

  if (filters.interventionId) {
    where.interventionId = filters.interventionId;
  }

  if (andFilters.length > 0) {
    where.AND = andFilters;
  }

  return where;
}

async function localCandidateReviewActiveWhere(
  filters: LocalCandidateReviewWorkbenchReadout["filters"]
): Promise<Prisma.SourceCandidateWhereInput> {
  const where = localCandidateReviewWhere(filters);
  const parkedKeys = await listLocalCandidateReviewParkedResearchKeys(filters);

  if (parkedKeys.length === 0) {
    return where;
  }

  return andLocalCandidateReviewWhere(where, {
    dedupeKey: {
      notIn: parkedKeys
    }
  });
}

function localCandidateReviewParkedResearchWhere(
  filters: LocalCandidateReviewWorkbenchReadout["filters"]
): Prisma.SourceCandidateWhereInput {
  return {
    AND: [
      localCandidateReviewWhere(filters),
      localCandidateReviewParkedResearchDispositionWhere()
    ]
  };
}

async function listLocalCandidateReviewParkedResearchKeys(
  filters: LocalCandidateReviewWorkbenchReadout["filters"]
) {
  const rows = await prisma.sourceCandidate.findMany({
    where: localCandidateReviewParkedResearchWhere(filters),
    select: {
      dedupeKey: true
    },
    take: LOCAL_REVIEW_BULK_MAX_CANDIDATES
  });

  return rows.map((row) => row.dedupeKey);
}

function andLocalCandidateReviewWhere(
  ...filters: Prisma.SourceCandidateWhereInput[]
): Prisma.SourceCandidateWhereInput {
  const andFilters = filters.filter((filter) => Object.keys(filter).length > 0);

  if (andFilters.length === 0) {
    return {};
  }

  if (andFilters.length === 1) {
    return andFilters[0];
  }

  return {
    AND: andFilters
  };
}

function localCandidateReviewParkedResearchDispositionWhere(): Prisma.SourceCandidateWhereInput {
  return {
    metadata: {
      path: [...SOURCE_CANDIDATE_METADATA_PATHS.candidateReviewDispositionStatus],
      equals: "parked-research"
    }
  };
}

function localCandidateReviewBucketWhere(
  bucket: LocalCandidateReviewBucket
): Prisma.SourceCandidateWhereInput {
  const bucketPath = ["discoveryClassification", "bucket"];

  switch (bucket) {
    case "all":
      return {};
    case "all-useful":
      return {
        OR: [
          { metadata: { path: bucketPath, equals: "likely-useful" } },
          { metadata: { path: bucketPath, equals: "maybe-useful" } }
        ]
      };
    case "likely-useful":
    case "maybe-useful":
    case "likely-noise":
      return {
        metadata: {
          path: bucketPath,
          equals: bucket
        }
      };
    case "unclassified":
      return {
        NOT: [
          { metadata: { path: bucketPath, equals: "likely-useful" } },
          { metadata: { path: bucketPath, equals: "maybe-useful" } },
          { metadata: { path: bucketPath, equals: "likely-noise" } }
        ]
      };
  }
}

function localCandidateReviewStudyFilterWhere(
  studyFilter: LocalCandidateReviewStudyFilter
): Prisma.SourceCandidateWhereInput {
  switch (studyFilter) {
    case "all":
      return {};
    case "results-posted":
      return {
        metadata: {
          path: ["trialResultLabel"],
          equals: "Results posted"
        }
      };
    case "reviews":
      return {
        sourceType: {
          contains: "Review",
          mode: "insensitive"
        }
      };
    case "trials":
      return {
        OR: [
          {
            source: DbSourceKind.CLINICALTRIALS_GOV
          },
          {
            sourceType: {
              contains: "Randomized",
              mode: "insensitive"
            }
          },
          {
            sourceType: {
              contains: "Clinical Trial",
              mode: "insensitive"
            }
          },
          {
            sourceType: {
              contains: "Interventional",
              mode: "insensitive"
            }
          }
        ]
      };
  }
}

function localCandidateReviewSearchWhere(
  query: string | undefined
): Prisma.SourceCandidateWhereInput {
  if (!query) {
    return {};
  }

  return {
    OR: [
      { title: { contains: query, mode: "insensitive" } },
      { query: { contains: query, mode: "insensitive" } },
      { externalId: { contains: query, mode: "insensitive" } },
      { interventionId: { contains: query, mode: "insensitive" } },
      { sourceType: { contains: query, mode: "insensitive" } }
    ]
  };
}

function localCandidateReviewIsPriorityStudy(
  candidate: {
    metadata: unknown;
    source: DbSourceKind;
    sourceType: string | null;
  },
  sourceTypeSuggestion: string
) {
  const metadata = sourceCandidateMetadataObject(candidate.metadata);
  const sourceText = localBenefitDiscoveryTerm(
    [
      sourceTypeSuggestion,
      candidate.sourceType,
      ...sourceCandidateMetadataStringArray(metadata.publicationTypes),
      sourceCandidateMetadataString(metadata, "trialResultLabel")
    ]
      .filter(Boolean)
      .join(" ")
  );

  return (
    sourceText.includes("meta analysis") ||
    sourceText.includes("systematic review") ||
    sourceText.includes("randomized") ||
    sourceText.includes("clinical trial") ||
    sourceText.includes("interventional") ||
    sourceText.includes("results posted") ||
    candidate.source === DbSourceKind.CLINICALTRIALS_GOV
  );
}

function localCandidateReviewInterventionIdentityVisible(candidate: {
  intervention?: {
    name: string;
    synonyms: string[];
  } | null;
  sourceType: string | null;
  title: string;
}) {
  const intervention = candidate.intervention;

  if (!intervention) {
    return false;
  }

  const sourceText = localBenefitDiscoveryTerm([candidate.title, candidate.sourceType].filter(Boolean).join(" "));
  const terms = [intervention.name, ...intervention.synonyms]
    .map(localBenefitDiscoveryTerm)
    .filter((term) => term.length > 0);

  return terms.some((term) => localIdentityResolutionContainsLooseTerm(sourceText, term));
}

function localCandidateReviewQueryIdentityVisible(candidate: {
  intervention?: {
    name: string;
    synonyms: string[];
  } | null;
  query: string;
}) {
  const intervention = candidate.intervention;

  if (!intervention) {
    return false;
  }

  const queryText = localBenefitDiscoveryTerm(candidate.query);
  const terms = [intervention.name, ...intervention.synonyms]
    .map(localBenefitDiscoveryTerm)
    .filter((term) => term.length > 0);

  return terms.some((term) => localIdentityResolutionContainsLooseTerm(queryText, term));
}

function normaliseCandidateReviewBucket(value: unknown): LocalCandidateReviewBucket {
  switch (optionalString(value)) {
    case "all":
      return "all";
    case "all-useful":
      return "all-useful";
    case "likely-noise":
      return "likely-noise";
    case "maybe-useful":
      return "maybe-useful";
    case "unclassified":
      return "unclassified";
    case "likely-useful":
    default:
      return "likely-useful";
  }
}

function normaliseCandidateReviewSource(value: unknown) {
  switch (optionalString(value)?.toUpperCase()) {
    case DbSourceKind.PUBMED:
      return DbSourceKind.PUBMED;
    case DbSourceKind.CLINICALTRIALS_GOV:
      return DbSourceKind.CLINICALTRIALS_GOV;
    default:
      return "ALL" as const;
  }
}

function normaliseCandidateReviewStudyFilter(
  value: unknown
): LocalCandidateReviewStudyFilter {
  switch (optionalString(value)) {
    case "reviews":
      return "reviews";
    case "trials":
      return "trials";
    case "results-posted":
      return "results-posted";
    default:
      return "all";
  }
}

function normaliseCandidateReviewBulkAction(value: unknown): LocalCandidateReviewBulkAction {
  switch (optionalString(value)) {
    case "accept-all":
      return "accept-all";
    case "accept-likely-useful":
      return "accept-likely-useful";
    case "reject-not-useful":
      return "reject-not-useful";
    default:
      throw new Error(
        "Candidate bulk action must be accept-all, accept-likely-useful, or reject-not-useful."
      );
  }
}

function normaliseCandidateReviewAutomationStrategy(
  value: unknown
): LocalCandidateReviewAutomationStrategy {
  switch (optionalString(value)) {
    case "query-backed":
      return "query-backed";
    case "strict":
    default:
      return "strict";
  }
}

function normaliseCandidateReviewSignalApplyAction(
  value: unknown
): LocalCandidateReviewSignalApplyAction {
  switch (optionalString(value)) {
    case "park-research":
      return "park-research";
    case "reject-mismatches":
      return "reject-mismatches";
    default:
      throw new Error(
        "Candidate signal cleanup action must be park-research or reject-mismatches."
      );
  }
}

function normaliseBenefitDiscoveryAction(value: unknown): LocalBenefitDiscoveryAction {
  switch (optionalString(value)) {
    case "draft-claim":
      return "draft-claim";
    case "link-existing-claim":
      return "link-existing-claim";
    case "park-lead":
      return "park-lead";
    case "reject-cluster":
      return "reject-cluster";
    default:
      throw new Error(
        "Benefit discovery action must be draft-claim, link-existing-claim, park-lead, or reject-cluster."
      );
  }
}

function normaliseBenefitDiscoveryAutomationScope(
  value: unknown
): LocalBenefitDiscoveryAutomationScope {
  switch (optionalString(value)) {
    case "all-eligible":
      return "all-eligible";
    case "batch":
    default:
      return "batch";
  }
}

function normaliseBenefitDiscoveryAutomationStrategy(
  value: unknown
): LocalBenefitDiscoveryAutomationStrategy {
  switch (optionalString(value)) {
    case "park-backlog":
      return "park-backlog";
    case "link-existing":
      return "link-existing";
    case "build-leads":
    default:
      return "build-leads";
  }
}

function normaliseBenefitDiscoveryParkThreshold(value: unknown, threshold: number) {
  const defaultValue = Math.min(
    threshold - 1,
    LOCAL_BENEFIT_DISCOVERY_EXISTING_LINK_SCORE_FLOOR
  );
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return Math.max(0, defaultValue);
  }

  return Math.min(threshold - 1, Math.max(0, Math.floor(parsed)));
}

function normaliseBenefitDiscoveryRejectThreshold(value: unknown, threshold: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  const maxValue = Math.max(0, threshold - 1);

  if (!Number.isFinite(parsed)) {
    return Math.min(
      maxValue,
      LOCAL_BENEFIT_DISCOVERY_REJECT_SCORE_THRESHOLD_DEFAULT
    );
  }

  return Math.min(maxValue, Math.max(0, Math.floor(parsed)));
}

function normaliseIdentityResolutionAction(value: unknown): LocalIdentityResolutionAction {
  switch (optionalString(value)) {
    case "confirm-target":
      return "confirm-target";
    case "reassign-intervention":
      return "reassign-intervention";
    case "reject-wrong-supplement":
      return "reject-wrong-supplement";
    case "add-synonym":
      return "add-synonym";
    default:
      throw new Error(
        "Identity resolution action must be confirm-target, reassign-intervention, reject-wrong-supplement, or add-synonym."
      );
  }
}

function normaliseIdentityResolutionAutomationStrategy(
  value: unknown
): LocalIdentityResolutionAutomationStrategy {
  switch (optionalString(value)) {
    case "source-led":
      return "source-led";
    case "strict":
    default:
      return "strict";
  }
}

function normaliseIdentityResolutionAutomationScope(
  value: unknown
): LocalIdentityResolutionAutomationScope {
  switch (optionalString(value)) {
    case "all-eligible":
      return "all-eligible";
    case "batch":
    default:
      return "batch";
  }
}

function normaliseCandidateReviewDecision(value: unknown): "Accepted" | "Rejected" {
  const decision = optionalString(value)?.toLowerCase();

  if (decision === "accepted" || decision === "accept") {
    return "Accepted";
  }

  if (decision === "rejected" || decision === "reject") {
    return "Rejected";
  }

  throw new Error("Candidate review decision must be Accepted or Rejected.");
}

function localCandidateReferenceIdentifier(candidate: {
  externalId: string;
  source: DbSourceKind;
}) {
  if (candidate.source === DbSourceKind.PUBMED) {
    const pmid = candidate.externalId.match(/\d+/)?.[0] ?? candidate.externalId;

    return `PMID: ${pmid}`;
  }

  if (candidate.source === DbSourceKind.CLINICALTRIALS_GOV) {
    return candidate.externalId.toUpperCase();
  }

  return candidate.externalId;
}

function localIngestionSynonymSearchTerms(intervention: {
  name: string;
  synonyms: string[];
}) {
  const seen = new Set([normaliseLocalIngestionSearchTerm(intervention.name)]);
  const terms: string[] = [];

  for (const synonym of intervention.synonyms) {
    const trimmed = synonym.trim();
    const key = normaliseLocalIngestionSearchTerm(trimmed);

    if (!trimmed || !key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    terms.push(trimmed);
  }

  return terms;
}

function normaliseLocalIngestionSearchTerm(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function normaliseRequiredString(value: unknown, message: string) {
  const normalised = optionalString(value);

  if (!normalised) {
    throw new Error(message);
  }

  return normalised;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalised = optionalString(value)?.toLowerCase();

  return normalised === "1" || normalised === "true" || normalised === "yes";
}

function emptyJobCounts(): LocalIngestionJobCounts {
  return {
    [DbIngestionStatus.FAILED]: 0,
    [DbIngestionStatus.QUEUED]: 0,
    [DbIngestionStatus.RUNNING]: 0,
    [DbIngestionStatus.SKIPPED]: 0,
    [DbIngestionStatus.SUCCEEDED]: 0
  };
}

function emptyCandidateDecisionCounts(): LocalCandidateDecisionCounts {
  return {
    [DbSourceCandidateDecision.ACCEPTED]: 0,
    [DbSourceCandidateDecision.PENDING_REVIEW]: 0,
    [DbSourceCandidateDecision.REJECTED]: 0
  };
}
