import {
  AustraliaRegulatoryKind as DbAustraliaRegulatoryKind,
  ConfidenceLevel as DbConfidenceLevel,
  EvidenceLabel as DbEvidenceLabel,
  EvidenceMomentum as DbEvidenceMomentum,
  InterventionCategory as DbInterventionCategory,
  OutcomeArea as DbOutcomeArea,
  ReviewStatus as DbReviewStatus,
  SupplementOnboardingDraftStatus,
  type Prisma
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type { OperatorPrincipal, OperatorWriteEnv } from "@/lib/operator/authorization";
import {
  OperatorAuthorizationError,
  requireOperatorPermission
} from "@/lib/operator/authorization";
import { recordOperatorAuditEvent } from "@/lib/operator/audit";
import {
  australiaRegulatoryStatuses,
  claims,
  interventions
} from "@/lib/seed-data";
import {
  type SupplementOnboardingPlan,
  buildSupplementOnboardingPlan,
  type SupplementOnboardingInput
} from "@/lib/supplement-onboarding";
import {
  buildSupplementOnboardingSeedDiffReport,
  type SupplementOnboardingDraftImportPlan
} from "@/lib/supplement-onboarding-seed-diff";
import type {
  ConfidenceLevel,
  EvidenceLabel,
  EvidenceMomentum,
  InterventionCategory,
  OutcomeArea
} from "@/lib/types";

export interface SaveSupplementOnboardingDraftInput extends SupplementOnboardingInput {
  note?: string;
}

export interface SavedSupplementOnboardingDraft {
  action: "created" | "updated";
  blockingReviewItems: string[];
  claimCount: number;
  createdAt: string;
  guardrailWarnings: string[];
  id: string;
  name: string;
  slug: string;
  status: "DRAFT";
  updatedAt: string;
}

export interface ImportSupplementOnboardingDraftInput {
  draftId: string;
  importedAt?: Date;
  importNote: string;
}

export interface SupplementOnboardingDatabaseImportEnv extends OperatorWriteEnv {
  APEX_ONBOARDING_DATABASE_IMPORT_ENABLED?: string;
  APEX_ONBOARDING_DATABASE_IMPORT_REVIEWED_AT?: string;
}

export type SupplementOnboardingDatabaseImportActionStatus =
  | "blocked"
  | "ready-for-import"
  | "review-required";

export interface SupplementOnboardingDatabaseImportAction {
  blockerCount: number;
  blockers: string[];
  claimCount: number;
  claimIds: string[];
  enabledWhenGateSatisfied: boolean;
  importedRowPreview: {
    australiaRegulatoryStatuses: 1;
    claims: number;
    interventions: 1;
  };
  interventionId?: string;
  nextAction: string;
  noAutoPromotion: true;
  noCandidateDecision: true;
  noClaimReview: true;
  noConnectorApproval: true;
  noExtractionWrite: true;
  noFullTextFetch: true;
  permission: "onboarding:import";
  publicVisibilityWarning: string;
  regulatoryStatusId?: string;
  requiresImportNote: true;
  requiresOperatorBrowserGate: true;
  status: SupplementOnboardingDatabaseImportActionStatus;
  supportedNow: true;
  warnings: string[];
}

export interface ImportedSupplementOnboardingDraft {
  action: "imported";
  claimCount: number;
  claimIds: string[];
  draftId: string;
  draftStatus: "READY_FOR_REVIEW";
  importedAt: string;
  interventionId: string;
  noAutoPromotion: true;
  noCandidateDecision: true;
  noClaimReview: true;
  noConnectorApproval: true;
  noExtractionWrite: true;
  noFullTextFetch: true;
  publicVisibilityWarning: string;
  regulatoryStatusId: string;
}

export interface SupplementOnboardingDraftReviewRow {
  blockerCount: number;
  claimCount: number;
  createdByEmail: string;
  databaseImportAction: SupplementOnboardingDatabaseImportAction;
  draftStatus: SupplementOnboardingDraftStatus;
  id: string;
  importPlan: SupplementOnboardingDraftImportPlan;
  name: string;
  nextAction: string;
  privateDraft: true;
  readOnly: true;
  slug: string;
  updatedAt: string;
  warningCount: number;
}

export interface SupplementOnboardingDraftReviewSnapshot {
  generatedAt: string;
  humanOwned: true;
  limit: number;
  noAutoPromotion: true;
  noAutoWrite: true;
  noDatabaseWrite: true;
  noPublicEvidenceRowsWritten: true;
  readOnly: true;
  rows: SupplementOnboardingDraftReviewRow[];
  summary: {
    blocked: number;
    databaseImportBlocked: number;
    databaseImportReady: number;
    databaseImportReviewRequired: number;
    databaseImportSupported: true;
    drafts: number;
    readyForManualSeedCopy: number;
    reviewRequired: number;
  };
}

const categoryMap: Record<InterventionCategory, DbInterventionCategory> = {
  "Vitamin/mineral": DbInterventionCategory.VITAMIN_MINERAL,
  "Fatty acid": DbInterventionCategory.FATTY_ACID,
  "Amino acid": DbInterventionCategory.AMINO_ACID,
  "Botanical/herbal": DbInterventionCategory.BOTANICAL_HERBAL,
  "Fiber/prebiotic/probiotic": DbInterventionCategory.FIBER_PREBIOTIC_PROBIOTIC,
  "Ergogenic/performance supplement":
    DbInterventionCategory.ERGOGENIC_PERFORMANCE_SUPPLEMENT,
  Nootropic: DbInterventionCategory.NOOTROPIC,
  "Hormonal/endocrine intervention":
    DbInterventionCategory.HORMONAL_ENDOCRINE_INTERVENTION,
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
  "Insufficient Evidence": DbEvidenceLabel.INSUFFICIENT_EVIDENCE
};

const momentumMap: Record<EvidenceMomentum, DbEvidenceMomentum> = {
  Increasing: DbEvidenceMomentum.INCREASING,
  Stable: DbEvidenceMomentum.STABLE,
  Conflicting: DbEvidenceMomentum.CONFLICTING,
  Weakening: DbEvidenceMomentum.WEAKENING,
  "Safety concern emerging": DbEvidenceMomentum.SAFETY_CONCERN_EMERGING
};

const PUBLIC_VISIBILITY_WARNING =
  "Database-backed public dashboards may display imported rows as unreviewed draft claims; import only after accepting that draft status, uncertainty labels, and AU/TGA Unknown framing are appropriate.";

const existingSeedData = {
  australiaRegulatoryStatuses: australiaRegulatoryStatuses.map((status) => ({
    id: status.id
  })),
  claims: claims.map((claim) => ({
    id: claim.id
  })),
  interventions: interventions.map((intervention) => ({
    id: intervention.id
  }))
};

export async function getSupplementOnboardingDraftReviewSnapshot(
  limit = 5,
  generatedAt = new Date()
): Promise<SupplementOnboardingDraftReviewSnapshot> {
  const cappedLimit = Math.max(1, Math.min(20, Math.trunc(limit)));
  const generatedAtIso = generatedAt.toISOString();
  const drafts = await prisma.supplementOnboardingDraft.findMany({
    orderBy: {
      updatedAt: "desc"
    },
    select: {
      blockingReviewItems: true,
      createdByEmail: true,
      guardrailWarnings: true,
      id: true,
      name: true,
      plan: true,
      slug: true,
      status: true,
      updatedAt: true
    },
    take: cappedLimit
  });
  const parsedDrafts = drafts.map((draft) => ({
    draft,
    plan: supplementOnboardingPlanFromJson(draft.plan)
  }));
  const existingDatabaseData = await existingDatabaseIdsForPlans(
    parsedDrafts.flatMap((item) => (item.plan ? [item.plan] : []))
  );
  const rows = parsedDrafts.map(({ draft, plan }) => {
    const importPlan = plan
      ? buildSupplementOnboardingSeedDiffReport({
          existingData: existingSeedData,
          generatedAt,
          plans: [plan]
        }).items[0].importPlan
      : unreadablePlanImportPlan();
    const databaseImportAction = plan
      ? databaseImportActionForPlan({
          existingData: existingDatabaseData,
          generatedAt,
          plan
        })
      : unreadablePlanDatabaseImportAction();

    return {
      blockerCount: draft.blockingReviewItems.length,
      claimCount: plan?.claimDrafts.length ?? 0,
      createdByEmail: draft.createdByEmail,
      databaseImportAction,
      draftStatus: draft.status,
      id: draft.id,
      importPlan,
      name: draft.name,
      nextAction: savedDraftNextAction({
        blockerCount: draft.blockingReviewItems.length,
        importPlan,
        planReadable: Boolean(plan)
      }),
      privateDraft: true,
      readOnly: true,
      slug: draft.slug,
      updatedAt: draft.updatedAt.toISOString(),
      warningCount: draft.guardrailWarnings.length
    } satisfies SupplementOnboardingDraftReviewRow;
  });

  return {
    generatedAt: generatedAtIso,
    humanOwned: true,
    limit: cappedLimit,
    noAutoPromotion: true,
    noAutoWrite: true,
    noDatabaseWrite: true,
    noPublicEvidenceRowsWritten: true,
    readOnly: true,
    rows,
    summary: {
      blocked: rows.filter((row) => row.importPlan.status === "blocked").length,
      databaseImportBlocked: rows.filter(
        (row) => row.databaseImportAction.status === "blocked"
      ).length,
      databaseImportReady: rows.filter(
        (row) => row.databaseImportAction.status === "ready-for-import"
      ).length,
      databaseImportReviewRequired: rows.filter(
        (row) => row.databaseImportAction.status === "review-required"
      ).length,
      databaseImportSupported: true,
      drafts: rows.length,
      readyForManualSeedCopy: rows.filter(
        (row) => row.importPlan.status === "ready-for-manual-seed-copy"
      ).length,
      reviewRequired: rows.filter((row) => row.importPlan.status === "review-required")
        .length
    }
  };
}

export async function saveSupplementOnboardingDraftAsOperator(
  principal: OperatorPrincipal,
  input: SaveSupplementOnboardingDraftInput,
  env?: OperatorWriteEnv
): Promise<SavedSupplementOnboardingDraft> {
  requireOperatorPermission(principal, "onboarding:draft", env);

  const plan = buildSupplementOnboardingPlan(input);
  const slug = plan.interventionDraft.slug;
  const before = await prisma.supplementOnboardingDraft.findUnique({
    select: {
      blockingReviewItems: true,
      guardrailWarnings: true,
      id: true,
      name: true,
      status: true,
      updatedAt: true
    },
    where: {
      slug
    }
  });
  const savedInput = serializableJson({
    category: input.category,
    claimTemplateIds: input.claimTemplateIds ?? [],
    claims: input.claims ?? [],
    commonForms: input.commonForms ?? [],
    generatedAt: plan.generatedAt,
    name: input.name,
    product: input.product,
    region: input.region ?? plan.region,
    synonyms: input.synonyms ?? []
  });
  const savedPlan = serializableJson(plan);
  const draft = await prisma.supplementOnboardingDraft.upsert({
    create: {
      blockingReviewItems: plan.blockingReviewItems,
      category: plan.interventionDraft.category
        ? categoryMap[plan.interventionDraft.category]
        : undefined,
      createdByEmail: principal.email,
      createdByUserId: principal.userId,
      guardrailWarnings: plan.guardrailWarnings,
      input: savedInput,
      name: plan.interventionDraft.name,
      plan: savedPlan,
      region: plan.region,
      slug,
      status: SupplementOnboardingDraftStatus.DRAFT
    },
    select: {
      blockingReviewItems: true,
      createdAt: true,
      guardrailWarnings: true,
      id: true,
      name: true,
      slug: true,
      status: true,
      updatedAt: true
    },
    update: {
      blockingReviewItems: plan.blockingReviewItems,
      category: plan.interventionDraft.category
        ? categoryMap[plan.interventionDraft.category]
        : null,
      guardrailWarnings: plan.guardrailWarnings,
      input: savedInput,
      name: plan.interventionDraft.name,
      plan: savedPlan,
      region: plan.region,
      status: SupplementOnboardingDraftStatus.DRAFT
    },
    where: {
      slug
    }
  });
  const action = before ? "updated" : "created";

  await recordOperatorAuditEvent(principal, {
    action: "supplementOnboarding.draftSaved",
    afterSummary: {
      blockingReviewItems: draft.blockingReviewItems.length,
      claimCount: plan.claimDrafts.length,
      guardrailWarnings: draft.guardrailWarnings.length,
      status: draft.status
    },
    beforeSummary: before
      ? {
          blockingReviewItems: before.blockingReviewItems.length,
          guardrailWarnings: before.guardrailWarnings.length,
          name: before.name,
          status: before.status,
          updatedAt: before.updatedAt.toISOString()
        }
      : undefined,
    metadata: {
      claimTemplateIds: plan.claimTemplateIds,
      interventionId: plan.interventionDraft.id,
      noPublicEvidenceRowsWritten: true,
      productStatusGapCount: plan.productStatusAssistant.gapAssessment.length,
      productStatusTarget: plan.productStatusAssistant.target,
      region: plan.region
    },
    note: input.note,
    targetId: slug,
    targetType: "SupplementOnboardingDraft"
  });

  return {
    action,
    blockingReviewItems: draft.blockingReviewItems,
    claimCount: plan.claimDrafts.length,
    createdAt: draft.createdAt.toISOString(),
    guardrailWarnings: draft.guardrailWarnings,
    id: draft.id,
    name: draft.name,
    slug: draft.slug,
    status: "DRAFT",
    updatedAt: draft.updatedAt.toISOString()
  };
}

export async function importSupplementOnboardingDraftAsOperator(
  principal: OperatorPrincipal,
  input: ImportSupplementOnboardingDraftInput,
  env: SupplementOnboardingDatabaseImportEnv = {
    APEX_ONBOARDING_DATABASE_IMPORT_ENABLED:
      process.env.APEX_ONBOARDING_DATABASE_IMPORT_ENABLED,
    APEX_ONBOARDING_DATABASE_IMPORT_REVIEWED_AT:
      process.env.APEX_ONBOARDING_DATABASE_IMPORT_REVIEWED_AT,
    APEX_OPERATOR_WRITES_ENABLED: process.env.APEX_OPERATOR_WRITES_ENABLED
  }
): Promise<ImportedSupplementOnboardingDraft> {
  requireOperatorPermission(principal, "onboarding:import", env);
  requireDatabaseImportGate(env);

  const importNote = input.importNote.trim();

  if (!importNote) {
    throw new Error("importNote is required.");
  }

  const importedAt = input.importedAt ?? new Date();
  const draft = await prisma.supplementOnboardingDraft.findUnique({
    select: {
      blockingReviewItems: true,
      guardrailWarnings: true,
      id: true,
      name: true,
      plan: true,
      slug: true,
      status: true,
      updatedAt: true
    },
    where: {
      id: input.draftId
    }
  });

  if (!draft) {
    throw new Error("Supplement onboarding draft was not found.");
  }

  if (draft.status !== SupplementOnboardingDraftStatus.DRAFT) {
    throw new Error("Only DRAFT supplement onboarding drafts can be imported.");
  }

  const plan = supplementOnboardingPlanFromJson(draft.plan);

  if (!plan) {
    throw new Error("Supplement onboarding draft plan is unreadable; re-save the draft first.");
  }

  const existingData = await existingDatabaseIdsForPlans([plan]);
  const databaseImportAction = databaseImportActionForPlan({
    existingData,
    generatedAt: importedAt,
    plan
  });

  if (databaseImportAction.status === "blocked") {
    throw new Error(databaseImportAction.blockers[0] ?? "Database import is blocked.");
  }

  const category = plan.interventionDraft.category;

  if (!category) {
    throw new Error("A reviewed intervention category is required before database import.");
  }

  const interventionId = plan.interventionDraft.id;
  const claimIds = plan.claimDrafts.map((claim) => claim.id);
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
    await tx.supplementOnboardingDraft.update({
      data: {
        status: SupplementOnboardingDraftStatus.READY_FOR_REVIEW
      },
      where: {
        id: draft.id
      }
    });
  });

  await recordOperatorAuditEvent(principal, {
    action: "supplementOnboarding.databaseImport",
    afterSummary: serializableJson({
      claimCount: claimIds.length,
      draftStatus: SupplementOnboardingDraftStatus.READY_FOR_REVIEW,
      importedRows: databaseImportAction.importedRowPreview,
      interventionId,
      regulatoryStatusId
    }),
    beforeSummary: serializableJson({
      blockerCount: draft.blockingReviewItems.length,
      draftStatus: draft.status,
      guardrailWarningCount: draft.guardrailWarnings.length,
      name: draft.name,
      slug: draft.slug,
      updatedAt: draft.updatedAt.toISOString()
    }),
    metadata: serializableJson({
      databaseImportStatus: databaseImportAction.status,
      noAutoPromotion: true,
      noCandidateDecision: true,
      noClaimReview: true,
      noConnectorApproval: true,
      noExtractionWrite: true,
      noFullTextFetch: true,
      publicVisibilityWarning: PUBLIC_VISIBILITY_WARNING,
      warningCount: databaseImportAction.warnings.length
    }),
    note: importNote,
    targetId: draft.id,
    targetType: "SupplementOnboardingDraft"
  });

  return {
    action: "imported",
    claimCount: claimIds.length,
    claimIds,
    draftId: draft.id,
    draftStatus: "READY_FOR_REVIEW",
    importedAt: importedAt.toISOString(),
    interventionId,
    noAutoPromotion: true,
    noCandidateDecision: true,
    noClaimReview: true,
    noConnectorApproval: true,
    noExtractionWrite: true,
    noFullTextFetch: true,
    publicVisibilityWarning: PUBLIC_VISIBILITY_WARNING,
    regulatoryStatusId
  };
}

async function existingDatabaseIdsForPlans(
  plans: SupplementOnboardingPlan[]
): Promise<{
  australiaRegulatoryStatuses: { id: string }[];
  claims: { id: string }[];
  interventions: { id: string }[];
}> {
  const interventionIds = unique(plans.map((plan) => plan.interventionDraft.id));
  const claimIds = unique(plans.flatMap((plan) => plan.claimDrafts.map((claim) => claim.id)));
  const regulatoryStatusIds = unique(
    plans.map((plan) => `${plan.interventionDraft.id}-au-status`)
  );

  if (
    interventionIds.length === 0 &&
    claimIds.length === 0 &&
    regulatoryStatusIds.length === 0
  ) {
    return {
      australiaRegulatoryStatuses: [],
      claims: [],
      interventions: []
    };
  }

  const [dbInterventions, dbClaims, dbRegulatoryStatuses] = await Promise.all([
    interventionIds.length > 0
      ? prisma.intervention.findMany({
          select: {
            id: true
          },
          where: {
            id: {
              in: interventionIds
            }
          }
        })
      : Promise.resolve([]),
    claimIds.length > 0
      ? prisma.claim.findMany({
          select: {
            id: true
          },
          where: {
            id: {
              in: claimIds
            }
          }
        })
      : Promise.resolve([]),
    regulatoryStatusIds.length > 0
      ? prisma.australiaRegulatoryStatus.findMany({
          select: {
            id: true
          },
          where: {
            id: {
              in: regulatoryStatusIds
            }
          }
        })
      : Promise.resolve([])
  ]);

  return {
    australiaRegulatoryStatuses: dbRegulatoryStatuses,
    claims: dbClaims,
    interventions: dbInterventions
  };
}

function databaseImportActionForPlan({
  existingData,
  generatedAt,
  plan
}: {
  existingData: {
    australiaRegulatoryStatuses: { id: string }[];
    claims: { id: string }[];
    interventions: { id: string }[];
  };
  generatedAt: Date;
  plan: SupplementOnboardingPlan;
}): SupplementOnboardingDatabaseImportAction {
  const item = buildSupplementOnboardingSeedDiffReport({
    existingData,
    generatedAt,
    plans: [plan]
  }).items[0];
  const status: SupplementOnboardingDatabaseImportActionStatus =
    item.importPlan.status === "ready-for-manual-seed-copy"
      ? "ready-for-import"
      : item.importPlan.status;
  const blockers =
    status === "blocked" ? item.blockers.map(databaseConflictWording) : [];

  return {
    blockerCount: blockers.length,
    blockers,
    claimCount: item.claimCount,
    claimIds: item.claimIds,
    enabledWhenGateSatisfied: status !== "blocked",
    importedRowPreview: {
      australiaRegulatoryStatuses: 1,
      claims: item.claimCount,
      interventions: 1
    },
    interventionId: item.interventionId,
    nextAction: databaseImportNextAction(status, blockers),
    noAutoPromotion: true,
    noCandidateDecision: true,
    noClaimReview: true,
    noConnectorApproval: true,
    noExtractionWrite: true,
    noFullTextFetch: true,
    permission: "onboarding:import",
    publicVisibilityWarning: PUBLIC_VISIBILITY_WARNING,
    regulatoryStatusId: item.regulatoryStatusId,
    requiresImportNote: true,
    requiresOperatorBrowserGate: true,
    status,
    supportedNow: true,
    warnings: item.warnings
  };
}

function unreadablePlanDatabaseImportAction(): SupplementOnboardingDatabaseImportAction {
  return {
    blockerCount: 1,
    blockers: [
      "Saved onboarding plan is unreadable; re-save the private draft before database import."
    ],
    claimCount: 0,
    claimIds: [],
    enabledWhenGateSatisfied: false,
    importedRowPreview: {
      australiaRegulatoryStatuses: 1,
      claims: 0,
      interventions: 1
    },
    nextAction:
      "Re-save this private draft from the operator wizard before database import.",
    noAutoPromotion: true,
    noCandidateDecision: true,
    noClaimReview: true,
    noConnectorApproval: true,
    noExtractionWrite: true,
    noFullTextFetch: true,
    permission: "onboarding:import",
    publicVisibilityWarning: PUBLIC_VISIBILITY_WARNING,
    requiresImportNote: true,
    requiresOperatorBrowserGate: true,
    status: "blocked",
    supportedNow: true,
    warnings: []
  };
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
    uncertainty: `Imported from operator onboarding draft on ${importedAt.toISOString()}; citation traceability and claim packet review are still required.`,
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
    notes: `${plan.regulatoryDraft.notes} Imported from an operator onboarding draft; product-level AU/TGA status remains unreviewed.`,
    preMarketAssessment: false,
    region: "AU",
    sourceUrl:
      "https://www.tga.gov.au/products/regulations-all-products/about-australian-register-therapeutic-goods-artg",
    status: plan.regulatoryDraft.status,
    supplySummary: plan.regulatoryDraft.supplySummary
  };
}

function requireDatabaseImportGate(env: SupplementOnboardingDatabaseImportEnv) {
  if (env.APEX_ONBOARDING_DATABASE_IMPORT_ENABLED !== "true") {
    throw new OperatorAuthorizationError(
      "Supplement onboarding database import is disabled.",
      503
    );
  }

  if (!readEnv(env, "APEX_ONBOARDING_DATABASE_IMPORT_REVIEWED_AT")) {
    throw new OperatorAuthorizationError(
      "Supplement onboarding database import review evidence is required.",
      503
    );
  }
}

function databaseImportNextAction(
  status: SupplementOnboardingDatabaseImportActionStatus,
  blockers: string[]
) {
  if (status === "blocked") {
    return blockers[0] ?? "Resolve database import blockers before importing.";
  }

  if (status === "review-required") {
    return "Review warnings, confirm draft public visibility is acceptable, then use the approved operator import action with an import note.";
  }

  return "Use the approved operator import action with an import note, then queue sources only through the separate reviewed source workflow.";
}

function databaseConflictWording(blocker: string) {
  return blocker.replaceAll("seed data", "database");
}

function serializableJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function readEnv(env: object, key: string) {
  const value = (env as Record<string, string | undefined>)[key];
  return value && value.trim() ? value.trim() : undefined;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function savedDraftNextAction({
  blockerCount,
  importPlan,
  planReadable
}: {
  blockerCount: number;
  importPlan: SupplementOnboardingDraftImportPlan;
  planReadable: boolean;
}) {
  if (!planReadable) {
    return "Re-save this private draft from the operator wizard before seed copy review.";
  }

  if (blockerCount > 0 || importPlan.status === "blocked") {
    return importPlan.nextAction;
  }

  if (importPlan.status === "review-required") {
    return importPlan.seedCopy.nextAction;
  }

  return importPlan.nextAction;
}

function supplementOnboardingPlanFromJson(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }

  if (
    !Array.isArray(value.blockingReviewItems) ||
    !Array.isArray(value.claimDrafts) ||
    !Array.isArray(value.guardrailWarnings) ||
    !Array.isArray(value.queueAfterSeedCommands) ||
    !isRecord(value.interventionDraft) ||
    !isRecord(value.productStatusAssistant) ||
    !isRecord(value.safetyWatchlist)
  ) {
    return undefined;
  }

  if (
    typeof value.interventionDraft.id !== "string" ||
    typeof value.interventionDraft.name !== "string" ||
    typeof value.interventionDraft.slug !== "string" ||
    !Array.isArray(value.productStatusAssistant.gapAssessment) ||
    !Array.isArray(value.safetyWatchlist.signals)
  ) {
    return undefined;
  }

  return value as unknown as SupplementOnboardingPlan;
}

function unreadablePlanImportPlan(): SupplementOnboardingDraftImportPlan {
  return {
    databaseImport: {
      nextAction:
        "Keep saved operator drafts private; re-save this draft before any future database import can be considered.",
      noImportCommand: true,
      requiredFutureApproval:
        "Explicit authenticated operator database-import implementation and review.",
      status: "not-yet-enabled",
      supportedNow: false
    },
    nextAction:
      "Re-save this private draft from the operator wizard before seed copy review.",
    noAutoPromotion: true,
    noAutoWrite: true,
    noDatabaseWrite: true,
    noPublicEvidenceRowsWritten: true,
    recommendedPath: "resolve-blockers",
    seedCopy: {
      nextAction:
        "Re-save this private draft from the operator wizard before copying any draft records into seed data.",
      operations: [],
      reviewRequired: true,
      status: "blocked",
      targetPath: "src/lib/seed-data.ts"
    },
    status: "blocked",
    validationCommands: [
      "npm run db:validate",
      "npm run typecheck",
      "npm run test",
      "npm run build"
    ]
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
