import {
  type ClaimReference as DbClaimReference,
  type Reference as DbReference,
  ReviewStatus as DbReviewStatus,
  SourceCandidateDecision as DbSourceCandidateDecision,
  SourceKind as DbSourceKind,
  type Study as DbStudy,
  StudyType as DbStudyType,
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
  claimIdMissing?: boolean;
  decision?: SourceCandidateDecision;
  externalId?: string;
  ingestionJobId?: string;
  interventionId?: string;
  interventionIdMissing?: boolean;
  limit?: number;
  region?: string;
  source?: SourceCandidateSource;
}

export interface SourceCandidateReviewOverviewOptions {
  claimId?: string;
  claimIdMissing?: boolean;
  ingestionJobId?: string;
  interventionId?: string;
  interventionIdMissing?: boolean;
  limit?: number;
  region?: string;
  source?: SourceCandidateSource;
}

export interface SourceCandidateReviewOverviewGroup {
  claimId?: string;
  count: number;
  interventionId?: string;
  region: string;
  source: SourceCandidateSource;
  topCandidate: SourceCandidate;
  topIdentityCandidateCount: number;
  topTriageScore: number;
}

export interface SourceCandidateReviewOverview {
  candidateCount: number;
  groups: SourceCandidateReviewOverviewGroup[];
  totalGroups: number;
}

export interface SourceCandidateIdentityGroup {
  candidates: SourceCandidate[];
  externalId: string;
  source: SourceCandidateSource;
}

export interface SourceCandidateAcceptedReferenceMatches {
  candidate: SourceCandidate;
  references: Reference[];
}

export type SourceCandidateSiblingMatchReason =
  | "Same source/external id"
  | "Same query/region"
  | "Same intervention context"
  | "Same claim context";

export interface SourceCandidateSibling {
  candidate: SourceCandidate;
  matchReasons: SourceCandidateSiblingMatchReason[];
}

export interface SourceCandidateSiblings {
  siblings: SourceCandidateSibling[];
  target: SourceCandidate;
}

export interface SourceCandidateSiblingOptions {
  limit?: number;
}

export type SourceCandidateCurationStatusKind =
  | "Not accepted"
  | "Accepted reference missing"
  | "Accepted reference mismatch"
  | "Candidate claim missing"
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

export interface SourceCandidateCurationClaimLinkDraft {
  alreadyLinked: boolean;
  claimId: string;
  note: string;
  referenceId: string;
  relevance: number;
}

export interface SourceCandidateCurationDraftMetadataField {
  label: string;
  value: string;
}

export interface SourceCandidateCurationStudyExtractionDraft {
  abstractAvailable?: boolean;
  alreadyExtracted: boolean;
  doi?: string;
  manualFields: string[];
  metadataFields: SourceCandidateCurationDraftMetadataField[];
  nctId?: string;
  pmid?: string;
  referenceId: string;
  source: SourceCandidateSource;
  sourceTypeSuggestion: string;
  title: string;
  url: string;
  year?: number;
}

export interface SourceCandidateCurationDraft {
  claimLinkDraft?: SourceCandidateCurationClaimLinkDraft;
  status: SourceCandidateCurationStatus;
  studyExtractionDraft?: SourceCandidateCurationStudyExtractionDraft;
}

export interface LinkAcceptedSourceCandidateClaimInput {
  dedupeKey: string;
  note?: string;
  relevance?: number;
}

export interface LinkedSourceCandidateClaim {
  acceptedReference: Reference;
  candidate: SourceCandidate;
  claimLink: SourceCandidateCurationClaimLink;
  created: boolean;
  status: SourceCandidateCurationStatus;
}

export type SourceCandidateStudyExtractionSourceType =
  | "META_ANALYSIS"
  | "SYSTEMATIC_REVIEW"
  | "RANDOMIZED_CONTROLLED_TRIAL"
  | "OBSERVATIONAL_COHORT"
  | "CASE_REPORT"
  | "ANIMAL_STUDY"
  | "IN_VITRO_MECHANISTIC"
  | "CLINICAL_TRIAL_RECORD"
  | "REGULATORY_SAFETY_WARNING";

export interface ExtractAcceptedSourceCandidateStudyInput {
  abstract?: string;
  adverseEvents: string;
  dedupeKey: string;
  dose?: string;
  duration?: string;
  fundingConflicts: string;
  interventionName: string;
  mainResults?: string;
  outcomes: string[];
  population: string;
  relevance?: number;
  riskOfBias: string;
  sampleSize: string;
  sourceType?: SourceCandidateStudyExtractionSourceType;
  updateExisting?: boolean;
}

export interface ExtractedSourceCandidateStudy {
  acceptedReference: Reference;
  candidate: SourceCandidate;
  created: boolean;
  status: SourceCandidateCurationStatus;
  study: SourceCandidateCurationStudy;
}

export interface SourceCandidateCurationHandoffOptions {
  claimId?: string;
  claimIdMissing?: boolean;
  ingestionJobId?: string;
  interventionId?: string;
  interventionIdMissing?: boolean;
  limit?: number;
  region?: string;
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
const DEFAULT_REVIEW_OVERVIEW_LIMIT = 25;
const MAX_REVIEW_OVERVIEW_LIMIT = 50;
const MAX_REVIEW_OVERVIEW_SCAN_CANDIDATES = 1000;
const DEFAULT_IDENTITY_GROUP_LIMIT = 25;
const MAX_IDENTITY_GROUP_LIMIT = 50;
const MAX_IDENTITY_SCAN_CANDIDATES = 500;
const DEFAULT_CURATION_HANDOFF_LIMIT = 25;
const MAX_CURATION_HANDOFF_LIMIT = 50;
const DEFAULT_SIBLING_LIMIT = 25;
const MAX_SIBLING_LIMIT = 50;
const MAX_REFERENCE_MATCH_CANDIDATES = 50;
const MANUAL_STUDY_EXTRACTION_FIELDS = [
  "sampleSize",
  "population",
  "interventionName",
  "outcomes",
  "adverseEvents",
  "fundingConflicts",
  "riskOfBias"
];
const CURATION_HANDOFF_STATUS_ORDER: SourceCandidateCurationStatusKind[] = [
  "Accepted reference missing",
  "Accepted reference mismatch",
  "Candidate claim missing",
  "Claim link missing",
  "Extraction pending",
  "Public source packet ready",
  "Not accepted"
];

const sourceMap: Record<SourceCandidateSource, DbSourceKind> = {
  PubMed: DbSourceKind.PUBMED,
  "ClinicalTrials.gov": DbSourceKind.CLINICALTRIALS_GOV
};

const studyTypeMap: Record<SourceCandidateStudyExtractionSourceType, DbStudyType> = {
  META_ANALYSIS: DbStudyType.META_ANALYSIS,
  SYSTEMATIC_REVIEW: DbStudyType.SYSTEMATIC_REVIEW,
  RANDOMIZED_CONTROLLED_TRIAL: DbStudyType.RANDOMIZED_CONTROLLED_TRIAL,
  OBSERVATIONAL_COHORT: DbStudyType.OBSERVATIONAL_COHORT,
  CASE_REPORT: DbStudyType.CASE_REPORT,
  ANIMAL_STUDY: DbStudyType.ANIMAL_STUDY,
  IN_VITRO_MECHANISTIC: DbStudyType.IN_VITRO_MECHANISTIC,
  CLINICAL_TRIAL_RECORD: DbStudyType.CLINICAL_TRIAL_RECORD,
  REGULATORY_SAFETY_WARNING: DbStudyType.REGULATORY_SAFETY_WARNING
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
  const candidates = await prisma.sourceCandidate.findMany({
    where: sourceCandidateReviewQueueWhere(options),
    orderBy: [{ triageScore: "desc" }, { updatedAt: "desc" }],
    take: normaliseReviewQueueLimit(options.limit)
  });

  return candidates.map(mapDbSourceCandidate);
}

export async function listSourceCandidateReviewOverview(
  options: SourceCandidateReviewOverviewOptions = {}
): Promise<SourceCandidateReviewOverview> {
  const candidates = (
    await prisma.sourceCandidate.findMany({
      where: sourceCandidateReviewQueueWhere({
        claimId: options.claimId,
        claimIdMissing: options.claimIdMissing,
        ingestionJobId: options.ingestionJobId,
        interventionId: options.interventionId,
        interventionIdMissing: options.interventionIdMissing,
        region: options.region,
        source: options.source
      }),
      orderBy: [{ triageScore: "desc" }, { updatedAt: "desc" }],
      take: MAX_REVIEW_OVERVIEW_SCAN_CANDIDATES
    })
  ).map(mapDbSourceCandidate);
  const identityCandidateCounts = sourceCandidateIdentityCounts(candidates);
  const groupsByContext = new Map<string, SourceCandidateReviewOverviewGroup>();

  for (const candidate of candidates) {
    const key = [
      candidate.claimId ?? "",
      candidate.interventionId ?? "",
      candidate.source,
      candidate.region
    ].join("\u0000");
    const currentGroup = groupsByContext.get(key);

    if (!currentGroup) {
      groupsByContext.set(key, {
        claimId: candidate.claimId,
        count: 1,
        interventionId: candidate.interventionId,
        region: candidate.region,
        source: candidate.source,
        topCandidate: candidate,
        topIdentityCandidateCount:
          identityCandidateCounts.get(sourceCandidateIdentityKey(candidate)) ?? 1,
        topTriageScore: candidate.triageScore
      });
      continue;
    }

    currentGroup.count += 1;

    if (compareSourceCandidateReviewOverviewTop(candidate, currentGroup.topCandidate) < 0) {
      currentGroup.topCandidate = candidate;
      currentGroup.topIdentityCandidateCount =
        identityCandidateCounts.get(sourceCandidateIdentityKey(candidate)) ?? 1;
      currentGroup.topTriageScore = candidate.triageScore;
    }
  }

  const groups = Array.from(groupsByContext.values()).sort(
    compareSourceCandidateReviewOverviewGroups
  );

  return {
    candidateCount: candidates.length,
    groups: groups.slice(0, normaliseReviewOverviewLimit(options.limit)),
    totalGroups: groups.length
  };
}

export async function listSourceCandidateIdentityGroups(
  options: SourceCandidateReviewQueueOptions = {}
): Promise<SourceCandidateIdentityGroup[]> {
  const candidates = await prisma.sourceCandidate.findMany({
    where: sourceCandidateReviewQueueWhere(options),
    orderBy: [{ source: "asc" }, { externalId: "asc" }, { triageScore: "desc" }],
    take: MAX_IDENTITY_SCAN_CANDIDATES
  });
  const groupsByIdentity = new Map<string, SourceCandidate[]>();

  for (const candidate of candidates.map(mapDbSourceCandidate)) {
    const key = sourceCandidateIdentityKey(candidate);
    groupsByIdentity.set(key, [...(groupsByIdentity.get(key) ?? []), candidate]);
  }

  return Array.from(groupsByIdentity.values())
    .filter((group) => group.length > 1)
    .map((candidatesInGroup) => ({
      candidates: candidatesInGroup,
      externalId: candidatesInGroup[0]?.externalId ?? "",
      source: candidatesInGroup[0]?.source ?? "PubMed"
    }))
    .sort(sourceCandidateIdentityGroupSort)
    .slice(0, normaliseIdentityGroupLimit(options.limit));
}

function sourceCandidateIdentityCounts(candidates: SourceCandidate[]) {
  const counts = new Map<string, number>();

  for (const candidate of candidates) {
    const key = sourceCandidateIdentityKey(candidate);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function sourceCandidateIdentityKey(candidate: SourceCandidate) {
  return `${candidate.source}\u0000${candidate.externalId}`;
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

export async function listSourceCandidateSiblings(
  dedupeKey: string,
  options: SourceCandidateSiblingOptions = {}
): Promise<SourceCandidateSiblings | null> {
  const target = await prisma.sourceCandidate.findUnique({
    where: {
      dedupeKey
    }
  });

  if (!target) {
    return null;
  }

  const siblings = await prisma.sourceCandidate.findMany({
    where: sourceCandidateSiblingWhere(target),
    orderBy: [{ externalId: "asc" }, { triageScore: "desc" }, { updatedAt: "desc" }],
    take: normaliseSiblingLimit(options.limit)
  });

  return {
    siblings: siblings.map((candidate) => ({
      candidate: mapDbSourceCandidate(candidate),
      matchReasons: sourceCandidateSiblingMatchReasons(target, candidate)
    })),
    target: mapDbSourceCandidate(target)
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

  if (!referenceMatchesSourceCandidate(acceptedReference, candidate)) {
    return sourceCandidateCurationStatus({
      acceptedReference: mapDbReference(acceptedReference),
      acceptedReferenceId,
      candidate: mappedCandidate,
      status: "Accepted reference mismatch"
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

export async function getSourceCandidateCurationDraft(
  dedupeKey: string
): Promise<SourceCandidateCurationDraft | null> {
  const status = await getSourceCandidateCurationStatus(dedupeKey);

  if (!status) {
    return null;
  }

  return {
    claimLinkDraft: sourceCandidateClaimLinkDraft(status),
    status,
    studyExtractionDraft: sourceCandidateStudyExtractionDraft(status)
  };
}

export async function linkAcceptedSourceCandidateClaim({
  dedupeKey,
  note,
  relevance
}: LinkAcceptedSourceCandidateClaimInput): Promise<LinkedSourceCandidateClaim> {
  const candidate = await prisma.sourceCandidate.findUnique({
    where: {
      dedupeKey
    }
  });

  if (!candidate || candidate.decision !== DbSourceCandidateDecision.ACCEPTED) {
    throw new Error("Accepted source candidate not found for claim linking.");
  }

  if (!candidate.acceptedReferenceId) {
    throw new Error("Accepted source candidate requires an acceptedReferenceId before claim linking.");
  }

  if (!candidate.claimId) {
    throw new Error("Accepted source candidate requires a claimId before claim linking.");
  }

  const [acceptedReference, claim] = await Promise.all([
    prisma.reference.findUnique({
      where: {
        id: candidate.acceptedReferenceId
      }
    }),
    prisma.claim.findUnique({
      where: {
        id: candidate.claimId
      }
    })
  ]);

  if (!acceptedReference) {
    throw new Error("Accepted source candidate reference was not found.");
  }

  if (!referenceMatchesSourceCandidate(acceptedReference, candidate)) {
    throw new Error(
      "Accepted source candidate reference must match candidate source and external id."
    );
  }

  if (!claim) {
    throw new Error("Accepted source candidate claim was not found.");
  }

  if (candidate.interventionId && claim.interventionId !== candidate.interventionId) {
    throw new Error("Accepted source candidate claim must belong to candidate intervention.");
  }

  const linkInput = {
    claimId: candidate.claimId,
    note: normaliseClaimLinkNote(note, candidate),
    referenceId: candidate.acceptedReferenceId,
    relevance: normaliseClaimLinkRelevance(relevance)
  };
  const existingLink = await prisma.claimReference.findUnique({
    where: {
      claimId_referenceId: {
        claimId: linkInput.claimId,
        referenceId: linkInput.referenceId
      }
    }
  });
  const claimLink = await prisma.claimReference.upsert({
    where: {
      claimId_referenceId: {
        claimId: linkInput.claimId,
        referenceId: linkInput.referenceId
      }
    },
    create: linkInput,
    update: {
      note: linkInput.note,
      relevance: linkInput.relevance
    }
  });
  const studies = await prisma.study.findMany({
    where: {
      referenceId: acceptedReference.id
    },
    orderBy: [{ year: "desc" }, { title: "asc" }]
  });
  const mappedCandidate = mapDbSourceCandidate(candidate);
  const mappedClaimLink = mapDbClaimReference(claimLink);
  const mappedStudies = studies.map(mapDbCurationStudy);
  const mappedReference = mapDbReference(acceptedReference);
  const status = sourceCandidateCurationStatus({
    acceptedReference: mappedReference,
    acceptedReferenceId: candidate.acceptedReferenceId,
    candidate: mappedCandidate,
    candidateClaimLinked: true,
    claimLinks: [mappedClaimLink],
    status: curationStatusKind([mappedClaimLink], mappedStudies, true),
    studies: mappedStudies
  });

  return {
    acceptedReference: mappedReference,
    candidate: mappedCandidate,
    claimLink: mappedClaimLink,
    created: !existingLink,
    status
  };
}

export async function extractAcceptedSourceCandidateStudy({
  dedupeKey,
  ...input
}: ExtractAcceptedSourceCandidateStudyInput): Promise<ExtractedSourceCandidateStudy> {
  const candidate = await prisma.sourceCandidate.findUnique({
    where: {
      dedupeKey
    }
  });

  if (!candidate || candidate.decision !== DbSourceCandidateDecision.ACCEPTED) {
    throw new Error("Accepted source candidate not found for study extraction.");
  }

  if (!candidate.acceptedReferenceId) {
    throw new Error("Accepted source candidate requires an acceptedReferenceId before study extraction.");
  }

  if (!candidate.claimId) {
    throw new Error("Accepted source candidate requires a claimId before study extraction.");
  }

  const [acceptedReference, claim, claimLink, existingStudies] = await Promise.all([
    prisma.reference.findUnique({
      where: {
        id: candidate.acceptedReferenceId
      }
    }),
    prisma.claim.findUnique({
      where: {
        id: candidate.claimId
      }
    }),
    prisma.claimReference.findUnique({
      where: {
        claimId_referenceId: {
          claimId: candidate.claimId,
          referenceId: candidate.acceptedReferenceId
        }
      }
    }),
    prisma.study.findMany({
      where: {
        referenceId: candidate.acceptedReferenceId
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }]
    })
  ]);

  if (!acceptedReference) {
    throw new Error("Accepted source candidate reference was not found.");
  }

  if (!referenceMatchesSourceCandidate(acceptedReference, candidate)) {
    throw new Error(
      "Accepted source candidate reference must match candidate source and external id."
    );
  }

  if (!claim) {
    throw new Error("Accepted source candidate claim was not found.");
  }

  if (candidate.interventionId && claim.interventionId !== candidate.interventionId) {
    throw new Error("Accepted source candidate claim must belong to candidate intervention.");
  }

  if (!claimLink) {
    throw new Error("Accepted source candidate claim link is required before study extraction.");
  }

  if (existingStudies.length > 0 && !input.updateExisting) {
    throw new Error("Accepted source candidate reference already has study extraction.");
  }

  if (existingStudies.length > 1 && input.updateExisting) {
    throw new Error(
      "Accepted source candidate reference has multiple study extractions; update manually."
    );
  }

  const studyInput = sourceCandidateStudyExtractionInput(
    input,
    candidate,
    acceptedReference
  );
  const existingStudy = existingStudies[0];
  const study = existingStudy
    ? await prisma.study.update({
        where: {
          id: existingStudy.id
        },
        data: studyInput
      })
    : await prisma.study.create({
        data: studyInput
      });
  const mappedCandidate = mapDbSourceCandidate(candidate);
  const mappedReference = mapDbReference(acceptedReference);
  const mappedClaimLink = mapDbClaimReference(claimLink);
  const mappedStudy = mapDbCurationStudy(study);
  const status = sourceCandidateCurationStatus({
    acceptedReference: mappedReference,
    acceptedReferenceId: candidate.acceptedReferenceId,
    candidate: mappedCandidate,
    candidateClaimLinked: true,
    claimLinks: [mappedClaimLink],
    status: curationStatusKind([mappedClaimLink], [mappedStudy], true),
    studies: [mappedStudy]
  });

  return {
    acceptedReference: mappedReference,
    candidate: mappedCandidate,
    created: !existingStudy,
    status,
    study: mappedStudy
  };
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

  if (options.interventionIdMissing) {
    where.interventionId = null;
  } else if (options.interventionId) {
    where.interventionId = options.interventionId;
  }

  if (options.claimIdMissing) {
    where.claimId = null;
  } else if (options.claimId) {
    where.claimId = options.claimId;
  }

  if (options.region) {
    where.region = options.region;
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

    if (!referenceMatchesSourceCandidate(acceptedReference, candidate)) {
      return sourceCandidateCurationStatus({
        acceptedReference: mapDbReference(acceptedReference),
        acceptedReferenceId,
        candidate: mappedCandidate,
        status: "Accepted reference mismatch"
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

function sourceCandidateReviewQueueWhere(
  options: SourceCandidateReviewQueueOptions
): Prisma.SourceCandidateWhereInput {
  const where: Prisma.SourceCandidateWhereInput = {
    decision: decisionMap[options.decision ?? "Pending review"]
  };

  if (options.source) {
    where.source = sourceMap[options.source];
  }

  if (options.ingestionJobId) {
    where.ingestionJobId = options.ingestionJobId;
  }

  if (options.externalId) {
    where.externalId = options.externalId;
  }

  if (options.interventionIdMissing) {
    where.interventionId = null;
  } else if (options.interventionId) {
    where.interventionId = options.interventionId;
  }

  if (options.claimIdMissing) {
    where.claimId = null;
  } else if (options.claimId) {
    where.claimId = options.claimId;
  }

  if (options.region) {
    where.region = options.region;
  }

  return where;
}

function sourceCandidateIdentityGroupSort(
  left: SourceCandidateIdentityGroup,
  right: SourceCandidateIdentityGroup
) {
  const countDelta = right.candidates.length - left.candidates.length;

  if (countDelta !== 0) {
    return countDelta;
  }

  const leftTriage = Math.max(...left.candidates.map((candidate) => candidate.triageScore));
  const rightTriage = Math.max(
    ...right.candidates.map((candidate) => candidate.triageScore)
  );
  const triageDelta = rightTriage - leftTriage;

  if (triageDelta !== 0) {
    return triageDelta;
  }

  return `${left.source}:${left.externalId}`.localeCompare(
    `${right.source}:${right.externalId}`
  );
}

function normaliseReviewQueueLimit(limit: number | undefined) {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_REVIEW_QUEUE_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), MAX_REVIEW_QUEUE_LIMIT);
}

function normaliseReviewOverviewLimit(limit: number | undefined) {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_REVIEW_OVERVIEW_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), MAX_REVIEW_OVERVIEW_LIMIT);
}

function compareSourceCandidateReviewOverviewGroups(
  left: SourceCandidateReviewOverviewGroup,
  right: SourceCandidateReviewOverviewGroup
) {
  const topTriageDelta = right.topTriageScore - left.topTriageScore;

  if (topTriageDelta !== 0) {
    return topTriageDelta;
  }

  const countDelta = right.count - left.count;

  if (countDelta !== 0) {
    return countDelta;
  }

  return [
    left.claimId ?? "",
    left.interventionId ?? "",
    left.source,
    left.region
  ].join(":").localeCompare([
    right.claimId ?? "",
    right.interventionId ?? "",
    right.source,
    right.region
  ].join(":"));
}

function compareSourceCandidateReviewOverviewTop(
  left: SourceCandidate,
  right: SourceCandidate
) {
  const triageDelta = right.triageScore - left.triageScore;

  if (triageDelta !== 0) {
    return triageDelta;
  }

  return 0;
}

function normaliseIdentityGroupLimit(limit: number | undefined) {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_IDENTITY_GROUP_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), MAX_IDENTITY_GROUP_LIMIT);
}

function normaliseCurationHandoffLimit(limit: number | undefined) {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_CURATION_HANDOFF_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), MAX_CURATION_HANDOFF_LIMIT);
}

function normaliseSiblingLimit(limit: number | undefined) {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_SIBLING_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), MAX_SIBLING_LIMIT);
}

function sourceCandidateSiblingWhere(
  target: DbSourceCandidate
): Prisma.SourceCandidateWhereInput {
  return {
    source: target.source,
    dedupeKey: {
      not: target.dedupeKey
    },
    OR: [
      {
        externalId: target.externalId
      },
      {
        claimId: target.claimId,
        interventionId: target.interventionId,
        query: target.query,
        region: target.region
      }
    ]
  };
}

function sourceCandidateSiblingMatchReasons(
  target: DbSourceCandidate,
  candidate: DbSourceCandidate
): SourceCandidateSiblingMatchReason[] {
  const reasons: SourceCandidateSiblingMatchReason[] = [];

  if (candidate.source === target.source && candidate.externalId === target.externalId) {
    reasons.push("Same source/external id");
  }

  if (candidate.query === target.query && candidate.region === target.region) {
    reasons.push("Same query/region");
  }

  if (candidate.interventionId && candidate.interventionId === target.interventionId) {
    reasons.push("Same intervention context");
  }

  if (candidate.claimId && candidate.claimId === target.claimId) {
    reasons.push("Same claim context");
  }

  return reasons;
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

function normaliseClaimLinkNote(
  note: string | undefined,
  candidate: DbSourceCandidate
) {
  const trimmed = note?.trim();

  if (trimmed) {
    return trimmed;
  }

  return `Accepted ${sourceFromDb(candidate.source)} candidate ${candidate.externalId}: ${candidate.title}`;
}

function normaliseClaimLinkRelevance(relevance: number | undefined) {
  if (relevance === undefined || !Number.isFinite(relevance)) {
    return 5;
  }

  return Math.min(Math.max(Math.trunc(relevance), 1), 5);
}

function sourceCandidateStudyExtractionInput(
  input: Omit<ExtractAcceptedSourceCandidateStudyInput, "dedupeKey">,
  candidate: DbSourceCandidate,
  acceptedReference: DbReference
): Prisma.StudyUncheckedCreateInput {
  return {
    abstract: normaliseOptionalText(input.abstract),
    adverseEvents: requireStudyText(input.adverseEvents, "--study-adverse-events"),
    doi: metadataString(metadataObject(candidate.metadata), "doi"),
    dose: normaliseOptionalText(input.dose),
    duration: normaliseOptionalText(input.duration),
    fundingConflicts: requireStudyText(
      input.fundingConflicts,
      "--study-funding-conflicts"
    ),
    interventionName: requireStudyText(
      input.interventionName,
      "--study-intervention-name"
    ),
    mainResults: normaliseOptionalText(input.mainResults),
    nctId:
      candidate.source === DbSourceKind.CLINICALTRIALS_GOV
        ? normaliseNctId(candidate.externalId)
        : undefined,
    outcomes: normaliseStudyOutcomes(input.outcomes),
    pmid:
      candidate.source === DbSourceKind.PUBMED
        ? normalisePubMedId(candidate.externalId)
        : undefined,
    population: requireStudyText(input.population, "--study-population"),
    referenceId: acceptedReference.id,
    relevanceScore: normaliseClaimLinkRelevance(input.relevance),
    riskOfBias: requireStudyText(input.riskOfBias, "--study-risk-of-bias"),
    sampleSize: requireStudyText(input.sampleSize, "--study-sample-size"),
    source: sourceFromDb(candidate.source),
    sourceType: normaliseStudySourceType(input.sourceType, mapDbSourceCandidate(candidate)),
    title: acceptedReference.title || candidate.title,
    url: candidate.url,
    year: candidate.publishedYear ?? acceptedReference.year
  };
}

function normaliseStudySourceType(
  sourceType: SourceCandidateStudyExtractionSourceType | undefined,
  candidate: SourceCandidate
) {
  const candidateSourceType = sourceType ?? sourceCandidateStudyTypeSuggestion(candidate);

  if (isStudySourceType(candidateSourceType)) {
    return studyTypeMap[candidateSourceType];
  }

  throw new Error(
    "Study extraction requires --study-source-type because source type cannot be inferred."
  );
}

function isStudySourceType(
  value: string
): value is SourceCandidateStudyExtractionSourceType {
  return value in studyTypeMap;
}

function normaliseStudyOutcomes(outcomes: string[]) {
  const normalised = outcomes
    .map((outcome) => outcome.trim())
    .filter((outcome) => outcome.length > 0);

  if (normalised.length === 0) {
    throw new Error("Study extraction requires at least one --study-outcome.");
  }

  return normalised;
}

function requireStudyText(value: string, option: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`Study extraction requires ${option}.`);
  }

  return trimmed;
}

function normaliseOptionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function sourceCandidateClaimLinkDraft(
  status: SourceCandidateCurationStatus
): SourceCandidateCurationClaimLinkDraft | undefined {
  const candidate = status.candidate;

  if (
    !isDraftableAcceptedReferenceStatus(status) ||
    !candidate.claimId ||
    !status.acceptedReferenceId
  ) {
    return undefined;
  }

  return {
    alreadyLinked: status.candidateClaimLinked === true,
    claimId: candidate.claimId,
    note: `Accepted ${candidate.source} candidate ${candidate.externalId}: ${candidate.title}`,
    referenceId: status.acceptedReferenceId,
    relevance: 5
  };
}

function sourceCandidateStudyExtractionDraft(
  status: SourceCandidateCurationStatus
): SourceCandidateCurationStudyExtractionDraft | undefined {
  const candidate = status.candidate;

  if (!isDraftableAcceptedReferenceStatus(status) || !status.acceptedReferenceId) {
    return undefined;
  }

  return {
    abstractAvailable: candidate.abstractAvailable,
    alreadyExtracted: status.studies.length > 0,
    doi: metadataString(candidate.metadata, "doi"),
    manualFields: MANUAL_STUDY_EXTRACTION_FIELDS,
    metadataFields: curationDraftMetadataFields(candidate),
    nctId:
      candidate.source === "ClinicalTrials.gov"
        ? normaliseNctId(candidate.externalId)
        : undefined,
    pmid:
      candidate.source === "PubMed"
        ? normalisePubMedId(candidate.externalId)
        : undefined,
    referenceId: status.acceptedReferenceId,
    source: candidate.source,
    sourceTypeSuggestion: sourceCandidateStudyTypeSuggestion(candidate),
    title: candidate.title,
    url: candidate.url,
    year: candidate.publishedYear
  };
}

function isDraftableAcceptedReferenceStatus(status: SourceCandidateCurationStatus) {
  return Boolean(
    status.acceptedReference &&
      status.status !== "Not accepted" &&
      status.status !== "Accepted reference missing" &&
      status.status !== "Accepted reference mismatch"
  );
}

function sourceCandidateStudyTypeSuggestion(candidate: SourceCandidate) {
  if (candidate.source === "ClinicalTrials.gov") {
    return "CLINICAL_TRIAL_RECORD";
  }

  const sourceText = [
    candidate.sourceType,
    ...metadataStringArray(candidate.metadata, "publicationTypes")
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (sourceText.includes("meta-analysis")) {
    return "META_ANALYSIS";
  }

  if (sourceText.includes("systematic review")) {
    return "SYSTEMATIC_REVIEW";
  }

  if (sourceText.includes("randomized") || sourceText.includes("clinical trial")) {
    return "RANDOMIZED_CONTROLLED_TRIAL";
  }

  if (sourceText.includes("review")) {
    return "SYSTEMATIC_REVIEW";
  }

  return "Manual review required";
}

function curationDraftMetadataFields(
  candidate: SourceCandidate
): SourceCandidateCurationDraftMetadataField[] {
  const fields: SourceCandidateCurationDraftMetadataField[] = [];

  for (const key of [
    "journal",
    "publicationDate",
    "publicationTypes",
    "authors",
    "doi",
    "status",
    "phase",
    "enrollment",
    "conditions",
    "interventions",
    "primaryOutcomes",
    "hasResults",
    "resultsFirstPostDate",
    "sponsor",
    "lastUpdateDate"
  ]) {
    const value = metadataDisplayValue(candidate.metadata, key);

    if (value) {
      fields.push({
        label: key,
        value
      });
    }
  }

  return fields;
}

function metadataDisplayValue(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];

  if (Array.isArray(value)) {
    const items = value.filter(
      (item): item is string | number | boolean =>
        ["string", "number", "boolean"].includes(typeof item)
    );

    return items.length > 0 ? items.join(", ") : undefined;
  }

  if (["string", "number", "boolean"].includes(typeof value)) {
    return String(value);
  }

  return undefined;
}

function metadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function metadataStringArray(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0
  );
}

function curationNextAction(status: SourceCandidateCurationStatusKind) {
  switch (status) {
    case "Not accepted":
      return "Accept with a matching curated reference before curation handoff.";
    case "Accepted reference missing":
      return "Attach or restore the matching curated reference before public packet review.";
    case "Accepted reference mismatch":
      return "Replace the accepted reference with one matching the candidate source and external id.";
    case "Candidate claim missing":
      return "Review or queue this candidate with a claim id before public packet review.";
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
  if (candidateClaimLinked === undefined) {
    return "Candidate claim missing";
  }

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
