import { describe, expect, it } from "vitest";

import { interventions } from "@/lib/seed-data";
import { labelTrialWatchItem } from "@/lib/trial-registry-labels";
import type { TrialWatchItem } from "@/lib/types";

describe("labelTrialWatchItem", () => {
  it("labels a creatine registry record as a direct match", () => {
    const trial: TrialWatchItem = {
      id: "trial-creatine-strength",
      interventionId: "creatine",
      title: "Creatine monohydrate supplementation and resistance-training strength outcomes",
      status: "Recruiting",
      phase: "Phase 2",
      enrollment: "120 planned",
      lastUpdateDate: "2026-05-18",
      evidenceImpact: "Increasing",
      url: "https://clinicaltrials.gov/study/NCTSEED-CREATINE",
      nctId: "NCTSEED-CREATINE",
      registeredInterventions: ["Dietary Supplement: Creatine monohydrate"],
      primaryOutcomes: ["1-repetition maximum bench press"],
      resultsPosted: false
    };

    const labels = labelTrialWatchItem(
      trial,
      interventions.find((item) => item.id === "creatine")
    );

    expect(labels.trialRelevanceLabel).toBe("Direct match");
    expect(labels.trialResultLabel).toBe("Unreviewed lead");
  });

  it("labels a completed magnesium sleep trial with posted results", () => {
    const trial: TrialWatchItem = {
      id: "trial-magnesium-sleep",
      interventionId: "magnesium",
      title: "Magnesium supplementation and subjective sleep quality in adults with low habitual intake",
      status: "Completed",
      phase: "Phase 3",
      enrollment: "180 actual",
      lastUpdateDate: "2026-04-02",
      evidenceImpact: "Stable",
      url: "https://clinicaltrials.gov/study/NCTSEED-MAGSLEEP",
      nctId: "NCTSEED-MAGSLEEP",
      registeredInterventions: ["Dietary Supplement: Magnesium glycinate"],
      primaryOutcomes: ["Pittsburgh Sleep Quality Index"],
      resultsPosted: true
    };

    const labels = labelTrialWatchItem(
      trial,
      interventions.find((item) => item.id === "magnesium")
    );

    expect(labels.trialRelevanceLabel).toBe("Direct match");
    expect(labels.trialResultLabel).toBe("Results posted");
  });
});
