import { OperatorRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { getOperatorAuditTrailSnapshot } from "@/lib/operator/audit-trail";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    operatorAuditEvent: {
      findMany: vi.fn()
    }
  }
}));

const findManyMock = vi.mocked(prisma.operatorAuditEvent.findMany);

describe("operator audit trail snapshot", () => {
  beforeEach(() => {
    findManyMock.mockReset();
  });

  it("returns recent audit rows without exposing JSON summaries", async () => {
    findManyMock.mockResolvedValue([
      {
        action: "sourceCandidate.reviewDecision",
        actorEmail: "reviewer@example.com",
        actorRole: OperatorRole.REVIEWER,
        createdAt: new Date("2026-06-11T01:02:03.000Z"),
        id: "audit-1",
        note: "Accepted after source packet review.\nNo promotion yet.",
        targetId: "pubmed:creatine:42141930",
        targetType: "SourceCandidate"
      }
    ] as never);

    await expect(getOperatorAuditTrailSnapshot(5)).resolves.toEqual({
      eventCount: 1,
      rows: [
        {
          action: "sourceCandidate.reviewDecision",
          actorEmail: "reviewer@example.com",
          actorRole: "REVIEWER",
          createdAt: "2026-06-11T01:02:03.000Z",
          id: "audit-1",
          notePreview: "Accepted after source packet review. No promotion yet.",
          target: "SourceCandidate pubmed:creatine:42141930"
        }
      ]
    });
    expect(findManyMock).toHaveBeenCalledWith({
      orderBy: {
        createdAt: "desc"
      },
      select: {
        action: true,
        actorEmail: true,
        actorRole: true,
        createdAt: true,
        id: true,
        note: true,
        targetId: true,
        targetType: true
      },
      take: 5
    });
  });

  it("bounds requested limits and truncates long notes", async () => {
    findManyMock.mockResolvedValue([
      {
        action: "sourceCandidate.publicEvidencePromotion",
        actorEmail: "admin@example.com",
        actorRole: OperatorRole.ADMIN,
        createdAt: new Date("2026-06-11T01:02:03.000Z"),
        id: "audit-2",
        note: "x".repeat(140),
        targetId: null,
        targetType: "SourceCandidate"
      }
    ] as never);

    const snapshot = await getOperatorAuditTrailSnapshot(500);

    expect(snapshot.rows[0].notePreview).toHaveLength(120);
    expect(snapshot.rows[0].notePreview?.endsWith("...")).toBe(true);
    expect(snapshot.rows[0].target).toBe("SourceCandidate");
    expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
  });
});
