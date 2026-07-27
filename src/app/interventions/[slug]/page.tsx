import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { DashboardDataUnavailable } from "@/app/dashboard-data-unavailable";
import { InterventionTrialList } from "@/components/intervention-trial-list";
import { PublicSiteNav } from "@/components/public-site-nav";
import { SupplementBriefView } from "@/components/supplement-brief";
import {
  claimEvidenceDirectionLabel,
  isAdverseDirectionClaim
} from "@/lib/claim-direction";
import { getInterventionEvidenceDashboardData } from "@/lib/data/dashboard";
import { buildSupplementBrief } from "@/lib/evidence-brief";
import { australiaRegulatoryKindDescription, australiaRegulatoryTone } from "@/lib/regulatory";
import { summarizeReviewStatus } from "@/lib/review-summary";
import {
  buildScoreReadinessRows,
  scoreReadinessNextAction,
  type ScoreReadinessRow
} from "@/lib/score-readiness";
import {
  buildClaimSourcePacket,
  summarizeClaimSourcePackets,
  type ClaimSourcePacket,
  type EvidenceDepthBadge
} from "@/lib/source-packet";
import {
  compositeScore,
  getClaimScoreRows,
  labelTone,
  scoreBand,
  severityTone
} from "@/lib/scoring";
import type {
  AustraliaRegulatoryStatus,
  Claim,
  EvidenceDashboardData,
  Intervention,
  ProductSignal,
  Reference,
  SafetyAlert,
  Study
} from "@/lib/types";
import { hasBeenReviewed, isHumanConfirmed } from "@/lib/review-status";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Intervention Detail | Apex Lifespan",
  description:
    "What the research actually shows for one supplement, what it will not do, and the sources behind it."
};

const DRAFT_LEAD_EVIDENCE_GRADE = "Draft lead";
const SOURCE_PACKET_REVIEW_EVIDENCE_GRADE = "Insufficient until source packets are reviewed.";

type InterventionDetailPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ tab?: string | string[] }>;
};

type InterventionDetailTab = "brief" | "overview" | "claims" | "sources" | "safety" | "audit";

type InterventionDetailTabItem = {
  badge?: string;
  id: InterventionDetailTab;
  label: string;
};

const INTERVENTION_DETAIL_TABS: InterventionDetailTabItem[] = [
  { id: "brief", label: "Summary" },
  { id: "overview", label: "Full detail" },
  { id: "claims", label: "Claims" },
  { id: "sources", label: "Sources" },
  { id: "safety", label: "Safety & trials" },
  { id: "audit", label: "Audit" }
];

export default async function InterventionDetailPage({
  params,
  searchParams
}: InterventionDetailPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const activeTab = interventionDetailTabFromSearchParam(resolvedSearchParams?.tab);
  let data: EvidenceDashboardData;

  try {
    data = await getInterventionEvidenceDashboardData(slug);
  } catch {
    return <DashboardDataUnavailable />;
  }

  const intervention = data.interventions.find((item) => item.slug === slug);

  if (!intervention) {
    notFound();
  }

  const referencesById = new Map(data.references.map((reference) => [reference.id, reference]));
  const claims = data.claims.filter((claim) => claim.interventionId === intervention.id);
  const scoreReadinessRows = buildScoreReadinessRows({ ...data, claims });
  const readinessByClaimId = new Map(
    scoreReadinessRows.map((row) => [row.claim.id, row])
  );
  const sourcePackets = claims.map((claim) => ({
    claim,
    packet:
      readinessByClaimId.get(claim.id)?.packet ??
      buildClaimSourcePacket({
        claim,
        referencesById,
        studies: data.studies
      })
  }));
  const sourcePacketsByClaimId = new Map(
    sourcePackets.map((item) => [item.claim.id, item.packet])
  );
  const readiness = buildInterventionReadinessSummary({
    claims,
    referencesById,
    readinessRows: scoreReadinessRows,
    studies: data.studies
  });
  const safetyAlerts = data.safetyAlerts.filter(
    (alert) => alert.interventionId === intervention.id
  );
  const trialWatchItems = data.trialWatchItems.filter(
    (trial) => trial.interventionId === intervention.id
  );
  const australiaStatuses = data.australiaRegulatoryStatuses.filter(
    (status) => status.interventionId === intervention.id
  );
  const productSignals = productSignalsForIntervention(data.productSignals, intervention);
  const productSignalIds = new Set(productSignals.map((product) => product.id));
  const productAustraliaStatuses = data.australiaRegulatoryStatuses.filter(
    (status) => status.productId && productSignalIds.has(status.productId)
  );
  const claimIds = new Set(claims.map((claim) => claim.id));
  const snapshotsByClaimId = new Map(
    (data.claimScoreSnapshots ?? [])
      .filter((snapshot) => claimIds.has(snapshot.claimId))
      .map((snapshot) => [snapshot.claimId, snapshot])
  );
  const scoreHistory = (data.claimScoreHistory ?? [])
    .filter((entry) => claimIds.has(entry.claimId))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const detailTabs = interventionDetailTabsWithBadges({
    australiaStatuses,
    claims,
    productSignals,
    safetyAlerts,
    scoreHistory,
    sourcePackets,
    trialWatchItems
  });

  if (activeTab === "brief") {
    const brief = buildSupplementBrief({
      claims,
      intervention,
      packets: sourcePacketsByClaimId,
      safetyAlerts
    });

    return (
      <main className="min-h-screen">
        <div className="mx-auto w-full max-w-4xl px-4 pt-4 sm:px-6">
          <PublicSiteNav activeSection="supplements" showBrand={false} />
        </div>
        <SupplementBriefView
          brief={brief}
          detailHref={interventionDetailTabHref(intervention.slug, "overview")}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <header className="rounded-lg border border-line bg-white p-4 shadow-panel">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <Link
                className="inline-flex rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-signal hover:text-signal"
                href="/"
              >
                Back to dashboard
              </Link>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Plain-language evidence brief
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-ink">
                {intervention.name}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700">
                A reader-first summary of possible benefits, important limitations, safety, and
                the strength of the linked evidence. Detailed scores and source notes remain
                available below for anyone who wants the audit trail.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-md border border-line bg-mist px-2 py-1 text-slate-700">
                {intervention.category}
              </span>
              <span className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-slate-700">
                Last reviewed {intervention.lastReviewed}
              </span>
              <span className="rounded-md border border-signal/25 bg-blue-50 px-2 py-1 text-signal">
                {claims.length} claim {claims.length === 1 ? "card" : "cards"}
              </span>
            </div>
          </div>
          {isPeptideOrTherapeutic(intervention, claims) ? (
            <p className="mt-4 rounded-md border border-amberline/30 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-950">
              Peptide and therapeutic-intervention cards emphasize regulatory status, approved
              indications, human evidence, safety signals, product-quality risk, and clinician
              oversight. Apex must not provide sourcing, compounding, reconstitution, injection,
              cycling, or self-administration instructions.
            </p>
          ) : null}
        </header>

        <InterventionDetailTabs
          activeTab={activeTab}
          slug={intervention.slug}
          tabs={detailTabs}
        />

        {activeTab === "overview" ? (
          <>
            <DetailedEvidenceSummary
              australiaStatuses={australiaStatuses}
              compact
              intervention={intervention}
              productAustraliaStatuses={productAustraliaStatuses}
              productSignals={productSignals}
              readinessByClaimId={readinessByClaimId}
              safetyAlerts={safetyAlerts}
              sourcePackets={sourcePackets}
            />

            <CollapsibleSection defaultOpen title="Evidence quality and review status">
              <InterventionReadinessPanel
                australiaStatuses={australiaStatuses}
                productAustraliaStatuses={productAustraliaStatuses}
                productSignals={productSignals}
                readiness={readiness}
                safetyAlerts={safetyAlerts}
              />
            </CollapsibleSection>

            <CollapsibleSection defaultOpen title="Supplement context">
              <div className="grid gap-3 md:grid-cols-2">
                <InfoCard label="Common forms" value={intervention.commonForms.join(", ")} />
                <InfoCard label="Regulatory status" value={intervention.regulatoryStatus} />
                <InfoCard label="Safety summary" value={intervention.safetySummary} />
                <InfoCard label="Interaction summary" value={intervention.interactionSummary} />
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              badge={`${claims.length} outcomes`}
              title="Score index by outcome (secondary)"
            >
              <p className="mb-3 text-sm leading-6 text-slate-600">
                Use this grid as a navigation and audit index. The evidence brief above is the main
                interpretation; a number alone should not be read as a recommendation to take a
                supplement.
              </p>
              {claims.length > 0 ? (
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {claims.map((claim) => {
                    const scoreState = claimScorePresentation(
                      claim,
                      readinessByClaimId.get(claim.id)
                    );

                    return (
                      <article
                        className={cn("rounded-lg border p-3", scoreState.tone)}
                        id={`claim-score-${claim.id}`}
                        key={claim.id}
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide">
                          {shortOutcome(claim.outcome)}
                        </p>
                        <p className="mt-2 text-xs font-semibold">{scoreState.compositeLabel}</p>
                        {scoreState.score === null ? (
                          <>
                            <p className="mt-2 text-lg font-semibold">{scoreState.primary}</p>
                            <p className="mt-1 text-xs font-semibold">{scoreState.secondary}</p>
                          </>
                        ) : (
                          <>
                            <p className="mt-2 text-2xl font-semibold">
                              {scoreState.score.toFixed(1)}
                            </p>
                            <p className="mt-1 text-xs font-semibold">{scoreState.secondary}</p>
                          </>
                        )}
                        <p className="mt-2 text-xs leading-5">
                          {classificationLabel(claim, readinessByClaimId.get(claim.id))}:{" "}
                          {claim.finalLabel}
                        </p>
                        <p className="mt-1 text-xs leading-5">
                          {reviewStatusLabel(claim.reviewStatus)}
                        </p>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <EmptyState>No scored claim rows are attached to this intervention yet.</EmptyState>
              )}
            </CollapsibleSection>
          </>
        ) : null}

        {activeTab === "claims" ? (
          <CollapsibleSection
            badge={`${claims.length}`}
            defaultOpen
            title="Claim-by-claim evidence notes"
          >
            <div className="grid gap-3">
              {claims.map((claim) => (
                <ClaimCard
                  claim={claim}
                  key={claim.id}
                  packet={sourcePacketsByClaimId.get(claim.id)}
                  readinessRow={readinessByClaimId.get(claim.id)}
                  referencesById={referencesById}
                />
              ))}
            </div>
          </CollapsibleSection>
        ) : null}

        {activeTab === "sources" ? (
          <CollapsibleSection badge={`${claims.length}`} title="Source trail">
            <div className="grid gap-3">
              {sourcePackets.map(({ claim, packet }) => (
                <SourcePacketCard
                  claim={claim}
                  key={claim.id}
                  packet={packet}
                  referencesById={referencesById}
                />
              ))}
            </div>
          </CollapsibleSection>
        ) : null}

        {activeTab === "safety" ? (
          <>
            <CollapsibleSection
              badge={safetyAlerts.length > 0 ? String(safetyAlerts.length) : undefined}
              title="Safety alerts"
            >
              {safetyAlerts.length > 0 ? (
                <div className="grid gap-3">
                  {safetyAlerts.map((alert) => (
                    <SafetyAlertCard alert={alert} key={alert.id} />
                  ))}
                </div>
              ) : (
                <EmptyState>
                  No local safety alerts are attached to this intervention. This does not imply
                  safety, efficacy, or regulatory clearance.
                </EmptyState>
              )}
            </CollapsibleSection>

            <CollapsibleSection
              badge={trialWatchItems.length > 0 ? String(trialWatchItems.length) : undefined}
              title="Trial watcher"
            >
              <InterventionTrialList intervention={intervention} trials={trialWatchItems} />
            </CollapsibleSection>

            <CollapsibleSection title="AU/TGA and product context">
              <div className="grid gap-3">
                {australiaStatuses.length > 0 ? (
                  australiaStatuses.map((status) => (
                    <AustraliaStatusCard key={status.id} status={status} />
                  ))
                ) : (
                  <EmptyState>
                    No intervention-level AU/TGA status row is captured yet. Product-level
                    confidence needs product-level evidence.
                  </EmptyState>
                )}
                {productSignals.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {productSignals.map((product) => {
                      const productStatuses = productAustraliaStatuses.filter(
                        (status) => status.productId === product.id
                      );

                      return (
                        <ProductContextCard
                          key={product.id}
                          product={product}
                          statuses={productStatuses}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState>
                    No matching local product-signal row is attached to this intervention.
                  </EmptyState>
                )}
              </div>
            </CollapsibleSection>
          </>
        ) : null}

        {activeTab === "audit" ? (
          <>
        <CollapsibleSection title="Score/audit history">
          {claims.length > 0 ? (
            <div className="grid gap-4">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr>
                      {["Claim", "Current score", "Band", "Label", "Snapshot date"].map((heading) => (
                        <th
                          className="border-b border-line bg-mist px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
                          key={heading}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {claims.map((claim) => {
                      const snapshot = snapshotsByClaimId.get(claim.id);
                      const scoreState = claimScorePresentation(
                        claim,
                        readinessByClaimId.get(claim.id)
                      );
                      const finalLabel = snapshot?.finalLabel ?? claim.finalLabel;
                      const snapshotDate = snapshot
                        ? formatSnapshotDate(snapshot.computedAt)
                        : claim.lastUpdated;

                      return (
                        <tr key={claim.id}>
                          <td className="border-b border-line px-3 py-3 text-slate-700">
                            {shortOutcome(claim.outcome)}
                          </td>
                          <td className="border-b border-line px-3 py-3 font-semibold text-ink">
                            {scoreState.score === null
                              ? scoreState.primary
                              : scoreState.score.toFixed(1)}
                          </td>
                          <td className="border-b border-line px-3 py-3 text-slate-700">
                            {scoreState.tableBand}
                          </td>
                          <td className="border-b border-line px-3 py-3">
                            <span
                              className={cn(
                                "rounded-md border px-2 py-1 text-xs font-semibold",
                                labelTone(finalLabel)
                              )}
                            >
                              {finalLabel}
                            </span>
                          </td>
                          <td className="border-b border-line px-3 py-3 text-slate-700">
                            {snapshotDate}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {scoreHistory.length > 0 ? (
                <div className="grid gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Recorded score changes
                  </p>
                  {scoreHistory.map((entry) => (
                    <div
                      className="rounded-md border border-line bg-mist px-3 py-2 text-sm leading-6 text-slate-700"
                      key={entry.id}
                    >
                      <p className="font-semibold text-ink">
                        {shortOutcome(
                          claims.find((claim) => claim.id === entry.claimId)?.outcome ?? entry.claimId
                        )}
                        {entry.oldCompositeScore !== undefined &&
                        entry.newCompositeScore !== undefined ? (
                          <>
                            {" "}
                            {entry.oldCompositeScore.toFixed(1)} → {entry.newCompositeScore.toFixed(1)}
                          </>
                        ) : null}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {formatHistoryReason(entry.reason)} · {formatSnapshotDate(entry.createdAt)}
                      </p>
                      <p className="mt-1">{entry.rationale}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              <p className="rounded-md border border-line bg-mist px-3 py-2 text-xs leading-5 text-slate-600">
                Score history prefers normalized database snapshots when present. Decimal scores are
                provisional review heuristics, not clinical recommendations.
              </p>
            </div>
          ) : (
            <EmptyState>No score snapshots are attached to this intervention yet.</EmptyState>
          )}
        </CollapsibleSection>

        <CollapsibleSection title="What would change the score">
          {claims.length > 0 ? (
            <div className="grid gap-2">
              {claims.map((claim) => (
                <InfoCard
                  key={claim.id}
                  label={shortOutcome(claim.outcome)}
                  value={claim.whatWouldChangeScore}
                />
              ))}
            </div>
          ) : (
            <EmptyState>No score-change criteria are attached to this intervention yet.</EmptyState>
          )}
        </CollapsibleSection>
          </>
        ) : null}
      </div>
    </main>
  );
}

function interventionDetailTabFromSearchParam(value?: string | string[]): InterventionDetailTab {
  const tab = Array.isArray(value) ? value[0] : value;

  return INTERVENTION_DETAIL_TABS.some((item) => item.id === tab)
    ? (tab as InterventionDetailTab)
    : "brief";
}

function interventionDetailTabHref(slug: string, tab: InterventionDetailTab) {
  return tab === "brief" ? `/interventions/${slug}` : `/interventions/${slug}?tab=${tab}`;
}

function interventionDetailTabsWithBadges({
  australiaStatuses,
  claims,
  productSignals,
  safetyAlerts,
  scoreHistory,
  sourcePackets,
  trialWatchItems
}: {
  australiaStatuses: AustraliaRegulatoryStatus[];
  claims: Claim[];
  productSignals: ProductSignal[];
  safetyAlerts: SafetyAlert[];
  scoreHistory: NonNullable<EvidenceDashboardData["claimScoreHistory"]>;
  sourcePackets: ClaimPacketPair[];
  trialWatchItems: EvidenceDashboardData["trialWatchItems"];
}): InterventionDetailTabItem[] {
  const safetyRows =
    safetyAlerts.length + trialWatchItems.length + australiaStatuses.length + productSignals.length;

  return INTERVENTION_DETAIL_TABS.map((tab) => {
    switch (tab.id) {
      case "claims":
        return { ...tab, badge: String(claims.length) };
      case "sources":
        return { ...tab, badge: String(sourcePackets.length) };
      case "safety":
        return { ...tab, badge: safetyRows > 0 ? String(safetyRows) : undefined };
      case "audit":
        return { ...tab, badge: String(claims.length + scoreHistory.length) };
      case "brief":
      case "overview":
        return tab;
    }
  });
}

function InterventionDetailTabs({
  activeTab,
  slug,
  tabs
}: {
  activeTab: InterventionDetailTab;
  slug: string;
  tabs: InterventionDetailTabItem[];
}) {
  return (
    <nav
      aria-label="Intervention detail sections"
      className="rounded-lg border border-line bg-white p-2 shadow-panel"
    >
      <div className="flex gap-2 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition",
                isActive
                  ? "border-signal bg-blue-50 text-signal"
                  : "border-transparent bg-white text-slate-700 hover:border-signal/40 hover:bg-mist"
              )}
              href={interventionDetailTabHref(slug, tab.id)}
              key={tab.id}
            >
              {tab.label}
              {tab.badge ? (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px]",
                    isActive ? "bg-white text-signal" : "bg-mist text-slate-600"
                  )}
                >
                  {tab.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function CollapsibleSection({
  badge,
  children,
  defaultOpen = false,
  title
}: {
  badge?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  title: string;
}) {
  return (
    <details
      className="group/section rounded-lg border border-line bg-white shadow-panel [&_summary::-webkit-details-marker]:hidden"
      open={defaultOpen || undefined}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 outline-none transition hover:bg-mist focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-signal/20">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {badge ? (
            <span className="rounded-full bg-mist px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {badge}
            </span>
          ) : null}
        </div>
        <ChevronDown
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-slate-600 transition group-open/section:rotate-180"
        />
      </summary>
      <div className="border-t border-line p-4">{children}</div>
    </details>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-mist p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{value}</p>
    </div>
  );
}

type ClaimPacketPair = {
  claim: Claim;
  packet: ClaimSourcePacket;
};

type SupplementPracticalReadout = {
  confidenceAndMaturity: string[];
  doesNotProve: string[];
  longevityHealthspanRead: string[];
  mainCautions: string[];
  mayHelpWith: string[];
  whoMightCare: string[];
  whyItStandsOut: string[];
};

type ReaderOutcomeRow = ClaimPacketPair & {
  scoreState: ClaimScorePresentation;
};

type ReaderOutcomeVerdict = {
  kind: "caution" | "insufficient" | "possible" | "risk" | "unclear";
  label: string;
  tone: string;
};

function buildReaderOutcomeRows(
  sourcePackets: ClaimPacketPair[],
  readinessByClaimId: Map<string, ScoreReadinessRow>
): ReaderOutcomeRow[] {
  return sourcePackets
    .map((row) => ({
      ...row,
      scoreState: claimScorePresentation(row.claim, readinessByClaimId.get(row.claim.id))
    }))
    .sort((left, right) => readerOutcomePriority(right) - readerOutcomePriority(left));
}

function readerOutcomePriority({ claim, packet, scoreState }: ReaderOutcomeRow) {
  const matureBenefit =
    isPracticalBenefitClaim(claim) &&
    isPracticalSummaryMatureClaim(claim) &&
    packet.completeness.status === "complete";
  const readableEvidence = packet.completeness.status === "complete" ? 10 : 0;
  const maturity = matureBenefit ? 40 : 0;
  const riskPriority = isAdverseDirectionClaim(claim) ? 60 : 0;
  const labelPenalty = [
    "Avoid / Not Recommended",
    "Regulatory Concern",
    "Requires Clinician Oversight",
    "Safety Concern"
  ].includes(claim.finalLabel)
    ? 15
    : 0;

  return riskPriority + maturity + readableEvidence + (scoreState.score ?? 0) - labelPenalty;
}

function readerOutcomeVerdict(row: ReaderOutcomeRow): ReaderOutcomeVerdict {
  const { claim, packet, scoreState } = row;

  if (isAdverseDirectionClaim(claim)) {
    return {
      kind: "risk",
      label: "Possible risk",
      tone: "border-danger/30 bg-red-50 text-danger"
    };
  }

  if (
    claim.finalLabel === "Avoid / Not Recommended" ||
    claim.finalLabel === "Regulatory Concern" ||
    claim.finalLabel === "Requires Clinician Oversight" ||
    claim.finalLabel === "Safety Concern"
  ) {
    return {
      kind: "caution",
      label: "Caution / unclear",
      tone: "border-amberline/30 bg-amber-50 text-amberline"
    };
  }

  if (scoreState.score === null || packet.completeness.status !== "complete") {
    return {
      kind: "unclear",
      label: "Not enough data",
      tone: "border-slate-300 bg-slate-50 text-slate-700"
    };
  }

  if (claim.finalLabel === "Insufficient Evidence") {
    return {
      kind: "insufficient",
      label: "No clear benefit",
      tone: "border-slate-300 bg-slate-50 text-slate-700"
    };
  }

  if (claim.confidenceLevel === "Low" || claim.confidenceLevel === "Very low") {
    return {
      kind: "unclear",
      label: "Evidence unclear",
      tone: "border-amberline/30 bg-amber-50 text-amberline"
    };
  }

  return {
    kind: "possible",
    label: "May help in studied settings",
    tone: "border-spruce/30 bg-teal-50 text-spruce"
  };
}

function readerOutcomeFinding(intervention: Intervention, row: ReaderOutcomeRow) {
  const verdict = readerOutcomeVerdict(row);
  const curatedSummary = cleanStudyText(row.claim.summary ?? "");

  if (verdict.kind === "risk" && curatedSummary) {
    return firstSentence(curatedSummary);
  }

  if (verdict.kind === "caution") {
    return "This outcome is tracked mainly as a caution or unresolved signal, not as a demonstrated benefit.";
  }

  if (verdict.kind === "insufficient") {
    return "The current local evidence does not show a clear benefit for this outcome.";
  }

  if (verdict.kind === "unclear") {
    return `Research is linked to this outcome, but the evidence is too uncertain to say whether ${intervention.name} helps.`;
  }

  return curatedSummary
    ? firstSentence(curatedSummary)
    : "The linked evidence suggests a possible benefit in the studied setting, but the result should not be generalized beyond that context.";
}

function readerOutcomeCaveat({ claim, packet }: ReaderOutcomeRow) {
  if (packet.completeness.status !== "complete") {
    return "Some linked evidence has not been fully extracted or checked yet.";
  }

  if (claim.confidenceLevel === "Very low") {
    return "Very low confidence. Source relevance and outcome matching still need review.";
  }

  if (claim.confidenceLevel === "Low") {
    return "Low confidence. The conclusion may change as the source set is reviewed.";
  }

  const curatedUncertainty = cleanStudyText(claim.uncertainty ?? "");
  return curatedUncertainty
    ? firstSentence(curatedUncertainty.replace(/^Uncertainty(?: remains because|:)\s*/i, ""))
    : "The result still depends on the studied population, product form, duration, and outcome.";
}

function readerBottomLine(intervention: Intervention, rows: ReaderOutcomeRow[]) {
  const matureBenefits = rows.filter(
    ({ claim, packet }) =>
      isPracticalBenefitClaim(claim) &&
      isPracticalSummaryMatureClaim(claim) &&
      packet.completeness.status === "complete"
  );

  if (matureBenefits.length > 0) {
    const outcomes = matureBenefits.map(({ claim }) => shortOutcome(claim.outcome));
    return `The clearest current evidence for ${intervention.name} relates to ${naturalJoin(outcomes)}. Even these findings are limited to the studied populations, forms, durations, and outcomes; they are not a recommendation or proof for every product or person.`;
  }

  if (rows.length > 0) {
    const outcomes = rows.slice(0, 3).map(({ claim }) => shortOutcome(claim.outcome));
    return `The local evidence does not yet support a clear, settled health benefit for ${intervention.name}. Research is linked across ${naturalJoin(outcomes)}${rows.length > 3 ? " and other outcomes" : ""}, but the leading claims are still low-confidence or unreviewed.`;
  }

  return `There is not enough reviewed local evidence to summarize a clear health benefit for ${intervention.name} yet.`;
}

function readerOverallConfidence(rows: ReaderOutcomeRow[]) {
  // Human confirmation, not merely "someone looked at it". This drives the
  // site's strongest reader-facing confidence badge, so AI review must not be
  // able to raise it — that is the laundering `AI reviewed` exists to prevent.
  const reviewedHighConfidence = rows.some(
    ({ claim, packet }) =>
      claim.confidenceLevel === "High" &&
      isHumanConfirmed(claim.reviewStatus) &&
      packet.completeness.status === "complete" &&
      isPracticalBenefitClaim(claim)
  );
  const matureEvidence = rows.some(
    ({ claim, packet }) =>
      (claim.confidenceLevel === "High" || claim.confidenceLevel === "Moderate") &&
      packet.completeness.status === "complete" &&
      isPracticalBenefitClaim(claim)
  );

  if (reviewedHighConfidence) {
    return {
      label: "Overall confidence: higher",
      tone: "border-spruce/30 bg-teal-50 text-spruce"
    };
  }

  if (matureEvidence) {
    return {
      label: "Overall confidence: moderate",
      tone: "border-signal/25 bg-blue-50 text-signal"
    };
  }

  return {
    label: "Overall confidence: low",
    tone: "border-amberline/30 bg-amber-50 text-amberline"
  };
}

function readerReviewLabel(sourcePackets: ClaimPacketPair[]) {
  const claims = sourcePackets.map(({ claim }) => claim);
  const humanReviewed = claims.filter(({ reviewStatus }) => reviewStatus === "Human reviewed").length;

  if (claims.length > 0 && humanReviewed === claims.length) {
    return "Review status: Human reviewed";
  }

  if (humanReviewed > 0) {
    return "Review status: mixed";
  }

  return "Review status: AI-assisted draft";
}

function ReaderEvidenceOverview({
  australiaStatuses,
  intervention,
  practicalReadout,
  productAustraliaStatuses,
  productSignals,
  safetyAlerts,
  sourcePackets,
  outcomeRows
}: {
  australiaStatuses: AustraliaRegulatoryStatus[];
  intervention: Intervention;
  practicalReadout: SupplementPracticalReadout;
  productAustraliaStatuses: AustraliaRegulatoryStatus[];
  productSignals: ProductSignal[];
  safetyAlerts: SafetyAlert[];
  sourcePackets: ClaimPacketPair[];
  outcomeRows: ReaderOutcomeRow[];
}) {
  const confidence = readerOverallConfidence(outcomeRows);
  const references = uniqueReferences(sourcePackets.flatMap(({ packet }) => packet.references));
  const studies = uniqueStudies(sourcePackets.flatMap(({ packet }) => packet.studies));
  const humanReviewed = sourcePackets.filter(({ claim }) => isHumanReviewed(claim.reviewStatus)).length;
  const unreviewed = sourcePackets.length - humanReviewed;
  const safetyRows = outcomeRows.filter(({ claim }) => claim.outcome === "Safety/adverse effects");
  const safetyStudies = uniqueStudies(safetyRows.flatMap(({ packet }) => packet.studies));
  const unknowns = [
    unreviewed > 0
      ? `${unreviewed} of ${sourcePackets.length} outcome summaries have not been human reviewed.`
      : "All visible outcome summaries have a recorded human review.",
    ...practicalReadout.doesNotProve.slice(0, 2)
  ];

  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-signal">Evidence brief</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">What the evidence says</h2>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className={cn("rounded-md border px-2 py-1", confidence.tone)}>
            {confidence.label}
          </span>
          <span className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-slate-700">
            {readerReviewLabel(sourcePackets)}
          </span>
        </div>
      </div>

      <section className="mt-4 rounded-md border border-signal/20 bg-blue-50 p-4">
        <h3 className="text-sm font-semibold text-ink">Bottom line</h3>
        <p className="mt-2 max-w-4xl text-base leading-7 text-slate-800">
          {readerBottomLine(intervention, outcomeRows)}
        </p>
      </section>

      <CrossStudyEvidenceSummary
        intervention={intervention}
        outcomeRows={outcomeRows}
        productAustraliaStatuses={productAustraliaStatuses}
        productSignals={productSignals}
        safetyAlerts={safetyAlerts}
        sourcePackets={sourcePackets}
      />

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <section className="rounded-md border border-amberline/30 bg-amber-50 p-4 text-amber-950">
          <h3 className="text-base font-semibold">Safety and interactions</h3>
          <p className="mt-2 text-sm leading-6">{intervention.safetySummary}</p>
          <p className="mt-2 text-sm leading-6">{intervention.interactionSummary}</p>
          <p className="mt-3 rounded-md border border-amberline/20 bg-white px-3 py-2 text-xs leading-5">
            The local record contains {safetyRows.length} scoped safety claim
            {safetyRows.length === 1 ? "" : "s"} and {safetyStudies.length} linked safety-related
            study record{safetyStudies.length === 1 ? "" : "s"}. These records provide context;
            they do not prove product-level safety.
          </p>
          {safetyAlerts.length > 0 ? (
            <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm leading-6">
              {safetyAlerts.slice(0, 2).map((alert) => (
                <li key={alert.id}>{firstSentence(alert.summary)}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm font-semibold leading-6">
              No local safety alerts were found. This does not mean the supplement is safe.
            </p>
          )}
          <a
            className="mt-3 inline-flex text-sm font-semibold text-amber-950 underline"
            href={`/interventions/${intervention.slug}?tab=safety`}
          >
            Read safety and trial details
          </a>
        </section>

        <section className="rounded-md border border-line bg-mist p-4">
          <h3 className="text-base font-semibold text-ink">What we still do not know</h3>
          <ul className="mt-3 list-disc space-y-2 pl-4 text-sm leading-6 text-slate-700">
            {unknowns.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-3 rounded-md border border-amberline/25 bg-white p-3">
        <h3 className="text-sm font-semibold text-ink">Australian product status</h3>
        <p className="mt-1 text-sm leading-6 text-slate-700">
          Ingredient-level evidence does not confirm the safety, quality, effectiveness, or
          AUST/ARTG status of a particular product.
          {productAustraliaStatuses.length > 0
            ? ` ${productAustraliaStatuses.length} product-level AU/TGA record${productAustraliaStatuses.length === 1 ? " is" : "s are"} attached, but exact status remains product-specific.`
            : " No product-level AU/TGA record is attached here."}
        </p>
        <p className="mt-2 text-xs leading-5 text-slate-600">
          Local context attached: {australiaStatuses.length} intervention-level AU/TGA record
          {australiaStatuses.length === 1 ? "" : "s"}, {productSignals.length} matching product
          signal{productSignals.length === 1 ? "" : "s"}, and {productAustraliaStatuses.length}{" "}
          product-level AU/TGA record{productAustraliaStatuses.length === 1 ? "" : "s"}.
        </p>
      </section>

      <section className="mt-3 rounded-md border border-line bg-mist p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink">Evidence trail</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {references.length} linked source{references.length === 1 ? "" : "s"} · {studies.length}{" "}
              extracted study record{studies.length === 1 ? "" : "s"} · {humanReviewed}/
              {sourcePackets.length} outcome summaries human reviewed
            </p>
          </div>
          <a
            className="w-fit rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-signal hover:border-signal"
            href={`/interventions/${intervention.slug}?tab=sources`}
          >
            View all sources
          </a>
        </div>
      </section>

      <section className="mt-6 border-t border-line pt-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-ink">
              Supporting detail: evidence by health outcome
            </h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Use this section when you want to inspect a particular claim. Every scoped outcome
              remains available with its score, confidence, source coverage, and limitations, but
              these buckets are supporting detail rather than the overall conclusion.
            </p>
          </div>
          <span className="w-fit rounded-md border border-line bg-mist px-2 py-1 text-xs font-semibold text-slate-700">
            {outcomeRows.length} outcome{outcomeRows.length === 1 ? "" : "s"}
          </span>
        </div>
        {outcomeRows.length > 0 ? (
          <div className="mt-4 grid gap-4">
            {outcomeRows.map((row) => (
              <ReaderOutcomeEvidenceCard
                intervention={intervention}
                key={row.claim.id}
                row={row}
              />
            ))}
          </div>
        ) : (
          <EmptyState>No scoped outcome rows are attached to this supplement yet.</EmptyState>
        )}
      </section>
    </section>
  );
}

function CrossStudyEvidenceSummary({
  intervention,
  outcomeRows,
  productAustraliaStatuses,
  productSignals,
  safetyAlerts,
  sourcePackets
}: {
  intervention: Intervention;
  outcomeRows: ReaderOutcomeRow[];
  productAustraliaStatuses: AustraliaRegulatoryStatus[];
  productSignals: ProductSignal[];
  safetyAlerts: SafetyAlert[];
  sourcePackets: ClaimPacketPair[];
}) {
  const references = uniqueReferences(sourcePackets.flatMap(({ packet }) => packet.references));
  const studies = uniqueStudies(sourcePackets.flatMap(({ packet }) => packet.studies));
  const studyTypes = summarizeStudyTypes(studies);
  const humanReviewed = outcomeRows.filter(({ claim }) =>
    isHumanReviewed(claim.reviewStatus)
  ).length;
  const lowConfidence = outcomeRows.filter(
    ({ claim }) => claim.confidenceLevel === "Low" || claim.confidenceLevel === "Very low"
  ).length;
  const incomplete = outcomeRows.filter(
    ({ packet, scoreState }) =>
      packet.completeness.status !== "complete" || scoreState.score === null
  ).length;
  const matureSignals = outcomeRows.filter(
    ({ claim, packet }) =>
      claim.outcome !== "Safety/adverse effects" &&
      isPracticalBenefitClaim(claim) &&
      isPracticalSummaryMatureClaim(claim) &&
      isHumanReviewed(claim.reviewStatus) &&
      packet.completeness.status === "complete"
  );
  const cautionSignals = outcomeRows.filter(
    ({ claim }) =>
      isAdverseDirectionClaim(claim) ||
      [
        "Avoid / Not Recommended",
        "Regulatory Concern",
        "Requires Clinician Oversight",
        "Safety Concern"
      ].includes(claim.finalLabel)
  ).length;
  const safetyRows = outcomeRows.filter(({ claim }) => claim.outcome === "Safety/adverse effects");
  const safetyStudies = uniqueStudies(safetyRows.flatMap(({ packet }) => packet.studies));
  const matureOutcomes = matureSignals
    .slice(0, 3)
    .map(({ claim }) => shortOutcome(claim.outcome));
  const overallPattern =
    matureSignals.length > 0
      ? `Taken together, the local record has its clearest supportive evidence in ${naturalJoin(
          matureOutcomes
        )}. That pattern is limited to the populations, forms, durations, comparators, and endpoints actually studied; the remaining evidence does not establish a broad all-purpose benefit for ${intervention.name}.`
      : outcomeRows.length === 0
        ? `The local catalog does not yet contain enough scoped, extracted evidence to form an overall conclusion for ${intervention.name}.`
        : `Taken together, the linked research does not yet add up to a dependable overall health-benefit conclusion for ${intervention.name}. The studies examine different populations, forms, durations, and outcomes, while confidence, review maturity, or source completeness remains limited. This is a map of research leads, not one universal effect.`;

  return (
    <section
      className="mt-5 rounded-lg border border-spruce/25 bg-teal-50 p-4"
      id="whole-evidence-summary"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-spruce">
        Cross-study summary
      </p>
      <h3 className="mt-1 text-lg font-semibold text-ink">The evidence as a whole</h3>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-700">
        This view summarizes the full local study set across all linked outcomes. The outcome cards
        remain below as the source-traceable supporting detail.
      </p>

      <section className="mt-4 rounded-md border border-spruce/20 bg-white p-4">
        <h4 className="text-sm font-semibold text-ink">Overall pattern</h4>
        <p className="mt-2 text-base leading-7 text-slate-800">{overallPattern}</p>
      </section>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <section className="rounded-md border border-line bg-white p-3">
          <h4 className="text-sm font-semibold text-ink">What researchers studied</h4>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            The local evidence map links {references.length} article
            {references.length === 1 ? "" : "s"} and contains {studies.length} extracted study
            record{studies.length === 1 ? "" : "s"}.
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-600">
            Study mix: {studyTypes || "study designs have not been classified yet"}.
          </p>
        </section>

        <section className="rounded-md border border-line bg-white p-3">
          <h4 className="text-sm font-semibold text-ink">How dependable is the overall picture?</h4>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            {lowConfidence} of {outcomeRows.length} scoped conclusions are low or very-low
            confidence, {incomplete} still have incomplete source or score work, and {humanReviewed}
            {" "}have recorded human review.
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-600">
            A large number of studies does not by itself make the conclusion reliable; relevance,
            consistency, study quality, and review status still matter.
          </p>
        </section>

        <section className="rounded-md border border-line bg-white p-3">
          <h4 className="text-sm font-semibold text-ink">Safety and product context</h4>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            The local record includes {safetyRows.length} scoped safety claim
            {safetyRows.length === 1 ? "" : "s"}, {safetyStudies.length} study record
            {safetyStudies.length === 1 ? "" : "s"} linked to those claims, and{" "}
            {safetyAlerts.length} local alert{safetyAlerts.length === 1 ? "" : "s"}.
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-600">
            {cautionSignals} caution or adverse signal{cautionSignals === 1 ? " is" : "s are"}{" "}
            tracked. {productSignals.length} product signal{productSignals.length === 1 ? "" : "s"}{" "}
            and {productAustraliaStatuses.length} product-level AU/TGA record
            {productAustraliaStatuses.length === 1 ? " is" : "s are"} attached.
            {safetyAlerts.length === 0
              ? " No local alert was found; this does not establish safety."
              : " Local alerts should be read as scoped safety signals, not complete product risk profiles."}{" "}
            This does not
            establish product-level safety, effectiveness, quality, or AUST/ARTG status.
          </p>
        </section>
      </div>

      <section className="mt-3 rounded-md border border-spruce/20 bg-white p-3">
        <h4 className="text-sm font-semibold text-ink">What this means for an average reader</h4>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          Read the overall pattern first. Use the individual outcomes only to understand where a
          signal came from and what its limits are—not as a menu of proven benefits or a
          recommendation to use a particular supplement product.
        </p>
      </section>
    </section>
  );
}

function ReaderOutcomeEvidenceCard({
  intervention,
  row
}: {
  intervention: Intervention;
  row: ReaderOutcomeRow;
}) {
  const { claim, packet, scoreState } = row;
  const verdict = readerOutcomeVerdict(row);
  const references = uniqueReferences(packet.references);
  const studies = uniqueStudies(packet.studies);
  const studyTypes = summarizeStudyTypes(studies);
  const storedSummary = cleanStudyText(claim.summary ?? "");
  const representativeFinding = topStudyFindingSummaries(studies, 1)[0] ?? "";
  const direction = claimEvidenceDirectionLabel(claim);

  return (
    <article className="rounded-lg border border-line bg-mist p-4" id={`overview-claim-${claim.id}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Health outcome
          </p>
          <h4 className="mt-1 text-base font-semibold text-ink">{shortOutcome(claim.outcome)}</h4>
          {direction ? (
            <p className="mt-1 text-xs font-semibold text-slate-600">
              Evidence direction: {direction}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
          <span className={cn("rounded-md border px-2 py-1", verdict.tone)}>
            {verdict.label}
          </span>
          <span className={cn("rounded-md border px-2 py-1", scoreState.tone)}>
            {scoreState.score === null
              ? scoreState.compositeLabel
              : `Score ${scoreState.score.toFixed(1)} · ${scoreState.tableBand}`}
          </span>
          <span className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-700">
            {claim.confidenceLevel} confidence
          </span>
          <span className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-700">
            {reviewStatusLabel(claim.reviewStatus)}
          </span>
          <span
            className={cn(
              "rounded-md border px-2 py-1",
              sourcePacketCompletenessTone(packet.completeness.status)
            )}
          >
            {packet.completeness.label}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <section className="rounded-md border border-line bg-white p-3">
          <h5 className="text-sm font-semibold text-ink">What the evidence currently says</h5>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            {readerOutcomeFinding(intervention, row)}
          </p>
          {storedSummary ? (
            <div className="mt-3 rounded-md border border-amberline/20 bg-amber-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                {isHumanReviewed(claim.reviewStatus)
                  ? "Reviewed catalog summary"
                  : "Unreviewed catalog summary"}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-700">
                {firstSentence(storedSummary)}
              </p>
            </div>
          ) : null}
        </section>
        <section className="rounded-md border border-line bg-white p-3">
          <h5 className="text-sm font-semibold text-ink">Evidence base</h5>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            {references.length} linked article{references.length === 1 ? "" : "s"} and{" "}
            {studies.length} extracted study record{studies.length === 1 ? "" : "s"}
            {studyTypes ? ` (${studyTypes}).` : "."}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-600">{packet.completeness.detail}</p>
        </section>
        <section className="rounded-md border border-line bg-white p-3">
          <h5 className="text-sm font-semibold text-ink">Why confidence is limited</h5>
          <p className="mt-2 text-sm leading-6 text-slate-700">{readerOutcomeCaveat(row)}</p>
          <p className="mt-2 text-xs leading-5 text-slate-600">
            Population, dose or form, duration, comparator, product quality, and AU/TGA product
            status remain claim-specific boundaries.
          </p>
        </section>
        <section className="rounded-md border border-line bg-white p-3">
          <h5 className="text-sm font-semibold text-ink">What would make this clearer</h5>
          <p className="mt-2 text-sm leading-6 text-slate-700">{claim.whatWouldChangeScore}</p>
        </section>
      </div>

      {storedSummary || representativeFinding ? (
        <details className="group/outcome mt-3 rounded-md border border-line bg-white [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-ink outline-none hover:bg-mist focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-signal/20">
            <span>Stored claim wording and representative study text</span>
            <ChevronDown
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-slate-600 transition group-open/outcome:rotate-180"
            />
          </summary>
          <div className="grid gap-3 border-t border-line p-3 text-sm leading-6 text-slate-700">
            <Detail label="Claim being assessed" value={claim.claimText} />
            {storedSummary ? (
              <Detail
                label="Stored claim summary (draft wording)"
                value={storedSummary}
              />
            ) : null}
            {representativeFinding ? (
              <Detail
                label="Representative source extract — outcome match may still need review"
                value={representativeFinding}
              />
            ) : null}
            {claim.uncertainty ? (
              <Detail label="Stored uncertainty note" value={claim.uncertainty} />
            ) : null}
          </div>
        </details>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
        <a
          className="text-signal hover:underline"
          href={`/interventions/${intervention.slug}?tab=claims#claim-${claim.id}`}
        >
          Read the full claim record
        </a>
        <a
          className="text-signal hover:underline"
          href={`/interventions/${intervention.slug}?tab=sources`}
        >
          Open its source trail
        </a>
      </div>
    </article>
  );
}

function ReaderSourceWorkOverview({
  intervention,
  scoredRows,
  sourceGapRows,
  sourcePackets
}: {
  intervention: Intervention;
  scoredRows: Array<ClaimPacketPair & { scoreState: ClaimScorePresentation }>;
  sourceGapRows: ClaimPacketPair[];
  sourcePackets: ClaimPacketPair[];
}) {
  const completePackets = sourcePackets.filter(
    ({ packet }) => packet.completeness.status === "complete"
  ).length;
  const extractedReferences = sourceGapRows.reduce(
    (total, { packet }) => total + packet.completeness.extractedReferences,
    0
  );
  const totalReferences = sourceGapRows.reduce(
    (total, { packet }) => total + packet.completeness.totalReferences,
    0
  );

  return (
    <section className="rounded-lg border border-amberline/30 bg-amber-50 p-4 text-amber-950 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            Evidence still being checked
          </p>
          <h3 className="mt-1 text-base font-semibold">Where the evidence record is incomplete</h3>
          <p className="mt-2 max-w-4xl text-sm leading-6">
            These outcomes have missing extraction or source-review work. Their stored scores and
            summaries should not be treated as settled conclusions until the gaps below are fixed.
          </p>
        </div>
        <span className="rounded-md border border-amberline/30 bg-white px-2 py-1 text-xs font-semibold">
          {sourceGapRows.length} incomplete outcome{sourceGapRows.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <SourceWorkDrilldownStat
          label="Outcomes with a displayed score"
          value={`${scoredRows.length}/${sourcePackets.length}`}
        />
        <SourceWorkDrilldownStat
          label="Complete evidence packets"
          value={`${completePackets}/${sourcePackets.length}`}
        />
        <SourceWorkDrilldownStat
          label="Outcomes still blocked"
          value={sourceGapRows.length.toLocaleString()}
        />
        <SourceWorkDrilldownStat
          label="Linked references extracted"
          value={`${extractedReferences.toLocaleString()}/${totalReferences.toLocaleString()}`}
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {sourceGapRows.map(({ claim, packet }) => (
          <article className="rounded-md border border-amberline/20 bg-white p-3" key={claim.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <a
                className="text-sm font-semibold text-ink underline"
                href={`/interventions/${intervention.slug}?tab=claims#claim-${claim.id}`}
              >
                {shortOutcome(claim.outcome)}
              </a>
              <span
                className={cn(
                  "rounded-md border px-2 py-1 text-xs font-semibold",
                  sourcePacketCompletenessTone(packet.completeness.status)
                )}
              >
                {sourceGapBlockerLabel(packet)}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5">
              <span className="font-semibold text-ink">What is missing:</span>{" "}
              {sourceGapSummary(claim, packet)}
            </p>
            <p className="mt-2 text-xs leading-5">
              <span className="font-semibold text-ink">Why it matters:</span>{" "}
              {sourceGapBlockedReason(packet)}
            </p>
            <p className="mt-2 text-xs leading-5">
              <span className="font-semibold text-ink">What needs to happen next:</span>{" "}
              {packet.completeness.nextStep}
            </p>
            <p className="mt-2 text-xs font-semibold text-slate-600">
              Audit status: {packet.completeness.label} · {packet.completeness.extractedReferences}/
              {packet.completeness.totalReferences} linked references extracted
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function DetailedEvidenceSummary({
  australiaStatuses,
  compact = false,
  intervention,
  productAustraliaStatuses,
  productSignals,
  readinessByClaimId,
  safetyAlerts,
  sourcePackets
}: {
  australiaStatuses: AustraliaRegulatoryStatus[];
  compact?: boolean;
  intervention: Intervention;
  productAustraliaStatuses: AustraliaRegulatoryStatus[];
  productSignals: ProductSignal[];
  readinessByClaimId: Map<string, ScoreReadinessRow>;
  safetyAlerts: SafetyAlert[];
  sourcePackets: ClaimPacketPair[];
}) {
  const scoredRows = sourcePackets
    .map((row) => ({
      ...row,
      scoreState: claimScorePresentation(row.claim, readinessByClaimId.get(row.claim.id))
    }))
    .filter((row) => row.scoreState.score !== null)
    .sort((left, right) => (right.scoreState.score ?? 0) - (left.scoreState.score ?? 0));
  const incompleteRows = sourcePackets.filter((row) => {
    const readinessRow = readinessByClaimId.get(row.claim.id);
    const scoreState = claimScorePresentation(row.claim, readinessRow);

    return scoreState.score === null || row.packet.completeness.status !== "complete";
  });
  const sourceGapRows = sourcePackets
    .filter((row) => row.packet.completeness.status !== "complete")
    .sort(sourceGapRowSort);
  const displayedSourceGapRows = sourceGapRows;
  const references = uniqueReferences(sourcePackets.flatMap((row) => row.packet.references));
  const studies = uniqueStudies(sourcePackets.flatMap((row) => row.packet.studies));
  const studyTypeSummary = summarizeStudyTypes(studies);
  const studyFindingRows = buildStudyFindingRows(sourcePackets);
  const popularClaimRows = buildPopularClaimRows(intervention, sourcePackets, readinessByClaimId);
  const practicalReadout = buildSupplementPracticalReadout({
    australiaStatuses,
    incompleteRows,
    intervention,
    productAustraliaStatuses,
    productSignals,
    safetyAlerts,
    scoredRows,
    sourcePackets,
    studies
  });
  const overallSummary = buildOverallEvidenceNarrative({
    australiaStatuses,
    incompleteRows,
    intervention,
    productAustraliaStatuses,
    productSignals,
    references,
    safetyAlerts,
    scoredRows,
    sourcePackets,
    studies
  });
  const readerOutcomeRows = buildReaderOutcomeRows(sourcePackets, readinessByClaimId);

  return (
    <div className="grid gap-4">
      {compact ? (
        <ReaderEvidenceOverview
          australiaStatuses={australiaStatuses}
          intervention={intervention}
          outcomeRows={readerOutcomeRows}
          practicalReadout={practicalReadout}
          productAustraliaStatuses={productAustraliaStatuses}
          productSignals={productSignals}
          safetyAlerts={safetyAlerts}
          sourcePackets={sourcePackets}
        />
      ) : null}

      {compact ? (
        <>
          <SupplementPracticalReadoutPanel readout={practicalReadout} />
          {sourceGapRows.length > 0 ? (
            <ReaderSourceWorkOverview
              intervention={intervention}
              scoredRows={scoredRows}
              sourceGapRows={sourceGapRows}
              sourcePackets={sourcePackets}
            />
          ) : null}
        </>
      ) : null}

      <details
        className="group/technical rounded-lg border border-line bg-white shadow-panel [&_summary::-webkit-details-marker]:hidden"
        open={!compact}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 outline-none transition hover:bg-mist focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-signal/20">
          <div>
            <h3 className="text-sm font-semibold text-ink">
              Study details, original synthesis, and audit notes
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Study extracts, source counts, uncertainty notes, and audit scores for readers who
              want the technical detail.
            </p>
          </div>
          <ChevronDown
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-slate-600 transition group-open/technical:rotate-180"
          />
        </summary>
        <div className="grid gap-4 border-t border-line p-4">
      <section className="rounded-md border border-line bg-mist p-3">
        <h3 className="text-sm font-semibold text-ink">How to read this brief</h3>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          This page is an AI-assisted translation of the local evidence trail: linked articles,
          extracted study rows, trial leads, safety notes, and AU/TGA context. It tries to explain
          what the evidence appears to say in ordinary language while keeping uncertainty, study
          limits, and citation links visible.
        </p>
      </section>

      <section className="rounded-md border border-signal/20 bg-blue-50 p-3">
        <h3 className="text-sm font-semibold text-ink">
          Overall plain-language evidence summary
        </h3>
        <div className="mt-2 grid gap-2 text-sm leading-6 text-slate-700">
          {overallSummary.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>

      {compact ? null : <EvidenceBriefAtAGlance
        productAustraliaStatuses={productAustraliaStatuses}
        productSignals={productSignals}
        safetyAlerts={safetyAlerts}
        scoredRows={scoredRows}
        sourceGapRows={sourceGapRows}
      />}

      {compact ? null : <SupplementPracticalReadoutPanel readout={practicalReadout} />}

      {!compact && sourceGapRows.length > 0 ? (
        <section className="rounded-md border border-amberline/30 bg-amber-50 p-3 text-amber-950">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                Evidence gaps to treat as sourcing work
              </p>
              <h3 className="mt-1 text-sm font-semibold">Source Work drilldown</h3>
            </div>
            <span className="rounded-md border border-amberline/30 bg-white px-2 py-1 text-xs font-semibold">
              {sourceGapRows.length} source {sourceGapRows.length === 1 ? "gap" : "gaps"}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6">
            These rows may appear in the dashboard as source work. They are not evidence-backed
            conclusions yet; they need linked articles and structured extraction before they should
            influence practical rankings.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <SourceWorkDrilldownStat
              label="Displayed scores"
              value={`${scoredRows.length}/${sourcePackets.length}`}
            />
            <SourceWorkDrilldownStat
              label="Complete packets"
              value={`${
                sourcePackets.filter((row) => row.packet.completeness.status === "complete").length
              }/${sourcePackets.length}`}
            />
            <SourceWorkDrilldownStat
              label="Blocked claims"
              value={sourceGapRows.length.toLocaleString()}
            />
            <SourceWorkDrilldownStat
              label="Linked refs extracted"
              value={`${sourceGapRows
                .reduce((total, row) => total + row.packet.completeness.extractedReferences, 0)
                .toLocaleString()}/${sourceGapRows
                .reduce((total, row) => total + row.packet.completeness.totalReferences, 0)
                .toLocaleString()}`}
            />
          </div>
          <div className="mt-3 grid gap-2">
            {displayedSourceGapRows.map(({ claim, packet }) => (
              <article className="rounded-md border border-amberline/20 bg-white p-3" key={claim.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a
                    className="text-sm font-semibold text-ink underline"
                    href={`/interventions/${intervention.slug}?tab=claims#claim-${claim.id}`}
                  >
                    {shortOutcome(claim.outcome)}
                  </a>
                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs font-semibold",
                        sourcePacketCompletenessTone(packet.completeness.status)
                      )}
                    >
                      {sourceGapBlockerLabel(packet)}
                    </span>
                    <span className="rounded-md border border-line bg-mist px-2 py-1 text-xs font-semibold text-slate-600">
                      {packet.completeness.extractedReferences}/{packet.completeness.totalReferences} refs
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-700">
                  {sourceGapSummary(claim, packet)}
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-700">
                  <span className="font-semibold text-ink">Why it is Source Work:</span>{" "}
                  {sourceGapBlockedReason(packet)}
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-700">
                  <span className="font-semibold text-ink">Next source step:</span>{" "}
                  {packet.completeness.nextStep}
                </p>
              </article>
            ))}
          </div>
          {compact && sourceGapRows.length > displayedSourceGapRows.length ? (
            <p className="mt-3 rounded-md border border-amberline/20 bg-white px-3 py-2 text-xs leading-5 text-amber-950">
              Showing {displayedSourceGapRows.length.toLocaleString()} of{" "}
              {sourceGapRows.length.toLocaleString()} source-work rows on the overview. Open the
              claim or source tabs for the complete trace.
            </p>
          ) : null}
        </section>
      ) : null}

      <>
          <section className="rounded-md border border-line bg-mist p-3">
            <h3 className="text-sm font-semibold text-ink">Common claims: what the evidence says</h3>
            {popularClaimRows.length > 0 ? (
              <div className="mt-3 grid gap-2">
                {popularClaimRows.map(({ claim, packet, popularClaim, scoreState, verdict }) => (
                  <PopularClaimVerdictRow
                    claim={claim}
                    key={claim.id}
                    packet={packet}
                    popularClaim={popularClaim}
                    scoreState={scoreState}
                    verdict={verdict}
                  />
                ))}
              </div>
            ) : (
              <EmptyState>No local claim rows are attached to this supplement yet.</EmptyState>
            )}
          </section>

          <section className="rounded-md border border-signal/20 bg-blue-50 p-3">
            <h3 className="text-sm font-semibold text-ink">Study findings and conclusions</h3>
            {studyFindingRows.length > 0 ? (
              <div className="mt-3 grid gap-3">
                {studyFindingRows.map(({ claim, packet, studies: claimStudies }) => (
                  <StudyFindingGroup
                    claim={claim}
                    key={claim.id}
                    packet={packet}
                    studies={claimStudies}
                  />
                ))}
              </div>
            ) : (
              <EmptyState>
                No extracted study findings are attached to this supplement yet. Article-level
                conclusions need to be captured before a detailed evidence synthesis can be shown.
              </EmptyState>
            )}
          </section>

          <div className="grid gap-3 lg:grid-cols-2">
            <section className="rounded-md border border-line bg-mist p-3">
              <h3 className="text-sm font-semibold text-ink">What the evidence supports</h3>
              {scoredRows.length > 0 ? (
                <div className="mt-3 grid gap-2">
                  {scoredRows.map(({ claim, packet, scoreState }) => (
                    <ClaimEvidenceSummaryRow
                      claim={claim}
                      key={claim.id}
                      packet={packet}
                      scoreState={scoreState}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState>
                  No claim has a final displayed evidence score yet. Use the claim cards and source
                  packets below to see what is still being reviewed.
                </EmptyState>
              )}
            </section>

            <section className="rounded-md border border-line bg-mist p-3">
              <h3 className="text-sm font-semibold text-ink">Where the evidence is limited</h3>
              {incompleteRows.length > 0 ? (
                <div className="mt-3 grid gap-2">
                  {incompleteRows.map(({ claim, packet }) => {
                    const readinessRow = readinessByClaimId.get(claim.id);
                    const scoreState = claimScorePresentation(claim, readinessRow);
                    const limitationSummary =
                      scoreState.noticeBody ??
                      (readinessRow
                        ? scoreReadinessNextAction(readinessRow)
                        : packet.completeness.nextStep);

                    return (
                      <article className="rounded-md border border-line bg-white p-3" key={claim.id}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-ink">
                            {shortOutcome(claim.outcome)}
                          </p>
                          <span
                            className={cn(
                              "rounded-md border px-2 py-1 text-xs font-semibold",
                              sourcePacketCompletenessTone(packet.completeness.status)
                            )}
                          >
                            {packet.completeness.label}
                          </span>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-slate-700">{claim.claimText}</p>
                        <p className="mt-2 text-xs leading-5 text-slate-600">
                          {limitationSummary}
                        </p>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <EmptyState>
                  All scoped claims currently have complete source packets and displayed scores.
                </EmptyState>
              )}
            </section>
          </div>

          <section className="rounded-md border border-line bg-mist p-3">
            <h3 className="text-sm font-semibold text-ink">Source base and article links</h3>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              This page currently links {references.length.toLocaleString()} curated article
              {references.length === 1 ? "" : "s"} and {studies.length.toLocaleString()} extracted
              study record{studies.length === 1 ? "" : "s"}
              {studyTypeSummary ? ` (${studyTypeSummary}).` : "."} These links are the source trail
              for the summaries above.
            </p>
            {references.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {references.map((reference) => (
                  <SourceLink key={reference.id} reference={reference} />
                ))}
              </div>
            ) : (
              <EmptyState>No curated article links are attached to this supplement yet.</EmptyState>
            )}
          </section>
        </>

      <section className="rounded-md border border-amberline/30 bg-amber-50 p-3 text-amber-950">
        <h3 className="text-sm font-semibold">Safety, regulatory, and product context</h3>
        <p className="mt-2 text-sm leading-6">
          {buildSafetyRegulatorySummary({
            australiaStatuses,
            intervention,
            productAustraliaStatuses,
            productSignals,
            safetyAlerts,
            sourcePackets
          })}
        </p>
      </section>
        </div>
      </details>
    </div>
  );
}

function buildSupplementPracticalReadout({
  australiaStatuses,
  incompleteRows,
  intervention,
  productAustraliaStatuses,
  productSignals,
  safetyAlerts,
  scoredRows,
  sourcePackets,
  studies
}: {
  australiaStatuses: AustraliaRegulatoryStatus[];
  incompleteRows: ClaimPacketPair[];
  intervention: Intervention;
  productAustraliaStatuses: AustraliaRegulatoryStatus[];
  productSignals: ProductSignal[];
  safetyAlerts: SafetyAlert[];
  scoredRows: Array<ClaimPacketPair & { scoreState: ClaimScorePresentation }>;
  sourcePackets: ClaimPacketPair[];
  studies: Study[];
}): SupplementPracticalReadout {
  const sourceLeadRows = scoredRows.filter(
    ({ claim }) => isPracticalBenefitClaim(claim) && !isPracticalSummaryMatureClaim(claim)
  );
  const benefitRows = scoredRows.filter(
    ({ claim }) => isPracticalBenefitClaim(claim) && isPracticalSummaryMatureClaim(claim)
  );
  const topBenefitRows = benefitRows.slice(0, 4);
  const topScoredRow = scoredRows[0];
  const completePackets = sourcePackets.filter(
    (row) => row.packet.completeness.status === "complete"
  ).length;
  const references = uniqueReferences(sourcePackets.flatMap((row) => row.packet.references));
  const uniqueStudyRows = uniqueStudies(studies);
  const studyTypeSummary = summarizeStudyTypes(uniqueStudyRows);
  const directLifespanRows = sourcePackets.filter(
    (row) => row.claim.outcome === "Mortality/lifespan"
  );
  const healthspanRows = sourcePackets.filter((row) => isHealthspanOutcome(row.claim.outcome));
  const biomarkerRows = sourcePackets.filter((row) => isBiomarkerOutcome(row.claim.outcome));
  const sourceWorkCount = incompleteRows.length;

  return {
    confidenceAndMaturity: [
      `${scoredRows.length.toLocaleString()}/${sourcePackets.length.toLocaleString()} scoped claim${sourcePackets.length === 1 ? "" : "s"} currently show a displayed evidence score.`,
      `${completePackets.toLocaleString()}/${sourcePackets.length.toLocaleString()} source packet${sourcePackets.length === 1 ? "" : "s"} are complete; ${references.length.toLocaleString()} curated article link${references.length === 1 ? "" : "s"} and ${uniqueStudyRows.length.toLocaleString()} extracted study record${uniqueStudyRows.length === 1 ? "" : "s"} feed this page.`,
      studyTypeSummary
        ? `Evidence maturity currently includes ${studyTypeSummary}.`
        : "No extracted study-type mix is available yet.",
      sourceWorkCount > 0
        ? `${sourceWorkCount.toLocaleString()} claim${sourceWorkCount === 1 ? "" : "s"} still need source extraction, scoring review, or source-packet cleanup before stronger conclusions.`
        : "All scoped claims currently have complete source packets or displayed score status in the local catalog.",
      sourceLeadRows.length > 0
        ? `${sourceLeadRows.length.toLocaleString()} scored-looking benefit claim${sourceLeadRows.length === 1 ? "" : "s"} are held as source leads because confidence is low or very low.`
        : "No scored-looking benefit claim is being held back solely for low confidence."
    ],
    doesNotProve: buildSupplementDoesNotProveRows(sourcePackets),
    longevityHealthspanRead: [
      directLifespanRows.length > 0
        ? buildDirectLifespanRead(directLifespanRows)
        : "No direct lifespan claim is currently scoped for this supplement.",
      healthspanRows.length > 0
        ? `${healthspanRows.length.toLocaleString()} scoped claim${healthspanRows.length === 1 ? "" : "s"} map to healthspan-adjacent outcomes such as function, sleep, mood, cognition, cardiovascular, immune, or musculoskeletal endpoints.`
        : "No scoped healthspan-adjacent outcome currently stands out for this supplement.",
      biomarkerRows.length > 0
        ? `${biomarkerRows.length.toLocaleString()} claim${biomarkerRows.length === 1 ? "" : "s"} are best interpreted as biomarker or measured-risk signals, not broad longevity promises.`
        : "No biomarker-led claim is currently attached."
    ],
    mainCautions: buildSupplementCautionRows({
      australiaStatuses,
      intervention,
      productAustraliaStatuses,
      productSignals,
      safetyAlerts,
      sourcePackets
    }),
    mayHelpWith:
      topBenefitRows.length > 0
        ? topBenefitRows.map(({ claim, scoreState }) =>
            `${shortOutcome(claim.outcome)}: ${practicalClaimSummary(claim)} (${scoreState.score?.toFixed(1)} ${scoreState.tableBand}, ${claim.confidenceLevel.toLowerCase()} confidence).`
          )
        : sourceLeadRows.length > 0
          ? [
              `${sourceLeadRows.length.toLocaleString()} possible benefit signal${sourceLeadRows.length === 1 ? "" : "s"} are present, but current confidence is low or very low, so this page treats them as source leads rather than practical benefit claims.`
            ]
        : [
            "No scored benefit claim is strong enough to present as a practical benefit yet; read the current page as source review and uncertainty tracking."
          ],
    whoMightCare: buildWhoMightCareRows({
      benefitRows: topBenefitRows,
      intervention,
      sourcePackets
    }),
    whyItStandsOut: buildWhyItStandsOutRows({
      intervention,
      sourceWorkCount,
      topScoredRow
    })
  };
}

function isPracticalSummaryMatureClaim(claim: Claim) {
  return claim.confidenceLevel === "High" || claim.confidenceLevel === "Moderate";
}

function SupplementPracticalReadoutPanel({
  readout
}: {
  readout: SupplementPracticalReadout;
}) {
  return (
    <section className="rounded-md border border-spruce/20 bg-teal-50 p-3">
      <h3 className="text-sm font-semibold text-ink">Practical readout</h3>
      <p className="mt-2 text-sm leading-6 text-slate-700">
        A plain-language interpretation of who may find this supplement relevant, what the
        current evidence may support, and where conclusions remain limited. This is not
        personal medical advice.
      </p>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <PracticalReadoutCard label="Who might care" items={readout.whoMightCare} />
        <PracticalReadoutCard label="What it may help with" items={readout.mayHelpWith} />
        <PracticalReadoutCard label="What it does not prove" items={readout.doesNotProve} />
        <PracticalReadoutCard label="Main cautions" items={readout.mainCautions} />
        <PracticalReadoutCard
          label="Confidence / evidence maturity"
          items={readout.confidenceAndMaturity}
        />
        <PracticalReadoutCard
          label="Why it stands out or does not stand out"
          items={readout.whyItStandsOut}
        />
        <PracticalReadoutCard
          label="Longevity / healthspan read"
          items={readout.longevityHealthspanRead}
        />
      </div>
    </section>
  );
}

function EvidenceBriefAtAGlance({
  productAustraliaStatuses,
  productSignals,
  safetyAlerts,
  scoredRows,
  sourceGapRows
}: {
  productAustraliaStatuses: AustraliaRegulatoryStatus[];
  productSignals: ProductSignal[];
  safetyAlerts: SafetyAlert[];
  scoredRows: Array<ClaimPacketPair & { scoreState: ClaimScorePresentation }>;
  sourceGapRows: ClaimPacketPair[];
}) {
  const topScoredRow = scoredRows[0];
  const sourceBlockerSummary = summarizeSourceGapMix(sourceGapRows);
  const productUnknownCount = productAustraliaStatuses.filter(
    (status) => status.kind === "Unknown"
  ).length;
  const productStatusText =
    productSignals.length === 0
      ? "No matching product profile is attached; do not infer product-level AU/TGA status from ingredient evidence."
      : productAustraliaStatuses.length === 0
        ? `${productSignals.length} matching product profile(s) are present, but no product-level AU/TGA row is attached.`
        : `${productAustraliaStatuses.length} product AU/TGA row(s) are attached; ${productUnknownCount} remain exact-status unknown.`;

  return (
    <section className="rounded-md border border-line bg-white p-3">
      <h3 className="text-sm font-semibold text-ink">Evidence brief at a glance</h3>
      <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-4">
        <BriefGlanceCard
          label="Best current read"
          value={
            topScoredRow && topScoredRow.scoreState.score !== null
              ? isAdverseDirectionClaim(topScoredRow.claim)
                ? `${shortOutcome(topScoredRow.claim.outcome)} is the strongest displayed local signal (${topScoredRow.scoreState.score.toFixed(1)} ${topScoredRow.scoreState.tableBand}), but it is a caution/adverse signal, not a benefit read.`
                : `${shortOutcome(topScoredRow.claim.outcome)} is the strongest displayed local signal (${topScoredRow.scoreState.score.toFixed(1)} ${topScoredRow.scoreState.tableBand}).`
              : "No scoped claim has a displayed final evidence score yet."
          }
        />
        <BriefGlanceCard
          label="Still unfinished"
          value={
            sourceGapRows.length > 0
              ? `${sourceGapRows.length} claim(s) remain Source Work: ${sourceBlockerSummary}.`
              : "No Source Work rows are visible for this intervention."
          }
        />
        <BriefGlanceCard
          label="Safety context"
          value={
            safetyAlerts.length > 0
              ? `${safetyAlerts.length} local safety alert(s) are attached; read these before benefit rows.`
              : "No local safety alerts are attached; this does not imply safety."
          }
        />
        <BriefGlanceCard label="Product AU/TGA" value={productStatusText} />
      </div>
    </section>
  );
}

function BriefGlanceCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-mist p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{value}</p>
    </div>
  );
}

function PracticalReadoutCard({ items, label }: { items: string[]; label: string }) {
  return (
    <section className="rounded-md border border-line bg-white p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</h4>
      <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm leading-6 text-slate-700">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function buildWhoMightCareRows({
  benefitRows,
  intervention,
  sourcePackets
}: {
  benefitRows: Array<ClaimPacketPair & { scoreState: ClaimScorePresentation }>;
  intervention: Intervention;
  sourcePackets: ClaimPacketPair[];
}) {
  const outcomes = benefitRows.map((row) => shortOutcome(row.claim.outcome));
  const rows = [
    outcomes.length > 0
      ? `People comparing ${naturalJoin(outcomes)} claims for ${intervention.name}, when their population, product form, duration, and comparator match the source packet.`
      : `People trying to decide whether ${intervention.name} deserves further evidence review rather than immediate action.`,
    "People who want citation-linked evidence and uncertainty labels before discussing a supplement with a clinician or making a product-level decision."
  ];

  if (sourcePackets.some((row) => row.claim.outcome === "Safety/adverse effects")) {
    rows.push(
      "People with safety, interaction, medication, pregnancy, kidney/liver, or sport-testing context should read the safety rows before any benefit rows."
    );
  }

  return rows;
}

function buildWhyItStandsOutRows({
  intervention,
  sourceWorkCount,
  topScoredRow
}: {
  intervention: Intervention;
  sourceWorkCount: number;
  topScoredRow?: ClaimPacketPair & { scoreState: ClaimScorePresentation };
}) {
  if (!topScoredRow || topScoredRow.scoreState.score === null) {
    return [
      `${intervention.name} does not yet stand out as a practical priority because no scoped claim has a displayed evidence score.`,
      "The useful next step is source-packet completion, extraction, and scoring review rather than stronger public conclusions."
    ];
  }

  const score = topScoredRow.scoreState.score;
  const rows = [
    isAdverseDirectionClaim(topScoredRow.claim)
      ? `${intervention.name}'s strongest displayed local score is for ${shortOutcome(topScoredRow.claim.outcome)} (${score.toFixed(1)} ${topScoredRow.scoreState.tableBand}), but that row is a caution/adverse signal, so it should not be read as a standout benefit.`
      : score >= 8
        ? `${intervention.name} stands out most for ${shortOutcome(topScoredRow.claim.outcome)} because it has the strongest displayed local score (${score.toFixed(1)} ${topScoredRow.scoreState.tableBand}).`
        : `${intervention.name} does not stand out as a broad top-tier supplement; its strongest current signal is ${shortOutcome(topScoredRow.claim.outcome)} (${score.toFixed(1)} ${topScoredRow.scoreState.tableBand}).`
  ];

  if (sourceWorkCount > 0) {
    rows.push(
      `${sourceWorkCount.toLocaleString()} claim${sourceWorkCount === 1 ? "" : "s"} still need source or score work, so some apparent promise should be treated as an evidence radar item.`
    );
  }

  rows.push(
    "Scores are prioritization aids, not recommendations, and they do not establish product-level AU/TGA status."
  );

  return rows;
}

function buildSupplementDoesNotProveRows(sourcePackets: ClaimPacketPair[]) {
  const curated = sourcePackets
    .flatMap((row) => row.claim.doesNotProve ?? [])
    .map(punctuateSentence)
    .filter(Boolean);
  const fallbackRows = [
    "Does not prove direct lifespan extension.",
    "Does not prove the same effect for every population, dose, product form, or duration.",
    "Does not prove product-level safety, efficacy, quality, or AU/TGA clearance."
  ];

  return uniqueTextRows([...curated, ...fallbackRows]).slice(0, 5);
}

function buildSupplementCautionRows({
  australiaStatuses,
  intervention,
  productAustraliaStatuses,
  productSignals,
  safetyAlerts,
  sourcePackets
}: {
  australiaStatuses: AustraliaRegulatoryStatus[];
  intervention: Intervention;
  productAustraliaStatuses: AustraliaRegulatoryStatus[];
  productSignals: ProductSignal[];
  safetyAlerts: SafetyAlert[];
  sourcePackets: ClaimPacketPair[];
}) {
  const unknownProductStatusCount = productAustraliaStatuses.filter(
    (status) => status.kind === "Unknown"
  ).length;
  const rows = [
    punctuateSentence(intervention.safetySummary),
    punctuateSentence(intervention.interactionSummary),
    `${australiaStatuses.length.toLocaleString()} AU/TGA intervention row${australiaStatuses.length === 1 ? "" : "s"}, ${productSignals.length.toLocaleString()} product signal${productSignals.length === 1 ? "" : "s"}, and ${productAustraliaStatuses.length.toLocaleString()} product-level AU/TGA row${productAustraliaStatuses.length === 1 ? "" : "s"} are attached; ingredient evidence does not verify a specific product or AUST number.`,
    unknownProductStatusCount > 0
      ? `${unknownProductStatusCount.toLocaleString()} product-level row${unknownProductStatusCount === 1 ? " remains" : "s remain"} exact-status unknown because the local profile lacks an exact product label, sponsor, and AUST/ARTG identifier.`
      : ""
  ];

  safetyAlerts.slice(0, 2).forEach((alert) => {
    rows.push(`${alert.source} ${alert.alertType}: ${punctuateSentence(alert.summary)}`);
  });

  sourcePackets
    .filter(
      (row) =>
        row.claim.outcome !== "Safety/adverse effects" && isAdverseDirectionClaim(row.claim)
    )
    .slice(0, 3)
    .forEach(({ claim }) => {
      const summary = firstSentence(cleanStudyText(claim.summary ?? ""));

      rows.push(
        summary
          ? `${shortOutcome(claim.outcome)} carries a caution/adverse signal, not a benefit read: ${punctuateSentence(summary)}`
          : `${shortOutcome(claim.outcome)} carries a caution/adverse signal in the local record; read it as a caution row, not a benefit claim.`
      );
    });

  if (isPeptideOrTherapeutic(intervention, sourcePackets.map((row) => row.claim))) {
    rows.push(
      "Peptide or therapeutic-intervention rows require clinician/regulatory review and must not be used for sourcing, compounding, reconstitution, injection, cycling, or self-administration guidance."
    );
  }

  return uniqueTextRows(rows.filter(Boolean));
}

function buildDirectLifespanRead(directLifespanRows: ClaimPacketPair[]) {
  const supportedRows = directLifespanRows.filter(
    (row) =>
      row.claim.finalLabel === "Core Evidence-Based" &&
      row.claim.confidenceLevel === "High"
  );

  if (supportedRows.length === 0) {
    return `${directLifespanRows.length.toLocaleString()} direct lifespan claim${directLifespanRows.length === 1 ? "" : "s"} are tracked, but the current local evidence does not present them as strong direct lifespan proof.`;
  }

  return `${supportedRows.length.toLocaleString()} direct lifespan claim${supportedRows.length === 1 ? "" : "s"} have high-confidence core-evidence local support, but healthspan, biomarker, product, and population boundaries still apply.`;
}

function practicalClaimSummary(claim: Claim) {
  return punctuateSentence(claim.summary ?? claim.claimText);
}

function isPracticalBenefitClaim(claim: Claim) {
  return (
    claim.outcome !== "Safety/adverse effects" &&
    claim.finalLabel !== "Insufficient Evidence" &&
    claim.finalLabel !== "Safety Concern" &&
    claim.finalLabel !== "Avoid / Not Recommended" &&
    claim.finalLabel !== "Requires Clinician Oversight" &&
    claim.finalLabel !== "Regulatory Concern" &&
    !isAdverseDirectionClaim(claim)
  );
}

function isHealthspanOutcome(outcome: Claim["outcome"]) {
  return [
    "Blood pressure",
    "Cardiovascular events",
    "Cognition",
    "Eye health",
    "Glucose/insulin/HbA1c",
    "Immune/respiratory",
    "Inflammation",
    "Joint/tendon/skin",
    "Mood/stress",
    "Muscle/strength",
    "Sleep",
    "VO2 max/endurance"
  ].includes(outcome);
}

function isBiomarkerOutcome(outcome: Claim["outcome"]) {
  return [
    "Biological aging clocks",
    "Blood pressure",
    "Glucose/insulin/HbA1c",
    "Inflammation",
    "LDL/ApoB/lipids"
  ].includes(outcome);
}

function uniqueTextRows(values: string[]) {
  const seen = new Set<string>();
  const rows: string[] = [];

  values.forEach((value) => {
    const normalized = value.trim();
    const key = normalized.toLowerCase();

    if (normalized && !seen.has(key)) {
      seen.add(key);
      rows.push(normalized);
    }
  });

  return rows;
}

type PopularClaimRow = ClaimPacketPair & {
  popularClaim: string;
  priority: number;
  scoreState: ClaimScorePresentation;
  verdict: PopularClaimVerdict;
};

type PopularClaimVerdict = {
  explanation: string;
  label: string;
  tone: string;
};

const POPULAR_CLAIM_OVERRIDES: Record<string, Partial<Record<Claim["outcome"], string>>> = {
  ashwagandha: {
    Cognition: "Supports mental clarity, memory, focus, and cognitive function.",
    "Fertility/hormones":
      "Supports hormone balance, testosterone, sperm quality, and reproductive health.",
    "Mood/stress":
      "Helps the body manage physical and psychological stress by reducing cortisol levels.",
    "Muscle/strength":
      "Improves athletic performance, strength, muscle mass, and VO2 max.",
    "Safety/adverse effects":
      "Is a natural Ayurvedic adaptogen and is generally safe for most people.",
    Sleep: "Improves sleep quality and helps with insomnia."
  }
};

const POPULAR_CLAIM_ORDER_OVERRIDES: Record<string, Partial<Record<Claim["outcome"], number>>> = {
  ashwagandha: {
    "Mood/stress": 100,
    Sleep: 90,
    "Muscle/strength": 80,
    Cognition: 70,
    "Fertility/hormones": 60,
    "Safety/adverse effects": 50
  }
};

function buildPopularClaimRows(
  intervention: Intervention,
  sourcePackets: ClaimPacketPair[],
  readinessByClaimId: Map<string, ScoreReadinessRow>
): PopularClaimRow[] {
  return sourcePackets
    .map((row) => {
      const scoreState = claimScorePresentation(
        row.claim,
        readinessByClaimId.get(row.claim.id)
      );

      return {
        ...row,
        popularClaim: popularClaimText(intervention, row.claim),
        priority: popularClaimPriority(intervention, row.claim, row.packet, scoreState),
        scoreState,
        verdict: popularClaimVerdict(row.claim, row.packet, scoreState)
      };
    })
    .sort(
      (left, right) =>
        right.priority - left.priority ||
        shortOutcome(left.claim.outcome).localeCompare(shortOutcome(right.claim.outcome))
    );
}

function popularClaimPriority(
  intervention: Intervention,
  claim: Claim,
  packet: ClaimSourcePacket,
  scoreState: ClaimScorePresentation
) {
  const override = POPULAR_CLAIM_ORDER_OVERRIDES[intervention.id]?.[claim.outcome];

  if (override !== undefined) {
    return override;
  }

  const scoreValue = scoreState.score ?? -1;
  const sourceValue = Math.min(packet.references.length + packet.studies.length, 8) / 10;

  return scoreValue + sourceValue;
}

function PopularClaimVerdictRow({
  claim,
  packet,
  popularClaim,
  scoreState,
  verdict
}: Omit<PopularClaimRow, "priority">) {
  const references = uniqueReferences(packet.references);
  const studies = uniqueStudies(packet.studies);
  const uncertainty = popularClaimUncertaintyText({ claim, packet, scoreState });

  return (
    <article className="rounded-md border border-line bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Common claim
          </p>
          <p className="mt-1 text-sm font-semibold leading-6 text-ink">{popularClaim}</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Evidence category: {shortOutcome(claim.outcome)}
          </p>
        </div>
        <span className={cn("rounded-md border px-2 py-1 text-xs font-semibold", verdict.tone)}>
          {verdict.label}
        </span>
      </div>
      <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-700">
        <p>
          <span className="font-semibold text-ink">Evidence read:</span> {verdict.explanation}
        </p>
        <p>
          <span className="font-semibold text-ink">Source basis:</span>{" "}
          {sourcePacketBasisSentence({ references, studies })}
        </p>
        <p>
          <span className="font-semibold text-ink">Uncertainty:</span> {uncertainty}
        </p>
      </div>
    </article>
  );
}

function popularClaimText(intervention: Intervention, claim: Claim) {
  const override = POPULAR_CLAIM_OVERRIDES[intervention.id]?.[claim.outcome];

  if (override) {
    return override;
  }

  const name = intervention.name;

  switch (claim.outcome) {
    case "Mortality/lifespan":
      return `${name} extends lifespan or slows aging.`;
    case "Cardiovascular events":
      return `${name} protects the heart or reduces cardiovascular risk.`;
    case "LDL/ApoB/lipids":
      return `${name} improves cholesterol, ApoB, or blood lipid markers.`;
    case "Blood pressure":
      return `${name} lowers blood pressure.`;
    case "Glucose/insulin/HbA1c":
      return `${name} improves blood sugar, insulin resistance, or HbA1c.`;
    case "Inflammation":
      return `${name} lowers inflammation.`;
    case "Cognition":
      return `${name} improves memory, focus, or cognitive performance.`;
    case "Sleep":
      return `${name} improves sleep quality.`;
    case "Mood/stress":
      return `${name} reduces stress, anxiety, or cortisol.`;
    case "Muscle/strength":
      return `${name} improves strength, muscle mass, or exercise performance.`;
    case "VO2 max/endurance":
      return `${name} improves endurance, stamina, or VO2 max.`;
    case "Joint/tendon/skin":
      return `${name} improves joint, tendon, or skin health.`;
    case "Eye health":
      return `${name} supports eye health.`;
    case "Immune/respiratory":
      return `${name} supports immunity or respiratory resilience.`;
    case "Fertility/hormones":
      return `${name} supports testosterone, fertility, or hormone balance.`;
    case "Biological aging clocks":
      return `${name} improves biological age or aging-clock markers.`;
    case "Safety/adverse effects":
      return `${name} is natural and generally safe for most people.`;
  }
}

function popularClaimVerdict(
  claim: Claim,
  packet: ClaimSourcePacket,
  scoreState: ClaimScorePresentation
): PopularClaimVerdict {
  if (
    claim.finalLabel === "Regulatory Concern" ||
    claim.finalLabel === "Requires Clinician Oversight" ||
    claim.finalLabel === "Avoid / Not Recommended" ||
    claim.finalLabel === "Safety Concern"
  ) {
    return {
      explanation:
        "The local record does not back this as an ordinary consumer supplement claim. It should be read primarily through safety, regulatory, or clinician-oversight boundaries.",
      label: "Caution / not backed broadly",
      tone: "border-danger/30 bg-red-50 text-danger"
    };
  }

  if (scoreState.score === null || packet.completeness.status !== "complete") {
    return {
      explanation:
        "The local record has not finished source extraction or scoring for this claim, so it should be treated as unproven in the dashboard for now.",
      label: "Not settled yet",
      tone: "border-amberline/30 bg-amber-50 text-amberline"
    };
  }

  if (
    claim.finalLabel === "Insufficient Evidence" ||
    scoreState.score < 5
  ) {
    return {
      explanation:
        "The evidence does not currently back this claim as a settled conclusion. It is best treated as inconclusive, indirect, or hypothesis-generating.",
      label: "Not backed yet",
      tone: "border-slate-300 bg-slate-50 text-slate-700"
    };
  }

  if (claim.confidenceLevel === "Low" || claim.confidenceLevel === "Very low") {
    return {
      explanation:
        "There is some local evidence pointing toward this claim, but the dashboard does not treat it as settled because confidence is still low and source review is incomplete or uncertain.",
      label: "Early support, not settled",
      tone: "border-amberline/30 bg-amber-50 text-amberline"
    };
  }

  if (claim.confidenceLevel === "Moderate" || scoreState.score < 8) {
    return {
      explanation:
        "The local evidence is supportive for the scoped use case, but the conclusion depends on the studied population, dose/form, duration, endpoint, and product context.",
      label: "Partly backed",
      tone: "border-signal/25 bg-blue-50 text-signal"
    };
  }

  return {
    explanation:
      "The local evidence backs this scoped claim better than the other rows for this supplement, while still staying short of medical advice or product-level proof.",
    label: "Backed for scoped use",
    tone: "border-spruce/30 bg-teal-50 text-spruce"
  };
}

function popularClaimUncertaintyText({
  claim,
  packet,
  scoreState
}: ClaimPacketPair & {
  scoreState: ClaimScorePresentation;
}) {
  const curatedUncertainty = cleanStudyText(claim.uncertainty ?? "")
    .replace(/^Uncertainty remains because\s*/i, "")
    .replace(/^Uncertainty:\s*/i, "");

  if (curatedUncertainty) {
    return punctuateSentence(firstSentence(curatedUncertainty));
  }

  if (scoreState.noticeBody) {
    return firstSentence(scoreState.noticeBody);
  }

  if (packet.completeness.status !== "complete") {
    return `${packet.completeness.detail} ${packet.completeness.nextStep}`;
  }

  return claimCertaintySentence({ claim, packet, scoreState });
}

type StudyFindingRow = ClaimPacketPair & {
  studies: Study[];
};

function buildStudyFindingRows(sourcePackets: ClaimPacketPair[]): StudyFindingRow[] {
  return sourcePackets
    .map((row) => ({
      ...row,
      studies: uniqueStudies(row.packet.studies).filter(hasStudyFindingText)
    }))
    .filter((row) => row.studies.length > 0);
}

function StudyFindingGroup({
  claim,
  packet,
  studies
}: {
  claim: Claim;
  packet: ClaimSourcePacket;
  studies: Study[];
}) {
  return (
    <article className="rounded-md border border-line bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-ink">{shortOutcome(claim.outcome)}</h4>
          <p className="mt-1 text-xs leading-5 text-slate-600">{claim.claimText}</p>
        </div>
        <span
          className={cn(
            "rounded-md border px-2 py-1 text-xs font-semibold",
            sourcePacketCompletenessTone(packet.completeness.status)
          )}
        >
          {studies.length} finding{studies.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="mt-3 grid gap-3">
        {studies.map((study) => (
          <StudyFindingCard
            key={study.id}
            reference={packet.references.find((reference) => reference.id === study.referenceId)}
            study={study}
          />
        ))}
      </div>
    </article>
  );
}

function StudyFindingCard({
  reference,
  study
}: {
  reference?: Reference;
  study: Study;
}) {
  const findingText = studyFindingText(study);

  return (
    <article className="rounded-md border border-line bg-mist p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h5 className="text-sm font-semibold leading-6 text-ink">{study.title}</h5>
          <p className="mt-1 text-xs text-slate-600">
            {study.studyType}
            {study.year ? ` - ${study.year}` : ""}
          </p>
        </div>
        {reference ? <SourceLink reference={reference} /> : null}
      </div>
      <div className="mt-3 grid gap-2 text-sm">
        <Detail label="What it found or concluded" value={findingText} />
        <Detail label="Study context" value={studyContextSummary(study)} />
        <Detail label="Safety and tolerability" value={study.adverseEvents} />
        <Detail label="Limitations and bias checks" value={study.riskOfBias} />
        <Detail label="Funding and conflicts" value={study.fundingConflicts} />
      </div>
    </article>
  );
}

function hasStudyFindingText(study: Study) {
  return Boolean(studyFindingText(study).trim());
}

function studyFindingText(study: Study) {
  const mainResults = cleanStudyText(study.mainResults ?? "");
  const abstractConclusion = cleanStudyText(extractAbstractConclusion(study.abstract));
  const abstractText = cleanStudyText(study.abstract ?? "");
  const outcomeFallback = cleanStudyText(
    study.outcomes.length > 0
      ? `The local extraction lists outcomes: ${study.outcomes.join(
          ", "
        )}. It does not yet include the article's own conclusion text.`
      : ""
  );

  if (mainResults && !isLowValueFindingText(mainResults)) {
    return mainResults;
  }

  return abstractConclusion || mainResults || abstractText || outcomeFallback;
}

function studyContextSummary(study: Study) {
  const parts = [
    study.sampleSize,
    study.population,
    study.dose ? `Studied dose/form: ${study.dose}` : undefined,
    study.duration ? `Studied duration: ${study.duration}` : undefined
  ].filter((part): part is string => Boolean(part));

  return parts.join(" ");
}

function cleanStudyText(value: string) {
  return value
    .replace(/^Local abstract\/source metadata reports:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAbstractConclusion(value?: string) {
  const abstractText = cleanStudyText(value ?? "");

  if (!abstractText) {
    return "";
  }

  const labelledSection = abstractText.match(
    /(?:CONCLUSIONS?|INTERPRETATION|FINDINGS|RESULTS):\s*(.+?)(?=\s[A-Z][A-Z /-]{2,}:|$)/i
  );

  return labelledSection?.[1]?.trim() ?? "";
}

function ClaimEvidenceSummaryRow({
  claim,
  packet,
  scoreState
}: {
  claim: Claim;
  packet: ClaimSourcePacket;
  scoreState: ClaimScorePresentation;
}) {
  return (
    <article className="rounded-md border border-line bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{shortOutcome(claim.outcome)}</p>
        <span className={cn("rounded-md border px-2 py-1 text-xs font-semibold", labelTone(claim.finalLabel))}>
          {scoreState.score?.toFixed(1)} {scoreState.tableBand}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-700">{claim.claimText}</p>
      <p className="mt-2 text-xs leading-5 text-slate-600">
        Evidence confidence is {claim.confidenceLevel.toLowerCase()} with {packet.completeness.detail}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-600">
        What would change the score: {claim.whatWouldChangeScore}
      </p>
    </article>
  );
}

function buildOverallEvidenceNarrative({
  australiaStatuses,
  incompleteRows,
  intervention,
  productAustraliaStatuses,
  productSignals,
  references,
  safetyAlerts,
  scoredRows,
  sourcePackets,
  studies
}: {
  australiaStatuses: AustraliaRegulatoryStatus[];
  incompleteRows: ClaimPacketPair[];
  intervention: Intervention;
  productAustraliaStatuses: AustraliaRegulatoryStatus[];
  productSignals: ProductSignal[];
  references: Reference[];
  safetyAlerts: SafetyAlert[];
  scoredRows: Array<ClaimPacketPair & { scoreState: ClaimScorePresentation }>;
  sourcePackets: ClaimPacketPair[];
  studies: Study[];
}): string[] {
  const strongestRows = scoredRows.slice(0, 3);
  const strongestMatureRows = scoredRows
    .filter(({ claim }) => isPracticalSummaryMatureClaim(claim))
    .slice(0, 3);
  const strongestSourceLeadRows = scoredRows
    .filter(({ claim }) => !isPracticalSummaryMatureClaim(claim))
    .slice(0, 3);
  const lowCertaintyClaims = sourcePackets.filter((row) =>
    row.claim.confidenceLevel === "Low" || row.claim.confidenceLevel === "Very low"
  );
  const unreviewedClaims = sourcePackets.filter(
    (row) => row.claim.reviewStatus !== "Human reviewed"
  );
  const sourceWorkCount = incompleteRows.length;

  if (studies.length === 0 || references.length === 0) {
    return [
      `${intervention.name} does not yet have enough linked, extracted source material in the local catalog to support a useful overall conclusion. The page should be treated as a research placeholder until article-level findings are captured and reviewed.`,
      `The safest current interpretation is uncertainty: absence of linked local evidence here does not prove lack of effect, safety, or regulatory clearance.`
    ];
  }

  const supportParagraph =
    strongestMatureRows.length > 0
      ? [
          `${intervention.name}'s most mature displayed local scores are for ${formatClaimOutcomeList(
            strongestMatureRows
          )}. These are scoped decision-support signals, not broad advice or product-level proof.`,
          strongestSourceLeadRows.length > 0
            ? `Other high-looking rows such as ${formatClaimOutcomeList(
                strongestSourceLeadRows
              )} are kept as source leads because confidence is still low or very low.`
            : "No high-looking row is being held back solely for low confidence."
        ].join(" ")
      : strongestRows.length > 0
        ? `${intervention.name} has displayed local scores for ${formatClaimOutcomeList(
            strongestRows
          )}, but the leading scored rows are still low or very low confidence. Treat them as source leads and scoring priorities rather than settled benefit claims.`
        : `${intervention.name} has linked studies in the local catalog, but none of the scoped outcomes currently have a displayed final score. The data is therefore not strong enough here to make a confident overall efficacy conclusion.`;

  const findingParagraph = buildFindingSynthesisParagraph({
    intervention,
    scoredRows,
    sourcePackets,
    studies
  });
  const outcomeParagraphs = buildOutcomeSynthesisParagraphs({
    scoredRows,
    sourcePackets
  });
  const uncertaintyParagraph = buildUncertaintySynthesisParagraph({
    incompleteRows,
    lowCertaintyClaims,
    sourcePackets,
    sourceWorkCount,
    unreviewedClaims
  });
  const safetyParagraph = buildSafetySynthesisParagraph({
    australiaStatuses,
    intervention,
    productAustraliaStatuses,
    productSignals,
    safetyAlerts,
    sourcePackets,
    studies
  });

  return [supportParagraph, findingParagraph, ...outcomeParagraphs, uncertaintyParagraph, safetyParagraph];
}

function buildFindingSynthesisParagraph({
  intervention,
  scoredRows,
  sourcePackets,
  studies
}: {
  intervention: Intervention;
  scoredRows: Array<ClaimPacketPair & { scoreState: ClaimScorePresentation }>;
  sourcePackets: ClaimPacketPair[];
  studies: Study[];
}) {
  const studyTypeSummary = summarizeStudyTypes(studies);
  const curatedSummaries = topCuratedClaimSummaries({
    scoredRows,
    sourcePackets
  });
  const topFindings = topStudyFindingSummaries(studies, 3);

  if (curatedSummaries.length > 0) {
    return `Across the curated claim summaries, the most useful reading is: ${punctuateSentence(
      naturalJoin(curatedSummaries)
    )} These findings should be read as a synthesis of the local extracted records, not as a fresh clinical guideline.`;
  }

  if (topFindings.length === 0) {
    return `The extracted study set for ${intervention.name} includes ${studyTypeSummary}, but the local records do not yet contain enough finding text to summarize what the articles concluded.`;
  }

  return `Across the extracted source set (${studyTypeSummary}), the recurring signal is: ${punctuateSentence(
    naturalJoin(topFindings)
  )} These findings should be read as a synthesis of the local extracted records, not as a fresh clinical guideline.`;
}

function topCuratedClaimSummaries({
  scoredRows,
  sourcePackets
}: {
  scoredRows: Array<ClaimPacketPair & { scoreState: ClaimScorePresentation }>;
  sourcePackets: ClaimPacketPair[];
}) {
  const scoredClaimIds = new Set(scoredRows.map((row) => row.claim.id));
  const rows = [
    ...scoredRows,
    ...sourcePackets.filter((row) => !scoredClaimIds.has(row.claim.id))
  ];

  return rows
    .map(({ claim }) => {
      const summary = cleanStudyText(claim.summary ?? "");

      if (!summary) {
        return "";
      }

      return `${shortOutcome(claim.outcome).toLowerCase()} - ${firstSentence(summary)}`;
    })
    .filter(Boolean)
    .slice(0, 3);
}

function buildOutcomeSynthesisParagraphs({
  scoredRows,
  sourcePackets
}: {
  scoredRows: Array<ClaimPacketPair & { scoreState: ClaimScorePresentation }>;
  sourcePackets: ClaimPacketPair[];
}) {
  const scoredByClaimId = new Map(scoredRows.map((row) => [row.claim.id, row.scoreState]));
  const rowsForSummary = sourcePackets
    .filter((row) => {
      const scoreState = scoredByClaimId.get(row.claim.id);

      return (
        (scoreState !== undefined && scoreState.score !== null) ||
        row.packet.studies.length > 0 ||
        row.packet.references.length > 0
      );
    })
    .sort((left, right) => {
      const leftScore = scoredByClaimId.get(left.claim.id)?.score ?? -1;
      const rightScore = scoredByClaimId.get(right.claim.id)?.score ?? -1;

      return rightScore - leftScore;
    });
  const visibleRows = rowsForSummary.slice(0, 8);
  const omittedCount = rowsForSummary.length - visibleRows.length;
  const paragraphs = visibleRows.map((row) =>
    buildOutcomeSynthesisParagraph({
      ...row,
      scoreState: scoredByClaimId.get(row.claim.id)
    })
  );

  if (omittedCount > 0) {
    paragraphs.push(
      `${omittedCount.toLocaleString()} additional scoped outcome${
        omittedCount === 1 ? " is" : "s are"
      } summarized in the claim cards below. Those rows are kept out of this top summary so the overall conclusion stays readable.`
    );
  }

  return paragraphs;
}

function buildOutcomeSynthesisParagraph({
  claim,
  packet,
  scoreState
}: ClaimPacketPair & {
  scoreState?: ClaimScorePresentation;
}) {
  const curatedSummary = cleanStudyText(claim.summary ?? "");
  const curatedUncertainty = cleanStudyText(claim.uncertainty ?? "");
  const studies = uniqueStudies(packet.studies).filter(hasStudyFindingText);
  const references = uniqueReferences(packet.references);
  const scoreText =
    scoreState && scoreState.score !== null
      ? `It scores ${scoreState.score.toFixed(1)} (${scoreState.tableBand}) with ${claim.confidenceLevel.toLowerCase()} confidence.`
      : `It does not have a final displayed score yet.`;
  const studyText = curatedSummary
    ? sourcePacketBasisSentence({ references, studies })
    : sourcePacketFindingSentence({ references, studies });
  const limitationText = curatedUncertainty
    ? `Uncertainty: ${curatedUncertainty}`
    : claimCertaintySentence({ claim, packet, scoreState });
  const summaryText = curatedSummary || claim.claimText;
  const directionLabel = claimEvidenceDirectionLabel(claim);
  const outcomeHeading = directionLabel
    ? `${shortOutcome(claim.outcome)} (${directionLabel.toLowerCase()})`
    : shortOutcome(claim.outcome);

  return `${outcomeHeading}: ${summaryText} ${scoreText} ${studyText} ${limitationText}`;
}

function sourcePacketBasisSentence({
  references,
  studies
}: {
  references: Reference[];
  studies: Study[];
}) {
  if (references.length === 0 && studies.length === 0) {
    return "No article-level local source is linked for this outcome yet.";
  }

  return `This is based on ${references.length.toLocaleString()} linked article${
    references.length === 1 ? "" : "s"
  } and ${studies.length.toLocaleString()} extracted study row${studies.length === 1 ? "" : "s"}.`;
}

function sourcePacketFindingSentence({
  references,
  studies
}: {
  references: Reference[];
  studies: Study[];
}) {
  const representativeFindings = naturalJoin(topStudyFindingSummaries(studies, 2));

  if (representativeFindings) {
    return `Representative extracted findings include ${punctuateSentence(representativeFindings)}`;
  }

  if (studies.length > 0) {
    return `The local record has ${studies.length.toLocaleString()} extracted study row${
      studies.length === 1 ? "" : "s"
    }, but the captured text is not specific enough to summarize a finding or conclusion for this outcome yet.`;
  }

  if (references.length > 0) {
    return `The source packet links ${references.length.toLocaleString()} article${
      references.length === 1 ? "" : "s"
    }, but article-level conclusions have not been extracted into the local record yet.`;
  }

  return "No article-level local source is linked for this outcome yet.";
}

function claimCertaintySentence({
  claim,
  packet,
  scoreState
}: ClaimPacketPair & {
  scoreState?: ClaimScorePresentation;
}) {
  const isIncomplete = packet.completeness.status !== "complete" || !scoreState || scoreState.score === null;
  const confidence = claim.confidenceLevel.toLowerCase();

  if (isIncomplete) {
    return `The honest read is unfinished or inconclusive for this outcome because ${packet.completeness.detail.toLowerCase()}; the next thing that would change the score is: ${claim.whatWouldChangeScore}`;
  }

  if (
    claim.finalLabel === "Insufficient Evidence" ||
    claim.confidenceLevel === "Low" ||
    claim.confidenceLevel === "Very low"
  ) {
    return `The honest read is inconclusive or hypothesis-generating, not settled, because confidence is ${confidence} and the current label is ${claim.finalLabel}.`;
  }

  if (claim.confidenceLevel === "Moderate") {
    return `The honest read is supportive but not definitive: the conclusion should stay limited to the studied population, dose, duration, and endpoints.`;
  }

  return `The honest read is comparatively strong for this local catalog, but it still does not turn the supplement into broad medical advice or product-level proof.`;
}

function buildUncertaintySynthesisParagraph({
  incompleteRows,
  lowCertaintyClaims,
  sourcePackets,
  sourceWorkCount,
  unreviewedClaims
}: {
  incompleteRows: ClaimPacketPair[];
  lowCertaintyClaims: ClaimPacketPair[];
  sourcePackets: ClaimPacketPair[];
  sourceWorkCount: number;
  unreviewedClaims: ClaimPacketPair[];
}) {
  const caveats = new Set<string>();

  if (sourceWorkCount > 0) {
    caveats.add(
      `${sourceWorkCount.toLocaleString()} scoped outcome${
        sourceWorkCount === 1 ? " still needs" : "s still need"
      } source extraction or score work`
    );
  }

  if (lowCertaintyClaims.length > 0) {
    caveats.add(
      `${lowCertaintyClaims.length.toLocaleString()} outcome${
        lowCertaintyClaims.length === 1 ? " is" : "s are"
      } labelled low or very-low confidence`
    );
  }

  if (unreviewedClaims.length > 0) {
    caveats.add(
      `${unreviewedClaims.length.toLocaleString()} claim card${
        unreviewedClaims.length === 1 ? " remains" : "s remain"
      } pending human review`
    );
  }

  const broadClaims = sourcePackets.filter((row) =>
    row.claim.claimText.toLowerCase().includes("accepted source leads") ||
    row.claim.claimText.toLowerCase().includes("need structured evidence review")
  );

  if (broadClaims.length > 0) {
    caveats.add("some outcome rows are still source leads rather than settled evidence conclusions");
  }

  if (caveats.size === 0 && incompleteRows.length === 0) {
    return "The main uncertainty is generalization: even when a source packet is complete, the linked studies may use specific extracts, doses, populations, endpoints, and short follow-up windows, so conclusions should stay scoped to the studied context.";
  }

  return `The overall conclusion is not fully settled because ${naturalJoin([...caveats])}. Where the data is incomplete or mixed, the page should say so rather than converting an early source lead into a confident supplement claim.`;
}

function buildSafetySynthesisParagraph({
  australiaStatuses,
  intervention,
  productAustraliaStatuses,
  productSignals,
  safetyAlerts,
  sourcePackets,
  studies
}: {
  australiaStatuses: AustraliaRegulatoryStatus[];
  intervention: Intervention;
  productAustraliaStatuses: AustraliaRegulatoryStatus[];
  productSignals: ProductSignal[];
  safetyAlerts: SafetyAlert[];
  sourcePackets: ClaimPacketPair[];
  studies: Study[];
}) {
  const safetyStudyCount = studies.filter((study) =>
    `${study.outcomes.join(" ")} ${study.adverseEvents}`.toLowerCase().includes("safety")
  ).length;
  const safetyClaimCount = sourcePackets.filter(
    (row) => row.claim.outcome === "Safety/adverse effects"
  ).length;

  return `Safety is treated separately from efficacy. The local record includes ${safetyStudyCount.toLocaleString()} study extraction${
    safetyStudyCount === 1 ? "" : "s"
  } with safety-related text and ${safetyClaimCount.toLocaleString()} scoped safety claim${
    safetyClaimCount === 1 ? "" : "s"
  }, but this still does not prove product-level safety, efficacy, or TGA clearance. AU/TGA context currently has ${australiaStatuses.length.toLocaleString()} intervention row${
    australiaStatuses.length === 1 ? "" : "s"
  }, ${productSignals.length.toLocaleString()} matching product signal${
    productSignals.length === 1 ? "" : "s"
  }, ${productAustraliaStatuses.length.toLocaleString()} product-level AU/TGA row${
    productAustraliaStatuses.length === 1 ? "" : "s"
  }, and ${safetyAlerts.length.toLocaleString()} local safety alert${
    safetyAlerts.length === 1 ? "" : "s"
  }. ${intervention.safetySummary}`;
}

function formatClaimOutcomeList(
  rows: Array<ClaimPacketPair & { scoreState: ClaimScorePresentation }>
) {
  return naturalJoin(
    rows.map(({ claim, scoreState }) => {
      const score = scoreState.score === null ? "unscored" : scoreState.score.toFixed(1);
      const directionNote = isAdverseDirectionClaim(claim) ? ", caution/adverse signal" : "";
      return `${shortOutcome(claim.outcome).toLowerCase()} (${score} ${scoreState.tableBand}, ${claim.confidenceLevel.toLowerCase()} confidence${directionNote})`;
    })
  );
}

function topStudyFindingSummaries(studies: Study[], limit: number) {
  return uniqueStudies(studies)
    .map((study) => ({
      priority: studyNarrativePriority(study),
      summary: summarizeStudyFindingForNarrative(study)
    }))
    .filter((row) => row.summary)
    .sort((left, right) => right.priority - left.priority || left.summary.localeCompare(right.summary))
    .map((row) => row.summary)
    .slice(0, limit);
}

function summarizeStudyFindingForNarrative(study: Study) {
  const finding = studyNarrativeText(study);

  if (!finding) {
    return "";
  }

  const normalized = finding
    .replace(/^RESULTS:\s*/i, "")
    .replace(/^CONCLUSIONS?:\s*/i, "")
    .replace(/^METHODS:\s*/i, "")
    .replace(/\s+/g, " ")
      .trim();
  const sentence = bestFindingSentence(normalized);
  const hasExtractedConclusion = Boolean(study.mainResults ?? study.abstract);

  if (!sentence) {
    return "";
  }

  return `${study.studyType.toLowerCase()} evidence on ${studyOutcomeSummary(
    study
  )} ${
    hasExtractedConclusion
      ? "reported that"
      : "is currently captured only as outcome metadata noting that"
  } ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`;
}

function studyNarrativePriority(study: Study) {
  const taxonomy = (study.sourceTypeTaxonomy ?? study.studyType).toLowerCase();
  const mainResults = cleanStudyText(study.mainResults ?? "");
  let priority = studyNarrativeText(study) ? 1 : 0;

  if (mainResults && !isLowValueFindingText(mainResults)) {
    priority += 10;
  }

  if (taxonomy.includes("meta-analysis")) {
    priority += 5;
  } else if (taxonomy.includes("systematic review")) {
    priority += 4;
  } else if (taxonomy.includes("rct") || taxonomy.includes("randomized")) {
    priority += 3;
  }

  return priority + Math.max(study.year - 2000, 0) / 100;
}

function studyNarrativeText(study: Study) {
  const mainResults = cleanStudyText(study.mainResults ?? "");

  if (mainResults && !isLowValueFindingText(mainResults)) {
    return mainResults;
  }

  return "";
}

function isLowValueFindingText(value: string) {
  const lowerValue = value.toLowerCase();

  return (
    !lowerValue ||
    lowerValue.startsWith("the local extraction lists outcomes") ||
    lowerValue.includes("local source metadata links") ||
    lowerValue.includes("does not include a claim-specific effect estimate") ||
    lowerValue.includes("accepted source leads") ||
    lowerValue.includes("need structured evidence review") ||
    lowerValue.startsWith("an increasing body of evidence") ||
    lowerValue.startsWith("objectives:") ||
    lowerValue.includes("aims to summarize and critically evaluate") ||
    lowerValue.startsWith("since the herbal remedy") ||
    lowerValue.includes("evaluated the efficacy and safety") ||
    lowerValue.startsWith("this randomized")
  );
}

function studyOutcomeSummary(study: Study) {
  const cleanedOutcomes = study.outcomes
    .map((outcome) => outcome.replace(/^Claim domain:\s*/i, ""))
    .filter((outcome, index, outcomes) => outcome && outcomes.indexOf(outcome) === index)
    .slice(0, 3);

  return cleanedOutcomes.length > 0 ? naturalJoin(cleanedOutcomes) : "the linked outcome";
}

function firstSentence(value: string) {
  const match = value.match(/^(.+?[.!?])(?:\s|$)/);

  return truncateAtWord(match?.[1] ?? value, 260);
}

function bestFindingSentence(value: string) {
  const sentences = splitSentences(value);
  const selected = sentences.find(
    (sentence) => !isStudySizeOnlySentence(sentence) && !isMalformedFindingSentence(sentence)
  );

  if (!selected) {
    return "";
  }

  return truncateAtWord(selected, 260);
}

function splitSentences(value: string) {
  return value
    .match(/[^.!?]+[.!?](?=\s|$)|[^.!?]+$/g)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) ?? [];
}

function isStudySizeOnlySentence(value: string) {
  const lowerValue = value.toLowerCase();

  return (
    (lowerValue.includes("included") ||
      lowerValue.includes("contributed") ||
      lowerValue.includes("involving")) &&
    (lowerValue.includes("participants") ||
      lowerValue.includes("trials") ||
      lowerValue.includes("studies") ||
      lowerValue.includes("effect sizes"))
  );
}

function isMalformedFindingSentence(value: string) {
  const trimmed = value.trim();

  return trimmed.length < 30 || /^[\d).,;:<>%=\s-]+$/.test(trimmed);
}

function truncateAtWord(value: string, maxLength: number) {
  const trimmed = value.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  const clipped = trimmed.slice(0, maxLength);
  const lastSpace = clipped.lastIndexOf(" ");
  const safeClip = lastSpace > maxLength * 0.6 ? clipped.slice(0, lastSpace) : clipped;

  return `${safeClip.replace(/[,.!?;:]$/, "")}...`;
}

function punctuateSentence(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function naturalJoin(items: string[]) {
  if (items.length === 0) {
    return "";
  }

  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function buildSafetyRegulatorySummary({
  australiaStatuses,
  intervention,
  productAustraliaStatuses,
  productSignals,
  safetyAlerts,
  sourcePackets
}: {
  australiaStatuses: AustraliaRegulatoryStatus[];
  intervention: Intervention;
  productAustraliaStatuses: AustraliaRegulatoryStatus[];
  productSignals: ProductSignal[];
  safetyAlerts: SafetyAlert[];
  sourcePackets: ClaimPacketPair[];
}) {
  const safetyClaims = sourcePackets.filter((row) => row.claim.outcome === "Safety/adverse effects");
  const safetyClaimText =
    safetyClaims.length > 0
      ? ` The scoped safety claim says: ${safetyClaims.map((row) => row.claim.claimText).join(" ")}`
      : "";

  return `${intervention.safetySummary} ${safetyAlerts.length.toLocaleString()} local safety alert${
    safetyAlerts.length === 1 ? " is" : "s are"
  } attached to this supplement. AU/TGA context includes ${australiaStatuses.length.toLocaleString()} intervention-level row${
    australiaStatuses.length === 1 ? "" : "s"
  } and ${productSignals.length.toLocaleString()} matching product signal${
    productSignals.length === 1 ? "" : "s"
  }, with ${productAustraliaStatuses.length.toLocaleString()} product-level AU/TGA row${
    productAustraliaStatuses.length === 1 ? "" : "s"
  }.${safetyClaimText} This does not prove product-level safety, efficacy, or TGA clearance.`;
}

function uniqueReferences(references: Reference[]) {
  return [...new Map(references.map((reference) => [reference.id, reference])).values()].sort(
    (left, right) => left.title.localeCompare(right.title)
  );
}

function uniqueStudies(studies: Study[]) {
  return [...new Map(studies.map((study) => [study.id, study])).values()];
}

function summarizeStudyTypes(studies: Study[]) {
  const counts = new Map<string, number>();

  for (const study of studies) {
    const key = study.sourceTypeTaxonomy ?? study.studyType;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([label, count]) => `${count} ${readableStudyTypeCount(label, count)}`)
    .join(", ");
}

function readableStudyTypeCount(label: string, count: number) {
  if (count === 1) {
    return label;
  }

  const normalized = label.toLowerCase();

  if (normalized === "meta-analysis") {
    return label.replace(/meta-analysis/i, "meta-analyses");
  }

  if (normalized === "analysis") {
    return label.replace(/analysis/i, "analyses");
  }

  if (/\brct$/i.test(label)) {
    return `${label}s`;
  }

  return label.endsWith("s") ? label : `${label}s`;
}

function sourceGapSummary(claim: Claim, packet: ClaimSourcePacket) {
  const outcome = shortOutcome(claim.outcome);

  switch (packet.completeness.status) {
    case "not_linked":
      return `No curated source packet is linked yet for ${outcome.toLowerCase()}. Treat this as a sourcing task, not an evidence-backed conclusion.`;
    case "missing_sources":
      return `${outcome} has linked reference IDs, but at least one curated source record is missing. Treat this as source repair work before using it as evidence.`;
    case "extraction_pending":
      return `${outcome} has ${packet.completeness.extractedReferences}/${packet.completeness.totalReferences} references extracted; finish structured extraction before treating the claim as source-backed.`;
    case "complete":
      return `${outcome} has a complete source packet.`;
  }
}

function sourceGapBlockerLabel(packet: ClaimSourcePacket) {
  switch (packet.completeness.status) {
    case "not_linked":
      return "No curated sources";
    case "missing_sources":
      return "Source record missing";
    case "extraction_pending":
      return "Extraction pending";
    case "complete":
      return "Source-backed";
  }
}

function sourceGapBlockedReason(packet: ClaimSourcePacket) {
  switch (packet.completeness.status) {
    case "not_linked":
      return "No article or registry reference is linked to this claim yet.";
    case "missing_sources":
      return "The claim points to a reference ID that is not present in the local source table.";
    case "extraction_pending":
      return "A reference is linked, but at least one source still needs structured fields such as population, intervention, outcomes, results, adverse events, and risk of bias.";
    case "complete":
      return "The linked references have structured extraction rows.";
  }
}

function summarizeSourceGapMix(rows: ClaimPacketPair[]) {
  const counts = rows.reduce(
    (summary, row) => {
      summary[row.packet.completeness.status] += 1;
      return summary;
    },
    {
      complete: 0,
      extraction_pending: 0,
      missing_sources: 0,
      not_linked: 0
    } satisfies Record<ClaimSourcePacket["completeness"]["status"], number>
  );
  const parts = [
    counts.extraction_pending > 0
      ? `${counts.extraction_pending} extraction pending`
      : "",
    counts.not_linked > 0 ? `${counts.not_linked} no curated sources` : "",
    counts.missing_sources > 0 ? `${counts.missing_sources} missing source records` : ""
  ].filter(Boolean);

  return parts.length > 0 ? parts.join("; ") : "none";
}

function sourceWorkMixLabel(readiness: InterventionReadinessSummary) {
  const parts = [
    readiness.extractionPendingSourcePackets > 0
      ? `${readiness.extractionPendingSourcePackets} extraction pending`
      : "",
    readiness.unlinkedSourcePackets > 0
      ? `${readiness.unlinkedSourcePackets} no curated sources`
      : "",
    readiness.missingSourcePackets > 0
      ? `${readiness.missingSourcePackets} missing source records`
      : ""
  ].filter(Boolean);

  return parts.length > 0 ? parts.join("; ") : "none";
}

function sourceGapRowSort(left: ClaimPacketPair, right: ClaimPacketPair) {
  return (
    sourceGapWeight(left.packet.completeness.status) -
      sourceGapWeight(right.packet.completeness.status) ||
    shortOutcome(left.claim.outcome).localeCompare(shortOutcome(right.claim.outcome))
  );
}

function sourceGapWeight(status: ClaimSourcePacket["completeness"]["status"]) {
  switch (status) {
    case "not_linked":
      return 0;
    case "missing_sources":
      return 1;
    case "extraction_pending":
      return 2;
    case "complete":
      return 3;
  }
}

function sourcePacketCompletenessTone(status: ClaimSourcePacket["completeness"]["status"]) {
  switch (status) {
    case "complete":
      return "border-spruce/30 bg-teal-50 text-spruce";
    case "extraction_pending":
      return "border-amberline/30 bg-amber-50 text-amberline";
    case "missing_sources":
      return "border-danger/30 bg-red-50 text-danger";
    case "not_linked":
      return "border-slate-300 bg-slate-50 text-slate-700";
  }
}

type InterventionReadinessSummary = {
  completeSourcePackets: number;
  defaultScoreReviewClaims: number;
  extractionPendingSourcePackets: number;
  extractedReferences: number;
  humanReviewedClaims: number;
  incompleteSourcePackets: number;
  missingSourcePackets: number;
  pendingHumanReview: number;
  pendingReferences: number;
  readyToScoreClaims: number;
  reviewWorkClaims: number;
  scoredClaims: Array<{ claim: Claim; score: number }>;
  scoreAuditClaims: number;
  sourceWorkClaims: number;
  totalClaims: number;
  totalReferences: number;
  unlinkedSourcePackets: number;
};

function buildInterventionReadinessSummary({
  claims,
  referencesById,
  readinessRows,
  studies
}: {
  claims: Claim[];
  referencesById: Map<string, Reference>;
  readinessRows: ScoreReadinessRow[];
  studies: Study[];
}): InterventionReadinessSummary {
  const sourcePacketSummary = summarizeClaimSourcePackets({ claims, referencesById, studies });
  const reviewSummary = summarizeReviewStatus(claims);
  const scoredClaims = readinessRows
    .filter((row) => row.state === "scored" && row.currentScore !== null)
    .map((row) => ({
      claim: row.claim,
      score: row.currentScore ?? compositeScore(row.claim.scores)
    }))
    .sort((left, right) => right.score - left.score);

  return {
    completeSourcePackets: sourcePacketSummary.completeClaims,
    defaultScoreReviewClaims: readinessRows.filter((row) => row.state === "default_score_review")
      .length,
    extractionPendingSourcePackets: sourcePacketSummary.extractionPendingClaims,
    extractedReferences: sourcePacketSummary.extractedReferences,
    humanReviewedClaims: reviewSummary.humanReviewed,
    incompleteSourcePackets:
      sourcePacketSummary.extractionPendingClaims +
      sourcePacketSummary.missingSourceClaims +
      sourcePacketSummary.unlinkedClaims,
    missingSourcePackets: sourcePacketSummary.missingSourceClaims,
    pendingHumanReview: reviewSummary.unreviewedDrafts,
    pendingReferences: sourcePacketSummary.pendingReferences + sourcePacketSummary.missingReferences,
    readyToScoreClaims: readinessRows.filter((row) => row.state === "ready_to_score").length,
    reviewWorkClaims: claims.filter(isReviewWorkClaim).length,
    scoredClaims,
    scoreAuditClaims: readinessRows.filter((row) => row.state === "snapshot_gap").length,
    sourceWorkClaims: readinessRows.filter(
      (row) => row.state === "source_blocked" && !isReviewWorkClaim(row.claim)
    ).length,
    totalClaims: claims.length,
    totalReferences: sourcePacketSummary.totalReferences,
    unlinkedSourcePackets: sourcePacketSummary.unlinkedClaims
  };
}

function InterventionReadinessPanel({
  australiaStatuses,
  productAustraliaStatuses,
  productSignals,
  readiness,
  safetyAlerts
}: {
  australiaStatuses: AustraliaRegulatoryStatus[];
  productAustraliaStatuses: AustraliaRegulatoryStatus[];
  productSignals: ProductSignal[];
  readiness: InterventionReadinessSummary;
  safetyAlerts: SafetyAlert[];
}) {
  const strongestClaims = readiness.scoredClaims.slice(0, 3);
  const hasClaims = readiness.totalClaims > 0;

  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-ink">Evidence readiness</h2>
            <span className="rounded-md border border-spruce/25 bg-teal-50 px-2 py-1 text-xs font-semibold text-spruce">
              {readiness.scoredClaims.length} scored
            </span>
            {readiness.sourceWorkClaims > 0 ? (
              <span className="rounded-md border border-amberline/25 bg-amber-50 px-2 py-1 text-xs font-semibold text-amberline">
                {readiness.sourceWorkClaims} source work
              </span>
            ) : null}
            <span className="rounded-md border border-amberline/25 bg-amber-50 px-2 py-1 text-xs font-semibold text-amberline">
              {readiness.reviewWorkClaims} review work
            </span>
            {readiness.scoreAuditClaims > 0 || readiness.defaultScoreReviewClaims > 0 ? (
              <span className="rounded-md border border-signal/25 bg-blue-50 px-2 py-1 text-xs font-semibold text-signal">
                {readiness.scoreAuditClaims + readiness.defaultScoreReviewClaims} score audit
              </span>
            ) : null}
          </div>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-700">
            Scored claims are review aids, not treatment advice. Source-work and review-work claims
            remain visible without treating stored or starter scores as final evidence.
          </p>
        </div>
        <Link
          className="w-fit rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-signal hover:border-signal"
          href="/methodology"
        >
          Methodology
        </Link>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <ReadinessStat
          label="Scored claims"
          value={hasClaims ? `${readiness.scoredClaims.length}/${readiness.totalClaims}` : "0/0"}
        />
        <ReadinessStat
          label="Source work"
          value={
            hasClaims
              ? `${readiness.sourceWorkClaims}/${readiness.totalClaims} (${sourceWorkMixLabel(readiness)})`
              : "0/0"
          }
        />
        <ReadinessStat
          label="Human reviewed"
          value={hasClaims ? `${readiness.humanReviewedClaims}/${readiness.totalClaims}` : "0/0"}
        />
        <ReadinessStat
          label="Source packets complete"
          value={hasClaims ? `${readiness.completeSourcePackets}/${readiness.totalClaims}` : "0/0"}
        />
        <ReadinessStat
          label="References extracted"
          value={`${readiness.extractedReferences}/${readiness.totalReferences}`}
        />
        <ReadinessStat
          label="Safety alerts"
          value={
            safetyAlerts.length > 0
              ? `${safetyAlerts.length} local alert${safetyAlerts.length === 1 ? "" : "s"}`
              : "None captured locally"
          }
        />
        <ReadinessStat
          label="AU/TGA context"
          value={`${australiaStatuses.length} intervention row${
            australiaStatuses.length === 1 ? "" : "s"
          }, ${productSignals.length} product signal${productSignals.length === 1 ? "" : "s"}, ${productAustraliaStatuses.length} product status row${productAustraliaStatuses.length === 1 ? "" : "s"}`}
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_0.85fr]">
        <div className="rounded-md border border-line bg-mist p-3">
          <h3 className="text-sm font-semibold text-ink">Strongest current claims</h3>
          {strongestClaims.length > 0 ? (
            <div className="mt-3 grid gap-2">
              {strongestClaims.map(({ claim, score }) => (
                <a
                  className="rounded-md border border-line bg-white p-3 text-left transition hover:border-signal"
                  href={`?tab=claims#claim-${claim.id}`}
                  key={claim.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">{shortOutcome(claim.outcome)}</p>
                    <span className={cn("rounded-md border px-2 py-1 text-xs font-semibold", labelTone(claim.finalLabel))}>
                      {score.toFixed(1)} {scoreBand(score)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">{claim.claimText}</p>
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-md border border-line bg-white px-3 py-2 text-sm leading-6 text-slate-600">
              No finalized composite scores are available for this intervention yet.
            </p>
          )}
        </div>

        <div className="rounded-md border border-amberline/30 bg-amber-50 p-3 text-amber-950">
          <h3 className="text-sm font-semibold">Main evidence checks still visible</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6">
            {readiness.pendingHumanReview > 0 ? (
              <li>{readiness.pendingHumanReview} claim(s) still need human review.</li>
            ) : (
              <li>All visible claims are human-reviewed in the local catalog.</li>
            )}
            {readiness.incompleteSourcePackets > 0 ? (
              <li>
                {readiness.incompleteSourcePackets} source packet(s) still need work:{" "}
                {sourceWorkMixLabel(readiness)}.
              </li>
            ) : (
              <li>All visible source packets have complete structured extraction.</li>
            )}
            {readiness.pendingReferences > 0 ? (
              <li>{readiness.pendingReferences} linked reference(s) still need extraction or repair.</li>
            ) : (
              <li>No linked-reference extraction gaps are visible locally.</li>
            )}
            {readiness.sourceWorkClaims > 0 ? (
              <li>
                {readiness.sourceWorkClaims} stored score(s) are shown as source work until their
                source packets are complete.
              </li>
            ) : null}
            {readiness.readyToScoreClaims > 0 ? (
              <li>{readiness.readyToScoreClaims} reviewed packet(s) are ready for scoring.</li>
            ) : null}
            {productSignals.length === 0 ? (
              <li>Product-level AU/TGA status is not established by intervention evidence alone.</li>
            ) : (
              <li>
                Product context exists; {productAustraliaStatuses.length} product-level AU/TGA row(s)
                are attached, and exact AUST/ARTG status remains product-specific.
              </li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}

function ReadinessStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-mist p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-ink">{value}</p>
    </div>
  );
}

function SourceWorkDrilldownStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-amberline/20 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">{label}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-ink">{value}</p>
    </div>
  );
}

function isHumanReviewed(status: Claim["reviewStatus"]) {
  return status === "Human reviewed";
}

function reviewStatusLabel(status: Claim["reviewStatus"]) {
  return isHumanReviewed(status) ? "Human reviewed" : "Pending human review";
}

function classificationLabel(claim: Claim, readinessRow?: ScoreReadinessRow) {
  if (isDraftLeadClaim(claim)) {
    return "Review-needed classification";
  }

  if (readinessRow?.state === "ready_to_score") {
    return "Ready-to-score classification";
  }

  if (isReviewWorkClaim(claim)) {
    return "Review-needed classification";
  }

  if (readinessRow?.state === "source_blocked") {
    return "Source-work classification";
  }

  if (readinessRow?.state === "default_score_review") {
    return "Scoring-review classification";
  }

  return isHumanReviewed(claim.reviewStatus)
    ? "Human-reviewed classification"
    : "AI Draft Classification";
}

function compositeLabel(claim: Claim) {
  if (isReviewWorkClaim(claim)) {
    return "Composite pending";
  }

  return isHumanReviewed(claim.reviewStatus) ? "Reviewed composite" : "Draft composite";
}

function isDraftLeadClaim(claim: Claim) {
  return claim.evidenceGrade === DRAFT_LEAD_EVIDENCE_GRADE;
}

function isSourcePacketScaffoldClaim(claim: Claim) {
  return claim.evidenceGrade === SOURCE_PACKET_REVIEW_EVIDENCE_GRADE;
}

function isReviewWorkClaim(claim: Claim) {
  return isDraftLeadClaim(claim) || isSourcePacketScaffoldClaim(claim);
}

type ClaimScorePresentation = {
  compositeLabel: string;
  hideComponents: boolean;
  noticeBody?: string;
  noticeTitle?: string;
  noticeTone?: string;
  primary: string;
  score: number | null;
  secondary: string;
  tableBand: string;
  tone: string;
};

function claimScorePresentation(
  claim: Claim,
  readinessRow?: ScoreReadinessRow
): ClaimScorePresentation {
  if (readinessRow?.state === "ready_to_score" && !isDraftLeadClaim(claim)) {
    return {
      compositeLabel: "Composite ready to score",
      hideComponents: true,
      noticeBody: `${scoreReadinessNextAction(
        readinessRow
      )} The stored placeholder score and component values are hidden here until a claim-specific score is assigned from the complete source packet.`,
      noticeTitle: "Complete packet awaiting score assignment",
      noticeTone: "border-spruce/30 bg-teal-50 text-spruce",
      primary: "Ready to score",
      score: null,
      secondary: "Complete packet needs score assignment",
      tableBand: "Ready to score",
      tone: "border-dashed border-spruce/35 bg-teal-50 text-spruce"
    };
  }

  if (isReviewWorkClaim(claim)) {
    return {
      compositeLabel: "Composite pending",
      hideComponents: true,
      noticeBody: `${reviewWorkReason(
        claim
      )} Starter component values are hidden here until the claim is scored from reviewed, citation-linked evidence.`,
      noticeTitle: "Score pending source review",
      noticeTone: "border-amberline/30 bg-amber-50 text-amber-950",
      primary: "Review work",
      score: null,
      secondary: "No final evidence score assigned yet",
      tableBand: "Pending source review",
      tone: "border-dashed border-amberline/35 bg-amber-50 text-amberline"
    };
  }

  if (readinessRow?.state === "source_blocked") {
    return {
      compositeLabel: "Composite source work",
      hideComponents: true,
      noticeBody: `${scoreReadinessNextAction(
        readinessRow
      )} The stored score and component values are hidden here because linked references still need extraction or source-packet repair before this should be treated as current scored evidence.`,
      noticeTitle: "Stored score needs source extraction",
      noticeTone: "border-amberline/30 bg-amber-50 text-amber-950",
      primary: "Source work",
      score: null,
      secondary: "Stored score needs source extraction",
      tableBand: "Pending extraction",
      tone: "border-dashed border-amberline/35 bg-amber-50 text-amberline"
    };
  }

  if (readinessRow?.state === "default_score_review") {
    return {
      compositeLabel: "Composite needs review",
      hideComponents: true,
      noticeBody: `${scoreReadinessNextAction(
        readinessRow
      )} The starter-looking component values are hidden here until a claim-specific score rationale is saved.`,
      noticeTitle: "Starter-looking score needs review",
      noticeTone: "border-danger/30 bg-red-50 text-danger",
      primary: "Score review",
      score: null,
      secondary: "Starter-looking score needs claim-specific review",
      tableBand: "Needs score review",
      tone: "border-dashed border-danger/30 bg-red-50 text-danger"
    };
  }

  const score = readinessRow?.currentScore ?? compositeScore(claim.scores);

  if (readinessRow?.state === "snapshot_gap") {
    return {
      compositeLabel: compositeLabel(claim),
      hideComponents: false,
      noticeBody: scoreReadinessNextAction(readinessRow),
      noticeTitle: "Score audit gap",
      noticeTone: "border-signal/25 bg-blue-50 text-signal",
      primary: score.toFixed(1),
      score,
      secondary: "Audit gap",
      tableBand: "Audit gap",
      tone: "border-dashed border-signal/35 bg-blue-50 text-signal"
    };
  }

  return {
    compositeLabel: compositeLabel(claim),
    hideComponents: false,
    primary: score.toFixed(1),
    score,
    secondary: scoreBand(score),
    tableBand: scoreBand(score),
    tone: labelTone(claim.finalLabel)
  };
}

function reviewWorkReason(claim: Claim) {
  return isDraftLeadClaim(claim)
    ? "This is a discovery lead awaiting source review."
    : "This source-packet scaffold is awaiting evidence review.";
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-line bg-mist p-3 text-sm leading-6 text-slate-600">
      {children}
    </p>
  );
}

function ClaimCard({
  claim,
  packet,
  readinessRow,
  referencesById
}: {
  claim: Claim;
  packet?: ClaimSourcePacket;
  readinessRow?: ScoreReadinessRow;
  referencesById: Map<string, Reference>;
}) {
  const scoreState = claimScorePresentation(claim, readinessRow);

  return (
    <article
      className="intervention-claim-card scroll-mt-6 rounded-lg border border-line bg-white p-3 transition"
      id={`claim-${claim.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{shortOutcome(claim.outcome)}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">{claim.claimText}</p>
        </div>
        <div className="rounded-md border border-line bg-mist px-3 py-2 text-right">
          <p className="text-xs text-slate-600">{scoreState.compositeLabel}</p>
          <p className="text-2xl font-semibold text-ink">
            {scoreState.score === null ? scoreState.primary : scoreState.score.toFixed(1)}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className={cn("rounded-md border px-2 py-1 font-semibold", labelTone(claim.finalLabel))}>
          {classificationLabel(claim, readinessRow)}: {claim.finalLabel}
        </span>
        <span className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 font-semibold text-slate-700">
          {reviewStatusLabel(claim.reviewStatus)}
        </span>
        <span className="rounded-md border border-line bg-mist px-2 py-1 text-slate-600">
          Confidence: {claim.confidenceLevel}
        </span>
        {packet ? (
          <span className="rounded-md border border-signal/25 bg-blue-50 px-2 py-1 font-semibold text-signal">
            Source packet: {packet.completeness.label}
          </span>
        ) : null}
      </div>
      <p className="claim-target-note mt-3 hidden rounded-md border border-signal/25 bg-blue-50 px-3 py-2 text-sm leading-6 text-signal">
        Selected from the ranked evidence map. Read the score, confidence, source packet, and
        caveats together.
      </p>
      <ClaimPlainLanguageReadout claim={claim} scoreState={scoreState} />
      {packet ? <ClaimSourcePacketStatus packet={packet} /> : null}
      <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
        <Detail label="Population" value={claim.populationStudied} />
        <Detail label="Dose/form" value={claim.doseFormStudied} />
        <Detail label="Comparator" value={claim.comparator} />
        <Detail label="Effect" value={claim.effectSize} />
        <Detail label="Safety" value={claim.safetyNotes} />
        <Detail label="Applicability" value={claim.applicabilityNotes} />
      </dl>
      {scoreState.noticeTitle ? <ScoreReadinessNotice scoreState={scoreState} /> : null}
      {scoreState.hideComponents ? null : <ScoreComponentBreakdown claim={claim} />}
      <NonProofList claim={claim} />
      <ReferenceLinks claim={claim} referencesById={referencesById} />
    </article>
  );
}

function ClaimPlainLanguageReadout({
  claim,
  scoreState
}: {
  claim: Claim;
  scoreState: ClaimScorePresentation;
}) {
  const summary = cleanStudyText(claim.summary ?? "");
  const uncertainty = cleanStudyText(claim.uncertainty ?? "");
  const scoreChangeText = cleanStudyText(claim.whatWouldChangeScore ?? "");
  const directionLabel = claimEvidenceDirectionLabel(claim);
  // "Has any synthesis been written yet", so AI review counts here — an
  // AI-written summary is still a summary and should be shown rather than
  // hidden behind the fallback. Labelling it as machine-written is the
  // synthesis stage's job, not this check's.
  const lowConfidenceDraft =
    claim.confidenceLevel === "Very low" || !hasBeenReviewed(claim.reviewStatus);
  const fallback =
    "No claim-specific plain-language synthesis has been reviewed yet. Treat the component score as an audit signal and read the source packet, uncertainty, and caveats before interpreting this row.";

  return (
    <section className="mt-3 rounded-md border border-signal/20 bg-blue-50 px-3 py-2 text-sm leading-6 text-slate-800">
      <p className="text-xs font-semibold uppercase text-signal">
        What this evidence appears to say
      </p>
      {directionLabel ? (
        <span className="mt-2 inline-flex rounded-md border border-amberline/25 bg-amber-50 px-2 py-1 text-xs font-semibold text-amberline">
          {directionLabel}
        </span>
      ) : null}
      <p className="mt-1">{summary || fallback}</p>
      {uncertainty ? (
        <p className="mt-2 text-slate-700">
          <span className="font-semibold text-ink">Uncertainty:</span> {uncertainty}
        </p>
      ) : null}
      {scoreChangeText ? (
        <p className="mt-2 text-slate-700">
          <span className="font-semibold text-ink">What would change this score:</span>{" "}
          {scoreChangeText}
        </p>
      ) : null}
      {lowConfidenceDraft ? (
        <p className="mt-2 text-xs leading-5 text-slate-700">
          <span className="font-semibold text-ink">Read the score cautiously:</span>{" "}
          {scoreState.score === null
            ? "this draft row is not presenting a final score yet."
            : "the number is a draft audit score, not a recommendation or proof of benefit."}
        </p>
      ) : null}
    </section>
  );
}

function ClaimSourcePacketStatus({ packet }: { packet: ClaimSourcePacket }) {
  const progress = sourcePacketProgressText(packet);
  const needsSourceWork = packet.completeness.status !== "complete";

  return (
    <section className="mt-3 rounded-md border border-line bg-mist px-3 py-2 text-xs leading-5 text-slate-700">
      <p>
        <span className="font-semibold text-slate-900">Source extraction:</span> {progress}
      </p>
      {needsSourceWork ? (
        <>
          <p className="mt-1">
            <span className="font-semibold text-slate-900">Source-work blocker:</span>{" "}
            {sourceGapBlockerLabel(packet)} - {sourceGapBlockedReason(packet)}
          </p>
          <p className="mt-1">
            <span className="font-semibold text-slate-900">Next source step:</span>{" "}
            {packet.completeness.nextStep}
          </p>
        </>
      ) : null}
    </section>
  );
}

function sourcePacketProgressText(packet: ClaimSourcePacket) {
  const { extractedReferences, missingReferences, pendingReferences, totalReferences } =
    packet.completeness;
  const parts = [`${extractedReferences}/${totalReferences} references extracted`];

  if (pendingReferences > 0) {
    parts.push(`${pendingReferences} pending extraction`);
  }

  if (missingReferences > 0) {
    parts.push(`${missingReferences} missing source record${missingReferences === 1 ? "" : "s"}`);
  }

  if (totalReferences === 0) {
    parts.push("no curated references linked");
  }

  return parts.join("; ");
}

function ScoreReadinessNotice({ scoreState }: { scoreState: ClaimScorePresentation }) {
  return (
    <section
      className={cn(
        "mt-3 rounded-md border px-3 py-2 text-xs leading-5",
        scoreState.noticeTone
      )}
    >
      <p className="font-semibold">{scoreState.noticeTitle}</p>
      <p className="mt-1">{scoreState.noticeBody}</p>
    </section>
  );
}

function ScoreComponentBreakdown({ claim }: { claim: Claim }) {
  const rows = getClaimScoreRows(claim);

  return (
    <section
      aria-label={`${shortOutcome(claim.outcome)} component score breakdown`}
      className="mt-3 rounded-md border border-line bg-mist p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-ink">Component score breakdown</h4>
        <a
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-signal hover:border-signal"
          href="/methodology#score-components"
        >
          Methodology
        </a>
      </div>
      <div className="mt-2 text-xs leading-5 text-slate-600">
        Higher is better for every component shown here. Low regulatory risk and Low hype risk
        are inverted from raw concern penalties.
      </div>
      <div className="mt-3 grid gap-2">
        {rows.map((row) => (
          <div
            className="grid gap-2 rounded-md border border-line bg-white p-2 sm:grid-cols-[150px_1fr_44px]"
            key={row.label}
            title={scoreComponentDetail(row.label)}
          >
            <span className="text-xs font-semibold text-slate-700">{row.label}</span>
            <div
              aria-label={`${row.label} ${row.value} out of 10. ${scoreComponentDetail(row.label)}`}
              className="h-2 self-center rounded-full bg-slate-100"
              aria-valuemax={10}
              aria-valuemin={0}
              aria-valuenow={row.value}
              role="meter"
            >
              <span
                className="block h-full rounded-full bg-signal"
                style={{ width: `${scorePercent(row.value)}%` }}
              />
            </div>
            <span className="text-right text-xs font-semibold text-ink">{row.value}/10</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function scorePercent(value: number) {
  return Math.min(100, Math.max(0, value * 10));
}

function scoreComponentDetail(label: string) {
  switch (label) {
    case "Directness":
      return "Higher when the evidence matches the scoped intervention, form, population, outcome, and comparator.";
    case "Rigor":
      return "Higher when study design, comparator quality, extraction detail, and risk-of-bias context are stronger.";
    case "Impact":
      return "Higher when the observed or plausible effect is more clinically or practically meaningful for the scoped claim.";
    case "Safety":
      return "Higher when captured adverse-event, interaction, population-risk, and regulatory safety context is more reassuring.";
    case "Measurability":
      return "Higher when the claim can be checked with clear endpoints, biomarkers, registry outcomes, or validated measures.";
    case "Low regulatory risk":
      return "Higher means fewer captured product-status, supply, legal, AU/TGA, or regulatory concerns.";
    case "Low hype risk":
      return "Higher means fewer promotional overclaims, cure-all claims, or unsupported lifespan extrapolations.";
    default:
      return "Component score used by the provisional composite review heuristic.";
  }
}

function SourcePacketCard({
  claim,
  packet,
  referencesById
}: {
  claim: Claim;
  packet: ClaimSourcePacket;
  referencesById: Map<string, Reference>;
}) {
  return (
    <article className="rounded-lg border border-line bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{shortOutcome(claim.outcome)}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">{packet.completeness.detail}</p>
        </div>
        <span className="rounded-md border border-signal/25 bg-blue-50 px-2 py-1 text-xs font-semibold text-signal">
          {packet.completeness.extractedReferences}/{packet.completeness.totalReferences} refs extracted
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {packet.evidenceDepth.badges.map((badge) => (
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
      </div>
      <div className="mt-3 grid gap-3">
        {packet.studies.map((study) => (
          <StudyCard
            key={study.id}
            reference={referencesById.get(study.referenceId)}
            study={study}
          />
        ))}
        {packet.pendingReferences.map((reference) => (
          <ReferenceCard key={reference.id} reference={reference} status="Extraction pending" />
        ))}
        {packet.references.length === 0 ? (
          <EmptyState>No curated source packet is linked to this claim yet.</EmptyState>
        ) : null}
      </div>
    </article>
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

function StudyCard({ reference, study }: { reference?: Reference; study: Study }) {
  return (
    <article className="rounded-md border border-line bg-mist p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold leading-6 text-ink">{study.title}</h4>
          <p className="mt-1 text-xs text-slate-600">
            {study.source} - {study.year}
          </p>
        </div>
        <span className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700">
          {study.sourceTypeTaxonomy ?? study.studyType}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-700">
        Outcomes: {study.outcomes.join(", ")}
      </p>
      <dl className="mt-3 grid gap-2 text-xs md:grid-cols-2">
        <Detail label="Sample" value={study.sampleSize} />
        <Detail label="Population" value={study.population} />
        <Detail label="Risk of bias" value={study.riskOfBias} />
        <Detail label="Adverse events" value={study.adverseEvents} />
      </dl>
      {reference ? <SourceLink reference={reference} /> : null}
    </article>
  );
}

function ReferenceCard({
  reference,
  status
}: {
  reference: Reference;
  status: string;
}) {
  return (
    <article className="rounded-md border border-line bg-mist p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold leading-6 text-ink">{reference.title}</h4>
          <p className="mt-1 text-xs text-slate-600">
            {reference.source}
            {reference.year ? ` - ${reference.year}` : ""}
          </p>
        </div>
        <span className="rounded-md border border-amberline/30 bg-amber-50 px-2 py-1 text-xs font-semibold text-amberline">
          {status}
        </span>
      </div>
      <SourceLink reference={reference} />
    </article>
  );
}

function SafetyAlertCard({ alert }: { alert: SafetyAlert }) {
  return (
    <article className="rounded-lg border border-line bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{alert.alertType}</h3>
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
        className="mt-3 inline-flex max-w-full items-center gap-1 break-words text-xs font-semibold text-signal hover:underline"
        href={alert.url}
        rel="noreferrer"
        target="_blank"
      >
        Source
      </a>
    </article>
  );
}

function AustraliaStatusCard({ status }: { status: AustraliaRegulatoryStatus }) {
  return (
    <article className="rounded-lg border border-line bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">AU/TGA status</h3>
        <span className={cn("rounded-md border px-2 py-1 text-xs font-semibold", australiaRegulatoryTone(status.kind))}>
          {status.kind}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-700">{status.status}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{status.supplySummary}</p>
      <p className="mt-2 text-xs leading-5 text-slate-600">
        {australiaRegulatoryKindDescription(status.kind)}
      </p>
      <a
        className="mt-3 inline-flex max-w-full items-center gap-1 break-words text-xs font-semibold text-signal hover:underline"
        href={status.sourceUrl}
        rel="noreferrer"
        target="_blank"
      >
        TGA source
      </a>
    </article>
  );
}

function ProductContextCard({
  product,
  statuses
}: {
  product: ProductSignal;
  statuses: AustraliaRegulatoryStatus[];
}) {
  return (
    <article className="rounded-lg border border-line bg-white p-3">
      <h3 className="text-sm font-semibold text-ink">
        {product.brand} - {product.name}
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-700">
        Ingredients: {product.ingredients.join(", ")}
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-md border border-line bg-mist px-2 py-1 text-slate-600">
          Region: {product.region}
        </span>
        <span className="rounded-md border border-signal/25 bg-blue-50 px-2 py-1 font-semibold text-signal">
          Product quality {product.qualityScore}/10
        </span>
        <span className="rounded-md border border-amberline/30 bg-amber-50 px-2 py-1 font-semibold text-amberline">
          Claim risk {product.labelClaimRiskScore}/10
        </span>
      </div>
      {statuses.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {statuses.map((status) => (
            <div
              className="rounded-md border border-amberline/30 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950"
              key={status.id}
            >
              <p className="font-semibold">
                Product AU/TGA: {status.status} ({status.kind})
              </p>
              <p className="mt-1">{status.supplySummary}</p>
              <p className="mt-1">
                <span className="font-semibold">Needed:</span> {status.evidenceRequirement}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-md border border-amberline/30 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
          Product-level AU/TGA status is not captured for this profile. Ingredient evidence and
          quality certifications do not verify an AUST/ARTG listing.
        </p>
      )}
    </article>
  );
}

function NonProofList({ claim }: { claim: Claim }) {
  const statements =
    claim.doesNotProve && claim.doesNotProve.length > 0
      ? claim.doesNotProve
      : ["Does not provide individualized medical advice."];

  return (
    <section className="mt-3 rounded-md border border-amberline/30 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
      <p className="font-semibold">What this does not prove</p>
      <ul className="mt-1 list-disc space-y-1 pl-4">
        {statements.map((statement) => (
          <li key={statement}>{statement}</li>
        ))}
      </ul>
    </section>
  );
}

function ReferenceLinks({
  claim,
  referencesById
}: {
  claim: Claim;
  referencesById: Map<string, Reference>;
}) {
  const references = claim.keyReferenceIds
    .map((referenceId) => referencesById.get(referenceId))
    .filter((reference): reference is Reference => Boolean(reference));

  if (references.length === 0) {
    return <EmptyState>No citation links are attached to this claim yet.</EmptyState>;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {references.map((reference) => (
        <a
          className="rounded-md border border-line bg-mist px-2 py-1 text-xs font-semibold text-signal hover:border-signal"
          href={reference.url}
          key={reference.id}
          rel="noreferrer"
          target="_blank"
        >
          {reference.source}
          {reference.identifier ? ` - ${reference.identifier}` : ""}
        </a>
      ))}
    </div>
  );
}

function SourceLink({ reference }: { reference: Reference }) {
  return (
    <a
      className="mt-3 inline-flex max-w-full items-center gap-1 break-words text-xs font-semibold text-signal hover:underline"
      href={reference.url}
      rel="noreferrer"
      target="_blank"
    >
      {reference.source}
      {reference.identifier ? ` - ${reference.identifier}` : ""}
    </a>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-mist p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</dt>
      <dd className="mt-2 text-sm leading-6 text-slate-700">{value}</dd>
    </div>
  );
}

function productSignalsForIntervention(
  products: ProductSignal[],
  intervention: Intervention
) {
  const terms = [intervention.name, ...intervention.synonyms]
    .map((term) => term.toLowerCase())
    .filter(Boolean);

  return products.filter((product) => {
    const haystack = [product.name, product.brand, ...product.ingredients]
      .join(" ")
      .toLowerCase();

    return terms.some((term) => haystack.includes(term));
  });
}

function isPeptideOrTherapeutic(intervention: Intervention, claims: Claim[]) {
  return (
    intervention.category === "Peptide/biologic" ||
    claims.some((claim) =>
      ["Regulatory Concern", "Requires Clinician Oversight"].includes(claim.finalLabel)
    )
  );
}

function shortOutcome(outcome: string) {
  return outcome
    .replace("Mortality/lifespan", "Lifespan")
    .replace("Cardiovascular events", "CV events")
    .replace("LDL/ApoB/lipids", "Lipids")
    .replace("Joint/tendon/skin", "Joint/skin")
    .replace("Muscle/strength", "Strength");
}

function formatSnapshotDate(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(parsed);
}

function formatHistoryReason(reason: string) {
  return reason
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
