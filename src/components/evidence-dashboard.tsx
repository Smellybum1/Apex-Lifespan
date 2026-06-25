"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  ExternalLink,
  Filter,
  FlaskConical,
  Search
} from "lucide-react";
import { TrialClassificationBadge } from "@/components/trial-classification-badge";

import { labelTrialWatchItem } from "@/lib/trial-registry-labels";
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
  australiaRegulatoryTone
} from "@/lib/regulatory";
import {
  buildProductAustraliaRegulatoryVerifications,
  type ProductAustraliaRegulatoryVerification
} from "@/lib/australia-regulatory-verification";
import {
  analyzeLabel,
  compositeScore,
  labelTone,
  scoreBand,
  severityTone
} from "@/lib/scoring";
import { summarizeReviewStatus } from "@/lib/review-summary";
import {
  buildClaimSourcePacket,
  summarizeClaimSourcePackets,
  type ClaimSourcePacket,
  type ClaimSourcePacketSummary,
  type EvidenceDepthBadge
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
import { SUPPLEMENT_ONBOARDING_CLAIM_TEMPLATES } from "@/lib/supplement-onboarding";

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

const CODEX_REVIEW_SIDECAR_URL_KEY = "apexCodexReviewSidecarUrl";
const CODEX_REVIEW_TOKEN_KEY = "apexCodexReviewToken";
const DEFAULT_CODEX_REVIEW_SIDECAR_URL = "http://127.0.0.1:3217/codex/review";
const HUMAN_REVIEWED_TOOLTIP =
  "Human reviewed means a human reviewer checked the source packet against the scoped claim. It does not mean clinical guideline endorsement.";
const compositeScoreFormula =
  "Composite = directness + rigor + impact + safety + measurability - hype/regulatory penalty.";
const compositeScoreDetail =
  "Weighted 0-10 review aid: directness 22%, rigor 22%, impact 18%, safety 14%, low regulatory risk 10%, low hype 8%, and measurability 6%. The formula is partly heuristic and is not medical advice.";

type ScoreExplanationKind =
  | "claimRisk"
  | "composite"
  | "directness"
  | "lowHypeRisk"
  | "impact"
  | "measurability"
  | "productQuality"
  | "regulatoryRisk"
  | "lowRegulatoryRisk"
  | "reviewPriority"
  | "rigor"
  | "safety";

type ScoreExplanation = {
  detail: string;
  formula?: string;
  title: string;
};

const scoreExplanations: Record<ScoreExplanationKind, ScoreExplanation> = {
  claimRisk: {
    detail:
      "Label claim risk is a heuristic product-label screen. Higher values mean stronger marketing or therapeutic-claim concern and need product-level review.",
    title: "Claim-risk score"
  },
  composite: {
    detail: compositeScoreDetail,
    formula: compositeScoreFormula,
    title: "Composite score"
  },
  directness: {
    detail:
      "Directness is higher when the cited human evidence matches the exact intervention, outcome, population, and form instead of relying on indirect proxies.",
    title: "Directness score"
  },
  lowHypeRisk: {
    detail:
      "Low hype risk is 10 minus the hype penalty. Higher is better: fewer promotional overclaims, cure-all claims, or lifespan extrapolations in the reviewed packet.",
    title: "Low-hype-risk score"
  },
  impact: {
    detail:
      "Impact reflects the observed or plausible outcome magnitude for the scoped claim, while preserving uncertainty and study limitations.",
    title: "Impact score"
  },
  measurability: {
    detail:
      "Measurability is higher when the claim can be checked with clear endpoints, biomarkers, or trial outcomes rather than vague wellness language.",
    title: "Measurability score"
  },
  productQuality: {
    detail:
      "Product quality is a product-signal score from captured label/certification quality cues. It is not ARTG/AUST status or proof of efficacy.",
    title: "Product-quality score"
  },
  lowRegulatoryRisk: {
    detail:
      "Low regulatory risk is 10 minus the raw regulatory-risk concern. Higher is better: fewer captured AU/TGA, product-status, supply, or legal concerns. It is not guaranteed clearance.",
    title: "Low-regulatory-risk score"
  },
  regulatoryRisk: {
    detail:
      "Regulatory risk is a raw concern score. Higher values mean more AU/TGA, product-status, or supply-context uncertainty; the composite subtracts this as a penalty.",
    title: "Regulatory-risk score"
  },
  reviewPriority: {
    detail:
      "Review priority is a live-search triage score based on source metadata and query relevance. It ranks what to inspect next; it is not evidence quality.",
    title: "Review-priority score"
  },
  rigor: {
    detail:
      "Rigor is higher when the evidence uses stronger study designs, cleaner comparators, better extraction detail, and lower bias concerns.",
    title: "Rigor score"
  },
  safety: {
    detail:
      "Safety reflects captured adverse-event, interaction, population-risk, and regulator-signal context for the scoped claim. It is not individualized advice.",
    title: "Safety score"
  }
};

type DashboardTabId =
  | "claim-scores"
  | "evidence-cards"
  | "product-labels"
  | "safety-center"
  | "sources"
  | "trial-watcher";

const EVIDENCE_CARD_PREVIEW_LIMIT = 5;

type SelectClaimHandler = (claimId: string, options?: { scrollToDetail?: boolean }) => void;

function dashboardPanelShellClassName(embedded?: boolean) {
  return cn("min-w-0", !embedded && "rounded-lg border border-line bg-white p-4 shadow-panel");
}

function formatEvidenceMapFilterSummary({
  filteredClaimCount,
  filteredInterventionCount,
  totalClaimCount,
  totalInterventionCount
}: {
  filteredClaimCount: number;
  filteredInterventionCount: number;
  totalClaimCount: number;
  totalInterventionCount: number;
}) {
  const interventionsLabel =
    filteredInterventionCount === totalInterventionCount
      ? `${totalInterventionCount} interventions`
      : `${filteredInterventionCount} of ${totalInterventionCount} interventions`;
  const claimsLabel =
    filteredClaimCount === totalClaimCount
      ? `${totalClaimCount} scoped claims`
      : `${filteredClaimCount} of ${totalClaimCount} scoped claims`;

  return `Showing ${interventionsLabel} · ${claimsLabel}`;
}

function ActiveClaimContextBar({
  activeClaim,
  activeIntervention
}: {
  activeClaim: Claim;
  activeIntervention?: Intervention;
}) {
  const score = compositeScore(activeClaim.scores);

  return (
    <div className="mb-3 rounded-lg border border-signal/25 bg-blue-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-signal">Selected claim</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-700">
        <span className="font-semibold text-ink">
          {activeIntervention?.name ?? "Unknown intervention"} · {shortOutcome(activeClaim.outcome)}
        </span>
        <span>
          {compositeLabel(activeClaim)} {score.toFixed(1)}/10
        </span>
        <span className={cn("rounded-md border px-2 py-0.5 text-xs font-semibold", labelTone(activeClaim.finalLabel))}>
          {activeClaim.finalLabel}
        </span>
        <span className="text-xs text-slate-600">{reviewStatusLabel(activeClaim.reviewStatus)}</span>
        {activeIntervention ? (
          <a
            className="text-xs font-semibold text-signal underline decoration-signal/30 underline-offset-2 hover:decoration-signal"
            href={`/interventions/${activeIntervention.slug}`}
          >
            Intervention detail
          </a>
        ) : null}
      </div>
    </div>
  );
}

function EvidenceDashboardTabbedPanels({
  activeClaim,
  activeClaimId,
  activeIntervention,
  filteredClaims,
  hasFilteredClaims,
  interventionsById,
  labelFindings,
  labelText,
  onOpenChange,
  onSelectClaim,
  open,
  productAustraliaVerificationById,
  productSignals,
  referencesById,
  safetyAlerts,
  setLabelText,
  studies,
  tableRows,
  trialWatchItems
}: {
  activeClaim: Claim | null;
  activeClaimId: string;
  activeIntervention?: Intervention;
  filteredClaims: Claim[];
  hasFilteredClaims: boolean;
  interventionsById: Map<string, Intervention>;
  labelFindings: ReturnType<typeof analyzeLabel>;
  labelText: string;
  onOpenChange: (open: boolean) => void;
  onSelectClaim: SelectClaimHandler;
  open: boolean;
  productAustraliaVerificationById: Map<string, ProductAustraliaRegulatoryVerification>;
  productSignals: ProductSignal[];
  referencesById: Map<string, Reference>;
  safetyAlerts: SafetyAlert[];
  setLabelText: (value: string) => void;
  studies: Study[];
  tableRows: ClaimTableRow[];
  trialWatchItems: TrialWatchItem[];
}) {
  const [activeTab, setActiveTab] = useState<DashboardTabId>("claim-scores");
  const tabs: Array<{
    badge?: string;
    id: DashboardTabId;
    label: string;
  }> = [
    { badge: String(tableRows.length), id: "claim-scores", label: "Claim Scores" },
    { badge: String(safetyAlerts.length), id: "safety-center", label: "Safety Center" },
    { badge: String(filteredClaims.length), id: "evidence-cards", label: "Evidence Cards" },
    { id: "product-labels", label: "Product Labels" },
    { badge: String(trialWatchItems.length), id: "trial-watcher", label: "Trial Watcher" },
    { id: "sources", label: "Sources" }
  ];

  return (
    <section className="min-w-0 rounded-lg border border-line bg-white shadow-panel">
      <button
        type="button"
        aria-controls="dashboard-detail-panels"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left outline-none transition hover:bg-mist focus:ring-4 focus:ring-inset focus:ring-signal/20"
        onClick={() => onOpenChange(!open)}
      >
        <div className="min-w-0">
          <p className="text-base font-semibold text-ink">Claim details</p>
          <p className="mt-0.5 text-xs text-slate-600">
            Scores, safety, evidence cards, product labels, trials, and sources
          </p>
        </div>
        <ChevronDown
          aria-hidden="true"
          className={cn("h-4 w-4 shrink-0 text-slate-600 transition", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div id="dashboard-detail-panels">
      <div
        aria-label="Dashboard detail sections"
        className="flex flex-wrap gap-1 border-t border-line p-2"
        role="tablist"
      >
        {tabs.map((tab) => {
          const selected = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              id={`dashboard-tab-button-${tab.id}`}
              role="tab"
              aria-controls={`dashboard-tab-panel-${tab.id}`}
              aria-selected={selected}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold outline-none transition focus:ring-4 focus:ring-signal/20",
                selected
                  ? "border-signal bg-blue-50 text-signal"
                  : "border-transparent bg-white text-slate-700 hover:border-line hover:bg-mist"
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.label}</span>
              {tab.badge ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
                    selected ? "bg-white text-signal" : "bg-mist text-slate-600"
                  )}
                >
                  {tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="p-4">
        <div
          aria-labelledby="dashboard-tab-button-claim-scores"
          hidden={activeTab !== "claim-scores"}
          id="dashboard-tab-panel-claim-scores"
          role="tabpanel"
        >
          <ClaimTable
            embedded
            rows={tableRows}
            onSelectClaim={onSelectClaim}
            activeClaimId={activeClaimId}
          />
        </div>
        <div
          aria-labelledby="dashboard-tab-button-safety-center"
          hidden={activeTab !== "safety-center"}
          id="dashboard-tab-panel-safety-center"
          role="tabpanel"
        >
          <SafetyPanel embedded interventionsById={interventionsById} safetyAlerts={safetyAlerts} />
        </div>
        <div
          aria-labelledby="dashboard-tab-button-evidence-cards"
          hidden={activeTab !== "evidence-cards"}
          id="dashboard-tab-panel-evidence-cards"
          role="tabpanel"
        >
          <EvidenceCards
            embedded
            claims={filteredClaims}
            interventionsById={interventionsById}
            referencesById={referencesById}
            studies={studies}
            activeClaimId={activeClaimId}
            onSelectClaim={onSelectClaim}
          />
        </div>
        <div
          aria-labelledby="dashboard-tab-button-product-labels"
          hidden={activeTab !== "product-labels"}
          id="dashboard-tab-panel-product-labels"
          role="tabpanel"
        >
          <LabelAnalyzer
            embedded
            labelText={labelText}
            setLabelText={setLabelText}
            findings={labelFindings}
            productSignals={productSignals}
            productAustraliaVerificationById={productAustraliaVerificationById}
          />
        </div>
        <div
          aria-labelledby="dashboard-tab-button-trial-watcher"
          hidden={activeTab !== "trial-watcher"}
          id="dashboard-tab-panel-trial-watcher"
          role="tabpanel"
        >
          <TrialWatcher embedded interventionsById={interventionsById} trialWatchItems={trialWatchItems} />
        </div>
        <div
          aria-labelledby="dashboard-tab-button-sources"
          hidden={activeTab !== "sources"}
          id="dashboard-tab-panel-sources"
          role="tabpanel"
        >
          {hasFilteredClaims && activeClaim ? (
            <SourceAndStudyPanel
              embedded
              key={activeClaim.id}
              activeClaim={activeClaim}
              activeIntervention={activeIntervention}
              referencesById={referencesById}
              studies={studies}
            />
          ) : (
            <FilteredClaimDetailEmptyState
              embedded
              title="Sources and Review Queue"
              detail="Source packets and live search suggestions appear after the current filters match a local scored claim."
            />
          )}
        </div>
      </div>
        </div>
      ) : null}
    </section>
  );
}

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
  const [labelFilter, setLabelFilter] = useState("All");
  const [outcomeFilter, setOutcomeFilter] = useState("All");
  const [activeClaimId, setActiveClaimId] = useState(claims[0]?.id ?? "");
  const [labelText, setLabelText] = useState(
    "Creatine monohydrate 5 g\nNSF Certified for Sport\nNo proprietary blend"
  );
  const detailSectionRef = useRef<HTMLElement>(null);
  const [detailPanelsOpen, setDetailPanelsOpen] = useState(false);

  const handleSelectClaim = useCallback<SelectClaimHandler>((claimId, options) => {
    setActiveClaimId(claimId);

    if (options?.scrollToDetail) {
      setDetailPanelsOpen(true);
      requestAnimationFrame(() => {
        detailSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }
  }, []);

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

  const evidenceLabels = useMemo(
    () => ["All", ...Array.from(new Set(claims.map((claim) => claim.finalLabel))).sort()],
    [claims]
  );

  const outcomeAreas = useMemo(
    () => ["All", ...Array.from(new Set(claims.map((claim) => claim.outcome))).sort()],
    [claims]
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
    () =>
      claims.filter((claim) => {
        const labelMatch = labelFilter === "All" || claim.finalLabel === labelFilter;
        const outcomeMatch = outcomeFilter === "All" || claim.outcome === outcomeFilter;

        return labelMatch && outcomeMatch && visibleInterventionIds.has(claim.interventionId);
      }),
    [claims, labelFilter, outcomeFilter, visibleInterventionIds]
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
  const productAustraliaVerifications = useMemo(
    () => buildProductAustraliaRegulatoryVerifications(data),
    [data]
  );
  const productAustraliaVerificationById = useMemo(
    () =>
      new Map(
        productAustraliaVerifications.map((verification) => [
          verification.productId,
          verification
        ])
      ),
    [productAustraliaVerifications]
  );
  const labelFindings = analyzeLabel(labelText);
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
    <main className="min-h-screen overflow-x-hidden px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full min-w-0 max-w-[1500px] flex-col gap-4">
        <Header data={data} />

        <section className="min-w-0">
          <div className="min-w-0 rounded-lg border border-line bg-white p-4 shadow-panel">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-semibold text-ink">Evidence Map</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Claim cells show composite evidence confidence, with safety and hype penalties included.
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {formatEvidenceMapFilterSummary({
                    filteredClaimCount: filteredClaims.length,
                    filteredInterventionCount: filteredInterventions.length,
                    totalClaimCount: claims.length,
                    totalInterventionCount: interventions.length
                  })}
                </p>
              </div>
              <div className="grid min-w-0 gap-2 lg:grid-cols-2 xl:grid-cols-4">
                <label className="relative" htmlFor="evidence-map-search">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600"
                  />
                  <span className="sr-only">Search interventions</span>
                  <input
                    id="evidence-map-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="h-10 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm outline-none ring-signal/20 transition focus:border-signal focus:ring-4"
                    placeholder="Search interventions"
                  />
                </label>
                <label className="relative" htmlFor="evidence-map-category">
                  <Filter
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600"
                  />
                  <span className="sr-only">Filter category</span>
                  <select
                    id="evidence-map-category"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="h-10 w-full appearance-none rounded-md border border-line bg-white pl-9 pr-3 text-sm outline-none ring-signal/20 transition focus:border-signal focus:ring-4"
                  >
                    {categories.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label className="relative" htmlFor="evidence-map-label">
                  <Filter
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600"
                  />
                  <span className="sr-only">Filter by evidence label</span>
                  <select
                    id="evidence-map-label"
                    value={labelFilter}
                    onChange={(event) => setLabelFilter(event.target.value)}
                    className="h-10 w-full appearance-none rounded-md border border-line bg-white pl-9 pr-3 text-sm outline-none ring-signal/20 transition focus:border-signal focus:ring-4"
                  >
                    {evidenceLabels.map((item) => (
                      <option key={item} value={item}>
                        {item === "All" ? "All labels" : item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="relative" htmlFor="evidence-map-outcome">
                  <Filter
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600"
                  />
                  <span className="sr-only">Filter by outcome area</span>
                  <select
                    id="evidence-map-outcome"
                    value={outcomeFilter}
                    onChange={(event) => setOutcomeFilter(event.target.value)}
                    className="h-10 w-full appearance-none rounded-md border border-line bg-white pl-9 pr-3 text-sm outline-none ring-signal/20 transition focus:border-signal focus:ring-4"
                  >
                    {outcomeAreas.map((item) => (
                      <option key={item} value={item}>
                        {item === "All" ? "All outcomes" : shortOutcome(item as OutcomeArea)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <EvidenceMap
              claims={filteredClaims}
              interventions={filteredInterventions}
              activeClaimId={activeClaimIdForDisplay}
              onSelectClaim={handleSelectClaim}
            />
          </div>
        </section>

        <section
          ref={detailSectionRef}
          aria-label="Selected claim details"
          className="min-w-0 scroll-mt-4"
        >
          {activeClaim ? (
            <ActiveClaimContextBar activeClaim={activeClaim} activeIntervention={activeIntervention} />
          ) : null}
          <EvidenceDashboardTabbedPanels
          activeClaim={activeClaim}
          activeClaimId={activeClaimIdForDisplay}
          activeIntervention={activeIntervention}
          filteredClaims={filteredClaims}
          hasFilteredClaims={hasFilteredClaims}
          interventionsById={interventionsById}
          labelFindings={labelFindings}
          labelText={labelText}
          onOpenChange={setDetailPanelsOpen}
          onSelectClaim={handleSelectClaim}
          open={detailPanelsOpen}
          productAustraliaVerificationById={productAustraliaVerificationById}
          productSignals={productSignals}
          referencesById={referencesById}
          safetyAlerts={safetyAlerts}
          setLabelText={setLabelText}
          studies={studies}
          tableRows={tableRows}
          trialWatchItems={trialWatchItems}
        />
        </section>
      </div>
    </main>
  );
}

function FilteredClaimDetailEmptyState({
  detail,
  embedded,
  title
}: {
  detail: string;
  embedded?: boolean;
  title: string;
}) {
  return (
    <section className={dashboardPanelShellClassName(embedded)}>
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <p className="mt-4 rounded-lg border border-line bg-mist p-3 text-sm leading-6 text-slate-600">
        {detail} Clear the search, category, label, or outcome filter to return to the full local evidence set.
      </p>
    </section>
  );
}

function ScoreWithExplainer({
  children,
  explanationKind,
  value
}: {
  children: ReactNode;
  explanationKind: ScoreExplanationKind;
  value?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1"
      title={scoreExplanationTitle(explanationKind, value)}
    >
      <span>{children}</span>
      <ScoreExplainer explanationKind={explanationKind} value={value} />
    </span>
  );
}

function ScoreExplainer({
  explanationKind,
  value
}: {
  explanationKind: ScoreExplanationKind;
  value?: string;
}) {
  const explanation = scoreExplanations[explanationKind];
  const label = scoreExplanationTitle(explanationKind, value);

  return (
    <span
      className="group relative inline-flex"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        aria-label={label}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-signal/25 bg-white text-signal outline-none transition hover:border-signal hover:bg-blue-50 focus:border-signal focus:ring-4 focus:ring-signal/20"
        title={label}
      >
        <CircleHelp aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-30 mt-2 hidden w-72 rounded-md border border-line bg-white p-3 text-left text-xs leading-5 text-slate-700 shadow-panel group-focus-within:block group-hover:block"
      >
        <span className="block font-semibold text-ink">{explanation.title}</span>
        {value ? <span className="mt-1 block font-semibold text-signal">{value}</span> : null}
        {explanation.formula ? (
          <span className="mt-1 block font-semibold text-slate-700">
            {explanation.formula}
          </span>
        ) : null}
        <span className="mt-1 block">{explanation.detail}</span>
      </span>
    </span>
  );
}

function ReviewStatusBadge({
  className,
  status
}: {
  className?: string;
  status: Claim["reviewStatus"];
}) {
  const tooltip = isHumanReviewed(status)
    ? HUMAN_REVIEWED_TOOLTIP
    : "Pending human review means this remains an unreviewed AI draft. A human reviewer has not yet checked the source packet against the scoped claim.";

  return (
    <span
      aria-label={`${reviewStatusLabel(status)}: ${tooltip}`}
      className={cn(
        "rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700",
        className
      )}
      title={tooltip}
    >
      {reviewStatusLabel(status)}
    </span>
  );
}

function isHumanReviewed(status: Claim["reviewStatus"]) {
  return status === "Human reviewed";
}

function reviewStatusLabel(status: Claim["reviewStatus"]) {
  return isHumanReviewed(status) ? "Human reviewed" : "Pending human review";
}

function classificationLabel(claim: Claim) {
  return isHumanReviewed(claim.reviewStatus)
    ? "Human-reviewed classification"
    : "AI Draft Classification";
}

function compositeLabel(claim: Claim) {
  return isHumanReviewed(claim.reviewStatus) ? "Reviewed composite" : "Draft composite";
}

function scoreExplanationTitle(explanationKind: ScoreExplanationKind, value?: string) {
  const explanation = scoreExplanations[explanationKind];
  return [explanation.title, value, explanation.formula, explanation.detail]
    .filter(Boolean)
    .join(": ");
}

function scoreExplanationKindForLabel(label: string): ScoreExplanationKind {
  if (label === "Directness") {
    return "directness";
  }

  if (label === "Rigor") {
    return "rigor";
  }

  if (label === "Impact") {
    return "impact";
  }

  if (label === "Safety") {
    return "safety";
  }

  if (label === "Measurability") {
    return "measurability";
  }

  if (label === "Low regulatory risk") {
    return "lowRegulatoryRisk";
  }

  return "lowHypeRisk";
}

function NonProofBox({
  claim,
  compact = false,
  intervention
}: {
  claim: Claim;
  compact?: boolean;
  intervention?: Intervention;
}) {
  const statements = claimNonProofStatements(claim);
  const cardLabel = [
    intervention?.name ?? "Selected intervention",
    shortOutcome(claim.outcome)
  ].join(" - ");

  return (
    <section
      aria-label={`What this evidence card does not prove for ${cardLabel}`}
      className={cn(
        "mt-3 rounded-md border border-amberline/30 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950",
        compact ? "max-w-3xl" : "w-full"
      )}
      role="note"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amberline" />
        <div className="min-w-0">
          <p className="font-semibold text-ink">What this does not prove</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {statements.map((statement) => (
              <li key={statement}>{statement}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function claimNonProofStatements(claim: Claim) {
  const curatedStatements = claim.doesNotProve
    ?.map((statement) => normaliseSentence(statement))
    .filter((statement) => statement.length > 0);

  if (curatedStatements && curatedStatements.length > 0) {
    return curatedStatements;
  }

  const statements: string[] = [];

  if (claim.outcome !== "Mortality/lifespan") {
    statements.push("Does not prove direct lifespan extension.");
  } else {
    statements.push("Does not prove a direct lifespan benefit outside the scoped evidence.");
  }

  if (claim.applicabilityNotes.trim().length > 0) {
    statements.push(
      `Does not override applicability limits: ${normaliseSentence(claim.applicabilityNotes)}`
    );
  }

  if (claim.safetyNotes.trim().length > 0) {
    statements.push(`Does not override safety caveats: ${normaliseSentence(claim.safetyNotes)}`);
  }

  if (statements.length < 3) {
    statements.push("Does not provide individualized medical advice.");
  }

  return statements.slice(0, 3);
}

function normaliseSentence(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
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
          <div
            aria-label={
              data.dataSource === "database"
                ? "Local database catalog status"
                : "Prototype and seed dataset status"
            }
            className="mt-3 max-w-4xl border-l-4 border-signal bg-mist px-3 py-2"
            role="note"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-signal">
              {data.dataSource === "database" ? "Local database catalog" : "Prototype / seed dataset"}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-700">
              {data.dataSource === "database"
                ? `Apex Lifespan is running against your local catalog (${data.interventions.length} interventions, ${data.claims.length} scoped claims). Scores and packets are review aids, not medical advice.`
                : "Apex Lifespan is in early public prototype. Current scores are based on a small curated seed dataset and live source-search previews. Scores are review aids, not medical advice."}
            </p>
          </div>
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
          <a
            href="/privacy"
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:border-signal hover:text-signal"
          >
            Privacy
          </a>
          <a
            href="/methodology"
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:border-signal hover:text-signal"
          >
            Methodology
          </a>
          <a
            href="/changelog"
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:border-signal hover:text-signal"
          >
            Changelog
          </a>
          <a
            href="/feedback"
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:border-signal hover:text-signal"
          >
            Feedback
          </a>
          <a
            href="/terms"
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:border-signal hover:text-signal"
          >
            Terms
          </a>
          <CodexReviewPacketButton data={data} />
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

function CodexReviewPacketButton({ data }: { data: EvidenceDashboardData }) {
  const [isApproving, setIsApproving] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [sendError, setSendError] = useState<string | null>(null);
  const [sidecarUrl, setSidecarUrl] = useState(() => readBrowserStorage(
    CODEX_REVIEW_SIDECAR_URL_KEY,
    DEFAULT_CODEX_REVIEW_SIDECAR_URL
  ));
  const [operatorToken, setOperatorToken] = useState(() => readBrowserStorage(
    CODEX_REVIEW_TOKEN_KEY,
    ""
  ));
  const [isPublicBrowser, setIsPublicBrowser] = useState(false);
  const packet = useMemo(() => buildCodexReviewPacket(data), [data]);
  const hasLocalOperatorConfig =
    isLocalOperatorSidecarUrl(sidecarUrl) && operatorToken.trim().length > 0;
  const publicOperatorDisabled = isPublicBrowser && !hasLocalOperatorConfig;
  const operatorButtonTitle = publicOperatorDisabled
    ? "Operator mode is disabled on public deployments unless this browser has local sidecar configuration."
    : "Open local operator mode.";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setIsPublicBrowser(isPublicHost(window.location.hostname));
  }, []);

  const resetStatus = () => {
    setCopyStatus("idle");
    setSendStatus("idle");
    setSendError(null);
  };

  const copyPacket = async () => {
    try {
      await navigator.clipboard.writeText(packet);
      setCopyStatus("copied");
      setSendStatus("idle");
      setSendError(null);
    } catch {
      setCopyStatus("error");
    }
  };

  const sendPacket = async () => {
    const nextSidecarUrl = sidecarUrl.trim();
    const nextToken = operatorToken.trim();

    setCopyStatus("idle");

    if (!nextSidecarUrl || !nextToken) {
      setSendStatus("error");
      setSendError("Local sidecar URL and operator token are required.");
      return;
    }

    if (!isLocalOperatorSidecarUrl(nextSidecarUrl)) {
      setSendStatus("error");
      setSendError("Operator mode requires a local localhost or 127.0.0.1 sidecar URL.");
      return;
    }

    if (isPublicBrowser && !hasLocalOperatorConfig) {
      setSendStatus("error");
      setSendError("Operator mode is disabled on public deployments unless local operator configuration exists in this browser.");
      return;
    }

    writeBrowserStorage(CODEX_REVIEW_SIDECAR_URL_KEY, nextSidecarUrl);
    writeBrowserStorage(CODEX_REVIEW_TOKEN_KEY, nextToken);
    setSendStatus("sending");
    setSendError(null);

    try {
      const response = await fetch(nextSidecarUrl, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Apex-Codex-Token": nextToken
        },
        body: JSON.stringify({ packet })
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(body.error || "Codex sidecar request failed.");
      }

      setSendStatus("sent");
    } catch (error) {
      setSendStatus("error");
      setSendError(error instanceof Error ? error.message : "Codex sidecar request failed.");
    }
  };

  return (
    <div className="relative flex flex-wrap items-center gap-1">
      <button
        type="button"
        onClick={() => {
          setIsApproving((current) => !current);
          resetStatus();
        }}
        className={cn(
          "inline-flex h-7 items-center gap-1 rounded-md border border-signal/25 bg-blue-50 px-2 text-xs font-semibold text-signal hover:border-signal disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-50 disabled:text-slate-500",
          publicOperatorDisabled && "opacity-80"
        )}
        disabled={publicOperatorDisabled}
        title={operatorButtonTitle}
      >
        <ClipboardCheck aria-hidden="true" className="h-3.5 w-3.5" />
        Operator mode
      </button>
      <span className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
        local only
      </span>
      <span className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
        no shared public token
      </span>
      {isApproving ? (
        <div className="absolute right-0 z-20 mt-2 w-[min(88vw,440px)] rounded-lg border border-line bg-white p-3 text-left shadow-panel">
          <p className="text-xs font-semibold text-ink">Operator mode review packet</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
              local only
            </span>
            <span className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
              no shared public token
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Sends a read-only packet through the local operator sidecar. Source-candidate decisions
            and public evidence promotion stay human-owned.
          </p>
          <div className="mt-3 grid gap-2">
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Local sidecar URL
              <input
                value={sidecarUrl}
                onChange={(event) => setSidecarUrl(event.target.value)}
                className="h-8 rounded-md border border-line bg-white px-2 font-mono text-[11px] font-normal text-ink outline-none transition focus:border-signal"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Operator token
              <input
                value={operatorToken}
                onChange={(event) => setOperatorToken(event.target.value)}
                className="h-8 rounded-md border border-line bg-white px-2 font-mono text-[11px] font-normal text-ink outline-none transition focus:border-signal"
                type="password"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={sendPacket}
              disabled={sendStatus === "sending" || publicOperatorDisabled}
              className="inline-flex h-8 items-center gap-2 rounded-md border border-signal/30 bg-blue-50 px-2 text-xs font-semibold text-signal hover:border-signal disabled:cursor-wait disabled:opacity-60"
            >
              <ClipboardCheck aria-hidden="true" className="h-3.5 w-3.5" />
              {sendStatus === "sending" ? "Sending" : "Approve and send"}
            </button>
            <button
              type="button"
              onClick={copyPacket}
              className="inline-flex h-8 items-center gap-2 rounded-md border border-line bg-mist px-2 text-xs font-semibold text-slate-700 hover:border-signal"
            >
              <ClipboardCheck aria-hidden="true" className="h-3.5 w-3.5" />
              Copy packet
            </button>
            <button
              type="button"
              onClick={() => {
                setIsApproving(false);
                resetStatus();
              }}
              className="inline-flex h-8 items-center rounded-md border border-line bg-mist px-2 text-xs font-semibold text-slate-700 hover:border-signal"
            >
              Cancel
            </button>
          </div>
          {copyStatus === "copied" ? (
            <p className="mt-2 rounded-md border border-spruce/25 bg-teal-50 px-2 py-1 text-xs font-semibold text-spruce">
              Packet copied for Codex.
            </p>
          ) : null}
          {sendStatus === "sent" ? (
            <p className="mt-2 rounded-md border border-spruce/25 bg-teal-50 px-2 py-1 text-xs font-semibold text-spruce">
              Packet sent to the configured Codex thread.
            </p>
          ) : null}
          {copyStatus === "error" ? (
            <p className="mt-2 rounded-md border border-amberline/25 bg-amber-50 px-2 py-1 text-xs font-semibold text-amberline">
              Clipboard unavailable. Select and copy the packet below.
            </p>
          ) : null}
          {sendStatus === "error" ? (
            <p className="mt-2 rounded-md border border-amberline/25 bg-amber-50 px-2 py-1 text-xs font-semibold text-amberline">
              {sendError ?? "Codex sidecar request failed."}
            </p>
          ) : null}
          <textarea
            readOnly
            value={packet}
            className="mt-2 h-32 w-full resize-none rounded-md border border-line bg-mist p-2 font-mono text-[11px] leading-4 text-slate-700"
          />
        </div>
      ) : null}
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

function readBrowserStorage(key: string, fallback: string) {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function isPublicHost(hostname: string) {
  return hostname !== "localhost" && hostname !== "127.0.0.1";
}

function isLocalOperatorSidecarUrl(value: string) {
  try {
    const url = new URL(value);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function writeBrowserStorage(key: string, value: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Local storage is only a convenience for the operator sidecar fields.
  }
}

export function buildCodexReviewPacket(data: EvidenceDashboardData) {
  const referencesById = new Map(data.references.map((reference) => [reference.id, reference]));
  const interventionsById = new Map(
    data.interventions.map((intervention) => [intervention.id, intervention])
  );
  const reviewSummary = summarizeReviewStatus(data.claims);
  const sourcePacketSummary = summarizeClaimSourcePackets({
    claims: data.claims,
    referencesById,
    studies: data.studies
  });
  const sourceWorkClaims = data.claims
    .map((claim) => ({
      claim,
      intervention: interventionsById.get(claim.interventionId),
      packet: buildClaimSourcePacket({ claim, referencesById, studies: data.studies })
    }))
    .filter(({ packet }) => packet.completeness.status !== "complete")
    .slice(0, 5);

  const sourceWorkLines =
    sourceWorkClaims.length > 0
      ? sourceWorkClaims.map(({ claim, intervention, packet }) => {
          return `- ${claim.id} (${intervention?.name ?? "Unknown intervention"} / ${claim.outcome}): ${packet.completeness.label}; ${packet.completeness.nextStep}`;
        })
      : ["- No incomplete local source packets in the current dashboard data."];
  const claimBoundaryLines = data.claims.map((claim) => {
    const intervention = interventionsById.get(claim.interventionId);
    const statements = claimNonProofStatements(claim).join(" ");

    return `- ${claim.id} (${intervention?.name ?? "Unknown intervention"} / ${claim.outcome}): ${statements}`;
  });

  return [
    "Analyze this Apex Lifespan dashboard state.",
    "",
    "Guardrails:",
    "- Keep source-candidate workflows local, read-only by default, and human-owned.",
    "- Do not accept/reject candidates, link claims, extract studies, or promote public evidence without explicit human review.",
    "- Public routes stay read-only; avoid medical advice, dosing, sourcing, reconstitution, injection, cycling, or self-administration guidance.",
    "- Use Australia/TGA as the default lens and do not infer ARTG/AUST status without product-level evidence.",
    "",
    "Dashboard snapshot:",
    `- Data source: ${data.dataSource}${data.fallbackReason ? ` (${data.fallbackReason})` : ""}`,
    `- Interventions: ${data.interventions.length}`,
    `- Claims: ${data.claims.length}`,
    `- Human-reviewed claims: ${reviewSummary.humanReviewed}`,
    `- Unreviewed draft claims: ${reviewSummary.unreviewedDrafts}`,
    `- References: ${data.references.length}`,
    `- Extracted studies: ${data.studies.length}`,
    `- Trial-watch records: ${data.trialWatchItems.length}`,
    `- Safety alerts: ${data.safetyAlerts.length}`,
    `- Source packets: ${sourcePacketSummary.completeClaims}/${sourcePacketSummary.totalClaims} complete; ${sourcePacketSummary.extractedReferences}/${sourcePacketSummary.totalReferences} linked refs extracted`,
    "",
    "Claim boundaries (what this does not prove):",
    ...claimBoundaryLines,
    "",
    "Top local source-packet gaps:",
    ...sourceWorkLines,
    "",
    "Requested Codex output:",
    "- Find dashboard and evidence-source deficiencies.",
    "- Suggest source-ingestion or curation improvements as human-reviewed tasks.",
    "- Write Codex-ready implementation tasks with targeted tests.",
    "- Do not perform writes or make source-candidate decisions unless I explicitly approve them in this thread."
  ].join("\n");
}

type EvidenceMapSort =
  | {
      direction: "asc" | "desc";
      outcome: OutcomeArea;
    }
  | null;

function cycleEvidenceMapSort(
  current: EvidenceMapSort,
  outcome: OutcomeArea
): EvidenceMapSort {
  if (current?.outcome !== outcome) {
    return { direction: "desc", outcome };
  }

  if (current.direction === "desc") {
    return { direction: "asc", outcome };
  }

  return null;
}

function sortEvidenceMapInterventions({
  claims,
  interventions,
  sort
}: {
  claims: Claim[];
  interventions: Intervention[];
  sort: EvidenceMapSort;
}) {
  const sorted = [...interventions];

  if (!sort) {
    return sorted.sort((left, right) => left.name.localeCompare(right.name));
  }

  const scoreFor = (interventionId: string) => {
    const claim = claims.find(
      (item) => item.interventionId === interventionId && item.outcome === sort.outcome
    );

    return claim ? compositeScore(claim.scores) : null;
  };

  return sorted.sort((left, right) => {
    const leftScore = scoreFor(left.id);
    const rightScore = scoreFor(right.id);

    if (leftScore === null && rightScore === null) {
      return left.name.localeCompare(right.name);
    }

    if (leftScore === null) {
      return 1;
    }

    if (rightScore === null) {
      return -1;
    }

    const scoreDelta =
      sort.direction === "desc" ? rightScore - leftScore : leftScore - rightScore;

    return scoreDelta !== 0 ? scoreDelta : left.name.localeCompare(right.name);
  });
}

function evidenceMapSortAriaLabel(sort: EvidenceMapSort, outcome: OutcomeArea) {
  if (sort?.outcome !== outcome) {
    return `Sort supplements by ${outcome}, highest score first`;
  }

  if (sort.direction === "desc") {
    return `Sort supplements by ${outcome}, lowest score first`;
  }

  return `Clear ${outcome} sort and return to alphabetical order`;
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
  onSelectClaim: SelectClaimHandler;
}) {
  const [sort, setSort] = useState<EvidenceMapSort>(null);
  const outcomes = useMemo(
    () => Array.from(new Set(visibleClaims.map((claim) => claim.outcome))),
    [visibleClaims]
  );
  const sortedInterventions = useMemo(
    () =>
      sortEvidenceMapInterventions({
        claims: visibleClaims,
        interventions: visibleInterventions,
        sort
      }),
    [sort, visibleClaims, visibleInterventions]
  );

  if (visibleClaims.length === 0) {
    return (
      <p className="mt-4 rounded-lg border border-line bg-mist p-3 text-sm leading-6 text-slate-600">
        No local scored claims match the current filters. Clear the search, category, label, or outcome filter to
        rebuild the evidence map.
      </p>
    );
  }

  return (
    <div className="mt-4">
      <div className="max-w-full overflow-x-auto">
      <table
        aria-describedby="evidence-map-legend"
        className="w-full min-w-0 border-separate border-spacing-1 text-sm"
      >
          <caption className="sr-only">
            Evidence map. Rows are interventions and columns are outcomes. Unassessed cells do not
            imply absence of evidence.
          </caption>
          <thead>
            <tr>
              <th
                className="sticky left-0 z-20 w-[220px] rounded-md border border-transparent bg-mist px-2 py-2 text-left text-xs font-semibold text-slate-600"
                scope="col"
              >
                <button
                  type="button"
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-left outline-none transition hover:text-signal focus:ring-4 focus:ring-signal/20",
                    sort === null && "text-signal"
                  )}
                  onClick={() => setSort(null)}
                  aria-label="Sort supplements alphabetically by name"
                  title="Sort alphabetically by intervention name"
                >
                  Intervention
                  {sort === null ? (
                    <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  ) : null}
                </button>
              </th>
              {outcomes.map((outcome) => {
                const isActive = sort?.outcome === outcome;

                return (
                  <th
                    key={outcome}
                    aria-sort={
                      isActive
                        ? sort.direction === "desc"
                          ? "descending"
                          : "ascending"
                        : "none"
                    }
                    className="w-[4.25rem] min-w-[4.25rem] max-w-[4.75rem] rounded-md border border-line bg-mist px-0.5 py-1 text-center text-xs font-semibold text-slate-700"
                    scope="col"
                  >
                    <div className="flex flex-col items-center gap-1 py-0.5">
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          type="button"
                          className={cn(
                            "inline-flex h-5 w-5 items-center justify-center rounded-md outline-none transition hover:bg-white focus:ring-4 focus:ring-signal/20",
                            isActive && "bg-white text-signal"
                          )}
                          onClick={() => setSort((current) => cycleEvidenceMapSort(current, outcome))}
                          aria-label={evidenceMapSortAriaLabel(sort, outcome)}
                          title={evidenceMapSortAriaLabel(sort, outcome)}
                        >
                          <EvidenceMapSortIndicator
                            direction={isActive ? sort.direction : null}
                          />
                        </button>
                        <OutcomeColumnTooltip outcome={outcome} />
                      </div>
                      <button
                        type="button"
                        className={cn(
                          "w-full rounded-md px-0.5 py-0.5 text-center text-[11px] leading-tight outline-none transition hover:bg-white hover:text-signal focus:ring-4 focus:ring-signal/20",
                          isActive && "text-signal"
                        )}
                        onClick={() => setSort((current) => cycleEvidenceMapSort(current, outcome))}
                        aria-label={evidenceMapSortAriaLabel(sort, outcome)}
                        title={evidenceMapSortAriaLabel(sort, outcome)}
                      >
                        {shortOutcome(outcome)}
                      </button>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedInterventions.map((intervention) => (
              <EvidenceMapRow
                key={intervention.id}
                intervention={intervention}
                outcomes={outcomes}
                claims={visibleClaims}
                activeClaimId={activeClaimId}
                onSelectClaim={onSelectClaim}
              />
            ))}
          </tbody>
        </table>
      </div>
      <EvidenceMapLegend />
    </div>
  );
}

function EvidenceMapLegend() {
  return (
    <div
      aria-label="Evidence map legend"
      className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600"
      id="evidence-map-legend"
    >
      <span className="rounded-md border border-line bg-mist px-2 py-1">
        <strong className="text-ink">—</strong> = not yet assessed
      </span>
      <span className="rounded-md border border-line bg-mist px-2 py-1">
        <strong className="text-ink">N/A</strong> = not applicable
      </span>
      <span className="rounded-md border border-line bg-mist px-2 py-1">
        <strong className="text-ink">No evidence found</strong> = searched and no credible evidence found
      </span>
      <span className="rounded-md border border-amberline/25 bg-amber-50 px-2 py-1 text-amberline">
        Unassessed cells do not imply absence of evidence.
      </span>
      <span className="rounded-md border border-line bg-mist px-2 py-1">
        Click an outcome column to sort rows high to low, then low to high, then alphabetical again.
      </span>
    </div>
  );
}

function OutcomeColumnTooltip({ outcome }: { outcome: OutcomeArea }) {
  const label = `About ${outcome} column`;
  const template = SUPPLEMENT_ONBOARDING_CLAIM_TEMPLATES.find((item) => item.outcome === outcome);
  const detail =
    template?.claimText ??
    "Each cell summarizes a scoped draft claim for this outcome when one exists in the catalog.";

  return (
    <span
      className="group relative inline-flex shrink-0"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        aria-label={label}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-signal/25 bg-white text-signal outline-none transition hover:border-signal hover:bg-blue-50 focus:border-signal focus:ring-4 focus:ring-signal/20"
        title={label}
      >
        <CircleHelp aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-72 -translate-x-1/2 rounded-md border border-line bg-white p-3 text-left text-xs font-normal leading-5 text-slate-700 shadow-panel group-focus-within:block group-hover:block"
      >
        <span className="block font-semibold text-ink">{outcome}</span>
        <span className="mt-2 block">{detail}</span>
        <span className="mt-2 block text-slate-600">
          Cells show a draft composite score when a scoped claim exists. A dash means not yet
          assessed, not evidence of absence.
        </span>
      </span>
    </span>
  );
}

function EvidenceMapSortIndicator({
  direction
}: {
  direction: "asc" | "desc" | null;
}) {
  if (direction === "desc") {
    return <ArrowDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />;
  }

  if (direction === "asc") {
    return <ArrowUp aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />;
  }

  return <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-400" />;
}

function InterventionRowTooltip({ intervention }: { intervention: Intervention }) {
  const label = `About ${intervention.name}`;

  return (
    <span
      className="group relative inline-flex shrink-0"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        aria-label={label}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-signal/25 bg-white text-signal outline-none transition hover:border-signal hover:bg-blue-50 focus:border-signal focus:ring-4 focus:ring-signal/20"
        title={label}
      >
        <CircleHelp aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-30 mt-2 hidden w-80 rounded-md border border-line bg-white p-3 text-left text-xs font-normal leading-5 text-slate-700 shadow-panel group-focus-within:block group-hover:block"
      >
        <span className="block font-semibold text-ink">{intervention.name}</span>
        <span className="mt-2 block">
          <span className="font-semibold text-slate-600">Category:</span> {intervention.category}
        </span>
        {intervention.synonyms.length > 0 ? (
          <span className="mt-1 block">
            <span className="font-semibold text-slate-600">Also known as:</span>{" "}
            {shortList(intervention.synonyms)}
          </span>
        ) : null}
        <span className="mt-1 block">
          <span className="font-semibold text-slate-600">Common forms:</span>{" "}
          {shortList(intervention.commonForms)}
        </span>
        <span className="mt-2 block">{intervention.evidenceSummary}</span>
        <span className="mt-2 block text-slate-600">{intervention.safetySummary}</span>
        <span className="mt-2 block text-slate-600">
          Open the intervention name link for claim-level evidence cards and source packets.
        </span>
      </span>
    </span>
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
  onSelectClaim: SelectClaimHandler;
}) {
  return (
    <tr>
      <th
        className="sticky left-0 z-10 h-14 rounded-md border border-line bg-white px-2 text-left text-sm font-semibold text-ink"
        scope="row"
      >
        <div className="flex items-start gap-1.5">
          <a
            className="min-w-0 text-ink underline decoration-slate-300 underline-offset-2 hover:text-signal hover:decoration-signal"
            href={`/interventions/${intervention.slug}`}
          >
            {intervention.name}
          </a>
          <InterventionRowTooltip intervention={intervention} />
        </div>
      </th>
      {outcomes.map((outcome) => {
        const claim = visibleClaims.find(
          (item) => item.interventionId === intervention.id && item.outcome === outcome
        );

        if (!claim) {
          return (
            <td
              key={`${intervention.id}-${outcome}`}
              aria-label={`${intervention.name}, ${outcome}: not yet assessed; this does not mean no evidence exists.`}
              className="h-14 w-[4.25rem] min-w-[4.25rem] max-w-[4.75rem] rounded-md border border-dashed border-line bg-slate-50 px-1 text-center text-xs text-slate-400"
              title="Not yet assessed; this does not mean no evidence exists."
            >
              <span aria-hidden="true">—</span>
              <span className="sr-only">
                Not yet assessed; this does not mean no evidence exists.
              </span>
            </td>
          );
        }

        const score = compositeScore(claim.scores);

        return (
          <td key={claim.id} className="h-14 w-[4.25rem] min-w-[4.25rem] max-w-[4.75rem] p-0 align-middle">
            <button
              type="button"
              onClick={() => onSelectClaim(claim.id, { scrollToDetail: true })}
              className={cn(
                "flex h-14 w-full flex-col items-center justify-center rounded-md border px-1 text-center text-[11px] leading-tight transition hover:border-signal hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-signal/20",
                labelTone(claim.finalLabel),
                activeClaimId === claim.id && "border-signal ring-2 ring-signal/25"
              )}
              aria-label={`${intervention.name}, ${claim.outcome}: ${compositeLabel(
                claim
              )} ${score.toFixed(
                1
              )} out of 10, ${scoreBand(score)} band, ${classificationLabel(claim)} ${
                claim.finalLabel
              }, review status ${reviewStatusLabel(claim.reviewStatus)}. ${scoreExplanationTitle(
                "composite",
                `${score.toFixed(1)}/10`
              )}`}
              title={scoreExplanationTitle("composite", `${score.toFixed(1)}/10`)}
            >
              <span className="font-semibold">{score.toFixed(1)}</span>
              <span className="max-w-full truncate">{scoreBand(score)}</span>
            </button>
          </td>
        );
      })}
    </tr>
  );
}

function ClaimTable({
  activeClaimId,
  embedded,
  onSelectClaim,
  rows
}: {
  activeClaimId: string;
  embedded?: boolean;
  onSelectClaim: SelectClaimHandler;
  rows: ClaimTableRow[];
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
        cell: ({ row }) => (
          <ScoreWithExplainer
            explanationKind="composite"
            value={`${row.original.composite.toFixed(1)}/10`}
          >
            {row.original.composite.toFixed(1)}
          </ScoreWithExplainer>
        )
      },
      {
        accessorKey: "safety",
        header: "Safety",
        cell: ({ row }) => (
          <ScoreWithExplainer explanationKind="safety" value={`${row.original.safety}/10`}>
            {row.original.safety}
          </ScoreWithExplainer>
        )
      },
      {
        accessorKey: "regulatoryRisk",
        header: "Reg risk",
        cell: ({ row }) => (
          <ScoreWithExplainer
            explanationKind="regulatoryRisk"
            value={`${row.original.regulatoryRisk}/10`}
          >
            {row.original.regulatoryRisk}
          </ScoreWithExplainer>
        )
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
    <section className={dashboardPanelShellClassName(embedded)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Claim Scores</h2>
          <p className="mt-1 text-sm text-slate-600">Each row is an intervention-outcome pair.</p>
        </div>
      </div>
      {rows.length > 0 ? (
        <div className="mt-4 max-w-full overflow-x-auto">
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
          No local scored claims match the current filters. Clear the search, category, label, or outcome filter to
          return to the full local evidence set.
        </p>
      )}
    </section>
  );
}

function SafetyPanel({
  embedded,
  interventionsById,
  safetyAlerts
}: {
  embedded?: boolean;
  interventionsById: Map<string, Intervention>;
  safetyAlerts: SafetyAlert[];
}) {
  return (
    <section className={dashboardPanelShellClassName(embedded)}>
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
                  <p className="mt-1 text-xs text-slate-600">
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
  activeClaimId,
  claims: visibleClaims,
  embedded,
  interventionsById,
  onSelectClaim,
  referencesById,
  studies
}: {
  activeClaimId: string;
  claims: Claim[];
  embedded?: boolean;
  interventionsById: Map<string, Intervention>;
  onSelectClaim: SelectClaimHandler;
  referencesById: Map<string, Reference>;
  studies: Study[];
}) {
  const [showAllEvidenceCards, setShowAllEvidenceCards] = useState(false);
  const orderedClaims = useMemo(() => {
    const activeClaim = visibleClaims.find((claim) => claim.id === activeClaimId);
    const remainingClaims = visibleClaims.filter((claim) => claim.id !== activeClaimId);

    return activeClaim ? [activeClaim, ...remainingClaims] : remainingClaims;
  }, [activeClaimId, visibleClaims]);
  const displayClaims = showAllEvidenceCards
    ? orderedClaims
    : orderedClaims.slice(0, EVIDENCE_CARD_PREVIEW_LIMIT);
  const hiddenEvidenceCardCount = Math.max(
    orderedClaims.length - EVIDENCE_CARD_PREVIEW_LIMIT,
    0
  );

  useEffect(() => {
    setShowAllEvidenceCards(false);
  }, [activeClaimId, visibleClaims.length]);

  return (
    <section className={dashboardPanelShellClassName(embedded)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">Evidence Cards</h2>
        {visibleClaims.length > 0 ? (
          <p className="text-xs text-slate-600">
            {visibleClaims.length} local evidence card{visibleClaims.length === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3">
        {visibleClaims.length > 0 ? (
          <>
            {displayClaims.map((claim) => {
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
                    {intervention ? (
                      <a
                        className="mt-2 inline-flex rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-signal hover:border-signal"
                        href={`/interventions/${intervention.slug}`}
                      >
                        Intervention detail
                      </a>
                    ) : null}
                    <p className="mt-1 text-sm leading-6 text-slate-700">{claim.claimText}</p>
                  </div>
                  <span className={cn("rounded-md border px-2 py-1 text-xs font-semibold", labelTone(claim.finalLabel))}>
                    {classificationLabel(claim)}: {claim.finalLabel}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{claim.clinicalRelevance}</p>
                <NonProofBox claim={claim} intervention={intervention} compact />
                <div className="mt-3 flex flex-wrap gap-2">
                  <ReviewStatusBadge status={claim.reviewStatus} />
                  <span className={cn("rounded-md border px-2 py-1 text-xs font-semibold", sourcePacketCompletenessTone(sourcePacket.completeness.status))}>
                    Source packet: {sourcePacket.completeness.label}
                  </span>
                  <EvidenceDepthBadges badges={sourcePacket.evidenceDepth.badges} />
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
                  <div className="mt-3 grid gap-2 text-xs md:grid-cols-2">
                    <MiniStat label="Evidence grade" value={claim.evidenceGrade} />
                    <MiniStat label="Effect" value={claim.effectSize} />
                    <MiniStat label="Population" value={claim.populationStudied} />
                    <MiniStat label="Comparator" value={claim.comparator} />
                    <MiniStat label="Duration" value={claim.durationStudied} />
                    <MiniStat label="Applicability" value={claim.applicabilityNotes} />
                    <MiniStat label="Score mover" value={claim.whatWouldChangeScore} />
                    <MiniStat label="Last reviewed" value={claim.lastUpdated} />
                  </div>
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
          })}
            {hiddenEvidenceCardCount > 0 ? (
              <button
                type="button"
                className="rounded-md border border-line bg-mist px-3 py-2 text-left text-xs font-semibold text-signal hover:bg-white"
                onClick={() => setShowAllEvidenceCards((current) => !current)}
              >
                {showAllEvidenceCards
                  ? "Show fewer evidence cards"
                  : `Show ${hiddenEvidenceCardCount} more evidence card${
                      hiddenEvidenceCardCount === 1 ? "" : "s"
                    }`}
              </button>
            ) : null}
          </>
        ) : (
          <p className="rounded-lg border border-line bg-mist p-3 text-sm leading-6 text-slate-600">
            No evidence cards match the current filters. Clear the search, category, or label filter to
            review the full local evidence set.
          </p>
        )}
      </div>
    </section>
  );
}

function LabelAnalyzer({
  embedded,
  findings,
  labelText,
  productAustraliaVerificationById,
  productSignals,
  setLabelText
}: {
  embedded?: boolean;
  findings: ReturnType<typeof analyzeLabel>;
  labelText: string;
  productAustraliaVerificationById: Map<string, ProductAustraliaRegulatoryVerification>;
  productSignals: ProductSignal[];
  setLabelText: (value: string) => void;
}) {
  return (
    <section className={dashboardPanelShellClassName(embedded)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Product Label Analyzer</h2>
          <p className="mt-1 text-sm text-slate-600">
            Ingredient text is checked for quality and safety signals. Demo profiles are not
            verified product recommendations.
          </p>
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
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-ink">{product.name}</h3>
                <p className="mt-1 text-xs text-slate-600">{product.brand}</p>
              </div>
              {isDemoProductSignal(product) ? (
                <span className="rounded-md border border-amberline/30 bg-amber-50 px-2 py-1 text-xs font-semibold text-amberline">
                  Demo only - not a verified product recommendation
                </span>
              ) : null}
            </div>
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
              verification={productAustraliaVerificationById.get(product.id)}
            />
            <p className="mt-3 text-xs leading-5 text-slate-600">
              {product.certifications.length > 0
                ? `Certifications: ${product.certifications.join(", ")}`
                : "No product certifications captured."}
            </p>
            <p className="mt-2 rounded-md border border-line bg-white px-2 py-1 text-xs leading-5 text-slate-600">
              Product quality, efficacy evidence, and AU/TGA/ARTG status are separate. Certification
              does not imply medical proof or Australian authorization.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <span className="rounded-md bg-white px-2 py-1 text-slate-700">
                <ScoreWithExplainer
                  explanationKind="productQuality"
                  value={`${product.qualityScore}/10`}
                >
                  Product quality {product.qualityScore}/10
                </ScoreWithExplainer>
              </span>
              <span className="rounded-md bg-white px-2 py-1 text-slate-700">
                <ScoreWithExplainer
                  explanationKind="claimRisk"
                  value={`${product.labelClaimRiskScore}/10`}
                >
                  Claim risk {product.labelClaimRiskScore}/10
                </ScoreWithExplainer>
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function isDemoProductSignal(product: ProductSignal) {
  return product.brand.toLowerCase() === "demo profile";
}

function ProductAustraliaRegulatoryChip({
  verification
}: {
  verification?: ProductAustraliaRegulatoryVerification;
}) {
  if (!verification?.status) {
    return (
      <div className="mt-3">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex rounded-md border border-amberline/30 bg-amber-50 px-2 py-1 text-xs font-semibold text-amberline">
            AU status uncaptured
          </span>
          <span className="inline-flex rounded-md border border-amberline/30 bg-amber-50 px-2 py-1 text-xs font-semibold text-amberline">
            AU confidence: {verification?.confidence ?? "Very low"}
          </span>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-600">
          {verification?.nextAction ??
            "No product-level AUST/ARTG record has been captured for this product."}
        </p>
      </div>
    );
  }

  const { status } = verification;

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <span
          className={cn(
            "inline-flex rounded-md border px-2 py-1 text-xs font-semibold",
            australiaRegulatoryTone(status.kind)
          )}
          title={status.evidenceRequirement}
        >
          AU: {status.kind} - {status.status}
        </span>
        <span
          className={cn(
            "inline-flex rounded-md border px-2 py-1 text-xs font-semibold",
            australiaVerificationStateTone(verification.state)
          )}
        >
          {verification.stateLabel}
        </span>
        <span className="inline-flex rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-slate-700">
          AU confidence: {verification.confidence}
        </span>
      </div>
      <details className="mt-2 rounded-md border border-line bg-white px-3 py-2 text-xs text-slate-600">
        <summary className="cursor-pointer font-semibold text-ink">AU/TGA detail</summary>
        <dl className="mt-2 grid gap-2">
          <div>
            <dt className="font-semibold text-slate-600">Verification state</dt>
            <dd className="mt-0.5 leading-5">{verification.stateLabel}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-600">Confidence</dt>
            <dd className="mt-0.5 leading-5">{verification.confidence}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-600">Supply status</dt>
            <dd className="mt-0.5 leading-5">{status.supplySummary}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-600">Evidence needed</dt>
            <dd className="mt-0.5 leading-5">{verification.nextAction}</dd>
          </div>
          {status.austNumber ? (
            <div>
              <dt className="font-semibold text-slate-600">AUST number</dt>
              <dd className="mt-0.5 leading-5">{status.austNumber}</dd>
            </div>
          ) : null}
          {status.sponsor ? (
            <div>
              <dt className="font-semibold text-slate-600">Sponsor</dt>
              <dd className="mt-0.5 leading-5">{status.sponsor}</dd>
            </div>
          ) : null}
          <div>
            <dt className="font-semibold text-slate-600">Checked</dt>
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

function australiaVerificationStateTone(state: ProductAustraliaRegulatoryVerification["state"]) {
  switch (state) {
    case "Verified":
      return "border-spruce/30 bg-teal-50 text-spruce";
    case "Stale":
      return "border-amberline/30 bg-amber-50 text-amberline";
    case "Unknown":
      return "border-amberline/30 bg-amber-50 text-amberline";
    case "Missing":
      return "border-danger/30 bg-red-50 text-danger";
  }
}

function TrialWatcher({
  embedded,
  interventionsById,
  trialWatchItems
}: {
  embedded?: boolean;
  interventionsById: Map<string, Intervention>;
  trialWatchItems: TrialWatchItem[];
}) {
  const [showAllTrials, setShowAllTrials] = useState(false);
  const trialPreviewLimit = 6;
  const visibleTrials = showAllTrials
    ? trialWatchItems
    : trialWatchItems.slice(0, trialPreviewLimit);
  const hiddenTrialCount = Math.max(trialWatchItems.length - trialPreviewLimit, 0);

  return (
    <section className={dashboardPanelShellClassName(embedded)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">Trial Watcher</h2>
        {trialWatchItems.length > 0 ? (
          <p className="text-xs text-slate-600">
            {trialWatchItems.length} local registry lead
            {trialWatchItems.length === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3">
        {trialWatchItems.length > 0 ? (
          <>
            {visibleTrials.map((item) => {
              const intervention = interventionsById.get(item.interventionId);
              const labels = labelTrialWatchItem(item, intervention);

              return (
                <article key={item.id} className="rounded-lg border border-line bg-white p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
                      <p className="mt-1 text-xs text-slate-600">
                        {intervention?.name ?? "Unknown intervention"} - {item.lastUpdateDate}
                      </p>
                    </div>
                    <span className="rounded-md border border-signal/30 bg-blue-50 px-2 py-1 text-xs font-semibold text-signal">
                      {item.evidenceImpact}
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
                    <MiniStat label="Status" value={item.status} />
                    <MiniStat label="Phase" value={item.phase} />
                    <MiniStat label="Scope" value={item.enrollment} />
                  </div>
                  <p className="mt-3 rounded-md border border-line bg-mist px-3 py-2 text-xs leading-5 text-slate-600">
                    Registry records are review leads only; relevance labels do not prove benefit or
                    safety.
                  </p>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-signal hover:underline"
                  >
                    {item.nctId ?? "Source"}{" "}
                    <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                  </a>
                </article>
              );
            })}
            {hiddenTrialCount > 0 ? (
              <button
                type="button"
                className="rounded-md border border-line bg-mist px-3 py-2 text-left text-xs font-semibold text-signal hover:bg-white"
                onClick={() => setShowAllTrials((current) => !current)}
              >
                {showAllTrials
                  ? "Show fewer trial records"
                  : `Show ${hiddenTrialCount} more trial record${hiddenTrialCount === 1 ? "" : "s"}`}
              </button>
            ) : null}
          </>
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
  embedded,
  referencesById,
  studies
}: {
  activeClaim: Claim;
  activeIntervention?: Intervention;
  embedded?: boolean;
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
    <section className={dashboardPanelShellClassName(embedded)}>
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
            <p className="mt-1 truncate text-xs text-slate-600">{activeSourceQueries.label}</p>
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
          <NonProofBox claim={claim} intervention={intervention} compact />
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className={cn("rounded-md border px-2 py-1 font-semibold", labelTone(claim.finalLabel))}>
            {classificationLabel(claim)}: {claim.finalLabel}
          </span>
          <ReviewStatusBadge className="bg-white" status={claim.reviewStatus} />
          <span className={cn("rounded-md border px-2 py-1 font-semibold", sourcePacketCompletenessTone(completeness.status))}>
            {completeness.label}
          </span>
          <span className="rounded-md border border-signal/25 bg-white px-2 py-1 font-semibold text-signal">
            {completeness.extractedReferences}/{completeness.totalReferences} refs extracted
          </span>
          <EvidenceDepthBadges badges={packet.evidenceDepth.badges} />
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
                <p className="mt-1 text-xs text-slate-600">
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
          <p className="mt-1 text-xs text-slate-600">
            {study.source} - {study.year}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
            {sourceTypeLabel(study)}
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
        <div className="mt-2 grid gap-2 text-xs md:grid-cols-2">
          <MiniStat label="Sample" value={study.sampleSize} />
          <MiniStat label="Population" value={study.population} />
          <MiniStat label="Intervention" value={study.intervention} />
          <MiniStat label="Risk of bias" value={study.riskOfBias} />
          <MiniStat label="Adverse events" value={study.adverseEvents} />
          <MiniStat label="Funding/conflicts" value={study.fundingConflicts} />
        </div>
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

function sourceTypeLabel(study: Study) {
  return study.sourceTypeTaxonomy ?? study.studyType;
}

function EvidenceDepthBadges({ badges }: { badges: EvidenceDepthBadge[] }) {
  return (
    <>
      {badges.map((badge) => (
        <span
          key={`${badge.kind}-${badge.label}`}
          aria-label={`${badge.label}: ${badge.detail}`}
          className={cn(
            "rounded-md border px-2 py-1 text-xs font-semibold outline-none transition focus:ring-4 focus:ring-signal/20",
            evidenceDepthBadgeTone(badge.kind)
          )}
          tabIndex={0}
          title={badge.detail}
        >
          {badge.label}
        </span>
      ))}
    </>
  );
}

function evidenceDepthBadgeTone(kind: EvidenceDepthBadge["kind"]) {
  if (kind === "rct" || kind === "meta-analysis") {
    return "border-spruce/30 bg-teal-50 text-spruce";
  }

  if (
    kind === "systematic-review" ||
    kind === "review-position-stand" ||
    kind === "clinical-trial-record"
  ) {
    return "border-signal/25 bg-blue-50 text-signal";
  }

  if (
    kind === "regulatory-only" ||
    kind === "regulatory-warning-source" ||
    kind === "animal-mechanistic-only"
  ) {
    return "border-amberline/30 bg-amber-50 text-amberline";
  }

  if (kind === "human-trials-none") {
    return "border-slate-300 bg-slate-50 text-slate-700";
  }

  return "border-line bg-mist text-slate-600";
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
          <p className="mt-1 text-xs text-slate-600">{resultSummary}</p>
          <p className="mt-1 text-xs text-slate-600">
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
          <p className="mt-1 text-xs text-slate-600">{meta.join(" - ") || "Metadata pending"}</p>
        </div>
        <span className="rounded-md border border-spruce/30 bg-teal-50 px-2 py-1 text-xs font-semibold text-spruce">
          <ScoreWithExplainer
            explanationKind="reviewPriority"
            value={`${article.relevanceScore}/100`}
          >
            Review priority {article.relevanceScore}/100
          </ScoreWithExplainer>
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

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
        <MiniStat label="Authors" value={authors || "Not listed"} />
        <MiniStat label="Abstract" value={abstractStatus} />
        <MiniStat label="DOI" value={article.doi ?? "Not listed"} />
      </div>

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
          <p className="mt-1 text-xs text-slate-600">{resultSummary}</p>
          <p className="mt-1 text-xs text-slate-600">
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
          <p className="mt-1 text-xs text-slate-600">
            {study.status} - {study.phase} - {study.lastUpdateDate}
          </p>
        </div>
        <span className="rounded-md border border-spruce/30 bg-teal-50 px-2 py-1 text-xs font-semibold text-spruce">
          <ScoreWithExplainer explanationKind="reviewPriority" value={`${study.triageScore}/100`}>
            Review priority {study.triageScore}/100
          </ScoreWithExplainer>
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <TrialClassificationBadge
          detail={study.trialRelevanceDetail}
          label={study.trialRelevanceLabel}
        />
        <TrialClassificationBadge
          detail={study.trialResultDetail}
          label={study.trialResultLabel}
        />
        {study.triageReasons.map((reason) => (
          <span
            key={reason}
            className="rounded-md border border-line bg-mist px-2 py-1 text-xs font-semibold text-slate-600"
          >
            {reason}
          </span>
        ))}
      </div>

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
        <MiniStat label="Enrollment" value={study.enrollment} />
        <MiniStat label="Study type" value={study.studyType} />
        <MiniStat label="Results" value={study.trialResultLabel} />
      </div>

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
