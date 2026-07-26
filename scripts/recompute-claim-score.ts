import { loadEnvFile, mergeEnv, withProcessEnv } from "@/lib/env-file";

async function main() {
  const args = readRecomputeClaimScoreArgs(process.argv.slice(2));

  if (args.showHelp) {
    console.log(HELP_TEXT);
    return;
  }

  const envFile = args.envFilePath ? loadEnvFile(args.envFilePath) : undefined;
  const env = mergeEnv(process.env, envFile?.env);

  await withProcessEnv(env, async () => {
    const { prisma } = await import("@/lib/db/prisma");
    const { recomputeClaimScoreAsOperator } = await import(
      "@/lib/operator/claim-score-recompute"
    );

    const user = await prisma.user.findUnique({
      include: {
        operatorProfile: true
      },
      where: {
        email: args.actorEmail
      }
    });

    if (!user?.email || !user.operatorProfile) {
      throw new Error(`Active operator not found for actor email: ${args.actorEmail}.`);
    }

    const result = await recomputeClaimScoreAsOperator(
      {
        email: user.email,
        role: user.operatorProfile.role,
        status: user.operatorProfile.status,
        userId: user.id
      },
      {
        claimId: args.claimId,
        dryRun: args.dryRun,
        rationale: args.rationale
      },
      env
    );

    console.log(JSON.stringify(result, null, 2));
  });
}

interface RecomputeClaimScoreCliArgs {
  actorEmail: string;
  claimId: string;
  dryRun: boolean;
  envFilePath?: string;
  rationale: string;
  showHelp?: false;
}

type ParsedRecomputeClaimScoreCliArgs =
  | RecomputeClaimScoreCliArgs
  | {
      showHelp: true;
    };

const HELP_TEXT = `Usage: npx tsx scripts/recompute-claim-score.ts [options]

Options:
  --env-file <path>       Load an approved local env file before the operator write.
  --actor-email <email>   Active operator email to attach to the audit event.
  --claim <claim-id>      Claim id to recompute and snapshot.
  --rationale <note>      Human rationale; required.
  --dry-run               Preview score snapshot changes without writing.
  --help                  Show this help.

Requires APEX_OPERATOR_WRITES_ENABLED=true and an active admin/owner operator.`;

function readRecomputeClaimScoreArgs(
  args: string[]
): ParsedRecomputeClaimScoreCliArgs {
  const parsed: RecomputeClaimScoreCliArgs = {
    actorEmail: "",
    claimId: "",
    dryRun: false,
    rationale: ""
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help") {
      return { showHelp: true };
    }

    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }

    if (arg === "--env-file") {
      const value = args[index + 1]?.trim();
      if (!value) {
        throw new Error("--env-file requires a path.");
      }
      parsed.envFilePath = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--env-file=")) {
      parsed.envFilePath = arg.slice("--env-file=".length).trim();
      continue;
    }

    if (arg === "--actor-email") {
      const value = args[index + 1]?.trim();
      if (!value) {
        throw new Error("--actor-email requires an email.");
      }
      parsed.actorEmail = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--actor-email=")) {
      parsed.actorEmail = arg.slice("--actor-email=".length).trim();
      continue;
    }

    if (arg === "--claim") {
      const value = args[index + 1]?.trim();
      if (!value) {
        throw new Error("--claim requires a claim id.");
      }
      parsed.claimId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--claim=")) {
      parsed.claimId = arg.slice("--claim=".length).trim();
      continue;
    }

    if (arg === "--rationale") {
      const value = args[index + 1]?.trim();
      if (!value) {
        throw new Error("--rationale requires a note.");
      }
      parsed.rationale = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--rationale=")) {
      parsed.rationale = arg.slice("--rationale=".length).trim();
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!parsed.claimId) {
    throw new Error("--claim is required.");
  }

  if (!parsed.actorEmail) {
    throw new Error("--actor-email is required.");
  }

  if (!parsed.rationale) {
    throw new Error("--rationale is required.");
  }

  return parsed;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
