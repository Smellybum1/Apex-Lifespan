import { describe, expect, it } from "vitest";

import {
  buildSupplementOnboardingImportAssistantReport,
  summarizeSupplementOnboardingImportAssistantReport,
  supplementOnboardingImportAssistantReportToMarkdown
} from "@/lib/supplement-onboarding-import-assistant";
import { buildSupplementOnboardingPlan } from "@/lib/supplement-onboarding";
import { buildSupplementOnboardingSeedDiffReport } from "@/lib/supplement-onboarding-seed-diff";

describe("supplement onboarding import assistant", () => {
  it("previews draft-to-seed and future database import without enabling writes", () => {
    const plan = buildSupplementOnboardingPlan({
      category: "Vitamin/mineral",
      claimTemplateIds: ["sleep"],
      generatedAt: new Date("2026-06-13T10:00:00.000Z"),
      name: "Magnesium glycinate"
    });
    const seedDiffReport = buildSupplementOnboardingSeedDiffReport({
      generatedAt: new Date("2026-06-13T10:30:00.000Z"),
      plans: [plan]
    });

    const report = buildSupplementOnboardingImportAssistantReport({
      generatedAt: new Date("2026-06-13T11:00:00.000Z"),
      plans: [plan],
      seedDiffReport
    });

    expect(report).toMatchObject({
      generatedAt: "2026-06-13T11:00:00.000Z",
      humanOwned: true,
      noAutoPromotion: true,
      noAutoReview: true,
      noAutoWrite: true,
      noCandidateDecision: true,
      noDatabaseWrite: true,
      noExtractionWrite: true,
      noPublicEvidenceRowsWritten: true,
      readOnly: true,
      summary: {
        blockedItems: 0,
        databaseImportSupported: false,
        items: 1,
        manualReviewRequiredItems: 1,
        plannedDatabaseRecords: 3,
        publicPromotionSupported: false
      }
    });
    expect(report.items[0]).toMatchObject({
      databaseImport: {
        auditAction: "supplementOnboarding.databaseImport",
        noImportCommand: true,
        plannedRecords: [
          expect.objectContaining({
            id: "magnesium-glycinate",
            model: "Intervention",
            status: "draft-only"
          }),
          expect.objectContaining({
            id: "magnesium-glycinate-sleep",
            model: "Claim",
            status: "draft-only"
          }),
          expect.objectContaining({
            id: "magnesium-glycinate-au-status",
            model: "AustraliaRegulatoryStatus",
            status: "draft-only"
          })
        ],
        status: "future-gated",
        supportedNow: false
      },
      manualSeedCopy: {
        status: "review-required",
        supportedNow: true,
        targetPath: "src/lib/seed-data.ts"
      },
      publicPromotion: {
        noAutoPromotion: true,
        status: "blocked-until-evidence-review",
        supportedNow: false
      },
      status: "manual-review-required"
    });
    expect(report.items[0].databaseImport.plannedRecords[1].fieldPreview).toMatchObject({
      reviewStatus: "Unreviewed AI draft"
    });
  });

  it("summarizes import assistant status without field previews", () => {
    const plan = buildSupplementOnboardingPlan({
      category: "Vitamin/mineral",
      claimTemplateIds: ["sleep"],
      name: "Magnesium glycinate"
    });
    const seedDiffReport = buildSupplementOnboardingSeedDiffReport({
      existingData: {
        australiaRegulatoryStatuses: [{ id: "magnesium-glycinate-au-status" }],
        claims: [{ id: "magnesium-glycinate-sleep" }],
        interventions: [{ id: "magnesium-glycinate" }]
      },
      plans: [plan]
    });
    const report = buildSupplementOnboardingImportAssistantReport({
      plans: [plan],
      seedDiffReport
    });
    const summary = summarizeSupplementOnboardingImportAssistantReport(report);

    expect(summary).toMatchObject({
      noAutoWrite: true,
      noDatabaseWrite: true,
      noPublicEvidenceRowsWritten: true,
      readOnly: true,
      summary: {
        blockedItems: 1,
        databaseImportSupported: false
      }
    });
    expect(summary.items[0]).toMatchObject({
      databaseImportStatus: "future-gated",
      manualSeedCopyStatus: "blocked",
      plannedDatabaseRecords: 3,
      publicPromotionStatus: "blocked-until-evidence-review",
      status: "blocked"
    });
    expect(JSON.stringify(summary)).not.toContain("fieldPreview");
  });

  it("renders markdown with gates and planned records", () => {
    const plan = buildSupplementOnboardingPlan({
      category: "Vitamin/mineral",
      claimTemplateIds: ["sleep"],
      name: "Magnesium glycinate"
    });
    const seedDiffReport = buildSupplementOnboardingSeedDiffReport({
      plans: [plan]
    });
    const markdown = supplementOnboardingImportAssistantReportToMarkdown(
      buildSupplementOnboardingImportAssistantReport({
        plans: [plan],
        seedDiffReport
      })
    );

    expect(markdown).toContain("# Supplement Onboarding Import Assistant");
    expect(markdown).toContain("No database write: true");
    expect(markdown).toContain("database import: future-gated; supported now: false");
    expect(markdown).toContain("Claim `magnesium-glycinate-sleep`");
    expect(markdown).toContain("Required future gates for database import:");
    expect(markdown).toContain("Public promotion prerequisites:");
  });
});
