import { readSourceCandidateDiscoveryClassification } from "@/lib/source-candidate-metadata";

export const DEFAULT_PUBMED_RETMAX = 20;
export const MAX_PUBMED_DEEPENING_RESULTS = 100;
export const DEFAULT_PUBMED_DEEPENING_CATCH_UP_LIMIT = 500;
export const MAX_PUBMED_DEEPENING_CATCH_UP_LIMIT = 2000;
export const MIN_PUBMED_DEEPENING_USEFUL_CANDIDATES = 3;
export const MIN_PUBMED_DEEPENING_USEFUL_RATIO = 0.25;

export interface PubMedDeepeningCandidateSignal {
  metadata: unknown;
  triageScore: number;
}

export interface PubMedDeepeningAssessment {
  candidateCount: number;
  maxResults: number;
  nextPageStart: number;
  pageSize: number;
  pageStart: number;
  reason: string;
  shouldQueue: boolean;
  totalCount?: number;
  usefulCandidateCount: number;
  usefulRatio: number;
}

export function normalisePubMedRetmax(retmax: number | undefined) {
  if (retmax === undefined || !Number.isFinite(retmax)) {
    return DEFAULT_PUBMED_RETMAX;
  }

  return Math.min(Math.max(Math.trunc(retmax), 1), DEFAULT_PUBMED_RETMAX);
}

export function normalisePubMedDeepeningCatchUpLimit(limit: number | undefined) {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_PUBMED_DEEPENING_CATCH_UP_LIMIT;
  }

  return Math.min(
    Math.max(Math.trunc(limit), 1),
    MAX_PUBMED_DEEPENING_CATCH_UP_LIMIT
  );
}

export function sourceCandidateSignalLooksWorthDeepening(
  candidate: PubMedDeepeningCandidateSignal
) {
  const classification = readSourceCandidateDiscoveryClassification(candidate.metadata);

  if (classification) {
    return (
      classification.bucket === "likely-useful" ||
      classification.bucket === "maybe-useful"
    );
  }

  return candidate.triageScore >= 50;
}

export function pubMedDeepeningUsefulnessSummary(
  candidates: PubMedDeepeningCandidateSignal[],
  precountedUsefulCount?: number
) {
  const usefulCandidateCount =
    precountedUsefulCount ?? candidates.filter(sourceCandidateSignalLooksWorthDeepening).length;
  const usefulRatio =
    candidates.length > 0 ? usefulCandidateCount / candidates.length : 0;

  return {
    candidateCount: candidates.length,
    usefulCandidateCount,
    usefulRatio
  };
}

export function hasEnoughUsefulPubMedCandidates(
  candidates: PubMedDeepeningCandidateSignal[],
  precountedUsefulCount?: number
) {
  const summary = pubMedDeepeningUsefulnessSummary(candidates, precountedUsefulCount);

  if (summary.candidateCount === 0) {
    return false;
  }

  return (
    summary.usefulCandidateCount >= MIN_PUBMED_DEEPENING_USEFUL_CANDIDATES ||
    summary.usefulRatio >= MIN_PUBMED_DEEPENING_USEFUL_RATIO
  );
}

export function assessPubMedDeepeningPage({
  candidates,
  pageSize,
  pageStart,
  totalCount
}: {
  candidates: PubMedDeepeningCandidateSignal[];
  pageSize: number;
  pageStart: number;
  totalCount?: number;
}): PubMedDeepeningAssessment {
  const nextPageStart = pageStart + pageSize;
  const summary = pubMedDeepeningUsefulnessSummary(candidates);
  const base = {
    ...summary,
    maxResults: MAX_PUBMED_DEEPENING_RESULTS,
    nextPageStart,
    pageSize,
    pageStart,
    ...(typeof totalCount === "number" ? { totalCount } : {})
  };

  if (candidates.length < pageSize) {
    return {
      ...base,
      reason: "current PubMed page was not full",
      shouldQueue: false
    };
  }

  if (typeof totalCount === "number" && nextPageStart >= totalCount) {
    return {
      ...base,
      reason: "PubMed reports no further result pages",
      shouldQueue: false
    };
  }

  if (nextPageStart >= MAX_PUBMED_DEEPENING_RESULTS) {
    return {
      ...base,
      reason: `reached local PubMed deepening cap of ${MAX_PUBMED_DEEPENING_RESULTS} results`,
      shouldQueue: false
    };
  }

  if (!hasEnoughUsefulPubMedCandidates(candidates, summary.usefulCandidateCount)) {
    return {
      ...base,
      reason: "current PubMed page did not have enough useful-looking candidates",
      shouldQueue: false
    };
  }

  return {
    ...base,
    reason: "enough useful-looking candidates to check the next page",
    shouldQueue: true
  };
}
