import { OperatorRole, OperatorStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyRecomputeClaimScore, dryRunRecomputeClaimScore } from "@/lib/data/score-recompute";
import { recordOperatorAuditEvent } from "@/lib/operator/audit";
import { recomputeClaimScoreAsOperator } from "@/lib/operator/claim-score-recompute";
import type { OperatorPrincipal } from "@/lib/operator/authorization";

vi.mock("@/lib/data/score-recompute", () => ({
  applyRecomputeClaimScore: vi.fn(),
  dryRunRecomputeClaimScore: vi.fn()
}));

vi.mock("@/lib/data/review-events", () => ({
  recordReviewEvent: vi.fn()
}));

vi.mock("@/lib/operator/audit", () => ({
  recordOperatorAuditEvent: vi.fn()
}));

const dryRunMock = vi.mocked(dryRunRecomputeClaimScore);
const applyMock = vi.mocked(applyRecomputeClaimScore);
const auditMock = vi.mocked(recordOperatorAuditEvent);

const admin: OperatorPrincipal = {
  email: "admin@example.test",
  role: OperatorRole.ADMIN,
  status: OperatorStatus.ACTIVE,
  userId: "user-admin"
};

const writesEnabled = {
  APEX_OPERATOR_WRITES_ENABLED: "true"
};

describe("recomputeClaimScoreAsOperator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditMock.mockResolvedValue({ id: "audit-1" } as never);
  });

  it("returns a dry-run preview without writing", async () => {
    dryRunMock.mockResolvedValue({
      claimId: "creatine-strength",
      current: {
        compositeScore: 6.4,
        finalLabel: "Useful for Specific Use Case",
        scores: {
          effectSize: 7,
          evidenceDirectness: 8,
          evidenceRigor: 7,
          hypePenalty: 2,
          measurability: 6,
          productQuality: 6,
          regulatoryRisk: 3,
          safety: 8
        }
      },
      dryRun: true,
      rationale: "Preview only.",
      reason: "MANUAL_REVIEW",
      wouldChange: false,
      wouldCreateHistory: false,
      wouldCreateSnapshot: false
    });

    const result = await recomputeClaimScoreAsOperator(
      admin,
      {
        claimId: "creatine-strength",
        dryRun: true,
        rationale: "Preview only."
      },
      writesEnabled
    );

    expect(result).toMatchObject({
      claimId: "creatine-strength",
      dryRun: true
    });
    expect(applyMock).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });
});
