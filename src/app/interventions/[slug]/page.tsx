import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { DashboardDataUnavailable } from "@/app/dashboard-data-unavailable";
import { getEvidenceDashboardData } from "@/lib/data/dashboard";
import { buildEvidenceHumanReviewQueue } from "@/lib/evidence-coverage";
import { australiaRegulatoryKindDescription, australiaRegulatoryTone } from "@/lib/regulatory";
import {
  formatSafetyAlertRegionLabel,
  safetyDomainForAlertType,
  summarizeRegionalSafetyRegulatoryCoverage,
  summarizeSafetyDomainCoverage
} from "@/lib/safety-domains";
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
  ClaimScoreHistoryEntry,
  ClaimScoreSnapshot,
  EvidenceDashboardData,
  Intervention,
  ProductSignal,
  Reference,
  SafetyAlert,
  Study,
  TrialWatchItem
} from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Intervention Detail | Apex Lifespan",
  description: "Claim-specific evidence, source packets, safety context, and score history."
};

const HUMAN_REVIEWED_TOOLTIP =
  "Human reviewed means a human reviewer checked the source packet against the scoped claim. It does not mean clinical guideline endorsement.";
const PENDING_HUMAN_REVIEW_TOOLTIP =
  "Pending human review means a human reviewer has not yet confirmed the source packet against the scoped claim. AI-reviewed packets remain draft review aids.";

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
  const confidenceQueueItemsByClaimId = new Map(
    buildEvidenceHumanReviewQueue(data).items.map((item) => [item.claimId, item])
  );
  const scoreHistoryByClaimId = latestScoreHistoryByClaimId(data.scoreHistory ?? []);
  const scoreSnapshotsByClaimId = latestScoreSnapshotsByClaimId(data.scoreSnapshots ?? []);
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
  const localScopeSummary = [
    `${claims.length} scoped claim${claims.length === 1 ? "" : "s"}`,
    `${sourcePackets.length} source-packet view${sourcePackets.length === 1 ? "" : "s"}`,
    `${safetyAlerts.length} local safety alert${safetyAlerts.length === 1 ? "" : "s"}`,
    `${australiaStatuses.length} AU/TGA row${australiaStatuses.length === 1 ? "" : "s"}`,
    `${productSignals.length} product-signal row${productSignals.length === 1 ? "" : "s"}`
  ].join(", ");

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
          <p className="mt-3 rounded-md border border-line bg-mist px-3 py-2 text-xs leading-5 text-slate-600">
            Local page scope: {localScopeSummary}. Counts show captured local data only; absent
            rows are review gaps, not medical advice, regulatory clearance, or product
            recommendations.
          </p>
          {isPeptideOrTherapeutic(intervention, claims) ? (
            <p className="mt-4 rounded-md border border-amberline/30 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-950">
              Peptide and therapeutic-intervention cards emphasize regulatory status, approved
              indications, human evidence, safety signals, product-quality risk, and clinician
              oversight. Apex must not provide sourcing, compounding, reconstitution, injection,
              cycling, or self-administration instructions.
            </p>
          ) : null}
        </header>

        <Section title="Intervention Summary">
          <div className="grid gap-3 md:grid-cols-2">
            <InfoCard label="Common forms" value={intervention.commonForms.join(", ")} />
            <InfoCard label="Regulatory status" value={intervention.regulatoryStatus} />
            <InfoCard label="Safety summary" value={intervention.safetySummary} />
            <InfoCard label="Interaction summary" value={intervention.interactionSummary} />
          </div>
        </Section>

        <Section title="Evidence Map Row">
          {claims.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {claims.map((claim) => {
                const score = compositeScore(claim.scores);
                const confidenceItem = confidenceQueueItemsByClaimId.get(claim.id);
                const weightedScore = confidenceItem?.confidenceWeightedScore ?? score;
                const aiConfidenceScore = confidenceItem?.aiConfidenceScore ?? 100;

                return (
                  <article
                    className={cn("rounded-lg border p-3", labelTone(claim.finalLabel))}
                    key={claim.id}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide">
                      {shortOutcome(claim.outcome)}
                    </p>
                    <p className="mt-2 text-xs font-semibold">
                      Confidence-weighted {compositeLabel(claim)}
                    </p>
                    <p className="mt-2 text-2xl font-semibold">{weightedScore.toFixed(1)}</p>
                    <p className="mt-1 text-xs font-semibold">{scoreBand(weightedScore)}</p>
                    <p className="mt-2 text-xs leading-5">
                      Raw {score.toFixed(1)} x AI confidence {aiConfidenceScore}/100
                    </p>
                    <p className="mt-2 text-xs leading-5">
                      {classificationLabel(claim)}: {claim.finalLabel}
                    </p>
                    <p className="mt-1 text-xs leading-5">{reviewStatusLabel(claim.reviewStatus)}</p>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState>
              No scored claim rows are attached to this intervention yet. This is a local data gap,
              not evidence that no scoped claim or evidence exists.
            </EmptyState>
          )}
        </Section>

        <Section title="Evidence Cards">
          <div className="grid gap-3">
            <p className="rounded-md border border-line bg-mist px-3 py-2 text-sm leading-6 text-slate-600">
              These cards carry dashboard evidence-card detail for this supplement, including
              scoped claims, component scores, source packet status, boundaries, and references.
            </p>
            {claims.map((claim) => (
              <ClaimCard
                claim={claim}
                key={claim.id}
                packet={sourcePackets.find((item) => item.claim.id === claim.id)?.packet}
                referencesById={referencesById}
              />
            ))}
          </div>
        </Section>

        <Section title="Source Packets">
          <div className="grid gap-3">
            <SourcePacketCoverageSummary sourcePackets={sourcePackets} />
            {sourcePackets.map(({ claim, packet }) => (
              <SourcePacketCard
                claim={claim}
                key={claim.id}
                packet={packet}
                referencesById={referencesById}
              />
            ))}
          </div>
        </Section>

        <Section title="Safety Alerts">
          {safetyAlerts.length > 0 ? (
            <div className="grid gap-3">
              <SafetyDomainCoveragePanel safetyAlerts={safetyAlerts} />
              <div className="grid gap-3">
                {safetyAlerts.map((alert) => (
                  <SafetyAlertCard alert={alert} key={alert.id} />
                ))}
              </div>
            </div>
          ) : (
            <EmptyState>
              No local safety alerts are attached to this intervention. This does not imply
              safety, efficacy, or regulatory clearance.
            </EmptyState>
          )}
        </Section>

        <Section title="Trial Watcher Records">
          {trialWatchItems.length > 0 ? (
            <div className="grid gap-3">
              {trialWatchItems.map((trial) => (
                <TrialWatchCard key={trial.id} trial={trial} />
              ))}
            </div>
          ) : (
            <EmptyState>
              No local trial watcher records are attached to this intervention. Check current trial
              registries before treating this as no active or relevant trials.
            </EmptyState>
          )}
        </Section>

        <Section title="AU/TGA And Product Context">
          <div className="grid gap-3">
            <RegionalSafetyRegulatoryCoveragePanel
              australiaStatuses={australiaStatuses}
              safetyAlerts={safetyAlerts}
            />
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
              <EmptyState>
                No matching local product-signal row is attached to this intervention. This does not
                imply product authorization, product quality, or a product recommendation.
              </EmptyState>
            )}
          </div>
        </Section>

        <Section title="Score History">
          {claims.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    {[
                      "Claim",
                      "Current score",
                      "Previous",
                      "Band",
                      "Label",
                      "Reason",
                      "Provenance",
                      "Date"
                    ].map((heading) => (
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
                    const history = scoreHistoryByClaimId.get(claim.id);
                    const snapshot = scoreSnapshotsByClaimId.get(claim.id);
                    const score =
                      history?.newCompositeScore ??
                      snapshot?.compositeScore ??
                      compositeScore(claim.scores);
                    const finalLabel = history?.newLabel ?? snapshot?.finalLabel ?? claim.finalLabel;
                    const snapshotDate = history?.createdAt ?? snapshot?.computedAt ?? claim.lastUpdated;
                    const previousScore = history?.oldCompositeScore;
                    const reason = history?.reason ?? "Current score snapshot";

                    return (
                      <tr key={claim.id}>
                        <td className="border-b border-line px-3 py-3 text-slate-700">
                          {shortOutcome(claim.outcome)}
                        </td>
                        <td className="border-b border-line px-3 py-3 font-semibold text-ink">
                          {score.toFixed(1)}
                        </td>
                        <td className="border-b border-line px-3 py-3 text-slate-700">
                          {previousScore === undefined ? "n/a" : previousScore.toFixed(1)}
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
                          {reason}
                        </td>
                        <td className="max-w-[22rem] border-b border-line px-3 py-3 text-xs leading-5 text-slate-700">
                          <ScoreProvenanceCell
                            history={history}
                            referencesById={referencesById}
                            snapshot={snapshot}
                          />
                        </td>
                        <td className="border-b border-line px-3 py-3 text-slate-700">
                          {snapshotDate}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-3 rounded-md border border-line bg-mist px-3 py-2 text-xs leading-5 text-slate-600">
                Score history shows the latest captured score-change row when available, otherwise
                the latest score snapshot for each scoped claim. Decimal scores are provisional
                review heuristics, not clinical recommendations.
              </p>
            </div>
          ) : (
            <EmptyState>
              No score snapshots are attached to this intervention yet. Current scoring may still
              come from seed claim rows rather than stored score-history records.
            </EmptyState>
          )}
        </Section>

        <Section title="What Would Change The Score">
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
            <EmptyState>
              No score-change criteria are attached to this intervention yet. This means no local
              improvement criteria were captured, not that the score is final.
            </EmptyState>
          )}
        </Section>
      </div>
    </main>
  );
}

function Section({
  children,
  title
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
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

function reviewStatusTooltip(status: Claim["reviewStatus"]) {
  return isHumanReviewed(status) ? HUMAN_REVIEWED_TOOLTIP : PENDING_HUMAN_REVIEW_TOOLTIP;
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
  const statusLabel = reviewStatusLabel(claim.reviewStatus);
  const statusTooltip = reviewStatusTooltip(claim.reviewStatus);

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
        <span
          aria-label={`${statusLabel}: ${statusTooltip}`}
          className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 font-semibold text-slate-700"
          title={statusTooltip}
        >
          {statusLabel}
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

function SourcePacketCoverageSummary({
  sourcePackets
}: {
  sourcePackets: Array<{ claim: Claim; packet: ClaimSourcePacket }>;
}) {
  const completePackets = sourcePackets.filter(
    ({ packet }) => packet.completeness.status === "complete"
  );
  const gapPackets = sourcePackets.filter(
    ({ packet }) => packet.completeness.status !== "complete"
  );
  const totalReferences = sourcePackets.reduce(
    (count, { packet }) => count + packet.completeness.totalReferences,
    0
  );
  const extractedReferences = sourcePackets.reduce(
    (count, { packet }) => count + packet.completeness.extractedReferences,
    0
  );

  return (
    <section className="rounded-md border border-line bg-mist p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink">Source coverage for this intervention</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Local source-packet coverage only; incomplete packets are evidence-intake gaps, not
            evidence that no source exists.
          </p>
          {totalReferences > 0 ? (
            <p className="mt-2 text-xs leading-5 text-slate-600">
              {extractedReferences}/{totalReferences} linked reference
              {totalReferences === 1 ? "" : "s"} have structured extraction on this page.
            </p>
          ) : null}
        </div>
        <span className="w-fit rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-slate-700">
          {completePackets.length}/{sourcePackets.length} complete
        </span>
      </div>
      {gapPackets.length > 0 ? (
        <div className="mt-3 rounded-md border border-amberline/25 bg-amber-50 p-2 text-xs leading-5 text-amber-950">
          <p className="font-semibold">
            {gapPackets.length} claim{gapPackets.length === 1 ? " needs" : "s need"} source work
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {gapPackets.map(({ claim, packet }) => (
              <li key={claim.id}>
                {shortOutcome(claim.outcome)}: {packet.completeness.label}.{" "}
                {packet.completeness.nextStep}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 rounded-md border border-spruce/25 bg-teal-50 p-2 text-xs leading-5 text-spruce">
          Every scoped claim on this page has a complete local source packet. Human review,
          AU/TGA product status, safety clearance, and medical advice remain separate.
        </p>
      )}
    </section>
  );
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
    <article
      className="scroll-mt-4 rounded-lg border border-line bg-white p-3"
      id={`source-packet-${claim.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{shortOutcome(claim.outcome)}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">{packet.completeness.detail}</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {reviewStatusLabel(claim.reviewStatus)} · last updated {claim.lastUpdated}
          </p>
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

function RegionalSafetyRegulatoryCoveragePanel({
  australiaStatuses,
  safetyAlerts
}: {
  australiaStatuses: AustraliaRegulatoryStatus[];
  safetyAlerts: SafetyAlert[];
}) {
  const coverage = summarizeRegionalSafetyRegulatoryCoverage({
    australiaRegulatoryStatuses: australiaStatuses,
    safetyAlerts
  });

  return (
    <div className="rounded-md border border-line bg-mist p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">
            Regional safety and AU/TGA scope for this intervention
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Captured local safety and AU/TGA records only; absent rows are review gaps, not
            clearance or product authorization.
          </p>
        </div>
        <span className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-slate-700">
          {coverage.length} review scopes
        </span>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {coverage.map((region) => (
          <div key={region.region} className="rounded-md border border-line bg-white p-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-ink">{region.region}</p>
                <p className="mt-1 text-xs text-slate-600">{region.reviewScopeLabel}</p>
              </div>
              <span className="rounded-md border border-line bg-mist px-2 py-1 text-xs font-semibold text-slate-700">
                {region.scopeLabel}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              {region.statusLabel}
              {region.status === "not-yet-captured"
                ? ": no reviewed local safety or AU/TGA record is currently linked to this intervention in this review region."
                : "."}
            </p>
            <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
              <Detail label="Safety alerts" value={formatRegionalSafetyAlertValue(region)} />
              <Detail
                label="Highest safety severity"
                value={region.highestSafetySeverityLabel}
              />
              <Detail label="AU/TGA records" value={formatRegionalAustraliaStatusValue(region)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatRegionalSafetyAlertValue(
  region: ReturnType<typeof summarizeRegionalSafetyRegulatoryCoverage>[number]
) {
  return `${region.safetyAlertCount}${
    region.safetyAlertTypes.length > 0 ? `: ${region.safetyAlertTypes.join(", ")}` : ""
  }`;
}

function formatRegionalAustraliaStatusValue(
  region: ReturnType<typeof summarizeRegionalSafetyRegulatoryCoverage>[number]
) {
  return `${region.australiaRegulatoryStatusCount}${
    region.australiaRegulatoryKinds.length > 0
      ? `: ${region.australiaRegulatoryKinds.join(", ")}`
      : ""
  }`;
}

function SafetyDomainCoveragePanel({ safetyAlerts }: { safetyAlerts: SafetyAlert[] }) {
  const coverage = summarizeSafetyDomainCoverage(safetyAlerts);

  return (
    <div className="rounded-md border border-line bg-mist p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">
            Safety-domain coverage for this intervention
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Reviewed local alerts by safety domain; gaps mean no reviewed alert is currently
            attached to this intervention.
          </p>
        </div>
        <span className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-slate-700">
          {safetyAlerts.length} alert{safetyAlerts.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {coverage.map((domain) => (
          <div key={domain.id} className="rounded-md border border-line bg-white p-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-ink">{domain.label}</span>
              <span
                className={cn(
                  "rounded-md border px-2 py-1 text-xs font-semibold",
                  domain.status === "reviewed-alerts-captured"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                )}
              >
                {domain.statusLabel}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              {domain.alertCount > 0
                ? `${domain.alertCount} reviewed alert${
                    domain.alertCount === 1 ? "" : "s"
                  } across ${domain.regions.join(", ")}.`
                : "No reviewed local alert captured for this domain on this intervention."}
            </p>
            {domain.alertTypes.length > 0 ? (
              <p className="mt-1 text-xs font-semibold text-slate-700">
                {domain.alertTypes.join(", ")}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function SafetyAlertCard({ alert }: { alert: SafetyAlert }) {
  const domain = safetyDomainForAlertType(alert.alertType);

  return (
    <article className="rounded-lg border border-line bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{alert.alertType}</h3>
          <p className="mt-1 text-xs text-slate-600">
            {alert.source} - {formatSafetyAlertRegionLabel(alert.region)} - {alert.date}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <span className="rounded-md border border-line bg-mist px-2 py-1 text-xs font-semibold text-slate-700">
            {domain.label}
          </span>
          <span className={cn("rounded-md border px-2 py-1 text-xs font-semibold", severityTone(alert.severity))}>
            {alert.severity}
          </span>
        </div>
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

function TrialWatchCard({ trial }: { trial: TrialWatchItem }) {
  return (
    <article className="rounded-lg border border-line bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{trial.title}</h3>
          <p className="mt-1 text-xs text-slate-600">
            {trial.status} - {trial.phase} - {trial.lastUpdateDate}
          </p>
        </div>
        <span className="rounded-md border border-signal/25 bg-blue-50 px-2 py-1 text-xs font-semibold text-signal">
          {trial.evidenceImpact}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-700">
        Enrollment: {trial.enrollment}. Registry records are review leads, not proof of benefit.
      </p>
      <a
        className="mt-3 inline-flex max-w-full items-center gap-1 break-words text-xs font-semibold text-signal hover:underline"
        href={trial.url}
        rel="noreferrer"
        target="_blank"
      >
        Trial registry source
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

function ScoreProvenanceCell({
  history,
  referencesById,
  snapshot
}: {
  history?: ClaimScoreHistoryEntry;
  referencesById: Map<string, Reference>;
  snapshot?: ClaimScoreSnapshot;
}) {
  if (history) {
    const reference = history.referenceId
      ? referencesById.get(history.referenceId)
      : undefined;

    return (
      <div className="space-y-1">
        <p>{history.rationale}</p>
        {history.referenceId ? (
          <p>
            Linked reference:{" "}
            {reference ? (
              <a
                className="font-semibold text-signal hover:underline"
                href={reference.url}
                rel="noreferrer"
                target="_blank"
              >
                {formatReferenceLabel(reference)}
              </a>
            ) : (
              history.referenceId
            )}
          </p>
        ) : null}
      </div>
    );
  }

  if (snapshot?.rationale) {
    return (
      <div className="space-y-1">
        <p>{snapshot.rationale}</p>
        <p>Snapshot: {snapshot.id}</p>
      </div>
    );
  }

  return <p>No normalized score provenance row yet.</p>;
}

function formatReferenceLabel(reference: Reference) {
  return `${reference.source}${reference.identifier ? ` - ${reference.identifier}` : ""}`;
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

function latestScoreHistoryByClaimId(historyRows: ClaimScoreHistoryEntry[]) {
  const byClaimId = new Map<string, ClaimScoreHistoryEntry>();

  for (const row of historyRows) {
    if (!byClaimId.has(row.claimId)) {
      byClaimId.set(row.claimId, row);
    }
  }

  return byClaimId;
}

function latestScoreSnapshotsByClaimId(snapshots: ClaimScoreSnapshot[]) {
  const snapshotsByClaimId = new Map<string, ClaimScoreSnapshot>();

  for (const snapshot of snapshots) {
    const current = snapshotsByClaimId.get(snapshot.claimId);

    if (!current || snapshot.computedAt > current.computedAt) {
      snapshotsByClaimId.set(snapshot.claimId, snapshot);
    }
  }

  return snapshotsByClaimId;
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
