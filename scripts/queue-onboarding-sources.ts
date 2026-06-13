import { pathToFileURL } from "node:url";

import { loadEnvFile, mergeEnv, withProcessEnv } from "@/lib/env-file";

process.env.APEX_PRISMA_LOG ??= "silent";

interface QueueOnboardingSourcesArgs {
  apply: boolean;
  envFilePath?: string;
  region: string;
  supplement?: string;
}

async function main() {
  const args = readArgs(process.argv.slice(2));

  if (!args.supplement) {
    throw new Error(
      "Usage: npm run onboarding:queue-sources -- --supplement <intervention-id-or-slug> [--env-file <path>] [--region AU] [--apply]"
    );
  }

  const envFile = args.envFilePath ? loadEnvFile(args.envFilePath) : undefined;
  const env = mergeEnv(process.env, envFile?.env);

  await withProcessEnv(env, async () => {
    const { getEvidenceDashboardData } = await import("@/lib/data/dashboard");
    const { queueClaimSourceCandidateIngestionJobs } = await import(
      "@/lib/data/source-candidate-jobs"
    );
    const data = await getEvidenceDashboardData();
    const supplement = data.interventions.find(
      (intervention) =>
        intervention.id === args.supplement ||
        intervention.slug === args.supplement ||
        intervention.name.toLowerCase() === args.supplement?.toLowerCase()
    );

    if (!supplement) {
      throw new Error(`Supplement not found for source queueing: ${args.supplement}`);
    }

    const claims = data.claims.filter((claim) => claim.interventionId === supplement.id);

    if (claims.length === 0) {
      throw new Error(`No claims found for source queueing: ${supplement.id}`);
    }

    if (!args.apply) {
      console.log(
        JSON.stringify(
          {
            applyRequired: true,
            commands: claims.map(
              (claim) =>
                `npm run ingest:sources -- --queue-claim-sources ${claim.id} --region "${args.region}"`
            ),
            note:
              "Dry run only. Rerun with --apply to create queued source-candidate jobs. This does not run live ingestion, accept/reject candidates, or promote evidence.",
            readOnly: true,
            region: args.region,
            supplement: {
              claimCount: claims.length,
              id: supplement.id,
              name: supplement.name
            }
          },
          null,
          2
        )
      );
      return;
    }

    const results = [];

    for (const claim of claims) {
      results.push(
        await queueClaimSourceCandidateIngestionJobs({
          claimId: claim.id,
          region: args.region
        })
      );
    }

    console.log(
      JSON.stringify(
        {
          applied: true,
          noAutoReview: true,
          noAutoPromotion: true,
          queuedClaimCount: results.length,
          results,
          supplement: {
            id: supplement.id,
            name: supplement.name
          }
        },
        null,
        2
      )
    );
  });
}

function readArgs(args: string[]): QueueOnboardingSourcesArgs {
  const parsed: QueueOnboardingSourcesArgs = {
    apply: false,
    region: "AU"
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--apply") {
      parsed.apply = true;
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

    if (arg === "--region") {
      parsed.region = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--region=")) {
      parsed.region = readInlineValue(arg, "--region");
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

    throw new Error(`Unknown onboarding source queue option: ${arg}`);
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
