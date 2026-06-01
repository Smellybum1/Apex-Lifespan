"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable
} from "@tanstack/react-table";
import {
  AlertTriangle,
  ArrowUpDown,
  ClipboardCheck,
  ExternalLink,
  FileSearch,
  Filter,
  FlaskConical,
  Search,
  ShieldCheck
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { projectConfig } from "@/lib/config/project";
import {
  analyzeLabel,
  compositeScore,
  getClaimScoreRows,
  labelTone,
  scoreBand,
  severityTone
} from "@/lib/scoring";
import type {
  Claim,
  EvidenceDashboardData,
  EvidenceLabel,
  Intervention,
  OutcomeArea,
  ProductSignal,
  Reference,
  SafetyAlert,
  Study,
  TrialWatchItem
} from "@/lib/types";
import { cn } from "@/lib/utils";

type ClaimTableRow = {
  id: string;
  intervention: string;
  outcome: string;
  label: EvidenceLabel;
  composite: number;
  safety: number;
  regulatoryRisk: number;
  confidence: string;
  updated: string;
};

const scoreColors = ["#1d4ed8", "#0f766e", "#b7791f", "#334155", "#7c3aed", "#b91c1c"];

export function EvidenceDashboard({ data }: { data: EvidenceDashboardData }) {
  const {
    claims,
    interventions,
    productSignals,
    references,
    safetyAlerts,
    studies,
    trialWatchItems
  } = data;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [activeClaimId, setActiveClaimId] = useState(claims[0]?.id ?? "");
  const [labelText, setLabelText] = useState(
    "Creatine monohydrate 5 g\nNSF Certified for Sport\nNo proprietary blend"
  );

  const referencesById = useMemo(
    () => new Map(references.map((reference) => [reference.id, reference])),
    [references]
  );

  const interventionsById = useMemo(
    () => new Map(interventions.map((intervention) => [intervention.id, intervention])),
    [interventions]
  );

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(interventions.map((item) => item.category)))],
    [interventions]
  );

  const filteredInterventions = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return interventions.filter((intervention) => {
      const categoryMatch = category === "All" || intervention.category === category;
      const queryMatch =
        !normalized ||
        intervention.name.toLowerCase().includes(normalized) ||
        intervention.synonyms.some((synonym) => synonym.toLowerCase().includes(normalized));

      return categoryMatch && queryMatch;
    });
  }, [category, interventions, query]);

  const visibleInterventionIds = useMemo(
    () => new Set(filteredInterventions.map((intervention) => intervention.id)),
    [filteredInterventions]
  );

  const filteredClaims = useMemo(
    () => claims.filter((claim) => visibleInterventionIds.has(claim.interventionId)),
    [claims, visibleInterventionIds]
  );

  const activeClaim =
    claims.find((claim) => claim.id === activeClaimId) ?? filteredClaims[0] ?? claims[0];
  const activeIntervention = interventionsById.get(activeClaim.interventionId);
  const labelFindings = analyzeLabel(labelText);

  const tableRows = useMemo(
    () =>
      filteredClaims.map((claim) => ({
        id: claim.id,
        intervention: interventionsById.get(claim.interventionId)?.name ?? "Unknown",
        outcome: claim.outcome,
        label: claim.finalLabel,
        composite: compositeScore(claim.scores),
        safety: claim.scores.safety,
        regulatoryRisk: claim.scores.regulatoryRisk,
        confidence: claim.confidenceLevel,
        updated: claim.lastUpdated
      })),
    [filteredClaims, interventionsById]
  );

  return (
    <main className="min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
        <Header data={data} />

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricPanel
            icon={<FileSearch aria-hidden="true" className="h-4 w-4" />}
            label="Interventions"
            value={interventions.length}
            detail={`${claims.length} scored claims`}
          />
          <MetricPanel
            icon={<ShieldCheck aria-hidden="true" className="h-4 w-4" />}
            label="Human-reviewed"
            value={claims.filter((claim) => claim.reviewStatus === "Human reviewed").length}
            detail={`${claims.length} drafts awaiting review`}
          />
          <MetricPanel
            icon={<AlertTriangle aria-hidden="true" className="h-4 w-4" />}
            label="Safety alerts"
            value={safetyAlerts.length}
            detail={`${safetyAlerts.filter((alert) => alert.severity !== "Low").length} moderate+`}
          />
          <MetricPanel
            icon={<FlaskConical aria-hidden="true" className="h-4 w-4" />}
            label="Source monitors"
            value={trialWatchItems.length}
            detail="PubMed + ClinicalTrials.gov"
          />
        </section>

        <section className="grid items-start gap-4 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-lg border border-line bg-white p-4 shadow-panel">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-semibold text-ink">Evidence Map</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Claim cells show composite evidence confidence, with safety and hype penalties included.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_220px]">
                <label className="relative">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                  />
                  <span className="sr-only">Search interventions</span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="h-10 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm outline-none ring-signal/20 transition focus:border-signal focus:ring-4"
                    placeholder="Search interventions"
                  />
                </label>
                <label className="relative">
                  <Filter
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                  />
                  <span className="sr-only">Filter category</span>
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="h-10 w-full appearance-none rounded-md border border-line bg-white pl-9 pr-3 text-sm outline-none ring-signal/20 transition focus:border-signal focus:ring-4"
                  >
                    {categories.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <EvidenceMap
              claims={filteredClaims}
              interventions={filteredInterventions}
              activeClaimId={activeClaim.id}
              onSelectClaim={setActiveClaimId}
            />
          </div>

          <ScorePanel claim={activeClaim} intervention={activeIntervention} />
        </section>

        <section className="grid items-start gap-4 xl:grid-cols-[1fr_0.8fr]">
          <ClaimTable rows={tableRows} onSelectClaim={setActiveClaimId} activeClaimId={activeClaim.id} />
          <SafetyPanel interventionsById={interventionsById} safetyAlerts={safetyAlerts} />
        </section>

        <section className="grid items-start gap-4 xl:grid-cols-[1fr_1fr]">
          <EvidenceCards
            claims={filteredClaims}
            interventionsById={interventionsById}
            referencesById={referencesById}
            activeClaimId={activeClaim.id}
            onSelectClaim={setActiveClaimId}
          />
          <LabelAnalyzer
            labelText={labelText}
            setLabelText={setLabelText}
            findings={labelFindings}
            productSignals={productSignals}
          />
        </section>

        <section className="grid items-start gap-4 xl:grid-cols-[0.8fr_1fr]">
          <TrialWatcher
            interventionsById={interventionsById}
            trialWatchItems={trialWatchItems}
          />
          <SourceAndStudyPanel referencesById={referencesById} studies={studies} />
        </section>
      </div>
    </main>
  );
}

function Header({ data }: { data: EvidenceDashboardData }) {
  return (
    <header className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-normal text-ink sm:text-3xl">
              Apex Lifespan
            </h1>
            <span className="rounded-md border border-signal/25 bg-blue-50 px-2 py-1 text-xs font-semibold text-signal">
              Evidence Intelligence
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            General public evidence dashboard. Draft evidence must stay citation-linked, uncertainty-aware,
            and separate from individualized medical advice.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-medium">
          <span className="rounded-md border border-spruce/25 bg-teal-50 px-2 py-1 text-spruce">
            Score claims
          </span>
          <span className="rounded-md border border-amberline/25 bg-amber-50 px-2 py-1 text-amberline">
            {projectConfig.defaultRegion} / {projectConfig.defaultRegulatoryAgency}
          </span>
          <span className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-slate-700">
            {data.dataSource === "database" ? "Database-backed" : "Seed fallback"}
          </span>
        </div>
        {data.fallbackReason ? (
          <p className="mt-3 max-w-4xl rounded-md border border-amberline/25 bg-amber-50 px-3 py-2 text-xs leading-5 text-amberline">
            {data.fallbackReason}
          </p>
        ) : null}
      </div>
    </header>
  );
}

function MetricPanel({
  icon,
  label,
  value,
  detail
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex items-center justify-between gap-3">
        <div className="rounded-md border border-line bg-mist p-2 text-signal">{icon}</div>
        <span className="text-2xl font-semibold text-ink">{value}</span>
      </div>
      <div className="mt-3">
        <p className="text-sm font-semibold text-ink">{label}</p>
        <p className="mt-1 text-xs text-slate-600">{detail}</p>
      </div>
    </div>
  );
}

function EvidenceMap({
  claims: visibleClaims,
  interventions: visibleInterventions,
  activeClaimId,
  onSelectClaim
}: {
  claims: Claim[];
  interventions: Intervention[];
  activeClaimId: string;
  onSelectClaim: (claimId: string) => void;
}) {
  const outcomes = useMemo(
    () => Array.from(new Set(visibleClaims.map((claim) => claim.outcome))),
    [visibleClaims]
  );

  return (
    <div className="mt-4 overflow-x-auto">
      <div
        className="grid min-w-[880px] gap-1"
        style={{
          gridTemplateColumns: `220px repeat(${outcomes.length}, minmax(112px, 1fr))`
        }}
      >
        <div className="rounded-md border border-transparent px-2 py-2 text-xs font-semibold text-slate-500">
          Intervention
        </div>
        {outcomes.map((outcome) => (
          <div
            key={outcome}
            className="rounded-md border border-line bg-mist px-2 py-2 text-xs font-semibold text-slate-700"
          >
            {shortOutcome(outcome)}
          </div>
        ))}

        {visibleInterventions.map((intervention) => (
          <EvidenceMapRow
            key={intervention.id}
            intervention={intervention}
            outcomes={outcomes}
            claims={visibleClaims}
            activeClaimId={activeClaimId}
            onSelectClaim={onSelectClaim}
          />
        ))}
      </div>
    </div>
  );
}

function EvidenceMapRow({
  intervention,
  outcomes,
  claims: visibleClaims,
  activeClaimId,
  onSelectClaim
}: {
  intervention: Intervention;
  outcomes: OutcomeArea[];
  claims: Claim[];
  activeClaimId: string;
  onSelectClaim: (claimId: string) => void;
}) {
  return (
    <>
      <div className="flex h-14 items-center rounded-md border border-line bg-white px-2 text-sm font-semibold text-ink">
        {intervention.name}
      </div>
      {outcomes.map((outcome) => {
        const claim = visibleClaims.find(
          (item) => item.interventionId === intervention.id && item.outcome === outcome
        );

        if (!claim) {
          return (
            <div
              key={`${intervention.id}-${outcome}`}
              className="flex h-14 items-center justify-center rounded-md border border-dashed border-line bg-slate-50 text-xs text-slate-400"
            >
              -
            </div>
          );
        }

        const score = compositeScore(claim.scores);

        return (
          <button
            key={claim.id}
            type="button"
            onClick={() => onSelectClaim(claim.id)}
            className={cn(
              "flex h-14 flex-col items-start justify-center rounded-md border px-2 text-left text-xs transition hover:border-signal hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-signal/20",
              labelTone(claim.finalLabel),
              activeClaimId === claim.id && "border-signal ring-2 ring-signal/25"
            )}
            title={`${intervention.name}: ${claim.outcome}`}
          >
            <span className="font-semibold">{score.toFixed(1)}</span>
            <span className="max-w-full truncate">{scoreBand(score)}</span>
          </button>
        );
      })}
    </>
  );
}

function ScorePanel({
  claim,
  intervention
}: {
  claim: Claim;
  intervention?: Intervention;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartReady, setChartReady] = useState(false);
  const [chartWidth, setChartWidth] = useState(0);
  const scoreRows = getClaimScoreRows(claim);
  const composite = compositeScore(claim.scores);

  useEffect(() => {
    setChartReady(true);
  }, []);

  useEffect(() => {
    const node = chartRef.current;

    if (!node) {
      return;
    }

    const updateWidth = () => {
      setChartWidth(Math.max(0, Math.floor(node.getBoundingClientRect().width)));
    };

    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <aside className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Active evidence card
          </p>
          <h2 className="mt-1 text-lg font-semibold text-ink">{intervention?.name}</h2>
          <p className="mt-1 text-sm text-slate-600">{claim.claimText}</p>
        </div>
        <div className="rounded-md border border-line bg-mist px-3 py-2 text-right">
          <p className="text-xs text-slate-500">Composite</p>
          <p className="text-2xl font-semibold text-ink">{composite.toFixed(1)}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className={cn("rounded-md border px-2 py-1 text-xs font-semibold", labelTone(claim.finalLabel))}>
          {claim.finalLabel}
        </span>
        <span className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
          {claim.reviewStatus}
        </span>
      </div>

      <div ref={chartRef} className="mt-4 h-64">
        {chartReady && chartWidth > 0 ? (
            <BarChart
              data={scoreRows}
              height={250}
              layout="vertical"
              margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
              width={chartWidth}
            >
              <CartesianGrid stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" domain={[0, 10]} hide />
              <YAxis
                dataKey="label"
                type="category"
                width={92}
                tick={{ fill: "#475569", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "rgba(29, 78, 216, 0.08)" }}
                formatter={(value) => [`${value}/10`, "Score"]}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                {scoreRows.map((row, index) => (
                  <Cell key={row.label} fill={scoreColors[index % scoreColors.length]} />
                ))}
              </Bar>
            </BarChart>
        ) : (
          <div className="grid h-full content-center gap-3">
            {scoreRows.map((row, index) => (
              <div key={row.label} className="grid grid-cols-[92px_1fr_34px] items-center gap-2 text-xs">
                <span className="text-slate-600">{row.label}</span>
                <span className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${row.value * 10}%`,
                      backgroundColor: scoreColors[index % scoreColors.length]
                    }}
                  />
                </span>
                <span className="text-right font-semibold text-slate-700">{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <dl className="grid gap-2 text-sm">
        <DetailRow label="Population" value={claim.populationStudied} />
        <DetailRow label="Dose/form" value={claim.doseFormStudied} />
        <DetailRow label="Safety" value={claim.safetyNotes} />
        <DetailRow label="Score mover" value={claim.whatWouldChangeScore} />
      </dl>
    </aside>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-md border border-line bg-mist p-3 sm:grid-cols-[120px_1fr]">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-700">{value}</dd>
    </div>
  );
}

function ClaimTable({
  rows,
  activeClaimId,
  onSelectClaim
}: {
  rows: ClaimTableRow[];
  activeClaimId: string;
  onSelectClaim: (claimId: string) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "composite", desc: true }]);

  const columns = useMemo<ColumnDef<ClaimTableRow>[]>(
    () => [
      {
        accessorKey: "intervention",
        header: "Intervention"
      },
      {
        accessorKey: "outcome",
        header: "Outcome"
      },
      {
        accessorKey: "label",
        header: "Label",
        cell: ({ row }) => (
          <span className={cn("rounded-md border px-2 py-1 text-xs font-semibold", labelTone(row.original.label))}>
            {row.original.label}
          </span>
        )
      },
      {
        accessorKey: "composite",
        header: "Score",
        cell: ({ row }) => row.original.composite.toFixed(1)
      },
      {
        accessorKey: "safety",
        header: "Safety"
      },
      {
        accessorKey: "regulatoryRisk",
        header: "Reg risk"
      },
      {
        accessorKey: "confidence",
        header: "Confidence"
      }
    ],
    []
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Claim Scores</h2>
          <p className="mt-1 text-sm text-slate-600">Each row is an intervention-outcome pair.</p>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[860px] border-separate border-spacing-0 text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="border-b border-line bg-mist px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
                  >
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      className="inline-flex items-center gap-1 rounded-sm outline-none focus:ring-4 focus:ring-signal/20"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5" />
                    </button>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  "cursor-pointer transition hover:bg-blue-50",
                  row.original.id === activeClaimId && "bg-blue-50"
                )}
                onClick={() => onSelectClaim(row.original.id)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="border-b border-line px-3 py-3 align-middle text-slate-700">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SafetyPanel({
  interventionsById,
  safetyAlerts
}: {
  interventionsById: Map<string, Intervention>;
  safetyAlerts: SafetyAlert[];
}) {
  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <h2 className="text-base font-semibold text-ink">Safety Center</h2>
      <div className="mt-4 grid gap-3">
        {safetyAlerts.map((alert) => (
          <article key={alert.id} className="rounded-lg border border-line bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-ink">
                  {interventionsById.get(alert.interventionId)?.name}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {alert.source} - {alert.region} - {alert.date}
                </p>
              </div>
              <span className={cn("rounded-md border px-2 py-1 text-xs font-semibold", severityTone(alert.severity))}>
                {alert.severity}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-700">{alert.summary}</p>
            <a
              href={alert.url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-signal hover:underline"
            >
              Source <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

function EvidenceCards({
  claims: visibleClaims,
  interventionsById,
  referencesById,
  activeClaimId,
  onSelectClaim
}: {
  claims: Claim[];
  interventionsById: Map<string, Intervention>;
  referencesById: Map<string, Reference>;
  activeClaimId: string;
  onSelectClaim: (claimId: string) => void;
}) {
  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <h2 className="text-base font-semibold text-ink">Evidence Cards</h2>
      <div className="mt-4 grid gap-3">
        {visibleClaims.map((claim) => {
          const intervention = interventionsById.get(claim.interventionId);

          return (
            <button
              key={claim.id}
              type="button"
              onClick={() => onSelectClaim(claim.id)}
              className={cn(
                "rounded-lg border border-line bg-white p-3 text-left transition hover:border-signal hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-signal/20",
                activeClaimId === claim.id && "border-signal ring-2 ring-signal/20"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-ink">
                    {intervention?.name} - {shortOutcome(claim.outcome)}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{claim.claimText}</p>
                </div>
                <span className={cn("rounded-md border px-2 py-1 text-xs font-semibold", labelTone(claim.finalLabel))}>
                  {claim.finalLabel}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{claim.clinicalRelevance}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {claim.keyReferenceIds.map((referenceId) => {
                  const reference = referencesById.get(referenceId);

                  if (!reference) {
                    return null;
                  }

                  return (
                    <span
                      key={referenceId}
                      className="rounded-md border border-line bg-mist px-2 py-1 text-xs text-slate-600"
                    >
                      {reference.source}
                      {reference.identifier ? ` - ${reference.identifier}` : ""}
                    </span>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function LabelAnalyzer({
  labelText,
  setLabelText,
  findings,
  productSignals
}: {
  labelText: string;
  setLabelText: (value: string) => void;
  findings: ReturnType<typeof analyzeLabel>;
  productSignals: ProductSignal[];
}) {
  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Product Label Analyzer</h2>
          <p className="mt-1 text-sm text-slate-600">Ingredient text is checked for quality and safety signals.</p>
        </div>
        <ClipboardCheck aria-hidden="true" className="h-5 w-5 text-spruce" />
      </div>
      <textarea
        value={labelText}
        onChange={(event) => setLabelText(event.target.value)}
        className="mt-4 min-h-40 w-full resize-y rounded-md border border-line bg-white p-3 text-sm leading-6 outline-none ring-signal/20 transition focus:border-signal focus:ring-4"
        placeholder="Paste supplement facts or marketing text"
      />
      <div className="mt-4 grid gap-3">
        {findings.length === 0 ? (
          <div className="rounded-lg border border-line bg-mist p-3 text-sm text-slate-600">
            No label warnings detected in the current text.
          </div>
        ) : (
          findings.map((finding) => (
            <article
              key={finding.id}
              className={cn(
                "rounded-lg border p-3",
                finding.level === "high" && "border-danger/30 bg-red-50",
                finding.level === "moderate" && "border-amberline/30 bg-amber-50",
                finding.level === "low" && "border-spruce/30 bg-teal-50"
              )}
            >
              <h3 className="text-sm font-semibold text-ink">{finding.title}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-700">{finding.detail}</p>
            </article>
          ))
        )}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {productSignals.map((product) => (
          <div key={product.id} className="rounded-lg border border-line bg-mist p-3">
            <h3 className="text-sm font-semibold text-ink">{product.name}</h3>
            <p className="mt-1 text-xs text-slate-500">{product.brand}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <span className="rounded-md bg-white px-2 py-1 text-slate-700">
                Quality {product.qualityScore}/10
              </span>
              <span className="rounded-md bg-white px-2 py-1 text-slate-700">
                Claim risk {product.labelClaimRiskScore}/10
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TrialWatcher({
  interventionsById,
  trialWatchItems
}: {
  interventionsById: Map<string, Intervention>;
  trialWatchItems: TrialWatchItem[];
}) {
  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <h2 className="text-base font-semibold text-ink">Trial Watcher</h2>
      <div className="mt-4 grid gap-3">
        {trialWatchItems.map((item) => (
          <article key={item.id} className="rounded-lg border border-line bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {interventionsById.get(item.interventionId)?.name} - {item.lastUpdateDate}
                </p>
              </div>
              <span className="rounded-md border border-signal/30 bg-blue-50 px-2 py-1 text-xs font-semibold text-signal">
                {item.evidenceImpact}
              </span>
            </div>
            <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
              <MiniStat label="Status" value={item.status} />
              <MiniStat label="Phase" value={item.phase} />
              <MiniStat label="Scope" value={item.enrollment} />
            </dl>
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-signal hover:underline"
            >
              Source <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

function SourceAndStudyPanel({
  referencesById,
  studies
}: {
  referencesById: Map<string, Reference>;
  studies: Study[];
}) {
  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink">Sources and Review Queue</h2>
          <p className="mt-1 text-sm text-slate-600">Seed records stay linked to primary or regulatory sources.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/pubmed/search?term=creatine%20monohydrate"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-mist px-3 text-xs font-semibold text-slate-700 hover:border-signal"
            target="_blank"
          >
            PubMed <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
          </a>
          <a
            href="/api/trials/search?term=omega-3"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-mist px-3 text-xs font-semibold text-slate-700 hover:border-signal"
            target="_blank"
          >
            Trials <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        {studies.map((study) => {
          const reference = referencesById.get(study.referenceId);

          return (
            <article key={study.id} className="rounded-lg border border-line bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-ink">{study.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {study.source} - {study.year}
                  </p>
                </div>
                <span className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                  {study.studyType}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Outcomes: {study.outcomes.join(", ")}
              </p>
              {reference ? (
                <a
                  href={reference.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-signal hover:underline"
                >
                  {reference.source} <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-mist p-2">
      <dt className="font-semibold text-slate-500">{label}</dt>
      <dd className="mt-1 text-slate-700">{value}</dd>
    </div>
  );
}

function shortOutcome(outcome: OutcomeArea) {
  const labels: Record<OutcomeArea, string> = {
    "Mortality/lifespan": "Lifespan",
    "Cardiovascular events": "CV events",
    "LDL/ApoB/lipids": "Lipids",
    "Blood pressure": "Blood pressure",
    "Glucose/insulin/HbA1c": "Glucose",
    Inflammation: "Inflammation",
    Cognition: "Cognition",
    Sleep: "Sleep",
    "Mood/stress": "Mood",
    "Muscle/strength": "Strength",
    "VO2 max/endurance": "Endurance",
    "Joint/tendon/skin": "Joint/skin",
    "Eye health": "Eye health",
    "Immune/respiratory": "Immune",
    "Fertility/hormones": "Hormones",
    "Biological aging clocks": "Aging clocks",
    "Safety/adverse effects": "Safety"
  };

  return labels[outcome];
}
