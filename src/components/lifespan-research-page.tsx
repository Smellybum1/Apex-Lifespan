import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { PublicSiteNav } from "@/components/public-site-nav";
import type {
  LifespanEvidenceData,
  LifespanEvidenceRecord,
  LifespanEvidenceStageId,
  LifespanTrialUpdate
} from "@/lib/lifespan-evidence";
import { cn } from "@/lib/utils";

const RESEARCH_AREAS = [
  {
    title: "Medicines and geroprotectors",
    detail: "Repurposed medicines and compounds targeting nutrient sensing, metabolism, autophagy, or other ageing biology."
  },
  {
    title: "Supplements and nutrients",
    detail: "Compounds being tested for mortality, function, resilience, or ageing-related biomarkers."
  },
  {
    title: "Senescence and immune ageing",
    detail: "Research into senescent cells, chronic inflammation, immune resilience, and related interventions."
  },
  {
    title: "Cellular and genetic frontiers",
    detail: "Reprogramming, gene, cell, and regenerative approaches, kept clearly separate from human clinical evidence."
  },
  {
    title: "Lifestyle geroscience",
    detail: "Exercise, nutrition, sleep, and environmental research where healthspan evidence may be more mature than lifespan evidence."
  },
  {
    title: "Measurements and ageing clocks",
    detail: "Tools researchers use to measure ageing, shown as measurements rather than benefits in their own right."
  }
] as const;

export function LifespanResearchPage({ data }: { data: LifespanEvidenceData }) {
  const { summary } = data;

  return (
    <main className="min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
        <PublicSiteNav activeSection="lifespan" />

        <header className="overflow-hidden rounded-xl border border-line bg-white shadow-panel">
          <div className="grid gap-6 px-5 py-7 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)] lg:px-8 lg:py-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-spruce">
                Lifespan research
              </p>
              <h1 className="mt-3 max-w-4xl text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                What researchers are testing to extend healthy life
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-700">
                A source-traceable view of human studies, ageing biomarkers, animal research,
                experimental treatments, and trials in progress. Evidence stage and uncertainty
                come before headlines.
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
                <a
                  className="rounded-md bg-signal px-3 py-2 text-white transition hover:bg-blue-800"
                  href="#research-library"
                >
                  Browse the research library
                </a>
                <a
                  className="rounded-md border border-line bg-white px-3 py-2 text-slate-700 transition hover:border-signal hover:text-signal"
                  href="#latest-developments"
                >
                  See registry developments
                </a>
              </div>
            </div>

            <section className="rounded-lg border border-signal/20 bg-blue-50 p-4" aria-label="How to read this page">
              <p className="text-xs font-semibold uppercase tracking-wide text-signal">
                Read this first
              </p>
              <ul className="mt-3 grid gap-3 text-sm leading-6 text-slate-700">
                <li>
                  <strong className="text-ink">Lifespan</strong> means survival or mortality—not
                  simply a change in a laboratory value.
                </li>
                <li>
                  <strong className="text-ink">Healthspan</strong> means function, resilience, or
                  years lived in better health.
                </li>
                <li>
                  <strong className="text-ink">Biomarkers and ageing clocks</strong> may help
                  research, but they do not by themselves show that someone will live longer.
                </li>
              </ul>
            </section>
          </div>

          <div className="grid border-t border-line bg-mist sm:grid-cols-2 xl:grid-cols-4">
            <Metric value={summary.trackedSubjects} label="research subjects tracked" />
            <Metric value={summary.directLifespanClaims} label="lifespan or mortality claim rows" />
            <Metric
              value={summary.humanLinkedSubjects}
              label="human outcome or healthspan briefs beyond intake"
            />
            <Metric value={summary.activeTrials} label="active registry leads in the local view" />
          </div>
        </header>

        <section className="rounded-lg border border-amberline/30 bg-amber-50 p-4">
          <h2 className="text-base font-semibold text-amber-950">Where the local evidence stands</h2>
          <p className="mt-2 text-sm leading-6 text-amber-950">
            {summary.lowCertaintyDirectClaims} of {summary.directLifespanClaims} direct lifespan or
            mortality claim rows currently have low or very low confidence. Many are source-intake
            records rather than settled conclusions. The cards below preserve those leads while
            making their maturity and review status explicit.
          </p>
        </section>

        <section aria-labelledby="evidence-stages-heading">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Evidence maturity
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-ink" id="evidence-stages-heading">
                Separate what was measured from what was proved
              </h2>
            </div>
            <Link className="text-sm font-semibold text-signal hover:underline" href="/methodology">
              How Apex evaluates evidence
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.stages.map((stage) => (
              <a
                className="rounded-lg border border-line bg-white p-4 shadow-panel transition hover:border-signal"
                href={`#stage-${stage.id}`}
                key={stage.id}
              >
                <span className={cn("inline-flex rounded-md border px-2 py-1 text-xs font-semibold", stageTone(stage.id))}>
                  {stage.records.length} tracked
                </span>
                <h3 className="mt-3 text-sm font-semibold text-ink">{stage.shortLabel}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-600">{stage.description}</p>
              </a>
            ))}
          </div>
        </section>

        {data.featuredRecords.length > 0 ? (
          <section aria-labelledby="featured-briefs-heading">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Across the maturity ladder
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-ink" id="featured-briefs-heading">
              Featured evidence briefs
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              These are representative local records, not recommendations or a ranking of what to
              use. Open a brief for its claim-level source trail, limitations, safety, and AU context.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {data.featuredRecords.map((record) => (
                <EvidenceRecordCard key={record.intervention.id} record={record} />
              ))}
            </div>
          </section>
        ) : null}

        <section id="latest-developments" aria-labelledby="latest-developments-heading">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Trial registry watcher
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-ink" id="latest-developments-heading">
            Latest locally captured developments
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            A registry entry records a study and its status; it is not a positive result. Relevance
            labels flag direct matches, related outcomes, combination products, and search-only
            leads. Dates are the last updates captured in the local catalog.
          </p>
          {data.latestTrialUpdates.length > 0 ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {data.latestTrialUpdates.map((update) => (
                <TrialUpdateCard key={update.trial.id} update={update} />
              ))}
            </div>
          ) : (
            <EmptyState>
              No local trial-registry updates are attached to the current Lifespan collection.
            </EmptyState>
          )}
        </section>

        <section aria-labelledby="research-areas-heading">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Coverage framework
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-ink" id="research-areas-heading">
            Research areas Lifespan is designed to cover
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            The current local catalog is strongest on supplements and intervention watchlists.
            Frontier areas will appear as their own source-traceable subjects as curated records are
            added; an empty area is not presented as evidence of absence.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {RESEARCH_AREAS.map((area) => (
              <article className="rounded-lg border border-line bg-white p-4 shadow-panel" key={area.title}>
                <h3 className="text-sm font-semibold text-ink">{area.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{area.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="research-library" aria-labelledby="research-library-heading">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Full local collection
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-ink" id="research-library-heading">
            Browse by evidence stage
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            The health-outcome buckets still exist inside each evidence brief, but this collection
            is organized first by research maturity so biomarkers, animal results, and human
            outcomes are not blended together.
          </p>
          <div className="mt-4 grid gap-3">
            {data.stages.map((stage) => (
              <details
                className="group rounded-lg border border-line bg-white shadow-panel"
                id={`stage-${stage.id}`}
                key={stage.id}
              >
                <summary className="cursor-pointer list-none px-4 py-4 outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-signal/20">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-ink">{stage.label}</h3>
                        <span className={cn("rounded-md border px-2 py-1 text-xs font-semibold", stageTone(stage.id))}>
                          {stage.records.length}
                        </span>
                      </div>
                      <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
                        {stage.description}
                      </p>
                      <p className="mt-2 max-w-4xl text-xs leading-5 text-slate-500">
                        {stage.caution}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-signal group-open:hidden">Open section</span>
                    <span className="hidden text-xs font-semibold text-signal group-open:inline">Close section</span>
                  </div>
                </summary>
                <div className="border-t border-line bg-mist p-3 sm:p-4">
                  {stage.records.length > 0 ? (
                    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                      {stage.records.map((record) => (
                        <EvidenceRecordCard compact key={record.intervention.id} record={record} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState>
                      No curated local records currently meet this stage definition. This does not
                      mean the research area is empty.
                    </EmptyState>
                  )}
                </div>
              </details>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white p-4 shadow-panel" aria-labelledby="safety-boundaries-heading">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Safety and Australian context
          </p>
          <h2 className="mt-2 text-xl font-semibold text-ink" id="safety-boundaries-heading">
            Research interest does not establish safety, approval, or suitability
          </h2>
          <div className="mt-3 grid gap-3 text-sm leading-6 text-slate-700 lg:grid-cols-3">
            <p className="rounded-md border border-line bg-mist p-3">
              Intervention evidence does not establish that a particular product is included in the
              ARTG or has an AUST number. Product status needs product-level evidence.
            </p>
            <p className="rounded-md border border-line bg-mist p-3">
              No local safety alert means only that no matching local warning was found. It does not
              imply safety, effectiveness, or TGA clearance.
            </p>
            <p className="rounded-md border border-line bg-mist p-3">
              Experimental medicines, peptides, biologics, and procedures are covered for evidence
              and risk awareness only. Apex does not provide sourcing, dosing, preparation, or
              self-administration instructions.
            </p>
          </div>
        </section>

        <footer className="border-t border-line py-5 text-xs leading-5 text-slate-500">
          <p>
            Public pages are read-only evidence summaries, not medical advice or clinical guidelines.
            Last-reviewed dates describe the local record, not a guarantee that every external source
            changed on that date.
          </p>
        </footer>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-b border-line px-5 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <p className="text-2xl font-semibold text-ink">{value.toLocaleString()}</p>
      <p className="mt-1 text-xs leading-5 text-slate-600">{label}</p>
    </div>
  );
}

function EvidenceRecordCard({
  compact = false,
  record
}: {
  compact?: boolean;
  record: LifespanEvidenceRecord;
}) {
  const visibleReferences = record.references.slice(0, compact ? 1 : 2);
  const highRiskAlerts = record.safetyAlerts.filter((alert) =>
    ["High", "Clinician review recommended", "Avoid"].includes(alert.severity)
  );

  return (
    <article className="flex min-w-0 flex-col rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {record.intervention.category}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-ink">{record.intervention.name}</h3>
        </div>
        <span className={cn("rounded-md border px-2 py-1 text-xs font-semibold", stageTone(record.stageId))}>
          {stageShortLabel(record.stageId)}
        </span>
      </div>

      <div className="mt-3 rounded-md border border-line bg-mist p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          What the local record says
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-700">{record.finding}</p>
      </div>

      <div className="mt-3 rounded-md border border-amberline/25 bg-amber-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-amberline">
          What it does not establish
        </p>
        <p className="mt-2 text-sm leading-6 text-amber-950">{record.limitation}</p>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <Fact label="Confidence" value={record.confidence ?? "Not assigned"} />
        <Fact label="Review" value={record.reviewStatus ?? "No scoped claim"} />
        <Fact
          label="Sources"
          value={
            record.sourceCount > 0
              ? `${record.sourceCount} linked${record.extractedSourceCount > 0 ? ` / ${record.extractedSourceCount} extracted` : ""}`
              : "No curated source linked"
          }
        />
        <Fact label="Registry leads" value={String(record.trials.length)} />
      </dl>

      <p className="mt-3 rounded-md border border-line bg-white px-3 py-2 text-xs leading-5 text-slate-600">
        <strong className="text-ink">Study basis:</strong> {studyBasis(record)}
      </p>

      {highRiskAlerts.length > 0 ? (
        <p className="mt-3 rounded-md border border-danger/25 bg-red-50 px-3 py-2 text-xs leading-5 text-danger">
          {highRiskAlerts.length} high-priority local safety or clinician-review alert
          {highRiskAlerts.length === 1 ? "" : "s"} attached. Open the full brief for context.
        </p>
      ) : (
        <p className="mt-3 text-xs leading-5 text-slate-500">
          No high-priority local alert shown here; this is not a safety or clearance finding.
        </p>
      )}

      <AustraliaStatusSummary statuses={record.australiaStatuses} />

      {visibleReferences.length > 0 ? (
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Source trail</p>
          <ul className="mt-2 grid gap-1">
            {visibleReferences.map((reference) => (
              <li key={reference.id}>
                <a
                  className="inline-flex max-w-full items-start gap-1 text-xs leading-5 text-signal hover:underline"
                  href={reference.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span>{reference.title}</span>
                  <ExternalLink aria-hidden="true" className="mt-1 h-3 w-3 shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <span className="text-xs text-slate-500">Local record updated {record.lastUpdated}</span>
        <Link
          className="rounded-md border border-signal/25 bg-blue-50 px-3 py-2 text-xs font-semibold text-signal transition hover:border-signal"
          href={`/interventions/${record.intervention.slug}`}
        >
          Read full evidence brief
        </Link>
      </div>
    </article>
  );
}

function TrialUpdateCard({ update }: { update: LifespanTrialUpdate }) {
  const { intervention, relevanceDetail, relevanceLabel, trial } = update;

  return (
    <article className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
        <span className="rounded-md border border-line bg-mist px-2 py-1 text-slate-700">
          {trial.status}
        </span>
        <span className="rounded-md border border-amberline/30 bg-amber-50 px-2 py-1 text-amberline" title={relevanceDetail}>
          {relevanceLabel}
        </span>
        {trial.resultsPosted ? (
          <span className="rounded-md border border-spruce/30 bg-teal-50 px-2 py-1 text-spruce">
            Results posted
          </span>
        ) : (
          <span className="rounded-md border border-line bg-white px-2 py-1 text-slate-600">
            No posted result captured
          </span>
        )}
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {intervention.name} / {trial.phase}
      </p>
      <h3 className="mt-1 text-sm font-semibold leading-6 text-ink">{trial.title}</h3>
      <p className="mt-2 text-xs leading-5 text-slate-600">{relevanceDetail}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-slate-500">Registry updated {trial.lastUpdateDate}</span>
        <a
          className="inline-flex items-center gap-1 font-semibold text-signal hover:underline"
          href={trial.url}
          rel="noreferrer"
          target="_blank"
        >
          Open registry record
          <ExternalLink aria-hidden="true" className="h-3 w-3" />
        </a>
      </div>
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-white px-2 py-2">
      <dt className="font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 leading-5 text-slate-700">{value}</dd>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 rounded-lg border border-dashed border-line bg-mist p-4 text-sm leading-6 text-slate-600">
      {children}
    </p>
  );
}

function stageShortLabel(stageId: LifespanEvidenceStageId) {
  switch (stageId) {
    case "human-outcomes":
      return "Human outcomes";
    case "healthspan":
      return "Healthspan / function";
    case "biomarkers":
      return "Ageing markers";
    case "preclinical":
      return "Preclinical";
    case "experimental-watchlist":
      return "Watchlist";
    case "source-leads":
      return "Source work";
  }
}

function stageTone(stageId: LifespanEvidenceStageId) {
  switch (stageId) {
    case "human-outcomes":
      return "border-spruce/30 bg-teal-50 text-spruce";
    case "healthspan":
      return "border-sky-300 bg-sky-50 text-sky-800";
    case "biomarkers":
      return "border-signal/25 bg-blue-50 text-signal";
    case "preclinical":
      return "border-violet-300 bg-violet-50 text-violet-800";
    case "experimental-watchlist":
      return "border-danger/25 bg-red-50 text-danger";
    case "source-leads":
      return "border-amberline/30 bg-amber-50 text-amberline";
  }
}

function AustraliaStatusSummary({
  statuses
}: {
  statuses: LifespanEvidenceRecord["australiaStatuses"];
}) {
  if (statuses.length === 0) {
    return (
      <p className="mt-2 text-xs leading-5 text-slate-500">
        No intervention-level AU status row captured; product status is not inferred.
      </p>
    );
  }

  const newestFirstStatuses = [...statuses].sort((left, right) =>
    right.checkedAt.localeCompare(left.checkedAt)
  );

  return (
    <div className="mt-2 rounded-md border border-line bg-mist px-3 py-2 text-xs leading-5 text-slate-600">
      <p className="font-semibold text-ink">AU intervention-level context</p>
      <ul className="mt-1 grid gap-1">
        {newestFirstStatuses.map((status) => (
          <li key={status.id}>
            {status.kind}: {status.status} / checked {status.checkedAt}.{" "}
            <a
              className="font-semibold text-signal hover:underline"
              href={status.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              AU/TGA source
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-1">This does not establish the status of any specific product.</p>
    </div>
  );
}

function studyBasis(record: LifespanEvidenceRecord) {
  if (record.studies.length === 0) {
    return record.sourceCount > 0
      ? "Linked references exist, but no structured study rows are attached yet."
      : "No curated source or structured study row is attached yet.";
  }

  const counts = new Map<string, number>();
  for (const study of record.studies) {
    const label = study.sourceTypeTaxonomy ?? study.studyType;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([label, count]) => `${count} ${count === 1 ? label : pluralStudyLabel(label)}`)
    .join(", ");
}

function pluralStudyLabel(label: string) {
  if (label.endsWith("analysis")) {
    return `${label.slice(0, -8)}analyses`;
  }

  if (label.endsWith("study")) {
    return `${label.slice(0, -5)}studies`;
  }

  return `${label}s`;
}
