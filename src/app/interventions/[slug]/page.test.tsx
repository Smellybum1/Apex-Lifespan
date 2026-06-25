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
    expect(html).toContain("Evidence scores by outcome");
    expect(html).toContain("Claim cards");
    expect(html).toContain("Source packets");
    expect(html).toContain("Safety alerts");
    expect(html).toContain("Trial watcher");
    expect(html).toContain("AU/TGA and product context");
    expect(html).toContain("Score history");
    expect(html).toContain("What would change the score");
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
