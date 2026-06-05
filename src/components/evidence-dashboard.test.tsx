import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EvidenceDashboard } from "@/components/evidence-dashboard";
import {
  australiaRegulatoryStatuses,
  claims,
  interventions,
  productSignals,
  references,
  safetyAlerts,
  studies,
  trialWatchItems
} from "@/lib/seed-data";
import type { EvidenceDashboardData } from "@/lib/types";

function emptyDashboardData(): EvidenceDashboardData {
  return {
    australiaRegulatoryStatuses: [],
    claims: [],
    dataSource: "database",
    interventions: [],
    productSignals: [],
    references: [],
    safetyAlerts: [],
    studies: [],
    trialWatchItems: []
  };
}

function seedDashboardData(): EvidenceDashboardData {
  return {
    australiaRegulatoryStatuses,
    claims,
    dataSource: "seed",
    interventions,
    productSignals,
    references,
    safetyAlerts,
    studies,
    trialWatchItems
  };
}

describe("EvidenceDashboard", () => {
  it("renders cautious empty states when no local claims are available", () => {
    const html = renderToStaticMarkup(<EvidenceDashboard data={emptyDashboardData()} />);

    expect(html).toContain("No local scored claims match the current filters.");
    expect(html).toContain("No active evidence card is selected");
    expect(html).toContain("Sources and Review Queue");
  });

  it("renders the seed-backed dashboard with active claim and source-packet cues", () => {
    const html = renderToStaticMarkup(<EvidenceDashboard data={seedDashboardData()} />);

    expect(html).toContain("Apex Lifespan");
    expect(html).toContain("Creatine monohydrate");
    expect(html).toContain("Muscle/strength");
    expect(html).toContain("Active card source packet");
    expect(html).toContain("Extraction complete");
    expect(html).toContain("Suggested searches");
  });
});
