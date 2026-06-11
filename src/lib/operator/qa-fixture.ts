import {
  ReviewStatus as DbReviewStatus,
  SourceCandidateDecision as DbSourceCandidateDecision,
  SourceKind as DbSourceKind
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export const OPERATOR_QA_FIXTURE_ENABLED_ENV = "APEX_OPERATOR_QA_FIXTURE_ENABLED";
export const OPERATOR_QA_FIXTURE_CLAIM_ID = "creatine-strength";
export const OPERATOR_QA_FIXTURE_DEDUPE_KEY =
  "operator-qa|preview|pubmed|90000001|creatine|creatine-strength";
export const OPERATOR_QA_FIXTURE_INTERVENTION_ID = "creatine";
export const OPERATOR_QA_FIXTURE_REFERENCE_ID =
  "operator-qa-reference-preview-creatine-strength";
export const OPERATOR_QA_FIXTURE_REFERENCE_URL =
  "https://pubmed.ncbi.nlm.nih.gov/90000001/";

export type OperatorQaFixtureAction = "blocked" | "cleanup" | "seed" | "skip";

export interface OperatorQaFixturePlan {
  action: OperatorQaFixtureAction;
  blockers: string[];
  detail: string;
  enabled: boolean;
  targetEnvironment?: string;
}

export interface OperatorQaFixtureResult extends OperatorQaFixturePlan {
  cleanup?: OperatorQaFixtureCleanupSummary;
  fixture?: {
    acceptedReferenceId: string;
    claimId: string;
    dedupeKey: string;
    interventionId: string;
  };
}

export interface OperatorQaFixtureCleanupSummary {
  auditEvents: number;
  claimReferences: number;
  sourceCandidates: number;
  sourceDocuments: number;
  studies: number;
  references: number;
}

export interface OperatorQaFixtureClient {
  $transaction<T>(
    callback: (transaction: OperatorQaFixtureTransaction) => Promise<T>
  ): Promise<T>;
}

interface OperatorQaFixtureTransaction {
  claim: {
    findUnique(args: unknown): Promise<{ id: string } | null>;
  };
  claimReference: {
    deleteMany(args: unknown): Promise<{ count: number }>;
  };
  operatorAuditEvent: {
    deleteMany(args: unknown): Promise<{ count: number }>;
  };
  reference: {
    deleteMany(args: unknown): Promise<{ count: number }>;
    upsert(args: unknown): Promise<unknown>;
  };
  sourceCandidate: {
    deleteMany(args: unknown): Promise<{ count: number }>;
    upsert(args: unknown): Promise<unknown>;
  };
  sourceDocument: {
    deleteMany(args: unknown): Promise<{ count: number }>;
  };
  study: {
    deleteMany(args: unknown): Promise<{ count: number }>;
  };
}

export function buildOperatorQaFixturePlan(
  env: Record<string, string | undefined>
): OperatorQaFixturePlan {
  const vercelEnv = readEnv(env, "VERCEL_ENV");
  const enabled = readEnv(env, OPERATOR_QA_FIXTURE_ENABLED_ENV) === "true";

  if (readEnv(env, "VERCEL") !== "1") {
    return {
      action: "skip",
      blockers: [],
      detail: "Not running in Vercel; operator QA fixture was not changed.",
      enabled,
      targetEnvironment: vercelEnv
    } satisfies OperatorQaFixturePlan;
  }

  if (vercelEnv === "production") {
    return enabled
      ? {
          action: "blocked",
          blockers: [
            `${OPERATOR_QA_FIXTURE_ENABLED_ENV}=true is not allowed in production.`
          ],
          detail: "Operator QA fixture is Preview-only.",
          enabled,
          targetEnvironment: vercelEnv
        }
      : {
          action: "skip",
          blockers: [],
          detail: "Production build; operator QA fixture was not changed.",
          enabled,
          targetEnvironment: vercelEnv
        };
  }

  if (vercelEnv !== "preview") {
    return {
      action: "skip",
      blockers: [],
      detail: vercelEnv
        ? `VERCEL_ENV=${vercelEnv}; operator QA fixture was not changed.`
        : "VERCEL_ENV is not configured; operator QA fixture was not changed.",
      enabled,
      targetEnvironment: vercelEnv
    } satisfies OperatorQaFixturePlan;
  }

  return {
    action: enabled ? "seed" : "cleanup",
    blockers: [],
    detail: enabled
      ? "Seed Preview-only operator QA source-candidate fixture."
      : "Clean Preview-only operator QA source-candidate fixture.",
    enabled,
    targetEnvironment: vercelEnv
  } satisfies OperatorQaFixturePlan;
}

export async function syncOperatorQaFixture({
  client = prisma as OperatorQaFixtureClient,
  env = process.env
}: {
  client?: OperatorQaFixtureClient;
  env?: Record<string, string | undefined>;
} = {}): Promise<OperatorQaFixtureResult> {
  const plan = buildOperatorQaFixturePlan(env);

  if (plan.action === "blocked") {
    throw new Error(plan.blockers.join(" "));
  }

  if (plan.action === "skip") {
    return plan;
  }

  if (plan.action === "cleanup") {
    const cleanup = await client.$transaction((transaction) =>
      cleanupOperatorQaFixture(transaction)
    );

    return {
      ...plan,
      cleanup
    };
  }

  return client.$transaction(async (transaction) => {
    const claim = await transaction.claim.findUnique({
      select: {
        id: true
      },
      where: {
        id: OPERATOR_QA_FIXTURE_CLAIM_ID
      }
    });

    if (!claim) {
      throw new Error(
        "Operator QA fixture requires Preview seed claim creatine-strength."
      );
    }

    const cleanup = await cleanupOperatorQaFixture(transaction);

    await transaction.reference.upsert({
      create: {
        id: OPERATOR_QA_FIXTURE_REFERENCE_ID,
        identifier: "PMID: 90000001",
        source: DbSourceKind.PUBMED,
        title: "Operator QA fixture: synthetic creatine review source",
        url: OPERATOR_QA_FIXTURE_REFERENCE_URL,
        year: 2026
      },
      update: {
        identifier: "PMID: 90000001",
        source: DbSourceKind.PUBMED,
        title: "Operator QA fixture: synthetic creatine review source",
        url: OPERATOR_QA_FIXTURE_REFERENCE_URL,
        year: 2026
      },
      where: {
        id: OPERATOR_QA_FIXTURE_REFERENCE_ID
      }
    });

    await transaction.sourceCandidate.upsert({
      create: sourceCandidateFixtureInput(),
      update: sourceCandidateFixtureInput(),
      where: {
        dedupeKey: OPERATOR_QA_FIXTURE_DEDUPE_KEY
      }
    });

    return {
      ...plan,
      cleanup,
      fixture: {
        acceptedReferenceId: OPERATOR_QA_FIXTURE_REFERENCE_ID,
        claimId: OPERATOR_QA_FIXTURE_CLAIM_ID,
        dedupeKey: OPERATOR_QA_FIXTURE_DEDUPE_KEY,
        interventionId: OPERATOR_QA_FIXTURE_INTERVENTION_ID
      }
    };
  });
}

async function cleanupOperatorQaFixture(
  transaction: OperatorQaFixtureTransaction
): Promise<OperatorQaFixtureCleanupSummary> {
  const auditEvents = await transaction.operatorAuditEvent.deleteMany({
    where: {
      targetId: OPERATOR_QA_FIXTURE_DEDUPE_KEY,
      targetType: "SourceCandidate"
    }
  });
  const studies = await transaction.study.deleteMany({
    where: {
      referenceId: OPERATOR_QA_FIXTURE_REFERENCE_ID
    }
  });
  const claimReferences = await transaction.claimReference.deleteMany({
    where: {
      referenceId: OPERATOR_QA_FIXTURE_REFERENCE_ID
    }
  });
  const sourceCandidates = await transaction.sourceCandidate.deleteMany({
    where: {
      dedupeKey: OPERATOR_QA_FIXTURE_DEDUPE_KEY
    }
  });
  const sourceDocuments = await transaction.sourceDocument.deleteMany({
    where: {
      OR: [
        {
          referenceId: OPERATOR_QA_FIXTURE_REFERENCE_ID
        },
        {
          url: OPERATOR_QA_FIXTURE_REFERENCE_URL
        }
      ]
    }
  });
  const references = await transaction.reference.deleteMany({
    where: {
      id: OPERATOR_QA_FIXTURE_REFERENCE_ID
    }
  });

  return {
    auditEvents: auditEvents.count,
    claimReferences: claimReferences.count,
    references: references.count,
    sourceCandidates: sourceCandidates.count,
    sourceDocuments: sourceDocuments.count,
    studies: studies.count
  };
}

function sourceCandidateFixtureInput() {
  return {
    abstractAvailable: true,
    acceptedReferenceId: null,
    claimId: OPERATOR_QA_FIXTURE_CLAIM_ID,
    decision: DbSourceCandidateDecision.PENDING_REVIEW,
    dedupeKey: OPERATOR_QA_FIXTURE_DEDUPE_KEY,
    externalId: "90000001",
    ingestionJobId: null,
    interventionId: OPERATOR_QA_FIXTURE_INTERVENTION_ID,
    metadata: {
      fixture: "operator-qa",
      note: "Synthetic Preview-only candidate for operator browser write QA.",
      publicationTypes: ["Randomized Controlled Trial"],
      synthetic: true
    },
    publishedYear: 2026,
    query: "operator qa fixture creatine strength",
    region: "AU",
    reviewNote: null,
    reviewStatus: DbReviewStatus.UNREVIEWED_AI_DRAFT,
    reviewedAt: null,
    source: DbSourceKind.PUBMED,
    sourceType: "Randomized controlled trial",
    title: "Operator QA fixture: synthetic creatine source candidate",
    triageReasons: [
      "Synthetic Preview-only operator QA fixture",
      "Use for accept/link/extract/promotion browser-control checks only"
    ],
    triageScore: 100,
    url: OPERATOR_QA_FIXTURE_REFERENCE_URL
  };
}

function readEnv(env: Record<string, string | undefined>, key: string) {
  const value = env[key];

  return value && value.trim() ? value.trim() : undefined;
}
