import type { Claim } from "@/lib/types";

export interface ReviewStatusSummary {
  humanReviewed: number;
  unreviewedDrafts: number;
  total: number;
}

export function summarizeReviewStatus(
  claims: Array<Pick<Claim, "reviewStatus">>
): ReviewStatusSummary {
  const humanReviewed = claims.filter((claim) => claim.reviewStatus === "Human reviewed").length;

  return {
    humanReviewed,
    unreviewedDrafts: claims.length - humanReviewed,
    total: claims.length
  };
}
