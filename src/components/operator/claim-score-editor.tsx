"use client";

import { useMemo, useState } from "react";

import {
  CLAIM_SCORE_FIELD_DEFINITIONS,
  EVIDENCE_LABEL_OPTIONS
} from "@/lib/score-fields";
import { compositeScore, scoreBand } from "@/lib/scoring";
import type {
  Claim,
  EvidenceLabel,
  NormalizedSourcePacketRow,
  Reference,
  ScoreSet
} from "@/lib/types";

interface OperatorClaimScoreEditorProps {
  applyEnabled: boolean;
  claimReferences: Record<string, Reference[]>;
  claims: Claim[];
  sourcePackets: NormalizedSourcePacketRow[];
  updateAction: (formData: FormData) => void | Promise<void>;
}

export function OperatorClaimScoreEditor({
  applyEnabled,
  claimReferences,
  claims,
  sourcePackets,
  updateAction
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
          updateAction={updateAction}
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
  updateAction
}: {
  applyEnabled: boolean;
  claim: Claim;
  references: Reference[];
  sourcePacket?: NormalizedSourcePacketRow;
  updateAction: (formData: FormData) => void | Promise<void>;
}) {
  const [scores, setScores] = useState<ScoreSet>(claim.scores);
  const [finalLabel, setFinalLabel] = useState<EvidenceLabel>(claim.finalLabel);
  const previewScore = compositeScore(scores);
  const currentScore = compositeScore(claim.scores);
  const changed =
    finalLabel !== claim.finalLabel ||
    CLAIM_SCORE_FIELD_DEFINITIONS.some(({ key }) => scores[key] !== claim.scores[key]);

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
          <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-950">
            <span className="font-semibold">Preview:</span> {previewScore.toFixed(1)} / 10,{" "}
            {scoreBand(previewScore)} band, {finalLabel}
            {changed ? (
              <span className="ml-2 font-semibold text-amber-800">Unsaved changes</span>
            ) : null}
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
              {applyEnabled ? <option value="apply">Apply score update</option> : null}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Rationale
            <textarea
              className="mt-1 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
        <SourcePacketContext references={references} sourcePacket={sourcePacket} />
      </div>
    </details>
  );
}

function SourcePacketContext({
  references,
  sourcePacket
}: {
  references: Reference[];
  sourcePacket?: NormalizedSourcePacketRow;
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
