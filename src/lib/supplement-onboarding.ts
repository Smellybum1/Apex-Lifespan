import {
  buildSourceSearchQueries,
  type SourceSearchQueryPlanItem,
  type SourceSearchQueryPlanKind
} from "@/lib/source-queries";
import type { InterventionCategory, OutcomeArea } from "@/lib/types";

export const SUPPLEMENT_ONBOARDING_CATEGORIES: InterventionCategory[] = [
  "Vitamin/mineral",
  "Fatty acid",
  "Amino acid",
  "Botanical/herbal",
  "Fiber/prebiotic/probiotic",
  "Ergogenic/performance supplement",
  "Nootropic",
  "Hormonal/endocrine intervention",
  "Peptide/biologic",
  "Drug/geroprotector watchlist",
  "Food/beverage"
];

export const SUPPLEMENT_ONBOARDING_OUTCOMES: OutcomeArea[] = [
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

export const SUPPLEMENT_ONBOARDING_CLAIM_TEMPLATES = [
  {
    id: "safety",
    label: "Safety profile",
    outcome: "Safety/adverse effects",
    claimText: "General safety, tolerability, interaction, and product-quality profile."
  },
  {
    id: "lifespan",
    label: "Direct lifespan extension",
    outcome: "Mortality/lifespan",
    claimText: "Direct lifespan extension."
  },
  {
    id: "lipids",
    label: "LDL/ApoB/lipids",
    outcome: "LDL/ApoB/lipids",
    claimText: "LDL, ApoB, or lipid biomarker support."
  },
  {
    id: "sleep",
    label: "Sleep",
    outcome: "Sleep",
    claimText: "Sleep quality or sleep-continuity support."
  },
  {
    id: "strength",
    label: "Muscle/strength",
    outcome: "Muscle/strength",
    claimText: "Strength, power, lean-mass, or functional performance support."
  },
  {
    id: "cognition",
    label: "Cognition",
    outcome: "Cognition",
    claimText: "Cognitive performance, memory, or attention support."
  },
  {
    id: "glucose",
    label: "Glucose/insulin/HbA1c",
    outcome: "Glucose/insulin/HbA1c",
    claimText: "Glucose, insulin, or HbA1c biomarker support."
  },
  {
    id: "blood-pressure",
    label: "Blood pressure",
    outcome: "Blood pressure",
    claimText: "Blood pressure support."
  },
  {
    id: "inflammation",
    label: "Inflammation",
    outcome: "Inflammation",
    claimText: "Inflammatory biomarker support."
  },
  {
    id: "cv-events",
    label: "Cardiovascular events",
    outcome: "Cardiovascular events",
    claimText: "Cardiovascular event or vascular-risk context."
  },
  {
    id: "mood-stress",
    label: "Mood/stress",
    outcome: "Mood/stress",
    claimText: "Mood, stress, or perceived-resilience support."
  },
  {
    id: "endurance",
    label: "VO2 max/endurance",
    outcome: "VO2 max/endurance",
    claimText: "Endurance, aerobic performance, or fatigue-resistance support."
  },
  {
    id: "joint-skin",
    label: "Joint/tendon/skin",
    outcome: "Joint/tendon/skin",
    claimText: "Joint, tendon, connective-tissue, or skin-health support."
  },
  {
    id: "eye-health",
    label: "Eye health",
    outcome: "Eye health",
    claimText: "Eye-health or vision-related biomarker support."
  },
  {
    id: "immune",
    label: "Immune/respiratory",
    outcome: "Immune/respiratory",
    claimText: "Immune or respiratory-health support."
  },
  {
    id: "fertility-hormones",
    label: "Fertility/hormones",
    outcome: "Fertility/hormones",
    claimText: "Fertility, reproductive, or hormone-related biomarker support."
  },
  {
    id: "aging-clocks",
    label: "Biological aging clocks",
    outcome: "Biological aging clocks",
    claimText: "Biological-aging clock or related biomarker support."
  }
] as const satisfies Array<{
  claimText: string;
  id: string;
  label: string;
  outcome: OutcomeArea;
}>;

export type SupplementOnboardingClaimTemplateId =
  (typeof SUPPLEMENT_ONBOARDING_CLAIM_TEMPLATES)[number]["id"];

export interface SupplementOnboardingCategoryProfile {
  category: InterventionCategory;
  defaultCommonForms: string[];
  defaultClaimTemplateIds: SupplementOnboardingClaimTemplateId[];
  guardrails: string[];
  synonymHints: string[];
}

export const SUPPLEMENT_ONBOARDING_CATEGORY_PROFILES = [
  {
    category: "Vitamin/mineral",
    defaultCommonForms: ["capsule", "tablet", "powder", "liquid/drop"],
    defaultClaimTemplateIds: ["safety", "lifespan", "immune", "blood-pressure"],
    guardrails: [
      "Separate deficiency/low-status contexts from general-population claims.",
      "Keep upper-limit, toxicity, medication-interaction, and lab-context caveats visible."
    ],
    synonymHints: ["mineral", "vitamin", "low status", "deficiency"]
  },
  {
    category: "Fatty acid",
    defaultCommonForms: ["softgel", "capsule", "oil", "liquid"],
    defaultClaimTemplateIds: ["safety", "lifespan", "lipids", "cv-events", "inflammation"],
    guardrails: [
      "Separate prescription, concentrated, food-derived, and generic supplement forms.",
      "Keep atrial-fibrillation, bleeding-context, and product-form caveats visible where relevant."
    ],
    synonymHints: ["fatty acid", "oil", "EPA", "DHA"]
  },
  {
    category: "Amino acid",
    defaultCommonForms: ["powder", "capsule", "tablet"],
    defaultClaimTemplateIds: ["safety", "lifespan", "strength", "endurance"],
    guardrails: [
      "Separate sport-performance endpoints from disease or direct longevity claims.",
      "Keep renal, medication, training-status, and population-specific caveats visible where relevant."
    ],
    synonymHints: ["amino acid", "exercise", "performance"]
  },
  {
    category: "Botanical/herbal",
    defaultCommonForms: ["extract", "capsule", "tea", "powder", "tincture"],
    defaultClaimTemplateIds: ["safety", "lifespan", "mood-stress", "glucose", "inflammation"],
    guardrails: [
      "Separate standardized extracts from whole-herb or blended products.",
      "Require extra interaction, liver-risk, pregnancy, and product-quality review."
    ],
    synonymHints: ["extract", "herb", "botanical"]
  },
  {
    category: "Fiber/prebiotic/probiotic",
    defaultCommonForms: ["powder", "capsule", "food ingredient", "sachet"],
    defaultClaimTemplateIds: ["safety", "lifespan", "lipids", "glucose", "immune"],
    guardrails: [
      "Separate strain-, fiber-, dose-form-, and product-specific evidence.",
      "Keep GI tolerability and medication-timing caveats visible where relevant."
    ],
    synonymHints: ["fiber", "prebiotic", "probiotic", "gut"]
  },
  {
    category: "Ergogenic/performance supplement",
    defaultCommonForms: ["powder", "capsule", "drink mix", "bar"],
    defaultClaimTemplateIds: ["safety", "lifespan", "strength", "endurance"],
    guardrails: [
      "Separate performance endpoints from direct disease or lifespan claims.",
      "Check sport-prohibition, adulteration, stimulant, and label-claim risks."
    ],
    synonymHints: ["performance", "exercise", "training"]
  },
  {
    category: "Nootropic",
    defaultCommonForms: ["capsule", "tablet", "powder", "drink"],
    defaultClaimTemplateIds: ["safety", "lifespan", "cognition", "mood-stress", "sleep"],
    guardrails: [
      "Separate acute performance, long-term cognition, sleep, and mood/stress endpoints.",
      "Keep stimulant, sedative, psychiatric, and medication-interaction caveats visible."
    ],
    synonymHints: ["cognition", "memory", "attention"]
  },
  {
    category: "Hormonal/endocrine intervention",
    defaultCommonForms: ["capsule", "tablet", "topical", "liquid"],
    defaultClaimTemplateIds: ["safety", "lifespan", "fertility-hormones", "mood-stress"],
    guardrails: [
      "Treat hormone-related effects as clinician-context and lab-context sensitive.",
      "Avoid individualized dosing and keep fertility, pregnancy, endocrine, and medication caveats visible."
    ],
    synonymHints: ["hormone", "endocrine", "fertility"]
  },
  {
    category: "Peptide/biologic",
    defaultCommonForms: ["research-only record", "clinical record"],
    defaultClaimTemplateIds: ["safety", "lifespan", "joint-skin"],
    guardrails: [
      "Keep regulatory-concern framing and avoid self-use instructions.",
      "Do not include sourcing, compounding, reconstitution, injection, cycling, or procurement guidance."
    ],
    synonymHints: ["peptide", "biologic", "clinical trial"]
  },
  {
    category: "Drug/geroprotector watchlist",
    defaultCommonForms: ["clinical record", "tablet", "capsule"],
    defaultClaimTemplateIds: ["safety", "lifespan", "aging-clocks", "glucose", "inflammation"],
    guardrails: [
      "Keep prescription/clinician oversight, adverse-event, contraindication, and drug-interaction caveats visible.",
      "Separate mechanistic or animal longevity evidence from human health-span outcomes."
    ],
    synonymHints: ["geroprotector", "drug", "clinical trial"]
  },
  {
    category: "Food/beverage",
    defaultCommonForms: ["food", "beverage", "powder", "extract"],
    defaultClaimTemplateIds: ["safety", "lifespan", "glucose", "lipids", "blood-pressure"],
    guardrails: [
      "Separate food-matrix evidence from concentrated extract or supplement product evidence.",
      "Keep added sugar, caffeine, alcohol, allergen, and product-quality caveats visible where relevant."
    ],
    synonymHints: ["food", "beverage", "dietary"]
  }
] as const satisfies SupplementOnboardingCategoryProfile[];

export function getSupplementOnboardingCategoryProfile(
  category: InterventionCategory | undefined
) {
  return category
    ? SUPPLEMENT_ONBOARDING_CATEGORY_PROFILES.find(
        (profile) => profile.category === category
      )
    : undefined;
}

const OUTCOME_SLUGS: Record<OutcomeArea, string> = {
  "Mortality/lifespan": "lifespan",
  "Cardiovascular events": "cv-events",
  "LDL/ApoB/lipids": "ldl-lipids",
  "Blood pressure": "blood-pressure",
  "Glucose/insulin/HbA1c": "glucose",
  Inflammation: "inflammation",
  Cognition: "cognition",
  Sleep: "sleep",
  "Mood/stress": "mood-stress",
  "Muscle/strength": "strength",
  "VO2 max/endurance": "endurance",
  "Joint/tendon/skin": "joint-tendon-skin",
  "Eye health": "eye-health",
  "Immune/respiratory": "immune-respiratory",
  "Fertility/hormones": "fertility-hormones",
  "Biological aging clocks": "aging-clocks",
  "Safety/adverse effects": "safety"
};

const WATCHLIST_TERMS = [
  "peptide",
  "bpc",
  "research chemical",
  "injectable",
  "injection",
  "vial",
  "reconstitution",
  "compounding",
  "sourcing",
  "cycle"
];

const SAFETY_WATCHLIST_RULES = [
  {
    id: "peptide-biologic",
    label: "Peptide/biologic or research-chemical framing",
    terms: ["peptide", "bpc", "research chemical", "biologic"],
    requiredAction:
      "Keep regulatory-concern framing, require clinician/regulatory review, and do not add public self-use instructions.",
    severity: "blocked"
  },
  {
    id: "sourcing-self-use",
    label: "Sourcing, preparation, or self-administration language",
    terms: [
      "sourcing",
      "procurement",
      "vendor",
      "buy",
      "compounding",
      "reconstitution",
      "injectable",
      "injection",
      "vial",
      "cycle",
      "cycling"
    ],
    requiredAction:
      "Remove sourcing, procurement, compounding, reconstitution, injection, cycling, and self-administration guidance from public wording.",
    severity: "blocked"
  },
  {
    id: "interaction-context",
    label: "Interaction or higher-risk population context",
    terms: [
      "anticoagulant",
      "blood thinner",
      "warfarin",
      "ssri",
      "sedative",
      "pregnancy",
      "kidney",
      "liver",
      "immunosuppressant"
    ],
    requiredAction:
      "Require source-backed interaction and safety caveats before public wording; avoid individualized advice.",
    severity: "warning"
  },
  {
    id: "regulatory-concern",
    label: "Regulatory concern language",
    terms: ["unapproved", "prescription", "controlled", "banned", "not in artg"],
    requiredAction:
      "Keep AU/TGA/regulatory status explicit and product-level; do not infer clearance from ingredient evidence.",
    severity: "warning"
  }
] as const satisfies Array<{
  id: string;
  label: string;
  requiredAction: string;
  severity: "blocked" | "warning";
  terms: string[];
}>;

const SOURCE_CONVICTION_POLICY = [
  "Database-backed readiness scores candidate sources by source reputation, study design, traceability, abstract availability, recency, and relevance signals.",
  "Higher-conviction sources should be reviewed first and lower-conviction sources should carry visible limitations.",
  "The score explains positive factors and limitations; it does not auto-accept evidence or remove the explicit public promotion gate."
];

export interface SupplementOnboardingClaimInput {
  claimText: string;
  outcome: OutcomeArea;
}

export interface SupplementOnboardingInput {
  category?: InterventionCategory;
  claimTemplateIds?: SupplementOnboardingClaimTemplateId[];
  claims?: SupplementOnboardingClaimInput[];
  commonForms?: string[];
  generatedAt?: Date;
  name: string;
  product?: SupplementOnboardingProductInput;
  region?: string;
  synonyms?: string[];
}

export interface SupplementOnboardingProductInput {
  artgId?: string;
  austNumber?: string;
  brand?: string;
  name?: string;
  sourceUrl?: string;
  sponsor?: string;
}

export interface SupplementOnboardingClaimDraft {
  claimText: string;
  id: string;
  outcome: OutcomeArea;
  reviewStatus: "Unreviewed AI draft";
}

export interface SupplementOnboardingSafetyWatchlistSignal {
  explanation: string;
  id: string;
  label: string;
  matchedTerms: string[];
  requiredAction: string;
  severity: "blocked" | "warning";
}

export interface SupplementOnboardingSourceQuery {
  claimId: string;
  command: string;
  label: string;
  outcome: OutcomeArea;
  priority: SourceSearchQueryPlanItem["priority"];
  purpose: SourceSearchQueryPlanKind;
  rationale: string;
  source: SourceSearchQueryPlanItem["source"];
  sourceBundleId: SourceSearchQueryPlanItem["bundleId"];
  sourceBundleLabel: SourceSearchQueryPlanItem["bundleLabel"];
  term: string;
}

export interface SupplementOnboardingPlan {
  blockingReviewItems: string[];
  claimDrafts: SupplementOnboardingClaimDraft[];
  frictionAssessment: string[];
  generatedAt: string;
  guardrailWarnings: string[];
  claimTemplateIds: SupplementOnboardingClaimTemplateId[];
  handoffCommands: SupplementOnboardingHandoffCommand[];
  interventionDraft: {
    category?: InterventionCategory;
    commonForms: string[];
    evidenceSummary: string;
    id: string;
    interactionSummary: string;
    lastReviewed: string;
    name: string;
    regulatoryStatus: string;
    safetySummary: string;
    slug: string;
    synonyms: string[];
  };
  nextSteps: string[];
  productStatusAssistant: {
    commands: string[];
    confidenceRules: Array<{
      confidence: "High" | "Moderate" | "Low" | "Very low";
      rule: string;
    }>;
    evidenceChecklist: string[];
    gapAssessment: string[];
    searchTerms: string[];
    target: {
      artgId?: string;
      austNumber?: string;
      brand?: string;
      name: string;
      sourceUrl?: string;
      sponsor?: string;
    };
  };
  queueAfterSeedCommands: string[];
  region: string;
  regulatoryDraft: {
    evidenceRequirement: string;
    kind: "Unknown";
    notes: string;
    status: string;
    supplySummary: string;
  };
  safetyWatchlist: {
    publicWordingBlocks: string[];
    requiredPacketChecks: string[];
    signals: SupplementOnboardingSafetyWatchlistSignal[];
  };
  sourceQueries: SupplementOnboardingSourceQuery[];
  taxonomy: {
    autoAppliedClaimTemplateIds: SupplementOnboardingClaimTemplateId[];
    categoryGuardrails: string[];
    commonFormDefaults: string[];
    inferredSynonymHints: string[];
    suggestedClaimTemplateIds: SupplementOnboardingClaimTemplateId[];
    suggestedSynonymHints: string[];
  };
}

export interface SupplementOnboardingHandoffCommand {
  command: string;
  id: string;
  label: string;
  mode: "read-only" | "local-validation";
  purpose: string;
}

export interface SupplementOnboardingBatchPlan {
  batchReviewItems: string[];
  generatedAt: string;
  plans: SupplementOnboardingPlan[];
  priorityQueue: SupplementOnboardingBatchPriorityItem[];
  progress: {
    draftClaims: number;
    productStatusTargets: number;
    queueCommands: number;
    sourceQueries: number;
    supplements: number;
    supplementsWithBlockers: number;
    supplementsWithSafetySignals: number;
  };
  queueAfterSeedCommands: string[];
  readOnly: true;
  safetySummary: {
    blockedSignalCount: number;
    warningSignalCount: number;
    supplementsWithSignals: string[];
  };
}

export type SupplementOnboardingBatchPriorityTier =
  | "safety-regulatory-review"
  | "scope-review"
  | "product-status-review"
  | "ready-for-seed-review";

export interface SupplementOnboardingBatchPriorityItem {
  action: string;
  blockerCount: number;
  category?: InterventionCategory;
  claimDrafts: number;
  guardrailWarnings: number;
  id: string;
  name: string;
  priority: number;
  productStatusGaps: number;
  productStatusTargeted: boolean;
  queueCommands: string[];
  rationale: string[];
  safetySignals: {
    blocked: number;
    warning: number;
  };
  slug: string;
  tier: SupplementOnboardingBatchPriorityTier;
}

export function buildSupplementOnboardingPlan(
  input: SupplementOnboardingInput
): SupplementOnboardingPlan {
  const name = normalizeRequiredText(input.name, "name");
  const generatedAt = input.generatedAt ?? new Date();
  const slug = slugify(name);
  const interventionId = slug;
  const region = input.region?.trim() || "AU";
  const categoryProfile = getSupplementOnboardingCategoryProfile(input.category);
  const inferredSynonymHints = inferNameSynonymHints(name);
  const synonyms = uniqueNonEmpty([
    ...(input.synonyms ?? []),
    ...inferredSynonymHints
  ]);
  const commonForms = uniqueNonEmpty([
    ...(categoryProfile?.defaultCommonForms ?? []),
    ...(input.commonForms ?? [])
  ]);
  const explicitClaimTemplates = input.claimTemplateIds ?? [];
  const shouldAutoApplyCategoryTemplates =
    explicitClaimTemplates.length === 0 && (input.claims ?? []).length === 0;
  const autoAppliedClaimTemplateIds = shouldAutoApplyCategoryTemplates
    ? categoryProfile?.defaultClaimTemplateIds ?? []
    : [];
  const claimTemplateIds = uniqueClaimTemplateIds([
    ...autoAppliedClaimTemplateIds,
    ...explicitClaimTemplates
  ]);
  const claimInputs = [
    ...claimsFromTemplates(claimTemplateIds),
    ...(input.claims ?? [])
  ];
  const claimDrafts = buildClaimDrafts(interventionId, claimInputs);
  const safetyWatchlist = buildSafetyWatchlist({
    category: input.category,
    claimDrafts,
    commonForms,
    name,
    synonyms
  });
  const guardrailWarnings = uniqueNonEmpty([
    ...guardrailWarningsFor({
      category: input.category,
      name,
      safetyWatchlist,
      synonyms
    }),
    ...(categoryProfile?.guardrails.map(
      (guardrail) => `Category guardrail: ${guardrail}`
    ) ?? [])
  ]);

  return {
    blockingReviewItems: blockingReviewItemsFor(input, claimInputs),
    claimDrafts,
    claimTemplateIds,
    frictionAssessment: [
      "Current manual path requires coordinated intervention, claim, reference, study, regulatory, seed, source-candidate, and review updates.",
      "This planner reduces the first pass to a seed-ready draft plus source-review commands, and database-backed readiness adds automated source-conviction scoring.",
      "After seed data exists, source discovery can be queued per draft claim; accepted evidence still needs reference matching, extraction, explicit review, and public promotion approval."
    ],
    generatedAt: generatedAt.toISOString(),
    guardrailWarnings,
    handoffCommands: buildSupplementOnboardingHandoffCommands({
      category: input.category,
      name,
      region,
      slug
    }),
    interventionDraft: {
      category: input.category,
      commonForms,
      evidenceSummary:
        "New supplement onboarding draft. Evidence summary must remain provisional until source packets are reviewed.",
      id: interventionId,
      interactionSummary:
        "Interaction profile not reviewed yet; require source-backed review before public claims.",
      lastReviewed: isoDate(generatedAt),
      name,
      regulatoryStatus:
        "AU/TGA product-level status not reviewed. Do not infer AUST/ARTG status from ingredient evidence.",
      safetySummary:
        "Safety profile not reviewed yet; require safety, adverse-event, interaction, and product-quality source review.",
      slug,
      synonyms
    },
    nextSteps: [
      "Review the generated category, synonyms, forms, and claim scopes.",
      "Add the reviewed intervention and draft claims to seed data or the operator-only database workflow.",
      "Run seed/database validation before any source-candidate queueing.",
      "Queue claim-scoped source searches from the generated commands.",
      "Use the AU/TGA product-status assistant to capture exact product identity before adding product-level regulatory confidence.",
      "Use source-conviction explanations to prioritize candidates, then explicitly accept/reject candidates, link references, and extract study metadata.",
      "Mark claim packets human-reviewed only after citation traceability and uncertainty labels are checked."
    ],
    productStatusAssistant: buildProductStatusAssistant({
      interventionName: name,
      product: input.product
    }),
    queueAfterSeedCommands: claimDrafts.map(
      (claim) =>
        `npm run ingest:sources -- --queue-claim-sources ${claim.id} --region ${shellQuote(region)}`
    ),
    region,
    regulatoryDraft: {
      evidenceRequirement:
        "Review product-level ARTG/AUST evidence before claiming Australian market authorisation or assessed efficacy.",
      kind: "Unknown",
      notes:
        "Ingredient-level evidence is not product-level AU/TGA evidence. Keep product status unknown until reviewed.",
      status: "AU/TGA product-level status unverified",
      supplySummary:
        "No reviewed product-level ARTG/AUST record is attached in this onboarding draft."
    },
    safetyWatchlist,
    sourceQueries: buildSourceQueries({
      category: input.category,
      claimDrafts,
      interventionId,
      name,
      region,
      synonyms
    }),
    taxonomy: {
      autoAppliedClaimTemplateIds,
      categoryGuardrails: categoryProfile?.guardrails ?? [],
      commonFormDefaults: categoryProfile?.defaultCommonForms ?? [],
      inferredSynonymHints,
      suggestedClaimTemplateIds: categoryProfile?.defaultClaimTemplateIds ?? [],
      suggestedSynonymHints: categoryProfile?.synonymHints ?? []
    }
  };
}

export function buildSupplementOnboardingBatchPlan({
  generatedAt = new Date(),
  supplements
}: {
  generatedAt?: Date;
  supplements: SupplementOnboardingInput[];
}): SupplementOnboardingBatchPlan {
  if (supplements.length === 0) {
    throw new Error("Supplement onboarding batch requires at least one supplement.");
  }

  const plans = supplements.map((supplement) =>
    buildSupplementOnboardingPlan({
      ...supplement,
      generatedAt: supplement.generatedAt ?? generatedAt
    })
  );
  const allSignals = plans.flatMap((plan) =>
    plan.safetyWatchlist.signals.map((signal) => ({
      signal,
      supplementName: plan.interventionDraft.name
    }))
  );

  return {
    batchReviewItems: [
      "Review each generated supplement packet before copying seed snippets.",
      "Run seed/database validation after reviewed seed additions.",
      "Queue source discovery per claim only after reviewed intervention and claim records exist.",
      "Keep candidate acceptance, extraction, claim-packet review, and promotion as separate explicit steps."
    ],
    generatedAt: generatedAt.toISOString(),
    plans,
    priorityQueue: buildBatchPriorityQueue(plans),
    progress: {
      draftClaims: plans.reduce((total, plan) => total + plan.claimDrafts.length, 0),
      productStatusTargets: plans.filter((plan) =>
        Boolean(
          plan.productStatusAssistant.target.austNumber ||
            plan.productStatusAssistant.target.artgId ||
            plan.productStatusAssistant.target.brand ||
            plan.productStatusAssistant.target.sourceUrl ||
            plan.productStatusAssistant.target.sponsor
        )
      ).length,
      queueCommands: plans.reduce(
        (total, plan) => total + plan.queueAfterSeedCommands.length,
        0
      ),
      sourceQueries: plans.reduce((total, plan) => total + plan.sourceQueries.length, 0),
      supplements: plans.length,
      supplementsWithBlockers: plans.filter(
        (plan) => plan.blockingReviewItems.length > 0
      ).length,
      supplementsWithSafetySignals: Array.from(
        new Set(allSignals.map((item) => item.supplementName))
      ).length
    },
    queueAfterSeedCommands: plans.flatMap((plan) => plan.queueAfterSeedCommands),
    readOnly: true,
    safetySummary: {
      blockedSignalCount: allSignals.filter(
        (item) => item.signal.severity === "blocked"
      ).length,
      supplementsWithSignals: Array.from(
        new Set(allSignals.map((item) => item.supplementName))
      ).sort((left, right) => left.localeCompare(right)),
      warningSignalCount: allSignals.filter(
        (item) => item.signal.severity === "warning"
      ).length
    }
  };
}

function buildSupplementOnboardingHandoffCommands({
  category,
  name,
  region,
  slug
}: {
  category?: InterventionCategory;
  name: string;
  region: string;
  slug: string;
}): SupplementOnboardingHandoffCommand[] {
  const categoryArg = category ? shellQuote(category) : "<reviewed-category>";

  return [
    {
      command: `npm run onboarding:seed-diff -- --name ${shellQuote(name)} --category ${categoryArg} --summary`,
      id: "seed-diff-review",
      label: "Preview seed/data diff",
      mode: "read-only",
      purpose:
        "Review proposed intervention, claim, and AU/TGA seed snippets before editing seed or database records."
    },
    {
      command: `npm run onboarding:import-assistant -- --name ${shellQuote(name)} --category ${categoryArg} --summary`,
      id: "import-assistant",
      label: "Preview import assistant",
      mode: "read-only",
      purpose:
        "Preview manual seed-copy status, future-gated database import shape, and public-promotion prerequisites without writes."
    },
    {
      command: `npm run onboarding:readiness -- --supplement ${shellQuote(slug)} --summary`,
      id: "supplement-readiness",
      label: "Check supplement readiness",
      mode: "read-only",
      purpose:
        "Check whether reviewed intervention, claim scopes, source jobs, candidates, packets, and review gates exist."
    },
    {
      command: `npm run onboarding:queue-sources -- --supplement ${shellQuote(slug)} --region ${shellQuote(region)}`,
      id: "source-queue-preview",
      label: "Preview source queueing",
      mode: "read-only",
      purpose:
        "Print claim-scoped source queue commands after reviewed records exist; this omits --apply."
    },
    {
      command: `npm run onboarding:status -- --supplement ${shellQuote(slug)} --summary`,
      id: "onboarding-status",
      label: "Refresh onboarding status",
      mode: "read-only",
      purpose:
        "Combine quality, readiness, next action, full-text source gate, and workflow state for this supplement."
    },
    {
      command: "npm run regulatory:review",
      id: "product-status-review",
      label: "Review AU/TGA product status",
      mode: "read-only",
      purpose:
        "Keep product-level AU/TGA evidence separate from intervention-level evidence."
    },
    {
      command: "npm run onboarding:fulltext-sources -- --next --summary",
      id: "fulltext-source-next",
      label: "Check full-text source next step",
      mode: "read-only",
      purpose:
        "Route source-inventory template, worksheet, progress, hold, or connector-review planning without live fetch."
    },
    {
      command: "npm run db:validate",
      id: "db-validate",
      label: "Validate Prisma schema",
      mode: "local-validation",
      purpose:
        "Run after reviewed seed/database edits and before any source-candidate queueing."
    },
    {
      command: "npm run typecheck",
      id: "typecheck",
      label: "Run typecheck",
      mode: "local-validation",
      purpose:
        "Catch seed, command, and dashboard type regressions before broader tests."
    }
  ];
}

function buildBatchPriorityQueue(
  plans: SupplementOnboardingPlan[]
): SupplementOnboardingBatchPriorityItem[] {
  return plans
    .map(batchPriorityItemForPlan)
    .sort(
      (left, right) =>
        left.priority - right.priority ||
        right.safetySignals.blocked - left.safetySignals.blocked ||
        right.blockerCount - left.blockerCount ||
        left.name.localeCompare(right.name)
    );
}

function batchPriorityItemForPlan(
  plan: SupplementOnboardingPlan
): SupplementOnboardingBatchPriorityItem {
  const blockedSafetySignals = plan.safetyWatchlist.signals.filter(
    (signal) => signal.severity === "blocked"
  ).length;
  const warningSafetySignals = plan.safetyWatchlist.signals.filter(
    (signal) => signal.severity === "warning"
  ).length;
  const productStatusTargeted = Boolean(
    plan.productStatusAssistant.target.austNumber ||
      plan.productStatusAssistant.target.artgId ||
      plan.productStatusAssistant.target.brand ||
      plan.productStatusAssistant.target.sourceUrl ||
      plan.productStatusAssistant.target.sponsor
  );
  const productStatusGaps = plan.productStatusAssistant.gapAssessment.length;
  const tier = batchPriorityTier({
    blockedSafetySignals,
    blockerCount: plan.blockingReviewItems.length,
    productStatusGaps,
    productStatusTargeted,
    warningSafetySignals
  });

  return {
    action: batchPriorityAction(tier),
    blockerCount: plan.blockingReviewItems.length,
    category: plan.interventionDraft.category,
    claimDrafts: plan.claimDrafts.length,
    guardrailWarnings: plan.guardrailWarnings.length,
    id: plan.interventionDraft.id,
    name: plan.interventionDraft.name,
    priority: batchPriorityValue(tier),
    productStatusGaps,
    productStatusTargeted,
    queueCommands: plan.queueAfterSeedCommands,
    rationale: batchPriorityRationale({
      blockedSafetySignals,
      blockerCount: plan.blockingReviewItems.length,
      productStatusGaps,
      productStatusTargeted,
      queueCommands: plan.queueAfterSeedCommands.length,
      warningSafetySignals
    }),
    safetySignals: {
      blocked: blockedSafetySignals,
      warning: warningSafetySignals
    },
    slug: plan.interventionDraft.slug,
    tier
  };
}

function batchPriorityTier({
  blockedSafetySignals,
  blockerCount,
  productStatusGaps,
  productStatusTargeted,
  warningSafetySignals
}: {
  blockedSafetySignals: number;
  blockerCount: number;
  productStatusGaps: number;
  productStatusTargeted: boolean;
  warningSafetySignals: number;
}): SupplementOnboardingBatchPriorityTier {
  if (blockedSafetySignals > 0 || warningSafetySignals > 0) {
    return "safety-regulatory-review";
  }

  if (productStatusTargeted && productStatusGaps > 0) {
    return "product-status-review";
  }

  if (blockerCount > 0) {
    return "scope-review";
  }

  return "ready-for-seed-review";
}

function batchPriorityValue(tier: SupplementOnboardingBatchPriorityTier) {
  if (tier === "safety-regulatory-review") {
    return 10;
  }

  if (tier === "product-status-review") {
    return 20;
  }

  if (tier === "scope-review") {
    return 30;
  }

  return 40;
}

function batchPriorityAction(tier: SupplementOnboardingBatchPriorityTier) {
  if (tier === "safety-regulatory-review") {
    return "Review safety, watchlist, and regulatory guardrails before seed/data work.";
  }

  if (tier === "scope-review") {
    return "Resolve claim-scope and category blockers before source queueing.";
  }

  if (tier === "product-status-review") {
    return "Complete exact product-status review before adding product-sensitive records.";
  }

  return "Review the draft packet, then add reviewed seed/database records before queueing sources.";
}

function batchPriorityRationale({
  blockedSafetySignals,
  blockerCount,
  productStatusGaps,
  productStatusTargeted,
  queueCommands,
  warningSafetySignals
}: {
  blockedSafetySignals: number;
  blockerCount: number;
  productStatusGaps: number;
  productStatusTargeted: boolean;
  queueCommands: number;
  warningSafetySignals: number;
}) {
  return [
    blockedSafetySignals > 0
      ? `${blockedSafetySignals} blocked safety/watchlist signal(s) require review.`
      : undefined,
    warningSafetySignals > 0
      ? `${warningSafetySignals} safety/watchlist warning signal(s) require caveat review.`
      : undefined,
    blockerCount > 0 ? `${blockerCount} onboarding blocker(s) remain.` : undefined,
    productStatusTargeted && productStatusGaps > 0
      ? `${productStatusGaps} exact product-status gap(s) remain.`
      : undefined,
    `${queueCommands} source queue command(s) are available after reviewed seed/data records exist.`
  ].filter((item): item is string => Boolean(item));
}

export function supplementOnboardingPlanToMarkdown(
  plan: SupplementOnboardingPlan
): string {
  const category = plan.interventionDraft.category ?? "Needs review";
  const lines = [
    `# Supplement Onboarding: ${plan.interventionDraft.name}`,
    "",
    `Generated: ${plan.generatedAt}`,
    `Region: ${plan.region}`,
    "",
    "## Intervention Draft",
    "",
    `- id: \`${plan.interventionDraft.id}\``,
    `- slug: \`${plan.interventionDraft.slug}\``,
    `- category: ${category}`,
    `- synonyms: ${formatList(plan.interventionDraft.synonyms)}`,
    `- forms: ${formatList(plan.interventionDraft.commonForms)}`,
    `- claim templates: ${formatList(plan.claimTemplateIds)}`,
    "",
    "## Taxonomy Defaults",
    "",
    `- auto-applied templates: ${formatList(plan.taxonomy.autoAppliedClaimTemplateIds)}`,
    `- suggested templates: ${formatList(plan.taxonomy.suggestedClaimTemplateIds)}`,
    `- default forms: ${formatList(plan.taxonomy.commonFormDefaults)}`,
    `- inferred synonym hints: ${formatList(plan.taxonomy.inferredSynonymHints)}`,
    `- category synonym hints: ${formatList(plan.taxonomy.suggestedSynonymHints)}`,
    "Category guardrails:",
    ...markdownBullets(plan.taxonomy.categoryGuardrails),
    "",
    "## Blocking Review Items",
    "",
    ...markdownBullets(plan.blockingReviewItems),
    "",
    "## Guardrail Warnings",
    "",
    ...markdownBullets(plan.guardrailWarnings),
    "",
    "## Safety And Watchlist Automation",
    "",
    "Signals:",
    ...(
      plan.safetyWatchlist.signals.length > 0
        ? plan.safetyWatchlist.signals.map(
            (signal) =>
              `- ${signal.severity}: ${signal.label} (${signal.matchedTerms.join(", ")}) - ${signal.requiredAction}`
          )
        : ["- none: No watchlist terms detected in the onboarding draft."]
    ),
    "",
    "Required packet checks:",
    ...markdownBullets(plan.safetyWatchlist.requiredPacketChecks),
    "",
    "Public wording blocks:",
    ...markdownBullets(plan.safetyWatchlist.publicWordingBlocks),
    "",
    "## Draft Claims",
    "",
    ...plan.claimDrafts.flatMap((claim) => [
      `- \`${claim.id}\``,
      `  Outcome: ${claim.outcome}`,
      `  Claim: ${claim.claimText}`,
      `  Review: ${claim.reviewStatus}`
    ]),
    "",
    "## AU/TGA Regulatory Draft",
    "",
    `- kind: ${plan.regulatoryDraft.kind}`,
    `- status: ${plan.regulatoryDraft.status}`,
    `- supply: ${plan.regulatoryDraft.supplySummary}`,
    `- evidence: ${plan.regulatoryDraft.evidenceRequirement}`,
    "",
    "## AU/TGA Product-Status Assistant",
    "",
    `- target product: ${plan.productStatusAssistant.target.name}`,
    `- brand: ${plan.productStatusAssistant.target.brand ?? "Needs exact product brand"}`,
    `- AUST number: ${plan.productStatusAssistant.target.austNumber ?? "Not captured"}`,
    `- ARTG id: ${plan.productStatusAssistant.target.artgId ?? "Not captured"}`,
    `- sponsor: ${plan.productStatusAssistant.target.sponsor ?? "Not captured"}`,
    `- source URL: ${plan.productStatusAssistant.target.sourceUrl ?? "Not captured"}`,
    "",
    "Evidence checklist:",
    ...markdownBullets(plan.productStatusAssistant.evidenceChecklist),
    "",
    "Confidence rules:",
    ...plan.productStatusAssistant.confidenceRules.map(
      (rule) => `- ${rule.confidence}: ${rule.rule}`
    ),
    "",
    "Current gaps:",
    ...markdownBullets(plan.productStatusAssistant.gapAssessment),
    "",
    "Search terms:",
    ...plan.productStatusAssistant.searchTerms.map((term) => `- \`${term}\``),
    "",
    "Commands:",
    ...plan.productStatusAssistant.commands.map((command) => `- \`${command}\``),
    "",
    "## Claim-Specific Source Query Plan",
    "",
    ...plan.sourceQueries.flatMap((query) => [
      `- \`${query.claimId}\` ${query.sourceBundleLabel} / ${query.purpose} via ${query.source}: \`${query.command}\``,
      `  Priority: ${query.priority}`,
      `  Term: ${query.term}`,
      `  Rationale: ${query.rationale}`
    ]),
    "",
    "## Post-Draft Handoff Commands",
    "",
    ...plan.handoffCommands.map(
      (item) => `- ${item.label} (${item.mode}): \`${item.command}\` - ${item.purpose}`
    ),
    "",
    "## Claim-Scoped Queue Commands After Seed",
    "",
    ...plan.queueAfterSeedCommands.map((command) => `- \`${command}\``),
    "",
    "## Automated Source Conviction",
    "",
    ...markdownBullets(SOURCE_CONVICTION_POLICY),
    "",
    "## Seed Data Draft",
    "",
    "```ts",
    supplementOnboardingPlanToSeedSnippet(plan).trimEnd(),
    "```",
    "",
    "## Next Steps",
    "",
    ...markdownBullets(plan.nextSteps),
    ""
  ];

  return `${lines.join("\n")}\n`;
}

export function supplementOnboardingBatchPlanToMarkdown(
  batch: SupplementOnboardingBatchPlan
): string {
  const lines = [
    "# Supplement Onboarding Batch",
    "",
    `Generated: ${batch.generatedAt}`,
    `Read-only: ${batch.readOnly}`,
    `Supplements: ${batch.plans.length}`,
    "",
    "## Batch Progress",
    "",
    `- supplements: ${batch.progress.supplements}`,
    `- draft claims: ${batch.progress.draftClaims}`,
    `- source queries: ${batch.progress.sourceQueries}`,
    `- queue commands: ${batch.progress.queueCommands}`,
    `- supplements with blockers: ${batch.progress.supplementsWithBlockers}`,
    `- supplements with safety signals: ${batch.progress.supplementsWithSafetySignals}`,
    `- product-status targets: ${batch.progress.productStatusTargets}`,
    "",
    "## Batch Priority Queue",
    "",
    ...batch.priorityQueue.flatMap((item, index) => [
      `${index + 1}. \`${item.slug}\` - ${item.tier}`,
      `   Action: ${item.action}`,
      `   Counts: ${item.claimDrafts} claim drafts, ${item.blockerCount} blockers, ${item.safetySignals.blocked} blocked safety signals, ${item.safetySignals.warning} safety warnings, ${item.queueCommands.length} queue commands.`,
      `   Rationale: ${item.rationale.join(" ")}`
    ]),
    "",
    "## Batch Review Items",
    "",
    ...markdownBullets(batch.batchReviewItems),
    "",
    "## Safety Summary",
    "",
    `- blocked signals: ${batch.safetySummary.blockedSignalCount}`,
    `- warning signals: ${batch.safetySummary.warningSignalCount}`,
    `- supplements with signals: ${formatList(batch.safetySummary.supplementsWithSignals)}`,
    "",
    "## Queue Commands After Reviewed Seed/Data Additions",
    "",
    ...batch.queueAfterSeedCommands.map((command) => `- \`${command}\``),
    "",
    ...batch.plans.flatMap((plan) => [
      "---",
      "",
      supplementOnboardingPlanToMarkdown(plan).trimEnd(),
      ""
    ])
  ];

  return `${lines.join("\n")}\n`;
}

export function supplementOnboardingPlanToSeedSnippet(
  plan: SupplementOnboardingPlan
): string {
  const date = plan.generatedAt.slice(0, 10);
  const category =
    plan.interventionDraft.category ?? "Vitamin/mineral";
  const categoryComment = plan.interventionDraft.category
    ? ""
    : " // TODO: replace with the reviewed category before adding to seed data";
  const intervention = plan.interventionDraft;
  const claims = plan.claimDrafts.map((claim) =>
    seedClaimSnippet({
      claim,
      date,
      interventionId: intervention.id,
      interventionName: intervention.name
    })
  );

  return [
    "// Review before adding to src/lib/seed-data.ts.",
    "// This draft is intentionally conservative and is not a human-reviewed evidence packet.",
    "const interventionDraft = {",
    `  id: ${tsString(intervention.id)},`,
    `  name: ${tsString(intervention.name)},`,
    `  slug: ${tsString(intervention.slug)},`,
    `  synonyms: ${tsArray(intervention.synonyms)},`,
    `  category: ${tsString(category)},${categoryComment}`,
    `  commonForms: ${tsArray(intervention.commonForms)},`,
    `  regulatoryStatus: ${tsString(intervention.regulatoryStatus)},`,
    `  safetySummary: ${tsString(intervention.safetySummary)},`,
    `  interactionSummary: ${tsString(intervention.interactionSummary)},`,
    `  evidenceSummary: ${tsString(intervention.evidenceSummary)},`,
    `  lastReviewed: ${tsString(intervention.lastReviewed)}`,
    "} satisfies Intervention;",
    "",
    "const claimDrafts = [",
    ...claims.flatMap((claim) => claim.split("\n").map((line) => `  ${line}`)),
    "] satisfies Claim[];",
    "",
    "const australiaRegulatoryStatusDraft = {",
    `  id: ${tsString(`${intervention.id}-au-status`)},`,
    `  interventionId: ${tsString(intervention.id)},`,
    '  region: "AU",',
    '  kind: "Unknown",',
    `  status: ${tsString(plan.regulatoryDraft.status)},`,
    "  efficacyAssessed: false,",
    "  preMarketAssessment: false,",
    `  supplySummary: ${tsString(plan.regulatoryDraft.supplySummary)},`,
    `  evidenceRequirement: ${tsString(plan.regulatoryDraft.evidenceRequirement)},`,
    '  sourceUrl: "https://www.tga.gov.au/products/regulations-all-products/about-australian-register-therapeutic-goods-artg",',
    `  checkedAt: ${tsString(date)},`,
    `  notes: ${tsString(plan.regulatoryDraft.notes)}`,
    "} satisfies AustraliaRegulatoryStatus;",
    ""
  ].join("\n");
}

function buildClaimDrafts(
  interventionId: string,
  claims: SupplementOnboardingClaimInput[]
): SupplementOnboardingClaimDraft[] {
  const inputs =
    claims.length > 0
      ? claims
      : [
          {
            outcome: "Safety/adverse effects" as const,
            claimText: "General safety, tolerability, interaction, and product-quality profile."
          },
          {
            outcome: "Mortality/lifespan" as const,
            claimText: "Direct lifespan extension."
          }
        ];
  const usedIds = new Set<string>();

  return inputs.map((claim) => {
    const baseId = `${interventionId}-${OUTCOME_SLUGS[claim.outcome]}`;
    const id = uniqueId(baseId, usedIds);

    return {
      claimText: normalizeRequiredText(claim.claimText, "claim text"),
      id,
      outcome: claim.outcome,
      reviewStatus: "Unreviewed AI draft"
    };
  });
}

function claimsFromTemplates(
  templateIds: SupplementOnboardingClaimTemplateId[]
): SupplementOnboardingClaimInput[] {
  return templateIds.map((templateId) => {
    const template = SUPPLEMENT_ONBOARDING_CLAIM_TEMPLATES.find(
      (candidate) => candidate.id === templateId
    );

    if (!template) {
      throw new Error(`Unknown supplement onboarding claim template: ${templateId}.`);
    }

    return {
      claimText: template.claimText,
      outcome: template.outcome
    };
  });
}

function uniqueClaimTemplateIds(
  templateIds: SupplementOnboardingClaimTemplateId[]
) {
  return Array.from(new Set(templateIds));
}

function seedClaimSnippet({
  claim,
  date,
  interventionId,
  interventionName
}: {
  claim: SupplementOnboardingClaimDraft;
  date: string;
  interventionId: string;
  interventionName: string;
}) {
  return [
    "{",
    `  id: ${tsString(claim.id)},`,
    `  interventionId: ${tsString(interventionId)},`,
    `  outcome: ${tsString(claim.outcome)},`,
    `  claimText: ${tsString(claim.claimText)},`,
    `  populationStudied: "Not reviewed yet.",`,
    `  doseFormStudied: "Not reviewed yet; do not add dosing guidance without source review.",`,
    `  durationStudied: "Not reviewed yet.",`,
    `  comparator: "Not reviewed yet.",`,
    `  evidenceGrade: "Insufficient until source packets are reviewed.",`,
    `  effectSize: "Unknown until source review.",`,
    `  clinicalRelevance: "Not established until source review.",`,
    `  confidenceLevel: "Very low",`,
    `  safetyNotes: ${tsString(`${interventionName} safety and interactions are not reviewed yet.`)},`,
    `  applicabilityNotes: "Draft onboarding claim. Do not treat as public evidence until reviewed.",`,
    "  keyReferenceIds: [],",
    "  scores: {",
    "    evidenceDirectness: 1,",
    "    evidenceRigor: 1,",
    "    effectSize: 1,",
    "    safety: 3,",
    "    regulatoryRisk: 5,",
    "    productQuality: 1,",
    "    hypePenalty: 5,",
    "    measurability: 3",
    "  },",
    `  finalLabel: "Insufficient Evidence",`,
    `  momentum: "Stable",`,
    `  reviewStatus: ${tsString(claim.reviewStatus)},`,
    `  lastUpdated: ${tsString(date)},`,
    `  whatWouldChangeScore: "Reviewed human evidence with citation traceability, structured extraction, safety context, and AU/TGA product-level review where relevant."`,
    "},"
  ].join("\n");
}

function buildSourceQueries({
  category,
  claimDrafts,
  interventionId,
  name,
  region,
  synonyms
}: {
  category?: InterventionCategory;
  claimDrafts: SupplementOnboardingClaimDraft[];
  interventionId: string;
  name: string;
  region: string;
  synonyms: string[];
}): SupplementOnboardingSourceQuery[] {
  return claimDrafts.flatMap((claim) => {
    const queries = buildSourceSearchQueries({
      claim: {
        claimText: claim.claimText,
        outcome: claim.outcome
      },
      intervention: {
        category,
        name,
        synonyms
      }
    });

    return queries.plans.map((planItem) =>
      sourceQuery({
        claim,
        interventionId,
        label: queries.label,
        planItem,
        region
      })
    );
  });
}

function sourceQuery({
  claim,
  interventionId,
  label,
  planItem,
  region
}: {
  claim: SupplementOnboardingClaimDraft;
  interventionId: string;
  label: string;
  planItem: SourceSearchQueryPlanItem;
  region: string;
}): SupplementOnboardingSourceQuery {
  if (planItem.source === "AU/TGA review") {
    return {
      claimId: claim.id,
      command: "npm run regulatory:review",
      label,
      outcome: claim.outcome,
      priority: planItem.priority,
      purpose: planItem.kind,
      rationale: planItem.rationale,
      source: planItem.source,
      sourceBundleId: planItem.bundleId,
      sourceBundleLabel: planItem.bundleLabel,
      term: planItem.term
    };
  }

  const queueFlag =
    planItem.source === "PubMed" ? "--queue-pubmed" : "--queue-clinical-trials";

  return {
    claimId: claim.id,
    command: `npm run ingest:sources -- ${queueFlag} ${shellQuote(planItem.term)} --region ${shellQuote(region)} --intervention-id ${shellQuote(interventionId)} --claim-id ${shellQuote(claim.id)}`,
    label,
    outcome: claim.outcome,
    priority: planItem.priority,
    purpose: planItem.kind,
    rationale: planItem.rationale,
    source: planItem.source,
    sourceBundleId: planItem.bundleId,
    sourceBundleLabel: planItem.bundleLabel,
    term: planItem.term
  };
}

function buildProductStatusAssistant({
  interventionName,
  product
}: {
  interventionName: string;
  product?: SupplementOnboardingProductInput;
}): SupplementOnboardingPlan["productStatusAssistant"] {
  const targetName =
    product?.name?.trim() || `${interventionName} product requiring AU/TGA verification`;
  const brand = normaliseOptionalText(product?.brand);
  const austNumber = normaliseOptionalText(product?.austNumber);
  const artgId = normaliseOptionalText(product?.artgId);
  const sponsor = normaliseOptionalText(product?.sponsor);
  const sourceUrl = normaliseOptionalText(product?.sourceUrl);
  const targetLabel = [brand, targetName].filter(Boolean).join(" ");
  const searchSubject = targetLabel || interventionName;

  return {
    commands: [
      "npm run regulatory:review",
      "Record any accepted product-level status only after exact product, AUST/ARTG identifier, sponsor/formulation, source URL, and checked date are reviewed."
    ],
    confidenceRules: [
      {
        confidence: "High",
        rule:
          "Fresh product-level AUST R or AUST L(A) evidence with exact AUST/ARTG identifier, sponsor, formulation, source URL, and checked date."
      },
      {
        confidence: "Moderate",
        rule:
          "Fresh product-level AUST L evidence with exact AUST/ARTG identifier and matching product identity; listed status does not mean efficacy was assessed."
      },
      {
        confidence: "Low",
        rule:
          "Exact product-level not-in-ARTG, exempt, excluded, or unapproved evidence is captured, but identity or status implications need careful wording."
      },
      {
        confidence: "Very low",
        rule:
          "Only ingredient-level evidence, generic search results, missing identifiers, stale review, or unmatched product identity is available."
      }
    ],
    evidenceChecklist: [
      "Exact product name and brand as shown on the label or ARTG result.",
      "AUST number or ARTG identifier if present; absence must be documented from a product-level search, not assumed.",
      "Sponsor, formulation, active ingredients, and permitted indications or label claims.",
      "TGA/ARTG source URL, product label/source snapshot, and checked date.",
      "TGA safety alerts or regulatory concern signals relevant to the exact product or ingredient.",
      "A note separating product-level market status from ingredient-level efficacy evidence."
    ],
    gapAssessment: productStatusGaps({
      artgId,
      austNumber,
      brand,
      sourceUrl,
      sponsor,
      targetName
    }),
    searchTerms: [
      `${searchSubject} AUST ARTG`,
      `${searchSubject} TGA ARTG`,
      `${searchSubject} TGA safety alert`,
      `${interventionName} TGA ARTG AUST product status safety alert Australia`
    ],
    target: {
      ...(artgId ? { artgId } : {}),
      ...(austNumber ? { austNumber } : {}),
      ...(brand ? { brand } : {}),
      name: targetName,
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(sponsor ? { sponsor } : {})
    }
  };
}

function productStatusGaps({
  artgId,
  austNumber,
  brand,
  sourceUrl,
  sponsor,
  targetName
}: {
  artgId?: string;
  austNumber?: string;
  brand?: string;
  sourceUrl?: string;
  sponsor?: string;
  targetName: string;
}) {
  const gaps: string[] = [];

  if (targetName.endsWith("product requiring AU/TGA verification")) {
    gaps.push("Exact product name is not captured yet.");
  }

  if (!brand) {
    gaps.push("Product brand is not captured yet.");
  }

  if (!austNumber && !artgId) {
    gaps.push("No AUST number or ARTG identifier is captured yet.");
  }

  if (!sponsor) {
    gaps.push("Sponsor is not captured yet.");
  }

  if (!sourceUrl) {
    gaps.push("Product-level source URL is not captured yet.");
  }

  gaps.push(
    "Ingredient-level evidence must not be used as a fallback for product-level Australian regulatory confidence."
  );

  return gaps;
}

function blockingReviewItemsFor(
  input: SupplementOnboardingInput,
  claimInputs: SupplementOnboardingClaimInput[]
) {
  const items: string[] = [];

  if (!input.category) {
    items.push("Choose an intervention category before adding seed/public data.");
  }

  const hasSpecificNonLifespanClaim = claimInputs.some(
    (claim) =>
      claim.outcome !== "Mortality/lifespan" &&
      claim.outcome !== "Safety/adverse effects"
  );

  if (!hasSpecificNonLifespanClaim) {
    items.push("Add at least one specific non-lifespan use-case claim before public scoring.");
  }

  items.push("Review AU/TGA product-level status separately; do not infer AUST/ARTG status.");
  items.push("Attach source packets and human review before public evidence promotion.");

  return items;
}

function buildSafetyWatchlist({
  category,
  claimDrafts,
  commonForms,
  name,
  synonyms
}: {
  category?: InterventionCategory;
  claimDrafts: SupplementOnboardingClaimDraft[];
  commonForms: string[];
  name: string;
  synonyms: string[];
}): SupplementOnboardingPlan["safetyWatchlist"] {
  const haystack = [
    name,
    category ?? "",
    ...synonyms,
    ...commonForms,
    ...claimDrafts.map((claim) => `${claim.outcome} ${claim.claimText}`)
  ]
    .join(" ")
    .toLowerCase();
  const signals = SAFETY_WATCHLIST_RULES.flatMap((rule) => {
    const matchedTerms = rule.terms.filter((term) => haystack.includes(term));
    const matchedByCategory =
      rule.id === "peptide-biologic" && category === "Peptide/biologic";
    const allTerms = Array.from(
      new Set([
        ...matchedTerms,
        ...(matchedByCategory ? ["peptide/biologic category"] : [])
      ])
    );

    if (allTerms.length === 0) {
      return [];
    }

    return [
      {
        explanation:
          "Matched draft onboarding text before source review; treat as a routing and wording guardrail, not as a final safety finding.",
        id: rule.id,
        label: rule.label,
        matchedTerms: allTerms,
        requiredAction: rule.requiredAction,
        severity: rule.severity
      }
    ];
  });

  return {
    publicWordingBlocks: [
      "Do not include individualized medical advice, diagnosis, treatment, or dosing guidance.",
      "Do not include sourcing, procurement, compounding, reconstitution, injection, cycling, or self-administration guidance.",
      "Do not imply safety, efficacy, or AU/TGA clearance without reviewed, citation-linked evidence."
    ],
    requiredPacketChecks: [
      "Check adverse-event, contraindication, and interaction evidence separately from benefit evidence.",
      "Keep safety caveats visible in claim packet wording and dashboard labels.",
      "Preserve uncertainty labels when evidence is indirect, low-reputation, unreviewed, or product-status-sensitive.",
      "For watchlist or regulatory-concern signals, require explicit regulatory/safety review before public promotion."
    ],
    signals
  };
}

function guardrailWarningsFor({
  category,
  name,
  safetyWatchlist,
  synonyms
}: {
  category?: InterventionCategory;
  name: string;
  safetyWatchlist: SupplementOnboardingPlan["safetyWatchlist"];
  synonyms: string[];
}) {
  const haystack = [name, ...synonyms, category ?? ""].join(" ").toLowerCase();
  const matchedTerms = WATCHLIST_TERMS.filter((term) => haystack.includes(term));
  const warnings = [
    "No individualized medical advice, diagnosis, treatment, or dosing guidance is generated.",
    "No sourcing, procurement, compounding, reconstitution, injection, cycling, or self-administration guidance is generated.",
    "Source-candidate acceptance, claim linking, extraction, promotion, and claim review remain explicit human-owned steps."
  ];

  for (const signal of safetyWatchlist.signals) {
    warnings.push(
      `${signal.label} detected (${signal.matchedTerms.join(", ")}); ${signal.requiredAction}`
    );
  }

  if (matchedTerms.length > 0 || category === "Peptide/biologic") {
    warnings.push(
      `Watchlist language detected (${matchedTerms.join(", ") || "peptide/biologic category"}); keep regulatory/safety framing conservative and avoid product-use instructions.`
    );
  }

  return warnings;
}

function normalizeRequiredText(value: string, label: string) {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (!normalized) {
    throw new Error(`Supplement onboarding ${label} is required.`);
  }

  return normalized;
}

function uniqueNonEmpty(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim().replace(/\s+/g, " ")).filter(Boolean))
  );
}

function normaliseOptionalText(value: string | undefined) {
  const trimmed = value?.trim().replace(/\s+/g, " ");
  return trimmed || undefined;
}

function inferNameSynonymHints(name: string) {
  const hints: string[] = [];
  const parentheticalMatches = name.matchAll(/\(([^)]+)\)/g);

  for (const match of parentheticalMatches) {
    hints.push(match[1]);
  }

  const withoutParentheticals = name.replace(/\s*\([^)]*\)\s*/g, " ").trim();

  if (withoutParentheticals && withoutParentheticals !== name) {
    hints.push(withoutParentheticals);
  }

  if (name.includes("/")) {
    hints.push(...name.split("/"));
  }

  if (/[A-Za-z]-\d/.test(name) || /\d-[A-Za-z]/.test(name)) {
    hints.push(name.replace(/-/g, " "));
  }

  return uniqueNonEmpty(hints).filter(
    (hint) => hint.toLowerCase() !== name.toLowerCase()
  );
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) {
    throw new Error("Supplement onboarding name must include letters or numbers.");
  }

  return slug;
}

function uniqueId(baseId: string, usedIds: Set<string>) {
  let id = baseId;
  let suffix = 2;

  while (usedIds.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(id);
  return id;
}

function shellQuote(value: string) {
  return `"${value.replace(/"/g, '\\"')}"`;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatList(values: string[]) {
  return values.length > 0 ? values.join(", ") : "Needs review";
}

function markdownBullets(values: string[]) {
  return values.length > 0 ? values.map((value) => `- ${value}`) : ["- None"];
}

function tsString(value: string) {
  return JSON.stringify(value);
}

function tsArray(values: string[]) {
  return `[${values.map(tsString).join(", ")}]`;
}
