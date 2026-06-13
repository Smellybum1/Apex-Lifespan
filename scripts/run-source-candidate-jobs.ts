import { loadEnvFile, mergeEnv, withProcessEnv } from "@/lib/env-file";

process.env.APEX_PRISMA_LOG ??= "silent";

void main();

async function main() {
  try {
    const { args, envFilePath } = readSourceCandidateRunnerArgs(process.argv.slice(2));
    const envFile = envFilePath ? loadEnvFile(envFilePath) : undefined;
    const env = mergeEnv(process.env, envFile?.env);

    await withProcessEnv(env, async () => {
      const { runSourceCandidateJobCommand } = await import(
        "../src/lib/data/source-candidate-job-command"
      );
      process.exitCode = await runSourceCandidateJobCommand(args);
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

function readSourceCandidateRunnerArgs(args: string[]) {
  let envFilePath: string | undefined;
  const filteredArgs: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--env-file") {
      const value = args[index + 1]?.trim();

      if (!value) {
        throw new Error("--env-file requires a path.");
      }

      envFilePath = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--env-file=")) {
      const value = arg.slice("--env-file=".length).trim();

      if (!value) {
        throw new Error("--env-file requires a path.");
      }

      envFilePath = value;
      continue;
    }

    filteredArgs.push(arg);
  }

  return {
    args: filteredArgs,
    envFilePath
  };
}
