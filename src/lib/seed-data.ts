import type {
  AustraliaRegulatoryStatus,
  Claim,
  Intervention,
  ProductSignal,
  Reference,
  SafetyAlert,
  Study,
  TrialWatchItem
} from "@/lib/types";

const DRAFT_ONBOARDING_DATE = "2026-06-14";
const TGA_ARTG_URL =
  "https://www.tga.gov.au/products/regulations-all-products/about-australian-register-therapeutic-goods-artg";

const draftOnboardingScores = {
  evidenceDirectness: 1,
  evidenceRigor: 1,
  effectSize: 1,
  safety: 3,
  regulatoryRisk: 5,
  productQuality: 1,
  hypePenalty: 5,
  measurability: 3
} satisfies Claim["scores"];

function draftExpansionIntervention({
  category,
  commonForms,
  id,
  name,
  synonyms
}: Pick<Intervention, "category" | "commonForms" | "id" | "name" | "synonyms">): Intervention {
  return {
    id,
    name,
    slug: id,
    synonyms,
    category,
    commonForms,
    regulatoryStatus:
      "AU/TGA product-level status not reviewed; do not infer ARTG/AUST status from ingredient evidence.",
    safetySummary:
      "Safety profile not reviewed yet; keep safety and adverse-effect claims cautious until source packets are curated.",
    interactionSummary:
      "Interaction, contraindication, and medication context not reviewed yet.",
    evidenceSummary:
      "Draft onboarding supplement. Claims are placeholders for source-packet collection and confidence scoring, not reviewed evidence.",
    lastReviewed: DRAFT_ONBOARDING_DATE
  };
}

function draftExpansionClaim({
  claimText,
  evidence,
  id,
  interventionId,
  outcome,
  supplementName
}: {
  claimText: string;
  evidence?: Partial<Omit<Claim, "claimText" | "id" | "interventionId" | "outcome">>;
  id: string;
  interventionId: string;
  outcome: Claim["outcome"];
  supplementName: string;
}): Claim {
  const baseClaim: Claim = {
    id,
    interventionId,
    outcome,
    claimText,
    populationStudied: "Not reviewed yet.",
    doseFormStudied: "Not reviewed yet; do not add dosing guidance without source review.",
    durationStudied: "Not reviewed yet.",
    comparator: "Not reviewed yet.",
    evidenceGrade: "Insufficient until source packets are reviewed.",
    effectSize: "Unknown until source review.",
    clinicalRelevance: "Not established until source review.",
    confidenceLevel: "Very low",
    safetyNotes:
      outcome === "Safety/adverse effects"
        ? `${supplementName} safety profile is not reviewed yet; do not infer product safety, interaction safety, or AU/TGA clearance.`
        : `${supplementName} safety profile is not reviewed yet; interpret this draft claim as source-collection scope only.`,
    applicabilityNotes:
      "Draft onboarding claim. Do not treat as public evidence until source packets are reviewed.",
    doesNotProve: [
      "Does not establish this claim until source packets are reviewed.",
      "Does not establish product-level efficacy, safety, or AU/TGA status.",
      "Does not provide dosing or individualized medical advice."
    ],
    keyReferenceIds: [],
    scores: { ...draftOnboardingScores },
    finalLabel: "Insufficient Evidence",
    momentum: "Stable",
    reviewStatus: "Unreviewed AI draft",
    lastUpdated: DRAFT_ONBOARDING_DATE,
    whatWouldChangeScore:
      "Citation-linked source packets with structured extraction, claim-specific effect estimates, safety/regulatory review, and product-quality context."
  };

  if (!evidence) {
    return baseClaim;
  }

  return {
    ...baseClaim,
    ...evidence,
    doesNotProve: evidence.doesNotProve
      ? [...evidence.doesNotProve]
      : baseClaim.doesNotProve,
    keyReferenceIds: evidence.keyReferenceIds
      ? [...evidence.keyReferenceIds]
      : baseClaim.keyReferenceIds,
    scores: evidence.scores ? { ...evidence.scores } : baseClaim.scores
  };
}

function draftAustraliaRegulatoryStatus(interventionId: string): AustraliaRegulatoryStatus {
  return {
    id: `${interventionId}-au-status`,
    interventionId,
    region: "AU",
    kind: "Unknown",
    status: "AU/TGA product-level status unverified",
    efficacyAssessed: false,
    preMarketAssessment: false,
    supplySummary:
      "No reviewed product-level ARTG/AUST record is attached in this onboarding draft.",
    evidenceRequirement:
      "Review product-level ARTG/AUST evidence before claiming Australian market authorisation or assessed efficacy.",
    sourceUrl: TGA_ARTG_URL,
    checkedAt: DRAFT_ONBOARDING_DATE,
    notes:
      "Ingredient-level evidence is not product-level AU/TGA evidence. Keep product status unknown until reviewed."
  };
}

const expansionInterventions: Intervention[] = [
  draftExpansionIntervention({
    id: "magnesium-glycinate",
    name: "Magnesium glycinate",
    synonyms: ["magnesium", "glycine magnesium", "magnesium bisglycinate"],
    category: "Vitamin/mineral",
    commonForms: ["Capsule", "Tablet", "Powder"]
  }),
  draftExpansionIntervention({
    id: "zinc",
    name: "Zinc",
    synonyms: ["zinc gluconate", "zinc citrate", "zinc picolinate"],
    category: "Vitamin/mineral",
    commonForms: ["Tablet", "Capsule", "Lozenge"]
  }),
  draftExpansionIntervention({
    id: "whey-protein",
    name: "Whey protein",
    synonyms: ["protein powder", "whey protein isolate", "whey protein concentrate"],
    category: "Ergogenic/performance supplement",
    commonForms: ["Powder", "Drink mix", "Bar"]
  }),
  draftExpansionIntervention({
    id: "caffeine",
    name: "Caffeine",
    synonyms: ["caffeine anhydrous", "coffee caffeine", "pre-workout caffeine"],
    category: "Ergogenic/performance supplement",
    commonForms: ["Capsule", "Tablet", "Drink", "Powder"]
  }),
  draftExpansionIntervention({
    id: "ashwagandha",
    name: "Ashwagandha",
    synonyms: ["withania somnifera", "ashwagandha extract", "KSM-66", "Sensoril"],
    category: "Botanical/herbal",
    commonForms: ["Extract", "Capsule", "Powder"]
  }),
  draftExpansionIntervention({
    id: "berberine",
    name: "Berberine",
    synonyms: ["berberine hydrochloride", "berberine HCl"],
    category: "Botanical/herbal",
    commonForms: ["Capsule", "Tablet", "Extract"]
  }),
  draftExpansionIntervention({
    id: "curcumin",
    name: "Curcumin",
    synonyms: ["turmeric extract", "curcuma longa", "curcuminoids"],
    category: "Botanical/herbal",
    commonForms: ["Extract", "Capsule", "Powder"]
  }),
  draftExpansionIntervention({
    id: "hydrolyzed-collagen",
    name: "Hydrolyzed collagen",
    synonyms: ["collagen hydrolysate", "hydrolyzed gelatin", "oral collagen supplement"],
    category: "Amino acid",
    commonForms: ["Powder", "Capsule", "Drink mix"]
  }),
  draftExpansionIntervention({
    id: "melatonin",
    name: "Melatonin",
    synonyms: ["melatonin supplement", "circadian sleep aid"],
    category: "Hormonal/endocrine intervention",
    commonForms: ["Tablet", "Capsule", "Liquid"]
  }),
  draftExpansionIntervention({
    id: "probiotic-blend",
    name: "Probiotic blend",
    synonyms: ["lactobacillus", "bifidobacterium", "multi-strain probiotic"],
    category: "Fiber/prebiotic/probiotic",
    commonForms: ["Capsule", "Sachet", "Powder"]
  }),
  draftExpansionIntervention({
    id: "coenzyme-q10",
    name: "Coenzyme Q10",
    synonyms: ["CoQ10", "ubiquinone", "ubiquinol"],
    category: "Drug/geroprotector watchlist",
    commonForms: ["Softgel", "Capsule", "Tablet"]
  }),
  draftExpansionIntervention({
    id: "l-theanine",
    name: "L-theanine",
    synonyms: ["theanine", "green tea theanine"],
    category: "Nootropic",
    commonForms: ["Capsule", "Tablet", "Drink mix"]
  }),
  draftExpansionIntervention({
    id: "beta-alanine",
    name: "Beta-alanine",
    synonyms: ["beta alanine", "carnosine precursor"],
    category: "Ergogenic/performance supplement",
    commonForms: ["Powder", "Capsule", "Pre-workout blend"]
  }),
  draftExpansionIntervention({
    id: "l-citrulline",
    name: "L-citrulline",
    synonyms: ["citrulline", "citrulline malate"],
    category: "Ergogenic/performance supplement",
    commonForms: ["Powder", "Capsule", "Drink mix"]
  }),
  draftExpansionIntervention({
    id: "taurine",
    name: "Taurine",
    synonyms: ["2-aminoethanesulfonic acid"],
    category: "Amino acid",
    commonForms: ["Capsule", "Powder", "Drink"]
  }),
  draftExpansionIntervention({
    id: "n-acetylcysteine",
    name: "N-acetylcysteine",
    synonyms: ["NAC", "acetylcysteine"],
    category: "Amino acid",
    commonForms: ["Capsule", "Tablet", "Powder"]
  }),
  draftExpansionIntervention({
    id: "glucosamine-chondroitin",
    name: "Glucosamine/chondroitin",
    synonyms: ["glucosamine sulfate", "chondroitin sulfate", "joint formula"],
    category: "Amino acid",
    commonForms: ["Capsule", "Tablet", "Powder"]
  }),
  draftExpansionIntervention({
    id: "iron",
    name: "Iron",
    synonyms: ["ferrous sulfate", "ferrous bisglycinate", "iron supplement"],
    category: "Vitamin/mineral",
    commonForms: ["Tablet", "Capsule", "Liquid"]
  }),
  draftExpansionIntervention({
    id: "vitamin-b12",
    name: "Vitamin B12",
    synonyms: ["cobalamin", "methylcobalamin", "cyanocobalamin"],
    category: "Vitamin/mineral",
    commonForms: ["Tablet", "Capsule", "Sublingual", "Liquid"]
  }),
  draftExpansionIntervention({
    id: "folic-acid",
    name: "Folic acid / folate",
    synonyms: ["folate", "methylfolate", "5-MTHF", "folic acid"],
    category: "Vitamin/mineral",
    commonForms: ["Tablet", "Capsule", "Prenatal blend"]
  }),
  draftExpansionIntervention({
    id: "dietary-nitrate-beetroot",
    name: "Dietary nitrate / beetroot juice",
    synonyms: ["beetroot juice", "beet juice", "dietary nitrate", "nitrate-rich vegetables"],
    category: "Food/beverage",
    commonForms: ["Beetroot juice concentrate", "Beetroot powder", "Nitrate-rich vegetable foods"]
  }),
  draftExpansionIntervention({
    id: "sodium-bicarbonate",
    name: "Sodium bicarbonate",
    synonyms: ["bicarbonate", "bicarb soda", "baking soda", "NaHCO3"],
    category: "Ergogenic/performance supplement",
    commonForms: ["Capsule", "Tablet", "Powder"]
  }),
  draftExpansionIntervention({
    id: "vitamin-c",
    name: "Vitamin C",
    synonyms: ["ascorbic acid", "sodium ascorbate", "calcium ascorbate"],
    category: "Vitamin/mineral",
    commonForms: ["Tablet", "Capsule", "Powder", "Chewable"]
  }),
  draftExpansionIntervention({
    id: "resveratrol",
    name: "Resveratrol",
    synonyms: ["trans-resveratrol", "grape polyphenol", "red wine polyphenol"],
    category: "Botanical/herbal",
    commonForms: ["Capsule", "Tablet", "Extract"]
  }),
  draftExpansionIntervention({
    id: "quercetin",
    name: "Quercetin",
    synonyms: ["quercetin aglycone", "bioflavonoid", "flavonol"],
    category: "Botanical/herbal",
    commonForms: ["Capsule", "Tablet", "Extract"]
  }),
  draftExpansionIntervention({
    id: "fisetin",
    name: "Fisetin",
    synonyms: ["fisetin flavonol", "senolytic flavonoid", "strawberry flavonol"],
    category: "Botanical/herbal",
    commonForms: ["Capsule", "Tablet", "Extract"]
  })
];

const expansionClaims: Claim[] = [
  draftExpansionClaim({
    id: "magnesium-glycinate-sleep",
    interventionId: "magnesium-glycinate",
    outcome: "Sleep",
    claimText: "Sleep quality or sleep-continuity support.",
    supplementName: "Magnesium glycinate",
    evidence: {
      populationStudied:
        "Healthy adults reporting poor sleep quality in a magnesium bisglycinate RCT, plus older adults with insomnia in limited oral-magnesium trials.",
      doseFormStudied:
        "Magnesium bisglycinate and oral magnesium supplementation; this is not dosing guidance.",
      durationStudied:
        "Short-term trial contexts, including a 4-week bisglycinate RCT and older-adult insomnia trials summarized in review evidence.",
      comparator: "Placebo or no treatment in randomized trial contexts.",
      evidenceGrade:
        "Source-backed sleep signal with one direct bisglycinate RCT and low-certainty systematic-review context.",
      effectSize:
        "Modest subjective insomnia-severity improvement in the direct bisglycinate RCT; older-adult review evidence suggests a sleep-onset latency signal with low to very low certainty.",
      clinicalRelevance:
        "Possible sleep-symptom support signal for selected trial populations, not an insomnia treatment claim.",
      confidenceLevel: "Low",
      safetyNotes:
        "Adverse-event extraction is incomplete; safety depends on kidney function, medicines, total magnesium exposure, and product quality. No dosing guidance is provided.",
      applicabilityNotes:
        "Applies to studied magnesium and magnesium bisglycinate contexts, not every glycinate product, diagnosed insomnia care, or AU/TGA product status.",
      doesNotProve: [
        "Does not prove treatment of insomnia or other sleep disorders.",
        "Does not prove all magnesium glycinate or bisglycinate products are equivalent.",
        "Does not establish product-level efficacy, safety, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: [
        "schuster-magnesium-bisglycinate-sleep-2025",
        "mah-magnesium-insomnia-2021"
      ],
      keyStudyIds: [
        "study-schuster-magnesium-bisglycinate-sleep-2025",
        "study-mah-magnesium-insomnia-2021"
      ],
      scores: {
        evidenceDirectness: 7,
        evidenceRigor: 6,
        effectSize: 3,
        safety: 5,
        regulatoryRisk: 2,
        productQuality: 3,
        hypePenalty: 5,
        measurability: 6
      },
      finalLabel: "Reasonable N-of-1 Experiment",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Independent replication with objective sleep measures, longer follow-up, adverse-event extraction, and product-level quality/regulatory evidence."
    }
  }),
  draftExpansionClaim({
    id: "magnesium-glycinate-blood-pressure",
    interventionId: "magnesium-glycinate",
    outcome: "Blood pressure",
    claimText: "Small blood pressure support in reviewed magnesium supplementation trials.",
    supplementName: "Magnesium glycinate",
    evidence: {
      populationStudied: "Adults in randomized magnesium supplementation blood-pressure trials.",
      doseFormStudied:
        "Magnesium supplementation; glycinate-specific effects are not established by this source packet.",
      durationStudied: "Varied across included trials.",
      comparator: "Placebo or control in randomized double-blind trials.",
      evidenceGrade: "Source-backed meta-analysis; formulation-specific certainty remains limited.",
      effectSize:
        "Small average reductions in systolic and diastolic blood pressure reported in the reviewed trials.",
      clinicalRelevance:
        "Potentially relevant as a modest biomarker signal, not a hypertension treatment claim.",
      confidenceLevel: "Moderate",
      safetyNotes:
        "Safety depends on kidney function, medicines, total magnesium exposure, and product quality; no dosing guidance is provided.",
      applicabilityNotes:
        "Applies to magnesium supplementation trial evidence, not specifically to every magnesium glycinate product or AU/TGA product status.",
      doesNotProve: [
        "Does not prove magnesium glycinate is superior to other magnesium forms.",
        "Does not prove treatment of hypertension or cardiovascular-risk reduction.",
        "Does not establish product-level efficacy, safety, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: ["zhang-magnesium-bp-2016"],
      scores: {
        evidenceDirectness: 6,
        evidenceRigor: 7,
        effectSize: 3,
        safety: 6,
        regulatoryRisk: 2,
        productQuality: 4,
        hypePenalty: 4,
        measurability: 9
      },
      finalLabel: "Useful for Specific Use Case",
      whatWouldChangeScore:
        "Formulation-specific trials, stronger effect estimates, safety context, and product-level quality/regulatory evidence."
    }
  }),
  draftExpansionClaim({
    id: "magnesium-glycinate-safety",
    interventionId: "magnesium-glycinate",
    outcome: "Safety/adverse effects",
    claimText: "General safety, tolerability, interaction, and product-quality profile.",
    supplementName: "Magnesium glycinate",
    evidence: {
      populationStudied:
        "General health-professional magnesium safety reference; not a product-specific magnesium glycinate safety trial.",
      doseFormStudied:
        "Dietary supplements and medications containing magnesium; form-specific glycinate tolerability is not established here.",
      durationStudied: "Reference safety context, not a duration-matched intervention trial.",
      comparator: "Not applicable for this safety reference packet.",
      evidenceGrade:
        "Source-backed government safety reference for excessive supplemental magnesium and medication-interaction context.",
      effectSize:
        "Not an efficacy effect-size claim; captures known gastrointestinal, toxicity, kidney-function, and medication-interaction safety considerations.",
      clinicalRelevance:
        "Useful as a safety-screening packet before interpreting magnesium sleep or blood-pressure claims.",
      confidenceLevel: "Moderate",
      safetyNotes:
        "High supplemental or medication magnesium can cause gastrointestinal adverse effects; very high exposure can cause toxicity, with greater concern when kidney function is impaired or interacting medicines are present.",
      applicabilityNotes:
        "Applies to general magnesium supplement safety context only. It does not establish product quality, product-level safety, or AU/TGA product status.",
      doesNotProve: [
        "Does not prove magnesium glycinate products are safer than other forms.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not replace clinician or pharmacist review for kidney disease, medicines, pregnancy, or other individual risk contexts.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: ["ods-magnesium"],
      keyStudyIds: ["study-ods-magnesium-safety"],
      scores: {
        evidenceDirectness: 6,
        evidenceRigor: 6,
        effectSize: 1,
        safety: 5,
        regulatoryRisk: 3,
        productQuality: 2,
        hypePenalty: 4,
        measurability: 6
      },
      finalLabel: "Requires Clinician Oversight",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Form-specific tolerability trials, product-quality testing, Australian product-level regulatory review, and adverse-event extraction from intervention trials."
    }
  }),
  draftExpansionClaim({
    id: "zinc-immune-respiratory",
    interventionId: "zinc",
    outcome: "Immune/respiratory",
    claimText: "Common-cold duration support in reviewed trial contexts.",
    supplementName: "Zinc",
    evidence: {
      populationStudied: "People in randomized trials and systematic reviews of common-cold zinc use.",
      doseFormStudied:
        "Zinc preparations varied across trials; form and timing are major applicability limits.",
      durationStudied: "Varied across prevention and treatment trials.",
      comparator: "Placebo or usual care in reviewed trials.",
      evidenceGrade:
        "Source-backed systematic review with mixed prevention signal and more plausible duration signal.",
      effectSize:
        "Review evidence is more supportive for reducing duration of ongoing colds than broad prevention.",
      clinicalRelevance:
        "Narrow respiratory-symptom context only; not a general immune-boosting claim.",
      confidenceLevel: "Low",
      safetyNotes:
        "Safety depends on total zinc exposure, copper status, medicines, formulation, and product quality; no dosing guidance is provided.",
      applicabilityNotes:
        "Broad zinc immune claims should stay cautious unless source packets match the exact endpoint and product context.",
      doesNotProve: [
        "Does not prove broad immune enhancement.",
        "Does not prove reliable common-cold prevention.",
        "Does not establish product-level efficacy, safety, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: ["cochrane-zinc-cold-2024"],
      scores: {
        evidenceDirectness: 5,
        evidenceRigor: 6,
        effectSize: 3,
        safety: 4,
        regulatoryRisk: 2,
        productQuality: 3,
        hypePenalty: 5,
        measurability: 6
      },
      finalLabel: "Useful for Specific Use Case",
      whatWouldChangeScore:
        "Endpoint-specific extraction, product/formulation matching, safety limits, and AU/TGA product-level review."
    }
  }),
  draftExpansionClaim({
    id: "zinc-fertility-hormones",
    interventionId: "zinc",
    outcome: "Fertility/hormones",
    claimText: "Male fertility and semen-parameter support in selected trial contexts.",
    supplementName: "Zinc",
    evidence: {
      populationStudied:
        "Men in male infertility, subfertility, or couples-planning-infertility-treatment studies.",
      doseFormStudied:
        "Zinc alone and folic-acid-plus-zinc supplementation in reviewed male fertility studies; this is not dosing guidance.",
      durationStudied:
        "Varied across semen-parameter trials and reviews; one large infertility-treatment trial used 6 months of follow-up.",
      comparator: "Placebo, control, or fertile comparison groups depending on the source.",
      evidenceGrade:
        "Mixed source-backed male fertility packet: semen-parameter signals in reviews, but no live-birth benefit in a large folic-acid-plus-zinc RCT.",
      effectSize:
        "Meta-analytic sources report semen-parameter signals for zinc, while the larger JAMA trial did not improve semen quality or live birth.",
      clinicalRelevance:
        "Possible semen-parameter biomarker context only; not a fertility treatment, testosterone optimization, or live-birth claim.",
      confidenceLevel: "Low",
      safetyNotes:
        "Interpret alongside the zinc safety packet; total zinc exposure, copper status, medicines, and product quality matter. No dosing guidance is provided.",
      applicabilityNotes:
        "Applies to male semen-parameter study contexts, not female fertility, general hormone optimization, or every zinc product.",
      doesNotProve: [
        "Does not prove improved live birth or pregnancy outcomes.",
        "Does not prove treatment of infertility or hormone disorders.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: [
        "zhao-zinc-male-infertility-2016",
        "salas-huetos-sperm-supplements-2018",
        "schisterman-folic-acid-zinc-2020"
      ],
      keyStudyIds: [
        "study-zhao-zinc-male-infertility-2016",
        "study-salas-huetos-sperm-supplements-2018",
        "study-schisterman-folic-acid-zinc-2020"
      ],
      scores: {
        evidenceDirectness: 6,
        evidenceRigor: 6,
        effectSize: 3,
        safety: 4,
        regulatoryRisk: 3,
        productQuality: 2,
        hypePenalty: 6,
        measurability: 7
      },
      finalLabel: "Conditional / Biomarker-Gated",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Endpoint-specific replication with live-birth outcomes, baseline zinc-status stratification, product-quality evidence, and Australian product-level review."
    }
  }),
  draftExpansionClaim({
    id: "zinc-safety",
    interventionId: "zinc",
    outcome: "Safety/adverse effects",
    claimText: "General safety, tolerability, interaction, and product-quality profile.",
    supplementName: "Zinc",
    evidence: {
      populationStudied:
        "General health-professional zinc safety reference; not a product-specific zinc safety trial.",
      doseFormStudied:
        "Zinc from foods, supplements, medicines, lozenges, and zinc-containing denture adhesives; not product-specific.",
      durationStudied: "Reference safety context, not a duration-matched intervention trial.",
      comparator: "Not applicable for this safety reference packet.",
      evidenceGrade:
        "Source-backed government safety reference for excessive zinc exposure and medicine-interaction context.",
      effectSize:
        "Not an efficacy effect-size claim; captures gastrointestinal adverse effects, copper-deficiency risk, and interaction considerations.",
      clinicalRelevance:
        "Useful as a safety-screening packet before interpreting zinc respiratory or hormone-related claims.",
      confidenceLevel: "Moderate",
      safetyNotes:
        "Excess zinc can cause gastrointestinal symptoms and, with longer high exposure, copper-related problems; zinc can also interact with selected medicines and other minerals.",
      applicabilityNotes:
        "Applies to general zinc supplement safety context only. It does not establish product quality, product-level safety, or AU/TGA product status.",
      doesNotProve: [
        "Does not prove zinc products are interchangeable or safe for every user.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not replace clinician or pharmacist review for medicines, pregnancy, deficiency states, or long-term use.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: ["ods-zinc"],
      keyStudyIds: ["study-ods-zinc-safety"],
      scores: {
        evidenceDirectness: 6,
        evidenceRigor: 6,
        effectSize: 1,
        safety: 5,
        regulatoryRisk: 3,
        productQuality: 2,
        hypePenalty: 4,
        measurability: 6
      },
      finalLabel: "Requires Clinician Oversight",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Product-quality testing, Australian product-level regulatory review, and adverse-event extraction from zinc intervention trials."
    }
  }),
  draftExpansionClaim({
    id: "whey-protein-strength",
    interventionId: "whey-protein",
    outcome: "Muscle/strength",
    claimText:
      "Resistance-training strength and lean-mass support in studied adult trial contexts.",
    supplementName: "Whey protein",
    evidence: {
      populationStudied:
        "Healthy adults in resistance-training protein-supplementation trials and meta-analysis.",
      doseFormStudied:
        "Protein supplementation; not all effects are whey-specific and no dosing guidance is provided.",
      durationStudied: "Prolonged resistance-training interventions across included studies.",
      comparator: "Resistance training with lower protein, placebo, or control supplementation contexts.",
      evidenceGrade:
        "Source-backed systematic review, meta-analysis, and meta-regression in training contexts.",
      effectSize:
        "Supports additional gains in muscle mass and strength when paired with resistance training.",
      clinicalRelevance:
        "Most relevant for training-adaptations, not direct longevity or disease-treatment claims.",
      confidenceLevel: "Moderate",
      safetyNotes:
        "Safety depends on kidney disease history, total diet, allergens, contaminants, and product quality.",
      applicabilityNotes:
        "Evidence fits protein supplementation with resistance training; it does not automatically apply to every whey product or sedentary context.",
      doesNotProve: [
        "Does not prove direct lifespan extension.",
        "Does not prove benefit without appropriate training context.",
        "Does not establish product-level efficacy, safety, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: ["morton-protein-resistance-2018"],
      scores: {
        evidenceDirectness: 7,
        evidenceRigor: 8,
        effectSize: 5,
        safety: 7,
        regulatoryRisk: 2,
        productQuality: 4,
        hypePenalty: 3,
        measurability: 8
      },
      finalLabel: "Useful for Specific Use Case",
      whatWouldChangeScore:
        "Whey-specific extraction, older-adult subgroup detail, safety/product-quality review, and product-level evidence."
    }
  }),
  draftExpansionClaim({
    id: "whey-protein-lifespan",
    interventionId: "whey-protein",
    outcome: "Mortality/lifespan",
    claimText: "Direct lifespan extension.",
    supplementName: "Whey protein",
    evidence: {
      populationStudied:
        "Adults in prospective cohort studies of total, animal, and plant protein intake; not whey-protein intervention trials.",
      doseFormStudied:
        "Habitual dietary protein sources, not isolated whey protein products.",
      durationStudied: "Prospective cohort follow-up ranged from 3.5 to 32 years in the cited review.",
      comparator: "Higher versus lower dietary protein intake categories and dose-response models.",
      evidenceGrade:
        "Source-backed indirect mortality context only; no direct whey-protein lifespan-extension evidence.",
      effectSize:
        "Dietary protein source associations do not establish that whey protein extends lifespan.",
      clinicalRelevance:
        "Useful for separating protein-intake epidemiology from direct whey longevity claims.",
      confidenceLevel: "Very low",
      safetyNotes:
        "Safety depends on kidney disease history, total diet, allergens, contaminants, and product quality; no dosing guidance is provided.",
      applicabilityNotes:
        "This source is dietary protein epidemiology, not a whey protein product trial or AU/TGA product review.",
      doesNotProve: [
        "Does not prove whey protein extends lifespan.",
        "Does not prove animal-protein, dairy-protein, plant-protein, and whey-protein sources are interchangeable.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: ["naghshi-protein-mortality-2020"],
      keyStudyIds: ["study-naghshi-protein-mortality-2020"],
      scores: {
        evidenceDirectness: 1,
        evidenceRigor: 5,
        effectSize: 1,
        safety: 5,
        regulatoryRisk: 2,
        productQuality: 3,
        hypePenalty: 7,
        measurability: 4
      },
      finalLabel: "Insufficient Evidence",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Whey-specific controlled trials or high-quality cohorts with clinically meaningful morbidity or mortality endpoints, plus product-quality and AU/TGA product-level evidence."
    }
  }),
  draftExpansionClaim({
    id: "whey-protein-safety",
    interventionId: "whey-protein",
    outcome: "Safety/adverse effects",
    claimText: "General safety, tolerability, interaction, and product-quality profile.",
    supplementName: "Whey protein",
    evidence: {
      populationStudied:
        "Healthy adults in higher-protein renal-function trials plus whey-protein supplement adverse-effect literature.",
      doseFormStudied:
        "Higher-protein diets and whey protein supplementation; product formulations and additives vary.",
      durationStudied:
        "Short-to-moderate trial and review contexts; long-term product-specific safety is not established.",
      comparator:
        "Normal- or lower-protein intake in renal-function trials; mixed comparator contexts in whey adverse-effect reports.",
      evidenceGrade:
        "Source-backed safety-screening packet with renal-function trial synthesis and whey-specific adverse-effect review context.",
      effectSize:
        "Not an efficacy effect-size claim; evidence points to context-dependent renal, hepatic, gastrointestinal, acne, microbiome, allergen, and product-quality considerations.",
      clinicalRelevance:
        "Useful for screening before interpreting whey protein strength or body-composition claims, especially when kidney disease, liver disease, allergies, sedentary context, or high total intake may matter.",
      confidenceLevel: "Low",
      safetyNotes:
        "Healthy-adult renal-function trials do not establish universal safety; whey-specific review literature flags chronic, excessive, or unsupervised use as a concern. No dosing guidance is provided.",
      applicabilityNotes:
        "Applies to general whey/protein safety context, not every whey product, product purity, allergen profile, contaminant testing, or AU/TGA product status.",
      doesNotProve: [
        "Does not prove all whey products are safe, pure, equivalent, or appropriate for every user.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not replace clinician review for kidney disease, liver disease, allergy, medicines, pregnancy, or other individual risk contexts.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: [
        "devries-protein-kidney-2018",
        "vasconcelos-whey-adverse-effects-2021"
      ],
      keyStudyIds: [
        "study-devries-protein-kidney-2018",
        "study-vasconcelos-whey-adverse-effects-2021"
      ],
      scores: {
        evidenceDirectness: 5,
        evidenceRigor: 5,
        effectSize: 1,
        safety: 4,
        regulatoryRisk: 3,
        productQuality: 2,
        hypePenalty: 4,
        measurability: 5
      },
      finalLabel: "Requires Clinician Oversight",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Whey-product-specific tolerability trials, allergen/contaminant testing, longer follow-up, kidney/liver subgroup data, and Australian product-level regulatory review."
    }
  }),
  draftExpansionClaim({
    id: "caffeine-endurance",
    interventionId: "caffeine",
    outcome: "VO2 max/endurance",
    claimText: "Exercise performance or endurance support in reviewed sport-nutrition contexts.",
    supplementName: "Caffeine",
    evidence: {
      populationStudied: "Healthy and trained adults in sport and exercise performance literature.",
      doseFormStudied:
        "Caffeine forms vary across reviewed studies; this dashboard does not provide dosing guidance.",
      durationStudied: "Acute and training-context studies summarized by the position stand.",
      comparator: "Placebo or non-caffeine control in reviewed performance studies.",
      evidenceGrade: "Source-backed sport-nutrition position stand and review.",
      effectSize:
        "Consistent performance-support signal across multiple exercise contexts, with individual variability.",
      clinicalRelevance:
        "Useful for performance contexts; not a health-span, sleep, or safety endorsement.",
      confidenceLevel: "Moderate",
      safetyNotes:
        "Safety and tolerability vary with sleep sensitivity, anxiety, cardiovascular context, pregnancy context, medicines, and total intake.",
      applicabilityNotes:
        "Keep separate from cognition, sleep, and safety claims; those require their own source packets.",
      doesNotProve: [
        "Does not prove sleep support or broad health benefit.",
        "Does not prove safety for sensitive, pregnant, cardiovascular, anxiety, or medication contexts.",
        "Does not establish product-level efficacy, safety, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: ["issn-caffeine-2021"],
      scores: {
        evidenceDirectness: 8,
        evidenceRigor: 8,
        effectSize: 6,
        safety: 5,
        regulatoryRisk: 2,
        productQuality: 4,
        hypePenalty: 3,
        measurability: 8
      },
      finalLabel: "Useful for Specific Use Case",
      whatWouldChangeScore:
        "Endpoint-specific extraction, individual-response and safety stratification, and product-level stimulant quality review."
    }
  }),
  draftExpansionClaim({
    id: "caffeine-cognition",
    interventionId: "caffeine",
    outcome: "Cognition",
    claimText: "Cognitive performance, memory, or attention support.",
    supplementName: "Caffeine",
    evidence: {
      populationStudied:
        "Healthy and trained adults in sport and exercise performance literature, with acute mental-performance context.",
      doseFormStudied:
        "Caffeine forms vary across reviewed studies; this dashboard does not provide dosing guidance.",
      durationStudied: "Mostly acute performance contexts summarized by the position stand.",
      comparator: "Placebo or non-caffeine control in reviewed performance studies.",
      evidenceGrade:
        "Source-backed position stand for acute sport and exercise performance; cognition-specific certainty is limited.",
      effectSize:
        "May support alertness, attention, or fatigue resistance in acute performance settings, with substantial individual variability.",
      clinicalRelevance:
        "Useful only for narrow acute alertness/performance context, not memory enhancement, neuroprotection, or cognitive-disease claims.",
      confidenceLevel: "Low",
      safetyNotes:
        "Safety and tolerability vary with sleep sensitivity, anxiety, cardiovascular context, pregnancy context, medicines, and total intake.",
      applicabilityNotes:
        "Keep separate from sleep and safety claims; this source does not establish broad cognition or brain-health benefit.",
      doesNotProve: [
        "Does not prove memory enhancement, neuroprotection, or treatment of cognitive disorders.",
        "Does not prove benefit when sleep, anxiety, cardiovascular, pregnancy, or medication contexts are unfavorable.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: ["issn-caffeine-2021"],
      keyStudyIds: ["study-issn-caffeine-2021"],
      scores: {
        evidenceDirectness: 5,
        evidenceRigor: 6,
        effectSize: 3,
        safety: 4,
        regulatoryRisk: 2,
        productQuality: 3,
        hypePenalty: 5,
        measurability: 6
      },
      finalLabel: "Reasonable N-of-1 Experiment",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Cognition-specific randomized trials with validated attention, memory, sleep, and adverse-effect endpoints plus product-level stimulant quality review."
    }
  }),
  draftExpansionClaim({
    id: "caffeine-sleep",
    interventionId: "caffeine",
    outcome: "Sleep",
    claimText: "Sleep-disruption risk with later or higher caffeine exposure.",
    supplementName: "Caffeine",
    evidence: {
      populationStudied:
        "Adults in caffeine-and-sleep randomized trial and review contexts; most evidence is not product-specific.",
      doseFormStudied:
        "Coffee, caffeine, and pre-workout caffeine contexts summarized in review evidence; this dashboard does not provide timing or dosing guidance.",
      durationStudied:
        "Acute nighttime sleep outcomes after caffeine exposure, with dose and timing varying across studies.",
      comparator: "Placebo or no-caffeine control in reviewed studies.",
      evidenceGrade:
        "Source-backed systematic review/meta-analysis plus a direct randomized home-environment sleep study.",
      effectSize:
        "Review evidence reports shorter total sleep time, lower sleep efficiency, longer sleep onset, and more wake after sleep onset after caffeine exposure.",
      clinicalRelevance:
        "Relevant as a sleep-risk flag for caffeine users, not a sleep-support claim or individualized sleep-hygiene protocol.",
      confidenceLevel: "Moderate",
      safetyNotes:
        "Sleep disruption sensitivity varies by individual, baseline sleep, total stimulant exposure, medicines, pregnancy context, anxiety, and cardiovascular context.",
      applicabilityNotes:
        "Keep separate from performance and cognition claims; benefit in one context can still trade off against sleep.",
      doesNotProve: [
        "Does not prove caffeine supports sleep quality or sleep continuity.",
        "Does not establish a universally safe cutoff time, dose, or product context.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing, timing, or individualized medical advice."
      ],
      keyReferenceIds: ["gardiner-caffeine-sleep-2023", "drake-caffeine-sleep-2013"],
      keyStudyIds: ["study-gardiner-caffeine-sleep-2023", "study-drake-caffeine-sleep-2013"],
      scores: {
        evidenceDirectness: 7,
        evidenceRigor: 7,
        effectSize: 2,
        safety: 2,
        regulatoryRisk: 2,
        productQuality: 3,
        hypePenalty: 8,
        measurability: 8
      },
      finalLabel: "Safety Concern",
      momentum: "Stable",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Product-specific stimulant amount, individual sleep-sensitivity context, adverse-event extraction, and newer dose-response sleep trials."
    }
  }),
  draftExpansionClaim({
    id: "caffeine-safety",
    interventionId: "caffeine",
    outcome: "Safety/adverse effects",
    claimText: "General safety, tolerability, interaction, and product-quality profile.",
    supplementName: "Caffeine",
    evidence: {
      populationStudied:
        "Healthy adults, pregnant people, adolescents, children, and vulnerable groups in systematic-review and FDA consumer-safety contexts.",
      doseFormStudied:
        "Caffeine from foods, beverages, dietary supplements, energy drinks, and highly concentrated caffeine products; product amounts vary widely.",
      durationStudied:
        "General safety reference and review context, not a duration-matched intervention trial.",
      comparator:
        "Population-specific intake comparators in systematic review evidence; FDA sources are regulatory safety references.",
      evidenceGrade:
        "Source-backed safety packet with systematic review evidence and FDA consumer/regulatory warnings.",
      effectSize:
        "Not an efficacy effect-size claim; captures context-dependent risks including sleep disruption, cardiovascular symptoms, anxiety/jitters, pregnancy/lactation considerations, and concentrated-product toxicity.",
      clinicalRelevance:
        "Useful as a safety-screening packet before interpreting caffeine performance or cognition claims.",
      confidenceLevel: "Moderate",
      safetyNotes:
        "Sensitivity varies by body size, pregnancy or breastfeeding context, medicines, anxiety, cardiovascular context, age, sleep vulnerability, total stimulant exposure, and product concentration.",
      applicabilityNotes:
        "Applies to general caffeine safety context only. It does not establish product quality, product-level safety, or AU/TGA product status.",
      doesNotProve: [
        "Does not prove every caffeine product, drink, or supplement is safe or equivalent.",
        "Does not establish a universally safe amount for every user or health context.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing, timing, or individualized medical advice."
      ],
      keyReferenceIds: [
        "wikoff-caffeine-safety-2017",
        "fda-caffeine-too-much-2024",
        "fda-concentrated-caffeine-2018"
      ],
      keyStudyIds: [
        "study-wikoff-caffeine-safety-2017",
        "study-fda-caffeine-too-much-2024",
        "study-fda-concentrated-caffeine-2018"
      ],
      scores: {
        evidenceDirectness: 7,
        evidenceRigor: 7,
        effectSize: 1,
        safety: 4,
        regulatoryRisk: 3,
        productQuality: 2,
        hypePenalty: 5,
        measurability: 6
      },
      finalLabel: "Requires Clinician Oversight",
      momentum: "Stable",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Product-level caffeine amount verification, contaminant/label testing, Australian product-level regulatory review, and adverse-event extraction by population subgroup."
    }
  }),
  draftExpansionClaim({
    id: "ashwagandha-mood-stress",
    interventionId: "ashwagandha",
    outcome: "Mood/stress",
    claimText: "Stress or anxiety symptom support in reviewed randomized trial contexts.",
    supplementName: "Ashwagandha",
    evidence: {
      populationStudied: "Adults in randomized trials summarized by systematic review.",
      doseFormStudied:
        "Ashwagandha extracts varied across trials; extract standardization and product matching are major limits.",
      durationStudied: "Varied across included trials.",
      comparator: "Placebo or control in reviewed randomized trials.",
      evidenceGrade:
        "Source-backed systematic review/meta-analysis, limited by small trials and extract variability.",
      effectSize:
        "Review reports a stress/anxiety symptom signal, but certainty is constrained by trial size and heterogeneity.",
      clinicalRelevance:
        "Possible stress-symptom support signal; not a mental-health treatment claim.",
      confidenceLevel: "Low",
      safetyNotes:
        "Safety review should consider thyroid, pregnancy, liver, sedative, immunologic, and medication contexts; no dosing guidance is provided.",
      applicabilityNotes:
        "Applies only to studied extract contexts and measured stress/anxiety outcomes.",
      doesNotProve: [
        "Does not prove treatment of anxiety disorders, depression, insomnia, or endocrine conditions.",
        "Does not prove all ashwagandha extracts or products are equivalent.",
        "Does not establish product-level efficacy, safety, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: ["guo-ashwagandha-stress-2022"],
      scores: {
        evidenceDirectness: 6,
        evidenceRigor: 6,
        effectSize: 4,
        safety: 4,
        regulatoryRisk: 3,
        productQuality: 3,
        hypePenalty: 5,
        measurability: 6
      },
      finalLabel: "Reasonable N-of-1 Experiment",
      whatWouldChangeScore:
        "Larger independent trials, extract-matched product evidence, adverse-event extraction, and AU/TGA product-level review."
    }
  }),
  draftExpansionClaim({
    id: "ashwagandha-sleep",
    interventionId: "ashwagandha",
    outcome: "Sleep",
    claimText: "Sleep quality or sleep-continuity support.",
    supplementName: "Ashwagandha",
    evidence: {
      populationStudied:
        "Adults in randomized trials of ashwagandha extract for sleep, including healthy adults with non-restorative sleep and adults with insomnia symptoms.",
      doseFormStudied:
        "Standardized ashwagandha extracts in reviewed trials; extract standardization and product matching are major applicability limits.",
      durationStudied:
        "Short-term sleep trials, commonly 6 to 8 weeks in the cited direct studies and meta-analysis.",
      comparator: "Placebo in randomized trial contexts.",
      evidenceGrade:
        "Source-backed systematic review/meta-analysis plus direct randomized placebo-controlled sleep trials.",
      effectSize:
        "Review evidence reports a small but significant overall sleep signal; direct trials report improvements in subjective and objective sleep measures.",
      clinicalRelevance:
        "Possible sleep-quality support signal in studied adult extract contexts, not an insomnia treatment claim.",
      confidenceLevel: "Low",
      safetyNotes:
        "Serious-adverse-effect and long-term safety data remain limited; interpret alongside separate ashwagandha safety review for liver, thyroid, pregnancy, sedative, immunologic, and medication contexts.",
      applicabilityNotes:
        "Applies only to studied extract contexts and measured sleep outcomes; generic products should not inherit this score without matching evidence.",
      doesNotProve: [
        "Does not prove treatment of insomnia or other sleep disorders.",
        "Does not prove all ashwagandha extracts or products are equivalent.",
        "Does not establish long-term safety, product-level efficacy, quality, or AU/TGA status.",
        "Does not provide dosing, timing, or individualized medical advice."
      ],
      keyReferenceIds: [
        "cheah-ashwagandha-sleep-2021",
        "langade-ashwagandha-sleep-2021",
        "deshpande-ashwagandha-sleep-2020"
      ],
      keyStudyIds: [
        "study-cheah-ashwagandha-sleep-2021",
        "study-langade-ashwagandha-sleep-2021",
        "study-deshpande-ashwagandha-sleep-2020"
      ],
      scores: {
        evidenceDirectness: 6,
        evidenceRigor: 6,
        effectSize: 3,
        safety: 4,
        regulatoryRisk: 3,
        productQuality: 2,
        hypePenalty: 5,
        measurability: 7
      },
      finalLabel: "Reasonable N-of-1 Experiment",
      momentum: "Stable",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Larger independent extract-matched trials, objective sleep replication, long-term safety data, adverse-event extraction, and Australian product-level regulatory review."
    }
  }),
  draftExpansionClaim({
    id: "ashwagandha-fertility-hormones",
    interventionId: "ashwagandha",
    outcome: "Fertility/hormones",
    claimText: "Male semen-parameter and reproductive-hormone biomarker support in limited study contexts.",
    supplementName: "Ashwagandha",
    evidence: {
      populationStudied:
        "Men in male infertility or oligospermia studies, plus systematic-review context dominated by small or observational studies.",
      doseFormStudied:
        "Ashwagandha root extract or root powder in reviewed male fertility studies; extract and preparation matching are major limits.",
      durationStudied: "Mostly short-term male fertility biomarker studies around 90 days.",
      comparator:
        "Placebo in one small randomized pilot study; baseline or fertile-control comparisons in observational/prospective studies.",
      evidenceGrade:
        "Source-backed but limited male fertility packet: systematic review found only one RCT, with additional observational/prospective biomarker evidence.",
      effectSize:
        "Limited studies report semen-parameter and reproductive-hormone biomarker improvements, but certainty is constrained by small samples, study design, and endpoint limitations.",
      clinicalRelevance:
        "Possible male semen-parameter biomarker context only; not a fertility treatment, testosterone optimization, or live-birth claim.",
      confidenceLevel: "Low",
      safetyNotes:
        "Interpret alongside the ashwagandha safety packet, especially thyroid, liver, pregnancy, hormone-sensitive prostate cancer, sedative, immunologic, and medication contexts. No dosing guidance is provided.",
      applicabilityNotes:
        "Applies to studied male biomarker contexts only, not female fertility, hormone treatment, bodybuilding, or every ashwagandha product.",
      doesNotProve: [
        "Does not prove improved pregnancy, live birth, or infertility treatment outcomes.",
        "Does not prove testosterone optimization or treatment of hormone disorders.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing, timing, or individualized medical advice."
      ],
      keyReferenceIds: [
        "durg-ashwagandha-male-infertility-2018",
        "ambiye-ashwagandha-oligospermia-2013",
        "ahmad-ashwagandha-semen-hormones-2010"
      ],
      keyStudyIds: [
        "study-durg-ashwagandha-male-infertility-2018",
        "study-ambiye-ashwagandha-oligospermia-2013",
        "study-ahmad-ashwagandha-semen-hormones-2010"
      ],
      scores: {
        evidenceDirectness: 5,
        evidenceRigor: 4,
        effectSize: 3,
        safety: 3,
        regulatoryRisk: 4,
        productQuality: 2,
        hypePenalty: 7,
        measurability: 7
      },
      finalLabel: "Conditional / Biomarker-Gated",
      momentum: "Stable",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Larger independent RCTs with live-birth or pregnancy outcomes, extract-matched product evidence, long-term safety data, and Australian product-level regulatory review."
    }
  }),
  draftExpansionClaim({
    id: "ashwagandha-safety",
    interventionId: "ashwagandha",
    outcome: "Safety/adverse effects",
    claimText: "General safety, tolerability, interaction, and product-quality profile.",
    supplementName: "Ashwagandha",
    evidence: {
      populationStudied:
        "Generally healthy adults in 23 randomized trials synthesized by a 2026 systematic review of standardized ashwagandha root-only extract.",
      doseFormStudied:
        "Single-ingredient standardized ashwagandha root extract in included trials (125-600 mg/day; commercial products still vary by standardization and quality).",
      durationStudied:
        "Included trial durations ranged from a single dose to 180 days; longer-term safety remains uncertain.",
      comparator: "Placebo or comparator arms across included randomized trials.",
      evidenceGrade:
        "Human-reviewed systematic review of standardized root-extract safety and tolerability biomarkers in generally healthy adults.",
      effectSize:
        "Not an efficacy effect-size claim; synthesis reports biomarkers largely within normal clinical ranges with no clinically meaningful adverse alterations across included trials.",
      clinicalRelevance:
        "Primary safety packet for standardized root-extract tolerability context before interpreting stress, sleep, or hormone-related claims.",
      confidenceLevel: "Moderate",
      safetyNotes:
        "Preserve limits around study duration, formulation variability, rare or idiosyncratic events, vulnerable populations, sedative/thyroid/liver/medication interactions, and product-level AU/TGA boundaries.",
      applicabilityNotes:
        "Applies to standardized root-extract safety synthesis only. It does not establish product quality, product-level safety, or AU/TGA product status.",
      doesNotProve: [
        "Does not prove all ashwagandha products are safe, equivalent, correctly labeled, or appropriate for every user.",
        "Does not establish long-term safety or product-level quality.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing, timing, or individualized medical advice."
      ],
      keyReferenceIds: ["ref-pubmed-42198398"],
      keyStudyIds: ["study-pubmed-42198398-ashwagandha-safety"],
      scores: {
        evidenceDirectness: 7,
        evidenceRigor: 6,
        effectSize: 1,
        safety: 3,
        regulatoryRisk: 4,
        productQuality: 2,
        hypePenalty: 6,
        measurability: 5
      },
      finalLabel: "Requires Clinician Oversight",
      momentum: "Safety concern emerging",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-24",
      whatWouldChangeScore:
        "Longer-duration safety data, vulnerable-population subgroup reporting, product-level ingredient verification, contaminant testing, liver/thyroid interaction evidence, and Australian product-level regulatory review."
    }
  }),
  draftExpansionClaim({
    id: "berberine-glucose",
    interventionId: "berberine",
    outcome: "Glucose/insulin/HbA1c",
    claimText: "Glucose or HbA1c biomarker support in studied type 2 diabetes trial contexts.",
    supplementName: "Berberine",
    evidence: {
      populationStudied:
        "People with type 2 diabetes in randomized trials summarized by systematic review/meta-analysis.",
      doseFormStudied:
        "Berberine preparations varied across trials; no dosing or treatment guidance is provided.",
      durationStudied: "Varied across included randomized trials.",
      comparator: "Placebo, usual care, or comparator therapy contexts across reviewed trials.",
      evidenceGrade:
        "Source-backed systematic review/meta-analysis in type 2 diabetes biomarker contexts.",
      effectSize:
        "Biomarker signal reported for metabolic profiles, but applicability depends on clinical context and co-therapies.",
      clinicalRelevance:
        "Potential biomarker-focused signal only; medical management remains clinician-owned.",
      confidenceLevel: "Low",
      safetyNotes:
        "Medication interactions, pregnancy context, liver/kidney context, glucose-lowering therapy, and product quality require careful review.",
      applicabilityNotes:
        "Most applicable to studied type 2 diabetes biomarker contexts, not broad wellness or prevention claims.",
      doesNotProve: [
        "Does not prove diabetes treatment, medication replacement, or prevention.",
        "Does not prove safety with glucose-lowering medicines or other therapies.",
        "Does not establish product-level efficacy, safety, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: ["guo-berberine-t2dm-2021"],
      scores: {
        evidenceDirectness: 6,
        evidenceRigor: 6,
        effectSize: 5,
        safety: 4,
        regulatoryRisk: 4,
        productQuality: 3,
        hypePenalty: 5,
        measurability: 9
      },
      finalLabel: "Conditional / Biomarker-Gated",
      whatWouldChangeScore:
        "Higher-certainty trial extraction, adverse-event and interaction review, product-standardization evidence, and clinical-context boundaries."
    }
  }),
  draftExpansionClaim({
    id: "berberine-ldl-lipids",
    interventionId: "berberine",
    outcome: "LDL/ApoB/lipids",
    claimText:
      "Modest LDL, triglyceride, and ApoB biomarker support in dyslipidemia trial contexts.",
    supplementName: "Berberine",
    evidence: {
      populationStudied:
        "Adults with dyslipidemia or hyperlipidemia in randomized trials summarized by systematic reviews/meta-analyses.",
      doseFormStudied:
        "Berberine alone and berberine-containing nutraceutical products varied across trials; no dosing or product guidance is provided.",
      durationStudied: "Mostly short-term randomized trial contexts across included reviews.",
      comparator: "Placebo or control contexts across reviewed randomized trials.",
      evidenceGrade:
        "Source-backed systematic reviews/meta-analyses of randomized trials for lipid biomarkers.",
      effectSize:
        "Small to modest lipid biomarker reductions are reported, with heterogeneity and weaker berberine-alone LDL certainty in one recent review.",
      clinicalRelevance:
        "Biomarker-focused support only; lipid disease treatment and medication decisions remain clinician-owned.",
      confidenceLevel: "Low",
      safetyNotes:
        "Adverse-event reporting is limited; medication context, pregnancy/breastfeeding, glucose-lowering therapy, and product quality require separate review.",
      applicabilityNotes:
        "Most applicable to studied dyslipidemia biomarker contexts, not cardiovascular event prevention, longevity, or product-level claims.",
      doesNotProve: [
        "Does not prove cardiovascular event reduction or lipid-disease treatment.",
        "Does not prove medication replacement or safety with lipid/glucose therapies.",
        "Does not establish product-level efficacy, safety, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: [
        "ju-berberine-dyslipidaemia-2018",
        "hernandez-berberine-lipoproteins-2024",
        "blais-berberine-dyslipidemia-2023"
      ],
      keyStudyIds: [
        "study-ju-berberine-dyslipidaemia-2018",
        "study-hernandez-berberine-lipoproteins-2024",
        "study-blais-berberine-dyslipidemia-2023"
      ],
      scores: {
        evidenceDirectness: 6,
        evidenceRigor: 6,
        effectSize: 4,
        safety: 4,
        regulatoryRisk: 4,
        productQuality: 3,
        hypePenalty: 5,
        measurability: 9
      },
      finalLabel: "Conditional / Biomarker-Gated",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Higher-certainty placebo-controlled trials, event-outcome evidence, standardized-product evidence, adverse-event extraction, interaction review, and Australian product-level regulatory review."
    }
  }),
  draftExpansionClaim({
    id: "berberine-safety",
    interventionId: "berberine",
    outcome: "Safety/adverse effects",
    claimText: "General safety, tolerability, interaction, and product-quality profile.",
    supplementName: "Berberine",
    evidence: {
      populationStudied:
        "Adults in dyslipidemia randomized trials plus pregnancy/breastfeeding exposure contexts summarized by MotherToBaby.",
      doseFormStudied:
        "Berberine supplements and berberine-containing products; product quality and formulation matching remain unresolved.",
      durationStudied:
        "Short-term trial contexts for lipid reviews, with separate pregnancy/breastfeeding caution context.",
      comparator:
        "Placebo or control arms in reviewed lipid trials; MotherToBaby safety synthesis for pregnancy and breastfeeding.",
      evidenceGrade:
        "Source-backed safety caveat using randomized-trial reviews plus an NCBI Bookshelf pregnancy/breastfeeding fact sheet.",
      effectSize:
        "No serious adverse events were reported in cited dyslipidemia trial reviews, but gastrointestinal events and special-population cautions remain important.",
      clinicalRelevance:
        "Safety screening and clinician review are important before use with medical conditions, medicines, pregnancy, breastfeeding, or infant exposure.",
      confidenceLevel: "Low",
      safetyNotes:
        "MotherToBaby flags limited pregnancy data, bilirubin-related concern, and breastfeeding caution, especially for newborns; lipid reviews do not resolve long-term or product-level safety.",
      applicabilityNotes:
        "Useful for caution flags only; does not establish safety for a specific product, medical condition, medicine combination, pregnancy, breastfeeding, or AU/TGA status.",
      doesNotProve: [
        "Does not prove general safety, long-term safety, or safety for pregnancy/breastfeeding.",
        "Does not prove safety with glucose-lowering, lipid-lowering, anticoagulant, or other medicines.",
        "Does not establish product-level efficacy, safety, contaminant status, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: [
        "mother-to-baby-berberine-2025",
        "ju-berberine-dyslipidaemia-2018",
        "blais-berberine-dyslipidemia-2023"
      ],
      keyStudyIds: [
        "study-mother-to-baby-berberine-2025",
        "study-ju-berberine-dyslipidaemia-2018",
        "study-blais-berberine-dyslipidemia-2023"
      ],
      scores: {
        evidenceDirectness: 5,
        evidenceRigor: 5,
        effectSize: 1,
        safety: 3,
        regulatoryRisk: 4,
        productQuality: 2,
        hypePenalty: 6,
        measurability: 5
      },
      finalLabel: "Requires Clinician Oversight",
      momentum: "Safety concern emerging",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Structured adverse-event extraction, medication interaction review, pregnancy/breastfeeding evidence, long-term safety data, product-quality testing, and Australian product-level regulatory review."
    }
  }),
  draftExpansionClaim({
    id: "curcumin-inflammation",
    interventionId: "curcumin",
    outcome: "Inflammation",
    claimText:
      "Mixed inflammatory biomarker support, with CRP, IL-6, and TNF-alpha signals varying by population and formulation.",
    supplementName: "Curcumin",
    evidence: {
      populationStudied:
        "Adults in randomized turmeric/curcumin trials, including chronic inflammatory disease and broader adult biomarker contexts.",
      doseFormStudied:
        "Turmeric, curcumin, and curcuminoid supplement preparations varied across trials; formulation and bioavailability are major limits.",
      durationStudied: "Mostly short-term randomized trial contexts across included reviews.",
      comparator: "Placebo or control contexts across reviewed randomized trials.",
      evidenceGrade:
        "Source-backed systematic reviews/meta-analyses of randomized trials with mixed inflammatory-marker findings.",
      effectSize:
        "Some meta-analyses report reductions in CRP, IL-6, and TNF-alpha, while a chronic-inflammatory-disease review found no significant marker reductions.",
      clinicalRelevance:
        "Biomarker-focused signal only; clinical disease treatment, prevention, and medication decisions remain clinician-owned.",
      confidenceLevel: "Low",
      safetyNotes:
        "Safety review should consider gallbladder, anticoagulant/antiplatelet, liver, pregnancy, interaction, and product-quality contexts.",
      applicabilityNotes:
        "Best interpreted as uncertain biomarker support, not a general anti-inflammatory treatment claim.",
      doesNotProve: [
        "Does not prove treatment of inflammatory disease or chronic pain.",
        "Does not prove all turmeric, curcumin, or curcuminoid formulations are equivalent.",
        "Does not establish product-level efficacy, safety, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: [
        "tabrizi-curcumin-inflammation-2019",
        "white-curcumin-inflammatory-markers-2019",
        "dehzad-curcumin-inflammatory-oxidative-2023"
      ],
      keyStudyIds: [
        "study-tabrizi-curcumin-inflammation-2019",
        "study-white-curcumin-inflammatory-markers-2019",
        "study-dehzad-curcumin-inflammatory-oxidative-2023"
      ],
      scores: {
        evidenceDirectness: 5,
        evidenceRigor: 6,
        effectSize: 3,
        safety: 5,
        regulatoryRisk: 3,
        productQuality: 3,
        hypePenalty: 5,
        measurability: 7
      },
      finalLabel: "Reasonable N-of-1 Experiment",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Formulation-specific extraction, larger independent trials with consistent biomarker panels, patient-centered outcomes, adverse-event review, and Australian product-level regulatory review."
    }
  }),
  draftExpansionClaim({
    id: "curcumin-joint-tendon-skin",
    interventionId: "curcumin",
    outcome: "Joint/tendon/skin",
    claimText: "Arthritis symptom support in reviewed turmeric/curcumin randomized trials.",
    supplementName: "Curcumin",
    evidence: {
      populationStudied: "People with arthritis symptoms in randomized clinical trials.",
      doseFormStudied:
        "Turmeric extracts and curcumin products varied; formulation and bioavailability are key limits.",
      durationStudied: "Varied across included randomized trials.",
      comparator: "Placebo or active comparator contexts in reviewed trials.",
      evidenceGrade: "Source-backed systematic review/meta-analysis of randomized clinical trials.",
      effectSize:
        "Symptom-relief signal reported for joint arthritis outcomes, with formulation and trial-quality limits.",
      clinicalRelevance:
        "Most relevant to arthritis symptom measures, not tendon repair or general skin-health claims.",
      confidenceLevel: "Low",
      safetyNotes:
        "Safety review should consider gallbladder, anticoagulant/antiplatelet, liver, pregnancy, and product-quality contexts.",
      applicabilityNotes:
        "Keep tendon and skin claims low until separate source packets are attached.",
      doesNotProve: [
        "Does not prove tendon repair, connective-tissue repair, or skin-health benefit.",
        "Does not prove all curcumin formulations are equivalent.",
        "Does not establish product-level efficacy, safety, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: ["daily-curcumin-arthritis-2016"],
      scores: {
        evidenceDirectness: 5,
        evidenceRigor: 6,
        effectSize: 4,
        safety: 5,
        regulatoryRisk: 3,
        productQuality: 3,
        hypePenalty: 4,
        measurability: 6
      },
      finalLabel: "Reasonable N-of-1 Experiment",
      whatWouldChangeScore:
        "Better formulation-specific extraction, independent large trials, safety review, and separate tendon/skin evidence packets."
    }
  }),
  draftExpansionClaim({
    id: "curcumin-safety",
    interventionId: "curcumin",
    outcome: "Safety/adverse effects",
    claimText: "General safety, tolerability, interaction, and product-quality profile.",
    supplementName: "Curcumin",
    evidence: {
      populationStudied:
        "People using turmeric, curcumin, or Curcuma-containing supplements, including Australia-relevant medicinal-dose safety-alert contexts.",
      doseFormStudied:
        "Turmeric and curcumin products vary widely; enhanced-bioavailability formulations and piperine-containing products are specifically relevant to liver-injury concern.",
      durationStudied:
        "Short-term conventional-use safety contexts plus post-market case-report and safety-alert evidence.",
      comparator:
        "Government safety synthesis, TGA post-market safety investigation, and LiverTox hepatotoxicity review.",
      evidenceGrade:
        "Source-backed safety caveat using NCCIH, TGA, and LiverTox government/reference safety sources.",
      effectSize:
        "Serious liver injury appears rare, but reported cases include severe outcomes; gastrointestinal effects are more common and usually milder.",
      clinicalRelevance:
        "Clinician review is important for liver history, pregnancy/breastfeeding, medication use, gallbladder context, and high-bioavailability products.",
      confidenceLevel: "Low",
      safetyNotes:
        "TGA flags rare liver-injury risk in medicinal dosage forms, especially with enhanced absorption or higher-dose contexts; NCCIH flags pregnancy and liver-symptom cautions.",
      applicabilityNotes:
        "Safety source packet supports caution flags only; it does not establish safety for a specific product, dose, formulation, medicine combination, or AU/TGA status.",
      doesNotProve: [
        "Does not prove general safety, long-term safety, or safety in pregnancy/breastfeeding.",
        "Does not prove safety for enhanced-bioavailability, piperine-containing, or high-dose products.",
        "Does not establish product-level efficacy, safety, contaminant status, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: ["nccih-turmeric", "tga-turmeric-curcumin-liver-2023", "livertox-turmeric"],
      keyStudyIds: [
        "study-nccih-turmeric-safety",
        "study-tga-turmeric-curcumin-liver-2023",
        "study-livertox-turmeric"
      ],
      scores: {
        evidenceDirectness: 6,
        evidenceRigor: 6,
        effectSize: 1,
        safety: 3,
        regulatoryRisk: 5,
        productQuality: 2,
        hypePenalty: 6,
        measurability: 5
      },
      finalLabel: "Requires Clinician Oversight",
      momentum: "Safety concern emerging",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Product-specific ingredient and formulation review, adverse-event extraction, liver-risk subgroup evidence, interaction review, pregnancy/breastfeeding evidence, and Australian product-level regulatory review."
    }
  }),
  draftExpansionClaim({
    id: "hydrolyzed-collagen-joint-tendon-skin",
    interventionId: "hydrolyzed-collagen",
    outcome: "Joint/tendon/skin",
    claimText: "Osteoarthritis symptom support in reviewed collagen supplementation trials.",
    supplementName: "Hydrolyzed collagen",
    evidence: {
      populationStudied: "People with osteoarthritis symptoms in randomized placebo-controlled trials.",
      doseFormStudied:
        "Collagen products varied across trials; hydrolyzed-collagen specificity and product matching remain limited.",
      durationStudied: "Varied across included trials.",
      comparator: "Placebo control in reviewed randomized trials.",
      evidenceGrade: "Source-backed meta-analysis of randomized placebo-controlled trials.",
      effectSize:
        "Reported symptom-score improvements for osteoarthritis outcomes, with product and endpoint heterogeneity.",
      clinicalRelevance:
        "Most relevant to osteoarthritis symptom scales, not proven tendon regeneration or general skin benefit.",
      confidenceLevel: "Low",
      safetyNotes:
        "Safety depends on allergens, contaminants, protein-source quality, total diet, and product quality.",
      applicabilityNotes:
        "Skin and tendon claims need separate source packets; this source packet is joint/OA-focused.",
      doesNotProve: [
        "Does not prove tendon repair or general skin-health benefit.",
        "Does not prove structural joint regeneration.",
        "Does not establish product-level efficacy, safety, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: ["collagen-oa-2018"],
      scores: {
        evidenceDirectness: 5,
        evidenceRigor: 5,
        effectSize: 4,
        safety: 6,
        regulatoryRisk: 2,
        productQuality: 3,
        hypePenalty: 4,
        measurability: 6
      },
      finalLabel: "Reasonable N-of-1 Experiment",
      whatWouldChangeScore:
        "Product-specific extraction, separate tendon/skin evidence packets, adverse-event detail, and product-quality verification."
    }
  }),
  draftExpansionClaim({
    id: "hydrolyzed-collagen-safety",
    interventionId: "hydrolyzed-collagen",
    outcome: "Safety/adverse effects",
    claimText: "General safety, tolerability, interaction, and product-quality profile.",
    supplementName: "Hydrolyzed collagen",
    evidence: {
      populationStudied:
        "Adults in oral collagen or hydrolyzed-collagen randomized trial reviews for skin and osteoarthritis contexts.",
      doseFormStudied:
        "Oral collagen hydrolysate, collagen tripeptide, and collagen-based supplements varied across trials.",
      durationStudied: "Mostly short-term trial contexts, commonly weeks to a few months.",
      comparator: "Placebo-controlled trials summarized by systematic reviews/meta-analyses.",
      evidenceGrade:
        "Source-backed short-term tolerability signal from systematic reviews/meta-analyses of oral collagen trials.",
      effectSize:
        "Trial reviews generally report few or no adverse events, but this is not a long-term or product-quality safety guarantee.",
      clinicalRelevance:
        "Likely lower-risk for many healthy adults in short-term trial contexts, but product source, allergens, contaminants, pregnancy, kidney disease, and total protein intake remain context-specific.",
      confidenceLevel: "Low",
      safetyNotes:
        "Product source, fish/bovine/porcine allergy context, contaminants, added ingredients, kidney disease/protein-load context, pregnancy/breastfeeding, and long-term use are not resolved by these sources.",
      applicabilityNotes:
        "Safety support is limited to studied oral collagen trial contexts and does not transfer automatically to every collagen product or blend.",
      doesNotProve: [
        "Does not prove long-term safety or safety for pregnancy/breastfeeding.",
        "Does not prove safety for allergen-sensitive users, kidney disease, or high total protein intake.",
        "Does not establish product-level efficacy, safety, contaminant status, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: [
        "choi-collagen-dermatology-2019",
        "de-miranda-hydrolyzed-collagen-skin-2021",
        "collagen-oa-2018"
      ],
      keyStudyIds: [
        "study-choi-collagen-dermatology-2019",
        "study-de-miranda-hydrolyzed-collagen-skin-2021",
        "study-collagen-oa-2018"
      ],
      scores: {
        evidenceDirectness: 5,
        evidenceRigor: 5,
        effectSize: 1,
        safety: 6,
        regulatoryRisk: 2,
        productQuality: 3,
        hypePenalty: 4,
        measurability: 4
      },
      finalLabel: "Reasonable N-of-1 Experiment",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Long-term safety studies, adverse-event extraction by collagen source, allergen and contaminant testing, kidney/protein-load subgroup review, pregnancy/breastfeeding data, and Australian product-level regulatory review."
    }
  }),
  draftExpansionClaim({
    id: "melatonin-sleep",
    interventionId: "melatonin",
    outcome: "Sleep",
    claimText:
      "Sleep-onset, total sleep time, or sleep-quality support in primary sleep-disorder trials.",
    supplementName: "Melatonin",
    evidence: {
      populationStudied: "People with primary sleep disorders in trials summarized by meta-analysis.",
      doseFormStudied:
        "Melatonin preparations varied across trials; this dashboard does not provide dosing guidance.",
      durationStudied: "Varied across included trials.",
      comparator: "Placebo or control in reviewed trials.",
      evidenceGrade: "Source-backed meta-analysis for primary sleep disorders.",
      effectSize:
        "Meta-analysis reports improved sleep-onset latency, total sleep time, and sleep-quality measures.",
      clinicalRelevance:
        "Sleep-metric support signal only; not a broad mood/stress or long-term safety claim.",
      confidenceLevel: "Moderate",
      safetyNotes:
        "Safety depends on age, pregnancy context, medicines, next-day impairment risk, sleep-disorder cause, and product quality.",
      applicabilityNotes:
        "Applies to primary sleep-disorder evidence; other sleep contexts need separate source packets.",
      doesNotProve: [
        "Does not prove treatment of every sleep problem or circadian condition.",
        "Does not prove long-term safety in all populations.",
        "Does not establish product-level efficacy, safety, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: ["ferracioli-oda-melatonin-2013"],
      scores: {
        evidenceDirectness: 7,
        evidenceRigor: 7,
        effectSize: 4,
        safety: 5,
        regulatoryRisk: 3,
        productQuality: 4,
        hypePenalty: 4,
        measurability: 7
      },
      finalLabel: "Useful for Specific Use Case",
      whatWouldChangeScore:
        "Population-specific extraction, long-term safety context, product-quality verification, and AU/TGA product-level review."
    }
  }),
  draftExpansionClaim({
    id: "melatonin-safety",
    interventionId: "melatonin",
    outcome: "Safety/adverse effects",
    claimText: "General safety, tolerability, interaction, and product-quality profile.",
    supplementName: "Melatonin",
    evidence: {
      populationStudied:
        "Adults in melatonin adverse-event reviews, children/adolescents in pediatric safety reviews and ingestion surveillance, plus pregnancy/breastfeeding exposure context.",
      doseFormStudied:
        "Melatonin supplements and products varied; gummies and over-the-counter products have special label-accuracy and pediatric-ingestion concerns.",
      durationStudied:
        "Mostly short-term randomized trial contexts, with limited long-term pediatric and adult safety certainty.",
      comparator:
        "Placebo-controlled adverse-event reviews, official safety synthesis, pregnancy/breastfeeding fact sheet, and pediatric poison-control surveillance.",
      evidenceGrade:
        "Source-backed safety caveat using systematic reviews plus NCCIH, MotherToBaby, and CDC/MMWR safety sources.",
      effectSize:
        "Adult short-term adverse events are usually mild, but drowsiness, headache, dizziness, pediatric non-serious adverse events, overdose/ingestion risk, and long-term uncertainty remain important.",
      clinicalRelevance:
        "Clinician review is important for children, pregnancy/breastfeeding, older adults, dementia, epilepsy, anticoagulants, sedating medicines, product-label uncertainty, and chronic use.",
      confidenceLevel: "Low",
      safetyNotes:
        "NCCIH flags long-term uncertainty, medicine interactions, older-adult/dementia concerns, pregnancy/breastfeeding gaps, pediatric ingestion risk, and label variability.",
      applicabilityNotes:
        "Supports short-term tolerability with caution; does not establish chronic-use safety, pediatric self-treatment safety, pregnancy/breastfeeding safety, or product-level quality.",
      doesNotProve: [
        "Does not prove long-term safety or safety for children without clinician oversight.",
        "Does not prove safety in pregnancy, breastfeeding, dementia, epilepsy, anticoagulant use, or sedating medicine contexts.",
        "Does not establish product-level potency accuracy, efficacy, safety, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: [
        "nccih-melatonin",
        "besag-melatonin-adverse-events-2019",
        "menczel-melatonin-high-dose-2022",
        "handel-pediatric-melatonin-safety-2023",
        "mother-to-baby-melatonin-2024",
        "cdc-pediatric-melatonin-ingestions-2022"
      ],
      keyStudyIds: [
        "study-nccih-melatonin-safety",
        "study-besag-melatonin-adverse-events-2019",
        "study-menczel-melatonin-high-dose-2022",
        "study-handel-pediatric-melatonin-safety-2023",
        "study-mother-to-baby-melatonin-2024",
        "study-cdc-pediatric-melatonin-ingestions-2022"
      ],
      scores: {
        evidenceDirectness: 6,
        evidenceRigor: 6,
        effectSize: 1,
        safety: 4,
        regulatoryRisk: 4,
        productQuality: 2,
        hypePenalty: 5,
        measurability: 5
      },
      finalLabel: "Requires Clinician Oversight",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Better long-term safety data, pediatric and older-adult subgroup evidence, medication-interaction extraction, pregnancy/breastfeeding data, product potency/contaminant testing, and Australian product-level regulatory review."
    }
  }),
  draftExpansionClaim({
    id: "melatonin-mood-stress",
    interventionId: "melatonin",
    outcome: "Mood/stress",
    claimText:
      "Situational anxiety and limited depression-score support, with mixed mood-disorder evidence.",
    supplementName: "Melatonin",
    evidence: {
      populationStudied:
        "Adults in perioperative anxiety randomized trials, adults with mood-disorder diagnoses, depression-score trial contexts, postmenopausal women, and post-acute-coronary-syndrome prevention context.",
      doseFormStudied:
        "Melatonin tablets, sublingual forms, or supplements varied across trials; this dashboard does not provide dosing guidance.",
      durationStudied:
        "Acute perioperative use plus mostly short-term depression/anxiety trial contexts.",
      comparator: "Placebo, benzodiazepines, or control contexts across reviewed trials.",
      evidenceGrade:
        "Source-backed but mixed systematic-review evidence: clearer for preoperative anxiety, weaker and inconsistent for mood disorders or depression prevention.",
      effectSize:
        "Cochrane review reports probable preoperative anxiety reduction versus placebo; mood-disorder review found no significant mood-symptom effect, while later depression-score reviews report limited signals in selected contexts.",
      clinicalRelevance:
        "Clinician-owned anxiety or mood context only; not a broad stress resilience, antidepressant, or mental-health treatment claim.",
      confidenceLevel: "Low",
      safetyNotes:
        "Use the melatonin safety packet for long-term uncertainty, pediatric, pregnancy/breastfeeding, medication, next-day impairment, and product-quality caveats.",
      applicabilityNotes:
        "Most applicable to perioperative anxiety evidence and selected studied mood-score contexts, not general mood enhancement.",
      doesNotProve: [
        "Does not prove treatment or prevention of depression, anxiety disorders, bipolar disorder, or seasonal affective disorder.",
        "Does not prove broad stress resilience, emotional wellbeing, or replacement for mental-health care.",
        "Does not establish product-level efficacy, safety, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: [
        "madsen-melatonin-perioperative-anxiety-2020",
        "de-crescenzo-melatonin-mood-disorders-2017",
        "shokri-melatonin-depression-bdnf-2023",
        "demirhan-melatonin-menopause-mood-2024",
        "madsen-medacis-melatonin-acs-2019"
      ],
      keyStudyIds: [
        "study-madsen-melatonin-perioperative-anxiety-2020",
        "study-de-crescenzo-melatonin-mood-disorders-2017",
        "study-shokri-melatonin-depression-bdnf-2023",
        "study-demirhan-melatonin-menopause-mood-2024",
        "study-madsen-medacis-melatonin-acs-2019"
      ],
      scores: {
        evidenceDirectness: 4,
        evidenceRigor: 6,
        effectSize: 3,
        safety: 4,
        regulatoryRisk: 4,
        productQuality: 3,
        hypePenalty: 6,
        measurability: 6
      },
      finalLabel: "Speculative Watchlist",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Mood-disorder-specific high-quality trials, longer follow-up, consistent anxiety/depression endpoints, subgroup clarity, safety extraction, and Australian product-level regulatory review."
    }
  }),
  draftExpansionClaim({
    id: "probiotic-blend-immune-respiratory",
    interventionId: "probiotic-blend",
    outcome: "Immune/respiratory",
    claimText: "Upper-respiratory infection prevention signal in reviewed probiotic-strain trials.",
    supplementName: "Probiotic blend",
    evidence: {
      populationStudied:
        "Adults and children in randomized trials of probiotic strains for acute upper respiratory tract infections.",
      doseFormStudied:
        "Probiotic strains and blends varied; strain identity is a major applicability requirement.",
      durationStudied: "Varied across included prevention trials.",
      comparator: "Placebo or control in reviewed trials.",
      evidenceGrade:
        "Source-backed systematic review with strain-specific applicability and heterogeneity limits.",
      effectSize:
        "Review reports a prevention signal for some probiotic trials, but broad blend-level certainty is low.",
      clinicalRelevance:
        "Potential respiratory-infection prevention signal only when strain/product match is plausible.",
      confidenceLevel: "Low",
      safetyNotes:
        "Safety needs extra caution in immunocompromised, central-line, critically ill, infant, pregnancy, and medication contexts.",
      applicabilityNotes:
        "A generic probiotic blend should not inherit evidence from unrelated strains or products.",
      doesNotProve: [
        "Does not prove all probiotic blends or strains are effective.",
        "Does not prove treatment of respiratory infection or broad immune enhancement.",
        "Does not establish product-level efficacy, safety, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: ["cochrane-probiotics-urti-2022"],
      scores: {
        evidenceDirectness: 4,
        evidenceRigor: 6,
        effectSize: 3,
        safety: 6,
        regulatoryRisk: 2,
        productQuality: 2,
        hypePenalty: 5,
        measurability: 5
      },
      finalLabel: "Reasonable N-of-1 Experiment",
      whatWouldChangeScore:
        "Strain-matched product evidence, population-specific extraction, adverse-event detail, and product-level quality verification."
    }
  }),
  draftExpansionClaim({
    id: "probiotic-blend-safety",
    interventionId: "probiotic-blend",
    outcome: "Safety/adverse effects",
    claimText: "General safety, tolerability, interaction, and product-quality profile.",
    supplementName: "Probiotic blend",
    evidence: {
      populationStudied:
        "Healthy people, probiotic trial participants, and higher-risk groups including premature infants, seriously ill hospital patients, and immunocompromised people.",
      doseFormStudied:
        "Probiotic foods and dietary supplements with single or multiple live microorganism strains; strain identity, CFU-at-end-of-shelf-life, and contamination testing are key product-quality variables.",
      durationStudied:
        "Short-term clinical trial contexts plus post-market and case-report safety concerns.",
      comparator:
        "Government health-professional safety syntheses, published safety reviews, and FDA safety warning context.",
      evidenceGrade:
        "Source-backed safety caveat using ODS/NCCIH guidance, clinical safety reviews, and FDA warning context for preterm infants.",
      effectSize:
        "Generally low adverse-event concern in healthy populations, but serious infections and contamination risks are documented in vulnerable populations and product-quality contexts.",
      clinicalRelevance:
        "Safety depends on strain, product quality, immune status, central-line/hospital context, premature infant status, and underlying illness.",
      confidenceLevel: "Low",
      safetyNotes:
        "NCCIH/ODS flag limited detailed safety data, higher risk in severe illness or compromised immunity, possible infections, harmful substance production, antibiotic-resistance gene transfer, and product contaminants.",
      applicabilityNotes:
        "This safety packet does not transfer automatically to every strain, blend, food, supplement, infant, hospital, or immunocompromised context.",
      doesNotProve: [
        "Does not prove all probiotic strains, blends, or fermented foods are safe.",
        "Does not prove safety in premature infants, immunocompromised people, central-line users, or seriously ill hospital patients.",
        "Does not establish product-level efficacy, viable-count accuracy, contaminant status, safety, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: [
        "ods-probiotics",
        "nccih-probiotics",
        "doron-probiotics-risk-safety-2015",
        "liong-probiotics-translocation-infection-2008",
        "fda-probiotics-preterm-infants-2023"
      ],
      keyStudyIds: [
        "study-ods-probiotics-safety",
        "study-nccih-probiotics-safety",
        "study-doron-probiotics-risk-safety-2015",
        "study-liong-probiotics-translocation-infection-2008",
        "study-fda-probiotics-preterm-infants-2023"
      ],
      scores: {
        evidenceDirectness: 6,
        evidenceRigor: 6,
        effectSize: 1,
        safety: 4,
        regulatoryRisk: 4,
        productQuality: 2,
        hypePenalty: 5,
        measurability: 5
      },
      finalLabel: "Requires Clinician Oversight",
      momentum: "Safety concern emerging",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Strain-specific adverse-event extraction, product-quality and contaminant testing, viable-count verification, high-risk subgroup data, hospital/preterm infant safety review, and Australian product-level regulatory review."
    }
  }),
  draftExpansionClaim({
    id: "probiotic-blend-glucose",
    interventionId: "probiotic-blend",
    outcome: "Glucose/insulin/HbA1c",
    claimText:
      "Glucose, insulin-resistance, or HbA1c biomarker support in studied impaired-glucose and type 2 diabetes trial contexts.",
    supplementName: "Probiotic blend",
    evidence: {
      populationStudied:
        "Adults with type 2 diabetes, prediabetes, or abnormal glucose metabolism in randomized trials summarized by systematic reviews/meta-analyses.",
      doseFormStudied:
        "Probiotic and synbiotic products varied by species, strain, blend, delivery vehicle, CFU count, and duration; no product or dosing guidance is provided.",
      durationStudied: "Mostly short-term to medium-term randomized trial contexts across included reviews.",
      comparator: "Placebo, no intervention, or comparator supplement contexts across randomized trials.",
      evidenceGrade:
        "Source-backed systematic reviews/meta-analyses of randomized trials for glycemic biomarkers.",
      effectSize:
        "Reviews report modest fasting glucose, insulin-resistance, and HbA1c biomarker signals, with heterogeneity and strain/product uncertainty.",
      clinicalRelevance:
        "Biomarker-focused adjunct signal only; diabetes diagnosis, monitoring, medicines, and treatment decisions remain clinician-owned.",
      confidenceLevel: "Low",
      safetyNotes:
        "Use the probiotic safety packet for high-risk population, infection, contamination, strain identity, and product-quality caveats.",
      applicabilityNotes:
        "Most applicable to studied type 2 diabetes or impaired-glucose biomarker contexts, not broad wellness, prevention, or product-level claims.",
      doesNotProve: [
        "Does not prove diabetes treatment, prevention, remission, or medication replacement.",
        "Does not prove every probiotic strain, blend, synbiotic, or fermented food improves glycemic biomarkers.",
        "Does not establish product-level efficacy, viable-count accuracy, contaminant status, safety, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: [
        "rittiphairoj-probiotics-glycemic-t2dm-2021",
        "li-probiotics-glycemic-t2dm-2023",
        "baroni-probiotics-synbiotics-diabetes-2024"
      ],
      keyStudyIds: [
        "study-rittiphairoj-probiotics-glycemic-t2dm-2021",
        "study-li-probiotics-glycemic-t2dm-2023",
        "study-baroni-probiotics-synbiotics-diabetes-2024"
      ],
      scores: {
        evidenceDirectness: 6,
        evidenceRigor: 6,
        effectSize: 4,
        safety: 4,
        regulatoryRisk: 4,
        productQuality: 2,
        hypePenalty: 5,
        measurability: 9
      },
      finalLabel: "Conditional / Biomarker-Gated",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Strain-specific extraction, standardized-product evidence, higher-certainty diabetes subgroup trials, adverse-event review, medication-context boundaries, and Australian product-level regulatory review."
    }
  }),
  draftExpansionClaim({
    id: "coenzyme-q10-blood-pressure",
    interventionId: "coenzyme-q10",
    outcome: "Blood pressure",
    claimText:
      "Modest systolic blood pressure biomarker support in cardiometabolic trial contexts, with mixed primary-hypertension evidence.",
    supplementName: "Coenzyme Q10",
    evidence: {
      populationStudied:
        "Adults in primary hypertension, metabolic disease, and cardiometabolic disorder randomized-trial/meta-analysis contexts; not product-specific.",
      doseFormStudied:
        "Coenzyme Q10 supplements across varied trial formulations; this dashboard does not provide dosing guidance.",
      durationStudied:
        "Varied trial durations across systematic reviews, mostly weeks to months; newer analyses report duration subgroup signals.",
      comparator:
        "Placebo or control in randomized controlled trials summarized by systematic reviews and meta-analyses.",
      evidenceGrade:
        "Mixed source-backed systematic review/meta-analysis evidence: Cochrane primary-hypertension evidence was neutral, while later cardiometabolic reviews report modest systolic signals.",
      effectSize:
        "Later meta-analyses report modest systolic blood pressure reductions, while diastolic blood pressure is inconsistent or non-significant; the Cochrane primary-hypertension review found no clinically significant effect in a small pooled RCT set.",
      clinicalRelevance:
        "Biomarker-only signal for review alongside clinician-managed blood pressure care; not hypertension treatment or medication replacement.",
      confidenceLevel: "Low",
      safetyNotes:
        "Medication context, anticoagulant or warfarin use, cardiovascular disease, pregnancy, and product quality require clinician or product-level review; safety is tracked in a separate packet.",
      applicabilityNotes:
        "Most supportive evidence is from cardiometabolic or metabolic-disease contexts and may not apply to healthy adults, every formulation, every product label, or Australian product status.",
      doesNotProve: [
        "Does not prove hypertension treatment, cardiovascular-event reduction, or medication replacement.",
        "Does not prove benefit for every formulation, dose, duration, product, or healthy-adult context.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: [
        "ho-coq10-bp-primary-hypertension-2016",
        "tabrizi-coq10-bp-metabolic-2018",
        "zhao-coq10-bp-dose-response-2022",
        "karimi-coq10-bp-heart-rate-2025"
      ],
      keyStudyIds: [
        "study-ho-coq10-bp-primary-hypertension-2016",
        "study-tabrizi-coq10-bp-metabolic-2018",
        "study-zhao-coq10-bp-dose-response-2022",
        "study-karimi-coq10-bp-heart-rate-2025"
      ],
      scores: {
        evidenceDirectness: 6,
        evidenceRigor: 6,
        effectSize: 3,
        safety: 4,
        regulatoryRisk: 3,
        productQuality: 2,
        hypePenalty: 5,
        measurability: 9
      },
      finalLabel: "Conditional / Biomarker-Gated",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Product-level formulation review, updated hypertension-specific RCTs, stronger DBP and clinical-outcome evidence, adverse-event extraction, medication-interaction review, and Australian product-level regulatory verification."
    }
  }),
  draftExpansionClaim({
    id: "coenzyme-q10-safety",
    interventionId: "coenzyme-q10",
    outcome: "Safety/adverse effects",
    claimText: "General safety, tolerability, interaction, and product-quality profile.",
    supplementName: "Coenzyme Q10",
    evidence: {
      populationStudied:
        "Adults in supplement safety reviews, official health summaries, liver-safety reference context, and medication-interaction reports; pregnancy, children, cancer-treatment, and complex medication contexts are not cleared by this packet.",
      doseFormStudied:
        "Coenzyme Q10, ubiquinone, and ubiquinol supplement contexts; product formulation, contaminants, label accuracy, and Australian product status vary by product.",
      durationStudied:
        "General safety literature and reference context across short- and longer-term supplement use; not a product-specific longitudinal safety study.",
      comparator:
        "Safety review, risk-assessment, official NIH/NCCIH and LiverTox reference context, plus warfarin interaction case-report evidence.",
      evidenceGrade:
        "Source-backed safety packet combining official health references, indexed safety/risk reviews, and low-level interaction signal evidence.",
      effectSize:
        "Not an efficacy effect-size claim; sources generally describe low toxicity and mostly mild adverse effects, while flagging possible interactions with warfarin, insulin, and some cancer-treatment contexts.",
      clinicalRelevance:
        "Useful as a safety-screening packet before interpreting CoQ10 benefit claims; medication, oncology, pregnancy, pediatric, liver-disease, and product-quality questions remain clinician/product-level review items.",
      confidenceLevel: "Low",
      safetyNotes:
        "NCCIH reports no serious side effects but notes mild insomnia or digestive upset and possible interaction with warfarin, insulin, and some cancer treatments. LiverTox reports no convincing clinically apparent liver injury signal.",
      applicabilityNotes:
        "Does not establish safety for every formulation, dose, duration, product, medicine combination, health condition, or Australian market product.",
      doesNotProve: [
        "Does not prove CoQ10 is safe for warfarin, insulin, chemotherapy, pregnancy, pediatric, perioperative, or complex medication contexts.",
        "Does not prove every CoQ10 product is accurately labeled, contaminant-free, or equivalent.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: [
        "nccih-coq10",
        "hidaka-coq10-safety-2008",
        "hathcock-coq10-risk-assessment-2006",
        "livertox-coq10-2024",
        "landbo-warfarin-coq10-1998"
      ],
      keyStudyIds: [
        "study-nccih-coq10",
        "study-hidaka-coq10-safety-2008",
        "study-hathcock-coq10-risk-assessment-2006",
        "study-livertox-coq10-2024",
        "study-landbo-warfarin-coq10-1998"
      ],
      scores: {
        evidenceDirectness: 5,
        evidenceRigor: 5,
        effectSize: 1,
        safety: 5,
        regulatoryRisk: 4,
        productQuality: 2,
        hypePenalty: 5,
        measurability: 5
      },
      finalLabel: "Requires Clinician Oversight",
      momentum: "Stable",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Product-specific contaminant and label testing, Australian product-level regulatory review, adverse-event extraction from larger modern trials, and clearer medication-interaction evidence for anticoagulant, diabetes, oncology, pregnancy, pediatric, and perioperative contexts."
    }
  }),
  draftExpansionClaim({
    id: "l-theanine-mood-stress",
    interventionId: "l-theanine",
    outcome: "Mood/stress",
    claimText:
      "Low-confidence stress and anxiety-symptom support in small human trial contexts, with negative generalized-anxiety adjunctive treatment evidence.",
    supplementName: "L-theanine",
    evidence: {
      populationStudied:
        "Healthy or generally stressed adults in small acute and short-term trials, plus adults with generalized anxiety disorder in an adjunctive randomized trial.",
      doseFormStudied:
        "L-theanine supplements or administered L-theanine in trial contexts; this dashboard does not provide dosing guidance.",
      durationStudied:
        "Acute stress-task studies, a four-week healthy-adult crossover trial, and longer adjunctive generalized-anxiety treatment context.",
      comparator:
        "Placebo or control in randomized trials, summarized with a systematic review of stress and anxiety evidence.",
      evidenceGrade:
        "Source-backed systematic review plus small randomized trials; psychiatric-treatment evidence is mixed and includes a negative GAD adjunctive trial.",
      effectSize:
        "Small trials report lower stress-related symptoms, tension-anxiety scores, or stress-response biomarkers, but the GAD adjunctive trial did not show an anxiolytic effect on its primary anxiety outcome.",
      clinicalRelevance:
        "Potentially relevant for self-tracked nonclinical stress response or calmness, not treatment of anxiety disorders or replacement for mental-health care.",
      confidenceLevel: "Low",
      safetyNotes:
        "Safety, medication, pregnancy, pediatric, sedation, driving, and product-quality contexts need a separate safety packet before stronger interpretation.",
      applicabilityNotes:
        "Small samples, mixed populations, and stress-task endpoints limit generalization to every user, product, dose, or mental-health context.",
      doesNotProve: [
        "Does not prove treatment for generalized anxiety disorder, depression, panic, insomnia, or other mental-health conditions.",
        "Does not prove durable benefit, dose-response certainty, or benefit for every formulation or product.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: [
        "williams-l-theanine-stress-anxiety-2020",
        "hidese-l-theanine-stress-cognition-2019",
        "kimura-l-theanine-stress-response-2007",
        "yoto-l-theanine-stress-bp-2012",
        "sarris-l-theanine-gad-2019"
      ],
      keyStudyIds: [
        "study-williams-l-theanine-stress-anxiety-2020",
        "study-hidese-l-theanine-stress-cognition-2019",
        "study-kimura-l-theanine-stress-response-2007",
        "study-yoto-l-theanine-stress-bp-2012",
        "study-sarris-l-theanine-gad-2019"
      ],
      scores: {
        evidenceDirectness: 5,
        evidenceRigor: 5,
        effectSize: 3,
        safety: 4,
        regulatoryRisk: 3,
        productQuality: 2,
        hypePenalty: 6,
        measurability: 7
      },
      finalLabel: "Reasonable N-of-1 Experiment",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Larger modern RCTs with validated stress/anxiety outcomes, preregistered dose-response analysis, adverse-event extraction, product-level quality review, and separate psychiatric-diagnosis subgroup evidence."
    }
  }),
  draftExpansionClaim({
    id: "l-theanine-sleep",
    interventionId: "l-theanine",
    outcome: "Sleep",
    claimText:
      "Low-confidence sleep-quality signal in small human trials, strongest in pediatric ADHD sleep-continuity context and not established as general insomnia treatment.",
    supplementName: "L-theanine",
    evidence: {
      populationStudied:
        "Boys with ADHD in an objective sleep-quality RCT, healthy adults in a small crossover trial, and pediatric ADHD/mental-disorder populations summarized in systematic reviews.",
      doseFormStudied:
        "L-theanine supplement or chewable-tablet trial contexts; this dashboard does not provide dosing guidance.",
      durationStudied:
        "Four- to six-week trial contexts plus systematic-review summaries; not long-term sleep safety or effectiveness evidence.",
      comparator:
        "Placebo or control in randomized trial contexts, summarized alongside systematic reviews.",
      evidenceGrade:
        "Source-backed but narrow evidence: one pediatric ADHD objective-sleep RCT, one small healthy-adult trial with PSQI sleep subscale signals, and reviews rating the pediatric insomnia evidence as limited.",
      effectSize:
        "The ADHD RCT reported improved actigraphy sleep percentage and sleep efficiency, while the healthy-adult crossover trial reported lower PSQI scores and sleep-latency/disturbance subscale improvements.",
      clinicalRelevance:
        "Potential sleep-quality or sleep-continuity signal for careful self-tracking, not insomnia treatment, ADHD treatment, sedative guidance, or pediatric use advice.",
      confidenceLevel: "Low",
      safetyNotes:
        "Safety, pediatric use, medication, pregnancy, sedation, driving, and product-quality contexts require separate review before stronger interpretation.",
      applicabilityNotes:
        "Pediatric ADHD and small adult stress-related-symptom contexts may not apply to healthy adult insomnia, every formulation, or every product.",
      doesNotProve: [
        "Does not prove treatment for insomnia, ADHD, anxiety, depression, or other mental-health conditions.",
        "Does not prove benefit for every adult, child, sleep problem, formulation, dose, duration, or product.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: [
        "lyon-l-theanine-adhd-sleep-2011",
        "hidese-l-theanine-stress-cognition-2019",
        "anand-adhd-insomnia-drugs-2017",
        "moshfeghinia-l-theanine-mental-disorders-2024"
      ],
      keyStudyIds: [
        "study-lyon-l-theanine-adhd-sleep-2011",
        "study-hidese-l-theanine-stress-cognition-2019",
        "study-anand-adhd-insomnia-drugs-2017",
        "study-moshfeghinia-l-theanine-mental-disorders-2024"
      ],
      scores: {
        evidenceDirectness: 4,
        evidenceRigor: 5,
        effectSize: 3,
        safety: 3,
        regulatoryRisk: 3,
        productQuality: 2,
        hypePenalty: 7,
        measurability: 8
      },
      finalLabel: "Speculative Watchlist",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Larger adult sleep RCTs with objective and validated subjective endpoints, adverse-event extraction, pediatric-specific safety review, product-level quality review, and clear separation from insomnia or ADHD treatment claims."
    }
  }),
  draftExpansionClaim({
    id: "beta-alanine-endurance",
    interventionId: "beta-alanine",
    outcome: "VO2 max/endurance",
    claimText:
      "Specific support for high-intensity exercise capacity and fatigue resistance, especially short-to-moderate duration efforts, without proving VO2 max or longevity benefit.",
    supplementName: "Beta-alanine",
    evidence: {
      populationStudied:
        "Healthy and athletic participants in exercise-performance trials summarized by meta-analyses and a sports-nutrition position stand.",
      doseFormStudied:
        "Beta-alanine supplementation across chronic trial protocols; this dashboard does not provide dosing guidance.",
      durationStudied:
        "Chronic supplementation protocols in exercise-performance studies, with exercise tests commonly in short-to-moderate high-intensity ranges.",
      comparator:
        "Placebo or control in double-blind exercise trials summarized by systematic review/meta-analysis and position-stand evidence.",
      evidenceGrade:
        "Source-backed sports-performance evidence from position stand plus meta-analyses; strongest for exercise capacity rather than broad endurance or VO2 max.",
      effectSize:
        "Saunders 2017 found a small significant overall effect and larger effects for 0.5-10 minute exercise capacity than for performance outcomes.",
      clinicalRelevance:
        "Useful for a specific ergogenic context, not a general healthspan, cardiometabolic, VO2 max, or disease-treatment claim.",
      confidenceLevel: "Moderate",
      safetyNotes:
        "Paresthesia/tolerability, medication context, pregnancy, pediatric use, pre-workout blends, and product quality require the separate safety packet.",
      applicabilityNotes:
        "Most useful where the user's target activity resembles the studied high-intensity exercise protocols and outcomes are measured directly.",
      doesNotProve: [
        "Does not prove VO2 max improvement, longevity benefit, disease treatment, or broad endurance benefit for every sport.",
        "Does not prove benefit for every formulation, dose, duration, training status, or pre-workout blend.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing or individualized training or medical advice."
      ],
      keyReferenceIds: [
        "issn-beta-alanine-position-stand-2015",
        "hobson-beta-alanine-performance-2012",
        "saunders-beta-alanine-exercise-2017"
      ],
      keyStudyIds: [
        "study-issn-beta-alanine-position-stand-2015",
        "study-hobson-beta-alanine-performance-2012",
        "study-saunders-beta-alanine-exercise-2017"
      ],
      scores: {
        evidenceDirectness: 7,
        evidenceRigor: 7,
        effectSize: 4,
        safety: 4,
        regulatoryRisk: 3,
        productQuality: 3,
        hypePenalty: 4,
        measurability: 9
      },
      finalLabel: "Useful for Specific Use Case",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Sport-specific extraction, direct VO2 max trials if claiming VO2 max, adverse-event review, pre-workout blend/product-quality review, and Australian product-level regulatory verification."
    }
  }),
  draftExpansionClaim({
    id: "beta-alanine-safety",
    interventionId: "beta-alanine",
    outcome: "Safety/adverse effects",
    claimText: "General safety, tolerability, interaction, and product-quality profile.",
    supplementName: "Beta-alanine",
    evidence: {
      populationStudied:
        "Mostly healthy, athletic, recreationally trained, and military-relevant populations in beta-alanine safety reviews and sports-nutrition literature.",
      doseFormStudied:
        "Oral beta-alanine supplementation in isolated supplement studies and sports-nutrition contexts; pre-workout blend safety and product contaminants are separate.",
      durationStudied:
        "Acute and longitudinal human studies summarized in risk-assessment literature, plus broader review/position-stand context.",
      comparator:
        "Placebo or control in many human studies, with systematic risk assessment including human and animal evidence.",
      evidenceGrade:
        "Source-backed safety packet using a systematic risk assessment/meta-analysis plus sports-nutrition position stand and military-focused evidence review.",
      effectSize:
        "Not an efficacy effect-size claim. Paresthesia is the main reported side effect; the 2019 risk assessment reported higher paresthesia odds versus placebo but similar dropout rates.",
      clinicalRelevance:
        "Useful as a tolerability and screening packet before interpreting beta-alanine performance claims, especially around paresthesia, blends, and product quality.",
      confidenceLevel: "Moderate",
      safetyNotes:
        "Paresthesia/tingling is the primary known tolerability issue. Medication, pregnancy, pediatric, neurologic, renal/hepatic, high-dose, blend, and product-quality contexts require separate review.",
      applicabilityNotes:
        "Available safety evidence is strongest for studied supplement contexts in generally healthy populations, not every user, long-term use pattern, product, or combination formula.",
      doesNotProve: [
        "Does not prove every beta-alanine product, pre-workout blend, high-dose pattern, or long-term use context is safe.",
        "Does not prove safety for pregnancy, pediatric use, medication contexts, neurologic symptoms, renal/hepatic disease, or complex health conditions.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: [
        "dolan-beta-alanine-risk-assessment-2019",
        "issn-beta-alanine-position-stand-2015",
        "ko-beta-alanine-military-2014"
      ],
      keyStudyIds: [
        "study-dolan-beta-alanine-risk-assessment-2019",
        "study-issn-beta-alanine-position-stand-2015",
        "study-ko-beta-alanine-military-2014"
      ],
      scores: {
        evidenceDirectness: 6,
        evidenceRigor: 6,
        effectSize: 1,
        safety: 5,
        regulatoryRisk: 3,
        productQuality: 2,
        hypePenalty: 5,
        measurability: 6
      },
      finalLabel: "Requires Clinician Oversight",
      momentum: "Stable",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Long-term adverse-event surveillance, product-level contaminant/label testing, blend-specific stimulant and ingredient review, sensitive-population data, and Australian product-level regulatory verification."
    }
  }),
  draftExpansionClaim({
    id: "l-citrulline-blood-pressure",
    interventionId: "l-citrulline",
    outcome: "Blood pressure",
    claimText:
      "Mixed blood pressure biomarker support, with modest signals in selected adult, older-adult, and cold-exposure contexts but neutral findings in earlier pooled analyses.",
    supplementName: "L-citrulline",
    evidence: {
      populationStudied:
        "Adults in clinical trials and meta-analyses, including middle-aged/older adults and cold-exposure contexts; not product-specific.",
      doseFormStudied:
        "L-citrulline supplementation and some watermelon-intake contexts across reviews; this dashboard does not provide dosing guidance.",
      durationStudied:
        "Short- to medium-term clinical trial contexts summarized by systematic reviews; not long-term cardiovascular outcomes evidence.",
      comparator:
        "Placebo or control in randomized clinical trials summarized by systematic reviews and meta-analyses.",
      evidenceGrade:
        "Mixed source-backed systematic review/meta-analysis evidence: earlier pooled analysis was neutral, while later adult subgroup and cold-exposure reviews report reductions.",
      effectSize:
        "Signals range from no significant brachial/aortic BP effect in one 2018 review to modest SBP/DBP reductions in later middle-aged/older adult and cold-exposure meta-analyses.",
      clinicalRelevance:
        "Blood-pressure biomarker signal only; hypertension diagnosis, medication decisions, cardiovascular disease prevention, and clinical management remain clinician-owned.",
      confidenceLevel: "Low",
      safetyNotes:
        "Medication context, hypotension risk, cardiovascular disease, kidney disease, pregnancy, blend ingredients, and product quality require separate safety review.",
      applicabilityNotes:
        "Most supportive evidence is context-specific and may not apply to healthy adults, every formulation, watermelon products, combination formulas, or Australian product status.",
      doesNotProve: [
        "Does not prove hypertension treatment, medication replacement, cardiovascular-event reduction, or durable clinical benefit.",
        "Does not prove benefit for every formulation, product, dose, duration, population, or blood-pressure context.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: [
        "mirenayat-l-citrulline-bp-2018",
        "barkhidarian-l-citrulline-bp-2019",
        "luo-l-citrulline-bp-older-adults-2025",
        "luo-l-citrulline-cold-bp-2026"
      ],
      keyStudyIds: [
        "study-mirenayat-l-citrulline-bp-2018",
        "study-barkhidarian-l-citrulline-bp-2019",
        "study-luo-l-citrulline-bp-older-adults-2025",
        "study-luo-l-citrulline-cold-bp-2026"
      ],
      scores: {
        evidenceDirectness: 6,
        evidenceRigor: 6,
        effectSize: 3,
        safety: 4,
        regulatoryRisk: 3,
        productQuality: 2,
        hypePenalty: 5,
        measurability: 9
      },
      finalLabel: "Conditional / Biomarker-Gated",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Updated extraction by baseline BP, age, cold-exposure status, formulation, combination ingredients, adverse events, medication context, and Australian product-level regulatory review."
    }
  }),
  draftExpansionClaim({
    id: "l-citrulline-endurance",
    interventionId: "l-citrulline",
    outcome: "VO2 max/endurance",
    claimText:
      "Limited exercise-support signal for perceived exertion, soreness, or repetition-performance contexts, without proving VO2 max, strength, or broad endurance benefit.",
    supplementName: "L-citrulline",
    evidence: {
      populationStudied:
        "Healthy adults, resistance-trained adults, and exercise-trial participants in citrulline or citrulline-malate randomized trials summarized by meta-analyses.",
      doseFormStudied:
        "L-citrulline and citrulline malate supplement contexts; this dashboard does not provide dosing guidance.",
      durationStudied:
        "Mostly acute pre-exercise and short-term resistance-exercise contexts summarized by systematic reviews.",
      comparator:
        "Placebo or control in randomized controlled exercise trials.",
      evidenceGrade:
        "Mixed source-backed systematic review/meta-analysis evidence; strongest for perceived exertion and soreness, weaker or neutral for strength and broad endurance outcomes.",
      effectSize:
        "Rhim 2020 reported reduced post-exercise RPE and some muscle-soreness outcomes without lower lactate, while Aguiar 2022 found no overall strength benefit in resistance-trained adults.",
      clinicalRelevance:
        "Potentially useful only for self-tracked exercise-session outcomes such as RPE, soreness, or repetitions; not a cardiovascular fitness, VO2 max, or healthspan claim.",
      confidenceLevel: "Low",
      safetyNotes:
        "Medication context, cardiovascular disease, kidney disease, pregnancy, blend ingredients, gastrointestinal tolerance, and product quality require separate safety review.",
      applicabilityNotes:
        "Citrulline malate, L-citrulline, exercise mode, timing, and outcome choice differ across studies and should not be treated as interchangeable.",
      doesNotProve: [
        "Does not prove VO2 max improvement, strength gain, endurance benefit, longevity benefit, or disease treatment.",
        "Does not prove benefit for every formulation, exercise type, timing, product, dose, or training status.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing, training, or individualized medical advice."
      ],
      keyReferenceIds: [
        "rhim-citrulline-rpe-soreness-2020",
        "varvik-citrulline-repetition-performance-2021",
        "aguiar-citrulline-malate-strength-2022"
      ],
      keyStudyIds: [
        "study-rhim-citrulline-rpe-soreness-2020",
        "study-varvik-citrulline-repetition-performance-2021",
        "study-aguiar-citrulline-malate-strength-2022"
      ],
      scores: {
        evidenceDirectness: 5,
        evidenceRigor: 6,
        effectSize: 3,
        safety: 4,
        regulatoryRisk: 3,
        productQuality: 2,
        hypePenalty: 6,
        measurability: 8
      },
      finalLabel: "Reasonable N-of-1 Experiment",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Endpoint-specific extraction by exercise mode, direct VO2 max/endurance trials, adverse-event review, formulation matching, product-level quality review, and Australian product-level regulatory verification."
    }
  }),
  draftExpansionClaim({
    id: "taurine-blood-pressure",
    interventionId: "taurine",
    outcome: "Blood pressure",
    claimText:
      "Cardiometabolic blood pressure biomarker support in randomized-trial meta-analyses, without proving hypertension treatment or cardiovascular event reduction.",
    supplementName: "Taurine",
    evidence: {
      populationStudied:
        "Adults in randomized clinical trials and cardiometabolic/metabolic-syndrome meta-analyses; many studies involve metabolic, liver, obesity, diabetes, or related risk contexts.",
      doseFormStudied:
        "Oral taurine supplementation in clinical-trial contexts; this dashboard does not provide dosing guidance.",
      durationStudied:
        "Short- to medium-term randomized trial contexts summarized by meta-analyses; not long-term cardiovascular outcomes evidence.",
      comparator:
        "Placebo or control in randomized clinical trials summarized by systematic reviews and meta-analyses.",
      evidenceGrade:
        "Source-backed meta-analysis evidence for BP and cardiometabolic biomarkers, with uncertainty around population specificity and long-term outcomes.",
      effectSize:
        "Meta-analyses report modest reductions in systolic and diastolic blood pressure alongside other cardiometabolic biomarker changes.",
      clinicalRelevance:
        "Biomarker-only signal for risk-factor tracking; hypertension diagnosis, treatment, medication decisions, and cardiovascular prevention remain clinician-owned.",
      confidenceLevel: "Low",
      safetyNotes:
        "Medication context, hypotension risk, cardiovascular disease, kidney disease, pregnancy, high intake, energy drinks/blends, and product quality require separate safety review.",
      applicabilityNotes:
        "Evidence often comes from cardiometabolic-risk populations and may not apply to healthy adults, every product, every baseline BP, or Australian product status.",
      doesNotProve: [
        "Does not prove hypertension treatment, medication replacement, cardiovascular-event reduction, or durable clinical benefit.",
        "Does not prove benefit for every formulation, product, dose, duration, baseline BP, or population.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: [
        "guan-taurine-bp-lipids-2020",
        "tzang-taurine-metabolic-syndrome-2024",
        "nie-taurine-cardiometabolic-2025"
      ],
      keyStudyIds: [
        "study-guan-taurine-bp-lipids-2020",
        "study-tzang-taurine-metabolic-syndrome-2024",
        "study-nie-taurine-cardiometabolic-2025"
      ],
      scores: {
        evidenceDirectness: 6,
        evidenceRigor: 6,
        effectSize: 3,
        safety: 4,
        regulatoryRisk: 3,
        productQuality: 2,
        hypePenalty: 5,
        measurability: 9
      },
      finalLabel: "Conditional / Biomarker-Gated",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Extraction by baseline BP and metabolic context, adverse-event review, energy-drink/blend separation, medication context, product-quality review, and Australian product-level regulatory verification."
    }
  }),
  draftExpansionClaim({
    id: "taurine-safety",
    interventionId: "taurine",
    outcome: "Safety/adverse effects",
    claimText: "General safety, tolerability, interaction, and product-quality profile.",
    supplementName: "Taurine",
    evidence: {
      populationStudied:
        "Adults in supplement risk-assessment literature, EFSA energy-drink constituent review, and randomized cardiometabolic trials; not product-specific.",
      doseFormStudied:
        "Oral taurine supplementation and taurine as an energy-drink constituent; energy-drink blends, caffeine, alcohol co-use, and product contaminants are separate safety contexts.",
      durationStudied:
        "Short- to medium-term randomized trial contexts plus safety/risk-assessment reviews; not long-term high-intake surveillance.",
      comparator:
        "Risk-assessment review, EFSA regulatory opinion, and placebo/control randomized trial adverse-event context.",
      evidenceGrade:
        "Source-backed safety packet combining risk assessment, regulatory ingredient review, and RCT meta-analysis adverse-event reporting.",
      effectSize:
        "Not an efficacy effect-size claim. Metabolic-syndrome RCT meta-analysis reported no significant adverse effects versus control, while risk/regulatory sources frame safety by exposure context.",
      clinicalRelevance:
        "Useful as a general safety-screening packet before interpreting taurine benefit claims; medication, hypotension, kidney/cardiovascular disease, pregnancy, pediatric, energy-drink, and product-quality contexts remain review items.",
      confidenceLevel: "Low",
      safetyNotes:
        "Do not treat taurine safety in isolated trials as clearance for energy drinks, stimulant blends, high intake, medical conditions, or medication combinations.",
      applicabilityNotes:
        "Evidence does not establish safety for every product, every intake pattern, every population, or Australian market status.",
      doesNotProve: [
        "Does not prove every taurine product, energy drink, stimulant blend, high-intake pattern, or long-term use context is safe.",
        "Does not prove safety for pregnancy, pediatric use, kidney disease, cardiovascular disease, hypotension-prone users, or medication contexts.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: [
        "shao-taurine-risk-assessment-2008",
        "efsa-taurine-energy-drinks-2009",
        "tzang-taurine-metabolic-syndrome-2024"
      ],
      keyStudyIds: [
        "study-shao-taurine-risk-assessment-2008",
        "study-efsa-taurine-energy-drinks-2009",
        "study-tzang-taurine-metabolic-syndrome-2024"
      ],
      scores: {
        evidenceDirectness: 5,
        evidenceRigor: 5,
        effectSize: 1,
        safety: 5,
        regulatoryRisk: 4,
        productQuality: 2,
        hypePenalty: 5,
        measurability: 5
      },
      finalLabel: "Requires Clinician Oversight",
      momentum: "Stable",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Long-term adverse-event surveillance, sensitive-population data, medication and hypotension-context extraction, energy-drink/blend separation, product-quality review, and Australian product-level regulatory verification."
    }
  }),
  draftExpansionClaim({
    id: "n-acetylcysteine-immune-respiratory",
    interventionId: "n-acetylcysteine",
    outcome: "Immune/respiratory",
    claimText:
      "Respiratory exacerbation and mucus/symptom support in chronic bronchitis or COPD mucolytic contexts, without proving broad immune support.",
    supplementName: "N-acetylcysteine",
    evidence: {
      populationStudied:
        "Adults with chronic bronchitis, chronic bronchitis/pre-COPD, or COPD in mucolytic systematic reviews and randomized COPD trials; not healthy adults or acute infection populations.",
      doseFormStudied:
        "Oral N-acetylcysteine or oral mucolytic trial contexts; this dashboard does not provide dosing guidance.",
      durationStudied:
        "At least two-month mucolytic trials in the Cochrane review, with key NAC COPD trials and longer-duration sensitivity analyses extending to around one year.",
      comparator:
        "Placebo or usual-therapy control in randomized chronic bronchitis/COPD trial contexts.",
      evidenceGrade:
        "Source-backed respiratory packet combining an NAC-specific meta-analysis, Cochrane mucolytic review, and direct randomized COPD trials; interpretation is limited by heterogeneity and disease-context specificity.",
      effectSize:
        "Cochrane 2019 found a small reduction in acute exacerbations and disability days for mucolytics, while NAC-specific synthesis and PANTHEON/HIACE trial evidence report fewer COPD exacerbations in studied populations.",
      clinicalRelevance:
        "Potentially useful only as a chronic bronchitis/COPD respiratory-support evidence packet; diagnosis, exacerbation prevention, medicines, and respiratory disease management remain clinician-owned.",
      confidenceLevel: "Moderate",
      safetyNotes:
        "Interpret alongside the NAC safety packet. Respiratory disease, asthma/bronchospasm risk, medicines, pregnancy, pediatric use, formulation, and product quality require separate review.",
      applicabilityNotes:
        "Does not generalize to generic immune enhancement, acute respiratory infections, healthy adults, every NAC product, inhaled/medical acetylcysteine, or Australian product status.",
      doesNotProve: [
        "Does not prove broad immune boosting, infection prevention, COVID treatment, or benefit for healthy adults.",
        "Does not prove treatment of COPD, chronic bronchitis, asthma, or acute respiratory disease, or replacement for prescribed care.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: [
        "papi-nac-copd-chronic-bronchitis-2024",
        "poole-mucolytics-copd-2019",
        "zheng-pantheon-nac-copd-2014",
        "tse-hiace-nac-copd-2013"
      ],
      keyStudyIds: [
        "study-papi-nac-copd-chronic-bronchitis-2024",
        "study-poole-mucolytics-copd-2019",
        "study-zheng-pantheon-nac-copd-2014",
        "study-tse-hiace-nac-copd-2013"
      ],
      scores: {
        evidenceDirectness: 7,
        evidenceRigor: 7,
        effectSize: 4,
        safety: 4,
        regulatoryRisk: 4,
        productQuality: 2,
        hypePenalty: 6,
        measurability: 7
      },
      finalLabel: "Useful for Specific Use Case",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Endpoint-specific extraction by COPD severity and exacerbation history, safety/adverse-event packet completion, medication and asthma-context review, product-quality review, and Australian product-level regulatory verification."
    }
  }),
  draftExpansionClaim({
    id: "n-acetylcysteine-safety",
    interventionId: "n-acetylcysteine",
    outcome: "Safety/adverse effects",
    claimText: "General safety, tolerability, interaction, and product-quality profile.",
    supplementName: "N-acetylcysteine",
    evidence: {
      populationStudied:
        "Adults in COPD/chronic bronchitis mucolytic trials, sports-supplement trial literature, and official acetylcysteine drug-label/regulatory supplement contexts; not product-specific.",
      doseFormStudied:
        "Oral NAC/mucolytic trial contexts, high-dose oral supplement trial contexts, and inhaled/prescription acetylcysteine label context; routes and products are not interchangeable.",
      durationStudied:
        "Short-term to one-year trial contexts plus current official label and U.S. regulatory guidance context; not long-term supplement surveillance.",
      comparator:
        "Placebo/control in trial syntheses, plus official drug-label and dietary-supplement regulatory context.",
      evidenceGrade:
        "Source-backed safety packet combining COPD mucolytic safety synthesis, NAC supplement side-effect meta-analysis, DailyMed label warnings, and FDA NAC supplement policy context.",
      effectSize:
        "Not an efficacy effect-size claim. Trial syntheses generally report mild or not clearly increased adverse events in studied contexts, while label/regulatory sources preserve bronchospasm, hypersensitivity, formulation, and legal-status boundaries.",
      clinicalRelevance:
        "Useful as a screening packet before interpreting NAC respiratory or antioxidant claims; respiratory disease, asthma, medication use, pregnancy, pediatric use, and product quality remain review items.",
      confidenceLevel: "Low",
      safetyNotes:
        "Do not treat oral trial tolerability as clearance for inhaled acetylcysteine, IV acetylcysteine, asthma/bronchospasm risk, medicines, pregnancy, pediatric use, high-dose patterns, or unverified products.",
      applicabilityNotes:
        "U.S. FDA enforcement discretion is not AU/TGA product approval and does not establish safety, efficacy, quality, or legality for any specific Australian product.",
      doesNotProve: [
        "Does not prove every NAC product, route, high-dose pattern, or long-term use context is safe.",
        "Does not prove safety for asthma, bronchospasm-prone users, pregnancy, pediatric use, medication contexts, respiratory disease, or complex health conditions.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: [
        "rogliani-mucolytic-antioxidant-copd-2019",
        "poole-mucolytics-copd-2019",
        "rhodes-nac-performance-side-effects-2017",
        "dailymed-acetylcysteine-inhalant-label",
        "fda-nac-enforcement-discretion-2022"
      ],
      keyStudyIds: [
        "study-rogliani-mucolytic-antioxidant-copd-2019",
        "study-poole-mucolytics-copd-2019",
        "study-rhodes-nac-performance-side-effects-2017",
        "study-dailymed-acetylcysteine-inhalant-label",
        "study-fda-nac-enforcement-discretion-2022"
      ],
      scores: {
        evidenceDirectness: 6,
        evidenceRigor: 6,
        effectSize: 1,
        safety: 4,
        regulatoryRisk: 5,
        productQuality: 2,
        hypePenalty: 6,
        measurability: 6
      },
      finalLabel: "Requires Clinician Oversight",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Dedicated long-term supplement safety surveillance, adverse-event extraction by route and dose, medication/asthma/pregnancy/pediatric context review, product-quality testing, and Australian product-level regulatory verification."
    }
  }),
  draftExpansionClaim({
    id: "glucosamine-chondroitin-joint-skin",
    interventionId: "glucosamine-chondroitin",
    outcome: "Joint/tendon/skin",
    claimText:
      "Mixed knee osteoarthritis joint-symptom support, with subgroup and comparator signals but no proof for tendon, skin, structural repair, or broad joint-health claims.",
    supplementName: "Glucosamine/chondroitin",
    evidence: {
      populationStudied:
        "Adults with knee, hip, or knee-focused osteoarthritis in large randomized trials and systematic reviews; not tendon, skin, injury-repair, or healthy-joint populations.",
      doseFormStudied:
        "Oral glucosamine, chondroitin sulfate, or combination supplement trial contexts; this dashboard does not provide dosing guidance.",
      durationStudied:
        "Mostly 24-week to 6-month symptomatic osteoarthritis trial contexts, plus longer and pooled review evidence for joint-space outcomes.",
      comparator:
        "Placebo, celecoxib, or other osteoarthritis trial comparators depending on source.",
      evidenceGrade:
        "Mixed source-backed osteoarthritis packet: a modern combination meta-analysis and MOVES trial suggest symptom signals, while GAIT and BMJ network meta-analysis limit broad clinical claims.",
      effectSize:
        "GAIT found no overall knee-pain benefit versus placebo but a moderate-to-severe pain subgroup signal; MOVES found combination therapy non-inferior to celecoxib in selected painful knee OA; BMJ 2010 found effects below its prespecified minimal clinically important threshold.",
      clinicalRelevance:
        "Best framed as a cautious, measurable knee-osteoarthritis symptom experiment, not cartilage rebuilding, disease modification, tendon support, skin support, or replacement for OA care.",
      confidenceLevel: "Low",
      safetyNotes:
        "Interpret alongside the glucosamine/chondroitin safety packet; shellfish allergy, diabetes/warfarin or anticoagulants, surgery, asthma, product quality, and medication contexts require review.",
      applicabilityNotes:
        "Evidence is mostly osteoarthritis-specific and may vary by baseline pain severity, formulation, source quality, funding, and outcome choice.",
      doesNotProve: [
        "Does not prove cartilage regrowth, structural joint repair, tendon healing, skin benefit, or broad joint-health prevention.",
        "Does not prove benefit for every OA site, pain severity, formulation, product, duration, or comparator.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: [
        "meng-glucosamine-chondroitin-knee-oa-2023",
        "clegg-gait-glucosamine-chondroitin-2006",
        "hochberg-moves-glucosamine-chondroitin-2016",
        "wandel-glucosamine-chondroitin-oa-2010"
      ],
      keyStudyIds: [
        "study-meng-glucosamine-chondroitin-knee-oa-2023",
        "study-clegg-gait-glucosamine-chondroitin-2006",
        "study-hochberg-moves-glucosamine-chondroitin-2016",
        "study-wandel-glucosamine-chondroitin-oa-2010"
      ],
      scores: {
        evidenceDirectness: 6,
        evidenceRigor: 6,
        effectSize: 3,
        safety: 4,
        regulatoryRisk: 3,
        productQuality: 3,
        hypePenalty: 6,
        measurability: 7
      },
      finalLabel: "Reasonable N-of-1 Experiment",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "High-quality independently funded formulation-specific trials, better responder subgroup prediction, safety/adverse-event packet completion, product-quality review, and Australian product-level regulatory verification."
    }
  }),
  draftExpansionClaim({
    id: "glucosamine-chondroitin-safety",
    interventionId: "glucosamine-chondroitin",
    outcome: "Safety/adverse effects",
    claimText: "General safety, tolerability, interaction, and product-quality profile.",
    supplementName: "Glucosamine/chondroitin",
    evidence: {
      populationStudied:
        "Adults in osteoarthritis safety reviews and public supplement-safety guidance, plus warfarin interaction case/reporting context and an Australian product-quality recall example.",
      doseFormStudied:
        "Oral glucosamine, chondroitin sulfate, and combination supplement contexts; product source, shellfish derivation, and batch quality vary.",
      durationStudied:
        "Randomized osteoarthritis trial safety periods plus current public safety guidance and product-recall monitoring context; not lifelong surveillance.",
      comparator:
        "Placebo/control in safety meta-analysis, plus case-report, health-information, and TGA recall context.",
      evidenceGrade:
        "Source-backed safety packet combining SYSADOA safety meta-analysis, NCCIH public safety summary, warfarin interaction reporting, and a current TGA product-quality recall.",
      effectSize:
        "Not an efficacy effect-size claim. Trial safety synthesis did not find increased adverse-event odds for glucosamine sulfate or chondroitin sulfate versus placebo, but interaction and product-quality signals remain important.",
      clinicalRelevance:
        "Useful as a screening packet before interpreting joint-symptom claims, especially around warfarin/bleeding risk, blood glucose, shellfish allergy, pregnancy/breastfeeding, and product quality.",
      confidenceLevel: "Moderate",
      safetyNotes:
        "Warfarin/anticoagulant use, diabetes or glucose monitoring, shellfish allergy, pregnancy/breastfeeding, surgery, asthma, liver disease, medication context, and product recalls require review.",
      applicabilityNotes:
        "Trial tolerability and government safety summaries do not establish safety for every product, batch, formulation, source material, medicine combination, or Australian ARTG/AUST status.",
      doesNotProve: [
        "Does not prove every glucosamine/chondroitin product, batch, formulation, animal source, or long-term use pattern is safe.",
        "Does not prove safety with warfarin or other anticoagulants, diabetes medicines, surgery, pregnancy, breastfeeding, shellfish allergy, asthma, liver disease, or complex health conditions.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: [
        "honvo-sysadoa-safety-2019",
        "nccih-glucosamine-chondroitin-oa",
        "knudsen-glucosamine-warfarin-2008",
        "tga-natures-own-glucosamine-recall-2026"
      ],
      keyStudyIds: [
        "study-honvo-sysadoa-safety-2019",
        "study-nccih-glucosamine-chondroitin-oa",
        "study-knudsen-glucosamine-warfarin-2008",
        "study-tga-natures-own-glucosamine-recall-2026"
      ],
      scores: {
        evidenceDirectness: 6,
        evidenceRigor: 6,
        effectSize: 1,
        safety: 5,
        regulatoryRisk: 4,
        productQuality: 3,
        hypePenalty: 5,
        measurability: 6
      },
      finalLabel: "Requires Clinician Oversight",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Product-specific contaminant/label testing, updated anticoagulant and glucose-interaction evidence, sensitive-population safety data, adverse-event surveillance, and Australian product-level regulatory verification."
    }
  }),
  draftExpansionClaim({
    id: "iron-endurance",
    interventionId: "iron",
    outcome: "VO2 max/endurance",
    claimText:
      "Fatigue or endurance support only in iron-deficient or low-ferritin contexts, without proving benefit for iron-replete users.",
    supplementName: "Iron",
    evidence: {
      populationStudied:
        "Iron-deficient nonanemic athletes, high-level iron-deficient female athletes, healthy adult athletes in oral iron trials, and nonanemic women with low ferritin or fatigue.",
      doseFormStudied:
        "Oral iron supplementation in trial and review contexts; this dashboard does not provide dosing guidance.",
      durationStudied:
        "Mostly 6- to 12-week oral supplementation contexts in trials and reviews, with athlete studies varying by protocol and baseline ferritin.",
      comparator:
        "Placebo/control in randomized trials and systematic-review contexts.",
      evidenceGrade:
        "Source-backed but biomarker-gated evidence: athlete reviews and low-ferritin trials suggest benefit mainly when iron stores are low, while performance effects remain inconsistent across studies.",
      effectSize:
        "Rubeor 2018 found equivocal performance evidence with stronger signals at ferritin cutoffs around 20 micrograms/L; Pengelly 2025 reported endurance decrements in iron-deficient female athletes and performance improvement after repletion; Smid 2024 found ferritin improvement with only a small, uncertain VO2 trend.",
      clinicalRelevance:
        "Most relevant when ferritin, hemoglobin, symptoms, diet, menstrual status, and training load justify clinician-guided assessment; not a general ergogenic supplement claim.",
      confidenceLevel: "Moderate",
      safetyNotes:
        "Iron can be harmful when unnecessary or excessive. Interpret alongside the iron safety packet; deficiency diagnosis, ferritin/hemoglobin monitoring, gastrointestinal tolerance, iron overload risk, pregnancy, pediatric use, and medicines require clinician review.",
      applicabilityNotes:
        "Evidence is strongest for low-ferritin or iron-deficient populations and should not be applied to iron-replete users, every sport, every fatigue cause, or every iron product.",
      doesNotProve: [
        "Does not prove endurance, VO2 max, strength, or fatigue benefit for iron-replete people.",
        "Does not prove self-diagnosis of deficiency, treatment of anemia, or replacement for clinician-guided testing and care.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing, training, or individualized medical advice."
      ],
      keyReferenceIds: [
        "rubeor-iron-deficient-nonanemic-athletes-2018",
        "pengelly-iron-female-athletes-performance-2025",
        "smid-oral-iron-athletes-meta-2024",
        "brutsaert-iron-fatigue-resistance-2003",
        "vaucher-iron-fatigue-low-ferritin-2012"
      ],
      keyStudyIds: [
        "study-rubeor-iron-deficient-nonanemic-athletes-2018",
        "study-pengelly-iron-female-athletes-performance-2025",
        "study-smid-oral-iron-athletes-meta-2024",
        "study-brutsaert-iron-fatigue-resistance-2003",
        "study-vaucher-iron-fatigue-low-ferritin-2012"
      ],
      scores: {
        evidenceDirectness: 7,
        evidenceRigor: 6,
        effectSize: 4,
        safety: 3,
        regulatoryRisk: 4,
        productQuality: 3,
        hypePenalty: 5,
        measurability: 10
      },
      finalLabel: "Conditional / Biomarker-Gated",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "More high-powered athlete RCTs stratified by ferritin, sex, sport, anemia status, and baseline symptoms, plus safety packet completion and product-quality/AU regulatory review."
    }
  }),
  draftExpansionClaim({
    id: "iron-safety",
    interventionId: "iron",
    outcome: "Safety/adverse effects",
    claimText: "General safety, tolerability, interaction, and product-quality profile.",
    supplementName: "Iron",
    evidence: {
      populationStudied:
        "General supplement users, menstruating women in daily iron trials, adults in ferrous sulfate adverse-event trials, children in accidental overdose context, and people with iron-overload risk.",
      doseFormStudied:
        "Dietary iron and oral iron supplement contexts, especially ferrous sulfate in adverse-event meta-analysis; IV/parenteral iron and prescription management are separate medical contexts.",
      durationStudied:
        "Short- to medium-term trial contexts plus government health-professional safety guidance and overdose/interaction context.",
      comparator:
        "Placebo/control or IV iron comparators in adverse-event reviews, plus government health-professional reference context.",
      evidenceGrade:
        "Source-backed safety packet combining NIH ODS guidance, ferrous sulfate GI adverse-event meta-analysis, and Cochrane review context for menstruating women.",
      effectSize:
        "Not an efficacy effect-size claim. Ferrous sulfate increased gastrointestinal side-effect odds versus placebo and IV iron in Tolkien 2015, while Cochrane found iron benefits came with increased gastrointestinal symptoms.",
      clinicalRelevance:
        "High-salience screening packet: iron can be necessary when deficiency is verified, but unnecessary or excessive supplementation can cause GI effects, interactions, overdose risk, and iron-overload harm.",
      confidenceLevel: "Moderate",
      safetyNotes:
        "Clinician review is important for iron deficiency, anemia, pregnancy, children, hemochromatosis or high ferritin, chronic disease, infection/inflammation, gastrointestinal disease, and medicines such as levothyroxine, levodopa, and proton pump inhibitors.",
      applicabilityNotes:
        "Trial tolerability, dietary reference values, and U.S. label-warning context do not establish safety for every dose, product, child-access setting, iron status, condition, or Australian product status.",
      doesNotProve: [
        "Does not prove iron supplementation is safe or useful without confirmed deficiency or clinical indication.",
        "Does not prove safety for children, pregnancy, hemochromatosis/high ferritin, chronic disease, infection/inflammation, gastrointestinal disease, medication contexts, or overdose risk.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: [
        "ods-iron",
        "tolkien-ferrous-sulfate-gi-2015",
        "low-daily-iron-menstruating-women-2016"
      ],
      keyStudyIds: [
        "study-ods-iron-safety",
        "study-tolkien-ferrous-sulfate-gi-2015",
        "study-low-daily-iron-menstruating-women-2016"
      ],
      scores: {
        evidenceDirectness: 7,
        evidenceRigor: 7,
        effectSize: 1,
        safety: 3,
        regulatoryRisk: 4,
        productQuality: 3,
        hypePenalty: 6,
        measurability: 9
      },
      finalLabel: "Requires Clinician Oversight",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Updated adverse-event surveillance by formulation, child-resistant packaging/product review, medication-interaction extraction, iron-overload risk stratification, and Australian product-level regulatory verification."
    }
  }),
  draftExpansionClaim({
    id: "vitamin-b12-cognition",
    interventionId: "vitamin-b12",
    outcome: "Cognition",
    claimText:
      "Cognitive or neurologic support mainly in B12 deficiency, low-status, or homocysteine/B-vitamin contexts, without proving broad nootropic benefit.",
    supplementName: "Vitamin B12",
    evidence: {
      populationStudied:
        "Adults with B12 deficiency risk or symptoms, older adults in B-vitamin cognitive trials, and non-demented or cognitively impaired populations in systematic reviews.",
      doseFormStudied:
        "Vitamin B12 alone in deficiency-management context and B-vitamin combinations in cognitive-trial meta-analyses; this dashboard does not provide dosing guidance.",
      durationStudied:
        "Deficiency-management context plus cognitive trials commonly lasting 26 weeks or longer in older-adult meta-analysis.",
      comparator:
        "Placebo/usual care in randomized B-vitamin cognitive trials, plus expert consensus for B12 deficiency diagnosis and management.",
      evidenceGrade:
        "Biomarker-gated evidence: B12 deficiency can cause neuropsychiatric symptoms, while B-vitamin cognitive trial evidence is small, mixed, and often not B12-specific.",
      effectSize:
        "Berg 2025 found a very small global-cognition benefit after excluding outliers; Behrens 2020 found no overall prevention effect in cognitively unimpaired people; Wang 2022 suggests B-vitamin effects may depend on early, longer intervention and folate/homocysteine context.",
      clinicalRelevance:
        "Clinically relevant when symptoms, diet, medicines, absorption risk, B12 markers, methylmalonic acid, homocysteine, or anemia/neurologic signs justify assessment; not a memory enhancer claim.",
      confidenceLevel: "Low",
      safetyNotes:
        "Interpret alongside the B12 safety packet. Neurologic symptoms, anemia, metformin or acid-suppressing medicines, malabsorption, vegan/vegetarian diet, pregnancy, and folate masking context require clinician review.",
      applicabilityNotes:
        "B-vitamin combination evidence should not be treated as proof that B12 alone improves cognition in replete adults or prevents dementia.",
      doesNotProve: [
        "Does not prove nootropic benefit, dementia prevention, dementia treatment, mood treatment, or cognitive enhancement in B12-replete people.",
        "Does not prove B12 alone explains effects seen in B-vitamin combination trials.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: [
        "obeid-b12-deficiency-consensus-2024",
        "berg-b-vitamins-global-cognition-2025",
        "wang-b-vitamins-cognitive-decline-2022",
        "behrens-vitamin-b-cognitive-decline-2020"
      ],
      keyStudyIds: [
        "study-obeid-b12-deficiency-consensus-2024",
        "study-berg-b-vitamins-global-cognition-2025",
        "study-wang-b-vitamins-cognitive-decline-2022",
        "study-behrens-vitamin-b-cognitive-decline-2020"
      ],
      scores: {
        evidenceDirectness: 5,
        evidenceRigor: 6,
        effectSize: 2,
        safety: 5,
        regulatoryRisk: 3,
        productQuality: 3,
        hypePenalty: 6,
        measurability: 9
      },
      finalLabel: "Conditional / Biomarker-Gated",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "B12-specific RCTs stratified by baseline B12, methylmalonic acid, homocysteine, cognition status, and absorption risk, plus safety/folate-context extraction and product-quality review."
    }
  }),
  draftExpansionClaim({
    id: "vitamin-b12-safety",
    interventionId: "vitamin-b12",
    outcome: "Safety/adverse effects",
    claimText: "General safety, tolerability, interaction, and product-quality profile.",
    supplementName: "Vitamin B12",
    evidence: {
      populationStudied:
        "General supplement users, adults at risk of B12 inadequacy or deficiency, and patients in route-comparison deficiency-treatment evidence.",
      doseFormStudied:
        "Oral, sublingual, intramuscular, and food/supplement B12 contexts; prescription injection and deficiency treatment remain clinical-care contexts.",
      durationStudied:
        "Health-professional safety reference and systematic reviews of deficiency management; not long-term product-specific surveillance.",
      comparator:
        "Reference intake/safety guidance, route-comparison evidence, and expert consensus for deficiency diagnosis and treatment.",
      evidenceGrade:
        "Source-backed safety packet: low toxicity/no established upper limit in ODS context, with important deficiency, malabsorption, medication, and route-of-care boundaries.",
      effectSize:
        "Not an efficacy effect-size claim. B12 has low toxicity in standard reference context, while route-comparison evidence mainly addresses correcting deficiency markers rather than proving broad supplement safety.",
      clinicalRelevance:
        "Useful as a screening packet for missed deficiency, neurologic symptoms, malabsorption, vegan/vegetarian diets, metformin or acid-suppressing medicines, and route selection in clinically managed deficiency.",
      confidenceLevel: "Moderate",
      safetyNotes:
        "Low toxicity does not replace evaluation of neurologic symptoms, anemia, pernicious anemia, gastrointestinal surgery/malabsorption, metformin or proton pump inhibitors, pregnancy, or product quality.",
      applicabilityNotes:
        "Reference safety and route evidence do not establish product-level quality, clinical appropriateness, diagnosis, or AU/TGA product status.",
      doesNotProve: [
        "Does not prove B12 supplementation is necessary, effective, or clinically appropriate without deficiency or risk context.",
        "Does not prove oral, sublingual, intramuscular, and fortified-food contexts are interchangeable for every deficiency cause or neurologic presentation.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: [
        "ods-vitamin-b12",
        "obeid-b12-deficiency-consensus-2024",
        "abdelwahab-b12-routes-2024"
      ],
      keyStudyIds: [
        "study-ods-vitamin-b12-safety",
        "study-obeid-b12-deficiency-consensus-2024",
        "study-abdelwahab-b12-routes-2024"
      ],
      scores: {
        evidenceDirectness: 6,
        evidenceRigor: 6,
        effectSize: 1,
        safety: 6,
        regulatoryRisk: 3,
        productQuality: 3,
        hypePenalty: 4,
        measurability: 9
      },
      finalLabel: "Requires Clinician Oversight",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Product-quality review, adverse-event surveillance by formulation/route, metformin and acid-suppression monitoring guidance, and Australian product-level regulatory verification."
    }
  }),
  draftExpansionClaim({
    id: "folic-acid-fertility-hormones",
    interventionId: "folic-acid",
    outcome: "Fertility/hormones",
    claimText:
      "Pregnancy-planning neural tube defect risk reduction and folate-status support, without proving fertility or hormone optimization.",
    supplementName: "Folic acid / folate",
    evidence: {
      populationStudied:
        "People planning to or able to become pregnant, periconceptional supplementation trial populations, and folate-status reference populations.",
      doseFormStudied:
        "Folic acid supplementation, folate-containing supplements, fortified foods, and folate status contexts; this dashboard does not provide dosing guidance.",
      durationStudied:
        "Periconceptional and early-pregnancy prevention contexts plus health-professional folate-status guidance.",
      comparator:
        "No intervention/placebo or supplements without folic acid in Cochrane trial evidence, plus USPSTF preventive-service evidence review.",
      evidenceGrade:
        "Strong source-backed pregnancy-planning evidence for neural tube defect prevention, but not evidence for fertility enhancement, hormone optimization, or broad methylation claims.",
      effectSize:
        "Cochrane 2015 found folic acid, alone or with other vitamins/minerals, reduced neural tube defect risk versus controls; USPSTF 2023 reaffirmed substantial net benefit for people planning to or able to become pregnant.",
      clinicalRelevance:
        "Highly relevant to pregnancy planning and neural tube defect prevention; fertility treatment, hormone symptoms, methylation protocols, pregnancy complications, and individualized prenatal care remain clinician-owned.",
      confidenceLevel: "High",
      safetyNotes:
        "Interpret alongside the folate safety packet; B12 deficiency masking, medication interactions, high supplemental intake, pregnancy context, and product quality require review.",
      applicabilityNotes:
        "This packet supports a specific pregnancy-planning prevention context, not a general fertility, hormone, mood, energy, or methylation-optimization claim.",
      doesNotProve: [
        "Does not prove improved fertility, ovulation, pregnancy rates, live birth, hormone balance, or broad methylation optimization.",
        "Does not replace prenatal, preconception, medication, or high-risk pregnancy care.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: [
        "de-regil-folate-birth-defects-2015",
        "uspstf-folic-acid-ntd-2023",
        "viswanathan-folic-acid-evidence-review-2023",
        "ods-folate"
      ],
      keyStudyIds: [
        "study-de-regil-folate-birth-defects-2015",
        "study-uspstf-folic-acid-ntd-2023",
        "study-viswanathan-folic-acid-evidence-review-2023",
        "study-ods-folate-safety"
      ],
      scores: {
        evidenceDirectness: 9,
        evidenceRigor: 8,
        effectSize: 8,
        safety: 5,
        regulatoryRisk: 3,
        productQuality: 3,
        hypePenalty: 3,
        measurability: 8
      },
      finalLabel: "Useful for Specific Use Case",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Australian-specific preconception guidance mapping, product-level folate-form verification, medication-context review, and separate evidence for fertility or hormone endpoints if those claims are made."
    }
  }),
  draftExpansionClaim({
    id: "folic-acid-safety",
    interventionId: "folic-acid",
    outcome: "Safety/adverse effects",
    claimText: "General safety, tolerability, interaction, and product-quality profile.",
    supplementName: "Folic acid / folate",
    evidence: {
      populationStudied:
        "General folate supplement users, people planning pregnancy, and medication/B12-deficiency risk contexts described in health-professional and preventive-service sources.",
      doseFormStudied:
        "Folic acid from dietary supplements and fortified foods, food folates, and folate-form context including 5-MTHF; high supplemental folate is separate from food folate.",
      durationStudied:
        "Periconceptional prevention contexts plus health-professional safety guidance for supplemental folate and medication interactions.",
      comparator:
        "Reference safety guidance, USPSTF harms evidence review, and Cochrane periconceptional supplementation safety context.",
      evidenceGrade:
        "Source-backed safety packet combining ODS folate safety/interactions, USPSTF harms review, and Cochrane periconceptional trial safety context.",
      effectSize:
        "Not an efficacy effect-size claim. USPSTF 2023 found no statistically significant harms in reviewed pregnancy-related folic-acid exposure outcomes, while ODS preserves upper-limit, B12 masking, and medication-interaction boundaries.",
      clinicalRelevance:
        "Useful for screening high supplemental intake, B12 deficiency risk, antiepileptic or methotrexate contexts, sulfasalazine-related deficiency risk, pregnancy planning, and product-quality questions.",
      confidenceLevel: "Moderate",
      safetyNotes:
        "High synthetic folate can mask B12 deficiency. Methotrexate, antiepileptic medicines, sulfasalazine, pregnancy planning, prior neural tube defect pregnancy, B12 deficiency symptoms, and high-dose use require clinician review.",
      applicabilityNotes:
        "Safety evidence for standard pregnancy-planning supplementation does not establish safety for every high-dose protocol, methylation product, medication context, folate form, or Australian product.",
      doesNotProve: [
        "Does not prove unlimited supplemental folate, high-dose methylfolate, or every folate product is safe.",
        "Does not prove safety with methotrexate, antiepileptic medicines, sulfasalazine, B12 deficiency, prior neural tube defect pregnancy, or complex pregnancy risk contexts without clinician review.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: [
        "ods-folate",
        "viswanathan-folic-acid-evidence-review-2023",
        "de-regil-folate-birth-defects-2015"
      ],
      keyStudyIds: [
        "study-ods-folate-safety",
        "study-viswanathan-folic-acid-evidence-review-2023",
        "study-de-regil-folate-birth-defects-2015"
      ],
      scores: {
        evidenceDirectness: 7,
        evidenceRigor: 7,
        effectSize: 1,
        safety: 5,
        regulatoryRisk: 4,
        productQuality: 3,
        hypePenalty: 5,
        measurability: 8
      },
      finalLabel: "Requires Clinician Oversight",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-21",
      whatWouldChangeScore:
        "Australian-specific preconception and medicine-interaction guidance, high-dose/methylfolate adverse-event surveillance, product-form verification, and B12-deficiency masking review."
    }
  }),
  draftExpansionClaim({
    id: "dietary-nitrate-beetroot-blood-pressure",
    interventionId: "dietary-nitrate-beetroot",
    outcome: "Blood pressure",
    claimText: "Short-term systolic blood-pressure support in studied hypertension contexts.",
    supplementName: "Dietary nitrate / beetroot juice",
    evidence: {
      populationStudied:
        "Adults with arterial hypertension in randomized beetroot-juice trials summarized by a 2022 systematic review and meta-analysis.",
      doseFormStudied:
        "Nitrate-rich beetroot juice in controlled trial protocols; protocol details belong in source review, not dosing advice.",
      durationStudied:
        "Short-term trial periods from several days to about two months in the reviewed hypertension evidence.",
      comparator: "Placebo or nitrate-depleted/control beetroot juice conditions in randomized trials.",
      evidenceGrade:
        "Source-backed blood-pressure packet with moderate-certainty systolic blood-pressure signal in hypertension trials.",
      effectSize:
        "The 2022 hypertension meta-analysis reported a systolic blood-pressure reduction signal, while diastolic effects were not statistically clear.",
      clinicalRelevance:
        "Potentially relevant as a dietary nitrate blood-pressure signal, not a replacement for hypertension diagnosis, monitoring, or treatment.",
      confidenceLevel: "Moderate",
      safetyNotes:
        "Blood-pressure effects make medication, hypotension, cardiovascular disease, kidney disease, pregnancy, and high-dose product contexts clinician-review situations.",
      applicabilityNotes:
        "Applies to studied beetroot-juice/nitrate protocols in hypertension trials; do not generalize to every powder, shot, vegetable intake pattern, product label, or AU/TGA status.",
      doesNotProve: [
        "Does not prove treatment or prevention of hypertension.",
        "Does not prove cardiovascular-event reduction or lifespan extension.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: ["benjamim-beetroot-bp-2022"],
      keyStudyIds: ["study-benjamim-beetroot-bp-2022"],
      scores: {
        evidenceDirectness: 7,
        evidenceRigor: 7,
        effectSize: 4,
        safety: 5,
        regulatoryRisk: 3,
        productQuality: 3,
        hypePenalty: 4,
        measurability: 8
      },
      finalLabel: "Conditional / Biomarker-Gated",
      momentum: "Stable",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-22",
      whatWouldChangeScore:
        "Larger longer trials, ambulatory blood-pressure outcomes, adverse-event extraction, medication-context stratification, and Australian product-level review."
    }
  }),
  draftExpansionClaim({
    id: "dietary-nitrate-beetroot-endurance",
    interventionId: "dietary-nitrate-beetroot",
    outcome: "VO2 max/endurance",
    claimText: "Exercise-economy or endurance-performance support in selected sport contexts.",
    supplementName: "Dietary nitrate / beetroot juice",
    evidence: {
      populationStudied:
        "Healthy adults and athlete/recreationally active groups in dietary nitrate exercise-performance reviews and AIS sports supplement guidance.",
      doseFormStudied:
        "Dietary nitrate, commonly as beetroot juice or beetroot concentrate in study protocols; this packet does not provide individualized use instructions.",
      durationStudied:
        "Mostly acute pre-exercise and short loading protocols in sports performance research.",
      comparator: "Placebo, nitrate-depleted beetroot juice, or control conditions in exercise studies.",
      evidenceGrade:
        "Source-backed sport-performance packet with useful but context-dependent ergogenic evidence.",
      effectSize:
        "Reviews and AIS guidance support selected performance contexts, especially endurance capacity or repeated high-intensity work, while elite-athlete and event-specific transfer remains variable.",
      clinicalRelevance:
        "Most relevant to performance planning, not disease treatment, longevity claims, or general cardiovascular-event risk reduction.",
      confidenceLevel: "Moderate",
      safetyNotes:
        "Concentrated products can cause gastrointestinal discomfort and benign urine/stool discoloration; practice-use and product-quality review matter for athletes.",
      applicabilityNotes:
        "Applies to studied nitrate-rich foods/products and sport contexts; do not extrapolate to every beetroot product, elite event, chronic supplement use, or product-level AU/TGA status.",
      doesNotProve: [
        "Does not prove direct VO2 max improvement for every athlete or event.",
        "Does not prove chronic training adaptation, cardiovascular-event reduction, or lifespan extension.",
        "Does not establish product-level efficacy, contamination control, quality, or AU/TGA status.",
        "Does not provide individualized sports nutrition or medical advice."
      ],
      keyReferenceIds: ["mcmahon-nitrate-endurance-2017", "ais-dietary-nitrate-beetroot"],
      keyStudyIds: ["study-mcmahon-nitrate-endurance-2017", "study-ais-dietary-nitrate-beetroot"],
      scores: {
        evidenceDirectness: 7,
        evidenceRigor: 7,
        effectSize: 4,
        safety: 6,
        regulatoryRisk: 2,
        productQuality: 4,
        hypePenalty: 4,
        measurability: 8
      },
      finalLabel: "Useful for Specific Use Case",
      momentum: "Stable",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-22",
      whatWouldChangeScore:
        "Event-specific replicated trials, trained-vs-recreational responder analysis, product nitrate-content verification, contamination review, and longer safety follow-up."
    }
  }),
  draftExpansionClaim({
    id: "dietary-nitrate-beetroot-safety",
    interventionId: "dietary-nitrate-beetroot",
    outcome: "Safety/adverse effects",
    claimText: "General safety, tolerability, product-quality, and nitrate-context profile.",
    supplementName: "Dietary nitrate / beetroot juice",
    evidence: {
      populationStudied:
        "Athletes and adults using dietary nitrate or beetroot products in sport and blood-pressure research contexts.",
      doseFormStudied:
        "Vegetable dietary nitrate, beetroot juice concentrates, powders, and product formats discussed in AIS guidance; sodium or potassium nitrate salts are separate and not recommended by AIS.",
      durationStudied:
        "Mostly acute and short-term use; chronic nitrate supplement use has less evidence.",
      comparator:
        "AIS consideration guidance, product-quality warnings, and adverse-event context from beetroot/nitrate source packets.",
      evidenceGrade:
        "Source-backed safety packet combining AIS practical safety considerations with claim-specific blood-pressure and performance evidence.",
      effectSize:
        "Not an efficacy effect-size claim. Main captured issues are gastrointestinal discomfort, benign urine/stool color changes, product nitrate-content uncertainty, nitrate-vs-nitrite confusion, and limited chronic-use evidence.",
      clinicalRelevance:
        "Useful for screening product quality, athlete practice-use, blood-pressure/medication context, nitrate salt confusion, and overconfident chronic-use claims.",
      confidenceLevel: "Moderate",
      safetyNotes:
        "Avoid interpreting natural dietary nitrate evidence as approval of nitrite salts, fertilizer/preservative nitrate salts, high-dose chronic use, or every concentrated product. Clinician review is needed for hypotension or medication contexts.",
      applicabilityNotes:
        "Safety guidance is product- and context-dependent. It does not establish contamination control, batch content, product efficacy, or Australian regulatory status.",
      doesNotProve: [
        "Does not prove every beetroot, nitrate, shot, powder, or extract product is safe.",
        "Does not prove chronic high-dose supplement use is safe.",
        "Does not establish product-level efficacy, safety, quality, sport certification, or AU/TGA status.",
        "Does not provide dosing, individualized medical advice, or sports-competition instructions."
      ],
      keyReferenceIds: ["ais-dietary-nitrate-beetroot", "benjamim-beetroot-bp-2022"],
      keyStudyIds: ["study-ais-dietary-nitrate-beetroot", "study-benjamim-beetroot-bp-2022"],
      scores: {
        evidenceDirectness: 6,
        evidenceRigor: 6,
        effectSize: 1,
        safety: 5,
        regulatoryRisk: 3,
        productQuality: 3,
        hypePenalty: 5,
        measurability: 7
      },
      finalLabel: "Requires Clinician Oversight",
      momentum: "Stable",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-22",
      whatWouldChangeScore:
        "Better chronic-use surveillance, product nitrate-content verification, contaminant testing, medication-context guidance, and AU/TGA product review."
    }
  }),
  draftExpansionClaim({
    id: "sodium-bicarbonate-high-intensity-performance",
    interventionId: "sodium-bicarbonate",
    outcome: "VO2 max/endurance",
    claimText: "High-intensity exercise buffering support in selected athletic contexts.",
    supplementName: "Sodium bicarbonate",
    evidence: {
      populationStudied:
        "Athletes and active adults in sodium bicarbonate performance literature, with AIS guidance focused on sports dietitian-supervised athlete use.",
      doseFormStudied:
        "Oral sodium bicarbonate loading protocols in sport studies; this packet does not provide individualized dosing or event instructions.",
      durationStudied:
        "Mostly acute and short loading protocols around high-intensity exercise or repeated-bout competition settings.",
      comparator: "Placebo or control conditions in sport-performance studies and evidence summaries.",
      evidenceGrade:
        "Source-backed sport-performance packet with AIS and ISSN support for selected high-intensity activities.",
      effectSize:
        "AIS summarizes meta-analytic evidence suggesting small performance improvements in selected high-intensity tasks, while individual tolerability and event fit strongly affect usefulness.",
      clinicalRelevance:
        "Relevant to athlete performance planning, not disease treatment, general fitness advice, lifespan extension, or cardiovascular health claims.",
      confidenceLevel: "Moderate",
      safetyNotes:
        "Gastrointestinal distress and sodium load can offset performance benefits. Hypertension, kidney disease, heart failure, sodium restriction, medication context, and competition anti-doping logistics require professional review.",
      applicabilityNotes:
        "Applies to studied high-intensity sport contexts under expert supervision; do not generalize to every athlete, event, sodium-containing product, chronic use, or AU/TGA product status.",
      doesNotProve: [
        "Does not prove benefit for low-intensity endurance, general health, VO2 max adaptation, or every athlete.",
        "Does not prove chronic performance improvement or lifespan extension.",
        "Does not establish product-level efficacy, sodium safety, contamination control, or AU/TGA status.",
        "Does not provide dosing, individualized sports nutrition, or medical advice."
      ],
      keyReferenceIds: ["issn-sodium-bicarbonate-2021", "ais-sodium-bicarbonate"],
      keyStudyIds: ["study-issn-sodium-bicarbonate-2021", "study-ais-sodium-bicarbonate"],
      scores: {
        evidenceDirectness: 7,
        evidenceRigor: 7,
        effectSize: 4,
        safety: 4,
        regulatoryRisk: 3,
        productQuality: 3,
        hypePenalty: 4,
        measurability: 8
      },
      finalLabel: "Useful for Specific Use Case",
      momentum: "Stable",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-22",
      whatWouldChangeScore:
        "More event-specific trials, individualized-response data, tolerability mitigation evidence, sodium-risk stratification, and product-quality verification."
    }
  }),
  draftExpansionClaim({
    id: "sodium-bicarbonate-safety",
    interventionId: "sodium-bicarbonate",
    outcome: "Safety/adverse effects",
    claimText: "General safety, sodium-load, gastrointestinal, and product-quality profile.",
    supplementName: "Sodium bicarbonate",
    evidence: {
      populationStudied:
        "Athletes and adults using sodium bicarbonate as an ergogenic aid, plus health-professional exercise-supplement safety summaries.",
      doseFormStudied:
        "Gram-level sodium bicarbonate supplement protocols and sodium-containing products; this is not a use protocol.",
      durationStudied:
        "Mostly acute and short-term sport use. Long-term ergogenic safety has not been well established.",
      comparator:
        "AIS practical concerns, ODS exercise-supplement safety summary, and ISSN performance position statement.",
      evidenceGrade:
        "Source-backed safety packet highlighting gastrointestinal distress, sodium exposure, individualized tolerability, and limited long-term evidence.",
      effectSize:
        "Not an efficacy effect-size claim. Main captured issues are nausea, stomach pain, diarrhea, vomiting, sodium load, fluid/weight changes, and competition logistics.",
      clinicalRelevance:
        "Useful for screening sodium restriction, cardiovascular or renal risk, medication context, athlete tolerability, and product-quality questions before considering performance use.",
      confidenceLevel: "Moderate",
      safetyNotes:
        "Clinician or sports-dietitian review is needed for hypertension, kidney disease, heart failure, sodium restriction, pregnancy, medication context, recurrent gastrointestinal symptoms, or competitive sport testing logistics.",
      applicabilityNotes:
        "Safety varies by product, total sodium exposure, timing, fluid intake, health status, and athlete/event context. This does not establish AU/TGA product status.",
      doesNotProve: [
        "Does not prove sodium bicarbonate is safe for people on sodium restriction or with cardiovascular, kidney, pregnancy, or medication concerns.",
        "Does not prove chronic high-dose or repeated loading protocols are safe.",
        "Does not establish product-level efficacy, safety, quality, sport certification, or AU/TGA status.",
        "Does not provide dosing, individualized sports nutrition, or medical advice."
      ],
      keyReferenceIds: [
        "ods-exercise-performance-sodium-bicarbonate",
        "ais-sodium-bicarbonate"
      ],
      keyStudyIds: [
        "study-ods-exercise-performance-sodium-bicarbonate",
        "study-ais-sodium-bicarbonate"
      ],
      scores: {
        evidenceDirectness: 7,
        evidenceRigor: 6,
        effectSize: 1,
        safety: 3,
        regulatoryRisk: 4,
        productQuality: 3,
        hypePenalty: 5,
        measurability: 8
      },
      finalLabel: "Requires Clinician Oversight",
      momentum: "Stable",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-22",
      whatWouldChangeScore:
        "Better long-term safety data, adverse-event rates by protocol, sodium-risk guidance, product-quality verification, and AU/TGA product review."
    }
  }),
  draftExpansionClaim({
    id: "vitamin-c-immune-respiratory",
    interventionId: "vitamin-c",
    outcome: "Immune/respiratory",
    claimText: "Common-cold duration or severity support in selected contexts.",
    supplementName: "Vitamin C",
    evidence: {
      populationStudied:
        "General-population common-cold trials plus subgroups exposed to brief severe physical exercise or cold environments in systematic reviews.",
      doseFormStudied:
        "Oral vitamin C / ascorbic acid supplementation in prevention or treatment trials; this packet does not provide dosing guidance.",
      durationStudied:
        "Regular prophylactic use before cold episodes and shorter therapeutic use after symptom onset in common-cold trials.",
      comparator: "Placebo-controlled common-cold prevention or treatment trials.",
      evidenceGrade:
        "Source-backed immune/respiratory packet with modest duration/severity signal and no routine incidence-prevention support for the general population.",
      effectSize:
        "Cochrane review found routine supplementation did not reduce common-cold incidence in the general population, while regular supplementation modestly reduced duration; a later meta-analysis found a severity reduction signal.",
      clinicalRelevance:
        "Most useful for setting expectations around common-cold symptom duration or severity, not for preventing colds broadly or treating serious respiratory infection.",
      confidenceLevel: "Moderate",
      safetyNotes:
        "High-dose use can cause gastrointestinal symptoms and requires review for kidney-stone risk, iron overload disorders, cancer therapy, statin/niacin therapy, pregnancy, kidney disease, and product quality.",
      applicabilityNotes:
        "Applies to oral vitamin C common-cold evidence, not IV vitamin C, COVID-19 treatment, pneumonia care, immune boosting in general, or Australian product-level status.",
      doesNotProve: [
        "Does not prove routine vitamin C prevents colds in the general population.",
        "Does not prove treatment of serious respiratory infections, COVID-19, pneumonia, or immune deficiency.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: [
        "hemila-vitamin-c-common-cold-2013",
        "hemila-vitamin-c-cold-severity-2023"
      ],
      keyStudyIds: [
        "study-hemila-vitamin-c-common-cold-2013",
        "study-hemila-vitamin-c-cold-severity-2023"
      ],
      scores: {
        evidenceDirectness: 7,
        evidenceRigor: 7,
        effectSize: 3,
        safety: 6,
        regulatoryRisk: 3,
        productQuality: 3,
        hypePenalty: 5,
        measurability: 7
      },
      finalLabel: "Conditional / Biomarker-Gated",
      momentum: "Stable",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-22",
      whatWouldChangeScore:
        "Updated common-cold prevention/treatment meta-analysis, subgroup response by baseline status and exposure, adverse-event extraction, and product-form verification."
    }
  }),
  draftExpansionClaim({
    id: "vitamin-c-safety",
    interventionId: "vitamin-c",
    outcome: "Safety/adverse effects",
    claimText: "General safety, high-dose, kidney-stone, iron, and medication-interaction profile.",
    supplementName: "Vitamin C",
    evidence: {
      populationStudied:
        "General vitamin C supplement users, higher-dose supplement contexts, people with kidney or iron-overload risk, and cancer or lipid-therapy medication contexts described by ODS.",
      doseFormStudied:
        "Oral vitamin C forms including ascorbic acid and mineral ascorbates; IV vitamin C and medical treatment protocols are separate.",
      durationStudied:
        "Routine dietary/supplement exposure and long-term high-intake safety contexts summarized by health-professional guidance.",
      comparator:
        "NIH ODS health-professional safety, upper-limit, adverse-effect, and interaction guidance.",
      evidenceGrade:
        "Source-backed safety packet from health-professional guidance; risk is dose, product, and patient-context dependent.",
      effectSize:
        "Not an efficacy effect-size claim. Main captured issues are gastrointestinal symptoms at high intakes, possible kidney-stone/oxalate context, iron-overload concerns, and medication interactions.",
      clinicalRelevance:
        "Useful for screening high-dose supplement use, kidney-stone history, renal disease, hemochromatosis, cancer therapy, statin/niacin therapy, pregnancy, and product-quality questions.",
      confidenceLevel: "Moderate",
      safetyNotes:
        "High intakes can cause diarrhea, nausea, and abdominal cramps; kidney-stone risk, iron overload, renal disorders, cancer therapy, and statin/niacin therapy require clinician review.",
      applicabilityNotes:
        "Safety guidance for oral vitamin C does not establish safety for high-dose protocols, IV vitamin C, every buffered form, every chewable product, or Australian product status.",
      doesNotProve: [
        "Does not prove unlimited high-dose vitamin C is safe.",
        "Does not prove safety in kidney disease, stone history, hemochromatosis, cancer treatment, pregnancy, or medication contexts without clinician review.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: ["ods-vitamin-c"],
      keyStudyIds: ["study-ods-vitamin-c-safety"],
      scores: {
        evidenceDirectness: 7,
        evidenceRigor: 6,
        effectSize: 1,
        safety: 5,
        regulatoryRisk: 3,
        productQuality: 3,
        hypePenalty: 5,
        measurability: 8
      },
      finalLabel: "Requires Clinician Oversight",
      momentum: "Stable",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-22",
      whatWouldChangeScore:
        "Updated adverse-event surveillance, dose-risk data for kidney stones and oxalate, medication-interaction clarification, product-form testing, and AU/TGA product review."
    }
  }),
  draftExpansionClaim({
    id: "resveratrol-glucose-insulin-hba1c",
    interventionId: "resveratrol",
    outcome: "Glucose/insulin/HbA1c",
    claimText: "Glucose control or insulin-resistance support in selected type 2 diabetes contexts.",
    supplementName: "Resveratrol",
    evidence: {
      populationStudied:
        "Adults with type 2 diabetes or metabolic-risk contexts in resveratrol supplementation trials summarized by a systematic review and meta-analysis.",
      doseFormStudied:
        "Oral resveratrol supplementation in controlled trial protocols; product purity, bioavailability, and dose form vary and are not generalized here.",
      durationStudied:
        "Short- to medium-term supplementation periods across included type 2 diabetes trials.",
      comparator: "Placebo or control conditions in randomized supplementation trials.",
      evidenceGrade:
        "Source-backed metabolic biomarker packet with heterogeneous trial evidence and limited general-population applicability.",
      effectSize:
        "The systematic review and meta-analysis reported favorable signals for insulin resistance and HbA1c, with fasting glucose effects clearer in diabetes subgroup analyses.",
      clinicalRelevance:
        "Potentially relevant as a monitored biomarker signal in selected type 2 diabetes contexts, not a diabetes treatment claim or general longevity claim.",
      confidenceLevel: "Low",
      safetyNotes:
        "Medication context, liver markers, diabetes therapy, anticoagulants, estrogen-sensitive contexts, product quality, and poor bioavailability require clinician review.",
      applicabilityNotes:
        "Applies to studied oral resveratrol trial contexts in type 2 diabetes or metabolic-risk populations; do not generalize to red wine, every extract, prevention, treatment, or AU/TGA product status.",
      doesNotProve: [
        "Does not prove prevention, treatment, or reversal of diabetes.",
        "Does not prove general metabolic benefit in people without type 2 diabetes or monitored biomarker context.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: ["resveratrol-t2d-meta-2021"],
      keyStudyIds: ["study-resveratrol-t2d-meta-2021"],
      scores: {
        evidenceDirectness: 6,
        evidenceRigor: 6,
        effectSize: 3,
        safety: 4,
        regulatoryRisk: 4,
        productQuality: 2,
        hypePenalty: 6,
        measurability: 8
      },
      finalLabel: "Conditional / Biomarker-Gated",
      momentum: "Stable",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-22",
      whatWouldChangeScore:
        "Larger preregistered trials with standardized resveratrol forms, diabetes-medication stratification, adverse-event extraction, longer biomarker follow-up, and Australian product-level review."
    }
  }),
  draftExpansionClaim({
    id: "resveratrol-lifespan",
    interventionId: "resveratrol",
    outcome: "Mortality/lifespan",
    claimText: "Direct lifespan extension or broad anti-aging effect.",
    supplementName: "Resveratrol",
    evidence: {
      populationStudied:
        "Older community-dwelling adults in an observational urinary-resveratrol-metabolite cohort, plus human relevance checks against anti-aging claims.",
      doseFormStudied:
        "Dietary resveratrol exposure estimated from urinary metabolites; supplement products and high-dose extracts are separate and not proven by this source packet.",
      durationStudied:
        "Long-term cohort follow-up for mortality and selected health outcomes.",
      comparator:
        "Higher versus lower urinary resveratrol metabolite exposure in an older-adult community cohort.",
      evidenceGrade:
        "Source-backed caution packet; available human cohort evidence does not support direct longevity or broad anti-aging claims.",
      effectSize:
        "The cohort did not find urinary resveratrol metabolites associated with all-cause mortality, cardiovascular disease, cancer, or inflammatory markers.",
      clinicalRelevance:
        "Useful for down-ranking broad lifespan-extension marketing; it does not rule out every narrow mechanistic hypothesis.",
      confidenceLevel: "Very low",
      safetyNotes:
        "Anti-aging claims can obscure separate safety, interaction, bioavailability, and product-quality questions that need review before use.",
      applicabilityNotes:
        "Applies to human longevity and broad anti-aging claims. It does not validate red-wine, extract, high-dose, product-level, or AU/TGA claims.",
      doesNotProve: [
        "Does not prove lifespan extension in humans.",
        "Does not prove prevention of cardiovascular disease, cancer, frailty, or aging-related decline.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: ["semba-resveratrol-mortality-2014"],
      keyStudyIds: ["study-semba-resveratrol-mortality-2014"],
      scores: {
        evidenceDirectness: 3,
        evidenceRigor: 4,
        effectSize: 1,
        safety: 4,
        regulatoryRisk: 4,
        productQuality: 2,
        hypePenalty: 8,
        measurability: 5
      },
      finalLabel: "Insufficient Evidence",
      momentum: "Stable",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-22",
      whatWouldChangeScore:
        "Human trials or strong prospective evidence showing clinically meaningful aging, mortality, or morbidity outcomes with standardized products and clear safety follow-up."
    }
  }),
  draftExpansionClaim({
    id: "resveratrol-safety",
    interventionId: "resveratrol",
    outcome: "Safety/adverse effects",
    claimText: "General safety, liver-enzyme, interaction, bioavailability, and product-quality profile.",
    supplementName: "Resveratrol",
    evidence: {
      populationStudied:
        "General supplement users, clinical trial participants, and medicine-interaction contexts described in LiverTox and drug-interaction review evidence.",
      doseFormStudied:
        "Oral resveratrol supplements and extracts; product purity, actual content, and bioavailability are variable and rarely well defined.",
      durationStudied:
        "Mostly short-term human supplement exposure and high-dose trial contexts, with limited long-term product-specific surveillance.",
      comparator:
        "Reference safety synthesis, liver-injury surveillance, and drug-interaction review evidence.",
      evidenceGrade:
        "Source-backed safety packet highlighting uncertain purity, poor bioavailability, possible gastrointestinal effects, liver-enzyme monitoring context, and interaction potential.",
      effectSize:
        "Not an efficacy effect-size claim. Main captured issues are gastrointestinal symptoms, rare liver-enzyme elevations at higher exposures, possible estrogen and anticoagulant concerns, and CYP-mediated interaction potential.",
      clinicalRelevance:
        "Useful for screening medication context, liver markers, anticoagulants, estrogen-sensitive contexts, diabetes therapy, pregnancy, surgery, and product-quality questions.",
      confidenceLevel: "Moderate",
      safetyNotes:
        "LiverTox does not identify convincing clinically apparent liver injury from resveratrol, but product quality, high-dose exposure, liver enzymes, anticoagulants, estrogenic context, CYP interactions, and medicines remain clinician-review issues.",
      applicabilityNotes:
        "Safety evidence is not product-specific and does not establish safety for every extract, high-dose protocol, chronic use, combination formula, or Australian regulatory status.",
      doesNotProve: [
        "Does not prove every resveratrol or polyphenol product is safe.",
        "Does not prove safety in pregnancy, liver disease, surgery, anticoagulant use, estrogen-sensitive contexts, diabetes-medication use, or complex medication regimens without clinician review.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: ["livertox-resveratrol", "resveratrol-drug-interactions-2012"],
      keyStudyIds: ["study-livertox-resveratrol", "study-resveratrol-drug-interactions-2012"],
      scores: {
        evidenceDirectness: 7,
        evidenceRigor: 6,
        effectSize: 1,
        safety: 4,
        regulatoryRisk: 4,
        productQuality: 2,
        hypePenalty: 6,
        measurability: 7
      },
      finalLabel: "Requires Clinician Oversight",
      momentum: "Stable",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-22",
      whatWouldChangeScore:
        "Product-specific assays, longer safety surveillance, better interaction studies, liver-enzyme adverse-event extraction, and Australian product-level review."
    }
  }),
  draftExpansionClaim({
    id: "quercetin-blood-pressure-biomarkers",
    interventionId: "quercetin",
    outcome: "Blood pressure",
    claimText: "Small blood-pressure support in reviewed adult randomized trial evidence.",
    supplementName: "Quercetin",
    evidence: {
      populationStudied:
        "Adults in randomized quercetin or standardized quercetin-enriched extract trials summarized by cardiovascular biomarker meta-analyses.",
      doseFormStudied:
        "Oral quercetin supplementation or standardized quercetin-enriched extracts in controlled trial protocols; this packet does not generalize to every bioflavonoid blend or product form.",
      durationStudied:
        "Mostly short-term trial periods, with cardiovascular biomarker analyses spanning several weeks to a few months.",
      comparator: "Placebo or control conditions in randomized controlled trials.",
      evidenceGrade:
        "Source-backed blood-pressure packet with small average systolic and diastolic blood-pressure reductions in meta-analyses, while lipid and glucose effects were inconsistent.",
      effectSize:
        "A 2020 meta-analysis of 17 trials reported systolic and diastolic blood-pressure reductions, while lipids and glucose did not change significantly overall. A 2016 meta-analysis reported similar small blood-pressure reductions and called for clinical-relevance studies.",
      clinicalRelevance:
        "Potentially useful as a monitored biomarker signal, not a hypertension treatment, cardiovascular-event reduction, or longevity claim.",
      confidenceLevel: "Moderate",
      safetyNotes:
        "Blood-pressure, medication, kidney-risk, pregnancy, cancer-treatment, estrogen-sensitive, and product-quality contexts require clinician review before interpreting use.",
      applicabilityNotes:
        "Applies to studied oral quercetin trial contexts and biomarker outcomes; do not generalize to every extract, multi-ingredient product, diet pattern, blood-pressure treatment plan, or AU/TGA product status.",
      doesNotProve: [
        "Does not prove treatment or prevention of hypertension.",
        "Does not prove cardiovascular-event reduction, glucose control, weight loss, immune benefit, or lifespan extension.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: ["huang-quercetin-cardiometabolic-2020", "serban-quercetin-bp-2016"],
      keyStudyIds: ["study-huang-quercetin-cardiometabolic-2020", "study-serban-quercetin-bp-2016"],
      scores: {
        evidenceDirectness: 7,
        evidenceRigor: 7,
        effectSize: 3,
        safety: 5,
        regulatoryRisk: 3,
        productQuality: 2,
        hypePenalty: 5,
        measurability: 8
      },
      finalLabel: "Conditional / Biomarker-Gated",
      momentum: "Stable",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-22",
      whatWouldChangeScore:
        "Larger longer trials with standardized product forms, baseline blood-pressure stratification, medication-context analysis, clinical outcomes, adverse-event extraction, and Australian product-level review."
    }
  }),
  draftExpansionClaim({
    id: "quercetin-safety",
    interventionId: "quercetin",
    outcome: "Safety/adverse effects",
    claimText: "General safety, liver, kidney-risk, interaction, and product-quality profile.",
    supplementName: "Quercetin",
    evidence: {
      populationStudied:
        "General quercetin supplement users, human intervention-study participants, and higher-risk groups discussed in LiverTox and dietary-supplement safety review evidence.",
      doseFormStudied:
        "Oral isolated quercetin, quercetin aglycone, and quercetin-containing supplements or extracts; product content and co-ingredients can vary.",
      durationStudied:
        "Mostly short-term human intervention studies, with limited long-term high-dose safety evidence.",
      comparator:
        "Reference liver-safety synthesis and dietary-supplement safety review evidence.",
      evidenceGrade:
        "Source-backed safety packet: human adverse effects are usually mild and liver injury is unlikely, but long-term high-dose data, drug bioavailability interactions, kidney-risk contexts, and sensitive populations remain uncertain.",
      effectSize:
        "Not an efficacy effect-size claim. Captured issues include abdominal discomfort, nausea, headache, limited focused hepatic safety studies, possible kidney and estrogen-sensitive risk contexts from safety review evidence, and drug-bioavailability interactions.",
      clinicalRelevance:
        "Useful for screening medicines, kidney disease or predamaged kidney contexts, pregnancy, cancer treatment, estrogen-sensitive conditions, surgery, and multi-ingredient product quality before interpreting claims.",
      confidenceLevel: "Moderate",
      safetyNotes:
        "LiverTox rates clinically apparent liver injury as unlikely, but long-term high-dose safety evidence is limited and safety review evidence flags possible kidney, estrogen-dependent cancer, and drug-interaction contexts.",
      applicabilityNotes:
        "Safety evidence is not product-specific and does not establish safety for every extract, high-dose protocol, chronic use, combination formula, or Australian regulatory status.",
      doesNotProve: [
        "Does not prove every quercetin or bioflavonoid product is safe.",
        "Does not prove safety in pregnancy, kidney disease, predamaged kidney contexts, cancer treatment, estrogen-sensitive conditions, surgery, or complex medication regimens without clinician review.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing or individualized medical advice."
      ],
      keyReferenceIds: ["livertox-quercetin", "andres-quercetin-safety-2018"],
      keyStudyIds: ["study-livertox-quercetin", "study-andres-quercetin-safety-2018"],
      scores: {
        evidenceDirectness: 7,
        evidenceRigor: 6,
        effectSize: 1,
        safety: 4,
        regulatoryRisk: 4,
        productQuality: 2,
        hypePenalty: 6,
        measurability: 7
      },
      finalLabel: "Requires Clinician Oversight",
      momentum: "Stable",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-22",
      whatWouldChangeScore:
        "Longer high-dose human safety studies, interaction studies with common medicines, kidney-risk stratification, reproductive/cancer-context data, product assays, and Australian product-level review."
    }
  }),
  draftExpansionClaim({
    id: "fisetin-senolytic-lifespan",
    interventionId: "fisetin",
    outcome: "Mortality/lifespan",
    claimText: "Senolytic, healthspan, or lifespan extension in humans.",
    supplementName: "Fisetin",
    evidence: {
      populationStudied:
        "Preclinical senescence models, aged wild-type mice, human adipose tissue explants, and early phase I/II human trial populations under investigation.",
      doseFormStudied:
        "Fisetin exposure in preclinical experiments and intermittent oral fisetin protocols in registered human trials; this packet does not provide use instructions.",
      durationStudied:
        "Preclinical acute, intermittent, and late-life mouse interventions plus early human trial follow-up windows; no human lifespan trial evidence is established.",
      comparator:
        "Preclinical control groups and placebo-controlled registered human trial designs where available.",
      evidenceGrade:
        "Source-backed speculative watchlist packet: strong animal/mechanistic signal and active early human trials, but no established human healthspan or lifespan efficacy.",
      effectSize:
        "The 2018 EBioMedicine preclinical study reported reduced senescence markers, restored tissue homeostasis, reduced age-related pathology, and extended median and maximum lifespan in mice. Human trials are designed to test vascular, OA, safety, pharmacokinetic, and biomarker questions rather than prove lifespan extension.",
      clinicalRelevance:
        "Useful for identifying a high-interest longevity claim that should remain speculative until human efficacy and safety data mature.",
      confidenceLevel: "Very low",
      safetyNotes:
        "Senolytic framing involves sensitive aging and multimorbidity contexts; human safety, pharmacokinetics, efficacy, medication context, product quality, and AU/TGA product status remain unresolved.",
      applicabilityNotes:
        "Applies to fisetin as a research watchlist ingredient. Do not translate animal lifespan findings or trial registration into human anti-aging, disease-treatment, dosing, or product-level claims.",
      doesNotProve: [
        "Does not prove lifespan extension or healthspan improvement in humans.",
        "Does not prove treatment or prevention of aging, multimorbidity, osteoarthritis, vascular disease, frailty, or chronic inflammation.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing, senolytic protocols, or individualized medical advice."
      ],
      keyReferenceIds: [
        "yousefzadeh-fisetin-senotherapeutic-2018",
        "fisetin-senotherapeutic-review-2024",
        "ctgov-fisetin-vascular-aging-nct06133634"
      ],
      keyStudyIds: [
        "study-yousefzadeh-fisetin-senotherapeutic-2018",
        "study-fisetin-senotherapeutic-review-2024",
        "study-ctgov-fisetin-vascular-aging-nct06133634"
      ],
      scores: {
        evidenceDirectness: 2,
        evidenceRigor: 4,
        effectSize: 2,
        safety: 3,
        regulatoryRisk: 4,
        productQuality: 2,
        hypePenalty: 8,
        measurability: 5
      },
      finalLabel: "Speculative Watchlist",
      momentum: "Increasing",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-22",
      whatWouldChangeScore:
        "Published placebo-controlled human outcomes, transparent safety and pharmacokinetic results, validated senescence biomarkers, replication across populations, product-quality assays, and Australian product-level review."
    }
  }),
  draftExpansionClaim({
    id: "fisetin-safety",
    interventionId: "fisetin",
    outcome: "Safety/adverse effects",
    claimText: "Human safety, pharmacokinetic, interaction, and product-quality profile.",
    supplementName: "Fisetin",
    evidence: {
      populationStudied:
        "Older adults, healthy volunteers, multimorbidity cohorts, and knee osteoarthritis trial participants in registered phase I/II fisetin studies, plus review evidence.",
      doseFormStudied:
        "Oral fisetin or placebo in registered clinical trial protocols; this packet does not provide protocol instructions.",
      durationStudied:
        "Short intermittent trial exposure and follow-up windows in early human studies; long-term supplement safety is not established.",
      comparator:
        "Registered placebo-controlled or active-control trial designs and senotherapeutic review evidence.",
      evidenceGrade:
        "Source-backed safety watch packet from early human trial registrations and review evidence; safety, pharmacokinetics, efficacy, and outcome measures remain under study.",
      effectSize:
        "Not an efficacy effect-size claim. Trial records show safety/tolerability/adherence or pharmacokinetic aims, while the 2024 review states further studies are needed to establish safety, pharmacokinetics, and efficacy.",
      clinicalRelevance:
        "Useful for screening against overconfident product claims and for flagging that human safety evidence is still maturing.",
      confidenceLevel: "Low",
      safetyNotes:
        "Early trial registration does not equal proven safety. Multimorbidity, older age, medicines, cancer survivorship, kidney/liver context, pregnancy, surgery, and high-dose or intermittent senolytic use require clinician review.",
      applicabilityNotes:
        "Safety evidence is not product-specific and does not establish safety for every fisetin extract, chronic use, combination formula, or Australian regulatory status.",
      doesNotProve: [
        "Does not prove fisetin is safe for unsupervised senolytic use.",
        "Does not prove safety in older adults, multimorbidity, cancer survivorship, kidney or liver disease, pregnancy, surgery, or complex medication regimens without clinician review.",
        "Does not establish product-level efficacy, safety, quality, or AU/TGA status.",
        "Does not provide dosing, trial-protocol replication, or individualized medical advice."
      ],
      keyReferenceIds: [
        "fisetin-senotherapeutic-review-2024",
        "ctgov-fisetin-safety-pk-nct06431932",
        "ctgov-fisetin-oa-nct04210986"
      ],
      keyStudyIds: [
        "study-fisetin-senotherapeutic-review-2024",
        "study-ctgov-fisetin-safety-pk-nct06431932",
        "study-ctgov-fisetin-oa-nct04210986"
      ],
      scores: {
        evidenceDirectness: 5,
        evidenceRigor: 4,
        effectSize: 1,
        safety: 3,
        regulatoryRisk: 4,
        productQuality: 2,
        hypePenalty: 7,
        measurability: 6
      },
      finalLabel: "Requires Clinician Oversight",
      momentum: "Increasing",
      reviewStatus: "AI reviewed",
      lastUpdated: "2026-06-22",
      whatWouldChangeScore:
        "Published human safety and pharmacokinetic results, adverse-event rates by population and protocol, medication-context data, long-term follow-up, product assays, and Australian product-level review."
    }
  })
];

const expansionAustraliaRegulatoryStatuses = expansionInterventions.map((intervention) =>
  draftAustraliaRegulatoryStatus(intervention.id)
);

export const references: Reference[] = [
  {
    id: "issn-creatine-2017",
    title:
      "International Society of Sports Nutrition position stand: safety and efficacy of creatine supplementation in exercise, sport, and medicine",
    source: "PubMed",
    identifier: "PMID: 28615996",
    year: 2017,
    url: "https://pubmed.ncbi.nlm.nih.gov/28615996/"
  },
  {
    id: "ref-pubmed-42141930",
    title:
      "Creatine monohydrate for lean mass, strength, and bone density in postmenopausal women: a systematic review and meta-analysis.",
    source: "PubMed",
    identifier: "PMID: 42141930; DOI: 10.1080/15502783.2026.2668435",
    year: 2026,
    url: "https://pubmed.ncbi.nlm.nih.gov/42141930/"
  },
  {
    id: "ods-vitamin-d",
    title: "Vitamin D - Health Professional Fact Sheet",
    source: "NIH Office of Dietary Supplements",
    url: "https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/"
  },
  {
    id: "ods-omega-3",
    title: "Omega-3 Fatty Acids - Health Professional Fact Sheet",
    source: "NIH Office of Dietary Supplements",
    url: "https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/"
  },
  {
    id: "brown-dietary-fiber-1999",
    title: "Cholesterol-lowering effects of dietary fiber: a meta-analysis",
    source: "American Journal of Clinical Nutrition via PubMed",
    identifier: "PMID: 9925120; DOI: 10.1093/ajcn/69.1.30",
    year: 1999,
    url: "https://pubmed.ncbi.nlm.nih.gov/9925120/"
  },
  {
    id: "fda-bpc-157-category-2",
    title:
      "Certain Bulk Drug Substances for Use in Compounding that May Present Significant Safety Risks",
    source: "FDA",
    url: "https://www.fda.gov/drugs/compounding/safety-risks-associated-certain-bulk-drug-substances-nominated-use-compounding"
  },
  {
    id: "tga-artg",
    title: "About the Australian Register of Therapeutic Goods (ARTG)",
    source: "TGA",
    year: 2024,
    url: "https://www.tga.gov.au/products/regulations-all-products/about-australian-register-therapeutic-goods-artg"
  },
  {
    id: "tga-aust-numbers",
    title: "AUST numbers on medicine labels",
    source: "TGA",
    year: 2025,
    url: "https://www.tga.gov.au/how-we-regulate/labelling-and-packaging/medicines-and-biologicals/aust-numbers-medicine-labels"
  },
  {
    id: "tga-safety-alerts",
    title: "Safety alerts",
    source: "TGA",
    year: 2026,
    url: "https://www.tga.gov.au/safety/safety-monitoring-and-information/safety-alerts"
  },
  {
    id: "zhang-magnesium-bp-2016",
    title:
      "Effects of Magnesium Supplementation on Blood Pressure: A Meta-Analysis of Randomized Double-Blind Placebo-Controlled Trials",
    source: "Hypertension via PubMed",
    identifier: "PMID: 27402922; DOI: 10.1161/HYPERTENSIONAHA.116.07664",
    year: 2016,
    url: "https://pubmed.ncbi.nlm.nih.gov/27402922/"
  },
  {
    id: "schuster-magnesium-bisglycinate-sleep-2025",
    title:
      "Magnesium Bisglycinate Supplementation in Healthy Adults Reporting Poor Sleep: A Randomized, Placebo-Controlled Trial",
    source: "Nature and Science of Sleep via PubMed",
    identifier: "PMID: 40918053; DOI: 10.2147/NSS.S524348",
    year: 2025,
    url: "https://pubmed.ncbi.nlm.nih.gov/40918053/"
  },
  {
    id: "mah-magnesium-insomnia-2021",
    title:
      "Oral magnesium supplementation for insomnia in older adults: a Systematic Review & Meta-Analysis",
    source: "BMC Complementary Medicine and Therapies via PubMed",
    identifier: "PMID: 33865376; DOI: 10.1186/s12906-021-03297-z",
    year: 2021,
    url: "https://pubmed.ncbi.nlm.nih.gov/33865376/"
  },
  {
    id: "ods-magnesium",
    title: "Magnesium health professional fact sheet",
    source: "NIH Office of Dietary Supplements",
    year: 2025,
    url: "https://ods.od.nih.gov/factsheets/Magnesium-HealthProfessional/"
  },
  {
    id: "ods-zinc",
    title: "Zinc health professional fact sheet",
    source: "NIH Office of Dietary Supplements",
    year: 2025,
    url: "https://ods.od.nih.gov/factsheets/Zinc-HealthProfessional/"
  },
  {
    id: "zhao-zinc-male-infertility-2016",
    title:
      "Zinc levels in seminal plasma and their correlation with male infertility: A systematic review and meta-analysis",
    source: "Scientific Reports via PubMed",
    identifier: "PMID: 26932683; DOI: 10.1038/srep22386",
    year: 2016,
    url: "https://pubmed.ncbi.nlm.nih.gov/26932683/"
  },
  {
    id: "salas-huetos-sperm-supplements-2018",
    title:
      "The Effect of Nutrients and Dietary Supplements on Sperm Quality Parameters: A Systematic Review and Meta-Analysis of Randomized Clinical Trials",
    source: "Advances in Nutrition via PubMed",
    identifier: "PMID: 30462179; DOI: 10.1093/advances/nmy057",
    year: 2018,
    url: "https://pubmed.ncbi.nlm.nih.gov/30462179/"
  },
  {
    id: "schisterman-folic-acid-zinc-2020",
    title:
      "Effect of Folic Acid and Zinc Supplementation in Men on Semen Quality and Live Birth Among Couples Undergoing Infertility Treatment",
    source: "JAMA via PubMed",
    identifier: "PMID: 31910279; DOI: 10.1001/jama.2019.18714",
    year: 2020,
    url: "https://pubmed.ncbi.nlm.nih.gov/31910279/"
  },
  {
    id: "naghshi-protein-mortality-2020",
    title:
      "Dietary intake of total, animal, and plant proteins and risk of all cause, cardiovascular, and cancer mortality",
    source: "BMJ via PubMed",
    identifier: "PMID: 32699048; DOI: 10.1136/bmj.m2412",
    year: 2020,
    url: "https://pubmed.ncbi.nlm.nih.gov/32699048/"
  },
  {
    id: "devries-protein-kidney-2018",
    title:
      "Changes in Kidney Function Do Not Differ between Healthy Adults Consuming Higher- Compared with Lower- or Normal-Protein Diets",
    source: "Journal of Nutrition via PubMed",
    identifier: "PMID: 30383278; DOI: 10.1093/jn/nxy197",
    year: 2018,
    url: "https://pubmed.ncbi.nlm.nih.gov/30383278/"
  },
  {
    id: "vasconcelos-whey-adverse-effects-2021",
    title: "Whey protein supplementation and its potentially adverse effects on health: a systematic review",
    source: "Applied Physiology, Nutrition, and Metabolism via PubMed",
    identifier: "PMID: 32702243; DOI: 10.1139/apnm-2020-0370",
    year: 2021,
    url: "https://pubmed.ncbi.nlm.nih.gov/32702243/"
  },
  {
    id: "cochrane-zinc-cold-2024",
    title: "Zinc for prevention and treatment of the common cold",
    source: "Cochrane Database of Systematic Reviews via PubMed",
    identifier: "PMID: 38719213; DOI: 10.1002/14651858.CD014914.pub2",
    year: 2024,
    url: "https://pubmed.ncbi.nlm.nih.gov/38719213/"
  },
  {
    id: "morton-protein-resistance-2018",
    title:
      "A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults",
    source: "British Journal of Sports Medicine via PubMed",
    identifier: "PMID: 28698222; DOI: 10.1136/bjsports-2017-097608",
    year: 2018,
    url: "https://pubmed.ncbi.nlm.nih.gov/28698222/"
  },
  {
    id: "issn-caffeine-2021",
    title: "International society of sports nutrition position stand: caffeine and exercise performance",
    source: "Journal of the International Society of Sports Nutrition via PubMed",
    identifier: "PMID: 33388079; DOI: 10.1186/s12970-020-00383-4",
    year: 2021,
    url: "https://pubmed.ncbi.nlm.nih.gov/33388079/"
  },
  {
    id: "gardiner-caffeine-sleep-2023",
    title: "The effect of caffeine on subsequent sleep: A systematic review and meta-analysis",
    source: "Sleep Medicine Reviews via PubMed",
    identifier: "PMID: 36870101; DOI: 10.1016/j.smrv.2023.101764",
    year: 2023,
    url: "https://pubmed.ncbi.nlm.nih.gov/36870101/"
  },
  {
    id: "drake-caffeine-sleep-2013",
    title: "Caffeine effects on sleep taken 0, 3, or 6 hours before going to bed",
    source: "Journal of Clinical Sleep Medicine via PubMed",
    identifier: "PMID: 24235903; DOI: 10.5664/jcsm.3170",
    year: 2013,
    url: "https://pubmed.ncbi.nlm.nih.gov/24235903/"
  },
  {
    id: "wikoff-caffeine-safety-2017",
    title:
      "Systematic review of the potential adverse effects of caffeine consumption in healthy adults, pregnant women, adolescents, and children",
    source: "Food and Chemical Toxicology via PubMed",
    identifier: "PMID: 28438661; DOI: 10.1016/j.fct.2017.04.002",
    year: 2017,
    url: "https://pubmed.ncbi.nlm.nih.gov/28438661/"
  },
  {
    id: "fda-caffeine-too-much-2024",
    title: "Spilling the Beans: How Much Caffeine is Too Much?",
    source: "FDA",
    year: 2024,
    url: "https://www.fda.gov/consumers/consumer-updates/spilling-beans-how-much-caffeine-too-much"
  },
  {
    id: "fda-concentrated-caffeine-2018",
    title: "FDA Warns Consumers About Pure and Highly Concentrated Caffeine",
    source: "FDA",
    year: 2018,
    url: "https://www.fda.gov/food/information-select-dietary-supplement-ingredients-and-other-substances/fda-warns-consumers-about-pure-and-highly-concentrated-caffeine"
  },
  {
    id: "guo-ashwagandha-stress-2022",
    title:
      "Does Ashwagandha supplementation have a beneficial effect on the management of anxiety and stress? A systematic review and meta-analysis of randomized controlled trials",
    source: "Phytotherapy Research via PubMed",
    identifier: "PMID: 36017529; DOI: 10.1002/ptr.7598",
    year: 2022,
    url: "https://pubmed.ncbi.nlm.nih.gov/36017529/"
  },
  {
    id: "cheah-ashwagandha-sleep-2021",
    title: "Effect of Ashwagandha (Withania somnifera) extract on sleep: A systematic review and meta-analysis",
    source: "PLOS One via PubMed",
    identifier: "PMID: 34559859; DOI: 10.1371/journal.pone.0257843",
    year: 2021,
    url: "https://pubmed.ncbi.nlm.nih.gov/34559859/"
  },
  {
    id: "langade-ashwagandha-sleep-2021",
    title:
      "Clinical evaluation of the pharmacological impact of ashwagandha root extract on sleep in healthy volunteers and insomnia patients",
    source: "Journal of Ethnopharmacology via PubMed",
    identifier: "PMID: 32818573; DOI: 10.1016/j.jep.2020.113276",
    year: 2021,
    url: "https://pubmed.ncbi.nlm.nih.gov/32818573/"
  },
  {
    id: "deshpande-ashwagandha-sleep-2020",
    title:
      "A randomized, double blind, placebo controlled study to evaluate the effects of ashwagandha extract on sleep quality in healthy adults",
    source: "Sleep Medicine via PubMed",
    identifier: "PMID: 32540634; DOI: 10.1016/j.sleep.2020.03.012",
    year: 2020,
    url: "https://pubmed.ncbi.nlm.nih.gov/32540634/"
  },
  {
    id: "ods-ashwagandha",
    title: "Ashwagandha: Is it helpful for stress, anxiety, or sleep? - Health Professional Fact Sheet",
    source: "NIH Office of Dietary Supplements",
    url: "https://ods.od.nih.gov/factsheets/Ashwagandha-HealthProfessional/"
  },
  {
    id: "nccih-ashwagandha",
    title: "Ashwagandha: Usefulness and Safety",
    source: "NIH National Center for Complementary and Integrative Health",
    url: "https://www.nccih.nih.gov/health/ashwagandha"
  },
  {
    id: "ref-pubmed-42198398",
    title:
      "Back to the Roots: Safety and Tolerability of Standardised Ashwagandha (Withania somnifera) Root Extract in Healthy Adults-A Systematic Review of Biomarkers and Adverse Events.",
    source: "PubMed",
    identifier: "PMID: 42198398; DOI: 10.3390/ph19050725",
    year: 2026,
    url: "https://pubmed.ncbi.nlm.nih.gov/42198398/"
  },
  {
    id: "durg-ashwagandha-male-infertility-2018",
    title: "Withania somnifera (Indian ginseng) in male infertility: An evidence-based systematic review and meta-analysis",
    source: "Phytomedicine via PubMed",
    identifier: "PMID: 30466985; DOI: 10.1016/j.phymed.2017.11.011",
    year: 2018,
    url: "https://pubmed.ncbi.nlm.nih.gov/30466985/"
  },
  {
    id: "ambiye-ashwagandha-oligospermia-2013",
    title:
      "Clinical Evaluation of the Spermatogenic Activity of the Root Extract of Ashwagandha in Oligospermic Males",
    source: "Evidence-Based Complementary and Alternative Medicine via PubMed",
    identifier: "PMID: 24371462; DOI: 10.1155/2013/571420",
    year: 2013,
    url: "https://pubmed.ncbi.nlm.nih.gov/24371462/"
  },
  {
    id: "ahmad-ashwagandha-semen-hormones-2010",
    title:
      "Withania somnifera improves semen quality by regulating reproductive hormone levels and oxidative stress in seminal plasma of infertile males",
    source: "Fertility and Sterility via PubMed",
    identifier: "PMID: 19501822; DOI: 10.1016/j.fertnstert.2009.04.046",
    year: 2010,
    url: "https://pubmed.ncbi.nlm.nih.gov/19501822/"
  },
  {
    id: "guo-berberine-t2dm-2021",
    title:
      "The Effect of Berberine on Metabolic Profiles in Type 2 Diabetic Patients: A Systematic Review and Meta-Analysis of Randomized Controlled Trials",
    source: "Oxidative Medicine and Cellular Longevity via PubMed",
    identifier: "PMID: 34956436; DOI: 10.1155/2021/2074610",
    year: 2021,
    url: "https://pubmed.ncbi.nlm.nih.gov/34956436/"
  },
  {
    id: "ju-berberine-dyslipidaemia-2018",
    title:
      "Efficacy and safety of berberine for dyslipidaemias: A systematic review and meta-analysis of randomized clinical trials",
    source: "Phytomedicine via PubMed",
    identifier: "PMID: 30466986; DOI: 10.1016/j.phymed.2018.09.212",
    year: 2018,
    url: "https://pubmed.ncbi.nlm.nih.gov/30466986/"
  },
  {
    id: "hernandez-berberine-lipoproteins-2024",
    title:
      "Impact of Berberine or Berberine Combination Products on Lipoprotein, Triglyceride and Biological Safety Marker Concentrations in Patients with Hyperlipidemia: A Systematic Review and Meta-Analysis",
    source: "Journal of Dietary Supplements via PubMed",
    identifier: "PMID: 37183391; DOI: 10.1080/19390211.2023.2212762",
    year: 2024,
    url: "https://pubmed.ncbi.nlm.nih.gov/37183391/"
  },
  {
    id: "blais-berberine-dyslipidemia-2023",
    title:
      "Overall and Sex-Specific Effect of Berberine for the Treatment of Dyslipidemia in Adults: A Systematic Review and Meta-Analysis of Randomized Placebo-Controlled Trials",
    source: "Drugs via PubMed",
    identifier: "PMID: 36941490; DOI: 10.1007/s40265-023-01841-4",
    year: 2023,
    url: "https://pubmed.ncbi.nlm.nih.gov/36941490/"
  },
  {
    id: "mother-to-baby-berberine-2025",
    title: "Berberine",
    source: "MotherToBaby Fact Sheets via NCBI Bookshelf",
    identifier: "Bookshelf ID: NBK600384; PMID: 38349985",
    year: 2025,
    url: "https://www.ncbi.nlm.nih.gov/books/NBK600384/"
  },
  {
    id: "daily-curcumin-arthritis-2016",
    title:
      "Efficacy of Turmeric Extracts and Curcumin for Alleviating the Symptoms of Joint Arthritis: A Systematic Review and Meta-Analysis of Randomized Clinical Trials",
    source: "Journal of Medicinal Food via PubMed",
    identifier: "PMID: 27533649; DOI: 10.1089/jmf.2016.3705",
    year: 2016,
    url: "https://pubmed.ncbi.nlm.nih.gov/27533649/"
  },
  {
    id: "tabrizi-curcumin-inflammation-2019",
    title:
      "The effects of curcumin-containing supplements on biomarkers of inflammation and oxidative stress: A systematic review and meta-analysis of randomized controlled trials",
    source: "Phytotherapy Research via PubMed",
    identifier: "PMID: 30402990; DOI: 10.1002/ptr.6226",
    year: 2019,
    url: "https://pubmed.ncbi.nlm.nih.gov/30402990/"
  },
  {
    id: "white-curcumin-inflammatory-markers-2019",
    title:
      "Oral turmeric/curcumin effects on inflammatory markers in chronic inflammatory diseases: A systematic review and meta-analysis of randomized controlled trials",
    source: "Pharmacological Research via PubMed",
    identifier: "PMID: 31121255; DOI: 10.1016/j.phrs.2019.104280",
    year: 2019,
    url: "https://pubmed.ncbi.nlm.nih.gov/31121255/"
  },
  {
    id: "dehzad-curcumin-inflammatory-oxidative-2023",
    title:
      "Antioxidant and anti-inflammatory effects of curcumin/turmeric supplementation in adults: A GRADE-assessed systematic review and dose-response meta-analysis of randomized controlled trials",
    source: "Cytokine via PubMed",
    identifier: "PMID: 36804260; DOI: 10.1016/j.cyto.2023.156144",
    year: 2023,
    url: "https://pubmed.ncbi.nlm.nih.gov/36804260/"
  },
  {
    id: "nccih-turmeric",
    title: "Turmeric: Usefulness and Safety",
    source: "NIH National Center for Complementary and Integrative Health",
    year: 2025,
    url: "https://www.nccih.nih.gov/health/turmeric"
  },
  {
    id: "tga-turmeric-curcumin-liver-2023",
    title: "Medicines containing turmeric or curcumin - risk of liver injury",
    source: "Therapeutic Goods Administration",
    identifier: "Safety advisory; published 15 August 2023",
    year: 2023,
    url: "https://www.tga.gov.au/safety/safety-monitoring-and-information/safety-alerts/medicines-containing-turmeric-or-curcumin-risk-liver-injury"
  },
  {
    id: "livertox-turmeric",
    title: "Turmeric",
    source: "LiverTox via NCBI Bookshelf",
    identifier: "Bookshelf ID: NBK548561; PMID: 31643876",
    year: 2025,
    url: "https://www.ncbi.nlm.nih.gov/books/NBK548561/"
  },
  {
    id: "collagen-oa-2018",
    title:
      "Effect of collagen supplementation on osteoarthritis symptoms: a meta-analysis of randomized placebo-controlled trials",
    source: "International Orthopaedics via PubMed",
    identifier: "PMID: 30368550; DOI: 10.1007/s00264-018-4211-5",
    year: 2019,
    url: "https://pubmed.ncbi.nlm.nih.gov/30368550/"
  },
  {
    id: "choi-collagen-dermatology-2019",
    title: "Oral Collagen Supplementation: A Systematic Review of Dermatological Applications",
    source: "Journal of Drugs in Dermatology via PubMed",
    identifier: "PMID: 30681787",
    year: 2019,
    url: "https://pubmed.ncbi.nlm.nih.gov/30681787/"
  },
  {
    id: "de-miranda-hydrolyzed-collagen-skin-2021",
    title: "Effects of hydrolyzed collagen supplementation on skin aging: a systematic review and meta-analysis",
    source: "International Journal of Dermatology via PubMed",
    identifier: "PMID: 33742704; DOI: 10.1111/ijd.15518",
    year: 2021,
    url: "https://pubmed.ncbi.nlm.nih.gov/33742704/"
  },
  {
    id: "ferracioli-oda-melatonin-2013",
    title: "Meta-analysis: melatonin for the treatment of primary sleep disorders",
    source: "PLOS One via PubMed",
    identifier: "PMID: 23691095; DOI: 10.1371/journal.pone.0063773",
    year: 2013,
    url: "https://pubmed.ncbi.nlm.nih.gov/23691095/"
  },
  {
    id: "nccih-melatonin",
    title: "Melatonin: What You Need To Know",
    source: "NIH National Center for Complementary and Integrative Health",
    year: 2025,
    url: "https://www.nccih.nih.gov/health/melatonin-what-you-need-to-know"
  },
  {
    id: "besag-melatonin-adverse-events-2019",
    title:
      "Adverse Events Associated with Melatonin for the Treatment of Primary or Secondary Sleep Disorders: A Systematic Review",
    source: "CNS Drugs via PubMed",
    identifier: "PMID: 31722088; DOI: 10.1007/s40263-019-00680-w",
    year: 2019,
    url: "https://pubmed.ncbi.nlm.nih.gov/31722088/"
  },
  {
    id: "menczel-melatonin-high-dose-2022",
    title: "Safety of higher doses of melatonin in adults: A systematic review and meta-analysis",
    source: "Journal of Pineal Research via PubMed",
    identifier: "PMID: 34923676; DOI: 10.1111/jpi.12782",
    year: 2022,
    url: "https://pubmed.ncbi.nlm.nih.gov/34923676/"
  },
  {
    id: "handel-pediatric-melatonin-safety-2023",
    title:
      "The short-term and long-term adverse effects of melatonin treatment in children and adolescents: a systematic review and GRADE assessment",
    source: "EClinicalMedicine via PubMed",
    identifier: "PMID: 37483551; DOI: 10.1016/j.eclinm.2023.102083",
    year: 2023,
    url: "https://pubmed.ncbi.nlm.nih.gov/37483551/"
  },
  {
    id: "mother-to-baby-melatonin-2024",
    title: "Melatonin",
    source: "MotherToBaby Fact Sheets via NCBI Bookshelf",
    identifier: "Bookshelf ID: NBK583263; PMID: 36037545",
    year: 2024,
    url: "https://www.ncbi.nlm.nih.gov/books/NBK583263/"
  },
  {
    id: "cdc-pediatric-melatonin-ingestions-2022",
    title: "Pediatric Melatonin Ingestions - United States, 2012-2021",
    source: "MMWR Morbidity and Mortality Weekly Report",
    identifier: "DOI: 10.15585/mmwr.mm7122a1",
    year: 2022,
    url: "https://www.cdc.gov/mmwr/volumes/71/wr/mm7122a1.htm"
  },
  {
    id: "madsen-melatonin-perioperative-anxiety-2020",
    title: "Melatonin for preoperative and postoperative anxiety in adults",
    source: "Cochrane Database of Systematic Reviews via PubMed",
    identifier: "PMID: 33319916; DOI: 10.1002/14651858.CD009861.pub3",
    year: 2020,
    url: "https://pubmed.ncbi.nlm.nih.gov/33319916/"
  },
  {
    id: "de-crescenzo-melatonin-mood-disorders-2017",
    title: "Melatonin as a treatment for mood disorders: a systematic review",
    source: "Acta Psychiatrica Scandinavica via PubMed",
    identifier: "PMID: 28612993; DOI: 10.1111/acps.12755",
    year: 2017,
    url: "https://pubmed.ncbi.nlm.nih.gov/28612993/"
  },
  {
    id: "shokri-melatonin-depression-bdnf-2023",
    title:
      "Effects of melatonin supplementation on BDNF concentrations and depression: A systematic review and meta-analysis of randomized controlled trials",
    source: "Behavioural Brain Research via PubMed",
    identifier: "PMID: 36049659; DOI: 10.1016/j.bbr.2022.114083",
    year: 2023,
    url: "https://pubmed.ncbi.nlm.nih.gov/36049659/"
  },
  {
    id: "demirhan-melatonin-menopause-mood-2024",
    title:
      "Effects of melatonin intake on depression and anxiety in postmenopausal women: a systematic review and meta-analysis of randomised controlled trials",
    source: "Archives of Women's Mental Health via PubMed",
    identifier: "PMID: 37945913; DOI: 10.1007/s00737-023-01395-0",
    year: 2024,
    url: "https://pubmed.ncbi.nlm.nih.gov/37945913/"
  },
  {
    id: "madsen-medacis-melatonin-acs-2019",
    title:
      "The effect of melatonin on depressive symptoms and anxiety in patients after acute coronary syndrome: The MEDACIS randomized clinical trial",
    source: "Journal of Psychiatric Research via PubMed",
    identifier: "PMID: 31586772; DOI: 10.1016/j.jpsychires.2019.09.014",
    year: 2019,
    url: "https://pubmed.ncbi.nlm.nih.gov/31586772/"
  },
  {
    id: "cochrane-probiotics-urti-2022",
    title: "Probiotics for preventing acute upper respiratory tract infections",
    source: "Cochrane Database of Systematic Reviews via PubMed",
    identifier: "PMID: 36001877; DOI: 10.1002/14651858.CD006895.pub4",
    year: 2022,
    url: "https://pubmed.ncbi.nlm.nih.gov/36001877/"
  },
  {
    id: "ods-probiotics",
    title: "Probiotics - Health Professional Fact Sheet",
    source: "NIH Office of Dietary Supplements",
    year: 2025,
    url: "https://ods.od.nih.gov/factsheets/Probiotics-HealthProfessional/"
  },
  {
    id: "nccih-probiotics",
    title: "Probiotics: Usefulness and Safety",
    source: "NIH National Center for Complementary and Integrative Health",
    year: 2019,
    url: "https://www.nccih.nih.gov/health/probiotics-usefulness-and-safety"
  },
  {
    id: "doron-probiotics-risk-safety-2015",
    title: "Risk and safety of probiotics",
    source: "Clinical Infectious Diseases via PubMed",
    identifier: "PMID: 25922398; DOI: 10.1093/cid/civ085",
    year: 2015,
    url: "https://pubmed.ncbi.nlm.nih.gov/25922398/"
  },
  {
    id: "liong-probiotics-translocation-infection-2008",
    title: "Safety of probiotics: translocation and infection",
    source: "Nutrition Reviews via PubMed",
    identifier: "PMID: 18366533; DOI: 10.1111/j.1753-4887.2008.00024.x",
    year: 2008,
    url: "https://pubmed.ncbi.nlm.nih.gov/18366533/"
  },
  {
    id: "fda-probiotics-preterm-infants-2023",
    title: "FDA Raises Concerns About Probiotic Products Sold for Use in Hospitalized Preterm Infants",
    source: "U.S. Food and Drug Administration",
    identifier: "FDA news release; 26 October 2023",
    year: 2023,
    url: "https://www.fda.gov/news-events/press-announcements/fda-raises-concerns-about-probiotic-products-sold-use-hospitalized-preterm-infants"
  },
  {
    id: "rittiphairoj-probiotics-glycemic-t2dm-2021",
    title:
      "Probiotics Contribute to Glycemic Control in Patients with Type 2 Diabetes Mellitus: A Systematic Review and Meta-Analysis",
    source: "Advances in Nutrition via PubMed",
    identifier: "PMID: 33126241; DOI: 10.1093/advances/nmaa133",
    year: 2021,
    url: "https://pubmed.ncbi.nlm.nih.gov/33126241/"
  },
  {
    id: "li-probiotics-glycemic-t2dm-2023",
    title:
      "The effects of probiotics supplementation on glycaemic control among adults with type 2 diabetes mellitus: a systematic review and meta-analysis of randomised clinical trials",
    source: "Journal of Translational Medicine via PubMed",
    identifier: "PMID: 37415167; DOI: 10.1186/s12967-023-04306-0",
    year: 2023,
    url: "https://pubmed.ncbi.nlm.nih.gov/37415167/"
  },
  {
    id: "baroni-probiotics-synbiotics-diabetes-2024",
    title:
      "Probiotics and synbiotics for glycemic control in diabetes: A systematic review and meta-analysis of randomized controlled trials",
    source: "Clinical Nutrition via PubMed",
    identifier: "PMID: 38527396; DOI: 10.1016/j.clnu.2024.03.006",
    year: 2024,
    url: "https://pubmed.ncbi.nlm.nih.gov/38527396/"
  },
  {
    id: "ho-coq10-bp-primary-hypertension-2016",
    title: "Blood pressure lowering efficacy of coenzyme Q10 for primary hypertension",
    source: "Cochrane Database of Systematic Reviews via PubMed",
    identifier: "PMID: 26935713; DOI: 10.1002/14651858.CD007435.pub3",
    year: 2016,
    url: "https://pubmed.ncbi.nlm.nih.gov/26935713/"
  },
  {
    id: "tabrizi-coq10-bp-metabolic-2018",
    title:
      "The Effects of Coenzyme Q10 Supplementation on Blood Pressures Among Patients with Metabolic Diseases: A Systematic Review and Meta-analysis of Randomized Controlled Trials",
    source: "High Blood Pressure & Cardiovascular Prevention via PubMed",
    identifier: "PMID: 29330704; DOI: 10.1007/s40292-018-0247-2",
    year: 2018,
    url: "https://pubmed.ncbi.nlm.nih.gov/29330704/"
  },
  {
    id: "zhao-coq10-bp-dose-response-2022",
    title:
      "Dose-Response Effect of Coenzyme Q10 Supplementation on Blood Pressure among Patients with Cardiometabolic Disorders: A GRADE-Assessed Systematic Review and Meta-Analysis of Randomized Controlled Trials",
    source: "Advances in Nutrition via PubMed",
    identifier: "PMID: 36130103; DOI: 10.1093/advances/nmac100",
    year: 2022,
    url: "https://pubmed.ncbi.nlm.nih.gov/36130103/"
  },
  {
    id: "karimi-coq10-bp-heart-rate-2025",
    title:
      "Effects of coenzyme Q10 administration on blood pressure and heart rate in adults: A systematic review and meta-analysis of randomized controlled trials",
    source: "International Journal of Cardiology. Cardiovascular Risk and Prevention via PubMed",
    identifier: "PMID: 40495903; DOI: 10.1016/j.ijcrp.2025.200424",
    year: 2025,
    url: "https://pubmed.ncbi.nlm.nih.gov/40495903/"
  },
  {
    id: "nccih-coq10",
    title: "Coenzyme Q10",
    source: "NIH National Center for Complementary and Integrative Health",
    identifier: "NCCIH fact sheet; last updated January 2019",
    year: 2019,
    url: "https://www.nccih.nih.gov/health/coenzyme-q10"
  },
  {
    id: "hidaka-coq10-safety-2008",
    title: "Safety assessment of coenzyme Q10 (CoQ10)",
    source: "BioFactors via PubMed",
    identifier: "PMID: 19096117; DOI: 10.1002/biof.5520320124",
    year: 2008,
    url: "https://pubmed.ncbi.nlm.nih.gov/19096117/"
  },
  {
    id: "hathcock-coq10-risk-assessment-2006",
    title: "Risk assessment for coenzyme Q10 (Ubiquinone)",
    source: "Regulatory Toxicology and Pharmacology via PubMed",
    identifier: "PMID: 16814438; DOI: 10.1016/j.yrtph.2006.05.006",
    year: 2006,
    url: "https://pubmed.ncbi.nlm.nih.gov/16814438/"
  },
  {
    id: "livertox-coq10-2024",
    title: "Coenzyme Q10",
    source: "LiverTox via NCBI Bookshelf",
    identifier: "Last update: 20 April 2024",
    year: 2024,
    url: "https://www.ncbi.nlm.nih.gov/books/NBK603562/"
  },
  {
    id: "landbo-warfarin-coq10-1998",
    title: "Interaction between warfarin and coenzyme Q10",
    source: "Ugeskrift for Laeger via PubMed",
    identifier: "PMID: 9621803",
    year: 1998,
    url: "https://pubmed.ncbi.nlm.nih.gov/9621803/"
  },
  {
    id: "williams-l-theanine-stress-anxiety-2020",
    title:
      "The Effects of Green Tea Amino Acid L-Theanine Consumption on the Ability to Manage Stress and Anxiety Levels: a Systematic Review",
    source: "Plant Foods for Human Nutrition via PubMed",
    identifier: "PMID: 31758301; DOI: 10.1007/s11130-019-00771-5",
    year: 2020,
    url: "https://pubmed.ncbi.nlm.nih.gov/31758301/"
  },
  {
    id: "hidese-l-theanine-stress-cognition-2019",
    title:
      "Effects of L-Theanine Administration on Stress-Related Symptoms and Cognitive Functions in Healthy Adults: A Randomized Controlled Trial",
    source: "Nutrients via PubMed",
    identifier: "PMID: 31623400; DOI: 10.3390/nu11102362",
    year: 2019,
    url: "https://pubmed.ncbi.nlm.nih.gov/31623400/"
  },
  {
    id: "lyon-l-theanine-adhd-sleep-2011",
    title:
      "The effects of L-theanine (Suntheanine) on objective sleep quality in boys with attention deficit hyperactivity disorder (ADHD): a randomized, double-blind, placebo-controlled clinical trial",
    source: "Alternative Medicine Review via PubMed",
    identifier: "PMID: 22214254",
    year: 2011,
    url: "https://pubmed.ncbi.nlm.nih.gov/22214254/"
  },
  {
    id: "anand-adhd-insomnia-drugs-2017",
    title:
      "Safety, Tolerability and Efficacy of Drugs for Treating Behavioural Insomnia in Children with Attention-Deficit/Hyperactivity Disorder: A Systematic Review with Methodological Quality Assessment",
    source: "Paediatric Drugs via PubMed",
    identifier: "PMID: 28391425; DOI: 10.1007/s40272-017-0224-6",
    year: 2017,
    url: "https://pubmed.ncbi.nlm.nih.gov/28391425/"
  },
  {
    id: "moshfeghinia-l-theanine-mental-disorders-2024",
    title:
      "The effects of L-theanine supplementation on the outcomes of patients with mental disorders: a systematic review",
    source: "BMC Psychiatry via PubMed",
    identifier: "PMID: 39633316; DOI: 10.1186/s12888-024-06285-y",
    year: 2024,
    url: "https://pubmed.ncbi.nlm.nih.gov/39633316/"
  },
  {
    id: "kimura-l-theanine-stress-response-2007",
    title: "L-Theanine reduces psychological and physiological stress responses",
    source: "Biological Psychology via PubMed",
    identifier: "PMID: 16930802; DOI: 10.1016/j.biopsycho.2006.06.006",
    year: 2007,
    url: "https://pubmed.ncbi.nlm.nih.gov/16930802/"
  },
  {
    id: "yoto-l-theanine-stress-bp-2012",
    title:
      "Effects of L-theanine or caffeine intake on changes in blood pressure under physical and psychological stresses",
    source: "Journal of Physiological Anthropology via PubMed",
    identifier: "PMID: 23107346; DOI: 10.1186/1880-6805-31-28",
    year: 2012,
    url: "https://pubmed.ncbi.nlm.nih.gov/23107346/"
  },
  {
    id: "sarris-l-theanine-gad-2019",
    title:
      "L-theanine in the adjunctive treatment of generalized anxiety disorder: A double-blind, randomised, placebo-controlled trial",
    source: "Journal of Psychiatric Research via PubMed",
    identifier: "PMID: 30580081; DOI: 10.1016/j.jpsychires.2018.12.014",
    year: 2019,
    url: "https://pubmed.ncbi.nlm.nih.gov/30580081/"
  },
  {
    id: "issn-beta-alanine-position-stand-2015",
    title: "International society of sports nutrition position stand: Beta-Alanine",
    source: "Journal of the International Society of Sports Nutrition via PubMed",
    identifier: "PMID: 26175657; DOI: 10.1186/s12970-015-0090-y",
    year: 2015,
    url: "https://pubmed.ncbi.nlm.nih.gov/26175657/"
  },
  {
    id: "hobson-beta-alanine-performance-2012",
    title: "Effects of beta-alanine supplementation on exercise performance: a meta-analysis",
    source: "Amino Acids via PubMed",
    identifier: "PMID: 22270875; DOI: 10.1007/s00726-011-1200-z",
    year: 2012,
    url: "https://pubmed.ncbi.nlm.nih.gov/22270875/"
  },
  {
    id: "saunders-beta-alanine-exercise-2017",
    title:
      "Beta-alanine supplementation to improve exercise capacity and performance: a systematic review and meta-analysis",
    source: "British Journal of Sports Medicine via PubMed",
    identifier: "PMID: 27797728; DOI: 10.1136/bjsports-2016-096396",
    year: 2017,
    url: "https://pubmed.ncbi.nlm.nih.gov/27797728/"
  },
  {
    id: "dolan-beta-alanine-risk-assessment-2019",
    title: "A Systematic Risk Assessment and Meta-Analysis on the Use of Oral Beta-Alanine Supplementation",
    source: "Advances in Nutrition via PubMed Central",
    identifier: "PMID: 30980076; DOI: 10.1093/advances/nmy115",
    year: 2019,
    url: "https://pubmed.ncbi.nlm.nih.gov/30980076/"
  },
  {
    id: "ko-beta-alanine-military-2014",
    title:
      "Evidence-based evaluation of potential benefits and safety of beta-alanine supplementation for military personnel",
    source: "Nutrition Reviews via PubMed",
    identifier: "PMID: 24697258; DOI: 10.1111/nure.12087",
    year: 2014,
    url: "https://pubmed.ncbi.nlm.nih.gov/24697258/"
  },
  {
    id: "mirenayat-l-citrulline-bp-2018",
    title: "Effect of L-Citrulline Supplementation on Blood Pressure: a Systematic Review and Meta-Analysis of Clinical Trials",
    source: "Current Hypertension Reports via PubMed",
    identifier: "PMID: 30284051; DOI: 10.1007/s11906-018-0898-3",
    year: 2018,
    url: "https://pubmed.ncbi.nlm.nih.gov/30284051/"
  },
  {
    id: "barkhidarian-l-citrulline-bp-2019",
    title: "Effects of L-citrulline supplementation on blood pressure: A systematic review and meta-analysis",
    source: "Avicenna Journal of Phytomedicine via PubMed Central",
    identifier: "PMID: 30788274; PMCID: PMC6369322",
    year: 2019,
    url: "https://pubmed.ncbi.nlm.nih.gov/30788274/"
  },
  {
    id: "luo-l-citrulline-bp-older-adults-2025",
    title:
      "Does l-citrulline supplementation and watermelon intake reduce blood pressure in middle-aged and older adults? A systematic review and meta-analysis of randomized controlled trials",
    source: "Clinical Nutrition ESPEN via PubMed",
    identifier: "PMID: 40789388; DOI: 10.1016/j.clnesp.2025.07.1130",
    year: 2025,
    url: "https://pubmed.ncbi.nlm.nih.gov/40789388/"
  },
  {
    id: "luo-l-citrulline-cold-bp-2026",
    title:
      "Effect of L-Citrulline Intake on Blood Pressure in Cold Environments: A Systematic Review and Meta-Analysis of Randomized Controlled Trials",
    source: "Food Science & Nutrition via PubMed Central",
    identifier: "PMID: 41797970; DOI: 10.1002/fsn3.71603",
    year: 2026,
    url: "https://pubmed.ncbi.nlm.nih.gov/41797970/"
  },
  {
    id: "rhim-citrulline-rpe-soreness-2020",
    title:
      "Effect of citrulline on post-exercise rating of perceived exertion, muscle soreness, and blood lactate levels: A systematic review and meta-analysis",
    source: "Journal of Sport and Health Science via PubMed",
    identifier: "PMID: 33308806; DOI: 10.1016/j.jshs.2020.02.003",
    year: 2020,
    url: "https://pubmed.ncbi.nlm.nih.gov/33308806/"
  },
  {
    id: "varvik-citrulline-repetition-performance-2021",
    title: "Acute Effect of Citrulline Malate on Repetition Performance During Strength Training: A Systematic Review and Meta-Analysis",
    source: "International Journal of Sport Nutrition and Exercise Metabolism via PubMed",
    identifier: "PMID: 34010809; DOI: 10.1123/ijsnem.2020-0295",
    year: 2021,
    url: "https://pubmed.ncbi.nlm.nih.gov/34010809/"
  },
  {
    id: "aguiar-citrulline-malate-strength-2022",
    title:
      "Effects of Citrulline Malate Supplementation on Muscle Strength in Resistance-Trained Adults: A Systematic Review and Meta-Analysis of Randomized Controlled Trials",
    source: "Journal of Dietary Supplements via PubMed",
    identifier: "PMID: 34176406; DOI: 10.1080/19390211.2021.1939473",
    year: 2022,
    url: "https://pubmed.ncbi.nlm.nih.gov/34176406/"
  },
  {
    id: "guan-taurine-bp-lipids-2020",
    title:
      "The effects of taurine supplementation on obesity, blood pressure and lipid profile: A meta-analysis of randomized controlled trials",
    source: "European Journal of Pharmacology via PubMed",
    identifier: "PMID: 32871172; DOI: 10.1016/j.ejphar.2020.173533",
    year: 2020,
    url: "https://pubmed.ncbi.nlm.nih.gov/32871172/"
  },
  {
    id: "tzang-taurine-metabolic-syndrome-2024",
    title: "Taurine reduces the risk for metabolic syndrome: a systematic review and meta-analysis of randomized controlled trials",
    source: "Nutrition & Diabetes via PubMed Central",
    identifier: "PMID: 38755142; DOI: 10.1038/s41387-024-00289-z",
    year: 2024,
    url: "https://pubmed.ncbi.nlm.nih.gov/38755142/"
  },
  {
    id: "nie-taurine-cardiometabolic-2025",
    title:
      "Effects of Oral Taurine Supplementation on Cardiometabolic Risk Factors: A Meta-analysis and Systematic Review of Randomized Clinical Trials",
    source: "Nutrition Reviews via PubMed",
    identifier: "PMID: 41275513; DOI: 10.1093/nutrit/nuaf220",
    year: 2025,
    url: "https://pubmed.ncbi.nlm.nih.gov/41275513/"
  },
  {
    id: "shao-taurine-risk-assessment-2008",
    title: "Risk assessment for the amino acids taurine, L-glutamine and L-arginine",
    source: "Regulatory Toxicology and Pharmacology via PubMed",
    identifier: "PMID: 18325648; DOI: 10.1016/j.yrtph.2008.01.004",
    year: 2008,
    url: "https://pubmed.ncbi.nlm.nih.gov/18325648/"
  },
  {
    id: "efsa-taurine-energy-drinks-2009",
    title:
      "The use of taurine and D-glucurono-gamma-lactone as constituents of the so-called energy drinks",
    source: "European Food Safety Authority",
    identifier: "EFSA Journal 2009; 935; DOI: 10.2903/j.efsa.2009.935",
    year: 2009,
    url: "https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2009.935"
  },
  {
    id: "papi-nac-copd-chronic-bronchitis-2024",
    title:
      "N-acetylcysteine Treatment in Chronic Obstructive Pulmonary Disease (COPD) and Chronic Bronchitis/Pre-COPD: Distinct Meta-analyses",
    source: "Archivos de Bronconeumologia via PubMed",
    identifier: "PMID: 38555190; DOI: 10.1016/j.arbres.2024.03.010",
    year: 2024,
    url: "https://pubmed.ncbi.nlm.nih.gov/38555190/"
  },
  {
    id: "poole-mucolytics-copd-2019",
    title: "Mucolytic agents versus placebo for chronic bronchitis or chronic obstructive pulmonary disease",
    source: "Cochrane Database of Systematic Reviews via PubMed",
    identifier: "PMID: 31107966; DOI: 10.1002/14651858.CD001287.pub6",
    year: 2019,
    url: "https://pubmed.ncbi.nlm.nih.gov/31107966/"
  },
  {
    id: "zheng-pantheon-nac-copd-2014",
    title:
      "Twice daily N-acetylcysteine 600 mg for exacerbations of chronic obstructive pulmonary disease (PANTHEON): a randomised, double-blind placebo-controlled trial",
    source: "The Lancet Respiratory Medicine via PubMed",
    identifier: "PMID: 24621680; DOI: 10.1016/S2213-2600(13)70286-8",
    year: 2014,
    url: "https://pubmed.ncbi.nlm.nih.gov/24621680/"
  },
  {
    id: "tse-hiace-nac-copd-2013",
    title:
      "High-dose N-acetylcysteine in stable COPD: the 1-year, double-blind, randomized, placebo-controlled HIACE study",
    source: "Chest via PubMed",
    identifier: "PMID: 23348146; DOI: 10.1378/chest.12-2357",
    year: 2013,
    url: "https://pubmed.ncbi.nlm.nih.gov/23348146/"
  },
  {
    id: "rogliani-mucolytic-antioxidant-copd-2019",
    title:
      "Efficacy and safety profile of mucolytic/antioxidant agents in chronic obstructive pulmonary disease: a comparative analysis across erdosteine, carbocysteine, and N-acetylcysteine",
    source: "Respiratory Research via PubMed",
    identifier: "PMID: 31133026; DOI: 10.1186/s12931-019-1078-y",
    year: 2019,
    url: "https://pubmed.ncbi.nlm.nih.gov/31133026/"
  },
  {
    id: "rhodes-nac-performance-side-effects-2017",
    title: "Performance and Side Effects of Supplementation with N-Acetylcysteine: A Systematic Review and Meta-Analysis",
    source: "Sports Medicine via PubMed",
    identifier: "PMID: 28102488; DOI: 10.1007/s40279-017-0677-3",
    year: 2017,
    url: "https://pubmed.ncbi.nlm.nih.gov/28102488/"
  },
  {
    id: "dailymed-acetylcysteine-inhalant-label",
    title: "DailyMed label: Acetylcysteine inhalant",
    source: "DailyMed / U.S. National Library of Medicine",
    identifier: "Updated 2024-12-17",
    year: 2024,
    url: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=f56b4087-db48-4fd7-84ec-9c927962b805"
  },
  {
    id: "fda-nac-enforcement-discretion-2022",
    title: "Guidance for Industry: Policy Regarding N-acetyl-L-cysteine",
    source: "U.S. Food and Drug Administration",
    identifier: "FDA-2022-D-0490; final guidance August 2022",
    year: 2022,
    url: "https://www.fda.gov/regulatory-information/search-fda-guidance-documents/guidance-industry-policy-regarding-n-acetyl-l-cysteine"
  },
  {
    id: "meng-glucosamine-chondroitin-knee-oa-2023",
    title:
      "Efficacy and safety of the combination of glucosamine and chondroitin for knee osteoarthritis: a systematic review and meta-analysis",
    source: "Archives of Orthopaedic and Trauma Surgery via PubMed",
    identifier: "PMID: 35024906; DOI: 10.1007/s00402-021-04326-9",
    year: 2023,
    url: "https://pubmed.ncbi.nlm.nih.gov/35024906/"
  },
  {
    id: "clegg-gait-glucosamine-chondroitin-2006",
    title: "Glucosamine, chondroitin sulfate, and the two in combination for painful knee osteoarthritis",
    source: "New England Journal of Medicine via PubMed",
    identifier: "PMID: 16495392; DOI: 10.1056/NEJMoa052771",
    year: 2006,
    url: "https://pubmed.ncbi.nlm.nih.gov/16495392/"
  },
  {
    id: "hochberg-moves-glucosamine-chondroitin-2016",
    title:
      "Combined chondroitin sulfate and glucosamine for painful knee osteoarthritis: a multicentre, randomised, double-blind, non-inferiority trial versus celecoxib",
    source: "Annals of the Rheumatic Diseases via PubMed",
    identifier: "PMID: 25589511; DOI: 10.1136/annrheumdis-2014-206792",
    year: 2016,
    url: "https://pubmed.ncbi.nlm.nih.gov/25589511/"
  },
  {
    id: "wandel-glucosamine-chondroitin-oa-2010",
    title:
      "Effects of glucosamine, chondroitin, or placebo in patients with osteoarthritis of hip or knee: network meta-analysis",
    source: "BMJ via PubMed",
    identifier: "PMID: 20847017; DOI: 10.1136/bmj.c4675",
    year: 2010,
    url: "https://pubmed.ncbi.nlm.nih.gov/20847017/"
  },
  {
    id: "honvo-sysadoa-safety-2019",
    title:
      "Safety of Symptomatic Slow-Acting Drugs for Osteoarthritis: Outcomes of a Systematic Review and Meta-Analysis",
    source: "Drugs & Aging via PubMed Central",
    identifier: "PMID: 31073924; DOI: 10.1007/s40266-019-00662-z",
    year: 2019,
    url: "https://pubmed.ncbi.nlm.nih.gov/31073924/"
  },
  {
    id: "nccih-glucosamine-chondroitin-oa",
    title: "Glucosamine and Chondroitin for Osteoarthritis: What You Need To Know",
    source: "NIH National Center for Complementary and Integrative Health",
    identifier: "NCCIH consumer health information",
    year: 2023,
    url: "https://www.nccih.nih.gov/health/glucosamine-and-chondroitin-for-osteoarthritis-what-you-need-to-know"
  },
  {
    id: "knudsen-glucosamine-warfarin-2008",
    title:
      "Potential glucosamine-warfarin interaction resulting in increased international normalized ratio: case report and review of the literature and MedWatch database",
    source: "Pharmacotherapy via PubMed",
    identifier: "PMID: 18363538; DOI: 10.1592/phco.28.4.540",
    year: 2008,
    url: "https://pubmed.ncbi.nlm.nih.gov/18363538/"
  },
  {
    id: "tga-natures-own-glucosamine-recall-2026",
    title: "Nature's Own Glucosamine Sulfate with Chondroitin recall",
    source: "Therapeutic Goods Administration",
    identifier: "Published 2026-06-03; ARTG 351737 batch 1662937",
    year: 2026,
    url: "https://www.tga.gov.au/safety/recalls-and-other-market-actions/market-actions/natures-own-glucosamine-sulfate-chondroitin-and-natures-own-magnesium-glycinate-1150mg"
  },
  {
    id: "rubeor-iron-deficient-nonanemic-athletes-2018",
    title: "Does Iron Supplementation Improve Performance in Iron-Deficient Nonanemic Athletes?",
    source: "Sports Health via PubMed Central",
    identifier: "PMID: 29792778; DOI: 10.1177/1941738118777488",
    year: 2018,
    url: "https://pubmed.ncbi.nlm.nih.gov/29792778/"
  },
  {
    id: "pengelly-iron-female-athletes-performance-2025",
    title: "Iron deficiency, supplementation, and sports performance in female athletes: A systematic review",
    source: "Journal of Sport and Health Science via PubMed",
    identifier: "PMID: 39536912; DOI: 10.1016/j.jshs.2024.101009",
    year: 2025,
    url: "https://pubmed.ncbi.nlm.nih.gov/39536912/"
  },
  {
    id: "smid-oral-iron-athletes-meta-2024",
    title:
      "Effects of Oral Iron Supplementation on Blood Iron Status in Athletes: A Systematic Review, Meta-Analysis and Meta-Regression of Randomized Controlled Trials",
    source: "Sports Medicine via PubMed",
    identifier: "PMID: 38407751; DOI: 10.1007/s40279-024-01992-8",
    year: 2024,
    url: "https://pubmed.ncbi.nlm.nih.gov/38407751/"
  },
  {
    id: "brutsaert-iron-fatigue-resistance-2003",
    title:
      "Iron supplementation improves progressive fatigue resistance during dynamic knee extensor exercise in iron-depleted, nonanemic women",
    source: "American Journal of Clinical Nutrition via PubMed",
    identifier: "PMID: 12540406; DOI: 10.1093/ajcn/77.2.441",
    year: 2003,
    url: "https://pubmed.ncbi.nlm.nih.gov/12540406/"
  },
  {
    id: "vaucher-iron-fatigue-low-ferritin-2012",
    title: "Effect of iron supplementation on fatigue in nonanemic menstruating women with low ferritin: a randomized controlled trial",
    source: "CMAJ via PubMed Central",
    identifier: "PMID: 22777991; DOI: 10.1503/cmaj.110950",
    year: 2012,
    url: "https://pubmed.ncbi.nlm.nih.gov/22777991/"
  },
  {
    id: "ods-iron",
    title: "Iron - Health Professional Fact Sheet",
    source: "NIH Office of Dietary Supplements",
    identifier: "Updated 2025-09-18",
    year: 2025,
    url: "https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/"
  },
  {
    id: "tolkien-ferrous-sulfate-gi-2015",
    title:
      "Ferrous sulfate supplementation causes significant gastrointestinal side-effects in adults: a systematic review and meta-analysis",
    source: "PLOS ONE via PubMed Central",
    identifier: "PMID: 25700159; DOI: 10.1371/journal.pone.0117383",
    year: 2015,
    url: "https://pubmed.ncbi.nlm.nih.gov/25700159/"
  },
  {
    id: "low-daily-iron-menstruating-women-2016",
    title: "Daily iron supplementation for improving anaemia, iron status and health in menstruating women",
    source: "Cochrane Database of Systematic Reviews via PubMed",
    identifier: "PMID: 27087396; DOI: 10.1002/14651858.CD009747.pub2",
    year: 2016,
    url: "https://pubmed.ncbi.nlm.nih.gov/27087396/"
  },
  {
    id: "obeid-b12-deficiency-consensus-2024",
    title: "Diagnosis, Treatment and Long-Term Management of Vitamin B12 Deficiency in Adults: A Delphi Expert Consensus",
    source: "Journal of Clinical Medicine via PubMed Central",
    identifier: "PMID: 38673453; DOI: 10.3390/jcm13082176",
    year: 2024,
    url: "https://pubmed.ncbi.nlm.nih.gov/38673453/"
  },
  {
    id: "berg-b-vitamins-global-cognition-2025",
    title: "Efficacy of B Vitamin Supplementation on Global Cognitive Function in Older Adults: A Systematic Review and Meta-analysis",
    source: "Nutrition Reviews via PubMed",
    identifier: "PMID: 40966571; DOI: 10.1093/nutrit/nuaf155",
    year: 2025,
    url: "https://pubmed.ncbi.nlm.nih.gov/40966571/"
  },
  {
    id: "wang-b-vitamins-cognitive-decline-2022",
    title: "B vitamins and prevention of cognitive decline and incident dementia: a systematic review and meta-analysis",
    source: "Nutrition Reviews via PubMed",
    identifier: "PMID: 34432056; DOI: 10.1093/nutrit/nuab057",
    year: 2022,
    url: "https://pubmed.ncbi.nlm.nih.gov/34432056/"
  },
  {
    id: "behrens-vitamin-b-cognitive-decline-2020",
    title: "Vitamin B-Can it prevent cognitive decline? A systematic review and meta-analysis",
    source: "Systematic Reviews via PubMed Central",
    identifier: "PMID: 32414424; DOI: 10.1186/s13643-020-01378-7",
    year: 2020,
    url: "https://pubmed.ncbi.nlm.nih.gov/32414424/"
  },
  {
    id: "ods-vitamin-b12",
    title: "Vitamin B12 - Health Professional Fact Sheet",
    source: "NIH Office of Dietary Supplements",
    identifier: "Updated 2024-12-19",
    year: 2024,
    url: "https://ods.od.nih.gov/factsheets/VitaminB12-HealthProfessional/"
  },
  {
    id: "abdelwahab-b12-routes-2024",
    title:
      "Efficacy of different routes of vitamin B12 supplementation for the treatment of patients with vitamin B12 deficiency: A systematic review and network meta-analysis",
    source: "Irish Journal of Medical Science via PubMed",
    identifier: "PMID: 38231320; DOI: 10.1007/s11845-023-03602-4",
    year: 2024,
    url: "https://pubmed.ncbi.nlm.nih.gov/38231320/"
  },
  {
    id: "de-regil-folate-birth-defects-2015",
    title: "Effects and safety of periconceptional oral folate supplementation for preventing birth defects",
    source: "Cochrane Database of Systematic Reviews via PubMed",
    identifier: "PMID: 26662928; DOI: 10.1002/14651858.CD007950.pub3",
    year: 2015,
    url: "https://pubmed.ncbi.nlm.nih.gov/26662928/"
  },
  {
    id: "uspstf-folic-acid-ntd-2023",
    title:
      "Folic Acid Supplementation to Prevent Neural Tube Defects: US Preventive Services Task Force Reaffirmation Recommendation Statement",
    source: "JAMA via PubMed",
    identifier: "PMID: 37526713; DOI: 10.1001/jama.2023.12876",
    year: 2023,
    url: "https://pubmed.ncbi.nlm.nih.gov/37526713/"
  },
  {
    id: "viswanathan-folic-acid-evidence-review-2023",
    title:
      "Folic Acid Supplementation to Prevent Neural Tube Defects: Updated Evidence Report and Systematic Review for the US Preventive Services Task Force",
    source: "JAMA via PubMed",
    identifier: "PMID: 37526714; DOI: 10.1001/jama.2023.9864",
    year: 2023,
    url: "https://pubmed.ncbi.nlm.nih.gov/37526714/"
  },
  {
    id: "ods-folate",
    title: "Folate - Health Professional Fact Sheet",
    source: "NIH Office of Dietary Supplements",
    identifier: "Updated 2024-11-15",
    year: 2024,
    url: "https://ods.od.nih.gov/factsheets/Folate-HealthProfessional/"
  },
  {
    id: "benjamim-beetroot-bp-2022",
    title:
      "Nitrate Derived From Beetroot Juice Lowers Blood Pressure in Patients With Arterial Hypertension: A Systematic Review and Meta-Analysis",
    source: "Frontiers in Nutrition via PubMed",
    identifier: "PMID: 35369064; DOI: 10.3389/fnut.2022.823039",
    year: 2022,
    url: "https://pubmed.ncbi.nlm.nih.gov/35369064/"
  },
  {
    id: "mcmahon-nitrate-endurance-2017",
    title:
      "The Effect of Dietary Nitrate Supplementation on Endurance Exercise Performance in Healthy Adults: A Systematic Review and Meta-Analysis",
    source: "Sports Medicine via PubMed",
    identifier: "PMID: 27600147; DOI: 10.1007/s40279-016-0617-7",
    year: 2017,
    url: "https://pubmed.ncbi.nlm.nih.gov/27600147/"
  },
  {
    id: "ais-dietary-nitrate-beetroot",
    title: "Dietary Nitrate / Beetroot Juice",
    source: "Australian Institute of Sport",
    year: 2026,
    url: "https://www.ausport.gov.au/ais/nutrition/supplements/group_a/performance-supplements2/beetroot-juicenitrate"
  },
  {
    id: "issn-sodium-bicarbonate-2021",
    title:
      "International Society of Sports Nutrition position stand: sodium bicarbonate and exercise performance",
    source: "Journal of the International Society of Sports Nutrition via PubMed",
    identifier: "PMID: 34503527; DOI: 10.1186/s12970-021-00458-w",
    year: 2021,
    url: "https://pubmed.ncbi.nlm.nih.gov/34503527/"
  },
  {
    id: "ais-sodium-bicarbonate",
    title: "Sodium Bicarbonate",
    source: "Australian Institute of Sport",
    year: 2026,
    url: "https://www.ausport.gov.au/ais/nutrition/supplements/group_a/performance-supplements2/bicarbonate"
  },
  {
    id: "ods-exercise-performance-sodium-bicarbonate",
    title: "Dietary Supplements for Exercise and Athletic Performance - Health Professional Fact Sheet",
    source: "NIH Office of Dietary Supplements",
    year: 2024,
    url: "https://ods.od.nih.gov/factsheets/ExerciseAndAthleticPerformance-HealthProfessional/"
  },
  {
    id: "hemila-vitamin-c-common-cold-2013",
    title: "Vitamin C for preventing and treating the common cold",
    source: "Cochrane Database of Systematic Reviews via PubMed",
    identifier: "PMID: 23440782; DOI: 10.1002/14651858.CD000980.pub4",
    year: 2013,
    url: "https://pubmed.ncbi.nlm.nih.gov/23440782/"
  },
  {
    id: "hemila-vitamin-c-cold-severity-2023",
    title: "Vitamin C reduces the severity of common colds: a meta-analysis",
    source: "BMC Public Health via PubMed",
    identifier: "PMID: 38082300; DOI: 10.1186/s12889-023-17229-8",
    year: 2023,
    url: "https://pubmed.ncbi.nlm.nih.gov/38082300/"
  },
  {
    id: "ods-vitamin-c",
    title: "Vitamin C - Health Professional Fact Sheet",
    source: "NIH Office of Dietary Supplements",
    year: 2025,
    url: "https://ods.od.nih.gov/factsheets/VitaminC-HealthProfessional/"
  },
  {
    id: "resveratrol-t2d-meta-2021",
    title: "Resveratrol supplementation and type 2 diabetes: a systematic review and meta-analysis",
    source: "Critical Reviews in Food Science and Nutrition via PubMed",
    identifier: "PMID: 33480264; DOI: 10.1080/10408398.2021.1875980",
    year: 2022,
    url: "https://pubmed.ncbi.nlm.nih.gov/33480264/"
  },
  {
    id: "semba-resveratrol-mortality-2014",
    title: "Resveratrol levels and all-cause mortality in older community-dwelling adults",
    source: "JAMA Internal Medicine via PubMed",
    identifier: "PMID: 24819981; DOI: 10.1001/jamainternmed.2014.1582",
    year: 2014,
    url: "https://pubmed.ncbi.nlm.nih.gov/24819981/"
  },
  {
    id: "livertox-resveratrol",
    title: "Resveratrol",
    source: "LiverTox via NCBI Bookshelf",
    identifier: "Updated 2024-11-30",
    year: 2024,
    url: "https://www.ncbi.nlm.nih.gov/books/NBK548465/"
  },
  {
    id: "resveratrol-drug-interactions-2012",
    title: "Drug interaction potential of resveratrol",
    source: "Drug Metabolism Reviews via PubMed",
    identifier: "PMID: 22788578; DOI: 10.3109/03602532.2012.700715",
    year: 2012,
    url: "https://pubmed.ncbi.nlm.nih.gov/22788578/"
  },
  {
    id: "huang-quercetin-cardiometabolic-2020",
    title:
      "Effect of quercetin supplementation on plasma lipid profiles, blood pressure, and glucose levels: a systematic review and meta-analysis",
    source: "Nutrition Reviews via PubMed",
    identifier: "PMID: 31940027; DOI: 10.1093/nutrit/nuz071",
    year: 2020,
    url: "https://pubmed.ncbi.nlm.nih.gov/31940027/"
  },
  {
    id: "serban-quercetin-bp-2016",
    title:
      "Effects of Quercetin on Blood Pressure: A Systematic Review and Meta-Analysis of Randomized Controlled Trials",
    source: "Journal of the American Heart Association via PubMed",
    identifier: "PMID: 27405810; DOI: 10.1161/JAHA.115.002713",
    year: 2016,
    url: "https://pubmed.ncbi.nlm.nih.gov/27405810/"
  },
  {
    id: "livertox-quercetin",
    title: "Quercetin",
    source: "LiverTox via NCBI Bookshelf",
    identifier: "PMID: 32364690; Updated 2020-03-28",
    year: 2020,
    url: "https://www.ncbi.nlm.nih.gov/books/NBK556474/"
  },
  {
    id: "andres-quercetin-safety-2018",
    title: "Safety Aspects of the Use of Quercetin as a Dietary Supplement",
    source: "Molecular Nutrition & Food Research via PubMed",
    identifier: "PMID: 29127724; DOI: 10.1002/mnfr.201700447",
    year: 2018,
    url: "https://pubmed.ncbi.nlm.nih.gov/29127724/"
  },
  {
    id: "yousefzadeh-fisetin-senotherapeutic-2018",
    title: "Fisetin is a senotherapeutic that extends health and lifespan",
    source: "EBioMedicine via PubMed",
    identifier: "PMID: 30279143; DOI: 10.1016/j.ebiom.2018.09.015",
    year: 2018,
    url: "https://pubmed.ncbi.nlm.nih.gov/30279143/"
  },
  {
    id: "fisetin-senotherapeutic-review-2024",
    title: "Fisetin as a senotherapeutic agent: Evidence and perspectives for age-related diseases",
    source: "Mechanisms of Ageing and Development via PubMed",
    identifier: "PMID: 39384074; DOI: 10.1016/j.mad.2024.111995",
    year: 2024,
    url: "https://pubmed.ncbi.nlm.nih.gov/39384074/"
  },
  {
    id: "ctgov-fisetin-vascular-aging-nct06133634",
    title: "Fisetin to Improve Vascular Function in Older Adults",
    source: "ClinicalTrials.gov",
    identifier: "NCT06133634; ACTIVE_NOT_RECRUITING",
    year: 2026,
    url: "https://clinicaltrials.gov/study/NCT06133634"
  },
  {
    id: "ctgov-fisetin-safety-pk-nct06431932",
    title: "Pilot Trial of Fisetin in Healthy Volunteers and Older Patients With Multimorbidity",
    source: "ClinicalTrials.gov",
    identifier: "NCT06431932; RECRUITING",
    year: 2026,
    url: "https://clinicaltrials.gov/study/NCT06431932"
  },
  {
    id: "ctgov-fisetin-oa-nct04210986",
    title: "Senolytic Drugs Attenuate Osteoarthritis-Related Articular Cartilage Degeneration: A Clinical Trial",
    source: "ClinicalTrials.gov",
    identifier: "NCT04210986; COMPLETED",
    year: 2026,
    url: "https://clinicaltrials.gov/study/NCT04210986"
  },
  {
    id: "ncbi-eutilities",
    title: "Entrez Programming Utilities Help",
    source: "NCBI Bookshelf",
    url: "https://www.ncbi.nlm.nih.gov/books/NBK25497/"
  },
  {
    id: "clinicaltrials-api",
    title: "ClinicalTrials.gov API",
    source: "ClinicalTrials.gov",
    url: "https://clinicaltrials.gov/data-about-studies/learn-about-api"
  }
];

export const interventions: Intervention[] = [
  {
    id: "creatine",
    name: "Creatine monohydrate",
    slug: "creatine-monohydrate",
    synonyms: ["creatine", "creatine hydrate"],
    category: "Ergogenic/performance supplement",
    commonForms: ["Monohydrate powder", "Capsules"],
    regulatoryStatus: "Dietary supplement in many regions; product quality varies by manufacturer.",
    safetySummary:
      "Generally treated as low regulatory risk for healthy adults in supplement contexts; kidney disease or abnormal renal markers require clinician review.",
    interactionSummary: "Hydration status and renal history should be considered in review.",
    evidenceSummary:
      "Strongest seed evidence is for strength, power, and lean mass claims paired with training, not direct lifespan extension.",
    lastReviewed: "2026-06-02"
  },
  {
    id: "vitamin-d",
    name: "Vitamin D",
    slug: "vitamin-d",
    synonyms: ["cholecalciferol", "ergocalciferol", "25(OH)D"],
    category: "Vitamin/mineral",
    commonForms: ["D3 softgel", "D3 drops", "D2 tablet"],
    regulatoryStatus: "Dietary supplement; dose limits and labeling rules vary by region.",
    safetySummary:
      "Benefit depends heavily on deficiency status; excess intake can create safety issues.",
    interactionSummary:
      "Relevant with calcium metabolism, kidney disease, granulomatous disease, and some medications.",
    evidenceSummary:
      "Best interpreted through deficiency correction and biomarker-guided use, not broad longevity claims in sufficient adults.",
    lastReviewed: "2026-06-02"
  },
  {
    id: "omega-3",
    name: "Omega-3 EPA/DHA",
    slug: "omega-3-epa-dha",
    synonyms: ["fish oil", "EPA", "DHA", "long-chain omega-3"],
    category: "Fatty acid",
    commonForms: ["Triglyceride oil", "Ethyl ester capsule", "Algal oil"],
    regulatoryStatus: "Dietary supplement and prescription-product contexts differ by dose and indication.",
    safetySummary:
      "Higher-dose contexts need attention to bleeding risk, atrial fibrillation signals, and product oxidation/contaminants.",
    interactionSummary: "Potential relevance with anticoagulants and atrial fibrillation risk review.",
    evidenceSummary:
      "Claims should be separated into triglycerides, cardiovascular prevention, dry eye, mood, inflammation, and safety.",
    lastReviewed: "2026-06-02"
  },
  {
    id: "bpc-157",
    name: "BPC-157",
    slug: "bpc-157",
    synonyms: ["body protection compound 157"],
    category: "Peptide/biologic",
    commonForms: ["Peptide watchlist item"],
    regulatoryStatus:
      "Therapeutic peptide watchlist; not treated as an ordinary dietary supplement. Australia-first review should check TGA safety alerts and ARTG status.",
    safetySummary:
      "Human evidence and long-term safety are limited in the seed data; regulatory concern is prominent.",
    interactionSummary: "Unknowns are material; clinician and regulatory review are required.",
    evidenceSummary:
      "Tracked for claims and safety signals only; the app must not provide sourcing, reconstitution, injection, cycling, or self-administration guidance.",
    lastReviewed: "2026-06-02"
  },
  {
    id: "psyllium",
    name: "Psyllium",
    slug: "psyllium",
    synonyms: ["ispaghula", "soluble fiber"],
    category: "Fiber/prebiotic/probiotic",
    commonForms: ["Husk powder", "Capsules"],
    regulatoryStatus: "Dietary fiber supplement; labeling and claims vary by region.",
    safetySummary:
      "Generally product-quality and tolerability focused; spacing from some medications can matter.",
    interactionSummary: "May affect absorption timing for some medicines and supplements.",
    evidenceSummary:
      "Seed evidence currently supports only a scoped lipid-biomarker claim; glucose, gut, satiety, and outcome claims still need separate packets.",
    lastReviewed: "2026-06-12"
  },
  ...expansionInterventions
];

export const claims: Claim[] = [
  {
    id: "creatine-strength",
    interventionId: "creatine",
    outcome: "Muscle/strength",
    claimText: "Strength, power, and lean mass support when paired with resistance training.",
    populationStudied:
      "Adults in exercise and sport nutrition literature, including postmenopausal women in recent randomized-trial syntheses.",
    doseFormStudied: "Creatine monohydrate; dose details must be checked per study.",
    durationStudied: "Varies by trial and review; included RCT durations ranged from 12 to 104 weeks in the 2026 meta-analysis.",
    comparator: "Placebo or usual training controls.",
    evidenceGrade:
      "Human-reviewed 2026 meta-analysis plus ISSN position-stand context for strength and lean mass with resistance training.",
    effectSize:
      "Meta-analysis reports modest lean-mass and strength gains, especially with resistance training; bone-density signal was not supported overall.",
    clinicalRelevance: "Most relevant to training outcomes, function, and lean mass.",
    confidenceLevel: "High",
    safetyNotes:
      "Renal disease or abnormal renal markers require clinician review; postmenopausal and general-adult contexts differ.",
    applicabilityNotes:
      "Do not extrapolate this score to direct lifespan extension, all cognitive claims, or product-level AU/TGA status.",
    doesNotProve: [
      "Does not prove direct lifespan extension.",
      "Does not prove all cognitive claims.",
      "Does not apply automatically to people with kidney disease or abnormal renal markers.",
      "Does not prove all creatine products are equivalent or product-level cleared."
    ],
    keyReferenceIds: ["ref-pubmed-42141930", "issn-creatine-2017"],
    keyStudyIds: ["study-pubmed-42141930-creatine-strength", "study-creatine-issn"],
    scores: {
      evidenceDirectness: 9,
      evidenceRigor: 9,
      effectSize: 7,
      safety: 8,
      regulatoryRisk: 1,
      productQuality: 4,
      hypePenalty: 2,
      measurability: 9
    },
    finalLabel: "Core Evidence-Based",
    momentum: "Stable",
    reviewStatus: "AI reviewed",
    lastUpdated: "2026-06-24",
    whatWouldChangeScore:
      "Larger independent trials in other populations, safety signal changes, stronger functional-aging endpoints, and Australian product-level regulatory review."
  },
  {
    id: "creatine-lifespan",
    interventionId: "creatine",
    outcome: "Mortality/lifespan",
    claimText: "Direct lifespan extension.",
    populationStudied: "No seeded human lifespan endpoint evidence.",
    doseFormStudied: "Not established for this claim.",
    durationStudied: "Not established for this claim.",
    comparator: "Not established for this claim.",
    evidenceGrade: "Insufficient for direct lifespan claims.",
    effectSize: "Unknown for mortality/lifespan.",
    clinicalRelevance: "Mechanistic or functional hypotheses do not prove lifespan extension.",
    confidenceLevel: "Very low",
    safetyNotes: "Do not use performance safety confidence to validate longevity claims.",
    applicabilityNotes: "Keep separate from strength and lean mass evidence.",
    doesNotProve: [
      "Does not prove direct lifespan extension.",
      "Does not show that strength or lean-mass evidence transfers to mortality outcomes.",
      "Does not establish dose, duration, or population selection for longevity use."
    ],
    keyReferenceIds: ["issn-creatine-2017"],
    scores: {
      evidenceDirectness: 1,
      evidenceRigor: 2,
      effectSize: 1,
      safety: 8,
      regulatoryRisk: 1,
      productQuality: 4,
      hypePenalty: 7,
      measurability: 2
    },
    finalLabel: "Insufficient Evidence",
    momentum: "Stable",
    reviewStatus: "Unreviewed AI draft",
    lastUpdated: "2026-06-02",
    whatWouldChangeScore:
      "Human studies with clinically meaningful aging, frailty, morbidity, or mortality endpoints."
  },
  {
    id: "vitamin-d-deficiency",
    interventionId: "vitamin-d",
    outcome: "Safety/adverse effects",
    claimText: "Correcting deficiency or low status.",
    populationStudied: "People with low vitamin D status or deficiency contexts.",
    doseFormStudied: "D2 or D3; dosing must be matched to labs and clinical context.",
    durationStudied: "Varies by deficiency and monitoring plan.",
    comparator: "Placebo, usual care, or baseline biomarker status.",
    evidenceGrade: "Strongest when biomarker-gated.",
    effectSize: "Clinically relevant for deficiency correction, not a blanket longevity claim.",
    clinicalRelevance: "Best framed around measured status and safety limits.",
    confidenceLevel: "High",
    safetyNotes: "Excess intake can cause harm; total intake and labs matter.",
    applicabilityNotes:
      "Already-sufficient adults should not inherit the deficiency-correction score.",
    doesNotProve: [
      "Does not prove high-dose vitamin D improves longevity in already-sufficient adults.",
      "Does not replace biomarker-guided review of vitamin D status.",
      "Does not remove excess-intake safety concerns."
    ],
    keyReferenceIds: ["ods-vitamin-d"],
    scores: {
      evidenceDirectness: 8,
      evidenceRigor: 8,
      effectSize: 7,
      safety: 6,
      regulatoryRisk: 2,
      productQuality: 5,
      hypePenalty: 3,
      measurability: 10
    },
    finalLabel: "Conditional / Biomarker-Gated",
    momentum: "Stable",
    reviewStatus: "Unreviewed AI draft",
    lastUpdated: "2026-06-02",
    whatWouldChangeScore:
      "Updated safety limits, stronger outcome trials by baseline status, or region-specific guideline changes."
  },
  {
    id: "vitamin-d-longevity",
    interventionId: "vitamin-d",
    outcome: "Mortality/lifespan",
    claimText: "Longevity benefit in already-sufficient adults.",
    populationStudied: "Already-sufficient adults are not established as a clear-benefit group in seed data.",
    doseFormStudied: "Not established for this claim.",
    durationStudied: "Varies.",
    comparator: "Placebo or usual intake.",
    evidenceGrade: "Weak or conditional for broad longevity framing.",
    effectSize: "Uncertain.",
    clinicalRelevance: "Avoid broad anti-aging claims without biomarker context.",
    confidenceLevel: "Low",
    safetyNotes: "High-dose unsupervised use is a safety-monitoring issue.",
    applicabilityNotes: "Do not conflate deficiency correction with longevity extension.",
    doesNotProve: [
      "Does not prove longevity benefit in already-sufficient adults.",
      "Does not justify high-dose use without biomarker and safety context.",
      "Does not transfer deficiency-correction evidence into an anti-aging claim."
    ],
    keyReferenceIds: ["ods-vitamin-d"],
    scores: {
      evidenceDirectness: 3,
      evidenceRigor: 5,
      effectSize: 2,
      safety: 6,
      regulatoryRisk: 2,
      productQuality: 5,
      hypePenalty: 6,
      measurability: 8
    },
    finalLabel: "Insufficient Evidence",
    momentum: "Stable",
    reviewStatus: "Unreviewed AI draft",
    lastUpdated: "2026-06-02",
    whatWouldChangeScore:
      "Large trials showing clinically meaningful longevity or morbidity benefit stratified by baseline vitamin D status."
  },
  {
    id: "omega-3-triglycerides",
    interventionId: "omega-3",
    outcome: "LDL/ApoB/lipids",
    claimText: "Triglyceride lowering.",
    populationStudied: "Adults in omega-3 cardiovascular and lipid literature.",
    doseFormStudied: "EPA/DHA amount and product form need study-level matching.",
    durationStudied: "Varies by trial.",
    comparator: "Placebo or usual care.",
    evidenceGrade: "Useful for a specific lipid endpoint.",
    effectSize: "Endpoint-specific; not identical to event prevention.",
    clinicalRelevance: "Relevant when triglycerides are the target outcome.",
    confidenceLevel: "Moderate",
    safetyNotes:
      "Higher-dose contexts require review for atrial fibrillation signals and bleeding context.",
    applicabilityNotes:
      "Separate triglyceride effects from cardiovascular event and longevity claims.",
    doesNotProve: [
      "Does not prove cardiovascular event prevention.",
      "Does not prove direct lifespan extension.",
      "Does not remove atrial-fibrillation or bleeding-context caveats at higher-dose exposures."
    ],
    keyReferenceIds: ["ods-omega-3"],
    scores: {
      evidenceDirectness: 8,
      evidenceRigor: 7,
      effectSize: 6,
      safety: 6,
      regulatoryRisk: 2,
      productQuality: 7,
      hypePenalty: 4,
      measurability: 10
    },
    finalLabel: "Useful for Specific Use Case",
    momentum: "Stable",
    reviewStatus: "Unreviewed AI draft",
    lastUpdated: "2026-06-02",
    whatWouldChangeScore:
      "New dose-stratified trials separating triglycerides, LDL/ApoB, cardiovascular events, and arrhythmia risk."
  },
  {
    id: "omega-3-cv-events",
    interventionId: "omega-3",
    outcome: "Cardiovascular events",
    claimText: "Cardiovascular prevention.",
    populationStudied: "Mixed cardiovascular-risk populations.",
    doseFormStudied: "EPA-only, EPA/DHA, prescription, and supplement forms must be separated.",
    durationStudied: "Multi-year trials in some evidence streams.",
    comparator: "Placebo or standard care.",
    evidenceGrade: "Conditional and product/form-specific.",
    effectSize: "Mixed across populations and formulations.",
    clinicalRelevance: "Requires careful separation from triglyceride lowering.",
    confidenceLevel: "Moderate",
    safetyNotes: "Atrial fibrillation signals at higher-dose contexts should be visible.",
    applicabilityNotes:
      "Product type, baseline risk, dose, and endpoint selection materially affect interpretation.",
    doesNotProve: [
      "Does not prove all omega-3 supplement products reduce cardiovascular events.",
      "Does not prove direct lifespan extension.",
      "Does not erase formulation, dose, baseline-risk, atrial-fibrillation, or bleeding-context caveats."
    ],
    keyReferenceIds: ["ods-omega-3"],
    scores: {
      evidenceDirectness: 6,
      evidenceRigor: 7,
      effectSize: 4,
      safety: 6,
      regulatoryRisk: 3,
      productQuality: 8,
      hypePenalty: 5,
      measurability: 7
    },
    finalLabel: "Conditional / Biomarker-Gated",
    momentum: "Conflicting",
    reviewStatus: "Unreviewed AI draft",
    lastUpdated: "2026-06-02",
    whatWouldChangeScore:
      "Clearer formulation-specific outcome trials and updated safety signal estimates."
  },
  {
    id: "psyllium-ldl-lipids",
    interventionId: "psyllium",
    outcome: "LDL/ApoB/lipids",
    claimText: "Small LDL-cholesterol support as a soluble-fiber lipid biomarker adjunct.",
    populationStudied: "Adults in controlled soluble-fiber lipid trials, including psyllium arms.",
    doseFormStudied: "Psyllium or other soluble fiber forms; product and amount need study-level matching.",
    durationStudied: "Varied across controlled dietary-fiber trials.",
    comparator: "Control diets, placebo, or usual dietary context depending on study.",
    evidenceGrade: "Meta-analysis supports a small lipid-biomarker effect, not event or lifespan proof.",
    effectSize:
      "Small total and LDL cholesterol reductions in practical intake ranges; triglycerides and HDL were not significant in the cited meta-analysis.",
    clinicalRelevance:
      "Relevant only as lipid biomarker support; do not treat as cardiovascular-event or longevity evidence.",
    confidenceLevel: "Moderate",
    safetyNotes:
      "Product tolerability and medication-absorption timing require review; do not infer product-level safety or AU/TGA status.",
    applicabilityNotes:
      "Keep separate from glucose, gut, satiety, cardiovascular-event, and lifespan claims until those source packets are curated.",
    doesNotProve: [
      "Does not prove cardiovascular event prevention.",
      "Does not prove direct lifespan extension.",
      "Does not establish glucose, gut, satiety, or product-level AU/TGA claims."
    ],
    keyReferenceIds: ["brown-dietary-fiber-1999"],
    scores: {
      evidenceDirectness: 7,
      evidenceRigor: 7,
      effectSize: 4,
      safety: 6,
      regulatoryRisk: 2,
      productQuality: 4,
      hypePenalty: 3,
      measurability: 9
    },
    finalLabel: "Useful for Specific Use Case",
    momentum: "Stable",
    reviewStatus: "Unreviewed AI draft",
    lastUpdated: "2026-06-12",
    whatWouldChangeScore:
      "Newer psyllium-specific RCT meta-analyses, baseline LDL subgroup detail, product-level safety/tolerability review, or direct outcome trials."
  },
  {
    id: "bpc-157-injury-healing",
    interventionId: "bpc-157",
    outcome: "Joint/tendon/skin",
    claimText: "Soft-tissue injury healing.",
    populationStudied: "Human clinical evidence is limited in the seed data.",
    doseFormStudied: "Not provided; self-administration details are out of scope.",
    durationStudied: "Not established for public guidance.",
    comparator: "Not established in seed data.",
    evidenceGrade: "Speculative watchlist with regulatory concern.",
    effectSize: "Uncertain.",
    clinicalRelevance:
      "Track human trials and safety signals; do not treat as an ordinary supplement claim.",
    confidenceLevel: "Very low",
    safetyNotes:
      "Regulatory and safety uncertainty require clinician oversight; route and preparation guidance are not provided.",
    applicabilityNotes:
      "Animal or mechanistic rationale cannot be promoted as human clinical proof.",
    doesNotProve: [
      "Does not prove safe or effective human use.",
      "Does not establish approved therapeutic use or product quality.",
      "Does not provide route, preparation, sourcing, cycling, or self-administration guidance."
    ],
    keyReferenceIds: ["tga-safety-alerts", "fda-bpc-157-category-2"],
    scores: {
      evidenceDirectness: 1,
      evidenceRigor: 2,
      effectSize: 2,
      safety: 2,
      regulatoryRisk: 9,
      productQuality: 1,
      hypePenalty: 9,
      measurability: 5
    },
    finalLabel: "Regulatory Concern",
    momentum: "Safety concern emerging",
    reviewStatus: "Unreviewed AI draft",
    lastUpdated: "2026-06-02",
    whatWouldChangeScore:
      "Approved therapeutic indications, robust human trials, clearer safety data, and lower regulatory concern."
  },
  ...expansionClaims
];

export const studies: Study[] = [
  {
    id: "study-creatine-issn",
    title:
      "International Society of Sports Nutrition position stand: safety and efficacy of creatine supplementation in exercise, sport, and medicine",
    year: 2017,
    source: "Journal of the International Society of Sports Nutrition via PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "position stand",
    sampleSize: "Review/position stand",
    population: "Exercise, sport, and medical nutrition contexts",
    intervention: "Creatine supplementation",
    outcomes: ["Strength", "Lean mass", "Exercise capacity", "Safety"],
    adverseEvents: "Seed review cites safety considerations; patient-specific review still required.",
    fundingConflicts: "Check source record for details.",
    riskOfBias: "Evidence synthesis and position stand; app should retain source metadata.",
    referenceId: "issn-creatine-2017"
  },
  {
    id: "study-pubmed-42141930-creatine-strength",
    title:
      "Creatine monohydrate for lean mass, strength, and bone density in postmenopausal women: a systematic review and meta-analysis.",
    year: 2026,
    source: "PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "Seven randomized placebo-controlled trials; 608 randomized postmenopausal women.",
    population:
      "Postmenopausal women, mean age about 62 years; eligible studies generally enrolled women aged at least 40-45 years.",
    intervention:
      "Creatine monohydrate supplementation with or without resistance training in randomized placebo-controlled trials.",
    outcomes: [
      "DXA-derived lean mass",
      "One-repetition maximum strength, especially leg press",
      "Bone mineral density",
      "Physical function and safety/adverse events"
    ],
    adverseEvents:
      "Adverse events were reported as mild and similar to placebo in included trials; renal indices were unchanged in the synthesis.",
    fundingConflicts:
      "Review reported no specific review funding; disclosed creatine-related advisory ties and APC support from Alzchem.",
    riskOfBias:
      "Cochrane RoB 2 used; overall risk mostly some concerns with one large preregistered RCT at low risk.",
    referenceId: "ref-pubmed-42141930"
  },
  {
    id: "study-vitamin-d-ods",
    title: "Vitamin D health professional fact sheet",
    year: 2025,
    source: "NIH Office of Dietary Supplements",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "narrative review",
    sampleSize: "Evidence summary",
    population: "General health professional reference",
    intervention: "Vitamin D",
    outcomes: ["Deficiency", "Safety limits", "Interactions"],
    adverseEvents: "Safety issues are dose and context dependent.",
    fundingConflicts: "Government health information source.",
    riskOfBias: "Reference summary; not a single trial.",
    referenceId: "ods-vitamin-d"
  },
  {
    id: "study-omega-3-ods",
    title: "Omega-3 fatty acids health professional fact sheet",
    year: 2025,
    source: "NIH Office of Dietary Supplements",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "narrative review",
    sampleSize: "Evidence summary",
    population: "General health professional reference",
    intervention: "EPA/DHA omega-3 fatty acids",
    outcomes: ["Triglycerides", "Cardiovascular endpoints", "Atrial fibrillation safety signal"],
    adverseEvents:
      "Higher-dose contexts require attention to atrial fibrillation signals, bleeding context, and medication interactions.",
    fundingConflicts: "Government health information source.",
    riskOfBias: "Reference summary; separates endpoint, dose, and formulation context.",
    referenceId: "ods-omega-3"
  },
  {
    id: "study-brown-dietary-fiber-1999",
    title: "Cholesterol-lowering effects of dietary fiber: a meta-analysis",
    year: 1999,
    source: "American Journal of Clinical Nutrition via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "67 controlled trials",
    population: "Participants in controlled soluble-fiber blood-lipid trials.",
    intervention: "Major dietary soluble fibers including psyllium.",
    outcomes: ["Total cholesterol", "LDL cholesterol", "Triglycerides", "HDL cholesterol"],
    adverseEvents:
      "Adverse-event detail is not the focus of the seed extraction; product tolerability and medication timing still need review.",
    fundingConflicts: "Check source record for details.",
    riskOfBias:
      "Meta-analysis of controlled trials; the abstract characterizes the practical-range lipid effect as small.",
    referenceId: "brown-dietary-fiber-1999"
  },
  {
    id: "study-fda-bpc-157",
    title:
      "Certain bulk drug substances for use in compounding that may present significant safety risks",
    year: 2023,
    source: "FDA",
    studyType: "Regulatory safety warning",
    sourceTypeTaxonomy: "regulatory warning",
    sampleSize: "Regulatory safety listing",
    population: "Compounding and public safety context",
    intervention: "BPC-157",
    outcomes: ["Regulatory concern", "Safety uncertainty"],
    adverseEvents: "FDA notes potential significant safety risk context for the substance.",
    fundingConflicts: "Government regulatory source.",
    riskOfBias: "Regulatory source; update monitoring required.",
    referenceId: "fda-bpc-157-category-2"
  },
  {
    id: "study-tga-unapproved-peptides",
    title: "TGA safety alerts and advisories for unapproved peptide products",
    year: 2026,
    source: "TGA",
    studyType: "Regulatory safety warning",
    sourceTypeTaxonomy: "regulatory warning",
    sampleSize: "Regulatory safety-alert monitoring",
    population: "Australian public, suppliers, and health professional regulatory context",
    intervention: "Unapproved peptide products including BPC-157",
    outcomes: ["ARTG status", "Regulatory concern", "Public safety monitoring"],
    adverseEvents:
      "TGA alerts highlight unknown safety, quality, effectiveness, product identity, and contamination risks for unapproved peptide products.",
    fundingConflicts: "Government regulatory source.",
    riskOfBias: "Regulatory safety source; monitor for current TGA updates.",
    referenceId: "tga-safety-alerts"
  },
  {
    id: "study-zhang-magnesium-bp-2016",
    title:
      "Effects of Magnesium Supplementation on Blood Pressure: A Meta-Analysis of Randomized Double-Blind Placebo-Controlled Trials",
    year: 2016,
    source: "Hypertension via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "34 randomized double-blind placebo-controlled trials; 2,028 participants",
    population: "Adults in magnesium supplementation blood-pressure trials.",
    intervention: "Magnesium supplementation",
    outcomes: ["Systolic blood pressure", "Diastolic blood pressure"],
    adverseEvents:
      "Adverse-event detail is not the focus of this source packet; safety remains context and product dependent.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Meta-analysis reports residual heterogeneity; form-specific certainty for magnesium glycinate is limited.",
    referenceId: "zhang-magnesium-bp-2016"
  },
  {
    id: "study-schuster-magnesium-bisglycinate-sleep-2025",
    title:
      "Magnesium Bisglycinate Supplementation in Healthy Adults Reporting Poor Sleep: A Randomized, Placebo-Controlled Trial",
    year: 2025,
    source: "Nature and Science of Sleep via PubMed",
    studyType: "Randomized controlled trial",
    sourceTypeTaxonomy: "RCT",
    sampleSize: "155 adults",
    population: "Adults aged 18-65 years reporting poor sleep quality.",
    intervention: "Magnesium bisglycinate supplementation",
    outcomes: ["Insomnia Severity Index", "Sleep quality", "Psychological questionnaires"],
    adverseEvents:
      "Adverse-event extraction is not complete in the local packet; safety remains context and product dependent.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Randomized placebo-controlled trial with subjective sleep outcomes; longer follow-up and objective sleep measures would improve certainty.",
    referenceId: "schuster-magnesium-bisglycinate-sleep-2025"
  },
  {
    id: "study-mah-magnesium-insomnia-2021",
    title:
      "Oral magnesium supplementation for insomnia in older adults: a Systematic Review & Meta-Analysis",
    year: 2021,
    source: "BMC Complementary Medicine and Therapies via PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "systematic review",
    sampleSize: "3 randomized controlled trials; 151 older adults",
    population: "Older adults with insomnia in randomized oral-magnesium trials.",
    intervention: "Oral magnesium supplementation",
    outcomes: ["Sleep onset latency", "Total sleep time", "Sleep quality", "Adverse events"],
    adverseEvents:
      "Review included adverse events as an outcome, but local safety extraction remains incomplete.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Included trials were moderate-to-high risk of bias and outcomes were rated low to very low quality.",
    referenceId: "mah-magnesium-insomnia-2021"
  },
  {
    id: "study-ods-magnesium-safety",
    title: "Magnesium health professional fact sheet",
    year: 2025,
    source: "NIH Office of Dietary Supplements",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "narrative review",
    sampleSize: "Government health-professional evidence summary",
    population: "General supplement safety and medication-interaction reference context.",
    intervention: "Magnesium from dietary supplements and medications",
    outcomes: ["Excess intake", "Gastrointestinal adverse effects", "Toxicity", "Medication interactions"],
    adverseEvents:
      "High supplemental or medication magnesium can cause gastrointestinal adverse effects; very high exposure can cause toxicity, especially with impaired kidney function.",
    fundingConflicts: "Government health information source.",
    riskOfBias:
      "Narrative evidence summary; not product-specific and not a magnesium glycinate tolerability trial.",
    referenceId: "ods-magnesium"
  },
  {
    id: "study-ods-zinc-safety",
    title: "Zinc health professional fact sheet",
    year: 2025,
    source: "NIH Office of Dietary Supplements",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "narrative review",
    sampleSize: "Government health-professional evidence summary",
    population: "General supplement safety and medication-interaction reference context.",
    intervention: "Zinc from dietary supplements, medicines, lozenges, and zinc-containing products",
    outcomes: ["Excess intake", "Gastrointestinal adverse effects", "Copper status", "Medication interactions"],
    adverseEvents:
      "Excess zinc can cause gastrointestinal symptoms and longer high exposure can contribute to copper-related problems.",
    fundingConflicts: "Government health information source.",
    riskOfBias:
      "Narrative evidence summary; not product-specific and not a zinc tolerability trial.",
    referenceId: "ods-zinc"
  },
  {
    id: "study-zhao-zinc-male-infertility-2016",
    title:
      "Zinc levels in seminal plasma and their correlation with male infertility: A systematic review and meta-analysis",
    year: 2016,
    source: "Scientific Reports via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "20 studies; 2,600 cases and 867 controls",
    population: "Infertile and fertile men in seminal-plasma zinc and sperm-parameter studies.",
    intervention: "Zinc exposure or supplementation",
    outcomes: ["Seminal plasma zinc", "Semen volume", "Sperm motility", "Sperm morphology"],
    adverseEvents:
      "Adverse-event extraction is not complete in this fertility packet; defer safety interpretation to the zinc safety packet.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Systematic review reports inconsistent source studies; semen-parameter signals do not prove fertility treatment benefit.",
    referenceId: "zhao-zinc-male-infertility-2016"
  },
  {
    id: "study-salas-huetos-sperm-supplements-2018",
    title:
      "The Effect of Nutrients and Dietary Supplements on Sperm Quality Parameters: A Systematic Review and Meta-Analysis of Randomized Clinical Trials",
    year: 2018,
    source: "Advances in Nutrition via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "28 randomized clinical trial articles qualitatively reviewed; 15 included in quantitative meta-analysis",
    population: "Men in randomized clinical trials evaluating nutrients, supplements, or foods for sperm-quality parameters.",
    intervention: "Dietary supplements including zinc",
    outcomes: ["Sperm concentration", "Sperm count", "Sperm motility", "Sperm morphology"],
    adverseEvents:
      "Adverse-event extraction is not complete in this fertility packet; zinc safety remains a separate source packet.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Multi-nutrient review with heterogeneous interventions; zinc-specific product and live-birth certainty remain limited.",
    referenceId: "salas-huetos-sperm-supplements-2018"
  },
  {
    id: "study-schisterman-folic-acid-zinc-2020",
    title:
      "Effect of Folic Acid and Zinc Supplementation in Men on Semen Quality and Live Birth Among Couples Undergoing Infertility Treatment",
    year: 2020,
    source: "JAMA via PubMed",
    studyType: "Randomized controlled trial",
    sourceTypeTaxonomy: "RCT",
    sampleSize: "2,370 couples",
    population: "Men and women planning infertility treatment at reproductive endocrinology and infertility care centers.",
    intervention: "Folic acid plus elemental zinc supplementation in male partners",
    outcomes: ["Live birth", "Semen quality", "DNA fragmentation", "Gastrointestinal symptoms"],
    adverseEvents:
      "Gastrointestinal symptoms were more common with folic acid plus zinc in the trial; this does not replace product-specific safety review.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Large randomized trial did not show improved live birth or most semen-quality parameters; keep broad fertility claims constrained.",
    referenceId: "schisterman-folic-acid-zinc-2020"
  },
  {
    id: "study-naghshi-protein-mortality-2020",
    title:
      "Dietary intake of total, animal, and plant proteins and risk of all cause, cardiovascular, and cancer mortality",
    year: 2020,
    source: "BMJ via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "32 prospective cohort studies; 715,128 participants in meta-analysis follow-up context",
    population: "Adults in prospective dietary-protein cohort studies.",
    intervention: "Habitual total, animal, and plant dietary protein intake",
    outcomes: ["All-cause mortality", "Cardiovascular mortality", "Cancer mortality"],
    adverseEvents:
      "Not an adverse-event extraction; this source is observational mortality epidemiology.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Prospective cohort meta-analysis; dietary protein source associations are indirect and not whey-protein intervention evidence.",
    referenceId: "naghshi-protein-mortality-2020"
  },
  {
    id: "study-devries-protein-kidney-2018",
    title:
      "Changes in Kidney Function Do Not Differ between Healthy Adults Consuming Higher- Compared with Lower- or Normal-Protein Diets",
    year: 2018,
    source: "Journal of Nutrition via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "28 trial articles; 1,358 participants",
    population: "Adults without kidney disease in higher- versus lower- or normal-protein intake trials.",
    intervention: "Higher-protein intake",
    outcomes: ["Glomerular filtration rate", "Kidney function"],
    adverseEvents:
      "Renal-function focus only; does not cover allergens, contaminants, liver markers, or product-specific whey tolerability.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Healthy-adult renal-function synthesis; it should not be extrapolated to people with kidney disease or to product-level safety.",
    referenceId: "devries-protein-kidney-2018"
  },
  {
    id: "study-vasconcelos-whey-adverse-effects-2021",
    title: "Whey protein supplementation and its potentially adverse effects on health: a systematic review",
    year: 2021,
    source: "Applied Physiology, Nutrition, and Metabolism via PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "systematic review",
    sampleSize: "11 documents",
    population: "Experimental and randomized study contexts involving whey protein supplementation.",
    intervention: "Whey protein supplementation",
    outcomes: ["Kidney function", "Liver function", "Acne", "Aggression", "Microbiota"],
    adverseEvents:
      "Review flags potential concerns with chronic, excessive, or unsupervised whey protein use.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Small safety literature with heterogeneous studies; useful for caution but not product-level risk quantification.",
    referenceId: "vasconcelos-whey-adverse-effects-2021"
  },
  {
    id: "study-cochrane-zinc-cold-2024",
    title: "Zinc for prevention and treatment of the common cold",
    year: 2024,
    source: "Cochrane Database of Systematic Reviews via PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "systematic review",
    sampleSize: "Cochrane systematic review; trial count and participant details are in the source.",
    population: "Adults and children in common-cold prevention and treatment trials.",
    intervention: "Zinc preparations",
    outcomes: ["Common-cold prevention", "Common-cold duration", "Respiratory symptoms"],
    adverseEvents:
      "Tolerability and total zinc exposure require separate safety extraction before stronger scoring.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Mixed endpoint signal; broad immune and prevention claims should remain cautious.",
    referenceId: "cochrane-zinc-cold-2024"
  },
  {
    id: "study-morton-protein-resistance-2018",
    title:
      "A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults",
    year: 2018,
    source: "British Journal of Sports Medicine via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "Systematic review/meta-analysis/meta-regression; study details are in the source.",
    population: "Healthy adults participating in resistance-training interventions.",
    intervention: "Protein supplementation",
    outcomes: ["Muscle strength", "Lean mass", "Resistance-training adaptation"],
    adverseEvents:
      "Adverse-event detail and product quality are not fully captured in this source packet.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Evidence is strongest for training-associated adaptation; not a direct lifespan or disease-treatment source.",
    referenceId: "morton-protein-resistance-2018"
  },
  {
    id: "study-issn-caffeine-2021",
    title: "International society of sports nutrition position stand: caffeine and exercise performance",
    year: 2021,
    source: "Journal of the International Society of Sports Nutrition via PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "position stand",
    sampleSize: "Position stand/review; source summarizes multiple exercise-performance literatures.",
    population: "Exercise and sport performance contexts.",
    intervention: "Caffeine",
    outcomes: [
      "Endurance performance",
      "Exercise performance",
      "Fatigue resistance",
      "Acute alertness/attention context"
    ],
    adverseEvents:
      "Safety and tolerability vary materially by individual context, sleep sensitivity, and total stimulant exposure.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Position stand; performance signal is clearer than generalized health or safety claims.",
    referenceId: "issn-caffeine-2021"
  },
  {
    id: "study-gardiner-caffeine-sleep-2023",
    title: "The effect of caffeine on subsequent sleep: A systematic review and meta-analysis",
    year: 2023,
    source: "Sleep Medicine Reviews via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "Systematic review/meta-analysis including 24 studies.",
    population: "Night-time sleep studies assessing caffeine exposure before subsequent sleep.",
    intervention: "Caffeine, coffee, or pre-workout caffeine exposure",
    outcomes: [
      "Total sleep time",
      "Sleep efficiency",
      "Sleep onset latency",
      "Wake after sleep onset",
      "Sleep-stage distribution"
    ],
    adverseEvents:
      "Caffeine exposure was associated with disrupted sleep parameters; individual sensitivity and total stimulant exposure require separate review.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Dose, form, timing, and population heterogeneity limit product-specific or individualized sleep recommendations.",
    referenceId: "gardiner-caffeine-sleep-2023"
  },
  {
    id: "study-drake-caffeine-sleep-2013",
    title: "Caffeine effects on sleep taken 0, 3, or 6 hours before going to bed",
    year: 2013,
    source: "Journal of Clinical Sleep Medicine via PubMed",
    studyType: "Randomized controlled trial",
    sourceTypeTaxonomy: "RCT",
    sampleSize: "Home-environment randomized crossover sleep study; source record contains details.",
    population: "Adults assessed with sleep diary and portable sleep monitoring in the home environment.",
    intervention: "Caffeine before habitual bedtime",
    outcomes: ["Sleep disturbance", "Total sleep time", "Objective sleep measures"],
    adverseEvents:
      "Sleep disturbance was detected versus placebo across bedtime-proximity conditions in this study.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Small acute study using one fixed caffeine exposure; supports risk flagging but not individualized timing guidance.",
    referenceId: "drake-caffeine-sleep-2013"
  },
  {
    id: "study-wikoff-caffeine-safety-2017",
    title:
      "Systematic review of the potential adverse effects of caffeine consumption in healthy adults, pregnant women, adolescents, and children",
    year: 2017,
    source: "Food and Chemical Toxicology via PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "systematic review",
    sampleSize: "Systematic review screening more than 5,000 articles with 381 included.",
    population: "Healthy adults, pregnant women, adolescents, and children in caffeine safety literature.",
    intervention: "Caffeine exposure from dietary and supplemental sources",
    outcomes: [
      "Acute toxicity",
      "Cardiovascular toxicity",
      "Bone and calcium effects",
      "Behavior",
      "Development and reproduction"
    ],
    adverseEvents:
      "Safety conclusions are population- and context-dependent; vulnerable groups need separate interpretation.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Review uses population-specific comparators; product concentration, labeling, and individual sensitivity remain outside a generic safety score.",
    referenceId: "wikoff-caffeine-safety-2017"
  },
  {
    id: "study-fda-caffeine-too-much-2024",
    title: "Spilling the Beans: How Much Caffeine is Too Much?",
    year: 2024,
    source: "FDA",
    studyType: "Regulatory safety warning",
    sourceTypeTaxonomy: "regulatory warning",
    sampleSize: "FDA consumer safety update; not a clinical trial.",
    population: "Consumers of caffeine-containing foods, beverages, supplements, and medicines.",
    intervention: "Caffeine-containing products",
    outcomes: [
      "Individual sensitivity",
      "Product caffeine variability",
      "Sleep disruption",
      "Cardiovascular symptoms",
      "Anxiety and gastrointestinal symptoms"
    ],
    adverseEvents:
      "FDA notes wide variation in sensitivity and flags symptoms of excessive caffeine exposure.",
    fundingConflicts: "Government consumer safety source.",
    riskOfBias:
      "Regulatory consumer update; useful for safety screening but not product-level efficacy or individualized guidance.",
    referenceId: "fda-caffeine-too-much-2024"
  },
  {
    id: "study-fda-concentrated-caffeine-2018",
    title: "FDA Warns Consumers About Pure and Highly Concentrated Caffeine",
    year: 2018,
    source: "FDA",
    studyType: "Regulatory safety warning",
    sourceTypeTaxonomy: "regulatory warning",
    sampleSize: "FDA warning; not a clinical trial.",
    population: "Consumers exposed to pure or highly concentrated caffeine products.",
    intervention: "Pure or highly concentrated caffeine in powdered or liquid dietary-supplement forms",
    outcomes: ["Accidental overdose", "Seizures", "Cardiac symptoms", "Death"],
    adverseEvents:
      "FDA warns that pure or highly concentrated caffeine products can cause serious adverse events, including death.",
    fundingConflicts: "Government regulatory safety source.",
    riskOfBias:
      "Regulatory warning focused on concentrated products; do not extrapolate to ordinary food or beverage caffeine without context.",
    referenceId: "fda-concentrated-caffeine-2018"
  },
  {
    id: "study-guo-ashwagandha-stress-2022",
    title:
      "Does Ashwagandha supplementation have a beneficial effect on the management of anxiety and stress? A systematic review and meta-analysis of randomized controlled trials",
    year: 2022,
    source: "Phytotherapy Research via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "Systematic review/meta-analysis of randomized controlled trials.",
    population: "Adults in stress and anxiety outcome trials.",
    intervention: "Ashwagandha supplementation",
    outcomes: ["Stress symptoms", "Anxiety symptoms"],
    adverseEvents:
      "Safety extraction remains incomplete; thyroid, pregnancy, liver, sedative, and medication contexts need review.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Small-study and extract-heterogeneity concerns limit confidence for broad product claims.",
    referenceId: "guo-ashwagandha-stress-2022"
  },
  {
    id: "study-cheah-ashwagandha-sleep-2021",
    title: "Effect of Ashwagandha (Withania somnifera) extract on sleep: A systematic review and meta-analysis",
    year: 2021,
    source: "PLOS One via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "5 randomized controlled trials; 400 participants.",
    population: "Adults in placebo-controlled ashwagandha sleep trials.",
    intervention: "Ashwagandha extract",
    outcomes: [
      "Overall sleep",
      "Sleep quality",
      "Sleep quantity",
      "Mental alertness on rising",
      "Anxiety"
    ],
    adverseEvents:
      "No serious side effects were reported in the review, but serious-adverse-effect and long-term safety data were limited.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Small trial base with extract and population heterogeneity; product matching and long-term safety remain unresolved.",
    referenceId: "cheah-ashwagandha-sleep-2021"
  },
  {
    id: "study-langade-ashwagandha-sleep-2021",
    title:
      "Clinical evaluation of the pharmacological impact of ashwagandha root extract on sleep in healthy volunteers and insomnia patients",
    year: 2021,
    source: "Journal of Ethnopharmacology via PubMed",
    studyType: "Randomized controlled trial",
    sourceTypeTaxonomy: "RCT",
    sampleSize: "80 participants.",
    population: "Healthy volunteers and adults with insomnia symptoms.",
    intervention: "Ashwagandha root extract",
    outcomes: [
      "Sleep onset latency",
      "Total sleep time",
      "Wake after sleep onset",
      "Sleep efficiency",
      "Pittsburgh Sleep Quality Index"
    ],
    adverseEvents:
      "Safety and adverse events were assessed, but this trial does not establish long-term or product-general safety.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Small direct trial with extract-specific applicability; stronger independent replication would improve certainty.",
    referenceId: "langade-ashwagandha-sleep-2021"
  },
  {
    id: "study-deshpande-ashwagandha-sleep-2020",
    title:
      "A randomized, double blind, placebo controlled study to evaluate the effects of ashwagandha extract on sleep quality in healthy adults",
    year: 2020,
    source: "Sleep Medicine via PubMed",
    studyType: "Randomized controlled trial",
    sourceTypeTaxonomy: "RCT",
    sampleSize: "150 randomized healthy adults with non-restorative sleep; 144 completed.",
    population: "Healthy adults reporting non-restorative sleep.",
    intervention: "Standardized ashwagandha extract",
    outcomes: [
      "Restorative sleep quality",
      "Sleep efficiency",
      "Total sleep time",
      "Sleep latency",
      "Wake after sleep onset"
    ],
    adverseEvents:
      "No dropouts due to adverse events were reported, but this does not establish long-term or product-general safety.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Short direct trial in selected adults; extract-specific results should not be generalized to every product.",
    referenceId: "deshpande-ashwagandha-sleep-2020"
  },
  {
    id: "study-ods-ashwagandha-safety",
    title: "Ashwagandha: Is it helpful for stress, anxiety, or sleep? - Health Professional Fact Sheet",
    year: 2025,
    source: "NIH Office of Dietary Supplements",
    studyType: "Regulatory safety warning",
    sourceTypeTaxonomy: "guideline",
    sampleSize: "Health-professional fact sheet; not a clinical trial.",
    population: "People considering or using ashwagandha supplements.",
    intervention: "Ashwagandha supplements and extracts",
    outcomes: [
      "Short-term tolerability",
      "Long-term safety gaps",
      "Liver function reports",
      "Thyroid function",
      "Pregnancy and breastfeeding caution",
      "Medication interactions"
    ],
    adverseEvents:
      "ODS flags mild gastrointestinal and drowsiness effects, rare liver-injury reports, thyroid effects, pregnancy/breastfeeding cautions, and medication interactions.",
    fundingConflicts: "Government health-professional safety source.",
    riskOfBias:
      "Reference safety synthesis; useful for screening but not product-level safety, efficacy, or AU/TGA status.",
    referenceId: "ods-ashwagandha"
  },
  {
    id: "study-nccih-ashwagandha-safety",
    title: "Ashwagandha: Usefulness and Safety",
    year: 2025,
    source: "NIH National Center for Complementary and Integrative Health",
    studyType: "Regulatory safety warning",
    sourceTypeTaxonomy: "guideline",
    sampleSize: "Consumer safety fact sheet; not a clinical trial.",
    population: "Consumers considering or using ashwagandha supplements.",
    intervention: "Ashwagandha supplements",
    outcomes: [
      "Short-term use",
      "Long-term safety gaps",
      "Liver injury reports",
      "Pregnancy and breastfeeding caution",
      "Autoimmune, thyroid, surgery, and medication contexts"
    ],
    adverseEvents:
      "NCCIH flags drowsiness, stomach upset, diarrhea, vomiting, liver-injury reports, pregnancy/breastfeeding avoidance, and selected condition/medication cautions.",
    fundingConflicts: "Government consumer safety source.",
    riskOfBias:
      "Consumer safety synthesis; useful for caveats but not product-level safety, efficacy, or AU/TGA status.",
    referenceId: "nccih-ashwagandha"
  },
  {
    id: "study-pubmed-42198398-ashwagandha-safety",
    title:
      "Back to the Roots: Safety and Tolerability of Standardised Ashwagandha (Withania somnifera) Root Extract in Healthy Adults-A Systematic Review of Biomarkers and Adverse Events.",
    year: 2026,
    source: "PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "systematic-review",
    sampleSize: "23 randomized trials; 2317 total participants in synthesis.",
    population:
      "Generally healthy adults in included randomized trials of single-ingredient standardized ashwagandha root-only extract.",
    intervention:
      "Standardized ashwagandha root extract (125-600 mg/day; durations from single dose to 180 days in included trials).",
    outcomes: [
      "Hepatic, renal, haematological, endocrine, and cardiovascular safety biomarkers",
      "Adverse events and tolerability",
      "Cortisol changes in included trials"
    ],
    adverseEvents:
      "Synthesis reports biomarkers within normal clinical ranges without clinically meaningful adverse alterations across included trials; non-standardized or multi-ingredient formulations remain a separate safety context.",
    fundingConflicts: "Review funding and conflicts require full-text verification.",
    riskOfBias:
      "Included trials assessed with Cochrane RoB 2; systematic-review limits, search scope, and formulation generalizability still apply.",
    referenceId: "ref-pubmed-42198398"
  },
  {
    id: "study-durg-ashwagandha-male-infertility-2018",
    title:
      "Withania somnifera (Indian ginseng) in male infertility: An evidence-based systematic review and meta-analysis",
    year: 2018,
    source: "Phytomedicine via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "4 clinical trials across 5 publications; only 1 randomized controlled trial.",
    population: "Men in male infertility and semen-parameter studies.",
    intervention: "Withania somnifera treatment",
    outcomes: [
      "Sperm concentration",
      "Semen volume",
      "Sperm motility",
      "Serum testosterone",
      "Luteinizing hormone"
    ],
    adverseEvents:
      "Safety certainty is limited by the small study base and sparse long-term adverse-event data.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Systematic review found only one RCT and multiple observational designs; live-birth and product-level certainty remain limited.",
    referenceId: "durg-ashwagandha-male-infertility-2018"
  },
  {
    id: "study-ambiye-ashwagandha-oligospermia-2013",
    title:
      "Clinical Evaluation of the Spermatogenic Activity of the Root Extract of Ashwagandha in Oligospermic Males",
    year: 2013,
    source: "Evidence-Based Complementary and Alternative Medicine via PubMed",
    studyType: "Randomized controlled trial",
    sourceTypeTaxonomy: "RCT",
    sampleSize: "46 male patients with oligospermia.",
    population: "Men with oligospermia in a placebo-controlled pilot study.",
    intervention: "Ashwagandha root extract",
    outcomes: ["Sperm count", "Semen volume", "Sperm motility", "Serum hormone levels"],
    adverseEvents:
      "Adverse-event and long-term safety detail are insufficient for product-general conclusions.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Small pilot RCT with biomarker endpoints; does not establish pregnancy, live-birth, or treatment outcomes.",
    referenceId: "ambiye-ashwagandha-oligospermia-2013"
  },
  {
    id: "study-ahmad-ashwagandha-semen-hormones-2010",
    title:
      "Withania somnifera improves semen quality by regulating reproductive hormone levels and oxidative stress in seminal plasma of infertile males",
    year: 2010,
    source: "Fertility and Sterility via PubMed",
    studyType: "Observational cohort",
    sourceTypeTaxonomy: "observational study",
    sampleSize: "75 infertile men and 75 fertile control subjects.",
    population: "Men undergoing infertility screening plus healthy fertile controls.",
    intervention: "Withania somnifera root treatment in infertile men",
    outcomes: [
      "Semen profile",
      "Oxidative biomarkers",
      "Testosterone",
      "Luteinizing hormone",
      "Follicle-stimulating hormone",
      "Prolactin"
    ],
    adverseEvents:
      "This prospective biomarker source does not provide robust product-level or long-term adverse-event certainty.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Prospective biomarker design with baseline/control comparisons; weaker than RCT evidence and not a clinical fertility outcome trial.",
    referenceId: "ahmad-ashwagandha-semen-hormones-2010"
  },
  {
    id: "study-guo-berberine-t2dm-2021",
    title:
      "The Effect of Berberine on Metabolic Profiles in Type 2 Diabetic Patients: A Systematic Review and Meta-Analysis of Randomized Controlled Trials",
    year: 2021,
    source: "Oxidative Medicine and Cellular Longevity via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "Systematic review/meta-analysis of randomized controlled trials.",
    population: "People with type 2 diabetes in metabolic biomarker trials.",
    intervention: "Berberine",
    outcomes: ["Glucose", "HbA1c", "Metabolic biomarkers"],
    adverseEvents:
      "Medication interaction and glucose-lowering therapy context require separate safety extraction.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Biomarker context is clinically sensitive; not evidence for medication replacement or unsupervised disease management.",
    referenceId: "guo-berberine-t2dm-2021"
  },
  {
    id: "study-ju-berberine-dyslipidaemia-2018",
    title:
      "Efficacy and safety of berberine for dyslipidaemias: A systematic review and meta-analysis of randomized clinical trials",
    year: 2018,
    source: "Phytomedicine via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "16 randomized trials; 2,147 participants.",
    population: "People with dyslipidemias in randomized clinical trials.",
    intervention: "Berberine",
    outcomes: [
      "Total cholesterol",
      "LDL cholesterol",
      "Triglycerides",
      "HDL cholesterol",
      "Adverse events"
    ],
    adverseEvents:
      "No severe adverse effects were reported in the included trials, but trial heterogeneity and bias limit certainty.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Authors reported high clinical heterogeneity and generally low methodological quality across included trials.",
    referenceId: "ju-berberine-dyslipidaemia-2018"
  },
  {
    id: "study-hernandez-berberine-lipoproteins-2024",
    title:
      "Impact of Berberine or Berberine Combination Products on Lipoprotein, Triglyceride and Biological Safety Marker Concentrations in Patients with Hyperlipidemia: A Systematic Review and Meta-Analysis",
    year: 2024,
    source: "Journal of Dietary Supplements via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "41 randomized controlled trials; 4,838 patients.",
    population: "Patients with hyperlipidemia in randomized controlled trials.",
    intervention: "Berberine alone or berberine-containing combination products",
    outcomes: [
      "Total cholesterol",
      "LDL cholesterol",
      "Triglycerides",
      "HDL cholesterol",
      "Biological safety markers"
    ],
    adverseEvents:
      "Safety-marker focus is useful but does not establish long-term or product-level safety.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Effects varied by combination product; berberine-alone LDL and HDL estimates were less robust than combination-product estimates.",
    referenceId: "hernandez-berberine-lipoproteins-2024"
  },
  {
    id: "study-blais-berberine-dyslipidemia-2023",
    title:
      "Overall and Sex-Specific Effect of Berberine for the Treatment of Dyslipidemia in Adults: A Systematic Review and Meta-Analysis of Randomized Placebo-Controlled Trials",
    year: 2023,
    source: "Drugs via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "18 randomized placebo-controlled trials; 1,788 adults.",
    population: "Adults in randomized placebo-controlled dyslipidemia trials.",
    intervention: "Berberine",
    outcomes: [
      "LDL cholesterol",
      "Total cholesterol",
      "Triglycerides",
      "HDL cholesterol",
      "Apolipoprotein B",
      "Adverse events"
    ],
    adverseEvents:
      "No serious adverse events were reported in included studies; gastrointestinal events were reported more often in berberine arms in some studies.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Short trial durations and biomarker outcomes do not prove cardiovascular event reduction or treatment replacement.",
    referenceId: "blais-berberine-dyslipidemia-2023"
  },
  {
    id: "study-mother-to-baby-berberine-2025",
    title: "Berberine",
    year: 2025,
    source: "MotherToBaby Fact Sheets via NCBI Bookshelf",
    studyType: "Regulatory safety warning",
    sourceTypeTaxonomy: "guideline",
    sampleSize: "Fact sheet based on published exposure literature; not a clinical trial.",
    population: "People considering berberine exposure during pregnancy or breastfeeding.",
    intervention: "Berberine-containing supplements and herbs",
    outcomes: [
      "Pregnancy exposure",
      "Birth-defect uncertainty",
      "Bilirubin-related concern",
      "Breastfeeding caution",
      "Infant exposure risk"
    ],
    adverseEvents:
      "Fact sheet flags limited pregnancy evidence, bilirubin-related concern, and breastfeeding caution, especially for newborns.",
    fundingConflicts: "NCBI Bookshelf/MotherToBaby safety fact sheet.",
    riskOfBias:
      "Safety synthesis is useful for cautions but does not establish product-level safety, efficacy, or AU/TGA status.",
    referenceId: "mother-to-baby-berberine-2025"
  },
  {
    id: "study-daily-curcumin-arthritis-2016",
    title:
      "Efficacy of Turmeric Extracts and Curcumin for Alleviating the Symptoms of Joint Arthritis: A Systematic Review and Meta-Analysis of Randomized Clinical Trials",
    year: 2016,
    source: "Journal of Medicinal Food via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "Systematic review/meta-analysis of randomized clinical trials.",
    population: "People with joint arthritis symptoms in randomized trials.",
    intervention: "Turmeric extracts and curcumin",
    outcomes: ["Arthritis symptoms", "Joint pain", "Function"],
    adverseEvents:
      "Adverse-event detail, interactions, and formulation safety require separate extraction.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Formulation and bioavailability vary; source does not cover tendon repair or general skin-health claims.",
    referenceId: "daily-curcumin-arthritis-2016"
  },
  {
    id: "study-tabrizi-curcumin-inflammation-2019",
    title:
      "The effects of curcumin-containing supplements on biomarkers of inflammation and oxidative stress: A systematic review and meta-analysis of randomized controlled trials",
    year: 2019,
    source: "Phytotherapy Research via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "15 randomized controlled trials.",
    population: "People in randomized trials assessing inflammatory and oxidative stress biomarkers.",
    intervention: "Curcumin-containing supplements",
    outcomes: [
      "IL-6",
      "High-sensitivity C-reactive protein",
      "Tumor necrosis factor-alpha",
      "Malondialdehyde",
      "Superoxide dismutase"
    ],
    adverseEvents:
      "Adverse-event and formulation safety details require separate extraction.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Biomarker-focused review; inflammatory-marker changes do not prove disease treatment or clinical outcome benefit.",
    referenceId: "tabrizi-curcumin-inflammation-2019"
  },
  {
    id: "study-white-curcumin-inflammatory-markers-2019",
    title:
      "Oral turmeric/curcumin effects on inflammatory markers in chronic inflammatory diseases: A systematic review and meta-analysis of randomized controlled trials",
    year: 2019,
    source: "Pharmacological Research via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "19 randomized controlled trials; 1,344 participants.",
    population:
      "People with chronic inflammatory diseases, including rheumatic disease, hemodialysis, metabolic syndrome, and cardiovascular disease contexts.",
    intervention: "Oral turmeric, curcumin, or curcuminoids",
    outcomes: [
      "CRP",
      "High-sensitivity CRP",
      "IL-1 beta",
      "IL-6",
      "TNF-alpha"
    ],
    adverseEvents:
      "Adverse-event and interaction certainty require separate safety extraction.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Review found no significant reductions in several inflammatory markers and high heterogeneity across most markers.",
    referenceId: "white-curcumin-inflammatory-markers-2019"
  },
  {
    id: "study-dehzad-curcumin-inflammatory-oxidative-2023",
    title:
      "Antioxidant and anti-inflammatory effects of curcumin/turmeric supplementation in adults: A GRADE-assessed systematic review and dose-response meta-analysis of randomized controlled trials",
    year: 2023,
    source: "Cytokine via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "66 randomized controlled trials.",
    population: "Adults in randomized trials assessing inflammatory and oxidative stress markers.",
    intervention: "Turmeric or curcumin supplementation",
    outcomes: [
      "C-reactive protein",
      "TNF-alpha",
      "IL-6",
      "IL-1 beta",
      "Total antioxidant capacity",
      "Malondialdehyde",
      "Superoxide dismutase"
    ],
    adverseEvents:
      "Safety, interactions, and formulation-specific tolerability require separate extraction.",
    fundingConflicts:
      "PubMed abstract reports no known competing financial interests or personal relationships.",
    riskOfBias:
      "GRADE-assessed biomarker review; marker improvements do not establish clinical disease treatment or product-level claims.",
    referenceId: "dehzad-curcumin-inflammatory-oxidative-2023"
  },
  {
    id: "study-nccih-turmeric-safety",
    title: "Turmeric: Usefulness and Safety",
    year: 2025,
    source: "NIH National Center for Complementary and Integrative Health",
    studyType: "Regulatory safety warning",
    sourceTypeTaxonomy: "guideline",
    sampleSize: "Consumer safety fact sheet; not a clinical trial.",
    population: "People considering or using turmeric or curcumin products.",
    intervention: "Turmeric and curcumin supplements",
    outcomes: [
      "Short-term conventional oral use",
      "Gastrointestinal adverse effects",
      "Liver-injury warning symptoms",
      "Pregnancy and breastfeeding caution",
      "Herb-medicine interaction caution"
    ],
    adverseEvents:
      "NCCIH flags nausea, vomiting, reflux, stomach upset, diarrhea, constipation, topical hives/itching, liver-damage reports with some bioavailable formulations, and pregnancy caution.",
    fundingConflicts: "Government consumer safety source.",
    riskOfBias:
      "Safety synthesis; useful for caution flags but not product-level safety, efficacy, or AU/TGA status.",
    referenceId: "nccih-turmeric"
  },
  {
    id: "study-tga-turmeric-curcumin-liver-2023",
    title: "Medicines containing turmeric or curcumin - risk of liver injury",
    year: 2023,
    source: "Therapeutic Goods Administration",
    studyType: "Regulatory safety warning",
    sourceTypeTaxonomy: "regulatory warning",
    sampleSize: "TGA safety investigation and adverse-event reports through 29 June 2023.",
    population:
      "Consumers using medicinal dosage forms of Curcuma longa, turmeric, curcumin, or related Curcuma species products.",
    intervention: "Medicines and herbal supplements containing turmeric, curcumin, or related Curcuma species",
    outcomes: [
      "Rare liver injury",
      "Severe liver-injury reports",
      "Enhanced bioavailability concern",
      "Higher-dose concern",
      "Existing liver-problem caution"
    ],
    adverseEvents:
      "TGA reports rare liver-injury risk, with some severe cases; risk may be higher with enhanced absorption, higher doses, or existing liver problems.",
    fundingConflicts: "Australian Government therapeutic goods safety source.",
    riskOfBias:
      "Post-market safety signal and regulatory investigation; does not identify all higher-risk products or establish product-level ARTG status.",
    referenceId: "tga-turmeric-curcumin-liver-2023"
  },
  {
    id: "study-livertox-turmeric",
    title: "Turmeric",
    year: 2025,
    source: "LiverTox via NCBI Bookshelf",
    studyType: "Regulatory safety warning",
    sourceTypeTaxonomy: "narrative review",
    sampleSize: "LiverTox drug record and annotated hepatotoxicity literature; not a clinical trial.",
    population: "People exposed to turmeric or curcumin products in clinical and post-market contexts.",
    intervention: "Turmeric and curcumin products, including high-bioavailability formulations",
    outcomes: [
      "Serum enzyme elevations",
      "Clinically apparent acute liver injury",
      "High-bioavailability formulation concern",
      "Rechallenge risk",
      "HLA-B*35:01 association"
    ],
    adverseEvents:
      "LiverTox describes rare but documented clinically apparent acute liver injury, often linked to high-bioavailability forms, with most cases resolving after discontinuation.",
    fundingConflicts: "NCBI Bookshelf/LiverTox reference source.",
    riskOfBias:
      "Hepatotoxicity review and case-literature synthesis; useful for safety caution but not product-level risk quantification.",
    referenceId: "livertox-turmeric"
  },
  {
    id: "study-collagen-oa-2018",
    title:
      "Effect of collagen supplementation on osteoarthritis symptoms: a meta-analysis of randomized placebo-controlled trials",
    year: 2019,
    source: "International Orthopaedics via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "Meta-analysis of randomized placebo-controlled trials.",
    population: "People with osteoarthritis symptoms in randomized trials.",
    intervention: "Collagen supplementation",
    outcomes: ["Osteoarthritis symptoms", "Pain scales", "Function scales"],
    adverseEvents:
      "Product quality, allergen, contaminant, and protein-source safety context remains separate.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Joint/OA symptom evidence does not prove tendon repair, structural regeneration, or general skin benefit.",
    referenceId: "collagen-oa-2018"
  },
  {
    id: "study-choi-collagen-dermatology-2019",
    title: "Oral Collagen Supplementation: A Systematic Review of Dermatological Applications",
    year: 2019,
    source: "Journal of Drugs in Dermatology via PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "systematic review",
    sampleSize: "11 randomized placebo-controlled trials; 805 patients.",
    population:
      "Human dermatology trial participants using collagen supplements for skin aging, xerosis, pressure ulcers, or cellulite contexts.",
    intervention: "Oral collagen hydrolysate, collagen tripeptide, or collagen dipeptide supplements",
    outcomes: [
      "Skin elasticity",
      "Skin hydration",
      "Dermal collagen density",
      "Wound healing",
      "Reported adverse events"
    ],
    adverseEvents:
      "Review reports oral collagen supplementation was generally safe with no reported adverse events in included trials.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Dermatology-focused trial review; does not establish long-term, allergen, contaminant, or product-level safety.",
    referenceId: "choi-collagen-dermatology-2019"
  },
  {
    id: "study-de-miranda-hydrolyzed-collagen-skin-2021",
    title: "Effects of hydrolyzed collagen supplementation on skin aging: a systematic review and meta-analysis",
    year: 2021,
    source: "International Journal of Dermatology via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "19 randomized double-blind controlled trials; 1,125 participants.",
    population: "Mostly women aged 20 to 70 years in hydrolyzed-collagen skin-aging trials.",
    intervention: "Oral hydrolyzed collagen supplementation",
    outcomes: ["Skin wrinkles", "Skin hydration", "Skin elasticity", "Skin firmness"],
    adverseEvents:
      "Safety detail is limited in the abstract; product source and long-term tolerability need separate review.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Skin-aging endpoint review; does not establish safety for joint/tendon claims, every collagen source, or product-level quality.",
    referenceId: "de-miranda-hydrolyzed-collagen-skin-2021"
  },
  {
    id: "study-ferracioli-oda-melatonin-2013",
    title: "Meta-analysis: melatonin for the treatment of primary sleep disorders",
    year: 2013,
    source: "PLOS One via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "Meta-analysis of trials in primary sleep disorders.",
    population: "People with primary sleep disorders in controlled trials.",
    intervention: "Melatonin",
    outcomes: ["Sleep-onset latency", "Total sleep time", "Sleep quality"],
    adverseEvents:
      "Age, pregnancy, medicine interaction, next-day impairment, and long-term safety context require separate review.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Sleep-metric source does not establish broader mood, stress, or long-term safety claims.",
    referenceId: "ferracioli-oda-melatonin-2013"
  },
  {
    id: "study-nccih-melatonin-safety",
    title: "Melatonin: What You Need To Know",
    year: 2025,
    source: "NIH National Center for Complementary and Integrative Health",
    studyType: "Regulatory safety warning",
    sourceTypeTaxonomy: "guideline",
    sampleSize: "Consumer safety fact sheet; not a clinical trial.",
    population: "People considering or using melatonin supplements.",
    intervention: "Melatonin dietary supplements",
    outcomes: [
      "Short-term safety",
      "Long-term safety gaps",
      "Medicine interactions",
      "Pregnancy and breastfeeding caution",
      "Older-adult and dementia caution",
      "Product-label variability",
      "Pediatric ingestion risk"
    ],
    adverseEvents:
      "NCCIH flags headache, dizziness, nausea, sleepiness, allergic reactions, medicine interactions, child-ingestion risk, and long-term safety uncertainty.",
    fundingConflicts: "Government consumer safety source.",
    riskOfBias:
      "Safety synthesis; useful for caution flags but not product-level safety, efficacy, or AU/TGA status.",
    referenceId: "nccih-melatonin"
  },
  {
    id: "study-besag-melatonin-adverse-events-2019",
    title:
      "Adverse Events Associated with Melatonin for the Treatment of Primary or Secondary Sleep Disorders: A Systematic Review",
    year: 2019,
    source: "CNS Drugs via PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "systematic review",
    sampleSize: "37 randomized controlled trials.",
    population: "People receiving melatonin for primary or secondary sleep disorders.",
    intervention: "Exogenous melatonin",
    outcomes: [
      "Daytime sleepiness",
      "Headache",
      "Sleep-related adverse events",
      "Dizziness",
      "Hypothermia",
      "Serious adverse events"
    ],
    adverseEvents:
      "Review found few generally mild to moderate adverse events, but long-term RCT evidence and at-risk population certainty were limited.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Many included studies had limited adverse-event reporting quality and short follow-up.",
    referenceId: "besag-melatonin-adverse-events-2019"
  },
  {
    id: "study-menczel-melatonin-high-dose-2022",
    title: "Safety of higher doses of melatonin in adults: A systematic review and meta-analysis",
    year: 2022,
    source: "Journal of Pineal Research via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "79 high-dose adult studies; 3,861 participants.",
    population: "Adults over 30 years in high-dose melatonin randomized trials.",
    intervention: "High-dose melatonin at 10 mg or more",
    outcomes: [
      "Adverse events",
      "Serious adverse events",
      "Withdrawals due to adverse events",
      "Drowsiness",
      "Headache",
      "Dizziness"
    ],
    adverseEvents:
      "Low-risk-of-bias subset did not detect increased serious adverse events or withdrawals, but adverse events such as drowsiness, headache, and dizziness were increased.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Adverse-event reporting was limited; only a small subset met low-risk-of-bias criteria for meta-analysis.",
    referenceId: "menczel-melatonin-high-dose-2022"
  },
  {
    id: "study-handel-pediatric-melatonin-safety-2023",
    title:
      "The short-term and long-term adverse effects of melatonin treatment in children and adolescents: a systematic review and GRADE assessment",
    year: 2023,
    source: "EClinicalMedicine via PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "systematic review",
    sampleSize:
      "22 randomized studies with 1,350 patients for adverse events; 4 observational studies with 105 patients for pubertal development.",
    population: "Children and adolescents aged 5 to 20 years with chronic insomnia.",
    intervention: "Melatonin treatment",
    outcomes: [
      "Non-serious adverse events",
      "Serious adverse events",
      "Pubertal development",
      "Bone health",
      "Long-term safety uncertainty"
    ],
    adverseEvents:
      "Review found no association with serious adverse events but increased non-serious adverse events and uncertain long-term consequences.",
    fundingConflicts:
      "Danish Health Authority and Parker Institute support; check source record for author disclosures.",
    riskOfBias:
      "Pediatric long-term evidence remains limited, so the source argues against complacent use.",
    referenceId: "handel-pediatric-melatonin-safety-2023"
  },
  {
    id: "study-mother-to-baby-melatonin-2024",
    title: "Melatonin",
    year: 2024,
    source: "MotherToBaby Fact Sheets via NCBI Bookshelf",
    studyType: "Regulatory safety warning",
    sourceTypeTaxonomy: "guideline",
    sampleSize: "Fact sheet based on published exposure literature; not a clinical trial.",
    population: "People considering melatonin exposure during pregnancy or breastfeeding.",
    intervention: "Melatonin supplements",
    outcomes: [
      "Miscarriage uncertainty",
      "Birth-defect uncertainty",
      "Pregnancy-related outcome gaps",
      "Breastfeeding uncertainty",
      "Infant exposure caution"
    ],
    adverseEvents:
      "MotherToBaby notes limited pregnancy and breastfeeding evidence and one infant bleeding report with a combined melatonin/valerian supplement.",
    fundingConflicts: "NCBI Bookshelf/MotherToBaby safety fact sheet.",
    riskOfBias:
      "Safety synthesis is useful for reproductive cautions but does not establish product-level safety or individualized use.",
    referenceId: "mother-to-baby-melatonin-2024"
  },
  {
    id: "study-cdc-pediatric-melatonin-ingestions-2022",
    title: "Pediatric Melatonin Ingestions - United States, 2012-2021",
    year: 2022,
    source: "MMWR Morbidity and Mortality Weekly Report",
    studyType: "Observational cohort",
    sourceTypeTaxonomy: "observational study",
    sampleSize: "260,435 pediatric melatonin ingestions reported to poison control centers.",
    population: "Children, adolescents, and young adults aged 19 years or younger in U.S. poison-control reports.",
    intervention: "Melatonin ingestion",
    outcomes: [
      "Unintentional ingestion",
      "Hospitalization",
      "Serious outcomes",
      "Mechanical ventilation",
      "Fatal reports"
    ],
    adverseEvents:
      "Pediatric ingestions increased 530% from 2012 to 2021; hospitalizations and more serious outcomes also increased.",
    fundingConflicts: "CDC/MMWR surveillance source.",
    riskOfBias:
      "Poison-control surveillance cannot prove causality for every outcome but is important for pediatric storage and overdose risk.",
    referenceId: "cdc-pediatric-melatonin-ingestions-2022"
  },
  {
    id: "study-madsen-melatonin-perioperative-anxiety-2020",
    title: "Melatonin for preoperative and postoperative anxiety in adults",
    year: 2020,
    source: "Cochrane Database of Systematic Reviews via PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "systematic review",
    sampleSize: "27 randomized controlled trials; 2,319 participants.",
    population: "Adults undergoing surgical procedures requiring anaesthesia.",
    intervention: "Preoperatively administered melatonin",
    outcomes: [
      "Preoperative anxiety",
      "Immediate postoperative anxiety",
      "Delayed postoperative anxiety",
      "Adverse events",
      "Sedation",
      "Psychomotor and cognitive function"
    ],
    adverseEvents:
      "No serious adverse events were reported, but many studies did not report adverse events.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Cochrane review found no study at low risk of bias across all domains; perioperative anxiety results do not generalize to everyday stress or mood disorders.",
    referenceId: "madsen-melatonin-perioperative-anxiety-2020"
  },
  {
    id: "study-de-crescenzo-melatonin-mood-disorders-2017",
    title: "Melatonin as a treatment for mood disorders: a systematic review",
    year: 2017,
    source: "Acta Psychiatrica Scandinavica via PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "systematic review",
    sampleSize: "8 randomized clinical trials.",
    population:
      "People with bipolar disorder, unipolar depression, or seasonal affective disorder in randomized trials.",
    intervention: "Melatonin compared with placebo",
    outcomes: ["Mood symptoms", "Acceptability", "Tolerability"],
    adverseEvents:
      "Review reported good acceptability and tolerability, but safety detail remains limited by small trials.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Review found no significant evidence of mood-symptom improvement and described the evidence base as early and inconclusive.",
    referenceId: "de-crescenzo-melatonin-mood-disorders-2017"
  },
  {
    id: "study-shokri-melatonin-depression-bdnf-2023",
    title:
      "Effects of melatonin supplementation on BDNF concentrations and depression: A systematic review and meta-analysis of randomized controlled trials",
    year: 2023,
    source: "Behavioural Brain Research via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "Clinical trials in adults; see source for trial count and subgroup details.",
    population: "Adults in clinical trials measuring BDNF concentration or depression score.",
    intervention: "Melatonin supplementation",
    outcomes: ["Depression score", "BDNF concentration"],
    adverseEvents:
      "Safety outcomes were not the main focus; use the melatonin safety packet for adverse-event context.",
    fundingConflicts: "Source abstract reports no conflicts of interest.",
    riskOfBias:
      "High heterogeneity limited definitive conclusions; depression-score signal should not be treated as proof of mood-disorder treatment.",
    referenceId: "shokri-melatonin-depression-bdnf-2023"
  },
  {
    id: "study-demirhan-melatonin-menopause-mood-2024",
    title:
      "Effects of melatonin intake on depression and anxiety in postmenopausal women: a systematic review and meta-analysis of randomised controlled trials",
    year: 2024,
    source: "Archives of Women's Mental Health via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "5 randomized controlled trials; 441 participants.",
    population: "Postmenopausal women in randomized trials measuring depression or anxiety scores.",
    intervention: "Melatonin intake",
    outcomes: ["Depression score", "Anxiety score"],
    adverseEvents:
      "Authors state more high-quality studies are needed to determine safety.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Narrow population and small trial count; not evidence for broad mood, anxiety-disorder, or stress-resilience claims.",
    referenceId: "demirhan-melatonin-menopause-mood-2024"
  },
  {
    id: "study-madsen-medacis-melatonin-acs-2019",
    title:
      "The effect of melatonin on depressive symptoms and anxiety in patients after acute coronary syndrome: The MEDACIS randomized clinical trial",
    year: 2019,
    source: "Journal of Psychiatric Research via PubMed",
    studyType: "Randomized controlled trial",
    sourceTypeTaxonomy: "RCT",
    sampleSize: "252 randomized participants.",
    population: "Adults after acute coronary syndrome without depression at baseline.",
    intervention: "Melatonin or placebo for 12 weeks after acute coronary syndrome",
    outcomes: ["Depressive symptoms", "Anxiety", "Depressive episodes", "Adverse events"],
    adverseEvents:
      "No intergroup differences were found in dropouts or adverse events.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Trial found no prophylactic antidepressant effect after acute coronary syndrome; does not support prevention claims.",
    referenceId: "madsen-medacis-melatonin-acs-2019"
  },
  {
    id: "study-cochrane-probiotics-urti-2022",
    title: "Probiotics for preventing acute upper respiratory tract infections",
    year: 2022,
    source: "Cochrane Database of Systematic Reviews via PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "systematic review",
    sampleSize: "Cochrane systematic review; trial count and participant details are in the source.",
    population:
      "Adults and children in probiotic prevention trials for acute upper respiratory tract infections.",
    intervention: "Probiotic strains and blends",
    outcomes: ["Acute upper respiratory tract infection prevention", "Respiratory symptoms"],
    adverseEvents:
      "High-risk populations and strain/product quality need separate safety review.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Evidence is strain-specific and heterogeneous; generic blend-level claims remain low confidence.",
    referenceId: "cochrane-probiotics-urti-2022"
  },
  {
    id: "study-ods-probiotics-safety",
    title: "Probiotics - Health Professional Fact Sheet",
    year: 2025,
    source: "NIH Office of Dietary Supplements",
    studyType: "Regulatory safety warning",
    sourceTypeTaxonomy: "guideline",
    sampleSize: "Health-professional fact sheet; not a clinical trial.",
    population: "People considering probiotic foods or dietary supplements.",
    intervention: "Probiotic foods and dietary supplements",
    outcomes: [
      "Strain identity",
      "CFU labeling",
      "Product selection",
      "Safety considerations",
      "Health-condition-specific guidance"
    ],
    adverseEvents:
      "ODS emphasizes strain/product variability and product-label limits; safety depends on context and product quality.",
    fundingConflicts: "Government health-professional source.",
    riskOfBias:
      "Reference safety synthesis; useful for product-quality caveats but not product-level safety or AU/TGA status.",
    referenceId: "ods-probiotics"
  },
  {
    id: "study-nccih-probiotics-safety",
    title: "Probiotics: Usefulness and Safety",
    year: 2019,
    source: "NIH National Center for Complementary and Integrative Health",
    studyType: "Regulatory safety warning",
    sourceTypeTaxonomy: "guideline",
    sampleSize: "Consumer safety fact sheet; not a clinical trial.",
    population: "People considering or using probiotic products, including higher-risk groups.",
    intervention: "Probiotic products",
    outcomes: [
      "History of use",
      "Safety-data gaps",
      "High-risk populations",
      "Infection risk",
      "Antibiotic-resistance gene transfer",
      "Product contaminants"
    ],
    adverseEvents:
      "NCCIH flags greater risk in severe illness or compromised immunity, possible infections, harmful substance production, antibiotic-resistance gene transfer, and contaminants.",
    fundingConflicts: "Government consumer safety source.",
    riskOfBias:
      "Safety synthesis; useful for caution flags but not strain-specific or product-level safety.",
    referenceId: "nccih-probiotics"
  },
  {
    id: "study-doron-probiotics-risk-safety-2015",
    title: "Risk and safety of probiotics",
    year: 2015,
    source: "Clinical Infectious Diseases via PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "narrative review",
    sampleSize: "Clinical safety review referencing AHRQ safety evidence.",
    population: "People exposed to probiotic products across clinical and post-market contexts.",
    intervention: "Probiotic products",
    outcomes: [
      "Systemic infections",
      "Deleterious metabolic activities",
      "Excessive immune stimulation",
      "Gene transfer",
      "Gastrointestinal side effects",
      "Adverse-event reporting gaps"
    ],
    adverseEvents:
      "Review describes inconsistent safety reporting and theoretical or reported risks including systemic infections and gene transfer.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Review notes that clinical-trial literature is not well equipped to answer probiotic safety questions with confidence.",
    referenceId: "doron-probiotics-risk-safety-2015"
  },
  {
    id: "study-liong-probiotics-translocation-infection-2008",
    title: "Safety of probiotics: translocation and infection",
    year: 2008,
    source: "Nutrition Reviews via PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "narrative review",
    sampleSize: "Review of translocation and infection safety literature.",
    population: "Healthy people and immunocompromised patients exposed to probiotics.",
    intervention: "Probiotic strains including Lactobacillus, Leuconostoc, Pediococcus, Enterococcus, and Bifidobacterium contexts",
    outcomes: [
      "Translocation",
      "Infection",
      "Immunocompromised-patient risk",
      "Antibiotic resistance"
    ],
    adverseEvents:
      "Review reports that harmful translocation is rare in healthy humans but documented in immunocompromised patients.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Older review; useful for infection/translocation caution but not enough for modern product-level safety.",
    referenceId: "liong-probiotics-translocation-infection-2008"
  },
  {
    id: "study-fda-probiotics-preterm-infants-2023",
    title: "FDA Raises Concerns About Probiotic Products Sold for Use in Hospitalized Preterm Infants",
    year: 2023,
    source: "U.S. Food and Drug Administration",
    studyType: "Regulatory safety warning",
    sourceTypeTaxonomy: "regulatory warning",
    sampleSize: "FDA warning context for hospitalized preterm infants.",
    population: "Hospitalized preterm infants exposed to probiotic products.",
    intervention: "Products containing live bacteria or yeast sold for preterm infant hospital use",
    outcomes: [
      "Invasive infection",
      "Potentially fatal disease",
      "Product approval status",
      "Manufacturing and testing concerns",
      "Adverse-event reports"
    ],
    adverseEvents:
      "FDA warned of invasive, potentially fatal disease or infection in preterm infants and noted one infant death in 2023 plus additional adverse-event reports.",
    fundingConflicts: "U.S. FDA safety warning source.",
    riskOfBias:
      "Regulatory warning context; does not establish risk for healthy adults or every probiotic product.",
    referenceId: "fda-probiotics-preterm-infants-2023"
  },
  {
    id: "study-rittiphairoj-probiotics-glycemic-t2dm-2021",
    title:
      "Probiotics Contribute to Glycemic Control in Patients with Type 2 Diabetes Mellitus: A Systematic Review and Meta-Analysis",
    year: 2021,
    source: "Advances in Nutrition via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "28 randomized controlled trials; 1,947 participants.",
    population: "Adults with prediabetes or type 2 diabetes mellitus.",
    intervention: "Probiotics or synbiotics",
    outcomes: [
      "Fasting blood glucose",
      "HbA1c",
      "Serum cholesterol",
      "Safety",
      "Subgroup response by baseline glucose and insulin therapy"
    ],
    adverseEvents:
      "Safety was included in the review aim, but product-specific and high-risk safety remains a separate packet.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Biomarker signal was stronger in selected subgroups; not evidence for medication replacement or diabetes treatment.",
    referenceId: "rittiphairoj-probiotics-glycemic-t2dm-2021"
  },
  {
    id: "study-li-probiotics-glycemic-t2dm-2023",
    title:
      "The effects of probiotics supplementation on glycaemic control among adults with type 2 diabetes mellitus: a systematic review and meta-analysis of randomised clinical trials",
    year: 2023,
    source: "Journal of Translational Medicine via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "30 randomized controlled trials; 1,827 participants with type 2 diabetes.",
    population: "Adults with type 2 diabetes mellitus.",
    intervention: "Probiotic supplementation",
    outcomes: ["Fasting blood glucose", "Insulin", "HbA1c", "HOMA-IR"],
    adverseEvents:
      "Safety outcomes require separate extraction; this source is primarily glycemic biomarker focused.",
    fundingConflicts: "Source abstract reports no competing interests.",
    riskOfBias:
      "Subgroup effects varied by race, BMI, probiotic genus, and delivery type; does not establish broad blend-level efficacy.",
    referenceId: "li-probiotics-glycemic-t2dm-2023"
  },
  {
    id: "study-baroni-probiotics-synbiotics-diabetes-2024",
    title:
      "Probiotics and synbiotics for glycemic control in diabetes: A systematic review and meta-analysis of randomized controlled trials",
    year: 2024,
    source: "Clinical Nutrition via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "41 randomized controlled trials; 2,991 adults with diabetes.",
    population: "Adults with type 1 or type 2 diabetes mellitus in randomized trials.",
    intervention: "Probiotics or synbiotics",
    outcomes: ["HbA1c", "Fasting plasma glucose", "Insulin levels", "Strain subgroup effects"],
    adverseEvents:
      "Safety and medicine-context questions require separate extraction; use the probiotic safety packet.",
    fundingConflicts: "Source abstract reports no conflicts of interest.",
    riskOfBias:
      "Medium heterogeneity and strain/country subgroup effects limit generic blend-level interpretation.",
    referenceId: "baroni-probiotics-synbiotics-diabetes-2024"
  },
  {
    id: "study-ho-coq10-bp-primary-hypertension-2016",
    title: "Blood pressure lowering efficacy of coenzyme Q10 for primary hypertension",
    year: 2016,
    source: "Cochrane Database of Systematic Reviews via PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "systematic review",
    sampleSize: "3 included randomized trials; 2 trials and 50 participants pooled.",
    population: "Adults with primary hypertension in double-blind randomized trials.",
    intervention: "Coenzyme Q10",
    outcomes: ["Systolic blood pressure", "Diastolic blood pressure", "Adverse effects"],
    adverseEvents:
      "One of three included trials reporting adverse effects found CoQ10 was well tolerated; broader safety requires separate extraction.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Small trial set; one included trial was judged unacceptably high risk of bias and excluded from pooling.",
    referenceId: "ho-coq10-bp-primary-hypertension-2016"
  },
  {
    id: "study-tabrizi-coq10-bp-metabolic-2018",
    title:
      "The Effects of Coenzyme Q10 Supplementation on Blood Pressures Among Patients with Metabolic Diseases: A Systematic Review and Meta-analysis of Randomized Controlled Trials",
    year: 2018,
    source: "High Blood Pressure & Cardiovascular Prevention via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "17 randomized controlled trials; 684 participants.",
    population: "Patients with metabolic diseases in randomized controlled trials.",
    intervention: "Coenzyme Q10 supplementation",
    outcomes: ["Systolic blood pressure", "Diastolic blood pressure"],
    adverseEvents:
      "Safety outcomes require separate extraction; this source is primarily blood-pressure biomarker focused.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Findings were stronger for systolic than diastolic pressure and require metabolic-disease context boundaries.",
    referenceId: "tabrizi-coq10-bp-metabolic-2018"
  },
  {
    id: "study-zhao-coq10-bp-dose-response-2022",
    title:
      "Dose-Response Effect of Coenzyme Q10 Supplementation on Blood Pressure among Patients with Cardiometabolic Disorders: A GRADE-Assessed Systematic Review and Meta-Analysis of Randomized Controlled Trials",
    year: 2022,
    source: "Advances in Nutrition via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "26 studies; 1,831 participants with cardiometabolic disorders.",
    population: "Patients with cardiometabolic disorders in randomized controlled trials.",
    intervention: "Coenzyme Q10 supplementation",
    outcomes: ["Systolic blood pressure", "Diastolic blood pressure", "Dose-response pattern"],
    adverseEvents:
      "Safety outcomes require separate extraction; this source is primarily dose-response blood-pressure biomarker focused.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "GRADE certainty and dose-response shape should be preserved; does not establish product-level or medication-replacement claims.",
    referenceId: "zhao-coq10-bp-dose-response-2022"
  },
  {
    id: "study-karimi-coq10-bp-heart-rate-2025",
    title:
      "Effects of coenzyme Q10 administration on blood pressure and heart rate in adults: A systematic review and meta-analysis of randomized controlled trials",
    year: 2025,
    source: "International Journal of Cardiology. Cardiovascular Risk and Prevention via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "45 randomized controlled trials; 48 effect sizes.",
    population: "Adults in randomized controlled trials.",
    intervention: "Coenzyme Q10 administration",
    outcomes: ["Systolic blood pressure", "Diastolic blood pressure", "Heart rate"],
    adverseEvents:
      "The abstract describes a favorable safety profile, but adverse-event extraction and medication-context review remain separate.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Pooled signal was systolic-only; do not translate adjunctive wording into treatment, dosing, or medication-replacement guidance.",
    referenceId: "karimi-coq10-bp-heart-rate-2025"
  },
  {
    id: "study-nccih-coq10",
    title: "Coenzyme Q10",
    year: 2019,
    source: "NIH National Center for Complementary and Integrative Health",
    studyType: "Regulatory safety warning",
    sourceTypeTaxonomy: "guideline",
    sampleSize: "Consumer safety fact sheet; not a clinical trial.",
    population: "General supplement users in consumer health reference context.",
    intervention: "Coenzyme Q10 supplement use",
    outcomes: ["Safety", "Side effects", "Warfarin interaction", "Insulin interaction", "Cancer treatment compatibility"],
    adverseEvents:
      "NCCIH reports no serious side effects, with possible mild insomnia or digestive upset, and flags warfarin, insulin, and some cancer-treatment compatibility concerns.",
    fundingConflicts: "U.S. NIH/NCCIH consumer health source.",
    riskOfBias:
      "Consumer health summary; useful for safety caveats but not product-specific risk quantification.",
    referenceId: "nccih-coq10"
  },
  {
    id: "study-hidaka-coq10-safety-2008",
    title: "Safety assessment of coenzyme Q10 (CoQ10)",
    year: 2008,
    source: "BioFactors via PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "narrative review",
    sampleSize: "Published safety review; study details are in the source.",
    population: "Human and nonclinical CoQ10 safety literature summarized by the review.",
    intervention: "Coenzyme Q10",
    outcomes: ["Toxicity", "Serious adverse effects", "Human safety reports"],
    adverseEvents:
      "The indexed summary reports low toxicity and no serious adverse effects in published human safety reports.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Older safety review; does not replace current product-level adverse-event or contaminant review.",
    referenceId: "hidaka-coq10-safety-2008"
  },
  {
    id: "study-hathcock-coq10-risk-assessment-2006",
    title: "Risk assessment for coenzyme Q10 (Ubiquinone)",
    year: 2006,
    source: "Regulatory Toxicology and Pharmacology via PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "narrative review",
    sampleSize: "Risk-assessment review; study details are in the source.",
    population: "Supplement users and safety-study populations in risk-assessment context.",
    intervention: "Coenzyme Q10 / ubiquinone",
    outcomes: ["Observed safe level", "Tolerability", "Risk assessment"],
    adverseEvents:
      "Risk-assessment source reports strong safety evidence at observed intake levels, but does not establish safety for every user or product.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Risk-assessment methods and older evidence base limit direct product-level interpretation.",
    referenceId: "hathcock-coq10-risk-assessment-2006"
  },
  {
    id: "study-livertox-coq10-2024",
    title: "Coenzyme Q10",
    year: 2024,
    source: "LiverTox via NCBI Bookshelf",
    studyType: "Regulatory safety warning",
    sourceTypeTaxonomy: "guideline",
    sampleSize: "LiverTox drug record and annotated hepatotoxicity literature; not a clinical trial.",
    population: "General CoQ10 supplement users in liver-safety reference context.",
    intervention: "Coenzyme Q10 supplements",
    outcomes: ["Hepatotoxicity", "Serum enzyme elevations", "Clinically apparent liver injury"],
    adverseEvents:
      "LiverTox reports no evidence of serum enzyme elevations or clinically apparent liver injury and rates clinically apparent liver injury as unlikely.",
    fundingConflicts: "NCBI Bookshelf/LiverTox reference source.",
    riskOfBias:
      "Liver-safety reference; does not establish broader safety, product quality, or medication-interaction safety.",
    referenceId: "livertox-coq10-2024"
  },
  {
    id: "study-landbo-warfarin-coq10-1998",
    title: "Interaction between warfarin and coenzyme Q10",
    year: 1998,
    source: "Ugeskrift for Laeger via PubMed",
    studyType: "Case report",
    sourceTypeTaxonomy: "observational study",
    sampleSize: "Case report.",
    population: "Warfarin-treated patient context.",
    intervention: "Concurrent coenzyme Q10 use",
    outcomes: ["Warfarin treatment failure signal", "Anticoagulation safety"],
    adverseEvents:
      "Case-report signal warns warfarin-treated patients about possible treatment failure with concurrent CoQ10 use.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Low-level case-report evidence; use as a medication-review flag, not proof of universal interaction.",
    referenceId: "landbo-warfarin-coq10-1998"
  },
  {
    id: "study-williams-l-theanine-stress-anxiety-2020",
    title:
      "The Effects of Green Tea Amino Acid L-Theanine Consumption on the Ability to Manage Stress and Anxiety Levels: a Systematic Review",
    year: 2020,
    source: "Plant Foods for Human Nutrition via PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "systematic review",
    sampleSize: "Systematic review; study details are in the source.",
    population: "Adults in human L-theanine stress and anxiety studies.",
    intervention: "L-theanine consumption",
    outcomes: ["Stress", "Anxiety", "Stress management"],
    adverseEvents:
      "Adverse-event detail requires separate extraction; this source primarily summarizes stress and anxiety outcomes.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Systematic review of a small, heterogeneous literature; not evidence for psychiatric treatment or product-level claims.",
    referenceId: "williams-l-theanine-stress-anxiety-2020"
  },
  {
    id: "study-hidese-l-theanine-stress-cognition-2019",
    title:
      "Effects of L-Theanine Administration on Stress-Related Symptoms and Cognitive Functions in Healthy Adults: A Randomized Controlled Trial",
    year: 2019,
    source: "Nutrients via PubMed",
    studyType: "Randomized controlled trial",
    sourceTypeTaxonomy: "RCT",
    sampleSize: "30 healthy adults in randomized, placebo-controlled, crossover, double-blind trial.",
    population: "Healthy adults without major psychiatric illness.",
    intervention: "L-theanine",
    outcomes: ["Self-rating depression score", "Trait anxiety", "Sleep quality", "Cognitive function"],
    adverseEvents:
      "Adverse-event detail requires separate extraction; safety is not established for every user context.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Small sample and crossover context; supports low-confidence symptom signal only.",
    referenceId: "hidese-l-theanine-stress-cognition-2019"
  },
  {
    id: "study-lyon-l-theanine-adhd-sleep-2011",
    title:
      "The effects of L-theanine (Suntheanine) on objective sleep quality in boys with attention deficit hyperactivity disorder (ADHD): a randomized, double-blind, placebo-controlled clinical trial",
    year: 2011,
    source: "Alternative Medicine Review via PubMed",
    studyType: "Randomized controlled trial",
    sourceTypeTaxonomy: "RCT",
    sampleSize: "98 boys with ADHD.",
    population: "Boys aged 8-12 years with physician-confirmed ADHD.",
    intervention: "L-theanine chewable tablets",
    outcomes: ["Actigraphy sleep percentage", "Sleep efficiency", "Sleep activity", "Sleep latency", "Parent sleep questionnaire"],
    adverseEvents:
      "The abstract reports L-theanine was well tolerated with no significant adverse events in this pediatric ADHD trial.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Pediatric ADHD context and branded formulation limit generalization to adult insomnia or general sleep support.",
    referenceId: "lyon-l-theanine-adhd-sleep-2011"
  },
  {
    id: "study-anand-adhd-insomnia-drugs-2017",
    title:
      "Safety, Tolerability and Efficacy of Drugs for Treating Behavioural Insomnia in Children with Attention-Deficit/Hyperactivity Disorder: A Systematic Review with Methodological Quality Assessment",
    year: 2017,
    source: "Paediatric Drugs via PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "systematic review",
    sampleSize: "12 pediatric ADHD insomnia studies; one L-theanine randomized trial.",
    population: "Children with ADHD and behavioral insomnia or sleep problems.",
    intervention: "Sleep-related pharmacologic interventions including L-theanine",
    outcomes: ["Sleep onset latency", "Total sleep duration", "Sleep quality", "Safety and tolerability"],
    adverseEvents:
      "The review reports L-theanine was generally well tolerated, but overall evidence for pediatric ADHD insomnia drugs was poor.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Review rated most evidence moderate to low quality; supports caution and pediatric clinician oversight.",
    referenceId: "anand-adhd-insomnia-drugs-2017"
  },
  {
    id: "study-moshfeghinia-l-theanine-mental-disorders-2024",
    title:
      "The effects of L-theanine supplementation on the outcomes of patients with mental disorders: a systematic review",
    year: 2024,
    source: "BMC Psychiatry via PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "systematic review",
    sampleSize: "11 randomized controlled studies across mental-health conditions.",
    population: "Patients with mental disorders including ADHD, sleep disorders, GAD, schizophrenia, OCD, MDD, and Tourette syndrome.",
    intervention: "L-theanine supplementation",
    outcomes: ["Psychiatric symptoms", "Sleep disorders", "ADHD symptoms"],
    adverseEvents:
      "Adverse-event details require source-level extraction; mental-health and medication contexts require clinician review.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Broad mental-disorder review; not direct evidence for general adult sleep support or insomnia treatment.",
    referenceId: "moshfeghinia-l-theanine-mental-disorders-2024"
  },
  {
    id: "study-kimura-l-theanine-stress-response-2007",
    title: "L-Theanine reduces psychological and physiological stress responses",
    year: 2007,
    source: "Biological Psychology via PubMed",
    studyType: "Randomized controlled trial",
    sourceTypeTaxonomy: "RCT",
    sampleSize: "Small randomized human stress-response trial; study details are in the source.",
    population: "Adults exposed to psychological or physiological stress tasks.",
    intervention: "L-theanine",
    outcomes: ["Psychological stress response", "Physiological stress response"],
    adverseEvents:
      "Adverse-event detail requires separate extraction; this source is stress-response focused.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Small experimental stress-task study; does not establish durable anxiety or mental-health treatment benefit.",
    referenceId: "kimura-l-theanine-stress-response-2007"
  },
  {
    id: "study-yoto-l-theanine-stress-bp-2012",
    title:
      "Effects of L-theanine or caffeine intake on changes in blood pressure under physical and psychological stresses",
    year: 2012,
    source: "Journal of Physiological Anthropology via PubMed",
    studyType: "Randomized controlled trial",
    sourceTypeTaxonomy: "RCT",
    sampleSize: "14 participants in three separate trials.",
    population: "Adults exposed to physical and psychological stress tasks.",
    intervention: "L-theanine or caffeine",
    outcomes: ["Tension-Anxiety score", "Blood pressure response under stress", "Mental task performance"],
    adverseEvents:
      "Adverse-event detail requires separate extraction; this source is acute stress-response focused.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Very small stress-task trial with subgroup response; use only as low-confidence stress-response support.",
    referenceId: "yoto-l-theanine-stress-bp-2012"
  },
  {
    id: "study-sarris-l-theanine-gad-2019",
    title:
      "L-theanine in the adjunctive treatment of generalized anxiety disorder: A double-blind, randomised, placebo-controlled trial",
    year: 2019,
    source: "Journal of Psychiatric Research via PubMed",
    studyType: "Randomized controlled trial",
    sourceTypeTaxonomy: "RCT",
    sampleSize: "Phase II randomized placebo-controlled trial; source record contains trial details.",
    population: "Adults with generalized anxiety disorder receiving adjunctive treatment.",
    intervention: "Adjunctive L-theanine",
    outcomes: ["Generalized anxiety symptoms", "Sleep", "Psychiatric treatment response"],
    adverseEvents:
      "Adverse-event detail requires separate extraction; psychiatric medication context requires clinician review.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Negative psychiatric-treatment context prevents treating L-theanine as an anxiety-disorder therapy.",
    referenceId: "sarris-l-theanine-gad-2019"
  },
  {
    id: "study-issn-beta-alanine-position-stand-2015",
    title: "International society of sports nutrition position stand: Beta-Alanine",
    year: 2015,
    source: "Journal of the International Society of Sports Nutrition via PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "position stand",
    sampleSize: "Position stand/review; source summarizes multiple beta-alanine performance and safety studies.",
    population: "Healthy and athletic adults in sports-nutrition literature.",
    intervention: "Beta-alanine supplementation",
    outcomes: ["Muscle carnosine", "High-intensity exercise capacity", "Performance", "Paresthesia and safety"],
    adverseEvents:
      "Position stand discusses paresthesia and safety context; use the separate beta-alanine safety packet for adverse-event interpretation.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Position stand/review; useful for sports-nutrition consensus but not product-specific or VO2 max proof.",
    referenceId: "issn-beta-alanine-position-stand-2015"
  },
  {
    id: "study-hobson-beta-alanine-performance-2012",
    title: "Effects of beta-alanine supplementation on exercise performance: a meta-analysis",
    year: 2012,
    source: "Amino Acids via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "Meta-analysis of beta-alanine exercise-performance trials.",
    population: "Healthy participants in exercise-performance trials.",
    intervention: "Beta-alanine supplementation",
    outcomes: ["Exercise performance", "Exercise capacity", "Ergogenic effect"],
    adverseEvents:
      "Adverse-event details require separate extraction; this source is primarily performance focused.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Earlier meta-analysis; interpret alongside newer synthesis and endpoint-specific sport context.",
    referenceId: "hobson-beta-alanine-performance-2012"
  },
  {
    id: "study-saunders-beta-alanine-exercise-2017",
    title:
      "Beta-alanine supplementation to improve exercise capacity and performance: a systematic review and meta-analysis",
    year: 2017,
    source: "British Journal of Sports Medicine via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "40 studies; 65 exercise protocols; 70 exercise measures; 1,461 participants.",
    population: "Healthy participant populations in double-blind placebo-controlled exercise studies.",
    intervention: "Chronic beta-alanine supplementation",
    outcomes: ["Exercise capacity", "Exercise performance", "Exercise duration subgroup effects", "Co-supplementation context"],
    adverseEvents:
      "Adverse-event details require separate extraction; performance outcomes are the main focus.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Effect sizes were small overall and moderated by exercise duration/type; does not establish broad endurance, VO2 max, or longevity effects.",
    referenceId: "saunders-beta-alanine-exercise-2017"
  },
  {
    id: "study-dolan-beta-alanine-risk-assessment-2019",
    title: "A Systematic Risk Assessment and Meta-Analysis on the Use of Oral Beta-Alanine Supplementation",
    year: 2019,
    source: "Advances in Nutrition via PubMed Central",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "101 human and 50 animal studies; 2,268 humans in final analyses.",
    population: "Mostly healthy human participants in beta-alanine supplementation studies, plus animal safety data.",
    intervention: "Oral beta-alanine supplementation",
    outcomes: ["Paresthesia", "Dropout rates", "Health-related biomarkers", "Muscle taurine and histidine", "Animal safety outcomes"],
    adverseEvents:
      "Paresthesia was the only reported side effect and was more likely with beta-alanine than placebo; dropout rates were similar to placebo.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Safety reporting was often secondary and not always systematically collected; product-level and sensitive-population safety remain unresolved.",
    referenceId: "dolan-beta-alanine-risk-assessment-2019"
  },
  {
    id: "study-ko-beta-alanine-military-2014",
    title:
      "Evidence-based evaluation of potential benefits and safety of beta-alanine supplementation for military personnel",
    year: 2014,
    source: "Nutrition Reviews via PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "systematic review",
    sampleSize: "Evidence-based review for military personnel; study details are in the source.",
    population: "Military personnel and military-relevant performance contexts.",
    intervention: "Beta-alanine supplementation",
    outcomes: ["Potential benefits", "Safety", "Military performance context"],
    adverseEvents:
      "Safety review context; adverse-event details require source-level extraction before product or population-specific clearance.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Military-focused review may not generalize to all users, products, or high-risk health contexts.",
    referenceId: "ko-beta-alanine-military-2014"
  },
  {
    id: "study-mirenayat-l-citrulline-bp-2018",
    title: "Effect of L-Citrulline Supplementation on Blood Pressure: a Systematic Review and Meta-Analysis of Clinical Trials",
    year: 2018,
    source: "Current Hypertension Reports via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "5 interventions included in meta-analysis.",
    population: "Human clinical trial participants with brachial or aortic blood-pressure outcomes.",
    intervention: "L-citrulline supplementation",
    outcomes: ["Brachial systolic blood pressure", "Brachial diastolic blood pressure", "Aortic blood pressure"],
    adverseEvents:
      "Adverse-event details require separate extraction; this source is primarily blood-pressure biomarker focused.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Neutral pooled result and small intervention set limit confidence in a broad blood-pressure claim.",
    referenceId: "mirenayat-l-citrulline-bp-2018"
  },
  {
    id: "study-barkhidarian-l-citrulline-bp-2019",
    title: "Effects of L-citrulline supplementation on blood pressure: A systematic review and meta-analysis",
    year: 2019,
    source: "Avicenna Journal of Phytomedicine via PubMed Central",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "8 trials with 10 datasets; trial sample sizes ranged from 12 to 34 participants.",
    population: "Adults in randomized clinical trials.",
    intervention: "Oral L-citrulline supplementation",
    outcomes: ["Systolic blood pressure", "Diastolic blood pressure", "Dose subgroup"],
    adverseEvents:
      "Adverse-event details require separate extraction; this source is primarily blood-pressure biomarker focused.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Small trials and mixed DBP findings require conservative, biomarker-only interpretation.",
    referenceId: "barkhidarian-l-citrulline-bp-2019"
  },
  {
    id: "study-luo-l-citrulline-bp-older-adults-2025",
    title:
      "Does l-citrulline supplementation and watermelon intake reduce blood pressure in middle-aged and older adults? A systematic review and meta-analysis of randomized controlled trials",
    year: 2025,
    source: "Clinical Nutrition ESPEN via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "15 randomized controlled trials; 24 datasets; 415 participants.",
    population: "Middle-aged and older adults in randomized controlled trials.",
    intervention: "L-citrulline supplementation or watermelon intake",
    outcomes: ["Systolic blood pressure", "Diastolic blood pressure", "L-citrulline plus L-arginine subgroup"],
    adverseEvents:
      "Adverse-event details require separate extraction; combination and food-form contexts need separate interpretation.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Population and combination-subgroup context limit generalization to every adult or isolated L-citrulline product.",
    referenceId: "luo-l-citrulline-bp-older-adults-2025"
  },
  {
    id: "study-luo-l-citrulline-cold-bp-2026",
    title:
      "Effect of L-Citrulline Intake on Blood Pressure in Cold Environments: A Systematic Review and Meta-Analysis of Randomized Controlled Trials",
    year: 2026,
    source: "Food Science & Nutrition via PubMed Central",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "6 randomized controlled trials; 162 participants.",
    population: "Participants exposed to cold-environment blood-pressure stressors.",
    intervention: "L-citrulline intake",
    outcomes: ["Cold-induced systolic blood pressure", "Cold-induced diastolic blood pressure", "Brachial and aortic blood pressure"],
    adverseEvents:
      "Adverse-event details require separate extraction; cold-exposure cardiovascular context may require clinician review.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Cold-environment niche context; does not establish broad hypertension treatment or general adult BP benefit.",
    referenceId: "luo-l-citrulline-cold-bp-2026"
  },
  {
    id: "study-rhim-citrulline-rpe-soreness-2020",
    title:
      "Effect of citrulline on post-exercise rating of perceived exertion, muscle soreness, and blood lactate levels: A systematic review and meta-analysis",
    year: 2020,
    source: "Journal of Sport and Health Science via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "13 randomized controlled trials; 206 participants.",
    population: "Healthy individuals in exercise trials.",
    intervention: "L-citrulline or citrulline malate supplementation",
    outcomes: ["Rating of perceived exertion", "Muscle soreness", "Blood lactate"],
    adverseEvents:
      "Adverse-event details require separate extraction; exercise-outcome source, not a safety packet.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Acute exercise-context outcomes; does not prove VO2 max, long-term endurance, or disease benefit.",
    referenceId: "rhim-citrulline-rpe-soreness-2020"
  },
  {
    id: "study-varvik-citrulline-repetition-performance-2021",
    title: "Acute Effect of Citrulline Malate on Repetition Performance During Strength Training: A Systematic Review and Meta-Analysis",
    year: 2021,
    source: "International Journal of Sport Nutrition and Exercise Metabolism via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "Systematic review/meta-analysis of strength-training repetition-performance trials.",
    population: "Participants in strength-training repetition-performance studies.",
    intervention: "Acute citrulline malate supplementation",
    outcomes: ["Repetition performance", "Strength training"],
    adverseEvents:
      "Adverse-event details require separate extraction; this source is performance focused.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Acute citrulline malate and repetition-performance context may not generalize to L-citrulline, endurance, or VO2 max.",
    referenceId: "varvik-citrulline-repetition-performance-2021"
  },
  {
    id: "study-aguiar-citrulline-malate-strength-2022",
    title:
      "Effects of Citrulline Malate Supplementation on Muscle Strength in Resistance-Trained Adults: A Systematic Review and Meta-Analysis of Randomized Controlled Trials",
    year: 2022,
    source: "Journal of Dietary Supplements via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "4 studies; 138 assessments in resistance-trained adults.",
    population: "Healthy resistance-trained adults.",
    intervention: "Citrulline malate supplementation",
    outcomes: ["Muscle strength", "Upper-limb strength", "Lower-limb strength"],
    adverseEvents:
      "Adverse-event details require separate extraction; this source is strength-outcome focused.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Neutral strength finding prevents broad performance or strength claims from this packet.",
    referenceId: "aguiar-citrulline-malate-strength-2022"
  },
  {
    id: "study-guan-taurine-bp-lipids-2020",
    title:
      "The effects of taurine supplementation on obesity, blood pressure and lipid profile: A meta-analysis of randomized controlled trials",
    year: 2020,
    source: "European Journal of Pharmacology via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "12 randomized controlled studies.",
    population: "Mostly patients with liver or metabolic dysregulation, including diabetes, fatty liver, obesity, cystic fibrosis, chronic alcoholism, and cardiac surgery contexts.",
    intervention: "Taurine supplementation",
    outcomes: ["Systolic blood pressure", "Diastolic blood pressure", "Lipids", "Anthropometric measures"],
    adverseEvents:
      "Adverse-event details require separate extraction; this source is primarily cardiometabolic biomarker focused.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Population mix and metabolic/liver-risk context limit generalization to healthy adults or product-level claims.",
    referenceId: "guan-taurine-bp-lipids-2020"
  },
  {
    id: "study-tzang-taurine-metabolic-syndrome-2024",
    title: "Taurine reduces the risk for metabolic syndrome: a systematic review and meta-analysis of randomized controlled trials",
    year: 2024,
    source: "Nutrition & Diabetes via PubMed Central",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "25 randomized controlled trials; 1,024 participants.",
    population: "Participants in metabolic-syndrome-related randomized controlled trials.",
    intervention: "Taurine supplementation",
    outcomes: ["Systolic blood pressure", "Diastolic blood pressure", "Fasting glucose", "Triglycerides", "HDL-C"],
    adverseEvents:
      "The abstract reports no significant adverse effects compared with control, but safety still requires separate extraction.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Metabolic-syndrome risk-factor outcomes do not establish clinical disease prevention or hypertension treatment.",
    referenceId: "tzang-taurine-metabolic-syndrome-2024"
  },
  {
    id: "study-nie-taurine-cardiometabolic-2025",
    title:
      "Effects of Oral Taurine Supplementation on Cardiometabolic Risk Factors: A Meta-analysis and Systematic Review of Randomized Clinical Trials",
    year: 2025,
    source: "Nutrition Reviews via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "34 randomized controlled trials.",
    population: "Adults in cardiometabolic risk-factor randomized clinical trials.",
    intervention: "Oral taurine supplementation",
    outcomes: ["Systolic blood pressure", "Diastolic blood pressure", "Glycemic markers", "Lipids", "Inflammation markers"],
    adverseEvents:
      "Adverse-event details require source-level extraction; cardiometabolic biomarker evidence is not a safety clearance.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "As-supplied publisher record at capture; use as an emerging synthesis and preserve uncertainty until fully indexed review details mature.",
    referenceId: "nie-taurine-cardiometabolic-2025"
  },
  {
    id: "study-shao-taurine-risk-assessment-2008",
    title: "Risk assessment for the amino acids taurine, L-glutamine and L-arginine",
    year: 2008,
    source: "Regulatory Toxicology and Pharmacology via PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "narrative review",
    sampleSize: "Risk-assessment review; study details are in the source.",
    population: "Supplement users and safety-study populations in amino-acid risk-assessment context.",
    intervention: "Taurine, L-glutamine, and L-arginine",
    outcomes: ["Risk assessment", "Observed safe level", "Human safety evidence"],
    adverseEvents:
      "Risk-assessment source; specific adverse-event details require source-level extraction before product-level safety claims.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Older risk assessment and multi-amino-acid scope; does not establish safety for every product, high-intake pattern, or sensitive population.",
    referenceId: "shao-taurine-risk-assessment-2008"
  },
  {
    id: "study-efsa-taurine-energy-drinks-2009",
    title:
      "The use of taurine and D-glucurono-gamma-lactone as constituents of the so-called energy drinks",
    year: 2009,
    source: "European Food Safety Authority",
    studyType: "Regulatory safety warning",
    sourceTypeTaxonomy: "regulatory warning",
    sampleSize: "EFSA scientific opinion; not a clinical trial.",
    population: "Consumers exposed to taurine and D-glucurono-gamma-lactone as energy-drink constituents.",
    intervention: "Taurine and D-glucurono-gamma-lactone in energy drinks",
    outcomes: ["Safety-in-use", "Exposure assessment", "Energy-drink constituent review"],
    adverseEvents:
      "EFSA reviewed taurine as an energy-drink constituent; this does not clear energy drinks, caffeine combinations, alcohol co-use, or every supplement product.",
    fundingConflicts: "European Food Safety Authority scientific opinion.",
    riskOfBias:
      "Regulatory ingredient/exposure review; not a product-specific supplement safety trial.",
    referenceId: "efsa-taurine-energy-drinks-2009"
  },
  {
    id: "study-papi-nac-copd-chronic-bronchitis-2024",
    title:
      "N-acetylcysteine Treatment in Chronic Obstructive Pulmonary Disease (COPD) and Chronic Bronchitis/Pre-COPD: Distinct Meta-analyses",
    year: 2024,
    source: "Archivos de Bronconeumologia via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize:
      "20 studies, including 7 studies evaluating chronic bronchitis/pre-COPD entry criteria.",
    population: "People with COPD or chronic bronchitis/pre-COPD in NAC trials.",
    intervention: "N-acetylcysteine compared with placebo",
    outcomes: ["Exacerbations", "Respiratory symptoms", "Quality of life"],
    adverseEvents:
      "Use the separate NAC safety packet for adverse-event extraction; this source is primarily respiratory-outcome focused.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Disease-specific synthesis with sensitivity analyses; does not support generic immune enhancement, acute infection treatment, or healthy-adult respiratory claims.",
    referenceId: "papi-nac-copd-chronic-bronchitis-2024"
  },
  {
    id: "study-poole-mucolytics-copd-2019",
    title: "Mucolytic agents versus placebo for chronic bronchitis or chronic obstructive pulmonary disease",
    year: 2019,
    source: "Cochrane Database of Systematic Reviews via PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "systematic review",
    sampleSize: "38 trials; 10,377 participants.",
    population: "Adults with chronic bronchitis or COPD in oral mucolytic randomized trials.",
    intervention:
      "Oral mucolytic therapy including N-acetylcysteine, carbocysteine, erdosteine, and ambroxol",
    outcomes: ["Acute exacerbations", "Days of disability", "Hospitalisations", "Quality of life", "Adverse events"],
    adverseEvents:
      "Review did not find an adverse-event increase for mucolytics overall, but product, drug, respiratory-disease, and formulation contexts remain separate safety questions.",
    fundingConflicts: "Cochrane review; check source record for detailed funding and conflict declarations.",
    riskOfBias:
      "Moderate-certainty but heterogeneous mucolytic-class evidence; newer studies showed less benefit than earlier trials and NAC-specific inference requires direct NAC sources.",
    referenceId: "poole-mucolytics-copd-2019"
  },
  {
    id: "study-zheng-pantheon-nac-copd-2014",
    title:
      "Twice daily N-acetylcysteine 600 mg for exacerbations of chronic obstructive pulmonary disease (PANTHEON): a randomised, double-blind placebo-controlled trial",
    year: 2014,
    source: "The Lancet Respiratory Medicine via PubMed",
    studyType: "Randomized controlled trial",
    sourceTypeTaxonomy: "RCT",
    sampleSize: "1006 randomized participants; primary analysis included 482 per group.",
    population: "Chinese adults aged 40 to 80 years with moderate-to-severe COPD.",
    intervention: "N-acetylcysteine compared with matched placebo for 1 year",
    outcomes: ["Annual COPD exacerbation rate", "Adverse events", "Serious adverse events"],
    adverseEvents:
      "Adverse events were reported in 29% of NAC recipients and 26% of placebo recipients; serious adverse-event counts were similar.",
    fundingConflicts: "Source abstract reports funding by Hainan Zambon Pharmaceutical.",
    riskOfBias:
      "Large COPD disease-management RCT; does not generalize to healthy adults, acute infections, every COPD phenotype, or supplement-product claims.",
    referenceId: "zheng-pantheon-nac-copd-2014"
  },
  {
    id: "study-tse-hiace-nac-copd-2013",
    title:
      "High-dose N-acetylcysteine in stable COPD: the 1-year, double-blind, randomized, placebo-controlled HIACE study",
    year: 2013,
    source: "Chest via PubMed",
    studyType: "Randomized controlled trial",
    sourceTypeTaxonomy: "RCT",
    sampleSize: "120 eligible participants.",
    population: "Chinese adults with stable COPD in a one-year Hong Kong trial.",
    intervention: "N-acetylcysteine plus usual therapy compared with placebo plus usual therapy",
    outcomes: ["Small-airways function", "Exacerbation frequency", "Admission rate", "Dyspnea", "Quality of life", "Six-minute walk distance"],
    adverseEvents: "Source abstract reports no major adverse effects.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Small single-region COPD trial; symptom, lung-function, and exacerbation findings should not be translated into broad immune or healthy-adult respiratory claims.",
    referenceId: "tse-hiace-nac-copd-2013"
  },
  {
    id: "study-rogliani-mucolytic-antioxidant-copd-2019",
    title:
      "Efficacy and safety profile of mucolytic/antioxidant agents in chronic obstructive pulmonary disease: a comparative analysis across erdosteine, carbocysteine, and N-acetylcysteine",
    year: 2019,
    source: "Respiratory Research via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "7 randomized controlled trials; 2,753 COPD patients.",
    population: "People with COPD in mucolytic/antioxidant randomized trials.",
    intervention: "Erdosteine, carbocysteine, or N-acetylcysteine compared across COPD trial evidence",
    outcomes: ["Acute COPD exacerbations", "Exacerbation duration", "Hospitalization", "Adverse events"],
    adverseEvents:
      "Adverse events induced by the compared mucolytic/antioxidant agents were described as mild and generally well tolerated in the analyzed COPD trials.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Network comparison across COPD trials; it does not prove oral NAC safety for every population, route, product, or long-term pattern.",
    referenceId: "rogliani-mucolytic-antioxidant-copd-2019"
  },
  {
    id: "study-rhodes-nac-performance-side-effects-2017",
    title: "Performance and Side Effects of Supplementation with N-Acetylcysteine: A Systematic Review and Meta-Analysis",
    year: 2017,
    source: "Sports Medicine via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "7 studies in the performance analysis; 17 studies in the side-effects meta-analysis.",
    population: "Participants in NAC exercise-performance and side-effect reporting trials.",
    intervention: "N-acetylcysteine supplementation compared with placebo/control",
    outcomes: ["Exercise performance", "Side effects", "Dose-related side-effect uncertainty"],
    adverseEvents:
      "Review found unclear side-effect risk due to variation and suboptimal reporting, with a possible dose-related signal requiring more investigation.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Sports-supplement context and inconsistent adverse-event reporting limit safety certainty and do not support broad high-dose safety claims.",
    referenceId: "rhodes-nac-performance-side-effects-2017"
  },
  {
    id: "study-dailymed-acetylcysteine-inhalant-label",
    title: "DailyMed label: Acetylcysteine inhalant",
    year: 2024,
    source: "DailyMed / U.S. National Library of Medicine",
    studyType: "Regulatory safety warning",
    sourceTypeTaxonomy: "regulatory warning",
    sampleSize: "Prescription drug-label safety context; not a supplement trial.",
    population: "Patients receiving prescription acetylcysteine inhalant or oral antidote solution contexts.",
    intervention: "Acetylcysteine inhalant or oral acetaminophen-antidote solution",
    outcomes: ["Bronchospasm warning", "Adverse reactions", "Drug-mixing safety", "Pregnancy and nursing cautions"],
    adverseEvents:
      "Label lists nausea/vomiting and airway adverse effects, and warns that bronchospasm can occur unpredictably with inhaled acetylcysteine.",
    fundingConflicts: "Official DailyMed drug-label source.",
    riskOfBias:
      "Medical-label context is route and product specific; it should not be merged with oral supplement trial tolerability or treated as AU/TGA product status.",
    referenceId: "dailymed-acetylcysteine-inhalant-label"
  },
  {
    id: "study-fda-nac-enforcement-discretion-2022",
    title: "Guidance for Industry: Policy Regarding N-acetyl-L-cysteine",
    year: 2022,
    source: "U.S. Food and Drug Administration",
    studyType: "Regulatory safety warning",
    sourceTypeTaxonomy: "regulatory warning",
    sampleSize: "U.S. dietary-supplement enforcement-discretion guidance; not a clinical trial.",
    population: "U.S. dietary-supplement manufacturers, distributors, and NAC-containing supplement products.",
    intervention: "N-acetyl-L-cysteine products labeled as dietary supplements",
    outcomes: ["Dietary supplement policy", "Enforcement discretion", "Regulatory boundary", "Safety-review status"],
    adverseEvents:
      "FDA policy context says enforcement discretion applies only to products that would otherwise be lawfully marketed and not otherwise in FD&C Act violation.",
    fundingConflicts: "U.S. FDA guidance source.",
    riskOfBias:
      "U.S. regulatory policy source; not AU/TGA approval, not product-level safety, and not evidence of efficacy.",
    referenceId: "fda-nac-enforcement-discretion-2022"
  },
  {
    id: "study-meng-glucosamine-chondroitin-knee-oa-2023",
    title:
      "Efficacy and safety of the combination of glucosamine and chondroitin for knee osteoarthritis: a systematic review and meta-analysis",
    year: 2023,
    source: "Archives of Orthopaedic and Trauma Surgery via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "8 randomized controlled trials; 3,793 participants.",
    population: "Adults with knee osteoarthritis in combination glucosamine/chondroitin trials.",
    intervention: "Combination glucosamine plus chondroitin compared with placebo or other treatments",
    outcomes: ["WOMAC total score", "Pain", "Stiffness", "Joint-space narrowing", "Safety"],
    adverseEvents:
      "Safety analysis found no significant differences between comparison groups, but trial count and quality were limited.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Limited number of studies and uneven trial quality; does not prove tendon, skin, prevention, or broad joint-health claims.",
    referenceId: "meng-glucosamine-chondroitin-knee-oa-2023"
  },
  {
    id: "study-clegg-gait-glucosamine-chondroitin-2006",
    title: "Glucosamine, chondroitin sulfate, and the two in combination for painful knee osteoarthritis",
    year: 2006,
    source: "New England Journal of Medicine via PubMed",
    studyType: "Randomized controlled trial",
    sourceTypeTaxonomy: "RCT",
    sampleSize: "1,583 randomized participants.",
    population: "Adults with symptomatic knee osteoarthritis, stratified by baseline pain severity.",
    intervention:
      "Glucosamine, chondroitin sulfate, combination therapy, celecoxib, or placebo for 24 weeks",
    outcomes: ["Knee pain response", "Moderate-to-severe pain subgroup", "Adverse events"],
    adverseEvents:
      "Adverse events were mild, infrequent, and evenly distributed among groups in the trial.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Overall neutral primary result with exploratory subgroup signal; subgroup should not be treated as proof for all knee OA users.",
    referenceId: "clegg-gait-glucosamine-chondroitin-2006"
  },
  {
    id: "study-hochberg-moves-glucosamine-chondroitin-2016",
    title:
      "Combined chondroitin sulfate and glucosamine for painful knee osteoarthritis: a multicentre, randomised, double-blind, non-inferiority trial versus celecoxib",
    year: 2016,
    source: "Annals of the Rheumatic Diseases via PubMed",
    studyType: "Randomized controlled trial",
    sourceTypeTaxonomy: "RCT",
    sampleSize: "606 randomized participants.",
    population: "Adults with Kellgren-Lawrence grade 2-3 knee osteoarthritis and moderate-to-severe pain.",
    intervention: "Chondroitin sulfate plus glucosamine hydrochloride compared with celecoxib for 6 months",
    outcomes: ["WOMAC pain", "Function", "Stiffness", "Joint swelling/effusion", "Responder criteria", "Adverse events"],
    adverseEvents:
      "Adverse events were low and similarly distributed between groups.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Active-comparator non-inferiority trial in selected painful knee OA; not a placebo proof, prevention claim, or tendon/skin endpoint.",
    referenceId: "hochberg-moves-glucosamine-chondroitin-2016"
  },
  {
    id: "study-wandel-glucosamine-chondroitin-oa-2010",
    title:
      "Effects of glucosamine, chondroitin, or placebo in patients with osteoarthritis of hip or knee: network meta-analysis",
    year: 2010,
    source: "BMJ via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "10 large randomized trials; 3,803 participants.",
    population: "People with hip or knee osteoarthritis in large randomized trials.",
    intervention: "Glucosamine, chondroitin, or combination therapy compared with placebo or head-to-head comparators",
    outcomes: ["Pain intensity", "Minimal joint-space width", "Funding-related effect differences"],
    adverseEvents:
      "This source primarily evaluates pain and radiographic progression; use safety packet for adverse-event context.",
    fundingConflicts:
      "Network meta-analysis reported smaller effects in industry-independent trials than commercially funded trials.",
    riskOfBias:
      "Found effects below prespecified minimal clinical importance and no clear joint-space benefit; useful counterweight against strong symptom or structural claims.",
    referenceId: "wandel-glucosamine-chondroitin-oa-2010"
  },
  {
    id: "study-honvo-sysadoa-safety-2019",
    title:
      "Safety of Symptomatic Slow-Acting Drugs for Osteoarthritis: Outcomes of a Systematic Review and Meta-Analysis",
    year: 2019,
    source: "Drugs & Aging via PubMed Central",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize:
      "25 studies in qualitative synthesis, with 13 studies included in main safety meta-analyses and parallel analyses for studies allowing concomitant OA medicines.",
    population: "Patients with osteoarthritis in randomized, double-blind, placebo-controlled SYSADOA trials.",
    intervention: "Glucosamine sulfate, chondroitin sulfate, and other symptomatic slow-acting drugs for osteoarthritis",
    outcomes: ["Serious adverse events", "Severe adverse events", "Gastrointestinal events", "Cardiac events", "Skin events", "Renal and urinary events"],
    adverseEvents:
      "Glucosamine sulfate and chondroitin sulfate were not associated with increased odds of analyzed adverse-event categories versus placebo in this safety synthesis.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Trial safety synthesis does not resolve product quality, anticoagulant interaction, shellfish source, pregnancy, diabetes, or Australian product-level questions.",
    referenceId: "honvo-sysadoa-safety-2019"
  },
  {
    id: "study-nccih-glucosamine-chondroitin-oa",
    title: "Glucosamine and Chondroitin for Osteoarthritis: What You Need To Know",
    year: 2023,
    source: "NIH National Center for Complementary and Integrative Health",
    studyType: "Regulatory safety warning",
    sourceTypeTaxonomy: "guideline",
    sampleSize: "Government consumer health information; not a clinical trial.",
    population: "People considering glucosamine and chondroitin supplements for osteoarthritis.",
    intervention: "Glucosamine and chondroitin dietary supplements",
    outcomes: ["Safety overview", "Blood glucose caution", "Warfarin bleeding risk", "Pregnancy and breastfeeding uncertainty", "Guideline disagreement"],
    adverseEvents:
      "NCCIH states no major safety problems were identified in large OA studies, while flagging possible blood glucose increases, warfarin bleeding risk, and limited pregnancy/breastfeeding safety information.",
    fundingConflicts: "U.S. NIH/NCCIH consumer health source.",
    riskOfBias:
      "Consumer health summary; useful for safety caveats but not product-specific safety, efficacy, or AU/TGA status.",
    referenceId: "nccih-glucosamine-chondroitin-oa"
  },
  {
    id: "study-knudsen-glucosamine-warfarin-2008",
    title:
      "Potential glucosamine-warfarin interaction resulting in increased international normalized ratio: case report and review of the literature and MedWatch database",
    year: 2008,
    source: "Pharmacotherapy via PubMed",
    studyType: "Case report",
    sourceTypeTaxonomy: "case report",
    sampleSize: "Case report plus literature and MedWatch database review.",
    population: "Warfarin-treated patient/reporting contexts exposed to glucosamine or glucosamine/chondroitin.",
    intervention: "Glucosamine or glucosamine/chondroitin use with warfarin",
    outcomes: ["Increased INR", "Potential bleeding risk", "Warfarin interaction signal"],
    adverseEvents:
      "Case/reporting evidence suggests a potential warfarin interaction with increased INR; this is a high-salience safety screen despite limited causal certainty.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Case/reporting evidence cannot quantify population risk but is enough to preserve anticoagulant caution.",
    referenceId: "knudsen-glucosamine-warfarin-2008"
  },
  {
    id: "study-tga-natures-own-glucosamine-recall-2026",
    title: "Nature's Own Glucosamine Sulfate with Chondroitin recall",
    year: 2026,
    source: "Therapeutic Goods Administration",
    studyType: "Regulatory safety warning",
    sourceTypeTaxonomy: "regulatory warning",
    sampleSize: "One Australian product batch recall; not an ingredient-class clinical study.",
    population: "Consumers exposed to affected Australian product batches supplied from 7 May 2026.",
    intervention: "Nature's Own Glucosamine Sulfate with Chondroitin affected batch",
    outcomes: ["Product recall", "Potential glass fragment", "Cut/swallowing hazard", "Batch-specific quality issue"],
    adverseEvents:
      "TGA recall cites potential glass fragments within the bottle and risk of cuts or harm if accidentally swallowed.",
    fundingConflicts: "Australian Therapeutic Goods Administration recall notice.",
    riskOfBias:
      "Product-quality recall for one affected batch only; do not generalize to all glucosamine/chondroitin products or infer product-level status for other products.",
    referenceId: "tga-natures-own-glucosamine-recall-2026"
  },
  {
    id: "study-rubeor-iron-deficient-nonanemic-athletes-2018",
    title: "Does Iron Supplementation Improve Performance in Iron-Deficient Nonanemic Athletes?",
    year: 2018,
    source: "Sports Health via PubMed Central",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "systematic review",
    sampleSize: "12 studies; 283 participants.",
    population: "Iron-deficient nonanemic athletes in performance studies.",
    intervention: "Iron supplementation compared with placebo/control or pre/post contexts",
    outcomes: ["Athletic performance", "Ferritin cutoff", "Oral supplementation response"],
    adverseEvents:
      "Safety outcomes are not the main focus; use the iron safety packet for adverse-event and excess-iron context.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Equivocal evidence with small studies; strongest signal appears in athletes with ferritin at or below about 20 micrograms/L.",
    referenceId: "rubeor-iron-deficient-nonanemic-athletes-2018"
  },
  {
    id: "study-pengelly-iron-female-athletes-performance-2025",
    title: "Iron deficiency, supplementation, and sports performance in female athletes: A systematic review",
    year: 2025,
    source: "Journal of Sport and Health Science via PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "systematic review",
    sampleSize: "23 studies; 669 athletes.",
    population: "High-level iron-deficient female athletes across 16 sports.",
    intervention: "Iron supplementation or iron-deficiency exposure compared across performance studies",
    outcomes: ["Endurance performance", "Maximal aerobic capacity", "Strength", "Anaerobic power"],
    adverseEvents:
      "Safety extraction is not the main focus; iron deficiency and supplementation should be interpreted with clinical monitoring.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Female-athlete-focused review with many small groups; not evidence for iron-replete users or every sport.",
    referenceId: "pengelly-iron-female-athletes-performance-2025"
  },
  {
    id: "study-smid-oral-iron-athletes-meta-2024",
    title:
      "Effects of Oral Iron Supplementation on Blood Iron Status in Athletes: A Systematic Review, Meta-Analysis and Meta-Regression of Randomized Controlled Trials",
    year: 2024,
    source: "Sports Medicine via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "13 randomized studies; 449 participants.",
    population: "Healthy adult physically active participants and athletes in oral iron trials.",
    intervention: "Oral iron supplementation compared with control",
    outcomes: ["Serum ferritin", "Hemoglobin", "Transferrin saturation", "VO2 trend"],
    adverseEvents:
      "Safety outcomes require the separate iron safety packet; this source primarily evaluates blood iron parameters and performance signals.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Moderate-to-low certainty; ferritin response was strongest when baseline ferritin was very low, while VO2 evidence was a small uncertain trend.",
    referenceId: "smid-oral-iron-athletes-meta-2024"
  },
  {
    id: "study-brutsaert-iron-fatigue-resistance-2003",
    title:
      "Iron supplementation improves progressive fatigue resistance during dynamic knee extensor exercise in iron-depleted, nonanemic women",
    year: 2003,
    source: "American Journal of Clinical Nutrition via PubMed",
    studyType: "Randomized controlled trial",
    sourceTypeTaxonomy: "RCT",
    sampleSize: "20 iron-depleted nonanemic women.",
    population: "Young women with low ferritin and nonanemic hemoglobin values.",
    intervention: "Iron supplementation compared with placebo for 6 weeks",
    outcomes: ["Dynamic knee-extensor fatigue resistance", "Serum iron", "Transferrin saturation", "Maximal voluntary contraction"],
    adverseEvents:
      "Adverse events are not the main focus; low power limits inference beyond the fatigue-resistance endpoint.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Small trial; useful for fatigue-resistance signal but not enough for broad endurance or iron-replete performance claims.",
    referenceId: "brutsaert-iron-fatigue-resistance-2003"
  },
  {
    id: "study-vaucher-iron-fatigue-low-ferritin-2012",
    title: "Effect of iron supplementation on fatigue in nonanemic menstruating women with low ferritin: a randomized controlled trial",
    year: 2012,
    source: "CMAJ via PubMed Central",
    studyType: "Randomized controlled trial",
    sourceTypeTaxonomy: "RCT",
    sampleSize: "198 nonanemic women with fatigue and low ferritin.",
    population: "Menstruating women aged 18 to 53 years with unexplained fatigue and low ferritin but nonanemic hemoglobin.",
    intervention: "Oral iron compared with placebo for 12 weeks",
    outcomes: ["Fatigue", "Quality of life", "Hemoglobin", "Ferritin", "Soluble transferrin receptor"],
    adverseEvents:
      "Safety outcomes are not the main focus; source supports fatigue/biomarker context rather than general safety.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Fatigue endpoint in nonanemic low-ferritin women; not direct VO2 max evidence or a claim for iron-replete users.",
    referenceId: "vaucher-iron-fatigue-low-ferritin-2012"
  },
  {
    id: "study-ods-iron-safety",
    title: "Iron - Health Professional Fact Sheet",
    year: 2025,
    source: "NIH Office of Dietary Supplements",
    studyType: "Regulatory safety warning",
    sourceTypeTaxonomy: "guideline",
    sampleSize: "Government health-professional fact sheet; not a clinical trial.",
    population: "People consuming dietary or supplemental iron, including higher-risk groups.",
    intervention: "Dietary iron and iron-containing supplements",
    outcomes: ["Upper intake levels", "Gastrointestinal effects", "Acute overdose", "Child poisoning", "Hemochromatosis", "Medication interactions"],
    adverseEvents:
      "ODS flags GI effects, severe overdose risk, child poisoning warnings, hemochromatosis risk, and interactions including levodopa, levothyroxine, and proton pump inhibitors.",
    fundingConflicts: "U.S. NIH Office of Dietary Supplements health-professional source.",
    riskOfBias:
      "Reference safety synthesis; does not establish product-level safety, deficiency diagnosis, or AU/TGA status.",
    referenceId: "ods-iron"
  },
  {
    id: "study-tolkien-ferrous-sulfate-gi-2015",
    title:
      "Ferrous sulfate supplementation causes significant gastrointestinal side-effects in adults: a systematic review and meta-analysis",
    year: 2015,
    source: "PLOS ONE via PubMed Central",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "43 randomized trials; 6,831 adult participants.",
    population: "Adults in ferrous sulfate trials with placebo or IV iron comparators.",
    intervention: "Ferrous sulfate compared with placebo or intravenous iron",
    outcomes: ["Gastrointestinal side effects", "Comparator side-effect odds", "Pregnancy subgroup"],
    adverseEvents:
      "Ferrous sulfate significantly increased gastrointestinal side-effect odds versus placebo and versus IV iron in this meta-analysis.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Ferrous sulfate-specific GI tolerability source; does not cover every oral iron formulation, overdose, interactions, or iron-overload risk.",
    referenceId: "tolkien-ferrous-sulfate-gi-2015"
  },
  {
    id: "study-low-daily-iron-menstruating-women-2016",
    title: "Daily iron supplementation for improving anaemia, iron status and health in menstruating women",
    year: 2016,
    source: "Cochrane Database of Systematic Reviews via PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "systematic review",
    sampleSize: "67 trials; 8,506 women recruited.",
    population: "Menstruating women or women aged 12 to 50 years in daily oral iron trials.",
    intervention: "Daily oral iron supplementation compared with control/placebo",
    outcomes: ["Anemia", "Hemoglobin", "Iron deficiency", "Exercise performance", "Fatigue", "Gastrointestinal side effects"],
    adverseEvents:
      "Cochrane found increased gastrointestinal side effects, loose stools/diarrhea, hard stools/constipation, and possible abdominal pain signals with iron supplementation.",
    fundingConflicts: "Cochrane review; check source record for detailed funding and conflict declarations.",
    riskOfBias:
      "Population-specific review; benefits and adverse effects do not justify untested supplementation in iron-replete or higher-risk users.",
    referenceId: "low-daily-iron-menstruating-women-2016"
  },
  {
    id: "study-obeid-b12-deficiency-consensus-2024",
    title: "Diagnosis, Treatment and Long-Term Management of Vitamin B12 Deficiency in Adults: A Delphi Expert Consensus",
    year: 2024,
    source: "Journal of Clinical Medicine via PubMed Central",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "guideline",
    sampleSize: "Scoping review plus two-round Delphi survey with 42 experts.",
    population: "Adults with suspected or confirmed vitamin B12 deficiency.",
    intervention: "Vitamin B12 deficiency diagnosis, treatment, and long-term management",
    outcomes: ["Clinical symptoms", "Serum B12", "Methylmalonic acid", "Homocysteine", "Neurologic manifestations", "Treatment route"],
    adverseEvents:
      "Consensus focuses on diagnosis and management; use the safety packet for supplementation adverse-event and masking context.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Expert consensus and deficiency-management context; not evidence that B12 improves cognition in replete adults.",
    referenceId: "obeid-b12-deficiency-consensus-2024"
  },
  {
    id: "study-berg-b-vitamins-global-cognition-2025",
    title: "Efficacy of B Vitamin Supplementation on Global Cognitive Function in Older Adults: A Systematic Review and Meta-analysis",
    year: 2025,
    source: "Nutrition Reviews via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "17 randomized controlled trials; 5,275 participants.",
    population: "Older adults aged 60 years or older in B-vitamin supplementation trials.",
    intervention: "Vitamin B6, B9, or B12 supplementation compared with placebo or usual dementia care",
    outcomes: ["Global cognitive function", "Cognitive impairment subgroup", "Heterogeneity", "GRADE certainty"],
    adverseEvents:
      "Adverse-event detail is not the focus; use safety packet for B12/folate interaction and high-risk context.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Very small pooled benefit after outlier handling; B-vitamin combination evidence should not be treated as B12-alone nootropic proof.",
    referenceId: "berg-b-vitamins-global-cognition-2025"
  },
  {
    id: "study-wang-b-vitamins-cognitive-decline-2022",
    title: "B vitamins and prevention of cognitive decline and incident dementia: a systematic review and meta-analysis",
    year: 2022,
    source: "Nutrition Reviews via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "95 studies; 46,175 participants, including 25 randomized controlled trials.",
    population: "People in B-vitamin randomized trials, cohort studies, and cross-sectional studies related to cognitive decline and dementia.",
    intervention: "B vitamin supplementation or dietary B-vitamin exposure",
    outcomes: ["Cognitive decline", "Incident dementia", "Homocysteine", "Folate", "Vitamin B12"],
    adverseEvents:
      "Safety outcomes require separate extraction; this source primarily evaluates cognition and dementia-risk associations.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Mixed study designs and B-vitamin combination context limit B12-specific inference; folate and homocysteine signals are not B12-alone proof.",
    referenceId: "wang-b-vitamins-cognitive-decline-2022"
  },
  {
    id: "study-behrens-vitamin-b-cognitive-decline-2020",
    title: "Vitamin B-Can it prevent cognitive decline? A systematic review and meta-analysis",
    year: 2020,
    source: "Systematic Reviews via PubMed Central",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "Oral B-vitamin supplementation trials in cognitively unimpaired adults; see source for trial count and subgroup details.",
    population: "Cognitively unimpaired individuals in B-vitamin supplementation trials.",
    intervention: "Oral B-vitamin supplementation compared with placebo/control",
    outcomes: ["Global cognition", "Cognitive decline prevention", "Cognitive-domain outcomes"],
    adverseEvents:
      "Safety outcomes require separate extraction; this source primarily evaluates cognitive-prevention claims.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Neutral overall prevention result; useful counterweight against broad cognitive-prevention claims.",
    referenceId: "behrens-vitamin-b-cognitive-decline-2020"
  },
  {
    id: "study-ods-vitamin-b12-safety",
    title: "Vitamin B12 - Health Professional Fact Sheet",
    year: 2024,
    source: "NIH Office of Dietary Supplements",
    studyType: "Regulatory safety warning",
    sourceTypeTaxonomy: "guideline",
    sampleSize: "Government health-professional fact sheet; not a clinical trial.",
    population: "General population and groups at risk of vitamin B12 inadequacy.",
    intervention: "Dietary and supplemental vitamin B12",
    outcomes: ["Deficiency risk", "Medication interactions", "Excess intake safety", "Groups at risk", "Absorption context"],
    adverseEvents:
      "ODS notes low toxicity/no established upper intake level, while flagging medication and absorption contexts that can affect B12 status.",
    fundingConflicts: "U.S. NIH Office of Dietary Supplements health-professional source.",
    riskOfBias:
      "Reference safety synthesis; does not establish product-level safety, clinical need, or AU/TGA status.",
    referenceId: "ods-vitamin-b12"
  },
  {
    id: "study-abdelwahab-b12-routes-2024",
    title:
      "Efficacy of different routes of vitamin B12 supplementation for the treatment of patients with vitamin B12 deficiency: A systematic review and network meta-analysis",
    year: 2024,
    source: "Irish Journal of Medical Science via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "13 comparative studies; 4,275 patients.",
    population: "Patients with vitamin B12 deficiency in route-comparison studies.",
    intervention: "Oral, intramuscular, or sublingual vitamin B12 supplementation",
    outcomes: ["Vitamin B12 level", "Hemoglobin", "CBC parameters", "Homocysteine"],
    adverseEvents:
      "Safety detail is secondary; source mainly supports route-specific deficiency-management context rather than product-level safety.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Deficiency-treatment route comparison; not evidence that every route or product is appropriate for severe neurologic symptoms or every malabsorption cause.",
    referenceId: "abdelwahab-b12-routes-2024"
  },
  {
    id: "study-de-regil-folate-birth-defects-2015",
    title: "Effects and safety of periconceptional oral folate supplementation for preventing birth defects",
    year: 2015,
    source: "Cochrane Database of Systematic Reviews via PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "systematic review",
    sampleSize: "5 trials; 7,391 women.",
    population:
      "Women in periconceptional folate supplementation trials, including participants with and without prior neural tube defect-affected pregnancy history.",
    intervention: "Periconceptional folic acid or folate-containing supplementation compared with no intervention/placebo or supplements without folic acid",
    outcomes: ["Neural tube defects", "Birth defects", "Miscarriage", "Maternal and infant safety outcomes"],
    adverseEvents:
      "Review found folic acid prevented neural tube defects and did not find clear evidence of negative effects on assessed maternal or infant outcomes.",
    fundingConflicts: "Cochrane review; check source record for detailed funding and conflict declarations.",
    riskOfBias:
      "Periconceptional birth-defect prevention context only; not evidence for fertility enhancement, hormone optimization, or high-dose safety in all users.",
    referenceId: "de-regil-folate-birth-defects-2015"
  },
  {
    id: "study-uspstf-folic-acid-ntd-2023",
    title:
      "Folic Acid Supplementation to Prevent Neural Tube Defects: US Preventive Services Task Force Reaffirmation Recommendation Statement",
    year: 2023,
    source: "JAMA via PubMed",
    studyType: "Regulatory safety warning",
    sourceTypeTaxonomy: "guideline",
    sampleSize: "USPSTF recommendation statement for people planning to or who could become pregnant.",
    population: "People planning to or who could become pregnant.",
    intervention: "Folic acid supplementation for neural tube defect prevention",
    outcomes: ["Neural tube defect prevention", "Net benefit", "Preventive recommendation"],
    adverseEvents:
      "Recommendation statement concludes substantial net benefit; use the evidence report and ODS safety packet for harms and interaction detail.",
    fundingConflicts: "U.S. Preventive Services Task Force recommendation statement.",
    riskOfBias:
      "U.S. preventive-service guidance; not AU/TGA product approval, fertility treatment, or individualized prenatal advice.",
    referenceId: "uspstf-folic-acid-ntd-2023"
  },
  {
    id: "study-viswanathan-folic-acid-evidence-review-2023",
    title:
      "Folic Acid Supplementation to Prevent Neural Tube Defects: Updated Evidence Report and Systematic Review for the US Preventive Services Task Force",
    year: 2023,
    source: "JAMA via PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "systematic review",
    sampleSize: "12 observational studies in the update; 1,244,072 participants.",
    population: "Pregnancy-related folic acid exposure and neural tube defect prevention evidence in very highly developed countries.",
    intervention: "Folic acid supplementation before or during pregnancy",
    outcomes: ["Neural tube defects", "Multiple gestation", "Autism spectrum disorder", "Maternal cancer"],
    adverseEvents:
      "Updated review reported no statistically significant harms for multiple gestation, autism, or maternal cancer in eligible studies.",
    fundingConflicts: "USPSTF evidence report; check source record for detailed disclosures.",
    riskOfBias:
      "Limited update and observational evidence for harms; does not address every high-dose, methylfolate, medication, or product-quality context.",
    referenceId: "viswanathan-folic-acid-evidence-review-2023"
  },
  {
    id: "study-ods-folate-safety",
    title: "Folate - Health Professional Fact Sheet",
    year: 2024,
    source: "NIH Office of Dietary Supplements",
    studyType: "Regulatory safety warning",
    sourceTypeTaxonomy: "guideline",
    sampleSize: "Government health-professional fact sheet; not a clinical trial.",
    population: "General folate consumers and higher-risk groups using supplements, fortified foods, or folate-related medicines.",
    intervention: "Food folates, folic acid supplements/fortified foods, and 5-MTHF supplement context",
    outcomes: ["Folate status", "Unmetabolized folic acid", "Upper limits", "Vitamin B12 masking", "Medication interactions"],
    adverseEvents:
      "ODS preserves upper-limit context for synthetic folate and flags B12 masking and interactions with methotrexate, antiepileptic medicines, and sulfasalazine.",
    fundingConflicts: "U.S. NIH Office of Dietary Supplements health-professional source.",
    riskOfBias:
      "Reference safety synthesis; not product-specific safety, high-dose protocol approval, or AU/TGA status.",
    referenceId: "ods-folate"
  },
  {
    id: "study-benjamim-beetroot-bp-2022",
    title:
      "Nitrate Derived From Beetroot Juice Lowers Blood Pressure in Patients With Arterial Hypertension: A Systematic Review and Meta-Analysis",
    year: 2022,
    source: "Frontiers in Nutrition via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "7 randomized trials; 218 adults with arterial hypertension.",
    population: "Adults with arterial hypertension in randomized beetroot-juice trials.",
    intervention: "Nitrate-rich beetroot juice",
    outcomes: ["Systolic blood pressure", "Diastolic blood pressure", "Hypertension context"],
    adverseEvents:
      "Adverse-event extraction is not the focus of this meta-analysis packet; medication and hypotension contexts still need clinician review.",
    fundingConflicts:
      "Authors declared no commercial or financial relationships that could be construed as a potential conflict.",
    riskOfBias:
      "Systematic review and meta-analysis with GRADE-rated moderate certainty for systolic blood pressure; short duration and limited sample size constrain certainty.",
    referenceId: "benjamim-beetroot-bp-2022"
  },
  {
    id: "study-mcmahon-nitrate-endurance-2017",
    title:
      "The Effect of Dietary Nitrate Supplementation on Endurance Exercise Performance in Healthy Adults: A Systematic Review and Meta-Analysis",
    year: 2017,
    source: "Sports Medicine via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "Systematic review and meta-analysis of healthy-adult endurance exercise trials.",
    population: "Healthy adults in endurance exercise performance studies.",
    intervention: "Dietary nitrate supplementation, commonly beetroot juice or nitrate-rich products",
    outcomes: ["Endurance exercise capacity", "Exercise performance", "Cardiorespiratory measures"],
    adverseEvents:
      "Adverse-event detail is not the focus of this performance meta-analysis; use product and safety packets for tolerability and quality context.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Performance effects are context-dependent; event, training status, protocol, and responder variation limit broad claims.",
    referenceId: "mcmahon-nitrate-endurance-2017"
  },
  {
    id: "study-ais-dietary-nitrate-beetroot",
    title: "Dietary Nitrate / Beetroot Juice",
    year: 2026,
    source: "Australian Institute of Sport",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "guideline",
    sampleSize: "AIS sports supplement framework fact sheet; not a single clinical trial.",
    population: "Athletes and sports nutrition practitioners considering dietary nitrate products.",
    intervention: "Dietary nitrate and beetroot juice products",
    outcomes: ["Sports performance context", "Product nitrate content", "Practical concerns", "Safety considerations"],
    adverseEvents:
      "AIS notes concentrated beetroot products may cause mild gastrointestinal discomfort and temporary pink urine or stool; chronic nitrate supplement use is less studied.",
    fundingConflicts: "Australian Sports Commission / Australian Institute of Sport source.",
    riskOfBias:
      "Sports-practice guidance and evidence summary; not medical advice, product certification, or AU/TGA product authorization.",
    referenceId: "ais-dietary-nitrate-beetroot"
  },
  {
    id: "study-issn-sodium-bicarbonate-2021",
    title:
      "International Society of Sports Nutrition position stand: sodium bicarbonate and exercise performance",
    year: 2021,
    source: "Journal of the International Society of Sports Nutrition via PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "position stand",
    sampleSize: "ISSN position stand based on comprehensive review of sodium bicarbonate exercise-performance literature.",
    population: "Athletes and active people in sodium bicarbonate sport-performance studies.",
    intervention: "Sodium bicarbonate supplementation",
    outcomes: ["High-intensity exercise performance", "Muscular endurance", "Repeated-bout exercise", "Adverse effects"],
    adverseEvents:
      "Position stand notes higher amounts can increase adverse side-effect incidence and severity; individual tolerability remains important.",
    fundingConflicts: "Check source record for author disclosures.",
    riskOfBias:
      "Position stand and evidence synthesis; event-specific transfer, individual response, and safety context remain important.",
    referenceId: "issn-sodium-bicarbonate-2021"
  },
  {
    id: "study-ais-sodium-bicarbonate",
    title: "Sodium Bicarbonate",
    year: 2026,
    source: "Australian Institute of Sport",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "guideline",
    sampleSize: "AIS sports supplement framework fact sheet; not a single clinical trial.",
    population: "Athletes and sports nutrition practitioners considering sodium bicarbonate use.",
    intervention: "Sodium bicarbonate products and loading strategies",
    outcomes: ["High-intensity exercise performance", "Gastrointestinal distress", "Competition logistics", "Product form"],
    adverseEvents:
      "AIS highlights gastrointestinal distress including nausea, stomach pain, diarrhoea, and vomiting, plus competition-practical issues.",
    fundingConflicts: "Australian Sports Commission / Australian Institute of Sport source.",
    riskOfBias:
      "Sports-practice guidance and evidence summary; not individualized medical advice, product certification, or AU/TGA product authorization.",
    referenceId: "ais-sodium-bicarbonate"
  },
  {
    id: "study-ods-exercise-performance-sodium-bicarbonate",
    title: "Dietary Supplements for Exercise and Athletic Performance - Health Professional Fact Sheet",
    year: 2024,
    source: "NIH Office of Dietary Supplements",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "guideline",
    sampleSize: "Government health-professional fact sheet; not a single clinical trial.",
    population: "General supplement users, athletes, and health professionals reviewing exercise-performance supplement evidence.",
    intervention: "Sodium bicarbonate as an ergogenic aid",
    outcomes: ["Short-term high-intensity performance", "Gastrointestinal distress", "Sodium exposure", "Long-term safety limits"],
    adverseEvents:
      "ODS flags gastrointestinal distress, substantial sodium exposure in gram-quantity protocols, fluid/weight considerations, and lack of long-term safety evaluation.",
    fundingConflicts: "U.S. NIH Office of Dietary Supplements health-professional source.",
    riskOfBias:
      "Reference safety synthesis; not product-specific safety, sport certification, chronic-use approval, or AU/TGA status.",
    referenceId: "ods-exercise-performance-sodium-bicarbonate"
  },
  {
    id: "study-hemila-vitamin-c-common-cold-2013",
    title: "Vitamin C for preventing and treating the common cold",
    year: 2013,
    source: "Cochrane Database of Systematic Reviews via PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "systematic review",
    sampleSize: "Cochrane review of placebo-controlled common-cold prevention and treatment trials.",
    population: "General population and severe-exercise/cold-exposure subgroups in common-cold trials.",
    intervention: "Oral vitamin C supplementation",
    outcomes: ["Common cold incidence", "Cold duration", "Cold severity", "Therapeutic use after symptom onset"],
    adverseEvents:
      "Adverse-event extraction is not the focus of this common-cold packet; use the ODS safety packet for high-dose and interaction context.",
    fundingConflicts: "Cochrane review; check source record for detailed disclosures.",
    riskOfBias:
      "Systematic review reports no general-population incidence prevention, modest duration signal, and subgroup/context limitations.",
    referenceId: "hemila-vitamin-c-common-cold-2013"
  },
  {
    id: "study-hemila-vitamin-c-cold-severity-2023",
    title: "Vitamin C reduces the severity of common colds: a meta-analysis",
    year: 2023,
    source: "BMC Public Health via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "Meta-analysis of randomized common-cold symptom-severity trials.",
    population: "Participants in randomized vitamin C common-cold symptom trials.",
    intervention: "Vitamin C supplementation",
    outcomes: ["Common cold severity", "Severe symptoms", "Mild symptoms"],
    adverseEvents:
      "Adverse-event extraction is not the focus of this severity packet; use the ODS safety packet for high-dose and interaction context.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Symptom severity meta-analysis; does not establish broad prevention, serious-infection treatment, or product-specific efficacy.",
    referenceId: "hemila-vitamin-c-cold-severity-2023"
  },
  {
    id: "study-ods-vitamin-c-safety",
    title: "Vitamin C - Health Professional Fact Sheet",
    year: 2025,
    source: "NIH Office of Dietary Supplements",
    studyType: "Regulatory safety warning",
    sourceTypeTaxonomy: "guideline",
    sampleSize: "Government health-professional fact sheet; not a clinical trial.",
    population: "General vitamin C consumers and higher-risk supplement or medication contexts.",
    intervention: "Food vitamin C and oral vitamin C supplements",
    outcomes: ["Deficiency", "Common cold context", "High-dose adverse effects", "Kidney-stone risk", "Iron absorption", "Medication interactions"],
    adverseEvents:
      "ODS flags gastrointestinal symptoms at high intakes, kidney-stone/oxalate uncertainty, iron-overload concerns, and interactions with cancer therapy and statin/niacin therapy.",
    fundingConflicts: "U.S. NIH Office of Dietary Supplements health-professional source.",
    riskOfBias:
      "Reference safety synthesis; not product-specific safety, high-dose protocol approval, IV vitamin C guidance, or AU/TGA status.",
    referenceId: "ods-vitamin-c"
  },
  {
    id: "study-resveratrol-t2d-meta-2021",
    title: "Resveratrol supplementation and type 2 diabetes: a systematic review and meta-analysis",
    year: 2022,
    source: "Critical Reviews in Food Science and Nutrition via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "Systematic review and meta-analysis of resveratrol supplementation trials in type 2 diabetes contexts.",
    population: "Adults with type 2 diabetes or metabolic-risk trial contexts.",
    intervention: "Oral resveratrol supplementation",
    outcomes: ["Fasting glucose", "Insulin resistance", "HbA1c", "Metabolic biomarkers"],
    adverseEvents:
      "Adverse-event extraction is not the focus of this metabolic packet; use safety and interaction packets for product-quality, liver, and medication context.",
    fundingConflicts: "Check source record for author disclosures.",
    riskOfBias:
      "Heterogeneous supplement trials; does not establish diabetes treatment, prevention, product equivalence, or AU/TGA status.",
    referenceId: "resveratrol-t2d-meta-2021"
  },
  {
    id: "study-semba-resveratrol-mortality-2014",
    title: "Resveratrol levels and all-cause mortality in older community-dwelling adults",
    year: 2014,
    source: "JAMA Internal Medicine via PubMed",
    studyType: "Observational cohort",
    sourceTypeTaxonomy: "observational study",
    sampleSize: "Community-dwelling older-adult cohort with urinary resveratrol metabolite exposure and long-term follow-up.",
    population: "Older community-dwelling adults.",
    intervention: "Dietary resveratrol exposure estimated from urinary metabolites",
    outcomes: ["All-cause mortality", "Inflammatory markers", "Cardiovascular disease", "Cancer"],
    adverseEvents:
      "Not a supplement safety trial; use safety and interaction packets for supplement adverse-event context.",
    fundingConflicts: "NIH and non-U.S. government support listed in PubMed metadata; check source record for details.",
    riskOfBias:
      "Observational exposure-marker study; useful for caution against broad longevity claims but not proof about standardized supplement interventions.",
    referenceId: "semba-resveratrol-mortality-2014"
  },
  {
    id: "study-livertox-resveratrol",
    title: "Resveratrol",
    year: 2024,
    source: "LiverTox via NCBI Bookshelf",
    studyType: "Regulatory safety warning",
    sourceTypeTaxonomy: "guideline",
    sampleSize: "Reference safety monograph; not a clinical trial.",
    population: "General supplement users and trial participants in liver-safety surveillance context.",
    intervention: "Resveratrol supplements and extracts",
    outcomes: ["Liver injury", "Liver enzymes", "Gastrointestinal adverse effects", "Product purity", "Bioavailability"],
    adverseEvents:
      "LiverTox notes rare liver-enzyme elevations in some high-dose studies but no convincing reports of clinically apparent liver injury; gastrointestinal symptoms and product-quality uncertainty remain relevant.",
    fundingConflicts: "NCBI Bookshelf / LiverTox reference source.",
    riskOfBias:
      "Reference safety synthesis; not product-specific safety, high-dose approval, chronic-use clearance, or AU/TGA product authorization.",
    referenceId: "livertox-resveratrol"
  },
  {
    id: "study-resveratrol-drug-interactions-2012",
    title: "Drug interaction potential of resveratrol",
    year: 2012,
    source: "Drug Metabolism Reviews via PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "narrative review",
    sampleSize: "Drug-interaction review of resveratrol pharmacokinetic and pharmacodynamic interaction evidence.",
    population: "General supplement users and medication-context populations considered in interaction evidence.",
    intervention: "Resveratrol exposure in interaction-relevant contexts",
    outcomes: ["CYP interaction potential", "Pharmacokinetic interactions", "Pharmacodynamic interactions", "Medication safety context"],
    adverseEvents:
      "Interaction potential is most relevant for high-dose exposure, anticoagulants, estrogen-related contexts, diabetes medicines, and complex medication regimens.",
    fundingConflicts: "Check source record for author disclosures.",
    riskOfBias:
      "Review evidence and mechanistic interaction context; does not establish product-specific safety or individualized medication guidance.",
    referenceId: "resveratrol-drug-interactions-2012"
  },
  {
    id: "study-huang-quercetin-cardiometabolic-2020",
    title:
      "Effect of quercetin supplementation on plasma lipid profiles, blood pressure, and glucose levels: a systematic review and meta-analysis",
    year: 2020,
    source: "Nutrition Reviews via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "Meta-analysis of 17 randomized trials with 896 total participants.",
    population: "Adults in randomized quercetin or standardized quercetin-enriched extract trials.",
    intervention: "Oral quercetin supplementation or standardized quercetin-enriched extract",
    outcomes: ["Systolic blood pressure", "Diastolic blood pressure", "Lipids", "Glucose"],
    adverseEvents:
      "Adverse-event extraction is not the focus of this cardiometabolic packet; use safety packets for long-term high-dose, kidney, liver, interaction, and product-quality context.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Biomarker meta-analysis with conflicting trial context; blood-pressure signal does not establish treatment, cardiovascular-event reduction, or product-level efficacy.",
    referenceId: "huang-quercetin-cardiometabolic-2020"
  },
  {
    id: "study-serban-quercetin-bp-2016",
    title:
      "Effects of Quercetin on Blood Pressure: A Systematic Review and Meta-Analysis of Randomized Controlled Trials",
    year: 2016,
    source: "Journal of the American Heart Association via PubMed",
    studyType: "Meta-analysis",
    sourceTypeTaxonomy: "meta-analysis",
    sampleSize: "Meta-analysis of 7 randomized trials with 587 total participants.",
    population: "Adults in placebo-controlled randomized quercetin blood-pressure trials.",
    intervention: "Quercetin supplementation",
    outcomes: ["Systolic blood pressure", "Diastolic blood pressure", "Dose subgroup"],
    adverseEvents:
      "The LiverTox bibliography summarizes no serious adverse-event reports in this blood-pressure trial set; use safety packets for broader risk context.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Short-term biomarker trials; source calls for further studies on clinical relevance and add-on use rather than treatment claims.",
    referenceId: "serban-quercetin-bp-2016"
  },
  {
    id: "study-livertox-quercetin",
    title: "Quercetin",
    year: 2020,
    source: "LiverTox via NCBI Bookshelf",
    studyType: "Regulatory safety warning",
    sourceTypeTaxonomy: "guideline",
    sampleSize: "Reference safety monograph; not a clinical trial.",
    population: "General supplement users and trial participants in liver-safety surveillance context.",
    intervention: "Quercetin supplements and extracts",
    outcomes: ["Liver injury", "Liver enzymes", "Gastrointestinal adverse effects", "Product claims", "Hepatic safety gaps"],
    adverseEvents:
      "LiverTox describes quercetin as generally well tolerated, not linked to serum enzyme elevations or clinically apparent liver injury, while noting abdominal discomfort, nausea, and headache in some studies.",
    fundingConflicts: "NCBI Bookshelf / LiverTox reference source.",
    riskOfBias:
      "Reference safety synthesis; not product-specific safety, chronic-use clearance, interaction guidance, or AU/TGA product authorization.",
    referenceId: "livertox-quercetin"
  },
  {
    id: "study-andres-quercetin-safety-2018",
    title: "Safety Aspects of the Use of Quercetin as a Dietary Supplement",
    year: 2018,
    source: "Molecular Nutrition & Food Research via PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "narrative review",
    sampleSize: "Dietary-supplement safety review of isolated quercetin evidence.",
    population: "People using quercetin dietary supplements and risk groups discussed in human, animal, and interaction evidence.",
    intervention: "Isolated quercetin dietary supplements",
    outcomes: ["Adverse effects", "Long-term high-dose safety", "Kidney-risk context", "Estrogen-dependent cancer context", "Drug bioavailability interactions"],
    adverseEvents:
      "Review reports rarely noted mild human adverse effects, limited long-term high-dose safety data, possible predamaged-kidney and estrogen-dependent cancer concerns from animal evidence, and short-term drug-bioavailability interactions.",
    fundingConflicts: "Check source record for funding and conflict details.",
    riskOfBias:
      "Safety review combines human, animal, and interaction evidence; useful for risk screening but not product-specific safety or individualized medication guidance.",
    referenceId: "andres-quercetin-safety-2018"
  },
  {
    id: "study-yousefzadeh-fisetin-senotherapeutic-2018",
    title: "Fisetin is a senotherapeutic that extends health and lifespan",
    year: 2018,
    source: "EBioMedicine via PubMed",
    studyType: "Animal study",
    sourceTypeTaxonomy: "animal study",
    sampleSize:
      "Preclinical flavonoid screen with senescent murine and human fibroblasts, progeroid mice, aged wild-type mice, and human adipose tissue explants.",
    population: "Preclinical mouse models and human tissue explants, not clinical human participants.",
    intervention: "Fisetin exposure in senescence and aged-mouse models",
    outcomes: ["Senescence markers", "Tissue homeostasis", "Age-related pathology", "Healthspan", "Median and maximum lifespan"],
    adverseEvents:
      "Preclinical source; does not establish human adverse-event rates, pharmacokinetics, medication safety, or product-specific safety.",
    fundingConflicts: "NIH, foundation, and philanthropic support listed in the PubMed abstract.",
    riskOfBias:
      "Animal and tissue-explant evidence can generate hypotheses but does not establish human lifespan, disease-treatment, dosing, or product-level claims.",
    referenceId: "yousefzadeh-fisetin-senotherapeutic-2018"
  },
  {
    id: "study-fisetin-senotherapeutic-review-2024",
    title: "Fisetin as a senotherapeutic agent: Evidence and perspectives for age-related diseases",
    year: 2024,
    source: "Mechanisms of Ageing and Development via PubMed",
    studyType: "Systematic review",
    sourceTypeTaxonomy: "narrative review",
    sampleSize: "Review of in vitro, animal-model, and phase I/II trial evidence and perspectives.",
    population: "Preclinical models and early human trial populations discussed in senotherapeutic evidence.",
    intervention: "Fisetin as a senotherapeutic agent",
    outcomes: ["Senescent cells", "Chronic inflammation", "Age-related diseases", "Human trial challenges", "Safety and pharmacokinetics"],
    adverseEvents:
      "Review states further studies are needed to establish fisetin safety, pharmacokinetics, efficacy, outcome measures, dosing, and limitations.",
    fundingConflicts: "NIH and non-U.S. government support listed in PubMed metadata; check source record for author disclosures.",
    riskOfBias:
      "Perspective review over heterogeneous preclinical and early trial evidence; useful for watchlist framing, not proof of human efficacy.",
    referenceId: "fisetin-senotherapeutic-review-2024"
  },
  {
    id: "study-ctgov-fisetin-vascular-aging-nct06133634",
    title: "Fisetin to Improve Vascular Function in Older Adults",
    year: 2026,
    source: "ClinicalTrials.gov",
    studyType: "Clinical trial record",
    sourceTypeTaxonomy: "RCT",
    sampleSize: "Planned enrollment 70; phase I/II pilot trial.",
    population: "Older adults with aging, endothelial dysfunction, and arterial stiffness context.",
    intervention: "Intermittent fisetin or placebo in a registered trial protocol",
    outcomes: ["Vascular endothelial function", "Aortic stiffness", "Senescence biomarkers", "Safety", "Tolerability", "Adherence"],
    adverseEvents:
      "Trial record includes safety, tolerability, and adherence aims; posted record does not establish final safety or efficacy outcomes.",
    fundingConflicts: "Sponsor: University of Colorado, Boulder.",
    riskOfBias:
      "Active-not-recruiting registered trial record; review lead only until results are published and extracted.",
    referenceId: "ctgov-fisetin-vascular-aging-nct06133634"
  },
  {
    id: "study-ctgov-fisetin-safety-pk-nct06431932",
    title: "Pilot Trial of Fisetin in Healthy Volunteers and Older Patients With Multimorbidity",
    year: 2026,
    source: "ClinicalTrials.gov",
    studyType: "Clinical trial record",
    sourceTypeTaxonomy: "RCT",
    sampleSize: "Planned enrollment 60; phase I/II pilot trial.",
    population: "Healthy volunteers and older patients with multimorbidity.",
    intervention: "Fisetin or placebo in a registered trial protocol",
    outcomes: ["Safety", "Pharmacokinetics", "Chronic inflammation", "Senescent cells", "General health measures"],
    adverseEvents:
      "Trial record is designed to investigate absorption, metabolism, and safety; it does not establish final safety outcomes.",
    fundingConflicts: "Check ClinicalTrials.gov record for sponsor and collaborator details.",
    riskOfBias:
      "Recruiting registered trial record; not proof of safety, pharmacokinetics, efficacy, or product-level quality.",
    referenceId: "ctgov-fisetin-safety-pk-nct06431932"
  },
  {
    id: "study-ctgov-fisetin-oa-nct04210986",
    title: "Senolytic Drugs Attenuate Osteoarthritis-Related Articular Cartilage Degeneration: A Clinical Trial",
    year: 2026,
    source: "ClinicalTrials.gov",
    studyType: "Clinical trial record",
    sourceTypeTaxonomy: "RCT",
    sampleSize: "Enrollment 75; phase I/II randomized, double-blind, placebo-controlled trial.",
    population: "Participants with mild to moderate knee osteoarthritis.",
    intervention: "Fisetin or placebo in a registered trial protocol",
    outcomes: ["Knee osteoarthritis", "Safety", "Efficacy", "Articular cartilage degeneration"],
    adverseEvents:
      "Completed trial record does not by itself establish source-extracted safety or efficacy outcomes in this local packet.",
    fundingConflicts: "Check ClinicalTrials.gov record for sponsor and collaborator details.",
    riskOfBias:
      "Completed trial record is a review lead until published or posted results are extracted; do not treat registration as evidence of efficacy.",
    referenceId: "ctgov-fisetin-oa-nct04210986"
  }
];

export const trialWatchItems: TrialWatchItem[] = [
  {
    id: "trial-api",
    interventionId: "creatine",
    title: "ClinicalTrials.gov v2 search is wired for intervention monitoring",
    status: "Active",
    phase: "Integration",
    enrollment: "Live API",
    lastUpdateDate: "2026-06-02",
    evidenceImpact: "Increasing",
    url: "https://clinicaltrials.gov/data-about-studies/learn-about-api"
  },
  {
    id: "pubmed-api",
    interventionId: "omega-3",
    title: "PubMed E-utilities search is wired for literature monitoring",
    status: "Active",
    phase: "Integration",
    enrollment: "Live API",
    lastUpdateDate: "2026-06-02",
    evidenceImpact: "Increasing",
    url: "https://www.ncbi.nlm.nih.gov/books/NBK25497/"
  }
];

export const safetyAlerts: SafetyAlert[] = [
  {
    id: "tga-unapproved-peptides",
    interventionId: "bpc-157",
    region: "Australia",
    source: "TGA",
    date: "2026-05-07",
    alertType: "Unapproved therapeutic good",
    severity: "Clinician review recommended",
    summary:
      "TGA safety-alert monitoring is first-class for peptide watchlist items; unapproved peptides should show regulatory and clinician-review warnings.",
    url: "https://www.tga.gov.au/safety/safety-monitoring-and-information/safety-alerts",
    lastChecked: "2026-06-02"
  },
  {
    id: "bpc-157-fda",
    interventionId: "bpc-157",
    region: "United States",
    source: "FDA",
    date: "2023-09-29",
    alertType: "Compounding restriction",
    severity: "Clinician review recommended",
    summary:
      "BPC-157 is tracked as a regulatory concern; the dashboard must not provide self-use instructions.",
    url: "https://www.fda.gov/drugs/compounding/safety-risks-associated-certain-bulk-drug-substances-nominated-use-compounding",
    lastChecked: "2026-06-02"
  },
  {
    id: "omega-3-afib",
    interventionId: "omega-3",
    region: "General",
    source: "NIH ODS",
    date: "2025-01-01",
    alertType: "Drug interaction",
    severity: "Moderate",
    summary:
      "Higher-dose omega-3 contexts should display atrial fibrillation and bleeding-context review notes.",
    url: "https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/",
    lastChecked: "2026-06-02"
  },
  {
    id: "vitamin-d-upper-limit",
    interventionId: "vitamin-d",
    region: "General",
    source: "NIH ODS",
    date: "2025-01-01",
    alertType: "Kidney risk",
    severity: "Moderate",
    summary:
      "High-dose vitamin D claims must be framed around measured status, total intake, and safety limits.",
    url: "https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/",
    lastChecked: "2026-06-02"
  }
];

export const australiaRegulatoryStatuses: AustraliaRegulatoryStatus[] = [
  {
    id: "au-reg-creatine-intervention",
    interventionId: "creatine",
    referenceId: "tga-artg",
    region: "AU",
    kind: "Unknown",
    status: "Product-level ARTG status required",
    supplySummary:
      "Creatine is an ingredient-level intervention in this dashboard; Australian supply status must be verified at the product and AUST-number level.",
    evidenceRequirement:
      "Check the product label and ARTG record for AUST L, AUST L(A), AUST R, or absence of an AUST number.",
    sourceUrl:
      "https://www.tga.gov.au/products/regulations-all-products/about-australian-register-therapeutic-goods-artg",
    checkedAt: "2026-06-02",
    notes:
      "No seed ARTG product record is attached yet, so do not infer Australian market authorisation from the intervention evidence score."
  },
  {
    id: "au-reg-vitamin-d-intervention",
    interventionId: "vitamin-d",
    referenceId: "tga-aust-numbers",
    region: "AU",
    kind: "Unknown",
    status: "AUST number varies by product",
    supplySummary:
      "Vitamin D products may appear in different Australian regulatory contexts; this project has not verified a specific ARTG entry.",
    evidenceRequirement:
      "Use the product's AUST number to distinguish AUST L, AUST L(A), and AUST R status.",
    sourceUrl:
      "https://www.tga.gov.au/how-we-regulate/labelling-and-packaging/medicines-and-biologicals/aust-numbers-medicine-labels",
    checkedAt: "2026-06-02",
    notes:
      "Biomarker-gated evidence should remain separate from product-level market authorisation."
  },
  {
    id: "au-reg-omega-3-intervention",
    interventionId: "omega-3",
    referenceId: "tga-aust-numbers",
    region: "AU",
    kind: "Unknown",
    status: "Supplement and medicine contexts differ",
    supplySummary:
      "Omega-3 intervention evidence is not the same as a verified Australian ARTG status for any specific product.",
    evidenceRequirement:
      "Record the product's AUST number and formulation before showing product-level regulatory confidence.",
    sourceUrl:
      "https://www.tga.gov.au/how-we-regulate/labelling-and-packaging/medicines-and-biologicals/aust-numbers-medicine-labels",
    checkedAt: "2026-06-02",
    notes:
      "Keep triglyceride, cardiovascular-event, and safety claims separate from product registration/listing."
  },
  {
    id: "au-reg-bpc-157-intervention",
    interventionId: "bpc-157",
    referenceId: "tga-safety-alerts",
    region: "AU",
    kind: "Unapproved",
    status: "Unapproved therapeutic good concern",
    efficacyAssessed: false,
    preMarketAssessment: false,
    supplySummary:
      "BPC-157 should remain in the peptide/regulatory watchlist with clinician-review warnings and no self-use instructions.",
    evidenceRequirement:
      "Require ARTG verification, TGA safety-alert review, and human clinical evidence before any stronger claim label.",
    sourceUrl: "https://www.tga.gov.au/safety/safety-monitoring-and-information/safety-alerts",
    checkedAt: "2026-06-02",
    notes:
      "The seed data flags regulatory concern; it does not provide sourcing, reconstitution, injection, cycling, or dosing guidance."
  },
  {
    id: "au-reg-psyllium-intervention",
    interventionId: "psyllium",
    referenceId: "tga-artg",
    region: "AU",
    kind: "Unknown",
    status: "Product-level ARTG status required",
    supplySummary:
      "Psyllium is tracked as an intervention; Australian product supply status must be verified product by product.",
    evidenceRequirement:
      "Record AUST number, sponsor, formulation, and permitted indications when product ingestion is added.",
    sourceUrl:
      "https://www.tga.gov.au/products/regulations-all-products/about-australian-register-therapeutic-goods-artg",
    checkedAt: "2026-06-02",
    notes:
      "Do not assume a generic fiber evidence card applies to every Australian product label."
  },
  {
    id: "au-reg-seed-creatine-product",
    productId: "seed-creatine-product",
    referenceId: "tga-aust-numbers",
    region: "AU",
    kind: "Unknown",
    status: "AUST number not verified",
    supplySummary:
      "This seed product is a quality-signal example, not a verified Australian ARTG record.",
    evidenceRequirement:
      "Capture the label AUST number or ARTG search result before showing Australian regulatory confidence.",
    sourceUrl:
      "https://www.tga.gov.au/how-we-regulate/labelling-and-packaging/medicines-and-biologicals/aust-numbers-medicine-labels",
    checkedAt: "2026-06-02",
    notes: "NSF certification is a quality signal, not an Australian market authorisation signal."
  },
  {
    id: "au-reg-seed-blend-product",
    productId: "seed-blend-product",
    referenceId: "tga-aust-numbers",
    region: "AU",
    kind: "Unknown",
    status: "AUST number not verified",
    supplySummary:
      "This seed blend is intentionally a label-risk example; Australian ARTG status has not been verified.",
    evidenceRequirement:
      "Capture AUST number, sponsor, ingredients, and permitted indications before product recommendations.",
    sourceUrl:
      "https://www.tga.gov.au/how-we-regulate/labelling-and-packaging/medicines-and-biologicals/aust-numbers-medicine-labels",
    checkedAt: "2026-06-02",
    notes: "Proprietary blend and hype-risk checks remain separate from ARTG verification."
  },
  ...expansionAustraliaRegulatoryStatuses
];

export const productSignals: ProductSignal[] = [
  {
    id: "seed-creatine-product",
    name: "Creatine monohydrate powder",
    brand: "Demo profile",
    ingredients: ["Creatine monohydrate"],
    proprietaryBlend: false,
    certifications: ["NSF Certified for Sport"],
    region: "AU verification pending",
    qualityScore: 8,
    labelClaimRiskScore: 2
  },
  {
    id: "seed-blend-product",
    name: "Longevity blend",
    brand: "Demo profile",
    ingredients: ["Proprietary blend", "Resveratrol", "Fisetin", "Quercetin"],
    proprietaryBlend: true,
    certifications: [],
    region: "AU verification pending",
    qualityScore: 3,
    labelClaimRiskScore: 8
  },
  {
    id: "seed-sleep-support-product",
    name: "Sleep support blend",
    brand: "Demo profile",
    ingredients: ["Magnesium glycinate", "L-theanine", "Melatonin"],
    proprietaryBlend: false,
    certifications: [],
    region: "AU verification pending",
    qualityScore: 5,
    labelClaimRiskScore: 5
  }
];
