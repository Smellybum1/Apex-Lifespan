export type InterventionCategory =
  | "Vitamin/mineral"
  | "Fatty acid"
  | "Amino acid"
  | "Botanical/herbal"
  | "Fiber/prebiotic/probiotic"
  | "Ergogenic/performance supplement"
  | "Nootropic"
  | "Hormonal/endocrine intervention"
  | "Peptide/biologic"
  | "Drug/geroprotector watchlist"
  | "Food/beverage";

export type OutcomeArea =
  | "Mortality/lifespan"
  | "Cardiovascular events"
  | "LDL/ApoB/lipids"
  | "Blood pressure"
  | "Glucose/insulin/HbA1c"
  | "Inflammation"
  | "Cognition"
  | "Sleep"
  | "Mood/stress"
  | "Muscle/strength"
  | "VO2 max/endurance"
  | "Joint/tendon/skin"
  | "Eye health"
  | "Immune/respiratory"
  | "Fertility/hormones"
  | "Biological aging clocks"
  | "Safety/adverse effects";

export type EvidenceLabel =
  | "Core Evidence-Based"
  | "Conditional / Biomarker-Gated"
  | "Useful for Specific Use Case"
  | "Reasonable N-of-1 Experiment"
  | "Speculative Watchlist"
  | "Safety Concern"
  | "Avoid / Not Recommended"
  | "Requires Clinician Oversight"
  | "Regulatory Concern"
  | "Insufficient Evidence";

export type EvidenceMomentum =
  | "Increasing"
  | "Stable"
  | "Conflicting"
  | "Weakening"
  | "Safety concern emerging";

/**
 * Three-way, and the middle value is the point: automation may write evidence,
 * but it may never claim a human confirmed it. "AI reviewed" is what every
 * automated pipeline stamps; "Human reviewed" requires explicit human sign-off.
 * Any check asking "has anyone looked at this" must treat the first value as
 * the only unreviewed one — see `hasBeenReviewed` / `isHumanConfirmed` in
 * `@/lib/review-status`.
 */
export type ReviewStatus = "Unreviewed AI draft" | "AI reviewed" | "Human reviewed";

export type ConfidenceLevel = "High" | "Moderate" | "Low" | "Very low";

export type SourceCandidateSource = "PubMed" | "ClinicalTrials.gov";

export type SourceCandidateDecision = "Pending review" | "Accepted" | "Rejected";

export type SourceTypeTaxonomy =
  | "RCT"
  | "meta-analysis"
  | "systematic review"
  | "narrative review"
  | "position stand"
  | "guideline"
  | "observational study"
  | "case report"
  | "animal study"
  | "in vitro/mechanistic"
  | "regulatory warning"
  | "unclassified";

export type AustraliaRegulatoryKind =
  | "AUST L"
  | "AUST L(A)"
  | "AUST R"
  | "Not in ARTG"
  | "Unapproved"
  | "Exempt"
  | "Excluded"
  | "Unknown";

export interface ScoreSet {
  evidenceDirectness: number;
  evidenceRigor: number;
  effectSize: number;
  safety: number;
  regulatoryRisk: number;
  productQuality: number;
  hypePenalty: number;
  measurability: number;
}

export interface Reference {
  id: string;
  title: string;
  source: string;
  identifier?: string;
  year?: number;
  url: string;
}

export interface Intervention {
  id: string;
  name: string;
  slug: string;
  synonyms: string[];
  category: InterventionCategory;
  commonForms: string[];
  regulatoryStatus: string;
  safetySummary: string;
  interactionSummary: string;
  evidenceSummary: string;
  lastReviewed: string;
}

export interface Claim {
  id: string;
  interventionId: string;
  outcome: OutcomeArea;
  claimText: string;
  populationStudied: string;
  doseFormStudied: string;
  durationStudied: string;
  comparator: string;
  evidenceGrade: string;
  effectSize: string;
  clinicalRelevance: string;
  confidenceLevel: ConfidenceLevel;
  safetyNotes: string;
  applicabilityNotes: string;
  summary?: string;
  uncertainty?: string;
  doesNotProve?: string[];
  keyReferenceIds: string[];
  scores: ScoreSet;
  finalLabel: EvidenceLabel;
  momentum: EvidenceMomentum;
  reviewStatus: ReviewStatus;
  lastUpdated: string;
  whatWouldChangeScore: string;
}

export interface Study {
  id: string;
  title: string;
  year: number;
  source: string;
  studyType:
    | "Meta-analysis"
    | "Systematic review"
    | "Randomized controlled trial"
    | "Observational cohort"
    | "Case report"
    | "Animal study"
    | "In vitro/mechanistic"
    | "Clinical trial record"
    | "Regulatory safety warning"
    /** No design could be established from the source metadata. Carries rigor 0. */
    | "Unclassified";
  sourceTypeTaxonomy?: SourceTypeTaxonomy;
  abstract?: string;
  dose?: string;
  duration?: string;
  mainResults?: string;
  sampleSize: string;
  population: string;
  intervention: string;
  outcomes: string[];
  adverseEvents: string;
  fundingConflicts: string;
  riskOfBias: string;
  referenceId: string;
}

export interface SourceCandidate {
  dedupeKey: string;
  source: SourceCandidateSource;
  externalId: string;
  query: string;
  region: string;
  title: string;
  url: string;
  publishedYear?: number;
  sourceType?: string;
  abstractAvailable?: boolean;
  triageScore: number;
  triageReasons: string[];
  decision: SourceCandidateDecision;
  reviewStatus: ReviewStatus;
  interventionId?: string;
  claimId?: string;
  ingestionJobId?: string;
  acceptedReferenceId?: string;
  reviewedAt?: string;
  reviewNote?: string;
  metadata: Record<string, unknown>;
}

export interface TrialWatchItem {
  id: string;
  interventionId: string;
  title: string;
  status: "Recruiting" | "Active" | "Completed" | "Terminated" | "Results pending";
  phase: string;
  enrollment: string;
  lastUpdateDate: string;
  evidenceImpact: EvidenceMomentum;
  url: string;
  briefSummary?: string;
  conditions?: string[];
  nctId?: string;
  primaryOutcomes?: string[];
  registeredInterventions?: string[];
  resultsPosted?: boolean;
}

export interface SafetyAlert {
  id: string;
  interventionId: string;
  region: string;
  source: string;
  date: string;
  alertType:
    | "Liver injury"
    | "Kidney risk"
    | "Contamination"
    | "Adulteration"
    | "Mislabeling"
    | "Prohibited in sport"
    | "Prescription-only"
    | "Unapproved therapeutic good"
    | "Compounding restriction"
    | "Drug interaction";
  severity: "Low" | "Moderate" | "High" | "Clinician review recommended" | "Avoid";
  summary: string;
  url: string;
  lastChecked: string;
}

export interface ProductSignal {
  id: string;
  name: string;
  brand: string;
  ingredients: string[];
  proprietaryBlend: boolean;
  certifications: string[];
  region: string;
  qualityScore: number;
  labelClaimRiskScore: number;
}

export interface AustraliaRegulatoryStatus {
  id: string;
  interventionId?: string;
  productId?: string;
  referenceId?: string;
  region: "AU";
  kind: AustraliaRegulatoryKind;
  artgId?: string;
  austNumber?: string;
  sponsor?: string;
  status: string;
  efficacyAssessed?: boolean;
  preMarketAssessment?: boolean;
  supplySummary: string;
  evidenceRequirement: string;
  sourceUrl: string;
  checkedAt: string;
  notes: string;
}

export interface NormalizedSourcePacketRow {
  claimId: string;
  current: boolean;
  extractedReferenceCount?: number;
  missingReferenceCount?: number;
  pendingReferenceCount?: number;
  referenceIds: string[];
  reviewStatus: ReviewStatus;
  sourcePacketId: string;
  status: "complete" | "extraction_pending" | "missing_sources" | "not_linked";
}

export interface ClaimScoreSnapshotRow {
  claimId: string;
  compositeScore: number;
  computedAt: string;
  finalLabel: EvidenceLabel;
  reviewStatus: ReviewStatus;
  scores: ScoreSet;
  scoreVersion: string;
  snapshotId: string;
}

export interface ClaimScoreHistoryRow {
  claimId: string;
  createdAt: string;
  id: string;
  newCompositeScore?: number;
  newLabel?: EvidenceLabel;
  oldCompositeScore?: number;
  oldLabel?: EvidenceLabel;
  rationale: string;
  reason: string;
}

export interface EvidenceDashboardData {
  references: Reference[];
  interventions: Intervention[];
  claims: Claim[];
  studies: Study[];
  trialWatchItems: TrialWatchItem[];
  safetyAlerts: SafetyAlert[];
  productSignals: ProductSignal[];
  australiaRegulatoryStatuses: AustraliaRegulatoryStatus[];
  normalizedSourcePackets?: NormalizedSourcePacketRow[];
  claimScoreSnapshots?: ClaimScoreSnapshotRow[];
  claimScoreHistory?: ClaimScoreHistoryRow[];
  dataSource: "database" | "seed";
  fallbackReason?: string;
}
