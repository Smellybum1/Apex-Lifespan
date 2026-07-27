import {
  ReviewStatus as DbReviewStatus,
  SourceCandidateDecision as DbSourceCandidateDecision,
  SourceKind as DbSourceKind
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildOperatorQaFixturePlan,
  OPERATOR_QA_FIXTURE_CLAIM_ID,
  OPERATOR_QA_FIXTURE_DEDUPE_KEY,
  OPERATOR_QA_FIXTURE_ENABLED_ENV,
  OPERATOR_QA_FIXTURE_REFERENCE_ID,
  OPERATOR_QA_FIXTURE_REFERENCE_URL,
  syncOperatorQaFixture,
  type OperatorQaFixtureClient
} from "@/lib/operator/qa-fixture";

describe("operator QA fixture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips local runs", () => {
    expect(
      buildOperatorQaFixturePlan({
        [OPERATOR_QA_FIXTURE_ENABLED_ENV]: "true"
      })
    ).toMatchObject({
      action: "skip",
      enabled: true
    });
  });

  it("blocks production fixture seeding", () => {
    expect(
      buildOperatorQaFixturePlan({
        [OPERATOR_QA_FIXTURE_ENABLED_ENV]: "true",
        VERCEL: "1",
        VERCEL_ENV: "production"
      })
    ).toEqual({
      action: "blocked",
      blockers: [`${OPERATOR_QA_FIXTURE_ENABLED_ENV}=true is not allowed in production.`],
      detail: "Operator QA fixture is Preview-only.",
      enabled: true,
      targetEnvironment: "production"
    });
  });

  it("cleans preview fixture rows when the flag is absent", async () => {
    const client = fixtureClient();

    await expect(
      syncOperatorQaFixture({
        client,
        env: {
          VERCEL: "1",
          VERCEL_ENV: "preview"
        }
      })
    ).resolves.toMatchObject({
      action: "cleanup",
      cleanup: {
        references: 1,
        sourceCandidates: 1
      }
    });
    expect(client.tx.sourceCandidate.deleteMany).toHaveBeenCalledWith({
      where: {
        dedupeKey: OPERATOR_QA_FIXTURE_DEDUPE_KEY
      }
    });
    expect(client.tx.reference.deleteMany).toHaveBeenCalledWith({
      where: {
        id: OPERATOR_QA_FIXTURE_REFERENCE_ID
      }
    });
  });

  it("seeds a pending preview candidate and matching reference", async () => {
    const client = fixtureClient();

    await expect(
      syncOperatorQaFixture({
        client,
        env: {
          [OPERATOR_QA_FIXTURE_ENABLED_ENV]: "true",
          VERCEL: "1",
          VERCEL_ENV: "preview"
        }
      })
    ).resolves.toMatchObject({
      action: "seed",
      fixture: {
        acceptedReferenceId: OPERATOR_QA_FIXTURE_REFERENCE_ID,
        claimId: OPERATOR_QA_FIXTURE_CLAIM_ID,
        dedupeKey: OPERATOR_QA_FIXTURE_DEDUPE_KEY
      }
    });
    expect(client.tx.reference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          id: OPERATOR_QA_FIXTURE_REFERENCE_ID,
          source: DbSourceKind.PUBMED,
          url: OPERATOR_QA_FIXTURE_REFERENCE_URL
        })
      })
    );
    expect(client.tx.sourceCandidate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          acceptedReferenceId: null,
          claimId: OPERATOR_QA_FIXTURE_CLAIM_ID,
          decision: DbSourceCandidateDecision.PENDING_REVIEW,
          dedupeKey: OPERATOR_QA_FIXTURE_DEDUPE_KEY,
          reviewStatus: DbReviewStatus.UNREVIEWED_AI_DRAFT,
          source: DbSourceKind.PUBMED,
          triageScore: 100
        })
      })
    );
  });

  it("fails clearly if preview seed data is missing", async () => {
    const client = fixtureClient({
      claim: null
    });

    await expect(
      syncOperatorQaFixture({
        client,
        env: {
          [OPERATOR_QA_FIXTURE_ENABLED_ENV]: "true",
          VERCEL: "1",
          VERCEL_ENV: "preview"
        }
      })
    ).rejects.toThrow("Operator QA fixture requires Preview seed claim creatine-strength.");
    expect(client.tx.reference.upsert).not.toHaveBeenCalled();
  });
});

function fixtureClient(options: { claim?: { id: string } | null } = {}) {
  const claim = Object.hasOwn(options, "claim")
    ? options.claim
    : { id: OPERATOR_QA_FIXTURE_CLAIM_ID };
  const tx = {
    claim: {
      findUnique: vi.fn().mockResolvedValue(claim)
    },
    claimReference: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    operatorAuditEvent: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    reference: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      upsert: vi.fn().mockResolvedValue({})
    },
    sourceCandidate: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      upsert: vi.fn().mockResolvedValue({})
    },
    sourceDocument: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    study: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 })
    }
  };
  const client = {
    $transaction: vi.fn(async (callback) => callback(tx)),
    tx
  };

  return client as typeof client & OperatorQaFixtureClient;
}
