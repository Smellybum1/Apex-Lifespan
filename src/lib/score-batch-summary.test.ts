import { describe, expect, it } from "vitest";

import {
  buildScoreBatchReviewSummary,
  formatScoreBatchReviewSummaryLines
} from "@/lib/score-batch-summary";

describe("score batch summary", () => {
  it("summarizes ready score batches by state, label, band, and guardrails", () => {
    const summary = buildScoreBatchReviewSummary([
      {
        compositeScore: 7.1,
        finalLabel: "Useful for Specific Use Case",
        state: "ready_to_score"
      },
      {
        compositeScore: 5.1,
        finalLabel: "Regulatory Concern",
        state: "ready_to_score"
      },
      {
        compositeScore: 3.1,
        finalLabel: "Insufficient Evidence",
        state: "source_blocked"
      }
    ]);
    const lines = formatScoreBatchReviewSummaryLines(summary).join("\n");

    expect(summary).toMatchObject({
      directScoreRows: 2,
      guardedLabelDrafts: 1,
      regulatoryConcernDrafts: 1,
      sourceBlockedRows: 1,
      totalRows: 3
    });
    expect(summary.labels).toEqual([
      { count: 1, label: "Insufficient Evidence" },
      { count: 1, label: "Regulatory Concern" },
      { count: 1, label: "Useful for Specific Use Case" }
    ]);
    expect(summary.bands).toEqual([
      { count: 1, label: "Moderate" },
      { count: 1, label: "Limited" },
      { count: 1, label: "Weak" }
    ]);
    expect(summary.scoreRange).toEqual({
      average: 5.1,
      max: 7.1,
      min: 3.1
    });
    expect(lines).toContain("Direct score rows: 2");
    expect(lines).toContain("Guardrail label drafts: 1 (1 regulatory concern)");
    expect(lines).toContain("Review regulatory/product-status caveats first");
  });

  it("points source-blocked-only batches back to source extraction", () => {
    const summary = buildScoreBatchReviewSummary([
      {
        compositeScore: 3.1,
        finalLabel: "Insufficient Evidence",
        state: "source_blocked"
      }
    ]);

    expect(summary.nextAction).toContain("Complete source extraction");
  });
});
