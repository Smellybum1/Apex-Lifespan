import type { Claim, EvidenceDashboardData } from "@/lib/types";

const DRAFT_LEAD_EVIDENCE_GRADE = "Draft lead";
const SOURCE_PACKET_REVIEW_EVIDENCE_GRADE = "Insufficient until source packets are reviewed.";

export type DuplicateScaffoldRecommendation = "retire" | "merge-then-retire";

export interface DuplicateScaffoldClaimRef {
  evidenceGrade: string;
  finalLabel: string;
  id: string;
  referenceCount: number;
  reviewStatus: string;
}

export interface DuplicateScaffoldReview {
  interventionId: string;
  interventionName: string;
  outcome: string;
  recommendation: DuplicateScaffoldRecommendation;
  realClaims: DuplicateScaffoldClaimRef[];
  scaffold: {
    claimText: string;
    id: string;
    referenceCount: number;
  };
  sharedReferenceCount: number;
  uniqueReferenceIds: string[];
}

export interface BuildDuplicateScaffoldReviewOptions {
  limit?: number;
}

/**
 * Read-only report of "Draft lead" scaffold claims that duplicate an already
 * authored (non-scaffold) claim for the same intervention and outcome. For each
 * one it reports the reference overlap so an operator can either retire the
 * scaffold outright (all its references are already covered) or fold its unique
 * references into the real claim first. It never mutates data.
 */
export function buildDuplicateScaffoldReview(
  data: EvidenceDashboardData,
  options: BuildDuplicateScaffoldReviewOptions = {}
): DuplicateScaffoldReview[] {
  const interventionsById = new Map(
    data.interventions.map((intervention) => [intervention.id, intervention])
  );
  const claimsByKey = new Map<string, Claim[]>();

  for (const claim of data.claims) {
    const key = `${claim.interventionId}|${claim.outcome}`;
    claimsByKey.set(key, [...(claimsByKey.get(key) ?? []), claim]);
  }

  const reviews: DuplicateScaffoldReview[] = [];

  for (const claims of claimsByKey.values()) {
    if (claims.length < 2) {
      continue;
    }

    const scaffolds = claims.filter(isScaffoldClaim);
    const realClaims = claims.filter((claim) => !isScaffoldClaim(claim));

    if (scaffolds.length === 0 || realClaims.length === 0) {
      continue;
    }

    const realReferenceIds = new Set(
      realClaims.flatMap((claim) => claim.keyReferenceIds)
    );

    for (const scaffold of scaffolds) {
      const uniqueReferenceIds = Array.from(new Set(scaffold.keyReferenceIds)).filter(
        (referenceId) => !realReferenceIds.has(referenceId)
      );
      const scaffoldReferenceCount = new Set(scaffold.keyReferenceIds).size;

      reviews.push({
        interventionId: scaffold.interventionId,
        interventionName:
          interventionsById.get(scaffold.interventionId)?.name ?? scaffold.interventionId,
        outcome: scaffold.outcome,
        realClaims: realClaims.map((claim) => ({
          evidenceGrade: claim.evidenceGrade,
          finalLabel: claim.finalLabel,
          id: claim.id,
          referenceCount: new Set(claim.keyReferenceIds).size,
          reviewStatus: claim.reviewStatus
        })),
        recommendation: uniqueReferenceIds.length === 0 ? "retire" : "merge-then-retire",
        scaffold: {
          claimText: scaffold.claimText,
          id: scaffold.id,
          referenceCount: scaffoldReferenceCount
        },
        sharedReferenceCount: scaffoldReferenceCount - uniqueReferenceIds.length,
        uniqueReferenceIds
      });
    }
  }

  reviews.sort(
    (left, right) =>
      left.uniqueReferenceIds.length - right.uniqueReferenceIds.length ||
      left.interventionName.localeCompare(right.interventionName) ||
      left.outcome.localeCompare(right.outcome)
  );

  return options.limit ? reviews.slice(0, options.limit) : reviews;
}

export function summarizeDuplicateScaffoldReview(reviews: DuplicateScaffoldReview[]) {
  const retire = reviews.filter((review) => review.recommendation === "retire").length;

  return {
    mergeThenRetire: reviews.length - retire,
    retire,
    total: reviews.length
  };
}

function isScaffoldClaim(claim: Claim) {
  return (
    claim.evidenceGrade === DRAFT_LEAD_EVIDENCE_GRADE ||
    claim.evidenceGrade === SOURCE_PACKET_REVIEW_EVIDENCE_GRADE
  );
}

export function formatDuplicateScaffoldReviewLines(reviews: DuplicateScaffoldReview[]) {
  if (reviews.length === 0) {
    return ["No duplicate scaffold claims were found."];
  }

  const summary = summarizeDuplicateScaffoldReview(reviews);
  const lines = [
    `Duplicate scaffold review (${summary.total} scaffold claim(s) duplicating a real claim)`,
    `Retire outright (all references already covered): ${summary.retire}; merge-then-retire (has unique references): ${summary.mergeThenRetire}`,
    "Read-only: shows scaffold claims that duplicate an authored claim for the same intervention/outcome.",
    ""
  ];

  reviews.forEach((review, index) => {
    lines.push(`${index + 1}. ${review.interventionName} / ${review.outcome} [${review.recommendation}]`);
    lines.push(`   scaffold ${review.scaffold.id} (${review.scaffold.referenceCount} ref(s)): ${review.scaffold.claimText}`);
    review.realClaims.forEach((real) => {
      lines.push(
        `   real ${real.id} (${real.referenceCount} ref(s)) - ${real.finalLabel}; ${real.reviewStatus}`
      );
    });
    lines.push(
      `   references: ${review.sharedReferenceCount} already covered, ${review.uniqueReferenceIds.length} unique to scaffold`
    );
    lines.push("");
  });

  return lines;
}
