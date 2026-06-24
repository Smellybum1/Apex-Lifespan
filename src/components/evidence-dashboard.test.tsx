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
    expect(html).toContain(
      "Clear the active filters (search, category, safety, region, severity, or AU/TGA)"
    );
    expect(html).toContain("Evidence Map");
    expect(html).toContain("Sources and Review Queue");
    expect(html).not.toContain("Active evidence card");
  });

  it("renders the seed-backed dashboard with evidence-map links and source-packet cues", () => {
    const data = seedDashboardData();
    const sourcePacketSummary = sourcePacketSummaryFor(data);
    const sourcePacketGapCount =
      sourcePacketSummary.totalClaims - sourcePacketSummary.completeClaims;
    const safetyInterventionCount = new Set(
      data.safetyAlerts.map((alert) => alert.interventionId)
    ).size;
    const australiaRegulatoryInterventionCount = new Set(
      data.australiaRegulatoryStatuses
        .map((status) => status.interventionId)
        .filter(Boolean)
    ).size;
    const html = renderToStaticMarkup(<EvidenceDashboard data={data} />);

    expect(html).toContain("Apex Lifespan");
    expect(html).toContain("Prototype / seed dataset");
    expect(html).toContain("Current scores are based on a small");
    expect(html).toContain("curated seed dataset and live source-search previews");
    expect(html).toContain("Scores are review aids, not");
    expect(html).toContain("medical advice");
    expect(html).toContain("Project Health Snapshot");
    expect(html).toContain("Aggregate local signals only");
    expect(html).toContain(
      "no user identifiers, raw health text, pasted labels, search terms, or operator notes"
    );
    expect(html).toContain(
      `${sourcePacketSummary.completeClaims}/${sourcePacketSummary.totalClaims} source packets`
    );
    expect(html).toContain(
      "All scoped claims have citation-linked source packets; human review remains separate."
    );
    expect(html).toContain("Source packet coverage complete");
    expect(html).toContain("Every scoped claim has a linked source packet");
    expect(html).toContain(`0 of ${sourcePacketGapCount} shown`);
    expect(html).toContain("Open source review");
    expect(html).toContain("Source packet coverage");
    expect(html).toContain("No local source-packet gaps");
    expect(html).toContain("This panel stays read-only and does not mark evidence human reviewed.");
    expect(html).toContain("Source-packet coverage is complete for the current local dataset.");
    expect(html).toContain("human review, AU/TGA product status, safety clearance, and medical advice");
    expect(html).toContain("Safety alerts/AU scope");
    expect(html).toContain(
      "Captured alert rows and AU/TGA rows are local review aids, not clearance."
    );
    expect(html).toContain(
      `${safetyInterventionCount}/${data.interventions.length} alerts, ${australiaRegulatoryInterventionCount}/${data.interventions.length} AU/TGA`
    );
    expect(html).toContain("Registry/watch items are review leads only and do not change scores.");
    expect(html).toContain(`Current local scope: ${data.interventions.length} interventions`);
    expect(html).toContain(
      "Composite = directness + rigor + impact + safety + measurability - hype/regulatory penalty."
    );
    expect(html).toContain("Weighted 0-10 review aid");
    expect(html).toContain("Resveratrol");
    expect(html).toContain("Glucose control or insulin-resistance support");
    expect(html).toContain("Resveratrol levels and all-cause mortality");
    expect(html).toContain("Quercetin");
    expect(html).toContain("Small blood-pressure support in reviewed adult randomized trial evidence");
    expect(html).toContain("Effects of Quercetin on Blood Pressure");
    expect(html).toContain("Fisetin");
    expect(html).toContain("Senolytic, healthspan, or lifespan extension in humans");
    expect(html).toContain("Fisetin is a senotherapeutic that extends health and lifespan");
    expect(html).toContain("Safety domain: All safety domains");
    expect(html).toContain("Safety region: All safety regions");
    expect(html).toContain("Safety severity: All safety severity labels");
    expect(html).toContain("Safety coverage snapshot");
    expect(html).toContain("Reviewed local alerts by domain");
    expect(html).toContain("Reviewed alerts captured");
    expect(html).toContain("Not yet captured in reviewed alerts");
    expect(html).toContain("No reviewed local alert is currently linked to this domain.");
    expect(html).toContain("Regional review scope");
    expect(html).toContain("Captured local safety and AU/TGA records only; absence is not clearance.");
    expect(html).toContain("6 regions");
    expect(html).toContain("Safety alerts and AU/TGA records");
    expect(html).toContain("Safety alerts only");
    expect(html).toContain("Primary AU/TGA review gap");
    expect(html).toContain("Captured records need domain follow-up");
    expect(html).toContain("Configured scope not yet captured");
    expect(html).toContain("Review gaps");
    expect(html).toContain("Clinical safety, Product quality, Sport eligibility");
    expect(html).toContain("Highest safety severity");
    expect(html).toContain("No reviewed safety alert");
    expect(html).toContain("Not yet captured in reviewed local records");
    expect(html).toContain("Regional safety-domain matrix");
    expect(html).toContain("Reviewed safety-domain alerts by configured region");
    expect(html).toContain("empty cells are review gaps, not evidence of safety or clearance");
    expect(html).toContain("6 review scopes");
    expect(html).toContain("1/4 domains captured");
    expect(html).toContain("0/4 domains captured");
    expect(html).toContain("highest severity Clinician review recommended");
    expect(html).toContain(
      "no reviewed local safety or AU/TGA record is currently linked to this review region."
    );
    expect(html).toContain("Canada");
    expect(html).toContain("European Union");
    expect(html).toContain("United Kingdom");
    expect(html).toContain("AU/TGA records");
    expect(html).toContain("Unapproved, Unknown");
    expect(html).toContain("United States");
    expect(html).toContain("Regulatory access");
    expect(html).toContain("2 alerts across Australia, United States");
    expect(html).toContain("Clinical safety");
    expect(html).toContain("2 alerts across General");
    expect(html).toContain("AU/TGA: All AU/TGA contexts");
    expect(html).toContain(
      `Showing ${data.interventions.length} of ${data.interventions.length} supplements and ${data.claims.length} of ${data.claims.length} scoped claims`
    );
    expect(html).toContain("Open any supplement row or cell");
    expect(html).toContain("Open a supplement row or goal cell for claim boundaries");
    expect(html).toContain("local data gaps, not evidence of no effect or safety");
    expect(html).toContain("Reset filters");
    expect(html).toContain("Evidence map filters are already at their default values");
    expect(html).toContain("Dashboard sections");
    expect(html).toContain("Claim Scores");
    expect(html).toContain("AI Confidence");
    expect(html).toContain('aria-controls="dashboard-panel-ai-confidence"');
    expect(html.match(/About this panel/g)?.length ?? 0).toBeGreaterThanOrEqual(8);
    expect(html).toContain(
      "The high-level scan view for comparing supplements across goal categories using confidence-weighted scores."
    );
    expect(html).toContain(
      "A sortable row-by-row score table for comparing scoped claims and their confidence-weighted impact."
    );
    expect(html).toContain(
      "Explains the confidence multiplier behind each claim packet and shows how much impact uncertain evidence should have."
    );
    expect(html).toContain(
      "The risk and regulatory coverage view for reviewed alerts, safety domains, and regional review gaps."
    );
    expect(html).toContain(
      "The source-traceability workspace for selected claims, extracted studies, and live citation or trial leads."
    );
    expect(html).toContain("Safety Center");
    expect(html).toContain("Product Label Analyzer");
    expect(html).toContain("Trial Watcher");
    expect(html).toContain("Sources and Review Queue");
    expect(html).toContain('id="evidence-map-category"');
    expect(html).not.toContain("Evidence map categories");
    expect(html).toContain("All");
    expect(html).toContain("Ergogenic/performance supplement");
    expect(html).toContain("Vitamin/mineral");
    expect(html).toContain("Vitamin C");
    expect(html).toContain("Food/beverage");
    expect(html).toContain("Dietary nitrate / beetroot juice");
    expect(html).toContain("Sodium bicarbonate");
    expect(html).toContain("Peptide/biologic");
    expect(html).toContain("Category: All");
    expect(html).toContain("Prohibited in sport");
    expect(html).toContain("Avoid");
    expect(html).toContain("Unapproved therapeutic good");
    expect(html).toContain("<table");
    expect(html).toContain("Evidence map. Rows are interventions and columns are supplement goals.");
    expect(html).toContain("Select a goal column to sort supplements");
    expect(html).toContain("Sort supplements by Strength score, highest to lowest");
    expect(html).toContain("Sort supplements by Heart score, highest to lowest");
    expect(html).toContain("Sort supplements by Safety score, highest to lowest");
    expect(html).toContain("Lifespan");
    expect(html).toContain("Strength");
    expect(html).toContain("Energy");
    expect(html).toContain("Cognition");
    expect(html).toContain("Sleep");
    expect(html).toContain("Mood");
    expect(html).toContain("Metabolic");
    expect(html).toContain("Heart");
    expect(html).toContain("Gut");
    expect(html).toContain("Immune");
    expect(html).toContain("Joints/Skin");
    expect(html).toContain("Hormones");
    expect(html).toContain("Vision");
    expect(html).toContain("Safety");
    expect(html).toContain(
      "Creatine monohydrate, Strength: confidence-weighted Draft composite 8.0 out of 10 from Muscle/strength, raw composite 8.4, AI confidence 95/100"
    );
    expect(html).toContain("raw 8.4 x 95%");
    expect(html).toContain("Weighted score 0.3/10");
    expect(html).toContain(
      "Confidence-weighted score keeps the raw 0-10 composite visible"
    );
    expect(html).toContain("AI Draft Classification Core Evidence-Based");
    expect(html).toContain("review status Pending human review");
    expect(html).toContain("Open intervention detail");
    expect(html).toContain("Draft composite");
    expect(html).toContain("AI Draft Classification: Core Evidence-Based");
    expect(html).toContain("Pending human review");
    expect(html).toContain(
      "BPC-157, Strength: not yet assessed; this does not mean no evidence exists."
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
    expect(html).toContain('href="/interventions/bpc-157"');
    expect(html).not.toContain("Active evidence card");
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
    expect(html).toContain("Short-term systolic blood-pressure support");
    expect(html).toContain("Exercise-economy or endurance-performance support");
    expect(html).toContain("Nitrate Derived From Beetroot Juice Lowers Blood Pressure");
    expect(html).toContain("High-intensity exercise buffering support");
    expect(html).toContain("International Society of Sports Nutrition position stand: sodium bicarbonate");
    expect(html).toContain("Common-cold duration or severity support");
    expect(html).toContain("Vitamin C for preventing and treating the common cold");
    expect(html).toContain("Selected claim source packet");
    expect(html).toContain("Extraction complete");
    expect(html).toContain("Suggested searches");
    expect(html).toContain("scores rank review priority, not evidence quality");
    expect(html).toContain("Demo profile");
    expect(html).toContain("Demo profiles are not");
    expect(html).toContain("verified product recommendations");
    expect(html).toContain("Parsed ingredients");
    expect(html).toContain("Normalized: creatine monohydrate");
    expect(html).toContain("Captured amount: 5 g");
    expect(html).toContain("Metric normalization: 5,000 mg");
    expect(html).toContain("Normalized: vitamin d");
    expect(html).toContain("Captured amount: 400 IU");
    expect(html).toContain("Metric normalization: 0.01 mg vitamin D");
    expect(html).toContain("Vitamin D IU converted using 1 IU = 0.025 mcg vitamin D.");
    expect(html).toContain("Captured amount: 5,000 IU");
    expect(html).toContain("Metric normalization: 1.5 mg RAE");
    expect(html).toContain(
      "Vitamin A IU converted using 1 IU retinol = 0.3 mcg RAE."
    );
    expect(html).toContain("Metric normalization: 268 mg alpha-tocopherol");
    expect(html).toContain(
      "Vitamin E IU converted using 1 IU natural vitamin E = 0.67 mg alpha-tocopherol."
    );
    expect(html).toContain("Normalized: folate");
    expect(html).toContain("Captured amount: 680 mcg DFE");
    expect(html).toContain("Metric normalization: 0.68 mg DFE");
    expect(html).toContain(
      "Folate DFE preserved as dietary folate equivalents; 1 mcg DFE = 1 mcg food folate or 0.6 mcg folic acid from fortified foods or supplements consumed with food."
    );
    expect(html).toContain("Normalized: niacin");
    expect(html).toContain("Captured amount: 16 mg NE");
    expect(html).toContain("Metric normalization: 16 mg NE");
    expect(html).toContain(
      "Niacin NE preserved as niacin equivalents; 1 NE = 1 mg niacin or 60 mg tryptophan."
    );
    expect(html).toContain("Parsed dose directions");
    expect(html).toContain("No serving-size, per-unit, or daily-use direction cue was parsed");
    expect(html).toContain("Parsed certifications");
    expect(html).toContain("NSF Certified for Sport");
    expect(html).toContain("Signal: Sport-contamination screening");
    expect(html).toContain("exact product certificate");
    expect(html).toContain("Parsed label quality score");
    expect(html).toContain("8/10");
    expect(html).toContain("Signal: Higher quality signal");
    expect(html).toContain("All parsed ingredient rows include captured amounts.");
    expect(html).toContain("Product quality, efficacy evidence, and AU/TGA/ARTG status remain separate.");
    expect(html).toContain("Parsed label verification status");
    expect(html).toContain("Pasted label only - not verified product recommendation");
    expect(html).toContain("standalone, unverified label");
    expect(html).toContain("Captured product identifiers");
    expect(html).toContain("No AUST label identifier was parsed");
    expect(html).toContain("Ingredient evidence mapping");
    expect(html).toContain("Matched intervention: Creatine monohydrate");
    expect(html).toContain("Ingredient-level mapping only");
    expect(html).toContain("does not establish product-level efficacy");
    expect(html).toContain("Mapped claim: Muscle/strength - Core Evidence-Based");
    expect(html).toContain("Dose/form evidence: Creatine monohydrate; dose details must be checked per study.");
    expect(html).toContain("Product amount match: not verified from label parsing alone.");
    expect(html).toContain("Demo only - not a verified product recommendation");
    expect(html).toContain("Product quality, efficacy evidence, and AU/TGA/ARTG status are separate");
    expect(html).toContain("Certification does not imply medical proof or Australian authorization");
    expect(html).toContain("Product AU/TGA: All product AU/TGA contexts");
    expect(html).toContain("Quality signal: All product quality signals");
    expect(html).toContain("Filter product formulation evidence");
    expect(html).toContain("Formulation: All formulation evidence");
    expect(html).toContain("All formulation evidence (3)");
    expect(html).toContain("Fully ingredient-mapped (2)");
    expect(html).toContain("Has unmatched ingredients (1)");
    expect(html).toContain("Product-specific evidence captured (0)");
    expect(html).toContain("No local ingredient match (0)");
    expect(html).toContain("2 fully ingredient-mapped profiles");
    expect(html).toContain("1 profile with unmatched ingredients");
    expect(html).toContain("17 mapped ingredient claims");
    expect(html).toContain("0 product-specific evidence rows");
    expect(html).toContain("Higher quality signal");
    expect(html).toContain("Needs quality review");
    expect(html).toContain("Product quality 8/10");
    expect(html).toContain("1 captured ingredient");
    expect(html).toContain("Creatine monohydrate");
    expect(html).toContain("Formulation evidence map: Ingredient-level evidence only");
    expect(html).toContain("1 matched ingredient");
    expect(html).toContain("0 unmatched ingredients");
    expect(html).toContain("2 ingredient-level claims");
    expect(html).toContain("0 product-specific rows");
    expect(html).toContain("Claims: Muscle/strength - Core Evidence-Based; Mortality/lifespan - Insufficient Evidence");
    expect(html).toContain("No reviewed product-specific efficacy evidence row is captured for this formulation.");
    expect(html).toContain("Matched ingredient claims do not prove product-level efficacy");
    expect(html).toContain("Matched intervention: Resveratrol");
    expect(html).toContain("Matched intervention: Quercetin");
    expect(html).toContain("Matched intervention: Fisetin");
    expect(html).toContain("4 captured ingredients");
    expect(html).toContain("3 matched ingredients");
    expect(html).toContain("1 unmatched ingredient");
    expect(html).toContain("Proprietary blend");
    expect(html).toContain("No local scoped intervention match");
    expect(html).toContain("7 ingredient-level claims");
    expect(html).toContain("Claims: Glucose/insulin/HbA1c - Conditional / Biomarker-Gated; Mortality/lifespan - Insufficient Evidence");
    expect(html).toContain("Claims: Blood pressure - Conditional / Biomarker-Gated; Safety/adverse effects - Requires Clinician Oversight");
    expect(html).toContain("Claims: Mortality/lifespan - Speculative Watchlist; Safety/adverse effects - Requires Clinician Oversight");
    expect(html).toContain("Sleep support blend");
    expect(html).toContain("3 captured ingredients");
    expect(html).toContain("Product quality 5/10");
    expect(html).toContain("Matched intervention: Magnesium glycinate");
    expect(html).toContain("Matched intervention: L-theanine");
    expect(html).toContain("Matched intervention: Melatonin");
    expect(html).toContain("8 ingredient-level claims");
    expect(html).toContain("Claims: Sleep - Reasonable N-of-1 Experiment; Blood pressure - Useful for Specific Use Case");
    expect(html).toContain("Claims: Mood/stress - Reasonable N-of-1 Experiment; Sleep - Speculative Watchlist");
    expect(html).toContain("Claims: Sleep - Useful for Specific Use Case; Safety/adverse effects - Requires Clinician Oversight");
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
    expect(html).toContain(`${data.claims.length} draft classifications awaiting human confirmation`);
    expect(html).toContain("Source packets");
    expect(html).toContain(
      `${sourcePacketSummary.completeClaims}/${sourcePacketSummary.totalClaims}`
    );
    expect(html).toContain(
      `${sourcePacketSummary.extractedReferences}/${sourcePacketSummary.totalReferences} linked refs extracted`
    );
    expect(html).toContain("Pending human review");
    expect(html).toContain("AI-reviewed packets remain draft review aids.");
    expect(html).toContain("Extraction complete");
  });

  it("renders a read-only AI evidence confidence queue with operator packet links", () => {
    const html = renderToStaticMarkup(<EvidenceDashboard data={seedDashboardData()} />);

    expect(html).toContain("AI Evidence Confidence");
    expect(html).toContain("quick iteration");
    expect(html).toContain("AI confidence scored");
    expect(html).toContain("avg AI confidence");
    expect(html).toContain("Low scores are useful signals");
    expect(html).toContain("bpc-157-injury-healing");
    expect(html).toContain("AI confidence 17/100");
    expect(html).toContain("2/2 linked reference(s) have structured extraction");
    expect(html).toContain("Optional ChatGPT Pro cross-check");
    expect(html).toContain("Open Confidence Packet");
    expect(html).toContain('href="/operator?reviewClaim=bpc-157-injury-healing"');
    expect(html).not.toContain("Human review note");
    expect(html).not.toContain('name="reviewNote"');
    expect(html).not.toContain("Approve in Operator Console");
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

  it("renders trial alerts as review-only leads without score promotion", () => {
    const html = renderToStaticMarkup(
      <EvidenceDashboard
        data={{
          ...seedDashboardData(),
          trialAlerts: [
            {
              claimId: "creatine-strength",
              detectedAt: "2026-06-13",
              detail:
                "Posted registry results are an operator review alert. Do not change public scores until outcomes are extracted, citation-linked, and human-reviewed.",
              id: "trial-alert-creatine-results",
              interventionId: "creatine",
              kind: "Results review needed",
              nctId: "NCT123",
              noAutoPromotion: true,
              status: "Open",
              title: "Creatine trial results need review"
            }
          ]
        }}
      />
    );

    expect(html).toContain("Trial alert queue");
    expect(html).toContain("Trial alerts are monitoring and review signals only.");
    expect(html).toContain("No score change");
    expect(html).toContain("Auto-promotion");
    expect(html).toContain("Disabled");
  });

  it("renders aliased safety regions under canonical review scopes", () => {
    const html = renderToStaticMarkup(
      <EvidenceDashboard
        data={{
          ...emptyDashboardData(),
          interventions: [interventions[0]],
          safetyAlerts: [
            {
              alertType: "Mislabeling",
              date: "2026-06-13",
              id: "alias-region-alert",
              interventionId: "creatine",
              lastChecked: "2026-06-13",
              region: "US",
              severity: "Moderate",
              source: "Reviewed source",
              summary: "Synthetic reviewed alias-region fixture.",
              url: "https://example.test/alias-region"
            }
          ]
        }}
      />
    );

    expect(html).toContain("<option>United States</option>");
    expect(html).not.toContain("<option>US</option>");
    expect(html).toContain("Configured US review scope");
    expect(html).toContain("1/4 domains captured");
    expect(html).toContain("Mislabeling");
    expect(html).toContain("Reviewed source - United States (US) - 2026-06-13");
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
