import {
  ReviewStatus as DbReviewStatus,
  SourceCandidateDecision as DbSourceCandidateDecision,
  SourceKind as DbSourceKind,
  type SourceCandidate as DbSourceCandidate,
  type Prisma
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type {
  ReviewStatus,
  SourceCandidate,
  SourceCandidateDecision,
  SourceCandidateSource
} from "@/lib/types";

export interface SourceCandidateUpsertSummary {
  received: number;
  upserted: number;
}

export interface SourceCandidateReviewQueueOptions {
  decision?: SourceCandidateDecision;
  limit?: number;
  source?: SourceCandidateSource;
}

export type ReviewedSourceCandidateDecision = Exclude<
  SourceCandidateDecision,
  "Pending review"
>;

export interface RecordSourceCandidateDecisionInput {
  dedupeKey: string;
  decision: ReviewedSourceCandidateDecision;
  acceptedReferenceId?: string;
  reviewNote?: string;
  reviewedAt?: Date;
}

const DEFAULT_REVIEW_QUEUE_LIMIT = 25;
const MAX_REVIEW_QUEUE_LIMIT = 100;

const sourceMap: Record<SourceCandidateSource, DbSourceKind> = {
  PubMed: DbSourceKind.PUBMED,
  "ClinicalTrials.gov": DbSourceKind.CLINICALTRIALS_GOV
};

const decisionMap: Record<SourceCandidateDecision, DbSourceCandidateDecision> = {
  "Pending review": DbSourceCandidateDecision.PENDING_REVIEW,
  Accepted: DbSourceCandidateDecision.ACCEPTED,
  Rejected: DbSourceCandidateDecision.REJECTED
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

export async function listSourceCandidateReviewQueue(
  options: SourceCandidateReviewQueueOptions = {}
): Promise<SourceCandidate[]> {
  const where: Prisma.SourceCandidateWhereInput = {
    decision: decisionMap[options.decision ?? "Pending review"]
  };

  if (options.source) {
    where.source = sourceMap[options.source];
  }

  const candidates = await prisma.sourceCandidate.findMany({
    where,
    orderBy: [{ triageScore: "desc" }, { updatedAt: "desc" }],
    take: normaliseReviewQueueLimit(options.limit)
  });

  return candidates.map(mapDbSourceCandidate);
}

export async function recordSourceCandidateDecision({
  dedupeKey,
  decision,
  acceptedReferenceId,
  reviewNote,
  reviewedAt = new Date()
}: RecordSourceCandidateDecisionInput): Promise<SourceCandidate> {
  const acceptedReferenceIdOrUndefined = acceptedReferenceId?.trim();

  if (decision === "Accepted" && !acceptedReferenceIdOrUndefined) {
    throw new Error("Accepted source candidates require an acceptedReferenceId.");
  }

  const candidate = await prisma.sourceCandidate.update({
    where: {
      dedupeKey
    },
    data: {
      decision: decisionMap[decision],
      reviewStatus: DbReviewStatus.HUMAN_REVIEWED,
      reviewedAt,
      reviewNote,
      acceptedReferenceId:
        decision === "Accepted" ? acceptedReferenceIdOrUndefined : null
    }
  });

  return mapDbSourceCandidate(candidate);
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

function normaliseReviewQueueLimit(limit: number | undefined) {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_REVIEW_QUEUE_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), MAX_REVIEW_QUEUE_LIMIT);
}

function mapDbSourceCandidate(candidate: DbSourceCandidate): SourceCandidate {
  return {
    dedupeKey: candidate.dedupeKey,
    source: sourceFromDb(candidate.source),
    externalId: candidate.externalId,
    query: candidate.query,
    region: candidate.region,
    title: candidate.title,
    url: candidate.url,
    publishedYear: candidate.publishedYear ?? undefined,
    sourceType: candidate.sourceType ?? undefined,
    abstractAvailable: candidate.abstractAvailable ?? undefined,
    triageScore: candidate.triageScore,
    triageReasons: candidate.triageReasons,
    decision: decisionFromDb(candidate.decision),
    reviewStatus: reviewStatusFromDb(candidate.reviewStatus),
    interventionId: candidate.interventionId ?? undefined,
    claimId: candidate.claimId ?? undefined,
    ingestionJobId: candidate.ingestionJobId ?? undefined,
    acceptedReferenceId: candidate.acceptedReferenceId ?? undefined,
    reviewedAt: candidate.reviewedAt?.toISOString(),
    reviewNote: candidate.reviewNote ?? undefined,
    metadata: metadataObject(candidate.metadata)
  };
}

function sourceFromDb(source: DbSourceKind): SourceCandidateSource {
  switch (source) {
    case DbSourceKind.PUBMED:
      return "PubMed";
    case DbSourceKind.CLINICALTRIALS_GOV:
      return "ClinicalTrials.gov";
    default:
      throw new Error(`Unsupported source candidate source: ${source}`);
  }
}

function decisionFromDb(decision: DbSourceCandidateDecision): SourceCandidateDecision {
  switch (decision) {
    case DbSourceCandidateDecision.PENDING_REVIEW:
      return "Pending review";
    case DbSourceCandidateDecision.ACCEPTED:
      return "Accepted";
    case DbSourceCandidateDecision.REJECTED:
      return "Rejected";
  }
}

function reviewStatusFromDb(reviewStatus: DbReviewStatus): ReviewStatus {
  switch (reviewStatus) {
    case DbReviewStatus.UNREVIEWED_AI_DRAFT:
      return "Unreviewed AI draft";
    case DbReviewStatus.HUMAN_REVIEWED:
      return "Human reviewed";
  }
}

function metadataObject(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
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
