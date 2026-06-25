import { loadEnvFile, mergeEnv, withProcessEnv } from "@/lib/env-file";
import { prisma } from "@/lib/db/prisma";

async function main() {
  const envFile = readEnvFileArg(process.argv.slice(2));
  const env = envFile ? mergeEnv(process.env, loadEnvFile(envFile).env) : process.env;

  await withProcessEnv(env, async () => {
    const [interventions, claims] = await Promise.all([
      prisma.intervention.findMany({
        select: { id: true, name: true, slug: true },
        orderBy: { name: "asc" }
      }),
      prisma.claim.findMany({
        select: { id: true, interventionId: true, outcome: true },
        orderBy: [{ interventionId: "asc" }, { outcome: "asc" }]
      })
    ]);

    const claimsByIntervention = new Map<string, number>();
    for (const claim of claims) {
      claimsByIntervention.set(claim.interventionId, (claimsByIntervention.get(claim.interventionId) ?? 0) + 1);
    }

    console.log(
      JSON.stringify(
        {
          databaseUrlHost: redactDatabaseUrl(process.env.DATABASE_URL),
          totals: {
            interventions: interventions.length,
            claims: claims.length
          },
          interventions: interventions.map((intervention) => ({
            id: intervention.id,
            name: intervention.name,
            slug: intervention.slug,
            claimCount: claimsByIntervention.get(intervention.id) ?? 0
          }))
        },
        null,
        2
      )
    );
  });
}

function readEnvFileArg(args: string[]) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--env-file") {
      const value = args[index + 1]?.trim();
      if (!value) {
        throw new Error("--env-file requires a path.");
      }

      return value;
    }

    if (arg.startsWith("--env-file=")) {
      const value = arg.slice("--env-file=".length).trim();
      if (!value) {
        throw new Error("--env-file requires a path.");
      }

      return value;
    }
  }

  return undefined;
}

function redactDatabaseUrl(url: string | undefined) {
  if (!url) {
    return "missing";
  }

  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}:${parsed.port || "default"}/${parsed.pathname.replace(/^\//, "")}`;
  } catch {
    return "unparseable";
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
