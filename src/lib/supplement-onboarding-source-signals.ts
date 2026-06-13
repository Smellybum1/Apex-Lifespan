import { prisma } from "@/lib/db/prisma";
import { assessSourceCandidateConviction } from "@/lib/source-conviction";
import type {
  SupplementOnboardingSourceSignals
} from "@/lib/supplement-onboarding-readiness";
import type {
  EvidenceDashboardData,
  ReviewStatus,
  SourceCandidate,
  SourceCandidateDecision,
  SourceCandidateSource
} from "@/lib/types";

export async function readSupplementOnboardingSourceSignals({
  claimId,
  data,
  limit = 500,
  supplementQuery
}: {
  claimId?: string;
  data: Pick<EvidenceDashboardData, "claims" | "dataSource" | "interventions">;
  limit?: number;
  supplementQuery?: string;
}): Promise<SupplementOnboardingSourceSignals> {
  if (data.dataSource !== "database") {
    return {
      unavailableReason: "database-backed source tracking is unavailable in seed data mode"
    };
  }

  const supplement = supplementQuery
    ? findIntervention(data.interventions, supplementQuery)
    : undefined;
  const claimIds = new Set<string>();

  if (claimId) {
    claimIds.add(claimId);
  }

  if (supplement) {
    for (const claim of data.claims) {
      if (claim.interventionId === supplement.id) {
        claimIds.add(claim.id);
      }
    }
  }

  const where =
    claimIds.size > 0 || supplement
      ? {
          OR: [
            ...(supplement ? [{ interventionId: supplement.id }] : []),
            ...(claimIds.size > 0
              ? [
                  {
                    claimId: {
                      in: Array.from(claimIds)
                    }
                  }
                ]
              : [])
          ]
        }
      : {};

  try {
    const [candidates, jobs] = await Promise.all([
      prisma.sourceCandidate.findMany({
        where,
        orderBy: [{ triageScore: "desc" }, { updatedAt: "desc" }],
        take: limit
      }),
      prisma.ingestionJob.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }],
        take: limit
      })
    ]);

    return {
      candidates: candidates.map((candidate) => {
        const sourceCandidate: SourceCandidate = {
          abstractAvailable: candidate.abstractAvailable ?? undefined,
          acceptedReferenceId: candidate.acceptedReferenceId ?? undefined,
          claimId: candidate.claimId ?? undefined,
          decision: decisionFromDb(candidate.decision),
          dedupeKey: candidate.dedupeKey,
          externalId: candidate.externalId,
          ingestionJobId: candidate.ingestionJobId ?? undefined,
          interventionId: candidate.interventionId ?? undefined,
          metadata:
            candidate.metadata && typeof candidate.metadata === "object"
              ? (candidate.metadata as Record<string, unknown>)
              : {},
          publishedYear: candidate.publishedYear ?? undefined,
          query: candidate.query,
          region: candidate.region,
          reviewNote: candidate.reviewNote ?? undefined,
          reviewStatus: reviewStatusFromDb(candidate.reviewStatus),
          reviewedAt: candidate.reviewedAt?.toISOString(),
          source: sourceFromDb(candidate.source),
          sourceType: candidate.sourceType ?? undefined,
          title: candidate.title,
          triageReasons: candidate.triageReasons,
          triageScore: candidate.triageScore,
          url: candidate.url
        };
        const conviction = assessSourceCandidateConviction(sourceCandidate);

        return {
          acceptedReferenceId: candidate.acceptedReferenceId ?? undefined,
          claimId: candidate.claimId ?? undefined,
          convictionLabel: conviction.label,
          convictionLimitations: conviction.limitations,
          convictionPositiveFactors: conviction.positiveFactors,
          convictionRubricVersion: conviction.rubricVersion,
          convictionScore: conviction.score,
          convictionScoreBreakdown: conviction.scoreBreakdown,
          convictionUncertainty: conviction.uncertainty,
          sourceReputationLabel: conviction.sourceReputationLabel,
          dedupeKey: candidate.dedupeKey,
          decision: candidate.decision,
          externalId: candidate.externalId,
          interventionId: candidate.interventionId ?? undefined,
          reviewStatus: candidate.reviewStatus,
          source: sourceCandidate.source,
          title: candidate.title,
          triageRationale: conviction.triageRationale,
          triageRecommendation: conviction.triageRecommendation
        };
      }),
      jobs: jobs.map((job) => ({
        claimId: job.claimId ?? undefined,
        interventionId: job.interventionId ?? undefined,
        status: job.status
      }))
    };
  } catch (error) {
    return {
      unavailableReason: error instanceof Error ? error.message : String(error)
    };
  }
}

function findIntervention(
  interventions: Array<{ id: string; name: string; slug: string }>,
  query: string
) {
  const normalized = query.trim().toLowerCase();

  return interventions.find(
    (intervention) =>
      intervention.id.toLowerCase() === normalized ||
      intervention.slug.toLowerCase() === normalized ||
      intervention.name.toLowerCase() === normalized
  );
}

function sourceFromDb(source: string): SourceCandidateSource {
  return source === "CLINICALTRIALS_GOV" ? "ClinicalTrials.gov" : "PubMed";
}

function decisionFromDb(decision: string): SourceCandidateDecision {
  if (decision === "ACCEPTED") {
    return "Accepted";
  }

  if (decision === "REJECTED") {
    return "Rejected";
  }

  return "Pending review";
}

function reviewStatusFromDb(reviewStatus: string): ReviewStatus {
  return reviewStatus === "HUMAN_REVIEWED" ? "Human reviewed" : "Unreviewed AI draft";
}
