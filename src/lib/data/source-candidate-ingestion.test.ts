import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  searchClinicalTrials: vi.fn(),
  searchPubMed: vi.fn(),
  upsertSourceCandidateDrafts: vi.fn()
}));

vi.mock("@/lib/integrations/clinical-trials", () => ({
  searchClinicalTrials: mocks.searchClinicalTrials
}));

vi.mock("@/lib/integrations/pubmed", () => ({
  searchPubMed: mocks.searchPubMed
}));

vi.mock("@/lib/data/source-candidates", () => ({
  upsertSourceCandidateDrafts: mocks.upsertSourceCandidateDrafts
}));

import {
  ingestClinicalTrialSourceCandidates,
  ingestPubMedSourceCandidates
} from "@/lib/data/source-candidate-ingestion";

describe("source candidate ingestion helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upsertSourceCandidateDrafts.mockImplementation(async (candidates) => ({
      received: candidates.length,
      upserted: candidates.length
    }));
  });

  it("fetches PubMed, maps candidates, and persists them through the gated upsert helper", async () => {
    mocks.searchPubMed.mockResolvedValue({
      query: "creatine strength",
      ids: ["28615996"],
      count: 1,
      source: "NCBI E-utilities",
      articles: [
        {
          pmid: "28615996",
          title: "Creatine position stand",
          journal: "Journal of the International Society of Sports Nutrition",
          publicationDate: "2017 Jun 13",
          publicationYear: "2017",
          publicationTypes: ["Review"],
          doi: "10.1186/s12970-017-0173-z",
          hasAbstract: true,
          authors: ["Kreider RB"],
          relevanceScore: 80,
          relevanceReasons: ["Title matches query"],
          url: "https://pubmed.ncbi.nlm.nih.gov/28615996/"
        }
      ]
    });

    const result = await ingestPubMedSourceCandidates({
      term: "creatine strength",
      retmax: 5,
      interventionId: "creatine",
      claimId: "creatine-strength",
      ingestionJobId: "job-pubmed"
    });

    expect(mocks.searchPubMed).toHaveBeenCalledWith("creatine strength", 5);
    expect(mocks.upsertSourceCandidateDrafts).toHaveBeenCalledWith([
      expect.objectContaining({
        dedupeKey:
          "pubmed|au|creatine%20strength|28615996|creatine|creatine-strength",
        source: "PubMed",
        externalId: "28615996",
        triageScore: 80,
        decision: "Pending review",
        reviewStatus: "Unreviewed AI draft",
        ingestionJobId: "job-pubmed"
      })
    ]);
    expect(result).toMatchObject({
      source: "PubMed",
      query: "creatine strength",
      upsert: {
        received: 1,
        upserted: 1
      }
    });
    expect(result.candidates).toHaveLength(1);
  });

  it("fetches ClinicalTrials.gov, maps candidates, and persists them through the gated upsert helper", async () => {
    mocks.searchClinicalTrials.mockResolvedValue({
      query: "creatine aging",
      source: "ClinicalTrials.gov API v2",
      studies: [
        {
          nctId: "NCT06606704",
          title: "Creatine and resistance-band training",
          status: "Recruiting",
          phase: "Not applicable",
          studyType: "Interventional",
          enrollment: "52 estimated",
          enrollmentCount: 52,
          conditions: ["Aging"],
          interventions: ["DIETARY_SUPPLEMENT: Creatine"],
          primaryOutcomes: ["Lean mass"],
          lastUpdateDate: "2024-09-23",
          startDate: "2024-09",
          completionDate: "Unknown",
          hasResults: false,
          resultsFirstPostDate: null,
          sponsor: "Example University",
          triageScore: 80,
          triageReasons: ["Matches query context"],
          url: "https://clinicaltrials.gov/study/NCT06606704"
        }
      ]
    });

    const result = await ingestClinicalTrialSourceCandidates({
      term: "creatine aging",
      pageSize: 5,
      interventionId: "creatine",
      claimId: "creatine-strength"
    });

    expect(mocks.searchClinicalTrials).toHaveBeenCalledWith("creatine aging", 5);
    expect(mocks.upsertSourceCandidateDrafts).toHaveBeenCalledWith([
      expect.objectContaining({
        dedupeKey:
          "clinicaltrials.gov|au|creatine%20aging|nct06606704|creatine|creatine-strength",
        source: "ClinicalTrials.gov",
        externalId: "NCT06606704",
        sourceType: "Interventional",
        triageScore: 80,
        decision: "Pending review",
        reviewStatus: "Unreviewed AI draft"
      })
    ]);
    expect(result).toMatchObject({
      source: "ClinicalTrials.gov",
      query: "creatine aging",
      upsert: {
        received: 1,
        upserted: 1
      }
    });
  });
});
