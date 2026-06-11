import {
  buildOperationsReadinessReport,
  summarizeOperationsEvidenceReview
} from "@/lib/operations-readiness";

function main() {
  const evidenceId = readEvidenceId(process.argv.slice(2));

  if (evidenceId) {
    const packet = summarizeOperationsEvidenceReview(
      {
        env: process.env
      },
      evidenceId
    );

    if (!packet.found) {
      process.exitCode = 1;
    }

    console.log(JSON.stringify(packet, null, 2));
    return;
  }

  const report = buildOperationsReadinessReport({
    env: process.env
  });

  console.log(JSON.stringify(report, null, 2));
}

function readEvidenceId(args: string[]) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--evidence") {
      const value = args[index + 1]?.trim();

      if (!value) {
        throw new Error("--evidence requires an evidence id.");
      }

      return value;
    }

    if (arg.startsWith("--evidence=")) {
      const value = arg.slice("--evidence=".length).trim();

      if (!value) {
        throw new Error("--evidence requires an evidence id.");
      }

      return value;
    }

    throw new Error(`Unknown operations readiness argument: ${arg}`);
  }

  return undefined;
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
