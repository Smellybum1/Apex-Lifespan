import {
  upsertSourceCandidateDrafts,
  type SourceCandidateUpsertSummary
} from "@/lib/data/source-candidates";
import { searchClinicalTrials } from "@/lib/integrations/clinical-trials";
import { searchPubMed } from "@/lib/integrations/pubmed";
import {
  buildClinicalTrialSourceCandidates,
  buildPubMedSourceCandidates,
  type SourceCandidateContext
} from "@/lib/source-candidates";
import type { SourceCandidate, SourceCandidateSource } from "@/lib/types";

interface SourceCandidateIngestionContext extends SourceCandidateContext {
  term: string;
}

export interface PubMedSourceCandidateIngestionInput extends SourceCandidateIngestionContext {
  retmax?: number;
  retstart?: number;
}

export interface ClinicalTrialSourceCandidateIngestionInput
  extends SourceCandidateIngestionContext {
  pageSize?: number;
}

export interface SourceCandidateIngestionResult {
  source: SourceCandidateSource;
  query: string;
  candidates: SourceCandidate[];
  totalCount?: number;
  pageStart?: number;
  upsert: SourceCandidateUpsertSummary;
}

export async function ingestPubMedSourceCandidates({
  term,
  retmax,
  retstart,
  ...context
}: PubMedSourceCandidateIngestionInput): Promise<SourceCandidateIngestionResult> {
  const result = await searchPubMed(term, retmax, {
    includeAbstractText: true,
    retstart
  });
  const candidates = buildPubMedSourceCandidates(result, context);
  const upsert = await upsertSourceCandidateDrafts(candidates);

  return {
    source: "PubMed",
    query: result.query,
    candidates,
    totalCount: result.count,
    pageStart: result.retstart,
    upsert
  };
}

export async function ingestClinicalTrialSourceCandidates({
  term,
  pageSize,
  ...context
}: ClinicalTrialSourceCandidateIngestionInput): Promise<SourceCandidateIngestionResult> {
  const result = await searchClinicalTrials(term, pageSize);
  const candidates = buildClinicalTrialSourceCandidates(result, context);
  const upsert = await upsertSourceCandidateDrafts(candidates);

  return {
    source: "ClinicalTrials.gov",
    query: result.query,
    candidates,
    upsert
  };
}
