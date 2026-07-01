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
      ? "Regulatory concern wording was detected; regulatory risk is conservative."
      : "No product-level AU/TGA clearance is inferred from intervention evidence."
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
  const text = safetyConcernText(claim, studies, references);

  if (/\b(no|none|without)\s+(?:serious\s+)?adverse\b/i.test(text)) {
    return false;
  }

  return /\b(adverse|toxicity|warning|risk|injury|contraindicat|serious|death|hospitali[sz]ation)\b/i.test(
    text
  );
}

function regulatoryConcernDetected(claim: Claim, studies: Study[], references: Reference[]) {
  const text = regulatoryConcernText(claim, studies, references);

  return /\b(tga|artg|aust|unapproved|regulatory|warning|peptide|injectable|prescription)\b/i.test(
    text
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
    claim.whatWouldChangeScore,
    ...references.map((reference) => reference.title),
    ...studies.flatMap((study) => [
      study.title,
      study.intervention,
      study.outcomes.join(" ")
    ])
  ].join(" ");
}

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
