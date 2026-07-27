import {
  SUMMARY_NOISE_PREFIXES,
  UNCERTAINTY_NOISE_PREFIXES,
  withoutPipelineNoise
} from "@/lib/claim-text-noise";
import type { Claim } from "@/lib/types";

const ADVERSE_DIRECTION_PATTERN =
  /\b(adverse(?:ly)?|impair(?:s|ed|ing|ment|ments)?|disrupt(?:s|ed|ing|ion|ions|ive)?|worsen(?:s|ed|ing)?|harm(?:s|ed|ing|ful)?)\b/;

export function claimEvidenceDirectionLabel(
  claim: Pick<Claim, "summary" | "uncertainty">
) {
  return isAdverseDirectionClaim(claim) ? "Caution/adverse signal" : null;
}

/**
 * Whether the claim reports the supplement doing harm.
 *
 * Reads only the text that says something about the supplement. The pipeline
 * appends bookkeeping to both fields, and one of those sentences — "What would
 * change the score: ... adverse-event detail ..." — contains "adverse" while
 * asking for *more safety data*, not reporting any. Testing the raw fields
 * marked hydrolyzed collagen (osteoarthritis symptom support) and probiotic
 * blend (upper-respiratory infection prevention) as safety cautions on the
 * dashboard, burying two of the better-evidenced findings in the catalog under
 * a warning they had not earned.
 */
export function isAdverseDirectionClaim(claim: Pick<Claim, "summary" | "uncertainty">) {
  const summary = withoutPipelineNoise(claim.summary ?? "", SUMMARY_NOISE_PREFIXES);
  const uncertainty = withoutPipelineNoise(claim.uncertainty ?? "", UNCERTAINTY_NOISE_PREFIXES);
  const text = `${summary} ${uncertainty}`.toLowerCase();

  return (
    ADVERSE_DIRECTION_PATTERN.test(text) || text.includes("not frame this as a sleep benefit")
  );
}
