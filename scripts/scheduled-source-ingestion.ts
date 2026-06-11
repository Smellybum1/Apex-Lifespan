import {
  planScheduledSourceIngestionDryRun,
  runScheduledSourceIngestionBatch
} from "@/lib/data/scheduled-ingestion";

async function main() {
  const maxJobsPerRun = readNumberArg("--max-jobs");
  const apply = process.argv.includes("--apply");

  if (apply) {
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

  console.log(JSON.stringify(plan, null, 2));
}

function readNumberArg(name: string) {
  const index = process.argv.indexOf(name);

  if (index < 0) {
    return undefined;
  }

  const value = Number(process.argv[index + 1]);

  return Number.isFinite(value) ? value : undefined;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
