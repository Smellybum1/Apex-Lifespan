import { EvidenceDashboard } from "@/components/evidence-dashboard";
import { DashboardDataUnavailable } from "@/app/dashboard-data-unavailable";
import { getEvidenceDashboardData } from "@/lib/data/dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  let data: Awaited<ReturnType<typeof getEvidenceDashboardData>>;

  try {
    data = await getEvidenceDashboardData();
  } catch {
    return <DashboardDataUnavailable />;
  }

  return <EvidenceDashboard data={data} />;
}
