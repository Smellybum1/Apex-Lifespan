import { classifyClaim } from "@/lib/evidence-brief";
import { compositeScore } from "@/lib/scoring";
import type {
  Claim,
  EvidenceLabel,
  NormalizedSourcePacketRow,
  Reference,
  ScoreSet,
  Study
} from "@/lib/types";

export interface ClaimScoreSuggestion {
  finalLabel: EvidenceLabel;
  limitations: string[];
  rationale: string[];
  scores: ScoreSet;
  warning?: string;
  /**
   * Set when the claim has no reviewable content of its own. The dimension
   * scores below are derived from the design of the linked papers, so a
   * placeholder row linked to twenty meta-analyses would otherwise score as
   * high as a curated conclusion. Callers that write scores must refuse.
   */
  blockedReason?: string;
}

interface BuildClaimScoreSuggestionInput {
  claim: Claim;
  references: Reference[];
  sourcePacket?: NormalizedSourcePacketRow;
  studies: Study[];
}

const studyRigorScores: Record<Study["studyType"], number> = {
  "Animal study": 2,
  "Case report": 2,
  "Clinical trial record": 5,
  "In vitro/mechanistic": 2,
  "Meta-analysis": 9,
  "Observational cohort": 4,
  "Randomized controlled trial": 8,
  "Regulatory safety warning": 7,
  "Systematic review": 8,
  // Rigor 0, below every real design: a source whose design we could not
  // establish must never lift a claim's evidence rigor. Deliberately the only
  // zero in the table so `strongestLinkedStudy` sorts it last.
  Unclassified: 0
};

const directHumanStudyTypes = new Set<Study["studyType"]>([
  "Clinical trial record",
  "Meta-analysis",
  "Observational cohort",
  "Randomized controlled trial",
  "Systematic review"
]);

export function buildClaimScoreSuggestion({
  claim,
  references,
  sourcePacket,
  studies
}: BuildClaimScoreSuggestionInput): ClaimScoreSuggestion {
  const strongestStudy = strongestLinkedStudy(studies);
  const completePacket = sourcePacket?.status === "complete";
  const linkedReferenceCount = references.length;
  const strongestRigor = strongestStudy ? studyRigorScores[strongestStudy.studyType] : 2;
  const hasDirectHumanEvidence = studies.some((study) =>
    directHumanStudyTypes.has(study.studyType)
  );
  const hasClinicalTrialRecord = studies.some(
    (study) => study.studyType === "Clinical trial record"
  );
  const hasSafetyOrRegulatoryStudy = studies.some(
    (study) => study.studyType === "Regulatory safety warning"
  );
  const sourceDepthBonus =
    completePacket && linkedReferenceCount >= 3 ? 1 : completePacket && linkedReferenceCount > 0 ? 0 : -1;
  const safetyConcern = safetyConcernDetected(claim, studies, references);
  const regulatoryConcern = regulatoryConcernDetected(claim, studies, references);
  const hypeConcern = hypeConcernDetected(claim);

  const scores: ScoreSet = {
    effectSize: suggestedEffectSize(claim, strongestStudy, completePacket),
    evidenceDirectness: clampScore(
      (hasDirectHumanEvidence ? 7 : 3) +
        (hasClinicalTrialRecord ? 0 : 1) +
        sourceDepthBonus
    ),
    evidenceRigor: clampScore(strongestRigor + sourceDepthBonus),
    hypePenalty: hypeConcern ? 7 : 3,
    measurability: suggestedMeasurability(claim),
    productQuality: completePacket ? 5 : 4,
    regulatoryRisk: regulatoryConcern ? 8 : 4,
    safety: safetyConcern ? 4 : hasSafetyOrRegulatoryStudy ? 5 : 7
  };
  const limitations = [
    "Operator must verify the source packet before saving; this suggestion is not a review decision.",
    "Product-quality is held conservative unless product-level evidence is visible.",
    "Effect size is a starting estimate and should be adjusted from extracted outcomes."
  ];
  const rationale = [
    strongestStudy
      ? `Strongest linked study type: ${strongestStudy.studyType}.`
      : "No structured study extraction is linked yet.",
    sourcePacket
      ? `Source packet status: ${sourcePacketStatusText(sourcePacket.status)} with ${sourcePacket.referenceIds.length} linked reference(s).`
      : "No normalized source packet row is linked.",
    `${linkedReferenceCount} citation(s) are visible to the operator.`,
    safetyConcern
      ? "Safety wording was detected; safety score is conservative."
      : "No local safety warning wording was detected in the linked packet text.",
    regulatoryConcern
      ? "High-signal regulatory concern wording was detected; regulatory risk is conservative."
      : "No high-signal regulatory warning was detected; product-level AU/TGA clearance is still not inferred from intervention evidence."
  ];

  return {
    blockedReason: unscorableClaimReason(claim),
    finalLabel: suggestedFinalLabel(scores, sourcePacket, safetyConcern, regulatoryConcern),
    limitations,
    rationale,
    scores,
    warning:
      !sourcePacket || sourcePacket.status !== "complete"
        ? "Source packet is not complete; use this only as a triage aid."
        : undefined
  };
}

/**
 * A claim can only be scored once it states something. Scoring is derived from
 * the linked papers, which says nothing about whether a conclusion was ever
 * written — so pipeline scaffolding has to be refused explicitly.
 */
export function unscorableClaimReason(claim: Claim) {
  const kind = classifyClaim(claim);

  if (kind === "pipeline") {
    return "This row is a source-collection placeholder, not a conclusion. Scoring it would turn the quality of the linked papers into a score for a claim nobody has written.";
  }

  if (kind === "watchlist") {
    return "This row tracks a regulated intervention for monitoring only and carries no scoped conclusion to score.";
  }

  return undefined;
}

function strongestLinkedStudy(studies: Study[]) {
  return [...studies].sort(
    (left, right) => studyRigorScores[right.studyType] - studyRigorScores[left.studyType]
  )[0];
}

function suggestedEffectSize(
  claim: Claim,
  strongestStudy: Study | undefined,
  completePacket: boolean
) {
  const text = `${claim.effectSize} ${claim.clinicalRelevance}`.toLowerCase();

  if (/\b(large|substantial|clinically meaningful|strong)\b/.test(text)) {
    return strongestStudy && completePacket ? 7 : 6;
  }

  if (/\b(moderate|meaningful|improved|reduced)\b/.test(text)) {
    return strongestStudy && completePacket ? 6 : 5;
  }

  if (/\b(small|limited|mixed|uncertain)\b/.test(text)) {
    return 4;
  }

  return strongestStudy && completePacket ? 5 : 4;
}

function suggestedMeasurability(claim: Claim) {
  const measurableOutcomes = [
    "Blood pressure",
    "Cardiovascular events",
    "Glucose/insulin/HbA1c",
    "LDL/ApoB/lipids",
    "Muscle/strength",
    "VO2 max/endurance"
  ];

  if (measurableOutcomes.includes(claim.outcome)) {
    return 7;
  }

  if (claim.outcome === "Safety/adverse effects") {
    return 6;
  }

  return 5;
}

function suggestedFinalLabel(
  scores: ScoreSet,
  sourcePacket: NormalizedSourcePacketRow | undefined,
  safetyConcern: boolean,
  regulatoryConcern: boolean
): EvidenceLabel {
  if (!sourcePacket || sourcePacket.status !== "complete") {
    return regulatoryConcern ? "Regulatory Concern" : "Insufficient Evidence";
  }

  if (regulatoryConcern) {
    return "Regulatory Concern";
  }

  if (safetyConcern && scores.safety <= 4) {
    return "Safety Concern";
  }

  const score = compositeScore(scores);
  const lowDirectnessOrRigor = scores.evidenceDirectness < 5 || scores.evidenceRigor < 4;

  if (lowDirectnessOrRigor) {
    return score >= 4 ? "Speculative Watchlist" : "Insufficient Evidence";
  }

  if (score >= 8) {
    return "Core Evidence-Based";
  }

  if (score >= 6) {
    return "Useful for Specific Use Case";
  }

  if (score >= 4) {
    return "Reasonable N-of-1 Experiment";
  }

  return "Insufficient Evidence";
}

function safetyConcernDetected(claim: Claim, studies: Study[], references: Reference[]) {
  if (
    claim.finalLabel === "Safety Concern" ||
    claim.finalLabel === "Avoid / Not Recommended" ||
    claim.finalLabel === "Requires Clinician Oversight"
  ) {
    return true;
  }

  const text = safetyConcernText(claim, studies, references)
    .replace(/\b(no|none|without)\s+(?:serious\s+)?adverse(?:\s+events?)?(?:\s+(?:reported|observed|captured))?\b/gi, " ")
    .replace(/\b(adverse events?|side effects?)\s+(?:were\s+)?(?:not|rarely|inconsistently)\s+(?:reported|captured|observed)\b/gi, " ")
    .replace(/\bgenerally\s+well\s+tolerated\b/gi, " ")
    .replace(/\bno\s+major\s+safety\s+signals?\b/gi, " ");

  return unambiguousSafetyConcernPattern.test(text) || hasHarmDirectedEvent(text);
}

// Terms that signal a genuine safety problem regardless of direction. These are
// rarely used to describe an efficacy endpoint or a neutral reporting category.
const unambiguousSafetyConcernPattern =
  /\b(toxicity|toxic|hepatotox\w*|nephrotox\w*|black\s+box|boxed\s+warning|safety\s+warning|contraindicat\w*|increased\s+(?:risk|adverse)|adverse\s+event\s+risk|liver\s+injury|kidney\s+injury|renal\s+injury|seizure|overdose|fatal)\b/i;

// These words are frequently *efficacy* endpoints in cardiovascular/longevity
// literature (e.g. "reduced cardiac death") or neutral RCT reporting categories
// (e.g. "serious adverse events were monitored"). Treat them as a safety signal
// only when a nearby cue points at harm and no benefit-direction cue is closer.
const ambiguousEventPattern =
  /\b(deaths?|mortality|hospitali[sz]ations?|arrhythmias?|myocardial\s+infarctions?|strokes?|cardiac\s+events?|cardiovascular\s+events?|serious\s+adverse(?:\s+events?)?|severe\s+adverse(?:\s+events?)?)\b/gi;
const harmDirectionPattern =
  /\b(increased?|elevated|higher|greater|raised|more\s+(?:frequent|common|prevalent|likely)|caus(?:es|ed|ing)|induces?|induced|led\s+to|triggers?|triggered|worsen\w*|risk\s+of)\b/i;
const benefitDirectionPattern =
  /\b(reduced?|reduces?|lower(?:ed|s|ing)?|decreased?|prevent\w*|protect\w*|fewer|improv\w*|benefit\w*|less)\b/i;

function hasHarmDirectedEvent(text: string) {
  ambiguousEventPattern.lastIndex = 0;

  let match: RegExpExecArray | null;

  while ((match = ambiguousEventPattern.exec(text)) !== null) {
    // Harm cues can lead ("increased mortality") or trail ("adverse events
    // were more frequent"), so scan a window on both sides of the term.
    const windowStart = Math.max(0, match.index - 48);
    const windowEnd = match.index + match[0].length + 48;
    const window = text.slice(windowStart, windowEnd);

    if (benefitDirectionPattern.test(window)) {
      continue;
    }

    if (harmDirectionPattern.test(window)) {
      return true;
    }
  }

  return false;
}

function regulatoryConcernDetected(claim: Claim, studies: Study[], references: Reference[]) {
  if (
    claim.finalLabel === "Regulatory Concern" ||
    claim.finalLabel === "Requires Clinician Oversight" ||
    claim.finalLabel === "Avoid / Not Recommended"
  ) {
    return true;
  }

  if (studies.some((study) => study.studyType === "Regulatory safety warning")) {
    return true;
  }

  if (references.some((reference) => regulatorySourcePattern.test(reference.source))) {
    return true;
  }

  const text = regulatoryConcernText(claim, studies, references);

  return (
    regulatoryWarningPattern.test(text) ||
    /\b(?:unapproved|not\s+(?:artg|tga)\s+(?:listed|approved)|prescription|injectable|reconstitution|research\s+use\s+only)\b/i.test(
      text
    ) ||
    therapeuticPeptidePattern.test(text)
  );
}

function hypeConcernDetected(claim: Claim) {
  return /\b(cure|reverse|regenerate|anti[-\s]?aging|lifespan|longevity|miracle|detox)\b/i.test(
    `${claim.claimText} ${claim.clinicalRelevance}`
  );
}

function safetyConcernText(claim: Claim, studies: Study[], references: Reference[]) {
  return [
    claim.claimText,
    claim.safetyNotes,
    ...references.map((reference) => reference.title),
    ...studies.flatMap((study) => [
      study.title,
      study.adverseEvents
    ])
  ].join(" ");
}

function regulatoryConcernText(claim: Claim, studies: Study[], references: Reference[]) {
  return [
    claim.claimText,
    claim.safetyNotes,
    claim.applicabilityNotes,
    ...references.map((reference) => reference.title),
    ...studies.flatMap((study) => [
      study.title,
      study.intervention,
      study.outcomes.join(" ")
    ])
  ].join(" ");
}

const therapeuticPeptidePattern =
  /\b(bpc[-\s]?157|tb[-\s]?500|thymosin|cjc[-\s]?1295|ipamorelin|tesamorelin|semaglutide|mots[-\s]?c|epitalon|aod[-\s]?9604)\b/i;

const regulatoryAuthorityTerms = String.raw`(?:tga|therapeutic goods administration|artg|aust l|aust r)`;
const regulatoryActionTerms =
  String.raw`(?:warning|alert|recall|unapproved|illegal|not\s+(?:listed|approved)|import|prescription|schedule|prohibited)`;

const regulatorySourcePattern = new RegExp(
  String.raw`\b${regulatoryAuthorityTerms}\b`,
  "i"
);

const regulatoryWarningPattern = new RegExp(
  String.raw`\b${regulatoryAuthorityTerms}\b.{0,120}\b${regulatoryActionTerms}\b|` +
    String.raw`\b${regulatoryActionTerms}\b.{0,120}\b${regulatoryAuthorityTerms}\b`,
  "i"
);

function sourcePacketStatusText(status: NormalizedSourcePacketRow["status"]) {
  switch (status) {
    case "complete":
      return "complete";
    case "extraction_pending":
      return "extraction pending";
    case "missing_sources":
      return "missing sources";
    case "not_linked":
    default:
      return "not linked";
  }
}

function clampScore(score: number) {
  return Math.min(10, Math.max(0, Math.round(score)));
}
