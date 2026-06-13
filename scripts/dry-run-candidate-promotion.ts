import { loadEnvFile, mergeEnv, withProcessEnv } from "@/lib/env-file";

async function main() {
  const args = readPromotionDryRunArgs(process.argv.slice(2));
  const envFile = args.envFilePath ? loadEnvFile(args.envFilePath) : undefined;
  const env = mergeEnv(process.env, envFile?.env);

  await withProcessEnv(env, async () => {
    const dedupeKey = await resolveDedupeKey(args);

    if (!dedupeKey) {
      console.error(
        "Usage: npm run promotion:dry-run -- <source-candidate-dedupe-key>\n" +
          "   or: npm run promotion:dry-run -- --pmid <pubmed-id>\n" +
          "   or: npm run promotion:dry-run -- --env-file <env-file> --pmid <pubmed-id>"
      );
      process.exitCode = 1;
      return;
    }

    const { assessSourceCandidatePublicPromotion } = await import(
      "@/lib/operator/curation-promotion"
    );
    const assessment = await assessSourceCandidatePublicPromotion(dedupeKey);
    console.log(JSON.stringify(assessment, null, 2));
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

interface PromotionDryRunCliArgs {
  dedupeKey?: string;
  envFilePath?: string;
  pmid?: string;
}

function readPromotionDryRunArgs(args: string[]): PromotionDryRunCliArgs {
  const parsed: PromotionDryRunCliArgs = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--pmid") {
      const value = args[index + 1]?.trim();

      if (!value) {
        throw new Error("--pmid requires a PubMed id.");
      }

      parsed.pmid = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--pmid=")) {
      const value = arg.slice("--pmid=".length).trim();

      if (!value) {
        throw new Error("--pmid requires a PubMed id.");
      }

      parsed.pmid = value;
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
      const value = arg.slice("--env-file=".length).trim();

      if (!value) {
        throw new Error("--env-file requires a path.");
      }

      parsed.envFilePath = value;
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown promotion dry-run argument: ${arg}`);
    }

    if (parsed.dedupeKey) {
      throw new Error("Only one source-candidate dedupe key can be provided.");
    }

    parsed.dedupeKey = arg.trim();
  }

  return parsed;
}

async function resolveDedupeKey(args: PromotionDryRunCliArgs) {
  if (args.pmid) {
    const { listSourceCandidateReviewQueue } = await import("@/lib/data/source-candidates");
    const candidates = await listSourceCandidateReviewQueue({
      decision: "Accepted",
      externalId: args.pmid,
      limit: 10,
      source: "PubMed"
    });

    if (candidates.length === 1) {
      return candidates[0]?.dedupeKey;
    }

    if (candidates.length === 0) {
      throw new Error(`No accepted PubMed source candidate found for PMID ${args.pmid}.`);
    }

    throw new Error(
      `Multiple accepted PubMed candidates found for PMID ${args.pmid}; rerun with a dedupe key.`
    );
  }

  return args.dedupeKey;
}
