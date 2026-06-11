import type { OperatorPrincipal } from "@/lib/operator/authorization";
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
