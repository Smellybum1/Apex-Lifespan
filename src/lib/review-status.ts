import { ReviewStatus as DbReviewStatus } from "@prisma/client";

import type { ReviewStatus } from "@/lib/types";

/**
 * `ReviewStatus` became three-way when automation gained the right to write
 * evidence without impersonating a human reviewer. Most existing call sites
 * asked one of two different questions through the same binary comparison:
 *
 * - "has anyone looked at this yet" — now satisfied by AI review too
 * - "did a human sign this off" — must stay false for anything automated
 *
 * These helpers name the two questions so a future status cannot silently
 * change the meaning of a bare `=== "Unreviewed AI draft"` check again.
 */

/** True once any reviewer — human or automated — has passed over the row. */
export function hasBeenReviewed(status: ReviewStatus) {
  return status !== "Unreviewed AI draft";
}

/**
 * True only for explicit human sign-off. Automation must never satisfy this:
 * it gates the reader-facing "human reviewed" claim and the AGENTS.md rule
 * that `Human reviewed` requires explicit human confirmation.
 */
export function isHumanConfirmed(status: ReviewStatus) {
  return status === "Human reviewed";
}

/** True when a machine wrote the row and no human has confirmed it. */
export function isMachineReviewed(status: ReviewStatus) {
  return status === "AI reviewed";
}

const FROM_DB: Record<DbReviewStatus, ReviewStatus> = {
  [DbReviewStatus.UNREVIEWED_AI_DRAFT]: "Unreviewed AI draft",
  [DbReviewStatus.AI_REVIEWED]: "AI reviewed",
  [DbReviewStatus.HUMAN_REVIEWED]: "Human reviewed"
};

const TO_DB: Record<ReviewStatus, DbReviewStatus> = {
  "Unreviewed AI draft": DbReviewStatus.UNREVIEWED_AI_DRAFT,
  "AI reviewed": DbReviewStatus.AI_REVIEWED,
  "Human reviewed": DbReviewStatus.HUMAN_REVIEWED
};

export function reviewStatusFromDb(status: DbReviewStatus): ReviewStatus {
  return FROM_DB[status];
}

export function reviewStatusToDb(status: ReviewStatus): DbReviewStatus {
  return TO_DB[status];
}

/**
 * Same mapping for callers holding an unvalidated string (a raw column read, a
 * JSON payload). Unknown input is treated as unreviewed rather than assumed
 * reviewed — the conservative direction.
 */
export function reviewStatusFromDbString(status: string): ReviewStatus {
  return FROM_DB[status as DbReviewStatus] ?? "Unreviewed AI draft";
}
