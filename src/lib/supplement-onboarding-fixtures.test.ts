import { describe, expect, it } from "vitest";

import { SUPPLEMENT_ONBOARDING_REGRESSION_FIXTURES } from "@/lib/supplement-onboarding-fixtures";
import {
  buildSupplementOnboardingBatchPlan,
  buildSupplementOnboardingPlan
} from "@/lib/supplement-onboarding";

describe("supplement onboarding regression fixtures", () => {
  it("covers the expected onboarding case types", () => {
    expect(
      SUPPLEMENT_ONBOARDING_REGRESSION_FIXTURES.map((fixture) => fixture.kind)
    ).toEqual([
      "normal",
      "low-evidence",
      "safety-heavy",
      "peptide-watchlist",
      "product-status-sensitive"
    ]);
  });

  it("keeps each fixture conservative, read-only, and signal-aware", () => {
    for (const fixture of SUPPLEMENT_ONBOARDING_REGRESSION_FIXTURES) {
      const plan = buildSupplementOnboardingPlan({
        ...fixture.input,
        generatedAt: new Date("2026-06-12T10:00:00Z")
      });

      expect(plan.guardrailWarnings).toEqual(
        expect.arrayContaining([
          "No individualized medical advice, diagnosis, treatment, or dosing guidance is generated.",
          "Source-candidate acceptance, claim linking, extraction, promotion, and claim review remain explicit human-owned steps."
        ])
      );
      expect(plan.sourceQueries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            purpose: "regulatory-review",
            source: "AU/TGA review"
          })
        ])
      );
      expect(plan.safetyWatchlist.signals.map((signal) => signal.id)).toEqual(
        expect.arrayContaining(fixture.expectedSignals)
      );
    }
  });

  it("summarizes fixture safety signals in batch mode", () => {
    const batch = buildSupplementOnboardingBatchPlan({
      generatedAt: new Date("2026-06-12T10:00:00Z"),
      supplements: SUPPLEMENT_ONBOARDING_REGRESSION_FIXTURES.map(
        (fixture) => fixture.input
      )
    });

    expect(batch.readOnly).toBe(true);
    expect(batch.plans).toHaveLength(5);
    expect(batch.progress).toMatchObject({
      draftClaims: batch.plans.reduce((total, plan) => total + plan.claimDrafts.length, 0),
      productStatusTargets: 1,
      queueCommands: batch.queueAfterSeedCommands.length,
      supplements: 5,
      supplementsWithSafetySignals: 2
    });
    expect(batch.safetySummary).toMatchObject({
      blockedSignalCount: 2,
      supplementsWithSignals: ["Calm herb complex", "Example peptide"],
      warningSignalCount: 1
    });
    expect(batch.queueAfterSeedCommands.length).toBeGreaterThan(5);
  });
});
