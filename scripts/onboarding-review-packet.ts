import { pathToFileURL } from "node:url";

import { loadEnvFile, mergeEnv, withProcessEnv } from "@/lib/env-file";
import type {
  SourceCandidate,
  SourceCandidateDecision,
  SourceCandidateSource,
  ReviewStatus
} from "@/lib/types";
import type { SupplementOnboardingReviewPacketReport } from "@/lib/supplement-onboarding-review-packet";

process.env.APEX_PRISMA_LOG ??= "silent";

interface OnboardingReviewPacketArgs {
  claimId?: string;
  envFilePath?: string;
  supplement?: string;
  summary: boolean;
}

async function main() {
  const args = readArgs(process.argv.slice(2));

  if (!args.supplement && !args.claimId) {
    throw new Error(
      "Usage: npm run onboarding:review-packet -- (--supplement <intervention-id-or-slug> | --claim-id <claim-id>) [--env-file <path>] [--summary]"
    );
  }

  const envFile = args.envFilePath ? loadEnvFile(args.envFilePath) : undefined;
  const env = mergeEnv(process.env, envFile?.env);

  await withProcessEnv(env, async () => {
    const { getEvidenceDashboardData } = await import("@/lib/data/dashboard");
    const { buildSupplementOnboardingReviewPacketReport } = await import(
      "@/lib/supplement-onboarding-review-packet"
    );
    const data = await getEvidenceDashboardData();
    const sourceSignals = await readSourceSignals({
      claimId: args.claimId,
      data,
      supplementQuery: args.supplement
    });
    const report = buildSupplementOnboardingReviewPacketReport({
      claimId: args.claimId,
      data,
      sourceSignals,
      supplementQuery: args.supplement
    });

    console.log(JSON.stringify(args.summary ? summarizeReport(report) : report, null, 2));
  });
}

async function readSourceSignals({
  claimId,
  data,
  supplementQuery
}: {
  claimId?: string;
  data: { dataSource: "database" | "seed"; claims: Array<{ id: string; interventionId: string }>; interventions: Array<{ id: string; name: string; slug: string }> };
  supplementQuery?: string;
}) {
  if (data.dataSource !== "database") {
    return {
      unavailableReason: "database-backed source tracking is unavailable in seed data mode"
    };
  }

  const { prisma } = await import("@/lib/db/prisma");
  const { assessSourceCandidateConviction } = await import("@/lib/source-conviction");
  const supplement = supplementQuery
    ? data.interventions.find(
        (intervention) =>
          intervention.id === supplementQuery ||
          intervention.slug === supplementQuery ||
          intervention.name.toLowerCase() === supplementQuery.toLowerCase()
      )
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
    const candidates = await prisma.sourceCandidate.findMany({
      where,
      orderBy: [{ triageScore: "desc" }, { updatedAt: "desc" }],
      take: 50
    });

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
      })
    };
  } catch (error) {
    return {
      unavailableReason: error instanceof Error ? error.message : String(error)
    };
  }
}

function summarizeReport(report: SupplementOnboardingReviewPacketReport) {
  return {
    generatedAt: report.generatedAt,
    packetCount: report.packets.length,
    packets: report.packets.map((packet) => ({
      acceptedCandidates: packet.sourceCandidates.accepted.length,
      autopilotCurationDraftCommand:
        packet.candidateReviewAutopilot.curationDraftCommand,
      autopilotNextAction: packet.candidateReviewAutopilot.nextAction,
      autopilotRecommendedCandidate:
        packet.candidateReviewAutopilot.recommendedCandidate?.dedupeKey ??
        packet.candidateReviewAutopilot.recommendedCandidate?.title,
      autopilotStatus: packet.candidateReviewAutopilot.status,
      caveatCount: packet.caveats.length,
      claimId: packet.claim.id,
      curatedSources: packet.curatedSources.length,
      decisionLabel: packet.operatorDecision.label,
      decisionRecommendation: packet.operatorDecision.recommendation,
      decisionSummary: packet.operatorDecision.summary,
      nextDecisionAction: packet.operatorDecision.nextActions[0],
      pendingCandidates: packet.sourceCandidates.pendingReview.length,
      promotionBlockers: packet.promotionDiff.blockers.length,
      promotionReady: packet.promotionDiff.readyForPromotionReview,
      proposedStatus: packet.proposedPublicWording.status,
      safetySignalCount: packet.safetyWatchlist.acceptedPacketSignals.length,
      sourcePacketStatus: packet.sourcePacket.status,
      supplementId: packet.supplement.id,
      triageCounts: {
        holdOrReject: packet.operatorDecision.candidateCounts.holdOrReject,
        limitationsOnly: packet.operatorDecision.candidateCounts.limitationsOnly,
        reviewAfterStrongerSources:
          packet.operatorDecision.candidateCounts.reviewAfterStrongerSources,
        reviewFirst: packet.operatorDecision.candidateCounts.reviewFirst
      }
    })),
    readOnly: true,
    sourceConvictionRubric: report.sourceConvictionRubric,
    unmatchedClaimId: report.unmatchedClaimId,
    unmatchedSupplementQuery: report.unmatchedSupplementQuery
  };
}

function readArgs(args: string[]): OnboardingReviewPacketArgs {
  const parsed: OnboardingReviewPacketArgs = {
    summary: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--summary") {
      parsed.summary = true;
      continue;
    }

    if (arg === "--supplement") {
      parsed.supplement = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--supplement=")) {
      parsed.supplement = readInlineValue(arg, "--supplement");
      continue;
    }

    if (arg === "--claim-id") {
      parsed.claimId = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--claim-id=")) {
      parsed.claimId = readInlineValue(arg, "--claim-id");
      continue;
    }

    if (arg === "--env-file") {
      parsed.envFilePath = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--env-file=")) {
      parsed.envFilePath = readInlineValue(arg, "--env-file");
      continue;
    }

    throw new Error(`Unknown onboarding review packet option: ${arg}`);
  }

  return parsed;
}

function readRequiredValue(args: string[], index: number, option: string) {
  const value = args[index + 1]?.trim();

  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }

  return value;
}

function readInlineValue(arg: string, option: string) {
  const value = arg.slice(`${option}=`.length).trim();

  if (!value) {
    throw new Error(`${option} requires a value.`);
  }

  return value;
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
