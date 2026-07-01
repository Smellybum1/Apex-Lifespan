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
    expect(html).toContain("Intervention Summary");
    expect(html).toContain("Evidence readiness");
    expect(html).toContain("Scored claims are review aids");
    expect(html).toContain("Strongest current claims");
    expect(html).toContain("Main evidence checks still visible");
    expect(html).toContain("Evidence scores by outcome");
    expect(html).toContain("Claim cards");
    expect(html).toContain("Source packets");
    expect(html).toContain("Safety alerts");
    expect(html).toContain("Trial watcher");
    expect(html).toContain("AU/TGA and product context");
    expect(html).toContain("Score history");
    expect(html).toContain("What would change the score");
    expect(html).toContain("Source extraction:");
    expect(html).toContain("1/1 references extracted");
    expect(html).toContain("Component score breakdown");
    expect(html).toContain("Draft composite");
    expect(html).toContain("AI Draft Classification: Core Evidence-Based");
    expect(html).toContain("Pending human review");
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
    expect(html).toContain("Direct match");
    expect(html).toContain("Registry records are review leads only");
    expect(html).toContain("NCTSEED-CREATINE");
    expect(html).toContain('tabindex="0"');
    expect(html).toContain("position stand");
    expect(html).toContain("PMID: 28615996");
    expect(html).toContain("https://pubmed.ncbi.nlm.nih.gov/28615996/");
    expect(html).toContain("not clinical recommendations");
  });

  it("keeps review-work claim rows from looking like final scored evidence", async () => {
    const data = seedDashboardData();
    const creatine = data.interventions.find((item) => item.slug === "creatine-monohydrate");

    getEvidenceDashboardDataMock.mockResolvedValue({
      ...data,
      claims: data.claims.map((claim) =>
        claim.interventionId === creatine?.id ? { ...claim, evidenceGrade: "Draft lead" } : claim
      )
    });

    const html = renderToStaticMarkup(
      await InterventionDetailPage({ params: Promise.resolve({ slug: "creatine-monohydrate" }) })
    );

    expect(html).toContain("Composite pending");
    expect(html).toContain("No final evidence score assigned yet");
    expect(html).toContain("Review-needed classification");
    expect(html).toContain("Starter component values are hidden here until the claim is scored");
  });

  it("marks scored-looking detail claims as source work when extraction is incomplete", async () => {
    const data = seedDashboardData();
    const creatine = data.interventions.find((item) => item.slug === "creatine-monohydrate");
    const targetClaim = data.claims.find(
      (claim) => claim.interventionId === creatine?.id && claim.keyReferenceIds.length > 0
    );

    expect(targetClaim).toBeDefined();

    getEvidenceDashboardDataMock.mockResolvedValue({
      ...data,
      studies: data.studies.filter(
        (study) => !targetClaim?.keyReferenceIds.includes(study.referenceId)
      )
    });

    const html = renderToStaticMarkup(
      await InterventionDetailPage({ params: Promise.resolve({ slug: "creatine-monohydrate" }) })
    );

    expect(html).toContain("Source work");
    expect(html).toContain("Composite source work");
    expect(html).toContain("Stored score needs source extraction");
    expect(html).toContain("Pending extraction");
    expect(html).toContain("Source-work classification");
    expect(html).toContain("stored score and component values are hidden here");
    expect(html).toContain("linked references still need extraction or source-packet repair");
    expect(html).toContain("Source extraction:");
    expect(html).toContain("0/1 references extracted; 1 pending extraction");
    expect(html).toContain("Next source step:");
    expect(html).toContain(
      "Add structured extraction for the pending references before treating this packet as complete."
    );
  });

  it("marks complete source packets as ready to score without showing placeholder components", async () => {
    const data = seedDashboardData();
    const creatine = data.interventions.find((item) => item.slug === "creatine-monohydrate");
    const targetClaim = data.claims.find(
      (claim) => claim.interventionId === creatine?.id && claim.keyReferenceIds.length > 0
    );

    expect(targetClaim).toBeDefined();

    getEvidenceDashboardDataMock.mockResolvedValue({
      ...data,
      claims: data.claims.map((claim) =>
        claim.id === targetClaim?.id
          ? { ...claim, evidenceGrade: "Insufficient until source packets are reviewed." }
          : claim
      )
    });

    const html = renderToStaticMarkup(
      await InterventionDetailPage({ params: Promise.resolve({ slug: "creatine-monohydrate" }) })
    );

    expect(html).toContain("Composite ready to score");
    expect(html).toContain("Ready to score");
    expect(html).toContain("Complete packet awaiting score assignment");
    expect(html).toContain("Ready-to-score classification");
    expect(html).toContain("Use the complete source packet to assign dimension scores");
    expect(html).toContain("stored placeholder score and component values are hidden here");
  });

  it("renders magnesium sleep coverage with trial registry labels", async () => {
    getEvidenceDashboardDataMock.mockResolvedValue(seedDashboardData());

    const html = renderToStaticMarkup(
      await InterventionDetailPage({ params: Promise.resolve({ slug: "magnesium" }) })
    );

    expect(html).toContain("Magnesium");
    expect(html).toContain("Sleep quality support in adults with low habitual intake or measured insufficiency.");
    expect(html).toContain("AI Draft Classification: Insufficient Evidence");
    expect(html).toContain("Does not prove insomnia treatment for all adults.");
    expect(html).toContain("Trial watcher");
    expect(html).toContain("NCTSEED-MAGSLEEP");
    expect(html).toContain("Direct match");
    expect(html).toContain("Results posted");
    expect(html).toContain("Pittsburgh Sleep Quality Index");
    expect(html).toContain("review/position-stand source extracted");
    expect(html).toContain("Magnesium health professional fact sheet");
    expect(html).toContain("https://ods.od.nih.gov/factsheets/Magnesium-HealthProfessional/");
  });
});
