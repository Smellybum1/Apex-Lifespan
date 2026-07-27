import type { Claim, Intervention, InterventionCategory, OutcomeArea } from "@/lib/types";

export interface SourceSearchQueries {
  label: string;
  plans: SourceSearchQueryPlanItem[];
  pubMedTerm: string;
  pubMedTerms: string[];
  trialTerm: string;
}

export interface InterventionDiscoverySearchQueries {
  label: string;
  plans: SourceSearchQueryPlanItem[];
  pubMedTerms: string[];
  trialTerm: string;
}

export type SourceSearchQueryPlanKind =
  | "benefit-discovery"
  | "benefit-discovery-review"
  | "benefit-discovery-trial"
  | "category-context"
  | "intervention-review"
  | "human-trial"
  | "outcome-context"
  | "outcome-review"
  | "regulatory-review"
  | "review-level"
  | "safety"
  | "trial-registry";

export type SourceSearchQueryBundleId =
  | "benefit-discovery"
  | "category-context"
  | "core-evidence"
  | "outcome-context";

export interface SourceSearchQueryPlanItem {
  bundleId: SourceSearchQueryBundleId;
  bundleLabel: string;
  executable: boolean;
  kind: SourceSearchQueryPlanKind;
  priority: number;
  rationale: string;
  source: "AU/TGA review" | "ClinicalTrials.gov" | "PubMed";
  term: string;
}

const outcomeSearchTerms: Record<OutcomeArea, string> = {
  "Mortality/lifespan": "longevity mortality lifespan",
  "Cardiovascular events": "cardiovascular events prevention",
  "LDL/ApoB/lipids": "lipids triglycerides ApoB",
  "Blood pressure": "blood pressure",
  "Glucose/insulin/HbA1c": "glucose insulin HbA1c",
  Inflammation: "inflammation biomarkers",
  Cognition: "cognition cognitive function",
  Sleep: "sleep",
  "Mood/stress": "mood stress",
  "Muscle/strength": "strength resistance training lean mass",
  "VO2 max/endurance": "VO2 max endurance",
  "Joint/tendon/skin": "injury healing tendon skin",
  "Eye health": "eye health",
  "Immune/respiratory": "immune respiratory",
  "Fertility/hormones": "fertility hormones",
  "Biological aging clocks": "biological aging clocks",
  "Safety/adverse effects": "safety adverse effects"
};

const outcomeReviewTerms: Record<OutcomeArea, string> = {
  "Mortality/lifespan": "longevity mortality lifespan systematic review meta-analysis",
  "Cardiovascular events": "cardiovascular events systematic review meta-analysis",
  "LDL/ApoB/lipids": "lipids triglycerides ApoB systematic review meta-analysis",
  "Blood pressure": "blood pressure systematic review meta-analysis",
  "Glucose/insulin/HbA1c": "glucose insulin HbA1c systematic review meta-analysis",
  Inflammation: "inflammation systematic review meta-analysis",
  Cognition: "cognition systematic review meta-analysis",
  Sleep: "sleep systematic review meta-analysis",
  "Mood/stress": "mood stress systematic review meta-analysis",
  "Muscle/strength": "strength exercise performance systematic review meta-analysis",
  "VO2 max/endurance": "VO2 max endurance systematic review meta-analysis",
  "Joint/tendon/skin": "skin systematic review meta-analysis",
  "Eye health": "eye health vision systematic review meta-analysis",
  "Immune/respiratory": "immune respiratory systematic review meta-analysis",
  "Fertility/hormones": "fertility hormones systematic review meta-analysis",
  "Biological aging clocks": "biological aging clocks systematic review meta-analysis",
  "Safety/adverse effects": "safety adverse effects systematic review meta-analysis"
};

const outcomeSupplementalContexts: Partial<
  Record<OutcomeArea, { rationale: string; term: string }>
> = {
  "Cardiovascular events": {
    rationale:
      "Add event-specific cardiovascular terms so candidate discovery does not stop at surrogate biomarker literature.",
    term: "major adverse cardiovascular events atrial fibrillation bleeding randomized meta-analysis"
  },
  "LDL/ApoB/lipids": {
    rationale:
      "Add lipid-specific biomarker terms for LDL, ApoB, triglycerides, and placebo-controlled human evidence.",
    term: "LDL cholesterol ApoB triglycerides placebo randomized controlled trial"
  },
  "Blood pressure": {
    rationale:
      "Add blood-pressure measurement terms for systolic, diastolic, and ambulatory outcomes.",
    term: "systolic diastolic ambulatory blood pressure placebo randomized trial"
  },
  "Glucose/insulin/HbA1c": {
    rationale:
      "Add glycemic-marker terms for HbA1c, insulin resistance, fasting glucose, and controlled trials.",
    term: "HbA1c insulin resistance fasting glucose placebo randomized trial"
  },
  Inflammation: {
    rationale:
      "Add inflammatory biomarker terms so the search distinguishes mechanistic markers from clinical endpoints.",
    term: "CRP IL-6 TNF alpha inflammatory biomarkers placebo human trial"
  },
  Cognition: {
    rationale:
      "Add cognition-measure terms for memory, attention, and neuropsychological testing.",
    term: "memory attention cognitive performance neuropsychological test randomized trial"
  },
  Sleep: {
    rationale:
      "Add sleep-measure terms for sleep quality, insomnia, and placebo-controlled trials.",
    term: "sleep quality insomnia sleep continuity placebo randomized trial"
  },
  "Mood/stress": {
    rationale:
      "Add mood and stress scale terms for anxiety, perceived stress, and placebo-controlled trials.",
    term: "anxiety perceived stress mood scale placebo randomized trial"
  },
  "Muscle/strength": {
    rationale:
      "Add performance-measure terms for resistance training, strength, lean mass, and placebo-controlled evidence.",
    term: "resistance training strength lean mass placebo randomized trial"
  },
  "VO2 max/endurance": {
    rationale:
      "Add endurance-measure terms for VO2 max, time trial, fatigue, and controlled human evidence.",
    term: "VO2 max endurance time trial fatigue placebo randomized trial"
  },
  "Joint/tendon/skin": {
    rationale:
      "Add tissue-specific outcome terms while avoiding preparation or self-administration language.",
    term: "tendon ligament skin healing pain function clinical trial"
  },
  "Eye health": {
    rationale:
      "Add eye-health measurement terms for strain, dry-eye, myopia, visual acuity, macular outcomes, and controlled evidence.",
    term: "eye strain dry eye myopia visual acuity macular retinal placebo randomized trial"
  },
  "Immune/respiratory": {
    rationale:
      "Add immune and respiratory endpoint terms for infection, symptom duration, and controlled trials.",
    term: "respiratory infection symptom duration immune function placebo randomized trial"
  },
  "Fertility/hormones": {
    rationale:
      "Add endocrine-marker terms while preserving clinician-context sensitivity.",
    term: "testosterone estrogen fertility hormone biomarker placebo randomized trial"
  },
  "Biological aging clocks": {
    rationale:
      "Add biological-aging marker terms while keeping surrogate endpoints distinct from lifespan claims.",
    term: "epigenetic clock biological age methylation biomarker clinical trial"
  }
};

const benefitDiscoveryOutcomeContexts: Record<
  OutcomeArea,
  { review: string[]; trial: string[] }
> = {
  "Mortality/lifespan": {
    review: ["longevity lifespan mortality systematic review meta-analysis"],
    trial: ["aging biomarkers biological age randomized placebo trial"]
  },
  "Cardiovascular events": {
    review: ["cardiovascular events heart health systematic review meta-analysis"],
    trial: ["blood pressure vascular function endothelial randomized placebo trial"]
  },
  "LDL/ApoB/lipids": {
    review: ["lipids cholesterol triglycerides ApoB systematic review meta-analysis"],
    trial: ["LDL cholesterol triglycerides ApoB randomized placebo trial"]
  },
  "Blood pressure": {
    review: ["blood pressure hypertension systematic review meta-analysis"],
    trial: ["systolic diastolic blood pressure randomized placebo trial"]
  },
  "Glucose/insulin/HbA1c": {
    review: ["glucose insulin HbA1c metabolic health systematic review meta-analysis"],
    trial: ["fasting glucose insulin resistance HbA1c randomized placebo trial"]
  },
  Inflammation: {
    review: ["inflammation oxidative stress systematic review meta-analysis"],
    trial: ["CRP IL-6 TNF oxidative stress randomized placebo trial"]
  },
  Cognition: {
    review: ["cognition memory attention systematic review meta-analysis"],
    trial: ["memory attention cognitive performance randomized placebo trial"]
  },
  Sleep: {
    review: ["sleep insomnia systematic review meta-analysis"],
    trial: ["sleep quality insomnia randomized placebo trial"]
  },
  "Mood/stress": {
    review: ["mood stress anxiety systematic review meta-analysis"],
    trial: ["anxiety stress mood randomized placebo trial"]
  },
  "Muscle/strength": {
    review: ["exercise performance strength muscle systematic review meta-analysis"],
    trial: ["strength exercise performance muscle randomized placebo trial"]
  },
  "VO2 max/endurance": {
    review: ["endurance VO2 max fatigue systematic review meta-analysis"],
    trial: ["VO2 max endurance fatigue randomized placebo trial"]
  },
  "Joint/tendon/skin": {
    review: [
      "skin aging photoaging systematic review meta-analysis",
      "joint tendon pain systematic review meta-analysis"
    ],
    trial: [
      "skin aging photoaging randomized placebo trial",
      "skin hydration elasticity randomized placebo trial",
      "joint pain tendon function randomized placebo trial"
    ]
  },
  "Eye health": {
    review: [
      "eye health vision systematic review meta-analysis",
      "digital eye strain systematic review",
      "dry eye myopia systematic review"
    ],
    trial: [
      "eye strain randomized placebo",
      "digital eye strain randomized placebo",
      "dry eye randomized placebo",
      "myopia randomized placebo",
      "visual acuity retinal macular randomized placebo"
    ]
  },
  "Immune/respiratory": {
    review: ["immune respiratory infection systematic review meta-analysis"],
    trial: ["respiratory infection immune function randomized placebo trial"]
  },
  "Fertility/hormones": {
    review: ["fertility hormones testosterone estrogen systematic review meta-analysis"],
    trial: ["fertility hormones testosterone estrogen randomized placebo trial"]
  },
  "Biological aging clocks": {
    review: ["biological aging epigenetic clock systematic review meta-analysis"],
    trial: ["epigenetic clock biological age methylation randomized placebo trial"]
  },
  "Safety/adverse effects": {
    review: ["safety adverse effects tolerability systematic review meta-analysis"],
    trial: ["safety adverse effects tolerability randomized placebo trial"]
  }
};

const categorySupplementalContexts: Partial<
  Record<InterventionCategory, { rationale: string; term: string }>
> = {
  "Vitamin/mineral": {
    rationale:
      "Add deficiency, low-status, upper-limit, and toxicity context for vitamin/mineral claims.",
    term: "deficiency low status upper intake level toxicity biomarker review"
  },
  "Fatty acid": {
    rationale:
      "Add fatty-acid product-form and caveat terms for EPA/DHA, bleeding, atrial fibrillation, and triglycerides.",
    term: "EPA DHA formulation atrial fibrillation bleeding triglycerides product quality"
  },
  "Amino acid": {
    rationale:
      "Add training-status and renal-safety context for amino-acid performance claims.",
    term: "trained adults exercise performance renal safety tolerability"
  },
  "Botanical/herbal": {
    rationale:
      "Add standardized-extract, liver-risk, interaction, adulteration, and product-quality terms.",
    term: "standardized extract liver injury drug interactions adulteration product quality"
  },
  "Fiber/prebiotic/probiotic": {
    rationale:
      "Add strain/fiber specificity and GI-tolerability terms for gut-related products.",
    term: "strain specific fiber prebiotic probiotic gastrointestinal tolerability microbiome"
  },
  "Ergogenic/performance supplement": {
    rationale:
      "Add sport-performance, adulteration, stimulant, and safety-screening context.",
    term: "exercise performance trained adults adulteration stimulant safety review"
  },
  Nootropic: {
    rationale:
      "Add stimulant, sedative, psychiatric, and medication-interaction context for cognitive claims.",
    term: "stimulant sedative psychiatric adverse events medication interaction cognition"
  },
  "Hormonal/endocrine intervention": {
    rationale:
      "Add endocrine, fertility, pregnancy, and lab-marker safety context.",
    term: "endocrine hormone fertility pregnancy lab biomarker adverse events"
  },
  "Peptide/biologic": {
    rationale:
      "Add clinical-trial, adverse-event, and regulatory context without sourcing or self-use language.",
    term: "clinical trial adverse events regulatory safety review"
  },
  "Drug/geroprotector watchlist": {
    rationale:
      "Add prescription-context, contraindication, adverse-event, and human-trial review terms.",
    term: "contraindications adverse events drug interaction human clinical trial review"
  },
  "Food/beverage": {
    rationale:
      "Add food-matrix, extract, caffeine, sugar, allergen, and product-quality context.",
    term: "food matrix extract caffeine sugar allergen product quality clinical trial"
  }
};

const CLAIM_CONTEXT_TOKEN_LIMIT = 8;
const claimContextStopwords = new Set([
  "already",
  "and",
  "benefit",
  "benefits",
  "claim",
  "claims",
  "correcting",
  "for",
  "not",
  "or",
  "paired",
  "support",
  "supporting",
  "supports",
  "the",
  "use",
  "when",
  "with",
  "without"
]);
const claimContextBlockedTokens = new Set([
  "administer",
  "administered",
  "administering",
  "administration",
  "bac",
  "bacteriostatic",
  "buy",
  "compound",
  "compounded",
  "compounding",
  "cycle",
  "cycles",
  "cycling",
  "dosage",
  "dose",
  "dosed",
  "doses",
  "dosing",
  "inject",
  "injectable",
  "injected",
  "injecting",
  "injection",
  "injections",
  "lyophilised",
  "lyophilized",
  "needle",
  "needles",
  "purchase",
  "reconstitute",
  "reconstituted",
  "reconstitution",
  "self",
  "source",
  "sourced",
  "sources",
  "sourcing",
  "sterile",
  "vial",
  "vials"
]);
const claimContextBlockedPhrasePattern =
  /\b(?:bac(?:teriostatic)?|sterile)[-\s]+water\b|\bself[-\s]+(?:administer(?:ed|ing)?|administration|use)\b/gi;

export function buildSourceSearchQueries({
  claim,
  intervention
}: {
  claim?: Pick<Claim, "claimText" | "outcome">;
  intervention?: Pick<Intervention, "name" | "synonyms"> &
    Partial<Pick<Intervention, "category">>;
}): SourceSearchQueries {
  const interventionTerm = intervention?.name ?? intervention?.synonyms[0] ?? "healthspan intervention";
  const outcomeTerm = claim ? outcomeSearchTerms[claim.outcome] : "human evidence";
  const claimContextTerm = claim ? claimContextSearchTerm(claim.claimText) : "";
  const label = claim && intervention ? `${intervention.name} - ${claim.outcome}` : "Active claim";
  const clinicalContextTerm = normaliseSearchTerm(`${outcomeTerm} ${claimContextTerm}`);
  const pubMedTerm = normaliseSearchTerm(
    `${interventionTerm} ${clinicalContextTerm} randomized trial systematic review`
  );
  const trialTerm = normaliseSearchTerm(`${interventionTerm} ${clinicalContextTerm}`);
  const plans = sourceSearchQueryPlans({
    category: intervention?.category,
    clinicalContextTerm,
    claimContextTerm,
    claimOutcome: claim?.outcome,
    interventionTerm,
    pubMedTerm,
    trialTerm
  });

  return {
    label,
    plans,
    pubMedTerm,
    pubMedTerms: executablePubMedTerms(plans),
    trialTerm
  };
}

export function buildInterventionDiscoverySearchQueries({
  intervention
}: {
  intervention: Pick<Intervention, "name" | "synonyms"> &
    Partial<Pick<Intervention, "category">>;
}): InterventionDiscoverySearchQueries {
  const interventionTerm = intervention.name ?? intervention.synonyms[0] ?? "healthspan intervention";
  const trialTerm = normaliseSearchTerm(`${interventionTerm}`);
  const plans = interventionDiscoverySearchQueryPlans({
    category: intervention.category,
    interventionTerm,
    trialTerm
  });

  return {
    label: `${interventionTerm} - broad benefit discovery`,
    plans,
    pubMedTerms: executablePubMedTerms(plans),
    trialTerm
  };
}

function interventionDiscoverySearchQueryPlans({
  category,
  interventionTerm,
  trialTerm
}: {
  category?: InterventionCategory;
  interventionTerm: string;
  trialTerm: string;
}): SourceSearchQueryPlanItem[] {
  return [
    {
      bundleId: "benefit-discovery",
      bundleLabel: "Broad benefit discovery",
      executable: true,
      kind: "benefit-discovery",
      priority: 1,
      rationale:
        "Run the raw intervention term first so unexpected titles and outcomes can surface before benefit-area filters narrow the search.",
      source: "PubMed",
      term: normaliseSearchTerm(interventionTerm)
    },
    {
      bundleId: "benefit-discovery",
      bundleLabel: "Broad benefit discovery",
      executable: true,
      kind: "benefit-discovery-review",
      priority: 5,
      rationale:
        "Sweep intervention-wide review literature before assuming only existing claim outcomes matter.",
      source: "PubMed",
      term: normaliseSearchTerm(
        `${interventionTerm} systematic review meta-analysis human`
      )
    },
    {
      bundleId: "benefit-discovery",
      bundleLabel: "Broad benefit discovery",
      executable: true,
      kind: "benefit-discovery-trial",
      priority: 10,
      rationale:
        "Sweep human placebo-controlled and randomized evidence across possible benefit domains.",
      source: "PubMed",
      term: normaliseSearchTerm(`${interventionTerm} randomized placebo clinical trial`)
    },
    {
      bundleId: "benefit-discovery",
      bundleLabel: "Broad benefit discovery",
      executable: true,
      kind: "benefit-discovery",
      priority: 15,
      rationale:
        "Catch human biomarker and functional outcome studies that do not fit existing claim wording.",
      source: "PubMed",
      term: normaliseSearchTerm(`${interventionTerm} human health biomarkers benefits`)
    },
    ...benefitDiscoveryOutcomePlans({ interventionTerm }),
    ...supplementalCategoryPlans({ category, interventionTerm }),
    {
      bundleId: "benefit-discovery",
      bundleLabel: "Broad benefit discovery",
      executable: true,
      kind: "trial-registry",
      priority: 500,
      rationale:
        "Check active, completed, and unpublished trial records at the whole-intervention level.",
      source: "ClinicalTrials.gov",
      term: trialTerm
    }
  ];
}

function benefitDiscoveryOutcomePlans({
  interventionTerm
}: {
  interventionTerm: string;
}): SourceSearchQueryPlanItem[] {
  const plans: SourceSearchQueryPlanItem[] = [];
  let priority = 100;

  for (const [outcome, context] of Object.entries(benefitDiscoveryOutcomeContexts) as Array<
    [OutcomeArea, { review: string[]; trial: string[] }]
  >) {
    for (const term of context.review) {
      plans.push({
        bundleId: "benefit-discovery",
        bundleLabel: "Broad benefit discovery",
        executable: true,
        kind: "benefit-discovery-review",
        priority,
        rationale: `Look for ${outcome.toLowerCase()} review-level signals before claims are pre-selected.`,
        source: "PubMed",
        term: normaliseSearchTerm(`${interventionTerm} ${term}`)
      });
      priority += 1;
    }

    for (const term of context.trial) {
      plans.push({
        bundleId: "benefit-discovery",
        bundleLabel: "Broad benefit discovery",
        executable: true,
        kind: "benefit-discovery-trial",
        priority,
        rationale: `Look for ${outcome.toLowerCase()} human trial signals before claims are pre-selected.`,
        source: "PubMed",
        term: normaliseSearchTerm(`${interventionTerm} ${term}`)
      });
      priority += 1;
    }
  }

  return plans;
}

function sourceSearchQueryPlans({
  category,
  clinicalContextTerm,
  claimContextTerm,
  claimOutcome,
  interventionTerm,
  pubMedTerm,
  trialTerm
}: {
  category?: InterventionCategory;
  clinicalContextTerm: string;
  claimContextTerm: string;
  claimOutcome?: OutcomeArea;
  interventionTerm: string;
  pubMedTerm: string;
  trialTerm: string;
}): SourceSearchQueryPlanItem[] {
  const safetyContextTerm = normaliseSearchTerm(
    `safety adverse effects interactions ${claimContextTerm}`
  );

  return [
    {
      bundleId: "core-evidence",
      bundleLabel: "Core evidence sweep",
      executable: true,
      kind: "intervention-review",
      priority: 5,
      rationale:
        "Run a compact intervention-wide review query so narrow outcome terms do not hide useful human meta-analyses.",
      source: "PubMed",
      term: normaliseSearchTerm(
        `${interventionTerm} randomized clinical trial systematic review meta-analysis`
      )
    },
    {
      bundleId: "core-evidence",
      bundleLabel: "Core evidence sweep",
      executable: true,
      kind: "review-level",
      priority: 10,
      rationale:
        "Start with reviews/meta-analyses to understand overall evidence direction and uncertainty.",
      source: "PubMed",
      term: normaliseSearchTerm(
        `${interventionTerm} ${clinicalContextTerm} systematic review meta-analysis`
      )
    },
    ...outcomeReviewPlans({ claimOutcome, interventionTerm }),
    {
      bundleId: "core-evidence",
      bundleLabel: "Core evidence sweep",
      executable: true,
      kind: "human-trial",
      priority: 20,
      rationale:
        "Find human randomized or controlled trials relevant to the claim outcome.",
      source: "PubMed",
      term: pubMedTerm
    },
    {
      bundleId: "core-evidence",
      bundleLabel: "Core evidence sweep",
      executable: true,
      kind: "trial-registry",
      priority: 30,
      rationale:
        "Check active, completed, and unpublished trial records before treating published evidence as complete.",
      source: "ClinicalTrials.gov",
      term: trialTerm
    },
    {
      bundleId: "core-evidence",
      bundleLabel: "Core evidence sweep",
      executable: true,
      kind: "safety",
      priority: 40,
      rationale:
        "Search safety, tolerability, adverse-event, and interaction context separately from benefit evidence.",
      source: "PubMed",
      term: normaliseSearchTerm(
        `${interventionTerm} ${safetyContextTerm} contraindications`
      )
    },
    {
      bundleId: "core-evidence",
      bundleLabel: "Core evidence sweep",
      executable: true,
      kind: "regulatory-review",
      priority: 50,
      rationale:
        "Use the AU/TGA workflow to keep product-level status separate from ingredient evidence.",
      source: "AU/TGA review",
      term: normaliseSearchTerm(
        `${interventionTerm} TGA ARTG AUST product status safety alert Australia`
      )
    },
    ...supplementalOutcomePlans({ claimOutcome, interventionTerm }),
    ...supplementalCategoryPlans({ category, interventionTerm })
  ];
}

function outcomeReviewPlans({
  claimOutcome,
  interventionTerm
}: {
  claimOutcome?: OutcomeArea;
  interventionTerm: string;
}): SourceSearchQueryPlanItem[] {
  const term = claimOutcome ? outcomeReviewTerms[claimOutcome] : undefined;

  if (!term) {
    return [];
  }

  return [
    {
      bundleId: "core-evidence",
      bundleLabel: "Core evidence sweep",
      executable: true,
      kind: "outcome-review",
      priority: 15,
      rationale:
        "Use a shorter outcome review query to catch relevant meta-analyses that PubMed drops when the claim text is too specific.",
      source: "PubMed",
      term: normaliseSearchTerm(`${interventionTerm} ${term}`)
    }
  ];
}

function supplementalOutcomePlans({
  claimOutcome,
  interventionTerm
}: {
  claimOutcome?: OutcomeArea;
  interventionTerm: string;
}): SourceSearchQueryPlanItem[] {
  const context = claimOutcome ? outcomeSupplementalContexts[claimOutcome] : undefined;

  if (!context) {
    return [];
  }

  return [
    {
      bundleId: "outcome-context",
      bundleLabel: "Outcome-specific evidence bundle",
      executable: true,
      kind: "outcome-context",
      priority: 60,
      rationale: context.rationale,
      source: "PubMed",
      term: normaliseSearchTerm(`${interventionTerm} ${context.term}`)
    }
  ];
}

function supplementalCategoryPlans({
  category,
  interventionTerm
}: {
  category?: InterventionCategory;
  interventionTerm: string;
}): SourceSearchQueryPlanItem[] {
  const context = category ? categorySupplementalContexts[category] : undefined;

  if (!context) {
    return [];
  }

  return [
    {
      bundleId: "category-context",
      bundleLabel: "Category-specific safety/context bundle",
      executable: true,
      kind: "category-context",
      priority: 70,
      rationale: context.rationale,
      source: "PubMed",
      term: normaliseSearchTerm(`${interventionTerm} ${context.term}`)
    }
  ];
}

function claimContextSearchTerm(value: string) {
  const seen = new Set<string>();

  return value
    .replace(claimContextBlockedPhrasePattern, " ")
    .replace(/['"]/g, "")
    .replace(/[^a-zA-Z0-9/+-]+/g, " ")
    .split(" ")
    .map((token) => token.trim().toLowerCase())
    .filter((token) => {
      if (
        token.length < 3 ||
        claimContextStopwords.has(token) ||
        claimContextBlockedTokens.has(token) ||
        seen.has(token)
      ) {
        return false;
      }

      seen.add(token);
      return true;
    })
    .slice(0, CLAIM_CONTEXT_TOKEN_LIMIT)
    .join(" ");
}

function normaliseSearchTerm(value: string) {
  const seen = new Set<string>();

  return value
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((token) => {
      const key = token.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .join(" ");
}

function executablePubMedTerms(plans: SourceSearchQueryPlanItem[]) {
  const seen = new Set<string>();
  const terms: string[] = [];

  for (const plan of plans) {
    if (!plan.executable || plan.source !== "PubMed") {
      continue;
    }

    if (!seen.has(plan.term)) {
      seen.add(plan.term);
      terms.push(plan.term);
    }
  }

  return terms;
}
