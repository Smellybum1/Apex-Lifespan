import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CircleSlash,
  FlaskConical,
  Info,
  ShieldAlert,
  Sparkles
} from "lucide-react";

import type { EvidenceTier, OutcomeVerdict, SupplementBrief } from "@/lib/evidence-brief";
import { severityTone } from "@/lib/scoring";
import { cn } from "@/lib/utils";

interface TierStyle {
  accent: string;
  chip: string;
  meter: string;
  panel: string;
}

const TIER_STYLES: Record<EvidenceTier, TierStyle> = {
  strong: {
    accent: "bg-spruce",
    chip: "border-spruce/30 bg-teal-50 text-spruce",
    meter: "bg-spruce",
    panel: "border-spruce/25 bg-teal-50/60"
  },
  good: {
    accent: "bg-signal",
    chip: "border-signal/30 bg-blue-50 text-signal",
    meter: "bg-signal",
    panel: "border-signal/25 bg-blue-50/60"
  },
  early: {
    accent: "bg-amberline",
    chip: "border-amberline/30 bg-amber-50 text-amberline",
    meter: "bg-amberline",
    panel: "border-amberline/25 bg-amber-50/60"
  },
  unclear: {
    accent: "bg-slate-400",
    chip: "border-slate-300 bg-slate-100 text-slate-700",
    meter: "bg-slate-400",
    panel: "border-slate-300 bg-slate-50"
  },
  caution: {
    accent: "bg-danger",
    chip: "border-danger/30 bg-red-50 text-danger",
    meter: "bg-danger",
    panel: "border-danger/25 bg-red-50/60"
  }
};

export function SupplementBriefView({
  brief,
  detailHref
}: {
  brief: SupplementBrief;
  detailHref: string;
}) {
  const { intervention, verdict, supported, emerging, cautions, pending, evidenceBase } = brief;
  const tier = TIER_STYLES[verdict.tier];
  const helpful = [...supported, ...emerging];

  return (
    <article className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 pb-16 pt-6 sm:px-6">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-signal"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All supplements
      </Link>

      <header className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {intervention.category}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            {intervention.name}
          </h1>
          {intervention.synonyms.length > 0 ? (
            <p className="text-sm text-slate-500">
              Also called {intervention.synonyms.join(", ")}
            </p>
          ) : null}
        </div>

        <section
          className={cn(
            "flex flex-col gap-4 rounded-xl2 border p-5 shadow-card sm:p-6",
            tier.panel
          )}
          aria-labelledby="short-answer"
        >
          <div className="flex flex-wrap items-center gap-3">
            <h2
              id="short-answer"
              className="text-xs font-semibold uppercase tracking-wider text-slate-600"
            >
              The short answer
            </h2>
            <span
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold",
                tier.chip
              )}
            >
              {verdict.label}
            </span>
          </div>

          <p className="max-w-prose-wide text-lg leading-relaxed text-ink">{verdict.summary}</p>

          <dl className="flex flex-wrap gap-x-6 gap-y-2 border-t border-line/70 pt-4 text-sm text-slate-600">
            <FactPair label="Research on file" value={countLabel(evidenceBase.studyCount, "study", "studies")} />
            <FactPair
              label="Checked by a person"
              value={
                evidenceBase.totalOutcomes > 0
                  ? `${evidenceBase.humanReviewedOutcomes} of ${evidenceBase.totalOutcomes} conclusions`
                  : "Not yet"
              }
            />
            <FactPair label="Last reviewed" value={formatDate(brief.lastReviewed)} />
          </dl>
        </section>
      </header>

      {brief.safety.clinicianTerritory ? (
        <Callout
          tone="danger"
          icon={<ShieldAlert className="h-5 w-5" aria-hidden="true" />}
          title="This one is not an over-the-counter supplement"
        >
          In Australia this sits in prescription or clinician-supervised territory. This page tracks
          what the research says and where the risks are. It is not a guide to obtaining, preparing,
          dosing or administering it, and nothing here is medical advice.
          {brief.safety.trackedTopics.length > 0 ? (
            <>
              {" "}
              The catalog watches it for {brief.safety.trackedTopics.join(", ").toLowerCase()},
              without drawing a conclusion on any of them.
            </>
          ) : null}
        </Callout>
      ) : null}

      {helpful.length > 0 ? (
        <Section
          title="What it may help with"
          subtitle="Ranked by how good the evidence is. Anything not listed here has no reviewed conclusion yet."
        >
          <div className="flex flex-col gap-3">
            {helpful.map((outcome) => (
              <OutcomeRow key={outcome.claimId} outcome={outcome} />
            ))}
          </div>
        </Section>
      ) : (
        <Section title="What it may help with">
          <p className="rounded-xl2 border border-line bg-white p-5 text-sm leading-relaxed text-slate-600 shadow-card">
            No outcome has a reviewed conclusion yet. Research has been collected — see{" "}
            <span className="font-medium text-ink">Still being worked through</span> below — but
            nobody has read it and written up a finding, so there is nothing honest to report.
          </p>
        </Section>
      )}

      {cautions.length > 0 ? (
        <Section
          title="Reasons for caution"
          subtitle="Findings that point the wrong way, or that the record flags as a risk rather than a benefit."
        >
          <div className="flex flex-col gap-3">
            {cautions.map((outcome) => (
              <OutcomeRow key={outcome.claimId} outcome={outcome} />
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="What it will not do">
        <ul className="flex flex-col gap-3 rounded-xl2 border border-line bg-white p-5 shadow-card">
          {brief.doesNotProve.map((row) => (
            <li key={row} className="flex gap-3 text-sm leading-relaxed text-slate-700">
              <CircleSlash
                className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
                aria-hidden="true"
              />
              <span>{row}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Safety">
        <div className="flex flex-col gap-4 rounded-xl2 border border-line bg-white p-5 shadow-card">
          <p className="text-sm leading-relaxed text-slate-700">{brief.safety.summary}</p>

          {brief.safety.notes.map((note) => (
            <p key={note} className="text-sm leading-relaxed text-slate-700">
              {note}
            </p>
          ))}

          {brief.safety.interactions ? (
            <p className="text-sm leading-relaxed text-slate-600">
              <span className="font-semibold text-ink">Interactions: </span>
              {brief.safety.interactions}
            </p>
          ) : null}

          {brief.safety.alerts.length > 0 ? (
            <div className="flex flex-col gap-2">
              {brief.safety.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex flex-col gap-1 rounded-lg border border-danger/25 bg-red-50/70 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-danger" aria-hidden="true" />
                    <span className="text-sm font-semibold text-ink">{alert.alertType}</span>
                    <span
                      className={cn(
                        "rounded-md border px-2 py-0.5 text-xs font-semibold",
                        severityTone(alert.severity)
                      )}
                    >
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-700">{alert.summary}</p>
                  <p className="text-xs text-slate-500">
                    {alert.source} · {alert.region} · {alert.date}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-slate-500">
              No safety alerts were found in this catalog. That is not the same as being safe — it
              means nothing has been recorded here.
            </p>
          )}

          <p className="border-t border-line pt-4 text-sm leading-relaxed text-slate-500">
            Australian status is decided per product, not per ingredient. Evidence about{" "}
            {intervention.name.toLowerCase()} tells you nothing about whether a specific bottle is
            listed on the ARTG, accurately labelled, or legal to supply.
          </p>
        </div>
      </Section>

      {pending.length > 0 ? (
        <Section
          title="Still being worked through"
          subtitle="Studies have been gathered for these, but nobody has reviewed them into a conclusion yet. They are listed for transparency, not as evidence of anything."
        >
          <div className="rounded-xl2 border border-line bg-mist p-5">
            <ul className="flex flex-wrap gap-2">
              {pending.map((row) => (
                <li
                  key={row.outcome}
                  className="rounded-full border border-line bg-white px-3 py-1 text-xs text-slate-600"
                >
                  {row.topic}
                  {row.referenceCount > 0 ? (
                    <span className="ml-1.5 tabular text-slate-400">{row.referenceCount}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </Section>
      ) : null}

      <Section title="Where this comes from">
        <div className="flex flex-col gap-4 rounded-xl2 border border-line bg-white p-5 shadow-card">
          <p className="text-sm leading-relaxed text-slate-700">
            This page is built from {countLabel(evidenceBase.referenceCount, "linked article", "linked articles")}{" "}
            and {countLabel(evidenceBase.studyCount, "extracted study record", "extracted study records")}
            {evidenceBase.studyMix ? ` (${evidenceBase.studyMix})` : ""}. Conclusions marked{" "}
            <span className="font-medium text-ink">reviewed</span> were checked by a person; the
            rest are drafts produced from the source material.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={detailHref}
              className="inline-flex items-center gap-2 rounded-lg border border-signal bg-signal px-4 py-2 text-sm font-semibold text-white transition hover:bg-signal/90"
            >
              <FlaskConical className="h-4 w-4" aria-hidden="true" />
              Full evidence detail and sources
            </Link>
            <Link
              href="/methodology"
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-mist px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-signal hover:text-signal"
            >
              <Info className="h-4 w-4" aria-hidden="true" />
              How we rate evidence
            </Link>
          </div>
          <p className="text-xs leading-relaxed text-slate-500">
            Every finding on this page is limited to the doses, forms, durations and populations
            that were actually studied. This is a research summary, not medical advice — talk to a
            clinician before changing anything you take.
          </p>
        </div>
      </Section>
    </article>
  );
}

function OutcomeRow({ outcome }: { outcome: OutcomeVerdict }) {
  const tier = TIER_STYLES[outcome.tier];

  return (
    <div className="flex overflow-hidden rounded-xl2 border border-line bg-white shadow-card transition hover:shadow-lift">
      <div className={cn("w-1.5 shrink-0", tier.accent)} aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="text-lg font-semibold tracking-tight text-ink">{outcome.topic}</h3>
          <div className="flex items-center gap-2.5">
            <StrengthMeter strength={outcome.strength} tier={outcome.tier} />
            <span
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-semibold",
                tier.chip
              )}
            >
              {outcome.tierLabel}
            </span>
          </div>
        </div>

        <p className="max-w-prose-wide text-[15px] leading-relaxed text-slate-700">
          {outcome.finding}
        </p>

        {outcome.caveat ? (
          <p className="max-w-prose-wide text-sm leading-relaxed text-slate-500">
            <span className="font-semibold text-slate-600">Worth knowing: </span>
            {outcome.caveat}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line/70 pt-3 text-xs text-slate-500">
          {outcome.studyCount > 0 ? (
            <span className="tabular">
              {outcome.studyCount} {outcome.studyCount === 1 ? "study" : "studies"}
              {outcome.studyMix ? ` · ${outcome.studyMix}` : ""}
            </span>
          ) : (
            <span>No studies extracted yet</span>
          )}
          {outcome.humanReviewed ? (
            <span className="inline-flex items-center gap-1 font-medium text-spruce">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Reviewed by a person
            </span>
          ) : (
            <span className="text-slate-400">Draft — not yet reviewed by a person</span>
          )}
        </div>
      </div>
    </div>
  );
}

function StrengthMeter({ strength, tier }: { strength: number; tier: EvidenceTier }) {
  const style = TIER_STYLES[tier];

  return (
    <span
      className="flex items-center gap-1"
      role="img"
      aria-label={`Evidence strength ${strength} out of 4`}
    >
      {[1, 2, 3, 4].map((step) => (
        <span
          key={step}
          className={cn(
            "h-1.5 w-5 rounded-full",
            step <= strength ? style.meter : "bg-slate-200"
          )}
        />
      ))}
    </span>
  );
}

function Section({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight text-ink">{title}</h2>
        {subtitle ? (
          <p className="max-w-prose-wide text-sm leading-relaxed text-slate-500">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Callout({
  tone,
  icon,
  title,
  children
}: {
  tone: "danger" | "info";
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex gap-4 rounded-xl2 border p-5 shadow-card",
        tone === "danger" ? "border-danger/30 bg-red-50/70" : "border-signal/25 bg-blue-50/60"
      )}
    >
      <span className={tone === "danger" ? "text-danger" : "text-signal"}>{icon}</span>
      <div className="flex flex-col gap-1.5">
        <p className="font-semibold text-ink">{title}</p>
        <p className="max-w-prose-wide text-sm leading-relaxed text-slate-700">{children}</p>
      </div>
    </div>
  );
}

function FactPair({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="font-medium text-ink tabular">{value}</dd>
    </div>
  );
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

function formatDate(value: string) {
  const parsed = new Date(value);

  if (!value.trim() || Number.isNaN(parsed.getTime())) {
    return "Not recorded";
  }

  return parsed.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  });
}
