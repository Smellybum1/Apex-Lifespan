import { describe, expect, it } from "vitest";

import {
  assertSeedIntegrity,
  findSeedIntegrityIssues,
  formatSeedIntegrityIssues
} from "@/lib/seed-integrity";
import {
  australiaRegulatoryStatuses,
  claims,
  interventions,
  productSignals,
  references,
  safetyAlerts,
  studies,
  trialWatchItems
} from "@/lib/seed-data";

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

  it("keeps seeded dashboard intervention links resolvable", () => {
    const interventionIds = interventions.map((intervention) => intervention.id);

    expect(
      findSeedIntegrityIssues([
        {
          name: "Claim interventions",
          expectedIds: claims.map((claim) => claim.interventionId),
          actualIds: interventionIds
        },
        {
          name: "Safety alert interventions",
          expectedIds: safetyAlerts.map((alert) => alert.interventionId),
          actualIds: interventionIds
        },
        {
          name: "Trial watch interventions",
          expectedIds: trialWatchItems.map((trial) => trial.interventionId),
          actualIds: interventionIds
        },
        {
          name: "AustraliaRegulatoryStatus interventions",
          expectedIds: australiaRegulatoryStatuses.flatMap((status) =>
            status.interventionId ? [status.interventionId] : []
          ),
          actualIds: interventionIds
        },
        {
          name: "Intervention AU/TGA status coverage",
          expectedIds: interventionIds,
          actualIds: australiaRegulatoryStatuses.flatMap((status) =>
            status.interventionId ? [status.interventionId] : []
          )
        }
      ])
    ).toEqual([]);
  });

  it("keeps seeded AU/TGA product statuses attached to exactly one known target", () => {
    const productIds = productSignals.map((product) => product.id);
    const malformedTargets = australiaRegulatoryStatuses.flatMap((status) => {
      const targetCount =
        Number(Boolean(status.interventionId)) + Number(Boolean(status.productId));

      return targetCount === 1
        ? []
        : [
            {
              productId: status.productId,
              interventionId: status.interventionId,
              statusId: status.id
            }
          ];
    });

    expect(malformedTargets).toEqual([]);
    expect(
      findSeedIntegrityIssues([
        {
          name: "AustraliaRegulatoryStatus products",
          expectedIds: australiaRegulatoryStatuses.flatMap((status) =>
            status.productId ? [status.productId] : []
          ),
          actualIds: productIds
        },
        {
          name: "Product AU/TGA status coverage",
          expectedIds: productIds,
          actualIds: australiaRegulatoryStatuses.flatMap((status) =>
            status.productId ? [status.productId] : []
          )
        }
      ])
    ).toEqual([]);
  });
});
