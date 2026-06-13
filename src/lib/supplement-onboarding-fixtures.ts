import type { SupplementOnboardingInput } from "@/lib/supplement-onboarding";

export type SupplementOnboardingRegressionFixtureKind =
  | "normal"
  | "low-evidence"
  | "safety-heavy"
  | "peptide-watchlist"
  | "product-status-sensitive";

export interface SupplementOnboardingRegressionFixture {
  description: string;
  expectedSignals: string[];
  input: SupplementOnboardingInput;
  kind: SupplementOnboardingRegressionFixtureKind;
}

export const SUPPLEMENT_ONBOARDING_REGRESSION_FIXTURES: SupplementOnboardingRegressionFixture[] = [
  {
    description: "Ordinary vitamin/mineral supplement with a specific use-case claim.",
    expectedSignals: [],
    input: {
      category: "Vitamin/mineral",
      claimTemplateIds: ["sleep", "safety"],
      commonForms: ["Capsule"],
      name: "Magnesium glycinate",
      synonyms: ["magnesium", "glycine magnesium"]
    },
    kind: "normal"
  },
  {
    description: "Novel supplement that should remain blocked until specific claims and sources exist.",
    expectedSignals: [],
    input: {
      category: "Nootropic",
      name: "Novel longevity compound"
    },
    kind: "low-evidence"
  },
  {
    description: "Interaction-heavy supplement that should surface safety packet checks.",
    expectedSignals: ["interaction-context"],
    input: {
      category: "Botanical/herbal",
      claims: [
        {
          claimText:
            "Mood support where sedative and SSRI interaction context must remain visible.",
          outcome: "Mood/stress"
        }
      ],
      name: "Calm herb complex",
      synonyms: ["sedative interaction", "SSRI caution"]
    },
    kind: "safety-heavy"
  },
  {
    description: "Peptide/watchlist item that must block self-use and sourcing language.",
    expectedSignals: ["peptide-biologic", "sourcing-self-use"],
    input: {
      category: "Peptide/biologic",
      name: "Example peptide",
      synonyms: ["research chemical vial", "injectable cycle"]
    },
    kind: "peptide-watchlist"
  },
  {
    description: "Product-specific AU/TGA case with exact product hints.",
    expectedSignals: [],
    input: {
      category: "Fatty acid",
      claimTemplateIds: ["safety"],
      name: "Omega-3 concentrate",
      product: {
        austNumber: "AUST L 123456",
        brand: "Example Brand",
        name: "Omega-3 Concentrate Plus",
        sourceUrl: "https://example.test/artg-result",
        sponsor: "Example Sponsor"
      },
      synonyms: ["fish oil"]
    },
    kind: "product-status-sensitive"
  }
];
