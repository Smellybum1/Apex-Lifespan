import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/lib/data/dashboard", () => ({
  getEvidenceDashboardData: vi.fn()
}));

import InterventionDetailPage from "@/app/interventions/[slug]/page";
import { getEvidenceDashboardData } from "@/lib/data/dashboard";

const getEvidenceDashboardDataMock = vi.mocked(getEvidenceDashboardData);

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

describe("intervention detail page", () => {
  beforeEach(() => {
    getEvidenceDashboardDataMock.mockReset();
  });

  it("renders a citation-linked public detail view for one intervention", async () => {
    getEvidenceDashboardDataMock.mockResolvedValue(seedDashboardData());

    const html = renderToStaticMarkup(
      await InterventionDetailPage({ params: Promise.resolve({ slug: "creatine-monohydrate" }) })
    );

    expect(html).toContain("Creatine monohydrate");
    expect(html).toContain("Local page scope:");
    expect(html).toContain("2 scoped claims, 2 source-packet views");
    expect(html).toContain("Counts show captured local data only");
    expect(html).toContain("not medical advice, regulatory clearance, or product recommendations");
    expect(html).toContain("Intervention Summary");
    expect(html).toContain("Evidence Map Row");
    expect(html).toContain("Evidence Cards");
    expect(html).toContain("These cards carry dashboard evidence-card detail");
    expect(html).toContain("Source Packets");
    expect(html).toContain("Source coverage for this intervention");
    expect(html).toContain("2/2 complete");
    expect(html).toContain("Every scoped claim on this page has a complete local source packet.");
    expect(html).toContain(
      "Human review, AU/TGA product status, safety clearance, and medical advice remain separate."
    );
    expect(html).toContain("Safety Alerts");
    expect(html).toContain("Trial Watcher Records");
    expect(html).toContain("AU/TGA And Product Context");
    expect(html).toContain("Regional safety and AU/TGA scope for this intervention");
    expect(html).toContain("Captured local safety and AU/TGA records only");
    expect(html).toContain("AU/TGA records only");
    expect(html).toContain("Australia/TGA primary lens");
    expect(html).toContain("Score History");
    expect(html).toContain("Provenance");
    expect(html).toContain("What Would Change The Score");
    expect(html).toContain("Component score breakdown");
    expect(html).toContain("Draft composite");
    expect(html).toContain("AI Draft Classification: Core Evidence-Based");
    expect(html).toContain("Pending human review");
    expect(html).toContain("AI-reviewed packets remain draft review aids.");
    expect(html).toContain("Higher is better for every component shown here.");
    expect(html).toContain('href="/methodology#score-components"');
    expect(html).toContain("Directness");
    expect(html).toContain("Rigor");
    expect(html).toContain("Impact");
    expect(html).toContain("Safety");
    expect(html).toContain("Measurability");
    expect(html).toContain("Low regulatory risk");
    expect(html).toContain("Low hype risk");
    expect(html).toContain('role="meter"');
    expect(html).toContain("What this does not prove");
    expect(html).toContain("review/position-stand source extracted");
    expect(html).toContain("This does not mean no human trials exist");
    expect(html).toContain('tabindex="0"');
    expect(html).toContain("position stand");
    expect(html).toContain("PMID: 28615996");
    expect(html).toContain("https://pubmed.ncbi.nlm.nih.gov/28615996/");
    expect(html).toContain("not clinical recommendations");
  });

  it("shows local source-packet gaps on intervention detail pages", async () => {
    getEvidenceDashboardDataMock.mockResolvedValue(seedDashboardData());

    const html = renderToStaticMarkup(
      await InterventionDetailPage({ params: Promise.resolve({ slug: "magnesium-glycinate" }) })
    );

    expect(html).toContain("Magnesium glycinate");
    expect(html).toContain("Source coverage for this intervention");
    expect(html).toContain("Local source-packet coverage only");
    expect(html).toContain("3/3 complete");
    expect(html).toContain('id="source-packet-magnesium-glycinate-sleep"');
    expect(html).toContain("Every scoped claim on this page has a complete local source packet.");
    expect(html).toContain(
      "Human review, AU/TGA product status, safety clearance, and medical advice remain separate."
    );
    expect(html).toContain("Sleep quality or sleep-continuity support.");
    expect(html).toContain("Reasonable N-of-1 Experiment");
    expect(html).toContain("PMID: 40918053");
    expect(html).toContain("PMID: 33865376");
    expect(html).toContain("General safety, tolerability, interaction, and product-quality profile.");
    expect(html).toContain("Requires Clinician Oversight");
    expect(html).toContain("NIH Office of Dietary Supplements");
    expect(html).not.toContain("Safety/adverse effects: No curated sources");
  });

  it("renders the dietary nitrate / beetroot juice coverage packet", async () => {
    getEvidenceDashboardDataMock.mockResolvedValue(seedDashboardData());

    const html = renderToStaticMarkup(
      await InterventionDetailPage({
        params: Promise.resolve({ slug: "dietary-nitrate-beetroot" })
      })
    );

    expect(html).toContain("Dietary nitrate / beetroot juice");
    expect(html).toContain("3 scoped claims, 3 source-packet views");
    expect(html).toContain("Food/beverage");
    expect(html).toContain("Short-term systolic blood-pressure support");
    expect(html).toContain("Exercise-economy or endurance-performance support");
    expect(html).toContain("General safety, tolerability, product-quality, and nitrate-context profile.");
    expect(html).toContain("AI Draft Classification: Conditional / Biomarker-Gated");
    expect(html).toContain("Useful for Specific Use Case");
    expect(html).toContain("Requires Clinician Oversight");
    expect(html).toContain("Every scoped claim on this page has a complete local source packet.");
    expect(html).toContain("Nitrate Derived From Beetroot Juice Lowers Blood Pressure");
    expect(html).toContain("The Effect of Dietary Nitrate Supplementation on Endurance Exercise Performance");
    expect(html).toContain("Australian Institute of Sport");
    expect(html).toContain("AU/TGA product-level status unverified");
    expect(html).toContain("Does not provide dosing or individualized medical advice.");
  });

  it("renders the sodium bicarbonate coverage packet", async () => {
    getEvidenceDashboardDataMock.mockResolvedValue(seedDashboardData());

    const html = renderToStaticMarkup(
      await InterventionDetailPage({ params: Promise.resolve({ slug: "sodium-bicarbonate" }) })
    );

    expect(html).toContain("Sodium bicarbonate");
    expect(html).toContain("2 scoped claims, 2 source-packet views");
    expect(html).toContain("Ergogenic/performance supplement");
    expect(html).toContain("High-intensity exercise buffering support");
    expect(html).toContain("General safety, sodium-load, gastrointestinal, and product-quality profile.");
    expect(html).toContain("Useful for Specific Use Case");
    expect(html).toContain("Requires Clinician Oversight");
    expect(html).toContain("Every scoped claim on this page has a complete local source packet.");
    expect(html).toContain("International Society of Sports Nutrition position stand: sodium bicarbonate");
    expect(html).toContain("Dietary Supplements for Exercise and Athletic Performance");
    expect(html).toContain("Australian Institute of Sport");
    expect(html).toContain("AU/TGA product-level status unverified");
    expect(html).toContain("Does not provide dosing, individualized sports nutrition, or medical advice.");
  });

  it("renders the vitamin C coverage packet", async () => {
    getEvidenceDashboardDataMock.mockResolvedValue(seedDashboardData());

    const html = renderToStaticMarkup(
      await InterventionDetailPage({ params: Promise.resolve({ slug: "vitamin-c" }) })
    );

    expect(html).toContain("Vitamin C");
    expect(html).toContain("2 scoped claims, 2 source-packet views");
    expect(html).toContain("Vitamin/mineral");
    expect(html).toContain("Common-cold duration or severity support");
    expect(html).toContain("General safety, high-dose, kidney-stone, iron, and medication-interaction profile.");
    expect(html).toContain("Conditional / Biomarker-Gated");
    expect(html).toContain("Requires Clinician Oversight");
    expect(html).toContain("Every scoped claim on this page has a complete local source packet.");
    expect(html).toContain("Vitamin C for preventing and treating the common cold");
    expect(html).toContain("Vitamin C reduces the severity of common colds");
    expect(html).toContain("NIH Office of Dietary Supplements");
    expect(html).toContain("AU/TGA product-level status unverified");
    expect(html).toContain("Does not provide dosing or individualized medical advice.");
  });

  it("renders the resveratrol coverage packet", async () => {
    getEvidenceDashboardDataMock.mockResolvedValue(seedDashboardData());

    const html = renderToStaticMarkup(
      await InterventionDetailPage({ params: Promise.resolve({ slug: "resveratrol" }) })
    );

    expect(html).toContain("Resveratrol");
    expect(html).toContain("3 scoped claims, 3 source-packet views");
    expect(html).toContain("Botanical/herbal");
    expect(html).toContain("Glucose control or insulin-resistance support");
    expect(html).toContain("Direct lifespan extension or broad anti-aging effect");
    expect(html).toContain("General safety, liver-enzyme, interaction, bioavailability");
    expect(html).toContain("Conditional / Biomarker-Gated");
    expect(html).toContain("Insufficient Evidence");
    expect(html).toContain("Requires Clinician Oversight");
    expect(html).toContain("Every scoped claim on this page has a complete local source packet.");
    expect(html).toContain("Resveratrol supplementation and type 2 diabetes");
    expect(html).toContain("Resveratrol levels and all-cause mortality");
    expect(html).toContain("LiverTox");
    expect(html).toContain("AU/TGA product-level status unverified");
    expect(html).toContain("Does not provide dosing or individualized medical advice.");
  });

  it("renders the quercetin coverage packet", async () => {
    getEvidenceDashboardDataMock.mockResolvedValue(seedDashboardData());

    const html = renderToStaticMarkup(
      await InterventionDetailPage({ params: Promise.resolve({ slug: "quercetin" }) })
    );

    expect(html).toContain("Quercetin");
    expect(html).toContain("2 scoped claims, 2 source-packet views");
    expect(html).toContain("Botanical/herbal");
    expect(html).toContain("Small blood-pressure support in reviewed adult randomized trial evidence.");
    expect(html).toContain("General safety, liver, kidney-risk, interaction, and product-quality profile.");
    expect(html).toContain("Conditional / Biomarker-Gated");
    expect(html).toContain("Requires Clinician Oversight");
    expect(html).toContain("Every scoped claim on this page has a complete local source packet.");
    expect(html).toContain("Effect of quercetin supplementation on plasma lipid profiles");
    expect(html).toContain("Effects of Quercetin on Blood Pressure");
    expect(html).toContain("LiverTox");
    expect(html).toContain("Safety Aspects of the Use of Quercetin as a Dietary Supplement");
    expect(html).toContain("AU/TGA product-level status unverified");
    expect(html).toContain("Does not provide dosing or individualized medical advice.");
  });

  it("renders the fisetin coverage packet", async () => {
    getEvidenceDashboardDataMock.mockResolvedValue(seedDashboardData());

    const html = renderToStaticMarkup(
      await InterventionDetailPage({ params: Promise.resolve({ slug: "fisetin" }) })
    );

    expect(html).toContain("Fisetin");
    expect(html).toContain("2 scoped claims, 2 source-packet views");
    expect(html).toContain("Botanical/herbal");
    expect(html).toContain("Senolytic, healthspan, or lifespan extension in humans.");
    expect(html).toContain("Human safety, pharmacokinetic, interaction, and product-quality profile.");
    expect(html).toContain("Speculative Watchlist");
    expect(html).toContain("Requires Clinician Oversight");
    expect(html).toContain("Every scoped claim on this page has a complete local source packet.");
    expect(html).toContain("Fisetin is a senotherapeutic that extends health and lifespan");
    expect(html).toContain("Fisetin as a senotherapeutic agent");
    expect(html).toContain("ClinicalTrials.gov");
    expect(html).toContain("AU/TGA product-level status unverified");
    expect(html).toContain("Does not provide dosing, senolytic protocols, or individualized medical advice.");
  });

  it("renders intervention safety-domain coverage without treating gaps as clearance", async () => {
    getEvidenceDashboardDataMock.mockResolvedValue(seedDashboardData());

    const html = renderToStaticMarkup(
      await InterventionDetailPage({ params: Promise.resolve({ slug: "bpc-157" }) })
    );

    expect(html).toContain("BPC-157");
    expect(html).toContain("Peptide and therapeutic-intervention cards emphasize regulatory status");
    expect(html).toContain("must not provide sourcing");
    expect(html).toContain("Safety-domain coverage for this intervention");
    expect(html).toContain("Reviewed local alerts by safety domain");
    expect(html).toContain("Regulatory access");
    expect(html).toContain("Reviewed alerts captured");
    expect(html).toContain("2 reviewed alerts across Australia, United States.");
    expect(html).toContain("Compounding restriction, Unapproved therapeutic good");
    expect(html).toContain("No reviewed local alert captured for this domain on this intervention.");
    expect(html).toContain("TGA - Australia - 2026-05-07");
    expect(html).toContain("FDA - United States - 2023-09-29");
    expect(html).toContain("Clinician review recommended");
    expect(html).toContain(
      "Check current trial registries before treating this as no active or relevant trials"
    );
    expect(html).toContain(
      "This does not imply product authorization, product quality, or a product recommendation"
    );
    expect(html).toContain("Regional safety and AU/TGA scope for this intervention");
    expect(html).toContain("Safety alerts and AU/TGA records");
    expect(html).toContain("Safety alerts only");
    expect(html).toContain("1: Unapproved therapeutic good");
    expect(html).toContain("1: Compounding restriction");
    expect(html).toContain("1: Unapproved");
  });

  it("renders the creatine strength meta-analysis on the public detail page", async () => {
    getEvidenceDashboardDataMock.mockResolvedValue(seedDashboardData());

    const html = renderToStaticMarkup(
      await InterventionDetailPage({ params: Promise.resolve({ slug: "creatine-monohydrate" }) })
    );

    expect(html).toContain("PMID: 42141930");
    expect(html).toContain("Creatine monohydrate for lean mass, strength, and bone density");
    expect(html).toContain("https://pubmed.ncbi.nlm.nih.gov/42141930/");
    expect(html).toContain("linked references");
  });

  it("renders the ashwagandha safety systematic review on the public detail page", async () => {
    getEvidenceDashboardDataMock.mockResolvedValue(seedDashboardData());

    const html = renderToStaticMarkup(
      await InterventionDetailPage({ params: Promise.resolve({ slug: "ashwagandha" }) })
    );

    expect(html).toContain("Ashwagandha");
    expect(html).toContain("Safety/adverse effects");
    expect(html).toContain("PMID: 42198398");
    expect(html).toContain("Back to the Roots: Safety and Tolerability");
    expect(html).toContain("https://pubmed.ncbi.nlm.nih.gov/42198398/");
    expect(html).toContain("Source coverage for this intervention");
  });

  it("normalizes aliased safety alert regions on intervention detail alerts", async () => {
    getEvidenceDashboardDataMock.mockResolvedValue({
      ...seedDashboardData(),
      safetyAlerts: [
        {
          alertType: "Mislabeling",
          date: "2026-06-13",
          id: "detail-region-alias",
          interventionId: "creatine",
          lastChecked: "2026-06-13",
          region: "US",
          severity: "Moderate",
          source: "Reviewed source",
          summary: "Synthetic reviewed detail-page region-alias fixture.",
          url: "https://example.test/detail-region-alias"
        }
      ]
    });

    const html = renderToStaticMarkup(
      await InterventionDetailPage({ params: Promise.resolve({ slug: "creatine-monohydrate" }) })
    );

    expect(html).toContain("Safety-domain coverage for this intervention");
    expect(html).toContain("1 reviewed alert across United States.");
    expect(html).toContain("Reviewed source - United States (US) - 2026-06-13");
    expect(html).toContain("Mislabeling");
    expect(html).toContain("Product quality");
  });

  it("renders normalized score snapshots in the score history table", async () => {
    const data = seedDashboardData();
    const claim = claims.find((item) => item.id === "creatine-strength");

    expect(claim).toBeDefined();

    getEvidenceDashboardDataMock.mockResolvedValue({
      ...data,
      scoreSnapshots: [
        {
          claimId: "creatine-strength",
          compositeScore: 9.9,
          computedAt: "2026-06-14",
          finalLabel: "Core Evidence-Based",
          id: "score-snapshot-creatine-strength-review",
          rationale: "Human-reviewed score snapshot fixture.",
          reviewStatus: "Human reviewed",
          scoreVersion: "v1",
          scores: claim!.scores
        }
      ]
    });

    const html = renderToStaticMarkup(
      await InterventionDetailPage({ params: Promise.resolve({ slug: "creatine-monohydrate" }) })
    );

    expect(html).toContain("Score History");
    expect(html).toContain("9.9");
    expect(html).toContain("2026-06-14");
    expect(html).toContain("Current score snapshot");
    expect(html).toContain("Human-reviewed score snapshot fixture.");
    expect(html).toContain("Snapshot: score-snapshot-creatine-strength-review");
  });

  it("prefers normalized score history rows in the score history table", async () => {
    const data = seedDashboardData();

    getEvidenceDashboardDataMock.mockResolvedValue({
      ...data,
      scoreHistory: [
        {
          claimId: "creatine-strength",
          createdAt: "2026-06-15",
          id: "score-history-creatine-strength-review",
          newCompositeScore: 8.8,
          newLabel: "Core Evidence-Based",
          oldCompositeScore: 8.1,
          oldLabel: "Useful for Specific Use Case",
          rationale: "Human-reviewed source packet changed the score.",
          reason: "Manual review",
          referenceId: "issn-creatine-2017"
        }
      ]
    });

    const html = renderToStaticMarkup(
      await InterventionDetailPage({ params: Promise.resolve({ slug: "creatine-monohydrate" }) })
    );

    expect(html).toContain("Score History");
    expect(html).toContain("8.8");
    expect(html).toContain("8.1");
    expect(html).toContain("Manual review");
    expect(html).toContain("Human-reviewed source packet changed the score.");
    expect(html).toContain("Linked reference:");
    expect(html).toContain("PubMed - PMID: 28615996");
    expect(html).toContain("2026-06-15");
  });
});
