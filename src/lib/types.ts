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

export type ReviewStatus = "Unreviewed AI draft" | "Human reviewed";

export type ConfidenceLevel = "High" | "Moderate" | "Low" | "Very low";

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
    | "Regulatory safety warning";
  sampleSize: string;
  population: string;
  intervention: string;
  outcomes: string[];
  adverseEvents: string;
  fundingConflicts: string;
  riskOfBias: string;
  referenceId: string;
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

export interface EvidenceDashboardData {
  references: Reference[];
  interventions: Intervention[];
  claims: Claim[];
  studies: Study[];
  trialWatchItems: TrialWatchItem[];
  safetyAlerts: SafetyAlert[];
  productSignals: ProductSignal[];
  dataSource: "database" | "seed";
  fallbackReason?: string;
}
