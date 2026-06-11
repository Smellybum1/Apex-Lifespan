import {
  planScheduledSourceIngestionDryRun,
  runScheduledSourceIngestionBatch,
  summarizeScheduledSourceIngestionDryRun
} from "@/lib/data/scheduled-ingestion";

async function main() {
  const { apply, maxJobsPerRun, summary } = readScheduledIngestionArgs(
    process.argv.slice(2)
  );

  if (apply) {
    if (summary) {
      throw new Error("--summary is read-only and cannot be combined with --apply.");
    }

    const result = await runScheduledSourceIngestionBatch({
      apply,
      maxJobsPerRun
    });

    console.log(JSON.stringify(result, null, 2));

    if (result.blocked) {
      process.exitCode = 1;
    }

    return;
  }

  const plan = await planScheduledSourceIngestionDryRun({ maxJobsPerRun });
  const output = summary ? summarizeScheduledSourceIngestionDryRun(plan) : plan;

  console.log(JSON.stringify(output, null, 2));
}

interface ScheduledIngestionCliArgs {
  apply: boolean;
  maxJobsPerRun?: number;
  summary: boolean;
}

function readScheduledIngestionArgs(args: string[]): ScheduledIngestionCliArgs {
  const parsed: ScheduledIngestionCliArgs = {
    apply: false,
    summary: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--apply") {
      parsed.apply = true;
      continue;
    }

    if (arg === "--summary") {
      parsed.summary = true;
      continue;
    }

    if (arg === "--max-jobs") {
      parsed.maxJobsPerRun = parseMaxJobs(args[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith("--max-jobs=")) {
      parsed.maxJobsPerRun = parseMaxJobs(arg.slice("--max-jobs=".length));
      continue;
    }

    throw new Error(`Unknown scheduled ingestion argument: ${arg}`);
  }

  return parsed;
}

function parseMaxJobs(value: string | undefined) {
  const maxJobs = Number(value?.trim());

  if (!Number.isInteger(maxJobs) || maxJobs < 1) {
    throw new Error("--max-jobs requires a positive integer.");
  }

  return maxJobs;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
