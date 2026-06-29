import { describe, expect, it } from "vitest";

import {
  assessPubMedDeepeningPage,
  hasEnoughUsefulPubMedCandidates,
  normalisePubMedRetmax
} from "@/lib/source-discovery-policy";

describe("source discovery policy", () => {
  it("summarizes and continues a full useful PubMed page", () => {
    expect(
      assessPubMedDeepeningPage({
        candidates: deepeningCandidates(20, "likely-useful"),
        pageSize: 20,
        pageStart: 0,
        totalCount: 80
      })
    ).toMatchObject({
      candidateCount: 20,
      nextPageStart: 20,
      pageSize: 20,
      pageStart: 0,
      reason: "enough useful-looking candidates to check the next page",
      shouldQueue: true,
      usefulCandidateCount: 20,
      usefulRatio: 1
    });
  });

  it("stops a full noisy PubMed page with the useful ratio visible", () => {
    expect(
      assessPubMedDeepeningPage({
        candidates: deepeningCandidates(20, "likely-noise"),
        pageSize: 20,
        pageStart: 0,
        totalCount: 80
      })
    ).toMatchObject({
      candidateCount: 20,
      reason: "current PubMed page did not have enough useful-looking candidates",
      shouldQueue: false,
      usefulCandidateCount: 0,
      usefulRatio: 0
    });
  });

  it("keeps normalisation and usefulness thresholds compact", () => {
    expect(normalisePubMedRetmax(99)).toBe(20);
    expect(hasEnoughUsefulPubMedCandidates(deepeningCandidates(12, "maybe-useful"))).toBe(true);
    expect(hasEnoughUsefulPubMedCandidates(deepeningCandidates(12, "likely-noise"))).toBe(false);
  });
});

function deepeningCandidates(
  count: number,
  bucket: "likely-useful" | "maybe-useful" | "likely-noise"
) {
  return Array.from({ length: count }, (_, index) => ({
    metadata: {
      discoveryClassification: {
        bucket,
        label:
          bucket === "likely-useful"
            ? "Likely useful"
            : bucket === "maybe-useful"
              ? "Maybe useful"
              : "Likely noise",
        score: bucket === "likely-noise" ? 20 : 70
      }
    },
    triageScore: bucket === "likely-noise" ? 20 : 70,
    index
  }));
}
