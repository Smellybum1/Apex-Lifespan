import {
  ConfidenceLevel as DbConfidenceLevel,
  EvidenceLabel as DbEvidenceLabel,
  EvidenceMomentum as DbEvidenceMomentum,
  OutcomeArea as DbOutcomeArea,
  Prisma,
  SourceCandidateDecision as DbSourceCandidateDecision
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { syncSourcePacketForClaim } from "@/lib/data/source-packets";
import {
  readLocalAcceptedCandidateProcessingMetadata,
  readLocalBenefitDiscoveryDecisionMetadata,
  readLocalIdentityResolutionMetadata,
  sourceCandidateMetadataInput,
  sourceCandidateMetadataObject,
  sourceCandidateMetadataString,
  sourceCandidateMetadataStringArray
} from "@/lib/source-candidate-metadata";

const LOCAL_CLAIM_EXPANSION_LIMIT_DEFAULT = 500;
const LOCAL_CLAIM_EXPANSION_LIMIT_MAX = 2000;
const LOCAL_CLAIM_EXPANSION_METADATA_VERSION = "claim-expansion-v1";

const OUTCOME_LABELS: Record<DbOutcomeArea, string> = {
  BIOLOGICAL_AGING_CLOCKS: "biological aging clocks",
  BLOOD_PRESSURE: "blood pressure",
  CARDIOVASCULAR_EVENTS: "cardiovascular events",
  COGNITION: "cognition",
  EYE_HEALTH: "eye health",
  FERTILITY_HORMONES: "fertility/hormones",
  GLUCOSE_INSULIN_HBA1C: "glucose/insulin/HbA1c",
  IMMUNE_RESPIRATORY: "immune/respiratory",
  INFLAMMATION: "inflammation",
  JOINT_TENDON_SKIN: "joint/tendon/skin",
  LDL_APOB_LIPIDS: "LDL/ApoB/lipids",
  MORTALITY_LIFESPAN: "mortality/lifespan",
  MOOD_STRESS: "mood/stress",
  MUSCLE_STRENGTH: "muscle/strength",
  SAFETY_ADVERSE_EFFECTS: "safety/adverse effects",
  SLEEP: "sleep",
  VO2_MAX_ENDURANCE: "VO2 max/endurance"
};

const LOCAL_CLAIM_EXPANSION_CANDIDATE_SELECT = {
  acceptedReferenceId: true,
  claimId: true,
  dedupeKey: true,
  externalId: true,
  intervention: {
    select: {
      id: true,
      name: true,
      synonyms: true
    }
  },
  interventionId: true,
  metadata: true,
  query: true,
  source: true,
  sourceType: true,
  title: true,
  triageScore: true,
  url: true
} satisfies Prisma.SourceCandidateSelect;

type LocalClaimExpansionCandidate = Prisma.SourceCandidateGetPayload<{
  select: typeof LOCAL_CLAIM_EXPANSION_CANDIDATE_SELECT;
}>;

type LocalClaimExpansionGroup = {
  candidates: LocalClaimExpansionCandidate[];
  intervention: NonNullable<LocalClaimExpansionCandidate["intervention"]>;
  interventionId: string;
  outcome: DbOutcomeArea;
};

export type LocalClaimExpansionInput = {
  apply?: boolean;
  limit?: number;
};

export type LocalClaimExpansionDecision = {
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
  decisions: LocalClaimExpansionDecision[];
  limit: number;
  message: string;
  updatedAt: string;
};

export async function runLocalClaimExpansion(
  input: LocalClaimExpansionInput = {}
): Promise<LocalClaimExpansionResponse> {
  const limit = normaliseClaimExpansionLimit(input.limit);
  const applied = input.apply === true;
  const [claimCellsBefore, sourceCandidatesBefore, candidates] = await Promise.all([
    prisma.claim.count(),
    unlinkedAcceptedCandidateCount(),
    prisma.sourceCandidate.findMany({
      orderBy: [{ triageScore: "desc" }, { updatedAt: "desc" }],
      select: LOCAL_CLAIM_EXPANSION_CANDIDATE_SELECT,
      where: {
        acceptedReferenceId: { not: null },
        claimId: null,
        decision: DbSourceCandidateDecision.ACCEPTED,
        interventionId: { not: null }
      }
    })
  ]);
  const held = {
    identity: 0,
    noOutcome: 0,
    rejectedDecision: 0
  };
  const groups = new Map<string, LocalClaimExpansionGroup>();

  for (const candidate of candidates) {
    const processing = readLocalAcceptedCandidateProcessingMetadata(candidate.metadata);
    const decision = readLocalBenefitDiscoveryDecisionMetadata(candidate.metadata);

    if (!candidate.interventionId || !candidate.intervention || !candidate.acceptedReferenceId) {
      continue;
    }

    if (decision?.status === "rejected" || decision?.status === "skipped-mismatch") {
      held.rejectedDecision += 1;
      continue;
    }

    if (!candidateIdentityLooksUsable(candidate)) {
      held.identity += 1;
      continue;
    }

    const outcome = bestCandidateOutcome(candidate, processing);

    if (!outcome) {
      held.noOutcome += 1;
      continue;
    }

    const key = `${candidate.interventionId}::${outcome}`;
    const group =
      groups.get(key) ??
      ({
        candidates: [],
        intervention: candidate.intervention,
        interventionId: candidate.interventionId,
        outcome
      } satisfies LocalClaimExpansionGroup);

    group.candidates.push(candidate);
    groups.set(key, group);
  }

  const sortedGroups = Array.from(groups.values())
    .sort(
      (left, right) =>
        uniqueReferenceCount(right.candidates) - uniqueReferenceCount(left.candidates) ||
        right.candidates.length - left.candidates.length ||
        right.candidates[0].triageScore - left.candidates[0].triageScore ||
        left.intervention.name.localeCompare(right.intervention.name) ||
        OUTCOME_LABELS[left.outcome].localeCompare(OUTCOME_LABELS[right.outcome])
    )
    .slice(0, limit);
  const decisions: LocalClaimExpansionDecision[] = [];
  const syncedClaimIds = new Set<string>();

  for (const group of sortedGroups) {
    const baseDecision = {
      applied: false,
      candidateCount: group.candidates.length,
      existingClaimCount: 0,
      interventionName: group.intervention.name,
      linkedReferences: 0,
      outcome: OUTCOME_LABELS[group.outcome],
      referenceCount: uniqueReferenceCount(group.candidates)
    };

    try {
      const existingClaims = await prisma.claim.findMany({
        orderBy: [{ reviewStatus: "asc" }, { updatedAt: "desc" }, { id: "asc" }],
        where: {
          interventionId: group.interventionId,
          outcome: group.outcome
        }
      });
      const existingClaim = existingClaims[0];
      const willDraftClaim = !existingClaim;
      const claimResult = existingClaim
        ? { claim: existingClaim, created: false }
        : applied
          ? await createDraftClaim(group)
          : null;
      let linkedReferences = 0;

      if (applied && claimResult) {
        for (const candidate of group.candidates) {
          if (!candidate.acceptedReferenceId) {
            continue;
          }

          await prisma.claimReference.upsert({
            create: {
              claimId: claimResult.claim.id,
              note: `Accepted local claim-expansion source ${candidate.externalId}: ${candidate.title}`,
              referenceId: candidate.acceptedReferenceId,
              relevance: 4
            },
            update: {
              note: `Accepted local claim-expansion source ${candidate.externalId}: ${candidate.title}`,
              relevance: 4
            },
            where: {
              claimId_referenceId: {
                claimId: claimResult.claim.id,
                referenceId: candidate.acceptedReferenceId
              }
            }
          });
          await prisma.sourceCandidate.update({
            data: {
              claimId: claimResult.claim.id,
              metadata: writeLocalClaimExpansionMetadata(candidate.metadata, {
                action: claimResult.created ? "draft-claim" : "link-existing-claim",
                claimId: claimResult.claim.id,
                outcome: group.outcome
              })
            },
            where: { dedupeKey: candidate.dedupeKey }
          });
          linkedReferences += 1;
        }

        await syncSourcePacketForClaim(claimResult.claim.id);
        syncedClaimIds.add(claimResult.claim.id);
      }

      decisions.push({
        ...baseDecision,
        action: willDraftClaim ? "draft-claim" : "link-existing-claim",
        applied,
        claimCreated: claimResult?.created ?? false,
        claimId: claimResult?.claim.id,
        existingClaimCount: existingClaims.length,
        linkedReferences
      });
    } catch (error) {
      decisions.push({
        ...baseDecision,
        action: "hold",
        applied: false,
        error:
          error instanceof Error
            ? error.message
            : "Claim expansion failed for this accepted-source group.",
        reason: "Error while drafting or linking the claim."
      });
    }
  }

  const [claimCellsAfter, sourceCandidatesAfter] = await Promise.all([
    prisma.claim.count(),
    unlinkedAcceptedCandidateCount()
  ]);
  const counts = {
    claimCellsAfter,
    claimCellsBefore,
    claimsCreated: decisions.filter((decision) => decision.applied && decision.claimCreated).length,
    errors: decisions.filter((decision) => Boolean(decision.error)).length,
    groupsHeld: Math.max(0, groups.size - sortedGroups.length) +
      decisions.filter((decision) => decision.action === "hold").length,
    groupsScanned: groups.size,
    heldIdentity: held.identity,
    heldNoOutcome: held.noOutcome,
    heldRejectedDecision: held.rejectedDecision,
    linkedExistingClaims: decisions.filter(
      (decision) => decision.applied && decision.action === "link-existing-claim"
    ).length,
    linkedReferences: decisions.reduce((total, decision) => total + decision.linkedReferences, 0),
    sourceCandidatesAfter,
    sourceCandidatesBefore,
    syncedClaims: syncedClaimIds.size
  };

  return {
    action: "expand-claims",
    applied,
    counts,
    decisions,
    limit,
    message: claimExpansionMessage(counts, applied),
    updatedAt: new Date().toISOString()
  };
}

async function createDraftClaim(group: LocalClaimExpansionGroup) {
  const claimText = `${group.intervention.name} has accepted source leads for ${OUTCOME_LABELS[group.outcome]} that need structured evidence review.`;
  const existingClaim = await prisma.claim.findUnique({
    where: {
      interventionId_outcome_claimText: {
        claimText,
        interventionId: group.interventionId,
        outcome: group.outcome
      }
    }
  });
  const claim =
    existingClaim ??
    (await prisma.claim.create({
      data: {
        applicabilityNotes:
          "Local claim-expansion draft only. Verify population, dose/form, comparator, outcome, and source quality before public wording.",
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
        interventionId: group.interventionId,
        measurabilityScore: 4,
        momentum: DbEvidenceMomentum.STABLE,
        outcome: group.outcome,
        populationStudied: "Manual review required",
        productQualityScore: 3,
        regulatoryRiskScore: 5,
        reviewStatus: "UNREVIEWED_AI_DRAFT",
        safetyNotes:
          "Safety, adverse-event, interaction, and regulatory evidence were not reviewed by this draft action.",
        safetyScore: 5,
        summary:
          "Draft local claim created from accepted source candidates. Not medical advice and not a reviewed evidence conclusion.",
        uncertainty:
          "Candidate-to-claim expansion is heuristic; source relevance, intervention identity, and outcome fit require review.",
        whatWouldChangeScore:
          "Review linked accepted sources, extract structured study fields, confirm intervention identity, and update scores only after source review."
      }
    }));

  return {
    claim,
    created: !existingClaim
  };
}

function bestCandidateOutcome(
  candidate: LocalClaimExpansionCandidate,
  processing: ReturnType<typeof readLocalAcceptedCandidateProcessingMetadata>
) {
  if (!processing?.needsClaim) {
    return undefined;
  }

  const outcomes = [
    ...processing.novelTopics.map((item) => ({ ...item, priority: 4 })),
    ...processing.novelOutcomes.map((item) => ({ ...item, priority: 3 })),
    ...processing.topicSuggestions.map((item) => ({ ...item, priority: 2 })),
    ...processing.outcomeSuggestions.map((item) => ({ ...item, priority: 1 }))
  ]
    .map((item) => ({
      outcome: normaliseOutcome(item.outcome),
      priority: item.priority,
      score: typeof item.score === "number" ? item.score : 0
    }))
    .filter((item): item is { outcome: DbOutcomeArea; priority: number; score: number } =>
      Boolean(item.outcome)
    )
    .sort((left, right) => right.priority - left.priority || right.score - left.score);

  return outcomes[0]?.outcome ?? inferCandidateOutcomeFromSourceText(candidate);
}

function inferCandidateOutcomeFromSourceText(candidate: LocalClaimExpansionCandidate) {
  const text = candidateOutcomeText(candidate);
  const matches = OUTCOME_TEXT_RULES.map((rule) => ({
    outcome: rule.outcome,
    score: rule.terms.reduce(
      (total, term) => total + (text.includes(term) ? termScore(term) : 0),
      0
    )
  }))
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score);
  const [first, second] = matches;

  if (!first) {
    return undefined;
  }

  if (first.score >= 5 && (!second || first.score - second.score >= 2)) {
    return first.outcome;
  }

  return undefined;
}

const OUTCOME_TEXT_RULES: Array<{
  outcome: DbOutcomeArea;
  terms: string[];
}> = [
  {
    outcome: DbOutcomeArea.SAFETY_ADVERSE_EFFECTS,
    terms: [
      "adverse event",
      "adverse events",
      "adverse effect",
      "serious adverse event",
      "serious adverse events",
      "treatment emergent adverse event",
      "treatment emergent adverse events",
      "incidence of adverse",
      "incidence of serious adverse",
      "number of participants with adverse",
      "side effect",
      "safety",
      "toxicity",
      "tolerability",
      "linezolid induced thrombocytopenia",
      "thrombocytopenia"
    ]
  },
  {
    outcome: DbOutcomeArea.GLUCOSE_INSULIN_HBA1C,
    terms: [
      "glucose",
      "glycemic",
      "glycaemic",
      "insulin",
      "hba1c",
      "diabetes",
      "dysglycemia",
      "glucose tolerance",
      "metabolic syndrome"
    ]
  },
  {
    outcome: DbOutcomeArea.LDL_APOB_LIPIDS,
    terms: [
      "ldl",
      "apob",
      "apo b",
      "cholesterol",
      "triglyceride",
      "triglycerides",
      "lipid",
      "lipids"
    ]
  },
  {
    outcome: DbOutcomeArea.BLOOD_PRESSURE,
    terms: ["blood pressure", "hypertension", "systolic", "diastolic", "endothelial"]
  },
  {
    outcome: DbOutcomeArea.CARDIOVASCULAR_EVENTS,
    terms: [
      "cardiovascular event",
      "cardiovascular events",
      "myocardial",
      "stroke",
      "heart failure",
      "atrial fibrillation"
    ]
  },
  {
    outcome: DbOutcomeArea.INFLAMMATION,
    terms: [
      "inflammation",
      "inflammatory",
      "c reactive protein",
      "crp",
      "interleukin",
      "il 6",
      "tnf",
      "cytokine",
      "neutrophil lymphocyte",
      "oxidative stress"
    ]
  },
  {
    outcome: DbOutcomeArea.COGNITION,
    terms: [
      "cognition",
      "cognitive",
      "cognitive function",
      "brain function",
      "memory",
      "attention",
      "executive function",
      "dementia",
      "alzheimer"
    ]
  },
  {
    outcome: DbOutcomeArea.SLEEP,
    terms: ["sleep", "insomnia", "circadian", "sleep quality", "sleep latency"]
  },
  {
    outcome: DbOutcomeArea.MOOD_STRESS,
    terms: [
      "mood",
      "stress",
      "depression",
      "depressive",
      "anxiety",
      "ptsd",
      "alcohol use disorder",
      "alcohol dependence",
      "alcohol consumption",
      "alcoholism",
      "addiction",
      "ptsd symptoms",
      "heavy drinking"
    ]
  },
  {
    outcome: DbOutcomeArea.MUSCLE_STRENGTH,
    terms: [
      "muscle strength",
      "strength",
      "power",
      "lean mass",
      "grip strength",
      "sarcopenia",
      "muscle mass"
    ]
  },
  {
    outcome: DbOutcomeArea.VO2_MAX_ENDURANCE,
    terms: [
      "vo2",
      "endurance",
      "exercise performance",
      "aerobic",
      "fatigue",
      "time trial",
      "recovery following exercise"
    ]
  },
  {
    outcome: DbOutcomeArea.JOINT_TENDON_SKIN,
    terms: [
      "joint",
      "tendon",
      "skin",
      "wrinkle",
      "cartilage",
      "osteoarthritis",
      "bone mineral density",
      "bmd",
      "sciatic radiculopathy",
      "sciatica",
      "pain"
    ]
  },
  {
    outcome: DbOutcomeArea.EYE_HEALTH,
    terms: ["eye", "macular", "retina", "retinal", "visual acuity", "vision"]
  },
  {
    outcome: DbOutcomeArea.IMMUNE_RESPIRATORY,
    terms: [
      "immune",
      "infection",
      "respiratory",
      "covid",
      "influenza",
      "common cold",
      "lung",
      "copd",
      "asthma"
    ]
  },
  {
    outcome: DbOutcomeArea.FERTILITY_HORMONES,
    terms: [
      "fertility",
      "sperm",
      "testosterone",
      "estrogen",
      "oestrogen",
      "hormone",
      "menopause",
      "pcos"
    ]
  },
  {
    outcome: DbOutcomeArea.BIOLOGICAL_AGING_CLOCKS,
    terms: [
      "dna methylation",
      "methylation",
      "epigenetic",
      "biological age",
      "aging clock",
      "ageing clock",
      "telomere",
      "senescence"
    ]
  },
  {
    outcome: DbOutcomeArea.MORTALITY_LIFESPAN,
    terms: ["mortality", "survival", "lifespan", "life span", "all cause death"]
  }
];

function candidateOutcomeText(candidate: LocalClaimExpansionCandidate) {
  const metadata = sourceCandidateMetadataObject(candidate.metadata);

  return identityTerm(
    [
      candidate.title,
      candidate.sourceType,
      sourceCandidateMetadataString(metadata, "abstractText"),
      sourceCandidateMetadataString(metadata, "briefSummary"),
      ...sourceCandidateMetadataStringArray(metadata.conditions),
      ...sourceCandidateMetadataStringArray(metadata.primaryOutcomes)
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function termScore(term: string) {
  return term.includes(" ") ? 3 : 1;
}

function candidateIdentityLooksUsable(candidate: LocalClaimExpansionCandidate) {
  const identity = readLocalIdentityResolutionMetadata(candidate.metadata);

  if (identity?.status === "rejected-wrong-supplement") {
    return false;
  }

  if (identity?.status === "confirmed-target" && identity.interventionId === candidate.interventionId) {
    return true;
  }

  const terms = [candidate.intervention?.name, ...(candidate.intervention?.synonyms ?? [])]
    .filter((term): term is string => Boolean(term))
    .map(identityTerm)
    .filter((term) => term.length >= 3);
  const metadata = sourceCandidateMetadataObject(candidate.metadata);
  const sourceText = identityTerm(
    [
      candidate.query,
      candidate.title,
      candidate.sourceType,
      sourceCandidateMetadataString(metadata, "abstractText"),
      sourceCandidateMetadataString(metadata, "briefSummary"),
      ...sourceCandidateMetadataStringArray(metadata.conditions),
      ...sourceCandidateMetadataStringArray(metadata.interventions),
      ...sourceCandidateMetadataStringArray(metadata.primaryOutcomes)
    ]
      .filter(Boolean)
      .join(" ")
  );

  return terms.some((term) => sourceText.includes(term));
}

function writeLocalClaimExpansionMetadata(
  metadata: unknown,
  input: {
    action: "draft-claim" | "link-existing-claim";
    claimId: string;
    outcome: DbOutcomeArea;
  }
) {
  return sourceCandidateMetadataInput({
    ...sourceCandidateMetadataObject(metadata),
    localClaimExpansionDecision: {
      action: input.action,
      claimId: input.claimId,
      decidedAt: new Date().toISOString(),
      outcome: input.outcome,
      status: input.action === "draft-claim" ? "claim-drafted" : "linked-existing-claim",
      version: LOCAL_CLAIM_EXPANSION_METADATA_VERSION
    }
  });
}

function uniqueReferenceCount(candidates: LocalClaimExpansionCandidate[]) {
  return new Set(candidates.map((candidate) => candidate.acceptedReferenceId).filter(Boolean)).size;
}

function normaliseOutcome(value: unknown) {
  return typeof value === "string" && value in DbOutcomeArea
    ? (value as DbOutcomeArea)
    : undefined;
}

function identityTerm(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normaliseClaimExpansionLimit(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return LOCAL_CLAIM_EXPANSION_LIMIT_DEFAULT;
  }

  return Math.min(LOCAL_CLAIM_EXPANSION_LIMIT_MAX, Math.max(1, Math.floor(parsed)));
}

async function unlinkedAcceptedCandidateCount() {
  return prisma.sourceCandidate.count({
    where: {
      acceptedReferenceId: { not: null },
      claimId: null,
      decision: DbSourceCandidateDecision.ACCEPTED
    }
  });
}

function claimExpansionMessage(
  counts: LocalClaimExpansionResponse["counts"],
  applied: boolean
) {
  const action = applied ? "Expanded" : "Would expand";

  return `${action} ${counts.claimsCreated.toLocaleString()} draft claim(s), linked ${counts.linkedReferences.toLocaleString()} accepted source reference(s), and synced ${counts.syncedClaims.toLocaleString()} source packet(s). ${counts.sourceCandidatesAfter.toLocaleString()} accepted source candidate(s) still have no claim link.`;
}
