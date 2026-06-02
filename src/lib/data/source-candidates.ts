import {
  type ClaimReference as DbClaimReference,
  type Reference as DbReference,
  ReviewStatus as DbReviewStatus,
  SourceCandidateDecision as DbSourceCandidateDecision,
  SourceKind as DbSourceKind,
  type Study as DbStudy,
  type SourceCandidate as DbSourceCandidate,
  type Prisma
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type {
  Reference,
  ReviewStatus,
  SourceCandidate,
  SourceCandidateDecision,
  SourceCandidateSource
} from "@/lib/types";

export interface SourceCandidateUpsertSummary {
  received: number;
  upserted: number;
}

export interface SourceCandidateBacklogSummaryGroup {
  count: number;
  decision: SourceCandidateDecision;
  region: string;
  reviewStatus: ReviewStatus;
  source: SourceCandidateSource;
}

export interface SourceCandidateBacklogSummary {
  groups: SourceCandidateBacklogSummaryGroup[];
  total: number;
}

export interface SourceCandidateCurationHandoffSummaryGroup {
  count: number;
  publicSourcePacketReady: boolean;
  status: SourceCandidateCurationStatusKind;
}

export interface SourceCandidateCurationHandoffSummary {
  groups: SourceCandidateCurationHandoffSummaryGroup[];
  total: number;
}

export interface SourceCandidateReviewQueueOptions {
  claimId?: string;
  decision?: SourceCandidateDecision;
  ingestionJobId?: string;
  interventionId?: string;
  limit?: number;
  source?: SourceCandidateSource;
}

export interface SourceCandidateAcceptedReferenceMatches {
  candidate: SourceCandidate;
  references: Reference[];
}

export type SourceCandidateCurationStatusKind =
  | "Not accepted"
  | "Accepted reference missing"
  | "Claim link missing"
  | "Extraction pending"
  | "Public source packet ready";

export interface SourceCandidateCurationClaimLink {
  claimId: string;
  note?: string;
  relevance: number;
}

export interface SourceCandidateCurationStudy {
  id: string;
  referenceId: string;
  title: string;
  year?: number;
}

export interface SourceCandidateCurationStatus {
  acceptedReference?: Reference;
  acceptedReferenceId?: string;
  candidate: SourceCandidate;
  candidateClaimLinked?: boolean;
  claimLinks: SourceCandidateCurationClaimLink[];
  nextAction: string;
  publicSourcePacketReady: boolean;
  status: SourceCandidateCurationStatusKind;
  studies: SourceCandidateCurationStudy[];
}

export interface SourceCandidateCurationHandoffOptions {
  claimId?: string;
  ingestionJobId?: string;
  interventionId?: string;
  limit?: number;
  source?: SourceCandidateSource;
  status?: SourceCandidateCurationStatusKind;
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
const DEFAULT_CURATION_HANDOFF_LIMIT = 25;
const MAX_CURATION_HANDOFF_LIMIT = 50;
const MAX_REFERENCE_MATCH_CANDIDATES = 50;
const CURATION_HANDOFF_STATUS_ORDER: SourceCandidateCurationStatusKind[] = [
  "Accepted reference missing",
  "Claim link missing",
  "Extraction pending",
  "Public source packet ready",
  "Not accepted"
];

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

  if (options.ingestionJobId) {
    where.ingestionJobId = options.ingestionJobId;
  }

  if (options.interventionId) {
    where.interventionId = options.interventionId;
  }

  if (options.claimId) {
    where.claimId = options.claimId;
  }

  const candidates = await prisma.sourceCandidate.findMany({
    where,
    orderBy: [{ triageScore: "desc" }, { updatedAt: "desc" }],
    take: normaliseReviewQueueLimit(options.limit)
  });

  return candidates.map(mapDbSourceCandidate);
}

export async function getSourceCandidateByDedupeKey(
  dedupeKey: string
): Promise<SourceCandidate | null> {
  const candidate = await prisma.sourceCandidate.findUnique({
    where: {
      dedupeKey
    }
  });

  return candidate ? mapDbSourceCandidate(candidate) : null;
}

export async function listSourceCandidateAcceptedReferenceMatches(
  dedupeKey: string
): Promise<SourceCandidateAcceptedReferenceMatches | null> {
  const candidate = await prisma.sourceCandidate.findUnique({
    where: {
      dedupeKey
    }
  });

  if (!candidate) {
    return null;
  }

  const references = await prisma.reference.findMany({
    where: referenceMatchLookupWhere(candidate),
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: MAX_REFERENCE_MATCH_CANDIDATES
  });

  return {
    candidate: mapDbSourceCandidate(candidate),
    references: references
      .filter((reference) => referenceMatchesSourceCandidate(reference, candidate))
      .map(mapDbReference)
  };
}

export async function getSourceCandidateCurationStatus(
  dedupeKey: string
): Promise<SourceCandidateCurationStatus | null> {
  const candidate = await prisma.sourceCandidate.findUnique({
    where: {
      dedupeKey
    }
  });

  if (!candidate) {
    return null;
  }

  const mappedCandidate = mapDbSourceCandidate(candidate);
  const acceptedReferenceId = candidate.acceptedReferenceId ?? undefined;

  if (candidate.decision !== DbSourceCandidateDecision.ACCEPTED) {
    return sourceCandidateCurationStatus({
      candidate: mappedCandidate,
      status: "Not accepted"
    });
  }

  if (!acceptedReferenceId) {
    return sourceCandidateCurationStatus({
      candidate: mappedCandidate,
      status: "Accepted reference missing"
    });
  }

  const acceptedReference = await prisma.reference.findUnique({
    where: {
      id: acceptedReferenceId
    }
  });

  if (!acceptedReference) {
    return sourceCandidateCurationStatus({
      acceptedReferenceId,
      candidate: mappedCandidate,
      status: "Accepted reference missing"
    });
  }

  const [claimLinks, studies] = await Promise.all([
    prisma.claimReference.findMany({
      where: {
        referenceId: acceptedReference.id
      },
      orderBy: [{ claimId: "asc" }]
    }),
    prisma.study.findMany({
      where: {
        referenceId: acceptedReference.id
      },
      orderBy: [{ year: "desc" }, { title: "asc" }]
    })
  ]);
  const mappedClaimLinks = claimLinks.map(mapDbClaimReference);
  const mappedStudies = studies.map(mapDbCurationStudy);
  const candidateClaimLinked = candidate.claimId
    ? mappedClaimLinks.some((link) => link.claimId === candidate.claimId)
    : undefined;

  return sourceCandidateCurationStatus({
    acceptedReference: mapDbReference(acceptedReference),
    acceptedReferenceId,
    candidate: mappedCandidate,
    candidateClaimLinked,
    claimLinks: mappedClaimLinks,
    status: curationStatusKind(mappedClaimLinks, mappedStudies, candidateClaimLinked),
    studies: mappedStudies
  });
}

export async function listSourceCandidateCurationHandoff(
  options: SourceCandidateCurationHandoffOptions = {}
): Promise<SourceCandidateCurationStatus[]> {
  const where: Prisma.SourceCandidateWhereInput = {
    decision: DbSourceCandidateDecision.ACCEPTED
  };

  if (options.source) {
    where.source = sourceMap[options.source];
  }

  if (options.ingestionJobId) {
    where.ingestionJobId = options.ingestionJobId;
  }

  if (options.interventionId) {
    where.interventionId = options.interventionId;
  }

  if (options.claimId) {
    where.claimId = options.claimId;
  }

  const limit = normaliseCurationHandoffLimit(options.limit);
  const candidates = await prisma.sourceCandidate.findMany({
    where,
    orderBy: [{ reviewedAt: "asc" }, { updatedAt: "desc" }],
    ...(options.status ? {} : { take: limit })
  });
  const statuses = await sourceCandidateCurationStatuses(candidates);

  return options.status
    ? statuses.filter((status) => status.status === options.status).slice(0, limit)
    : statuses;
}

export async function summarizeSourceCandidateCurationHandoff(): Promise<SourceCandidateCurationHandoffSummary> {
  const candidates = await prisma.sourceCandidate.findMany({
    where: {
      decision: DbSourceCandidateDecision.ACCEPTED
    },
    orderBy: [{ reviewedAt: "asc" }, { updatedAt: "desc" }]
  });
  const statuses = await sourceCandidateCurationStatuses(candidates);
  const counts = new Map<SourceCandidateCurationStatusKind, number>();

  for (const status of statuses) {
    counts.set(status.status, (counts.get(status.status) ?? 0) + 1);
  }

  const groups = CURATION_HANDOFF_STATUS_ORDER.map((status) => ({
    count: counts.get(status) ?? 0,
    publicSourcePacketReady: status === "Public source packet ready",
    status
  })).filter((group) => group.count > 0);

  return {
    groups,
    total: statuses.length
  };
}

async function sourceCandidateCurationStatuses(
  candidates: DbSourceCandidate[]
): Promise<SourceCandidateCurationStatus[]> {
  const acceptedReferenceIds = uniqueStringValues(
    candidates.map((candidate) => candidate.acceptedReferenceId)
  );

  if (acceptedReferenceIds.length === 0) {
    return candidates.map((candidate) =>
      sourceCandidateCurationStatus({
        candidate: mapDbSourceCandidate(candidate),
        status: "Accepted reference missing"
      })
    );
  }

  const [acceptedReferences, claimLinks, studies] = await Promise.all([
    prisma.reference.findMany({
      where: {
        id: {
          in: acceptedReferenceIds
        }
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }]
    }),
    prisma.claimReference.findMany({
      where: {
        referenceId: {
          in: acceptedReferenceIds
        }
      },
      orderBy: [{ referenceId: "asc" }, { claimId: "asc" }]
    }),
    prisma.study.findMany({
      where: {
        referenceId: {
          in: acceptedReferenceIds
        }
      },
      orderBy: [{ referenceId: "asc" }, { year: "desc" }, { title: "asc" }]
    })
  ]);
  const referencesById = new Map(
    acceptedReferences.map((reference) => [reference.id, reference])
  );
  const claimLinksByReferenceId = groupByReferenceId(claimLinks);
  const studiesByReferenceId = groupByReferenceId(studies);

  return candidates.map((candidate) => {
    const mappedCandidate = mapDbSourceCandidate(candidate);
    const acceptedReferenceId = candidate.acceptedReferenceId ?? undefined;

    if (!acceptedReferenceId) {
      return sourceCandidateCurationStatus({
        candidate: mappedCandidate,
        status: "Accepted reference missing"
      });
    }

    const acceptedReference = referencesById.get(acceptedReferenceId);

    if (!acceptedReference) {
      return sourceCandidateCurationStatus({
        acceptedReferenceId,
        candidate: mappedCandidate,
        status: "Accepted reference missing"
      });
    }

    const mappedClaimLinks = (claimLinksByReferenceId.get(acceptedReferenceId) ?? [])
      .map(mapDbClaimReference);
    const mappedStudies = (studiesByReferenceId.get(acceptedReferenceId) ?? [])
      .map(mapDbCurationStudy);
    const candidateClaimLinked = candidate.claimId
      ? mappedClaimLinks.some((link) => link.claimId === candidate.claimId)
      : undefined;

    return sourceCandidateCurationStatus({
      acceptedReference: mapDbReference(acceptedReference),
      acceptedReferenceId,
      candidate: mappedCandidate,
      candidateClaimLinked,
      claimLinks: mappedClaimLinks,
      status: curationStatusKind(mappedClaimLinks, mappedStudies, candidateClaimLinked),
      studies: mappedStudies
    });
  });
}

export async function summarizeSourceCandidateBacklog(): Promise<SourceCandidateBacklogSummary> {
  const groups = await prisma.sourceCandidate.groupBy({
    by: ["source", "region", "decision", "reviewStatus"],
    _count: {
      _all: true
    },
    orderBy: [
      { source: "asc" },
      { region: "asc" },
      { decision: "asc" },
      { reviewStatus: "asc" }
    ]
  });
  const mappedGroups = groups.map(mapDbSourceCandidateBacklogGroup);

  return {
    groups: mappedGroups,
    total: mappedGroups.reduce((total, group) => total + group.count, 0)
  };
}

export async function recordSourceCandidateDecision({
  dedupeKey,
  decision,
  acceptedReferenceId,
  reviewNote,
  reviewedAt = new Date()
}: RecordSourceCandidateDecisionInput): Promise<SourceCandidate> {
  const acceptedReferenceIdOrUndefined = acceptedReferenceId?.trim();
  const reviewNoteOrUndefined = reviewNote?.trim();

  if (decision === "Accepted" && !acceptedReferenceIdOrUndefined) {
    throw new Error("Accepted source candidates require an acceptedReferenceId.");
  }

  if (decision === "Rejected" && !reviewNoteOrUndefined) {
    throw new Error("Rejected source candidates require a reviewNote.");
  }

  const pendingCandidate = await prisma.sourceCandidate.findUnique({
    where: {
      dedupeKey
    }
  });

  if (!pendingCandidate || pendingCandidate.decision !== DbSourceCandidateDecision.PENDING_REVIEW) {
    throw new Error("Pending source candidate not found for review.");
  }

  if (decision === "Accepted") {
    const acceptedReference = await prisma.reference.findUnique({
      where: {
        id: acceptedReferenceIdOrUndefined
      }
    });

    if (!acceptedReference) {
      throw new Error("Accepted source candidate reference was not found.");
    }

    if (!referenceMatchesSourceCandidate(acceptedReference, pendingCandidate)) {
      throw new Error(
        "Accepted source candidate reference must match candidate source and external id."
      );
    }
  }

  try {
    const candidate = await prisma.sourceCandidate.update({
      where: {
        dedupeKey,
        decision: DbSourceCandidateDecision.PENDING_REVIEW
      },
      data: {
        decision: decisionMap[decision],
        reviewStatus: DbReviewStatus.HUMAN_REVIEWED,
        reviewedAt,
        reviewNote: decision === "Rejected" ? reviewNoteOrUndefined : reviewNote,
        acceptedReferenceId:
          decision === "Accepted" ? acceptedReferenceIdOrUndefined : null
      }
    });

    return mapDbSourceCandidate(candidate);
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      throw new Error("Pending source candidate not found for review.");
    }

    throw error;
  }
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

function normaliseCurationHandoffLimit(limit: number | undefined) {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_CURATION_HANDOFF_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), MAX_CURATION_HANDOFF_LIMIT);
}

function mapDbSourceCandidateBacklogGroup(group: {
  _count: {
    _all: number;
  };
  decision: DbSourceCandidateDecision;
  region: string;
  reviewStatus: DbReviewStatus;
  source: DbSourceKind;
}): SourceCandidateBacklogSummaryGroup {
  return {
    count: group._count._all,
    decision: decisionFromDb(group.decision),
    region: group.region,
    reviewStatus: reviewStatusFromDb(group.reviewStatus),
    source: sourceFromDb(group.source)
  };
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

function mapDbReference(reference: DbReference): Reference {
  return {
    id: reference.id,
    title: reference.title,
    source: sourceFromDb(reference.source),
    identifier: reference.identifier ?? undefined,
    year: reference.year ?? undefined,
    url: reference.url
  };
}

function mapDbClaimReference(
  claimReference: DbClaimReference
): SourceCandidateCurationClaimLink {
  return {
    claimId: claimReference.claimId,
    note: claimReference.note ?? undefined,
    relevance: claimReference.relevance
  };
}

function mapDbCurationStudy(study: DbStudy): SourceCandidateCurationStudy {
  return {
    id: study.id,
    referenceId: study.referenceId ?? "",
    title: study.title,
    year: study.year ?? undefined
  };
}

function sourceCandidateCurationStatus({
  acceptedReference,
  acceptedReferenceId,
  candidate,
  candidateClaimLinked,
  claimLinks = [],
  status,
  studies = []
}: {
  acceptedReference?: Reference;
  acceptedReferenceId?: string;
  candidate: SourceCandidate;
  candidateClaimLinked?: boolean;
  claimLinks?: SourceCandidateCurationClaimLink[];
  status: SourceCandidateCurationStatusKind;
  studies?: SourceCandidateCurationStudy[];
}): SourceCandidateCurationStatus {
  return {
    acceptedReference,
    acceptedReferenceId,
    candidate,
    candidateClaimLinked,
    claimLinks,
    nextAction: curationNextAction(status),
    publicSourcePacketReady: status === "Public source packet ready",
    status,
    studies
  };
}

function curationNextAction(status: SourceCandidateCurationStatusKind) {
  switch (status) {
    case "Not accepted":
      return "Accept with a matching curated reference before curation handoff.";
    case "Accepted reference missing":
      return "Attach or restore the matching curated reference before public packet review.";
    case "Claim link missing":
      return "Link the accepted reference to the candidate claim before public packet review.";
    case "Extraction pending":
      return "Add structured study extraction for the accepted reference.";
    case "Public source packet ready":
      return "Review for public source packet inclusion.";
  }
}

function curationStatusKind(
  claimLinks: SourceCandidateCurationClaimLink[],
  studies: SourceCandidateCurationStudy[],
  candidateClaimLinked: boolean | undefined
): SourceCandidateCurationStatusKind {
  if (claimLinks.length === 0 || candidateClaimLinked === false) {
    return "Claim link missing";
  }

  if (studies.length === 0) {
    return "Extraction pending";
  }

  return "Public source packet ready";
}

function uniqueStringValues(values: Array<string | null>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function groupByReferenceId<T extends { referenceId: string | null }>(items: T[]) {
  const grouped = new Map<string, T[]>();

  for (const item of items) {
    if (!item.referenceId) {
      continue;
    }

    grouped.set(item.referenceId, [...(grouped.get(item.referenceId) ?? []), item]);
  }

  return grouped;
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

function referenceMatchesSourceCandidate(
  reference: DbReference,
  candidate: DbSourceCandidate
) {
  if (reference.source !== candidate.source) {
    return false;
  }

  const candidateUrl = normaliseUrl(candidate.url);
  const referenceUrl = normaliseUrl(reference.url);

  if (candidateUrl && referenceUrl && candidateUrl === referenceUrl) {
    return true;
  }

  if (candidate.source === DbSourceKind.PUBMED) {
    const candidatePmid = normalisePubMedId(candidate.externalId);

    return Boolean(
      candidatePmid && readPubMedReferenceIds(reference).includes(candidatePmid)
    );
  }

  if (candidate.source === DbSourceKind.CLINICALTRIALS_GOV) {
    const candidateNctId = normaliseNctId(candidate.externalId);

    return Boolean(
      candidateNctId && readClinicalTrialReferenceIds(reference).includes(candidateNctId)
    );
  }

  return false;
}

function referenceMatchLookupWhere(
  candidate: DbSourceCandidate
): Prisma.ReferenceWhereInput {
  const candidates: Prisma.ReferenceWhereInput[] = [
    {
      url: candidate.url
    }
  ];

  if (candidate.source === DbSourceKind.PUBMED) {
    const pmid = normalisePubMedId(candidate.externalId);

    if (pmid) {
      candidates.push(
        {
          identifier: {
            contains: pmid
          }
        },
        {
          url: {
            contains: pmid
          }
        }
      );
    }
  }

  if (candidate.source === DbSourceKind.CLINICALTRIALS_GOV) {
    const nctId = normaliseNctId(candidate.externalId);

    if (nctId) {
      candidates.push(
        {
          identifier: {
            contains: nctId,
            mode: "insensitive"
          }
        },
        {
          url: {
            contains: nctId,
            mode: "insensitive"
          }
        }
      );
    }
  }

  return {
    source: candidate.source,
    OR: candidates
  };
}

function normaliseUrl(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}

function normalisePubMedId(value: string | null | undefined) {
  const match = (value ?? "").trim().match(/\d+/);
  return match?.[0];
}

function normaliseNctId(value: string | null | undefined) {
  return value?.trim().match(/^NCT[A-Z0-9]+$/i)?.[0].toUpperCase();
}

function readPubMedReferenceIds(reference: DbReference) {
  const ids: string[] = [];
  const identifier = reference.identifier?.trim();

  if (identifier) {
    const pmidMatch = identifier.match(/\bPMID\s*:?\s*(\d+)\b/i);
    const plainMatch = identifier.match(/^\d+$/);
    const id = pmidMatch?.[1] ?? plainMatch?.[0];

    if (id) {
      ids.push(id);
    }
  }

  const urlMatch = reference.url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i);

  if (urlMatch?.[1]) {
    ids.push(urlMatch[1]);
  }

  return ids;
}

function readClinicalTrialReferenceIds(reference: DbReference) {
  const ids = new Set<string>();

  for (const value of [reference.identifier, reference.url]) {
    const matches = value?.match(/\bNCT[A-Z0-9]+\b/gi) ?? [];

    for (const match of matches) {
      ids.add(match.toUpperCase());
    }
  }

  return Array.from(ids);
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

function isPrismaNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2025"
  );
}
