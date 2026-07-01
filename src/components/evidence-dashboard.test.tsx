import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  buildCodexReviewPacket,
  buildSourcePacketGapRows,
  EvidenceDashboard
} from "@/components/evidence-dashboard";
import { buildScoreReadinessRows } from "@/lib/score-readiness";
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

    expect(html).toContain("No evidence-map cells match the current filters and map mode.");
    expect(html).toContain("Claim Details");
    expect(html).toContain("Catalog Trust");
  });

  it("renders database catalog banner when dashboard data comes from local DB", () => {
    const data: EvidenceDashboardData = {
      ...seedDashboardData(),
      dataSource: "database"
    };
    const html = renderToStaticMarkup(<EvidenceDashboard data={data} />);

    expect(html).toContain("Local database catalog");
    expect(html).toContain("local catalog (6 interventions, 9 scoped claims)");
    expect(html).toContain("Database-backed");
  });

  it("renders the seed-backed dashboard with evidence map and section tabs", () => {
    const data = seedDashboardData();
    const html = renderToStaticMarkup(<EvidenceDashboard data={data} />);

    expect(html).toContain("Apex Lifespan");
    expect(html).toContain("9 scoped claims");
    expect(html).toContain("Evidence Map");
    expect(html).toContain("Claim Details");
    expect(html).toContain("Catalog Trust");
    expect(html).toContain("Prototype / seed dataset");
    expect(html).toContain("Current scores are based on a small");
    expect(html).toContain("curated seed dataset and live source-search previews");
    expect(html).toContain("Scores are review aids, not");
    expect(html).toContain("medical advice");
    expect(html).toContain("<table");
    expect(html).toContain("Evidence map. Rows are interventions and columns are outcomes.");
    expect(html).toContain("About Creatine monohydrate");
    expect(html).toContain("About Muscle/strength column");
    expect(html).toContain("Strength, power, lean-mass, or functional performance support.");
    expect(html).toContain("Sort supplements by Muscle/strength, highest score first");
    expect(html).toContain(
      "Click an outcome column to sort rows high to low, then low to high, then alphabetical again."
    );
    expect(html).toContain("Creatine monohydrate, Muscle/strength: Draft composite 8.4 out of 10");
    expect(html).toContain("AI Draft Classification Core Evidence-Based");
    expect(html).toContain("review status Pending human review");
    expect(html).toContain(
      "BPC-157, Muscle/strength: not yet assessed; this does not mean no evidence exists."
    );
    expect(html).toContain("—</strong> = not yet assessed");
    expect(html).toContain("N/A</strong> = not applicable");
    expect(html).toContain("No evidence found</strong> = searched and no credible evidence found");
    expect(html).toContain("Unassessed cells do not imply absence of evidence.");
    expect(html).toContain("review status Pending human review");
    expect(html).toContain('href="/interventions/creatine-monohydrate"');
    expect(html).toContain('id="evidence-map-label"');
    expect(html).toContain('id="evidence-map-outcome"');
    expect(html).toContain("All labels");
    expect(html).toContain("All outcomes");
    expect(html).not.toContain("Local catalog trust");
    expect(html).not.toContain("Source packet gap worklist");
    expect(html).not.toContain("Selected claim");
    expect(html).toContain("Showing 6 interventions · 9 scoped claims");
    expect(html).not.toContain("Dashboard detail sections");
    expect(html).not.toContain("Active card source packet");
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

    expect(html).toContain("Pending human review");
    expect(sourcePacketSummary.completeClaims).toBeGreaterThan(0);
  });

  it("marks scored-looking map cells as source work when linked extraction is incomplete", () => {
    const data = seedDashboardData();
    const targetClaim = data.claims.find((claim) => claim.keyReferenceIds.length > 0);

    expect(targetClaim).toBeDefined();

    const html = renderToStaticMarkup(
      <EvidenceDashboard
        data={{
          ...data,
          studies: data.studies.filter(
            (study) => !targetClaim?.keyReferenceIds.includes(study.referenceId)
          )
        }}
      />
    );

    expect(html).toContain("Source / Work");
    expect(html).toContain("Source work");
    expect(html).toContain("Source-work classification");
    expect(html).toContain("stored score needs source extraction");
    expect(html).toContain(
      "stored score, but linked references still need extraction or source-packet repair"
    );
  });

  it("ranks source-packet gaps by actionable extraction work", () => {
    const data = seedDashboardData();
    const targetClaim = data.claims.find((claim) => claim.keyReferenceIds.length > 0);

    expect(targetClaim).toBeDefined();

    const gapRows = buildSourcePacketGapRows({
      ...data,
      studies: data.studies.filter(
        (study) => !targetClaim?.keyReferenceIds.includes(study.referenceId)
      )
    });
    const targetRow = gapRows.find((row) => row.claim.id === targetClaim?.id);

    expect(targetRow).toBeDefined();
    expect(targetRow?.packet.completeness.status).toBe("extraction_pending");
    expect(targetRow?.reasons.join(" ")).toContain("linked ref(s) need extraction");
    expect(targetRow?.reasons.join(" ")).toContain("stored composite hidden until source-blocked");
    expect(targetRow?.intervention?.slug).toBeTruthy();
  });

  it("separates score-ready claims from starter-looking public scores", () => {
    const data = seedDashboardData();
    const sourceBackedClaim = data.claims.find((claim) => claim.keyReferenceIds.length > 0);

    expect(sourceBackedClaim).toBeDefined();

    const scoreReadyClaim = {
      ...sourceBackedClaim!,
      id: "score-ready-test",
      evidenceGrade: "Insufficient until source packets are reviewed."
    };
    const starterScoreClaim = {
      ...sourceBackedClaim!,
      id: "starter-score-test",
      evidenceGrade: "Starter score review fixture",
      finalLabel: "Insufficient Evidence" as const,
      scores: {
        evidenceDirectness: 3,
        evidenceRigor: 3,
        effectSize: 3,
        safety: 4,
        regulatoryRisk: 7,
        productQuality: 4,
        hypePenalty: 7,
        measurability: 3
      }
    };
    const rows = buildScoreReadinessRows({
      ...data,
      claims: [...data.claims, scoreReadyClaim, starterScoreClaim],
      claimScoreSnapshots: []
    });
    const scoreReadyRow = rows.find((row) => row.claim.id === scoreReadyClaim.id);
    const starterScoreRow = rows.find((row) => row.claim.id === starterScoreClaim.id);

    expect(scoreReadyRow?.state).toBe("ready_to_score");
    expect(scoreReadyRow?.reasons).toContain("source packet complete");
    expect(starterScoreRow?.state).toBe("default_score_review");
    expect(starterScoreRow?.currentScore).toBe(3.1);
    expect(starterScoreRow?.reasons.join(" ")).toContain("starter-score pattern");

    const html = renderToStaticMarkup(
      <EvidenceDashboard
        data={{
          ...data,
          claims: [scoreReadyClaim],
          claimScoreSnapshots: []
        }}
      />
    );

    expect(html).toContain("Ready-to-score classification");
    expect(html).toContain("Complete source packet awaiting score assignment");
    expect(html).toContain("The stored placeholder score is hidden until a claim-specific score");
    expect(html).toContain("Ready to score");
    expect(html).not.toContain("Draft composite 8.4");

    const starterHtml = renderToStaticMarkup(
      <EvidenceDashboard
        data={{
          ...data,
          claims: [starterScoreClaim],
          claimScoreSnapshots: []
        }}
      />
    );

    expect(starterHtml).toContain("Score / Review");
    expect(starterHtml).toContain("Scoring-review classification");
    expect(starterHtml).toContain("starter-looking stored score");
    expect(starterHtml).toContain("1 score review");
    expect(starterHtml).not.toContain("Draft composite 3.1 out of 10");
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
    expect(html).toContain("token stays in tab");
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
    expect(packet).toContain("Priority scoring work:");
    expect(packet).toContain("Priority source-packet work:");
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
