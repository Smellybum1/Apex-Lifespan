"use client";

import { useMemo, useState } from "react";

import {
  CLAIM_SCORE_FIELD_DEFINITIONS,
  EVIDENCE_LABEL_OPTIONS
} from "@/lib/score-fields";
import { buildClaimScoreSuggestion } from "@/lib/score-suggestions";
import { compositeScore, scoreBand } from "@/lib/scoring";
import type { ScoreReadinessState } from "@/lib/score-readiness";
import type {
  Claim,
  EvidenceLabel,
  NormalizedSourcePacketRow,
  Reference,
  ScoreSet,
  Study
} from "@/lib/types";

interface OperatorClaimScoreEditorProps {
  applyEnabled: boolean;
  claimReferences: Record<string, Reference[]>;
  claims: Claim[];
  sourcePackets: NormalizedSourcePacketRow[];
  studies: Study[];
  updateAction: (formData: FormData) => void | Promise<void>;
  worklistContext?: Record<string, ClaimScoreWorklistContext>;
}

export interface ClaimScoreWorklistContext {
  nextAction: string;
  priorityLabel: string;
  reasons: string[];
  state: ScoreReadinessState;
  stateLabel: string;
}

export function OperatorClaimScoreEditor({
  applyEnabled,
  claimReferences,
  claims,
  sourcePackets,
  studies,
  updateAction,
  worklistContext = {}
}: OperatorClaimScoreEditorProps) {
  const sourcePacketByClaim = useMemo(
    () => new Map(sourcePackets.map((packet) => [packet.claimId, packet])),
    [sourcePackets]
  );

  return (
    <div className="space-y-2 border-t border-slate-100 pt-4">
      <div>
        <h3 className="text-base font-semibold tracking-normal text-slate-950">
          Score field editor
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Preview the composite against linked citations before saving. Apply keeps the claim draft-reviewed unless a human explicitly confirms otherwise.
        </p>
      </div>
      {claims.map((claim) => (
        <EditableClaimScoreCard
          applyEnabled={applyEnabled}
          claim={claim}
          key={claim.id}
          references={claimReferences[claim.id] ?? []}
          sourcePacket={sourcePacketByClaim.get(claim.id)}
          studies={studies}
          updateAction={updateAction}
          worklistContext={worklistContext[claim.id]}
        />
      ))}
    </div>
  );
}

function EditableClaimScoreCard({
  applyEnabled,
  claim,
  references,
  sourcePacket,
  studies,
  updateAction,
  worklistContext
}: {
  applyEnabled: boolean;
  claim: Claim;
  references: Reference[];
  sourcePacket?: NormalizedSourcePacketRow;
  studies: Study[];
  updateAction: (formData: FormData) => void | Promise<void>;
  worklistContext?: ClaimScoreWorklistContext;
}) {
  const linkedReferenceIds = useMemo(
    () => new Set(references.map((reference) => reference.id)),
    [references]
  );
  const linkedStudies = useMemo(
    () => studies.filter((study) => linkedReferenceIds.has(study.referenceId)),
    [linkedReferenceIds, studies]
  );
  const suggestion = useMemo(
    () =>
      buildClaimScoreSuggestion({
        claim,
        references,
        sourcePacket,
        studies: linkedStudies
      }),
    [claim, linkedStudies, references, sourcePacket]
  );
  const initialDraft = shouldStartFromSuggestion(worklistContext)
    ? {
        finalLabel: suggestion.finalLabel,
        scores: suggestion.scores
      }
    : {
        finalLabel: claim.finalLabel,
        scores: claim.scores
      };
  const [scores, setScores] = useState<ScoreSet>(() => initialDraft.scores);
  const [finalLabel, setFinalLabel] = useState<EvidenceLabel>(() => initialDraft.finalLabel);
  const suggestedRationale = useMemo(
    () =>
      buildScoreEditorRationale({
        claim,
        references,
        sourcePacket,
        studies: linkedStudies,
        suggestion
      }),
    [claim, linkedStudies, references, sourcePacket, suggestion]
  );
  const previewScore = compositeScore(scores);
  const currentScore = compositeScore(claim.scores);
  const changed =
    finalLabel !== claim.finalLabel ||
    CLAIM_SCORE_FIELD_DEFINITIONS.some(({ key }) => scores[key] !== claim.scores[key]);
  const scoreFieldChanges = scoreDraftFieldChanges(claim.scores, scores);
  const scoreUpdateAllowed = canUpdateScoreFromContext(worklistContext);

  return (
    <details className="rounded-md border border-slate-200 bg-slate-50" key={claim.id}>
      <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-800">
        {claim.outcome} - current {currentScore.toFixed(1)} {scoreBand(currentScore)} - preview{" "}
        {previewScore.toFixed(1)} {scoreBand(previewScore)}
      </summary>
      <div className="grid gap-3 border-t border-slate-200 p-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <form action={updateAction} className="space-y-3">
          <input name="claimId" type="hidden" value={claim.id} />
          <p className="text-sm text-slate-700">{claim.claimText}</p>
          {worklistContext ? <WorklistContextSummary context={worklistContext} /> : null}
          <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-950">
            <span className="font-semibold">Preview:</span> {previewScore.toFixed(1)} / 10,{" "}
            {scoreBand(previewScore)} band, {finalLabel}
            {changed ? (
              <span className="ml-2 font-semibold text-amber-800">
                Draft differs from saved score
              </span>
            ) : null}
          </div>
          {changed ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              <h4 className="font-semibold">Draft changes</h4>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {scoreFieldChanges.map((change) => (
                  <span
                    className="rounded-md border border-amber-200 bg-white px-2 py-1 text-xs font-semibold"
                    key={change.key}
                  >
                    {change.label}: {change.saved} -&gt; {change.draft}
                  </span>
                ))}
                {finalLabel !== claim.finalLabel ? (
                  <span className="rounded-md border border-amber-200 bg-white px-2 py-1 text-xs font-semibold">
                    Label: {claim.finalLabel} -&gt; {finalLabel}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="font-semibold">Suggested scoring</h4>
                <p className="mt-1">
                  {compositeScore(suggestion.scores).toFixed(1)} / 10,{" "}
                  {scoreBand(compositeScore(suggestion.scores))} band, {suggestion.finalLabel}
                </p>
              </div>
              <button
                className="rounded-md border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-900 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                disabled={!scoreUpdateAllowed}
                onClick={() => {
                  setScores(suggestion.scores);
                  setFinalLabel(suggestion.finalLabel);
                }}
                title={
                  scoreUpdateAllowed
                    ? "Use this conservative suggestion as an editable draft."
                    : "Complete source extraction or capture the needed snapshot before applying scoring suggestions."
                }
                type="button"
              >
                Use suggestion
              </button>
              <button
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                onClick={() => {
                  setScores(claim.scores);
                  setFinalLabel(claim.finalLabel);
                }}
                title="Restore the saved score values before running a dry run."
                type="button"
              >
                Use current
              </button>
            </div>
            {!scoreUpdateAllowed ? (
              <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-900">
                Apply waits for ready-to-score or score-review work. Use this card for dry-run
                triage until the source packet is complete or the snapshot gap is handled.
              </p>
            ) : null}
            {suggestion.warning ? (
              <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-900">
                {suggestion.warning}
              </p>
            ) : null}
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {suggestion.rationale.slice(0, 4).map((reason) => (
                <p className="rounded-md border border-emerald-100 bg-white/70 p-2" key={reason}>
                  {reason}
                </p>
              ))}
            </div>
            <p className="mt-2 text-xs font-semibold text-emerald-900">
              Limitation: {suggestion.limitations[0]}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            {CLAIM_SCORE_FIELD_DEFINITIONS.map(({ key, label }) => (
              <label className="block text-sm font-semibold text-slate-700" key={key}>
                {label}
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  max={10}
                  min={0}
                  name={key}
                  onChange={(event) =>
                    setScores((current) => ({
                      ...current,
                      [key]: normalizedScoreValue(event.currentTarget.value)
                    }))
                  }
                  required
                  step={1}
                  type="number"
                  value={scores[key]}
                />
              </label>
            ))}
          </div>
          <label className="block text-sm font-semibold text-slate-700">
            Final label
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              name="finalLabel"
              onChange={(event) => setFinalLabel(event.currentTarget.value as EvidenceLabel)}
              required
              value={finalLabel}
            >
              {EVIDENCE_LABEL_OPTIONS.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Mode
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              name="mode"
              required
            >
              <option value="dry-run">Dry run</option>
              {applyEnabled && scoreUpdateAllowed ? (
                <option value="apply">Apply score update</option>
              ) : null}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Rationale
            <textarea
              className="mt-1 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              defaultValue={suggestedRationale}
              name="rationale"
              placeholder="Which source packet or scoring rationale supports this change?"
              required
            />
          </label>
          <button
            className="rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900"
            type="submit"
          >
            Run score update
          </button>
        </form>
        <SourcePacketContext
          references={references}
          sourcePacket={sourcePacket}
          studies={linkedStudies}
        />
      </div>
    </details>
  );
}

function canUpdateScoreFromContext(context: ClaimScoreWorklistContext | undefined) {
  if (!context) {
    return true;
  }

  return (
    context.state === "default_score_review" ||
    context.state === "ready_to_score" ||
    context.state === "scored"
  );
}

function shouldStartFromSuggestion(context: ClaimScoreWorklistContext | undefined) {
  return context?.state === "default_score_review" || context?.state === "ready_to_score";
}

function scoreDraftFieldChanges(savedScores: ScoreSet, draftScores: ScoreSet) {
  return CLAIM_SCORE_FIELD_DEFINITIONS.flatMap(({ key, label }) =>
    savedScores[key] === draftScores[key]
      ? []
      : [
          {
            draft: draftScores[key],
            key,
            label,
            saved: savedScores[key]
          }
        ]
  );
}

function WorklistContextSummary({ context }: { context: ClaimScoreWorklistContext }) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-semibold">
          {context.stateLabel}
        </span>
        <span className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-semibold">
          {context.priorityLabel} priority
        </span>
      </div>
      <p className="mt-2 font-semibold">{context.nextAction}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {context.reasons.slice(0, 5).map((reason) => (
          <span
            className="rounded-md border border-amber-200 bg-white px-2 py-1 text-xs text-amber-900"
            key={reason}
          >
            {reason}
          </span>
        ))}
      </div>
    </div>
  );
}

function SourcePacketContext({
  references,
  sourcePacket,
  studies
}: {
  references: Reference[];
  sourcePacket?: NormalizedSourcePacketRow;
  studies: Study[];
}) {
  return (
    <aside className="rounded-md border border-slate-200 bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold text-slate-950">Source packet</h4>
        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
          {sourcePacket ? sourcePacketStatusLabel(sourcePacket.status) : "No packet row"}
        </span>
      </div>
      <p className="mt-2 text-slate-600">
        {sourcePacket
          ? `${sourcePacket.referenceIds.length} linked reference(s), ${sourcePacket.reviewStatus}.`
          : "No normalized source packet is linked to this claim yet."}
      </p>
      <div className="mt-3 space-y-2">
        {references.length > 0 ? (
          references.slice(0, 4).map((reference) => (
            <div className="rounded-md border border-slate-100 bg-slate-50 p-2" key={reference.id}>
              <p className="break-words font-semibold text-slate-800">{reference.title}</p>
              <p className="mt-1 text-xs text-slate-500">
                {reference.source}
                {reference.identifier ? ` ${reference.identifier}` : ""}
                {reference.year ? ` - ${reference.year}` : ""}
              </p>
            </div>
          ))
        ) : (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-900">
            No linked citations are visible for this score.
          </p>
        )}
        {references.length > 4 ? (
          <p className="text-xs font-semibold text-slate-500">
            {references.length - 4} more linked citation(s).
          </p>
        ) : null}
      </div>
      <div className="mt-3 border-t border-slate-100 pt-3">
        <h5 className="font-semibold text-slate-950">Extracted study context</h5>
        {studies.length > 0 ? (
          <div className="mt-2 space-y-2">
            {studies.slice(0, 3).map((study) => (
              <div className="rounded-md border border-slate-100 bg-slate-50 p-2" key={study.id}>
                <p className="break-words font-semibold text-slate-800">
                  {study.studyType} {study.year} - {study.title}
                </p>
                <dl className="mt-2 grid gap-1 text-xs leading-5 text-slate-600">
                  <div>
                    <dt className="inline font-semibold text-slate-700">Population:</dt>{" "}
                    <dd className="inline">{study.population}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-slate-700">Intervention:</dt>{" "}
                    <dd className="inline">{study.intervention}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-slate-700">Outcomes:</dt>{" "}
                    <dd className="inline">{study.outcomes.join(", ")}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-slate-700">Sample/results:</dt>{" "}
                    <dd className="inline">{study.sampleSize}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-slate-700">Safety:</dt>{" "}
                    <dd className="inline">{study.adverseEvents}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-slate-700">Bias/quality:</dt>{" "}
                    <dd className="inline">{study.riskOfBias}</dd>
                  </div>
                </dl>
              </div>
            ))}
            {studies.length > 3 ? (
              <p className="text-xs font-semibold text-slate-500">
                {studies.length - 3} more extracted study row(s).
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-900">
            No extracted study rows are visible for these linked citations.
          </p>
        )}
      </div>
    </aside>
  );
}

function normalizedScoreValue(value: string) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.min(10, Math.max(0, parsed));
}

function sourcePacketStatusLabel(status: NormalizedSourcePacketRow["status"]) {
  switch (status) {
    case "complete":
      return "Complete";
    case "extraction_pending":
      return "Extraction pending";
    case "missing_sources":
      return "Missing sources";
    case "not_linked":
    default:
      return "Not linked";
  }
}

function buildScoreEditorRationale({
  claim,
  references,
  sourcePacket,
  studies,
  suggestion
}: {
  claim: Claim;
  references: Reference[];
  sourcePacket?: NormalizedSourcePacketRow;
  studies: Study[];
  suggestion: ReturnType<typeof buildClaimScoreSuggestion>;
}) {
  const citationLine =
    references.length > 0
      ? references
          .map((reference) => `${reference.source} ${reference.identifier}: ${reference.title}`)
          .join("; ")
      : "No linked citations visible.";
  const studyLine =
    studies.length > 0
      ? studies
          .map(
            (study) =>
              `${study.studyType} ${study.year} on ${study.intervention}; outcomes: ${study.outcomes.join(", ")}; ${study.riskOfBias}`
          )
          .join(" | ")
      : "No substantive study extraction visible.";
  const packetLine = sourcePacket
    ? `${sourcePacket.status}; ${sourcePacket.referenceIds.length} linked reference(s); ${sourcePacket.reviewStatus}.`
    : "No normalized source packet is linked.";

  return [
    "Operator draft score update; verify citation support before applying.",
    `Claim scope: ${claim.outcome} - ${claim.claimText}`,
    `Suggested score: ${compositeScore(suggestion.scores).toFixed(1)} ${scoreBand(compositeScore(suggestion.scores))}; label ${suggestion.finalLabel}.`,
    `Source packet: ${packetLine}`,
    `Citations: ${citationLine}`,
    `Extraction basis: ${studyLine}`,
    `Caveats: ${suggestion.limitations.join(" ")} Product-level AU/TGA clearance is not inferred from intervention evidence. No medical advice.`
  ].join("\n");
}
