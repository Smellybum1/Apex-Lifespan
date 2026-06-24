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
  type ClaimScoreHistory as DbClaimScoreHistory,
  type ClaimScoreSnapshot as DbClaimScoreSnapshot,
  type ClaimStudy as DbClaimStudy,
  type Intervention as DbIntervention,
  type Product as DbProduct,
  type Reference as DbReference,
  type SafetyAlert as DbSafetyAlert,
  SafetyAlertType as DbSafetyAlertType,
  SafetySeverity as DbSafetySeverity,
  ScoreChangeKind as DbScoreChangeKind,
  SourceKind as DbSourceKind,
  type SourcePacket as DbSourcePacket,
  type SourcePacketReference as DbSourcePacketReference,
  type Study as DbStudy,
  StudyType as DbStudyType,
  type Trial as DbTrial,
  type TrialAlert as DbTrialAlert,
  TrialAlertKind as DbTrialAlertKind,
  TrialAlertStatus as DbTrialAlertStatus,
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
import { buildSeedNormalizedEvidenceRows } from "@/lib/seed-normalized-evidence";
import type {
  Claim,
  ClaimScoreHistoryEntry,
  ClaimScoreSnapshot,
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
  SourceTypeTaxonomy,
  Study,
  TrialAlert,
  TrialWatchItem
} from "@/lib/types";

type DbClaimWithReferences = DbClaim & {
  references?: DbClaimReference[];
  sourcePackets?: Array<
    DbSourcePacket & {
      references: DbSourcePacketReference[];
    }
  >;
  studyLinks?: DbClaimStudy[];
};

type DatabasePreflight =
  | { reachable: true }
  | { reachable: false; reason: string };

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

const trialAlertKindMap: Record<DbTrialAlertKind, TrialAlert["kind"]> = {
  LOW_PRIORITY_LEAD: "Low-priority lead",
  MISSING_RESULTS_FOLLOW_UP: "Missing results follow-up",
  MONITOR_ACTIVE_TRIAL: "Monitor active trial",
  REGISTRY_STATUS_REVIEW: "Registry status review",
  RESULTS_REVIEW_NEEDED: "Results review needed"
};

const trialAlertStatusMap: Record<DbTrialAlertStatus, TrialAlert["status"]> = {
  ACKNOWLEDGED: "Acknowledged",
  DISMISSED: "Dismissed",
  OPEN: "Open",
  RESOLVED: "Resolved"
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

const scoreChangeReasonMap: Record<DbScoreChangeKind, string> = {
  BETTER_DOSE_FORM_EVIDENCE: "Better dose-form evidence",
  CONTRADICTORY_EVIDENCE: "Contradictory evidence",
  MANUAL_REVIEW: "Manual review",
  NEW_META_ANALYSIS: "New meta-analysis",
  NEW_RCT: "New RCT",
  OTHER: "Other",
  PRODUCT_QUALITY_CONCERN: "Product-quality concern",
  REGULATORY_WARNING: "Regulatory warning",
  SAFETY_SIGNAL: "Safety signal",
  TRIAL_RESULT_POSTED: "Trial result posted"
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

  const databasePreflight = await checkDatabaseConnection(process.env.DATABASE_URL);

  if (!databasePreflight.reachable) {
    if (process.env.APEX_DATA_SOURCE === "database") {
      throw new Error(databasePreflight.reason);
    }

    return getSeedDashboardData(databasePreflight.reason);
  }

  try {
    return await getPrismaDashboardData({
      strictDatabaseMode: process.env.APEX_DATA_SOURCE === "database"
    });
  } catch (error) {
    if (process.env.APEX_DATA_SOURCE === "database") {
      throw new Error(strictDatabaseError(error));
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
    scoreSnapshots: seedScoreSnapshots(),
    productSignals,
    australiaRegulatoryStatuses,
    dataSource: "seed",
    fallbackReason
  };
}

function seedScoreSnapshots(): ClaimScoreSnapshot[] {
  return buildSeedNormalizedEvidenceRows({ claims, studies }).scoreSnapshots.map((snapshot) => ({
    claimId: snapshot.claimId,
    compositeScore: snapshot.compositeScore,
    computedAt: snapshot.computedAt ?? "Unknown",
    finalLabel: snapshot.finalLabel,
    id: snapshot.id,
    rationale: snapshot.rationale,
    reviewStatus: snapshot.reviewStatus,
    scoreVersion: snapshot.scoreVersion,
    scores: snapshot.scores
  }));
}

async function getPrismaDashboardData({
  strictDatabaseMode = false
}: {
  strictDatabaseMode?: boolean;
} = {}): Promise<EvidenceDashboardData> {
  const [
    dbReferences,
    dbInterventions,
    dbClaims,
    dbStudies,
    dbTrials,
    dbTrialAlerts,
    dbSafetyAlerts,
    dbScoreHistory,
    dbScoreSnapshots,
    dbProducts,
    dbAustraliaRegulatoryStatuses
  ] = await Promise.all([
    prisma.reference.findMany({ orderBy: [{ source: "asc" }, { title: "asc" }] }),
    prisma.intervention.findMany({ orderBy: { name: "asc" } }),
    prisma.claim.findMany({
      include: {
        references: true,
        sourcePackets: {
          include: {
            references: {
              orderBy: { createdAt: "asc" }
            }
          },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          where: { current: true }
        },
        studyLinks: {
          orderBy: [{ relevanceScore: "desc" }, { updatedAt: "desc" }],
          where: {
            relation: {
              not: "UNREVIEWED_LEAD"
            }
          }
        }
      },
      orderBy: [{ finalLabel: "asc" }, { updatedAt: "desc" }]
    }),
    prisma.study.findMany({ orderBy: [{ year: "desc" }, { title: "asc" }] }),
    prisma.trial.findMany({ orderBy: [{ lastUpdateDate: "desc" }, { title: "asc" }] }),
    prisma.trialAlert.findMany({ orderBy: [{ detectedAt: "desc" }, { createdAt: "desc" }] }),
    prisma.safetyAlert.findMany({ orderBy: [{ date: "desc" }, { severity: "desc" }] }),
    prisma.claimScoreHistory.findMany({
      orderBy: [{ createdAt: "desc" }]
    }),
    prisma.claimScoreSnapshot.findMany({
      orderBy: [{ computedAt: "desc" }, { createdAt: "desc" }]
    }),
    prisma.product.findMany({ orderBy: [{ qualityScore: "desc" }, { name: "asc" }] }),
    prisma.australiaRegulatoryStatus.findMany({
      orderBy: [{ region: "asc" }, { kind: "asc" }, { status: "asc" }]
    })
  ]);

  if (dbInterventions.length === 0 || dbClaims.length === 0) {
    const reason = "Database connected but has not been seeded yet.";

    if (strictDatabaseMode) {
      throw new Error(reason);
    }

    return getSeedDashboardData(reason);
  }

  return {
    references: dbReferences.map(mapReference),
    interventions: dbInterventions.map(mapIntervention),
    claims: dbClaims.map((claim) => mapClaim(claim, dbStudies)),
    studies: dbStudies.map(mapStudy),
    trialAlerts: dbTrialAlerts.map(mapTrialAlert),
    trialWatchItems: dbTrials.map(mapTrial),
    safetyAlerts: dbSafetyAlerts.map(mapSafetyAlert),
    scoreHistory: dbScoreHistory.map(mapClaimScoreHistory),
    scoreSnapshots: dbScoreSnapshots.map(mapClaimScoreSnapshot),
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

function mapClaim(claim: DbClaimWithReferences, dbStudies: DbStudy[]): Claim {
  const keyReferenceIds = currentSourcePacketReferenceIds(claim);
  const keyStudyIds = currentClaimStudyIds(claim, dbStudies);

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
    keyReferenceIds,
    ...(keyStudyIds.length > 0 ? { keyStudyIds } : {}),
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
    reviewStatus: reviewStatusFromDb(claim.reviewStatus),
    lastUpdated: formatDate(claim.lastReviewedAt ?? claim.updatedAt),
    whatWouldChangeScore: claim.whatWouldChangeScore
  };
}

function currentSourcePacketReferenceIds(claim: DbClaimWithReferences) {
  const packetReferenceIds = uniqueStrings(
    (claim.sourcePackets ?? []).flatMap((packet) =>
      packet.references.map((reference) => reference.referenceId)
    )
  );
  const claimReferenceIds = uniqueStrings(
    (claim.references ?? []).map((reference) => reference.referenceId)
  );

  return uniqueStrings([...packetReferenceIds, ...claimReferenceIds]);
}

function currentClaimStudyIds(claim: DbClaimWithReferences, dbStudies: DbStudy[]) {
  const linkedStudyIds = uniqueStrings((claim.studyLinks ?? []).map((link) => link.studyId));
  const referenceIds = new Set(currentSourcePacketReferenceIds(claim));
  const extractedStudyIds = dbStudies
    .filter((study) => referenceIds.has(study.referenceId))
    .map((study) => study.id);

  return uniqueStrings([...linkedStudyIds, ...extractedStudyIds]);
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

function mapClaimScoreSnapshot(snapshot: DbClaimScoreSnapshot): ClaimScoreSnapshot {
  return {
    claimId: snapshot.claimId,
    compositeScore: Number(snapshot.compositeScore),
    computedAt: formatDate(snapshot.computedAt),
    finalLabel: evidenceLabelMap[snapshot.finalLabel],
    id: snapshot.id,
    rationale: snapshot.rationale ?? undefined,
    reviewStatus: reviewStatusFromDb(snapshot.reviewStatus),
    scoreVersion: snapshot.scoreVersion,
    scores: {
      evidenceDirectness: snapshot.evidenceDirectnessScore,
      evidenceRigor: snapshot.evidenceRigorScore,
      effectSize: snapshot.effectSizeScore,
      safety: snapshot.safetyScore,
      regulatoryRisk: snapshot.regulatoryRiskScore,
      productQuality: snapshot.productQualityScore,
      hypePenalty: snapshot.hypePenalty,
      measurability: snapshot.measurabilityScore
    }
  };
}

function reviewStatusFromDb(reviewStatus: string) {
  if (reviewStatus === "HUMAN_REVIEWED") {
    return "Human reviewed";
  }

  if (reviewStatus === "AI_REVIEWED") {
    return "AI reviewed";
  }

  return "Unreviewed AI draft";
}

function mapClaimScoreHistory(history: DbClaimScoreHistory): ClaimScoreHistoryEntry {
  return {
    claimId: history.claimId,
    createdAt: formatDate(history.createdAt),
    id: history.id,
    newCompositeScore:
      history.newCompositeScore === null ? undefined : Number(history.newCompositeScore),
    newLabel: history.newLabel === null ? undefined : evidenceLabelMap[history.newLabel],
    oldCompositeScore:
      history.oldCompositeScore === null ? undefined : Number(history.oldCompositeScore),
    oldLabel: history.oldLabel === null ? undefined : evidenceLabelMap[history.oldLabel],
    rationale: history.rationale,
    reason: scoreChangeReasonMap[history.reason],
    referenceId: history.referenceId ?? undefined
  };
}

function mapStudy(study: DbStudy): Study {
  return {
    id: study.id,
    title: study.title,
    year: study.year ?? 0,
    source: study.source,
    studyType: studyTypeMap[study.sourceType],
    sourceTypeTaxonomy: sourceTypeTaxonomyFromDbStudy(study),
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

function sourceTypeTaxonomyFromDbStudy(study: DbStudy): SourceTypeTaxonomy | undefined {
  if (study.sourceType === DbStudyType.META_ANALYSIS) {
    return "meta-analysis";
  }

  if (study.sourceType === DbStudyType.RANDOMIZED_CONTROLLED_TRIAL) {
    return "RCT";
  }

  if (study.sourceType === DbStudyType.OBSERVATIONAL_COHORT) {
    return "observational study";
  }

  if (study.sourceType === DbStudyType.CASE_REPORT) {
    return "case report";
  }

  if (study.sourceType === DbStudyType.ANIMAL_STUDY) {
    return "animal study";
  }

  if (study.sourceType === DbStudyType.IN_VITRO_MECHANISTIC) {
    return "in vitro/mechanistic";
  }

  if (study.sourceType === DbStudyType.REGULATORY_SAFETY_WARNING) {
    return "regulatory warning";
  }

  if (study.sourceType !== DbStudyType.SYSTEMATIC_REVIEW) {
    return undefined;
  }

  const sourceText = `${study.title} ${study.source}`.toLowerCase();

  if (sourceText.includes("position stand")) {
    return "position stand";
  }

  if (
    sourceText.includes("fact sheet") ||
    sourceText.includes("office of dietary supplements") ||
    sourceText.includes("health professional")
  ) {
    return "narrative review";
  }

  if (sourceText.includes("guideline")) {
    return "guideline";
  }

  return "systematic review";
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

function mapTrialAlert(alert: DbTrialAlert): TrialAlert {
  return {
    claimId: alert.claimId ?? undefined,
    detectedAt: formatDate(alert.detectedAt),
    detail: alert.detail,
    id: alert.id,
    interventionId: alert.interventionId ?? undefined,
    kind: trialAlertKindMap[alert.kind],
    nctId: alert.nctId ?? undefined,
    noAutoPromotion: alert.noAutoPromotion,
    reviewedAt: alert.reviewedAt ? formatDate(alert.reviewedAt) : undefined,
    scoreHistoryId: alert.scoreHistoryId ?? undefined,
    status: trialAlertStatusMap[alert.status],
    title: alert.title,
    trialId: alert.trialId ?? undefined
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
  const message = error instanceof Error ? error.message : "";

  if (message.includes("Environment variable not found: DATABASE_URL")) {
    return "DATABASE_URL is not configured, using seed data.";
  }

  if (
    message.includes("P1001") ||
    message.includes("Can't reach database server")
  ) {
    return "Database is not reachable, using seed data.";
  }

  if (message.includes("DATABASE_URL") && message.toLowerCase().includes("invalid")) {
    return "DATABASE_URL is invalid, using seed data.";
  }

  return "Database query failed, using seed data.";
}

function strictDatabaseError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message === "Database connected but has not been seeded yet.") {
    return message;
  }

  const missingTableName = missingDatabaseTableName(message);

  if (missingTableName) {
    return `Database schema is missing required table ${missingTableName}; run approved migrations before strict database smoke.`;
  }

  return "Database query failed while strict database mode is required.";
}

function missingDatabaseTableName(message: string) {
  const missingTableMatch = message.match(
    /(?:table|relation)\s+[`'"]?(?:[a-z_][\w]*\.)?([A-Z][A-Za-z0-9_]*)[`'"]?\s+(?:does not exist|doesn't exist)/i
  );

  return missingTableMatch?.[1];
}

async function checkDatabaseConnection(databaseUrl: string | undefined): Promise<DatabasePreflight> {
  if (!databaseUrl) {
    return {
      reachable: false,
      reason: "DATABASE_URL is not configured, using seed data."
    };
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    return {
      reachable: false,
      reason: "DATABASE_URL is invalid, using seed data."
    };
  }

  if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol)) {
    return {
      reachable: false,
      reason: "DATABASE_URL is invalid, using seed data."
    };
  }

  const reachable = await canReachDatabase(parsedUrl);

  return reachable
    ? { reachable: true }
    : {
        reachable: false,
        reason: "Database is not reachable, using seed data."
      };
}

function canReachDatabase(databaseUrl: URL) {
  return new Promise<boolean>((resolve) => {
    const socket = new Socket();
    const port = Number(databaseUrl.port || 5432);

    const finish = (reachable: boolean) => {
      socket.destroy();
      resolve(reachable);
    };

    socket.setTimeout(300);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, databaseUrl.hostname);
  });
}
