import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

type OutputMode = "text" | "json";

type Options = {
  mode: OutputMode;
  top: number;
};

type StatusEntry = {
  area: string;
  approxTokens: number | null;
  bytes: number | null;
  drilldownCommands: string[];
  exists: boolean;
  fileCount: number | null;
  path: string;
  riskFlags: string[];
  status: string;
};

const HELP_TEXT = `Usage: npx tsx scripts/codex-context-index.ts [options]

Read-only Codex context index. Summarizes dirty paths, rough token cost,
guardrail-sensitive areas, and suggested drilldowns without reading raw diffs.

Options:
  --json              Print machine-readable JSON.
  --top <count>       Number of largest changed paths to show. Default: 12
  --changed           Accepted for readability; changed paths are always shown.
  --help              Show this help.
`;

function main() {
  const options = parseArgs(process.argv.slice(2));
  const branch = git(["status", "-sb"]).stdout.trim().split(/\r?\n/)[0] ?? "unknown branch";
  const entries = parseStatus(git(["status", "--porcelain=v1"]).stdout).map(buildStatusEntry);
  const entriesByArea = groupBy(entries, (entry) => entry.area);
  const prioritizedEntries = [...entries].sort(
    (left, right) => (right.bytes ?? -1) - (left.bytes ?? -1)
  );
  const largestChangedPaths = prioritizedEntries.slice(0, options.top);
  const recommendedChecks = buildRecommendedChecks(entries);
  const hardStopFlags = buildHardStopFlags(entries);
  const drilldownCommands = buildDrilldownCommands(prioritizedEntries);

  const summary = {
    branch,
    dirtyCount: entries.length,
    hardStopFlags,
    largestChangedPaths,
    recommendedChecks,
    drilldownCommands,
    dirtyFilesByArea: Object.fromEntries(
      [...entriesByArea.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([area, areaEntries]) => [
          area,
          {
            count: areaEntries.length,
            approxTokens: sumNumbers(areaEntries.map((entry) => entry.approxTokens)),
            bytes: sumNumbers(areaEntries.map((entry) => entry.bytes)),
            paths: areaEntries.map((entry) => entry.path)
          }
        ])
    )
  };

  if (options.mode === "json") {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(branch);
  console.log(`Dirty paths: ${entries.length}`);
  if (hardStopFlags.length > 0) {
    console.log(`Hard-stop-sensitive flags: ${hardStopFlags.join(", ")}`);
  }
  console.log("\nAreas:");
  for (const [area, areaEntries] of [...entriesByArea.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const tokens = sumNumbers(areaEntries.map((entry) => entry.approxTokens));
    console.log(`- ${area}: ${areaEntries.length} path(s), ~${tokens.toLocaleString()} tokens if read raw`);
  }
  if (largestChangedPaths.length > 0) {
    console.log("\nLargest changed paths:");
    for (const entry of largestChangedPaths) {
      const size = entry.bytes === null ? "missing" : `${entry.bytes.toLocaleString()} chars`;
      const tokens = entry.approxTokens === null ? "unknown" : `~${entry.approxTokens.toLocaleString()} tokens`;
      const flags = entry.riskFlags.length > 0 ? ` [${entry.riskFlags.join(", ")}]` : "";
      console.log(`- ${entry.status} ${entry.path}: ${size}, ${tokens}${flags}`);
    }
  }
  console.log("\nRecommended checks:");
  for (const check of recommendedChecks) {
    console.log(`- ${check}`);
  }
  console.log("\nDrilldown:");
  for (const command of drilldownCommands) {
    console.log(`- ${command}`);
  }
}

function parseArgs(args: string[]): Options {
  const options: Options = { mode: "text", top: 12 };

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
    if (arg === "--changed") {
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

function git(args: string[]) {
  const result = spawnSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  return {
    code: result.status ?? 1,
    stderr: result.stderr ?? "",
    stdout: result.stdout ?? ""
  };
}

function parseStatus(output: string) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const status = line.slice(0, 2).trim() || line.slice(0, 2);
      const rawPath = line.slice(3);
      const renamedPath = rawPath.includes(" -> ") ? rawPath.split(" -> ").at(-1) ?? rawPath : rawPath;
      return { status, path: normalizePath(renamedPath) };
    });
}

function buildStatusEntry(entry: { path: string; status: string }): StatusEntry {
  const filesystemPath = path.resolve(process.cwd(), entry.path);
  const measurement = measurePath(filesystemPath);
  const area = classifyArea(entry.path);
  const riskFlags = classifyRisk(entry.path, entry.status, area);

  return {
    area,
    approxTokens: measurement.bytes === null ? null : Math.round(measurement.bytes / 4),
    bytes: measurement.bytes,
    drilldownCommands: buildPathDrilldowns(entry.path, measurement.isDirectory),
    exists: measurement.exists,
    fileCount: measurement.fileCount,
    path: entry.path,
    riskFlags,
    status: entry.status
  };
}

function measurePath(filesystemPath: string) {
  if (!existsSync(filesystemPath)) {
    return { bytes: null, exists: false, fileCount: null, isDirectory: false };
  }

  const stats = statSync(filesystemPath);
  if (stats.isDirectory()) {
    const files = walkFiles(filesystemPath);
    return {
      bytes: files.reduce((total, file) => total + statSync(file).size, 0),
      exists: true,
      fileCount: files.length,
      isDirectory: true
    };
  }

  return { bytes: stats.size, exists: true, fileCount: 1, isDirectory: false };
}

function walkFiles(root: string): string[] {
  const ignored = new Set([".git", ".next", "node_modules"]);
  const found: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (ignored.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      found.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      found.push(fullPath);
    }
  }
  return found;
}

function classifyArea(filePath: string) {
  if (filePath.startsWith("docs/codex/archive/") || filePath.startsWith("docs/codex/plans/archive/")) {
    return "archive-docs";
  }
  if (filePath.startsWith("docs/") || filePath === "AGENTS.md") {
    return "docs";
  }
  if (filePath.startsWith("scripts/")) {
    return "scripts";
  }
  if (filePath.startsWith("src/components/")) {
    return "ui-components";
  }
  if (filePath.startsWith("src/app/")) {
    return "app-routes";
  }
  if (filePath.startsWith("src/lib/data/")) {
    return "data-layer";
  }
  if (filePath.startsWith("src/lib/")) {
    return "domain-lib";
  }
  if (filePath.startsWith("prisma/")) {
    return "database";
  }
  if (filePath.startsWith("output/")) {
    return "generated-output";
  }
  if (filePath === "package.json" || filePath === "package-lock.json") {
    return "dependencies";
  }
  return "other";
}

function classifyRisk(filePath: string, status: string, area: string) {
  const flags = new Set<string>();
  const lower = filePath.toLowerCase();
  if (status.includes("D")) {
    flags.add("deletion");
  }
  if (area === "database" || lower.includes("migration")) {
    flags.add("database");
  }
  if (lower.includes(".env") || lower.includes("secret")) {
    flags.add("secrets");
  }
  if (lower.includes("production") || lower.includes("preview") || lower.includes("deploy")) {
    flags.add("remote-boundary");
  }
  if (lower.includes("medical") || lower.includes("regulatory") || lower.includes("peptide")) {
    flags.add("medical-regulatory");
  }
  if (lower.includes("human-reviewed") || lower.includes("review-claim") || lower.includes("claim")) {
    flags.add("review-status");
  }
  if (lower.includes("source-packet") || lower.includes("evidence") || lower.includes("score")) {
    flags.add("evidence-traceability");
  }
  if (area === "archive-docs") {
    flags.add("archive");
  }
  return [...flags].sort();
}

function buildHardStopFlags(entries: StatusEntry[]) {
  const allFlags = new Set(entries.flatMap((entry) => entry.riskFlags));
  return [...allFlags].filter((flag) =>
    ["database", "secrets", "remote-boundary", "medical-regulatory", "deletion"].includes(flag)
  );
}

function buildRecommendedChecks(entries: StatusEntry[]) {
  if (entries.length === 0) {
    return ["No dirty paths; run task-specific checks only."];
  }

  const checks = new Set<string>();
  checks.add("git diff --stat");
  checks.add("git diff --name-status");
  checks.add("git diff --check -- <task-owned-paths>");

  const paths = entries.map((entry) => entry.path);
  if (paths.some((filePath) => /\.(ts|tsx)$/.test(filePath))) {
    checks.add("npm run typecheck:tsc -- --pretty false");
  }
  if (paths.some((filePath) => filePath.startsWith("prisma/"))) {
    checks.add("npm run db:validate");
  }
  if (paths.some((filePath) => filePath.startsWith("src/components/"))) {
    checks.add("npm run test -- <targeted component test>");
  }
  if (paths.some((filePath) => filePath.startsWith("src/lib/data/") || filePath.includes("source-packet"))) {
    checks.add("npm run test -- <targeted data/source-packet test>");
  }
  if (paths.every((filePath) => filePath.startsWith("docs/") || filePath === "AGENTS.md")) {
    checks.add("Docs-only change: skip broad tests unless commands changed.");
  }

  return [...checks];
}

function buildDrilldownCommands(entries: StatusEntry[]) {
  const commands = new Set<string>(["git diff --stat", "git diff --name-status"]);
  for (const entry of entries.slice(0, 8)) {
    for (const command of entry.drilldownCommands) {
      commands.add(command);
    }
  }
  return [...commands];
}

function buildPathDrilldowns(filePath: string, isDirectory: boolean) {
  if (isDirectory) {
    return [`Get-ChildItem -Recurse -File -LiteralPath '${escapeSingleQuotes(filePath)}' | Select-Object FullName,Length`];
  }
  const commands = [`git diff -- '${escapeSingleQuotes(filePath)}'`];
  if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath)) {
    commands.push(`npx tsx scripts/module-outline.ts '${escapeSingleQuotes(filePath)}'`);
  }
  return commands;
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = getKey(item);
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  return map;
}

function sumNumbers(values: Array<number | null>): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
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

function escapeSingleQuotes(value: string) {
  return value.replace(/'/g, "''");
}

main();
