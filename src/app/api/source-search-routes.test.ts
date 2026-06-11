import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET as searchPubMedRoute } from "@/app/api/pubmed/search/route";
import { GET as searchTrialsRoute } from "@/app/api/trials/search/route";
import { searchClinicalTrials } from "@/lib/integrations/clinical-trials";
import { searchPubMed } from "@/lib/integrations/pubmed";
import {
  MAX_LIVE_SOURCE_RESULT_LIMIT,
  MAX_LIVE_SOURCE_TERM_LENGTH
} from "@/lib/live-source-request";

vi.mock("@/lib/integrations/clinical-trials", () => ({
  searchClinicalTrials: vi.fn()
}));

vi.mock("@/lib/integrations/pubmed", () => ({
  searchPubMed: vi.fn()
}));

const searchClinicalTrialsMock = vi.mocked(searchClinicalTrials);
const searchPubMedMock = vi.mocked(searchPubMed);

function expectLiveSourceHeaders(response: Response) {
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
}

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
    expectLiveSourceHeaders(response);
    expect(searchPubMedMock).toHaveBeenCalledWith("creatine monohydrate", 5);
  });

  it("removes hidden control characters from accepted PubMed terms", async () => {
    const term = encodeURIComponent("creatine\u0000monohydrate\u202E trial");
    const response = await searchPubMedRoute(
      new Request(`http://localhost/api/pubmed/search?term=${term}&retmax=5`)
    );

    expect(response.status).toBe(200);
    expectLiveSourceHeaders(response);
    expect(searchPubMedMock).toHaveBeenCalledWith("creatine monohydrate trial", 5);
  });

  it("normalises accepted ClinicalTrials.gov terms and passes the requested limit", async () => {
    const response = await searchTrialsRoute(
      new Request("http://localhost/api/trials/search?term=omega-3%09lipids&pageSize=5")
    );

    expect(response.status).toBe(200);
    expectLiveSourceHeaders(response);
    expect(searchClinicalTrialsMock).toHaveBeenCalledWith("omega-3 lipids", 5);
  });

  it("strips self-use PubMed terms before calling the integration", async () => {
    const response = await searchPubMedRoute(
      new Request(
        "http://localhost/api/pubmed/search?term=BPC-157%20injection%20reconstitution%20vial%20sourcing&retmax=5"
      )
    );

    expect(response.status).toBe(200);
    expectLiveSourceHeaders(response);
    expect(searchPubMedMock).toHaveBeenCalledWith("BPC-157", 5);
  });

  it("preserves ordinary ClinicalTrials.gov clinical terms while stripping preparation phrases", async () => {
    const response = await searchTrialsRoute(
      new Request(
        "http://localhost/api/trials/search?term=creatine%20water%20retention%20sterile%20water%20dose%20response&pageSize=5"
      )
    );

    expect(response.status).toBe(200);
    expectLiveSourceHeaders(response);
    expect(searchClinicalTrialsMock).toHaveBeenCalledWith(
      "creatine water retention dose response",
      5
    );
  });

  it("bounds PubMed limits before calling the integration", async () => {
    const response = await searchPubMedRoute(
      new Request("http://localhost/api/pubmed/search?term=creatine&retmax=99.9")
    );

    expect(response.status).toBe(200);
    expect(searchPubMedMock).toHaveBeenCalledWith("creatine", MAX_LIVE_SOURCE_RESULT_LIMIT);
  });

  it("clamps low PubMed limits before calling the integration", async () => {
    const response = await searchPubMedRoute(
      new Request("http://localhost/api/pubmed/search?term=creatine&retmax=0")
    );

    expect(response.status).toBe(200);
    expect(searchPubMedMock).toHaveBeenCalledWith("creatine", 1);
  });

  it("defaults invalid ClinicalTrials.gov limits before calling the integration", async () => {
    const response = await searchTrialsRoute(
      new Request("http://localhost/api/trials/search?term=omega-3&pageSize=not-a-number")
    );

    expect(response.status).toBe(200);
    expect(searchClinicalTrialsMock).toHaveBeenCalledWith("omega-3", 10);
  });

  it("clamps low ClinicalTrials.gov limits before calling the integration", async () => {
    const response = await searchTrialsRoute(
      new Request("http://localhost/api/trials/search?term=omega-3&pageSize=-7")
    );

    expect(response.status).toBe(200);
    expect(searchClinicalTrialsMock).toHaveBeenCalledWith("omega-3", 1);
  });

  it("rejects missing PubMed terms before calling the integration", async () => {
    const response = await searchPubMedRoute(new Request("http://localhost/api/pubmed/search"));

    expect(response.status).toBe(400);
    expectLiveSourceHeaders(response);
    expect(await response.json()).toEqual({ error: "Missing term query parameter." });
    expect(searchPubMedMock).not.toHaveBeenCalled();
  });

  it("rejects ClinicalTrials.gov terms that contain only hidden control characters", async () => {
    const term = encodeURIComponent("\u0000\u202E\u2066");
    const response = await searchTrialsRoute(
      new Request(`http://localhost/api/trials/search?term=${term}`)
    );

    expect(response.status).toBe(400);
    expectLiveSourceHeaders(response);
    expect(await response.json()).toEqual({ error: "Missing term query parameter." });
    expect(searchClinicalTrialsMock).not.toHaveBeenCalled();
  });

  it("rejects PubMed terms that contain only unsafe self-use words", async () => {
    const response = await searchPubMedRoute(
      new Request(
        "http://localhost/api/pubmed/search?term=injection%20reconstitution%20vials%20sourcing"
      )
    );

    expect(response.status).toBe(400);
    expectLiveSourceHeaders(response);
    expect(await response.json()).toEqual({
      error: "Term query parameter must include citation-oriented search terms."
    });
    expect(searchPubMedMock).not.toHaveBeenCalled();
  });

  it("rejects overlong PubMed raw terms before unsafe-term scrubbing", async () => {
    const overlongRawTerm = `creatine ${"injection ".repeat(40)}`;
    const response = await searchPubMedRoute(
      new Request(
        `http://localhost/api/pubmed/search?term=${encodeURIComponent(overlongRawTerm)}`
      )
    );

    expect(response.status).toBe(400);
    expectLiveSourceHeaders(response);
    expect(await response.json()).toEqual({
      error: `Term query parameter must be ${MAX_LIVE_SOURCE_TERM_LENGTH} characters or fewer.`
    });
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
    expectLiveSourceHeaders(response);
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
    expectLiveSourceHeaders(response);
    expect(await response.json()).toEqual({
      error: "ClinicalTrials.gov search is temporarily unavailable."
    });
  });
});
