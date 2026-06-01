import { describe, expect, it } from "vitest";

import {
  assertSeedIntegrity,
  findSeedIntegrityIssues,
  formatSeedIntegrityIssues
} from "@/lib/seed-integrity";

describe("seed integrity", () => {
  it("reports missing expected IDs", () => {
    const issues = findSeedIntegrityIssues([
      {
        name: "Intervention",
        expectedIds: ["creatine", "vitamin-d"],
        actualIds: ["creatine"]
      }
    ]);

    expect(issues).toEqual([
      {
        name: "Intervention",
        missingIds: ["vitamin-d"],
        staleSeedOwnedIds: []
      }
    ]);
  });

  it("reports stale seed-owned rows while allowing non-seed extra rows", () => {
    const issues = findSeedIntegrityIssues([
      {
        name: "AustraliaRegulatoryStatus",
        expectedIds: ["au-reg-creatine-intervention"],
        actualIds: [
          "au-reg-creatine-intervention",
          "au-reg-retired-seed-row",
          "external-imported-status"
        ],
        seedOwnedPrefixes: ["au-reg-"]
      }
    ]);

    expect(issues).toEqual([
      {
        name: "AustraliaRegulatoryStatus",
        missingIds: [],
        staleSeedOwnedIds: ["au-reg-retired-seed-row"]
      }
    ]);
  });

  it("formats a seed failure message for the seed script", () => {
    const issue = {
      name: "Product",
      missingIds: ["seed-creatine-product"],
      staleSeedOwnedIds: ["seed-retired-product"]
    };

    expect(formatSeedIntegrityIssues([issue])).toContain(
      "Product missing expected IDs: seed-creatine-product"
    );
    expect(() => assertSeedIntegrity([{ name: "Product", expectedIds: ["a"], actualIds: [] }]))
      .toThrowErrorMatchingInlineSnapshot(`
      [Error: Seed integrity check failed.
      Product missing expected IDs: a]
    `);
  });
});
