import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EvidenceDashboard } from "@/components/evidence-dashboard";
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

describe("EvidenceDashboard", () => {
  it("renders cautious empty states when no local claims are available", () => {
    const html = renderToStaticMarkup(<EvidenceDashboard data={emptyDashboardData()} />);

    expect(html).toContain("No local scored claims match the current filters.");
    expect(html).toContain("No active evidence card is selected");
    expect(html).toContain("Sources and Review Queue");
  });
});
