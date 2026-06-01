import {
  AustraliaRegulatoryKind as PrismaAustraliaRegulatoryKind,
  ConfidenceLevel as PrismaConfidenceLevel,
  EvidenceLabel as PrismaEvidenceLabel,
  EvidenceMomentum as PrismaEvidenceMomentum,
  IngestionStatus as PrismaIngestionStatus,
  InterventionCategory as PrismaInterventionCategory,
  OutcomeArea as PrismaOutcomeArea,
  PrismaClient,
  SafetyAlertType as PrismaSafetyAlertType,
  SafetySeverity as PrismaSafetySeverity,
  SourceKind as PrismaSourceKind,
  StudyType as PrismaStudyType,
  TrialStatus as PrismaTrialStatus
} from "@prisma/client";
import {
  australiaRegulatoryStatuses,
  claims,
  interventions,
  productSignals,
  references,
  safetyAlerts,
  studies,
  trialWatchItems
} from "../src/lib/seed-data";
import {
  assertSeedIntegrity,
  type SeedIntegrityCollection
} from "../src/lib/seed-integrity";
import type {
  AustraliaRegulatoryKind,
  Claim,
  EvidenceLabel,
  EvidenceMomentum,
  InterventionCategory,
  OutcomeArea,
  SafetyAlert,
  Study,
  TrialWatchItem
} from "../src/lib/types";

const prisma = new PrismaClient();

const categoryMap: Record<InterventionCategory, PrismaInterventionCategory> = {
  "Vitamin/mineral": PrismaInterventionCategory.VITAMIN_MINERAL,
  "Fatty acid": PrismaInterventionCategory.FATTY_ACID,
  "Amino acid": PrismaInterventionCategory.AMINO_ACID,
  "Botanical/herbal": PrismaInterventionCategory.BOTANICAL_HERBAL,
  "Fiber/prebiotic/probiotic": PrismaInterventionCategory.FIBER_PREBIOTIC_PROBIOTIC,
  "Ergogenic/performance supplement": PrismaInterventionCategory.ERGOGENIC_PERFORMANCE_SUPPLEMENT,
  Nootropic: PrismaInterventionCategory.NOOTROPIC,
  "Hormonal/endocrine intervention": PrismaInterventionCategory.HORMONAL_ENDOCRINE_INTERVENTION,
  "Peptide/biologic": PrismaInterventionCategory.PEPTIDE_BIOLOGIC,
  "Drug/geroprotector watchlist": PrismaInterventionCategory.DRUG_GEROPROTECTOR_WATCHLIST,
  "Food/beverage": PrismaInterventionCategory.FOOD_BEVERAGE
};

const outcomeMap: Record<OutcomeArea, PrismaOutcomeArea> = {
  "Mortality/lifespan": PrismaOutcomeArea.MORTALITY_LIFESPAN,
  "Cardiovascular events": PrismaOutcomeArea.CARDIOVASCULAR_EVENTS,
  "LDL/ApoB/lipids": PrismaOutcomeArea.LDL_APOB_LIPIDS,
  "Blood pressure": PrismaOutcomeArea.BLOOD_PRESSURE,
  "Glucose/insulin/HbA1c": PrismaOutcomeArea.GLUCOSE_INSULIN_HBA1C,
  Inflammation: PrismaOutcomeArea.INFLAMMATION,
  Cognition: PrismaOutcomeArea.COGNITION,
  Sleep: PrismaOutcomeArea.SLEEP,
  "Mood/stress": PrismaOutcomeArea.MOOD_STRESS,
  "Muscle/strength": PrismaOutcomeArea.MUSCLE_STRENGTH,
  "VO2 max/endurance": PrismaOutcomeArea.VO2_MAX_ENDURANCE,
  "Joint/tendon/skin": PrismaOutcomeArea.JOINT_TENDON_SKIN,
  "Eye health": PrismaOutcomeArea.EYE_HEALTH,
  "Immune/respiratory": PrismaOutcomeArea.IMMUNE_RESPIRATORY,
  "Fertility/hormones": PrismaOutcomeArea.FERTILITY_HORMONES,
  "Biological aging clocks": PrismaOutcomeArea.BIOLOGICAL_AGING_CLOCKS,
  "Safety/adverse effects": PrismaOutcomeArea.SAFETY_ADVERSE_EFFECTS
};

const evidenceLabelMap: Record<EvidenceLabel, PrismaEvidenceLabel> = {
  "Core Evidence-Based": PrismaEvidenceLabel.CORE_EVIDENCE_BASED,
  "Conditional / Biomarker-Gated": PrismaEvidenceLabel.CONDITIONAL_BIOMARKER_GATED,
  "Useful for Specific Use Case": PrismaEvidenceLabel.USEFUL_FOR_SPECIFIC_USE_CASE,
  "Reasonable N-of-1 Experiment": PrismaEvidenceLabel.REASONABLE_N_OF_1_EXPERIMENT,
  "Speculative Watchlist": PrismaEvidenceLabel.SPECULATIVE_WATCHLIST,
  "Safety Concern": PrismaEvidenceLabel.SAFETY_CONCERN,
  "Avoid / Not Recommended": PrismaEvidenceLabel.AVOID_NOT_RECOMMENDED,
  "Requires Clinician Oversight": PrismaEvidenceLabel.REQUIRES_CLINICIAN_OVERSIGHT,
  "Regulatory Concern": PrismaEvidenceLabel.REGULATORY_CONCERN,
  "Insufficient Evidence": PrismaEvidenceLabel.INSUFFICIENT_EVIDENCE
};

const momentumMap: Record<EvidenceMomentum, PrismaEvidenceMomentum> = {
  Increasing: PrismaEvidenceMomentum.INCREASING,
  Stable: PrismaEvidenceMomentum.STABLE,
  Conflicting: PrismaEvidenceMomentum.CONFLICTING,
  Weakening: PrismaEvidenceMomentum.WEAKENING,
  "Safety concern emerging": PrismaEvidenceMomentum.SAFETY_CONCERN_EMERGING
};

const confidenceMap: Record<Claim["confidenceLevel"], PrismaConfidenceLevel> = {
  High: PrismaConfidenceLevel.HIGH,
  Moderate: PrismaConfidenceLevel.MODERATE,
  Low: PrismaConfidenceLevel.LOW,
  "Very low": PrismaConfidenceLevel.VERY_LOW
};

const studyTypeMap: Record<Study["studyType"], PrismaStudyType> = {
  "Meta-analysis": PrismaStudyType.META_ANALYSIS,
  "Systematic review": PrismaStudyType.SYSTEMATIC_REVIEW,
  "Randomized controlled trial": PrismaStudyType.RANDOMIZED_CONTROLLED_TRIAL,
  "Observational cohort": PrismaStudyType.OBSERVATIONAL_COHORT,
  "Case report": PrismaStudyType.CASE_REPORT,
  "Animal study": PrismaStudyType.ANIMAL_STUDY,
  "In vitro/mechanistic": PrismaStudyType.IN_VITRO_MECHANISTIC,
  "Clinical trial record": PrismaStudyType.CLINICAL_TRIAL_RECORD,
  "Regulatory safety warning": PrismaStudyType.REGULATORY_SAFETY_WARNING
};

const alertTypeMap: Record<SafetyAlert["alertType"], PrismaSafetyAlertType> = {
  "Liver injury": PrismaSafetyAlertType.LIVER_INJURY,
  "Kidney risk": PrismaSafetyAlertType.KIDNEY_RISK,
  Contamination: PrismaSafetyAlertType.CONTAMINATION,
  Adulteration: PrismaSafetyAlertType.ADULTERATION,
  Mislabeling: PrismaSafetyAlertType.MISLABELING,
  "Prohibited in sport": PrismaSafetyAlertType.PROHIBITED_IN_SPORT,
  "Prescription-only": PrismaSafetyAlertType.PRESCRIPTION_ONLY,
  "Unapproved therapeutic good": PrismaSafetyAlertType.UNAPPROVED_THERAPEUTIC_GOOD,
  "Compounding restriction": PrismaSafetyAlertType.COMPOUNDING_RESTRICTION,
  "Drug interaction": PrismaSafetyAlertType.DRUG_INTERACTION
};

const severityMap: Record<SafetyAlert["severity"], PrismaSafetySeverity> = {
  Low: PrismaSafetySeverity.LOW,
  Moderate: PrismaSafetySeverity.MODERATE,
  High: PrismaSafetySeverity.HIGH,
  "Clinician review recommended": PrismaSafetySeverity.CLINICIAN_REVIEW_RECOMMENDED,
  Avoid: PrismaSafetySeverity.AVOID
};

const trialStatusMap: Record<TrialWatchItem["status"], PrismaTrialStatus> = {
  Recruiting: PrismaTrialStatus.RECRUITING,
  Active: PrismaTrialStatus.ACTIVE,
  Completed: PrismaTrialStatus.COMPLETED,
  Terminated: PrismaTrialStatus.TERMINATED,
  "Results pending": PrismaTrialStatus.RESULTS_PENDING
};

const australiaRegulatoryKindMap: Record<AustraliaRegulatoryKind, PrismaAustraliaRegulatoryKind> = {
  "AUST L": PrismaAustraliaRegulatoryKind.AUST_L,
  "AUST L(A)": PrismaAustraliaRegulatoryKind.AUST_LA,
  "AUST R": PrismaAustraliaRegulatoryKind.AUST_R,
  "Not in ARTG": PrismaAustraliaRegulatoryKind.NOT_IN_ARTG,
  Unapproved: PrismaAustraliaRegulatoryKind.UNAPPROVED,
  Exempt: PrismaAustraliaRegulatoryKind.EXEMPT,
  Excluded: PrismaAustraliaRegulatoryKind.EXCLUDED,
  Unknown: PrismaAustraliaRegulatoryKind.UNKNOWN
};

function sourceKind(source: string) {
  if (source.includes("PubMed")) {
    return PrismaSourceKind.PUBMED;
  }

  if (source.includes("ClinicalTrials")) {
    return PrismaSourceKind.CLINICALTRIALS_GOV;
  }

  if (source.includes("NIH")) {
    return PrismaSourceKind.NIH_ODS;
  }

  if (source.includes("FDA")) {
    return PrismaSourceKind.FDA;
  }

  if (source.includes("TGA")) {
    return PrismaSourceKind.TGA;
  }

  return PrismaSourceKind.OTHER;
}

function australiaStatusFor(interventionId: string, fallback: string) {
  if (interventionId === "bpc-157") {
    return "AU-first lens: unapproved peptide watchlist; check TGA safety alerts, ARTG status, and clinician/regulatory context.";
  }

  return `AU-first lens: verify ARTG/AUST L/AUST L(A)/AUST R status for products; ${fallback}`;
}

function dateOrNull(value?: string) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

const seedIngestionJobs = [
  {
    source: PrismaSourceKind.PUBMED,
    status: PrismaIngestionStatus.QUEUED,
    query: "creatine monohydrate strength randomized trial meta-analysis",
    region: "AU",
    metadata: {
      priority: "first-source-workflow",
      reason: "PubMed gives the fastest path to citation-backed evidence cards."
    }
  },
  {
    source: PrismaSourceKind.TGA,
    status: PrismaIngestionStatus.QUEUED,
    query: "safety alerts peptides complementary medicines",
    region: "AU",
    metadata: {
      priority: "regulatory-watch",
      reason: "Australia is the first regulatory lens."
    }
  }
];

async function main() {
  for (const intervention of interventions) {
    await prisma.intervention.upsert({
      where: { id: intervention.id },
      update: {
        slug: intervention.slug,
        name: intervention.name,
        synonyms: intervention.synonyms,
        category: categoryMap[intervention.category],
        commonForms: intervention.commonForms,
        regulatorySummary: intervention.regulatoryStatus,
        australiaRegulatoryStatus: australiaStatusFor(intervention.id, intervention.regulatoryStatus),
        safetySummary: intervention.safetySummary,
        interactionSummary: intervention.interactionSummary,
        evidenceSummary: intervention.evidenceSummary,
        lastReviewedAt: dateOrNull(intervention.lastReviewed)
      },
      create: {
        id: intervention.id,
        slug: intervention.slug,
        name: intervention.name,
        synonyms: intervention.synonyms,
        category: categoryMap[intervention.category],
        commonForms: intervention.commonForms,
        commonStudyDoses: [],
        consumerProductDoseRanges: [],
        regulatorySummary: intervention.regulatoryStatus,
        australiaRegulatoryStatus: australiaStatusFor(intervention.id, intervention.regulatoryStatus),
        safetySummary: intervention.safetySummary,
        interactionSummary: intervention.interactionSummary,
        evidenceSummary: intervention.evidenceSummary,
        lastReviewedAt: dateOrNull(intervention.lastReviewed)
      }
    });
  }

  for (const reference of references) {
    await prisma.reference.upsert({
      where: { id: reference.id },
      update: {
        title: reference.title,
        source: sourceKind(reference.source),
        identifier: reference.identifier,
        year: reference.year,
        url: reference.url
      },
      create: {
        id: reference.id,
        title: reference.title,
        source: sourceKind(reference.source),
        identifier: reference.identifier,
        year: reference.year,
        url: reference.url
      }
    });

    await prisma.sourceDocument.upsert({
      where: { url: reference.url },
      update: {
        referenceId: reference.id,
        title: reference.title,
        source: sourceKind(reference.source),
        extractedSummary: "Seed source placeholder; raw source extraction has not run yet."
      },
      create: {
        referenceId: reference.id,
        title: reference.title,
        source: sourceKind(reference.source),
        url: reference.url,
        extractedSummary: "Seed source placeholder; raw source extraction has not run yet."
      }
    });
  }

  for (const claim of claims) {
    await prisma.claim.upsert({
      where: { id: claim.id },
      update: {
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
        evidenceDirectnessScore: claim.scores.evidenceDirectness,
        evidenceRigorScore: claim.scores.evidenceRigor,
        effectSizeScore: claim.scores.effectSize,
        safetyScore: claim.scores.safety,
        regulatoryRiskScore: claim.scores.regulatoryRisk,
        productQualityScore: claim.scores.productQuality,
        hypePenalty: claim.scores.hypePenalty,
        measurabilityScore: claim.scores.measurability,
        finalLabel: evidenceLabelMap[claim.finalLabel],
        momentum: momentumMap[claim.momentum],
        reviewStatus: "UNREVIEWED_AI_DRAFT",
        whatWouldChangeScore: claim.whatWouldChangeScore,
        lastReviewedAt: dateOrNull(claim.lastUpdated)
      },
      create: {
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
        evidenceDirectnessScore: claim.scores.evidenceDirectness,
        evidenceRigorScore: claim.scores.evidenceRigor,
        effectSizeScore: claim.scores.effectSize,
        safetyScore: claim.scores.safety,
        regulatoryRiskScore: claim.scores.regulatoryRisk,
        productQualityScore: claim.scores.productQuality,
        hypePenalty: claim.scores.hypePenalty,
        measurabilityScore: claim.scores.measurability,
        finalLabel: evidenceLabelMap[claim.finalLabel],
        momentum: momentumMap[claim.momentum],
        reviewStatus: "UNREVIEWED_AI_DRAFT",
        whatWouldChangeScore: claim.whatWouldChangeScore,
        lastReviewedAt: dateOrNull(claim.lastUpdated)
      }
    });

    for (const referenceId of claim.keyReferenceIds) {
      await prisma.claimReference.upsert({
        where: {
          claimId_referenceId: {
            claimId: claim.id,
            referenceId
          }
        },
        update: {},
        create: {
          claimId: claim.id,
          referenceId,
          relevance: 8
        }
      });
    }
  }

  for (const study of studies) {
    const reference = references.find((item) => item.id === study.referenceId);

    await prisma.study.upsert({
      where: { id: study.id },
      update: {
        referenceId: study.referenceId,
        title: study.title,
        year: study.year,
        source: study.source,
        sourceType: studyTypeMap[study.studyType],
        url: reference?.url,
        sampleSize: study.sampleSize,
        population: study.population,
        interventionName: study.intervention,
        outcomes: study.outcomes,
        adverseEvents: study.adverseEvents,
        fundingConflicts: study.fundingConflicts,
        riskOfBias: study.riskOfBias
      },
      create: {
        id: study.id,
        referenceId: study.referenceId,
        title: study.title,
        year: study.year,
        source: study.source,
        sourceType: studyTypeMap[study.studyType],
        pmid: reference?.identifier?.startsWith("PMID:") ? reference.identifier.replace("PMID:", "").trim() : null,
        url: reference?.url,
        sampleSize: study.sampleSize,
        population: study.population,
        interventionName: study.intervention,
        outcomes: study.outcomes,
        adverseEvents: study.adverseEvents,
        fundingConflicts: study.fundingConflicts,
        riskOfBias: study.riskOfBias
      }
    });
  }

  for (const trial of trialWatchItems) {
    await prisma.trial.upsert({
      where: { id: trial.id },
      update: {
        interventionId: trial.interventionId,
        title: trial.title,
        status: trialStatusMap[trial.status],
        phase: trial.phase,
        enrollment: trial.enrollment,
        lastUpdateDate: dateOrNull(trial.lastUpdateDate),
        evidenceImpact: momentumMap[trial.evidenceImpact],
        url: trial.url
      },
      create: {
        id: trial.id,
        interventionId: trial.interventionId,
        title: trial.title,
        status: trialStatusMap[trial.status],
        phase: trial.phase,
        enrollment: trial.enrollment,
        conditions: [],
        interventions: [],
        outcomes: [],
        lastUpdateDate: dateOrNull(trial.lastUpdateDate),
        evidenceImpact: momentumMap[trial.evidenceImpact],
        url: trial.url
      }
    });
  }

  for (const alert of safetyAlerts) {
    await prisma.safetyAlert.upsert({
      where: { id: alert.id },
      update: {
        interventionId: alert.interventionId,
        region: alert.source === "TGA" ? "AU" : alert.region,
        agency: sourceKind(alert.source),
        date: dateOrNull(alert.date),
        alertType: alertTypeMap[alert.alertType],
        severity: severityMap[alert.severity],
        summary: alert.summary,
        url: alert.url,
        lastCheckedAt: dateOrNull(alert.lastChecked)
      },
      create: {
        id: alert.id,
        interventionId: alert.interventionId,
        region: alert.source === "TGA" ? "AU" : alert.region,
        agency: sourceKind(alert.source),
        date: dateOrNull(alert.date),
        alertType: alertTypeMap[alert.alertType],
        severity: severityMap[alert.severity],
        summary: alert.summary,
        url: alert.url,
        lastCheckedAt: dateOrNull(alert.lastChecked)
      }
    });
  }

  for (const product of productSignals) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: {
        name: product.name,
        brand: product.brand,
        ingredientsJson: product.ingredients,
        proprietaryBlend: product.proprietaryBlend,
        certificationsJson: product.certifications,
        region: product.region === "US" ? "AU-ready" : product.region,
        qualityScore: product.qualityScore,
        labelClaimRiskScore: product.labelClaimRiskScore
      },
      create: {
        id: product.id,
        name: product.name,
        brand: product.brand,
        ingredientsJson: product.ingredients,
        proprietaryBlend: product.proprietaryBlend,
        certificationsJson: product.certifications,
        region: product.region === "US" ? "AU-ready" : product.region,
        qualityScore: product.qualityScore,
        labelClaimRiskScore: product.labelClaimRiskScore
      }
    });
  }

  for (const status of australiaRegulatoryStatuses) {
    await prisma.australiaRegulatoryStatus.upsert({
      where: { id: status.id },
      update: {
        interventionId: status.interventionId,
        productId: status.productId,
        referenceId: status.referenceId,
        region: status.region,
        kind: australiaRegulatoryKindMap[status.kind],
        artgId: status.artgId,
        austNumber: status.austNumber,
        sponsor: status.sponsor,
        status: status.status,
        efficacyAssessed: status.efficacyAssessed,
        preMarketAssessment: status.preMarketAssessment,
        supplySummary: status.supplySummary,
        evidenceRequirement: status.evidenceRequirement,
        sourceUrl: status.sourceUrl,
        checkedAt: dateOrNull(status.checkedAt),
        notes: status.notes
      },
      create: {
        id: status.id,
        interventionId: status.interventionId,
        productId: status.productId,
        referenceId: status.referenceId,
        region: status.region,
        kind: australiaRegulatoryKindMap[status.kind],
        artgId: status.artgId,
        austNumber: status.austNumber,
        sponsor: status.sponsor,
        status: status.status,
        efficacyAssessed: status.efficacyAssessed,
        preMarketAssessment: status.preMarketAssessment,
        supplySummary: status.supplySummary,
        evidenceRequirement: status.evidenceRequirement,
        sourceUrl: status.sourceUrl,
        checkedAt: dateOrNull(status.checkedAt),
        notes: status.notes
      }
    });
  }

  await prisma.ingestionJob.createMany({
    data: seedIngestionJobs,
    skipDuplicates: true
  });

  await assertDatabaseSeedIntegrity();
}

async function assertDatabaseSeedIntegrity() {
  const [
    dbReferences,
    dbInterventions,
    dbClaims,
    dbClaimReferences,
    dbStudies,
    dbTrials,
    dbSafetyAlerts,
    dbProducts,
    dbAustraliaRegulatoryStatuses,
    dbIngestionJobs
  ] = await Promise.all([
    prisma.reference.findMany({ select: { id: true } }),
    prisma.intervention.findMany({ select: { id: true } }),
    prisma.claim.findMany({ select: { id: true } }),
    prisma.claimReference.findMany({ select: { claimId: true, referenceId: true } }),
    prisma.study.findMany({ select: { id: true } }),
    prisma.trial.findMany({ select: { id: true } }),
    prisma.safetyAlert.findMany({ select: { id: true } }),
    prisma.product.findMany({ select: { id: true } }),
    prisma.australiaRegulatoryStatus.findMany({ select: { id: true } }),
    prisma.ingestionJob.findMany({ select: { source: true, query: true, region: true } })
  ]);

  assertSeedIntegrity([
    seedCollection("Reference", ids(references), ids(dbReferences), [
      "issn-",
      "ods-",
      "fda-",
      "tga-",
      "ncbi-",
      "clinicaltrials-"
    ]),
    seedCollection("Intervention", ids(interventions), ids(dbInterventions)),
    seedCollection("Claim", ids(claims), ids(dbClaims), [
      "creatine-",
      "vitamin-d-",
      "omega-3-",
      "bpc-157-"
    ]),
    seedCollection(
      "ClaimReference",
      claims.flatMap((claim) =>
        claim.keyReferenceIds.map((referenceId) => claimReferenceKey(claim.id, referenceId))
      ),
      dbClaimReferences.map((reference) =>
        claimReferenceKey(reference.claimId, reference.referenceId)
      ),
      ["creatine-", "vitamin-d-", "omega-3-", "bpc-157-"]
    ),
    seedCollection("Study", ids(studies), ids(dbStudies), ["study-"]),
    seedCollection("Trial", ids(trialWatchItems), ids(dbTrials), ["trial-", "pubmed-"]),
    seedCollection("SafetyAlert", ids(safetyAlerts), ids(dbSafetyAlerts), [
      "tga-",
      "bpc-157-",
      "omega-3-",
      "vitamin-d-"
    ]),
    seedCollection("Product", ids(productSignals), ids(dbProducts), ["seed-"]),
    seedCollection(
      "AustraliaRegulatoryStatus",
      ids(australiaRegulatoryStatuses),
      ids(dbAustraliaRegulatoryStatuses),
      ["au-reg-"]
    ),
    seedCollection(
      "IngestionJob",
      seedIngestionJobs.map(ingestionJobKey),
      dbIngestionJobs.map(ingestionJobKey)
    )
  ]);

  console.log("Seed integrity verified.");
}

function seedCollection(
  name: string,
  expectedIds: readonly string[],
  actualIds: readonly string[],
  seedOwnedPrefixes?: readonly string[]
): SeedIntegrityCollection {
  return {
    name,
    expectedIds,
    actualIds,
    seedOwnedPrefixes
  };
}

function ids(items: readonly { id: string }[]) {
  return items.map((item) => item.id);
}

function claimReferenceKey(claimId: string, referenceId: string) {
  return `${claimId}:${referenceId}`;
}

function ingestionJobKey(job: { source: string; query: string; region: string }) {
  return `${job.source}:${job.region}:${job.query}`;
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
