import { OperatorRole, OperatorStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db/prisma";
import type { OperatorPrincipal } from "@/lib/operator/authorization";
import { publishPublicChangelogEntryAsOperator } from "@/lib/operator/changelog-publication";

vi.mock("@/lib/db/prisma", () => ({
  prisma: (() => {
    const transactionClient = {
      operatorAuditEvent: {
        create: vi.fn()
      },
      publicChangelogEntry: {
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        updateMany: vi.fn()
      }
    };

    return {
      __transactionClient: transactionClient,
      $transaction: vi.fn(async (callback) => callback(transactionClient)),
      operatorAuditEvent: {
        create: vi.fn()
      },
      publicChangelogEntry: {
        findUnique: vi.fn(),
        update: vi.fn()
      }
    };
  })()
}));

const prismaMock = prisma as typeof prisma & {
  __transactionClient: {
    operatorAuditEvent: {
      create: typeof prisma.operatorAuditEvent.create;
    };
    publicChangelogEntry: {
      findUnique: typeof prisma.publicChangelogEntry.findUnique;
      findUniqueOrThrow: typeof prisma.publicChangelogEntry.findUniqueOrThrow;
      updateMany: typeof prisma.publicChangelogEntry.updateMany;
    };
  };
};

const auditCreateMock = vi.mocked(
  prismaMock.__transactionClient.operatorAuditEvent.create
);
const globalAuditCreateMock = vi.mocked(prisma.operatorAuditEvent.create);
const publicChangelogEntryFindUniqueMock = vi.mocked(
  prismaMock.__transactionClient.publicChangelogEntry.findUnique
);
const globalPublicChangelogEntryFindUniqueMock = vi.mocked(
  prisma.publicChangelogEntry.findUnique
);
const publicChangelogEntryUpdateMock = vi.mocked(
  prismaMock.__transactionClient.publicChangelogEntry.updateMany
);
const publicChangelogEntryFindUniqueOrThrowMock = vi.mocked(
  prismaMock.__transactionClient.publicChangelogEntry.findUniqueOrThrow
);
const globalPublicChangelogEntryUpdateMock = vi.mocked(
  prisma.publicChangelogEntry.update
);
const transactionMock = vi.mocked(prisma.$transaction);

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

const publicationGateEnv = {
  APEX_OPERATOR_WRITES_ENABLED: "true",
  APEX_PUBLIC_CHANGELOG_PUBLISH_REVIEWED_AT: "2026-06-13T21:00:00Z"
};

describe("operator public changelog publication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditCreateMock.mockResolvedValue({ id: "audit-1" } as never);
  });

  it("requires admin evidence-promotion permission", async () => {
    await expect(
      publishPublicChangelogEntryAsOperator(
        reviewer,
        {
          publicationNote: "Reviewed public wording.",
          slug: "claim-review-creatine-score-history"
        },
        publicationGateEnv
      )
    ).rejects.toMatchObject({
      message: "Operator role does not allow this action.",
      status: 403
    });

    expect(publicChangelogEntryFindUniqueMock).not.toHaveBeenCalled();
    expect(publicChangelogEntryUpdateMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("requires the dedicated publication execution control", async () => {
    await expect(
      publishPublicChangelogEntryAsOperator(
        admin,
        {
          publicationNote: "Reviewed public wording.",
          slug: "claim-review-creatine-score-history"
        },
        {
          APEX_OPERATOR_WRITES_ENABLED: "true"
        }
      )
    ).rejects.toThrow("APEX_PUBLIC_CHANGELOG_PUBLISH_REVIEWED_AT is required.");

    expect(publicChangelogEntryFindUniqueMock).not.toHaveBeenCalled();
    expect(publicChangelogEntryUpdateMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("requires a human publication note before lookup or writes", async () => {
    await expect(
      publishPublicChangelogEntryAsOperator(
        admin,
        {
          publicationNote: " ",
          slug: "claim-review-creatine-score-history"
        },
        publicationGateEnv
      )
    ).rejects.toThrow("Changelog publication note is required.");

    expect(publicChangelogEntryFindUniqueMock).not.toHaveBeenCalled();
    expect(publicChangelogEntryUpdateMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("refuses already published changelog entries", async () => {
    publicChangelogEntryFindUniqueMock.mockResolvedValue({
      claimId: "creatine-strength",
      id: "changelog-1",
      interventionId: "creatine",
      kind: "EVIDENCE_CARD",
      publishedAt: new Date("2026-06-14T00:00:00.000Z"),
      referenceId: "ref-creatine",
      scoreHistoryId: "score-history-1",
      slug: "claim-review-creatine-score-history",
      title: "Creatine source packet reviewed"
    } as never);

    await expect(
      publishPublicChangelogEntryAsOperator(
        admin,
        {
          publicationNote: "Reviewed public wording.",
          slug: "claim-review-creatine-score-history"
        },
        publicationGateEnv
      )
    ).rejects.toThrow("Public changelog entry is already published.");

    expect(publicChangelogEntryUpdateMock).not.toHaveBeenCalled();
    expect(auditCreateMock).not.toHaveBeenCalled();
    expect(transactionMock).toHaveBeenCalledTimes(1);
  });

  it("publishes a draft entry and records an audit event", async () => {
    const publishedAt = new Date("2026-06-14T01:30:00.000Z");
    publicChangelogEntryFindUniqueMock.mockResolvedValue({
      claimId: "creatine-strength",
      id: "changelog-1",
      interventionId: "creatine",
      kind: "EVIDENCE_CARD",
      publishedAt: null,
      referenceId: "ref-creatine",
      scoreHistoryId: "score-history-1",
      slug: "claim-review-creatine-score-history",
      title: "Creatine source packet reviewed"
    } as never);
    publicChangelogEntryUpdateMock.mockResolvedValue({ count: 1 } as never);
    publicChangelogEntryFindUniqueOrThrowMock.mockResolvedValue({
      id: "changelog-1",
      publishedAt,
      slug: "claim-review-creatine-score-history",
      title: "Creatine source packet reviewed"
    } as never);

    await expect(
      publishPublicChangelogEntryAsOperator(
        admin,
        {
          publicationNote: "Reviewed public wording and source traceability.",
          publishedAt,
          slug: "claim-review-creatine-score-history"
        },
        publicationGateEnv
      )
    ).resolves.toEqual({
      id: "changelog-1",
      publishedAt: "2026-06-14T01:30:00.000Z",
      slug: "claim-review-creatine-score-history",
      title: "Creatine source packet reviewed"
    });

    expect(publicChangelogEntryFindUniqueMock).toHaveBeenCalledWith({
      select: {
        claimId: true,
        id: true,
        interventionId: true,
        kind: true,
        publishedAt: true,
        referenceId: true,
        scoreHistoryId: true,
        slug: true,
        title: true
      },
      where: {
        slug: "claim-review-creatine-score-history"
      }
    });
    expect(publicChangelogEntryUpdateMock).toHaveBeenCalledWith({
      data: {
        publishedAt
      },
      where: {
        id: "changelog-1",
        publishedAt: null
      }
    });
    expect(publicChangelogEntryFindUniqueOrThrowMock).toHaveBeenCalledWith({
      select: {
        id: true,
        publishedAt: true,
        slug: true,
        title: true
      },
      where: {
        id: "changelog-1"
      }
    });
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(auditCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "publicChangelog.publish",
        actorEmail: admin.email,
        actorRole: OperatorRole.ADMIN,
        actorUserId: admin.userId,
        afterSummary: expect.objectContaining({
          id: "changelog-1",
          publishedAt: "2026-06-14T01:30:00.000Z",
          slug: "claim-review-creatine-score-history"
        }),
        beforeSummary: expect.objectContaining({
          id: "changelog-1",
          publishedAt: null,
          slug: "claim-review-creatine-score-history"
        }),
        metadata: expect.objectContaining({
          approvalAt: "2026-06-13T21:00:00Z",
          approvalKey: "APEX_PUBLIC_CHANGELOG_PUBLISH_REVIEWED_AT",
          claimId: "creatine-strength",
          scoreHistoryId: "score-history-1"
        }),
        note: "Reviewed public wording and source traceability.",
        targetId: "changelog-1",
        targetType: "PublicChangelogEntry"
      })
    });
    expect(globalPublicChangelogEntryUpdateMock).not.toHaveBeenCalled();
    expect(globalPublicChangelogEntryFindUniqueMock).not.toHaveBeenCalled();
    expect(globalAuditCreateMock).not.toHaveBeenCalled();
  });

  it("refuses a concurrent publication before recording audit", async () => {
    const publishedAt = new Date("2026-06-14T01:30:00.000Z");
    publicChangelogEntryFindUniqueMock.mockResolvedValue({
      claimId: "creatine-strength",
      id: "changelog-1",
      interventionId: "creatine",
      kind: "EVIDENCE_CARD",
      publishedAt: null,
      referenceId: "ref-creatine",
      scoreHistoryId: "score-history-1",
      slug: "claim-review-creatine-score-history",
      title: "Creatine source packet reviewed"
    } as never);
    publicChangelogEntryUpdateMock.mockResolvedValue({ count: 0 } as never);

    await expect(
      publishPublicChangelogEntryAsOperator(
        admin,
        {
          publicationNote: "Reviewed public wording and source traceability.",
          publishedAt,
          slug: "claim-review-creatine-score-history"
        },
        publicationGateEnv
      )
    ).rejects.toThrow("Public changelog entry is already published.");

    expect(publicChangelogEntryFindUniqueOrThrowMock).not.toHaveBeenCalled();
    expect(auditCreateMock).not.toHaveBeenCalled();
    expect(globalPublicChangelogEntryUpdateMock).not.toHaveBeenCalled();
    expect(globalAuditCreateMock).not.toHaveBeenCalled();
  });
});
