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
import type {
  ClinicalTrialSearchItem,
  ClinicalTrialSearchResult
} from "@/lib/integrations/clinical-trials";
import type {
  PubMedArticleSummary,
  PubMedSearchResult
} from "@/lib/integrations/pubmed";
import {
  normaliseLiveSourceSearchTerm,
  publicLiveSourceDisplayError
} from "@/lib/live-source-request";
import {
  australiaRegulatoryKindDescription,
  australiaRegulatoryTone,
  getPrimaryAustraliaStatus
} from "@/lib/regulatory";
import {
  analyzeLabel,
  compositeScore,
  getClaimScoreRows,
  labelTone,
  scoreBand,
  severityTone
} from "@/lib/scoring";
import { summarizeReviewStatus } from "@/lib/review-summary";
import {
  buildClaimSourcePacket,
  summarizeClaimSourcePackets,
  type ClaimSourcePacket,
  type ClaimSourcePacketSummary
} from "@/lib/source-packet";
import { buildSourceSearchQueries } from "@/lib/source-queries";
import { formatProductRegionLabel } from "@/lib/product-signals";
import type {
  Claim,
  EvidenceDashboardData,
  EvidenceLabel,
  AustraliaRegulatoryStatus,
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
  sourcePacketStatus: ClaimSourcePacket["completeness"]["status"];
  sourcePacketLabel: string;
  composite: number;
  safety: number;
  regulatoryRisk: number;
  confidence: string;
  updated: string;
};

type LivePreviewStatus = "idle" | "loading" | "ready" | "error";
type SourceSearchSubmission = {
  term: string;
  requestId: number;
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
  const hasFilteredClaims = filteredClaims.length > 0;

  useEffect(() => {
    if (filteredClaims.length === 0) {
      return;
    }

    if (filteredClaims.some((claim) => claim.id === activeClaimId)) {
      return;
    }

    setActiveClaimId(filteredClaims[0].id);
  }, [activeClaimId, filteredClaims]);

  const activeClaim =
    filteredClaims.find((claim) => claim.id === activeClaimId) ??
    filteredClaims[0] ??
    claims.find((claim) => claim.id === activeClaimId) ??
    claims[0] ??
    null;
  const activeClaimIdForDisplay = activeClaim?.id ?? "";
  const activeIntervention = activeClaim
    ? interventionsById.get(activeClaim.interventionId)
    : undefined;
  const activeAustraliaStatus = activeIntervention
    ? getPrimaryAustraliaStatus(data.australiaRegulatoryStatuses, activeIntervention.id)
    : undefined;
  const labelFindings = analyzeLabel(labelText);
  const reviewSummary = useMemo(() => summarizeReviewStatus(claims), [claims]);
  const sourcePacketSummary = useMemo(
    () =>
      summarizeClaimSourcePackets({
        claims,
        referencesById,
        studies
      }),
    [claims, referencesById, studies]
  );

  const tableRows = useMemo(
    () =>
      filteredClaims.map((claim) => {
        const sourcePacket = buildClaimSourcePacket({
          claim,
          referencesById,
          studies
        });

        return {
          id: claim.id,
          intervention: interventionsById.get(claim.interventionId)?.name ?? "Unknown",
          outcome: claim.outcome,
          label: claim.finalLabel,
          sourcePacketStatus: sourcePacket.completeness.status,
          sourcePacketLabel: sourcePacket.completeness.label,
          composite: compositeScore(claim.scores),
          safety: claim.scores.safety,
          regulatoryRisk: claim.scores.regulatoryRisk,
          confidence: claim.confidenceLevel,
          updated: claim.lastUpdated
        };
      }),
    [filteredClaims, interventionsById, referencesById, studies]
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
            value={reviewSummary.humanReviewed}
            detail={`${reviewSummary.unreviewedDrafts} drafts awaiting review`}
          />
          <MetricPanel
            icon={<AlertTriangle aria-hidden="true" className="h-4 w-4" />}
            label="Safety alerts"
            value={safetyAlerts.length}
            detail={`${safetyAlerts.filter((alert) => alert.severity !== "Low").length} moderate+`}
          />
          <MetricPanel
            icon={<FlaskConical aria-hidden="true" className="h-4 w-4" />}
            label="Source packets"
            value={`${sourcePacketSummary.completeClaims}/${sourcePacketSummary.totalClaims}`}
            detail={sourcePacketSummaryDetail(sourcePacketSummary)}
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
              activeClaimId={activeClaimIdForDisplay}
              onSelectClaim={setActiveClaimId}
            />
          </div>

          {hasFilteredClaims && activeClaim ? (
            <ScorePanel
              australiaStatus={activeAustraliaStatus}
              claim={activeClaim}
              intervention={activeIntervention}
            />
          ) : (
            <FilteredClaimDetailEmptyState
              title="Active Evidence Card"
              detail="No active evidence card is selected because the current filters do not match local scored claims."
            />
          )}
        </section>

        <section className="grid items-start gap-4 xl:grid-cols-[1fr_0.8fr]">
          <ClaimTable
            rows={tableRows}
            onSelectClaim={setActiveClaimId}
            activeClaimId={activeClaimIdForDisplay}
          />
          <SafetyPanel interventionsById={interventionsById} safetyAlerts={safetyAlerts} />
        </section>

        <section className="grid items-start gap-4 xl:grid-cols-[1fr_1fr]">
          <EvidenceCards
            claims={filteredClaims}
            interventionsById={interventionsById}
            referencesById={referencesById}
            studies={studies}
            activeClaimId={activeClaimIdForDisplay}
            onSelectClaim={setActiveClaimId}
          />
          <LabelAnalyzer
            labelText={labelText}
            setLabelText={setLabelText}
            findings={labelFindings}
            productSignals={productSignals}
            australiaRegulatoryStatuses={data.australiaRegulatoryStatuses}
          />
        </section>

        <section className="grid items-start gap-4 xl:grid-cols-[0.8fr_1fr]">
          <TrialWatcher
            interventionsById={interventionsById}
            trialWatchItems={trialWatchItems}
          />
          {hasFilteredClaims && activeClaim ? (
            <SourceAndStudyPanel
              key={activeClaim.id}
              activeClaim={activeClaim}
              activeIntervention={activeIntervention}
              referencesById={referencesById}
              studies={studies}
            />
          ) : (
            <FilteredClaimDetailEmptyState
              title="Sources and Review Queue"
              detail="Source packets and live search suggestions appear after the current filters match a local scored claim."
            />
          )}
        </section>
      </div>
    </main>
  );
}

function FilteredClaimDetailEmptyState({
  detail,
  title
}: {
  detail: string;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <p className="mt-4 rounded-lg border border-line bg-mist p-3 text-sm leading-6 text-slate-600">
        {detail} Clear the search or category filter to return to the full local evidence set.
      </p>
    </section>
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
  value: React.ReactNode;
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

function sourcePacketSummaryDetail(summary: ClaimSourcePacketSummary) {
  if (summary.totalClaims === 0) {
    return "No scored claims yet";
  }

  const needsWork =
    summary.extractionPendingClaims +
    summary.missingSourceClaims +
    summary.unlinkedClaims;

  if (needsWork === 0) {
    return `${summary.extractedReferences}/${summary.totalReferences} linked refs extracted`;
  }

  return `${needsWork} need source work: ${summary.extractionPendingClaims} pending, ${summary.missingSourceClaims} missing, ${summary.unlinkedClaims} unlinked`;
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

  if (visibleClaims.length === 0) {
    return (
      <p className="mt-4 rounded-lg border border-line bg-mist p-3 text-sm leading-6 text-slate-600">
        No local scored claims match the current filters. Clear the search or category filter to
        rebuild the evidence map.
      </p>
    );
  }

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
  australiaStatus,
  claim,
  intervention
}: {
  australiaStatus?: AustraliaRegulatoryStatus;
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
        <AustraliaRegulatoryDetail status={australiaStatus} />
        <DetailRow label="Dose/form" value={claim.doseFormStudied} />
        <DetailRow label="Safety" value={claim.safetyNotes} />
        <DetailRow label="Score mover" value={claim.whatWouldChangeScore} />
      </dl>
    </aside>
  );
}

function AustraliaRegulatoryDetail({
  status
}: {
  status?: AustraliaRegulatoryStatus;
}) {
  if (!status) {
    return (
      <DetailRow
        label="AU/TGA"
        value="Australian regulatory status has not been captured for this intervention yet."
      />
    );
  }

  return (
    <div className="grid gap-2 rounded-md border border-line bg-mist p-3 sm:grid-cols-[120px_1fr]">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">AU/TGA</dt>
      <dd className="text-sm text-slate-700">
        <span
          className={cn(
            "mb-2 inline-flex rounded-md border px-2 py-1 text-xs font-semibold",
            australiaRegulatoryTone(status.kind)
          )}
        >
          {status.kind}
        </span>
        <p className="leading-6">{status.status}</p>
        <p className="mt-1 leading-6 text-slate-600">{status.supplySummary}</p>
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-semibold text-signal">
            Research detail
          </summary>
          <p className="mt-2 leading-6 text-slate-600">
            {australiaRegulatoryKindDescription(status.kind)}
          </p>
          <p className="mt-2 leading-6 text-slate-600">{status.evidenceRequirement}</p>
          <a
            href={status.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-signal hover:underline"
          >
            TGA source <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
          </a>
        </details>
      </dd>
    </div>
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
        accessorKey: "sourcePacketLabel",
        header: "Sources",
        cell: ({ row }) => (
          <span className={cn("rounded-md border px-2 py-1 text-xs font-semibold", sourcePacketCompletenessTone(row.original.sourcePacketStatus))}>
            {row.original.sourcePacketLabel}
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
      {rows.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[960px] border-separate border-spacing-0 text-sm">
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
              {table.getRowModel().rows.map((row) => {
                const isActive = row.original.id === activeClaimId;
                const selectRow = () => onSelectClaim(row.original.id);

                return (
                  <tr
                    key={row.id}
                    aria-selected={isActive}
                    className={cn(
                      "cursor-pointer transition hover:bg-blue-50 focus:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-inset focus:ring-signal/20",
                      isActive && "bg-blue-50"
                    )}
                    onClick={selectRow}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        selectRow();
                      }
                    }}
                    tabIndex={0}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="border-b border-line px-3 py-3 align-middle text-slate-700">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-line bg-mist p-3 text-sm leading-6 text-slate-600">
          No local scored claims match the current filters. Clear the search or category filter to
          return to the full local evidence set.
        </p>
      )}
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
        {safetyAlerts.length > 0 ? (
          safetyAlerts.map((alert) => (
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
          ))
        ) : (
          <p className="rounded-lg border border-line bg-mist p-3 text-sm leading-6 text-slate-600">
            No local safety alerts were captured for this dataset. Check current regulator and
            clinical sources before treating any intervention or product as low risk.
          </p>
        )}
      </div>
    </section>
  );
}

function EvidenceCards({
  claims: visibleClaims,
  interventionsById,
  referencesById,
  studies,
  activeClaimId,
  onSelectClaim
}: {
  claims: Claim[];
  interventionsById: Map<string, Intervention>;
  referencesById: Map<string, Reference>;
  studies: Study[];
  activeClaimId: string;
  onSelectClaim: (claimId: string) => void;
}) {
  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <h2 className="text-base font-semibold text-ink">Evidence Cards</h2>
      <div className="mt-4 grid gap-3">
        {visibleClaims.length > 0 ? (
          visibleClaims.map((claim) => {
            const intervention = interventionsById.get(claim.interventionId);
            const claimReferences = claim.keyReferenceIds
              .map((referenceId) => referencesById.get(referenceId))
              .filter((reference): reference is Reference => Boolean(reference));
            const sourcePacket = buildClaimSourcePacket({
              claim,
              referencesById,
              studies
            });

            return (
              <article
                key={claim.id}
                className={cn(
                  "rounded-lg border border-line bg-white p-3 transition",
                  activeClaimId === claim.id && "border-signal ring-2 ring-signal/20"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-ink">
                      <button
                        type="button"
                        onClick={() => onSelectClaim(claim.id)}
                        className="rounded-md text-left outline-none transition hover:text-signal focus:ring-4 focus:ring-signal/20"
                      >
                        {intervention?.name} - {shortOutcome(claim.outcome)}
                      </button>
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-slate-700">{claim.claimText}</p>
                  </div>
                  <span className={cn("rounded-md border px-2 py-1 text-xs font-semibold", labelTone(claim.finalLabel))}>
                    {claim.finalLabel}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{claim.clinicalRelevance}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                    {claim.reviewStatus}
                  </span>
                  <span className={cn("rounded-md border px-2 py-1 text-xs font-semibold", sourcePacketCompletenessTone(sourcePacket.completeness.status))}>
                    Source packet: {sourcePacket.completeness.label}
                  </span>
                  <span className="rounded-md border border-line bg-mist px-2 py-1 text-xs text-slate-600">
                    Confidence: {claim.confidenceLevel}
                  </span>
                  {claimReferences.map((reference) => (
                    <span
                      key={reference.id}
                      className="rounded-md border border-line bg-mist px-2 py-1 text-xs text-slate-600"
                    >
                      {reference.source}
                      {reference.identifier ? ` - ${reference.identifier}` : ""}
                    </span>
                  ))}
                </div>
                <details className="mt-3 rounded-md border border-line bg-mist p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-signal">
                    Research detail
                  </summary>
                  <dl className="mt-3 grid gap-2 text-xs md:grid-cols-2">
                    <MiniStat label="Evidence grade" value={claim.evidenceGrade} />
                    <MiniStat label="Effect" value={claim.effectSize} />
                    <MiniStat label="Population" value={claim.populationStudied} />
                    <MiniStat label="Comparator" value={claim.comparator} />
                    <MiniStat label="Duration" value={claim.durationStudied} />
                    <MiniStat label="Applicability" value={claim.applicabilityNotes} />
                    <MiniStat label="Score mover" value={claim.whatWouldChangeScore} />
                    <MiniStat label="Last reviewed" value={claim.lastUpdated} />
                  </dl>
                  <div className="mt-3 grid gap-2">
                    {claimReferences.length > 0 ? (
                      claimReferences.map((reference) => (
                        <a
                          key={reference.id}
                          href={reference.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex w-fit max-w-full items-center gap-1 break-words text-xs font-semibold text-signal hover:underline"
                        >
                          {reference.source}
                          {reference.identifier ? ` - ${reference.identifier}` : ""}
                          <ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                        </a>
                      ))
                    ) : (
                      <p className="text-xs text-slate-600">No references linked yet.</p>
                    )}
                  </div>
                </details>
              </article>
            );
          })
        ) : (
          <p className="rounded-lg border border-line bg-mist p-3 text-sm leading-6 text-slate-600">
            No evidence cards match the current filters. Clear the search or category filter to
            review the full local evidence set.
          </p>
        )}
      </div>
    </section>
  );
}

function LabelAnalyzer({
  australiaRegulatoryStatuses,
  labelText,
  setLabelText,
  findings,
  productSignals
}: {
  australiaRegulatoryStatuses: AustraliaRegulatoryStatus[];
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
      <label className="sr-only" htmlFor="product-label-text">
        Product label text
      </label>
      <textarea
        id="product-label-text"
        value={labelText}
        onChange={(event) => setLabelText(event.target.value)}
        className="mt-4 min-h-40 w-full resize-y rounded-md border border-line bg-white p-3 text-sm leading-6 outline-none ring-signal/20 transition focus:border-signal focus:ring-4"
        placeholder="Paste supplement facts or marketing text"
      />
      <div className="mt-4 grid gap-3">
        {findings.length === 0 ? (
          <div className="rounded-lg border border-line bg-mist p-3 text-sm text-slate-600">
            No local label-risk warnings from these checks. Verify product-level AUST/ARTG status and claim citations before treating the label as Australia-ready.
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
              {finding.sourceUrl ? (
                <a
                  href={finding.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-signal hover:underline"
                >
                  {finding.sourceLabel ?? "Source"}{" "}
                  <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                </a>
              ) : finding.sourceLabel ? (
                <span className="mt-2 inline-flex rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-slate-600">
                  {finding.sourceLabel}
                </span>
              ) : null}
            </article>
          ))
        )}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {productSignals.map((product) => (
          <div key={product.id} className="rounded-lg border border-line bg-mist p-3">
            <h3 className="text-sm font-semibold text-ink">{product.name}</h3>
            <p className="mt-1 text-xs text-slate-500">{product.brand}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-md border border-line bg-white px-2 py-1 text-slate-700">
                Market context: {formatProductRegionLabel(product.region)}
              </span>
              {product.proprietaryBlend ? (
                <span className="rounded-md border border-amberline/30 bg-amber-50 px-2 py-1 font-semibold text-amberline">
                  Proprietary blend
                </span>
              ) : null}
            </div>
            <ProductAustraliaRegulatoryChip
              status={australiaRegulatoryStatuses.find((item) => item.productId === product.id)}
            />
            <p className="mt-3 text-xs leading-5 text-slate-600">
              {product.certifications.length > 0
                ? `Certifications: ${product.certifications.join(", ")}`
                : "No product certifications captured."}
            </p>
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

function ProductAustraliaRegulatoryChip({
  status
}: {
  status?: AustraliaRegulatoryStatus;
}) {
  if (!status) {
    return (
      <div className="mt-3">
        <span className="inline-flex rounded-md border border-amberline/30 bg-amber-50 px-2 py-1 text-xs font-semibold text-amberline">
          AU status uncaptured
        </span>
        <p className="mt-2 text-xs leading-5 text-slate-600">
          No product-level AUST/ARTG record has been captured for this product.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <span
        className={cn(
          "inline-flex rounded-md border px-2 py-1 text-xs font-semibold",
          australiaRegulatoryTone(status.kind)
        )}
        title={status.evidenceRequirement}
      >
        AU: {status.kind} - {status.status}
      </span>
      <details className="mt-2 rounded-md border border-line bg-white px-3 py-2 text-xs text-slate-600">
        <summary className="cursor-pointer font-semibold text-ink">AU/TGA detail</summary>
        <dl className="mt-2 grid gap-2">
          <div>
            <dt className="font-semibold text-slate-500">Supply status</dt>
            <dd className="mt-0.5 leading-5">{status.supplySummary}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Evidence needed</dt>
            <dd className="mt-0.5 leading-5">{status.evidenceRequirement}</dd>
          </div>
          {status.austNumber ? (
            <div>
              <dt className="font-semibold text-slate-500">AUST number</dt>
              <dd className="mt-0.5 leading-5">{status.austNumber}</dd>
            </div>
          ) : null}
          {status.sponsor ? (
            <div>
              <dt className="font-semibold text-slate-500">Sponsor</dt>
              <dd className="mt-0.5 leading-5">{status.sponsor}</dd>
            </div>
          ) : null}
          <div>
            <dt className="font-semibold text-slate-500">Checked</dt>
            <dd className="mt-0.5 leading-5">{status.checkedAt}</dd>
          </div>
        </dl>
        <p className="mt-2 leading-5">{status.notes}</p>
        <a
          href={status.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 font-semibold text-signal hover:underline"
        >
          TGA source <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
        </a>
      </details>
    </div>
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
        {trialWatchItems.length > 0 ? (
          trialWatchItems.map((item) => (
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
          ))
        ) : (
          <p className="rounded-lg border border-line bg-mist p-3 text-sm leading-6 text-slate-600">
            No local trial-watch records were captured for this dataset. Check current
            ClinicalTrials.gov records before treating the absence of local watch items as evidence
            that no relevant trials exist.
          </p>
        )}
      </div>
    </section>
  );
}

function SourceAndStudyPanel({
  activeClaim,
  activeIntervention,
  referencesById,
  studies
}: {
  activeClaim: Claim;
  activeIntervention?: Intervention;
  referencesById: Map<string, Reference>;
  studies: Study[];
}) {
  const activeSourceQueries = useMemo(
    () =>
      buildSourceSearchQueries({
        claim: activeClaim,
        intervention: activeIntervention
      }),
    [activeClaim, activeIntervention]
  );
  const activeSourcePacket = useMemo(
    () =>
      buildClaimSourcePacket({
        claim: activeClaim,
        referencesById,
        studies
      }),
    [activeClaim, referencesById, studies]
  );
  const activeStudyIds = useMemo(
    () => new Set(activeSourcePacket.studies.map((study) => study.id)),
    [activeSourcePacket.studies]
  );
  const otherStudies = useMemo(
    () => studies.filter((study) => !activeStudyIds.has(study.id)),
    [activeStudyIds, studies]
  );
  const [pubMedTerm, setPubMedTerm] = useState(() => activeSourceQueries.pubMedTerm);
  const [submittedPubMedSearch, setSubmittedPubMedSearch] =
    useState<SourceSearchSubmission | null>(null);
  const [pubMedResult, setPubMedResult] = useState<PubMedSearchResult | null>(null);
  const [pubMedStatus, setPubMedStatus] = useState<LivePreviewStatus>("idle");
  const [pubMedError, setPubMedError] = useState<string | null>(null);
  const [trialTerm, setTrialTerm] = useState(() => activeSourceQueries.trialTerm);
  const [submittedTrialSearch, setSubmittedTrialSearch] =
    useState<SourceSearchSubmission | null>(null);
  const [trialResult, setTrialResult] = useState<ClinicalTrialSearchResult | null>(null);
  const [trialStatus, setTrialStatus] = useState<LivePreviewStatus>("idle");
  const [trialError, setTrialError] = useState<string | null>(null);

  useEffect(() => {
    setPubMedTerm(activeSourceQueries.pubMedTerm);
    setSubmittedPubMedSearch(null);
    setPubMedResult(null);
    setPubMedStatus("idle");
    setPubMedError(null);

    setTrialTerm(activeSourceQueries.trialTerm);
    setSubmittedTrialSearch(null);
    setTrialResult(null);
    setTrialStatus("idle");
    setTrialError(null);
  }, [activeSourceQueries.pubMedTerm, activeSourceQueries.trialTerm]);

  useEffect(() => {
    if (!submittedPubMedSearch) {
      return;
    }

    const controller = new AbortController();
    const submittedTerm = submittedPubMedSearch.term;

    async function loadPubMedPreview() {
      setPubMedStatus("loading");
      setPubMedError(null);
      setPubMedResult(null);

      try {
        const response = await fetch(
          `/api/pubmed/search?term=${encodeURIComponent(submittedTerm)}&retmax=5`,
          {
            signal: controller.signal,
            cache: "no-store"
          }
        );
        const body = (await response.json()) as PubMedSearchResult | { error?: string };

        if (!response.ok) {
          throw new Error("error" in body && body.error ? body.error : "PubMed search failed.");
        }

        if (!controller.signal.aborted) {
          setPubMedResult(body as PubMedSearchResult);
          setPubMedStatus("ready");
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setPubMedError(publicLiveSourceDisplayError("PubMed", error));
          setPubMedStatus("error");
        }
      }
    }

    loadPubMedPreview();

    return () => {
      controller.abort();
    };
  }, [submittedPubMedSearch]);

  useEffect(() => {
    if (!submittedTrialSearch) {
      return;
    }

    const controller = new AbortController();
    const submittedTerm = submittedTrialSearch.term;

    async function loadTrialPreview() {
      setTrialStatus("loading");
      setTrialError(null);
      setTrialResult(null);

      try {
        const response = await fetch(
          `/api/trials/search?term=${encodeURIComponent(submittedTerm)}&pageSize=5`,
          {
            signal: controller.signal,
            cache: "no-store"
          }
        );
        const body = (await response.json()) as ClinicalTrialSearchResult | { error?: string };

        if (!response.ok) {
          throw new Error(
            "error" in body && body.error ? body.error : "ClinicalTrials.gov search failed."
          );
        }

        if (!controller.signal.aborted) {
          setTrialResult(body as ClinicalTrialSearchResult);
          setTrialStatus("ready");
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setTrialError(publicLiveSourceDisplayError("ClinicalTrials.gov", error));
          setTrialStatus("error");
        }
      }
    }

    loadTrialPreview();

    return () => {
      controller.abort();
    };
  }, [submittedTrialSearch]);

  const pubMedApiTerm = normaliseLiveSourceSearchTerm(submittedPubMedSearch?.term ?? pubMedTerm);
  const trialApiTerm = normaliseLiveSourceSearchTerm(submittedTrialSearch?.term ?? trialTerm);
  const pubMedApiHref = pubMedApiTerm
    ? `/api/pubmed/search?term=${encodeURIComponent(pubMedApiTerm)}&retmax=5`
    : "#pubmed-term";
  const trialApiHref = trialApiTerm
    ? `/api/trials/search?term=${encodeURIComponent(trialApiTerm)}&pageSize=5`
    : "#trial-term";
  const submitPubMedSearch = (term: string) => {
    const nextTerm = normaliseLiveSourceSearchTerm(term);

    if (!nextTerm) {
      return;
    }

    setPubMedTerm(nextTerm);
    setSubmittedPubMedSearch((current) => ({
      term: nextTerm,
      requestId: (current?.requestId ?? 0) + 1
    }));
  };
  const submitTrialSearch = (term: string) => {
    const nextTerm = normaliseLiveSourceSearchTerm(term);

    if (!nextTerm) {
      return;
    }

    setTrialTerm(nextTerm);
    setSubmittedTrialSearch((current) => ({
      term: nextTerm,
      requestId: (current?.requestId ?? 0) + 1
    }));
  };
  const applyActivePubMedSearch = () => {
    submitPubMedSearch(activeSourceQueries.pubMedTerm);
  };
  const applyActiveTrialSearch = () => {
    submitTrialSearch(activeSourceQueries.trialTerm);
  };
  const applyActiveSourceSearches = () => {
    applyActivePubMedSearch();
    applyActiveTrialSearch();
  };

  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink">Sources and Review Queue</h2>
          <p className="mt-1 text-sm text-slate-600">Seed records stay linked to primary or regulatory sources.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <form
            className="flex min-w-0 gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const nextTerm = pubMedTerm.trim();

              if (nextTerm) {
                submitPubMedSearch(nextTerm);
              }
            }}
          >
            <label className="sr-only" htmlFor="pubmed-term">
              PubMed term
            </label>
            <input
              id="pubmed-term"
              value={pubMedTerm}
              onChange={(event) => setPubMedTerm(event.target.value)}
              className="h-9 w-full min-w-0 rounded-md border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-signal sm:w-56"
            />
            <button
              type="submit"
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-line bg-mist px-3 text-xs font-semibold text-slate-700 hover:border-signal"
            >
              <Search aria-hidden="true" className="h-3.5 w-3.5" />
              Search
            </button>
          </form>
          <form
            className="flex min-w-0 gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const nextTerm = trialTerm.trim();

              if (nextTerm) {
                submitTrialSearch(nextTerm);
              }
            }}
          >
            <label className="sr-only" htmlFor="trial-term">
              ClinicalTrials.gov term
            </label>
            <input
              id="trial-term"
              value={trialTerm}
              onChange={(event) => setTrialTerm(event.target.value)}
              className="h-9 w-full min-w-0 rounded-md border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-signal sm:w-48"
            />
            <button
              type="submit"
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-line bg-mist px-3 text-xs font-semibold text-slate-700 hover:border-signal"
            >
              <FlaskConical aria-hidden="true" className="h-3.5 w-3.5" />
              Trials
            </button>
          </form>
          <a
            href={pubMedApiHref}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-mist px-3 text-xs font-semibold text-slate-700 hover:border-signal"
            target="_blank"
            rel="noreferrer"
          >
            Raw PubMed <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
          </a>
          <a
            href={trialApiHref}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-mist px-3 text-xs font-semibold text-slate-700 hover:border-signal"
            target="_blank"
            rel="noreferrer"
          >
            Raw Trials <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-line bg-mist p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ink">Suggested searches</h3>
            <p className="mt-1 truncate text-xs text-slate-500">{activeSourceQueries.label}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={applyActivePubMedSearch}
              className="inline-flex h-8 items-center gap-2 rounded-md border border-line bg-white px-2 text-xs font-semibold text-slate-700 hover:border-signal"
            >
              <Search aria-hidden="true" className="h-3.5 w-3.5" />
              PubMed
            </button>
            <button
              type="button"
              onClick={applyActiveTrialSearch}
              className="inline-flex h-8 items-center gap-2 rounded-md border border-line bg-white px-2 text-xs font-semibold text-slate-700 hover:border-signal"
            >
              <FlaskConical aria-hidden="true" className="h-3.5 w-3.5" />
              Trials
            </button>
            <button
              type="button"
              onClick={applyActiveSourceSearches}
              className="inline-flex h-8 items-center rounded-md border border-signal/30 bg-blue-50 px-2 text-xs font-semibold text-signal hover:border-signal"
            >
              Both
            </button>
          </div>
        </div>
        <div className="mt-3 grid gap-2 text-xs lg:grid-cols-2">
          <MiniStat label="PubMed" value={activeSourceQueries.pubMedTerm} />
          <MiniStat label="Trials" value={activeSourceQueries.trialTerm} />
        </div>
      </div>
      <ActiveSourcePacketPanel
        claim={activeClaim}
        intervention={activeIntervention}
        packet={activeSourcePacket}
        referencesById={referencesById}
      />
      <PubMedTriagePreview
        error={pubMedError}
        result={pubMedResult}
        status={pubMedStatus}
        submittedTerm={submittedPubMedSearch?.term}
      />
      <ClinicalTrialsPreview
        error={trialError}
        result={trialResult}
        status={trialStatus}
        submittedTerm={submittedTrialSearch?.term}
      />
      <details className="mt-4 rounded-lg border border-line bg-white p-3">
        <summary className="cursor-pointer text-sm font-semibold text-ink">
          Other curated study records ({otherStudies.length})
        </summary>
        <div className="mt-3 grid gap-3">
          {otherStudies.length > 0 ? (
            otherStudies.map((study) => (
              <CuratedStudyCard
                key={study.id}
                reference={referencesById.get(study.referenceId)}
                study={study}
              />
            ))
          ) : (
            <p className="rounded-md border border-line bg-mist p-3 text-sm text-slate-600">
              No additional curated study records outside the active evidence card.
            </p>
          )}
        </div>
      </details>
    </section>
  );
}

function ActiveSourcePacketPanel({
  claim,
  intervention,
  packet,
  referencesById
}: {
  claim: Claim;
  intervention?: Intervention;
  packet: ClaimSourcePacket;
  referencesById: Map<string, Reference>;
}) {
  const completeness = packet.completeness;

  return (
    <div className="mt-4 rounded-lg border border-signal/25 bg-blue-50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">Active card source packet</h3>
          <p className="mt-1 text-xs text-slate-600">
            {intervention?.name ?? "Selected intervention"} - {shortOutcome(claim.outcome)}
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-700">{claim.claimText}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className={cn("rounded-md border px-2 py-1 font-semibold", labelTone(claim.finalLabel))}>
            {claim.finalLabel}
          </span>
          <span className="rounded-md border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-700">
            {claim.reviewStatus}
          </span>
          <span className={cn("rounded-md border px-2 py-1 font-semibold", sourcePacketCompletenessTone(completeness.status))}>
            {completeness.label}
          </span>
          <span className="rounded-md border border-signal/25 bg-white px-2 py-1 font-semibold text-signal">
            {completeness.extractedReferences}/{completeness.totalReferences} refs extracted
          </span>
          <span className="rounded-md border border-signal/25 bg-white px-2 py-1 font-semibold text-signal">
            {packet.studies.length} extracted studies
          </span>
          {completeness.pendingReferences > 0 ? (
            <span className="rounded-md border border-amberline/30 bg-amber-50 px-2 py-1 font-semibold text-amberline">
              {completeness.pendingReferences} pending
            </span>
          ) : null}
          {completeness.missingReferences > 0 ? (
            <span className="rounded-md border border-danger/30 bg-red-50 px-2 py-1 font-semibold text-danger">
              {completeness.missingReferences} missing
            </span>
          ) : null}
        </div>
      </div>
      <div className="mt-3 rounded-md border border-signal/20 bg-white px-3 py-2 text-sm leading-6 text-slate-700">
        <p>Curated source coverage: {completeness.detail}</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          <span className="font-semibold text-slate-700">Next source step:</span>{" "}
          {completeness.nextStep}
        </p>
      </div>

      <div className="mt-3 grid gap-3">
        {packet.studies.length > 0 ? (
          packet.studies.map((study) => (
            <CuratedStudyCard
              key={study.id}
              reference={referencesById.get(study.referenceId)}
              study={study}
            />
          ))
        ) : (
          <p className="rounded-md border border-line bg-white p-3 text-sm text-slate-600">
            No extracted study record has been attached to this active claim yet.
          </p>
        )}

        {packet.pendingReferences.map((reference) => (
          <article key={reference.id} className="rounded-md border border-line bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h4 className="text-sm font-semibold leading-6 text-ink">{reference.title}</h4>
                <p className="mt-1 text-xs text-slate-500">
                  {reference.source}
                  {reference.year ? ` - ${reference.year}` : ""}
                </p>
              </div>
              <span className="rounded-md border border-amberline/30 bg-amber-50 px-2 py-1 text-xs font-semibold text-amberline">
                Extraction pending
              </span>
              <span className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                {sourceContextLabel(reference)}
              </span>
            </div>
            <a
              href={reference.url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex max-w-full items-center gap-1 break-words text-xs font-semibold text-signal hover:underline"
            >
              {reference.identifier ?? reference.source}
              <ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            </a>
          </article>
        ))}

        {packet.references.length === 0 ? (
          <p className="rounded-md border border-line bg-white p-3 text-sm text-slate-600">
            No curated references are linked to this claim yet.
          </p>
        ) : null}

        {packet.missingReferenceIds.length > 0 ? (
          <p className="rounded-md border border-danger/30 bg-red-50 p-3 text-sm text-danger">
            Missing source records: {packet.missingReferenceIds.join(", ")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function CuratedStudyCard({
  reference,
  study
}: {
  reference?: Reference;
  study: Study;
}) {
  return (
    <article className="rounded-lg border border-line bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-6 text-ink">{study.title}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {study.source} - {study.year}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
            {study.studyType}
          </span>
          <span className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
            {sourceContextLabel(reference)}
          </span>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-700">
        Outcomes: {study.outcomes.join(", ")}
      </p>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold text-signal">
          Extraction detail
        </summary>
        <dl className="mt-2 grid gap-2 text-xs md:grid-cols-2">
          <MiniStat label="Sample" value={study.sampleSize} />
          <MiniStat label="Population" value={study.population} />
          <MiniStat label="Intervention" value={study.intervention} />
          <MiniStat label="Risk of bias" value={study.riskOfBias} />
          <MiniStat label="Adverse events" value={study.adverseEvents} />
          <MiniStat label="Funding/conflicts" value={study.fundingConflicts} />
        </dl>
      </details>
      {reference ? (
        <a
          href={reference.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex max-w-full items-center gap-1 break-words text-xs font-semibold text-signal hover:underline"
        >
          {reference.source}
          {reference.identifier ? ` - ${reference.identifier}` : ""}
          <ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        </a>
      ) : null}
    </article>
  );
}

function sourceContextLabel(reference?: Reference) {
  if (!reference) {
    return "Source link pending";
  }

  if (["FDA", "TGA", "WADA", "LiverTox"].includes(reference.source)) {
    return "Safety/regulatory source";
  }

  if (reference.source === "ClinicalTrials.gov") {
    return "Trial registry source";
  }

  return "Evidence source";
}

function sourcePacketCompletenessTone(status: ClaimSourcePacket["completeness"]["status"]) {
  if (status === "complete") {
    return "border-spruce/30 bg-teal-50 text-spruce";
  }

  if (status === "missing_sources") {
    return "border-danger/30 bg-red-50 text-danger";
  }

  if (status === "not_linked") {
    return "border-slate-300 bg-slate-50 text-slate-700";
  }

  return "border-amberline/30 bg-amber-50 text-amberline";
}

function livePreviewStatusLabel(status: LivePreviewStatus) {
  if (status === "idle") {
    return "Idle";
  }

  if (status === "loading") {
    return "Loading";
  }

  if (status === "error") {
    return "Needs retry";
  }

  return "Live preview";
}

function PubMedTriagePreview({
  error,
  result,
  submittedTerm,
  status
}: {
  error: string | null;
  result: PubMedSearchResult | null;
  submittedTerm?: string;
  status: LivePreviewStatus;
}) {
  const resultSummary =
    status === "idle"
      ? "No live PubMed search run yet"
      : result
        ? `${result.count.toLocaleString()} records for "${result.query}"`
        : submittedTerm
          ? `Citation candidates for "${submittedTerm}"`
          : "Citation candidates";

  return (
    <div className="mt-4 rounded-lg border border-line bg-mist p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">PubMed triage</h3>
          <p className="mt-1 text-xs text-slate-500">{resultSummary}</p>
          <p className="mt-1 text-xs text-slate-500">
            Live PubMed results are unreviewed citation leads; scores rank review priority, not
            evidence quality.
          </p>
        </div>
        <span className="rounded-md border border-signal/30 bg-blue-50 px-2 py-1 text-xs font-semibold text-signal">
          {livePreviewStatusLabel(status)}
        </span>
      </div>

      {status === "idle" ? (
        <p className="mt-3 rounded-md border border-line bg-white p-3 text-sm text-slate-600">
          Submit a PubMed term or use the active-card suggestion to load live citation candidates.
        </p>
      ) : null}

      {status === "error" ? (
        <p className="mt-3 rounded-md border border-danger/30 bg-red-50 p-3 text-sm text-danger">
          {error ?? "PubMed search failed."}
        </p>
      ) : null}

      {status === "loading" ? (
        <p className="mt-3 rounded-md border border-line bg-white p-3 text-sm text-slate-600">
          Loading PubMed citations...
        </p>
      ) : null}

      {status === "ready" && result ? (
        <div className="mt-3 grid gap-2">
          {result.articles.length > 0 ? (
            result.articles.map((article) => (
              <PubMedTriageArticle key={article.pmid} article={article} />
            ))
          ) : (
            <p className="rounded-md border border-line bg-white p-3 text-sm text-slate-600">
              No PubMed records returned.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function PubMedTriageArticle({ article }: { article: PubMedArticleSummary }) {
  const meta = [
    article.journal,
    article.publicationYear,
    article.publicationTypes.slice(0, 2).join(", ")
  ].filter(Boolean);
  const authors = article.authors.slice(0, 3).join(", ");
  const abstractStatus =
    article.hasAbstract === null ? "Unknown" : article.hasAbstract ? "Available" : "Not flagged";

  return (
    <article className="rounded-md border border-line bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold leading-6 text-ink">
            {article.title ?? `PubMed PMID ${article.pmid}`}
          </h4>
          <p className="mt-1 text-xs text-slate-500">{meta.join(" - ") || "Metadata pending"}</p>
        </div>
        <span className="rounded-md border border-spruce/30 bg-teal-50 px-2 py-1 text-xs font-semibold text-spruce">
          Review priority {article.relevanceScore}/100
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {article.relevanceReasons.map((reason) => (
          <span
            key={reason}
            className="rounded-md border border-line bg-mist px-2 py-1 text-xs font-semibold text-slate-600"
          >
            {reason}
          </span>
        ))}
      </div>

      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
        <MiniStat label="Authors" value={authors || "Not listed"} />
        <MiniStat label="Abstract" value={abstractStatus} />
        <MiniStat label="DOI" value={article.doi ?? "Not listed"} />
      </dl>

      <a
        href={article.url}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-signal hover:underline"
      >
        PMID {article.pmid} <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
      </a>
    </article>
  );
}

function ClinicalTrialsPreview({
  error,
  result,
  submittedTerm,
  status
}: {
  error: string | null;
  result: ClinicalTrialSearchResult | null;
  submittedTerm?: string;
  status: LivePreviewStatus;
}) {
  const resultSummary =
    status === "idle"
      ? "No live trial search run yet"
      : result
        ? `Live trial records for "${result.query}"`
        : submittedTerm
          ? `Trial candidates for "${submittedTerm}"`
          : "Trial candidates";

  return (
    <div className="mt-4 rounded-lg border border-line bg-mist p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">ClinicalTrials.gov preview</h3>
          <p className="mt-1 text-xs text-slate-500">{resultSummary}</p>
          <p className="mt-1 text-xs text-slate-500">
            Registry records are research leads, not proof of benefit; scores rank review priority,
            not evidence quality.
          </p>
        </div>
        <span className="rounded-md border border-signal/30 bg-blue-50 px-2 py-1 text-xs font-semibold text-signal">
          {livePreviewStatusLabel(status)}
        </span>
      </div>

      {status === "idle" ? (
        <p className="mt-3 rounded-md border border-line bg-white p-3 text-sm text-slate-600">
          Submit a ClinicalTrials.gov term or use the active-card suggestion to load live trial records.
        </p>
      ) : null}

      {status === "error" ? (
        <p className="mt-3 rounded-md border border-danger/30 bg-red-50 p-3 text-sm text-danger">
          {error ?? "ClinicalTrials.gov search failed."}
        </p>
      ) : null}

      {status === "loading" ? (
        <p className="mt-3 rounded-md border border-line bg-white p-3 text-sm text-slate-600">
          Loading trial records...
        </p>
      ) : null}

      {status === "ready" && result ? (
        <div className="mt-3 grid gap-2">
          {result.studies.length > 0 ? (
            result.studies.map((study) => (
              <ClinicalTrialsPreviewCard key={study.nctId} study={study} />
            ))
          ) : (
            <p className="rounded-md border border-line bg-white p-3 text-sm text-slate-600">
              No ClinicalTrials.gov records returned.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ClinicalTrialsPreviewCard({ study }: { study: ClinicalTrialSearchItem }) {
  return (
    <article className="rounded-md border border-line bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold leading-6 text-ink">{study.title}</h4>
          <p className="mt-1 text-xs text-slate-500">
            {study.status} - {study.phase} - {study.lastUpdateDate}
          </p>
        </div>
        <span className="rounded-md border border-spruce/30 bg-teal-50 px-2 py-1 text-xs font-semibold text-spruce">
          Review priority {study.triageScore}/100
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {study.triageReasons.map((reason) => (
          <span
            key={reason}
            className="rounded-md border border-line bg-mist px-2 py-1 text-xs font-semibold text-slate-600"
          >
            {reason}
          </span>
        ))}
      </div>

      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
        <MiniStat label="Enrollment" value={study.enrollment} />
        <MiniStat label="Study type" value={study.studyType} />
        <MiniStat label="Results" value={study.hasResults ? "Posted" : "Not posted"} />
      </dl>

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
        <MiniStat label="Conditions" value={shortList(study.conditions)} />
        <MiniStat label="Interventions" value={shortList(study.interventions)} />
        <MiniStat label="Primary outcomes" value={shortList(study.primaryOutcomes)} />
      </div>

      <a
        href={study.url}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-signal hover:underline"
      >
        {study.nctId} <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
      </a>
    </article>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-mist p-2">
      <dt className="font-semibold text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-slate-700">{value}</dd>
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
