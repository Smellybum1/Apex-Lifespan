import {
  OperatorRole,
  OperatorStatus,
  ReviewStatus as DbReviewStatus
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { reviewClaimPacketAsOperator } from "@/lib/operator/claim-packet-review";
import type { OperatorPrincipal } from "@/lib/operator/authorization";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    claim: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    operatorAuditEvent: {
      create: vi.fn()
    }
  }
}));

const claimFindUniqueMock = vi.mocked(prisma.claim.findUnique);
const claimUpdateMock = vi.mocked(prisma.claim.update);
const auditCreateMock = vi.mocked(prisma.operatorAuditEvent.create);

const writesEnabled = {
  APEX_OPERATOR_WRITES_ENABLED: "true"
};

const reviewer: OperatorPrincipal = {
  email: "reviewer@example.test",
  role: OperatorRole.REVIEWER,
  status: OperatorStatus.ACTIVE,
  userId: "user-reviewer"
};

const admin: OperatorPrincipal = {
  ...reviewer,
  role: OperatorRole.ADMIN,
  userId: "user-admin"
};

describe("operator claim packet review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditCreateMock.mockResolvedValue({ id: "audit-1" } as never);
  });

  it("requires admin promotion permission", async () => {
    await expect(
      reviewClaimPacketAsOperator(
        reviewer,
        {
          claimId: "vitamin-d-deficiency",
          reviewNote: "Human reviewed packet."
        },
        writesEnabled
      )
    ).rejects.toMatchObject({
      message: "Operator role does not allow this action.",
      status: 403
    });

    expect(claimFindUniqueMock).not.toHaveBeenCalled();
    expect(claimUpdateMock).not.toHaveBeenCalled();
  });

  it("fails closed when writes are disabled", async () => {
    await expect(
      reviewClaimPacketAsOperator(admin, {
        claimId: "vitamin-d-deficiency",
        reviewNote: "Human reviewed packet."
      })
    ).rejects.toMatchObject({
      message: "Operator writes are disabled.",
      status: 503
    });

    expect(claimFindUniqueMock).not.toHaveBeenCalled();
    expect(claimUpdateMock).not.toHaveBeenCalled();
  });

  it("requires a human review note", async () => {
    await expect(
      reviewClaimPacketAsOperator(
        admin,
        {
          claimId: "vitamin-d-deficiency",
          reviewNote: " "
        },
        writesEnabled
      )
    ).rejects.toThrow("Claim review note is required.");

    expect(claimFindUniqueMock).not.toHaveBeenCalled();
    expect(claimUpdateMock).not.toHaveBeenCalled();
  });

  it("refuses incomplete source packets", async () => {
    claimFindUniqueMock.mockResolvedValue({
      id: "vitamin-d-deficiency",
      interventionId: "vitamin-d",
      lastReviewedAt: null,
      references: [
        {
          reference: {
            id: "ods-vitamin-d",
            studies: []
          },
          referenceId: "ods-vitamin-d"
        }
      ],
      reviewStatus: DbReviewStatus.UNREVIEWED_AI_DRAFT
    } as never);

    await expect(
      reviewClaimPacketAsOperator(
        admin,
        {
          claimId: "vitamin-d-deficiency",
          reviewNote: "Human reviewed packet."
        },
        writesEnabled
      )
    ).rejects.toThrow(
      "Claim source packet is not complete: structured extraction missing for ods-vitamin-d."
    );

    expect(claimUpdateMock).not.toHaveBeenCalled();
    expect(auditCreateMock).not.toHaveBeenCalled();
  });

  it("marks a complete claim packet human-reviewed and audits it", async () => {
    const reviewedAt = new Date("2026-06-12T09:15:00.000Z");
    claimFindUniqueMock.mockResolvedValue({
      id: "vitamin-d-deficiency",
      interventionId: "vitamin-d",
      lastReviewedAt: null,
      references: [
        {
          reference: {
            id: "ods-vitamin-d",
            studies: [{ id: "study-vitamin-d-ods" }]
          },
          referenceId: "ods-vitamin-d"
        }
      ],
      reviewStatus: DbReviewStatus.UNREVIEWED_AI_DRAFT
    } as never);
    claimUpdateMock.mockResolvedValue({
      id: "vitamin-d-deficiency",
      lastReviewedAt: reviewedAt,
      reviewStatus: DbReviewStatus.HUMAN_REVIEWED
    } as never);

    await expect(
      reviewClaimPacketAsOperator(
        admin,
        {
          claimId: "vitamin-d-deficiency",
          reviewedAt,
          reviewNote: "Human reviewed ODS vitamin D packet."
        },
        writesEnabled
      )
    ).resolves.toEqual({
      claim: {
        id: "vitamin-d-deficiency",
        lastReviewedAt: "2026-06-12T09:15:00.000Z",
        reviewStatus: "Human reviewed"
      },
      referenceIds: ["ods-vitamin-d"],
      studyIds: ["study-vitamin-d-ods"]
    });

    expect(claimUpdateMock).toHaveBeenCalledWith({
      data: {
        lastReviewedAt: reviewedAt,
        reviewStatus: DbReviewStatus.HUMAN_REVIEWED
      },
      select: {
        id: true,
        lastReviewedAt: true,
        reviewStatus: true
      },
      where: {
        id: "vitamin-d-deficiency"
      }
    });
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "claimPacket.humanReview",
          actorEmail: admin.email,
          actorRole: OperatorRole.ADMIN,
          afterSummary: expect.objectContaining({
            claimId: "vitamin-d-deficiency",
            referenceIds: ["ods-vitamin-d"],
            reviewStatus: DbReviewStatus.HUMAN_REVIEWED,
            studyIds: ["study-vitamin-d-ods"]
          }),
          note: "Human reviewed ODS vitamin D packet.",
          targetId: "vitamin-d-deficiency",
          targetType: "Claim"
        })
      })
    );
  });
});
