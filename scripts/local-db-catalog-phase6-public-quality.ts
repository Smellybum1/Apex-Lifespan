import {
  AustraliaRegulatoryKind as DbAustraliaRegulatoryKind,
  OutcomeArea as DbOutcomeArea,
  Prisma,
  SourceKind as DbSourceKind,
  StudyType as DbStudyType
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { withProcessEnv } from "@/lib/env-file";
import {
  syncClaimStudyLinksForClaim,
  syncSourcePacketForClaim
} from "@/lib/data/source-packets";

const REVIEW_NOTE =
  "Local catalog phase-6 public-quality pass (hobby-project mode); verify before public promotion.";

export const TOP10_INTERVENTION_IDS = [
  "creatine",
  "vitamin-d",
  "magnesium",
  "omega-3",
  "caffeine",
  "ashwagandha",
  "berberine",
  "coenzyme-q10",
  "vitamin-c",
  "green-tea-extract"
] as const;

type ReferenceSpec = {
  id: string;
  identifier?: string;
  source: DbSourceKind;
  title: string;
  url: string;
  year: number;
};

type StudySpec = {
  id: string;
  referenceId: string;
  title: string;
  year: number;
  source: string;
  sourceType: DbStudyType;
  sampleSize: string;
  population: string;
  interventionName: string;
  outcomes: string[];
  adverseEvents: string;
  fundingConflicts: string;
  riskOfBias: string;
  pmid?: string;
};

type ClaimLinkSpec = {
  interventionId: string;
  outcome: DbOutcomeArea;
  referenceIds: string[];
};

type ClaimSummarySpec = {
  interventionId: string;
  outcome: DbOutcomeArea;
  summary: string;
  uncertainty: string;
};

type InterventionSummarySpec = {
  evidenceSummary: string;
  id: string;
};

const GENERATED_CLAIM_INCLUDE = {
  intervention: {
    select: {
      category: true,
      id: true,
      name: true
    }
  },
  references: {
    select: {
      reference: {
        select: {
          id: true,
          identifier: true,
          title: true,
          url: true
        }
      }
    }
  },
  studyLinks: {
    select: {
      study: {
        select: {
          abstract: true,
          adverseEvents: true,
          id: true,
          mainResults: true,
          outcomes: true,
          riskOfBias: true,
          sourceType: true,
          title: true,
          year: true
        }
      }
    }
  }
} satisfies Prisma.ClaimInclude;

type GeneratedClaim = Prisma.ClaimGetPayload<{
  include: typeof GENERATED_CLAIM_INCLUDE;
}>;

const GENERATED_INTERVENTION_INCLUDE = {
  claims: {
    select: {
      confidenceLevel: true,
      finalLabel: true,
      id: true,
      outcome: true,
      references: { select: { referenceId: true } },
      studyLinks: { select: { studyId: true } }
    }
  }
} satisfies Prisma.InterventionInclude;

type GeneratedIntervention = Prisma.InterventionGetPayload<{
  include: typeof GENERATED_INTERVENTION_INCLUDE;
}>;

const TGA_ARTG_URL =
  "https://www.tga.gov.au/products/regulations-all-products/about-australian-register-therapeutic-goods-artg";
const TGA_AUST_URL =
  "https://www.tga.gov.au/how-we-regulate/labelling-and-packaging/medicines-and-biologicals/aust-numbers-medicine-labels";
const TGA_PEPTIDE_ALERT_URL =
  "https://www.tga.gov.au/safety/safety-monitoring-and-information/safety-alerts";

const NEW_REFERENCES: ReferenceSpec[] = [
  {
    id: "ref-pubmed-23439798",
    identifier: "PMID: 23439798",
    source: DbSourceKind.PUBMED,
    title:
      "A prospective, randomized double-blind, placebo-controlled study of safety and efficacy of a high-concentration full-spectrum extract of ashwagandha root in reducing stress and anxiety in adults",
    url: "https://pubmed.ncbi.nlm.nih.gov/23439798/",
    year: 2012
  },
  {
    id: "ref-pubmed-36017529",
    identifier: "PMID: 36017529",
    source: DbSourceKind.PUBMED,
    title: "Effect of Ashwagandha (Withania somnifera) on stress and anxiety: A systematic review and meta-analysis",
    url: "https://pubmed.ncbi.nlm.nih.gov/36017529/",
    year: 2022
  },
  {
    id: "ref-pubmed-29099763",
    identifier: "PMID: 29099763",
    source: DbSourceKind.PUBMED,
    title: "Vitamin C and immune function",
    url: "https://pubmed.ncbi.nlm.nih.gov/29099763/",
    year: 2017
  }
];

const NEW_STUDIES: StudySpec[] = [
  {
    id: "study-ashwagandha-stress-rct-2012",
    referenceId: "ref-pubmed-23439798",
    title: "Ashwagandha root extract for stress and anxiety in adults",
    year: 2012,
    source: "PubMed",
    sourceType: DbStudyType.RANDOMIZED_CONTROLLED_TRIAL,
    sampleSize: "64 adults",
    population: "Adults reporting high stress without psychiatric diagnosis",
    interventionName: "Ashwagandha",
    outcomes: ["Stress scales", "Anxiety measures", "Cortisol"],
    adverseEvents: "Generally well tolerated in the trial; monitor tolerability and drug interactions.",
    fundingConflicts: "Industry-supported extract trial; verify funding in source record.",
    riskOfBias: "Single RCT; replication and larger trials still needed for broad claims.",
    pmid: "23439798"
  },
  {
    id: "study-ashwagandha-stress-meta-2022",
    referenceId: "ref-pubmed-36017529",
    title: "Ashwagandha for stress and anxiety: systematic review and meta-analysis",
    year: 2022,
    source: "PubMed",
    sourceType: DbStudyType.META_ANALYSIS,
    sampleSize: "Pooled trials",
    population: "Adults in stress and anxiety trials",
    interventionName: "Ashwagandha",
    outcomes: ["Stress", "Anxiety"],
    adverseEvents: "Review should be checked for GI upset and tolerability signals across trials.",
    fundingConflicts: "Check included-trial sponsorship in the meta-analysis record.",
    riskOfBias: "Meta-analysis quality depends on included trial heterogeneity and bias.",
    pmid: "36017529"
  },
  {
    id: "study-vitamin-c-immune-2017",
    referenceId: "ref-pubmed-29099763",
    title: "Vitamin C and immune function review",
    year: 2017,
    source: "PubMed",
    sourceType: DbStudyType.SYSTEMATIC_REVIEW,
    sampleSize: "Review synthesis",
    population: "General immune and infection-prevention contexts",
    interventionName: "Vitamin C",
    outcomes: ["Immune function", "Infection prevention contexts"],
    adverseEvents: "High-dose GI upset; oxalate and renal-stone context in susceptible people.",
    fundingConflicts: "Review funding should be checked in source record.",
    riskOfBias: "Review-level evidence; endpoint and population heterogeneity matter.",
    pmid: "29099763"
  }
];

const TOP10_CLAIM_LINKS: ClaimLinkSpec[] = [
  {
    interventionId: "ashwagandha",
    outcome: DbOutcomeArea.MOOD_STRESS,
    referenceIds: ["ref-pubmed-23439798", "ref-pubmed-36017529"]
  },
  {
    interventionId: "ashwagandha",
    outcome: DbOutcomeArea.SAFETY_ADVERSE_EFFECTS,
    referenceIds: ["ref-pubmed-36017529"]
  },
  {
    interventionId: "caffeine",
    outcome: DbOutcomeArea.VO2_MAX_ENDURANCE,
    referenceIds: ["issn-caffeine-2021"]
  },
  {
    interventionId: "caffeine",
    outcome: DbOutcomeArea.COGNITION,
    referenceIds: ["issn-caffeine-2021"]
  },
  {
    interventionId: "vitamin-c",
    outcome: DbOutcomeArea.IMMUNE_RESPIRATORY,
    referenceIds: ["ref-pubmed-29099763", "ods-vitamin-c"]
  }
];

const PRIORITY_INTERVENTION_SUMMARIES: InterventionSummarySpec[] = [
  {
    id: "ashwagandha",
    evidenceSummary:
      "Evidence is suggestive for stress-related symptoms, sleep, selected performance outcomes, and short-term tolerability, but current local claim confidence remains low or very low because many rows are still source leads rather than settled conclusions."
  },
  {
    id: "creatine",
    evidenceSummary:
      "Best supported for strength, power, lean mass, and some function-oriented outcomes when paired with training; direct lifespan extension remains unproven."
  },
  {
    id: "caffeine",
    evidenceSummary:
      "Best interpreted as an acute performance and alertness aid with clear sleep, blood-pressure, anxiety, tolerance, and individual-sensitivity tradeoffs."
  },
  {
    id: "berberine",
    evidenceSummary:
      "Local evidence is mostly biomarker-focused, especially glucose and lipids; clinical outcomes, product quality, interactions, and longer-term safety remain the main limits."
  },
  {
    id: "coenzyme-q10",
    evidenceSummary:
      "Evidence clusters around cardiometabolic, fatigue, inflammation, and mitochondrial-biomarker contexts, with mostly modest or population-specific signals rather than broad longevity proof."
  },
  {
    id: "collagen",
    evidenceSummary:
      "Most plausible support is for skin, joint, tendon, and connective-tissue outcomes; claims depend heavily on product type, population, duration, and endpoint."
  },
  {
    id: "magnesium",
    evidenceSummary:
      "Best interpreted through deficiency risk, intake context, form, renal function, and medication interactions; sleep claims remain cautious rather than general insomnia treatment claims."
  }
];

const PRIORITY_CLAIM_SUMMARIES: ClaimSummarySpec[] = [
  {
    interventionId: "ashwagandha",
    outcome: DbOutcomeArea.MOOD_STRESS,
    summary:
      "The local extracted evidence suggests possible reductions in perceived stress and anxiety symptoms in selected adult trial populations, including RCT and review material, but this remains a symptom-support signal rather than a treatment conclusion.",
    uncertainty:
      "Trials vary by extract, dose, duration, population, comparator, and outcome scale; several source rows still need structured extraction before the score should be treated as settled."
  },
  {
    interventionId: "ashwagandha",
    outcome: DbOutcomeArea.SLEEP,
    summary:
      "The local source set includes sleep-related Ashwagandha material, but the captured conclusion text is still too thin to make a confident overall sleep conclusion from this dashboard alone.",
    uncertainty:
      "Keep this as source-led and inconclusive until the linked sleep studies have clean results, endpoint definitions, extract details, and adverse-event notes captured."
  },
  {
    interventionId: "ashwagandha",
    outcome: DbOutcomeArea.MUSCLE_STRENGTH,
    summary:
      "Some local sources point toward possible strength or performance benefits, but the current dashboard record is still mostly source-lead evidence rather than a completed strength synthesis.",
    uncertainty:
      "Do not generalize across extracts, training status, sex, age, dose, or duration until the linked trials and meta-analyses are extracted claim by claim."
  },
  {
    interventionId: "ashwagandha",
    outcome: DbOutcomeArea.VO2_MAX_ENDURANCE,
    summary:
      "Endurance-related Ashwagandha evidence is present as a local source lead, but the dashboard does not yet contain enough clean conclusion text to say the effect is reliable.",
    uncertainty:
      "Treat this as inconclusive until study designs, endpoints, baseline fitness, and extract details are captured and separated from broader performance claims."
  },
  {
    interventionId: "ashwagandha",
    outcome: DbOutcomeArea.COGNITION,
    summary:
      "The local catalog links cognition-related Ashwagandha sources, but the current evidence packet does not yet support a settled cognitive-benefit conclusion.",
    uncertainty:
      "Cognition endpoints, age groups, baseline status, and extract details need structured extraction; the displayed score should stay visibly low-confidence."
  },
  {
    interventionId: "ashwagandha",
    outcome: DbOutcomeArea.FERTILITY_HORMONES,
    summary:
      "Hormone and fertility claims are present as source leads, but the local dashboard has not yet captured enough claim-specific effect estimates to support a confident conclusion.",
    uncertainty:
      "Keep population, endpoint, reproductive-health context, safety, and product identity boundaries visible; this is not a recommendation or a general endocrine claim."
  },
  {
    interventionId: "ashwagandha",
    outcome: DbOutcomeArea.SAFETY_ADVERSE_EFFECTS,
    summary:
      "The local safety extraction suggests standardized Ashwagandha root extract was generally tolerated in controlled healthy-adult trial settings at studied doses and durations, while safety must remain separate from efficacy.",
    uncertainty:
      "Trial tolerability does not prove product-level safety, pregnancy safety, liver safety, interaction safety, or TGA clearance; adverse-event surveillance and product quality remain important."
  },
  {
    interventionId: "creatine",
    outcome: DbOutcomeArea.MUSCLE_STRENGTH,
    summary:
      "Creatine monohydrate has the clearest local support for strength, power, lean-mass, and training-related performance outcomes, especially when paired with resistance training.",
    uncertainty:
      "This does not prove benefits for every population, dose, sport, disease state, or aging endpoint; renal history, product quality, and study context still matter."
  },
  {
    interventionId: "creatine",
    outcome: DbOutcomeArea.MORTALITY_LIFESPAN,
    summary:
      "The local record does not show direct human evidence that creatine extends lifespan or reduces mortality.",
    uncertainty:
      "Functional, muscle, or mechanistic benefits should not be converted into a lifespan claim without human aging, frailty, morbidity, or mortality endpoint evidence."
  },
  {
    interventionId: "creatine",
    outcome: DbOutcomeArea.COGNITION,
    summary:
      "Cognition-related creatine evidence is a plausible source-lead area, especially where energy metabolism or older-adult contexts are relevant, but the local packet is not yet a settled cognitive-benefit synthesis.",
    uncertainty:
      "Effects may depend on baseline diet, age, sleep deprivation, clinical status, and endpoint; stronger claim-specific extraction is needed."
  },
  {
    interventionId: "creatine",
    outcome: DbOutcomeArea.GLUCOSE_INSULIN_HBA1C,
    summary:
      "The local record includes glucose and insulin-resistance source leads, mostly around exercise, older adults, and metabolic contexts, but this is not yet a confident glycemic-control claim.",
    uncertainty:
      "Signals are heterogeneous and often tied to exercise or small trials; medication, diabetes status, and clinical outcomes are not resolved by the current packet."
  },
  {
    interventionId: "caffeine",
    outcome: DbOutcomeArea.COGNITION,
    summary:
      "Caffeine has local support for acute alertness, vigilance, and some cognitive-performance contexts, especially when fatigue or sleepiness is relevant.",
    uncertainty:
      "This is not a general cognitive-health claim; tolerance, anxiety, sleep loss, timing, genetics, and baseline caffeine use can change the effect."
  },
  {
    interventionId: "caffeine",
    outcome: DbOutcomeArea.VO2_MAX_ENDURANCE,
    summary:
      "The local evidence supports caffeine as an acute endurance and exercise-performance aid in appropriate studied contexts.",
    uncertainty:
      "Performance findings do not remove safety, sleep, anxiety, blood-pressure, or sport-specific constraints; individual response varies."
  },
  {
    interventionId: "caffeine",
    outcome: DbOutcomeArea.SLEEP,
    summary:
      "The clearest sleep-related conclusion is adverse: caffeine can impair sleep timing, continuity, or quality depending on timing and individual sensitivity.",
    uncertainty:
      "Sleep effects depend on dose timing, metabolism, tolerance, baseline sleep, and co-use with other stimulants; the dashboard should not frame this as a sleep benefit."
  },
  {
    interventionId: "caffeine",
    outcome: DbOutcomeArea.SAFETY_ADVERSE_EFFECTS,
    summary:
      "Caffeine safety is context-dependent: ordinary dietary exposure differs from concentrated products, high total intake, late-day use, pregnancy contexts, anxiety vulnerability, and cardiovascular sensitivity.",
    uncertainty:
      "Product concentration, combined stimulants, arrhythmia risk, blood pressure, and sleep disruption need product- and person-specific review."
  },
  {
    interventionId: "berberine",
    outcome: DbOutcomeArea.GLUCOSE_INSULIN_HBA1C,
    summary:
      "Berberine has local biomarker-oriented evidence suggesting possible improvements in glucose-related measures in metabolic-risk populations.",
    uncertainty:
      "This is not equivalent to proven diabetes treatment or medication substitution; trial quality, interactions, product variability, liver context, pregnancy context, and long-term outcomes remain important."
  },
  {
    interventionId: "berberine",
    outcome: DbOutcomeArea.LDL_APOB_LIPIDS,
    summary:
      "The local source set suggests berberine may improve lipid biomarkers in some studied metabolic populations.",
    uncertainty:
      "Hard cardiovascular outcomes, consistency across products, dose/form identity, and interaction safety remain unresolved."
  },
  {
    interventionId: "berberine",
    outcome: DbOutcomeArea.SAFETY_ADVERSE_EFFECTS,
    summary:
      "Berberine safety cannot be treated like a simple food-style supplement claim; interactions, pregnancy context, liver context, and product quality require caution.",
    uncertainty:
      "The dashboard should keep efficacy and safety separate and should not imply product-level safety, medication compatibility, or TGA clearance."
  },
  {
    interventionId: "coenzyme-q10",
    outcome: DbOutcomeArea.BLOOD_PRESSURE,
    summary:
      "CoQ10 evidence includes cardiometabolic biomarker and blood-pressure source leads, with effects that appear modest and population-specific rather than broadly decisive.",
    uncertainty:
      "Heterogeneity, baseline disease status, background medication use, formulation, dose, and trial quality limit broad interpretation."
  },
  {
    interventionId: "coenzyme-q10",
    outcome: DbOutcomeArea.INFLAMMATION,
    summary:
      "The local CoQ10 inflammation packet contains several meta-analytic and trial leads suggesting possible changes in inflammatory or oxidative-stress biomarkers.",
    uncertainty:
      "Biomarker movement does not prove clinical outcome benefit; results vary by condition, marker, formulation, and study quality."
  },
  {
    interventionId: "coenzyme-q10",
    outcome: DbOutcomeArea.CARDIOVASCULAR_EVENTS,
    summary:
      "CoQ10 has cardiovascular source leads, but the dashboard should distinguish symptom, biomarker, and heart-failure contexts from broad cardiovascular event prevention.",
    uncertainty:
      "Hard-outcome conclusions require claim-specific extraction, comparator context, background therapy details, and population separation."
  },
  {
    interventionId: "collagen",
    outcome: DbOutcomeArea.JOINT_TENDON_SKIN,
    summary:
      "Collagen evidence is most plausible for skin, joint, tendon, or connective-tissue endpoints, with effects depending on product type and the exact outcome measured.",
    uncertainty:
      "Hydrolyzed collagen, collagen peptides, gelatin, vitamin C co-use, duration, and endpoint choice should not be collapsed into one broad anti-aging claim."
  },
  {
    interventionId: "collagen",
    outcome: DbOutcomeArea.MUSCLE_STRENGTH,
    summary:
      "Muscle or strength claims for collagen are weaker than its connective-tissue and skin/joint framing in the local catalog.",
    uncertainty:
      "Any strength interpretation needs to separate protein adequacy, resistance training, comparator protein, and body-composition endpoints."
  },
  {
    interventionId: "whey-protein",
    outcome: DbOutcomeArea.MORTALITY_LIFESPAN,
    summary:
      "The local record does not show direct evidence that whey protein extends lifespan or reduces mortality. The linked protein evidence is better read as support for resistance-training strength and lean-mass outcomes, not as a longevity claim.",
    uncertainty:
      "Direct lifespan evidence is absent in the local packet; do not convert broad dietary-protein, muscle, or body-composition findings into a mortality or lifespan conclusion."
  },
  {
    interventionId: "magnesium",
    outcome: DbOutcomeArea.SLEEP,
    summary:
      "Magnesium sleep evidence is best treated as context-dependent: possible support is more plausible where low intake, insufficiency, or specific populations are relevant, not as a general insomnia treatment claim.",
    uncertainty:
      "Form, total intake, renal function, medication interactions, baseline magnesium status, and sleep-endpoint quality materially affect interpretation."
  }
];

const OUTCOME_LABELS: Record<DbOutcomeArea, string> = {
  [DbOutcomeArea.BIOLOGICAL_AGING_CLOCKS]: "biological aging clocks",
  [DbOutcomeArea.BLOOD_PRESSURE]: "blood pressure",
  [DbOutcomeArea.CARDIOVASCULAR_EVENTS]: "cardiovascular events",
  [DbOutcomeArea.COGNITION]: "cognition",
  [DbOutcomeArea.EYE_HEALTH]: "eye health",
  [DbOutcomeArea.FERTILITY_HORMONES]: "fertility/hormones",
  [DbOutcomeArea.GLUCOSE_INSULIN_HBA1C]: "glucose/insulin/HbA1c",
  [DbOutcomeArea.IMMUNE_RESPIRATORY]: "immune/respiratory",
  [DbOutcomeArea.INFLAMMATION]: "inflammation",
  [DbOutcomeArea.JOINT_TENDON_SKIN]: "joint/tendon/skin",
  [DbOutcomeArea.LDL_APOB_LIPIDS]: "LDL/ApoB/lipids",
  [DbOutcomeArea.MOOD_STRESS]: "mood/stress",
  [DbOutcomeArea.MORTALITY_LIFESPAN]: "mortality/lifespan",
  [DbOutcomeArea.MUSCLE_STRENGTH]: "muscle/strength",
  [DbOutcomeArea.SAFETY_ADVERSE_EFFECTS]: "safety/adverse effects",
  [DbOutcomeArea.SLEEP]: "sleep",
  [DbOutcomeArea.VO2_MAX_ENDURANCE]: "VO2 max/endurance"
};

const CONFIDENCE_LABELS: Record<GeneratedClaim["confidenceLevel"], string> = {
  HIGH: "high",
  LOW: "low",
  MODERATE: "moderate",
  VERY_LOW: "very low"
};

const FINAL_LABELS: Record<GeneratedClaim["finalLabel"], string> = {
  AVOID_NOT_RECOMMENDED: "Avoid / Not Recommended",
  CONDITIONAL_BIOMARKER_GATED: "Conditional / Biomarker-Gated",
  CORE_EVIDENCE_BASED: "Core Evidence-Based",
  INSUFFICIENT_EVIDENCE: "Insufficient Evidence",
  REASONABLE_N_OF_1_EXPERIMENT: "Reasonable N-of-1 Experiment",
  REGULATORY_CONCERN: "Regulatory Concern",
  REQUIRES_CLINICIAN_OVERSIGHT: "Requires Clinician Oversight",
  SAFETY_CONCERN: "Safety Concern",
  SPECULATIVE_WATCHLIST: "Speculative Watchlist",
  USEFUL_FOR_SPECIFIC_USE_CASE: "Useful for Specific Use Case"
};

const PEPTIDE_INTERVENTION_IDS = new Set([
  "bpc-157",
  "tb-500",
  "ghk-cu",
  "ipamorelin",
  "cjc-1295",
  "epitalon",
  "mots-c",
  "semax",
  "selank"
]);

const DRUG_INTERVENTION_IDS = new Set(["semaglutide", "retatrutide", "psilocybin"]);

async function ensureReference(input: ReferenceSpec) {
  const existing = await prisma.reference.findFirst({
    select: { id: true },
    where: { OR: [{ id: input.id }, { url: input.url }] }
  });

  if (existing) {
    await prisma.reference.update({
      data: {
        identifier: input.identifier ?? null,
        source: input.source,
        title: input.title,
        url: input.url,
        year: input.year
      },
      where: { id: existing.id }
    });
    return existing.id;
  }

  await prisma.reference.create({
    data: {
      id: input.id,
      identifier: input.identifier ?? null,
      source: input.source,
      title: input.title,
      url: input.url,
      year: input.year
    }
  });
  return input.id;
}

async function upsertStudy(study: StudySpec) {
  await prisma.study.upsert({
    create: {
      ...study,
      pmid: study.pmid ?? null,
      nctId: null
    },
    update: {
      referenceId: study.referenceId,
      title: study.title,
      year: study.year,
      source: study.source,
      sourceType: study.sourceType,
      sampleSize: study.sampleSize,
      population: study.population,
      interventionName: study.interventionName,
      outcomes: study.outcomes,
      adverseEvents: study.adverseEvents,
      fundingConflicts: study.fundingConflicts,
      riskOfBias: study.riskOfBias,
      pmid: study.pmid ?? null
    },
    where: { id: study.id }
  });
}

async function upsertClaimReference(claimId: string, referenceId: string, relevance: number) {
  await prisma.claimReference.upsert({
    create: { claimId, note: REVIEW_NOTE, referenceId, relevance },
    update: { note: REVIEW_NOTE, relevance },
    where: { claimId_referenceId: { claimId, referenceId } }
  });
}

function auUpgradeFor(intervention: { category: string; id: string; name: string }) {
  if (PEPTIDE_INTERVENTION_IDS.has(intervention.id)) {
    return {
      evidenceRequirement:
        "Require TGA safety-alert review, ARTG verification, and human clinical evidence before any stronger claim label.",
      kind: DbAustraliaRegulatoryKind.UNAPPROVED,
      notes:
        "Peptide watchlist entry. Do not provide sourcing, compounding, reconstitution, injection, cycling, or dosing guidance.",
      sourceUrl: TGA_PEPTIDE_ALERT_URL,
      status: "Unapproved peptide product concern",
      supplySummary: `${intervention.name} remains on the peptide/regulatory watchlist; Australian supply and product identity must be verified separately from generic evidence cards.`
    };
  }

  if (DRUG_INTERVENTION_IDS.has(intervention.id)) {
    return {
      evidenceRequirement:
        "Check ARTG listing, sponsor, approved indications, and PBS context before any product-level confidence.",
      kind: DbAustraliaRegulatoryKind.UNKNOWN,
      notes:
        "Drug/therapeutic watchlist entry. Keep clinician oversight and approved-indication boundaries visible.",
      sourceUrl: TGA_ARTG_URL,
      status: "Prescription or therapeutic-good context may apply",
      supplySummary: `${intervention.name} is tracked as a drug/therapeutic watchlist intervention; Australian market status must be verified at the product and ARTG level.`
    };
  }

  return {
    evidenceRequirement:
      "Record AUST number, sponsor, formulation, and permitted indications when product ingestion is added.",
    kind: DbAustraliaRegulatoryKind.UNKNOWN,
    notes: `Do not assume a generic ${intervention.name} evidence card applies to every Australian product label.`,
    sourceUrl: intervention.category.includes("Vitamin") ? TGA_AUST_URL : TGA_ARTG_URL,
    status: "Product-level ARTG status required",
    supplySummary: `${intervention.name} is tracked as an intervention; Australian product supply status must be verified product by product.`
  };
}

async function deepenTop10() {
  const result: Record<string, unknown> = { claims: {} as Record<string, string> };

  const refIdMap = new Map<string, string>();
  for (const reference of NEW_REFERENCES) {
    refIdMap.set(reference.id, await ensureReference(reference));
  }

  for (const study of NEW_STUDIES) {
    await upsertStudy({
      ...study,
      referenceId: refIdMap.get(study.referenceId) ?? study.referenceId
    });
  }

  const linkedClaims: string[] = [];
  for (const link of TOP10_CLAIM_LINKS) {
    const claim = await prisma.claim.findFirst({
      select: { id: true },
      where: { interventionId: link.interventionId, outcome: link.outcome }
    });

    if (!claim) {
      continue;
    }

    let relevance = 8;
    for (const referenceId of link.referenceIds) {
      const resolvedReferenceId =
        refIdMap.get(referenceId) ??
        (await prisma.reference.findFirst({ select: { id: true }, where: { id: referenceId } }))?.id;
      if (!resolvedReferenceId) {
        continue;
      }
      await upsertClaimReference(claim.id, resolvedReferenceId, relevance);
      relevance -= 1;
    }
    linkedClaims.push(claim.id);
  }

  const claims = await prisma.claim.findMany({
    where: { interventionId: { in: [...TOP10_INTERVENTION_IDS] } },
    select: { id: true },
    orderBy: { id: "asc" }
  });

  for (const claim of claims) {
    await syncClaimStudyLinksForClaim(claim.id);
    const packet = await syncSourcePacketForClaim(claim.id);
    (result.claims as Record<string, string>)[claim.id] = packet.status;
  }

  result.top10ClaimCount = claims.length;
  result.linkedClaims = linkedClaims;
  return result;
}

async function upgradeGenericAuRows() {
  const rows = await prisma.australiaRegulatoryStatus.findMany({
    where: {
      interventionId: { not: null },
      status: "AU/TGA product-level status unverified"
    },
    include: {
      intervention: {
        select: { category: true, id: true, name: true }
      }
    }
  });

  let updated = 0;
  for (const row of rows) {
    if (!row.intervention) {
      continue;
    }

    const spec = auUpgradeFor(row.intervention);
    await prisma.australiaRegulatoryStatus.update({
      where: { id: row.id },
      data: {
        checkedAt: new Date("2026-06-24T00:00:00.000Z"),
        efficacyAssessed: false,
        evidenceRequirement: spec.evidenceRequirement,
        kind: spec.kind,
        notes: spec.notes,
        preMarketAssessment: false,
        sourceUrl: spec.sourceUrl,
        status: spec.status,
        supplySummary: spec.supplySummary
      }
    });
    updated += 1;
  }

  return { genericRowsFound: rows.length, updated };
}

async function applyPriorityEvidenceSummaries() {
  const result: Record<string, unknown> = {
    claimSummaries: [] as Array<Record<string, string>>,
    interventionSummaries: [] as Array<Record<string, string>>
  };

  for (const summary of PRIORITY_INTERVENTION_SUMMARIES) {
    const intervention = await prisma.intervention.findUnique({
      select: { id: true, name: true },
      where: { id: summary.id }
    });

    if (!intervention) {
      (result.interventionSummaries as Array<Record<string, string>>).push({
        id: summary.id,
        status: "missing"
      });
      continue;
    }

    await prisma.intervention.update({
      data: { evidenceSummary: summary.evidenceSummary },
      where: { id: intervention.id }
    });
    (result.interventionSummaries as Array<Record<string, string>>).push({
      id: intervention.id,
      name: intervention.name,
      status: "updated"
    });
  }

  for (const summary of PRIORITY_CLAIM_SUMMARIES) {
    const claim = await prisma.claim.findFirst({
      select: { id: true, interventionId: true, outcome: true },
      where: {
        interventionId: summary.interventionId,
        outcome: summary.outcome
      }
    });

    if (!claim) {
      (result.claimSummaries as Array<Record<string, string>>).push({
        interventionId: summary.interventionId,
        outcome: summary.outcome,
        status: "missing"
      });
      continue;
    }

    await prisma.claim.update({
      data: {
        summary: summary.summary,
        uncertainty: summary.uncertainty
      },
      where: { id: claim.id }
    });
    (result.claimSummaries as Array<Record<string, string>>).push({
      claimId: claim.id,
      interventionId: claim.interventionId,
      outcome: claim.outcome,
      status: "updated"
    });
  }

  return {
    ...result,
    claimSummaryCount: (result.claimSummaries as Array<Record<string, string>>).filter(
      (row) => row.status === "updated"
    ).length,
    interventionSummaryCount: (
      result.interventionSummaries as Array<Record<string, string>>
    ).filter((row) => row.status === "updated").length
  };
}

async function applyGeneratedEvidenceSummaries() {
  const priorityClaimKeys = new Set(
    PRIORITY_CLAIM_SUMMARIES.map((summary) => claimSummaryKey(summary.interventionId, summary.outcome))
  );
  const priorityInterventionIds = new Set(
    PRIORITY_INTERVENTION_SUMMARIES.map((summary) => summary.id)
  );
  const result = {
    generatedClaimSummaries: 0,
    generatedInterventionSummaries: 0,
    preservedExistingClaimSummaries: 0,
    preservedPriorityClaimSummaries: 0,
    preservedPriorityInterventionSummaries: 0,
    sparseClaimSummaries: 0,
    totalClaims: 0,
    totalInterventions: 0
  };

  const claims = await prisma.claim.findMany({
    include: GENERATED_CLAIM_INCLUDE,
    orderBy: [{ interventionId: "asc" }, { outcome: "asc" }, { id: "asc" }]
  });

  result.totalClaims = claims.length;

  for (const claim of claims) {
    if (priorityClaimKeys.has(claimSummaryKey(claim.interventionId, claim.outcome))) {
      result.preservedPriorityClaimSummaries += 1;
      continue;
    }

    const summary = buildGeneratedClaimSummary(claim);
    const uncertainty = buildGeneratedClaimUncertainty(claim);

    if (!shouldReplaceGeneratedClaimText(claim.summary, claim.uncertainty)) {
      result.preservedExistingClaimSummaries += 1;
      continue;
    }

    await prisma.claim.update({
      data: { summary, uncertainty },
      where: { id: claim.id }
    });

    result.generatedClaimSummaries += 1;
    if (!hasClaimSourceContext(claim)) {
      result.sparseClaimSummaries += 1;
    }
  }

  const interventions = await prisma.intervention.findMany({
    include: GENERATED_INTERVENTION_INCLUDE,
    orderBy: { name: "asc" }
  });

  result.totalInterventions = interventions.length;

  for (const intervention of interventions) {
    if (priorityInterventionIds.has(intervention.id)) {
      result.preservedPriorityInterventionSummaries += 1;
      continue;
    }

    await prisma.intervention.update({
      data: { evidenceSummary: buildGeneratedInterventionSummary(intervention) },
      where: { id: intervention.id }
    });
    result.generatedInterventionSummaries += 1;
  }

  return result;
}

function claimSummaryKey(interventionId: string, outcome: DbOutcomeArea) {
  return `${interventionId}:${outcome}`;
}

function shouldReplaceGeneratedClaimText(summary: string | null, uncertainty: string | null) {
  const currentSummary = cleanSummaryText(summary ?? "");
  const currentUncertainty = cleanSummaryText(uncertainty ?? "");

  return (
    !currentSummary ||
    !currentUncertainty ||
    currentSummary.startsWith("Draft local discovery claim created") ||
    currentSummary.startsWith("Source-packet scaffold") ||
    currentUncertainty.startsWith("Uncertainty remains because current local confidence") ||
    currentUncertainty.startsWith("Candidate clustering is heuristic") ||
    currentUncertainty.startsWith("This broad local source lead")
  );
}

function buildGeneratedInterventionSummary(intervention: GeneratedIntervention) {
  const claims = intervention.claims;
  const sourceClaimCount = claims.filter(
    (claim) => claim.references.length > 0 || claim.studyLinks.length > 0
  ).length;
  const sparseClaimCount = claims.length - sourceClaimCount;
  const strongestOutcomes = claims
    .filter((claim) => claim.references.length > 0 || claim.studyLinks.length > 0)
    .sort((left, right) => claimPriorityScore(right) - claimPriorityScore(left))
    .slice(0, 3)
    .map((claim) => OUTCOME_LABELS[claim.outcome]);
  const sourceText =
    sourceClaimCount > 0
      ? `${sourceClaimCount.toLocaleString()} of ${claims.length.toLocaleString()} scoped local claim${
          claims.length === 1 ? "" : "s"
        } have linked source or study context`
      : `none of the ${claims.length.toLocaleString()} scoped local claim${
          claims.length === 1 ? "" : "s"
        } has linked source or study context yet`;
  const outcomeText =
    strongestOutcomes.length > 0
      ? ` The most source-supported rows to read first are ${naturalJoin(strongestOutcomes)}.`
      : " The current dashboard record should be read as a placeholder rather than an evidence conclusion.";
  const sparseText =
    sparseClaimCount > 0
      ? ` ${sparseClaimCount.toLocaleString()} sparse row${
          sparseClaimCount === 1 ? " still needs" : "s still need"
        } source capture before stronger conclusions are possible.`
      : " All scoped rows have at least some local source linkage, but claim-specific certainty still depends on extraction quality.";

  return `${intervention.name} has ${sourceText}.${outcomeText}${sparseText} This summary is a local evidence-map synthesis, not medical advice or product-level AU/TGA clearance.`;
}

function buildGeneratedClaimSummary(claim: GeneratedClaim) {
  const outcome = OUTCOME_LABELS[claim.outcome];
  const sourceBasis = claimSourceBasisSentence(claim);
  const finding = bestStudyFinding(claim);

  if (isPeptideOrTherapeuticClaim(claim)) {
    return `${claim.intervention.name} is tracked for ${outcome} as a regulatory, safety, or therapeutic-watchlist evidence row. ${sourceBasis} The local record should be used only to track evidence and risk boundaries, not to guide sourcing, compounding, dosing, cycling, injection, or self-administration.`;
  }

  if (!hasClaimSourceContext(claim)) {
    return `${claim.intervention.name} has a local ${outcome} claim, but no linked curated reference or extracted study row is attached yet. The honest conclusion is that the dashboard does not yet have enough local evidence to support this outcome.`;
  }

  if (isSourceLeadClaim(claim)) {
    return `${claim.intervention.name} has source leads for ${outcome}, but this row is still evidence-intake work rather than a settled conclusion. ${sourceBasis}${finding ? ` Representative extracted text: ${finding}` : ""}`;
  }

  if (claim.outcome === DbOutcomeArea.SAFETY_ADVERSE_EFFECTS) {
    return `${claim.intervention.name} has local safety and tolerability context attached to this claim. ${sourceBasis}${finding ? ` Representative extracted text: ${finding}` : ""} Safety evidence is kept separate from efficacy and does not prove product-level safety.`;
  }

  if (
    claim.finalLabel === "INSUFFICIENT_EVIDENCE" ||
    claim.confidenceLevel === "LOW" ||
    claim.confidenceLevel === "VERY_LOW"
  ) {
    return `The local record does not yet support a settled ${outcome} conclusion for ${claim.intervention.name}. ${sourceBasis}${finding ? ` Representative extracted text: ${finding}` : ""} The current claim should be treated as low-certainty or hypothesis-generating.`;
  }

  return `${claim.claimText} ${sourceBasis}${finding ? ` Representative extracted text: ${finding}` : ""} Keep the conclusion scoped to the studied population, intervention form, comparator, and endpoint.`;
}

function buildGeneratedClaimUncertainty(claim: GeneratedClaim) {
  const confidence = CONFIDENCE_LABELS[claim.confidenceLevel];
  const label = FINAL_LABELS[claim.finalLabel];
  const uncertainties = new Set<string>();

  uncertainties.add(`current local confidence is ${confidence} and the displayed label is ${label}`);

  if (!hasClaimSourceContext(claim)) {
    uncertainties.add("no linked local reference or extracted study row is attached yet");
  }

  if (claim.references.length > 0 && claim.studyLinks.length === 0) {
    uncertainties.add("linked articles still need structured study extraction");
  }

  if (claim.studyLinks.length > 0 && !bestStudyFinding(claim)) {
    uncertainties.add("extracted study rows do not yet contain enough clean result text for a claim-level conclusion");
  }

  if (isSourceLeadClaim(claim)) {
    uncertainties.add("source relevance, intervention identity, outcome fit, and score rationale still need review");
  }

  if (claim.outcome === DbOutcomeArea.SAFETY_ADVERSE_EFFECTS) {
    uncertainties.add("safety context does not prove product-level safety, interaction safety, pregnancy safety, or TGA clearance");
  }

  if (isPeptideOrTherapeuticClaim(claim)) {
    uncertainties.add(
      "do not use this row for sourcing, compounding, reconstitution, injection, cycling, dosing, or self-administration guidance"
    );
  }

  uncertainties.add(
    "population, dose/form, duration, comparator, product quality, and AU/TGA product status remain claim-specific boundaries"
  );

  return `Uncertainty remains because ${naturalJoin([...uncertainties])}. What would change the score: ${claim.whatWouldChangeScore}`;
}

function claimSourceBasisSentence(claim: GeneratedClaim) {
  const references = uniqueById(claim.references.map((link) => link.reference));
  const studies = uniqueById(claim.studyLinks.map((link) => link.study));
  const studyTypeSummary = summarizeStudyTypes(studies.map((study) => study.sourceType));

  return `This is based on ${references.length.toLocaleString()} linked article${
    references.length === 1 ? "" : "s"
  } and ${studies.length.toLocaleString()} extracted study row${studies.length === 1 ? "" : "s"}${
    studyTypeSummary ? ` (${studyTypeSummary})` : ""
  }.`;
}

function hasClaimSourceContext(claim: GeneratedClaim) {
  return claim.references.length > 0 || claim.studyLinks.length > 0;
}

function isSourceLeadClaim(claim: GeneratedClaim) {
  const haystack = `${claim.claimText} ${claim.evidenceGrade} ${claim.summary ?? ""}`.toLowerCase();

  return (
    haystack.includes("accepted source leads") ||
    haystack.includes("need structured evidence review") ||
    haystack.includes("draft local discovery") ||
    haystack.includes("source-packet scaffold")
  );
}

function isPeptideOrTherapeuticClaim(claim: GeneratedClaim) {
  return (
    claim.intervention.category === "PEPTIDE_BIOLOGIC" ||
    claim.finalLabel === "REGULATORY_CONCERN" ||
    claim.finalLabel === "REQUIRES_CLINICIAN_OVERSIGHT"
  );
}

function claimPriorityScore(claim: {
  confidenceLevel: GeneratedClaim["confidenceLevel"];
  finalLabel: GeneratedClaim["finalLabel"];
  references: unknown[];
  studyLinks: unknown[];
}) {
  const confidenceScore: Record<GeneratedClaim["confidenceLevel"], number> = {
    HIGH: 4,
    MODERATE: 3,
    LOW: 2,
    VERY_LOW: 1
  };
  const labelPenalty = claim.finalLabel === "INSUFFICIENT_EVIDENCE" ? -2 : 0;

  return (
    confidenceScore[claim.confidenceLevel] +
    Math.min(claim.references.length + claim.studyLinks.length, 8) / 10 +
    labelPenalty
  );
}

function bestStudyFinding(claim: GeneratedClaim) {
  const findings = claim.studyLinks
    .map((link) => link.study)
    .map((study) => ({
      priority: studyTypePriority(study.sourceType) + Math.max((study.year ?? 0) - 2000, 0) / 100,
      text: usefulStudyFindingText(study)
    }))
    .filter((finding) => finding.text)
    .sort((left, right) => right.priority - left.priority);

  return findings[0]?.text ?? "";
}

function usefulStudyFindingText(study: GeneratedClaim["studyLinks"][number]["study"]) {
  const text =
    cleanSummaryText(study.mainResults ?? "") ||
    extractAbstractConclusion(study.abstract ?? "") ||
    "";
  const cleaned = cleanSummaryText(text);

  if (isLowValueFindingText(cleaned)) {
    return "";
  }

  return truncateAtWord(firstUsefulSentence(cleaned), 260);
}

function extractAbstractConclusion(value: string) {
  const abstractText = cleanSummaryText(value);
  const labelledSection = abstractText.match(
    /(?:CONCLUSIONS?|INTERPRETATION|FINDINGS|RESULTS):\s*(.+?)(?=\s[A-Z][A-Z /-]{2,}:|$)/i
  );

  return labelledSection?.[1]?.trim() ?? "";
}

function firstUsefulSentence(value: string) {
  const sentences =
    value
      .match(/[^.!?]+[.!?](?=\s|$)|[^.!?]+$/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean) ?? [];

  return (
    sentences.find(
      (sentence) =>
        !isStudySizeOnlySentence(sentence) &&
        !isBackgroundOnlySentence(sentence) &&
        !isMalformedFindingSentence(sentence)
    ) ?? ""
  );
}

function isLowValueFindingText(value: string) {
  const lowerValue = value.toLowerCase();

  return (
    !lowerValue ||
    lowerValue.includes("local source metadata links") ||
    lowerValue.includes("does not include a claim-specific effect estimate") ||
    lowerValue.includes("accepted source leads") ||
    lowerValue.includes("need structured evidence review") ||
    lowerValue.startsWith("objectives:") ||
    lowerValue.includes("aims to summarize and critically evaluate") ||
    lowerValue.startsWith("this randomized")
  );
}

function isStudySizeOnlySentence(value: string) {
  const lowerValue = value.toLowerCase();

  return (
    (lowerValue.includes("included") ||
      lowerValue.includes("contributed") ||
      lowerValue.includes("identified") ||
      lowerValue.includes("involving")) &&
    (lowerValue.includes("participants") ||
      lowerValue.includes("trials") ||
      lowerValue.includes("studies") ||
      lowerValue.includes("effect sizes"))
  );
}

function isBackgroundOnlySentence(value: string) {
  const lowerValue = value.toLowerCase().trim();

  return (
    lowerValue.startsWith("background") ||
    lowerValue.startsWith("background/objectives") ||
    lowerValue.startsWith("objective") ||
    lowerValue.startsWith("objectives") ||
    lowerValue.startsWith("purpose") ||
    lowerValue.startsWith("methods") ||
    lowerValue.startsWith("introduction") ||
    lowerValue.includes("this review aims") ||
    lowerValue.includes("was conducted to investigate") ||
    lowerValue.includes("research in sport, military, and aerospace populations has shown")
  );
}

function isMalformedFindingSentence(value: string) {
  const trimmed = value.trim();

  return trimmed.length < 30 || /^[\d).,;:<>%=\s-]+$/.test(trimmed);
}

function cleanSummaryText(value: string) {
  return decodeHtmlEntities(value)
    .replace(/^Local abstract\/source metadata reports:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, codePoint: string) =>
      String.fromCodePoint(Number.parseInt(codePoint, 16))
    )
    .replace(/&#(\d+);/g, (_match, codePoint: string) =>
      String.fromCodePoint(Number.parseInt(codePoint, 10))
    )
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

function truncateAtWord(value: string, maxLength: number) {
  const trimmed = value.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  const clipped = trimmed.slice(0, maxLength);
  const lastSpace = clipped.lastIndexOf(" ");
  const safeClip = lastSpace > maxLength * 0.6 ? clipped.slice(0, lastSpace) : clipped;

  return `${safeClip.replace(/[,.!?;:]$/, "")}...`;
}

function summarizeStudyTypes(studyTypes: DbStudyType[]) {
  const counts = new Map<string, number>();

  for (const type of studyTypes) {
    const label = studyTypeLabel(type);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([label, count]) => `${count} ${count === 1 ? label : pluralStudyTypeLabel(label)}`)
    .join(", ");
}

function studyTypeLabel(type: DbStudyType) {
  switch (type) {
    case DbStudyType.ANIMAL_STUDY:
      return "animal study";
    case DbStudyType.CASE_REPORT:
      return "case report";
    case DbStudyType.CLINICAL_TRIAL_RECORD:
      return "clinical trial record";
    case DbStudyType.IN_VITRO_MECHANISTIC:
      return "in vitro/mechanistic study";
    case DbStudyType.META_ANALYSIS:
      return "meta-analysis";
    case DbStudyType.OBSERVATIONAL_COHORT:
      return "observational cohort";
    case DbStudyType.RANDOMIZED_CONTROLLED_TRIAL:
      return "RCT";
    case DbStudyType.REGULATORY_SAFETY_WARNING:
      return "regulatory safety warning";
    case DbStudyType.SYSTEMATIC_REVIEW:
      return "systematic review";
  }
}

function pluralStudyTypeLabel(label: string) {
  switch (label) {
    case "meta-analysis":
      return "meta-analyses";
    case "systematic review":
      return "systematic reviews";
    case "observational cohort":
      return "observational cohorts";
    case "case report":
      return "case reports";
    case "animal study":
      return "animal studies";
    case "in vitro/mechanistic study":
      return "in vitro/mechanistic studies";
    case "clinical trial record":
      return "clinical trial records";
    case "regulatory safety warning":
      return "regulatory safety warnings";
    case "RCT":
      return "RCTs";
    default:
      return `${label}s`;
  }
}

function studyTypePriority(type: DbStudyType) {
  switch (type) {
    case DbStudyType.META_ANALYSIS:
      return 5;
    case DbStudyType.SYSTEMATIC_REVIEW:
      return 4;
    case DbStudyType.RANDOMIZED_CONTROLLED_TRIAL:
      return 3;
    case DbStudyType.OBSERVATIONAL_COHORT:
      return 2.5;
    case DbStudyType.CLINICAL_TRIAL_RECORD:
      return 2;
    case DbStudyType.CASE_REPORT:
      return 1.5;
    case DbStudyType.REGULATORY_SAFETY_WARNING:
      return 1;
    case DbStudyType.ANIMAL_STUDY:
    case DbStudyType.IN_VITRO_MECHANISTIC:
      return 0.5;
  }
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function naturalJoin(items: string[]) {
  if (items.length === 0) {
    return "";
  }

  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

async function main() {
  const tracks = readTracks(process.argv.slice(2));
  const result: Record<string, unknown> = {};

  if (tracks.has("depth")) {
    result.depth = await deepenTop10();
  }

  if (tracks.has("au")) {
    result.au = await upgradeGenericAuRows();
  }

  if (tracks.has("summaries")) {
    result.summaries = {
      generated: await applyGeneratedEvidenceSummaries(),
      priority: await applyPriorityEvidenceSummaries()
    };
  }

  console.log(JSON.stringify(result, null, 2));
}

function readTracks(args: string[]) {
  const trackArg = args.find((arg) => arg.startsWith("--tracks="));
  if (!trackArg) {
    return new Set(["depth", "au"]);
  }

  return new Set(
    trackArg
      .slice("--tracks=".length)
      .split(",")
      .map((track) => track.trim())
      .filter((track) => track === "depth" || track === "au" || track === "summaries")
  );
}

withProcessEnv(process.env, () =>
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    })
);
