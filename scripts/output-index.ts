import { closeSync, existsSync, openSync, readSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

type OutputMode = "text" | "json";

type Options = {
  mode: OutputMode;
  root: string;
  top: number;
};

type FileSummary = {
  approxTokensIfRead: number;
  bytes: number;
  dimensions: { height: number; width: number } | null;
  extension: string;
  modifiedAt: string;
  path: string;
};

const HELP_TEXT = `Usage: npx tsx scripts/output-index.ts [options]

Read-only generated artifact index. Lists metadata only; does not read report
or image bodies into context.

Options:
  --json              Print machine-readable JSON.
  --root <path>       Artifact directory. Default: output
  --top <count>       Number of largest/newest files to show. Default: 20
  --help              Show this help.
`;

function main() {
  const options = parseArgs(process.argv.slice(2));
  const absoluteRoot = path.resolve(process.cwd(), options.root);
  const files = existsSync(absoluteRoot) ? walkFiles(absoluteRoot).map((filePath) => summarizeFile(filePath)) : [];
  const byExtension = summarizeByExtension(files);
  const largestFiles = [...files].sort((left, right) => right.bytes - left.bytes).slice(0, options.top);
  const newestFiles = [...files]
    .sort((left, right) => Date.parse(right.modifiedAt) - Date.parse(left.modifiedAt))
    .slice(0, options.top);
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);

  const summary = {
    root: normalizePath(options.root),
    exists: existsSync(absoluteRoot),
    totals: {
      files: files.length,
      bytes: totalBytes,
      approxTokensIfRead: Math.round(totalBytes / 4)
    },
    byExtension,
    largestFiles,
    newestFiles,
    drilldownHint: "Open one selected artifact by path; do not read the entire output directory."
  };

  if (options.mode === "json") {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(`${summary.root}: ${summary.totals.files.toLocaleString()} file(s), ${summary.totals.bytes.toLocaleString()} bytes, ~${summary.totals.approxTokensIfRead.toLocaleString()} tokens if read raw`);
  if (!summary.exists) {
    return;
  }
  console.log("\nBy extension:");
  for (const entry of byExtension) {
    console.log(`- ${entry.extension}: ${entry.count} file(s), ${entry.bytes.toLocaleString()} bytes, ~${entry.approxTokensIfRead.toLocaleString()} tokens`);
  }
  console.log("\nLargest files:");
  for (const file of largestFiles) {
    const dimensions = file.dimensions ? `, ${file.dimensions.width}x${file.dimensions.height}` : "";
    console.log(`- ${file.path}: ${file.bytes.toLocaleString()} bytes, ~${file.approxTokensIfRead.toLocaleString()} tokens${dimensions}`);
  }
  console.log("\nNewest files:");
  for (const file of newestFiles) {
    console.log(`- ${file.modifiedAt} ${file.path}`);
  }
}

function parseArgs(args: string[]): Options {
  const options: Options = { mode: "text", root: "output", top: 20 };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      console.log(HELP_TEXT);
      process.exit(0);
    }
    if (arg === "--json") {
      options.mode = "json";
      continue;
    }
    if (arg === "--root") {
      options.root = readRequiredValue(args[index + 1], "--root");
      index += 1;
      continue;
    }
    if (arg.startsWith("--root=")) {
      options.root = readRequiredValue(arg.slice("--root=".length), "--root");
      continue;
    }
    if (arg === "--top") {
      options.top = readPositiveInteger(args[index + 1], "--top");
      index += 1;
      continue;
    }
    if (arg.startsWith("--top=")) {
      options.top = readPositiveInteger(arg.slice("--top=".length), "--top");
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function walkFiles(root: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      found.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      found.push(fullPath);
    }
  }
  return found;
}

function summarizeFile(filePath: string): FileSummary {
  const stats = statSync(filePath);
  const extension = path.extname(filePath).toLowerCase() || "(none)";
  return {
    approxTokensIfRead: Math.round(stats.size / 4),
    bytes: stats.size,
    dimensions: extension === ".png" ? readPngDimensions(filePath) : null,
    extension,
    modifiedAt: stats.mtime.toISOString(),
    path: normalizePath(path.relative(process.cwd(), filePath))
  };
}

function summarizeByExtension(files: FileSummary[]) {
  const map = new Map<string, { bytes: number; count: number; extension: string }>();
  for (const file of files) {
    const current = map.get(file.extension) ?? { bytes: 0, count: 0, extension: file.extension };
    current.bytes += file.bytes;
    current.count += 1;
    map.set(file.extension, current);
  }
  return [...map.values()]
    .sort((left, right) => right.bytes - left.bytes)
    .map((entry) => ({
      ...entry,
      approxTokensIfRead: Math.round(entry.bytes / 4)
    }));
}

function readPngDimensions(filePath: string) {
  const header = Buffer.alloc(24);
  const descriptor = openSync(filePath, "r");
  try {
    readSync(descriptor, header, 0, header.length, 0);
  } finally {
    closeSync(descriptor);
  }
  const pngSignature = "89504e470d0a1a0a";
  if (header.length < 24 || header.subarray(0, 8).toString("hex") !== pngSignature) {
    return null;
  }
  return {
    width: header.readUInt32BE(16),
    height: header.readUInt32BE(20)
  };
}

function readRequiredValue(value: string | undefined, option: string) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return trimmed;
}

function readPositiveInteger(value: string | undefined, option: string) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${option} requires a positive integer.`);
  }
  return parsed;
}

function normalizePath(filePath: string) {
  return filePath.replace(/\\/g, "/");
}

main();
