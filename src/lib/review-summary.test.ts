import { describe, expect, it } from "vitest";

import { summarizeReviewStatus } from "@/lib/review-summary";

describe("summarizeReviewStatus", () => {
  it("counts human-reviewed claims and unreviewed drafts separately", () => {
    expect(
      summarizeReviewStatus([
        { reviewStatus: "Human reviewed" },
        { reviewStatus: "Unreviewed AI draft" },
        { reviewStatus: "Unreviewed AI draft" }
      ])
    ).toEqual({
      humanReviewed: 1,
      unreviewedDrafts: 2,
      total: 3
    });
  });

  it("does not count all claims as drafts when some are reviewed", () => {
    expect(
      summarizeReviewStatus([
        { reviewStatus: "Human reviewed" },
        { reviewStatus: "Human reviewed" },
        { reviewStatus: "Unreviewed AI draft" }
      ])
    ).toEqual({
      humanReviewed: 2,
      unreviewedDrafts: 1,
      total: 3
    });
  });

  it("handles empty claim lists", () => {
    expect(summarizeReviewStatus([])).toEqual({
      humanReviewed: 0,
      unreviewedDrafts: 0,
      total: 0
    });
  });
});
