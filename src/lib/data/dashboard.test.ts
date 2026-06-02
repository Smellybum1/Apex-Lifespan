import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const netSocketMocks = vi.hoisted(() => {
  type EventName = "connect" | "timeout" | "error";
  type EventHandler = () => void;

  class MockSocket {
    handlers: Partial<Record<EventName, EventHandler>> = {};
    setTimeout = vi.fn();
    once = vi.fn((event: EventName, handler: EventHandler) => {
      this.handlers[event] = handler;
      return this;
    });
    destroy = vi.fn();
    connect = vi.fn(() => {
      this.handlers.connect?.();
      return this;
    });
  }

  return {
    Socket: MockSocket,
    instances: [] as MockSocket[]
  };
});

const prismaFindManyMocks = vi.hoisted(() => ({
  australiaRegulatoryStatus: vi.fn(),
  claim: vi.fn(),
  intervention: vi.fn(),
  product: vi.fn(),
  reference: vi.fn(),
  safetyAlert: vi.fn(),
  study: vi.fn(),
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
    intervention: { findMany: prismaFindManyMocks.intervention },
    product: { findMany: prismaFindManyMocks.product },
    reference: { findMany: prismaFindManyMocks.reference },
    safetyAlert: { findMany: prismaFindManyMocks.safetyAlert },
    study: { findMany: prismaFindManyMocks.study },
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
    netSocketMocks.instances.length = 0;
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

  it("falls back to seed data when the configured database is unreachable", async () => {
    process.env.DATABASE_URL = "not-a-valid-database-url";

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

  it("maps database claim references and study extractions into a complete source packet", async () => {
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
            referenceId: "db-ref-creatine",
            relevance: 5,
            note: "Primary curated source."
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
    prismaFindManyMocks.safetyAlert.mockResolvedValue([]);
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
      }
    ]);
    expect(data.claims[0]?.keyReferenceIds).toEqual(["db-ref-creatine"]);
    expect(data.studies[0]).toMatchObject({
      id: "db-study-creatine",
      studyType: "Systematic review",
      referenceId: "db-ref-creatine"
    });
    expect(packet.references.map((reference) => reference.id)).toEqual(["db-ref-creatine"]);
    expect(packet.studies.map((study) => study.id)).toEqual(["db-study-creatine"]);
    expect(packet.pendingReferences).toEqual([]);
    expect(packet.missingReferenceIds).toEqual([]);
    expect(packet.completeness).toMatchObject({
      status: "complete",
      totalReferences: 1,
      extractedReferences: 1,
      pendingReferences: 0,
      missingReferences: 0
    });
    expect(prismaFindManyMocks.claim).toHaveBeenCalledWith({
      include: { references: true },
      orderBy: [{ finalLabel: "asc" }, { updatedAt: "desc" }]
    });
  });
});

function expectPrismaFindManyNotCalled() {
  Object.values(prismaFindManyMocks).forEach((findMany) => {
    expect(findMany).not.toHaveBeenCalled();
  });
}

function restoreEnv(key: "APEX_DATA_SOURCE" | "DATABASE_URL", value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
