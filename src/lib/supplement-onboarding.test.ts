import { describe, expect, it } from "vitest";

import {
  buildSupplementOnboardingBatchPlan,
  buildSupplementOnboardingPlan,
  supplementOnboardingBatchPlanToMarkdown,
  supplementOnboardingPlanToSeedSnippet,
  supplementOnboardingPlanToMarkdown
} from "@/lib/supplement-onboarding";

describe("supplement onboarding planner", () => {
  it("builds a seed-ready draft and claim-scoped source commands", () => {
    const plan = buildSupplementOnboardingPlan({
      category: "Vitamin/mineral",
      claims: [
        {
          outcome: "Sleep",
          claimText: "Sleep quality support in adults with low magnesium intake."
        }
      ],
      commonForms: ["Capsule"],
      generatedAt: new Date("2026-06-12T10:00:00Z"),
      name: "Magnesium glycinate",
      synonyms: ["magnesium", "glycine magnesium"]
    });

    expect(plan.interventionDraft).toMatchObject({
      category: "Vitamin/mineral",
      id: "magnesium-glycinate",
      lastReviewed: "2026-06-12",
      slug: "magnesium-glycinate"
    });
    expect(plan.claimDrafts).toEqual([
      {
        claimText: "Sleep quality support in adults with low magnesium intake.",
        id: "magnesium-glycinate-sleep",
        outcome: "Sleep",
        reviewStatus: "Unreviewed AI draft"
      }
    ]);
    expect(plan.sourceQueries[0].command).toContain("--queue-pubmed");
    expect(plan.sourceQueries[0]).toMatchObject({
      claimId: "magnesium-glycinate-sleep",
      outcome: "Sleep",
      sourceBundleId: "core-evidence",
      sourceBundleLabel: "Core evidence sweep",
      purpose: "review-level",
      priority: 10,
      source: "PubMed"
    });
    expect(plan.sourceQueries[0].command).toContain(
      '--intervention-id "magnesium-glycinate"'
    );
    expect(plan.sourceQueries[0].command).toContain(
      '--claim-id "magnesium-glycinate-sleep"'
    );
    expect(plan.sourceQueries).toContainEqual(
      expect.objectContaining({
        claimId: "magnesium-glycinate-sleep",
        purpose: "regulatory-review",
        command: "npm run regulatory:review",
        sourceBundleId: "core-evidence",
        source: "AU/TGA review"
      })
    );
    expect(plan.sourceQueries).toContainEqual(
      expect.objectContaining({
        claimId: "magnesium-glycinate-sleep",
        purpose: "outcome-context",
        sourceBundleId: "outcome-context",
        sourceBundleLabel: "Outcome-specific evidence bundle",
        source: "PubMed",
        term: "Magnesium glycinate sleep quality insomnia continuity placebo randomized trial"
      })
    );
    expect(plan.sourceQueries).toContainEqual(
      expect.objectContaining({
        claimId: "magnesium-glycinate-sleep",
        purpose: "category-context",
        sourceBundleId: "category-context",
        sourceBundleLabel: "Category-specific safety/context bundle",
        source: "PubMed",
        term:
          "Magnesium glycinate deficiency low status upper intake level toxicity biomarker review"
      })
    );
    expect(plan.queueAfterSeedCommands).toContain(
      'npm run ingest:sources -- --queue-claim-sources magnesium-glycinate-sleep --region "AU"'
    );
    expect(plan.handoffCommands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command:
            'npm run onboarding:seed-diff -- --name "Magnesium glycinate" --category "Vitamin/mineral" --summary',
          id: "seed-diff-review",
          mode: "read-only"
        }),
        expect.objectContaining({
          command:
            'npm run onboarding:import-assistant -- --name "Magnesium glycinate" --category "Vitamin/mineral" --summary',
          id: "import-assistant",
          mode: "read-only"
        }),
        expect.objectContaining({
          command:
            'npm run onboarding:readiness -- --supplement "magnesium-glycinate" --summary',
          id: "supplement-readiness"
        }),
        expect.objectContaining({
          command:
            'npm run onboarding:queue-sources -- --supplement "magnesium-glycinate" --region "AU"',
          id: "source-queue-preview"
        }),
        expect.objectContaining({
          command: "npm run db:validate",
          id: "db-validate",
          mode: "local-validation"
        })
      ])
    );
    expect(plan.regulatoryDraft.status).toBe("AU/TGA product-level status unverified");
    expect(plan.productStatusAssistant.target).toMatchObject({
      name: "Magnesium glycinate product requiring AU/TGA verification"
    });
    expect(plan.productStatusAssistant.gapAssessment).toEqual(
      expect.arrayContaining([
        "Exact product name is not captured yet.",
        "No AUST number or ARTG identifier is captured yet.",
        "Ingredient-level evidence must not be used as a fallback for product-level Australian regulatory confidence."
      ])
    );
  });

  it("builds a product-level AU/TGA assistant when exact product hints are available", () => {
    const plan = buildSupplementOnboardingPlan({
      category: "Vitamin/mineral",
      generatedAt: new Date("2026-06-12T10:00:00Z"),
      name: "Magnesium glycinate",
      product: {
        austNumber: "AUST L 123456",
        brand: "Example Brand",
        name: "Magnesium Glycinate Plus",
        sourceUrl: "https://example.test/artg-result",
        sponsor: "Example Sponsor"
      }
    });

    expect(plan.productStatusAssistant.target).toEqual({
      austNumber: "AUST L 123456",
      brand: "Example Brand",
      name: "Magnesium Glycinate Plus",
      sourceUrl: "https://example.test/artg-result",
      sponsor: "Example Sponsor"
    });
    expect(plan.productStatusAssistant.searchTerms).toEqual(
      expect.arrayContaining([
        "Example Brand Magnesium Glycinate Plus AUST ARTG",
        "Example Brand Magnesium Glycinate Plus TGA ARTG"
      ])
    );
    expect(plan.productStatusAssistant.confidenceRules).toContainEqual({
      confidence: "Moderate",
      rule:
        "Fresh product-level AUST L evidence with exact AUST/ARTG identifier and matching product identity; listed status does not mean efficacy was assessed."
    });
    expect(plan.productStatusAssistant.gapAssessment).toEqual([
      "Ingredient-level evidence must not be used as a fallback for product-level Australian regulatory confidence."
    ]);
  });

  it("expands claim templates into conservative draft claims", () => {
    const plan = buildSupplementOnboardingPlan({
      category: "Vitamin/mineral",
      claimTemplateIds: ["sleep", "safety", "sleep"],
      generatedAt: new Date("2026-06-12T10:00:00Z"),
      name: "Magnesium glycinate"
    });

    expect(plan.claimTemplateIds).toEqual(["sleep", "safety"]);
    expect(plan.claimDrafts.map((claim) => claim.id)).toEqual([
      "magnesium-glycinate-sleep",
      "magnesium-glycinate-safety"
    ]);
    expect(plan.blockingReviewItems).not.toContain(
      "Add at least one specific non-lifespan use-case claim before public scoring."
    );
  });

  it("auto-applies category defaults when no claim scopes are supplied", () => {
    const plan = buildSupplementOnboardingPlan({
      category: "Fatty acid",
      generatedAt: new Date("2026-06-12T10:00:00Z"),
      name: "Omega-3 EPA/DHA"
    });

    expect(plan.claimTemplateIds).toEqual([
      "safety",
      "lifespan",
      "lipids",
      "cv-events",
      "inflammation"
    ]);
    expect(plan.taxonomy.autoAppliedClaimTemplateIds).toEqual(plan.claimTemplateIds);
    expect(plan.interventionDraft.commonForms).toEqual([
      "softgel",
      "capsule",
      "oil",
      "liquid"
    ]);
    expect(plan.interventionDraft.synonyms).toEqual(
      expect.arrayContaining(["Omega-3 EPA", "DHA", "Omega 3 EPA/DHA"])
    );
    expect(plan.guardrailWarnings).toEqual(
      expect.arrayContaining([
        "Category guardrail: Separate prescription, concentrated, food-derived, and generic supplement forms."
      ])
    );
    expect(plan.blockingReviewItems).not.toContain(
      "Add at least one specific non-lifespan use-case claim before public scoring."
    );
  });

  it("keeps explicit templates scoped while still showing taxonomy suggestions", () => {
    const plan = buildSupplementOnboardingPlan({
      category: "Botanical/herbal",
      claimTemplateIds: ["sleep"],
      commonForms: ["lozenge"],
      generatedAt: new Date("2026-06-12T10:00:00Z"),
      name: "Test botanical (standardized extract)"
    });

    expect(plan.claimTemplateIds).toEqual(["sleep"]);
    expect(plan.taxonomy.autoAppliedClaimTemplateIds).toEqual([]);
    expect(plan.taxonomy.suggestedClaimTemplateIds).toEqual([
      "safety",
      "lifespan",
      "mood-stress",
      "glucose",
      "inflammation"
    ]);
    expect(plan.interventionDraft.commonForms).toEqual([
      "extract",
      "capsule",
      "tea",
      "powder",
      "tincture",
      "lozenge"
    ]);
    expect(plan.interventionDraft.synonyms).toEqual(
      expect.arrayContaining(["standardized extract", "Test botanical"])
    );
  });

  it("keeps underspecified onboarding blocked for review", () => {
    const plan = buildSupplementOnboardingPlan({
      generatedAt: new Date("2026-06-12T10:00:00Z"),
      name: "Novel supplement"
    });

    expect(plan.claimDrafts.map((claim) => claim.id)).toEqual([
      "novel-supplement-safety",
      "novel-supplement-lifespan"
    ]);
    expect(plan.blockingReviewItems).toEqual(
      expect.arrayContaining([
        "Choose an intervention category before adding seed/public data.",
        "Add at least one specific non-lifespan use-case claim before public scoring."
      ])
    );
    expect(plan.handoffCommands).toContainEqual(
      expect.objectContaining({
        command:
          'npm run onboarding:seed-diff -- --name "Novel supplement" --category <reviewed-category> --summary',
        id: "seed-diff-review"
      })
    );
    expect(plan.handoffCommands).toContainEqual(
      expect.objectContaining({
        command:
          'npm run onboarding:import-assistant -- --name "Novel supplement" --category <reviewed-category> --summary',
        id: "import-assistant"
      })
    );
  });

  it("adds watchlist warnings for peptide-like onboarding", () => {
    const plan = buildSupplementOnboardingPlan({
      category: "Peptide/biologic",
      generatedAt: new Date("2026-06-12T10:00:00Z"),
      name: "Example peptide",
      synonyms: ["research chemical vial", "injectable cycle"]
    });

    expect(plan.guardrailWarnings.join(" ")).toContain("Watchlist language detected");
    expect(plan.guardrailWarnings.join(" ")).toContain(
      "No sourcing, procurement, compounding, reconstitution, injection, cycling, or self-administration guidance is generated."
    );
    expect(plan.safetyWatchlist.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "peptide-biologic",
          matchedTerms: expect.arrayContaining([
            "peptide",
            "research chemical",
            "peptide/biologic category"
          ]),
          severity: "blocked"
        }),
        expect.objectContaining({
          id: "sourcing-self-use",
          matchedTerms: expect.arrayContaining(["vial", "injectable", "cycle"]),
          severity: "blocked"
        })
      ])
    );
    expect(plan.safetyWatchlist.publicWordingBlocks).toContain(
      "Do not include sourcing, procurement, compounding, reconstitution, injection, cycling, or self-administration guidance."
    );
  });

  it("renders a local-only markdown review draft", () => {
    const plan = buildSupplementOnboardingPlan({
      category: "Botanical/herbal",
      generatedAt: new Date("2026-06-12T10:00:00Z"),
      name: "Test botanical",
      synonyms: ["test herb"]
    });
    const markdown = supplementOnboardingPlanToMarkdown(plan);

    expect(markdown).toContain("# Supplement Onboarding: Test botanical");
    expect(markdown).toContain("## Taxonomy Defaults");
    expect(markdown).toContain("Category guardrails:");
    expect(markdown).toContain("## Claim-Specific Source Query Plan");
    expect(markdown).toContain("## Post-Draft Handoff Commands");
    expect(markdown).toContain("Preview seed/data diff");
    expect(markdown).toContain("npm run onboarding:status");
    expect(markdown).toContain("Core evidence sweep / review-level via PubMed");
    expect(markdown).toContain("Outcome-specific evidence bundle");
    expect(markdown).toContain("Category-specific safety/context bundle");
    expect(markdown).toContain("Priority: 10");
    expect(markdown).toContain("## Safety And Watchlist Automation");
    expect(markdown).toContain("## AU/TGA Product-Status Assistant");
    expect(markdown).toContain("Ingredient-level evidence must not be used as a fallback");
    expect(markdown).toContain("review-level via PubMed");
    expect(markdown).toContain("npm run regulatory:review");
    expect(markdown).toContain("## Claim-Scoped Queue Commands After Seed");
    expect(markdown).toContain("## Seed Data Draft");
    expect(markdown).toContain("Source-candidate acceptance, claim linking");
  });

  it("renders a copy-ready conservative seed snippet", () => {
    const plan = buildSupplementOnboardingPlan({
      category: "Vitamin/mineral",
      claimTemplateIds: ["sleep"],
      generatedAt: new Date("2026-06-12T10:00:00Z"),
      name: "Magnesium glycinate"
    });
    const snippet = supplementOnboardingPlanToSeedSnippet(plan);

    expect(snippet).toContain("satisfies Intervention");
    expect(snippet).toContain("satisfies Claim[]");
    expect(snippet).toContain("satisfies AustraliaRegulatoryStatus");
    expect(snippet).toContain('reviewStatus: "Unreviewed AI draft"');
    expect(snippet).toContain('finalLabel: "Insufficient Evidence"');
  });

  it("builds a read-only batch plan without combining review or promotion steps", () => {
    const batch = buildSupplementOnboardingBatchPlan({
      generatedAt: new Date("2026-06-12T10:00:00Z"),
      supplements: [
        {
          category: "Vitamin/mineral",
          claimTemplateIds: ["sleep"],
          name: "Magnesium glycinate"
        },
        {
          category: "Peptide/biologic",
          name: "Example peptide",
          synonyms: ["research chemical vial"]
        },
        {
          category: "Fatty acid",
          claimTemplateIds: ["lipids"],
          name: "Omega-3 EPA",
          product: {
            brand: "Example Brand",
            name: "Omega-3 EPA Product"
          }
        }
      ]
    });

    expect(batch).toMatchObject({
      generatedAt: "2026-06-12T10:00:00.000Z",
      priorityQueue: [
        expect.objectContaining({
          action:
            "Review safety, watchlist, and regulatory guardrails before seed/data work.",
          safetySignals: {
            blocked: 2,
            warning: 0
          },
          slug: "example-peptide",
          tier: "safety-regulatory-review"
        }),
        expect.objectContaining({
          productStatusTargeted: true,
          slug: "omega-3-epa",
          tier: "product-status-review"
        }),
        expect.objectContaining({
          slug: "magnesium-glycinate",
          tier: "scope-review"
        })
      ],
      progress: {
        productStatusTargets: 1,
        supplements: 3,
        supplementsWithSafetySignals: 1
      },
      readOnly: true,
      safetySummary: {
        blockedSignalCount: 2,
        supplementsWithSignals: ["Example peptide"],
        warningSignalCount: 0
      }
    });
    expect(batch.plans.map((plan) => plan.interventionDraft.id)).toEqual([
      "magnesium-glycinate",
      "example-peptide",
      "omega-3-epa"
    ]);
    expect(batch.queueAfterSeedCommands).toEqual(
      expect.arrayContaining([
        'npm run ingest:sources -- --queue-claim-sources magnesium-glycinate-sleep --region "AU"',
        'npm run ingest:sources -- --queue-claim-sources example-peptide-safety --region "AU"',
        'npm run ingest:sources -- --queue-claim-sources example-peptide-lifespan --region "AU"'
      ])
    );
    expect(batch.batchReviewItems).toContain(
      "Keep candidate acceptance, extraction, claim-packet review, and promotion as separate explicit steps."
    );
    expect(batch.priorityQueue[0]?.queueCommands).toEqual(
      expect.arrayContaining([
        'npm run ingest:sources -- --queue-claim-sources example-peptide-safety --region "AU"'
      ])
    );
  });

  it("renders a batch runbook-style markdown packet", () => {
    const batch = buildSupplementOnboardingBatchPlan({
      generatedAt: new Date("2026-06-12T10:00:00Z"),
      supplements: [
        {
          category: "Vitamin/mineral",
          claimTemplateIds: ["sleep"],
          name: "Magnesium glycinate"
        }
      ]
    });
    const markdown = supplementOnboardingBatchPlanToMarkdown(batch);

    expect(markdown).toContain("# Supplement Onboarding Batch");
    expect(markdown).toContain("## Batch Progress");
    expect(markdown).toContain("- supplements: 1");
    expect(markdown).toContain("## Batch Priority Queue");
    expect(markdown).toContain("scope-review");
    expect(markdown).toContain("## Batch Review Items");
    expect(markdown).toContain("## Queue Commands After Reviewed Seed/Data Additions");
    expect(markdown).toContain("# Supplement Onboarding: Magnesium glycinate");
  });
});
