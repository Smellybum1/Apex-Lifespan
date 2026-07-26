import { EvidenceDashboard } from "@/components/evidence-dashboard";
import { DashboardDataUnavailable } from "@/app/dashboard-data-unavailable";
import { PublicSiteNav } from "@/components/public-site-nav";
import { SupplementIndex } from "@/components/supplement-index";
import { getEvidenceDashboardOverviewData } from "@/lib/data/dashboard";
import { buildSupplementIndex } from "@/lib/evidence-brief";
import { buildClaimSourcePacketFromSnapshot, type ClaimSourcePacket } from "@/lib/source-packet";

export const dynamic = "force-dynamic";

export default async function Home() {
  let data: Awaited<ReturnType<typeof getEvidenceDashboardOverviewData>>;

  try {
    data = await getEvidenceDashboardOverviewData();
  } catch {
    return <DashboardDataUnavailable />;
  }

  // The overview payload omits reference and study rows for weight, so packets
  // come from the normalized snapshots instead.
  const snapshotsByClaimId = new Map(
    (data.normalizedSourcePackets ?? []).map((packet) => [packet.claimId, packet])
  );
  const packets = new Map<string, ClaimSourcePacket>(
    data.claims.map((claim) => [
      claim.id,
      buildClaimSourcePacketFromSnapshot({ claim, packet: snapshotsByClaimId.get(claim.id) })
    ])
  );
  const index = buildSupplementIndex({
    claims: data.claims,
    interventions: data.interventions,
    packets,
    safetyAlerts: data.safetyAlerts
  });

  return (
    <>
      <div className="px-4 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1500px]">
          <PublicSiteNav activeSection="supplements" showBrand={false} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <SupplementIndex entries={index} />
      </div>

      <details className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6">
        <summary className="cursor-pointer rounded-lg border border-line bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-panel transition hover:border-signal hover:text-signal">
          Evidence map, filters and source tools
        </summary>
        <p className="px-1 pt-3 text-sm leading-relaxed text-slate-500">
          The full working view: outcome-by-outcome rankings, the coverage matrix, score index,
          source packets and review queues.
        </p>
        <EvidenceDashboard data={data} />
      </details>
    </>
  );
}
