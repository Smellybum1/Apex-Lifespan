import type { OutcomeArea } from "@/lib/types";

export const supplementGoalCategories = [
  {
    description: "Direct lifespan, healthy-aging, frailty, or biological-aging endpoint claims.",
    id: "lifespan",
    label: "Lifespan"
  },
  {
    description: "Strength, muscle, power, lean-mass, and functional performance claims.",
    id: "strength",
    label: "Strength"
  },
  {
    description: "Energy, endurance, VO2 max, fatigue-resistance, and exercise-capacity claims.",
    id: "energy",
    label: "Energy"
  },
  {
    description: "Cognition, memory, attention, and focus claims.",
    id: "cognition",
    label: "Cognition"
  },
  {
    description: "Sleep quality, sleep continuity, and recovery-adjacent sleep claims.",
    id: "sleep",
    label: "Sleep"
  },
  {
    description: "Mood, stress, perceived resilience, and affective-wellbeing claims.",
    id: "mood",
    label: "Mood"
  },
  {
    description: "Glucose, insulin, HbA1c, body-composition, and metabolic-health claims.",
    id: "metabolic",
    label: "Metabolic"
  },
  {
    description: "Cardiovascular events, blood pressure, LDL, ApoB, triglyceride, and lipid claims.",
    id: "heart",
    label: "Heart"
  },
  {
    description: "Gut function, microbiome, fiber, motility, and digestive-health claims.",
    id: "gut",
    label: "Gut"
  },
  {
    description: "Immune, respiratory, inflammation, and immune-modulation claims.",
    id: "immune",
    label: "Immune"
  },
  {
    description: "Joint, tendon, connective-tissue, bone-adjacent, and skin-health claims.",
    id: "joints-skin",
    label: "Joints/Skin"
  },
  {
    description: "Fertility, reproductive, hormone, and endocrine-context claims.",
    id: "hormones",
    label: "Hormones"
  },
  {
    description: "Eye-health, vision, macular, and visual-function claims.",
    id: "vision",
    label: "Vision"
  },
  {
    description: "Safety, tolerability, adverse-event, interaction, regulatory, and quality risks.",
    id: "safety",
    label: "Safety"
  }
] as const;

export type SupplementGoalCategory = (typeof supplementGoalCategories)[number];
export type SupplementGoalCategoryId = SupplementGoalCategory["id"];

const supplementGoalCategoryById = new Map(
  supplementGoalCategories.map((category) => [category.id, category])
);

const outcomeGoalCategoryIds: Record<OutcomeArea, SupplementGoalCategoryId> = {
  "Biological aging clocks": "lifespan",
  "Blood pressure": "heart",
  "Cardiovascular events": "heart",
  Cognition: "cognition",
  "Eye health": "vision",
  "Fertility/hormones": "hormones",
  "Glucose/insulin/HbA1c": "metabolic",
  "Immune/respiratory": "immune",
  Inflammation: "immune",
  "Joint/tendon/skin": "joints-skin",
  "LDL/ApoB/lipids": "heart",
  "Mood/stress": "mood",
  "Mortality/lifespan": "lifespan",
  "Muscle/strength": "strength",
  "Safety/adverse effects": "safety",
  Sleep: "sleep",
  "VO2 max/endurance": "energy"
};

export function supplementGoalCategoryForOutcome(
  outcome: OutcomeArea
): SupplementGoalCategory {
  const category = supplementGoalCategoryById.get(outcomeGoalCategoryIds[outcome]);

  if (!category) {
    throw new Error(`No supplement goal category configured for outcome: ${outcome}`);
  }

  return category;
}
