import { OperatorRole, OperatorStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyUpdateClaimScore, dryRunUpdateClaimScore } from "@/lib/data/score-update";
import { recordReviewEvent } from "@/lib/data/review-events";
import { recordOperatorAuditEvent } from "@/lib/operator/audit";
import { updateClaimScoreAsOperator } from "@/lib/operator/claim-score-update";
import type { OperatorPrincipal } from "@/lib/operator/authorization";

vi.mock("@/lib/data/score-update", () => ({
  applyUpdateClaimScore: vi.fn(),
  dryRunUpdateClaimScore: vi.fn()
}));

vi.mock("@/lib/data/review-events", () => ({
  recordReviewEvent: vi.fn()
}));

vi.mock("@/lib/operator/audit", () => ({
  recordOperatorAuditEvent: vi.fn()
}));

const applyMock = vi.mocked(applyUpdateClaimScore);
const auditMock = vi.mocked(recordOperatorAuditEvent);
const dryRunMock = vi.mocked(dryRunUpdateClaimScore);
const reviewEventMock = vi.mocked(recordReviewEvent);

const admin: OperatorPrincipal = {
  email: "admin@example.test",
  role: OperatorRole.ADMIN,
  status: OperatorStatus.ACTIVE,
  userId: "user-admin"
};

const scores = {
  effectSize: 7,
  evidenceDirectness: 8,
  evidenceRigor: 7,
  hypePenalty: 2,
  measurability: 6,
  productQuality: 6,
  regulatoryRisk: 3,
  safety: 8
};

describe("updateClaimScoreAsOperator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditMock.mockResolvedValue({ id: "audit-1" } as never);
    reviewEventMock.mockResolvedValue({ id: "review-event-1" } as never);
  });

  it("returns a dry-run preview without requiring write env", async () => {
    dryRunMock.mockResolvedValue({
      claimId: "creatine-strength",
      current: {
        compositeScore: 3.1,
        finalLabel: "Insufficient Evidence",
        scores
      },
      dryRun: true,
      next: {
        compositeScore: 7.4,
        finalLabel: "Useful for Specific Use Case",
        scores
      },
      rationale: "Preview source packet scoring.",
      reason: "MANUAL_REVIEW",
      wouldCreateHistory: true,
      wouldCreateSnapshot: true,
      wouldUpdateClaim: true
    });

    const result = await updateClaimScoreAsOperator(admin, {
      claimId: "creatine-strength",
      dryRun: true,
      finalLabel: "Useful for Specific Use Case",
      rationale: "Preview source packet scoring.",
      scores
    });

    expect(result).toMatchObject({
      claimId: "creatine-strength",
      dryRun: true
    });
    expect(applyMock).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("applies score updates with audit and review events when writes are enabled", async () => {
    applyMock.mockResolvedValue({
      before: {
        claimId: "creatine-strength",
        current: {
          compositeScore: 3.1,
          finalLabel: "Insufficient Evidence",
          scores
        },
        dryRun: true,
        next: {
          compositeScore: 7.4,
          finalLabel: "Useful for Specific Use Case",
          scores
        },
        rationale: "Reviewed source packet scoring.",
        reason: "MANUAL_REVIEW",
        wouldCreateHistory: true,
        wouldCreateSnapshot: true,
        wouldUpdateClaim: true
      },
      result: {
        created: true,
        historyId: "history-1",
        snapshotId: "snapshot-1"
      },
      updatedClaim: true
    });

    await updateClaimScoreAsOperator(
      admin,
      {
        claimId: "creatine-strength",
        finalLabel: "Useful for Specific Use Case",
        rationale: "Reviewed source packet scoring.",
        scores
      },
      { APEX_OPERATOR_WRITES_ENABLED: "true" }
    );

    expect(applyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        changedByUserId: "user-admin",
        claimId: "creatine-strength",
        finalLabel: "Useful for Specific Use Case",
        rationale: "Reviewed source packet scoring.",
        scores
      })
    );
    expect(reviewEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "CLAIM_SCORE_UPDATED",
        metadata: {
          createdSnapshot: true,
          updatedClaim: true
        }
      })
    );
    expect(auditMock).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({
        action: "claimScore.update",
        targetId: "creatine-strength"
      })
    );
  });
});
