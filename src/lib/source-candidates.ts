import type { ClinicalTrialSearchResult } from "@/lib/integrations/clinical-trials";
import type { PubMedArticleSummary, PubMedSearchResult } from "@/lib/integrations/pubmed";
import {
  SOURCE_CANDIDATE_DISCOVERY_CLASSIFIER_VERSION,
  sourceCandidateMetadataString,
  sourceCandidateMetadataStringArray,
  type SourceCandidateDiscoveryBucket,
  type SourceCandidateDiscoveryClassification
} from "@/lib/source-candidate-metadata";
import type { SourceCandidate, SourceCandidateSource } from "@/lib/types";

export interface SourceCandidateContext {
  region?: string;
  interventionId?: string;
  claimId?: string;
  ingestionJobId?: string;
}

const DEFAULT_REGION = "AU";
const UNREVIEWED_STATUS = "Unreviewed AI draft";
const PENDING_DECISION = "Pending review";

export type {
  SourceCandidateDiscoveryBucket,
  SourceCandidateDiscoveryClassification
} from "@/lib/source-candidate-metadata";

export function buildPubMedSourceCandidates(
  result: PubMedSearchResult,
  context: SourceCandidateContext = {}
): SourceCandidate[] {
  return result.articles.map((article) => {
    const region = context.region ?? DEFAULT_REGION;
    const candidate = {
      dedupeKey: buildSourceCandidateDedupeKey({
        source: "PubMed",
        externalId: article.pmid,
        query: result.query,
        region,
        interventionId: context.interventionId,
        claimId: context.claimId
      }),
      source: "PubMed",
      externalId: article.pmid,
      query: result.query,
      region,
      title: article.title ?? `PubMed PMID ${article.pmid}`,
      url: article.url,
      publishedYear: readYear(article.publicationYear),
      sourceType: sourceTypeFromPubMedArticle(article),
      abstractAvailable: article.hasAbstract ?? undefined,
      triageScore: article.relevanceScore,
      triageReasons: article.relevanceReasons,
      decision: PENDING_DECISION,
      reviewStatus: UNREVIEWED_STATUS,
      interventionId: context.interventionId,
      claimId: context.claimId,
      ingestionJobId: context.ingestionJobId,
      metadata: {
        upstreamSource: result.source,
        journal: article.journal,
        publicationDate: article.publicationDate,
        publicationTypes: article.publicationTypes,
        doi: article.doi,
        authors: article.authors,
        ...(article.abstractText ? { abstractText: article.abstractText } : {})
      }
    } satisfies SourceCandidate;

    return {
      ...candidate,
      metadata: {
        ...candidate.metadata,
        discoveryClassification: classifySourceCandidateForDiscovery(candidate)
      }
    };
  });
}

export function buildClinicalTrialSourceCandidates(
  result: ClinicalTrialSearchResult,
  context: SourceCandidateContext = {}
): SourceCandidate[] {
  return result.studies.map((study) => {
    const region = context.region ?? DEFAULT_REGION;
    const candidate = {
      dedupeKey: buildSourceCandidateDedupeKey({
        source: "ClinicalTrials.gov",
        externalId: study.nctId,
        query: result.query,
        region,
        interventionId: context.interventionId,
        claimId: context.claimId
      }),
      source: "ClinicalTrials.gov",
      externalId: study.nctId,
      query: result.query,
      region,
      title: study.title,
      url: study.url,
      publishedYear: firstYear(study.lastUpdateDate, study.completionDate, study.startDate),
      sourceType: study.studyType,
      triageScore: study.triageScore,
      triageReasons: study.triageReasons,
      decision: PENDING_DECISION,
      reviewStatus: UNREVIEWED_STATUS,
      interventionId: context.interventionId,
      claimId: context.claimId,
      ingestionJobId: context.ingestionJobId,
      metadata: {
        upstreamSource: result.source,
        status: study.status,
        phase: study.phase,
        enrollment: study.enrollment,
        enrollmentCount: study.enrollmentCount,
        conditions: study.conditions,
        interventions: study.interventions,
        primaryOutcomes: study.primaryOutcomes,
        ...(study.briefSummary ? { briefSummary: study.briefSummary } : {}),
        hasResults: study.hasResults,
        resultsFirstPostDate: study.resultsFirstPostDate,
        sponsor: study.sponsor,
        lastUpdateDate: study.lastUpdateDate,
        startDate: study.startDate,
        completionDate: study.completionDate,
        trialRelevanceLabel: study.trialRelevanceLabel,
        trialResultLabel: study.trialResultLabel
      }
    } satisfies SourceCandidate;

    return {
      ...candidate,
      metadata: {
        ...candidate.metadata,
        discoveryClassification: classifySourceCandidateForDiscovery(candidate)
      }
    };
  });
}

export function classifySourceCandidateForDiscovery(
  candidate: SourceCandidate
): SourceCandidateDiscoveryClassification {
  const reasons: string[] = [];
  const cautions: string[] = [];
  let score = 25;
  const sourceType = candidate.sourceType ?? "";
  const combinedText = [
    candidate.title,
    sourceType,
    sourceCandidateMetadataString(candidate.metadata, "abstractText"),
    sourceCandidateMetadataString(candidate.metadata, "briefSummary"),
    ...sourceCandidateMetadataStringArray(candidate.metadata.conditions),
    ...sourceCandidateMetadataStringArray(candidate.metadata.interventions),
    ...sourceCandidateMetadataStringArray(candidate.metadata.primaryOutcomes)
  ].join(" ");

  if (candidate.source === "PubMed") {
    if (isReviewSource(sourceType)) {
      score += 28;
      reasons.push("review or meta-analysis signal");
    }

    if (isHumanTrialSource(sourceType)) {
      score += 24;
      reasons.push("human trial signal");
    }

    if (candidate.abstractAvailable) {
      score += 10;
      reasons.push("abstract available");
    }

    if (sourceCandidateMetadataString(candidate.metadata, "doi")) {
      score += 5;
      reasons.push("DOI available");
    }
  }

  if (candidate.source === "ClinicalTrials.gov") {
    const relevanceLabel = sourceCandidateMetadataString(candidate.metadata, "trialRelevanceLabel");
    const resultLabel = sourceCandidateMetadataString(candidate.metadata, "trialResultLabel");

    if (relevanceLabel === "Direct match") {
      score += 25;
      reasons.push("registered intervention directly matches query");
    } else if (relevanceLabel === "Combination product" || relevanceLabel === "Wrong population") {
      score -= 25;
      cautions.push(relevanceLabel.toLowerCase());
    } else if (relevanceLabel === "Related outcome only") {
      score -= 10;
      cautions.push("query appears in outcome or condition metadata, not intervention metadata");
    }

    if (resultLabel === "Results posted") {
      score += 20;
      reasons.push("registry results posted");
    }

    if (/interventional/i.test(sourceType)) {
      score += 15;
      reasons.push("interventional registry record");
    }
  }

  if (candidate.publishedYear && candidate.publishedYear >= 2020) {
    score += 6;
    reasons.push("recent record");
  }

  if (candidate.triageScore >= 70) {
    score += 10;
    reasons.push("strong ingestion triage score");
  } else if (candidate.triageScore < 40) {
    score -= 10;
    cautions.push("low ingestion triage score");
  }

  if (hasPreclinicalNoiseSignal(combinedText) && !isHumanEvidenceSignal(combinedText)) {
    score -= 35;
    cautions.push("preclinical or non-human signal");
  }

  if (hasReviewOrTrialIntent(candidate.query) && !isReviewSource(sourceType) && !isHumanTrialSource(sourceType)) {
    score -= 10;
    cautions.push("query asked for review/trial evidence but metadata does not show that design");
  }

  if (weakTitleQueryOverlap(candidate)) {
    score -= 12;
    cautions.push("weak title/query overlap");
  }

  const cappedScore = clampClassificationScore(score);
  const bucket = discoveryBucket(cappedScore, cautions);

  return {
    bucket,
    cautions: cautions.slice(0, 4),
    label: discoveryBucketLabel(bucket),
    reasons: reasons.length > 0 ? reasons.slice(0, 4) : ["needs manual relevance review"],
    score: cappedScore,
    version: SOURCE_CANDIDATE_DISCOVERY_CLASSIFIER_VERSION
  };
}

export function buildSourceCandidateDedupeKey({
  source,
  externalId,
  query,
  region,
  interventionId,
  claimId
}: {
  source: SourceCandidateSource;
  externalId: string;
  query: string;
  region: string;
  interventionId?: string;
  claimId?: string;
}) {
  return [source, region, query, externalId, interventionId ?? "", claimId ?? ""]
    .map(normaliseKeyPart)
    .join("|");
}

function sourceTypeFromPubMedArticle(article: PubMedArticleSummary) {
  return article.publicationTypes.length > 0
    ? article.publicationTypes.join(", ")
    : "PubMed article";
}

function firstYear(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const year = readYear(value);

    if (year !== undefined) {
      return year;
    }
  }

  return undefined;
}

function readYear(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }

  const year = value.match(/\b\d{4}\b/)?.[0];
  return year ? Number(year) : undefined;
}

function normaliseKeyPart(value: string) {
  return encodeURIComponent(value.trim().replace(/\s+/g, " ").toLowerCase());
}

function isReviewSource(value: string) {
  return /meta[- ]analysis|systematic review|review/i.test(value);
}

function isHumanTrialSource(value: string) {
  return /randomi[sz]ed|controlled trial|clinical trial/i.test(value);
}

function hasReviewOrTrialIntent(value: string) {
  return /meta[- ]analysis|systematic review|randomi[sz]ed|placebo|clinical trial/i.test(value);
}

function hasPreclinicalNoiseSignal(value: string) {
  return /\b(?:animal|animals|mouse|mice|rat|rats|murine|zebrafish|in vitro|cell line|cells|cultured cells)\b/i.test(
    value
  );
}

function isHumanEvidenceSignal(value: string) {
  return /\b(?:human|humans|adult|adults|participant|participants|patient|patients|clinical trial|randomi[sz]ed|placebo|systematic review|meta[- ]analysis)\b/i.test(
    value
  );
}

function weakTitleQueryOverlap(candidate: SourceCandidate) {
  const title = candidate.title.toLowerCase();
  const queryTokens = usefulQueryTokens(candidate.query);

  if (queryTokens.length === 0) {
    return false;
  }

  const matchingTokens = queryTokens.filter((token) => title.includes(token));

  return matchingTokens.length === 0;
}

function usefulQueryTokens(value: string) {
  const stopwords = new Set([
    "and",
    "benefit",
    "benefits",
    "clinical",
    "health",
    "human",
    "meta",
    "placebo",
    "review",
    "study",
    "systematic",
    "the",
    "trial"
  ]);

  return Array.from(
    new Set(
      value
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 3 && !stopwords.has(token))
    )
  );
}

function clampClassificationScore(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function discoveryBucket(
  score: number,
  cautions: string[]
): SourceCandidateDiscoveryBucket {
  if (score >= 68 && !cautions.some((caution) => caution.includes("preclinical"))) {
    return "likely-useful";
  }

  if (score <= 34 || cautions.some((caution) => caution.includes("preclinical"))) {
    return "likely-noise";
  }

  return "maybe-useful";
}

function discoveryBucketLabel(bucket: SourceCandidateDiscoveryBucket) {
  switch (bucket) {
    case "likely-useful":
      return "Likely useful";
    case "likely-noise":
      return "Likely noise";
    case "maybe-useful":
      return "Maybe useful";
  }
}
