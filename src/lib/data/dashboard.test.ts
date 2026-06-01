import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const originalEnv = {
  APEX_DATA_SOURCE: process.env.APEX_DATA_SOURCE,
  DATABASE_URL: process.env.DATABASE_URL
};

describe("getEvidenceDashboardData data source behavior", () => {
  beforeEach(() => {
    delete process.env.APEX_DATA_SOURCE;
    delete process.env.DATABASE_URL;
    vi.clearAllMocks();
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
