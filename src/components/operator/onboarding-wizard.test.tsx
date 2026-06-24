import { describe, expect, it } from "vitest";

import { draftImportPlanPreviewItems } from "@/components/operator/onboarding-wizard";
import { buildSupplementOnboardingPlan } from "@/lib/supplement-onboarding";
import { buildSupplementOnboardingSeedDiffReport } from "@/lib/supplement-onboarding-seed-diff";

describe("operator onboarding wizard", () => {
  it("formats the read-only draft import plan for the preview", () => {
    const plan = buildSupplementOnboardingPlan({
      category: "Vitamin/mineral",
      claimTemplateIds: ["sleep"],
      name: "Magnesium glycinate"
    });
    const importPlan = buildSupplementOnboardingSeedDiffReport({
      existingData: {
        australiaRegulatoryStatuses: [],
        claims: [],
        interventions: []
      },
      plans: [plan]
    }).items[0]?.importPlan;

    expect(importPlan).toBeDefined();
    expect(draftImportPlanPreviewItems(importPlan!)).toEqual(
      expect.arrayContaining([
        "Status: review required",
        "Recommended path: manual seed copy",
        expect.stringContaining("Seed copy: review required."),
        expect.stringContaining("Database import: not yet enabled."),
        "No auto-write: true",
        "No database write: true",
        "No public evidence rows written: true",
        "No auto-promotion: true"
      ])
    );
  });
});
