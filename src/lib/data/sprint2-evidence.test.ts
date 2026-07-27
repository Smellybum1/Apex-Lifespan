import { StudyType as DbStudyType, PublicChangelogKind } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  claimStudyRelationForStudyType,
  snapshotsEquivalent,
  sourcePacketStatusFromCompleteness
} from "@/lib/data/evidence-model-mappers";
import { getPublicChangelogEntries, mapDbPublicChangelogEntry } from "@/lib/data/public-changelog";
import { compositeScore } from "@/lib/scoring";
describe("evidence-model mappers", () => {
  it("maps source-packet completeness to prisma status", () => {
    expect(sourcePacketStatusFromCompleteness("complete")).toBe("COMPLETE");
    expect(sourcePacketStatusFromCompleteness("extraction_pending")).toBe("EXTRACTION_PENDING");
    expect(sourcePacketStatusFromCompleteness("missing_sources")).toBe("MISSING_SOURCES");
    expect(sourcePacketStatusFromCompleteness("not_linked")).toBe("NOT_LINKED");
  });

  it("infers claim-study relations from study type", () => {
    expect(claimStudyRelationForStudyType(DbStudyType.REGULATORY_SAFETY_WARNING)).toBe(
      "SAFETY_REGULATORY"
    );
    expect(claimStudyRelationForStudyType(DbStudyType.RANDOMIZED_CONTROLLED_TRIAL)).toBe(
      "SUPPORTS"
    );
    expect(claimStudyRelationForStudyType(DbStudyType.ANIMAL_STUDY)).toBe("UNREVIEWED_LEAD");
  });

  it("detects equivalent score snapshots", () => {
    const scores = {
      compositeScore: 6.4,
      effectSize: 7,
      evidenceDirectness: 8,
      evidenceRigor: 7,
      finalLabel: "Useful for Specific Use Case" as const,
      hypePenalty: 2,
      measurability: 6,
      productQuality: 6,
      regulatoryRisk: 3,
      safety: 8
    };

    expect(snapshotsEquivalent(scores, { ...scores })).toBe(true);
    expect(snapshotsEquivalent(scores, { ...scores, compositeScore: 6.5 })).toBe(false);
  });
});

describe("public changelog hydration", () => {
  it("maps database changelog rows with score-change payloads", () => {
    const entry = mapDbPublicChangelogEntry({
      claimId: null,
      createdAt: new Date("2026-06-12T00:00:00.000Z"),
      date: new Date("2026-06-12T00:00:00.000Z"),
      details: {
        bullets: ["Safety caveats were made visible."],
        scoreChange: {
          after: "5.9",
          before: "6.2",
          label: "Omega-3 CV events",
          reason: "Safety signal visibility."
        }
      },
      id: "omega-3-cv-safety-score-update",
      interventionId: null,
      kind: PublicChangelogKind.SCORING,
      publicImpact: "Safety caveats affect interpretation.",
      publishedAt: new Date("2026-06-12T00:00:00.000Z"),
      referenceId: null,
      scoreHistoryId: null,
      slug: "omega-3-cv-safety-score-update",
      title: "Updated omega-3 cardiovascular event scoring",
      updatedAt: new Date("2026-06-12T00:00:00.000Z")
    });

    expect(entry.kind).toBe("Scoring");
    expect(entry.details).toEqual(["Safety caveats were made visible."]);
    expect(entry.scoreChange?.before).toBe("6.2");
  });

  it("falls back to static changelog entries when database reads fail", async () => {
    const entries = await getPublicChangelogEntries();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((entry) => entry.id === "score-formula-tooltips")).toBe(true);
  });
});

describe("score recompute helpers", () => {
  it("computes composite scores from claim score components", () => {
    const composite = compositeScore({
      effectSize: 7,
      evidenceDirectness: 8,
      evidenceRigor: 7,
      hypePenalty: 2,
      measurability: 6,
      productQuality: 6,
      regulatoryRisk: 3,
      safety: 8
    });

    expect(composite).toBeGreaterThan(0);
  });
});
