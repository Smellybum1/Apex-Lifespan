import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EvidenceDashboardData } from "@/lib/types";

vi.mock("@/lib/data/dashboard", () => ({
  getEvidenceDashboardData: vi.fn()
}));

import LifespanPage from "@/app/lifespan/page";
import { getEvidenceDashboardData } from "@/lib/data/dashboard";

const getEvidenceDashboardDataMock = vi.mocked(getEvidenceDashboardData);

function lifespanFixture(): EvidenceDashboardData {
  return {
    dataSource: "database",
    interventions: [
      {
        id: "example",
        name: "Example intervention",
        slug: "example-intervention",
        synonyms: [],
        category: "Drug/geroprotector watchlist",
        commonForms: [],
        regulatoryStatus: "Ingredient context only",
        safetySummary: "Safety remains uncertain.",
        interactionSummary: "Interactions remain uncertain.",
        evidenceSummary: "An early research subject.",
        lastReviewed: "2026-07-01"
      }
    ],
    claims: [
      {
        id: "example-lifespan",
        interventionId: "example",
        outcome: "Mortality/lifespan",
        claimText: "Example intervention is being studied for ageing-related outcomes.",
        populationStudied: "Adults",
        doseFormStudied: "Not summarized",
        durationStudied: "Not summarized",
        comparator: "Placebo",
        evidenceGrade: "Draft lead",
        effectSize: "Unclear",
        clinicalRelevance: "Unclear",
        confidenceLevel: "Very low",
        safetyNotes: "Safety remains uncertain.",
        applicabilityNotes: "The endpoint does not establish longer life.",
        summary: "A small human study measured an ageing-related outcome",
        uncertainty: "The study did not establish that people live longer",
        keyReferenceIds: ["ref-example"],
        scores: {
          evidenceDirectness: 1,
          evidenceRigor: 2,
          effectSize: 1,
          safety: 3,
          regulatoryRisk: 7,
          productQuality: 1,
          hypePenalty: 8,
          measurability: 3
        },
        finalLabel: "Insufficient Evidence",
        momentum: "Increasing",
        reviewStatus: "Unreviewed AI draft",
        lastUpdated: "2026-07-02",
        whatWouldChangeScore: "A replicated human clinical-outcome study."
      }
    ],
    references: [
      {
        id: "ref-example",
        title: "Example primary study",
        source: "PubMed",
        url: "https://pubmed.ncbi.nlm.nih.gov/12345678/",
        year: 2026
      }
    ],
    studies: [
      {
        id: "study-example",
        title: "Example primary study",
        year: 2026,
        source: "PubMed",
        studyType: "Randomized controlled trial",
        sampleSize: "40",
        population: "Adults",
        intervention: "Example intervention",
        outcomes: ["Ageing-related outcome"],
        adverseEvents: "Not summarized",
        fundingConflicts: "Not summarized",
        riskOfBias: "Needs review",
        referenceId: "ref-example"
      }
    ],
    trialWatchItems: [
      {
        id: "trial-example",
        interventionId: "example",
        title: "Example intervention trial",
        status: "Recruiting",
        phase: "Phase 2",
        enrollment: "40",
        lastUpdateDate: "2026-07-03",
        evidenceImpact: "Increasing",
        url: "https://clinicaltrials.gov/study/NCT00000000",
        registeredInterventions: ["Example intervention"],
        resultsPosted: false
      }
    ],
    safetyAlerts: [],
    productSignals: [],
    australiaRegulatoryStatuses: [
      {
        id: "au-example",
        interventionId: "example",
        region: "AU",
        kind: "Unknown",
        status: "Exact status not verified",
        supplySummary: "No generic supply conclusion.",
        evidenceRequirement: "Check the exact product.",
        sourceUrl: "https://www.tga.gov.au/",
        checkedAt: "2026-07-01",
        notes: "Product-level evidence required."
      }
    ],
    normalizedSourcePackets: [
      {
        claimId: "example-lifespan",
        current: true,
        extractedReferenceCount: 1,
        referenceIds: ["ref-example"],
        reviewStatus: "Unreviewed AI draft",
        sourcePacketId: "packet-example",
        status: "complete"
      }
    ]
  };
}

describe("Lifespan page", () => {
  beforeEach(() => {
    getEvidenceDashboardDataMock.mockReset();
  });

  it("renders a readable, source-traceable maturity view without a Biohacking section", async () => {
    getEvidenceDashboardDataMock.mockResolvedValue(lifespanFixture());

    const html = renderToStaticMarkup(await LifespanPage());

    expect(html).toContain("What researchers are testing to extend healthy life");
    expect(html).toContain("Human outcome sources linked");
    expect(html).toContain("What it does not establish");
    expect(html).toContain("This record is for evidence, safety, and regulatory awareness");
    expect(html).toContain("Study basis:");
    expect(html).toContain("Very low");
    expect(html).toContain("Unreviewed AI draft");
    expect(html).toContain('href="https://pubmed.ncbi.nlm.nih.gov/12345678/"');
    expect(html).toContain('href="/interventions/example-intervention"');
    expect(html).toContain('href="https://clinicaltrials.gov/study/NCT00000000"');
    expect(html).toContain("No posted result captured");
    expect(html).toContain("Exact status not verified");
    expect(html).toContain("checked 2026-07-01");
    expect(html).toContain('href="https://www.tga.gov.au/"');
    expect(html).toContain("does not establish the status of any specific product");
    expect(html).toContain('href="/lifespan"');
    expect(html).not.toContain("Biohacking");
  });

  it("renders every intervention-level AU status with the newest check first", async () => {
    const data = lifespanFixture();
    data.australiaRegulatoryStatuses.push(
      {
        ...data.australiaRegulatoryStatuses[0],
        id: "au-example-older",
        status: "Older status",
        checkedAt: "2026-06-01"
      },
      {
        ...data.australiaRegulatoryStatuses[0],
        id: "au-example-newest",
        status: "Newest status",
        checkedAt: "2026-07-12"
      }
    );
    getEvidenceDashboardDataMock.mockResolvedValue(data);

    const html = renderToStaticMarkup(await LifespanPage());

    expect(html).toContain("Older status");
    expect(html).toContain("Exact status not verified");
    expect(html).toContain("Newest status");
    expect(html.indexOf("Newest status")).toBeLessThan(
      html.indexOf("Exact status not verified")
    );
    expect(html.indexOf("Exact status not verified")).toBeLessThan(
      html.indexOf("Older status")
    );
  });

  it("uses the sanitized unavailable state when the public data read fails", async () => {
    getEvidenceDashboardDataMock.mockRejectedValue(
      new Error("postgresql://user:secret@db.example.invalid/apex query failed")
    );

    const html = renderToStaticMarkup(await LifespanPage());

    expect(html).toContain("Evidence data temporarily unavailable");
    expect(html).not.toContain("postgresql://");
    expect(html).not.toContain("secret");
  });
});
