import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { EvidenceTier, SupplementIndexEntry } from "@/lib/evidence-brief";
import { cn } from "@/lib/utils";

const TIER_CHIP: Record<EvidenceTier, string> = {
  strong: "border-spruce/30 bg-teal-50 text-spruce",
  good: "border-signal/30 bg-blue-50 text-signal",
  early: "border-amberline/30 bg-amber-50 text-amberline",
  unclear: "border-slate-300 bg-slate-100 text-slate-600",
  caution: "border-danger/30 bg-red-50 text-danger"
};

const TIER_ACCENT: Record<EvidenceTier, string> = {
  strong: "bg-spruce",
  good: "bg-signal",
  early: "bg-amberline",
  unclear: "bg-slate-300",
  caution: "bg-danger"
};

const GROUPS: Array<{ tier: EvidenceTier; title: string; blurb: string }> = [
  {
    tier: "strong",
    title: "Actually works, for something specific",
    blurb: "At least one outcome has solid, human-reviewed evidence behind it."
  },
  {
    tier: "good",
    title: "Reasonable evidence, with conditions",
    blurb: "Worth a look if the specific outcome and situation match yours."
  },
  {
    tier: "early",
    title: "Early or mixed",
    blurb: "Something is there, but it is not settled and could go either way."
  },
  {
    tier: "caution",
    title: "Caution or clinician territory",
    blurb: "Prescription-only, regulated, or the evidence points at a risk rather than a benefit."
  },
  {
    tier: "unclear",
    title: "Nothing reviewed yet",
    blurb: "Research has been collected but nobody has read it into a conclusion. No claim either way."
  }
];

export function SupplementIndex({ entries }: { entries: SupplementIndexEntry[] }) {
  const counts = GROUPS.map((group) => ({
    ...group,
    items: entries.filter((entry) => entry.tier === group.tier)
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          What actually has evidence behind it
        </h1>
        <p className="max-w-prose-wide text-base leading-relaxed text-slate-600">
          {entries.length} supplements, sorted by how good the evidence is — not by how popular they
          are. Most land near the bottom, which is the honest answer.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {counts.map((group) => (
            <a
              key={group.tier}
              href={`#tier-${group.tier}`}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold transition hover:opacity-80",
                TIER_CHIP[group.tier]
              )}
            >
              {group.items.length} {group.title.toLowerCase()}
            </a>
          ))}
        </div>
      </header>

      {counts.map((group) => (
        <section key={group.tier} id={`tier-${group.tier}`} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <span
                className={cn("h-2.5 w-2.5 rounded-full", TIER_ACCENT[group.tier])}
                aria-hidden="true"
              />
              <h2 className="text-xl font-semibold tracking-tight text-ink">{group.title}</h2>
              <span className="tabular text-sm text-slate-400">{group.items.length}</span>
            </div>
            <p className="max-w-prose-wide text-sm leading-relaxed text-slate-500">{group.blurb}</p>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {group.items.map((entry) => (
              <li key={entry.intervention.id}>
                <SupplementCard entry={entry} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function SupplementCard({ entry }: { entry: SupplementIndexEntry }) {
  return (
    <Link
      href={`/interventions/${entry.intervention.slug}`}
      className="group flex h-full overflow-hidden rounded-xl2 border border-line bg-white shadow-card transition hover:border-signal/40 hover:shadow-lift focus:outline-none focus-visible:ring-4 focus-visible:ring-signal/20"
    >
      <span className={cn("w-1 shrink-0", TIER_ACCENT[entry.tier])} aria-hidden="true" />
      <span className="flex min-w-0 flex-1 flex-col gap-2.5 p-4">
        <span className="flex items-start justify-between gap-2">
          <span className="text-base font-semibold tracking-tight text-ink group-hover:text-signal">
            {entry.intervention.name}
          </span>
          <ArrowRight
            className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-signal"
            aria-hidden="true"
          />
        </span>

        <span className="text-sm leading-relaxed text-slate-600">{entry.headline}</span>

        <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-slate-400">
          <span className="tabular">{entry.sourceCount.toLocaleString()} sources</span>
          {entry.reviewedOutcomes > 0 ? (
            <span className="font-medium text-spruce">
              {entry.reviewedOutcomes} reviewed
            </span>
          ) : (
            <span>No reviewed conclusions</span>
          )}
        </span>
      </span>
    </Link>
  );
}
