import { describe, expect, it } from "vitest";

import { buildSupplementOnboardingPlan } from "@/lib/supplement-onboarding";
import { buildSupplementOnboardingReviewKit } from "@/lib/supplement-onboarding-review-kit";
import { buildSupplementOnboardingSeedDiffReport } from "@/lib/supplement-onboarding-seed-diff";

describe("supplement onboarding review kit", () => {
  it("builds a local read-only review kit for a supplement draft", () => {
    const plan = buildSupplementOnboardingPlan({
      category: "Vitamin/mineral",
      claimTemplateIds: ["sleep"],
      generatedAt: new Date("2026-06-12T10:00:00.000Z"),
      name: "Magnesium glycinate",
      product: {
        austNumber: "AUST L 123456",
        brand: "Example Brand",
        name: "Example Magnesium Glycinate",
        sourceUrl: "https://example.test/artg-product",
        sponsor: "Example Sponsor Pty Ltd"
      }
    });
    const seedDiffReport = buildSupplementOnboardingSeedDiffReport({
      generatedAt: new Date("2026-06-12T10:00:00.000Z"),
      plans: [plan]
    });

    const kit = buildSupplementOnboardingReviewKit({
      generatedAt: new Date("2026-06-12T10:30:00.000Z"),
      plan,
      seedDiffReport
    });

    expect(kit).toMatchObject({
      generatedAt: "2026-06-12T10:30:00.000Z",
      humanOwned: true,
      localFileWriteOnly: true,
      noAutoPromotion: true,
      noAutoReview: true,
      noAutoWrite: true,
      noCandidateDecision: true,
      noDatabaseWrite: true,
      noExtractionWrite: true,
      noPublicEvidenceRowsWritten: true,
      readOnly: true,
      slug: "magnesium-glycinate",
      summary: {
        claimDrafts: 1,
        files: 8,
        importPlanStatus: "review-required",
        seedCopyStatus: "review-required"
      }
    });
    expect(kit.files.map((file) => file.path)).toEqual([
      "magnesium-glycinate-review-kit/00-index.md",
      "magnesium-glycinate-review-kit/01-draft.md",
      "magnesium-glycinate-review-kit/02-seed-diff.md",
      "magnesium-glycinate-review-kit/03-handoff-commands.md",
      "magnesium-glycinate-review-kit/04-review-packet-shell.md",
      "magnesium-glycinate-review-kit/05-product-status.md",
      "magnesium-glycinate-review-kit/06-fulltext-next.md",
      "magnesium-glycinate-review-kit/07-import-assistant.md"
    ]);
    expect(kit.files[0].content).toContain("No auto-promotion: true");
    expect(kit.files[2].content).toContain("Draft import plan:");
    expect(kit.files[3].content).toContain("npm run onboarding:seed-diff");
    expect(kit.files[4].content).toContain("npm run onboarding:review-packet");
    expect(kit.files[5].content).toContain("AU/TGA Product Status");
    expect(kit.files[6].content).toContain("no connector approval: true");
    expect(kit.files[7].content).toContain("database import: future-gated");
  });

  it("fails closed when the seed diff report does not match the draft", () => {
    const plan = buildSupplementOnboardingPlan({
      category: "Vitamin/mineral",
      name: "Magnesium glycinate"
    });
    const otherPlan = buildSupplementOnboardingPlan({
      category: "Vitamin/mineral",
      name: "Zinc citrate"
    });
    const seedDiffReport = buildSupplementOnboardingSeedDiffReport({
      plans: [otherPlan]
    });

    expect(() =>
      buildSupplementOnboardingReviewKit({
        plan,
        seedDiffReport
      })
    ).toThrow("Seed diff report does not contain draft magnesium-glycinate.");
  });
});
