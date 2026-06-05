import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { buildCodexReviewPacket, EvidenceDashboard } from "@/components/evidence-dashboard";
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
    expect(html).toContain("scores rank review priority, not evidence quality");
  });

  it("keeps source-packet extraction separate from human review status", () => {
    const html = renderToStaticMarkup(<EvidenceDashboard data={seedDashboardData()} />);

    expect(html).toContain("Human-reviewed");
    expect(html).toContain("7 drafts awaiting review");
    expect(html).toContain("Source packets");
    expect(html).toContain("7/7");
    expect(html).toContain("8/8 linked refs extracted");
    expect(html).toContain("Unreviewed AI draft");
    expect(html).toContain("Extraction complete");
  });

  it("renders sanitized seed fallback reasons in the public header", () => {
    const html = renderToStaticMarkup(
      <EvidenceDashboard
        data={{
          ...seedDashboardData(),
          fallbackReason: "Database query failed, using seed data."
        }}
      />
    );

    expect(html).toContain("Seed fallback");
    expect(html).toContain("Database query failed, using seed data.");
  });

  it("renders a Codex packet approval entry point without running operator actions", () => {
    const html = renderToStaticMarkup(<EvidenceDashboard data={seedDashboardData()} />);

    expect(html).toContain("Ask Codex");
    expect(html).not.toContain("Approve and copy");
  });

  it("builds a read-only Codex review packet with source-candidate guardrails", () => {
    const data = seedDashboardData();
    const packet = buildCodexReviewPacket(data);

    expect(packet).toContain("Analyze this Apex Lifespan dashboard state.");
    expect(packet).toContain("Keep source-candidate workflows local, read-only by default");
    expect(packet).toContain("Do not accept/reject candidates");
    expect(packet).toContain("Public routes stay read-only");
    expect(packet).toContain("Use Australia/TGA as the default lens");
    expect(packet).toContain(`- Interventions: ${data.interventions.length}`);
    expect(packet).toContain(`- Claims: ${data.claims.length}`);
    expect(packet).toContain("- Source packets: 7/7 complete");
    expect(packet).toContain("Do not perform writes or make source-candidate decisions");
  });
});
