import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EvidenceDashboardData } from "@/lib/types";

vi.mock("@/components/evidence-dashboard", () => ({
  EvidenceDashboard: ({ data }: { data: EvidenceDashboardData }) => (
    <main>Dashboard rendered from {data.dataSource}</main>
  )
}));

vi.mock("@/lib/data/dashboard", () => ({
  getEvidenceDashboardData: vi.fn()
}));

import { DashboardDataUnavailable } from "@/app/dashboard-data-unavailable";
import Home from "@/app/page";
import { getEvidenceDashboardData } from "@/lib/data/dashboard";

const getEvidenceDashboardDataMock = vi.mocked(getEvidenceDashboardData);

function minimalDashboardData(): EvidenceDashboardData {
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

describe("Home page data boundary", () => {
  beforeEach(() => {
    getEvidenceDashboardDataMock.mockReset();
  });

  it("renders the dashboard when evidence data loads", async () => {
    getEvidenceDashboardDataMock.mockResolvedValue(minimalDashboardData());

    const html = renderToStaticMarkup(await Home());

    expect(html).toContain("Dashboard rendered from database");
  });

  it("renders a sanitized unavailable state when strict database reads fail", async () => {
    getEvidenceDashboardDataMock.mockRejectedValue(
      new Error("postgresql://user:secret@db.example.invalid/apex query failed")
    );

    const html = renderToStaticMarkup(await Home());

    expect(html).toContain("Evidence data temporarily unavailable");
    expect(html).toContain("Database-backed evidence unavailable");
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/terms"');
    expect(html).not.toContain("postgresql://");
    expect(html).not.toContain("secret");
    expect(html).not.toContain("query failed");
    expect(html).not.toContain("Seed fallback");
  });

  it("keeps the unavailable state renderable without dashboard data", () => {
    const html = renderToStaticMarkup(<DashboardDataUnavailable />);

    expect(html).toContain("Apex Lifespan");
    expect(html).toContain("No seed fallback is shown while database mode is required.");
  });
});
