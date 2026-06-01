import type { ClinicalTrialSearchResult } from "@/lib/integrations/clinical-trials";
import type { PubMedArticleSummary, PubMedSearchResult } from "@/lib/integrations/pubmed";
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

export function buildPubMedSourceCandidates(
  result: PubMedSearchResult,
  context: SourceCandidateContext = {}
): SourceCandidate[] {
  return result.articles.map((article) => {
    const region = context.region ?? DEFAULT_REGION;

    return {
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
        authors: article.authors
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

    return {
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
        hasResults: study.hasResults,
        resultsFirstPostDate: study.resultsFirstPostDate,
        sponsor: study.sponsor,
        lastUpdateDate: study.lastUpdateDate,
        startDate: study.startDate,
        completionDate: study.completionDate
      }
    };
  });
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
