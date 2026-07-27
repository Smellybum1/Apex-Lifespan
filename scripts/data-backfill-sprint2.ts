import { loadEnvFile, mergeEnv, withProcessEnv } from "@/lib/env-file";
import { runSprint2Backfill } from "@/lib/data/sprint2-backfill";

async function main() {
  const args = readBackfillArgs(process.argv.slice(2));
  const envFile = args.envFilePath ? loadEnvFile(args.envFilePath) : undefined;
  const env = mergeEnv(process.env, envFile?.env);

  await withProcessEnv(env, async () => {
    const summary = await runSprint2Backfill({
      apply: args.apply,
      importChangelog: args.importChangelog
    });

    console.log(JSON.stringify(summary, null, 2));

    if (!args.apply) {
      console.log("Dry-run only. Re-run with --apply to write normalized Sprint 2 rows.");
    }
  });
}

interface BackfillCliArgs {
  apply: boolean;
  envFilePath?: string;
  importChangelog: boolean;
}

function readBackfillArgs(args: string[]): BackfillCliArgs {
  const parsed: BackfillCliArgs = {
    apply: false,
    importChangelog: true
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--apply") {
      parsed.apply = true;
      continue;
    }

    if (arg === "--skip-changelog") {
      parsed.importChangelog = false;
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

    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
