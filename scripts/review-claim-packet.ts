import { loadEnvFile, mergeEnv, withProcessEnv } from "@/lib/env-file";

async function main() {
  const args = readReviewClaimPacketArgs(process.argv.slice(2));

  if (args.showHelp) {
    console.log(HELP_TEXT);
    return;
  }

  const envFile = args.envFilePath ? loadEnvFile(args.envFilePath) : undefined;
  const env = mergeEnv(process.env, envFile?.env);

  await withProcessEnv(env, async () => {
    const { prisma } = await import("@/lib/db/prisma");
    const { reviewClaimPacketAsOperator } = await import(
      "@/lib/operator/claim-packet-review"
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

    const result = await reviewClaimPacketAsOperator(
      {
        email: user.email,
        role: user.operatorProfile.role,
        status: user.operatorProfile.status,
        userId: user.id
      },
      {
        claimId: args.claimId,
        reviewedAt: args.reviewedAt,
        reviewNote: args.reviewNote
      },
      env
    );

    console.log(JSON.stringify(result, null, 2));
  });
}

interface ReviewClaimPacketCliArgs {
  actorEmail: string;
  claimId: string;
  envFilePath?: string;
  reviewedAt?: Date;
  reviewNote: string;
  showHelp?: false;
}

type ParsedReviewClaimPacketCliArgs =
  | ReviewClaimPacketCliArgs
  | {
      showHelp: true;
    };

const HELP_TEXT = `Usage: npm run coverage:mark-reviewed -- [options]

Options:
  --env-file <path>       Load an approved local env file before the operator write.
  --actor-email <email>   Active operator email to attach to the audit event.
  --claim <claim-id>      Complete claim source packet to mark human-reviewed.
  --review-note <note>    Human review rationale; required.
  --reviewed-at <iso>     Optional ISO timestamp for deterministic rehearsals.
  --help                  Show this help.

Requires APEX_OPERATOR_WRITES_ENABLED=true and an active admin/owner operator.`;

function readReviewClaimPacketArgs(
  args: string[]
): ParsedReviewClaimPacketCliArgs {
  const parsed: Partial<ReviewClaimPacketCliArgs> = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help") {
      return {
        showHelp: true
      };
    }

    if (arg === "--actor-email") {
      parsed.actorEmail = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--actor-email=")) {
      parsed.actorEmail = readInlineValue(arg, "--actor-email");
      continue;
    }

    if (arg === "--claim") {
      parsed.claimId = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--claim=")) {
      parsed.claimId = readInlineValue(arg, "--claim");
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

    if (arg === "--review-note") {
      parsed.reviewNote = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--review-note=")) {
      parsed.reviewNote = readInlineValue(arg, "--review-note");
      continue;
    }

    if (arg === "--reviewed-at") {
      parsed.reviewedAt = readIsoDate(readRequiredValue(args, index, arg));
      index += 1;
      continue;
    }

    if (arg.startsWith("--reviewed-at=")) {
      parsed.reviewedAt = readIsoDate(readInlineValue(arg, "--reviewed-at"));
      continue;
    }

    throw new Error(`Unknown claim review argument: ${arg}`);
  }

  if (!parsed.claimId) {
    throw new Error("--claim requires a claim id.");
  }

  if (!parsed.actorEmail) {
    throw new Error("--actor-email requires an operator email.");
  }

  if (!parsed.reviewNote) {
    throw new Error("--review-note requires a human review note.");
  }

  return {
    actorEmail: parsed.actorEmail,
    claimId: parsed.claimId,
    envFilePath: parsed.envFilePath,
    reviewedAt: parsed.reviewedAt,
    reviewNote: parsed.reviewNote,
    showHelp: false
  };
}

function readRequiredValue(args: string[], index: number, flag: string) {
  const value = args[index + 1]?.trim();

  if (!value) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

function readInlineValue(arg: string, flag: string) {
  const value = arg.slice(`${flag}=`.length).trim();

  if (!value) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

function readIsoDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.valueOf())) {
    throw new Error("--reviewed-at requires an ISO timestamp.");
  }

  return date;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
