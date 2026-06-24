import {
  OperatorRole,
  OperatorStatus,
  ReviewStatus as DbReviewStatus
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { reviewClaimPacketAsOperator } from "@/lib/operator/claim-packet-review";
import type { OperatorPrincipal } from "@/lib/operator/authorization";

vi.mock("@/lib/db/prisma", () => {
  const prismaMock = {
    $transaction: vi.fn(),
    claim: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    claimScoreSnapshot: {
      findFirst: vi.fn(),
      create: vi.fn()
    },
    claimScoreHistory: {
      create: vi.fn()
    },
    operatorAuditEvent: {
      create: vi.fn()
    },
    publicChangelogEntry: {
      create: vi.fn()
    },
    reviewEvent: {
      create: vi.fn()
    }
  };

  prismaMock.$transaction.mockImplementation(async (callback) =>
    callback(prismaMock)
  );

  return {
    prisma: prismaMock
  };
});

const claimFindUniqueMock = vi.mocked(prisma.claim.findUnique);
const claimUpdateMock = vi.mocked(prisma.claim.update);
const claimScoreSnapshotFindFirstMock = vi.mocked(prisma.claimScoreSnapshot.findFirst);
const claimScoreSnapshotCreateMock = vi.mocked(prisma.claimScoreSnapshot.create);
const claimScoreHistoryCreateMock = vi.mocked(prisma.claimScoreHistory.create);
const auditCreateMock = vi.mocked(prisma.operatorAuditEvent.create);
const publicChangelogEntryCreateMock = vi.mocked(prisma.publicChangelogEntry.create);
const reviewEventCreateMock = vi.mocked(prisma.reviewEvent.create);

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
    claimScoreHistoryCreateMock.mockResolvedValue({ id: "score-history-1" } as never);
    claimScoreSnapshotFindFirstMock.mockResolvedValue({
      compositeScore: "7.1",
      finalLabel: "CONDITIONAL_BIOMARKER_GATED",
      id: "previous-score-snapshot"
    } as never);
    claimScoreSnapshotCreateMock.mockResolvedValue({
      compositeScore: "7.6",
      finalLabel: "CONDITIONAL_BIOMARKER_GATED",
      id: "score-snapshot-1"
    } as never);
    publicChangelogEntryCreateMock.mockResolvedValue({ id: "changelog-1" } as never);
    reviewEventCreateMock.mockResolvedValue({ id: "review-event-1" } as never);
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

  it("requires an audit review note", async () => {
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
    expect(claimScoreHistoryCreateMock).not.toHaveBeenCalled();
    expect(claimScoreSnapshotCreateMock).not.toHaveBeenCalled();
    expect(publicChangelogEntryCreateMock).not.toHaveBeenCalled();
    expect(reviewEventCreateMock).not.toHaveBeenCalled();
  });

  it("marks a complete claim packet AI-reviewed by default and audits it", async () => {
    const reviewedAt = new Date("2026-06-12T09:15:00.000Z");
    claimFindUniqueMock.mockResolvedValue({
      id: "vitamin-d-deficiency",
      evidenceDirectnessScore: 8,
      evidenceRigorScore: 8,
      effectSizeScore: 7,
      finalLabel: "CONDITIONAL_BIOMARKER_GATED",
      hypePenalty: 3,
      interventionId: "vitamin-d",
      lastReviewedAt: null,
      measurabilityScore: 10,
      productQualityScore: 5,
      regulatoryRiskScore: 2,
      references: [
        {
          reference: {
            id: "ods-vitamin-d",
            studies: [{ id: "study-vitamin-d-ods" }]
          },
          referenceId: "ods-vitamin-d"
        }
      ],
      reviewStatus: DbReviewStatus.UNREVIEWED_AI_DRAFT,
      safetyScore: 6
    } as never);
    claimUpdateMock.mockResolvedValue({
      id: "vitamin-d-deficiency",
      lastReviewedAt: reviewedAt,
      reviewStatus: DbReviewStatus.AI_REVIEWED
    } as never);

    await expect(
      reviewClaimPacketAsOperator(
        admin,
        {
          claimId: "vitamin-d-deficiency",
          reviewedAt,
          reviewNote: "Codex reviewed ODS vitamin D packet."
        },
        writesEnabled
      )
    ).resolves.toEqual({
      approvalBasis: "codex-ai-review",
      claim: {
        id: "vitamin-d-deficiency",
        lastReviewedAt: "2026-06-12T09:15:00.000Z",
        reviewStatus: "AI reviewed"
      },
      referenceIds: ["ods-vitamin-d"],
      studyIds: ["study-vitamin-d-ods"]
    });

    expect(claimUpdateMock).toHaveBeenCalledWith({
      data: {
        lastReviewedAt: reviewedAt,
        reviewStatus: DbReviewStatus.AI_REVIEWED
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
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(reviewEventCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorEmail: admin.email,
        actorUserId: admin.userId,
        claimId: "vitamin-d-deficiency",
        createdAt: reviewedAt,
        entityId: "vitamin-d-deficiency",
        entityType: "Claim",
        eventType: "AI_REVIEWED",
        metadata: expect.objectContaining({
          approvalBasis: "codex-ai-review",
          completeSourcePacket: true,
          referenceIds: ["ods-vitamin-d"],
          studyIds: ["study-vitamin-d-ods"],
          workflow: "claimPacket.aiReview"
        }),
        note: "Codex reviewed ODS vitamin D packet.",
        reviewStatus: DbReviewStatus.AI_REVIEWED
      })
    });
    expect(claimScoreSnapshotCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        claimId: "vitamin-d-deficiency",
        compositeScore: 7.6,
        computedAt: reviewedAt,
        finalLabel: "CONDITIONAL_BIOMARKER_GATED",
        rationale: "AI-reviewed claim packet: Codex reviewed ODS vitamin D packet.",
        reviewStatus: DbReviewStatus.AI_REVIEWED,
        scoreVersion: "v1"
      })
    });
    expect(claimScoreHistoryCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        changedByUserId: admin.userId,
        claimId: "vitamin-d-deficiency",
        createdAt: reviewedAt,
        newCompositeScore: "7.6",
        newLabel: "CONDITIONAL_BIOMARKER_GATED",
        newSnapshotId: "score-snapshot-1",
        oldCompositeScore: "7.1",
        oldLabel: "CONDITIONAL_BIOMARKER_GATED",
        previousSnapshotId: "previous-score-snapshot",
        rationale: "AI-reviewed claim packet: Codex reviewed ODS vitamin D packet.",
        reason: "MANUAL_REVIEW"
      })
    });
    expect(publicChangelogEntryCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        claimId: "vitamin-d-deficiency",
        date: reviewedAt,
        interventionId: "vitamin-d",
        kind: "EVIDENCE_CARD",
        publishedAt: null,
        scoreHistoryId: "score-history-1",
        slug: "claim-review-vitamin-d-deficiency-score-history-1",
        title: "AI-reviewed source packet recorded"
      })
    });
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "claimPacket.aiReview",
          actorEmail: admin.email,
          actorRole: OperatorRole.ADMIN,
          afterSummary: expect.objectContaining({
            claimId: "vitamin-d-deficiency",
            referenceIds: ["ods-vitamin-d"],
            reviewStatus: DbReviewStatus.AI_REVIEWED,
            studyIds: ["study-vitamin-d-ods"]
          }),
          note: "Codex reviewed ODS vitamin D packet.",
          targetId: "vitamin-d-deficiency",
          targetType: "Claim"
        })
      })
    );
  });
});
