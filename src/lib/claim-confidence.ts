import { classifyClaim } from "@/lib/evidence-brief";
import type { ClaimSourcePacket } from "@/lib/source-packet";
import type { Claim, ConfidenceLevel } from "@/lib/types";

/**
 * Derives how confident the catalog should be in a claim, from the evidence
 * actually extracted for it.
 *
 * `confidenceLevel` is set once at claim creation as `Very low` and never
 * written again, which is why 687 of 704 claims sit there and nothing ever tiers
 * up — while the public page reads it in five places to decide whether to show a
 * score at all and how to present the supplement.
 *
 * The danger in fixing that is repeating the bug it sits next to. Stage 9 of the
 * pipeline derived a claim's rigor and directness purely from the design of its
 * linked papers, never checking whether the claim stated anything, so a
 * placeholder linked to nineteen meta-analyses scored 7.5. Confidence is read by
 * even more of the reader-facing surface than the composite is, so deriving it
 * the same careless way would surface scaffolding to readers with a tier
 * attached.
 *
 * So the first question here is never "how good are the papers" — it is "is
 * there a claim". A row that states nothing stays `Very low` no matter what is
 * linked to it.
 */

export interface DeriveClaimConfidenceInput {
  claim: Claim;
  packet?: ClaimSourcePacket;
}

export interface DerivedClaimConfidence {
  /** Set when the claim is not eligible to be lifted at all. */
  blockedReason?: string;
  confidenceLevel: ConfidenceLevel;
  /** Plain-language account of why, for the audit trail and the review queue. */
  reason: string;
}

const CONFIDENCE_RANK: Record<ConfidenceLevel, number> = {
  "Very low": 0,
  Low: 1,
  Moderate: 2,
  High: 3
};

/**
 * A conclusion needs to say what it found before its sources can raise
 * confidence in it. Mirrors `isInformativeDetail` in the reader model: pipeline
 * placeholders write "Unknown" and "Manual review required" into exactly these
 * fields.
 */
function statesSomething(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const trimmed = value.trim();

  if (trimmed.length < 12) {
    return false;
  }

  return !/^(unknown|not established|not reviewed|manual review|insufficient)/i.test(trimmed);
}

export function deriveClaimConfidence({
  claim,
  packet
}: DeriveClaimConfidenceInput): DerivedClaimConfidence {
  const kind = classifyClaim(claim);

  if (kind !== "conclusion") {
    return {
      blockedReason:
        kind === "pipeline"
          ? "This row is a source-collection placeholder, not a conclusion. Raising its confidence would present pipeline scaffolding to readers as a finding."
          : `This row is classified as ${kind}, which carries no scoped conclusion to be confident about.`,
      confidenceLevel: "Very low",
      reason: "Not a conclusion; confidence stays at the floor."
    };
  }

  // A conclusion that never says what it found cannot be believed more strongly
  // because it has sources attached.
  if (!statesSomething(claim.effectSize) || !statesSomething(claim.populationStudied)) {
    return {
      blockedReason:
        "The claim does not state an effect size and a population, so there is no finding for the sources to support.",
      confidenceLevel: "Very low",
      reason: "Conclusion is missing its effect size or population."
    };
  }

  if (!packet) {
    return {
      confidenceLevel: "Very low",
      reason: "No source packet is linked, so nothing has been extracted for this claim."
    };
  }

  const { evidenceDepth, completeness } = packet;
  const extracted = evidenceDepth.totalExtractedStudies;

  // Snapshot-built packets carry reference counts but no study rows. Design is
  // genuinely unknown there, and guessing is what made the index and the detail
  // page disagree, so confidence is simply not raised.
  if (extracted === 0) {
    return {
      confidenceLevel: "Very low",
      reason:
        completeness.extractedReferences > 0
          ? "References are linked but no study rows have been extracted, so their design is unknown."
          : "Nothing has been extracted for this claim yet."
    };
  }

  const reviewLevel = evidenceDepth.metaAnalyses + evidenceDepth.systematicReviews;
  const trials = evidenceDepth.randomizedControlledTrials;
  const humanEvidence = reviewLevel + trials;

  if (humanEvidence === 0) {
    return {
      confidenceLevel: "Very low",
      reason: `${extracted} extracted stud${extracted === 1 ? "y" : "ies"}, none of them a trial, systematic review or meta-analysis.`
    };
  }

  if (reviewLevel >= 2 && extracted >= 8) {
    return {
      confidenceLevel: "High",
      reason: `${reviewLevel} systematic reviews or meta-analyses across ${extracted} extracted studies.`
    };
  }

  // A single review-level source is not enough on its own. `Moderate` renders
  // as a "good" tier to a reader, and one systematic review plus one trial was
  // lifting claims as consequential as whey protein and mortality. Volume is
  // required alongside design.
  if ((reviewLevel >= 1 && extracted >= 3) || trials >= 3) {
    return {
      confidenceLevel: "Moderate",
      reason: `${reviewLevel} review-level source${reviewLevel === 1 ? "" : "s"} and ${trials} randomised trial${trials === 1 ? "" : "s"} across ${extracted} extracted studies.`
    };
  }

  return {
    confidenceLevel: "Low",
    reason: `${trials} randomised trial${trials === 1 ? "" : "s"} extracted and no review-level source yet.`
  };
}

/**
 * Whether a derived confidence would change what a reader is told. Used to keep
 * a backfill honest about its own blast radius rather than reporting every row
 * it touched as a change.
 */
export function confidenceChange(
  current: ConfidenceLevel,
  derived: ConfidenceLevel
): "raised" | "lowered" | "unchanged" {
  if (CONFIDENCE_RANK[derived] > CONFIDENCE_RANK[current]) {
    return "raised";
  }

  return CONFIDENCE_RANK[derived] < CONFIDENCE_RANK[current] ? "lowered" : "unchanged";
}
