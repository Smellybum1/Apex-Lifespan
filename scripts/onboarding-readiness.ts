import { pathToFileURL } from "node:url";

import { loadEnvFile, mergeEnv, withProcessEnv } from "@/lib/env-file";
import type {
  SourceCandidate,
  SourceCandidateDecision,
  SourceCandidateSource,
  ReviewStatus
} from "@/lib/types";

process.env.APEX_PRISMA_LOG ??= "silent";

interface OnboardingReadinessArgs {
  envFilePath?: string;
  supplement?: string;
  summary: boolean;
}

async function main() {
  const args = readArgs(process.argv.slice(2));

  if (!args.supplement) {
    throw new Error(
      "Usage: npm run onboarding:readiness -- --supplement <intervention-id-or-slug> [--env-file <path>] [--summary]"
    );
  }

  const envFile = args.envFilePath ? loadEnvFile(args.envFilePath) : undefined;
  const env = mergeEnv(process.env, envFile?.env);

  await withProcessEnv(env, async () => {
    const { getEvidenceDashboardData } = await import("@/lib/data/dashboard");
    const {
      buildSupplementOnboardingReadinessReport,
      summarizeSupplementOnboardingReadinessReport
    } = await import("@/lib/supplement-onboarding-readiness");
    const data = await getEvidenceDashboardData();
    const sourceSignals = await readSourceSignals(data, args.supplement ?? "");
    const report = buildSupplementOnboardingReadinessReport({
      data,
      sourceSignals,
      supplementQuery: args.supplement ?? ""
    });

    console.log(
      JSON.stringify(
        args.summary ? summarizeSupplementOnboardingReadinessReport(report) : report,
        null,
        2
      )
    );
  });
}

async function readSourceSignals(
  data: { dataSource: "database" | "seed"; claims: Array<{ id: string; interventionId: string }> },
  supplementQuery: string
) {
  if (data.dataSource !== "database") {
    return {
      unavailableReason: "database-backed source tracking is unavailable in seed data mode"
    };
  }

  const { prisma } = await import("@/lib/db/prisma");
  const { assessSourceCandidateConviction } = await import("@/lib/source-conviction");
  const interventionId = supplementQuery.trim();
  const claimIds = data.claims
    .filter((claim) => claim.interventionId === interventionId)
    .map((claim) => claim.id);
  const where = {
    OR: [
      { interventionId },
      ...(claimIds.length > 0
        ? [
            {
              claimId: {
                in: claimIds
              }
            }
          ]
        : [])
    ]
  };

  try {
    const [candidates, jobs] = await Promise.all([
      prisma.sourceCandidate.findMany({
        where,
        orderBy: [{ triageScore: "desc" }, { updatedAt: "desc" }],
        take: 50
      }),
      prisma.ingestionJob.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }],
        take: 50
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

function readArgs(args: string[]): OnboardingReadinessArgs {
  const parsed: OnboardingReadinessArgs = {
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

    if (arg === "--env-file") {
      parsed.envFilePath = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--env-file=")) {
      parsed.envFilePath = readInlineValue(arg, "--env-file");
      continue;
    }

    throw new Error(`Unknown onboarding readiness option: ${arg}`);
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
