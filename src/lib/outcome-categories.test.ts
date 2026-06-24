import { describe, expect, it } from "vitest";

import {
  supplementGoalCategories,
  supplementGoalCategoryForOutcome
} from "@/lib/outcome-categories";
import type { OutcomeArea } from "@/lib/types";

const outcomeAreas: OutcomeArea[] = [
  "Mortality/lifespan",
  "Cardiovascular events",
  "LDL/ApoB/lipids",
  "Blood pressure",
  "Glucose/insulin/HbA1c",
  "Inflammation",
  "Cognition",
  "Sleep",
  "Mood/stress",
  "Muscle/strength",
  "VO2 max/endurance",
  "Joint/tendon/skin",
  "Eye health",
  "Immune/respiratory",
  "Fertility/hormones",
  "Biological aging clocks",
  "Safety/adverse effects"
];

describe("supplement goal categories", () => {
  it("maps every detailed outcome to a user-facing supplement goal", () => {
    const categoryIds = new Set(supplementGoalCategories.map((category) => category.id));

    for (const outcome of outcomeAreas) {
      const category = supplementGoalCategoryForOutcome(outcome);

      expect(categoryIds.has(category.id)).toBe(true);
      expect(category.label.length).toBeGreaterThan(0);
    }
  });

  it("groups detailed cardiovascular outcomes under Heart", () => {
    expect(supplementGoalCategoryForOutcome("Cardiovascular events").label).toBe("Heart");
    expect(supplementGoalCategoryForOutcome("LDL/ApoB/lipids").label).toBe("Heart");
    expect(supplementGoalCategoryForOutcome("Blood pressure").label).toBe("Heart");
  });
});
