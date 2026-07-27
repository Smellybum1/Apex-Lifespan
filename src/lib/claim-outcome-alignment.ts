import { normaliseForMatch } from "@/lib/intervention-identity";
import { textMentionsOutcome } from "@/lib/relevance-gate";
import type { ClaimSourcePacket } from "@/lib/source-packet";
import type { Claim, Study } from "@/lib/types";

/**
 * Do a claim's extracted studies actually measure the outcome it is filed under?
 *
 * The identity gate asks "is this paper about this supplement?". This asks the
 * question one level up, and nothing did until now: a claim can be linked to
 * genuinely on-target papers about the right supplement that measured something
 * else entirely.
 *
 * Whey protein / Mortality-lifespan is the case that motivated this. It was
 * about to be raised to Moderate confidence on three studies — a
 * refeeding-syndrome trial in critically ill patients, a whey-and-E.coli
 * diarrhea trial, and a resistance-training strength meta-analysis. All three
 * are real whey/protein papers. None measured mortality. Counting design mix
 * and volume cannot catch that; only reading what was measured can.
 */

export type ClaimOutcomeAlignment = "aligned" | "unaligned" | "unknown";

export interface ClaimOutcomeAlignmentResult {
  /** Studies whose measured outcomes match the claim's outcome area. */
  alignedStudies: number;
  /** Studies carrying enough text to judge at all. */
  judgeableStudies: number;
  reason: string;
  totalStudies: number;
  verdict: ClaimOutcomeAlignment;
}

/**
 * Some `Study.outcomes` entries read "Claim domain: Cognition; Sleep". That is
 * written from the claim the study was linked to, not extracted from the paper,
 * so matching on it would compare the claim against itself and always agree.
 * It has to be dropped before anything is judged.
 */
function measuredOutcomeText(study: Study): string {
  const outcomes = (study.outcomes ?? []).filter(
    (outcome) => !/^\s*claim domain\s*:/i.test(outcome)
  );

  return normaliseForMatch([study.title, ...outcomes, study.mainResults ?? ""].join(" "));
}

/**
 * True when a study says anything about what it measured beyond its own title.
 * A row with no outcomes and no results cannot be judged either way, and
 * treating "we don't know" as "doesn't match" would penalise thin extraction
 * rather than off-topic evidence.
 */
function isJudgeable(study: Study): boolean {
  const outcomes = (study.outcomes ?? []).filter(
    (outcome) => !/^\s*claim domain\s*:/i.test(outcome)
  );

  return outcomes.length > 0 || Boolean(study.mainResults?.trim());
}

export function assessClaimOutcomeAlignment({
  claim,
  packet
}: {
  claim: Claim;
  packet?: ClaimSourcePacket;
}): ClaimOutcomeAlignmentResult {
  const studies = packet?.studies ?? [];

  if (studies.length === 0) {
    return {
      alignedStudies: 0,
      judgeableStudies: 0,
      reason: "No extracted studies to check.",
      totalStudies: 0,
      verdict: "unknown"
    };
  }

  const judgeable = studies.filter(isJudgeable);

  if (judgeable.length === 0) {
    return {
      alignedStudies: 0,
      judgeableStudies: 0,
      reason: `${studies.length} extracted stud${studies.length === 1 ? "y" : "ies"}, none recording what it measured.`,
      totalStudies: studies.length,
      verdict: "unknown"
    };
  }

  const aligned = judgeable.filter((study) =>
    textMentionsOutcome(measuredOutcomeText(study), claim.outcome)
  );

  if (aligned.length === 0) {
    return {
      alignedStudies: 0,
      judgeableStudies: judgeable.length,
      reason: `None of the ${judgeable.length} extracted stud${judgeable.length === 1 ? "y" : "ies"} recording an outcome measured ${claim.outcome}.`,
      totalStudies: studies.length,
      verdict: "unaligned"
    };
  }

  return {
    alignedStudies: aligned.length,
    judgeableStudies: judgeable.length,
    reason: `${aligned.length} of ${judgeable.length} extracted stud${judgeable.length === 1 ? "y" : "ies"} measured ${claim.outcome}.`,
    totalStudies: studies.length,
    verdict: "aligned"
  };
}
