import { readFileSync } from "node:fs";

import {
  AustraliaRegulatoryKind as DbAustraliaRegulatoryKind,
  ConfidenceLevel as DbConfidenceLevel,
  EvidenceLabel as DbEvidenceLabel,
  EvidenceMomentum as DbEvidenceMomentum,
  InterventionCategory as DbInterventionCategory,
  OutcomeArea as DbOutcomeArea,
  ReviewStatus as DbReviewStatus,
  TrialStatus as DbTrialStatus,
  type Prisma
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { loadEnvFile, mergeEnv, withProcessEnv } from "@/lib/env-file";
import {
  buildSupplementOnboardingPlan,
  type SupplementOnboardingInput,
  type SupplementOnboardingPlan
} from "@/lib/supplement-onboarding";
import { buildSupplementOnboardingSeedDiffReport } from "@/lib/supplement-onboarding-seed-diff";
import type {
  ConfidenceLevel,
  EvidenceLabel,
  EvidenceMomentum,
  InterventionCategory,
  OutcomeArea
} from "@/lib/types";

const IMPORT_NOTE =
  "Local catalog expansion batch (2026-06-24); draft claims only - verify before public promotion.";

const categoryMap: Record<InterventionCategory, DbInterventionCategory> = {
  "Vitamin/mineral": DbInterventionCategory.VITAMIN_MINERAL,
  "Fatty acid": DbInterventionCategory.FATTY_ACID,
  "Amino acid": DbInterventionCategory.AMINO_ACID,
  "Botanical/herbal": DbInterventionCategory.BOTANICAL_HERBAL,
  "Fiber/prebiotic/probiotic": DbInterventionCategory.FIBER_PREBIOTIC_PROBIOTIC,
  "Ergogenic/performance supplement": DbInterventionCategory.ERGOGENIC_PERFORMANCE_SUPPLEMENT,
  Nootropic: DbInterventionCategory.NOOTROPIC,
  "Hormonal/endocrine intervention": DbInterventionCategory.HORMONAL_ENDOCRINE_INTERVENTION,
  "Peptide/biologic": DbInterventionCategory.PEPTIDE_BIOLOGIC,
  "Drug/geroprotector watchlist": DbInterventionCategory.DRUG_GEROPROTECTOR_WATCHLIST,
  "Food/beverage": DbInterventionCategory.FOOD_BEVERAGE
};

const outcomeMap: Record<OutcomeArea, DbOutcomeArea> = {
  "Mortality/lifespan": DbOutcomeArea.MORTALITY_LIFESPAN,
  "Cardiovascular events": DbOutcomeArea.CARDIOVASCULAR_EVENTS,
  "LDL/ApoB/lipids": DbOutcomeArea.LDL_APOB_LIPIDS,
  "Blood pressure": DbOutcomeArea.BLOOD_PRESSURE,
  "Glucose/insulin/HbA1c": DbOutcomeArea.GLUCOSE_INSULIN_HBA1C,
  Inflammation: DbOutcomeArea.INFLAMMATION,
  Cognition: DbOutcomeArea.COGNITION,
  Sleep: DbOutcomeArea.SLEEP,
  "Mood/stress": DbOutcomeArea.MOOD_STRESS,
  "Muscle/strength": DbOutcomeArea.MUSCLE_STRENGTH,
  "VO2 max/endurance": DbOutcomeArea.VO2_MAX_ENDURANCE,
  "Joint/tendon/skin": DbOutcomeArea.JOINT_TENDON_SKIN,
  "Eye health": DbOutcomeArea.EYE_HEALTH,
  "Immune/respiratory": DbOutcomeArea.IMMUNE_RESPIRATORY,
  "Fertility/hormones": DbOutcomeArea.FERTILITY_HORMONES,
  "Biological aging clocks": DbOutcomeArea.BIOLOGICAL_AGING_CLOCKS,
  "Safety/adverse effects": DbOutcomeArea.SAFETY_ADVERSE_EFFECTS
};

const confidenceMap: Record<ConfidenceLevel, DbConfidenceLevel> = {
  High: DbConfidenceLevel.HIGH,
  Moderate: DbConfidenceLevel.MODERATE,
  Low: DbConfidenceLevel.LOW,
  "Very low": DbConfidenceLevel.VERY_LOW
};

const evidenceLabelMap: Record<EvidenceLabel, DbEvidenceLabel> = {
  "Core Evidence-Based": DbEvidenceLabel.CORE_EVIDENCE_BASED,
  "Conditional / Biomarker-Gated": DbEvidenceLabel.CONDITIONAL_BIOMARKER_GATED,
  "Useful for Specific Use Case": DbEvidenceLabel.USEFUL_FOR_SPECIFIC_USE_CASE,
  "Reasonable N-of-1 Experiment": DbEvidenceLabel.REASONABLE_N_OF_1_EXPERIMENT,
  "Speculative Watchlist": DbEvidenceLabel.SPECULATIVE_WATCHLIST,
  "Safety Concern": DbEvidenceLabel.SAFETY_CONCERN,
  "Avoid / Not Recommended": DbEvidenceLabel.AVOID_NOT_RECOMMENDED,
  "Requires Clinician Oversight": DbEvidenceLabel.REQUIRES_CLINICIAN_OVERSIGHT,
  "Regulatory Concern": DbEvidenceLabel.REGULATORY_CONCERN,
  "Insufficient Evidence": DbEvidenceLabel.INSUFFICIENT_EVIDENCE,
};

const momentumMap: Record<EvidenceMomentum, DbEvidenceMomentum> = {
  Increasing: DbEvidenceMomentum.INCREASING,
  Stable: DbEvidenceMomentum.STABLE,
  Conflicting: DbEvidenceMomentum.CONFLICTING,
  Weakening: DbEvidenceMomentum.WEAKENING,
  "Safety concern emerging": DbEvidenceMomentum.SAFETY_CONCERN_EMERGING
};

async function main() {
  const args = process.argv.slice(2);
  const forceBlocked = args.includes("--force-blocked");
  const batchFilePath =
    args.find((arg) => arg.startsWith("--batch-file="))?.slice("--batch-file=".length) ??
    "docs/codex/onboarding/batch/catalog-expansion-20260624.json";

  const env = mergeEnv(process.env, loadEnvFile(".env.local").env);

  await withProcessEnv(env, async () => {
    const supplements = readBatchFile(batchFilePath);
    const importedAt = new Date();
    const plans = supplements.map((input) => buildSupplementOnboardingPlan(input));
    const existingData = await existingDatabaseIdsForPlans(plans);
    const seedDiff = buildSupplementOnboardingSeedDiffReport({
      existingData,
      generatedAt: importedAt,
      plans
    });

    const imported: Array<{
      claimCount: number;
      claimIds: string[];
      interventionId: string;
      name: string;
    }> = [];
    const skipped: Array<{ interventionId: string; reason: string }> = [];

    for (const item of seedDiff.items) {
      const plan = plans.find((candidate) => candidate.interventionDraft.id === item.interventionId);
      const category = plan?.interventionDraft.category;
      const alreadyExists = existingData.interventions.some(
        (intervention) => intervention.id === item.interventionId
      );

      if (alreadyExists) {
        skipped.push({
          interventionId: item.interventionId,
          reason: "Intervention already exists in database."
        });
        continue;
      }

      if (item.importPlan.status === "blocked" && !forceBlocked) {
        skipped.push({
          interventionId: item.interventionId,
          reason: item.blockers[0] ?? "blocked"
        });
        continue;
      }

      if (!plan || !category) {
        skipped.push({
          interventionId: item.interventionId,
          reason: "Missing category on onboarding plan."
        });
        continue;
      }

      await persistPlan(plan, category, importedAt);
      await ensureTrialPlaceholder(plan.interventionDraft.id, plan.interventionDraft.name);

      imported.push({
        claimCount: plan.claimDrafts.length,
        claimIds: plan.claimDrafts.map((claim) => claim.id),
        interventionId: plan.interventionDraft.id,
        name: plan.interventionDraft.name
      });
    }

    const [interventionCount, claimCount] = await Promise.all([
      prisma.intervention.count(),
      prisma.claim.count()
    ]);

    console.log(
      JSON.stringify(
        {
          batchFilePath,
          importNote: IMPORT_NOTE,
          imported,
          skipped,
          totals: { interventions: interventionCount, claims: claimCount }
        },
        null,
        2
      )
    );
  });
}

function readBatchFile(filePath: string): SupplementOnboardingInput[] {
  const raw = readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as unknown;
  const supplements = Array.isArray(parsed)
    ? parsed
    : parsed &&
        typeof parsed === "object" &&
        Array.isArray((parsed as { supplements?: unknown }).supplements)
      ? (parsed as { supplements: SupplementOnboardingInput[] }).supplements
      : undefined;

  if (!supplements) {
    throw new Error("Batch file must contain supplements[].");
  }

  return supplements;
}

async function existingDatabaseIdsForPlans(plans: SupplementOnboardingPlan[]) {
  const interventionIds = [...new Set(plans.map((plan) => plan.interventionDraft.id))];
  const claimIds = [...new Set(plans.flatMap((plan) => plan.claimDrafts.map((claim) => claim.id)))];
  const regulatoryStatusIds = interventionIds.map((id) => `${id}-au-status`);

  const [interventions, claims, australiaRegulatoryStatuses] = await Promise.all([
    prisma.intervention.findMany({
      select: { id: true },
      where: { id: { in: interventionIds } }
    }),
    prisma.claim.findMany({
      select: { id: true },
      where: { id: { in: claimIds } }
    }),
    prisma.australiaRegulatoryStatus.findMany({
      select: { id: true },
      where: { id: { in: regulatoryStatusIds } }
    })
  ]);

  return { interventions, claims, australiaRegulatoryStatuses };
}

async function persistPlan(
  plan: SupplementOnboardingPlan,
  category: InterventionCategory,
  importedAt: Date
) {
  const interventionId = plan.interventionDraft.id;
  const regulatoryStatusId = `${interventionId}-au-status`;

  await prisma.$transaction(async (tx) => {
    await tx.intervention.create({
      data: interventionCreateData(plan, category)
    });
    await tx.claim.createMany({
      data: plan.claimDrafts.map((claim) =>
        claimCreateData({
          claim,
          importedAt,
          interventionId,
          interventionName: plan.interventionDraft.name
        })
      )
    });
    await tx.australiaRegulatoryStatus.create({
      data: regulatoryStatusCreateData({
        importedAt,
        interventionId,
        plan,
        regulatoryStatusId
      })
    });
  });
}

async function ensureTrialPlaceholder(interventionId: string, interventionName: string) {
  const existing = await prisma.trial.findFirst({
    where: { interventionId }
  });

  if (existing) {
    return;
  }

  await prisma.trial.create({
    data: {
      id: `trial-watch-${interventionId}`,
      interventionId,
      title: `${interventionName} — registry monitoring placeholder`,
      status: DbTrialStatus.RESULTS_PENDING,
      phase: "Not linked",
      enrollment: "Not linked",
      conditions: ["Evidence monitoring"],
      interventions: [interventionName],
      outcomes: ["Pending curated trial linkage"],
      evidenceImpact: DbEvidenceMomentum.STABLE,
      url: "https://clinicaltrials.gov/",
      resultsPosted: false,
      lastUpdateDate: new Date()
    }
  });
}

function interventionCreateData(
  plan: SupplementOnboardingPlan,
  category: InterventionCategory
): Prisma.InterventionCreateInput {
  return {
    australiaRegulatoryStatus: plan.interventionDraft.regulatoryStatus,
    category: categoryMap[category],
    commonForms: plan.interventionDraft.commonForms,
    commonStudyDoses: [],
    consumerProductDoseRanges: [],
    evidenceSummary: plan.interventionDraft.evidenceSummary,
    id: plan.interventionDraft.id,
    interactionSummary: plan.interventionDraft.interactionSummary,
    lastReviewedAt: null,
    name: plan.interventionDraft.name,
    regulatorySummary: plan.interventionDraft.regulatoryStatus,
    safetySummary: plan.interventionDraft.safetySummary,
    slug: plan.interventionDraft.slug,
    synonyms: plan.interventionDraft.synonyms
  };
}

function claimCreateData({
  claim,
  importedAt,
  interventionId,
  interventionName
}: {
  claim: SupplementOnboardingPlan["claimDrafts"][number];
  importedAt: Date;
  interventionId: string;
  interventionName: string;
}): Prisma.ClaimCreateManyInput {
  return {
    applicabilityNotes:
      "Draft onboarding claim. Do not treat as public evidence until reviewed.",
    claimText: claim.claimText,
    clinicalRelevance: "Not established until source review.",
    comparator: "Not reviewed yet.",
    confidenceLevel: confidenceMap["Very low"],
    doseFormStudied: "Not reviewed yet; do not add dosing guidance without source review.",
    durationStudied: "Not reviewed yet.",
    effectSize: "Unknown until source review.",
    effectSizeScore: 1,
    evidenceDirectnessScore: 1,
    evidenceGrade: "Insufficient until source packets are reviewed.",
    evidenceRigorScore: 1,
    finalLabel: evidenceLabelMap["Insufficient Evidence"],
    hypePenalty: 5,
    id: claim.id,
    interventionId,
    lastReviewedAt: null,
    measurabilityScore: 3,
    momentum: momentumMap.Stable,
    outcome: outcomeMap[claim.outcome],
    populationStudied: "Not reviewed yet.",
    productQualityScore: 1,
    regulatoryRiskScore: 5,
    reviewStatus: DbReviewStatus.UNREVIEWED_AI_DRAFT,
    safetyNotes: `${interventionName} safety and interactions are not reviewed yet.`,
    safetyScore: 3,
    summary: undefined,
    uncertainty: `${IMPORT_NOTE} Imported on ${importedAt.toISOString()}; citation traceability and claim packet review are still required.`,
    whatWouldChangeScore:
      "Reviewed human evidence with citation traceability, structured extraction, safety context, and AU/TGA product-level review where relevant."
  };
}

function regulatoryStatusCreateData({
  importedAt,
  interventionId,
  plan,
  regulatoryStatusId
}: {
  importedAt: Date;
  interventionId: string;
  plan: SupplementOnboardingPlan;
  regulatoryStatusId: string;
}): Prisma.AustraliaRegulatoryStatusCreateInput {
  return {
    checkedAt: importedAt,
    efficacyAssessed: false,
    evidenceRequirement: plan.regulatoryDraft.evidenceRequirement,
    id: regulatoryStatusId,
    intervention: {
      connect: {
        id: interventionId
      }
    },
    kind: DbAustraliaRegulatoryKind.UNKNOWN,
    notes: `${plan.regulatoryDraft.notes} Local batch import; product-level AU/TGA status remains unreviewed.`,
    preMarketAssessment: false,
    region: "AU",
    sourceUrl:
      "https://www.tga.gov.au/products/regulations-all-products/about-australian-register-therapeutic-goods-artg",
    status: plan.regulatoryDraft.status,
    supplySummary: plan.regulatoryDraft.supplySummary
  };
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
