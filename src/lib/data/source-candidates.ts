import {
  ReviewStatus as DbReviewStatus,
  SourceCandidateDecision as DbSourceCandidateDecision,
  SourceKind as DbSourceKind,
  type Prisma
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type { SourceCandidate, SourceCandidateSource } from "@/lib/types";

export interface SourceCandidateUpsertSummary {
  received: number;
  upserted: number;
}

const sourceMap: Record<SourceCandidateSource, DbSourceKind> = {
  PubMed: DbSourceKind.PUBMED,
  "ClinicalTrials.gov": DbSourceKind.CLINICALTRIALS_GOV
};

export async function upsertSourceCandidateDrafts(
  candidates: readonly SourceCandidate[]
): Promise<SourceCandidateUpsertSummary> {
  if (candidates.length === 0) {
    return {
      received: 0,
      upserted: 0
    };
  }

  const upserts = candidates.map((candidate) =>
    prisma.sourceCandidate.upsert({
      where: {
        dedupeKey: candidate.dedupeKey
      },
      create: sourceCandidateCreateInput(candidate),
      update: sourceCandidateRediscoveryUpdateInput(candidate)
    })
  );
  const result = await prisma.$transaction(upserts);

  return {
    received: candidates.length,
    upserted: result.length
  };
}

function sourceCandidateCreateInput(
  candidate: SourceCandidate
): Prisma.SourceCandidateUncheckedCreateInput {
  return {
    ...sourceCandidateRediscoveryScalars(candidate),
    dedupeKey: candidate.dedupeKey,
    decision: DbSourceCandidateDecision.PENDING_REVIEW,
    reviewStatus: DbReviewStatus.UNREVIEWED_AI_DRAFT
  };
}

function sourceCandidateRediscoveryUpdateInput(
  candidate: SourceCandidate
): Prisma.SourceCandidateUncheckedUpdateInput {
  return sourceCandidateRediscoveryScalars(candidate);
}

function sourceCandidateRediscoveryScalars(candidate: SourceCandidate) {
  return {
    source: sourceMap[candidate.source],
    externalId: candidate.externalId,
    query: candidate.query,
    region: candidate.region,
    title: candidate.title,
    url: candidate.url,
    publishedYear: candidate.publishedYear,
    sourceType: candidate.sourceType,
    abstractAvailable: candidate.abstractAvailable,
    triageScore: candidate.triageScore,
    triageReasons: candidate.triageReasons,
    metadata: jsonObject(candidate.metadata),
    interventionId: candidate.interventionId,
    claimId: candidate.claimId,
    ingestionJobId: candidate.ingestionJobId
  };
}

function jsonObject(value: Record<string, unknown>) {
  return stripUndefined(value) as Prisma.InputJsonObject;
}

function stripUndefined(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefined(item))
      .filter((item) => item !== undefined);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [key, stripUndefined(item)] as const)
      .filter(([, item]) => item !== undefined)
  );
}
