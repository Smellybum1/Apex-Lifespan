import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { DashboardDataUnavailable } from "@/app/dashboard-data-unavailable";
import { InterventionTrialList } from "@/components/intervention-trial-list";
import { getEvidenceDashboardData } from "@/lib/data/dashboard";
import { australiaRegulatoryKindDescription, australiaRegulatoryTone } from "@/lib/regulatory";
import {
  buildClaimSourcePacket,
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
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Intervention Detail | Apex Lifespan",
  description: "Claim-specific evidence, source packets, safety context, and score history."
};

type InterventionDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function InterventionDetailPage({ params }: InterventionDetailPageProps) {
  const { slug } = await params;
  let data: EvidenceDashboardData;

  try {
    data = await getEvidenceDashboardData();
  } catch {
    return <DashboardDataUnavailable />;
  }

  const intervention = data.interventions.find((item) => item.slug === slug);

  if (!intervention) {
    notFound();
  }

  const referencesById = new Map(data.references.map((reference) => [reference.id, reference]));
  const claims = data.claims.filter((claim) => claim.interventionId === intervention.id);
  const sourcePackets = claims.map((claim) => ({
    claim,
    packet: buildClaimSourcePacket({
      claim,
      referencesById,
      studies: data.studies
    })
  }));
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
  const claimIds = new Set(claims.map((claim) => claim.id));
  const snapshotsByClaimId = new Map(
    (data.claimScoreSnapshots ?? [])
      .filter((snapshot) => claimIds.has(snapshot.claimId))
      .map((snapshot) => [snapshot.claimId, snapshot])
  );
  const scoreHistory = (data.claimScoreHistory ?? [])
    .filter((entry) => claimIds.has(entry.claimId))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

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
                Intervention detail
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-ink">
                {intervention.name}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700">
                {intervention.evidenceSummary}
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

        <CollapsibleSection defaultOpen title="Intervention Summary">
          <div className="grid gap-3 md:grid-cols-2">
            <InfoCard label="Common forms" value={intervention.commonForms.join(", ")} />
            <InfoCard label="Regulatory status" value={intervention.regulatoryStatus} />
            <InfoCard label="Safety summary" value={intervention.safetySummary} />
            <InfoCard label="Interaction summary" value={intervention.interactionSummary} />
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          badge={`${claims.length} outcomes`}
          defaultOpen
          title="Evidence scores by outcome"
        >
          {claims.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {claims.map((claim) => {
                const score = compositeScore(claim.scores);

                return (
                  <article
                    className={cn("rounded-lg border p-3", labelTone(claim.finalLabel))}
                    id={`claim-${claim.id}`}
                    key={claim.id}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide">
                      {shortOutcome(claim.outcome)}
                    </p>
                    <p className="mt-2 text-xs font-semibold">{compositeLabel(claim)}</p>
                    <p className="mt-2 text-2xl font-semibold">{score.toFixed(1)}</p>
                    <p className="mt-1 text-xs font-semibold">{scoreBand(score)}</p>
                    <p className="mt-2 text-xs leading-5">
                      {classificationLabel(claim)}: {claim.finalLabel}
                    </p>
                    <p className="mt-1 text-xs leading-5">{reviewStatusLabel(claim.reviewStatus)}</p>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState>No scored claim rows are attached to this intervention yet.</EmptyState>
          )}
        </CollapsibleSection>

        <CollapsibleSection badge={`${claims.length}`} defaultOpen title="Claim cards">
          <div className="grid gap-3">
            {claims.map((claim) => (
              <ClaimCard
                claim={claim}
                key={claim.id}
                packet={sourcePackets.find((item) => item.claim.id === claim.id)?.packet}
                referencesById={referencesById}
              />
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection badge={`${claims.length}`} title="Source packets">
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

        <CollapsibleSection badge={safetyAlerts.length > 0 ? String(safetyAlerts.length) : undefined} title="Safety alerts">
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
                No intervention-level AU/TGA status row is captured yet. Product-level confidence
                needs product-level evidence.
              </EmptyState>
            )}
            {productSignals.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {productSignals.map((product) => (
                  <ProductContextCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <EmptyState>No matching local product-signal row is attached to this intervention.</EmptyState>
            )}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Score history">
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
                      const score = snapshot?.compositeScore ?? compositeScore(claim.scores);
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
                            {score.toFixed(1)}
                          </td>
                          <td className="border-b border-line px-3 py-3 text-slate-700">
                            {scoreBand(score)}
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
      </div>
    </main>
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
  referencesById
}: {
  claim: Claim;
  packet?: ClaimSourcePacket;
  referencesById: Map<string, Reference>;
}) {
  const score = compositeScore(claim.scores);

  return (
    <article className="rounded-lg border border-line bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{shortOutcome(claim.outcome)}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">{claim.claimText}</p>
        </div>
        <div className="rounded-md border border-line bg-mist px-3 py-2 text-right">
          <p className="text-xs text-slate-600">{compositeLabel(claim)}</p>
          <p className="text-2xl font-semibold text-ink">{score.toFixed(1)}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className={cn("rounded-md border px-2 py-1 font-semibold", labelTone(claim.finalLabel))}>
          {classificationLabel(claim)}: {claim.finalLabel}
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
      <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
        <Detail label="Population" value={claim.populationStudied} />
        <Detail label="Dose/form" value={claim.doseFormStudied} />
        <Detail label="Comparator" value={claim.comparator} />
        <Detail label="Effect" value={claim.effectSize} />
        <Detail label="Safety" value={claim.safetyNotes} />
        <Detail label="Applicability" value={claim.applicabilityNotes} />
      </dl>
      <ScoreComponentBreakdown claim={claim} />
      <NonProofList claim={claim} />
      <ReferenceLinks claim={claim} referencesById={referencesById} />
    </article>
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
      <p className="mt-2 text-xs leading-5 text-slate-600">
        Higher is better for every component shown here. Low regulatory risk and Low hype risk
        are inverted from raw concern penalties.
      </p>
      <div className="mt-3 grid gap-2">
        {rows.map((row) => (
          <div
            className="grid gap-2 rounded-md border border-line bg-white p-2 sm:grid-cols-[150px_1fr_44px]"
            key={row.label}
            title={scoreComponentDetail(row.label)}
          >
            <p className="text-xs font-semibold text-slate-700">{row.label}</p>
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
            <p className="text-right text-xs font-semibold text-ink">{row.value}/10</p>
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

function ProductContextCard({ product }: { product: ProductSignal }) {
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
