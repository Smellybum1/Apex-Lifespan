"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
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
  CircleHelp,
  ClipboardCheck,
  ExternalLink,
  FileSearch,
  Filter,
  FlaskConical,
  Search,
  ShieldCheck
} from "lucide-react";
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
import { australiaRegulatoryTone } from "@/lib/regulatory";
import {
  buildParsedAustraliaRegulatoryIdentifierVerifications,
  buildProductAustraliaRegulatoryVerifications,
  type ParsedAustraliaRegulatoryIdentifierVerification,
  type ProductAustraliaRegulatoryVerification
} from "@/lib/australia-regulatory-verification";
import { buildProductLabelVerificationSummary } from "@/lib/product-label-verification";
import {
  analyzeLabel,
  assessLabelProductQuality,
  compositeScore,
  labelTone,
  parseLabelCertifications,
  parseLabelDoseCues,
  parseLabelIngredients,
  parseLabelProductIdentifiers,
  type ParsedLabelIngredient,
  scoreBand,
  severityTone
} from "@/lib/scoring";
import { summarizeReviewStatus } from "@/lib/review-summary";
import {
  formatSafetyAlertRegionLabel,
  normalizeSafetyReviewRegion,
  type RegionalSafetyRegulatoryReviewGap,
  safetyDomainForAlertType,
  summarizeSafetyAlertsByDomain,
  summarizeSafetyDomainCoverage,
  summarizeRegionalSafetyDomainCoverage,
  summarizeRegionalSafetyRegulatoryCoverage,
  summarizeRegionalSafetyRegulatoryReviewGaps
} from "@/lib/safety-domains";
import {
  buildClaimSourcePacket,
  summarizeClaimSourcePackets,
  type ClaimSourcePacket,
  type ClaimSourcePacketSummary,
  type EvidenceDepthBadge
} from "@/lib/source-packet";
import { buildSourceSearchQueries } from "@/lib/source-queries";
import { formatProductRegionLabel } from "@/lib/product-signals";
import {
  buildProductFormulationEvidenceMappings,
  type ProductFormulationEvidenceMapping
} from "@/lib/product-efficacy-mapping";
import {
  buildEvidenceHumanReviewQueue,
  type EvidenceCoverageHumanReviewQueue,
  type EvidenceCoverageHumanReviewQueueItem
} from "@/lib/evidence-coverage";
import {
  supplementGoalCategories,
  supplementGoalCategoryForOutcome,
  type SupplementGoalCategory,
  type SupplementGoalCategoryId
} from "@/lib/outcome-categories";
import type {
  Claim,
  EvidenceDashboardData,
  EvidenceLabel,
  AustraliaRegulatoryKind,
  AustraliaRegulatoryStatus,
  Intervention,
  OutcomeArea,
  ProductSignal,
  Reference,
  SafetyAlert,
  Study,
  TrialAlert,
  TrialWatchItem
} from "@/lib/types";
import { cn } from "@/lib/utils";

type ClaimTableRow = {
  aiConfidenceScore: number;
  id: string;
  intervention: string;
  outcome: string;
  label: EvidenceLabel;
  sourcePacketStatus: ClaimSourcePacket["completeness"]["status"];
  sourcePacketLabel: string;
  composite: number;
  confidenceWeightedComposite: number;
  confidenceWeight: number;
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
const SAFETY_DOMAIN_ALL = "All safety domains";
const SAFETY_SEVERITY_ALL = "All safety severity labels";
const SAFETY_REGION_ALL = "All safety regions";
const AUSTRALIA_REGULATORY_KIND_ALL = "All AU/TGA contexts";
const PRODUCT_REGULATORY_KIND_ALL = "All product AU/TGA contexts";
const PRODUCT_REGULATORY_KIND_UNCAPTURED = "Uncaptured AU status";
const PRODUCT_QUALITY_ALL = "All product quality signals";
const PRODUCT_FORMULATION_ALL = "All formulation evidence";
const productFormulationFilterOptions = [
  PRODUCT_FORMULATION_ALL,
  "Fully ingredient-mapped",
  "Has unmatched ingredients",
  "Product-specific evidence captured",
  "No local ingredient match"
] as const;
const supportedSafetyDomains: SafetyAlert["alertType"][] = [
  "Liver injury",
  "Kidney risk",
  "Contamination",
  "Adulteration",
  "Mislabeling",
  "Prohibited in sport",
  "Prescription-only",
  "Unapproved therapeutic good",
  "Compounding restriction",
  "Drug interaction"
];
const supportedSafetySeverities: SafetyAlert["severity"][] = [
  "Low",
  "Moderate",
  "High",
  "Clinician review recommended",
  "Avoid"
];
const productQualityFilterOptions = [
  PRODUCT_QUALITY_ALL,
  "Higher quality signal",
  "Mixed quality signal",
  "Needs quality review"
] as const;
const compositeScoreFormula =
  "Composite = directness + rigor + impact + safety + measurability - hype/regulatory penalty.";
const compositeScoreDetail =
  "Weighted 0-10 review aid: directness 22%, rigor 22%, impact 18%, safety 14%, low regulatory risk 10%, low hype 8%, and measurability 6%. The formula is partly heuristic and is not medical advice.";

type ScoreExplanationKind =
  | "claimRisk"
  | "composite"
  | "confidenceWeightedComposite"
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
type AustraliaRegulatoryKindFilter =
  | AustraliaRegulatoryKind
  | typeof AUSTRALIA_REGULATORY_KIND_ALL;
type ProductRegulatoryKindFilter =
  | AustraliaRegulatoryKind
  | typeof PRODUCT_REGULATORY_KIND_ALL
  | typeof PRODUCT_REGULATORY_KIND_UNCAPTURED;
type ProductQualityFilter = (typeof productQualityFilterOptions)[number];
type ProductFormulationFilter = (typeof productFormulationFilterOptions)[number];
type IngredientEvidenceMapping = {
  claims: Claim[];
  ingredient: ParsedLabelIngredient;
  intervention?: Intervention;
};

type DashboardTabId =
  | "evidence-map"
  | "claim-scores"
  | "ai-confidence"
  | "safety-center"
  | "evidence-cards"
  | "product-label-analyzer"
  | "trial-watcher"
  | "sources-review";
type DashboardTab = {
  detail: string;
  id: DashboardTabId;
  label: string;
};
type PanelExplanation = {
  body: string[];
  summary: string;
};
type SourcePacketGapItem = {
  claimId: string;
  interventionName: string;
  interventionSlug?: string;
  label: string;
  nextStep: string;
  outcomeLabel: string;
};

const panelExplanations = {
  "ai-confidence": {
    body: [
      "Use this when you want to see which claim packets can already contribute to scoring and how much influence they should have. A low AI confidence score does not mean the packet is useless; it means the packet should have lower weight until traceability, source extraction, claim fit, or caveats improve.",
      "The weighted score shown here is the raw composite multiplied by AI confidence. That makes uncertain packets visible without letting them dominate the dashboard.",
      "This overlaps with Claim Scores because both show weighted score. The difference is that AI Confidence explains why confidence is high or low, while Claim Scores is better for sorting all claims in a compact table.",
      "This is not a clinical review, product recommendation, TGA/ARTG clearance, or an approval workflow. It does not write evidence rows or mark claims reviewed."
    ],
    summary:
      "Explains the confidence multiplier behind each claim packet and shows how much impact uncertain evidence should have."
  },
  "claim-scores": {
    body: [
      "Use this as the compact sortable ledger of all intervention-outcome claims. Each row is one scoped claim, such as a supplement and one outcome area, not a general rating for the entire supplement.",
      "The Weighted column is the main quick-iteration score: raw composite score multiplied by AI confidence. The Raw score column stays visible so you can tell whether a claim is weak because the evidence signal is weak, because confidence is low, or both.",
      "This overlaps with Evidence Map because both use the same weighted scoring idea. Claim Scores is better for precise row sorting and comparing numeric components; Evidence Map is better for scanning a supplement across goal categories.",
      "Scores are review aids. They are not individualized medical advice, dosing guidance, product verification, or a substitute for source traceability."
    ],
    summary:
      "A sortable row-by-row score table for comparing scoped claims and their confidence-weighted impact."
  },
  "evidence-cards": {
    body: [
      "Use this when you want the narrative card for each scoped claim: claim text, classification label, confidence label, non-proof statements, source badges, and concise research context.",
      "Evidence Cards are the human-readable version of the scoring rows. They explain what the claim says, what it does not prove, and which references are attached.",
      "This overlaps with Claim Scores and Sources and Review Queue. Claim Scores is better for comparing numbers; Evidence Cards is better for reading the claim boundary; Sources and Review Queue is better for inspecting the source packet and live search leads.",
      "The cards should preserve uncertainty. A card can be useful even when confidence is low, but it should not imply clinical certainty, product-level clearance, or broad supplement-wide benefit."
    ],
    summary:
      "Readable claim cards that explain the boundary, label, confidence, non-proof statements, and linked references."
  },
  "evidence-map": {
    body: [
      "Use this as the main cockpit for scanning supplements across practical goal categories such as Strength, Sleep, Heart, Safety, and Lifespan.",
      "Each cell shows the best available confidence-weighted claim score for that supplement and goal category. The small raw-score note shows the raw composite and AI confidence multiplier behind the weighted score.",
      "This overlaps with Claim Scores because the map uses the same underlying claims. The map is intentionally less detailed: it is for pattern recognition and navigation, not full evidence inspection.",
      "Empty cells mean not yet assessed in the local dataset. They do not mean no evidence exists, and they do not mean the supplement is safe, unsafe, effective, or ineffective."
    ],
    summary:
      "The high-level scan view for comparing supplements across goal categories using confidence-weighted scores."
  },
  "product-label-analyzer": {
    body: [
      "Use this for pasted product-label text and captured product profiles. It parses ingredients, amounts, certifications, AUST identifiers, product-quality signals, and label-risk flags.",
      "This panel separates product-quality signals from efficacy evidence and from Australian regulatory status. A certification or clean-looking label can improve product-quality context without proving the product works or is authorized.",
      "This overlaps with Safety Center because label text can surface safety or regulatory flags. Safety Center summarizes reviewed local alerts; Product Label Analyzer is a label/product-context workspace.",
      "Parsed label findings are cues for review. They are not product recommendations, dosing advice, or proof of product-level TGA/ARTG status."
    ],
    summary:
      "A product-label workspace for parsing ingredients, identifiers, quality cues, and product-level caveats."
  },
  "safety-center": {
    body: [
      "Use this to review safety, regulatory, and regional warning coverage across the local dataset. It groups alerts by safety domain and by configured review scope, with Australia/TGA kept prominent.",
      "This panel is about captured warning coverage, not benefit scoring. It helps you see where risks, jurisdiction-specific warnings, or missing regional review coverage should affect interpretation.",
      "This overlaps with Evidence Map's Safety column and Product Label Analyzer. The Safety column is a score view; Product Label Analyzer checks pasted labels; Safety Center is the broader reviewed-alert and regional-gap view.",
      "A missing alert means no reviewed local alert is captured. It does not imply safety, efficacy, product authorization, or absence of current regulator warnings."
    ],
    summary:
      "The risk and regulatory coverage view for reviewed alerts, safety domains, and regional review gaps."
  },
  "sources-review": {
    body: [
      "Use this when you want to inspect the selected claim's source packet: linked references, extracted study rows, source completeness, and live PubMed or ClinicalTrials.gov search leads.",
      "This is the most source-provenance-heavy panel. It is where you check whether a claim has enough linked, extracted, traceable evidence to support its score and confidence.",
      "This overlaps with AI Confidence because source completeness affects the confidence multiplier. AI Confidence summarizes the consequence; Sources and Review Queue shows the underlying packet and search leads.",
      "Live search results are unreviewed leads and their priority scores rank what to inspect next. They do not automatically change public scores, promote evidence, or approve claims."
    ],
    summary:
      "The source-traceability workspace for selected claims, extracted studies, and live citation or trial leads."
  },
  "trial-watcher": {
    body: [
      "Use this to monitor clinical trial records and trial alert leads that may change the evidence picture later.",
      "Trial Watcher is forward-looking. It helps track active, completed, missing-results, or result-posted trials so they can be reviewed before any score changes are made.",
      "This overlaps with Sources and Review Queue because both can show ClinicalTrials.gov material. Trial Watcher is for monitoring trial leads over time; Sources and Review Queue is for the currently selected claim's source packet and live searches.",
      "Trial alerts do not change scores by themselves. Outcomes still need extraction, citation links, claim-fit checks, and explicit review before influencing public evidence."
    ],
    summary:
      "A monitoring view for trial leads and alerts that might justify future evidence updates after review."
  }
} satisfies Record<DashboardTabId, PanelExplanation>;

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
  confidenceWeightedComposite: {
    detail:
      "Confidence-weighted score keeps the raw 0-10 composite visible, then multiplies it by the AI evidence-confidence score. Low-confidence packets still contribute, but with lower impact until source quality, extraction, claim fit, and caveats improve.",
    formula: "Weighted score = raw composite x AI confidence / 100.",
    title: "Confidence-weighted score"
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

function uniqueSorted<T extends string>(items: T[]) {
  return Array.from(new Set(items)).sort((first, second) => first.localeCompare(second));
}

export function EvidenceDashboard({ data }: { data: EvidenceDashboardData }) {
  const {
    australiaRegulatoryStatuses,
    claims,
    interventions,
    productSignals,
    references,
    safetyAlerts,
    studies,
    trialAlerts = [],
    trialWatchItems
  } = data;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [safetyDomain, setSafetyDomain] = useState(SAFETY_DOMAIN_ALL);
  const [safetySeverity, setSafetySeverity] = useState(SAFETY_SEVERITY_ALL);
  const [safetyRegion, setSafetyRegion] = useState(SAFETY_REGION_ALL);
  const [australiaRegulatoryKind, setAustraliaRegulatoryKind] =
    useState<AustraliaRegulatoryKindFilter>(AUSTRALIA_REGULATORY_KIND_ALL);
  const [activeClaimId, setActiveClaimId] = useState(claims[0]?.id ?? "");
  const [activeDashboardTab, setActiveDashboardTab] =
    useState<DashboardTabId>("evidence-map");
  const [labelText, setLabelText] = useState(
    "Creatine monohydrate 5 g\nVitamin D3 400 IU\nVitamin A 5,000 IU (as retinyl palmitate)\nVitamin E 400 IU (as d-alpha-tocopherol)\nFolate 680 mcg DFE (400 mcg folic acid)\nNiacin 16 mg NE\nNSF Certified for Sport\nNo proprietary blend"
  );
  const hasActiveEvidenceMapFilters =
    query.trim().length > 0 ||
    category !== "All" ||
    safetyDomain !== SAFETY_DOMAIN_ALL ||
    safetyRegion !== SAFETY_REGION_ALL ||
    safetySeverity !== SAFETY_SEVERITY_ALL ||
    australiaRegulatoryKind !== AUSTRALIA_REGULATORY_KIND_ALL;
  const resetEvidenceMapFilters = () => {
    setQuery("");
    setCategory("All");
    setSafetyDomain(SAFETY_DOMAIN_ALL);
    setSafetyRegion(SAFETY_REGION_ALL);
    setSafetySeverity(SAFETY_SEVERITY_ALL);
    setAustraliaRegulatoryKind(AUSTRALIA_REGULATORY_KIND_ALL);
  };

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

  const safetyAlertsByInterventionId = useMemo(() => {
    const grouped = new Map<string, SafetyAlert[]>();

    safetyAlerts.forEach((alert) => {
      grouped.set(alert.interventionId, [
        ...(grouped.get(alert.interventionId) ?? []),
        alert
      ]);
    });

    return grouped;
  }, [safetyAlerts]);

  const australiaStatusByInterventionId = useMemo(
    () =>
      new Map(
        australiaRegulatoryStatuses
          .filter((status) => status.interventionId)
          .map((status) => [status.interventionId as string, status])
      ),
    [australiaRegulatoryStatuses]
  );

  const safetyDomainOptions = useMemo(
    () => [
      SAFETY_DOMAIN_ALL,
      ...uniqueSorted([
        ...supportedSafetyDomains,
        ...safetyAlerts.map((alert) => alert.alertType)
      ])
    ],
    [safetyAlerts]
  );

  const safetyRegionOptions = useMemo(
    () => [
      SAFETY_REGION_ALL,
      ...uniqueSorted(safetyAlerts.map((alert) => normalizeSafetyReviewRegion(alert.region)))
    ],
    [safetyAlerts]
  );

  const safetySeverityOptions = useMemo(
    () => [
      SAFETY_SEVERITY_ALL,
      ...uniqueSorted([
        ...supportedSafetySeverities,
        ...safetyAlerts.map((alert) => alert.severity)
      ])
    ],
    [safetyAlerts]
  );

  const australiaRegulatoryKindOptions = useMemo(
    () => [
      AUSTRALIA_REGULATORY_KIND_ALL,
      ...uniqueSorted(
        australiaRegulatoryStatuses
          .filter((status) => status.interventionId)
          .map((status) => status.kind)
      )
    ],
    [australiaRegulatoryStatuses]
  );

  const filteredInterventions = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return interventions.filter((intervention) => {
      const interventionAlerts = safetyAlertsByInterventionId.get(intervention.id) ?? [];
      const australiaStatus = australiaStatusByInterventionId.get(intervention.id);
      const categoryMatch = category === "All" || intervention.category === category;
      const queryMatch =
        !normalized ||
        intervention.name.toLowerCase().includes(normalized) ||
        intervention.synonyms.some((synonym) => synonym.toLowerCase().includes(normalized));
      const safetyDomainMatch =
        safetyDomain === SAFETY_DOMAIN_ALL ||
        interventionAlerts.some((alert) => alert.alertType === safetyDomain);
      const safetySeverityMatch =
        safetySeverity === SAFETY_SEVERITY_ALL ||
        interventionAlerts.some((alert) => alert.severity === safetySeverity);
      const safetyRegionMatch =
        safetyRegion === SAFETY_REGION_ALL ||
        interventionAlerts.some(
          (alert) => normalizeSafetyReviewRegion(alert.region) === safetyRegion
        );
      const australiaRegulatoryMatch =
        australiaRegulatoryKind === AUSTRALIA_REGULATORY_KIND_ALL ||
        australiaStatus?.kind === australiaRegulatoryKind;

      return (
        categoryMatch &&
        queryMatch &&
        safetyDomainMatch &&
        safetySeverityMatch &&
        safetyRegionMatch &&
        australiaRegulatoryMatch
      );
    });
  }, [
    australiaRegulatoryKind,
    australiaStatusByInterventionId,
    category,
    interventions,
    query,
    safetyAlertsByInterventionId,
    safetyDomain,
    safetySeverity,
    safetyRegion
  ]);

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
  const reviewSummary = useMemo(() => summarizeReviewStatus(claims), [claims]);
  const humanReviewQueue = useMemo(() => buildEvidenceHumanReviewQueue(data), [data]);
  const confidenceQueueItemsByClaimId = useMemo(
    () => new Map(humanReviewQueue.items.map((item) => [item.claimId, item])),
    [humanReviewQueue]
  );
  const sourcePacketSummary = useMemo(
    () =>
      summarizeClaimSourcePackets({
        claims,
        referencesById,
        studies
      }),
    [claims, referencesById, studies]
  );
  const sourcePacketGapItems = useMemo(
    () =>
      claims
        .map((claim): SourcePacketGapItem | null => {
          const packet = buildClaimSourcePacket({
            claim,
            referencesById,
            studies
          });

          if (packet.completeness.status === "complete") {
            return null;
          }

          return {
            claimId: claim.id,
            interventionName:
              interventionsById.get(claim.interventionId)?.name ?? "Unknown intervention",
            interventionSlug: interventionsById.get(claim.interventionId)?.slug,
            label: packet.completeness.label,
            nextStep: packet.completeness.nextStep,
            outcomeLabel: shortOutcome(claim.outcome)
          };
        })
        .filter((item): item is SourcePacketGapItem => Boolean(item)),
    [claims, interventionsById, referencesById, studies]
  );
  const safetyAlertInterventionCount = useMemo(
    () => countUniqueIds(safetyAlerts.map((alert) => alert.interventionId)),
    [safetyAlerts]
  );
  const australiaRegulatoryInterventionCount = useMemo(
    () =>
      countUniqueIds(
        australiaRegulatoryStatuses.map((status) => status.interventionId)
      ),
    [australiaRegulatoryStatuses]
  );
  const trialLeadCount = trialWatchItems.length + trialAlerts.length;

  const tableRows = useMemo(
    () =>
      filteredClaims.map((claim) => {
        const sourcePacket = buildClaimSourcePacket({
          claim,
          referencesById,
          studies
        });
        const rawComposite = compositeScore(claim.scores);
        const confidenceItem = confidenceQueueItemsByClaimId.get(claim.id);

        return {
          aiConfidenceScore: confidenceItem?.aiConfidenceScore ?? 100,
          id: claim.id,
          intervention: interventionsById.get(claim.interventionId)?.name ?? "Unknown",
          outcome: claim.outcome,
          label: claim.finalLabel,
          sourcePacketStatus: sourcePacket.completeness.status,
          sourcePacketLabel: sourcePacket.completeness.label,
          composite: rawComposite,
          confidenceWeightedComposite:
            confidenceItem?.confidenceWeightedScore ?? rawComposite,
          confidenceWeight: confidenceItem?.confidenceWeight ?? 1,
          safety: claim.scores.safety,
          regulatoryRisk: claim.scores.regulatoryRisk,
          confidence: claim.confidenceLevel,
          updated: claim.lastUpdated
        };
      }),
    [confidenceQueueItemsByClaimId, filteredClaims, interventionsById, referencesById, studies]
  );

  const dashboardTabs: DashboardTab[] = [
    {
      detail: `${filteredClaims.length}/${claims.length} claims`,
      id: "evidence-map",
      label: "Evidence Map"
    },
    {
      detail: `${tableRows.length} rows`,
      id: "claim-scores",
      label: "Claim Scores"
    },
    {
      detail: `${humanReviewQueue.aiConfidenceAverage}/100 avg`,
      id: "ai-confidence",
      label: "AI Confidence"
    },
    {
      detail: `${safetyAlerts.length} alerts`,
      id: "safety-center",
      label: "Safety Center"
    },
    {
      detail: `${filteredClaims.length} cards`,
      id: "evidence-cards",
      label: "Evidence Cards"
    },
    {
      detail: `${productSignals.length} product signals`,
      id: "product-label-analyzer",
      label: "Product Label Analyzer"
    },
    {
      detail: `${trialWatchItems.length + trialAlerts.length} leads`,
      id: "trial-watcher",
      label: "Trial Watcher"
    },
    {
      detail: `${sourcePacketSummary.completeClaims}/${sourcePacketSummary.totalClaims} packets`,
      id: "sources-review",
      label: "Sources and Review Queue"
    }
  ];

  return (
    <main className="min-h-screen overflow-x-hidden px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full min-w-0 max-w-[1500px] flex-col gap-4">
        <Header data={data} />

        <section className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricPanel
            icon={<FileSearch aria-hidden="true" className="h-4 w-4" />}
            label="Interventions"
            value={interventions.length}
            detail={`${claims.length} scored claims`}
          />
          <MetricPanel
            icon={<ShieldCheck aria-hidden="true" className="h-4 w-4" />}
            label="Human reviewed"
            title={HUMAN_REVIEWED_TOOLTIP}
            value={reviewSummary.humanReviewed}
            detail={`${reviewSummary.unreviewedDrafts} draft classifications awaiting human confirmation`}
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

        <ProjectHealthSnapshot
          australiaRegulatoryInterventionCount={australiaRegulatoryInterventionCount}
          claimCount={claims.length}
          interventionCount={interventions.length}
          onShowSourcesReview={() => setActiveDashboardTab("sources-review")}
          productSignalCount={productSignals.length}
          safetyAlertInterventionCount={safetyAlertInterventionCount}
          sourcePacketGapItems={sourcePacketGapItems}
          sourcePacketSummary={sourcePacketSummary}
          trialLeadCount={trialLeadCount}
        />

        <DashboardTabs
          activeTab={activeDashboardTab}
          onChange={setActiveDashboardTab}
          tabs={dashboardTabs}
        />

        <DashboardTabPanel
          active={activeDashboardTab === "evidence-map"}
          id="dashboard-panel-evidence-map"
          labelledBy="dashboard-tab-evidence-map"
        >
          <section className="min-w-0 rounded-lg border border-line bg-white p-4 shadow-panel">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <PanelExplainer
                  explanation={panelExplanations["evidence-map"]}
                  title="Evidence Map"
                />
                <p className="mt-1 text-sm text-slate-600">
                  Claim cells show confidence-weighted evidence scores. Open any supplement row or
                  cell for its evidence cards, source packets, safety context, and score history.
                </p>
              </div>
              <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-6">
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
                <label className="relative" htmlFor="evidence-map-safety-domain">
                  <AlertTriangle
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600"
                  />
                  <span className="sr-only">Filter safety domain</span>
                  <select
                    id="evidence-map-safety-domain"
                    value={safetyDomain}
                    onChange={(event) => setSafetyDomain(event.target.value)}
                    className="h-10 w-full appearance-none rounded-md border border-line bg-white pl-9 pr-3 text-sm outline-none ring-signal/20 transition focus:border-signal focus:ring-4"
                  >
                    {safetyDomainOptions.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label className="relative" htmlFor="evidence-map-safety-region">
                  <Filter
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600"
                  />
                  <span className="sr-only">Filter safety region</span>
                  <select
                    id="evidence-map-safety-region"
                    value={safetyRegion}
                    onChange={(event) => setSafetyRegion(event.target.value)}
                    className="h-10 w-full appearance-none rounded-md border border-line bg-white pl-9 pr-3 text-sm outline-none ring-signal/20 transition focus:border-signal focus:ring-4"
                  >
                    {safetyRegionOptions.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label className="relative" htmlFor="evidence-map-safety-severity">
                  <AlertTriangle
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600"
                  />
                  <span className="sr-only">Filter safety severity</span>
                  <select
                    id="evidence-map-safety-severity"
                    value={safetySeverity}
                    onChange={(event) => setSafetySeverity(event.target.value)}
                    className="h-10 w-full appearance-none rounded-md border border-line bg-white pl-9 pr-3 text-sm outline-none ring-signal/20 transition focus:border-signal focus:ring-4"
                  >
                    {safetySeverityOptions.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label className="relative" htmlFor="evidence-map-au-tga-context">
                  <ShieldCheck
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600"
                  />
                  <span className="sr-only">Filter AU/TGA context</span>
                  <select
                    id="evidence-map-au-tga-context"
                    value={australiaRegulatoryKind}
                    onChange={(event) =>
                      setAustraliaRegulatoryKind(
                        event.target.value as AustraliaRegulatoryKindFilter
                      )
                    }
                    className="h-10 w-full appearance-none rounded-md border border-line bg-white pl-9 pr-3 text-sm outline-none ring-signal/20 transition focus:border-signal focus:ring-4"
                  >
                    {australiaRegulatoryKindOptions.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-md border border-line bg-mist px-2 py-1 font-semibold text-slate-700">
                Showing {filteredInterventions.length} of {interventions.length} supplements and{" "}
                {filteredClaims.length} of {claims.length} scoped claims
              </span>
              <span className="rounded-md border border-line bg-white px-2 py-1 text-slate-600">
                Category: {category}
              </span>
              {query.trim() ? (
                <span className="rounded-md border border-line bg-white px-2 py-1 text-slate-600">
                  Search: {query.trim()}
                </span>
              ) : null}
              <span className="rounded-md border border-line bg-white px-2 py-1 text-slate-600">
                Safety domain: {safetyDomain}
              </span>
              <span className="rounded-md border border-line bg-white px-2 py-1 text-slate-600">
                Safety region: {safetyRegion}
              </span>
              <span className="rounded-md border border-line bg-white px-2 py-1 text-slate-600">
                Safety severity: {safetySeverity}
              </span>
              <span className="rounded-md border border-line bg-white px-2 py-1 text-slate-600">
                AU/TGA: {australiaRegulatoryKind}
              </span>
              <button
                aria-label="Reset evidence map filters"
                className="rounded-md border border-signal/30 bg-blue-50 px-2 py-1 font-semibold text-signal transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-line disabled:bg-mist disabled:text-slate-500"
                disabled={!hasActiveEvidenceMapFilters}
                onClick={resetEvidenceMapFilters}
                title={
                  hasActiveEvidenceMapFilters
                    ? "Reset search, category, safety, region, severity, and AU/TGA filters"
                    : "Evidence map filters are already at their default values"
                }
                type="button"
              >
                Reset filters
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              Open a supplement row or goal cell for claim boundaries, source packets, safety
              alerts, AU/TGA context, and score-change reasons. Filtered-out or unassessed cells
              are local data gaps, not evidence of no effect or safety.
            </p>

            <EvidenceMap
              claims={filteredClaims}
              confidenceQueueItemsByClaimId={confidenceQueueItemsByClaimId}
              interventions={filteredInterventions}
            />
          </section>
        </DashboardTabPanel>

        <DashboardTabPanel
          active={activeDashboardTab === "claim-scores"}
          id="dashboard-panel-claim-scores"
          labelledBy="dashboard-tab-claim-scores"
        >
          <ClaimTable
            rows={tableRows}
            onSelectClaim={setActiveClaimId}
            activeClaimId={activeClaimIdForDisplay}
          />
        </DashboardTabPanel>

        <DashboardTabPanel
          active={activeDashboardTab === "ai-confidence"}
          id="dashboard-panel-ai-confidence"
          labelledBy="dashboard-tab-ai-confidence"
        >
          <NeedsHumanReviewPanel queue={humanReviewQueue} />
        </DashboardTabPanel>

        <DashboardTabPanel
          active={activeDashboardTab === "safety-center"}
          id="dashboard-panel-safety-center"
          labelledBy="dashboard-tab-safety-center"
        >
          <SafetyPanel
            australiaRegulatoryStatuses={australiaRegulatoryStatuses}
            interventionsById={interventionsById}
            safetyAlerts={safetyAlerts}
          />
        </DashboardTabPanel>

        <DashboardTabPanel
          active={activeDashboardTab === "evidence-cards"}
          id="dashboard-panel-evidence-cards"
          labelledBy="dashboard-tab-evidence-cards"
        >
          <EvidenceCards
            claims={filteredClaims}
            interventionsById={interventionsById}
            referencesById={referencesById}
            studies={studies}
            activeClaimId={activeClaimIdForDisplay}
            onSelectClaim={setActiveClaimId}
          />
        </DashboardTabPanel>

        <DashboardTabPanel
          active={activeDashboardTab === "product-label-analyzer"}
          id="dashboard-panel-product-label-analyzer"
          labelledBy="dashboard-tab-product-label-analyzer"
        >
          <LabelAnalyzer
            australiaRegulatoryStatuses={australiaRegulatoryStatuses}
            claims={claims}
            interventions={interventions}
            labelText={labelText}
            setLabelText={setLabelText}
            findings={labelFindings}
            productSignals={productSignals}
            productAustraliaVerificationById={productAustraliaVerificationById}
          />
        </DashboardTabPanel>

        <DashboardTabPanel
          active={activeDashboardTab === "trial-watcher"}
          id="dashboard-panel-trial-watcher"
          labelledBy="dashboard-tab-trial-watcher"
        >
          <TrialWatcher
            interventionsById={interventionsById}
            trialAlerts={trialAlerts}
            trialWatchItems={trialWatchItems}
          />
        </DashboardTabPanel>

        <DashboardTabPanel
          active={activeDashboardTab === "sources-review"}
          id="dashboard-panel-sources-review"
          labelledBy="dashboard-tab-sources-review"
        >
          {hasFilteredClaims && activeClaim ? (
            <SourceAndStudyPanel
              key={activeClaim.id}
              activeClaim={activeClaim}
              activeIntervention={activeIntervention}
              referencesById={referencesById}
              sourcePacketGapItems={sourcePacketGapItems}
              studies={studies}
            />
          ) : (
            <FilteredClaimDetailEmptyState
              title="Sources and Review Queue"
              detail="Source packets and live search suggestions appear after the current filters match a local scored claim."
              explanation={panelExplanations["sources-review"]}
            />
          )}
        </DashboardTabPanel>
      </div>
    </main>
  );
}

function NeedsHumanReviewPanel({ queue }: { queue: EvidenceCoverageHumanReviewQueue }) {
  return (
    <section className="min-w-0 rounded-lg border border-amberline/30 bg-white p-4 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <PanelExplainer
            explanation={panelExplanations["ai-confidence"]}
            title="AI Evidence Confidence"
          />
          <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-600">
            {queue.nextAction} Scores are Codex&apos;s evidence-confidence estimates from citation
            traceability, source-packet completeness, claim fit, uncertainty, and safety/regulatory
            caveats. Low scores are useful signals, not failures, and they are not medical advice or
            product-level TGA/ARTG clearance.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-md border border-amberline/30 bg-amber-50 px-2 py-1 font-semibold text-amberline">
            {queue.total} scored
          </span>
          <span className="rounded-md border border-spruce/30 bg-teal-50 px-2 py-1 font-semibold text-spruce">
            {queue.aiConfidenceAverage}/100 avg AI confidence
          </span>
          {queue.aiCrossCheckRecommended > 0 ? (
            <span className="rounded-md border border-amberline/30 bg-amber-50 px-2 py-1 font-semibold text-amberline">
              {queue.aiCrossCheckRecommended} high-attention
            </span>
          ) : null}
          {queue.blockedBySourcePacket > 0 ? (
            <span className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 font-semibold text-slate-700">
              {queue.blockedBySourcePacket} need source work
            </span>
          ) : null}
        </div>
      </div>

      {queue.items.length > 0 ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {queue.items.map((item) => (
            <NeedsHumanReviewCard item={item} key={item.claimId} />
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-md border border-line bg-mist p-3 text-sm text-slate-600">
          No public claim packets currently need AI confidence scoring.
        </p>
      )}
    </section>
  );
}

function NeedsHumanReviewCard({ item }: { item: EvidenceCoverageHumanReviewQueueItem }) {
  const preflightReady = item.aiPreReviewStatus === "codex-preflight-passed";

  return (
    <article className="min-w-0 rounded-md border border-line bg-mist p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-slate-500">
            #{item.reviewOrder} {item.interventionName} / {item.outcome}
          </p>
          <h3 className="mt-1 break-words text-sm font-semibold leading-6 text-ink">
            {item.claimId}
          </h3>
        </div>
        <span
          className={cn(
            "rounded-md border px-2 py-1 text-xs font-semibold",
            preflightReady
              ? "border-spruce/30 bg-teal-50 text-spruce"
              : "border-amberline/30 bg-amber-50 text-amberline"
          )}
        >
          {item.aiPreReviewLabel}
        </span>
      </div>

      <p className="mt-2 text-sm leading-6 text-slate-700">{item.aiPreReviewExplanation}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-md border border-spruce/30 bg-teal-50 px-2 py-1 font-semibold text-spruce">
          AI confidence {item.aiConfidenceScore}/100
        </span>
        <span className="rounded-md border border-signal/30 bg-blue-50 px-2 py-1 font-semibold text-signal">
          Weighted score {item.confidenceWeightedScore.toFixed(1)}/10
        </span>
        <span className="rounded-md border border-line bg-white px-2 py-1 font-semibold text-slate-700">
          {item.aiConfidenceSummary}
        </span>
        <span className="rounded-md border border-line bg-white px-2 py-1 font-semibold text-slate-700">
          {item.finalLabel}
        </span>
        <span className="rounded-md border border-line bg-white px-2 py-1 font-semibold text-slate-700">
          {item.extractedReferences}/{item.referenceCount} refs extracted
        </span>
        {item.highAttention ? (
          <span className="rounded-md border border-amberline/30 bg-amber-50 px-2 py-1 font-semibold text-amberline">
            High attention
          </span>
        ) : null}
      </div>
      {item.highAttentionReasons.length > 0 ? (
        <p className="mt-3 text-sm leading-6 text-slate-700">
          Optional ChatGPT Pro cross-check: {item.highAttentionReasons.join(" ")}
        </p>
      ) : null}
      <ul className="mt-3 space-y-1 text-sm leading-6 text-slate-700">
        <li>{item.confidenceWeightedScoreExplanation}</li>
        {item.aiConfidenceRationale.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a
          className="inline-flex items-center gap-2 rounded-md border border-signal/30 bg-blue-50 px-3 py-2 text-sm font-semibold text-signal hover:bg-blue-100"
          href={item.operatorHref}
        >
          <ClipboardCheck aria-hidden="true" className="h-4 w-4" />
          Open Confidence Packet
        </a>
        <span className="text-xs leading-5 text-slate-500">
          {item.confirmationRequirement}
        </span>
      </div>
    </article>
  );
}

function FilteredClaimDetailEmptyState({
  detail,
  explanation,
  title
}: {
  detail: string;
  explanation?: PanelExplanation;
  title: string;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-line bg-white p-4 shadow-panel">
      <PanelExplainer explanation={explanation} title={title} />
      <p className="mt-4 rounded-lg border border-line bg-mist p-3 text-sm leading-6 text-slate-600">
        {detail} Clear the active filters (search, category, safety, region, severity, or AU/TGA)
        to return to the full local evidence set.
      </p>
    </section>
  );
}

function PanelExplainer({
  explanation,
  title
}: {
  explanation?: PanelExplanation;
  title: string;
}) {
  if (!explanation) {
    return <h2 className="text-base font-semibold text-ink">{title}</h2>;
  }

  return (
    <details className="group max-w-4xl">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md outline-none transition hover:text-signal focus:ring-4 focus:ring-signal/20">
        <h2 className="text-base font-semibold text-ink group-hover:text-signal">{title}</h2>
        <CircleHelp aria-hidden="true" className="h-4 w-4 shrink-0 text-signal" />
        <span className="text-xs font-semibold text-signal">About this panel</span>
      </summary>
      <div className="mt-2 rounded-md border border-line bg-mist p-3 text-sm leading-6 text-slate-700">
        <p className="font-semibold text-ink">{explanation.summary}</p>
        <ul className="mt-2 grid gap-1">
          {explanation.body.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </details>
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

function ScoreHeaderExplainer({
  children,
  explanationKind
}: {
  children: ReactNode;
  explanationKind: ScoreExplanationKind;
}) {
  const explanation = scoreExplanations[explanationKind];
  const label = scoreExplanationTitle(explanationKind);

  return (
    <span className="inline-flex items-center gap-1">
      <span>{children}</span>
      <span className="group relative inline-flex">
        <span
          aria-label={label}
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-signal/25 bg-white text-signal"
          role="img"
          title={label}
        >
          <CircleHelp aria-hidden="true" className="h-3 w-3" />
        </span>
        <span
          role="tooltip"
          className="pointer-events-none absolute left-0 top-full z-30 mt-2 hidden w-72 rounded-md border border-line bg-white p-3 text-left text-xs normal-case leading-5 tracking-normal text-slate-700 shadow-panel group-hover:block"
        >
          <span className="block font-semibold text-ink">{explanation.title}</span>
          {explanation.formula ? (
            <span className="mt-1 block font-semibold text-slate-700">
              {explanation.formula}
            </span>
          ) : null}
          <span className="mt-1 block">{explanation.detail}</span>
        </span>
      </span>
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
    : "Pending human review means a human reviewer has not yet confirmed the source packet against the scoped claim. AI-reviewed packets remain draft review aids.";

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
            aria-label="Prototype and seed dataset status"
            className="mt-3 max-w-4xl border-l-4 border-signal bg-mist px-3 py-2"
            role="note"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-signal">
              Prototype / seed dataset
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-700">
              Apex Lifespan is in early public prototype. Current scores are based on a small
              curated seed dataset and live source-search previews. Scores are review aids, not
              medical advice.
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

function MetricPanel({
  icon,
  label,
  title,
  value,
  detail
}: {
  icon: React.ReactNode;
  label: string;
  title?: string;
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
        <p
          aria-label={title ? `${label}: ${title}` : undefined}
          className="text-sm font-semibold text-ink"
          title={title}
        >
          {label}
        </p>
        <p className="mt-1 text-xs text-slate-600">{detail}</p>
      </div>
    </div>
  );
}

function ProjectHealthSnapshot({
  australiaRegulatoryInterventionCount,
  claimCount,
  interventionCount,
  onShowSourcesReview,
  productSignalCount,
  safetyAlertInterventionCount,
  sourcePacketGapItems,
  sourcePacketSummary,
  trialLeadCount
}: {
  australiaRegulatoryInterventionCount: number;
  claimCount: number;
  interventionCount: number;
  onShowSourcesReview: () => void;
  productSignalCount: number;
  safetyAlertInterventionCount: number;
  sourcePacketGapItems: SourcePacketGapItem[];
  sourcePacketSummary: ClaimSourcePacketSummary;
  trialLeadCount: number;
}) {
  const sourcePacketGapCount =
    sourcePacketSummary.totalClaims - sourcePacketSummary.completeClaims;
  const previewSourcePacketGapItems = sourcePacketGapItems.slice(0, 3);
  const hasSourcePacketGaps = sourcePacketGapCount > 0;

  return (
    <section
      aria-label="Privacy-safe project health"
      className="rounded-lg border border-line bg-white p-4 shadow-panel"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h2 className="text-base font-semibold text-ink">Project Health Snapshot</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Aggregate local signals only; no user identifiers, raw health text, pasted labels,
            search terms, or operator notes are reported here.
          </p>
        </div>
        <a
          className="inline-flex w-fit rounded-md border border-line bg-mist px-3 py-2 text-xs font-semibold text-signal hover:border-signal"
          href="/privacy"
        >
          Privacy boundary
        </a>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <ProjectHealthItem
          detail={
            hasSourcePacketGaps
              ? `${sourcePacketGapCount} scoped claims still need source-packet work.`
              : "All scoped claims have citation-linked source packets; human review remains separate."
          }
          label="Evidence coverage"
          value={`${sourcePacketSummary.completeClaims}/${sourcePacketSummary.totalClaims} source packets`}
        />
        <ProjectHealthItem
          detail="Captured alert rows and AU/TGA rows are local review aids, not clearance."
          label="Safety alerts/AU scope"
          value={`${safetyAlertInterventionCount}/${interventionCount} alerts, ${australiaRegulatoryInterventionCount}/${interventionCount} AU/TGA`}
        />
        <ProjectHealthItem
          detail="Demo product/profile signals stay separate from ingredient evidence and AU/TGA status."
          label="Product context"
          value={`${productSignalCount} profile${productSignalCount === 1 ? "" : "s"}`}
        />
        <ProjectHealthItem
          detail="Registry/watch items are review leads only and do not change scores."
          label="Trial monitoring"
          value={`${trialLeadCount} lead${trialLeadCount === 1 ? "" : "s"}`}
        />
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-600">
        Current local scope: {interventionCount} interventions and {claimCount} scoped claims.
      </p>
      <div className="mt-3 rounded-md border border-line bg-mist p-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink">
              {hasSourcePacketGaps ? "Next source gaps" : "Source packet coverage complete"}
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              {hasSourcePacketGaps
                ? "Local evidence-intake leads only; these do not change public scores until sources are citation-linked and reviewed."
                : "Every scoped claim has a linked source packet in the local dataset. This does not mark claims human reviewed or product-level cleared."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-fit rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-slate-700">
              {previewSourcePacketGapItems.length} of {sourcePacketGapCount} shown
            </span>
            <button
              className="w-fit rounded-md border border-signal/30 bg-blue-50 px-2 py-1 text-xs font-semibold text-signal hover:bg-blue-100"
              onClick={onShowSourcesReview}
              type="button"
            >
              {hasSourcePacketGaps ? "Review all source gaps" : "Open source review"}
            </button>
          </div>
        </div>
        {previewSourcePacketGapItems.length > 0 ? (
          <ol className="mt-3 grid gap-2 md:grid-cols-3">
            {previewSourcePacketGapItems.map((item) => (
              <li key={item.claimId} className="rounded-md border border-line bg-white p-2">
                <p className="text-xs font-semibold text-ink">
                  {item.interventionName} - {item.outcomeLabel}
                </p>
                <p className="mt-1 text-xs text-slate-600">{item.label}</p>
                <p className="mt-2 text-xs leading-5 text-slate-600">{item.nextStep}</p>
                {item.interventionSlug ? (
                  <a
                    className="mt-2 inline-flex rounded-md border border-line bg-mist px-2 py-1 text-xs font-semibold text-signal hover:border-signal"
                    href={`/interventions/${item.interventionSlug}#source-packet-${item.claimId}`}
                  >
                    Open intervention detail
                  </a>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 rounded-md border border-line bg-white p-2 text-xs leading-5 text-slate-600">
            Source-packet coverage is complete for the current local dataset. Keep checking source
            packets separately from human review, AU/TGA product status, safety clearance, and
            medical advice.
          </p>
        )}
      </div>
    </section>
  );
}

function ProjectHealthItem({
  detail,
  label,
  value
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-line bg-mist p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</p>
      <p className="mt-2 text-sm font-semibold text-ink">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-600">{detail}</p>
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

function countUniqueIds(values: Array<string | null | undefined>) {
  return new Set(values.filter((value): value is string => Boolean(value))).size;
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

function EvidenceMap({
  claims: visibleClaims,
  confidenceQueueItemsByClaimId,
  interventions: visibleInterventions
}: {
  claims: Claim[];
  confidenceQueueItemsByClaimId: Map<string, EvidenceCoverageHumanReviewQueueItem>;
  interventions: Intervention[];
}) {
  const [sortCategoryId, setSortCategoryId] =
    useState<SupplementGoalCategoryId | null>(null);
  const activeSortCategory =
    supplementGoalCategories.find((category) => category.id === sortCategoryId) ?? null;
  const sortedInterventions = useMemo(
    () =>
      sortCategoryId
        ? sortInterventionsByGoalCategory(
            visibleInterventions,
            visibleClaims,
            confidenceQueueItemsByClaimId,
            sortCategoryId
          )
        : visibleInterventions,
    [confidenceQueueItemsByClaimId, sortCategoryId, visibleClaims, visibleInterventions]
  );

  if (visibleClaims.length === 0) {
    return (
      <p className="mt-4 rounded-lg border border-line bg-mist p-3 text-sm leading-6 text-slate-600">
        No local scored claims match the current filters. Clear the active filters (search,
        category, safety, region, severity, or AU/TGA) to rebuild the evidence map.
      </p>
    );
  }

  return (
    <div className="mt-4">
      <div className="max-w-full overflow-x-auto">
        <table
          aria-describedby="evidence-map-legend"
          className="w-full min-w-[1600px] border-separate border-spacing-1 text-sm"
        >
          <caption className="sr-only">
            Evidence map. Rows are interventions and columns are supplement goals. Select a goal
            column to sort supplements by the highest available score in that category. Unassessed
            cells do not imply absence of evidence.
          </caption>
          <thead>
            <tr>
              <th
                className="w-[220px] rounded-md border border-transparent px-2 py-2 text-left text-xs font-semibold text-slate-600"
                scope="col"
              >
                Intervention
              </th>
              {supplementGoalCategories.map((category) => (
                <th
                  aria-sort={sortCategoryId === category.id ? "descending" : undefined}
                  key={category.id}
                  className={cn(
                    "rounded-md border border-line bg-mist p-0 text-left text-xs font-semibold text-slate-700",
                    sortCategoryId === category.id && "border-signal/40 bg-blue-50"
                  )}
                  scope="col"
                >
                  <button
                    aria-label={`Sort supplements by ${category.label} score, highest to lowest`}
                    className="flex h-full min-h-12 w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left transition hover:bg-blue-50 hover:text-signal focus:outline-none focus:ring-4 focus:ring-inset focus:ring-signal/20"
                    onClick={() => setSortCategoryId(category.id)}
                    title={category.description}
                    type="button"
                  >
                    <span>{category.label}</span>
                    <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedInterventions.map((intervention) => (
              <EvidenceMapRow
                categories={supplementGoalCategories}
                claims={visibleClaims}
                confidenceQueueItemsByClaimId={confidenceQueueItemsByClaimId}
                intervention={intervention}
                key={intervention.id}
              />
            ))}
          </tbody>
        </table>
      </div>
      {activeSortCategory ? (
        <p className="mt-2 text-xs font-semibold text-slate-600">
          Sorted by {activeSortCategory.label} score, highest first.
        </p>
      ) : null}
      <EvidenceMapLegend />
    </div>
  );
}

function DashboardTabs({
  activeTab,
  onChange,
  tabs
}: {
  activeTab: DashboardTabId;
  onChange: (tab: DashboardTabId) => void;
  tabs: DashboardTab[];
}) {
  return (
    <div
      aria-label="Dashboard sections"
      className="flex max-w-full gap-1 overflow-x-auto border-b border-line"
      role="tablist"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTab;

        return (
          <button
            aria-controls={`dashboard-panel-${tab.id}`}
            aria-selected={active}
            className={cn(
              "min-w-[11rem] border border-line border-b-0 bg-mist px-4 py-3 text-left text-sm transition hover:bg-white focus:outline-none focus:ring-4 focus:ring-inset focus:ring-signal/20",
              active && "border-t-4 border-t-spruce bg-white pt-[9px] text-ink"
            )}
            id={`dashboard-tab-${tab.id}`}
            key={tab.id}
            onClick={() => onChange(tab.id)}
            role="tab"
            type="button"
          >
            <span className="block font-semibold">{tab.label}</span>
            <span className="mt-1 block text-xs font-medium text-slate-600">
              {tab.detail}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function DashboardTabPanel({
  active,
  children,
  id,
  labelledBy
}: {
  active: boolean;
  children: ReactNode;
  id: string;
  labelledBy: string;
}) {
  return (
    <div
      aria-labelledby={labelledBy}
      className={cn("min-w-0", !active && "hidden")}
      hidden={!active}
      id={id}
      role="tabpanel"
    >
      {children}
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
    </div>
  );
}

function EvidenceMapRow({
  categories,
  claims: visibleClaims,
  confidenceQueueItemsByClaimId,
  intervention,
}: {
  categories: readonly SupplementGoalCategory[];
  claims: Claim[];
  confidenceQueueItemsByClaimId: Map<string, EvidenceCoverageHumanReviewQueueItem>;
  intervention: Intervention;
}) {
  const href = interventionDetailHref(intervention);

  return (
    <tr>
      <th
        className="h-14 rounded-md border border-line bg-white p-0 text-left text-sm font-semibold text-ink"
        scope="row"
      >
        <a
          className="flex h-full min-h-14 items-center rounded-md px-2 transition hover:bg-blue-50 hover:text-signal focus:outline-none focus:ring-4 focus:ring-inset focus:ring-signal/20"
          href={href}
        >
          {intervention.name}
        </a>
      </th>
      {categories.map((category) => {
        const categoryClaims = claimsForGoalCategory(
          visibleClaims,
          intervention.id,
          category.id
        );
        const claim = bestClaimForGoalCategory(
          categoryClaims,
          confidenceQueueItemsByClaimId
        );

        if (!claim) {
          return (
            <td
              key={`${intervention.id}-${category.id}`}
              aria-label={`${intervention.name}, ${category.label}: not yet assessed; this does not mean no evidence exists.`}
              className="h-14 p-0 align-middle"
              title="Not yet assessed; this does not mean no evidence exists."
            >
              <a
                className="flex h-14 w-full items-center justify-center rounded-md border border-dashed border-line bg-slate-50 px-2 text-xs text-slate-400 transition hover:border-signal hover:bg-blue-50 hover:text-signal focus:outline-none focus:ring-4 focus:ring-signal/20"
                href={href}
              >
              <span aria-hidden="true">—</span>
              <span className="sr-only">
                {category.label} not yet assessed; open {intervention.name} detail.
              </span>
              </a>
            </td>
          );
        }

        const rawScore = compositeScore(claim.scores);
        const confidenceScore = claimAiConfidenceScore(claim, confidenceQueueItemsByClaimId);
        const score = claimConfidenceWeightedScore(claim, confidenceQueueItemsByClaimId);
        const detailedOutcomes = categoryClaims
          .map((item) => item.outcome)
          .sort((first, second) => first.localeCompare(second));
        const detailedOutcomeLabel = detailedOutcomes.join(", ");

        return (
          <td key={`${intervention.id}-${category.id}`} className="h-14 p-0 align-middle">
            <a
              href={href}
              className={cn(
                "flex h-14 w-full flex-col items-start justify-center rounded-md border px-2 text-left text-xs transition hover:border-signal hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-signal/20",
                labelTone(claim.finalLabel)
              )}
              aria-label={`${intervention.name}, ${category.label}: confidence-weighted ${compositeLabel(
                claim
              )} ${score.toFixed(
                1
              )} out of 10 from ${detailedOutcomeLabel}, raw composite ${rawScore.toFixed(
                1
              )}, AI confidence ${confidenceScore}/100, ${scoreBand(
                score
              )} band, ${classificationLabel(claim)} ${
                claim.finalLabel
              }, review status ${reviewStatusLabel(
                claim.reviewStatus
              )}. Open intervention detail. ${category.description} ${scoreExplanationTitle(
                "confidenceWeightedComposite",
                `${score.toFixed(1)}/10`
              )}`}
              title={scoreExplanationTitle(
                "confidenceWeightedComposite",
                `${score.toFixed(1)}/10`
              )}
            >
              <span className="font-semibold">{score.toFixed(1)}</span>
              <span className="max-w-full truncate">
                {categoryClaims.length > 1
                  ? `${categoryClaims.length} claims`
                  : shortOutcome(claim.outcome)}
              </span>
              <span className="max-w-full truncate text-[11px] opacity-80">
                raw {rawScore.toFixed(1)} x {confidenceScore}%
              </span>
            </a>
          </td>
        );
      })}
    </tr>
  );
}

function claimsForGoalCategory(
  claims: Claim[],
  interventionId: string,
  categoryId: SupplementGoalCategoryId
) {
  return claims.filter(
    (claim) =>
      claim.interventionId === interventionId &&
      supplementGoalCategoryForOutcome(claim.outcome).id === categoryId
  );
}

function bestClaimForGoalCategory(
  claims: Claim[],
  confidenceQueueItemsByClaimId: Map<string, EvidenceCoverageHumanReviewQueueItem>
) {
  return claims.reduce<Claim | undefined>((best, claim) => {
    if (!best) {
      return claim;
    }

    return claimConfidenceWeightedScore(claim, confidenceQueueItemsByClaimId) >
      claimConfidenceWeightedScore(best, confidenceQueueItemsByClaimId)
      ? claim
      : best;
  }, undefined);
}

function bestGoalCategoryScore(
  claims: Claim[],
  interventionId: string,
  confidenceQueueItemsByClaimId: Map<string, EvidenceCoverageHumanReviewQueueItem>,
  categoryId: SupplementGoalCategoryId
) {
  const bestClaim = bestClaimForGoalCategory(
    claimsForGoalCategory(claims, interventionId, categoryId),
    confidenceQueueItemsByClaimId
  );

  return bestClaim
    ? claimConfidenceWeightedScore(bestClaim, confidenceQueueItemsByClaimId)
    : null;
}

function sortInterventionsByGoalCategory(
  interventions: Intervention[],
  claims: Claim[],
  confidenceQueueItemsByClaimId: Map<string, EvidenceCoverageHumanReviewQueueItem>,
  categoryId: SupplementGoalCategoryId
) {
  return [...interventions].sort((first, second) => {
    const firstScore = bestGoalCategoryScore(
      claims,
      first.id,
      confidenceQueueItemsByClaimId,
      categoryId
    );
    const secondScore = bestGoalCategoryScore(
      claims,
      second.id,
      confidenceQueueItemsByClaimId,
      categoryId
    );

    if (firstScore === null && secondScore === null) {
      return first.name.localeCompare(second.name);
    }

    if (firstScore === null) {
      return 1;
    }

    if (secondScore === null) {
      return -1;
    }

    if (secondScore !== firstScore) {
      return secondScore - firstScore;
    }

    return first.name.localeCompare(second.name);
  });
}

function claimAiConfidenceScore(
  claim: Claim,
  confidenceQueueItemsByClaimId: Map<string, EvidenceCoverageHumanReviewQueueItem>
) {
  return confidenceQueueItemsByClaimId.get(claim.id)?.aiConfidenceScore ?? 100;
}

function claimConfidenceWeightedScore(
  claim: Claim,
  confidenceQueueItemsByClaimId: Map<string, EvidenceCoverageHumanReviewQueueItem>
) {
  return (
    confidenceQueueItemsByClaimId.get(claim.id)?.confidenceWeightedScore ??
    compositeScore(claim.scores)
  );
}

function interventionDetailHref(intervention: Intervention) {
  return `/interventions/${intervention.slug}`;
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
  const [sorting, setSorting] = useState<SortingState>([
    { id: "confidenceWeightedComposite", desc: true }
  ]);

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
        accessorKey: "confidenceWeightedComposite",
        header: () => (
          <ScoreHeaderExplainer explanationKind="confidenceWeightedComposite">
            Weighted
          </ScoreHeaderExplainer>
        ),
        cell: ({ row }) => (
          <div className="min-w-[5.5rem]">
            <span>{row.original.confidenceWeightedComposite.toFixed(1)}</span>
            <p className="mt-1 text-[11px] leading-4 text-slate-500">
              raw {row.original.composite.toFixed(1)} x {row.original.aiConfidenceScore}%
            </p>
          </div>
        )
      },
      {
        accessorKey: "composite",
        header: () => (
          <ScoreHeaderExplainer explanationKind="composite">Raw score</ScoreHeaderExplainer>
        ),
        cell: ({ row }) => row.original.composite.toFixed(1)
      },
      {
        accessorKey: "safety",
        header: () => <ScoreHeaderExplainer explanationKind="safety">Safety</ScoreHeaderExplainer>,
        cell: ({ row }) => row.original.safety
      },
      {
        accessorKey: "regulatoryRisk",
        header: () => (
          <ScoreHeaderExplainer explanationKind="regulatoryRisk">Reg risk</ScoreHeaderExplainer>
        ),
        cell: ({ row }) => row.original.regulatoryRisk
      },
      {
        accessorKey: "confidence",
        header: "Confidence"
      },
      {
        accessorKey: "aiConfidenceScore",
        header: "AI conf",
        cell: ({ row }) => `${row.original.aiConfidenceScore}/100`
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
    <section className="min-w-0 rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex items-center justify-between gap-3">
        <div>
          <PanelExplainer
            explanation={panelExplanations["claim-scores"]}
            title="Claim Scores"
          />
          <p className="mt-1 text-sm text-slate-600">
            Each row is an intervention-outcome pair. Weighted score is raw composite multiplied by
            AI confidence, so low-confidence packets still count with lower impact.
          </p>
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
          No local scored claims match the current filters. Clear the active filters (search,
          category, safety, region, severity, or AU/TGA) to return to the full local evidence set.
        </p>
      )}
    </section>
  );
}

function SafetyPanel({
  australiaRegulatoryStatuses,
  interventionsById,
  safetyAlerts
}: {
  australiaRegulatoryStatuses: AustraliaRegulatoryStatus[];
  interventionsById: Map<string, Intervention>;
  safetyAlerts: SafetyAlert[];
}) {
  const domainSummaries = summarizeSafetyAlertsByDomain(safetyAlerts);
  const domainCoverage = summarizeSafetyDomainCoverage(safetyAlerts);
  const regionalCoverage = summarizeRegionalSafetyRegulatoryCoverage({
    australiaRegulatoryStatuses,
    safetyAlerts
  });
  const regionalReviewGapsByRegion = new Map(
    summarizeRegionalSafetyRegulatoryReviewGaps({
      australiaRegulatoryStatuses,
      safetyAlerts
    }).map((gap) => [gap.region, gap])
  );
  const regionalDomainCoverage = summarizeRegionalSafetyDomainCoverage(safetyAlerts);

  return (
    <section className="min-w-0 rounded-lg border border-line bg-white p-4 shadow-panel">
      <PanelExplainer
        explanation={panelExplanations["safety-center"]}
        title="Safety Center"
      />
      <div className="mt-4 rounded-lg border border-line bg-mist p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-ink">Safety coverage snapshot</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Reviewed local alerts by domain; gaps mean no reviewed alert is currently captured.
            </p>
          </div>
          <span className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-slate-700">
            {safetyAlerts.length} alert{safetyAlerts.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {domainCoverage.map((coverage) => (
            <div key={coverage.id} className="rounded-md border border-line bg-white p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-ink">{coverage.label}</span>
                <span
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs font-semibold",
                    coverage.status === "reviewed-alerts-captured"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  )}
                >
                  {coverage.statusLabel}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                {coverage.alertCount > 0
                  ? `${coverage.alertCount} reviewed alert${
                      coverage.alertCount === 1 ? "" : "s"
                    } across ${coverage.regions.join(", ")}.`
                  : "No reviewed local alert is currently linked to this domain."}
              </p>
              {coverage.alertTypes.length > 0 ? (
                <p className="mt-1 text-xs font-semibold text-slate-700">
                  {coverage.alertTypes.join(", ")}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      {regionalCoverage.length > 0 ? (
        <div className="mt-4 rounded-lg border border-line bg-white p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-ink">Regional review scope</h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Captured local safety and AU/TGA records only; absence is not clearance.
              </p>
            </div>
            <span className="rounded-md border border-line bg-mist px-2 py-1 text-xs font-semibold text-slate-700">
              {regionalCoverage.length} region{regionalCoverage.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-3 grid gap-2">
            {regionalCoverage.map((coverage) => {
              const reviewGap = regionalReviewGapsByRegion.get(coverage.region);

              return (
                <div key={coverage.region} className="rounded-md border border-line bg-mist p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold text-ink">{coverage.region}</span>
                    <p className="mt-1 text-xs text-slate-600">{coverage.reviewScopeLabel}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {reviewGap ? (
                      <span
                        className={cn(
                          "rounded-md border px-2 py-1 text-xs font-semibold",
                          regionalReviewPriorityTone(reviewGap.reviewPriority)
                        )}
                      >
                        {reviewGap.reviewPriorityLabel}
                      </span>
                    ) : null}
                    <span className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                      {coverage.scopeLabel}
                    </span>
                  </div>
                </div>
                <p
                  className={`mt-2 text-xs leading-5 ${
                    coverage.status === "not-yet-captured"
                      ? "text-slate-500"
                      : "text-slate-600"
                  }`}
                >
                  {coverage.statusLabel}
                  {coverage.status === "not-yet-captured"
                    ? ": no reviewed local safety or AU/TGA record is currently linked to this review region."
                    : "."}
                </p>
                {reviewGap ? (
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    {reviewGap.nextAction}
                  </p>
                ) : null}
                <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
                  <MiniStat
                    label="Safety alerts"
                    value={`${coverage.safetyAlertCount}${
                      coverage.safetyAlertTypes.length > 0
                        ? `: ${coverage.safetyAlertTypes.join(", ")}`
                      : ""
                    }`}
                  />
                  <MiniStat
                    label="Highest safety severity"
                    value={coverage.highestSafetySeverityLabel}
                  />
                  <MiniStat
                    label="AU/TGA records"
                    value={`${coverage.australiaRegulatoryStatusCount}${
                      coverage.australiaRegulatoryKinds.length > 0
                        ? `: ${coverage.australiaRegulatoryKinds.join(", ")}`
                      : ""
                    }`}
                  />
                  {reviewGap ? (
                    <MiniStat
                      label="Review gaps"
                      value={
                        reviewGap.missingSafetyDomainLabels.length > 0
                          ? reviewGap.missingSafetyDomainLabels.join(", ")
                          : "No missing safety domains in current model"
                      }
                    />
                  ) : null}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      ) : null}
      {regionalDomainCoverage.length > 0 ? (
        <div className="mt-4 rounded-lg border border-line bg-mist p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-ink">Regional safety-domain matrix</h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Reviewed safety-domain alerts by configured region; empty cells are review gaps,
                not evidence of safety or clearance.
              </p>
            </div>
            <span className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-slate-700">
              {regionalDomainCoverage.length} review scopes
            </span>
          </div>
          <div className="mt-3 grid gap-2">
            {regionalDomainCoverage.map((coverage) => (
              <div key={coverage.region} className="rounded-md border border-line bg-white p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold text-ink">{coverage.region}</span>
                    <p className="mt-1 text-xs text-slate-600">{coverage.reviewScopeLabel}</p>
                  </div>
                  <span className="rounded-md border border-line bg-mist px-2 py-1 text-xs font-semibold text-slate-700">
                    {coverage.reviewedDomainCount}/{coverage.totalDomainCount} domains captured
                  </span>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {coverage.domains.map((domain) => (
                    <div
                      key={domain.id}
                      className={cn(
                        "rounded-md border px-2 py-2 text-xs",
                        domain.status === "reviewed-alerts-captured"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-line bg-mist text-slate-600"
                      )}
                    >
                      <p className="font-semibold text-ink">{domain.label}</p>
                      <p className="mt-1 leading-5">{domain.statusLabel}</p>
                      <p className="mt-1 leading-5">
                        {domain.alertCount > 0
                          ? `${domain.alertCount} alert${
                              domain.alertCount === 1 ? "" : "s"
                            }; highest severity ${domain.highestSeverityLabel}.`
                          : "No reviewed local alert captured for this domain in this region."}
                      </p>
                      {domain.alertTypes.length > 0 ? (
                        <p className="mt-1 font-semibold text-slate-700">
                          {domain.alertTypes.join(", ")}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {domainSummaries.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {domainSummaries.map((summary) => (
            <div key={summary.id} className="rounded-lg border border-line bg-mist p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-ink">{summary.label}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    {summary.alertCount} alert{summary.alertCount === 1 ? "" : "s"} across{" "}
                    {summary.regions.join(", ")}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs font-semibold",
                    severityTone(summary.highestSeverity)
                  )}
                >
                  {summary.highestSeverity}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">{summary.description}</p>
              <p className="mt-2 text-xs font-semibold text-slate-700">
                {summary.alertTypes.join(", ")}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-4 grid gap-3">
        {safetyAlerts.length > 0 ? (
          safetyAlerts.map((alert) => {
            const domain = safetyDomainForAlertType(alert.alertType);

            return (
              <article key={alert.id} className="rounded-lg border border-line bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-ink">
                      {interventionsById.get(alert.interventionId)?.name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-600">
                      {alert.source} - {formatSafetyAlertRegionLabel(alert.region)} -{" "}
                      {alert.date}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <span className="rounded-md border border-line bg-mist px-2 py-1 text-xs font-semibold text-slate-700">
                      {domain.label}
                    </span>
                    <span className="rounded-md border border-line bg-mist px-2 py-1 text-xs font-semibold text-slate-700">
                      {alert.alertType}
                    </span>
                    <span
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs font-semibold",
                        severityTone(alert.severity)
                      )}
                    >
                      {alert.severity}
                    </span>
                  </div>
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
            );
          })
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
    <section className="min-w-0 rounded-lg border border-line bg-white p-4 shadow-panel">
      <PanelExplainer
        explanation={panelExplanations["evidence-cards"]}
        title="Evidence Cards"
      />
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
          })
        ) : (
          <p className="rounded-lg border border-line bg-mist p-3 text-sm leading-6 text-slate-600">
            No evidence cards match the current filters. Clear the active filters (search,
            category, safety, region, severity, or AU/TGA) to review the full local evidence set.
          </p>
        )}
      </div>
    </section>
  );
}

function LabelAnalyzer({
  australiaRegulatoryStatuses,
  claims,
  interventions,
  labelText,
  setLabelText,
  findings,
  productAustraliaVerificationById,
  productSignals
}: {
  australiaRegulatoryStatuses: AustraliaRegulatoryStatus[];
  claims: Claim[];
  interventions: Intervention[];
  labelText: string;
  setLabelText: (value: string) => void;
  findings: ReturnType<typeof analyzeLabel>;
  productAustraliaVerificationById: Map<string, ProductAustraliaRegulatoryVerification>;
  productSignals: ProductSignal[];
}) {
  const [productRegulatoryKind, setProductRegulatoryKind] =
    useState<ProductRegulatoryKindFilter>(PRODUCT_REGULATORY_KIND_ALL);
  const [productQualityFilter, setProductQualityFilter] =
    useState<ProductQualityFilter>(PRODUCT_QUALITY_ALL);
  const [productFormulationFilter, setProductFormulationFilter] =
    useState<ProductFormulationFilter>(PRODUCT_FORMULATION_ALL);
  const labelProductQualityAssessment = useMemo(
    () => assessLabelProductQuality(labelText),
    [labelText]
  );
  const parsedCertifications = useMemo(
    () => parseLabelCertifications(labelText),
    [labelText]
  );
  const parsedDoseCues = useMemo(() => parseLabelDoseCues(labelText), [labelText]);
  const parsedIngredients = useMemo(() => parseLabelIngredients(labelText), [labelText]);
  const parsedProductIdentifiers = useMemo(
    () => parseLabelProductIdentifiers(labelText),
    [labelText]
  );
  const parsedProductIdentifierVerifications = useMemo(
    () =>
      buildParsedAustraliaRegulatoryIdentifierVerifications(parsedProductIdentifiers, {
        australiaRegulatoryStatuses,
        productSignals
      }),
    [australiaRegulatoryStatuses, parsedProductIdentifiers, productSignals]
  );
  const productLabelVerification = useMemo(
    () =>
      buildProductLabelVerificationSummary({
        labelText,
        parsedProductIdentifierVerifications,
        productAustraliaVerificationById,
        productSignals
      }),
    [
      labelText,
      parsedProductIdentifierVerifications,
      productAustraliaVerificationById,
      productSignals
    ]
  );
  const ingredientEvidenceMappings = useMemo(
    () => buildIngredientEvidenceMappings(parsedIngredients, interventions, claims),
    [claims, interventions, parsedIngredients]
  );
  const productRegulatoryKindOptions = useMemo(
    () => [
      PRODUCT_REGULATORY_KIND_ALL,
      ...uniqueSorted(
        productSignals.map((product) =>
          productRegulatoryKindFor(product, productAustraliaVerificationById)
        )
      )
    ],
    [productAustraliaVerificationById, productSignals]
  );
  const productFormulationEvidenceById = useMemo(
    () =>
      new Map(
        buildProductFormulationEvidenceMappings({
          claims,
          interventions,
          productAustraliaVerificationById,
          productSignals
        }).map((mapping) => [mapping.productId, mapping])
      ),
    [claims, interventions, productAustraliaVerificationById, productSignals]
  );
  const productSignalsMatchingBaseFilters = useMemo(
    () =>
      productSignals.filter((product) => {
        const regulatoryMatch =
          productRegulatoryKind === PRODUCT_REGULATORY_KIND_ALL ||
          productRegulatoryKindFor(product, productAustraliaVerificationById) ===
            productRegulatoryKind;
        const qualityMatch =
          productQualityFilter === PRODUCT_QUALITY_ALL ||
          productQualitySignalFor(product) === productQualityFilter;

        return regulatoryMatch && qualityMatch;
      }),
    [
      productAustraliaVerificationById,
      productQualityFilter,
      productRegulatoryKind,
      productSignals
    ]
  );
  const productFormulationFilterCounts = useMemo(
    () =>
      new Map(
        productFormulationFilterOptions.map((filter) => [
          filter,
          productSignalsMatchingBaseFilters.filter((product) => {
            const mapping = productFormulationEvidenceById.get(product.id);
            return mapping ? productFormulationFilterMatches(mapping, filter) : false;
          }).length
        ])
      ),
    [productFormulationEvidenceById, productSignalsMatchingBaseFilters]
  );
  const filteredProductSignals = useMemo(
    () =>
      productSignalsMatchingBaseFilters.filter((product) => {
        const formulationMapping = productFormulationEvidenceById.get(product.id);
        const formulationMatch = formulationMapping
          ? productFormulationFilterMatches(formulationMapping, productFormulationFilter)
          : productFormulationFilter === PRODUCT_FORMULATION_ALL;

        return formulationMatch;
      }),
    [
      productFormulationEvidenceById,
      productFormulationFilter,
      productSignalsMatchingBaseFilters
    ]
  );
  const visibleProductFormulationMappings = useMemo(
    () =>
      filteredProductSignals.flatMap((product) => {
        const mapping = productFormulationEvidenceById.get(product.id);
        return mapping ? [mapping] : [];
      }),
    [filteredProductSignals, productFormulationEvidenceById]
  );
  const productFormulationCoverage = useMemo(
    () => ({
      fullyMappedCount: visibleProductFormulationMappings.filter(
        (mapping) => mapping.matchedIngredientCount > 0 && mapping.unmatchedIngredients.length === 0
      ).length,
      ingredientLevelClaimCount: visibleProductFormulationMappings.reduce(
        (count, mapping) => count + mapping.ingredientLevelClaimCount,
        0
      ),
      productSpecificEvidenceCount: visibleProductFormulationMappings.reduce(
        (count, mapping) => count + mapping.productSpecificEvidenceCount,
        0
      ),
      withUnmatchedCount: visibleProductFormulationMappings.filter(
        (mapping) => mapping.unmatchedIngredients.length > 0
      ).length
    }),
    [visibleProductFormulationMappings]
  );

  return (
    <section className="min-w-0 rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <PanelExplainer
            explanation={panelExplanations["product-label-analyzer"]}
            title="Product Label Analyzer"
          />
          <p className="mt-1 text-sm text-slate-600">
            Ingredient text is checked for quality and safety signals. Demo profiles are not
            verified product recommendations.
          </p>
        </div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-3">
          <label className="relative" htmlFor="product-au-tga-filter">
            <ShieldCheck
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600"
            />
            <span className="sr-only">Filter product AU/TGA context</span>
            <select
              id="product-au-tga-filter"
              value={productRegulatoryKind}
              onChange={(event) =>
                setProductRegulatoryKind(event.target.value as ProductRegulatoryKindFilter)
              }
              className="h-10 w-full appearance-none rounded-md border border-line bg-white pl-9 pr-3 text-sm outline-none ring-signal/20 transition focus:border-signal focus:ring-4"
            >
              {productRegulatoryKindOptions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="relative" htmlFor="product-quality-filter">
            <ClipboardCheck
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600"
            />
            <span className="sr-only">Filter product quality signal</span>
            <select
              id="product-quality-filter"
              value={productQualityFilter}
              onChange={(event) =>
                setProductQualityFilter(event.target.value as ProductQualityFilter)
              }
              className="h-10 w-full appearance-none rounded-md border border-line bg-white pl-9 pr-3 text-sm outline-none ring-signal/20 transition focus:border-signal focus:ring-4"
            >
              {productQualityFilterOptions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="relative" htmlFor="product-formulation-filter">
            <Filter
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600"
            />
            <span className="sr-only">Filter product formulation evidence</span>
            <select
              id="product-formulation-filter"
              value={productFormulationFilter}
              onChange={(event) =>
                setProductFormulationFilter(event.target.value as ProductFormulationFilter)
              }
              className="h-10 w-full appearance-none rounded-md border border-line bg-white pl-9 pr-3 text-sm outline-none ring-signal/20 transition focus:border-signal focus:ring-4"
            >
              {productFormulationFilterOptions.map((item) => (
                <option key={item} value={item}>
                  {formatProductFormulationFilterOptionLabel(
                    item,
                    productFormulationFilterCounts.get(item) ?? 0
                  )}
                </option>
              ))}
            </select>
          </label>
        </div>
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
      <div className="mt-4 rounded-lg border border-line bg-mist p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">Parsed label quality score</h3>
          <span className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-slate-700">
            {labelProductQualityAssessment.score}/10
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Signal: {labelProductQualityAssessment.signal}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-line bg-white px-2 py-2 text-xs text-slate-600">
            <p className="font-semibold text-ink">Positive cues</p>
            <ul className="mt-2 grid gap-1">
              {labelProductQualityAssessment.positiveSignals.map((signal) => (
                <li key={signal}>{signal}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-md border border-line bg-white px-2 py-2 text-xs text-slate-600">
            <p className="font-semibold text-ink">Review flags</p>
            {labelProductQualityAssessment.reviewFlags.length > 0 ? (
              <ul className="mt-2 grid gap-1">
                {labelProductQualityAssessment.reviewFlags.map((flag) => (
                  <li key={flag}>{flag}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2">No local product-quality review flags from parsed label cues.</p>
            )}
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-600">
          {labelProductQualityAssessment.caveats.join(" ")}
        </p>
      </div>
      <div className="mt-4 rounded-lg border border-line bg-mist p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">Parsed label verification status</h3>
          <span className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-slate-700">
            {productLabelVerification.statusLabel}
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {productLabelVerification.detail}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-line bg-white px-2 py-2 text-xs text-slate-600">
            <p className="font-semibold text-ink">Verification evidence</p>
            <ul className="mt-2 grid gap-1">
              {productLabelVerification.evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-md border border-line bg-white px-2 py-2 text-xs text-slate-600">
            <p className="font-semibold text-ink">Next verification step</p>
            <p className="mt-2 leading-5">{productLabelVerification.nextAction}</p>
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-line bg-mist p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">Parsed certifications</h3>
          <span className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-slate-700">
            {parsedCertifications.length} captured
          </span>
        </div>
        {parsedCertifications.length > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {parsedCertifications.map((certification) => (
              <div
                key={certification.id}
                className="rounded-md border border-line bg-white px-2 py-2 text-xs text-slate-600"
              >
                <p className="font-semibold text-ink">{certification.label}</p>
                <p className="mt-1">Signal: {certification.signal}</p>
                <p className="mt-1 leading-5">{certification.note}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-slate-600">
            No recognized third-party certification was parsed. Product quality remains separate
            from efficacy evidence and AU/TGA status.
          </p>
        )}
      </div>
      <div className="mt-4 rounded-lg border border-line bg-mist p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">Parsed ingredients</h3>
          <span className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-slate-700">
            {parsedIngredients.length} captured
          </span>
        </div>
        {parsedIngredients.length > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {parsedIngredients.map((ingredient) => (
              <div
                key={`${ingredient.normalizedName}-${ingredient.amount ?? "unknown"}`}
                className="rounded-md border border-line bg-white px-2 py-2 text-xs text-slate-600"
              >
                <p className="font-semibold text-ink">{ingredient.displayName}</p>
                <p className="mt-1">Normalized: {ingredient.normalizedName}</p>
                {ingredient.blendContext ? (
                  <p className="mt-1">Context: {ingredient.blendContext}</p>
                ) : null}
                <p className="mt-1">
                  {ingredient.amount && ingredient.unit
                    ? `Captured amount: ${ingredient.amount} ${
                        ingredient.amountUnitLabel ?? ingredient.unit
                      }`
                    : "Amount not captured"}
                </p>
                {ingredient.amountMg !== undefined ? (
                  <p className="mt-1">
                    Metric normalization: {formatAmountMg(ingredient.amountMg)}{" "}
                    {ingredient.amountMetricUnit ?? "mg"}
                  </p>
                ) : null}
                {ingredient.amountConversion ? (
                  <p className="mt-1">
                    Converted amount: {ingredient.amountConversion.basis}{" "}
                    {ingredient.amountConversion.caveat}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-slate-600">
            No ingredient amounts were parsed from the current label text.
          </p>
        )}
      </div>
      <div className="mt-4 rounded-lg border border-line bg-mist p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">Parsed dose directions</h3>
          <span className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-slate-700">
            {parsedDoseCues.length} captured
          </span>
        </div>
        {parsedDoseCues.length > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {parsedDoseCues.map((cue) => (
              <div
                key={cue.id}
                className="rounded-md border border-line bg-white px-2 py-2 text-xs text-slate-600"
              >
                <p className="font-semibold text-ink">{cue.label}</p>
                <p className="mt-1">Cue type: {formatDoseCueKind(cue.kind)}</p>
                {cue.count !== undefined ? (
                  <p className="mt-1">
                    Count: {cue.count}
                    {cue.unit ? ` ${cue.unit}` : ""}
                  </p>
                ) : null}
                {cue.dailyUnitCount !== undefined ? (
                  <p className="mt-1">
                    Potential daily units: {cue.dailyUnitCount}
                    {cue.unit ? ` ${cue.unit}` : ""}
                  </p>
                ) : null}
                <p className="mt-1 leading-5">{cue.note}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-slate-600">
            No serving-size, per-unit, or daily-use direction cue was parsed. Amount review still
            depends on the exact product label basis.
          </p>
        )}
      </div>
      <div className="mt-4 rounded-lg border border-line bg-mist p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">Captured product identifiers</h3>
          <span className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-slate-700">
            {parsedProductIdentifiers.length} captured
          </span>
        </div>
        {parsedProductIdentifierVerifications.length > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {parsedProductIdentifierVerifications.map((verification) => (
              <div
                key={`${verification.label}-${verification.status?.id ?? verification.matchState}`}
                className="rounded-md border border-line bg-white px-2 py-2 text-xs text-slate-600"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">{verification.label}</p>
                    <p className="mt-1">Kind: {verification.kind}</p>
                  </div>
                  <span
                    className={cn(
                      "rounded-md border px-2 py-1 font-semibold",
                      parsedAustraliaIdentifierMatchTone(verification)
                    )}
                  >
                    {verification.matchStateLabel}
                  </span>
                </div>
                {verification.productName ? (
                  <p className="mt-2">
                    Local product: {verification.productName}
                    {verification.productBrand ? ` (${verification.productBrand})` : ""}
                  </p>
                ) : null}
                {verification.status ? (
                  <p className="mt-1">
                    Local status: {verification.status.kind} - {verification.status.status}
                  </p>
                ) : null}
                <p className="mt-1">AU confidence: {verification.confidence}</p>
                {verification.interventionStatusIds.length > 0 &&
                verification.matchState !== "local-product-match" ? (
                  <p className="mt-1">
                    Intervention-level matches: {verification.interventionStatusIds.length}
                  </p>
                ) : null}
                <p className="mt-1 leading-5">{verification.nextAction}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-slate-600">
            No AUST label identifier was parsed. Product-level Australian regulatory confidence
            still needs product-level evidence.
          </p>
        )}
      </div>
      <div className="mt-4 rounded-lg border border-line bg-mist p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">Ingredient evidence mapping</h3>
          <span className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-slate-700">
            {ingredientEvidenceMappings.filter((mapping) => mapping.intervention).length} matched
          </span>
        </div>
        {ingredientEvidenceMappings.length > 0 ? (
          <div className="mt-3 grid gap-2">
            {ingredientEvidenceMappings.map((mapping) => (
              <div
                key={`${mapping.ingredient.normalizedName}-${mapping.intervention?.id ?? "none"}`}
                className="rounded-md border border-line bg-white px-2 py-2 text-xs text-slate-600"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">{mapping.ingredient.displayName}</p>
                    <p className="mt-1">
                      {mapping.intervention
                        ? `Matched intervention: ${mapping.intervention.name}`
                        : "No local intervention match"}
                    </p>
                  </div>
                  <span className="rounded-md border border-line bg-mist px-2 py-1 font-semibold text-slate-700">
                    {mapping.claims.length} scored {mapping.claims.length === 1 ? "claim" : "claims"}
                  </span>
                </div>
                <p className="mt-2 leading-5">
                  Ingredient-level mapping only. It does not establish product-level efficacy,
                  product quality, dose/form match, or AU/TGA authorization.
                </p>
                {mapping.claims.length > 0 ? (
                  <ul className="mt-3 grid gap-2">
                    {mapping.claims.slice(0, 3).map((claim) => (
                      <li key={claim.id} className="border-l-2 border-line pl-2">
                        <p className="font-semibold text-ink">
                          Mapped claim: {claim.outcome} - {claim.finalLabel}
                        </p>
                        <p className="mt-1">Review status: {reviewStatusLabel(claim.reviewStatus)}</p>
                        <p className="mt-1">Dose/form evidence: {claim.doseFormStudied}</p>
                        <p className="mt-1">
                          Product amount match: not verified from label parsing alone.
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-slate-600">
            No parsed ingredients are available for local evidence mapping.
          </p>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-md border border-line bg-mist px-2 py-1 font-semibold text-slate-700">
          Showing {filteredProductSignals.length} of {productSignals.length} product profiles
        </span>
        <span className="rounded-md border border-line bg-white px-2 py-1 text-slate-600">
          Product AU/TGA: {productRegulatoryKind}
        </span>
        <span className="rounded-md border border-line bg-white px-2 py-1 text-slate-600">
          Quality signal: {productQualityFilter}
        </span>
        <span className="rounded-md border border-line bg-white px-2 py-1 text-slate-600">
          Formulation: {productFormulationFilter}
        </span>
        <span className="rounded-md border border-line bg-white px-2 py-1 text-slate-600">
          {formatCountLabel(
            productFormulationCoverage.fullyMappedCount,
            "fully ingredient-mapped profile"
          )}
        </span>
        <span
          className={cn(
            "rounded-md border px-2 py-1",
            productFormulationCoverage.withUnmatchedCount > 0
              ? "border-amberline/30 bg-amber-50 font-semibold text-amberline"
              : "border-line bg-white text-slate-600"
          )}
        >
          {formatCountLabel(
            productFormulationCoverage.withUnmatchedCount,
            "profile with unmatched ingredients"
          )}
        </span>
        <span className="rounded-md border border-line bg-white px-2 py-1 text-slate-600">
          {formatCountLabel(
            productFormulationCoverage.ingredientLevelClaimCount,
            "mapped ingredient claim"
          )}
        </span>
        <span className="rounded-md border border-line bg-white px-2 py-1 text-slate-600">
          {formatCountLabel(
            productFormulationCoverage.productSpecificEvidenceCount,
            "product-specific evidence row"
          )}
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {filteredProductSignals.length > 0 ? (
          filteredProductSignals.map((product) => (
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
                <span className="rounded-md border border-line bg-white px-2 py-1 font-semibold text-slate-700">
                  {formatCountLabel(product.ingredients.length, "captured ingredient")}
                </span>
                {product.proprietaryBlend ? (
                  <span className="rounded-md border border-amberline/30 bg-amber-50 px-2 py-1 font-semibold text-amberline">
                    Proprietary blend
                  </span>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                {product.ingredients.map((ingredient) => (
                  <span
                    key={`${product.id}-${ingredient}`}
                    className="rounded-md border border-line bg-white px-2 py-1 text-slate-700"
                  >
                    {ingredient}
                  </span>
                ))}
              </div>
              <ProductAustraliaRegulatoryChip
                verification={productAustraliaVerificationById.get(product.id)}
              />
              <ProductFormulationEvidenceSummary
                mapping={productFormulationEvidenceById.get(product.id)}
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
          ))
        ) : (
          <div className="rounded-lg border border-line bg-mist p-3 text-sm leading-6 text-slate-600 sm:col-span-2">
            No product profiles match the selected AU/TGA, quality-signal, and formulation filters.
          </div>
        )}
      </div>
    </section>
  );
}

function productRegulatoryKindFor(
  product: ProductSignal,
  productAustraliaVerificationById: Map<string, ProductAustraliaRegulatoryVerification>
): ProductRegulatoryKindFilter {
  return (
    productAustraliaVerificationById.get(product.id)?.status?.kind ??
    PRODUCT_REGULATORY_KIND_UNCAPTURED
  );
}

function productQualitySignalFor(product: ProductSignal): ProductQualityFilter {
  if (product.qualityScore >= 7) {
    return "Higher quality signal";
  }

  if (product.qualityScore <= 4) {
    return "Needs quality review";
  }

  return "Mixed quality signal";
}

function productFormulationFilterMatches(
  mapping: ProductFormulationEvidenceMapping,
  filter: ProductFormulationFilter
) {
  switch (filter) {
    case PRODUCT_FORMULATION_ALL:
      return true;
    case "Fully ingredient-mapped":
      return mapping.matchedIngredientCount > 0 && mapping.unmatchedIngredients.length === 0;
    case "Has unmatched ingredients":
      return mapping.unmatchedIngredients.length > 0;
    case "Product-specific evidence captured":
      return mapping.productSpecificEvidenceCount > 0;
    case "No local ingredient match":
      return mapping.matchedIngredientCount === 0 && mapping.ingredientLevelClaimCount === 0;
  }
}

function formatProductFormulationFilterOptionLabel(
  filter: ProductFormulationFilter,
  count: number
) {
  return `${filter} (${count})`;
}

function buildIngredientEvidenceMappings(
  ingredients: ParsedLabelIngredient[],
  interventions: Intervention[],
  claims: Claim[]
): IngredientEvidenceMapping[] {
  const interventionByName = new Map<string, Intervention>();

  interventions.forEach((intervention) => {
    [intervention.name, ...intervention.synonyms].forEach((name) => {
      interventionByName.set(normalizeEvidenceMappingName(name), intervention);
    });
  });

  return ingredients.map((ingredient) => {
    const intervention = interventionByName.get(ingredient.normalizedName);

    return {
      claims: intervention
        ? claims.filter((claim) => claim.interventionId === intervention.id)
        : [],
      ingredient,
      ...(intervention ? { intervention } : {})
    };
  });
}

function normalizeEvidenceMappingName(name: string) {
  return name
    .toLowerCase()
    .replace(/\bvitamin\s+d3\b/g, "vitamin d")
    .replace(/\bcholecalciferol\b/g, "vitamin d")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatAmountMg(amountMg: number) {
  return Number.isInteger(amountMg) ? amountMg.toLocaleString("en-US") : amountMg.toString();
}

function isDemoProductSignal(product: ProductSignal) {
  return product.brand.toLowerCase() === "demo profile";
}

function ProductFormulationEvidenceSummary({
  mapping
}: {
  mapping?: ProductFormulationEvidenceMapping;
}) {
  if (!mapping) {
    return null;
  }

  return (
    <details className="mt-3 rounded-md border border-line bg-white px-3 py-2 text-xs text-slate-600">
      <summary className="cursor-pointer font-semibold text-ink">
        Formulation evidence map: {mapping.statusLabel}
      </summary>
      <div className="mt-2 flex flex-wrap gap-2">
        <span className="rounded-md border border-line bg-mist px-2 py-1 font-semibold text-slate-700">
          {formatCountLabel(mapping.matchedIngredientCount, "matched ingredient")}
        </span>
        <span
          className={cn(
            "rounded-md border px-2 py-1 font-semibold",
            mapping.unmatchedIngredients.length > 0
              ? "border-amberline/30 bg-amber-50 text-amberline"
              : "border-line bg-mist text-slate-700"
          )}
        >
          {formatCountLabel(mapping.unmatchedIngredients.length, "unmatched ingredient")}
        </span>
        <span className="rounded-md border border-line bg-mist px-2 py-1 font-semibold text-slate-700">
          {formatCountLabel(mapping.ingredientLevelClaimCount, "ingredient-level claim")}
        </span>
        <span className="rounded-md border border-line bg-mist px-2 py-1 font-semibold text-slate-700">
          {formatCountLabel(mapping.productSpecificEvidenceCount, "product-specific row")}
        </span>
      </div>
      {mapping.productSpecificEvidence.length > 0 ? (
        <ul className="mt-3 grid gap-2">
          {mapping.productSpecificEvidence.slice(0, 3).map((evidence) => (
            <li key={evidence.id} className="border-l-2 border-line pl-2">
              <p className="font-semibold text-ink">{evidence.outcome}</p>
              <p className="mt-1">{evidence.detail}</p>
              <a
                href={evidence.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 font-semibold text-signal hover:underline"
              >
                {evidence.sourceLabel}{" "}
                <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {mapping.mappedIngredients.length > 0 ? (
        <ul className="mt-3 grid gap-2">
          {mapping.mappedIngredients.map((ingredient) => (
            <li key={ingredient.ingredient} className="border-l-2 border-line pl-2">
              <p className="font-semibold text-ink">{ingredient.ingredient}</p>
              <p className="mt-1">
                {ingredient.interventionName
                  ? `Matched intervention: ${ingredient.interventionName}`
                  : "No local scoped intervention match"}
              </p>
              {ingredient.claimSummaries.length > 0 ? (
                <p className="mt-1">
                  Claims:{" "}
                  {ingredient.claimSummaries
                    .slice(0, 2)
                    .map((claim) => `${claim.outcome} - ${claim.finalLabel}`)
                    .join("; ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <ul className="mt-3 grid gap-1">
        {mapping.readinessReasons.map((reason) => (
          <li key={reason} className="leading-5">
            {reason}
          </li>
        ))}
      </ul>
    </details>
  );
}

function formatCountLabel(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function formatDoseCueKind(kind: string) {
  switch (kind) {
    case "daily-directions":
      return "Daily directions";
    case "per-unit-amount":
      return "Per-unit amount";
    case "serving-size":
      return "Serving size";
    default:
      return kind;
  }
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
    case "Captured":
      return "border-amberline/30 bg-amber-50 text-amberline";
    case "Stale":
      return "border-amberline/30 bg-amber-50 text-amberline";
    case "Unknown":
      return "border-amberline/30 bg-amber-50 text-amberline";
    case "Missing":
      return "border-danger/30 bg-red-50 text-danger";
  }
}

function parsedAustraliaIdentifierMatchTone(
  verification: ParsedAustraliaRegulatoryIdentifierVerification
) {
  if (verification.matchState === "local-product-match") {
    return verification.confidence === "High" || verification.confidence === "Moderate"
      ? "border-spruce/30 bg-teal-50 text-spruce"
      : "border-amberline/30 bg-amber-50 text-amberline";
  }

  if (verification.matchState === "local-intervention-only-match") {
    return "border-amberline/30 bg-amber-50 text-amberline";
  }

  return "border-line bg-mist text-slate-700";
}

function regionalReviewPriorityTone(
  priority: RegionalSafetyRegulatoryReviewGap["reviewPriority"]
) {
  if (priority === "primary-lens-gap") {
    return "border-amberline/30 bg-amber-50 text-amberline";
  }

  if (priority === "captured-record-gap") {
    return "border-signal/25 bg-blue-50 text-signal";
  }

  if (priority === "unstarted-configured-scope") {
    return "border-slate-300 bg-slate-50 text-slate-700";
  }

  return "border-spruce/30 bg-teal-50 text-spruce";
}

function TrialWatcher({
  interventionsById,
  trialAlerts,
  trialWatchItems
}: {
  interventionsById: Map<string, Intervention>;
  trialAlerts: TrialAlert[];
  trialWatchItems: TrialWatchItem[];
}) {
  return (
    <section className="min-w-0 rounded-lg border border-line bg-white p-4 shadow-panel">
      <PanelExplainer
        explanation={panelExplanations["trial-watcher"]}
        title="Trial Watcher"
      />
      {trialAlerts.length > 0 ? (
        <div className="mt-4 rounded-md border border-line bg-mist p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink">Trial alert queue</h3>
            <span className="rounded-md border border-amberline/30 bg-amber-50 px-2 py-1 text-xs font-semibold text-amberline">
              {trialAlerts.length} review {trialAlerts.length === 1 ? "lead" : "leads"}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-600">
            Trial alerts are monitoring and review signals only. They do not change scores or
            promote evidence without extraction and human review.
          </p>
          <div className="mt-3 grid gap-2">
            {trialAlerts.slice(0, 4).map((alert) => (
              <article key={alert.id} className="rounded-md border border-line bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold leading-6 text-ink">{alert.title}</h4>
                    <p className="mt-1 text-xs text-slate-600">
                      {alert.nctId ?? "No NCT"} - detected {alert.detectedAt}
                    </p>
                  </div>
                  <TrialClassificationBadge detail={alert.detail} label={alert.kind} />
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-600">{alert.detail}</p>
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                  <MiniStat label="Status" value={alert.status} />
                  <MiniStat
                    label="Score link"
                    value={alert.scoreHistoryId ? "Linked after review" : "No score change"}
                  />
                  <MiniStat
                    label="Auto-promotion"
                    value={alert.noAutoPromotion ? "Disabled" : "Review required"}
                  />
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
      <div className="mt-4 grid gap-3">
        {trialWatchItems.length > 0 ? (
          trialWatchItems.map((item) => (
            <article key={item.id} className="rounded-lg border border-line bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
                  <p className="mt-1 text-xs text-slate-600">
                    {interventionsById.get(item.interventionId)?.name} - {item.lastUpdateDate}
                  </p>
                </div>
                <span className="rounded-md border border-signal/30 bg-blue-50 px-2 py-1 text-xs font-semibold text-signal">
                  {item.evidenceImpact}
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                <MiniStat label="Status" value={item.status} />
                <MiniStat label="Phase" value={item.phase} />
                <MiniStat label="Scope" value={item.enrollment} />
              </div>
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
  sourcePacketGapItems,
  studies
}: {
  activeClaim: Claim;
  activeIntervention?: Intervention;
  referencesById: Map<string, Reference>;
  sourcePacketGapItems: SourcePacketGapItem[];
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
    <section className="min-w-0 rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <PanelExplainer
            explanation={panelExplanations["sources-review"]}
            title="Sources and Review Queue"
          />
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
      <SourceGapQueue sourcePacketGapItems={sourcePacketGapItems} />
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

function SourceGapQueue({
  sourcePacketGapItems
}: {
  sourcePacketGapItems: SourcePacketGapItem[];
}) {
  const hasSourcePacketGaps = sourcePacketGapItems.length > 0;

  return (
    <section className="mt-4 rounded-lg border border-line bg-mist p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">
            {hasSourcePacketGaps ? "Source gap queue" : "Source packet coverage"}
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {hasSourcePacketGaps
              ? "Read-only local queue for incomplete source packets. Choose a claim to inspect next; this does not accept sources, change scores, or mark evidence reviewed."
              : "All local source packets are linked and extracted. This panel stays read-only and does not mark evidence human reviewed."}
          </p>
        </div>
        <span className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-slate-700">
          {hasSourcePacketGaps
            ? `${sourcePacketGapItems.length} local source-packet gaps`
            : "No local source-packet gaps"}
        </span>
      </div>
      {sourcePacketGapItems.length > 0 ? (
        <div className="mt-3 max-h-80 overflow-y-auto pr-1">
          <ol className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {sourcePacketGapItems.map((item) => (
              <li key={item.claimId} className="rounded-md border border-line bg-white p-2">
                <p className="text-xs font-semibold text-ink">
                  {item.interventionName} - {item.outcomeLabel}
                </p>
                <p className="mt-1 text-xs text-slate-600">{item.label}</p>
                <p className="mt-2 text-xs leading-5 text-slate-600">{item.nextStep}</p>
                {item.interventionSlug ? (
                  <a
                    className="mt-2 inline-flex rounded-md border border-line bg-mist px-2 py-1 text-xs font-semibold text-signal hover:border-signal"
                    href={`/interventions/${item.interventionSlug}#source-packet-${item.claimId}`}
                  >
                    Open source packet
                  </a>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="mt-3 rounded-md border border-line bg-white p-2 text-xs leading-5 text-slate-600">
          Source-packet coverage is complete for the current local dataset. Continue to treat human
          review, AU/TGA product status, safety clearance, and medical advice as separate checks.
        </p>
      )}
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
          <h3 className="text-sm font-semibold text-ink">Selected claim source packet</h3>
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
          Submit a PubMed term or use the selected-claim suggestion to load live citation candidates.
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
          Submit a ClinicalTrials.gov term or use the selected-claim suggestion to load live trial records.
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
        <TrialClassificationBadge
          detail={study.trialAlertDetail}
          label={study.trialAlertLabel}
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
        <MiniStat label="Alert" value={study.trialAlertLabel} />
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

function TrialClassificationBadge({ detail, label }: { detail: string; label: string }) {
  return (
    <span
      aria-label={`${label}: ${detail}`}
      className={cn(
        "rounded-md border px-2 py-1 text-xs font-semibold",
        trialClassificationTone(label)
      )}
      title={detail}
    >
      {label}
    </span>
  );
}

function trialClassificationTone(label: string) {
  if (label === "Direct match" || label === "Results posted") {
    return "border-spruce/30 bg-teal-50 text-spruce";
  }

  if (label === "Combination product") {
    return "border-signal/25 bg-blue-50 text-signal";
  }

  if (
    label === "Related outcome only" ||
    label === "Completed, no results posted" ||
    label === "Missing results follow-up" ||
    label === "Monitor active trial"
  ) {
    return "border-amberline/30 bg-amber-50 text-amberline";
  }

  if (
    label === "Wrong population" ||
    label === "Terminated/unknown" ||
    label === "Registry status review"
  ) {
    return "border-danger/30 bg-red-50 text-danger";
  }

  if (label === "Results review needed") {
    return "border-spruce/30 bg-teal-50 text-spruce";
  }

  return "border-slate-300 bg-slate-50 text-slate-700";
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
