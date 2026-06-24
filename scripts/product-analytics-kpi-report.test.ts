import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  main,
  productAnalyticsKpiHelpText,
  readAggregateRows,
  readProductAnalyticsKpiArgs
} from "./product-analytics-kpi-report";
import { buildProductAnalyticsKpiFramework } from "@/lib/product-analytics-kpis";

describe("product analytics KPI report CLI helpers", () => {
  it("parses summary and aggregate validation file-path arguments", () => {
    expect(readProductAnalyticsKpiArgs(["--summary"])).toEqual({
      aggregateSchema: false,
      help: false,
      privacyReview: false,
      summary: true
    });
    expect(readProductAnalyticsKpiArgs(["--aggregate-schema"])).toEqual({
      aggregateSchema: true,
      help: false,
      privacyReview: false,
      summary: false
    });
    expect(
      readProductAnalyticsKpiArgs(["--validate-aggregate", "aggregate-export.json"])
    ).toEqual({
      aggregateSchema: false,
      aggregateJsonPath: "aggregate-export.json",
      help: false,
      privacyReview: false,
      summary: false
    });
    expect(readProductAnalyticsKpiArgs(["--help"])).toEqual({
      aggregateSchema: false,
      help: true,
      privacyReview: false,
      summary: false
    });
    expect(readProductAnalyticsKpiArgs(["-h"])).toEqual({
      aggregateSchema: false,
      help: true,
      privacyReview: false,
      summary: false
    });
  });

  it("parses --privacy-review without enabling summary or aggregate schema", () => {
    expect(readProductAnalyticsKpiArgs(["--privacy-review"])).toEqual({
      aggregateSchema: false,
      help: false,
      privacyReview: true,
      summary: false
    });
  });

  it("prints framework privacy review when --privacy-review is passed", () => {
    const framework = buildProductAnalyticsKpiFramework();
    const logs: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((value) => {
      logs.push(String(value));
    });
    const originalArgv = process.argv;

    try {
      process.argv = ["node", "product-analytics-kpi-report.ts", "--privacy-review"];
      main();
      expect(JSON.parse(logs[0] ?? "")).toEqual(framework.privacyReview);
    } finally {
      logSpy.mockRestore();
      process.argv = originalArgv;
    }
  });

  it("requires aggregate validation to use a JSON file path", () => {
    expect(() => readProductAnalyticsKpiArgs(["--validate-aggregate"])).toThrow(
      "--validate-aggregate requires a JSON file path."
    );
    expect(() => readProductAnalyticsKpiArgs(["--inline-json"])).toThrow(
      "Unknown product analytics KPI argument: --inline-json"
    );
  });

  it("reads aggregate row arrays or wrapped rows objects from JSON files", () => {
    const directory = mkdtempSync(join(tmpdir(), "apex-analytics-kpis-"));
    const arrayPath = join(directory, "aggregate-array.json");
    const objectPath = join(directory, "aggregate-object.json");

    try {
      writeFileSync(
        arrayPath,
        "\uFEFF" +
          JSON.stringify([
            {
              metricId: "public-detail-depth-rate",
              value: 0.42
            }
          ])
      );
      writeFileSync(
        objectPath,
        JSON.stringify({
          rows: [
            {
              metricId: "operator-review-throughput",
              value: 3
            }
          ]
        })
      );

      expect(readAggregateRows(arrayPath)).toEqual([
        {
          metricId: "public-detail-depth-rate",
          value: 0.42
        }
      ]);
      expect(readAggregateRows(objectPath)).toEqual([
        {
          metricId: "operator-review-throughput",
          value: 3
        }
      ]);
    } finally {
      rmSync(directory, { recursive: true });
    }
  });

  it("documents file-based aggregate validation and read-only boundaries", () => {
    const helpText = productAnalyticsKpiHelpText();

    expect(helpText).toContain(
      "npm run analytics:kpis -- --validate-aggregate <aggregate-json-file>"
    );
    expect(helpText).toContain("npm run analytics:kpis -- --privacy-review");
    expect(helpText).toContain("Use --privacy-review for read-only privacy review output.");
    expect(helpText).toContain("npm run analytics:kpis -- --aggregate-schema");
    expect(helpText).toContain("Use a local JSON file export, not inline shell JSON.");
    expect(helpText).toContain(
      "Use --aggregate-schema to print the provider-neutral metric and dimension contract first."
    );
    expect(helpText).toContain(
      "Read-only: this command does not configure providers, write public data, or promote evidence."
    );
    expect(helpText).toContain(
      "Do not include raw searches, raw label text, private health details, user IDs, IP addresses, or session replay."
    );
  });
});
