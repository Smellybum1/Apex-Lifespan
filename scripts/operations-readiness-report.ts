import {
  buildOperationsReadinessReport,
  summarizeOperationsEvidenceReview,
  summarizeOperationsReadinessReport
} from "@/lib/operations-readiness";

function main() {
  const args = readOperationsReadinessArgs(process.argv.slice(2));

  if (args.evidenceId) {
    const packet = summarizeOperationsEvidenceReview(
      {
        env: process.env
      },
      args.evidenceId
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

  console.log(
    JSON.stringify(args.summary ? summarizeOperationsReadinessReport(report) : report, null, 2)
  );
}

interface OperationsReadinessCliArgs {
  evidenceId?: string;
  summary: boolean;
}

function readOperationsReadinessArgs(args: string[]): OperationsReadinessCliArgs {
  const parsed: OperationsReadinessCliArgs = {
    summary: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--summary") {
      parsed.summary = true;
      continue;
    }

    if (arg === "--evidence") {
      const value = args[index + 1]?.trim();

      if (!value) {
        throw new Error("--evidence requires an evidence id.");
      }

      parsed.evidenceId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--evidence=")) {
      const value = arg.slice("--evidence=".length).trim();

      if (!value) {
        throw new Error("--evidence requires an evidence id.");
      }

      parsed.evidenceId = value;
      continue;
    }

    throw new Error(`Unknown operations readiness argument: ${arg}`);
  }

  if (parsed.summary && parsed.evidenceId) {
    throw new Error("--summary cannot be combined with --evidence.");
  }

  return parsed;
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
