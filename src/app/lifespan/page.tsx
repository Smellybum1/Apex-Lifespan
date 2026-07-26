import type { Metadata } from "next";

import { DashboardDataUnavailable } from "@/app/dashboard-data-unavailable";
import { LifespanResearchPage } from "@/components/lifespan-research-page";
import { getEvidenceDashboardData } from "@/lib/data/dashboard";
import { selectLifespanEvidence } from "@/lib/lifespan-evidence";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lifespan Research | Apex Lifespan",
  description:
    "Source-traceable human, biomarker, preclinical, experimental, and trial evidence in lifespan and healthspan research."
};

export default async function LifespanPage() {
  try {
    const data = selectLifespanEvidence(await getEvidenceDashboardData());
    return <LifespanResearchPage data={data} />;
  } catch {
    return <DashboardDataUnavailable />;
  }
}
