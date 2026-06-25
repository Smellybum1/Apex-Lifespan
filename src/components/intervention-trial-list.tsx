"use client";

import { useState } from "react";

import { TrialClassificationBadge } from "@/components/trial-classification-badge";
import { labelTrialWatchItem } from "@/lib/trial-registry-labels";
import type { Intervention, TrialWatchItem } from "@/lib/types";

const TRIAL_PREVIEW_LIMIT = 3;

export function InterventionTrialList({
  intervention,
  trials
}: {
  intervention: Intervention;
  trials: TrialWatchItem[];
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleTrials = showAll ? trials : trials.slice(0, TRIAL_PREVIEW_LIMIT);
  const hiddenCount = Math.max(trials.length - TRIAL_PREVIEW_LIMIT, 0);

  if (trials.length === 0) {
    return (
      <p className="rounded-md border border-line bg-mist p-3 text-sm leading-6 text-slate-600">
        No local trial watcher records are attached to this intervention.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {visibleTrials.map((trial) => (
        <TrialCard key={trial.id} intervention={intervention} trial={trial} />
      ))}
      {hiddenCount > 0 ? (
        <button
          type="button"
          className="rounded-md border border-line bg-mist px-3 py-2 text-left text-xs font-semibold text-signal hover:bg-white"
          onClick={() => setShowAll((current) => !current)}
        >
          {showAll
            ? "Show fewer trial records"
            : `Show ${hiddenCount} more trial record${hiddenCount === 1 ? "" : "s"}`}
        </button>
      ) : null}
    </div>
  );
}

function TrialCard({
  intervention,
  trial
}: {
  intervention: Intervention;
  trial: TrialWatchItem;
}) {
  const labels = labelTrialWatchItem(trial, intervention);

  return (
    <article className="rounded-lg border border-line bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{trial.title}</h3>
          <p className="mt-1 text-xs text-slate-600">
            {trial.status} - {trial.phase} - {trial.lastUpdateDate}
          </p>
        </div>
        <span className="rounded-md border border-signal/25 bg-blue-50 px-2 py-1 text-xs font-semibold text-signal">
          {trial.evidenceImpact}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <TrialClassificationBadge
          detail={labels.trialRelevanceDetail}
          label={labels.trialRelevanceLabel}
        />
        <TrialClassificationBadge
          detail={labels.trialResultDetail}
          label={labels.trialResultLabel}
        />
      </div>
      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
        <MiniStat label="Enrollment" value={trial.enrollment} />
        <MiniStat label="Conditions" value={shortList(trial.conditions ?? [])} />
        <MiniStat label="Outcomes" value={shortList(trial.primaryOutcomes ?? [])} />
      </div>
      <p className="mt-3 rounded-md border border-line bg-mist px-3 py-2 text-xs leading-5 text-slate-600">
        Registry records are review leads only; relevance labels do not prove benefit or safety.
      </p>
      <a
        className="mt-3 inline-flex max-w-full items-center gap-1 break-words text-xs font-semibold text-signal hover:underline"
        href={trial.url}
        rel="noreferrer"
        target="_blank"
      >
        {trial.nctId ?? "Trial registry source"}
      </a>
    </article>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-mist p-2">
      <p className="font-semibold text-slate-600">{label}</p>
      <p className="mt-1 break-words text-slate-700">{value}</p>
    </div>
  );
}

function shortList(values: string[]) {
  if (values.length === 0) {
    return "Not provided";
  }

  const preview = values.slice(0, 2).join(", ");
  return values.length > 2 ? `${preview} +${values.length - 2}` : preview;
}
