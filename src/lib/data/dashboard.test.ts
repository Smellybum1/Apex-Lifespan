import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const netSocketMocks = vi.hoisted(() => {
  type EventName = "connect" | "timeout" | "error";
  type EventHandler = () => void;
  const state = { nextEvent: "connect" as EventName };

  class MockSocket {
    handlers: Partial<Record<EventName, EventHandler>> = {};
    setTimeout = vi.fn();
    once = vi.fn((event: EventName, handler: EventHandler) => {
      this.handlers[event] = handler;
      return this;
    });
    destroy = vi.fn();
    connect = vi.fn(() => {
      this.handlers[state.nextEvent]?.();
      return this;
    });
  }

  return {
    Socket: MockSocket,
    instances: [] as MockSocket[],
    state
  };
});

const prismaFindManyMocks = vi.hoisted(() => ({
  australiaRegulatoryStatus: vi.fn(),
  claim: vi.fn(),
  claimScoreHistory: vi.fn(),
  claimScoreSnapshot: vi.fn(),
  intervention: vi.fn(),
  product: vi.fn(),
  reference: vi.fn(),
  safetyAlert: vi.fn(),
  study: vi.fn(),
  trialAlert: vi.fn(),
  trial: vi.fn()
}));

vi.mock("node:net", () => ({
  Socket: vi.fn(function Socket() {
    const socket = new netSocketMocks.Socket();
    netSocketMocks.instances.push(socket);
    return socket;
  })
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    australiaRegulatoryStatus: { findMany: prismaFindManyMocks.australiaRegulatoryStatus },
    claim: { findMany: prismaFindManyMocks.claim },
    claimScoreHistory: { findMany: prismaFindManyMocks.claimScoreHistory },
    claimScoreSnapshot: { findMany: prismaFindManyMocks.claimScoreSnapshot },
    intervention: { findMany: prismaFindManyMocks.intervention },
    product: { findMany: prismaFindManyMocks.product },
    reference: { findMany: prismaFindManyMocks.reference },
    safetyAlert: { findMany: prismaFindManyMocks.safetyAlert },
    study: { findMany: prismaFindManyMocks.study },
    trialAlert: { findMany: prismaFindManyMocks.trialAlert },
    trial: { findMany: prismaFindManyMocks.trial }
  }
}));

import { getEvidenceDashboardData } from "@/lib/data/dashboard";
import { claims, interventions } from "@/lib/seed-data";
import { buildClaimSourcePacket } from "@/lib/source-packet";

const originalEnv = {
  APEX_DATA_SOURCE: process.env.APEX_DATA_SOURCE,
  DATABASE_URL: process.env.DATABASE_URL
};

describe("getEvidenceDashboardData data source behavior", () => {
  beforeEach(() => {
    delete process.env.APEX_DATA_SOURCE;
    delete process.env.DATABASE_URL;
    vi.clearAllMocks();
    resetPrismaFindManyMocks();
    netSocketMocks.instances.length = 0;
    netSocketMocks.state.nextEvent = "connect";
  });

  afterEach(() => {
    restoreEnv("APEX_DATA_SOURCE", originalEnv.APEX_DATA_SOURCE);
    restoreEnv("DATABASE_URL", originalEnv.DATABASE_URL);
  });

  it("uses seed data when seed mode is forced", async () => {
    process.env.APEX_DATA_SOURCE = "seed";
    process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:1/apex_lifespan";

    const data = await getEvidenceDashboardData();

    expect(data.dataSource).toBe("seed");
    expect(data.fallbackReason).toBe("Seed mode forced by APEX_DATA_SOURCE.");
    expect(data.claims).toHaveLength(claims.length);
    expect(data.interventions).toHaveLength(interventions.length);
    expectPrismaFindManyNotCalled();
  });

  it("falls back to seed data when DATABASE_URL is missing", async () => {
    const data = await getEvidenceDashboardData();

    expect(data.dataSource).toBe("seed");
    expect(data.fallbackReason).toBe("DATABASE_URL is not configured, using seed data.");
    expect(data.claims[0]?.id).toBe(claims[0]?.id);
    expectPrismaFindManyNotCalled();
  });

  it("falls back to seed data when DATABASE_URL is invalid", async () => {
    process.env.DATABASE_URL = "not-a-valid-database-url";

    const data = await getEvidenceDashboardData();

    expect(data.dataSource).toBe("seed");
    expect(data.fallbackReason).toBe("DATABASE_URL is invalid, using seed data.");
    expect(data.interventions[0]?.id).toBe(interventions[0]?.id);
    expectPrismaFindManyNotCalled();
  });

  it("falls back to seed data when the configured database is unreachable", async () => {
    process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:1/apex_lifespan";
    netSocketMocks.state.nextEvent = "error";

    const data = await getEvidenceDashboardData();

    expect(data.dataSource).toBe("seed");
    expect(data.fallbackReason).toBe("Database is not reachable, using seed data.");
    expect(data.interventions[0]?.id).toBe(interventions[0]?.id);
    expectPrismaFindManyNotCalled();
  });

  it("fails instead of falling back when strict database mode has no database", async () => {
    process.env.APEX_DATA_SOURCE = "database";

    await expect(getEvidenceDashboardData()).rejects.toThrow(
      "DATABASE_URL is not configured, using seed data."
    );
    expectPrismaFindManyNotCalled();
  });

  it("does not expose raw database query errors in seed fallback reasons", async () => {
    process.env.DATABASE_URL = "postgresql://postgres:secret@127.0.0.1:5432/apex_lifespan";
    prismaFindManyMocks.reference.mockRejectedValue(
      new Error("Query failed for postgresql://postgres:secret@127.0.0.1:5432/apex_lifespan")
    );

    const data = await getEvidenceDashboardData();

    expect(data.dataSource).toBe("seed");
    expect(data.fallbackReason).toBe("Database query failed, using seed data.");
    expect(data.fallbackReason).not.toContain("secret");
    expect(data.fallbackReason).not.toContain("postgresql://");
  });

  it("reports missing migrations safely in strict database mode", async () => {
    process.env.APEX_DATA_SOURCE = "database";
    process.env.DATABASE_URL = "postgresql://postgres:secret@127.0.0.1:5432/apex_lifespan";
    prismaFindManyMocks.claimScoreSnapshot.mockRejectedValue(
      new Error(
        "Invalid prisma.claimScoreSnapshot.findMany() invocation: The table `public.ClaimScoreSnapshot` does not exist in the current database. postgresql://postgres:secret@127.0.0.1:5432/apex_lifespan"
      )
    );

    await expect(getEvidenceDashboardData()).rejects.toThrow(
      "Database schema is missing required table ClaimScoreSnapshot; run approved migrations before strict database smoke."
    );
    await expect(getEvidenceDashboardData()).rejects.not.toThrow("secret");
    await expect(getEvidenceDashboardData()).rejects.not.toThrow("postgresql://");
  });

  it("falls back to seed data in auto mode when the database is connected but empty", async () => {
    process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/apex_lifespan";
    mockEmptyDatabase();

    const data = await getEvidenceDashboardData();

    expect(data.dataSource).toBe("seed");
    expect(data.fallbackReason).toBe("Database connected but has not been seeded yet.");
  });

  it("fails instead of falling back when strict database mode is connected but empty", async () => {
    process.env.APEX_DATA_SOURCE = "database";
    process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/apex_lifespan";
    mockEmptyDatabase();

    await expect(getEvidenceDashboardData()).rejects.toThrow(
      "Database connected but has not been seeded yet."
    );
  });

  it("maps current source packet references and study extractions into a complete packet", async () => {
    process.env.APEX_DATA_SOURCE = "database";
    process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/apex_lifespan";
    prismaFindManyMocks.reference.mockResolvedValue([
      {
        id: "db-ref-creatine",
        title: "Creatine supplementation and muscle strength: a systematic review",
        source: "PUBMED",
        identifier: "PMID:123456",
        year: 2026,
        url: "https://pubmed.ncbi.nlm.nih.gov/123456/"
      },
      {
        id: "db-ref-stale-legacy",
        title: "Legacy creatine reference kept for merge coverage",
        source: "PUBMED",
        identifier: "PMID:999999",
        year: 2015,
        url: "https://pubmed.ncbi.nlm.nih.gov/999999/"
      }
    ]);
    prismaFindManyMocks.intervention.mockResolvedValue([
      {
        id: "db-creatine",
        name: "Creatine",
        slug: "creatine",
        synonyms: ["creatine monohydrate"],
        category: "ERGOGENIC_PERFORMANCE_SUPPLEMENT",
        commonForms: ["Powder"],
        australiaRegulatoryStatus: "Product-level ARTG/AUST status requires verification.",
        regulatorySummary: "Product-level status requires verification.",
        safetySummary: "Generally well tolerated in studied adults.",
        interactionSummary: "Use clinician review for kidney disease or interacting medicines.",
        evidenceSummary: "Evidence strongest for strength and performance outcomes.",
        lastReviewedAt: new Date("2026-06-01T00:00:00.000Z")
      }
    ]);
    prismaFindManyMocks.claim.mockResolvedValue([
      {
        id: "db-claim-creatine-strength",
        interventionId: "db-creatine",
        outcome: "MUSCLE_STRENGTH",
        claimText: "Creatine can improve strength outcomes in adults doing resistance training.",
        populationStudied: "Adults doing resistance training.",
        doseFormStudied: "Creatine monohydrate.",
        durationStudied: "6-12 weeks.",
        comparator: "Placebo.",
        evidenceGrade: "B",
        effectSize: "Modest improvement in strength measures.",
        clinicalRelevance: "Useful for a specific training goal.",
        confidenceLevel: "MODERATE",
        safetyNotes: "Avoid implying individualized dosing advice.",
        applicabilityNotes: "Applies to studied adult populations.",
        evidenceDirectnessScore: 82,
        evidenceRigorScore: 78,
        effectSizeScore: 70,
        safetyScore: 76,
        regulatoryRiskScore: 62,
        productQualityScore: 64,
        hypePenalty: 8,
        measurabilityScore: 72,
        finalLabel: "USEFUL_FOR_SPECIFIC_USE_CASE",
        momentum: "STABLE",
        reviewStatus: "HUMAN_REVIEWED",
        whatWouldChangeScore: "More AU product-level verification would improve confidence.",
        lastReviewedAt: new Date("2026-06-01T00:00:00.000Z"),
        updatedAt: new Date("2026-06-01T00:00:00.000Z"),
        references: [
          {
            claimId: "db-claim-creatine-strength",
            referenceId: "db-ref-stale-legacy",
            relevance: 5,
            note: "Legacy link kept for fallback only."
          }
        ],
        sourcePackets: [
          {
            id: "db-source-packet-creatine-strength",
            claimId: "db-claim-creatine-strength",
            interventionId: "db-creatine",
            status: "COMPLETE",
            reviewStatus: "HUMAN_REVIEWED",
            citationStatus: "Citation checked",
            extractionNote: "Structured extraction fixture.",
            reviewerNotes: null,
            current: true,
            createdAt: new Date("2026-06-01T00:00:00.000Z"),
            updatedAt: new Date("2026-06-01T00:00:00.000Z"),
            references: [
              {
                sourcePacketId: "db-source-packet-creatine-strength",
                referenceId: "db-ref-creatine",
                extractionStatus: "Complete",
                citationStatus: "Citation checked",
                note: "Current normalized source-packet link.",
                createdAt: new Date("2026-06-01T00:00:00.000Z")
              }
            ]
          }
        ],
        studyLinks: [
          {
            claimId: "db-claim-creatine-strength",
            createdAt: new Date("2026-06-01T00:00:00.000Z"),
            humanReviewedAt: new Date("2026-06-01T00:00:00.000Z"),
            note: "Structured extraction supports this claim.",
            relation: "SUPPORTS",
            relevanceScore: 9,
            studyId: "db-study-creatine",
            updatedAt: new Date("2026-06-01T00:00:00.000Z")
          }
        ]
      }
    ]);
    prismaFindManyMocks.study.mockResolvedValue([
      {
        id: "db-study-creatine",
        title: "Structured extraction for creatine strength",
        year: 2026,
        source: "PubMed",
        sourceType: "SYSTEMATIC_REVIEW",
        sampleSize: "Systematic review fixture.",
        population: "Adults.",
        interventionName: "Creatine.",
        outcomes: ["Strength"],
        adverseEvents: "No serious signal in this fixture.",
        fundingConflicts: "Not assessed in this fixture.",
        riskOfBias: "Moderate.",
        referenceId: "db-ref-creatine"
      }
    ]);
    prismaFindManyMocks.trial.mockResolvedValue([]);
    prismaFindManyMocks.trialAlert.mockResolvedValue([
      {
        claimId: "db-claim-creatine-strength",
        createdAt: new Date("2026-06-03T00:00:00.000Z"),
        detectedAt: new Date("2026-06-03T00:00:00.000Z"),
        detail:
          "Posted registry results are an operator review alert. Do not change public scores until outcomes are extracted, citation-linked, and human-reviewed.",
        id: "trial-alert-creatine-results",
        interventionId: "db-creatine",
        kind: "RESULTS_REVIEW_NEEDED",
        metadata: {},
        nctId: "NCT123",
        noAutoPromotion: true,
        referenceId: null,
        reviewedAt: null,
        reviewerNotes: null,
        scoreHistoryId: null,
        sourceCandidateId: null,
        status: "OPEN",
        title: "Creatine trial results need review",
        trialId: null,
        updatedAt: new Date("2026-06-03T00:00:00.000Z")
      }
    ]);
    prismaFindManyMocks.safetyAlert.mockResolvedValue([]);
    prismaFindManyMocks.claimScoreHistory.mockResolvedValue([
      {
        id: "db-score-history-creatine-strength",
        claimId: "db-claim-creatine-strength",
        previousSnapshotId: "previous-score-snapshot",
        newSnapshotId: "db-score-snapshot-creatine-strength",
        oldCompositeScore: "6.81",
        newCompositeScore: "7.21",
        oldLabel: "REASONABLE_N_OF_1_EXPERIMENT",
        newLabel: "USEFUL_FOR_SPECIFIC_USE_CASE",
        reason: "MANUAL_REVIEW",
        rationale: "Human-reviewed source packet changed the public score row.",
        referenceId: "db-ref-creatine",
        changedByUserId: "user-admin",
        createdAt: new Date("2026-06-02T00:00:00.000Z")
      }
    ]);
    prismaFindManyMocks.claimScoreSnapshot.mockResolvedValue([
      {
        id: "db-score-snapshot-creatine-strength",
        claimId: "db-claim-creatine-strength",
        scoreVersion: "v1",
        evidenceDirectnessScore: 82,
        evidenceRigorScore: 78,
        effectSizeScore: 70,
        safetyScore: 76,
        regulatoryRiskScore: 62,
        productQualityScore: 64,
        hypePenalty: 8,
        measurabilityScore: 72,
        compositeScore: "7.21",
        finalLabel: "USEFUL_FOR_SPECIFIC_USE_CASE",
        reviewStatus: "HUMAN_REVIEWED",
        rationale: "Human-reviewed score snapshot fixture.",
        computedAt: new Date("2026-06-02T00:00:00.000Z"),
        createdAt: new Date("2026-06-02T00:00:00.000Z")
      }
    ]);
    prismaFindManyMocks.product.mockResolvedValue([]);
    prismaFindManyMocks.australiaRegulatoryStatus.mockResolvedValue([]);

    const data = await getEvidenceDashboardData();
    const referencesById = new Map(data.references.map((reference) => [reference.id, reference]));
    const packet = buildClaimSourcePacket({
      claim: data.claims[0]!,
      referencesById,
      studies: data.studies
    });

    expect(data.dataSource).toBe("database");
    expect(data.references).toMatchObject([
      {
        id: "db-ref-creatine",
        source: "PubMed",
        identifier: "PMID:123456",
        year: 2026
      },
      {
        id: "db-ref-stale-legacy",
        source: "PubMed",
        identifier: "PMID:999999",
        year: 2015
      }
    ]);
    expect(data.claims[0]?.keyReferenceIds).toEqual([
      "db-ref-creatine",
      "db-ref-stale-legacy"
    ]);
    expect(data.claims[0]?.keyStudyIds).toEqual(["db-study-creatine"]);
    expect(data.studies[0]).toMatchObject({
      id: "db-study-creatine",
      studyType: "Systematic review",
      referenceId: "db-ref-creatine"
    });
    expect(data.trialAlerts).toEqual([
      {
        claimId: "db-claim-creatine-strength",
        detectedAt: "2026-06-03",
        detail:
          "Posted registry results are an operator review alert. Do not change public scores until outcomes are extracted, citation-linked, and human-reviewed.",
        id: "trial-alert-creatine-results",
        interventionId: "db-creatine",
        kind: "Results review needed",
        nctId: "NCT123",
        noAutoPromotion: true,
        status: "Open",
        title: "Creatine trial results need review"
      }
    ]);
    expect(data.scoreHistory).toEqual([
      {
        claimId: "db-claim-creatine-strength",
        createdAt: "2026-06-02",
        id: "db-score-history-creatine-strength",
        newCompositeScore: 7.21,
        newLabel: "Useful for Specific Use Case",
        oldCompositeScore: 6.81,
        oldLabel: "Reasonable N-of-1 Experiment",
        rationale: "Human-reviewed source packet changed the public score row.",
        reason: "Manual review",
        referenceId: "db-ref-creatine"
      }
    ]);
    expect(data.scoreSnapshots).toEqual([
      {
        claimId: "db-claim-creatine-strength",
        compositeScore: 7.21,
        computedAt: "2026-06-02",
        finalLabel: "Useful for Specific Use Case",
        id: "db-score-snapshot-creatine-strength",
        rationale: "Human-reviewed score snapshot fixture.",
        reviewStatus: "Human reviewed",
        scoreVersion: "v1",
        scores: {
          evidenceDirectness: 82,
          evidenceRigor: 78,
          effectSize: 70,
          hypePenalty: 8,
          measurability: 72,
          productQuality: 64,
          regulatoryRisk: 62,
          safety: 76
        }
      }
    ]);
    expect(packet.references.map((reference) => reference.id)).toEqual([
      "db-ref-creatine",
      "db-ref-stale-legacy"
    ]);
    expect(packet.studies.map((study) => study.id)).toEqual(["db-study-creatine"]);
    expect(packet.pendingReferences).toEqual([
      expect.objectContaining({ id: "db-ref-stale-legacy" })
    ]);
    expect(packet.missingReferenceIds).toEqual([]);
    expect(packet.completeness).toMatchObject({
      status: "extraction_pending",
      totalReferences: 2,
      extractedReferences: 1,
      pendingReferences: 1,
      missingReferences: 0
    });
    expect(prismaFindManyMocks.claim).toHaveBeenCalledWith({
      include: {
        references: true,
        sourcePackets: {
          include: {
            references: {
              orderBy: { createdAt: "asc" }
            }
          },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          where: { current: true }
        },
        studyLinks: {
          orderBy: [{ relevanceScore: "desc" }, { updatedAt: "desc" }],
          where: {
            relation: {
              not: "UNREVIEWED_LEAD"
            }
          }
        }
      },
      orderBy: [{ finalLabel: "asc" }, { updatedAt: "desc" }]
    });
  });
});

function expectPrismaFindManyNotCalled() {
  Object.values(prismaFindManyMocks).forEach((findMany) => {
    expect(findMany).not.toHaveBeenCalled();
  });
}

function resetPrismaFindManyMocks() {
  Object.values(prismaFindManyMocks).forEach((findMany) => {
    findMany.mockReset();
  });
}

function mockEmptyDatabase() {
  Object.values(prismaFindManyMocks).forEach((findMany) => {
    findMany.mockResolvedValue([]);
  });
}

function restoreEnv(key: "APEX_DATA_SOURCE" | "DATABASE_URL", value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
