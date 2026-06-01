import {
  AustraliaRegulatoryKind as DbAustraliaRegulatoryKind,
  type AustraliaRegulatoryStatus as DbAustraliaRegulatoryStatus,
  ConfidenceLevel as DbConfidenceLevel,
  EvidenceLabel as DbEvidenceLabel,
  EvidenceMomentum as DbEvidenceMomentum,
  InterventionCategory as DbInterventionCategory,
  OutcomeArea as DbOutcomeArea,
  type Claim as DbClaim,
  type ClaimReference as DbClaimReference,
  type Intervention as DbIntervention,
  type Product as DbProduct,
  type Reference as DbReference,
  type SafetyAlert as DbSafetyAlert,
  SafetyAlertType as DbSafetyAlertType,
  SafetySeverity as DbSafetySeverity,
  SourceKind as DbSourceKind,
  type Study as DbStudy,
  StudyType as DbStudyType,
  type Trial as DbTrial,
  TrialStatus as DbTrialStatus,
  type Prisma
} from "@prisma/client";
import { Socket } from "node:net";

import { projectConfig } from "@/lib/config/project";
import { prisma } from "@/lib/db/prisma";
import {
  australiaRegulatoryStatuses,
  claims,
  interventions,
  productSignals,
  references,
  safetyAlerts,
  studies,
  trialWatchItems
} from "@/lib/seed-data";
import type {
  Claim,
  AustraliaRegulatoryKind,
  AustraliaRegulatoryStatus,
  ConfidenceLevel,
  EvidenceDashboardData,
  EvidenceLabel,
  EvidenceMomentum,
  Intervention,
  InterventionCategory,
  OutcomeArea,
  ProductSignal,
  Reference,
  SafetyAlert,
  Study,
  TrialWatchItem
} from "@/lib/types";

type DbClaimWithReferences = DbClaim & {
  references: DbClaimReference[];
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

const evidenceLabelMap: Record<DbEvidenceLabel, EvidenceLabel> = {
  CORE_EVIDENCE_BASED: "Core Evidence-Based",
  CONDITIONAL_BIOMARKER_GATED: "Conditional / Biomarker-Gated",
  USEFUL_FOR_SPECIFIC_USE_CASE: "Useful for Specific Use Case",
  REASONABLE_N_OF_1_EXPERIMENT: "Reasonable N-of-1 Experiment",
  SPECULATIVE_WATCHLIST: "Speculative Watchlist",
  SAFETY_CONCERN: "Safety Concern",
  AVOID_NOT_RECOMMENDED: "Avoid / Not Recommended",
  REQUIRES_CLINICIAN_OVERSIGHT: "Requires Clinician Oversight",
  REGULATORY_CONCERN: "Regulatory Concern",
  INSUFFICIENT_EVIDENCE: "Insufficient Evidence"
};

const momentumMap: Record<DbEvidenceMomentum, EvidenceMomentum> = {
  INCREASING: "Increasing",
  STABLE: "Stable",
  CONFLICTING: "Conflicting",
  WEAKENING: "Weakening",
  SAFETY_CONCERN_EMERGING: "Safety concern emerging"
};

const confidenceMap: Record<DbConfidenceLevel, ConfidenceLevel> = {
  HIGH: "High",
  MODERATE: "Moderate",
  LOW: "Low",
  VERY_LOW: "Very low"
};

const studyTypeMap: Record<DbStudyType, Study["studyType"]> = {
  META_ANALYSIS: "Meta-analysis",
  SYSTEMATIC_REVIEW: "Systematic review",
  RANDOMIZED_CONTROLLED_TRIAL: "Randomized controlled trial",
  OBSERVATIONAL_COHORT: "Observational cohort",
  CASE_REPORT: "Case report",
  ANIMAL_STUDY: "Animal study",
  IN_VITRO_MECHANISTIC: "In vitro/mechanistic",
  CLINICAL_TRIAL_RECORD: "Clinical trial record",
  REGULATORY_SAFETY_WARNING: "Regulatory safety warning"
};

const trialStatusMap: Record<DbTrialStatus, TrialWatchItem["status"]> = {
  RECRUITING: "Recruiting",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  TERMINATED: "Terminated",
  RESULTS_PENDING: "Results pending"
};

const alertTypeMap: Record<DbSafetyAlertType, SafetyAlert["alertType"]> = {
  LIVER_INJURY: "Liver injury",
  KIDNEY_RISK: "Kidney risk",
  CONTAMINATION: "Contamination",
  ADULTERATION: "Adulteration",
  MISLABELING: "Mislabeling",
  PROHIBITED_IN_SPORT: "Prohibited in sport",
  PRESCRIPTION_ONLY: "Prescription-only",
  UNAPPROVED_THERAPEUTIC_GOOD: "Unapproved therapeutic good",
  COMPOUNDING_RESTRICTION: "Compounding restriction",
  DRUG_INTERACTION: "Drug interaction"
};

const severityMap: Record<DbSafetySeverity, SafetyAlert["severity"]> = {
  LOW: "Low",
  MODERATE: "Moderate",
  HIGH: "High",
  CLINICIAN_REVIEW_RECOMMENDED: "Clinician review recommended",
  AVOID: "Avoid"
};

const sourceMap: Record<DbSourceKind, string> = {
  PUBMED: "PubMed",
  PUBMED_CENTRAL: "PubMed Central",
  CLINICALTRIALS_GOV: "ClinicalTrials.gov",
  NIH_ODS: "NIH Office of Dietary Supplements",
  TGA: "TGA",
  FDA: "FDA",
  WADA: "WADA",
  LIVERTOX: "LiverTox",
  NCCIH: "NCCIH",
  MEDLINEPLUS: "MedlinePlus",
  PRODUCT_LABEL: "Product label",
  ADMIN_ENTRY: "Admin entry",
  OTHER: "Other"
};

const australiaRegulatoryKindMap: Record<DbAustraliaRegulatoryKind, AustraliaRegulatoryKind> = {
  AUST_L: "AUST L",
  AUST_LA: "AUST L(A)",
  AUST_R: "AUST R",
  NOT_IN_ARTG: "Not in ARTG",
  UNAPPROVED: "Unapproved",
  EXEMPT: "Exempt",
  EXCLUDED: "Excluded",
  UNKNOWN: "Unknown"
};

export async function getEvidenceDashboardData(): Promise<EvidenceDashboardData> {
  if (process.env.APEX_DATA_SOURCE === "seed") {
    return getSeedDashboardData("Seed mode forced by APEX_DATA_SOURCE.");
  }

  const databaseUrl = process.env.DATABASE_URL;
  const databaseReachable = databaseUrl ? await canReachDatabase(databaseUrl) : false;

  if (!databaseReachable) {
    const reason = databaseUrl
      ? "Database is not reachable, using seed data."
      : "DATABASE_URL is not configured, using seed data.";

    if (process.env.APEX_DATA_SOURCE === "database") {
      throw new Error(reason);
    }

    return getSeedDashboardData(reason);
  }

  try {
    return await getPrismaDashboardData();
  } catch (error) {
    if (process.env.APEX_DATA_SOURCE === "database") {
      throw error;
    }

    return getSeedDashboardData(readableError(error));
  }
}

function getSeedDashboardData(fallbackReason?: string): EvidenceDashboardData {
  return {
    references,
    interventions,
    claims,
    studies,
    trialWatchItems,
    safetyAlerts,
    productSignals,
    australiaRegulatoryStatuses,
    dataSource: "seed",
    fallbackReason
  };
}

async function getPrismaDashboardData(): Promise<EvidenceDashboardData> {
  const [
    dbReferences,
    dbInterventions,
    dbClaims,
    dbStudies,
    dbTrials,
    dbSafetyAlerts,
    dbProducts,
    dbAustraliaRegulatoryStatuses
  ] = await Promise.all([
    prisma.reference.findMany({ orderBy: [{ source: "asc" }, { title: "asc" }] }),
    prisma.intervention.findMany({ orderBy: { name: "asc" } }),
    prisma.claim.findMany({
      include: { references: true },
      orderBy: [{ finalLabel: "asc" }, { updatedAt: "desc" }]
    }),
    prisma.study.findMany({ orderBy: [{ year: "desc" }, { title: "asc" }] }),
    prisma.trial.findMany({ orderBy: [{ lastUpdateDate: "desc" }, { title: "asc" }] }),
    prisma.safetyAlert.findMany({ orderBy: [{ date: "desc" }, { severity: "desc" }] }),
    prisma.product.findMany({ orderBy: [{ qualityScore: "desc" }, { name: "asc" }] }),
    prisma.australiaRegulatoryStatus.findMany({
      orderBy: [{ region: "asc" }, { kind: "asc" }, { status: "asc" }]
    })
  ]);

  if (dbInterventions.length === 0 || dbClaims.length === 0) {
    return getSeedDashboardData("Database connected but has not been seeded yet.");
  }

  return {
    references: dbReferences.map(mapReference),
    interventions: dbInterventions.map(mapIntervention),
    claims: dbClaims.map(mapClaim),
    studies: dbStudies.map(mapStudy),
    trialWatchItems: dbTrials.map(mapTrial),
    safetyAlerts: dbSafetyAlerts.map(mapSafetyAlert),
    productSignals: dbProducts.map(mapProduct),
    australiaRegulatoryStatuses: dbAustraliaRegulatoryStatuses.map(mapAustraliaRegulatoryStatus),
    dataSource: "database"
  };
}

function mapReference(reference: DbReference): Reference {
  return {
    id: reference.id,
    title: reference.title,
    source: sourceMap[reference.source],
    identifier: reference.identifier ?? undefined,
    year: reference.year ?? undefined,
    url: reference.url
  };
}

function mapIntervention(intervention: DbIntervention): Intervention {
  return {
    id: intervention.id,
    name: intervention.name,
    slug: intervention.slug,
    synonyms: intervention.synonyms,
    category: categoryMap[intervention.category],
    commonForms: intervention.commonForms,
    regulatoryStatus:
      projectConfig.defaultRegion === "AU"
        ? intervention.australiaRegulatoryStatus
        : intervention.regulatorySummary,
    safetySummary: intervention.safetySummary,
    interactionSummary: intervention.interactionSummary,
    evidenceSummary: intervention.evidenceSummary,
    lastReviewed: formatDate(intervention.lastReviewedAt)
  };
}

function mapClaim(claim: DbClaimWithReferences): Claim {
  return {
    id: claim.id,
    interventionId: claim.interventionId,
    outcome: outcomeMap[claim.outcome],
    claimText: claim.claimText,
    populationStudied: claim.populationStudied,
    doseFormStudied: claim.doseFormStudied,
    durationStudied: claim.durationStudied,
    comparator: claim.comparator,
    evidenceGrade: claim.evidenceGrade,
    effectSize: claim.effectSize,
    clinicalRelevance: claim.clinicalRelevance,
    confidenceLevel: confidenceMap[claim.confidenceLevel],
    safetyNotes: claim.safetyNotes,
    applicabilityNotes: claim.applicabilityNotes,
    keyReferenceIds: claim.references.map((reference) => reference.referenceId),
    scores: {
      evidenceDirectness: claim.evidenceDirectnessScore,
      evidenceRigor: claim.evidenceRigorScore,
      effectSize: claim.effectSizeScore,
      safety: claim.safetyScore,
      regulatoryRisk: claim.regulatoryRiskScore,
      productQuality: claim.productQualityScore,
      hypePenalty: claim.hypePenalty,
      measurability: claim.measurabilityScore
    },
    finalLabel: evidenceLabelMap[claim.finalLabel],
    momentum: momentumMap[claim.momentum],
    reviewStatus:
      claim.reviewStatus === "HUMAN_REVIEWED" ? "Human reviewed" : "Unreviewed AI draft",
    lastUpdated: formatDate(claim.lastReviewedAt ?? claim.updatedAt),
    whatWouldChangeScore: claim.whatWouldChangeScore
  };
}

function mapStudy(study: DbStudy): Study {
  return {
    id: study.id,
    title: study.title,
    year: study.year ?? 0,
    source: study.source,
    studyType: studyTypeMap[study.sourceType],
    sampleSize: study.sampleSize,
    population: study.population,
    intervention: study.interventionName,
    outcomes: study.outcomes,
    adverseEvents: study.adverseEvents,
    fundingConflicts: study.fundingConflicts,
    riskOfBias: study.riskOfBias,
    referenceId: study.referenceId ?? ""
  };
}

function mapTrial(trial: DbTrial): TrialWatchItem {
  return {
    id: trial.id,
    interventionId: trial.interventionId ?? "",
    title: trial.title,
    status: trialStatusMap[trial.status],
    phase: trial.phase,
    enrollment: trial.enrollment,
    lastUpdateDate: formatDate(trial.lastUpdateDate),
    evidenceImpact: momentumMap[trial.evidenceImpact],
    url: trial.url
  };
}

function mapSafetyAlert(alert: DbSafetyAlert): SafetyAlert {
  return {
    id: alert.id,
    interventionId: alert.interventionId ?? "",
    region: alert.region,
    source: sourceMap[alert.agency],
    date: formatDate(alert.date),
    alertType: alertTypeMap[alert.alertType],
    severity: severityMap[alert.severity],
    summary: alert.summary,
    url: alert.url,
    lastChecked: formatDate(alert.lastCheckedAt)
  };
}

function mapProduct(product: DbProduct): ProductSignal {
  return {
    id: product.id,
    name: product.name,
    brand: product.brand,
    ingredients: stringArray(product.ingredientsJson),
    proprietaryBlend: product.proprietaryBlend,
    certifications: stringArray(product.certificationsJson),
    region: product.region,
    qualityScore: product.qualityScore,
    labelClaimRiskScore: product.labelClaimRiskScore
  };
}

function mapAustraliaRegulatoryStatus(
  status: DbAustraliaRegulatoryStatus
): AustraliaRegulatoryStatus {
  return {
    id: status.id,
    interventionId: status.interventionId ?? undefined,
    productId: status.productId ?? undefined,
    referenceId: status.referenceId ?? undefined,
    region: "AU",
    kind: australiaRegulatoryKindMap[status.kind],
    artgId: status.artgId ?? undefined,
    austNumber: status.austNumber ?? undefined,
    sponsor: status.sponsor ?? undefined,
    status: status.status,
    efficacyAssessed: status.efficacyAssessed ?? undefined,
    preMarketAssessment: status.preMarketAssessment ?? undefined,
    supplySummary: status.supplySummary,
    evidenceRequirement: status.evidenceRequirement,
    sourceUrl: status.sourceUrl,
    checkedAt: formatDate(status.checkedAt),
    notes: status.notes
  };
}

function stringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function formatDate(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "Unknown";
}

function readableError(error: unknown) {
  if (error instanceof Error) {
    return `Database unavailable, using seed data: ${error.message}`;
  }

  return "Database unavailable, using seed data.";
}

function canReachDatabase(databaseUrl: string) {
  return new Promise<boolean>((resolve) => {
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(databaseUrl);
    } catch {
      resolve(false);
      return;
    }

    const socket = new Socket();
    const port = Number(parsedUrl.port || 5432);

    const finish = (reachable: boolean) => {
      socket.destroy();
      resolve(reachable);
    };

    socket.setTimeout(300);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, parsedUrl.hostname);
  });
}
