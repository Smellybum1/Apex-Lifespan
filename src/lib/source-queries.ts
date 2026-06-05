import type { Claim, Intervention, OutcomeArea } from "@/lib/types";

export interface SourceSearchQueries {
  label: string;
  pubMedTerm: string;
  trialTerm: string;
}

const outcomeSearchTerms: Record<OutcomeArea, string> = {
  "Mortality/lifespan": "longevity mortality lifespan",
  "Cardiovascular events": "cardiovascular events prevention",
  "LDL/ApoB/lipids": "lipids triglycerides ApoB",
  "Blood pressure": "blood pressure",
  "Glucose/insulin/HbA1c": "glucose insulin HbA1c",
  Inflammation: "inflammation biomarkers",
  Cognition: "cognition cognitive function",
  Sleep: "sleep",
  "Mood/stress": "mood stress",
  "Muscle/strength": "strength resistance training lean mass",
  "VO2 max/endurance": "VO2 max endurance",
  "Joint/tendon/skin": "injury healing tendon skin",
  "Eye health": "eye health",
  "Immune/respiratory": "immune respiratory",
  "Fertility/hormones": "fertility hormones",
  "Biological aging clocks": "biological aging clocks",
  "Safety/adverse effects": "safety adverse effects"
};

const CLAIM_CONTEXT_TOKEN_LIMIT = 8;
const claimContextStopwords = new Set([
  "already",
  "and",
  "benefit",
  "benefits",
  "claim",
  "claims",
  "correcting",
  "for",
  "not",
  "or",
  "paired",
  "support",
  "supporting",
  "supports",
  "the",
  "use",
  "when",
  "with",
  "without"
]);
const claimContextBlockedTokens = new Set([
  "administer",
  "administered",
  "administering",
  "administration",
  "bac",
  "bacteriostatic",
  "buy",
  "compound",
  "compounded",
  "compounding",
  "cycle",
  "cycles",
  "cycling",
  "dosage",
  "dose",
  "dosed",
  "doses",
  "dosing",
  "inject",
  "injectable",
  "injected",
  "injecting",
  "injection",
  "injections",
  "lyophilised",
  "lyophilized",
  "needle",
  "needles",
  "purchase",
  "reconstitute",
  "reconstituted",
  "reconstitution",
  "self",
  "source",
  "sourced",
  "sources",
  "sourcing",
  "sterile",
  "vial",
  "vials"
]);
const claimContextBlockedPhrasePattern =
  /\b(?:bac(?:teriostatic)?|sterile)[-\s]+water\b|\bself[-\s]+(?:administer(?:ed|ing)?|administration|use)\b/gi;

export function buildSourceSearchQueries({
  claim,
  intervention
}: {
  claim?: Pick<Claim, "claimText" | "outcome">;
  intervention?: Pick<Intervention, "name" | "synonyms">;
}): SourceSearchQueries {
  const interventionTerm = intervention?.name ?? intervention?.synonyms[0] ?? "healthspan intervention";
  const outcomeTerm = claim ? outcomeSearchTerms[claim.outcome] : "human evidence";
  const claimContextTerm = claim ? claimContextSearchTerm(claim.claimText) : "";
  const label = claim && intervention ? `${intervention.name} - ${claim.outcome}` : "Active claim";
  const clinicalContextTerm = normaliseSearchTerm(`${outcomeTerm} ${claimContextTerm}`);

  return {
    label,
    pubMedTerm: normaliseSearchTerm(
      `${interventionTerm} ${clinicalContextTerm} randomized trial systematic review`
    ),
    trialTerm: normaliseSearchTerm(`${interventionTerm} ${clinicalContextTerm}`)
  };
}

function claimContextSearchTerm(value: string) {
  const seen = new Set<string>();

  return value
    .replace(claimContextBlockedPhrasePattern, " ")
    .replace(/['"]/g, "")
    .replace(/[^a-zA-Z0-9/+-]+/g, " ")
    .split(" ")
    .map((token) => token.trim().toLowerCase())
    .filter((token) => {
      if (
        token.length < 3 ||
        claimContextStopwords.has(token) ||
        claimContextBlockedTokens.has(token) ||
        seen.has(token)
      ) {
        return false;
      }

      seen.add(token);
      return true;
    })
    .slice(0, CLAIM_CONTEXT_TOKEN_LIMIT)
    .join(" ");
}

function normaliseSearchTerm(value: string) {
  const seen = new Set<string>();

  return value
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((token) => {
      const key = token.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .join(" ");
}
