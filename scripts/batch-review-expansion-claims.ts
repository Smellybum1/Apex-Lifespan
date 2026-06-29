import { ReviewStatus as DbReviewStatus, SourcePacketStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { loadEnvFile, mergeEnv, withProcessEnv } from "@/lib/env-file";
import { reviewClaimPacketAsOperator } from "@/lib/operator/claim-packet-review";

import { EXPANSION_INTERVENTION_IDS } from "./local-db-catalog-phase4-expansion-data";

const DEFAULT_REVIEW_NOTE =
  "Batch human review of complete expansion claim packets (user-approved hobby-project pass).";
const HUMAN_REVIEW_CONFIRMATION_FLAG = "--confirm-human-reviewed";

type Scope = "expansion" | "all";

async function main() {
  const args = readArgs(process.argv.slice(2));
  const env = mergeEnv(process.env, loadEnvFile(".env.local").env);

  await withProcessEnv(env, async () => {
    const operator = await prisma.user.findUnique({
      include: { operatorProfile: true },
      where: { email: args.actorEmail }
    });

    if (!operator?.email || !operator.operatorProfile) {
      throw new Error(`Active operator not found for actor email: ${args.actorEmail}.`);
    }

    if (operator.operatorProfile.status !== "ACTIVE") {
      throw new Error(`Operator account is not active: ${args.actorEmail}.`);
    }

    const principal = {
      email: operator.email,
      role: operator.operatorProfile.role,
      status: operator.operatorProfile.status,
      userId: operator.id
    };

    const interventionFilter =
      args.scope === "expansion"
        ? { interventionId: { in: [...EXPANSION_INTERVENTION_IDS] } }
        : {};

    const claims = await prisma.claim.findMany({
      where: {
        ...interventionFilter,
        reviewStatus: DbReviewStatus.UNREVIEWED_AI_DRAFT,
        sourcePackets: {
          some: {
            current: true,
            status: SourcePacketStatus.COMPLETE
          }
        }
      },
      select: { id: true, interventionId: true },
      orderBy: [{ interventionId: "asc" }, { id: "asc" }]
    });

    if (args.dryRun) {
      console.log(
        JSON.stringify(
          {
            dryRun: true,
            scope: args.scope,
            actorEmail: args.actorEmail,
            eligibleCount: claims.length,
            claimIds: claims.map((claim) => claim.id)
          },
          null,
          2
        )
      );
      return;
    }

    if (!args.confirmHumanReviewed) {
      throw new Error(
        `${HUMAN_REVIEW_CONFIRMATION_FLAG} is required before marking claim packets Human reviewed. Use it only after explicit human confirmation.`
      );
    }

    const result = {
      reviewed: [] as string[],
      skipped: [] as string[],
      errors: [] as Array<{ claimId: string; error: string }>
    };

    for (const claim of claims) {
      try {
        await reviewClaimPacketAsOperator(
          principal,
          {
            claimId: claim.id,
            reviewNote: args.reviewNote
          },
          env
        );
        result.reviewed.push(claim.id);
      } catch (error) {
        result.errors.push({
          claimId: claim.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const [humanReviewed, pendingReview] = await Promise.all([
      prisma.claim.count({
        where: {
          ...interventionFilter,
          reviewStatus: DbReviewStatus.HUMAN_REVIEWED
        }
      }),
      prisma.claim.count({
        where: {
          ...interventionFilter,
          reviewStatus: DbReviewStatus.UNREVIEWED_AI_DRAFT
        }
      })
    ]);

    console.log(
      JSON.stringify(
        {
          scope: args.scope,
          actorEmail: args.actorEmail,
          eligible: claims.length,
          result,
          after: {
            humanReviewed,
            pendingReview
          }
        },
        null,
        2
      )
    );
  });
}

function readArgs(argv: string[]) {
  const parsed = {
    actorEmail: "",
    confirmHumanReviewed: false,
    dryRun: false,
    reviewNote: DEFAULT_REVIEW_NOTE,
    scope: "expansion" as Scope
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }

    if (arg === HUMAN_REVIEW_CONFIRMATION_FLAG) {
      parsed.confirmHumanReviewed = true;
      continue;
    }

    if (arg === "--actor-email") {
      parsed.actorEmail = readRequiredValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--actor-email=")) {
      parsed.actorEmail = readInlineValue(arg, "--actor-email");
      continue;
    }

    if (arg === "--review-note") {
      parsed.reviewNote = readRequiredValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--review-note=")) {
      parsed.reviewNote = readInlineValue(arg, "--review-note");
      continue;
    }

    if (arg === "--scope") {
      parsed.scope = readScope(readRequiredValue(argv, index, arg));
      index += 1;
      continue;
    }

    if (arg.startsWith("--scope=")) {
      parsed.scope = readScope(readInlineValue(arg, "--scope"));
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  if (!parsed.actorEmail) {
    throw new Error("--actor-email is required.");
  }

  if (!parsed.reviewNote.trim()) {
    throw new Error("--review-note cannot be blank.");
  }

  return parsed;
}

function readScope(value: string): Scope {
  if (value === "expansion" || value === "all") return value;
  throw new Error('--scope must be "expansion" or "all".');
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
  if (!value) throw new Error(`${option} requires a value.`);
  return value;
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
