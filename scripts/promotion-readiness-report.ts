import {
  buildSourceCandidatePromotionReadinessReport,
  summarizeSourceCandidatePromotionReadinessReport
} from "@/lib/operator/curation-promotion";

async function main() {
  const args = readPromotionReadinessArgs(process.argv.slice(2));
  const report = await buildSourceCandidatePromotionReadinessReport({
    limit: args.limit
  });

  console.log(
    JSON.stringify(
      args.summary ? summarizeSourceCandidatePromotionReadinessReport(report) : report,
      null,
      2
    )
  );
}

interface PromotionReadinessCliArgs {
  limit: number;
  summary: boolean;
}

function readPromotionReadinessArgs(args: string[]): PromotionReadinessCliArgs {
  const parsed: PromotionReadinessCliArgs = {
    limit: 5,
    summary: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--summary") {
      parsed.summary = true;
      continue;
    }

    if (arg === "--limit") {
      parsed.limit = parseLimit(args[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith("--limit=")) {
      parsed.limit = parseLimit(arg.slice("--limit=".length));
      continue;
    }

    throw new Error(`Unknown promotion readiness argument: ${arg}`);
  }

  return parsed;
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
