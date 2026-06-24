import { pathToFileURL } from "node:url";

import {
  formatSourceCandidateCommandIndex,
  listSourceCandidateCommandIndex,
  type SourceCandidateCommandMode
} from "@/lib/data/source-candidate-command-index";

interface SourceCandidateCommandIndexArgs {
  help: boolean;
  json: boolean;
  limit: number;
  mode?: SourceCandidateCommandMode;
  query?: string;
}

export function readSourceCandidateCommandIndexArgs(
  args: string[]
): SourceCandidateCommandIndexArgs {
  const parsed: SourceCandidateCommandIndexArgs = {
    help: false,
    json: false,
    limit: 25
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--json") {
      parsed.json = true;
      continue;
    }

    if (arg === "--limit") {
      parsed.limit = readLimit(readRequiredValue(args, index, arg));
      index += 1;
      continue;
    }

    if (arg.startsWith("--limit=")) {
      parsed.limit = readLimit(readInlineValue(arg, "--limit"));
      continue;
    }

    if (arg === "--mode") {
      parsed.mode = readMode(readRequiredValue(args, index, arg), arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--mode=")) {
      parsed.mode = readMode(readInlineValue(arg, "--mode"), "--mode");
      continue;
    }

    if (arg === "--query") {
      parsed.query = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--query=")) {
      parsed.query = readInlineValue(arg, "--query");
      continue;
    }

    throw new Error(`Unknown source-candidate command index argument: ${arg}`);
  }

  return parsed;
}

export function sourceCandidateCommandIndexHelpText() {
  return [
    "Usage: npm run ingest:sources:index -- [--json] [--mode read-only|explicit-write-after-approval] [--query <text>] [--limit <count>]",
    "",
    "Prints a compact, read-only command index for source-candidate workflows.",
    "Use it before opening the full source-candidate CLI implementation."
  ].join("\n");
}

function readRequiredValue(args: string[], index: number, option: string) {
  const value = args[index + 1]?.trim();

  if (!value) {
    throw new Error(`${option} requires a value.`);
  }

  return value;
}

function readInlineValue(arg: string, option: string) {
  const value = arg.slice(`${option}=`.length).trim();

  if (!value) {
    throw new Error(`${option} requires a value.`);
  }

  return value;
}

function readLimit(value: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
    throw new Error("--limit must be an integer between 1 and 50.");
  }

  return parsed;
}

function readMode(value: string, option: string): SourceCandidateCommandMode {
  if (value === "read-only" || value === "explicit-write-after-approval") {
    return value;
  }

  throw new Error(`${option} must be read-only or explicit-write-after-approval.`);
}

function main() {
  const args = readSourceCandidateCommandIndexArgs(process.argv.slice(2));

  if (args.help) {
    console.log(sourceCandidateCommandIndexHelpText());
    return;
  }

  const entries = listSourceCandidateCommandIndex({
    limit: args.limit,
    mode: args.mode,
    query: args.query
  });

  console.log(args.json ? JSON.stringify({ entries }, null, 2) : formatSourceCandidateCommandIndex(entries));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
