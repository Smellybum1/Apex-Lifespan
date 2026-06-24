import {
  buildProductAnalyticsAggregateSchema,
  buildProductAnalyticsKpiFramework,
  summarizeProductAnalyticsKpiFramework,
  validateProductAnalyticsAggregateRows,
  type ProductAnalyticsAggregateRow
} from "@/lib/product-analytics-kpis";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function main() {
  const args = readProductAnalyticsKpiArgs(process.argv.slice(2));

  if (args.help) {
    console.log(productAnalyticsKpiHelpText());
    return;
  }

  const framework = buildProductAnalyticsKpiFramework();
  const output = args.aggregateJsonPath
    ? validateProductAnalyticsAggregateRows(
        readAggregateRows(args.aggregateJsonPath),
        framework
      )
    : args.privacyReview
      ? framework.privacyReview
      : args.aggregateSchema
        ? buildProductAnalyticsAggregateSchema(framework)
        : args.summary
          ? summarizeProductAnalyticsKpiFramework(framework)
          : framework;

  console.log(JSON.stringify(output, null, 2));
}

export interface ProductAnalyticsKpiCliArgs {
  aggregateSchema: boolean;
  aggregateJsonPath?: string;
  help: boolean;
  privacyReview: boolean;
  summary: boolean;
}

export function readProductAnalyticsKpiArgs(args: string[]): ProductAnalyticsKpiCliArgs {
  const parsed: ProductAnalyticsKpiCliArgs = {
    aggregateSchema: false,
    help: false,
    privacyReview: false,
    summary: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--summary") {
      parsed.summary = true;
      continue;
    }

    if (arg === "--privacy-review") {
      parsed.privacyReview = true;
      continue;
    }

    if (arg === "--aggregate-schema") {
      parsed.aggregateSchema = true;
      continue;
    }

    if (arg === "--validate-aggregate") {
      const aggregateJsonPath = args[index + 1];

      if (!aggregateJsonPath) {
        throw new Error("--validate-aggregate requires a JSON file path.");
      }

      parsed.aggregateJsonPath = aggregateJsonPath;
      index += 1;
      continue;
    }

    throw new Error(`Unknown product analytics KPI argument: ${arg}`);
  }

  return parsed;
}

export function readAggregateRows(path: string): ProductAnalyticsAggregateRow[] {
  const parsed = JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, "")) as unknown;
  const rows = Array.isArray(parsed)
    ? parsed
    : isObject(parsed) && Array.isArray(parsed.rows)
      ? parsed.rows
      : undefined;

  if (!rows) {
    throw new Error("Aggregate validation input must be a JSON array or an object with a rows array.");
  }

  return rows.map((row) => (isObject(row) ? row : { value: row }));
}

export function productAnalyticsKpiHelpText() {
  return [
    "Usage:",
    "  npm run analytics:kpis -- --summary",
    "  npm run analytics:kpis -- --privacy-review",
    "  npm run analytics:kpis -- --aggregate-schema",
    "  npm run analytics:kpis -- --validate-aggregate <aggregate-json-file>",
    "  npm run analytics:kpis -- --help",
    "",
    "Aggregate validation input:",
    "  Use a local JSON file export, not inline shell JSON.",
    "  The file can be a JSON array of aggregate rows or an object with a rows array.",
    "  Rows are aggregate-only: metricId, value, dimensions, periodStart, periodEnd, and sourceLabel.",
    "  Use --privacy-review for read-only privacy review output.",
    "  Use --aggregate-schema to print the provider-neutral metric and dimension contract first.",
    "",
    "Safety boundaries:",
    "  Read-only: this command does not configure providers, write public data, or promote evidence.",
    "  Do not include raw searches, raw label text, private health details, user IDs, IP addresses, or session replay."
  ].join("\n");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
