import {
  buildOperatorReadinessReport,
  summarizeOperatorReadinessCheck
} from "@/lib/operator/readiness";

function main() {
  const checkId = readCheckId(process.argv.slice(2));
  const context = {
    env: process.env
  };

  if (checkId) {
    const packet = summarizeOperatorReadinessCheck(context, checkId);

    if (!packet.found) {
      process.exitCode = 1;
    }

    console.log(JSON.stringify(packet, null, 2));
    return;
  }

  const report = buildOperatorReadinessReport({
    env: process.env
  });

  console.log(JSON.stringify(report, null, 2));
}

function readCheckId(args: string[]) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--check") {
      const value = args[index + 1]?.trim();

      if (!value) {
        throw new Error("--check requires an operator readiness check id.");
      }

      return value;
    }

    if (arg.startsWith("--check=")) {
      const value = arg.slice("--check=".length).trim();

      if (!value) {
        throw new Error("--check requires an operator readiness check id.");
      }

      return value;
    }

    throw new Error(`Unknown operator readiness argument: ${arg}`);
  }

  return undefined;
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
