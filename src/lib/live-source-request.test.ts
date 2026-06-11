import { describe, expect, it } from "vitest";

import {
  MAX_LIVE_SOURCE_TERM_LENGTH,
  publicLiveSourceDisplayError,
  publicLiveSourceError
} from "@/lib/live-source-request";

describe("publicLiveSourceDisplayError", () => {
  it("keeps route-owned validation errors visible", () => {
    expect(publicLiveSourceDisplayError("PubMed", "Missing term query parameter.")).toBe(
      "Missing term query parameter."
    );
    expect(
      publicLiveSourceDisplayError(
        "PubMed",
        `Term query parameter must be ${MAX_LIVE_SOURCE_TERM_LENGTH} characters or fewer.`
      )
    ).toBe(`Term query parameter must be ${MAX_LIVE_SOURCE_TERM_LENGTH} characters or fewer.`);
    expect(
      publicLiveSourceDisplayError(
        "ClinicalTrials.gov",
        "Term query parameter must include citation-oriented search terms."
      )
    ).toBe("Term query parameter must include citation-oriented search terms.");
  });

  it("keeps route-owned upstream unavailable errors visible", () => {
    expect(publicLiveSourceDisplayError("PubMed", publicLiveSourceError("PubMed"))).toBe(
      "PubMed search is temporarily unavailable."
    );
    expect(
      publicLiveSourceDisplayError(
        "ClinicalTrials.gov",
        publicLiveSourceError("ClinicalTrials.gov")
      )
    ).toBe("ClinicalTrials.gov search is temporarily unavailable.");
  });

  it("downgrades unexpected client or proxy errors to public fallback text", () => {
    expect(
      publicLiveSourceDisplayError(
        "PubMed",
        new Error("fetch failed for https://eutils.ncbi.nlm.nih.gov/?api_key=secret")
      )
    ).toBe("PubMed search is temporarily unavailable.");
    expect(publicLiveSourceDisplayError("ClinicalTrials.gov", "token=secret")).toBe(
      "ClinicalTrials.gov search is temporarily unavailable."
    );
    expect(publicLiveSourceDisplayError("PubMed", { error: "upstream exploded" })).toBe(
      "PubMed search is temporarily unavailable."
    );
  });
});
