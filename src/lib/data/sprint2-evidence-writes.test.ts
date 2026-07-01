import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EvidenceLabel,
  ReviewStatus,
  ScoreChangeKind,
  SourcePacketStatus,
  StudyType
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const prismaMocks = vi.hoisted(() => ({
  claim: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn()
  },
  claimScoreHistory: {
    create: vi.fn(),
    findMany: vi.fn()
  },
  claimScoreSnapshot: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn()
  },
  claimStudy: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn()
  },
  publicChangelogEntry: {
    create: vi.fn(),
    findUnique: vi.fn()
  },
  sourcePacket: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn()
  },
  sourcePacketReference: {
    delete: vi.fn(),
    upsert: vi.fn()
  },
  study: {
    findMany: vi.fn()
  }
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMocks
}));

import { captureClaimScoreSnapshot } from "@/lib/data/score-history";
import { applyUpdateClaimScore } from "@/lib/data/score-update";
import { runSprint2Backfill } from "@/lib/data/sprint2-backfill";
import { syncSourcePacketForClaim } from "@/lib/data/source-packets";

describe("sprint2 normalized evidence writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a score snapshot and baseline history when none exists", async () => {
    prismaMocks.claimScoreSnapshot.findFirst.mockResolvedValue(null);
    prismaMocks.claimScoreSnapshot.create.mockResolvedValue({
      claimId: "creatine-strength",
      compositeScore: new Decimal(6.4),
      computedAt: new Date("2026-06-13T00:00:00.000Z"),
      effectSizeScore: 7,
      evidenceDirectnessScore: 8,
      evidenceRigorScore: 7,
      finalLabel: EvidenceLabel.USEFUL_FOR_SPECIFIC_USE_CASE,
      hypePenalty: 2,
      id: "snapshot-1",
      measurabilityScore: 6,
      productQualityScore: 6,
      rationale: "Human review snapshot.",
      regulatoryRiskScore: 3,
      reviewStatus: ReviewStatus.HUMAN_REVIEWED,
      safetyScore: 8,
      scoreVersion: "v1"
    });
    prismaMocks.claimScoreHistory.create.mockResolvedValue({ id: "history-1" });

    const result = await captureClaimScoreSnapshot(
      {
        effectSizeScore: 7,
        evidenceDirectnessScore: 8,
        evidenceRigorScore: 7,
        finalLabel: EvidenceLabel.USEFUL_FOR_SPECIFIC_USE_CASE,
        hypePenalty: 2,
        id: "creatine-strength",
        measurabilityScore: 6,
        productQualityScore: 6,
        regulatoryRiskScore: 3,
        reviewStatus: ReviewStatus.HUMAN_REVIEWED,
        safetyScore: 8
      },
      {
        claimId: "creatine-strength",
        rationale: "Human review snapshot.",
        reason: ScoreChangeKind.MANUAL_REVIEW
      }
    );

    expect(result.created).toBe(true);
    expect(result.snapshotId).toBe("snapshot-1");
    expect(result.historyId).toBe("history-1");
  });

  it("updates claim score fields and resets review status to AI draft", async () => {
    prismaMocks.claim.findUnique.mockResolvedValue({
      effectSizeScore: 2,
      evidenceDirectnessScore: 3,
      evidenceRigorScore: 3,
      finalLabel: EvidenceLabel.INSUFFICIENT_EVIDENCE,
      hypePenalty: 6,
      id: "creatine-strength",
      measurabilityScore: 4,
      productQualityScore: 3,
      regulatoryRiskScore: 5,
      reviewStatus: ReviewStatus.HUMAN_REVIEWED,
      safetyScore: 6
    });
    prismaMocks.claimScoreSnapshot.findFirst.mockResolvedValue(null);
    prismaMocks.claim.update.mockResolvedValue({
      effectSizeScore: 7,
      evidenceDirectnessScore: 8,
      evidenceRigorScore: 7,
      finalLabel: EvidenceLabel.USEFUL_FOR_SPECIFIC_USE_CASE,
      hypePenalty: 2,
      id: "creatine-strength",
      measurabilityScore: 6,
      productQualityScore: 6,
      regulatoryRiskScore: 3,
      reviewStatus: ReviewStatus.UNREVIEWED_AI_DRAFT,
      safetyScore: 8
    });
    prismaMocks.claimScoreSnapshot.create.mockResolvedValue({
      claimId: "creatine-strength",
      compositeScore: new Decimal(6.9),
      computedAt: new Date("2026-06-13T00:00:00.000Z"),
      effectSizeScore: 7,
      evidenceDirectnessScore: 8,
      evidenceRigorScore: 7,
      finalLabel: EvidenceLabel.USEFUL_FOR_SPECIFIC_USE_CASE,
      hypePenalty: 2,
      id: "snapshot-1",
      measurabilityScore: 6,
      productQualityScore: 6,
      rationale: "Reviewed source packet.",
      regulatoryRiskScore: 3,
      reviewStatus: ReviewStatus.UNREVIEWED_AI_DRAFT,
      safetyScore: 8,
      scoreVersion: "v1"
    });
    prismaMocks.claimScoreHistory.create.mockResolvedValue({ id: "history-1" });

    const result = await applyUpdateClaimScore({
      changedByUserId: "operator-1",
      claimId: "creatine-strength",
      finalLabel: "Useful for Specific Use Case",
      rationale: "Reviewed source packet.",
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
    });

    expect(result.updatedClaim).toBe(true);
    expect(result.result).toMatchObject({
      created: true,
      historyId: "history-1",
      snapshotId: "snapshot-1"
    });
    expect(prismaMocks.claim.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reviewStatus: ReviewStatus.UNREVIEWED_AI_DRAFT
        }),
        where: { id: "creatine-strength" }
      })
    );
    expect(prismaMocks.claimScoreSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reviewStatus: ReviewStatus.UNREVIEWED_AI_DRAFT
        })
      })
    );
  });

  it("syncs a current source packet from linked references and studies", async () => {
    prismaMocks.claim.findUnique.mockImplementation(async (args) => {
      if ("select" in args && args.select?.references) {
        return {
          references: [
            {
              reference: {
                studies: [
                  {
                    id: "study-creatine",
                    sourceType: StudyType.SYSTEMATIC_REVIEW
                  }
                ]
              }
            }
          ]
        };
      }

      return {
        id: "creatine-strength",
        interventionId: "creatine",
        references: [
          {
            reference: {
              id: "ref-creatine",
              identifier: "PMID:123",
              source: "PUBMED",
              title: "Creatine review",
              url: "https://example.test/creatine",
              year: 2026
            },
            referenceId: "ref-creatine"
          }
        ],
        reviewStatus: ReviewStatus.HUMAN_REVIEWED
      };
    });
    prismaMocks.study.findMany.mockResolvedValue([
      {
        adverseEvents: "None reported.",
        fundingConflicts: "None reported.",
        id: "study-creatine",
        interventionName: "Creatine",
        outcomes: ["Strength"],
        population: "Adults",
        referenceId: "ref-creatine",
        riskOfBias: "Low",
        sampleSize: "100",
        source: "PubMed",
        sourceType: StudyType.SYSTEMATIC_REVIEW,
        title: "Creatine extraction",
        year: 2026
      }
    ]);
    prismaMocks.sourcePacket.findFirst.mockResolvedValue(null);
    prismaMocks.sourcePacket.create.mockResolvedValue({
      claimId: "creatine-strength",
      current: true,
      id: "packet-1",
      interventionId: "creatine",
      references: [],
      reviewStatus: ReviewStatus.HUMAN_REVIEWED,
      status: SourcePacketStatus.COMPLETE
    });
    prismaMocks.sourcePacketReference.upsert.mockResolvedValue({});
    prismaMocks.claimStudy.findUnique.mockResolvedValue(null);
    prismaMocks.claimStudy.create.mockResolvedValue({});

    const result = await syncSourcePacketForClaim("creatine-strength");

    expect(result.created).toBe(true);
    expect(result.sourcePacketId).toBe("packet-1");
    expect(result.status).toBe(SourcePacketStatus.COMPLETE);
    expect(prismaMocks.sourcePacketReference.upsert).toHaveBeenCalled();
  });

  it("reports dry-run backfill counts without writing", async () => {
    prismaMocks.claim.findMany.mockResolvedValue([{ id: "creatine-strength" }]);
    prismaMocks.sourcePacket.findFirst.mockResolvedValue(null);
    prismaMocks.claimScoreSnapshot.findFirst.mockResolvedValue(null);
    prismaMocks.publicChangelogEntry.findUnique.mockResolvedValue(null);

    const summary = await runSprint2Backfill({ apply: false });

    expect(summary.applied).toBe(false);
    expect(summary.claimsProcessed).toBe(1);
    expect(summary.sourcePackets.created).toBe(1);
    expect(summary.scoreSnapshots.created).toBe(1);
    expect(summary.changelog.created).toBeGreaterThan(0);
    expect(prismaMocks.sourcePacket.create).not.toHaveBeenCalled();
  });
});
