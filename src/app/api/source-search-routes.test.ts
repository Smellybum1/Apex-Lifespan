import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET as searchPubMedRoute } from "@/app/api/pubmed/search/route";
import { GET as searchTrialsRoute } from "@/app/api/trials/search/route";
import { searchClinicalTrials } from "@/lib/integrations/clinical-trials";
import { searchPubMed } from "@/lib/integrations/pubmed";
import { MAX_LIVE_SOURCE_TERM_LENGTH } from "@/lib/live-source-request";

vi.mock("@/lib/integrations/clinical-trials", () => ({
  searchClinicalTrials: vi.fn()
}));

vi.mock("@/lib/integrations/pubmed", () => ({
  searchPubMed: vi.fn()
}));

const searchClinicalTrialsMock = vi.mocked(searchClinicalTrials);
const searchPubMedMock = vi.mocked(searchPubMed);

describe("live source search API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchClinicalTrialsMock.mockResolvedValue({
      query: "creatine",
      source: "ClinicalTrials.gov API v2",
      studies: []
    });
    searchPubMedMock.mockResolvedValue({
      query: "creatine",
      ids: [],
      count: 0,
      source: "NCBI E-utilities",
      articles: []
    });
  });

  it("normalises accepted PubMed terms and passes the requested limit", async () => {
    const response = await searchPubMedRoute(
      new Request("http://localhost/api/pubmed/search?term=%20%20creatine%0Amonohydrate%20&retmax=5")
    );

    expect(response.status).toBe(200);
    expect(searchPubMedMock).toHaveBeenCalledWith("creatine monohydrate", 5);
  });

  it("normalises accepted ClinicalTrials.gov terms and passes the requested limit", async () => {
    const response = await searchTrialsRoute(
      new Request("http://localhost/api/trials/search?term=omega-3%09lipids&pageSize=5")
    );

    expect(response.status).toBe(200);
    expect(searchClinicalTrialsMock).toHaveBeenCalledWith("omega-3 lipids", 5);
  });

  it("rejects missing PubMed terms before calling the integration", async () => {
    const response = await searchPubMedRoute(new Request("http://localhost/api/pubmed/search"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Missing term query parameter." });
    expect(searchPubMedMock).not.toHaveBeenCalled();
  });

  it("rejects overlong ClinicalTrials.gov terms before calling the integration", async () => {
    const overlongTerm = "a".repeat(MAX_LIVE_SOURCE_TERM_LENGTH + 1);
    const response = await searchTrialsRoute(
      new Request(`http://localhost/api/trials/search?term=${overlongTerm}`)
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: `Term query parameter must be ${MAX_LIVE_SOURCE_TERM_LENGTH} characters or fewer.`
    });
    expect(searchClinicalTrialsMock).not.toHaveBeenCalled();
  });

  it("does not expose raw PubMed integration errors", async () => {
    searchPubMedMock.mockRejectedValue(
      new Error("fetch failed for https://eutils.ncbi.nlm.nih.gov/?api_key=secret")
    );

    const response = await searchPubMedRoute(
      new Request("http://localhost/api/pubmed/search?term=creatine")
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "PubMed search is temporarily unavailable."
    });
  });

  it("does not expose raw ClinicalTrials.gov integration errors", async () => {
    searchClinicalTrialsMock.mockRejectedValue(
      new Error("upstream request failed for https://clinicaltrials.gov/api/v2/studies?token=secret")
    );

    const response = await searchTrialsRoute(
      new Request("http://localhost/api/trials/search?term=omega-3")
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "ClinicalTrials.gov search is temporarily unavailable."
    });
  });
});
