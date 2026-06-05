import { describe, expect, it } from "vitest";

import {
  assertSeedIntegrity,
  findSeedIntegrityIssues,
  formatSeedIntegrityIssues
} from "@/lib/seed-integrity";
import { australiaRegulatoryStatuses, claims, references, studies } from "@/lib/seed-data";

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

  it("keeps seeded claim, study, and AU/TGA reference links resolvable", () => {
    const referenceIds = references.map((reference) => reference.id);

    expect(
      findSeedIntegrityIssues([
        {
          name: "Claim key references",
          expectedIds: claims.flatMap((claim) => claim.keyReferenceIds),
          actualIds: referenceIds
        },
        {
          name: "Study references",
          expectedIds: studies.map((study) => study.referenceId),
          actualIds: referenceIds
        },
        {
          name: "AustraliaRegulatoryStatus references",
          expectedIds: australiaRegulatoryStatuses.flatMap((status) =>
            status.referenceId ? [status.referenceId] : []
          ),
          actualIds: referenceIds
        }
      ])
    ).toEqual([]);
  });

  it("keeps seeded AU/TGA source URLs aligned with their curated references", () => {
    const referencesById = new Map(references.map((reference) => [reference.id, reference]));
    const mismatches = australiaRegulatoryStatuses.flatMap((status) => {
      if (!status.referenceId) {
        return [];
      }

      const reference = referencesById.get(status.referenceId);

      if (!reference || reference.url === status.sourceUrl) {
        return [];
      }

      return [
        {
          referenceId: status.referenceId,
          referenceUrl: reference.url,
          sourceUrl: status.sourceUrl,
          statusId: status.id
        }
      ];
    });

    expect(mismatches).toEqual([]);
  });
});
