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
import { summarizeClaimSourcePackets } from "@/lib/source-packet";
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
    const data = seedDashboardData();
    const html = renderToStaticMarkup(<EvidenceDashboard data={data} />);

    expect(html).toContain("Apex Lifespan");
    expect(html).toContain("Prototype / seed dataset");
    expect(html).toContain("Current scores are based on a small");
    expect(html).toContain("curated seed dataset and live source-search previews");
    expect(html).toContain("Scores are review aids, not");
    expect(html).toContain("medical advice");
    expect(html).toContain(
      "Composite = directness + rigor + impact + safety + measurability - hype/regulatory penalty."
    );
    expect(html).toContain("The weighting is partly heuristic");
    expect(html).toContain("Weighted 0-10 review aid");
    expect(html).toContain("Low regulatory risk");
    expect(html).toContain("Regulatory-risk score");
    expect(html).toContain("Product-quality score");
    expect(html).toContain("<table");
    expect(html).toContain("Evidence map. Rows are interventions and columns are outcomes.");
    expect(html).toContain("Creatine monohydrate, Muscle/strength: Draft composite 8.4 out of 10");
    expect(html).toContain("AI Draft Classification Core Evidence-Based");
    expect(html).toContain("review status Pending human review");
    expect(html).toContain("Draft composite");
    expect(html).toContain("AI Draft Classification: Core Evidence-Based");
    expect(html).toContain("Pending human review");
    expect(html).toContain(
      "BPC-157, Muscle/strength: not yet assessed; this does not mean no evidence exists."
    );
    expect(html).toContain("1 source packet");
    expect(html).toContain("1 review/position-stand source extracted");
    expect(html).toContain("1 meta-analysis extracted");
    expect(html).toContain("0 individual human trial rows extracted");
    expect(html).toContain("2 regulatory-only sources");
    expect(html).toContain("—</strong> = not yet assessed");
    expect(html).toContain("N/A</strong> = not applicable");
    expect(html).toContain("No evidence found</strong> = searched and no credible evidence found");
    expect(html).toContain("Unassessed cells do not imply absence of evidence.");
    expect(html).toContain(
      "Human reviewed means a human reviewer checked the source packet against the scoped claim. It does not mean clinical guideline endorsement."
    );
    expect(html).toContain('href="/interventions/creatine-monohydrate"');
    expect(html.match(/What this does not prove/g)?.length ?? 0).toBeGreaterThanOrEqual(
      data.claims.length
    );
    expect(html).toContain("Does not prove direct lifespan extension.");
    expect(html).toContain(
      "Does not prove high-dose vitamin D improves longevity in already-sufficient adults."
    );
    expect(html).toContain("Does not prove safe or effective human use.");
    expect(html).toContain("Creatine monohydrate");
    expect(html).toContain("Muscle/strength");
    expect(html).toContain("Active card source packet");
    expect(html).toContain("Extraction complete");
    expect(html).toContain("Suggested searches");
    expect(html).toContain("scores rank review priority, not evidence quality");
    expect(html).toContain("Demo profile");
    expect(html).toContain("Demo profiles are not");
    expect(html).toContain("verified product recommendations");
    expect(html).toContain("Demo only - not a verified product recommendation");
    expect(html).toContain("Product quality, efficacy evidence, and AU/TGA/ARTG status are separate");
    expect(html).toContain("Certification does not imply medical proof or Australian authorization");
    expect(html).toContain("Product quality 8/10");
    expect(html).toContain("Product-level status unknown");
    expect(html).toContain("AU confidence: Very low");
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/methodology"');
    expect(html).toContain('href="/changelog"');
    expect(html).toContain('href="/feedback"');
    expect(html).toContain('href="/terms"');
    expect(html).not.toContain("Seed example");
  });

  it("keeps source-packet extraction separate from human review status", () => {
    const data = seedDashboardData();
    const sourcePacketSummary = sourcePacketSummaryFor(data);
    const html = renderToStaticMarkup(<EvidenceDashboard data={data} />);

    expect(html).toContain("Human reviewed");
    expect(html).toContain(`${data.claims.length} drafts awaiting review`);
    expect(html).toContain("Source packets");
    expect(html).toContain(
      `${sourcePacketSummary.completeClaims}/${sourcePacketSummary.totalClaims}`
    );
    expect(html).toContain(
      `${sourcePacketSummary.extractedReferences}/${sourcePacketSummary.totalReferences} linked refs extracted`
    );
    expect(html).toContain("Pending human review");
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

    expect(html).toContain("Operator mode");
    expect(html).toContain("local only");
    expect(html).toContain("no shared public token");
    expect(html).not.toContain("Ask Codex");
    expect(html).not.toContain("Approve and copy");
  });

  it("builds a read-only Codex review packet with source-candidate guardrails", () => {
    const data = seedDashboardData();
    const sourcePacketSummary = sourcePacketSummaryFor(data);
    const packet = buildCodexReviewPacket(data);

    expect(packet).toContain("Analyze this Apex Lifespan dashboard state.");
    expect(packet).toContain("Keep source-candidate workflows local, read-only by default");
    expect(packet).toContain("Do not accept/reject candidates");
    expect(packet).toContain("Public routes stay read-only");
    expect(packet).toContain("Use Australia/TGA as the default lens");
    expect(packet).toContain(`- Interventions: ${data.interventions.length}`);
    expect(packet).toContain(`- Claims: ${data.claims.length}`);
    expect(packet).toContain(
      `- Source packets: ${sourcePacketSummary.completeClaims}/${sourcePacketSummary.totalClaims} complete`
    );
    expect(packet).toContain("Claim boundaries (what this does not prove):");
    expect(packet).toContain("Does not prove direct lifespan extension.");
    expect(packet).toContain("Does not prove safe or effective human use.");
    expect(packet).toContain("Do not perform writes or make source-candidate decisions");
  });
});

function sourcePacketSummaryFor(data: EvidenceDashboardData) {
  return summarizeClaimSourcePackets({
    claims: data.claims,
    referencesById: new Map(data.references.map((reference) => [reference.id, reference])),
    studies: data.studies
  });
}
