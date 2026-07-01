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
  "Systematic review": 8
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

  return /\b(toxicity|toxic|black\s+box|boxed\s+warning|safety\s+warning|contraindicat|serious\s+adverse|severe\s+adverse|increased\s+(?:risk|adverse)|adverse\s+event\s+risk|death|hospitali[sz]ation|liver\s+injury|kidney\s+injury|arrhythmia|seizure)\b/i.test(
    text
  );
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
