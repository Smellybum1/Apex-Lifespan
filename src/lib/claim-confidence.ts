import { assessClaimOutcomeAlignment } from "@/lib/claim-outcome-alignment";
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

  // A claim already labelled "Insufficient Evidence" cannot become something the
  // catalog is confident in. Deriving a confidence level from design mix alone
  // will contradict the label, because this function counts what the linked
  // studies *are* and never checks what they *measured*.
  //
  // Caught on Whey protein / Mortality-lifespan, which this would have raised to
  // Moderate. Its claimText reads "Direct lifespan extension." while its own
  // effect size says "No lifespan or mortality effect established" and its
  // uncertainty warns against converting protein and body-composition findings
  // into a mortality conclusion. The three studies behind it were a
  // refeeding-syndrome trial in critically ill patients, a whey-and-E.coli
  // diarrhea trial, and a resistance-training strength meta-analysis — none
  // measuring mortality at all.
  if (claim.finalLabel === "Insufficient Evidence") {
    return {
      blockedReason:
        "The claim is labelled Insufficient Evidence. Raising confidence in it would contradict the label the curation process already assigned.",
      confidenceLevel: "Very low",
      reason: "Labelled Insufficient Evidence; confidence stays at the floor."
    };
  }

  if (!packet) {
    return {
      confidenceLevel: "Very low",
      reason: "No source packet is linked, so nothing has been extracted for this claim."
    };
  }

  // Design mix and volume say how good the linked studies are, never what they
  // measured. A claim can be linked to genuinely on-target papers about the
  // right supplement that studied something else entirely — which is how
  // Whey protein / Mortality-lifespan nearly reached Moderate on a
  // refeeding-syndrome trial, a diarrhea trial and a strength meta-analysis.
  //
  // `unknown` deliberately does not block: a study that records nothing about
  // what it measured is thin extraction, not off-topic evidence, and treating
  // the two the same would punish the catalog's gaps rather than its mistakes.
  const alignment = assessClaimOutcomeAlignment({ claim, packet });

  if (alignment.verdict === "unaligned") {
    return {
      blockedReason: `${alignment.reason} Confidence would be describing evidence for a different question.`,
      confidenceLevel: "Very low",
      reason: alignment.reason
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
