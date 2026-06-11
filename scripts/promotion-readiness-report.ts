import { buildSourceCandidatePromotionReadinessReport } from "@/lib/operator/curation-promotion";

async function main() {
  const limit = readLimit(process.argv.slice(2));
  const report = await buildSourceCandidatePromotionReadinessReport({ limit });

  console.log(JSON.stringify(report, null, 2));
}

function readLimit(args: string[]) {
  let limit = 5;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--limit") {
      limit = parseLimit(args[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith("--limit=")) {
      limit = parseLimit(arg.slice("--limit=".length));
      continue;
    }

    throw new Error(`Unknown promotion readiness argument: ${arg}`);
  }

  return limit;
}

function parseLimit(value: string | undefined) {
  const limit = Number(value?.trim());

  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new Error("--limit requires an integer between 1 and 50.");
  }

  return limit;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
