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

export function buildSourceSearchQueries({
  claim,
  intervention
}: {
  claim?: Pick<Claim, "claimText" | "outcome">;
  intervention?: Pick<Intervention, "name" | "synonyms">;
}): SourceSearchQueries {
  const interventionTerm = intervention?.name ?? intervention?.synonyms[0] ?? "healthspan intervention";
  const outcomeTerm = claim ? outcomeSearchTerms[claim.outcome] : "human evidence";
  const label = claim && intervention ? `${intervention.name} - ${claim.outcome}` : "Active claim";

  return {
    label,
    pubMedTerm: normaliseSearchTerm(
      `${interventionTerm} ${outcomeTerm} randomized trial systematic review`
    ),
    trialTerm: normaliseSearchTerm(`${interventionTerm} ${outcomeTerm}`)
  };
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
