import type { Metadata } from "next";
import Link from "next/link";

import type { ChangelogEntry } from "@/lib/changelog";
import {
  formatChangelogDate,
  getPublicChangelogEntries
} from "@/lib/data/public-changelog";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Changelog | Apex Lifespan",
  description: "Public changelog for Apex Lifespan evidence, scoring, and trust updates."
};

export default async function ChangelogPage() {
  const entries = await getPublicChangelogEntries();

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="inline-flex rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-signal hover:text-signal"
        >
          Back to dashboard
        </Link>

        <header className="mt-4 border-b border-line pb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Public trust record
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-ink">
            Apex Lifespan Changelog
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-700">
            Public notes for evidence cards, scoring behavior, source-search previews, and
            trust/safety wording. Entries summarize review-aid changes only; they are not medical
            advice, product endorsement, or proof of benefit.
          </p>
        </header>

        <section className="mt-6 grid gap-4">
          {entries.map((entry) => (
            <ChangelogEntryCard entry={entry} key={entry.id} />
          ))}
        </section>
      </article>
    </main>
  );
}

function ChangelogEntryCard({ entry }: { entry: ChangelogEntry }) {
  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {formatChangelogDate(entry.date)}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-ink">{entry.title}</h2>
        </div>
        <span
          className={cn(
            "rounded-md border px-2 py-1 text-xs font-semibold",
            changelogKindTone(entry.kind)
          )}
        >
          {entry.kind}
        </span>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-700">{entry.publicImpact}</p>

      {entry.scoreChange ? (
        <p className="mt-3 rounded-md border border-amberline/30 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-950">
          <span className="font-semibold">Score changed:</span> {entry.scoreChange.label}{" "}
          {entry.scoreChange.before} -&gt; {entry.scoreChange.after} because{" "}
          {entry.scoreChange.reason}
        </p>
      ) : null}

      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
        {entry.details.map((detail) => (
          <li key={detail}>{detail}</li>
        ))}
      </ul>
    </section>
  );
}

function changelogKindTone(kind: ChangelogEntry["kind"]) {
  if (kind === "Evidence card") {
    return "border-spruce/30 bg-teal-50 text-spruce";
  }

  if (kind === "Scoring") {
    return "border-amberline/30 bg-amber-50 text-amberline";
  }

  if (kind === "Source search") {
    return "border-signal/25 bg-blue-50 text-signal";
  }

  if (kind === "Operations") {
    return "border-slate-300 bg-slate-50 text-slate-700";
  }

  return "border-line bg-mist text-slate-600";
}
