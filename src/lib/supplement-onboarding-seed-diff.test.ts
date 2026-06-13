import { describe, expect, it } from "vitest";

import {
  buildSupplementOnboardingSeedDiffReport,
  summarizeSupplementOnboardingSeedDiffReport,
  supplementOnboardingSeedDiffReportToMarkdown
} from "@/lib/supplement-onboarding-seed-diff";
import { buildSupplementOnboardingPlan } from "@/lib/supplement-onboarding";

describe("supplement onboarding seed diff", () => {
  it("builds a read-only copy-review seed diff from an onboarding plan", () => {
    const plan = buildSupplementOnboardingPlan({
      category: "Vitamin/mineral",
      claimTemplateIds: ["sleep"],
      generatedAt: new Date("2026-06-13T10:00:00Z"),
      name: "Magnesium glycinate"
    });
    const report = buildSupplementOnboardingSeedDiffReport({
      generatedAt: new Date("2026-06-13T11:00:00Z"),
      plans: [plan]
    });

    expect(report).toMatchObject({
      generatedAt: "2026-06-13T11:00:00.000Z",
      humanOwned: true,
      noAutoPromotion: true,
      noAutoWrite: true,
      readOnly: true,
      summary: {
        blockedItems: 0,
        claimDrafts: 1,
        conflicts: 0,
        items: 1,
        reviewRequiredItems: 1,
        targetPath: "src/lib/seed-data.ts"
      },
      validationCommands: [
        "npm run db:validate",
        "npm run typecheck",
        "npm run test",
        "npm run build"
      ]
    });
    expect(report.items[0]).toMatchObject({
      claimIds: ["magnesium-glycinate-sleep"],
      importPlan: {
        databaseImport: {
          noImportCommand: true,
          status: "future-gated",
          supportedNow: false
        },
        noAutoPromotion: true,
        noAutoWrite: true,
        noDatabaseWrite: true,
        noPublicEvidenceRowsWritten: true,
        recommendedPath: "manual-seed-copy",
        seedCopy: {
          status: "review-required",
          targetPath: "src/lib/seed-data.ts"
        },
        status: "review-required"
      },
      interventionId: "magnesium-glycinate",
      operations: [
        expect.objectContaining({
          exportName: "interventions",
          ids: ["magnesium-glycinate"]
        }),
        expect.objectContaining({
          exportName: "claims",
          ids: ["magnesium-glycinate-sleep"]
        }),
        expect.objectContaining({
          exportName: "australiaRegulatoryStatuses",
          ids: ["magnesium-glycinate-au-status"]
        })
      ],
      status: "review-required"
    });
    expect(report.items[0]?.snippet).toContain("satisfies Intervention");
    expect(report.items[0]?.warnings).toEqual(
      expect.arrayContaining([
        "No individualized medical advice, diagnosis, treatment, or dosing guidance is generated.",
        "6 AU/TGA product-status gap(s) remain; keep regulatory kind Unknown until reviewed."
      ])
    );

    expect(summarizeSupplementOnboardingSeedDiffReport(report)).toMatchObject({
      items: [
        {
          claimCount: 1,
          importPlan: {
            databaseImportStatus: "future-gated",
            noAutoWrite: true,
            noDatabaseWrite: true,
            recommendedPath: "manual-seed-copy",
            seedCopyStatus: "review-required",
            status: "review-required"
          },
          interventionId: "magnesium-glycinate",
          name: "Magnesium glycinate",
          status: "review-required"
        }
      ],
      readOnly: true
    });
  });

  it("blocks copy-review when proposed ids already exist in seed data", () => {
    const plan = buildSupplementOnboardingPlan({
      category: "Vitamin/mineral",
      claimTemplateIds: ["sleep"],
      generatedAt: new Date("2026-06-13T10:00:00Z"),
      name: "Magnesium glycinate"
    });
    const report = buildSupplementOnboardingSeedDiffReport({
      existingData: {
        australiaRegulatoryStatuses: [{ id: "magnesium-glycinate-au-status" }],
        claims: [{ id: "magnesium-glycinate-sleep" }],
        interventions: [{ id: "magnesium-glycinate" }]
      },
      plans: [plan]
    });

    expect(report.summary).toMatchObject({
      blockedItems: 1,
      conflicts: 3
    });
    expect(report.items[0]).toMatchObject({
      blockers: [
        "Intervention id already exists in seed data: magnesium-glycinate.",
        "Claim id already exists in seed data: magnesium-glycinate-sleep.",
        "AU/TGA status id already exists in seed data: magnesium-glycinate-au-status."
      ],
      importPlan: {
        recommendedPath: "resolve-blockers",
        seedCopy: {
          nextAction: "Resolve blockers before copying any draft records into seed data.",
          status: "blocked"
        },
        status: "blocked"
      },
      status: "blocked"
    });
  });

  it("blocks peptide/watchlist seed diffs before seed-data copying", () => {
    const plan = buildSupplementOnboardingPlan({
      category: "Peptide/biologic",
      generatedAt: new Date("2026-06-13T10:00:00Z"),
      name: "Example peptide",
      synonyms: ["research chemical vial"]
    });
    const report = buildSupplementOnboardingSeedDiffReport({
      plans: [plan]
    });

    expect(report.summary).toMatchObject({
      blockedItems: 1,
      safetyBlockedItems: 1
    });
    expect(report.items[0]).toMatchObject({
      safetySignals: {
        blocked: 2,
        warning: 0
      },
      status: "blocked"
    });
    expect(report.items[0]?.blockers).toContain(
      "2 blocked safety/watchlist signal(s) must be resolved before copying seed data."
    );
  });

  it("renders a markdown review packet with snippets and validation commands", () => {
    const plan = buildSupplementOnboardingPlan({
      category: "Vitamin/mineral",
      claimTemplateIds: ["sleep"],
      generatedAt: new Date("2026-06-13T10:00:00Z"),
      name: "Magnesium glycinate"
    });
    const markdown = supplementOnboardingSeedDiffReportToMarkdown(
      buildSupplementOnboardingSeedDiffReport({
        plans: [plan]
      })
    );

    expect(markdown).toContain("# Supplement Onboarding Seed Diff");
    expect(markdown).toContain("No auto-write: true");
    expect(markdown).toContain("## Validation Commands");
    expect(markdown).toContain("npm run db:validate");
    expect(markdown).toContain("### Magnesium glycinate");
    expect(markdown).toContain("Draft import plan:");
    expect(markdown).toContain("database import: future-gated; supported now: false");
    expect(markdown).toContain("no database write: true");
    expect(markdown).toContain("Seed snippet:");
    expect(markdown).toContain("satisfies AustraliaRegulatoryStatus");
    expect(markdown).toContain("Queue commands after reviewed copy and validation");
  });
});
