import type { ScoreWorklistRow } from "@/lib/score-worklist";
import { CLAIM_SCORE_FIELD_DEFINITIONS } from "@/lib/score-fields";
import type { EvidenceLabel, ScoreSet } from "@/lib/types";

export interface ScoreUpdateDraft {
  changes: ScoreUpdateDraftChanges;
  claimId: string;
  finalLabel: EvidenceLabel;
  formFields: Record<string, string>;
  rationale: string;
  scores: ScoreSet;
}

export interface ScoreUpdateDraftChanges {
  finalLabel?: {
    draft: EvidenceLabel;
    saved: EvidenceLabel;
  };
  scoreFields: ScoreUpdateDraftFieldChange[];
}

export interface ScoreUpdateDraftFieldChange {
  draft: number;
  key: keyof ScoreSet;
  label: string;
  saved: number;
}

const SCORE_DRAFTABLE_STATES = new Set<ScoreWorklistRow["state"]>([
  "default_score_review",
  "ready_to_score"
]);

export function buildScoreUpdateDraft(row: ScoreWorklistRow): ScoreUpdateDraft {
  if (!SCORE_DRAFTABLE_STATES.has(row.state)) {
    throw new Error(
      `Claim ${row.claimId} is ${row.stateLabel}; complete source work before drafting a score update.`
    );
  }

  const rationale = buildScoreUpdateDraftRationale(row);

  return {
    changes: buildScoreUpdateDraftChanges(row),
    claimId: row.claimId,
    finalLabel: row.suggestion.finalLabel,
    formFields: {
      claimId: row.claimId,
      effectSize: String(row.suggestion.scores.effectSize),
      evidenceDirectness: String(row.suggestion.scores.evidenceDirectness),
      evidenceRigor: String(row.suggestion.scores.evidenceRigor),
      finalLabel: row.suggestion.finalLabel,
      hypePenalty: String(row.suggestion.scores.hypePenalty),
      measurability: String(row.suggestion.scores.measurability),
      mode: "dry-run",
      productQuality: String(row.suggestion.scores.productQuality),
      rationale,
      regulatoryRisk: String(row.suggestion.scores.regulatoryRisk),
      safety: String(row.suggestion.scores.safety)
    },
    rationale,
    scores: row.suggestion.scores
  };
}

function buildScoreUpdateDraftChanges(row: ScoreWorklistRow): ScoreUpdateDraftChanges {
  const scoreFields = CLAIM_SCORE_FIELD_DEFINITIONS.flatMap(({ key, label }) =>
    row.currentScores[key] === row.suggestion.scores[key]
      ? []
      : [
          {
            draft: row.suggestion.scores[key],
            key,
            label,
            saved: row.currentScores[key]
          }
        ]
  );

  return {
    finalLabel:
      row.currentFinalLabel === row.suggestion.finalLabel
        ? undefined
        : {
            draft: row.suggestion.finalLabel,
            saved: row.currentFinalLabel
          },
    scoreFields
  };
}

function buildScoreUpdateDraftRationale(row: ScoreWorklistRow) {
  const citationLine =
    row.references.length > 0
      ? row.references
          .map((reference) => `${reference.label}: ${reference.title}`)
          .join("; ")
      : "No linked citations visible.";
  const studyLine =
    row.sourcePacket.studies.length > 0
      ? row.sourcePacket.studies
          .map(
            (study) =>
              `${study.studyType} ${study.year} on ${study.intervention}; outcomes: ${study.outcomes.join(", ")}; ${study.riskOfBias}`
          )
          .join(" | ")
      : "No substantive study extraction visible.";

  return [
    "Draft score update from local ready-to-score worklist; operator must verify before applying.",
    `Claim scope: ${row.intervention?.name ?? "Unknown intervention"} / ${row.outcome} - ${row.claim.claimText}`,
    `Suggested score: ${row.suggestion.compositeScoreLabel}; label ${row.suggestion.finalLabel}.`,
    `Source packet: ${row.sourcePacket.label}; ${row.sourcePacket.extractedReferences}/${row.sourcePacket.totalReferences} reference(s) extracted.`,
    `Citations: ${citationLine}`,
    `Extraction basis: ${studyLine}`,
    `Caveats: ${row.suggestion.limitations.join(" ")} Product-level AU/TGA clearance is not inferred from intervention evidence. No medical advice.`
  ].join("\n");
}
