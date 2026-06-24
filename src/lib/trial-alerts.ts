import {
  TrialAlertKind as DbTrialAlertKind,
  TrialAlertStatus as DbTrialAlertStatus,
  type Prisma
} from "@prisma/client";

import type {
  ClinicalTrialAlertLabel,
  ClinicalTrialSearchResult
} from "@/lib/integrations/clinical-trials";

export interface TrialAlertDraftContext {
  claimId?: string;
  detectedAt?: Date;
  interventionId?: string;
  sourceCandidateIdByNctId?: Map<string, string>;
  trialIdByNctId?: Map<string, string>;
}

export interface TrialAlertDraft {
  data: Prisma.TrialAlertCreateInput;
  nctId: string;
}

const alertKindByLabel: Record<ClinicalTrialAlertLabel, DbTrialAlertKind> = {
  "Low-priority lead": DbTrialAlertKind.LOW_PRIORITY_LEAD,
  "Missing results follow-up": DbTrialAlertKind.MISSING_RESULTS_FOLLOW_UP,
  "Monitor active trial": DbTrialAlertKind.MONITOR_ACTIVE_TRIAL,
  "Registry status review": DbTrialAlertKind.REGISTRY_STATUS_REVIEW,
  "Results review needed": DbTrialAlertKind.RESULTS_REVIEW_NEEDED
};

export function buildClinicalTrialAlertDrafts(
  result: ClinicalTrialSearchResult,
  context: TrialAlertDraftContext = {}
): TrialAlertDraft[] {
  return result.studies.map((study) => {
    const sourceCandidateId = context.sourceCandidateIdByNctId?.get(study.nctId);
    const trialId = context.trialIdByNctId?.get(study.nctId);

    return {
      data: {
        claim: context.claimId
          ? {
              connect: {
                id: context.claimId
              }
            }
          : undefined,
        detectedAt: context.detectedAt,
        detail: study.trialAlertDetail,
        intervention: context.interventionId
          ? {
              connect: {
                id: context.interventionId
              }
            }
          : undefined,
        kind: alertKindByLabel[study.trialAlertLabel],
        metadata: {
          completionDate: study.completionDate,
          hasResults: study.hasResults,
          lastUpdateDate: study.lastUpdateDate,
          query: result.query,
          relevanceLabel: study.trialRelevanceLabel,
          resultLabel: study.trialResultLabel,
          source: result.source,
          status: study.status,
          triageScore: study.triageScore
        },
        nctId: study.nctId === "Unknown NCT" ? undefined : study.nctId,
        noAutoPromotion: true,
        sourceCandidate: sourceCandidateId
          ? {
              connect: {
                id: sourceCandidateId
              }
            }
          : undefined,
        status: DbTrialAlertStatus.OPEN,
        title: study.title,
        trial: trialId
          ? {
              connect: {
                id: trialId
              }
            }
          : undefined
      },
      nctId: study.nctId
    };
  });
}
