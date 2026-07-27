import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

type OutputMode = "text" | "json";

type Options = {
  mode: OutputMode;
  maxSymbols: number;
  paths: string[];
};

type SymbolEntry = {
  exported: boolean;
  kind: string;
  line: number;
  name: string;
  spanEndLine: number;
};

const HELP_TEXT = `Usage: npx tsx scripts/module-outline.ts <path> [path...] [options]

Read-only module outline. Use before opening large TS/TSX files.

Options:
  --json                  Print machine-readable JSON.
  --max-symbols <count>   Limit symbols per file. Default: 160
  --help                  Show this help.
`;

function main() {
  const options = parseArgs(process.argv.slice(2));
  const outlines = options.paths.map((filePath) => buildOutline(filePath, options.maxSymbols));

  if (options.mode === "json") {
    console.log(JSON.stringify({ files: outlines }, null, 2));
    return;
  }

  for (const outline of outlines) {
    console.log(`${outline.path}: ${outline.lines.toLocaleString()} lines, ${outline.chars.toLocaleString()} chars, ~${outline.approxTokens.toLocaleString()} tokens`);
    console.log(`Imports: ${outline.imports.length}; exports: ${outline.exports.length}; symbols shown: ${outline.symbols.length}/${outline.totalSymbols}`);
    if (outline.exports.length > 0) {
      console.log(`Exports: ${outline.exports.slice(0, 30).join(", ")}${outline.exports.length > 30 ? ", ..." : ""}`);
    }
    console.log("Symbols:");
    for (const symbol of outline.symbols) {
      const exported = symbol.exported ? " export" : "";
      console.log(`- L${symbol.line}-${symbol.spanEndLine}: ${symbol.kind}${exported} ${symbol.name}`);
    }
    console.log("");
  }
}

function parseArgs(args: string[]): Options {
  const options: Options = { mode: "text", maxSymbols: 160, paths: [] };

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
    if (arg === "--max-symbols") {
      options.maxSymbols = readPositiveInteger(args[index + 1], "--max-symbols");
      index += 1;
      continue;
    }
    if (arg.startsWith("--max-symbols=")) {
      options.maxSymbols = readPositiveInteger(arg.slice("--max-symbols=".length), "--max-symbols");
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    }
    options.paths.push(arg);
  }

  if (options.paths.length === 0) {
    throw new Error("At least one file path is required. Use --help for usage.");
  }

  return options;
}

function buildOutline(inputPath: string, maxSymbols: number) {
  const filePath = normalizePath(inputPath);
  const absolutePath = path.resolve(process.cwd(), filePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const stats = statSync(absolutePath);
  if (!stats.isFile()) {
    throw new Error(`Not a file: ${filePath}`);
  }

  const text = readFileSync(absolutePath, "utf8");
  const lines = text.split(/\r?\n/);
  const imports = lines
    .map((line, index) => ({ line: index + 1, text: line.trim() }))
    .filter((line) => line.text.startsWith("import "));
  const allSymbols = findSymbols(lines);
  const symbolsWithSpans = allSymbols.map((symbol, index) => ({
    ...symbol,
    spanEndLine: (allSymbols[index + 1]?.line ?? lines.length + 1) - 1
  }));

  return {
    path: filePath,
    chars: stats.size,
    approxTokens: Math.round(stats.size / 4),
    lines: lines.length,
    imports,
    exports: symbolsWithSpans.filter((symbol) => symbol.exported).map((symbol) => symbol.name),
    totalSymbols: symbolsWithSpans.length,
    symbols: symbolsWithSpans.slice(0, maxSymbols)
  };
}

function findSymbols(lines: string[]): SymbolEntry[] {
  const symbols: Omit<SymbolEntry, "spanEndLine">[] = [];
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) {
      return;
    }

    const declarations: Array<{ kind: string; match: RegExpMatchArray | null; nameIndex: number }> = [
      { kind: "function", match: trimmed.match(/^(export\s+)?(async\s+)?function\s+([A-Za-z0-9_$]+)/), nameIndex: 3 },
      { kind: "default function", match: trimmed.match(/^export\s+default\s+(async\s+)?function\s+([A-Za-z0-9_$]+)/), nameIndex: 2 },
      { kind: "const", match: trimmed.match(/^(export\s+)?const\s+([A-Za-z0-9_$]+)\s*[:=<({]/), nameIndex: 2 },
      { kind: "let", match: trimmed.match(/^(export\s+)?let\s+([A-Za-z0-9_$]+)\s*[:=]/), nameIndex: 2 },
      { kind: "class", match: trimmed.match(/^(export\s+)?class\s+([A-Za-z0-9_$]+)/), nameIndex: 2 },
      { kind: "interface", match: trimmed.match(/^(export\s+)?interface\s+([A-Za-z0-9_$]+)/), nameIndex: 2 },
      { kind: "type", match: trimmed.match(/^(export\s+)?type\s+([A-Za-z0-9_$]+)/), nameIndex: 2 },
      { kind: "enum", match: trimmed.match(/^(export\s+)?enum\s+([A-Za-z0-9_$]+)/), nameIndex: 2 },
      { kind: "test", match: trimmed.match(/^(describe|it|test)\((['\"`][^'\"`]+['\"`])?/), nameIndex: 1 }
    ];

    for (const declaration of declarations) {
      if (!declaration.match) {
        continue;
      }
      const name = declaration.match[declaration.nameIndex];
      if (!name) {
        continue;
      }
      symbols.push({
        exported: trimmed.startsWith("export "),
        kind: declaration.kind,
        line: lineNumber,
        name
      });
      return;
    }
  });

  return symbols.map((symbol) => ({ ...symbol, spanEndLine: symbol.line }));
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
