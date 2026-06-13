import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  applyLaunchEvidenceToEnvContent,
  buildLaunchEvidenceRecord,
  type LaunchEvidenceType
} from "@/lib/launch-evidence";

interface LaunchEvidenceCliArgs {
  approvedBy?: string;
  envFilePath?: string;
  evidence?: LaunchEvidenceType;
  force: boolean;
  help: boolean;
  note?: string;
  reviewWindow?: string;
  summary: boolean;
  timestamp?: string;
  url?: string;
  write: boolean;
}

async function main() {
  const args = readArgs(process.argv.slice(2));

  if (args.help) {
    console.log(usage());
    return;
  }

  if (!args.envFilePath) {
    throw new Error("--env-file is required.");
  }

  if (!args.evidence) {
    throw new Error("--evidence is required.");
  }

  const envFilePath = resolveWorkspaceEnvFile(args.envFilePath);

  if (!existsSync(envFilePath)) {
    throw new Error(`Env file not found: ${args.envFilePath}`);
  }

  if (args.write) {
    ensureUntrackedEnvFile(envFilePath);
  }

  const record = buildLaunchEvidenceRecord({
    approvedBy: args.approvedBy,
    note: args.note ?? "",
    reviewWindow: args.reviewWindow,
    timestamp: args.timestamp ? new Date(args.timestamp) : undefined,
    type: args.evidence,
    url: args.url
  });
  const existingContent = readFileSync(envFilePath, "utf8");
  const update = applyLaunchEvidenceToEnvContent(existingContent, record, {
    force: args.force
  });

  if (args.write) {
    writeFileSync(envFilePath, update.content);
  }

  const report = {
    appendedKeys: update.appendedKeys,
    dryRun: !args.write,
    evidenceKey: record.evidenceKey,
    force: args.force,
    humanOwned: true as const,
    label: record.label,
    localFileWrite: args.write,
    noDatabaseWrite: true as const,
    noProductionWrite: true as const,
    readOnly: !args.write,
    recordedKeys: update.recordedKeys,
    replacedKeys: update.replacedKeys,
    requiredConfirmation: record.requiredConfirmation,
    targetEnvFile: path.relative(process.cwd(), envFilePath) || envFilePath,
    type: record.type,
    valueSafe: true as const
  };

  console.log(JSON.stringify(args.summary ? summarize(report) : report, null, 2));
}

function readArgs(args: string[]): LaunchEvidenceCliArgs {
  const parsed: LaunchEvidenceCliArgs = {
    force: false,
    help: false,
    summary: false,
    write: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--force") {
      parsed.force = true;
      continue;
    }

    if (arg === "--summary") {
      parsed.summary = true;
      continue;
    }

    if (arg === "--write") {
      parsed.write = true;
      continue;
    }

    if (arg === "--env-file") {
      parsed.envFilePath = readNextValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--env-file=")) {
      parsed.envFilePath = readInlineValue(arg, "--env-file");
      continue;
    }

    if (arg === "--evidence") {
      parsed.evidence = readEvidenceType(readNextValue(args, index, arg));
      index += 1;
      continue;
    }

    if (arg.startsWith("--evidence=")) {
      parsed.evidence = readEvidenceType(readInlineValue(arg, "--evidence"));
      continue;
    }

    if (arg === "--note") {
      parsed.note = readNextValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--note=")) {
      parsed.note = readInlineValue(arg, "--note");
      continue;
    }

    if (arg === "--url") {
      parsed.url = readNextValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--url=")) {
      parsed.url = readInlineValue(arg, "--url");
      continue;
    }

    if (arg === "--review-window") {
      parsed.reviewWindow = readNextValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--review-window=")) {
      parsed.reviewWindow = readInlineValue(arg, "--review-window");
      continue;
    }

    if (arg === "--approved-by") {
      parsed.approvedBy = readNextValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--approved-by=")) {
      parsed.approvedBy = readInlineValue(arg, "--approved-by");
      continue;
    }

    if (arg === "--timestamp") {
      parsed.timestamp = readNextValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--timestamp=")) {
      parsed.timestamp = readInlineValue(arg, "--timestamp");
      continue;
    }

    throw new Error(`Unknown launch evidence argument: ${arg}`);
  }

  return parsed;
}

function readEvidenceType(value: string): LaunchEvidenceType {
  if (
    value === "admin-flow-smoke" ||
    value === "launch-approval" ||
    value === "post-launch-review"
  ) {
    return value;
  }

  throw new Error(
    "--evidence must be one of: admin-flow-smoke, launch-approval, post-launch-review."
  );
}

function readNextValue(args: string[], index: number, flag: string) {
  const value = args[index + 1]?.trim();

  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

function readInlineValue(arg: string, flag: string) {
  const value = arg.slice(flag.length + 1).trim();

  if (!value) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

function resolveWorkspaceEnvFile(filePath: string) {
  const resolved = path.resolve(filePath);
  const workspace = path.resolve(process.cwd());

  if (resolved !== workspace && !resolved.startsWith(`${workspace}${path.sep}`)) {
    throw new Error("--env-file must point inside the current workspace.");
  }

  return resolved;
}

function ensureUntrackedEnvFile(envFilePath: string) {
  const relativePath = path.relative(process.cwd(), envFilePath).replace(/\\/g, "/");
  const result = spawnSync("git", ["ls-files", "--error-unmatch", "--", relativePath], {
    encoding: "utf8",
    stdio: "ignore"
  });

  if (result.status === 0) {
    throw new Error("Refusing to write launch evidence into a tracked file.");
  }
}

function summarize(report: {
  appendedKeys: string[];
  dryRun: boolean;
  evidenceKey: string;
  humanOwned: true;
  label: string;
  localFileWrite: boolean;
  noDatabaseWrite: true;
  noProductionWrite: true;
  readOnly: boolean;
  recordedKeys: string[];
  replacedKeys: string[];
  requiredConfirmation: string;
  targetEnvFile: string;
  type: LaunchEvidenceType;
  valueSafe: true;
}) {
  return {
    appendedKeys: report.appendedKeys,
    dryRun: report.dryRun,
    evidenceKey: report.evidenceKey,
    humanOwned: report.humanOwned,
    label: report.label,
    localFileWrite: report.localFileWrite,
    noDatabaseWrite: report.noDatabaseWrite,
    noProductionWrite: report.noProductionWrite,
    readOnly: report.readOnly,
    recordedKeyCount: report.recordedKeys.length,
    replacedKeys: report.replacedKeys,
    requiredConfirmation: report.requiredConfirmation,
    targetEnvFile: report.targetEnvFile,
    type: report.type,
    valueSafe: report.valueSafe
  };
}

function usage() {
  return [
    "Usage:",
    "  npm run launch:evidence -- --env-file <ignored-env-file> --evidence admin-flow-smoke --url <operator-url> --note <manual-smoke-note> [--write]",
    "  npm run launch:evidence -- --env-file <ignored-env-file> --evidence post-launch-review --review-window <window> --note <schedule-note> [--write]",
    "  npm run launch:evidence -- --env-file <ignored-env-file> --evidence launch-approval --approved-by <name> --note <approval-note> [--write]",
    "",
    "Evidence types: admin-flow-smoke, post-launch-review, launch-approval.",
    "Default is dry-run; add --write only after the matching human-owned evidence exists.",
    "The target env file must already exist, be inside this workspace, and be untracked by git."
  ].join("\n");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
