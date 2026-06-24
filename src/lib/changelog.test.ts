import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  publicChangelogEntryFindMany: vi.fn()
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    publicChangelogEntry: {
      findMany: prismaMocks.publicChangelogEntryFindMany
    }
  }
}));

import {
  getPublicChangelogEntries,
  publicChangelogEntries
} from "@/lib/changelog";

describe("getPublicChangelogEntries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps published database changelog rows before static fallback entries", async () => {
    prismaMocks.publicChangelogEntryFindMany.mockResolvedValue([
      {
        claimId: "creatine-strength",
        createdAt: new Date("2026-06-14T00:00:00.000Z"),
        date: new Date("2026-06-14T00:00:00.000Z"),
        details: ["Human-reviewed source packet was published."],
        id: "db-changelog-1",
        interventionId: "creatine",
        kind: "EVIDENCE_CARD",
        publicImpact: "Readers can trace the reviewed evidence card update.",
        publishedAt: new Date("2026-06-14T00:00:00.000Z"),
        referenceId: null,
        scoreHistoryId: "score-history-1",
        slug: "creatine-strength-reviewed",
        title: "Creatine source packet reviewed",
        updatedAt: new Date("2026-06-14T00:00:00.000Z")
      }
    ]);

    const entries = await getPublicChangelogEntries();

    expect(entries[0]).toMatchObject({
      date: "2026-06-14",
      details: ["Human-reviewed source packet was published."],
      id: "creatine-strength-reviewed",
      kind: "Evidence card",
      publicImpact: "Readers can trace the reviewed evidence card update.",
      title: "Creatine source packet reviewed"
    });
    expect(entries[1]).toEqual(publicChangelogEntries[0]);
    expect(prismaMocks.publicChangelogEntryFindMany).toHaveBeenCalledWith({
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      where: {
        publishedAt: {
          not: null
        }
      }
    });
  });

  it("falls back to static entries when the database is unavailable", async () => {
    prismaMocks.publicChangelogEntryFindMany.mockRejectedValue(new Error("No database"));

    await expect(getPublicChangelogEntries()).resolves.toEqual(publicChangelogEntries);
  });
});
