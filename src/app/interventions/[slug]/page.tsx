import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { DashboardDataUnavailable } from "@/app/dashboard-data-unavailable";
import { InterventionTrialList } from "@/components/intervention-trial-list";
import { getEvidenceDashboardData } from "@/lib/data/dashboard";
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
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Intervention Detail | Apex Lifespan",
  description: "Claim-specific evidence, source packets, safety context, and score history."
};

const DRAFT_LEAD_EVIDENCE_GRADE = "Draft lead";
const SOURCE_PACKET_REVIEW_EVIDENCE_GRADE = "Insufficient until source packets are reviewed.";

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

        <CollapsibleSection defaultOpen title="What the Studies Found">
          <DetailedEvidenceSummary
            australiaStatuses={australiaStatuses}
            intervention={intervention}
            productSignals={productSignals}
            readinessByClaimId={readinessByClaimId}
            safetyAlerts={safetyAlerts}
            sourcePackets={sourcePackets}
          />
        </CollapsibleSection>

        <InterventionReadinessPanel
          australiaStatuses={australiaStatuses}
          productSignals={productSignals}
          readiness={readiness}
          safetyAlerts={safetyAlerts}
        />

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
                readinessRow={readinessByClaimId.get(claim.id)}
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

function DetailedEvidenceSummary({
  australiaStatuses,
  intervention,
  productSignals,
  readinessByClaimId,
  safetyAlerts,
  sourcePackets
}: {
  australiaStatuses: AustraliaRegulatoryStatus[];
  intervention: Intervention;
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
  const references = uniqueReferences(sourcePackets.flatMap((row) => row.packet.references));
  const studies = uniqueStudies(sourcePackets.flatMap((row) => row.packet.studies));
  const studyTypeSummary = summarizeStudyTypes(studies);
  const studyFindingRows = buildStudyFindingRows(sourcePackets);
  const popularClaimRows = buildPopularClaimRows(intervention, sourcePackets, readinessByClaimId);
  const practicalReadout = buildSupplementPracticalReadout({
    australiaStatuses,
    incompleteRows,
    intervention,
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
    productSignals,
    references,
    safetyAlerts,
    scoredRows,
    sourcePackets,
    studies
  });

  return (
    <div className="grid gap-4">
      <section className="rounded-md border border-signal/20 bg-blue-50 p-3">
        <h3 className="text-sm font-semibold text-ink">Overall evidence summary</h3>
        <div className="mt-2 grid gap-2 text-sm leading-6 text-slate-700">
          {overallSummary.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>

      <SupplementPracticalReadoutPanel readout={practicalReadout} />

      {sourceGapRows.length > 0 ? (
        <section className="rounded-md border border-amberline/30 bg-amber-50 p-3 text-amber-950">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Evidence gaps to treat as sourcing work</h3>
            <span className="rounded-md border border-amberline/30 bg-white px-2 py-1 text-xs font-semibold">
              {sourceGapRows.length} source {sourceGapRows.length === 1 ? "gap" : "gaps"}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6">
            These rows may appear in the dashboard as source work. They are not evidence-backed
            conclusions yet; they need linked articles and structured extraction before they should
            influence practical rankings.
          </p>
          <div className="mt-3 grid gap-2">
            {sourceGapRows.map(({ claim, packet }) => (
              <article className="rounded-md border border-amberline/20 bg-white p-3" key={claim.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a className="text-sm font-semibold text-ink underline" href={`#claim-${claim.id}`}>
                    {shortOutcome(claim.outcome)}
                  </a>
                  <span
                    className={cn(
                      "rounded-md border px-2 py-1 text-xs font-semibold",
                      sourcePacketCompletenessTone(packet.completeness.status)
                    )}
                  >
                    {packet.completeness.label}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-700">
                  {sourceGapSummary(claim, packet)}
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-700">
                  <span className="font-semibold text-ink">Next source step:</span>{" "}
                  {packet.completeness.nextStep}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

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
                  (readinessRow ? scoreReadinessNextAction(readinessRow) : packet.completeness.nextStep);

                return (
                  <article className="rounded-md border border-line bg-white p-3" key={claim.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-ink">{shortOutcome(claim.outcome)}</p>
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
          {studyTypeSummary ? ` (${studyTypeSummary}).` : "."} These links are the source trail for
          the summaries above.
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

      <section className="rounded-md border border-amberline/30 bg-amber-50 p-3 text-amber-950">
        <h3 className="text-sm font-semibold">Safety, regulatory, and product context</h3>
        <p className="mt-2 text-sm leading-6">
          {buildSafetyRegulatorySummary({
            australiaStatuses,
            intervention,
            productSignals,
            safetyAlerts,
            sourcePackets
          })}
        </p>
      </section>
    </div>
  );
}

function buildSupplementPracticalReadout({
  australiaStatuses,
  incompleteRows,
  intervention,
  productSignals,
  safetyAlerts,
  scoredRows,
  sourcePackets,
  studies
}: {
  australiaStatuses: AustraliaRegulatoryStatus[];
  incompleteRows: ClaimPacketPair[];
  intervention: Intervention;
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
    score >= 8
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
  productSignals,
  safetyAlerts,
  sourcePackets
}: {
  australiaStatuses: AustraliaRegulatoryStatus[];
  intervention: Intervention;
  productSignals: ProductSignal[];
  safetyAlerts: SafetyAlert[];
  sourcePackets: ClaimPacketPair[];
}) {
  const rows = [
    punctuateSentence(intervention.safetySummary),
    punctuateSentence(intervention.interactionSummary),
    `${australiaStatuses.length.toLocaleString()} AU/TGA intervention row${australiaStatuses.length === 1 ? "" : "s"} and ${productSignals.length.toLocaleString()} product signal${productSignals.length === 1 ? "" : "s"} are attached; ingredient evidence does not verify a specific product or AUST number.`
  ];

  safetyAlerts.slice(0, 2).forEach((alert) => {
    rows.push(`${alert.source} ${alert.alertType}: ${punctuateSentence(alert.summary)}`);
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

  return `${supportedRows.length.toLocaleString()} direct lifespan claim${supportedRows.length === 1 ? "" : "s"} have moderate-or-better local support, but healthspan, biomarker, product, and population boundaries still apply.`;
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
    claim.finalLabel !== "Regulatory Concern"
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

  return `${shortOutcome(claim.outcome)}: ${summaryText} ${scoreText} ${studyText} ${limitationText}`;
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
  productSignals,
  safetyAlerts,
  sourcePackets,
  studies
}: {
  australiaStatuses: AustraliaRegulatoryStatus[];
  intervention: Intervention;
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
      return `${shortOutcome(claim.outcome).toLowerCase()} (${score} ${scoreState.tableBand}, ${claim.confidenceLevel.toLowerCase()} confidence)`;
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
  productSignals,
  safetyAlerts,
  sourcePackets
}: {
  australiaStatuses: AustraliaRegulatoryStatus[];
  intervention: Intervention;
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
    .map(([label, count]) => `${count} ${label}`)
    .join(", ");
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
  extractedReferences: number;
  humanReviewedClaims: number;
  incompleteSourcePackets: number;
  pendingHumanReview: number;
  pendingReferences: number;
  readyToScoreClaims: number;
  reviewWorkClaims: number;
  scoredClaims: Array<{ claim: Claim; score: number }>;
  scoreAuditClaims: number;
  sourceWorkClaims: number;
  totalClaims: number;
  totalReferences: number;
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
    extractedReferences: sourcePacketSummary.extractedReferences,
    humanReviewedClaims: reviewSummary.humanReviewed,
    incompleteSourcePackets:
      sourcePacketSummary.extractionPendingClaims +
      sourcePacketSummary.missingSourceClaims +
      sourcePacketSummary.unlinkedClaims,
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
    totalReferences: sourcePacketSummary.totalReferences
  };
}

function InterventionReadinessPanel({
  australiaStatuses,
  productSignals,
  readiness,
  safetyAlerts
}: {
  australiaStatuses: AustraliaRegulatoryStatus[];
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
          value={hasClaims ? `${readiness.sourceWorkClaims}/${readiness.totalClaims}` : "0/0"}
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
          }, ${productSignals.length} product signal${productSignals.length === 1 ? "" : "s"}`}
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
                  href={`#claim-${claim.id}`}
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
                {readiness.incompleteSourcePackets} source packet(s) still need linking or
                extraction.
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
              <li>Product context exists, but exact AUST/ARTG status remains product-specific.</li>
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
      className="scroll-mt-4 rounded-lg border border-line bg-white p-3"
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

function ClaimSourcePacketStatus({ packet }: { packet: ClaimSourcePacket }) {
  const progress = sourcePacketProgressText(packet);
  const needsSourceWork = packet.completeness.status !== "complete";

  return (
    <section className="mt-3 rounded-md border border-line bg-mist px-3 py-2 text-xs leading-5 text-slate-700">
      <p>
        <span className="font-semibold text-slate-900">Source extraction:</span> {progress}
      </p>
      {needsSourceWork ? (
        <p className="mt-1">
          <span className="font-semibold text-slate-900">Next source step:</span>{" "}
          {packet.completeness.nextStep}
        </p>
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
