import { EvidenceDashboard } from "@/components/evidence-dashboard";
import { getEvidenceDashboardData } from "@/lib/data/dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getEvidenceDashboardData();

  return <EvidenceDashboard data={data} />;
}
