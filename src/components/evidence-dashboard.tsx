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
  Bookmark,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  DatabaseZap,
  ExternalLink,
  Filter,
  FlaskConical,
  LoaderCircle,
  Play,
  RefreshCw,
  Search,
  Square,
  X
} from "lucide-react";
import { TrialClassificationBadge } from "@/components/trial-classification-badge";
import {
  DASHBOARD_MAIN_TABS,
  LOCAL_CANDIDATE_BUCKET_OPTIONS,
  LOCAL_DASHBOARD_TABS
} from "@/components/local-ingestion/types";
import { InlineConfirmation } from "@/components/local-ingestion/inline-confirmation";
import {
  LocalNextActionStrip,
  acceptedCandidateProcessingNextAction,
  benefitDiscoveryNextAction,
  candidateReviewNextAction,
  identityResolutionNextAction,
  localIngestionNextAction
} from "@/components/local-ingestion/next-action";
import type {
  DashboardMainTab,
  LocalAcceptedCandidateProcessingResult,
  LocalAcceptedCandidateProcessingRunResponse,
  LocalAcceptedCandidateProcessingStatusResponse,
  LocalBenefitDiscoveryAction,
  LocalBenefitDiscoveryActionResponse,
  LocalBenefitDiscoveryAutomationAction,
  LocalBenefitDiscoveryAutomationDecision,
  LocalBenefitDiscoveryAutomationResponse,
  LocalBenefitDiscoveryAutomationScope,
  LocalBenefitDiscoveryAutomationStrategy,
  LocalBenefitDiscoveryCluster,
  LocalBenefitDiscoveryQueueResponse,
  LocalBenefitDiscoverySource,
  LocalCandidateReviewBucket,
  LocalCandidateReviewAutomationAction,
  LocalCandidateReviewAutomationDecision,
  LocalCandidateReviewAutomationResponse,
  LocalCandidateReviewAutomationStrategy,
  LocalCandidateReviewBulkAction,
  LocalCandidateReviewBulkResponse,
  LocalCandidateReviewCandidate,
  LocalCandidateReviewDecisionResponse,
  LocalCandidateReviewOutcomeSignal,
  LocalCandidateReviewResponse,
  LocalCandidateReviewSignalApplyAction,
  LocalCandidateReviewSignalApplyResponse,
  LocalCandidateReviewSignalDecision,
  LocalCandidateReviewSignalKind,
  LocalCandidateReviewSignalMiningResponse,
  LocalCandidateReviewSignalSample,
  LocalCandidateReviewSignalSummary,
  LocalCandidateReviewSourceFilter,
  LocalCandidateReviewStudyFilter,
  LocalIdentityResolutionAction,
  LocalIdentityResolutionActionResponse,
  LocalIdentityResolutionAutomationAction,
  LocalIdentityResolutionAutomationDecision,
  LocalIdentityResolutionAutomationResponse,
  LocalIdentityResolutionAutomationScope,
  LocalIdentityResolutionAutomationStrategy,
  LocalIdentityResolutionCandidate,
  LocalIdentityResolutionQueueResponse,
  LocalIngestionCandidateReadout,
  LocalIngestionDeepeningCatchUpReadout,
  LocalIngestionDiscoveryClassificationReadout,
  LocalIngestionJobReadout,
  LocalIngestionJobStatus,
  LocalIngestionLogEntry,
  LocalIngestionRunJobResult,
  LocalIngestionRunResponse,
  LocalIngestionSource,
  LocalIngestionStartResponse,
  LocalIngestionStatusReadout
} from "@/components/local-ingestion/types";

import {
  buildCatalogTrustSummary,
  isNctIdFormat,
  type CatalogTrustSummary
} from "@/lib/catalog-trust";
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
  isLocalIngestionWriteMethod,
  LOCAL_INGESTION_WRITE_HEADER,
  LOCAL_INGESTION_WRITE_HEADER_VALUE
} from "@/lib/local-ingestion-security";
import { australiaRegulatoryTone } from "@/lib/regulatory";
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
  type EvidenceDepthBadge
} from "@/lib/source-packet";
import { buildSourceSearchQueries } from "@/lib/source-queries";
import { formatProductRegionLabel } from "@/lib/product-signals";
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
import { SUPPLEMENT_ONBOARDING_CLAIM_TEMPLATES } from "@/lib/supplement-onboarding";

type ClaimTableRow = {
  id: string;
  intervention: string;
  outcome: string;
  label: EvidenceLabel;
  sourcePacketStatus: ClaimSourcePacket["completeness"]["status"];
  sourcePacketLabel: string;
  composite: number | null;
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
const DEFAULT_CODEX_REVIEW_SIDECAR_URL = "http://127.0.0.1:3217/codex/review";
const HUMAN_REVIEWED_TOOLTIP =
  "Human reviewed means a human reviewer checked the source packet against the scoped claim. It does not mean clinical guideline endorsement.";
const DRAFT_LEAD_EVIDENCE_GRADE = "Draft lead";
const SOURCE_PACKET_REVIEW_EVIDENCE_GRADE = "Insufficient until source packets are reviewed.";
const STARTER_LOOKING_COMPOSITE_SCORES = new Set(["2.1", "3.1"]);
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
  const score = evidenceMapSortableScore(activeClaim);

  return (
    <div className="mb-3 rounded-lg border border-signal/25 bg-blue-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-signal">Selected claim</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-700">
        <span className="font-semibold text-ink">
          {activeIntervention?.name ?? "Unknown intervention"} · {shortOutcome(activeClaim.outcome)}
        </span>
        <span>
          {score === null ? "Composite pending source review" : `${compositeLabel(activeClaim)} ${score.toFixed(1)}/10`}
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
  const [evidenceMapStatusFilter, setEvidenceMapStatusFilter] =
    useState<EvidenceMapStatusFilter>("all");
  const [activeClaimId, setActiveClaimId] = useState(claims[0]?.id ?? "");
  const [labelText, setLabelText] = useState(
    "Creatine monohydrate 5 g\nNSF Certified for Sport\nNo proprietary blend"
  );
  const detailSectionRef = useRef<HTMLElement>(null);
  const [detailPanelsOpen, setDetailPanelsOpen] = useState(false);
  const [mainTab, setMainTab] = useState<DashboardMainTab>("evidence-map");
  const [localToolsVisible, setLocalToolsVisible] = useState(false);
  const catalogTrustSummary = useMemo(() => buildCatalogTrustSummary(data), [data]);

  const handleSelectClaim = useCallback<SelectClaimHandler>((claimId, options) => {
    setActiveClaimId(claimId);

    if (options?.scrollToDetail) {
      setMainTab("claim-details");
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
  const evidenceMapClaims = useMemo(
    () =>
      filteredClaims.filter((claim) =>
        claimMatchesEvidenceMapStatusFilter(claim, evidenceMapStatusFilter)
      ),
    [evidenceMapStatusFilter, filteredClaims]
  );
  const evidenceMapInterventions = useMemo(() => {
    if (evidenceMapStatusFilter === "all") {
      return filteredInterventions;
    }

    const visibleIds = new Set(evidenceMapClaims.map((claim) => claim.interventionId));
    return filteredInterventions.filter((intervention) => visibleIds.has(intervention.id));
  }, [evidenceMapClaims, evidenceMapStatusFilter, filteredInterventions]);
  const evidenceMapReadinessSummary = useMemo(
    () =>
      buildEvidenceMapReadinessSummary({
        claims: filteredClaims,
        referencesById,
        studies
      }),
    [filteredClaims, referencesById, studies]
  );

  useEffect(() => {
    if (filteredClaims.length === 0) {
      return;
    }

    if (filteredClaims.some((claim) => claim.id === activeClaimId)) {
      return;
    }

    setActiveClaimId(filteredClaims[0].id);
  }, [activeClaimId, filteredClaims]);

  useEffect(() => {
    setLocalToolsVisible(isLocalDashboardHost());
  }, []);

  useEffect(() => {
    if (!localToolsVisible && LOCAL_DASHBOARD_TABS.has(mainTab)) {
      setMainTab("evidence-map");
    }
  }, [localToolsVisible, mainTab]);

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
          composite: evidenceMapSortableScore(claim),
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
        <DashboardMainTabs
          activeTab={mainTab}
          includeLocalTools={localToolsVisible}
          onChange={setMainTab}
        />

        {mainTab === "evidence-map" ? (
          <section className="min-w-0">
            <div className="min-w-0 rounded-lg border border-line bg-white p-4 shadow-panel">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-ink">Evidence Map</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Reviewed cells show composite evidence confidence. Draft leads and source-packet scaffolds stay
                    marked as review work until scores are assigned from the evidence.
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {formatEvidenceMapFilterSummary({
                      filteredClaimCount: evidenceMapClaims.length,
                      filteredInterventionCount: evidenceMapInterventions.length,
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

              <EvidenceMapReadinessStrip
                onStatusFilterChange={setEvidenceMapStatusFilter}
                statusFilter={evidenceMapStatusFilter}
                summary={evidenceMapReadinessSummary}
              />

              <EvidenceMap
                claims={evidenceMapClaims}
                interventions={evidenceMapInterventions}
                activeClaimId={activeClaimIdForDisplay}
                onSelectClaim={handleSelectClaim}
              />
            </div>
          </section>
        ) : null}

        {mainTab === "claim-details" ? (
          <section
            ref={detailSectionRef}
            aria-label="Selected claim details"
            className="min-w-0 scroll-mt-4"
          >
            {activeClaim ? (
              <ActiveClaimContextBar
                activeClaim={activeClaim}
                activeIntervention={activeIntervention}
              />
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
        ) : null}

        {mainTab === "candidate-review" ? <LocalCandidateReviewWorkbench /> : null}
        {mainTab === "local-ingestion" ? <LocalIngestionControl /> : null}
        {mainTab === "catalog-trust" ? (
          <CatalogTrustPanel data={data} summary={catalogTrustSummary} />
        ) : null}
      </div>
    </main>
  );
}

function DashboardMainTabs({
  activeTab,
  includeLocalTools,
  onChange
}: {
  activeTab: DashboardMainTab;
  includeLocalTools: boolean;
  onChange: (tab: DashboardMainTab) => void;
}) {
  const visibleTabs = DASHBOARD_MAIN_TABS.filter(
    (tab) => includeLocalTools || !LOCAL_DASHBOARD_TABS.has(tab.value)
  );

  return (
    <div
      role="tablist"
      aria-label="Dashboard sections"
      className="flex flex-wrap gap-2 rounded-lg border border-line bg-white p-2 shadow-panel"
    >
      {visibleTabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            "h-9 rounded-md border px-3 text-sm font-semibold transition",
            activeTab === tab.value
              ? "border-signal bg-blue-50 text-signal"
              : "border-transparent bg-white text-slate-700 hover:border-line hover:bg-mist"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function LocalIngestionControl() {
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<LocalIngestionStatusReadout | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    "Idle. Press Start ingestion to queue broad supplement discovery."
  );
  const [logEntries, setLogEntries] = useState<LocalIngestionLogEntry[]>([]);
  const stopRequestedRef = useRef(false);
  const runIdRef = useRef(0);

  const appendLog = useCallback((entry: Omit<LocalIngestionLogEntry, "id" | "timestamp">) => {
    setLogEntries((current) =>
      [
        {
          ...entry,
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          timestamp: new Date().toISOString()
        },
        ...current
      ].slice(0, 20)
    );
  }, []);

  const refreshStatus = useCallback(async () => {
    const nextStatus = await fetchLocalIngestionStatus();
    setStatus(nextStatus);
    return nextStatus;
  }, []);

  useEffect(() => {
    if (!isLocalDashboardHost()) {
      return;
    }

    setVisible(true);
    refreshStatus()
      .then((nextStatus) => {
        setStatusMessage(localIngestionIdleMessage(nextStatus));
      })
      .catch((error) => {
        setStatusMessage(localIngestionErrorMessage(error));
      });
  }, [refreshStatus]);

  useEffect(() => {
    return () => {
      stopRequestedRef.current = true;
      runIdRef.current += 1;
    };
  }, []);

  const stopIngestion = useCallback(() => {
    stopRequestedRef.current = true;
    setActive(false);
    setStatusMessage("Stopping after the current ingestion request finishes.");
    appendLog({
      level: "info",
      message: "Stop requested",
      detail: "The dashboard will not start another batch after the current request."
    });
  }, [appendLog]);

  const startIngestion = useCallback(async () => {
    if (active || busy) {
      return;
    }

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    stopRequestedRef.current = false;
    setActive(true);
    setBusy(true);
    setStatusMessage("Queuing broad discovery searches for every local intervention.");

    try {
      const startResult = await postLocalIngestionStart();
      setStatus(startResult.status);
      appendLog({
        level: "success",
        message: `Queued ${startResult.newJobs.toLocaleString()} new ingestion job(s)`,
        detail: `${startResult.existingJobs.toLocaleString()} existing job(s), ${startResult.interventionCount.toLocaleString()} interventions scanned. ${localIngestionDeepeningCatchUpSummary(startResult.deepeningCatchUp)}`
      });

      let nextStatus = startResult.status;
      let synonymExpansionQueued = false;

      while (!stopRequestedRef.current && runIdRef.current === runId) {
        const queued = localIngestionQueueCount(nextStatus, "QUEUED");
        const running = localIngestionQueueCount(nextStatus, "RUNNING");

        if (queued <= 0 && running <= 0) {
          if (!synonymExpansionQueued) {
            synonymExpansionQueued = true;
            setStatusMessage("Primary searches are exhausted. Queueing saved supplement synonyms.");
            const synonymResult = await postLocalIngestionSynonyms();
            nextStatus = synonymResult.status;
            setStatus(nextStatus);
            appendLog({
              level: synonymResult.newJobs > 0 ? "success" : "info",
              message: `Synonym pass queued ${synonymResult.newJobs.toLocaleString()} new ingestion job(s)`,
              detail: `${synonymResult.searchTermCount.toLocaleString()} saved synonym term(s), ${synonymResult.existingJobs.toLocaleString()} existing job(s). ${localIngestionDeepeningCatchUpSummary(synonymResult.deepeningCatchUp)}`
            });

            if (
              localIngestionQueueCount(nextStatus, "QUEUED") > 0 ||
              localIngestionQueueCount(nextStatus, "RUNNING") > 0
            ) {
              continue;
            }
          }

          setStatusMessage("Ingestion queue is empty.");
          appendLog({
            level: "success",
            message: "Ingestion queue finished",
            detail: `${nextStatus.candidates.total.toLocaleString()} source candidate(s) are now in the local database.`
          });
          break;
        }

        setStatusMessage(`Processing next source search. ${queued.toLocaleString()} queued.`);
        const batch = await postLocalIngestionRun(1);
        nextStatus = batch.status;
        setStatus(nextStatus);

        if (batch.results.length === 0) {
          setStatusMessage(localIngestionIdleMessage(nextStatus));
          appendLog({
            level: "info",
            message: "No queued job was available",
            detail: "The runner did not claim a job on this pulse."
          });
          break;
        }

        for (const result of batch.results) {
          const deepeningDetail = result.deepening
            ? ` ${localIngestionDeepeningRunSummary(result.deepening)}`
            : "";
          appendLog({
            level: result.status === "FAILED" ? "error" : "success",
            message: `${localIngestionSourceLabel(result.source)} ${localIngestionStatusLabel(result.status)}: ${result.recordsFound.toLocaleString()} found, ${result.recordsChanged.toLocaleString()} saved`,
            detail: result.error
              ? `${result.query} - ${result.error}${deepeningDetail}`
              : `${result.query}${deepeningDetail}`
          });
        }

        if (!batch.hasMoreQueued) {
          setStatusMessage(localIngestionIdleMessage(nextStatus));
          break;
        }

        await sleep(5000);
      }
    } catch (error) {
      const message = localIngestionErrorMessage(error);
      setStatusMessage(message);
      appendLog({
        level: "error",
        message: "Ingestion stopped",
        detail: message
      });
    } finally {
      if (runIdRef.current === runId) {
        setActive(false);
        setBusy(false);
        stopRequestedRef.current = false;
        refreshStatus().catch(() => undefined);
      }
    }
  }, [active, appendLog, busy, refreshStatus]);

  const queued = status ? localIngestionQueueCount(status, "QUEUED") : 0;
  const running = status ? localIngestionQueueCount(status, "RUNNING") : 0;
  const succeeded = status ? localIngestionQueueCount(status, "SUCCEEDED") : 0;
  const failed = status ? localIngestionQueueCount(status, "FAILED") : 0;
  const pendingCandidates = status?.candidates.counts.PENDING_REVIEW ?? 0;
  const acceptedCandidates = status?.candidates.counts.ACCEPTED ?? 0;

  if (!visible) {
    return null;
  }

  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Local ingestion
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-ink">Supplement discovery runner</h2>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold",
                active
                  ? "border-signal/30 bg-blue-50 text-signal"
                  : "border-line bg-mist text-slate-600"
              )}
            >
              {active ? (
                <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <DatabaseZap aria-hidden="true" className="h-3.5 w-3.5" />
              )}
              {active ? "Active" : "Idle"}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Starts with supplement-only PubMed searches, then broad PubMed and ClinicalTrials.gov
            discovery for local interventions. Saved synonyms are queued after the main-name searches
            are exhausted.
          </p>
          <p aria-live="polite" className="mt-2 text-sm font-semibold text-ink">
            {statusMessage}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={startIngestion}
            disabled={active || busy}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-signal bg-signal px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-signal/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {active ? (
              <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play aria-hidden="true" className="h-3.5 w-3.5" />
            )}
            {active ? "Ingesting" : "Start ingestion"}
          </button>
          <button
            type="button"
            onClick={stopIngestion}
            disabled={!active}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-mist px-3 text-xs font-semibold text-slate-700 transition hover:border-signal disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Square aria-hidden="true" className="h-3.5 w-3.5" />
            Stop
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusMessage("Refreshing local ingestion status.");
              refreshStatus()
                .then((nextStatus) => {
                  setStatusMessage(localIngestionIdleMessage(nextStatus));
                })
                .catch((error) => {
                  setStatusMessage(localIngestionErrorMessage(error));
                });
            }}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-signal"
          >
            <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      <LocalNextActionStrip
        action={localIngestionNextAction({
          active,
          busy,
          status
        })}
      />

      <div className="mt-4 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        <MiniStat label="Queued" value={queued.toLocaleString()} />
        <MiniStat label="Running" value={running.toLocaleString()} />
        <MiniStat label="Succeeded" value={succeeded.toLocaleString()} />
        <MiniStat label="Failed" value={failed.toLocaleString()} />
        <MiniStat label="Pending candidates" value={pendingCandidates.toLocaleString()} />
        <MiniStat label="Accepted candidates" value={acceptedCandidates.toLocaleString()} />
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-lg border border-line bg-mist p-3">
          <h3 className="text-sm font-semibold text-ink">Activity</h3>
          <div className="mt-3 grid gap-2">
            {logEntries.length > 0 ? (
              logEntries.map((entry) => (
                <LocalIngestionLogRow key={entry.id} entry={entry} />
              ))
            ) : (
              <p className="rounded-md border border-line bg-white p-3 text-sm text-slate-600">
                No ingestion pulses have run in this browser session yet.
              </p>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-line bg-mist p-3">
          <h3 className="text-sm font-semibold text-ink">Recent database activity</h3>
          <div className="mt-3 grid gap-2">
            {status?.queue.recentJobs.length ? (
              status.queue.recentJobs.slice(0, 5).map((job) => (
                <LocalIngestionJobRow key={job.jobId} job={job} />
              ))
            ) : (
              <p className="rounded-md border border-line bg-white p-3 text-sm text-slate-600">
                No source ingestion jobs found in the local database.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-line bg-mist p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">Newly discovered candidates</h3>
          <p className="text-xs text-slate-600">
            {status ? `Updated ${formatLocalIngestionTime(status.updatedAt)}` : "Not loaded"}
          </p>
        </div>
        <div className="mt-3 grid gap-2">
          {status?.candidates.recent.length ? (
            status.candidates.recent.slice(0, 5).map((candidate) => (
              <LocalIngestionCandidateRow
                key={`${candidate.source}-${candidate.externalId}-${candidate.query}`}
                candidate={candidate}
              />
            ))
          ) : (
            <p className="rounded-md border border-line bg-white p-3 text-sm text-slate-600">
              No source candidates have been discovered yet.
            </p>
          )}
        </div>
      </div>

    </section>
  );
}

function LocalCandidateReviewWorkbench({
  onCandidateDecision
}: {
  onCandidateDecision?: () => Promise<LocalIngestionStatusReadout | void>;
} = {}) {
  const [bucket, setBucket] = useState<LocalCandidateReviewBucket>("likely-useful");
  const [source, setSource] = useState<LocalCandidateReviewSourceFilter>("ALL");
  const [studyFilter, setStudyFilter] = useState<LocalCandidateReviewStudyFilter>("all");
  const [queryDraft, setQueryDraft] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [autoBusy, setAutoBusy] = useState<"preview" | "apply" | null>(null);
  const [autoPreview, setAutoPreview] =
    useState<LocalCandidateReviewAutomationResponse | null>(null);
  const [candidateAutoStrategy, setCandidateAutoStrategy] =
    useState<LocalCandidateReviewAutomationStrategy>("strict");
  const [signalBusy, setSignalBusy] = useState<"mine" | "park" | "reject" | null>(null);
  const [signalPreview, setSignalPreview] =
    useState<LocalCandidateReviewSignalMiningResponse | null>(null);
  const [message, setMessage] = useState("Loading review candidates.");
  const [pendingBulkAction, setPendingBulkAction] =
    useState<LocalCandidateReviewBulkAction | null>(null);
  const [pendingAutoTriage, setPendingAutoTriage] = useState(false);
  const [pendingSignalAction, setPendingSignalAction] =
    useState<LocalCandidateReviewSignalApplyAction | null>(null);
  const [review, setReview] = useState<LocalCandidateReviewResponse | null>(null);
  const activeBulkAction = actionKey?.startsWith("bulk:")
    ? (actionKey.slice(5) as LocalCandidateReviewBulkAction)
    : null;
  const currentBucketCount = localCandidateBucketCount(review, bucket);
  const controlsBusy = busy || Boolean(actionKey) || Boolean(autoBusy) || Boolean(signalBusy);

  const loadReviewCandidates = useCallback(async () => {
    setBusy(true);
    setMessage("Loading review candidates.");

    try {
      const nextReview = await fetchLocalCandidateReview({
        bucket,
        q: query,
        source,
        studyFilter
      });
      setReview(nextReview);
      setMessage(
        `${nextReview.candidates.length.toLocaleString()} candidate(s) shown from ${nextReview.counts.all.toLocaleString()} pending local candidate(s).`
      );
    } catch (error) {
      setMessage(localIngestionErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }, [bucket, query, source, studyFilter]);

  useEffect(() => {
    loadReviewCandidates().catch(() => undefined);
  }, [loadReviewCandidates]);

  useEffect(() => {
    setAutoPreview(null);
    setPendingAutoTriage(false);
    setPendingSignalAction(null);
    setSignalPreview(null);
  }, [candidateAutoStrategy, query, source, studyFilter]);

  const recordDecision = useCallback(
    async (candidate: LocalCandidateReviewCandidate, decision: "Accepted" | "Rejected") => {
      const nextActionKey = `${candidate.dedupeKey}:${decision}`;
      setActionKey(nextActionKey);
      setMessage(`${decision === "Accepted" ? "Accepting" : "Rejecting"} candidate.`);

      try {
        await postLocalCandidateReviewDecision({
          decision,
          dedupeKey: candidate.dedupeKey,
          reviewNote:
            decision === "Accepted"
              ? "Accepted from local candidate review dashboard after user click."
              : "Rejected from local candidate review dashboard after user click."
        });
        await onCandidateDecision?.();
        await loadReviewCandidates();
        setMessage(`${decision === "Accepted" ? "Accepted" : "Rejected"} ${candidate.externalId}.`);
      } catch (error) {
        setMessage(localIngestionErrorMessage(error));
      } finally {
        setActionKey(null);
      }
    },
    [loadReviewCandidates, onCandidateDecision]
  );

  const recordBulkDecision = useCallback(
    async (bulkAction: LocalCandidateReviewBulkAction) => {
      const nextActionKey = `bulk:${bulkAction}`;
      setActionKey(nextActionKey);
      setBusy(true);
      setMessage(`${localCandidateBulkActionProgressLabel(bulkAction)}.`);

      try {
        const result = await postLocalCandidateReviewBulkDecision({
          bucket,
          bulkAction,
          q: query,
          reviewNote: localCandidateBulkReviewNote(bulkAction),
          source,
          studyFilter
        });
        await onCandidateDecision?.();
        await loadReviewCandidates();
        setMessage(localCandidateBulkResultMessage(result));
      } catch (error) {
        setMessage(localIngestionErrorMessage(error));
      } finally {
        setActionKey(null);
        setPendingBulkAction(null);
        setBusy(false);
      }
    },
    [bucket, loadReviewCandidates, onCandidateDecision, query, source, studyFilter]
  );

  const previewMaybeUsefulAutomation = useCallback(async () => {
    setAutoBusy("preview");
    setMessage("Previewing maybe-useful auto-triage.");

    try {
      const result = await postLocalCandidateReviewAutomation({
        apply: false,
        q: query,
        source,
        strategy: candidateAutoStrategy,
        studyFilter
      });
      setAutoPreview(result);
      setMessage(localCandidateReviewAutomationResultMessage(result));
    } catch (error) {
      setMessage(localIngestionErrorMessage(error));
    } finally {
      setAutoBusy(null);
    }
  }, [candidateAutoStrategy, query, source, studyFilter]);

  const applyMaybeUsefulAutomation = useCallback(async () => {
    setAutoBusy("apply");
    setMessage("Applying maybe-useful auto-triage.");

    try {
      const result = await postLocalCandidateReviewAutomation({
        apply: true,
        q: query,
        source,
        strategy: candidateAutoStrategy,
        studyFilter
      });
      setAutoPreview(result);
      await onCandidateDecision?.();
      await loadReviewCandidates();
      setMessage(localCandidateReviewAutomationResultMessage(result));
    } catch (error) {
      setMessage(localIngestionErrorMessage(error));
    } finally {
      setAutoBusy(null);
      setPendingAutoTriage(false);
    }
  }, [candidateAutoStrategy, loadReviewCandidates, onCandidateDecision, query, source, studyFilter]);

  const mineMaybeUsefulSignals = useCallback(async () => {
    setSignalBusy("mine");
    setMessage("Mining held maybe-useful signals.");

    try {
      const result = await postLocalCandidateReviewSignalMining({
        q: query,
        source,
        studyFilter
      });
      setSignalPreview(result);
      setMessage(localCandidateReviewSignalMiningResultMessage(result));
    } catch (error) {
      setMessage(localIngestionErrorMessage(error));
    } finally {
      setSignalBusy(null);
    }
  }, [query, source, studyFilter]);

  const applyMinedSignals = useCallback(
    async (signalAction: LocalCandidateReviewSignalApplyAction) => {
      setSignalBusy(signalAction === "reject-mismatches" ? "reject" : "park");
      setMessage(localCandidateReviewSignalApplyProgressMessage(signalAction));

      try {
        const result = await postLocalCandidateReviewSignalApply({
          q: query,
          signalAction,
          source,
          studyFilter
        });
        await onCandidateDecision?.();
        await loadReviewCandidates();
        const nextPreview = await postLocalCandidateReviewSignalMining({
          q: query,
          source,
          studyFilter
        });
        setSignalPreview(nextPreview);
        setMessage(localCandidateReviewSignalApplyResultMessage(result));
      } catch (error) {
        setMessage(localIngestionErrorMessage(error));
      } finally {
        setPendingSignalAction(null);
        setSignalBusy(null);
      }
    },
    [loadReviewCandidates, onCandidateDecision, query, source, studyFilter]
  );

  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Local candidates
          </p>
          <h2 className="mt-1 text-base font-semibold text-ink">Candidate review workbench</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Review local draft candidates from the ingestion run. Accept creates or reuses a
            traceable local reference; reject removes noisy rows from the review queue.
          </p>
          <p aria-live="polite" className="mt-2 text-sm font-semibold text-slate-700">
            {message}
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadReviewCandidates()}
          disabled={busy}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-signal disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            aria-hidden="true"
            className={cn("h-3.5 w-3.5", busy ? "animate-spin" : "")}
          />
          Refresh
        </button>
      </div>

      <LocalNextActionStrip
        action={candidateReviewNextAction({
          bucket,
          review
        })}
      />

      <AcceptedCandidateProcessor />
      <BenefitDiscoveryQueue />

      <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-7">
        <MiniStat label="Likely useful" value={(review?.counts.likelyUseful ?? 0).toLocaleString()} />
        <MiniStat label="Maybe useful" value={(review?.counts.maybeUseful ?? 0).toLocaleString()} />
        <MiniStat label="All useful" value={(review?.counts.allUseful ?? 0).toLocaleString()} />
        <MiniStat label="Likely noise" value={(review?.counts.likelyNoise ?? 0).toLocaleString()} />
        <MiniStat
          label="Parked research"
          value={(review?.counts.parkedResearch ?? 0).toLocaleString()}
        />
        <MiniStat label="Unclassified" value={(review?.counts.unclassified ?? 0).toLocaleString()} />
        <MiniStat label="Pending" value={(review?.counts.all ?? 0).toLocaleString()} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {LOCAL_CANDIDATE_BUCKET_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setBucket(option.value)}
            className={cn(
              "h-8 rounded-md border px-3 text-xs font-semibold transition",
              bucket === option.value
                ? "border-signal bg-blue-50 text-signal"
                : "border-line bg-mist text-slate-700 hover:border-signal"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
        <label className="flex min-w-0 items-center gap-2 rounded-md border border-line bg-white px-3">
          <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500" />
          <input
            value={queryDraft}
            onChange={(event) => setQueryDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                setQuery(queryDraft.trim());
              }
            }}
            placeholder="Search title, query, PMID/NCT, or intervention"
            className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
        </label>
        <select
          value={source}
          onChange={(event) => setSource(event.target.value as LocalCandidateReviewSourceFilter)}
          className="h-9 rounded-md border border-line bg-white px-3 text-xs font-semibold text-slate-700"
        >
          <option value="ALL">All sources</option>
          <option value="PUBMED">PubMed</option>
          <option value="CLINICALTRIALS_GOV">ClinicalTrials.gov</option>
        </select>
        <select
          value={studyFilter}
          onChange={(event) =>
            setStudyFilter(event.target.value as LocalCandidateReviewStudyFilter)
          }
          className="h-9 rounded-md border border-line bg-white px-3 text-xs font-semibold text-slate-700"
        >
          <option value="all">All study types</option>
          <option value="reviews">Reviews</option>
          <option value="trials">Trials</option>
          <option value="results-posted">Results posted</option>
        </select>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setQuery(queryDraft.trim())}
          className="inline-flex h-8 items-center gap-2 rounded-md border border-signal bg-signal px-3 text-xs font-semibold text-white transition hover:bg-signal/90"
        >
          <Search aria-hidden="true" className="h-3.5 w-3.5" />
          Search
        </button>
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setQueryDraft("");
            }}
            className="inline-flex h-8 items-center gap-2 rounded-md border border-line bg-mist px-3 text-xs font-semibold text-slate-700 transition hover:border-signal"
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
            Clear
          </button>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 rounded-lg border border-line bg-mist p-3">
        <button
          type="button"
          onClick={() => setPendingBulkAction("accept-all")}
          disabled={controlsBusy || currentBucketCount === 0}
          title="Accept every visible candidate in the currently selected bucket and filters. Use sparingly."
          className="inline-flex h-9 items-center gap-2 rounded-md border border-green-600 bg-green-600 px-3 text-xs font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {activeBulkAction === "accept-all" ? (
            <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check aria-hidden="true" className="h-3.5 w-3.5" />
          )}
          Accept all
        </button>
        <button
          type="button"
          onClick={() => setPendingBulkAction("accept-likely-useful")}
          disabled={controlsBusy || !review?.counts.likelyUseful}
          title="Accept candidates classified as likely useful under the current source/search/study filters."
          className="inline-flex h-9 items-center gap-2 rounded-md border border-signal bg-signal px-3 text-xs font-semibold text-white transition hover:bg-signal/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {activeBulkAction === "accept-likely-useful" ? (
            <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ClipboardCheck aria-hidden="true" className="h-3.5 w-3.5" />
          )}
          Accept likely useful
        </button>
        <button
          type="button"
          onClick={() => setPendingBulkAction("reject-not-useful")}
          disabled={controlsBusy || !review?.counts.likelyNoise}
          title="Reject candidates classified as likely noise under the current source/search/study filters."
          className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-60"
        >
          {activeBulkAction === "reject-not-useful" ? (
            <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          )}
          Reject not useful
        </button>
      </div>

      <div className="mt-3 rounded-lg border border-line bg-mist p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ink">Maybe-useful auto-triage</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Accepts priority review/trial rows with visible intervention identity, rejects only
              low-signal rows, and holds ambiguous candidates.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex h-8 overflow-hidden rounded-md border border-line bg-white">
              {(["strict", "query-backed"] as LocalCandidateReviewAutomationStrategy[]).map(
                (strategy) => (
                  <button
                    key={strategy}
                    type="button"
                    onClick={() => setCandidateAutoStrategy(strategy)}
                    disabled={controlsBusy}
                    title={localCandidateReviewAutomationStrategyTooltip(strategy)}
                    className={cn(
                      "px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                      candidateAutoStrategy === strategy
                        ? "bg-signal text-white"
                        : "text-slate-700 hover:bg-mist"
                    )}
                  >
                    {localCandidateReviewAutomationStrategyLabel(strategy)}
                  </button>
                )
              )}
            </div>
            <button
              type="button"
              onClick={() => previewMaybeUsefulAutomation()}
              disabled={controlsBusy || !review?.counts.maybeUseful}
              title="Preview what the selected maybe-useful auto-triage pass would accept, reject, or hold."
              className="inline-flex h-8 items-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-signal disabled:cursor-not-allowed disabled:opacity-60"
            >
              {autoBusy === "preview" ? (
                <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search aria-hidden="true" className="h-3.5 w-3.5" />
              )}
              Preview
            </button>
            <button
              type="button"
              onClick={() => setPendingAutoTriage(true)}
              disabled={controlsBusy || !review?.counts.maybeUseful}
              title="Apply the selected maybe-useful auto-triage pass after reviewing the preview."
              className="inline-flex h-8 items-center gap-2 rounded-md border border-signal bg-signal px-3 text-xs font-semibold text-white transition hover:bg-signal/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {autoBusy === "apply" ? (
                <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play aria-hidden="true" className="h-3.5 w-3.5" />
              )}
              Apply auto-triage
            </button>
            <button
              type="button"
              onClick={() => mineMaybeUsefulSignals()}
              disabled={controlsBusy || !review?.counts.maybeUseful}
              title="Read-only scan of held maybe-useful rows. Groups them into spot-check, research, mismatch, and low-signal buckets without changing data."
              className="inline-flex h-8 items-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-signal disabled:cursor-not-allowed disabled:opacity-60"
            >
              {signalBusy === "mine" ? (
                <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <DatabaseZap aria-hidden="true" className="h-3.5 w-3.5" />
              )}
              Mine held signals
            </button>
          </div>
        </div>

        {pendingAutoTriage ? (
          <InlineConfirmation
            busy={autoBusy === "apply"}
            confirmLabel="Apply"
            message={localCandidateReviewAutomationConfirmMessage(autoPreview, review)}
            onCancel={() => setPendingAutoTriage(false)}
            onConfirm={() => applyMaybeUsefulAutomation()}
            tone="warn"
          />
        ) : null}

        {autoPreview ? (
          <div className="mt-3 grid gap-3">
            <div className="grid gap-2 md:grid-cols-5">
              <MiniStat label="Scanned" value={autoPreview.counts.scanned.toLocaleString()} />
              <MiniStat label="Accept" value={autoPreview.counts.accepted.toLocaleString()} />
              <MiniStat label="Reject" value={autoPreview.counts.rejected.toLocaleString()} />
              <MiniStat label="Hold" value={autoPreview.counts.held.toLocaleString()} />
              <MiniStat
                label="Applied"
                value={
                  autoPreview.applied
                    ? autoPreview.counts.appliedActions.toLocaleString()
                    : "preview"
                }
              />
            </div>
            <div className="grid gap-2 lg:grid-cols-2">
              {autoPreview.decisions.slice(0, 6).map((decision) => (
                <CandidateReviewAutomationDecisionRow
                  key={decision.dedupeKey}
                  decision={decision}
                />
              ))}
            </div>
          </div>
        ) : null}

        {signalPreview ? (
          <div className="mt-3 grid gap-3 rounded-md border border-line bg-white p-3">
            <div className="grid gap-2 md:grid-cols-5">
              <MiniStat label="Scanned" value={signalPreview.counts.scanned.toLocaleString()} />
              <MiniStat
                label="Spot-check"
                value={signalPreview.counts.spotCheck.toLocaleString()}
              />
              <MiniStat
                label="Research"
                value={signalPreview.counts.parkResearch.toLocaleString()}
              />
              <MiniStat
                label="Mismatch"
                value={signalPreview.counts.identityMismatch.toLocaleString()}
              />
              <MiniStat
                label="Low signal"
                value={signalPreview.counts.lowSignal.toLocaleString()}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPendingSignalAction("reject-mismatches")}
                disabled={controlsBusy || signalPreview.counts.identityMismatch === 0}
                title="Reject mined mismatch rows where the captured source points at another supplement or non-supplement context. Does not create claims or heatmap scores."
                className="inline-flex h-8 items-center gap-2 rounded-md border border-danger/30 bg-white px-3 text-xs font-semibold text-danger transition hover:border-danger disabled:cursor-not-allowed disabled:opacity-60"
              >
                {signalBusy === "reject" ? (
                  <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <X aria-hidden="true" className="h-3.5 w-3.5" />
                )}
                Reject mined mismatches
              </button>
              <button
                type="button"
                onClick={() => setPendingSignalAction("park-research")}
                disabled={controlsBusy || signalPreview.counts.parkResearch === 0}
                title="Park broad research/backlog signals so they stop appearing in active Maybe useful review. Rows remain pending locally; no claim or score is created."
                className="inline-flex h-8 items-center gap-2 rounded-md border border-amberline/30 bg-white px-3 text-xs font-semibold text-amberline transition hover:border-amberline disabled:cursor-not-allowed disabled:opacity-60"
              >
                {signalBusy === "park" ? (
                  <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Bookmark aria-hidden="true" className="h-3.5 w-3.5" />
                )}
                Park mined research
              </button>
            </div>

            {pendingSignalAction ? (
              <InlineConfirmation
                busy={Boolean(signalBusy)}
                confirmLabel="Apply"
                message={localCandidateReviewSignalApplyConfirmMessage(
                  pendingSignalAction,
                  signalPreview
                )}
                onCancel={() => setPendingSignalAction(null)}
                onConfirm={() => applyMinedSignals(pendingSignalAction)}
                tone={pendingSignalAction === "reject-mismatches" ? "danger" : "warn"}
              />
            ) : null}

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Top held interventions
                </h4>
                <div className="mt-2 grid gap-2">
                  {signalPreview.interventions.slice(0, 6).map((signal) => (
                    <CandidateReviewSignalSummaryRow key={signal.key} signal={signal} />
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Top area signals
                </h4>
                <div className="mt-2 grid gap-2">
                  {signalPreview.outcomes.slice(0, 6).map((signal) => (
                    <CandidateReviewOutcomeSignalRow key={signal.outcome} signal={signal} />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-2 lg:grid-cols-2">
              {signalPreview.decisions.slice(0, 4).map((decision) => (
                <CandidateReviewSignalDecisionRow
                  key={decision.dedupeKey}
                  decision={decision}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {pendingBulkAction ? (
        <InlineConfirmation
          busy={Boolean(activeBulkAction)}
          confirmLabel="Apply"
          message={localCandidateBulkConfirmMessage({
            action: pendingBulkAction,
            bucket,
            review
          })}
          onCancel={() => setPendingBulkAction(null)}
          onConfirm={() => recordBulkDecision(pendingBulkAction)}
          tone={pendingBulkAction === "reject-not-useful" ? "danger" : "warn"}
        />
      ) : null}

      <div className="mt-3 grid gap-2">
        {review?.candidates.length ? (
          review.candidates.map((candidate) => (
            <LocalCandidateReviewRow
              key={candidate.dedupeKey}
              actionKey={actionKey}
              candidate={candidate}
              onDecision={recordDecision}
            />
          ))
        ) : (
          <p className="rounded-md border border-line bg-mist p-3 text-sm text-slate-600">
            No candidates match the current filters.
          </p>
        )}
      </div>
    </section>
  );
}

function AcceptedCandidateProcessor() {
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<LocalAcceptedCandidateProcessingStatusResponse | null>(
    null
  );
  const [message, setMessage] = useState("Loading accepted candidate processor status.");
  const [logEntries, setLogEntries] = useState<LocalIngestionLogEntry[]>([]);
  const stopRequestedRef = useRef(false);
  const runIdRef = useRef(0);

  const appendLog = useCallback((entry: Omit<LocalIngestionLogEntry, "id" | "timestamp">) => {
    setLogEntries((current) =>
      [
        {
          ...entry,
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          timestamp: new Date().toISOString()
        },
        ...current
      ].slice(0, 20)
    );
  }, []);

  const refreshStatus = useCallback(async () => {
    const nextStatus = await fetchLocalAcceptedCandidateProcessingStatus();
    setStatus(nextStatus);
    setMessage(localAcceptedProcessorIdleMessage(nextStatus));
    return nextStatus;
  }, []);

  useEffect(() => {
    refreshStatus().catch((error) => {
      setMessage(localIngestionErrorMessage(error));
    });
  }, [refreshStatus]);

  useEffect(() => {
    return () => {
      stopRequestedRef.current = true;
      runIdRef.current += 1;
    };
  }, []);

  const stopProcessing = useCallback(() => {
    stopRequestedRef.current = true;
    setActive(false);
    setMessage("Stopping after the current processing batch finishes.");
    appendLog({
      detail: "The dashboard will not start another accepted-candidate batch.",
      level: "info",
      message: "Stop requested"
    });
  }, [appendLog]);

  const startProcessing = useCallback(async () => {
    if (active || busy) {
      return;
    }

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    stopRequestedRef.current = false;
    setActive(true);
    setBusy(true);
    setMessage("Processing accepted candidates in local batches.");

    try {
      while (!stopRequestedRef.current && runIdRef.current === runId) {
        const batch = await postLocalAcceptedCandidateProcessingRun(25);
        setStatus(batch.status);

        if (batch.processed === 0) {
          setMessage(localAcceptedProcessorIdleMessage(batch.status));
          appendLog({
            detail: "No unprocessed accepted candidates were available.",
            level: "success",
            message: "Accepted candidate queue finished"
          });
          break;
        }

        const linked = batch.results.filter((result) => result.linkedClaim).length;
        const needsClaim = batch.results.filter((result) => !result.claimId).length;
        appendLog({
          detail: `${linked.toLocaleString()} linked to existing claim(s), ${needsClaim.toLocaleString()} need claim/outcome review.`,
          level: batch.errors.length > 0 ? "error" : "success",
          message: `Processed ${batch.processed.toLocaleString()} accepted candidate(s)`
        });
        setMessage(localAcceptedProcessorIdleMessage(batch.status));

        if (!batch.hasMore) {
          appendLog({
            detail: `${batch.status.counts.processed.toLocaleString()} accepted candidate(s) processed.`,
            level: "success",
            message: "Accepted candidate queue finished"
          });
          break;
        }

        await sleep(750);
      }
    } catch (error) {
      const nextMessage = localIngestionErrorMessage(error);
      setMessage(nextMessage);
      appendLog({
        detail: nextMessage,
        level: "error",
        message: "Accepted candidate processing stopped"
      });
    } finally {
      if (runIdRef.current === runId) {
        setActive(false);
        setBusy(false);
        stopRequestedRef.current = false;
        refreshStatus().catch(() => undefined);
      }
    }
  }, [active, appendLog, busy, refreshStatus]);

  return (
    <div className="mt-4 rounded-lg border border-line bg-mist p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink">Accepted candidate processor</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Processes accepted references before the maybe-useful queue: links claim-scoped
            candidates, tags broad candidates with benefit-area suggestions, and leaves claim
            drafting for review.
          </p>
          <p aria-live="polite" className="mt-2 text-xs font-semibold text-slate-700">
            {message}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={startProcessing}
            disabled={active || busy || (status?.counts.unprocessed ?? 0) <= 0}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-signal bg-signal px-3 text-xs font-semibold text-white transition hover:bg-signal/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {active ? (
              <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play aria-hidden="true" className="h-3.5 w-3.5" />
            )}
            {active ? "Processing" : "Process accepted"}
          </button>
          <button
            type="button"
            onClick={stopProcessing}
            disabled={!active}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-signal disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Square aria-hidden="true" className="h-3.5 w-3.5" />
            Stop
          </button>
          <button
            type="button"
            onClick={() => refreshStatus().catch((error) => setMessage(localIngestionErrorMessage(error)))}
            disabled={busy}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-signal disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              aria-hidden="true"
              className={cn("h-3.5 w-3.5", busy && !active ? "animate-spin" : "")}
            />
            Refresh
          </button>
        </div>
      </div>

      <LocalNextActionStrip action={acceptedCandidateProcessingNextAction(status)} />

      <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        <MiniStat label="Accepted" value={(status?.counts.accepted ?? 0).toLocaleString()} />
        <MiniStat label="With reference" value={(status?.counts.acceptedWithReference ?? 0).toLocaleString()} />
        <MiniStat label="Processed" value={(status?.counts.processed ?? 0).toLocaleString()} />
        <MiniStat label="Unprocessed" value={(status?.counts.unprocessed ?? 0).toLocaleString()} />
        <MiniStat label="Needs claim" value={(status?.counts.needsClaim ?? 0).toLocaleString()} />
        <MiniStat label="Claim linked" value={(status?.counts.claimLinked ?? 0).toLocaleString()} />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-lg border border-line bg-white p-3">
          <h4 className="text-sm font-semibold text-ink">Activity</h4>
          <div className="mt-3 grid gap-2">
            {logEntries.length > 0 ? (
              logEntries.slice(0, 5).map((entry) => (
                <LocalIngestionLogRow key={entry.id} entry={entry} />
              ))
            ) : (
              <p className="rounded-md border border-line bg-mist p-3 text-sm text-slate-600">
                No accepted-candidate batches have run in this browser session yet.
              </p>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-line bg-white p-3">
          <h4 className="text-sm font-semibold text-ink">Recently processed</h4>
          <div className="mt-3 grid gap-2">
            {status?.recent.length ? (
              status.recent.slice(0, 5).map((candidate) => (
                <LocalAcceptedProcessingRow
                  key={candidate.dedupeKey}
                  candidate={candidate}
                />
              ))
            ) : (
              <p className="rounded-md border border-line bg-mist p-3 text-sm text-slate-600">
                No accepted candidates have been processed yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LocalAcceptedProcessingRow({
  candidate
}: {
  candidate: LocalAcceptedCandidateProcessingResult;
}) {
  return (
    <div className="rounded-md border border-line bg-mist p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <a
            href={candidate.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-w-0 items-center gap-1 text-sm font-semibold text-signal underline decoration-signal/30 underline-offset-2 hover:decoration-signal"
          >
            <span className="min-w-0 break-words">{candidate.title}</span>
            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          </a>
          <p className="mt-1 text-xs text-slate-600">
            {candidate.interventionName ?? "Unlinked intervention"} -{" "}
            {localIngestionSourceLabel(candidate.source)} {candidate.externalId} -{" "}
            {candidate.sourceTypeSuggestion}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600">{candidate.nextAction}</p>
          {candidate.outcomeLabels.length > 0 ? (
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Suggested areas: {candidate.outcomeLabels.join(", ")}
            </p>
          ) : null}
        </div>
        <span
          className={cn(
            "rounded-md border px-2 py-1 text-xs font-semibold",
            candidate.linkedClaim
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-amberline/25 bg-amber-50 text-amberline"
          )}
        >
          {candidate.linkedClaim ? "claim linked" : "needs claim"}
        </span>
      </div>
    </div>
  );
}

function BenefitDiscoveryQueue() {
  const [busy, setBusy] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [autoBusy, setAutoBusy] = useState<"preview" | "apply" | null>(null);
  const [autoPreview, setAutoPreview] =
    useState<LocalBenefitDiscoveryAutomationResponse | null>(null);
  const [autoScope, setAutoScope] =
    useState<LocalBenefitDiscoveryAutomationScope>("batch");
  const [autoStrategy, setAutoStrategy] =
    useState<LocalBenefitDiscoveryAutomationStrategy>("build-leads");
  const [autoThreshold, setAutoThreshold] = useState(80);
  const [autoRejectThreshold, setAutoRejectThreshold] = useState(40);
  const [queue, setQueue] = useState<LocalBenefitDiscoveryQueueResponse | null>(null);
  const [message, setMessage] = useState("Loading benefit discovery clusters.");
  const [pendingAutoBuild, setPendingAutoBuild] = useState(false);
  const [pendingClusterAction, setPendingClusterAction] = useState<{
    action: LocalBenefitDiscoveryAction;
    cluster: LocalBenefitDiscoveryCluster;
  } | null>(null);

  const loadQueue = useCallback(async () => {
    setBusy(true);

    try {
      const nextQueue = await fetchLocalBenefitDiscoveryQueue();
      setQueue(nextQueue);
      setMessage(localBenefitDiscoveryQueueMessage(nextQueue));
    } catch (error) {
      setMessage(localIngestionErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    loadQueue().catch(() => undefined);
  }, [loadQueue]);

  useEffect(() => {
    setAutoPreview(null);
    setPendingAutoBuild(false);
  }, [autoRejectThreshold, autoScope, autoStrategy, autoThreshold]);

  useEffect(() => {
    setAutoRejectThreshold((current) => Math.min(current, Math.max(0, autoThreshold - 1)));
  }, [autoThreshold]);

  const controlsBusy = busy || Boolean(actionKey) || Boolean(autoBusy);

  const recordAction = useCallback(
    async (cluster: LocalBenefitDiscoveryCluster, action: LocalBenefitDiscoveryAction) => {
      const nextActionKey = `${cluster.clusterKey}:${action}`;
      setActionKey(nextActionKey);
      setMessage(localBenefitDiscoveryActionProgress(action));

      try {
        const result = await postLocalBenefitDiscoveryAction({
          action,
          clusterKey: cluster.clusterKey
        });
        await loadQueue();
        setMessage(result.message);
      } catch (error) {
        setMessage(localIngestionErrorMessage(error));
      } finally {
        setActionKey(null);
        setPendingClusterAction(null);
      }
    },
    [loadQueue]
  );

  const previewAutoBuild = useCallback(async () => {
    setAutoBusy("preview");
    setMessage("Previewing scored benefit-discovery actions.");

    try {
      const result = await postLocalBenefitDiscoveryAutomation({
        apply: false,
        rejectThreshold: autoRejectThreshold,
        scope: autoScope,
        strategy: autoStrategy,
        threshold: autoThreshold
      });
      setAutoPreview(result);
      setMessage(localBenefitDiscoveryAutomationMessage(result));
    } catch (error) {
      setMessage(localIngestionErrorMessage(error));
    } finally {
      setAutoBusy(null);
    }
  }, [autoRejectThreshold, autoScope, autoStrategy, autoThreshold]);

  const applyAutoBuild = useCallback(async () => {
    setAutoBusy("apply");
    setMessage("Applying high-confidence benefit-discovery actions.");

    try {
      const result = await postLocalBenefitDiscoveryAutomation({
        apply: true,
        rejectThreshold: autoRejectThreshold,
        scope: autoScope,
        strategy: autoStrategy,
        threshold: autoThreshold
      });
      setAutoPreview(result);
      await loadQueue();
      setMessage(localBenefitDiscoveryAutomationMessage(result));
    } catch (error) {
      setMessage(localIngestionErrorMessage(error));
    } finally {
      setPendingAutoBuild(false);
      setAutoBusy(null);
    }
  }, [autoRejectThreshold, autoScope, autoStrategy, autoThreshold, loadQueue]);

  return (
    <div className="mt-4 rounded-lg border border-line bg-mist p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink">Benefit discovery queue</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Groups processed accepted candidates by supplement and suggested benefit area. Park
            middle-confidence leads instead of drafting weak heatmap claims.
          </p>
          <p aria-live="polite" className="mt-2 text-xs font-semibold text-slate-700">
            {message}
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadQueue()}
          disabled={controlsBusy}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-signal disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            aria-hidden="true"
            className={cn("h-3.5 w-3.5", busy ? "animate-spin" : "")}
          />
          Refresh
        </button>
      </div>

      <LocalNextActionStrip action={benefitDiscoveryNextAction(queue)} />

      <div className="mt-3 grid gap-2 md:grid-cols-5">
        <MiniStat label="Active clusters" value={(queue?.counts.activeClusters ?? 0).toLocaleString()} />
        <MiniStat label="Active candidates" value={(queue?.counts.activeCandidates ?? 0).toLocaleString()} />
        <MiniStat label="Mismatch flags" value={(queue?.counts.mismatchCandidates ?? 0).toLocaleString()} />
        <MiniStat label="Parked leads" value={(queue?.counts.parkedClusters ?? 0).toLocaleString()} />
        <MiniStat label="Decided clusters" value={(queue?.counts.decidedClusters ?? 0).toLocaleString()} />
      </div>

      <IdentityResolutionQueue onResolved={loadQueue} />

      <div className="mt-3 rounded-md border border-line bg-white p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-ink">Evidence lead score</h4>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Auto-build drafts or links only high-confidence local leads. Middle scores stay in
              the queue.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              Threshold
              <input
                type="range"
                min="55"
                max="95"
                value={autoThreshold}
                onChange={(event) => setAutoThreshold(Number(event.target.value))}
                disabled={controlsBusy}
                className="h-2 w-32 accent-signal"
              />
              <input
                type="number"
                min="55"
                max="95"
                value={autoThreshold}
                onChange={(event) =>
                  setAutoThreshold(Math.min(95, Math.max(55, Number(event.target.value) || 80)))
                }
                disabled={controlsBusy}
                className="h-8 w-16 rounded-md border border-line bg-white px-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
            <div className="inline-flex h-8 overflow-hidden rounded-md border border-line bg-white">
              {(["build-leads", "link-existing", "park-backlog"] as LocalBenefitDiscoveryAutomationStrategy[]).map(
                (strategy) => (
                  <button
                    key={strategy}
                    type="button"
                    onClick={() => setAutoStrategy(strategy)}
                    disabled={controlsBusy}
                    className={cn(
                      "px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                      autoStrategy === strategy
                        ? "bg-signal text-white"
                        : "text-slate-700 hover:bg-mist"
                    )}
                  >
                    {localBenefitDiscoveryAutomationStrategyButtonLabel(strategy)}
                  </button>
                )
              )}
            </div>
            <div className="inline-flex h-8 overflow-hidden rounded-md border border-line bg-white">
              {(["batch", "all-eligible"] as LocalBenefitDiscoveryAutomationScope[]).map(
                (scope) => (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => setAutoScope(scope)}
                    disabled={controlsBusy}
                    className={cn(
                      "px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                      autoScope === scope
                        ? "bg-ink text-white"
                        : "text-slate-700 hover:bg-mist"
                    )}
                  >
                    {scope === "batch" ? "Batch" : "All eligible"}
                  </button>
                )
              )}
            </div>
            <button
              type="button"
              onClick={() => previewAutoBuild()}
              disabled={controlsBusy || !queue?.clusters.length}
              className="inline-flex h-8 items-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-signal disabled:cursor-not-allowed disabled:opacity-60"
            >
              {autoBusy === "preview" ? (
                <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search aria-hidden="true" className="h-3.5 w-3.5" />
              )}
              Preview
            </button>
            <button
              type="button"
              onClick={() => setPendingAutoBuild(true)}
              disabled={controlsBusy || !queue?.clusters.length}
              className="inline-flex h-8 items-center gap-2 rounded-md border border-signal bg-signal px-3 text-xs font-semibold text-white transition hover:bg-signal/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {autoBusy === "apply" ? (
                <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play aria-hidden="true" className="h-3.5 w-3.5" />
              )}
              Apply automation
            </button>
          </div>
        </div>

        {autoStrategy === "park-backlog" ? (
          <div className="mt-3 grid gap-2 rounded-md border border-amberline/25 bg-amber-50/50 p-2 lg:grid-cols-[1fr_auto] lg:items-center">
            <label className="flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-700">
              <span className="w-24 shrink-0">Reject below</span>
              <input
                type="range"
                min="0"
                max={Math.max(0, autoThreshold - 1)}
                value={autoRejectThreshold}
                onChange={(event) =>
                  setAutoRejectThreshold(
                    Math.min(
                      Math.max(0, autoThreshold - 1),
                      Math.max(0, Number(event.target.value) || 0)
                    )
                  )
                }
                disabled={controlsBusy}
                className="h-2 min-w-0 flex-1 accent-danger"
              />
              <input
                type="number"
                min="0"
                max={Math.max(0, autoThreshold - 1)}
                value={autoRejectThreshold}
                onChange={(event) =>
                  setAutoRejectThreshold(
                    Math.min(
                      Math.max(0, autoThreshold - 1),
                      Math.max(0, Number(event.target.value) || 0)
                    )
                  )
                }
                disabled={controlsBusy}
                className="h-8 w-16 rounded-md border border-line bg-white px-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
            <span className="rounded-md border border-amberline/25 bg-white px-2 py-1 text-xs font-semibold text-amberline">
              Park {autoRejectThreshold}-{Math.max(0, autoThreshold - 1)}
            </span>
          </div>
        ) : null}

        {pendingAutoBuild ? (
          <InlineConfirmation
            busy={autoBusy === "apply"}
            confirmLabel="Apply"
            message={localBenefitDiscoveryAutomationConfirmMessage(
              autoPreview,
              autoRejectThreshold,
              autoScope,
              autoStrategy,
              autoThreshold
            )}
            onCancel={() => setPendingAutoBuild(false)}
            onConfirm={() => applyAutoBuild()}
            tone="warn"
          />
        ) : null}

        {autoPreview ? (
          <div className="mt-3 grid gap-3">
            <div className="grid gap-2 md:grid-cols-7">
              <MiniStat
                label="Scanned"
                value={autoPreview.counts.scannedClusters.toLocaleString()}
              />
              <MiniStat label="Draft" value={autoPreview.counts.draftClaims.toLocaleString()} />
              <MiniStat
                label="Link existing"
                value={autoPreview.counts.linkExistingClaims.toLocaleString()}
              />
              <MiniStat label="Park" value={autoPreview.counts.parkLeadClusters.toLocaleString()} />
              <MiniStat label="Hold" value={autoPreview.counts.holdClusters.toLocaleString()} />
              <MiniStat
                label="Reject"
                value={autoPreview.counts.rejectClusters.toLocaleString()}
              />
              <MiniStat
                label="References"
                value={autoPreview.applied
                  ? autoPreview.counts.linkedReferences.toLocaleString()
                  : "preview"}
              />
            </div>
            <div className="grid gap-2 lg:grid-cols-2">
              {autoPreview.decisions.slice(0, 6).map((decision) => (
                <BenefitDiscoveryAutomationDecisionRow
                  key={decision.clusterKey}
                  decision={decision}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {pendingClusterAction ? (
        <InlineConfirmation
          busy={Boolean(actionKey)}
          confirmLabel="Apply"
          message={localBenefitDiscoveryConfirmMessage(
            pendingClusterAction.cluster,
            pendingClusterAction.action
          )}
          onCancel={() => setPendingClusterAction(null)}
          onConfirm={() =>
            recordAction(pendingClusterAction.cluster, pendingClusterAction.action)
          }
          tone={pendingClusterAction.action === "reject-cluster" ? "danger" : "warn"}
        />
      ) : null}

      <div className="mt-3 grid gap-3">
        {queue?.clusters.length ? (
          queue.clusters.map((cluster) => (
            <BenefitDiscoveryClusterCard
              key={cluster.clusterKey}
              actionKey={actionKey}
              cluster={cluster}
              onAction={(nextCluster, nextAction) =>
                setPendingClusterAction({
                  action: nextAction,
                  cluster: nextCluster
                })
              }
            />
          ))
        ) : (
          <p className="rounded-md border border-line bg-white p-3 text-sm text-slate-600">
            No active benefit discovery clusters are ready. Process accepted candidates first, or
            move on to the maybe-useful queue.
          </p>
        )}
      </div>
    </div>
  );
}

function IdentityResolutionQueue({ onResolved }: { onResolved: () => Promise<void> }) {
  const [queue, setQueue] = useState<LocalIdentityResolutionQueueResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [autoBusy, setAutoBusy] = useState<"preview" | "apply" | null>(null);
  const [autoPreview, setAutoPreview] =
    useState<LocalIdentityResolutionAutomationResponse | null>(null);
  const [autoScope, setAutoScope] =
    useState<LocalIdentityResolutionAutomationScope>("all-eligible");
  const [autoStrategy, setAutoStrategy] =
    useState<LocalIdentityResolutionAutomationStrategy>("source-led");
  const [message, setMessage] = useState("Loading identity resolver.");
  const [pendingAutoResolve, setPendingAutoResolve] = useState(false);
  const [reassignTargets, setReassignTargets] = useState<Record<string, string>>({});
  const [synonyms, setSynonyms] = useState<Record<string, string>>({});
  const [pendingIdentityAction, setPendingIdentityAction] = useState<{
    action: LocalIdentityResolutionAction;
    candidate: LocalIdentityResolutionCandidate;
    input: {
      action: LocalIdentityResolutionAction;
      dedupeKey: string;
      interventionId?: string;
      synonym?: string;
    };
  } | null>(null);

  const loadQueue = useCallback(async () => {
    setBusy(true);

    try {
      const nextQueue = await fetchLocalIdentityResolutionQueue();
      setQueue(nextQueue);
      setMessage(localIdentityResolutionQueueMessage(nextQueue));
    } catch (error) {
      setMessage(localIngestionErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    loadQueue().catch(() => undefined);
  }, [loadQueue]);

  useEffect(() => {
    setAutoPreview(null);
    setPendingAutoResolve(false);
  }, [autoScope, autoStrategy]);

  const controlsBusy = busy || Boolean(actionKey) || Boolean(autoBusy);

  const requestAction = useCallback(
    (
      candidate: LocalIdentityResolutionCandidate,
      action: LocalIdentityResolutionAction
    ) => {
      const input: {
        action: LocalIdentityResolutionAction;
        dedupeKey: string;
        interventionId?: string;
        synonym?: string;
      } = {
        action,
        dedupeKey: candidate.dedupeKey
      };

      if (action === "reassign-intervention") {
        input.interventionId =
          reassignTargets[candidate.dedupeKey] ?? candidate.matchedInterventions[0]?.id;

        if (!input.interventionId) {
          setMessage("Choose a target supplement before reassigning.");
          return;
        }
      }

      if (action === "add-synonym") {
        input.synonym = synonyms[candidate.dedupeKey]?.trim();

        if (!input.synonym) {
          setMessage("Enter an alias before adding it.");
          return;
        }
      }

      setPendingIdentityAction({
        action,
        candidate,
        input
      });
    },
    [reassignTargets, synonyms]
  );

  const recordAction = useCallback(
    async ({
      action,
      candidate,
      input
    }: {
      action: LocalIdentityResolutionAction;
      candidate: LocalIdentityResolutionCandidate;
      input: {
        action: LocalIdentityResolutionAction;
        dedupeKey: string;
        interventionId?: string;
        synonym?: string;
      };
    }) => {
      setActionKey(`${candidate.dedupeKey}:${action}`);
      setMessage(localIdentityResolutionProgressMessage(action));

      try {
        const result = await postLocalIdentityResolutionAction(input);
        setMessage(result.message);
        await loadQueue();
        await onResolved();
      } catch (error) {
        setMessage(localIngestionErrorMessage(error));
      } finally {
        setActionKey(null);
        setPendingIdentityAction(null);
      }
    },
    [loadQueue, onResolved]
  );

  const previewAutoResolve = useCallback(async () => {
    setAutoBusy("preview");
    setMessage("Previewing identity auto-resolution.");

    try {
      const result = await postLocalIdentityResolutionAutomation({
        apply: false,
        scope: autoScope,
        strategy: autoStrategy
      });
      setAutoPreview(result);
      setMessage(localIdentityResolutionAutomationMessage(result));
    } catch (error) {
      setMessage(localIngestionErrorMessage(error));
    } finally {
      setAutoBusy(null);
    }
  }, [autoScope, autoStrategy]);

  const applyAutoResolve = useCallback(async () => {
    setAutoBusy("apply");
    setMessage("Applying identity auto-resolution.");

    try {
      const result = await postLocalIdentityResolutionAutomation({
        apply: true,
        scope: autoScope,
        strategy: autoStrategy
      });
      setAutoPreview(result);
      await loadQueue();
      await onResolved();
      setMessage(localIdentityResolutionAutomationMessage(result));
    } catch (error) {
      setMessage(localIngestionErrorMessage(error));
    } finally {
      setPendingAutoResolve(false);
      setAutoBusy(null);
    }
  }, [autoScope, autoStrategy, loadQueue, onResolved]);

  return (
    <div className="mt-3 rounded-md border border-line bg-white p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-ink">Identity resolver</h4>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Clears blocked source identity rows before auto-build. Multi-supplement matches are
            warnings when the target is visible.
          </p>
          <p aria-live="polite" className="mt-2 text-xs font-semibold text-slate-700">
            {message}
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadQueue()}
          disabled={controlsBusy}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-signal disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            aria-hidden="true"
            className={cn("h-3.5 w-3.5", busy ? "animate-spin" : "")}
          />
          Refresh
        </button>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <MiniStat
          label="Blocked identity rows"
          value={(queue?.counts.blockedCandidates ?? 0).toLocaleString()}
        />
        <MiniStat label="Shown" value={(queue?.candidates.length ?? 0).toLocaleString()} />
      </div>

      <LocalNextActionStrip action={identityResolutionNextAction(queue)} />

      <div className="mt-3 border-t border-line pt-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <h5 className="text-sm font-semibold text-ink">Auto-resolve</h5>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Exact query matches can be confirmed; competing supplement matches stay held or
              routed.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex h-8 overflow-hidden rounded-md border border-line bg-white">
              {(["strict", "source-led"] as LocalIdentityResolutionAutomationStrategy[]).map(
                (strategy) => (
                  <button
                    key={strategy}
                    type="button"
                    onClick={() => setAutoStrategy(strategy)}
                    disabled={controlsBusy}
                    className={cn(
                      "px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                      autoStrategy === strategy
                        ? "bg-signal text-white"
                        : "text-slate-700 hover:bg-mist"
                    )}
                  >
                    {strategy === "strict" ? "Strict" : "Source-led"}
                  </button>
                )
              )}
            </div>
            <div className="inline-flex h-8 overflow-hidden rounded-md border border-line bg-white">
              {(["batch", "all-eligible"] as LocalIdentityResolutionAutomationScope[]).map(
                (scope) => (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => setAutoScope(scope)}
                    disabled={controlsBusy}
                    className={cn(
                      "px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                      autoScope === scope
                        ? "bg-ink text-white"
                        : "text-slate-700 hover:bg-mist"
                    )}
                  >
                    {scope === "batch" ? "Batch" : "All eligible"}
                  </button>
                )
              )}
            </div>
            <button
              type="button"
              onClick={() => previewAutoResolve()}
              disabled={controlsBusy || !queue?.counts.blockedCandidates}
              className="inline-flex h-8 items-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-signal disabled:cursor-not-allowed disabled:opacity-60"
            >
              {autoBusy === "preview" ? (
                <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search aria-hidden="true" className="h-3.5 w-3.5" />
              )}
              Preview
            </button>
            <button
              type="button"
              onClick={() => setPendingAutoResolve(true)}
              disabled={controlsBusy || !queue?.counts.blockedCandidates}
              className="inline-flex h-8 items-center gap-2 rounded-md border border-signal bg-signal px-3 text-xs font-semibold text-white transition hover:bg-signal/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {autoBusy === "apply" ? (
                <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play aria-hidden="true" className="h-3.5 w-3.5" />
              )}
              Apply auto-resolve
            </button>
          </div>
        </div>

        {pendingAutoResolve ? (
          <InlineConfirmation
            busy={autoBusy === "apply"}
            confirmLabel="Apply"
            message={localIdentityResolutionAutomationConfirmMessage(
              autoPreview,
              autoStrategy,
              autoScope
            )}
            onCancel={() => setPendingAutoResolve(false)}
            onConfirm={() => applyAutoResolve()}
            tone="warn"
          />
        ) : null}

        {autoPreview ? (
          <div className="mt-3 grid gap-3">
            <div className="grid gap-2 md:grid-cols-6">
              <MiniStat
                label="Scanned"
                value={autoPreview.counts.scannedCandidates.toLocaleString()}
              />
              <MiniStat
                label="Confirm"
                value={autoPreview.counts.confirmTarget.toLocaleString()}
              />
              <MiniStat
                label="Reassign"
                value={autoPreview.counts.reassignIntervention.toLocaleString()}
              />
              <MiniStat
                label="Reject"
                value={autoPreview.counts.rejectWrongSupplement.toLocaleString()}
              />
              <MiniStat label="Hold" value={autoPreview.counts.hold.toLocaleString()} />
              <MiniStat
                label="Applied"
                value={
                  autoPreview.applied
                    ? autoPreview.counts.appliedActions.toLocaleString()
                    : "preview"
                }
              />
            </div>
            <div className="grid gap-2 lg:grid-cols-2">
              {autoPreview.decisions.slice(0, 6).map((decision) => (
                <IdentityResolutionAutomationDecisionRow
                  key={decision.dedupeKey}
                  decision={decision}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {pendingIdentityAction ? (
        <InlineConfirmation
          busy={Boolean(actionKey)}
          confirmLabel="Apply"
          message={localIdentityResolutionConfirmMessage(
            pendingIdentityAction.candidate,
            pendingIdentityAction.action
          )}
          onCancel={() => setPendingIdentityAction(null)}
          onConfirm={() => recordAction(pendingIdentityAction)}
          tone={
            pendingIdentityAction.action === "reject-wrong-supplement"
              ? "danger"
              : "warn"
          }
        />
      ) : null}

      <div className="mt-3 grid gap-2">
        {queue?.candidates.length ? (
          queue.candidates.map((candidate) => (
            <IdentityResolutionCandidateRow
              key={candidate.dedupeKey}
              actionKey={actionKey}
              candidate={candidate}
              interventions={queue.interventions}
              onAction={requestAction}
              onSynonymChange={(value) =>
                setSynonyms((current) => ({
                  ...current,
                  [candidate.dedupeKey]: value
                }))
              }
              onTargetChange={(value) =>
                setReassignTargets((current) => ({
                  ...current,
                  [candidate.dedupeKey]: value
                }))
              }
              synonym={synonyms[candidate.dedupeKey] ?? ""}
              targetInterventionId={
                reassignTargets[candidate.dedupeKey] ??
                candidate.matchedInterventions[0]?.id ??
                ""
              }
            />
          ))
        ) : (
          <p className="rounded-md border border-line bg-mist p-3 text-sm text-slate-600">
            No blocked identity rows are waiting.
          </p>
        )}
      </div>
    </div>
  );
}

function IdentityResolutionCandidateRow({
  actionKey,
  candidate,
  interventions,
  onAction,
  onSynonymChange,
  onTargetChange,
  synonym,
  targetInterventionId
}: {
  actionKey: string | null;
  candidate: LocalIdentityResolutionCandidate;
  interventions: LocalIdentityResolutionQueueResponse["interventions"];
  onAction: (
    candidate: LocalIdentityResolutionCandidate,
    action: LocalIdentityResolutionAction
  ) => void;
  onSynonymChange: (value: string) => void;
  onTargetChange: (value: string) => void;
  synonym: string;
  targetInterventionId: string;
}) {
  const busy = actionKey?.startsWith(`${candidate.dedupeKey}:`) ?? false;

  return (
    <div className="rounded-md border border-line bg-mist p-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-slate-700">
              {candidate.interventionName}
            </span>
            <span className="rounded-md border border-danger/20 bg-red-50 px-2 py-1 text-xs font-semibold text-danger">
              check identity
            </span>
          </div>
          <a
            href={candidate.url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex min-w-0 items-center gap-1 text-sm font-semibold text-signal underline decoration-signal/30 underline-offset-2 hover:decoration-signal"
          >
            <span className="min-w-0 break-words">{candidate.title}</span>
            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          </a>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {localIngestionSourceLabel(candidate.source)} {candidate.externalId}
            {candidate.publishedYear ? ` - ${candidate.publishedYear}` : ""} -{" "}
            {candidate.sourceTypeSuggestion} - triage {candidate.triageScore}
          </p>
          <p className="mt-1 break-words text-xs leading-5 text-slate-500">
            Query: {candidate.query}
          </p>
          <p className="mt-2 text-xs leading-5 text-danger">
            {candidate.mismatchReasons.join(" ")}
          </p>
          {candidate.matchedInterventions.length > 0 ? (
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Possible match: {candidate.matchedInterventions.map((item) => item.name).join(", ")}
            </p>
          ) : null}
        </div>

        <div className="grid shrink-0 gap-2 sm:min-w-80">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onAction(candidate, "confirm-target")}
              disabled={busy}
              className="inline-flex h-8 items-center gap-2 rounded-md border border-green-600 bg-green-600 px-3 text-xs font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionKey === `${candidate.dedupeKey}:confirm-target` ? (
                <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check aria-hidden="true" className="h-3.5 w-3.5" />
              )}
              Confirm
            </button>
            <button
              type="button"
              onClick={() => onAction(candidate, "reject-wrong-supplement")}
              disabled={busy}
              className="inline-flex h-8 items-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionKey === `${candidate.dedupeKey}:reject-wrong-supplement` ? (
                <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              )}
              Reject wrong
            </button>
          </div>

          <div className="flex gap-2">
            <select
              value={targetInterventionId}
              onChange={(event) => onTargetChange(event.target.value)}
              disabled={busy}
              className="h-8 min-w-0 flex-1 rounded-md border border-line bg-white px-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">Choose supplement</option>
              {interventions.map((intervention) => (
                <option key={intervention.id} value={intervention.id}>
                  {intervention.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onAction(candidate, "reassign-intervention")}
              disabled={busy}
              className="inline-flex h-8 items-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-signal disabled:cursor-not-allowed disabled:opacity-60"
            >
              Reassign
            </button>
          </div>

          <div className="flex gap-2">
            <input
              value={synonym}
              onChange={(event) => onSynonymChange(event.target.value)}
              disabled={busy}
              placeholder="Alias for current supplement"
              className="h-8 min-w-0 flex-1 rounded-md border border-line bg-white px-2 text-xs text-slate-700 outline-none ring-signal/20 transition focus:border-signal focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => onAction(candidate, "add-synonym")}
              disabled={busy}
              className="inline-flex h-8 items-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-signal disabled:cursor-not-allowed disabled:opacity-60"
            >
              Add alias
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function IdentityResolutionAutomationDecisionRow({
  decision
}: {
  decision: LocalIdentityResolutionAutomationDecision;
}) {
  return (
    <div className="rounded-md border border-line bg-mist p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{decision.interventionName}</p>
          <p className="mt-1 break-words text-xs leading-5 text-slate-600">
            {localIngestionSourceLabel(decision.source)} {decision.externalId} - Query:{" "}
            {decision.query}
          </p>
        </div>
        <span
          className={cn(
            "rounded-md border px-2 py-1 text-xs font-semibold",
            localIdentityResolutionAutomationTone(decision.action)
          )}
        >
          {localIdentityResolutionAutomationActionLabel(decision.action)}
        </span>
      </div>
      <p className="mt-2 break-words text-xs font-semibold text-signal">{decision.title}</p>
      <p className="mt-2 text-xs leading-5 text-slate-600">
        {decision.reasons.join(" ")}
      </p>
      {decision.matchedInterventionName ? (
        <p className="mt-1 text-xs leading-5 text-slate-600">
          Target: {decision.matchedInterventionName}
        </p>
      ) : null}
      {decision.error ? (
        <p className="mt-2 text-xs leading-5 text-danger">{decision.error}</p>
      ) : null}
      {decision.applied ? (
        <p className="mt-2 text-xs font-semibold text-green-700">Applied.</p>
      ) : null}
    </div>
  );
}

function BenefitDiscoveryAutomationDecisionRow({
  decision
}: {
  decision: LocalBenefitDiscoveryAutomationDecision;
}) {
  return (
    <div className="rounded-md border border-line bg-mist p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">
            {decision.interventionName} - {decision.outcomeLabel}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Score {decision.leadScore}. {decision.usableCandidateCount.toLocaleString()} usable /{" "}
            {decision.candidateCount.toLocaleString()} candidate(s).
          </p>
        </div>
        <span
          className={cn(
            "rounded-md border px-2 py-1 text-xs font-semibold",
            localBenefitDiscoveryAutomationTone(decision.action)
          )}
        >
          {localBenefitDiscoveryAutomationActionLabel(decision.action)}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-600">
        {decision.leadReasons.join(" ")}
      </p>
      {decision.error ? (
        <p className="mt-2 text-xs leading-5 text-danger">{decision.error}</p>
      ) : null}
      {decision.applied ? (
        <p className="mt-2 text-xs font-semibold text-green-700">
          Applied
          {decision.claimId ? (
            <>
              {" to claim "}
              <span className="break-all font-mono text-[11px] text-green-800">
                {decision.claimId}
              </span>
            </>
          ) : null}
          {decision.linkedReferences > 0
            ? `, ${decision.linkedReferences.toLocaleString()} reference(s) linked`
            : ""}
          .
        </p>
      ) : null}
    </div>
  );
}

function BenefitDiscoveryClusterCard({
  actionKey,
  cluster,
  onAction
}: {
  actionKey: string | null;
  cluster: LocalBenefitDiscoveryCluster;
  onAction: (
    cluster: LocalBenefitDiscoveryCluster,
    action: LocalBenefitDiscoveryAction
  ) => void;
}) {
  const busy = actionKey?.startsWith(`${cluster.clusterKey}:`) ?? false;
  const hasExistingClaim = cluster.existingClaims.length > 0;
  const hasUsableCandidates = cluster.usableCandidateCount > 0;

  return (
    <div className="rounded-lg border border-line bg-white p-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-ink">
              {cluster.interventionName} - {cluster.outcomeLabel}
            </h4>
            <span className="rounded-md border border-line bg-mist px-2 py-1 text-xs font-semibold text-slate-700">
              lead {cluster.score}
            </span>
            {cluster.existingClaims.length > 0 ? (
              <span className="rounded-md border border-green-200 bg-green-50 px-2 py-1 text-xs font-semibold text-green-700">
                existing claim
              </span>
            ) : (
              <span className="rounded-md border border-amberline/25 bg-amber-50 px-2 py-1 text-xs font-semibold text-amberline">
                novel area
              </span>
            )}
            {cluster.mismatchCount > 0 ? (
              <span className="rounded-md border border-danger/20 bg-red-50 px-2 py-1 text-xs font-semibold text-danger">
                {cluster.mismatchCount.toLocaleString()} mismatch flag(s)
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-600">
            {cluster.candidateCount.toLocaleString()} candidate(s),{" "}
            {cluster.usableCandidateCount.toLocaleString()} usable after mismatch flags.
            {hasExistingClaim
              ? ` Existing: ${cluster.existingClaims[0]?.claimText}`
              : " No existing claim for this supplement/area yet."}
          </p>
          {cluster.leadReasons.length > 0 ? (
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {cluster.leadReasons.join(" ")}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onAction(cluster, "draft-claim")}
            disabled={busy || !hasUsableCandidates}
            className="inline-flex h-8 items-center gap-2 rounded-md border border-signal bg-signal px-3 text-xs font-semibold text-white transition hover:bg-signal/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {actionKey === `${cluster.clusterKey}:draft-claim` ? (
              <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ClipboardCheck aria-hidden="true" className="h-3.5 w-3.5" />
            )}
            Draft claim
          </button>
          <button
            type="button"
            onClick={() => onAction(cluster, "link-existing-claim")}
            disabled={busy || !hasExistingClaim || !hasUsableCandidates}
            className="inline-flex h-8 items-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-signal disabled:cursor-not-allowed disabled:opacity-60"
          >
            {actionKey === `${cluster.clusterKey}:link-existing-claim` ? (
              <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check aria-hidden="true" className="h-3.5 w-3.5" />
            )}
            Link existing
          </button>
          <button
            type="button"
            onClick={() => onAction(cluster, "park-lead")}
            disabled={busy}
            className="inline-flex h-8 items-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-amberline hover:text-amberline disabled:cursor-not-allowed disabled:opacity-60"
          >
            {actionKey === `${cluster.clusterKey}:park-lead` ? (
              <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Bookmark aria-hidden="true" className="h-3.5 w-3.5" />
            )}
            Park lead
          </button>
          <button
            type="button"
            onClick={() => onAction(cluster, "reject-cluster")}
            disabled={busy}
            className="inline-flex h-8 items-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-60"
          >
            {actionKey === `${cluster.clusterKey}:reject-cluster` ? (
              <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <X aria-hidden="true" className="h-3.5 w-3.5" />
            )}
            Reject cluster
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        {cluster.topSources.map((source) => (
          <BenefitDiscoverySourceRow
            key={source.dedupeKey}
            source={source}
          />
        ))}
      </div>
    </div>
  );
}

function BenefitDiscoverySourceRow({ source }: { source: LocalBenefitDiscoverySource }) {
  return (
    <div className="rounded-md border border-line bg-mist p-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-w-0 items-center gap-1 text-sm font-semibold text-signal underline decoration-signal/30 underline-offset-2 hover:decoration-signal"
          >
            <span className="min-w-0 break-words">{source.title}</span>
            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          </a>
          <p className="mt-1 text-xs text-slate-600">
            {localIngestionSourceLabel(source.source)} {source.externalId}
            {source.publishedYear ? ` - ${source.publishedYear}` : ""} -{" "}
            {source.sourceTypeSuggestion} - triage {source.triageScore}
          </p>
          {source.mismatchReasons.length > 0 ? (
            <p className="mt-1 text-xs leading-5 text-danger">
              {source.mismatchReasons.join(" ")}
            </p>
          ) : null}
          {source.identityCautions.length > 0 ? (
            <p className="mt-1 text-xs leading-5 text-amberline">
              {source.identityCautions.join(" ")}
            </p>
          ) : null}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-md border px-2 py-1 text-xs font-semibold",
            source.mismatchReasons.length > 0
              ? "border-danger/20 bg-red-50 text-danger"
              : source.identityCautions.length > 0
                ? "border-amberline/25 bg-amber-50 text-amberline"
              : "border-green-200 bg-green-50 text-green-700"
          )}
        >
          {source.mismatchReasons.length > 0
            ? "check identity"
            : source.identityCautions.length > 0
              ? "caution"
              : "usable"}
        </span>
      </div>
    </div>
  );
}

function LocalIngestionLogRow({ entry }: { entry: LocalIngestionLogEntry }) {
  return (
    <div className="rounded-md border border-line bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          className={cn(
            "text-sm font-semibold",
            entry.level === "error" ? "text-danger" : entry.level === "success" ? "text-signal" : "text-ink"
          )}
        >
          {entry.message}
        </p>
        <span className="text-xs text-slate-500">{formatLocalIngestionTime(entry.timestamp)}</span>
      </div>
      {entry.detail ? (
        <p className="mt-1 break-words text-xs leading-5 text-slate-600">{entry.detail}</p>
      ) : null}
    </div>
  );
}

function LocalIngestionJobRow({ job }: { job: LocalIngestionJobReadout }) {
  return (
    <div className="rounded-md border border-line bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">
            {localIngestionSourceLabel(job.source)} - {job.recordsFound.toLocaleString()} found,{" "}
            {job.recordsChanged.toLocaleString()} saved
          </p>
          <p className="mt-1 break-words text-xs leading-5 text-slate-600">{job.query}</p>
        </div>
        <span
          className={cn(
            "rounded-md border px-2 py-1 text-xs font-semibold",
            localIngestionStatusTone(job.status)
          )}
        >
          {localIngestionStatusLabel(job.status)}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-500">Updated {formatLocalIngestionTime(job.updatedAt)}</p>
      {job.error ? <p className="mt-1 text-xs text-danger">{job.error}</p> : null}
    </div>
  );
}

function LocalIngestionCandidateRow({
  candidate
}: {
  candidate: LocalIngestionCandidateReadout;
}) {
  const classification = candidate.discoveryClassification;

  return (
    <div className="rounded-md border border-line bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <a
            href={candidate.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-w-0 items-center gap-1 text-sm font-semibold text-signal underline decoration-signal/30 underline-offset-2 hover:decoration-signal"
          >
            <span className="truncate">{candidate.title}</span>
            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          </a>
          <p className="mt-1 text-xs text-slate-600">
            {localIngestionSourceLabel(candidate.source)} {candidate.externalId}
            {candidate.publishedYear ? ` - ${candidate.publishedYear}` : ""} - triage{" "}
            {candidate.triageScore}
          </p>
          <p className="mt-1 break-words text-xs leading-5 text-slate-500">{candidate.query}</p>
          {classification ? (
            <p className="mt-2 text-xs leading-5 text-slate-600">
              <span className="font-semibold text-slate-700">Classifier:</span>{" "}
              {localIngestionClassificationSummary(classification)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1">
          {classification ? (
            <span
              className={cn(
                "rounded-md border px-2 py-1 text-xs font-semibold",
                localIngestionClassificationTone(classification.bucket)
              )}
            >
              {classification.label} {classification.score}
            </span>
          ) : null}
          <span className="rounded-md border border-line bg-mist px-2 py-1 text-xs font-semibold text-slate-700">
            {candidate.decision.replace(/_/g, " ").toLowerCase()}
          </span>
        </div>
      </div>
    </div>
  );
}

function LocalCandidateReviewRow({
  actionKey,
  candidate,
  onDecision
}: {
  actionKey: string | null;
  candidate: LocalCandidateReviewCandidate;
  onDecision: (
    candidate: LocalCandidateReviewCandidate,
    decision: "Accepted" | "Rejected"
  ) => Promise<void>;
}) {
  const classification = candidate.discoveryClassification;
  const acceptKey = `${candidate.dedupeKey}:Accepted`;
  const rejectKey = `${candidate.dedupeKey}:Rejected`;
  const accepting = actionKey === acceptKey;
  const rejecting = actionKey === rejectKey;
  const actionDisabled = Boolean(actionKey);

  return (
    <div className="rounded-md border border-line bg-mist p-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-slate-700">
              {candidate.interventionName ?? candidate.interventionId ?? "Unlinked intervention"}
            </span>
            {classification ? (
              <span
                className={cn(
                  "rounded-md border px-2 py-1 text-xs font-semibold",
                  localIngestionClassificationTone(classification.bucket)
                )}
              >
                {classification.label} {classification.score}
              </span>
            ) : (
              <span className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-slate-600">
                Unclassified
              </span>
            )}
          </div>
          <a
            href={candidate.url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex min-w-0 items-center gap-1 text-sm font-semibold text-signal underline decoration-signal/30 underline-offset-2 hover:decoration-signal"
          >
            <span className="min-w-0 break-words">{candidate.title}</span>
            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          </a>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {localIngestionSourceLabel(candidate.source)} {candidate.externalId}
            {candidate.publishedYear ? ` - ${candidate.publishedYear}` : ""}
            {candidate.sourceType ? ` - ${candidate.sourceType}` : ""} - triage{" "}
            {candidate.triageScore}
          </p>
          <p className="mt-1 break-words text-xs leading-5 text-slate-500">{candidate.query}</p>
          {classification ? (
            <p className="mt-2 text-xs leading-5 text-slate-600">
              <span className="font-semibold text-slate-700">Why shown:</span>{" "}
              {localIngestionClassificationSummary(classification)}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 xl:justify-end">
          <button
            type="button"
            onClick={() => onDecision(candidate, "Accepted")}
            disabled={actionDisabled}
            className="inline-flex h-8 items-center gap-2 rounded-md border border-green-600 bg-green-600 px-3 text-xs font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {accepting ? (
              <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check aria-hidden="true" className="h-3.5 w-3.5" />
            )}
            Accept
          </button>
          <button
            type="button"
            onClick={() => onDecision(candidate, "Rejected")}
            disabled={actionDisabled}
            className="inline-flex h-8 items-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-60"
          >
            {rejecting ? (
              <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <X aria-hidden="true" className="h-3.5 w-3.5" />
            )}
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

function CandidateReviewAutomationDecisionRow({
  decision
}: {
  decision: LocalCandidateReviewAutomationDecision;
}) {
  return (
    <div className="rounded-md border border-line bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{decision.interventionName ?? "Unlinked intervention"}</p>
          <p className="mt-1 break-words text-xs font-semibold text-signal">
            {decision.title}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {localIngestionSourceLabel(decision.source)} {decision.externalId} -{" "}
            {decision.sourceTypeSuggestion} - triage {decision.triageScore}
            {decision.classificationScore !== undefined
              ? ` - classifier ${decision.classificationScore}`
              : ""}
          </p>
        </div>
        <span
          className={cn(
            "rounded-md border px-2 py-1 text-xs font-semibold",
            localCandidateReviewAutomationTone(decision.action)
          )}
        >
          {localCandidateReviewAutomationActionLabel(decision.action)}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-600">
        {decision.reasons.join(" ")}
      </p>
      {decision.error ? (
        <p className="mt-2 text-xs leading-5 text-danger">{decision.error}</p>
      ) : null}
      {decision.applied ? (
        <p className="mt-2 text-xs font-semibold text-green-700">Applied.</p>
      ) : null}
    </div>
  );
}

function CandidateReviewSignalSummaryRow({
  signal
}: {
  signal: LocalCandidateReviewSignalSummary;
}) {
  return (
    <div className="rounded-md border border-line bg-mist p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{signal.label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {signal.count.toLocaleString()} held row(s), avg score {signal.averageScore}.
          </p>
        </div>
        <span className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-slate-700">
          {signal.priorityStudyCount.toLocaleString()} priority
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-600">
        Query-backed {signal.queryBackedCount.toLocaleString()} / visible identity{" "}
        {signal.identityVisibleCount.toLocaleString()} / mismatch{" "}
        {signal.sourcePointsElsewhereCount.toLocaleString()} / low signal{" "}
        {signal.lowScoreCount.toLocaleString()}.
      </p>
      {signal.topOutcomes.length > 0 ? (
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Areas:{" "}
          {signal.topOutcomes
            .map((outcome) => `${outcome.label} ${outcome.count}`)
            .join(", ")}
        </p>
      ) : null}
      <CandidateReviewSignalSamples samples={signal.samples} />
    </div>
  );
}

function CandidateReviewOutcomeSignalRow({
  signal
}: {
  signal: LocalCandidateReviewOutcomeSignal;
}) {
  return (
    <div className="rounded-md border border-line bg-mist p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{signal.label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {signal.count.toLocaleString()} held row(s) across{" "}
            {signal.interventionCount.toLocaleString()} intervention(s).
          </p>
        </div>
      </div>
      <CandidateReviewSignalSamples samples={signal.samples} />
    </div>
  );
}

function CandidateReviewSignalDecisionRow({
  decision
}: {
  decision: LocalCandidateReviewSignalDecision;
}) {
  return (
    <div className="rounded-md border border-line bg-mist p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">
            {decision.interventionName ?? "Unlinked intervention"}
          </p>
          <p className="mt-1 break-words text-xs font-semibold text-signal">
            {decision.title}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {localIngestionSourceLabel(decision.source)} {decision.externalId} -{" "}
            {decision.sourceTypeSuggestion} - triage {decision.triageScore}
          </p>
        </div>
        <span
          className={cn(
            "rounded-md border px-2 py-1 text-xs font-semibold",
            localCandidateReviewSignalTone(decision.kind)
          )}
        >
          {localCandidateReviewSignalKindLabel(decision.kind)}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-600">
        {decision.reasons.join(" ")}
      </p>
    </div>
  );
}

function CandidateReviewSignalSamples({
  samples
}: {
  samples: LocalCandidateReviewSignalSample[];
}) {
  if (samples.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 grid gap-1">
      {samples.map((sample) => (
        <p
          key={sample.dedupeKey}
          className="break-words text-xs leading-5 text-slate-500"
        >
          {localIngestionSourceLabel(sample.source)} {sample.externalId} -{" "}
          {sample.sourceTypeSuggestion} - {sample.title}
        </p>
      ))}
    </div>
  );
}

async function fetchLocalIngestionStatus() {
  return localIngestionFetch<LocalIngestionStatusReadout>("/api/local-ingestion/status");
}

async function fetchLocalAcceptedCandidateProcessingStatus() {
  return localIngestionFetch<LocalAcceptedCandidateProcessingStatusResponse>(
    "/api/local-ingestion/process-accepted"
  );
}

async function postLocalAcceptedCandidateProcessingRun(limit: number) {
  return localIngestionFetch<LocalAcceptedCandidateProcessingRunResponse>(
    "/api/local-ingestion/process-accepted",
    {
      body: JSON.stringify({ limit }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    }
  );
}

async function fetchLocalBenefitDiscoveryQueue() {
  return localIngestionFetch<LocalBenefitDiscoveryQueueResponse>(
    "/api/local-ingestion/benefit-discovery?limit=20"
  );
}

async function postLocalBenefitDiscoveryAction(input: {
  action: LocalBenefitDiscoveryAction;
  clusterKey: string;
}) {
  return localIngestionFetch<LocalBenefitDiscoveryActionResponse>(
    "/api/local-ingestion/benefit-discovery",
    {
      body: JSON.stringify(input),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    }
  );
}

async function postLocalBenefitDiscoveryAutomation(input: {
  apply: boolean;
  rejectThreshold: number;
  scope: LocalBenefitDiscoveryAutomationScope;
  strategy: LocalBenefitDiscoveryAutomationStrategy;
  threshold: number;
}) {
  return localIngestionFetch<LocalBenefitDiscoveryAutomationResponse>(
    "/api/local-ingestion/benefit-discovery",
    {
      body: JSON.stringify({
        action: "auto-build",
        apply: input.apply,
        rejectThreshold: input.rejectThreshold,
        scope: input.scope,
        strategy: input.strategy,
        threshold: input.threshold
      }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    }
  );
}

async function fetchLocalIdentityResolutionQueue() {
  return localIngestionFetch<LocalIdentityResolutionQueueResponse>(
    "/api/local-ingestion/identity-resolution?limit=12"
  );
}

async function postLocalIdentityResolutionAction(input: {
  action: LocalIdentityResolutionAction;
  dedupeKey: string;
  interventionId?: string;
  synonym?: string;
}) {
  return localIngestionFetch<LocalIdentityResolutionActionResponse>(
    "/api/local-ingestion/identity-resolution",
    {
      body: JSON.stringify(input),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    }
  );
}

async function postLocalIdentityResolutionAutomation(input: {
  apply: boolean;
  scope: LocalIdentityResolutionAutomationScope;
  strategy: LocalIdentityResolutionAutomationStrategy;
}) {
  return localIngestionFetch<LocalIdentityResolutionAutomationResponse>(
    "/api/local-ingestion/identity-resolution",
    {
      body: JSON.stringify({
        action: "auto-resolve",
        apply: input.apply,
        scope: input.scope,
        strategy: input.strategy
      }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    }
  );
}

async function fetchLocalCandidateReview({
  bucket,
  q,
  source,
  studyFilter
}: {
  bucket: LocalCandidateReviewBucket;
  q: string;
  source: LocalCandidateReviewSourceFilter;
  studyFilter: LocalCandidateReviewStudyFilter;
}) {
  const searchParams = new URLSearchParams({
    bucket,
    limit: "12",
    source,
    studyFilter
  });

  if (q) {
    searchParams.set("q", q);
  }

  return localIngestionFetch<LocalCandidateReviewResponse>(
    `/api/local-ingestion/candidates?${searchParams.toString()}`
  );
}

async function postLocalCandidateReviewDecision(input: {
  decision: "Accepted" | "Rejected";
  dedupeKey: string;
  reviewNote: string;
}) {
  return localIngestionFetch<LocalCandidateReviewDecisionResponse>(
    "/api/local-ingestion/candidates",
    {
      body: JSON.stringify(input),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    }
  );
}

async function postLocalCandidateReviewBulkDecision(input: {
  bucket: LocalCandidateReviewBucket;
  bulkAction: LocalCandidateReviewBulkAction;
  q: string;
  reviewNote: string;
  source: LocalCandidateReviewSourceFilter;
  studyFilter: LocalCandidateReviewStudyFilter;
}) {
  return localIngestionFetch<LocalCandidateReviewBulkResponse>(
    "/api/local-ingestion/candidates",
    {
      body: JSON.stringify(input),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    }
  );
}

async function postLocalCandidateReviewAutomation(input: {
  apply: boolean;
  q: string;
  source: LocalCandidateReviewSourceFilter;
  strategy: LocalCandidateReviewAutomationStrategy;
  studyFilter: LocalCandidateReviewStudyFilter;
}) {
  return localIngestionFetch<LocalCandidateReviewAutomationResponse>(
    "/api/local-ingestion/candidates",
    {
      body: JSON.stringify({
        action: "auto-triage-maybe-useful",
        apply: input.apply,
        q: input.q,
        source: input.source,
        strategy: input.strategy,
        studyFilter: input.studyFilter
      }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    }
  );
}

async function postLocalCandidateReviewSignalMining(input: {
  q: string;
  source: LocalCandidateReviewSourceFilter;
  studyFilter: LocalCandidateReviewStudyFilter;
}) {
  return localIngestionFetch<LocalCandidateReviewSignalMiningResponse>(
    "/api/local-ingestion/candidates",
    {
      body: JSON.stringify({
        action: "mine-maybe-useful-signals",
        q: input.q,
        source: input.source,
        studyFilter: input.studyFilter
      }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    }
  );
}

async function postLocalCandidateReviewSignalApply(input: {
  q: string;
  signalAction: LocalCandidateReviewSignalApplyAction;
  source: LocalCandidateReviewSourceFilter;
  studyFilter: LocalCandidateReviewStudyFilter;
}) {
  return localIngestionFetch<LocalCandidateReviewSignalApplyResponse>(
    "/api/local-ingestion/candidates",
    {
      body: JSON.stringify({
        action: "apply-mined-signals",
        q: input.q,
        signalAction: input.signalAction,
        source: input.source,
        studyFilter: input.studyFilter
      }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    }
  );
}

function localCandidateReviewAutomationConfirmMessage(
  preview: LocalCandidateReviewAutomationResponse | null,
  review: LocalCandidateReviewResponse | null
) {
  if (!preview) {
    return `Auto-triage maybe-useful candidates matching the current source/search/study filters? Preview first when possible. Up to ${(review?.counts.maybeUseful ?? 0).toLocaleString()} maybe-useful candidate(s) may be scanned.`;
  }

  return `Apply ${localCandidateReviewAutomationStrategyLabel(preview.strategy).toLowerCase()} maybe-useful auto-triage? This will accept ${preview.counts.accepted.toLocaleString()}, reject ${preview.counts.rejected.toLocaleString()}, and hold ${preview.counts.held.toLocaleString()} from ${preview.counts.scanned.toLocaleString()} scanned candidate(s).`;
}

function localCandidateReviewAutomationResultMessage(
  result: LocalCandidateReviewAutomationResponse
) {
  const parts = [
    `${result.counts.scanned.toLocaleString()} scanned`,
    `${result.counts.accepted.toLocaleString()} accept`,
    `${result.counts.rejected.toLocaleString()} reject`,
    `${result.counts.held.toLocaleString()} hold`
  ];

  if (result.applied) {
    parts.push(`${result.counts.appliedActions.toLocaleString()} action(s) applied`);
  }

  if (result.status === "stopped-at-limit") {
    parts.push("stopped at safety limit");
  }

  if (result.counts.errors > 0) {
    parts.push(`${result.counts.errors.toLocaleString()} error(s)`);
  }

  return `Maybe-useful ${localCandidateReviewAutomationStrategyLabel(result.strategy).toLowerCase()} auto-triage ${result.applied ? "applied" : "preview"}: ${parts.join(", ")}.`;
}

function localCandidateReviewSignalMiningResultMessage(
  result: LocalCandidateReviewSignalMiningResponse
) {
  const parts = [
    `${result.counts.scanned.toLocaleString()} scanned`,
    `${result.counts.spotCheck.toLocaleString()} spot-check`,
    `${result.counts.parkResearch.toLocaleString()} research`,
    `${result.counts.identityMismatch.toLocaleString()} mismatch`,
    `${result.counts.lowSignal.toLocaleString()} low signal`
  ];

  if (result.status === "stopped-at-limit") {
    parts.push("stopped at safety limit");
  }

  return `Held signal mining finished: ${parts.join(", ")}.`;
}

function localCandidateReviewSignalApplyConfirmMessage(
  signalAction: LocalCandidateReviewSignalApplyAction,
  preview: LocalCandidateReviewSignalMiningResponse
) {
  if (signalAction === "reject-mismatches") {
    return `Reject ${preview.counts.identityMismatch.toLocaleString()} mined mismatch row(s)? This removes source candidates where the captured source points at another intervention or context. No claims or heatmap scores will be created.`;
  }

  return `Park ${preview.counts.parkResearch.toLocaleString()} mined research row(s)? They will leave the active Maybe useful queue but remain pending as local research/backlog signals.`;
}

function localCandidateReviewSignalApplyProgressMessage(
  signalAction: LocalCandidateReviewSignalApplyAction
) {
  return signalAction === "reject-mismatches"
    ? "Rejecting mined mismatch rows."
    : "Parking mined research rows.";
}

function localCandidateReviewSignalApplyResultMessage(
  result: LocalCandidateReviewSignalApplyResponse
) {
  const parts = [
    `${result.counts.scanned.toLocaleString()} scanned`,
    `${result.counts.rejected.toLocaleString()} rejected`,
    `${result.counts.parked.toLocaleString()} parked`,
    `${result.counts.skipped.toLocaleString()} skipped`
  ];

  if (result.counts.errors > 0) {
    parts.push(`${result.counts.errors.toLocaleString()} error(s)`);
  }

  if (result.status === "stopped-at-limit") {
    parts.push("stopped at safety limit");
  }

  return `Mined signal cleanup finished: ${parts.join(", ")}.`;
}

function localCandidateReviewAutomationStrategyLabel(
  strategy: LocalCandidateReviewAutomationStrategy
) {
  switch (strategy) {
    case "query-backed":
      return "Pass 2";
    case "strict":
      return "Strict";
  }
}

function localCandidateReviewAutomationStrategyTooltip(
  strategy: LocalCandidateReviewAutomationStrategy
) {
  switch (strategy) {
    case "query-backed":
      return "Pass 2 accepts priority review/trial rows when the search query clearly names the intervention and the source does not point elsewhere.";
    case "strict":
      return "Strict accepts only priority review/trial rows where captured source metadata visibly names the intervention.";
  }
}

function localCandidateReviewAutomationActionLabel(
  action: LocalCandidateReviewAutomationAction
) {
  switch (action) {
    case "accept":
      return "accept";
    case "reject":
      return "reject";
    case "hold":
      return "hold";
  }
}

function localCandidateReviewAutomationTone(action: LocalCandidateReviewAutomationAction) {
  switch (action) {
    case "accept":
      return "border-green-200 bg-green-50 text-green-700";
    case "reject":
      return "border-danger/20 bg-red-50 text-danger";
    case "hold":
      return "border-amberline/25 bg-amber-50 text-amberline";
  }
}

function localCandidateReviewSignalKindLabel(kind: LocalCandidateReviewSignalKind) {
  switch (kind) {
    case "identity-mismatch":
      return "mismatch";
    case "low-signal":
      return "low signal";
    case "park-research":
      return "research";
    case "spot-check":
      return "spot-check";
  }
}

function localCandidateReviewSignalTone(kind: LocalCandidateReviewSignalKind) {
  switch (kind) {
    case "identity-mismatch":
      return "border-danger/20 bg-red-50 text-danger";
    case "low-signal":
      return "border-slate-200 bg-slate-50 text-slate-600";
    case "park-research":
      return "border-amberline/25 bg-amber-50 text-amberline";
    case "spot-check":
      return "border-green-200 bg-green-50 text-green-700";
  }
}

function localCandidateBulkConfirmMessage({
  action,
  bucket,
  review
}: {
  action: LocalCandidateReviewBulkAction;
  bucket: LocalCandidateReviewBucket;
  review: LocalCandidateReviewResponse | null;
}) {
  const counts = review?.counts;

  switch (action) {
    case "accept-all":
      return `Accept all pending candidates matching the current "${localCandidateBucketLabel(
        bucket
      )}" filters? This may create or reuse local references for up to ${(
        localCandidateBucketCount(review, bucket)
      ).toLocaleString()} candidate(s).`;
    case "accept-likely-useful":
      return `Accept all likely useful candidates matching the current source/search/study filters? This may create or reuse local references for up to ${(
        counts?.likelyUseful ?? 0
      ).toLocaleString()} candidate(s).`;
    case "reject-not-useful":
      return `Reject all likely-noise candidates matching the current source/search/study filters? This will remove up to ${(
        counts?.likelyNoise ?? 0
      ).toLocaleString()} candidate(s) from the review queue.`;
  }
}

function localCandidateBulkReviewNote(action: LocalCandidateReviewBulkAction) {
  switch (action) {
    case "accept-all":
      return "Bulk accepted all currently filtered candidates from local candidate review dashboard after user click.";
    case "accept-likely-useful":
      return "Bulk accepted likely useful candidates from local candidate review dashboard after user click.";
    case "reject-not-useful":
      return "Bulk rejected likely-noise candidates from local candidate review dashboard after user click.";
  }
}

function localCandidateBulkActionProgressLabel(action: LocalCandidateReviewBulkAction) {
  switch (action) {
    case "accept-all":
      return "Accepting filtered candidates";
    case "accept-likely-useful":
      return "Accepting likely useful candidates";
    case "reject-not-useful":
      return "Rejecting likely-noise candidates";
  }
}

function localCandidateBulkResultMessage(result: LocalCandidateReviewBulkResponse) {
  const parts = [
    `${result.accepted.toLocaleString()} accepted`,
    `${result.rejected.toLocaleString()} rejected`,
    `${result.scanned.toLocaleString()} scanned`
  ];

  if (result.status === "stopped-at-limit") {
    parts.push("stopped at the safety limit; press the button again to continue");
  }

  if (result.errors.length > 0) {
    parts.push(`${result.errors.length.toLocaleString()} error(s)`);
  }

  return `Bulk review finished: ${parts.join(", ")}.`;
}

function localCandidateBucketLabel(bucket: LocalCandidateReviewBucket) {
  return (
    LOCAL_CANDIDATE_BUCKET_OPTIONS.find((option) => option.value === bucket)?.label ??
    "current"
  );
}

function localCandidateBucketCount(
  review: LocalCandidateReviewResponse | null,
  bucket: LocalCandidateReviewBucket
) {
  const counts = review?.counts;

  if (!counts) {
    return 0;
  }

  switch (bucket) {
    case "all":
      return counts.all;
    case "all-useful":
      return counts.allUseful;
    case "likely-useful":
      return counts.likelyUseful;
    case "maybe-useful":
      return counts.maybeUseful;
    case "likely-noise":
      return counts.likelyNoise;
    case "unclassified":
      return counts.unclassified;
  }
}

function localAcceptedProcessorIdleMessage(
  status: LocalAcceptedCandidateProcessingStatusResponse
) {
  if (status.counts.unprocessed > 0) {
    return `${status.counts.unprocessed.toLocaleString()} accepted candidate(s) still need processing before moving to maybe-useful.`;
  }

  if (status.counts.acceptedWithReference === 0) {
    return "No accepted candidates with references are ready to process yet.";
  }

  return `${status.counts.processed.toLocaleString()} accepted candidate(s) processed. Likely-useful accepted work is caught up.`;
}

function localBenefitDiscoveryQueueMessage(queue: LocalBenefitDiscoveryQueueResponse) {
  if (queue.clusters.length === 0) {
    return queue.counts.parkedClusters > 0
      ? `No active benefit discovery clusters are ready. ${queue.counts.parkedClusters.toLocaleString()} lead(s) are parked for later review.`
      : "No active benefit discovery clusters are ready.";
  }

  return `${queue.counts.activeClusters.toLocaleString()} active cluster(s), ${queue.counts.activeCandidates.toLocaleString()} candidate(s), ${queue.counts.mismatchCandidates.toLocaleString()} candidate(s) flagged for identity checks, ${queue.counts.parkedClusters.toLocaleString()} parked lead(s).`;
}

function localBenefitDiscoveryConfirmMessage(
  cluster: LocalBenefitDiscoveryCluster,
  action: LocalBenefitDiscoveryAction
) {
  switch (action) {
    case "draft-claim":
      return `Create an unreviewed local draft claim for ${cluster.interventionName} / ${cluster.outcomeLabel} and link ${cluster.usableCandidateCount.toLocaleString()} usable accepted reference(s)?`;
    case "link-existing-claim":
      return `Link ${cluster.usableCandidateCount.toLocaleString()} usable accepted reference(s) to the existing ${cluster.interventionName} / ${cluster.outcomeLabel} claim?`;
    case "park-lead":
      return `Park this ${cluster.interventionName} / ${cluster.outcomeLabel} discovery lead? It stays available for later source review, but no claim or heatmap score will be created.`;
    case "reject-cluster":
      return `Reject this ${cluster.interventionName} / ${cluster.outcomeLabel} discovery cluster from the local queue?`;
  }
}

function localBenefitDiscoveryActionProgress(action: LocalBenefitDiscoveryAction) {
  switch (action) {
    case "draft-claim":
      return "Creating local draft claim and linking accepted references.";
    case "link-existing-claim":
      return "Linking accepted references to existing claim.";
    case "park-lead":
      return "Parking benefit discovery lead.";
    case "reject-cluster":
      return "Rejecting benefit discovery cluster.";
  }
}

function localIdentityResolutionQueueMessage(queue: LocalIdentityResolutionQueueResponse) {
  if (queue.counts.blockedCandidates === 0) {
    return "No blocked identity rows are waiting.";
  }

  return `${queue.counts.blockedCandidates.toLocaleString()} accepted source(s) need identity resolution.`;
}

function localIdentityResolutionConfirmMessage(
  candidate: LocalIdentityResolutionCandidate,
  action: LocalIdentityResolutionAction
) {
  switch (action) {
    case "confirm-target":
      return `Confirm this source belongs to ${candidate.interventionName}?`;
    case "reassign-intervention":
      return `Reassign this accepted source away from ${candidate.interventionName}?`;
    case "reject-wrong-supplement":
      return `Reject this source candidate as the wrong supplement for ${candidate.interventionName}?`;
    case "add-synonym":
      return `Add this alias to ${candidate.interventionName} and confirm the source identity?`;
  }
}

function localIdentityResolutionProgressMessage(action: LocalIdentityResolutionAction) {
  switch (action) {
    case "confirm-target":
      return "Confirming source identity.";
    case "reassign-intervention":
      return "Reassigning source identity.";
    case "reject-wrong-supplement":
      return "Rejecting wrong-supplement source.";
    case "add-synonym":
      return "Adding alias and confirming source identity.";
  }
}

function localIdentityResolutionAutomationMessage(
  result: LocalIdentityResolutionAutomationResponse
) {
  const parts = [
    `${result.counts.scannedCandidates.toLocaleString()} scanned`,
    `${result.counts.confirmTarget.toLocaleString()} confirm`,
    `${result.counts.reassignIntervention.toLocaleString()} reassign`,
    `${result.counts.rejectWrongSupplement.toLocaleString()} reject`,
    `${result.counts.hold.toLocaleString()} hold`
  ];

  if (result.applied) {
    parts.push(`${result.counts.appliedActions.toLocaleString()} action(s) applied`);
  }

  if (result.counts.errors > 0) {
    parts.push(`${result.counts.errors.toLocaleString()} error(s)`);
  }

  return `Identity auto-resolve ${localIdentityResolutionAutomationStrategyLabel(result.strategy)} ${localIdentityResolutionAutomationScopeLabel(result.scope)} ${result.applied ? "applied" : "preview"}: ${parts.join(", ")}.`;
}

function localIdentityResolutionAutomationConfirmMessage(
  preview: LocalIdentityResolutionAutomationResponse | null,
  strategy: LocalIdentityResolutionAutomationStrategy,
  scope: LocalIdentityResolutionAutomationScope
) {
  if (!preview) {
    return `Run ${localIdentityResolutionAutomationStrategyLabel(strategy)} ${localIdentityResolutionAutomationScopeLabel(scope)} identity auto-resolve? Preview first when possible; ambiguous rows stay held for manual review.`;
  }

  return `Apply ${localIdentityResolutionAutomationStrategyLabel(preview.strategy)} ${localIdentityResolutionAutomationScopeLabel(preview.scope)} identity auto-resolve? This will confirm ${preview.counts.confirmTarget.toLocaleString()} source(s), reassign ${preview.counts.reassignIntervention.toLocaleString()}, reject ${preview.counts.rejectWrongSupplement.toLocaleString()}, and hold ${preview.counts.hold.toLocaleString()}.`;
}

function localIdentityResolutionAutomationStrategyLabel(
  strategy: LocalIdentityResolutionAutomationStrategy
) {
  return strategy === "source-led" ? "source-led" : "strict";
}

function localIdentityResolutionAutomationScopeLabel(
  scope: LocalIdentityResolutionAutomationScope
) {
  return scope === "all-eligible" ? "all eligible" : "batch";
}

function localIdentityResolutionAutomationActionLabel(
  action: LocalIdentityResolutionAutomationAction
) {
  switch (action) {
    case "confirm-target":
      return "confirm";
    case "reassign-intervention":
      return "reassign";
    case "reject-wrong-supplement":
      return "reject";
    case "hold":
      return "hold";
  }
}

function localIdentityResolutionAutomationTone(
  action: LocalIdentityResolutionAutomationAction
) {
  switch (action) {
    case "confirm-target":
      return "border-green-200 bg-green-50 text-green-700";
    case "reassign-intervention":
      return "border-signal/20 bg-signal/10 text-signal";
    case "reject-wrong-supplement":
      return "border-danger/20 bg-red-50 text-danger";
    case "hold":
      return "border-amberline/25 bg-amber-50 text-amberline";
  }
}

function localBenefitDiscoveryAutomationMessage(
  result: LocalBenefitDiscoveryAutomationResponse
) {
  const parts = [
    `${result.counts.scannedClusters.toLocaleString()} scanned`,
    `${result.counts.draftClaims.toLocaleString()} draft`,
    `${result.counts.linkExistingClaims.toLocaleString()} link`,
    `${result.counts.parkLeadClusters.toLocaleString()} park`,
    `${result.counts.holdClusters.toLocaleString()} hold`,
    `${result.counts.rejectClusters.toLocaleString()} reject`
  ];

  if (result.applied) {
    parts.push(`${result.counts.appliedActions.toLocaleString()} action(s) applied`);
    parts.push(`${result.counts.linkedReferences.toLocaleString()} reference(s) linked`);
  }

  if (result.counts.errors > 0) {
    parts.push(`${result.counts.errors.toLocaleString()} error(s)`);
  }

  const bands =
    result.strategy === "park-backlog"
      ? ` Park ${result.rejectThreshold}-${result.threshold - 1}, reject below ${result.rejectThreshold}.`
      : "";

  return `Auto-build ${localBenefitDiscoveryAutomationStrategyLabel(result.strategy)} ${localBenefitDiscoveryAutomationScopeLabel(result.scope)} ${result.applied ? "applied" : "preview"}: ${parts.join(", ")}.${bands}`;
}

function localBenefitDiscoveryAutomationConfirmMessage(
  preview: LocalBenefitDiscoveryAutomationResponse | null,
  rejectThreshold: number,
  scope: LocalBenefitDiscoveryAutomationScope,
  strategy: LocalBenefitDiscoveryAutomationStrategy,
  threshold: number
) {
  if (!preview) {
    return `Run ${localBenefitDiscoveryAutomationStrategyLabel(strategy)} ${localBenefitDiscoveryAutomationScopeLabel(scope)} automation at score ${threshold}? ${localBenefitDiscoveryAutomationStrategyDescription(strategy, rejectThreshold, threshold)}`;
  }

  return `Apply ${localBenefitDiscoveryAutomationStrategyLabel(preview.strategy)} ${localBenefitDiscoveryAutomationScopeLabel(preview.scope)} automation at score ${preview.threshold}? This will draft ${preview.counts.draftClaims.toLocaleString()} claim(s), link ${preview.counts.linkExistingClaims.toLocaleString()} existing claim cluster(s), park ${preview.counts.parkLeadClusters.toLocaleString()} lead(s), and reject ${preview.counts.rejectClusters.toLocaleString()} low-confidence cluster(s).${preview.strategy === "park-backlog" ? ` Park ${preview.rejectThreshold}-${preview.threshold - 1}; reject below ${preview.rejectThreshold}.` : ""}`;
}

function localBenefitDiscoveryAutomationScopeLabel(
  scope: LocalBenefitDiscoveryAutomationScope
) {
  return scope === "all-eligible" ? "all eligible" : "batch";
}

function localBenefitDiscoveryAutomationStrategyLabel(
  strategy: LocalBenefitDiscoveryAutomationStrategy
) {
  switch (strategy) {
    case "build-leads":
      return "build leads";
    case "link-existing":
      return "link existing";
    case "park-backlog":
      return "park backlog";
  }
}

function localBenefitDiscoveryAutomationStrategyButtonLabel(
  strategy: LocalBenefitDiscoveryAutomationStrategy
) {
  switch (strategy) {
    case "build-leads":
      return "Build leads";
    case "link-existing":
      return "Link existing";
    case "park-backlog":
      return "Park backlog";
  }
}

function localBenefitDiscoveryAutomationStrategyDescription(
  strategy: LocalBenefitDiscoveryAutomationStrategy,
  rejectThreshold: number,
  threshold: number
) {
  if (strategy === "link-existing") {
    return "This only links sources into existing local claims, rejects very low-confidence clusters, and leaves novel claim areas for manual review.";
  }

  if (strategy === "park-backlog") {
    return `This parks leads from ${rejectThreshold} to ${threshold - 1}, rejects leads below ${rejectThreshold}, and holds ${threshold}+ for build/link review without creating heatmap claims.`;
  }

  return "This will create unreviewed local draft claims, link existing local claims, and reject very low-confidence clusters from the local queue.";
}

function localBenefitDiscoveryAutomationActionLabel(
  action: LocalBenefitDiscoveryAutomationAction
) {
  switch (action) {
    case "draft-claim":
      return "draft";
    case "link-existing-claim":
      return "link";
    case "park-lead":
      return "park";
    case "reject-cluster":
      return "reject";
    case "hold":
      return "hold";
  }
}

function localBenefitDiscoveryAutomationTone(
  action: LocalBenefitDiscoveryAutomationAction
) {
  switch (action) {
    case "draft-claim":
      return "border-signal/20 bg-signal/10 text-signal";
    case "link-existing-claim":
      return "border-green-200 bg-green-50 text-green-700";
    case "park-lead":
      return "border-amberline/25 bg-amber-50 text-amberline";
    case "reject-cluster":
      return "border-danger/20 bg-red-50 text-danger";
    case "hold":
      return "border-amberline/25 bg-amber-50 text-amberline";
  }
}

async function postLocalIngestionStart() {
  return localIngestionFetch<LocalIngestionStartResponse>("/api/local-ingestion/start", {
    method: "POST"
  });
}

async function postLocalIngestionSynonyms() {
  return localIngestionFetch<LocalIngestionStartResponse>("/api/local-ingestion/synonyms", {
    method: "POST"
  });
}

async function postLocalIngestionRun(limit: number) {
  return localIngestionFetch<LocalIngestionRunResponse>("/api/local-ingestion/run", {
    body: JSON.stringify({ limit }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
}

async function localIngestionFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const method = init.method ?? "GET";

  if (isLocalIngestionWriteMethod(method)) {
    headers.set(LOCAL_INGESTION_WRITE_HEADER, LOCAL_INGESTION_WRITE_HEADER_VALUE);
  }

  const response = await fetch(url, {
    ...init,
    headers,
    cache: "no-store"
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    throw new Error(body.error ?? "Local ingestion request failed.");
  }

  return body;
}

function isLocalDashboardHost() {
  if (typeof window === "undefined") {
    return false;
  }

  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

function localIngestionQueueCount(
  status: LocalIngestionStatusReadout,
  key: LocalIngestionJobStatus
) {
  return status.queue.counts[key] ?? 0;
}

function localIngestionIdleMessage(status: LocalIngestionStatusReadout) {
  const queued = localIngestionQueueCount(status, "QUEUED");
  const running = localIngestionQueueCount(status, "RUNNING");

  if (queued > 0 || running > 0) {
    return `${queued.toLocaleString()} queued and ${running.toLocaleString()} running.`;
  }

  return `Idle. ${status.candidates.total.toLocaleString()} source candidate(s) are in the local database.`;
}

function localIngestionErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Local ingestion request failed.";
}

function localIngestionSourceLabel(source: LocalIngestionSource) {
  switch (source) {
    case "CLINICALTRIALS_GOV":
      return "ClinicalTrials.gov";
    case "PUBMED":
      return "PubMed";
  }
}

function localIngestionStatusLabel(status: LocalIngestionJobStatus | LocalIngestionRunJobResult["status"]) {
  return status.replace(/_/g, " ").toLowerCase();
}

function localIngestionStatusTone(status: LocalIngestionJobStatus) {
  switch (status) {
    case "FAILED":
      return "border-danger/30 bg-red-50 text-danger";
    case "QUEUED":
      return "border-line bg-mist text-slate-700";
    case "RUNNING":
      return "border-signal/30 bg-blue-50 text-signal";
    case "SKIPPED":
      return "border-amberline/30 bg-amber-50 text-amberline";
    case "SUCCEEDED":
      return "border-green-200 bg-green-50 text-green-700";
  }
}

function localIngestionDeepeningCatchUpSummary(
  catchUp: LocalIngestionDeepeningCatchUpReadout
) {
  if (catchUp.eligibleJobs === 0) {
    return "No completed full PubMed first-page jobs needed catch-up deepening.";
  }

  return `Deepening catch-up: ${catchUp.newJobs.toLocaleString()} queued, ${catchUp.existingJobs.toLocaleString()} already queued, ${catchUp.skippedJobs.toLocaleString()} skipped from ${catchUp.eligibleJobs.toLocaleString()} completed full PubMed first-page job(s).`;
}

function localIngestionDeepeningRunSummary(
  deepening: NonNullable<LocalIngestionRunJobResult["deepening"]>
) {
  const usefulRatio = `${Math.round(deepening.usefulRatio * 100)}%`;
  const pageRange = `${deepening.pageStart + 1}-${deepening.pageStart + deepening.pageSize}`;
  const total =
    deepening.totalCount !== undefined
      ? ` of ${deepening.totalCount.toLocaleString()} reported`
      : `; cap ${deepening.maxResults.toLocaleString()}`;
  const nextPage =
    deepening.nextPageStart !== undefined
      ? ` Next page starts at ${deepening.nextPageStart + 1}.`
      : "";

  return `Deepening: ${deepening.reason}. Useful-looking ${deepening.usefulCandidateCount.toLocaleString()}/${deepening.candidateCount.toLocaleString()} (${usefulRatio}) on PubMed page ${pageRange}${total}.${nextPage}`;
}

function localIngestionClassificationTone(
  bucket: LocalIngestionDiscoveryClassificationReadout["bucket"]
) {
  switch (bucket) {
    case "likely-useful":
      return "border-green-200 bg-green-50 text-green-700";
    case "likely-noise":
      return "border-slate-200 bg-slate-50 text-slate-600";
    case "maybe-useful":
      return "border-amberline/30 bg-amber-50 text-amberline";
  }
}

function localIngestionClassificationSummary(
  classification: LocalIngestionDiscoveryClassificationReadout
) {
  const reasons = classification.reasons.slice(0, 2);
  const cautions = classification.cautions.slice(0, 2);
  const parts = [
    ...reasons,
    ...cautions.map((caution) => `caution: ${caution}`)
  ];

  return parts.length > 0 ? parts.join("; ") : "needs manual review";
}

function formatLocalIngestionTime(value?: string) {
  if (!value) {
    return "not started";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

type SourcePacketGapPriority = "High" | "Medium" | "Low";

type SourcePacketGapRow = {
  claim: Claim;
  intervention?: Intervention;
  packet: ClaimSourcePacket;
  priority: number;
  priorityLabel: SourcePacketGapPriority;
  reasons: string[];
};

type SourcePacketGapSummary = {
  extractionPending: number;
  highPriority: number;
  humanReviewedAffected: number;
  missingSources: number;
  noCuratedSources: number;
  pendingReferences: number;
  totalGaps: number;
};

type ScoreReadinessState =
  | "default_score_review"
  | "ready_to_score"
  | "scored"
  | "snapshot_gap"
  | "source_blocked";

type ScoreReadinessPriority = "High" | "Medium" | "Low";

type ScoreReadinessRow = {
  claim: Claim;
  currentScore: number | null;
  intervention?: Intervention;
  packet: ClaimSourcePacket;
  priority: number;
  priorityLabel: ScoreReadinessPriority;
  reasons: string[];
  state: ScoreReadinessState;
};

type ScoreReadinessSummary = {
  defaultLookingPublicScores: number;
  readyToScore: number;
  scoredPublicClaims: number;
  snapshotGaps: number;
  sourceBlocked: number;
  totalClaims: number;
  workItems: number;
};

export function buildSourcePacketGapRows(data: EvidenceDashboardData): SourcePacketGapRow[] {
  const referencesById = new Map(data.references.map((reference) => [reference.id, reference]));
  const interventionsById = new Map(
    data.interventions.map((intervention) => [intervention.id, intervention])
  );
  const claimCountByIntervention = new Map<string, number>();

  for (const claim of data.claims) {
    claimCountByIntervention.set(
      claim.interventionId,
      (claimCountByIntervention.get(claim.interventionId) ?? 0) + 1
    );
  }

  return data.claims
    .map((claim) => {
      const packet = buildClaimSourcePacket({
        claim,
        referencesById,
        studies: data.studies
      });

      return {
        claim,
        intervention: interventionsById.get(claim.interventionId),
        packet
      };
    })
    .filter(({ packet }) => packet.completeness.status !== "complete")
    .map(({ claim, intervention, packet }) => {
      const priority = sourcePacketGapPriorityScore({
        claim,
        interventionClaimCount: claimCountByIntervention.get(claim.interventionId) ?? 0,
        packet
      });
      const priorityLabel = sourcePacketGapPriorityLabel(priority);

      return {
        claim,
        intervention,
        packet,
        priority,
        priorityLabel,
        reasons: sourcePacketGapReasons({
          claim,
          interventionClaimCount: claimCountByIntervention.get(claim.interventionId) ?? 0,
          packet
        })
      };
    })
    .sort((left, right) => {
      const priorityDelta = right.priority - left.priority;

      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      const leftName = left.intervention?.name ?? "";
      const rightName = right.intervention?.name ?? "";
      return leftName.localeCompare(rightName) || left.claim.outcome.localeCompare(right.claim.outcome);
    });
}

function buildSourcePacketGapSummary(rows: SourcePacketGapRow[]): SourcePacketGapSummary {
  return {
    extractionPending: rows.filter((row) => row.packet.completeness.status === "extraction_pending").length,
    highPriority: rows.filter((row) => row.priorityLabel === "High").length,
    humanReviewedAffected: rows.filter((row) => isHumanReviewed(row.claim.reviewStatus)).length,
    missingSources: rows.filter((row) => row.packet.completeness.status === "missing_sources").length,
    noCuratedSources: rows.filter((row) => row.packet.completeness.status === "not_linked").length,
    pendingReferences: rows.reduce(
      (total, row) =>
        total +
        row.packet.completeness.pendingReferences +
        row.packet.completeness.missingReferences,
      0
    ),
    totalGaps: rows.length
  };
}

export function buildScoreReadinessRows(data: EvidenceDashboardData): ScoreReadinessRow[] {
  const referencesById = new Map(data.references.map((reference) => [reference.id, reference]));
  const interventionsById = new Map(
    data.interventions.map((intervention) => [intervention.id, intervention])
  );
  const snapshotsByClaimId = new Map(
    (data.claimScoreSnapshots ?? []).map((snapshot) => [snapshot.claimId, snapshot])
  );
  const hasSnapshotInventory = data.claimScoreSnapshots !== undefined;

  return data.claims
    .map((claim) => {
      const packet = buildClaimSourcePacket({
        claim,
        referencesById,
        studies: data.studies
      });
      const currentScore = evidenceMapSortableScore(claim);
      const state = scoreReadinessState({
        claim,
        currentScore,
        hasSnapshotInventory,
        packet,
        snapshotExists: snapshotsByClaimId.has(claim.id)
      });
      const priority = scoreReadinessPriorityScore({ claim, currentScore, packet, state });

      return {
        claim,
        currentScore,
        intervention: interventionsById.get(claim.interventionId),
        packet,
        priority,
        priorityLabel: scoreReadinessPriorityLabel(priority),
        reasons: scoreReadinessReasons({
          claim,
          currentScore,
          hasSnapshotInventory,
          packet,
          snapshotExists: snapshotsByClaimId.has(claim.id),
          state
        }),
        state
      };
    })
    .sort((left, right) => {
      const priorityDelta = right.priority - left.priority;

      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      const leftName = left.intervention?.name ?? "";
      const rightName = right.intervention?.name ?? "";
      return leftName.localeCompare(rightName) || left.claim.outcome.localeCompare(right.claim.outcome);
    });
}

function buildScoreReadinessSummary(rows: ScoreReadinessRow[]): ScoreReadinessSummary {
  const workItems = rows.filter((row) => row.state !== "scored").length;

  return {
    defaultLookingPublicScores: rows.filter((row) => row.state === "default_score_review").length,
    readyToScore: rows.filter((row) => row.state === "ready_to_score").length,
    scoredPublicClaims: rows.filter((row) => row.state === "scored").length,
    snapshotGaps: rows.filter((row) => row.state === "snapshot_gap").length,
    sourceBlocked: rows.filter((row) => row.state === "source_blocked").length,
    totalClaims: rows.length,
    workItems
  };
}

function scoreReadinessState({
  claim,
  currentScore,
  hasSnapshotInventory,
  packet,
  snapshotExists
}: {
  claim: Claim;
  currentScore: number | null;
  hasSnapshotInventory: boolean;
  packet: ClaimSourcePacket;
  snapshotExists: boolean;
}): ScoreReadinessState {
  if (currentScore !== null && isStarterLookingCompositeScore(currentScore)) {
    return "default_score_review";
  }

  if (packet.completeness.status !== "complete") {
    return "source_blocked";
  }

  if (isEvidenceMapPlaceholderClaim(claim)) {
    return "ready_to_score";
  }

  if (hasSnapshotInventory && !snapshotExists) {
    return "snapshot_gap";
  }

  return "scored";
}

function scoreReadinessPriorityScore({
  claim,
  currentScore,
  packet,
  state
}: {
  claim: Claim;
  currentScore: number | null;
  packet: ClaimSourcePacket;
  state: ScoreReadinessState;
}) {
  const stateScore: Record<ScoreReadinessState, number> = {
    default_score_review: 110,
    ready_to_score: 95,
    scored: 0,
    snapshot_gap: 55,
    source_blocked: 70
  };
  const labelWeight = sourcePacketGapLabelWeight(claim.finalLabel);
  const sourceDepth =
    packet.evidenceDepth.metaAnalyses * 8 +
    packet.evidenceDepth.systematicReviews * 6 +
    packet.evidenceDepth.randomizedControlledTrials * 6 +
    packet.evidenceDepth.clinicalTrialRecords * 3;

  return Math.round(
    stateScore[state] +
      labelWeight +
      (isHumanReviewed(claim.reviewStatus) ? 18 : 8) +
      (currentScore === null ? 0 : currentScore * 2) +
      Math.min(18, sourceDepth) +
      Math.min(12, packet.completeness.totalReferences * 3)
  );
}

function scoreReadinessPriorityLabel(priority: number): ScoreReadinessPriority {
  if (priority >= 120) {
    return "High";
  }

  if (priority >= 85) {
    return "Medium";
  }

  return "Low";
}

function scoreReadinessReasons({
  claim,
  currentScore,
  hasSnapshotInventory,
  packet,
  snapshotExists,
  state
}: {
  claim: Claim;
  currentScore: number | null;
  hasSnapshotInventory: boolean;
  packet: ClaimSourcePacket;
  snapshotExists: boolean;
  state: ScoreReadinessState;
}) {
  const reasons = [scoreReadinessStateLabel(state)];

  if (currentScore !== null && isStarterLookingCompositeScore(currentScore)) {
    reasons.push(`${currentScore.toFixed(1)} matches starter-score pattern`);
  }

  if (packet.completeness.status === "complete") {
    reasons.push("source packet complete");
  } else {
    reasons.push(packet.completeness.label);
  }

  if (isEvidenceMapPlaceholderClaim(claim)) {
    reasons.push("hidden from final score display");
  }

  if (hasSnapshotInventory && !snapshotExists) {
    reasons.push("no score snapshot recorded");
  }

  if (packet.evidenceDepth.metaAnalyses > 0 || packet.evidenceDepth.systematicReviews > 0) {
    reasons.push("review-level source extracted");
  }

  if (packet.evidenceDepth.randomizedControlledTrials > 0) {
    reasons.push("RCT extraction available");
  }

  if (!isHumanReviewed(claim.reviewStatus)) {
    reasons.push("pending human review");
  }

  return reasons;
}

function isStarterLookingCompositeScore(score: number) {
  return STARTER_LOOKING_COMPOSITE_SCORES.has(score.toFixed(1));
}

function scoreReadinessStateLabel(state: ScoreReadinessState) {
  switch (state) {
    case "default_score_review":
      return "Default-looking score";
    case "ready_to_score":
      return "Ready to score";
    case "scored":
      return "Scored";
    case "snapshot_gap":
      return "Snapshot gap";
    case "source_blocked":
      return "Source-blocked";
  }
}

function scoreReadinessNextAction(row: ScoreReadinessRow) {
  switch (row.state) {
    case "default_score_review":
      return "Review the linked source packet and replace the starter-looking public score with a claim-specific scoring rationale.";
    case "ready_to_score":
      return "Use the complete source packet to assign dimension scores, final label, and uncertainty language.";
    case "snapshot_gap":
      return "Capture a score snapshot so future score changes are auditable.";
    case "source_blocked":
      return row.packet.completeness.nextStep;
    case "scored":
      return "No immediate scoring action is required unless new sources or safety/regulatory context changes.";
  }
}

function sourcePacketGapPriorityScore({
  claim,
  interventionClaimCount,
  packet
}: {
  claim: Claim;
  interventionClaimCount: number;
  packet: ClaimSourcePacket;
}) {
  const statusScore: Record<ClaimSourcePacket["completeness"]["status"], number> = {
    complete: 0,
    extraction_pending: 70,
    missing_sources: 90,
    not_linked: 45
  };
  const score = evidenceMapSortableScore(claim);
  const labelWeight = sourcePacketGapLabelWeight(claim.finalLabel);

  return Math.round(
    statusScore[packet.completeness.status] +
      (isHumanReviewed(claim.reviewStatus) ? 30 : 10) +
      labelWeight +
      (score === null ? 0 : score * 3) +
      Math.min(18, packet.completeness.totalReferences * 3) +
      Math.min(18, packet.completeness.pendingReferences * 4) +
      Math.min(14, interventionClaimCount)
  );
}

function sourcePacketGapLabelWeight(label: EvidenceLabel) {
  if (label === "Core Evidence-Based") {
    return 22;
  }

  if (
    label === "Conditional / Biomarker-Gated" ||
    label === "Useful for Specific Use Case" ||
    label === "Safety Concern" ||
    label === "Requires Clinician Oversight" ||
    label === "Regulatory Concern"
  ) {
    return 16;
  }

  if (label === "Reasonable N-of-1 Experiment" || label === "Speculative Watchlist") {
    return 10;
  }

  return 4;
}

function sourcePacketGapPriorityLabel(priority: number): SourcePacketGapPriority {
  if (priority >= 120) {
    return "High";
  }

  if (priority >= 85) {
    return "Medium";
  }

  return "Low";
}

function sourcePacketGapReasons({
  claim,
  interventionClaimCount,
  packet
}: {
  claim: Claim;
  interventionClaimCount: number;
  packet: ClaimSourcePacket;
}) {
  const reasons = [packet.completeness.label];

  if (isHumanReviewed(claim.reviewStatus)) {
    reasons.push("human-reviewed claim affected");
  } else {
    reasons.push("pending human review");
  }

  if (packet.completeness.pendingReferences > 0) {
    reasons.push(`${packet.completeness.pendingReferences} linked ref(s) need extraction`);
  }

  if (packet.completeness.missingReferences > 0) {
    reasons.push(`${packet.completeness.missingReferences} missing ref record(s)`);
  }

  if (packet.completeness.totalReferences === 0) {
    reasons.push("no curated references linked");
  }

  if (interventionClaimCount >= 6) {
    reasons.push("high-coverage intervention");
  }

  if (!isEvidenceMapPlaceholderClaim(claim)) {
    reasons.push(`${compositeScore(claim.scores).toFixed(1)} composite`);
  }

  return reasons;
}

function ScoreReadinessWorklist({
  rows,
  summary
}: {
  rows: ScoreReadinessRow[];
  summary: ScoreReadinessSummary;
}) {
  const workRows = rows.filter((row) => row.state !== "scored");
  const visibleRows = workRows.slice(0, 12);
  const hiddenCount = Math.max(workRows.length - visibleRows.length, 0);

  return (
    <section className="rounded-lg border border-line bg-white p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-ink">Score readiness inventory</h3>
            <span className="rounded-md border border-amberline/25 bg-amber-50 px-2 py-1 text-xs font-semibold text-amberline">
              {summary.workItems.toLocaleString()} scoring work item(s)
            </span>
            {summary.defaultLookingPublicScores > 0 ? (
              <span className="rounded-md border border-danger/25 bg-red-50 px-2 py-1 text-xs font-semibold text-danger">
                {summary.defaultLookingPublicScores.toLocaleString()} default-looking public score(s)
              </span>
            ) : null}
          </div>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-700">
            Local-only scoring inventory. It separates claims ready for score review from
            source-blocked claims and flags starter-looking public scores before they read as final
            evidence.
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <MiniStat label="Ready to score" value={summary.readyToScore.toLocaleString()} />
        <MiniStat
          label="Default-looking scores"
          value={summary.defaultLookingPublicScores.toLocaleString()}
        />
        <MiniStat label="Source-blocked" value={summary.sourceBlocked.toLocaleString()} />
        <MiniStat label="Snapshot gaps" value={summary.snapshotGaps.toLocaleString()} />
        <MiniStat label="Scored public cells" value={summary.scoredPublicClaims.toLocaleString()} />
      </div>

      {visibleRows.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {visibleRows.map((row) => (
            <ScoreReadinessCard
              key={row.claim.id}
              row={row}
            />
          ))}
          {hiddenCount > 0 ? (
            <p className="rounded-md border border-line bg-mist px-3 py-2 text-xs leading-5 text-slate-600">
              Showing top {visibleRows.length.toLocaleString()} scoring work item(s);
              {" "}
              {hiddenCount.toLocaleString()} lower-priority item(s) remain below this cutoff.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 rounded-md border border-spruce/30 bg-teal-50 px-3 py-2 text-sm leading-6 text-spruce">
          No immediate scoring work is visible in the current local catalog.
        </p>
      )}
    </section>
  );
}

function ScoreReadinessCard({ row }: { row: ScoreReadinessRow }) {
  const claimUrl = row.intervention
    ? `/interventions/${row.intervention.slug}#claim-${row.claim.id}`
    : undefined;
  const scoreLabel =
    row.currentScore === null
      ? "No final score"
      : `${row.currentScore.toFixed(1)} ${scoreBand(row.currentScore)}`;

  return (
    <article className="rounded-md border border-line bg-mist p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-md border px-2 py-1 text-xs font-semibold",
                scoreReadinessStateTone(row.state)
              )}
            >
              {scoreReadinessStateLabel(row.state)}
            </span>
            <span
              className={cn(
                "rounded-md border px-2 py-1 text-xs font-semibold",
                scoreReadinessPriorityTone(row.priorityLabel)
              )}
              title={`Priority ${row.priority}`}
            >
              {row.priorityLabel} priority
            </span>
            <span
              className={cn(
                "rounded-md border px-2 py-1 text-xs font-semibold",
                sourcePacketCompletenessTone(row.packet.completeness.status)
              )}
            >
              {row.packet.completeness.label}
            </span>
          </div>
          <h4 className="mt-3 text-sm font-semibold text-ink">
            {row.intervention?.name ?? "Unknown intervention"} - {shortOutcome(row.claim.outcome)}
          </h4>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {scoreReadinessNextAction(row)}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {row.reasons.map((reason) => (
              <span
                className="rounded-md border border-line bg-white px-2 py-1 text-xs text-slate-600"
                key={reason}
              >
                {reason}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 text-xs lg:items-end">
          <span className="rounded-md border border-line bg-white px-2 py-1 font-semibold text-slate-700">
            {scoreLabel}
          </span>
          <span className={cn("rounded-md border px-2 py-1 font-semibold", labelTone(row.claim.finalLabel))}>
            {row.claim.finalLabel}
          </span>
          <span className="rounded-md border border-line bg-white px-2 py-1 font-semibold text-slate-700">
            {row.packet.completeness.extractedReferences}/
            {row.packet.completeness.totalReferences} refs extracted
          </span>
          {claimUrl ? (
            <a
              className="rounded-md border border-slate-300 bg-white px-2 py-1 font-semibold text-signal hover:border-signal"
              href={claimUrl}
            >
              Open claim
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function scoreReadinessStateTone(state: ScoreReadinessState) {
  switch (state) {
    case "default_score_review":
      return "border-danger/30 bg-red-50 text-danger";
    case "ready_to_score":
      return "border-signal/30 bg-blue-50 text-signal";
    case "scored":
      return "border-spruce/30 bg-teal-50 text-spruce";
    case "snapshot_gap":
      return "border-amberline/30 bg-amber-50 text-amberline";
    case "source_blocked":
      return "border-slate-300 bg-slate-50 text-slate-700";
  }
}

function scoreReadinessPriorityTone(priority: ScoreReadinessPriority) {
  if (priority === "High") {
    return "border-danger/30 bg-red-50 text-danger";
  }

  if (priority === "Medium") {
    return "border-amberline/30 bg-amber-50 text-amberline";
  }

  return "border-slate-300 bg-slate-50 text-slate-700";
}

function CatalogTrustPanel({
  data,
  summary
}: {
  data: EvidenceDashboardData;
  summary: CatalogTrustSummary;
}) {
  const hasAttentionItems = summary.previewAttentionItems.length > 0;
  const scoreReadinessRows = buildScoreReadinessRows(data);
  const scoreReadinessSummary = buildScoreReadinessSummary(scoreReadinessRows);
  const sourcePacketGapRows = buildSourcePacketGapRows(data);
  const sourcePacketGapSummary = buildSourcePacketGapSummary(sourcePacketGapRows);

  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="grid gap-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Local catalog trust
            </p>
            <h2 className="mt-1 text-lg font-semibold text-ink">
              {summary.interventions.total} interventions, {summary.claims.total} scoped claims
            </h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-700">
              This readout checks the local database catalog only. It separates source-packet
              completeness, trial registry leads, and product-level AU/TGA evidence so generic
              intervention evidence does not become product authorization.
            </p>
          </div>
          <span
            className={cn(
              "w-fit rounded-md border px-2 py-1 text-xs font-semibold",
              hasAttentionItems
                ? "border-amberline/30 bg-amber-50 text-amberline"
                : "border-spruce/30 bg-teal-50 text-spruce"
            )}
          >
            {hasAttentionItems ? "Needs local attention" : "No automated local blockers"}
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat
            label="Source packets"
            value={`${summary.claims.sourcePacketsComplete}/${summary.claims.sourcePacketsTotal} complete`}
          />
          <MiniStat
            label="Trial leads"
            value={`${summary.trials.nctIdFormat} NCT IDs, ${summary.trials.searchOnly} search-only`}
          />
          <MiniStat
            label="AU/TGA intervention rows"
            value={summary.australia.interventionCoverage}
          />
          <MiniStat
            label="Product AU/TGA"
            value={`${summary.australia.productExactStatusCount}/${summary.products.total} exact product statuses`}
          />
        </div>

        <ScoreReadinessWorklist
          rows={scoreReadinessRows}
          summary={scoreReadinessSummary}
        />

        <SourcePacketGapWorklist
          rows={sourcePacketGapRows}
          summary={sourcePacketGapSummary}
        />

        {hasAttentionItems ? (
          <div className="rounded-md border border-amberline/30 bg-amber-50 px-3 py-2">
            <p className="text-sm font-semibold text-amber-950">Before preview promotion</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-950">
              {summary.previewAttentionItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="rounded-md border border-line bg-mist px-3 py-2 text-xs leading-5 text-slate-600">
          Next useful local work: {summary.nextActions[0]}
        </p>
      </div>
    </section>
  );
}

function SourcePacketGapWorklist({
  rows,
  summary
}: {
  rows: SourcePacketGapRow[];
  summary: SourcePacketGapSummary;
}) {
  const visibleRows = rows.slice(0, 12);
  const hiddenCount = Math.max(rows.length - visibleRows.length, 0);

  return (
    <section className="rounded-lg border border-line bg-white p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-ink">Source packet gap worklist</h3>
            <span className="rounded-md border border-amberline/25 bg-amber-50 px-2 py-1 text-xs font-semibold text-amberline">
              {summary.totalGaps.toLocaleString()} incomplete
            </span>
            {summary.highPriority > 0 ? (
              <span className="rounded-md border border-danger/25 bg-red-50 px-2 py-1 text-xs font-semibold text-danger">
                {summary.highPriority.toLocaleString()} high priority
              </span>
            ) : null}
          </div>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-700">
            Ranked by source-packet severity, human-review status, linked-reference work, claim
            score, and intervention visibility. Fix these first to make public evidence cards more
            traceable.
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <MiniStat label="No curated sources" value={summary.noCuratedSources.toLocaleString()} />
        <MiniStat label="Extraction pending" value={summary.extractionPending.toLocaleString()} />
        <MiniStat label="Missing source records" value={summary.missingSources.toLocaleString()} />
        <MiniStat
          label="Human-reviewed affected"
          value={summary.humanReviewedAffected.toLocaleString()}
        />
        <MiniStat label="Pending references" value={summary.pendingReferences.toLocaleString()} />
      </div>

      {visibleRows.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {visibleRows.map((row) => (
            <SourcePacketGapCard
              key={row.claim.id}
              row={row}
            />
          ))}
          {hiddenCount > 0 ? (
            <p className="rounded-md border border-line bg-mist px-3 py-2 text-xs leading-5 text-slate-600">
              Showing top {visibleRows.length.toLocaleString()} source-packet gap(s);
              {" "}
              {hiddenCount.toLocaleString()} lower-priority gap(s) remain below this cutoff.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 rounded-md border border-spruce/30 bg-teal-50 px-3 py-2 text-sm leading-6 text-spruce">
          No incomplete source packets are visible in the current local catalog.
        </p>
      )}
    </section>
  );
}

function SourcePacketGapCard({ row }: { row: SourcePacketGapRow }) {
  const claimUrl = row.intervention
    ? `/interventions/${row.intervention.slug}#claim-${row.claim.id}`
    : undefined;

  return (
    <article className="rounded-md border border-line bg-mist p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-md border px-2 py-1 text-xs font-semibold",
                sourcePacketGapPriorityTone(row.priorityLabel)
              )}
              title={`Priority ${row.priority}`}
            >
              {row.priorityLabel} priority
            </span>
            <span
              className={cn(
                "rounded-md border px-2 py-1 text-xs font-semibold",
                sourcePacketCompletenessTone(row.packet.completeness.status)
              )}
            >
              {row.packet.completeness.label}
            </span>
            <ReviewStatusBadge status={row.claim.reviewStatus} />
          </div>
          <h4 className="mt-3 text-sm font-semibold text-ink">
            {row.intervention?.name ?? "Unknown intervention"} - {shortOutcome(row.claim.outcome)}
          </h4>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {row.packet.completeness.nextStep}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {row.reasons.map((reason) => (
              <span
                className="rounded-md border border-line bg-white px-2 py-1 text-xs text-slate-600"
                key={reason}
              >
                {reason}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 text-xs lg:items-end">
          <span className="rounded-md border border-line bg-white px-2 py-1 font-semibold text-slate-700">
            {row.packet.completeness.extractedReferences}/
            {row.packet.completeness.totalReferences} refs extracted
          </span>
          <span className={cn("rounded-md border px-2 py-1 font-semibold", labelTone(row.claim.finalLabel))}>
            {row.claim.finalLabel}
          </span>
          {claimUrl ? (
            <a
              className="rounded-md border border-slate-300 bg-white px-2 py-1 font-semibold text-signal hover:border-signal"
              href={claimUrl}
            >
              Open claim
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function sourcePacketGapPriorityTone(priority: SourcePacketGapPriority) {
  if (priority === "High") {
    return "border-danger/30 bg-red-50 text-danger";
  }

  if (priority === "Medium") {
    return "border-amberline/30 bg-amber-50 text-amberline";
  }

  return "border-slate-300 bg-slate-50 text-slate-700";
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
  if (isEvidenceMapPlaceholderClaim(claim)) {
    return "Review-needed classification";
  }

  return isHumanReviewed(claim.reviewStatus)
    ? "Human-reviewed classification"
    : "AI Draft Classification";
}

function compositeLabel(claim: Claim) {
  if (isEvidenceMapPlaceholderClaim(claim)) {
    return "Composite pending";
  }

  return isHumanReviewed(claim.reviewStatus) ? "Reviewed composite" : "Draft composite";
}

function scoreExplanationTitle(explanationKind: ScoreExplanationKind, value?: string) {
  const explanation = scoreExplanations[explanationKind];
  return [explanation.title, value, explanation.formula, explanation.detail]
    .filter(Boolean)
    .join(": ");
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
  const [operatorToken, setOperatorToken] = useState("");
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
        token stays in tab
      </span>
      {isApproving ? (
        <div className="absolute right-0 z-20 mt-2 w-[min(88vw,440px)] rounded-lg border border-line bg-white p-3 text-left shadow-panel">
          <p className="text-xs font-semibold text-ink">Operator mode review packet</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
              local only
            </span>
            <span className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
              token stays in tab
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Sends a read-only packet through the local operator sidecar. Paste the token for this
            tab only; source-candidate decisions and public evidence promotion stay human-owned.
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
              {sendStatus === "sending" ? "Sending" : "Send packet"}
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
  const scoreWorkClaims = buildScoreReadinessRows(data)
    .filter((row) => row.state !== "scored")
    .slice(0, 5);
  const sourceWorkClaims = buildSourcePacketGapRows(data).slice(0, 5);

  const scoreWorkLines =
    scoreWorkClaims.length > 0
      ? scoreWorkClaims.map(({ claim, currentScore, intervention, packet, state }) => {
          const scoreLabel =
            currentScore === null ? "no final score" : `${currentScore.toFixed(1)}/10`;
          return `- ${claim.id} (${intervention?.name ?? "Unknown intervention"} / ${claim.outcome}): ${scoreReadinessStateLabel(state)}; ${scoreLabel}; ${packet.completeness.label}; ${scoreReadinessNextAction({ claim, currentScore, intervention, packet, priority: 0, priorityLabel: "Low", reasons: [], state })}`;
        })
      : ["- No immediate local scoring work items in the current dashboard data."];
  const sourceWorkLines =
    sourceWorkClaims.length > 0
      ? sourceWorkClaims.map(({ claim, intervention, packet, priorityLabel }) => {
          return `- ${claim.id} (${intervention?.name ?? "Unknown intervention"} / ${claim.outcome}): ${priorityLabel} priority; ${packet.completeness.label}; ${packet.completeness.nextStep}`;
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
    "Priority scoring work:",
    ...scoreWorkLines,
    "",
    "Priority source-packet work:",
    ...sourceWorkLines,
    "",
    "Requested Codex output:",
    "- Find dashboard and evidence-source deficiencies.",
    "- Suggest source-ingestion or curation improvements as human-reviewed tasks.",
    "- Write Codex-ready implementation tasks with targeted tests.",
    "- Do not perform writes or make source-candidate decisions unless I explicitly approve them in this thread."
  ].join("\n");
}

type EvidenceMapStatusFilter = "all" | "scored" | "review-work";

type EvidenceMapReadinessSummary = {
  completeSourcePackets: number;
  draftClaims: number;
  draftLeadClaims: number;
  extractedReferences: number;
  humanReviewedClaims: number;
  incompleteSourcePackets: number;
  pendingReferences: number;
  reviewWorkClaims: number;
  scoredClaims: number;
  sourcePacketScaffoldClaims: number;
  totalClaims: number;
  totalReferences: number;
};

const EVIDENCE_MAP_STATUS_FILTERS: Array<{
  id: EvidenceMapStatusFilter;
  label: string;
  title: string;
}> = [
  {
    id: "all",
    label: "All",
    title: "Show every scoped evidence-map cell matching the current filters."
  },
  {
    id: "scored",
    label: "Scored",
    title: "Show cells with composite scores assigned from the evidence."
  },
  {
    id: "review-work",
    label: "Review work",
    title: "Show draft leads and source-packet scaffolds that still need evidence scoring."
  }
];

type EvidenceMapSort =
  | {
      direction: "asc" | "desc";
      outcome: OutcomeArea;
    }
  | null;

function isDraftLeadClaim(claim: Claim) {
  return claim.evidenceGrade === DRAFT_LEAD_EVIDENCE_GRADE;
}

function isSourcePacketScaffoldClaim(claim: Claim) {
  return claim.evidenceGrade === SOURCE_PACKET_REVIEW_EVIDENCE_GRADE;
}

function isEvidenceMapPlaceholderClaim(claim: Claim) {
  return isDraftLeadClaim(claim) || isSourcePacketScaffoldClaim(claim);
}

function claimMatchesEvidenceMapStatusFilter(
  claim: Claim,
  statusFilter: EvidenceMapStatusFilter
) {
  if (statusFilter === "scored") {
    return !isEvidenceMapPlaceholderClaim(claim);
  }

  if (statusFilter === "review-work") {
    return isEvidenceMapPlaceholderClaim(claim);
  }

  return true;
}

function buildEvidenceMapReadinessSummary({
  claims,
  referencesById,
  studies
}: {
  claims: Claim[];
  referencesById: Map<string, Reference>;
  studies: Study[];
}): EvidenceMapReadinessSummary {
  const packetSummary = summarizeClaimSourcePackets({ claims, referencesById, studies });
  const draftLeadClaims = claims.filter(isDraftLeadClaim).length;
  const sourcePacketScaffoldClaims = claims.filter(isSourcePacketScaffoldClaim).length;

  return {
    completeSourcePackets: packetSummary.completeClaims,
    draftClaims: claims.filter((claim) => !isHumanReviewed(claim.reviewStatus)).length,
    draftLeadClaims,
    extractedReferences: packetSummary.extractedReferences,
    humanReviewedClaims: claims.filter((claim) => isHumanReviewed(claim.reviewStatus)).length,
    incompleteSourcePackets:
      packetSummary.extractionPendingClaims +
      packetSummary.missingSourceClaims +
      packetSummary.unlinkedClaims,
    pendingReferences: packetSummary.pendingReferences + packetSummary.missingReferences,
    reviewWorkClaims: draftLeadClaims + sourcePacketScaffoldClaims,
    scoredClaims: claims.filter((claim) => !isEvidenceMapPlaceholderClaim(claim)).length,
    sourcePacketScaffoldClaims,
    totalClaims: claims.length,
    totalReferences: packetSummary.totalReferences
  };
}

function evidenceMapSortableScore(claim: Claim | undefined) {
  if (!claim || isEvidenceMapPlaceholderClaim(claim)) {
    return null;
  }

  return compositeScore(claim.scores);
}

function evidenceMapCellPresentation(claim: Claim, score: number) {
  if (isDraftLeadClaim(claim)) {
    return {
      ariaSummary:
        "discovery lead awaiting source review; no final evidence score has been assigned",
      primary: "Lead",
      secondary: "Draft",
      title:
        "Discovery lead awaiting source review. The stored starter score is hidden because it is not a final evidence score.",
      tone:
        "border-dashed border-amberline/35 bg-amber-50 text-amberline hover:border-amberline hover:bg-amber-50"
    };
  }

  if (isSourcePacketScaffoldClaim(claim)) {
    return {
      ariaSummary:
        "source-packet scaffold awaiting evidence review; no final evidence score has been assigned",
      primary: "Needs",
      secondary: "Review",
      title:
        "Source-packet scaffold awaiting evidence review. The stored placeholder score is hidden because it is not a final evidence score.",
      tone:
        "border-dashed border-slate-300 bg-slate-50 text-slate-600 hover:border-signal hover:bg-blue-50"
    };
  }

  return {
    ariaSummary: `${compositeLabel(claim)} ${score.toFixed(1)} out of 10, ${scoreBand(score)} band`,
    primary: score.toFixed(1),
    secondary: scoreBand(score),
    title: scoreExplanationTitle("composite", `${score.toFixed(1)}/10`),
    tone: labelTone(claim.finalLabel)
  };
}

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

    return evidenceMapSortableScore(claim);
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

function EvidenceMapReadinessStrip({
  onStatusFilterChange,
  statusFilter,
  summary
}: {
  onStatusFilterChange: (statusFilter: EvidenceMapStatusFilter) => void;
  statusFilter: EvidenceMapStatusFilter;
  summary: EvidenceMapReadinessSummary;
}) {
  const totalClaimsLabel = summary.totalClaims.toLocaleString();
  const scoredLabel = `${summary.scoredClaims.toLocaleString()}/${totalClaimsLabel}`;
  const humanReviewedLabel = `${summary.humanReviewedClaims.toLocaleString()}/${totalClaimsLabel}`;
  const sourcePacketLabel = `${summary.completeSourcePackets.toLocaleString()}/${totalClaimsLabel}`;
  const reviewWorkDetail =
    summary.reviewWorkClaims === 0
      ? "No draft leads or scaffolds in the current filters"
      : `${summary.draftLeadClaims.toLocaleString()} lead, ${summary.sourcePacketScaffoldClaims.toLocaleString()} scaffold`;

  return (
    <section aria-label="Evidence map readiness" className="mt-4 border-t border-line pt-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-ink">Evidence readiness</h3>
            <span className="rounded-md border border-spruce/25 bg-teal-50 px-2 py-1 text-xs font-semibold text-spruce">
              {summary.scoredClaims.toLocaleString()} scored
            </span>
            <span className="rounded-md border border-amberline/25 bg-amber-50 px-2 py-1 text-xs font-semibold text-amberline">
              {summary.reviewWorkClaims.toLocaleString()} review work
            </span>
          </div>
          <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-600">
            Scored cells are review aids, not treatment advice. Review-work cells keep draft leads visible
            without showing starter scores as final evidence.
          </p>
        </div>
        <div
          aria-label="Evidence map cell status"
          className="inline-flex w-fit overflow-hidden rounded-md border border-line bg-white p-0.5 text-xs font-semibold"
          role="group"
        >
          {EVIDENCE_MAP_STATUS_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                "px-3 py-1.5 transition hover:text-signal focus:outline-none focus:ring-4 focus:ring-signal/20",
                statusFilter === item.id
                  ? "rounded bg-signal text-white hover:text-white"
                  : "text-slate-700"
              )}
              onClick={() => onStatusFilterChange(item.id)}
              title={item.title}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <EvidenceReadinessBadge label="Scored cells" value={scoredLabel} />
        <EvidenceReadinessBadge label="Human reviewed" value={humanReviewedLabel} />
        <EvidenceReadinessBadge
          label="Source packets complete"
          value={sourcePacketLabel}
          title={`${summary.incompleteSourcePackets.toLocaleString()} claim(s) still need source-packet linking or extraction.`}
        />
        <EvidenceReadinessBadge label="Review-work mix" value={reviewWorkDetail} />
        <EvidenceReadinessBadge
          label="References extracted"
          value={`${summary.extractedReferences.toLocaleString()}/${summary.totalReferences.toLocaleString()}`}
          title={`${summary.pendingReferences.toLocaleString()} linked reference(s) still need extraction or repair.`}
        />
        <EvidenceReadinessBadge
          label="Pending human review"
          value={summary.draftClaims.toLocaleString()}
          title="AI-draft claims remain pending until a human checks the source packet against the scoped claim."
        />
      </div>
    </section>
  );
}

function EvidenceReadinessBadge({
  label,
  title,
  value
}: {
  label: string;
  title?: string;
  value: string;
}) {
  return (
    <span
      className="rounded-md border border-line bg-mist px-2 py-1 text-slate-600"
      title={title}
    >
      <span className="font-semibold text-ink">{label}:</span> {value}
    </span>
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
        No evidence-map cells match the current filters and map mode. Clear the search, category, label,
        outcome, or map-mode filter to rebuild the evidence map.
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
        <strong>Lead / Draft</strong> = discovery lead; no final score yet
      </span>
      <span className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1">
        <strong className="text-ink">Needs / Review</strong> = scaffold awaiting source-packet scoring
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
          Reviewed/source-scored cells show a composite score. Draft leads and scaffolds show review
          status instead of placeholder numbers.
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
        const cell = evidenceMapCellPresentation(claim, score);

        return (
          <td key={claim.id} className="h-14 w-[4.25rem] min-w-[4.25rem] max-w-[4.75rem] p-0 align-middle">
            <button
              type="button"
              onClick={() => onSelectClaim(claim.id, { scrollToDetail: true })}
              className={cn(
                "flex h-14 w-full flex-col items-center justify-center rounded-md border px-1 text-center text-[11px] leading-tight transition hover:border-signal hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-signal/20",
                cell.tone,
                activeClaimId === claim.id && "border-signal ring-2 ring-signal/25"
              )}
              aria-label={`${intervention.name}, ${claim.outcome}: ${cell.ariaSummary}, ${classificationLabel(
                claim
              )} ${claim.finalLabel}, review status ${reviewStatusLabel(claim.reviewStatus)}.`}
              title={cell.title}
            >
              <span className="font-semibold">{cell.primary}</span>
              <span className="max-w-full truncate">{cell.secondary}</span>
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
        cell: ({ row }) =>
          row.original.composite === null ? (
            <span
              className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600"
              title="Composite score pending until the source packet is reviewed."
            >
              Review work
            </span>
          ) : (
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
          No claim rows match the current filters. Clear the search, category, label, or outcome filter to
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
                    <MiniStat
                      label={isEvidenceMapPlaceholderClaim(claim) ? "Last updated" : "Last reviewed"}
                      value={claim.lastUpdated}
                    />
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
  const exactProductStatusCount = productSignals.filter((product) => {
    const verification = productAustraliaVerificationById.get(product.id);
    return (
      verification?.state === "Verified" &&
      Boolean(verification.status?.austNumber || verification.status?.artgId)
    );
  }).length;
  const unknownProductStatusCount = productSignals.filter((product) => {
    const verification = productAustraliaVerificationById.get(product.id);
    return verification?.state === "Unknown" || verification?.state === "Missing";
  }).length;

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
        <div className="rounded-lg border border-line bg-white p-3 sm:col-span-2">
          <p className="text-sm font-semibold text-ink">Product-level AU/TGA status</p>
          <p className="mt-1 text-sm leading-6 text-slate-700">
            {exactProductStatusCount}/{productSignals.length} product profiles have exact
            AUST/ARTG identifiers captured. {unknownProductStatusCount} remain unknown or missing;
            do not infer product authorization from intervention evidence or quality scores.
          </p>
        </div>
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
  const nctIdFormatCount = trialWatchItems.filter((item) => isNctIdFormat(item.nctId)).length;
  const searchOnlyCount = trialWatchItems.length - nctIdFormatCount;
  const resultsPostedCount = trialWatchItems.filter((item) => item.resultsPosted).length;

  return (
    <section className={dashboardPanelShellClassName(embedded)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">Trial Watcher</h2>
        {trialWatchItems.length > 0 ? (
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-md border border-line bg-mist px-2 py-1 text-slate-700">
              {trialWatchItems.length} local leads
            </span>
            <span className="rounded-md border border-spruce/30 bg-teal-50 px-2 py-1 text-spruce">
              {nctIdFormatCount} NCT IDs
            </span>
            {searchOnlyCount > 0 ? (
              <span className="rounded-md border border-amberline/30 bg-amber-50 px-2 py-1 text-amberline">
                {searchOnlyCount} search-only
              </span>
            ) : null}
            <span className="rounded-md border border-line bg-white px-2 py-1 text-slate-700">
              {resultsPostedCount} results posted
            </span>
          </div>
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
                  {!isNctIdFormat(item.nctId) ? (
                    <p className="mt-3 rounded-md border border-amberline/30 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
                      This is a search-only registry lead. Pick an NCT record before using it
                      as curated trial context.
                    </p>
                  ) : null}
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
