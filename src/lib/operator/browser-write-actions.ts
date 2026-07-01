import type { OperatorPrincipal } from "@/lib/operator/authorization";
import {
  CLAIM_SCORE_FIELD_DEFINITIONS,
  EVIDENCE_LABEL_OPTIONS
} from "@/lib/data/score-update";
import {
  getOperatorBrowserWriteControlState,
  type OperatorBrowserWriteControlEnv
} from "@/lib/operator/browser-write-controls";
import {
  extractSourceCandidateStudyAsOperator,
  linkSourceCandidateClaimAsOperator,
  promoteSourceCandidatePublicEvidenceAsOperator,
  reviewSourceCandidateAsOperator
} from "@/lib/operator/source-candidate-actions";
import { recomputeClaimScoreAsOperator } from "@/lib/operator/claim-score-recompute";
import { updateClaimScoreAsOperator } from "@/lib/operator/claim-score-update";
import {
  importSupplementOnboardingDraftAsOperator,
  saveSupplementOnboardingDraftAsOperator
} from "@/lib/operator/supplement-onboarding-drafts";
import {
  SUPPLEMENT_ONBOARDING_CATEGORIES,
  SUPPLEMENT_ONBOARDING_CLAIM_TEMPLATES,
  SUPPLEMENT_ONBOARDING_OUTCOMES,
  type SupplementOnboardingClaimTemplateId,
  type SupplementOnboardingProductInput
} from "@/lib/supplement-onboarding";
import type { InterventionCategory, OutcomeArea } from "@/lib/types";
import type { EvidenceLabel, ScoreSet } from "@/lib/types";

export async function reviewCandidateFromBrowserForm(
  principal: OperatorPrincipal,
  formData: FormData,
  env?: OperatorBrowserWriteControlEnv
) {
  requireBrowserControl(principal, "candidate-review", env);

  const dedupeKey = requiredFormString(formData, "dedupeKey");
  const reviewNote = requiredFormString(formData, "reviewNote");
  const decision = requiredFormString(formData, "decision");

  if (decision === "Accepted") {
    return reviewSourceCandidateAsOperator(
      principal,
      {
        acceptedReferenceId: requiredFormString(formData, "acceptedReferenceId"),
        decision,
        dedupeKey,
        reviewNote
      },
      env
    );
  }

  if (decision === "Rejected") {
    return reviewSourceCandidateAsOperator(
      principal,
      {
        decision,
        dedupeKey,
        reviewNote
      },
      env
    );
  }

  throw new Error("Unsupported source-candidate review decision.");
}

export async function linkCandidateClaimFromBrowserForm(
  principal: OperatorPrincipal,
  formData: FormData,
  env?: OperatorBrowserWriteControlEnv
) {
  requireBrowserControl(principal, "claim-link", env);

  return linkSourceCandidateClaimAsOperator(
    principal,
    {
      dedupeKey: requiredFormString(formData, "dedupeKey"),
      note: optionalFormString(formData, "note"),
      relevance: optionalFormNumber(formData, "relevance")
    },
    env
  );
}

export async function extractCandidateStudyFromBrowserForm(
  principal: OperatorPrincipal,
  formData: FormData,
  env?: OperatorBrowserWriteControlEnv
) {
  requireBrowserControl(principal, "study-extraction", env);

  return extractSourceCandidateStudyAsOperator(
    principal,
    {
      adverseEvents: requiredFormString(formData, "adverseEvents"),
      abstract: optionalFormString(formData, "abstract"),
      dedupeKey: requiredFormString(formData, "dedupeKey"),
      dose: optionalFormString(formData, "dose"),
      duration: optionalFormString(formData, "duration"),
      fundingConflicts: requiredFormString(formData, "fundingConflicts"),
      interventionName: requiredFormString(formData, "interventionName"),
      mainResults: optionalFormString(formData, "mainResults"),
      outcomes: requiredFormString(formData, "outcomes")
        .split(/\r?\n|,/)
        .map((outcome) => outcome.trim())
        .filter(Boolean),
      population: requiredFormString(formData, "population"),
      relevance: optionalFormNumber(formData, "relevance"),
      riskOfBias: requiredFormString(formData, "riskOfBias"),
      sampleSize: requiredFormString(formData, "sampleSize")
    },
    env
  );
}

export async function promoteCandidateFromBrowserForm(
  principal: OperatorPrincipal,
  formData: FormData,
  env?: OperatorBrowserWriteControlEnv
) {
  requireBrowserControl(principal, "public-promotion", env);

  return promoteSourceCandidatePublicEvidenceAsOperator(
    principal,
    {
      dedupeKey: requiredFormString(formData, "dedupeKey"),
      promotionNote: requiredFormString(formData, "promotionNote")
    },
    env
  );
}

export async function recomputeClaimScoreFromBrowserForm(
  principal: OperatorPrincipal,
  formData: FormData,
  env?: OperatorBrowserWriteControlEnv
) {
  const mode = requiredFormString(formData, "mode");

  if (mode !== "dry-run") {
    requireBrowserControl(principal, "public-promotion", env);
  }

  return recomputeClaimScoreAsOperator(
    principal,
    {
      claimId: requiredFormString(formData, "claimId"),
      dryRun: mode === "dry-run",
      rationale: requiredFormString(formData, "rationale")
    },
    env
  );
}

export async function updateClaimScoreFromBrowserForm(
  principal: OperatorPrincipal,
  formData: FormData,
  env?: OperatorBrowserWriteControlEnv
) {
  const mode = requiredFormString(formData, "mode");

  if (mode !== "dry-run") {
    requireBrowserControl(principal, "public-promotion", env);
  }

  return updateClaimScoreAsOperator(
    principal,
    {
      claimId: requiredFormString(formData, "claimId"),
      dryRun: mode === "dry-run",
      finalLabel: evidenceLabel(requiredFormString(formData, "finalLabel")),
      rationale: requiredFormString(formData, "rationale"),
      scores: scoreSetFromFormData(formData)
    },
    env
  );
}

export async function saveOnboardingDraftFromBrowserForm(
  principal: OperatorPrincipal,
  formData: FormData,
  env?: OperatorBrowserWriteControlEnv
) {
  requireBrowserControl(principal, "onboarding-draft", env);

  const customClaimText = optionalFormString(formData, "customClaimText");
  const customClaimOutcome = optionalOutcome(optionalFormString(formData, "customClaimOutcome"));

  if (customClaimText && !customClaimOutcome) {
    throw new Error("customClaimOutcome is required when customClaimText is set.");
  }

  return saveSupplementOnboardingDraftAsOperator(
    principal,
    {
      category: optionalCategory(optionalFormString(formData, "category")),
      claimTemplateIds: formData
        .getAll("claimTemplateIds")
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
        .map(claimTemplateId),
      claims:
        customClaimText && customClaimOutcome
          ? [
              {
                claimText: customClaimText,
                outcome: customClaimOutcome
              }
            ]
          : [],
      commonForms: splitLinesOrCommas(optionalFormString(formData, "commonForms")),
      name: requiredFormString(formData, "name"),
      note: optionalFormString(formData, "note"),
      product: productInputFromFormData(formData),
      region: optionalFormString(formData, "region") ?? "AU",
      synonyms: splitLinesOrCommas(optionalFormString(formData, "synonyms"))
    },
    env
  );
}

export async function importOnboardingDraftFromBrowserForm(
  principal: OperatorPrincipal,
  formData: FormData,
  env?: OperatorBrowserWriteControlEnv
) {
  requireBrowserControl(principal, "onboarding-import", env);

  return importSupplementOnboardingDraftAsOperator(
    principal,
    {
      draftId: requiredFormString(formData, "draftId"),
      importNote: requiredFormString(formData, "importNote")
    },
    env
  );
}

function requireBrowserControl(
  principal: OperatorPrincipal,
  control: Parameters<typeof getOperatorBrowserWriteControlState>[1],
  env?: OperatorBrowserWriteControlEnv
) {
  const state = getOperatorBrowserWriteControlState(principal, control, env);

  if (!state.enabled) {
    throw new Error(`Operator browser write control is not enabled: ${state.blockers[0]}`);
  }
}

function requiredFormString(formData: FormData, key: string) {
  const value = optionalFormString(formData, key);

  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
}

function optionalFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalFormNumber(formData: FormData, key: string) {
  const value = optionalFormString(formData, key);

  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${key} must be numeric.`);
  }

  return parsed;
}

function requiredFormInteger(formData: FormData, key: string) {
  const value = optionalFormNumber(formData, key);

  if (value === undefined) {
    throw new Error(`${key} is required.`);
  }

  if (!Number.isInteger(value)) {
    throw new Error(`${key} must be an integer.`);
  }

  return value;
}

function scoreSetFromFormData(formData: FormData): ScoreSet {
  return CLAIM_SCORE_FIELD_DEFINITIONS.reduce((scores, { key }) => {
    return {
      ...scores,
      [key]: requiredFormInteger(formData, key)
    };
  }, {} as ScoreSet);
}

function evidenceLabel(value: string): EvidenceLabel {
  if (EVIDENCE_LABEL_OPTIONS.includes(value as EvidenceLabel)) {
    return value as EvidenceLabel;
  }

  throw new Error("finalLabel is not supported.");
}

function splitLinesOrCommas(value: string | undefined) {
  return (value ?? "")
    .split(/\r?\n|,/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function productInputFromFormData(
  formData: FormData
): SupplementOnboardingProductInput | undefined {
  const product = {
    artgId: optionalFormString(formData, "productArtgId"),
    austNumber: optionalFormString(formData, "productAustNumber"),
    brand: optionalFormString(formData, "productBrand"),
    name: optionalFormString(formData, "productName"),
    sourceUrl: optionalFormString(formData, "productSourceUrl"),
    sponsor: optionalFormString(formData, "productSponsor")
  };

  return Object.values(product).some(Boolean) ? product : undefined;
}

function optionalCategory(value: string | undefined): InterventionCategory | undefined {
  if (!value) {
    return undefined;
  }

  if (SUPPLEMENT_ONBOARDING_CATEGORIES.includes(value as InterventionCategory)) {
    return value as InterventionCategory;
  }

  throw new Error("category is not supported.");
}

function optionalOutcome(value: string | undefined): OutcomeArea | undefined {
  if (!value) {
    return undefined;
  }

  if (SUPPLEMENT_ONBOARDING_OUTCOMES.includes(value as OutcomeArea)) {
    return value as OutcomeArea;
  }

  throw new Error("customClaimOutcome is not supported.");
}

function claimTemplateId(value: string): SupplementOnboardingClaimTemplateId {
  if (
    SUPPLEMENT_ONBOARDING_CLAIM_TEMPLATES.some((template) => template.id === value)
  ) {
    return value as SupplementOnboardingClaimTemplateId;
  }

  throw new Error(`Unknown supplement onboarding claim template: ${value}.`);
}
