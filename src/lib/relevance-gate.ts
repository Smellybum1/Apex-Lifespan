import {
  findInterventionIdentityMatch,
  containsIdentityTerm,
  normaliseForMatch,
  type InterventionIdentityInput,
  type InterventionIdentityMatch
} from "@/lib/intervention-identity";
import {
  studySourceTypeCommandHintFromText,
  type StudySourceTypeCommandHint
} from "@/lib/study-source-type-hints";
import type { OutcomeArea } from "@/lib/types";

/**
 * Decides whether a discovered source is evidence for the intervention it was
 * filed under, without a human reading it.
 *
 * This replaces triage-by-score. `triageScore` was never a relevance signal: in
 * the 70–89 band where most accepts live, only 55–61% were actually accepted, so
 * auto-accepting on it would admit roughly two wrong papers for every three
 * right ones. The gate asks four separate questions instead, each of which can
 * be checked against the text.
 *
 * Three verdicts, and the third is the important one. `undecided` means the gate
 * has no basis to answer — it is routed to the LLM relevance check, never
 * silently accepted and never quietly dropped. Guessing in either direction is
 * what produced a catalog whose scores nobody can stand behind.
 */

export type RelevanceVerdict = "accept" | "reject" | "undecided";

export type RelevanceGateSource = "PUBMED" | "CLINICALTRIALS_GOV";

export interface RelevanceGateInput {
  abstract?: string | null;
  intervention: InterventionIdentityInput;
  /** PubMed `publicationTypes`, or the registry's own design fields. */
  publicationTypes?: string[];
  source: RelevanceGateSource;
  title?: string | null;
}

export interface RelevanceGateResult {
  design?: StudySourceTypeCommandHint;
  identity?: InterventionIdentityMatch;
  outcome?: OutcomeArea;
  /** Every check that fired, in the order it was evaluated. */
  reasons: string[];
  trapTerm?: string;
  verdict: RelevanceVerdict;
}

/**
 * Terms whose presence means the supplement name in the text is a biomarker, a
 * drug class, or a different substance sharing the name — not the supplement
 * being studied.
 *
 * A trap only fires when no supplement context is also present, because a paper
 * can legitimately measure serum creatinine *in* a creatine supplementation
 * trial. The trap answers "is the supplement the subject", not "is the word
 * present".
 *
 * Keyed by slug. `LOCAL_BENEFIT_DISCOVERY_CONTEXT_RULES` in
 * `local-ingestion-control.ts` encodes the same idea for the benefit-discovery
 * lane but is keyed by intervention id, which only resolves for seeded rows.
 * That table should fold into this one; until it does, a term added there does
 * not protect this gate and vice versa.
 */
export const INTERVENTION_TRAP_RULES: Record<
  string,
  { supplementTerms: string[]; trapTerms: string[] }
> = {
  caffeine: {
    supplementTerms: ["caffeine supplementation", "caffeine ingestion", "oral caffeine"],
    // Neonatal apnoea drug, given IV. Not the supplement.
    trapTerms: ["caffeine citrate"]
  },
  calcium: {
    supplementTerms: [
      "calcium supplementation",
      "calcium supplement",
      "calcium carbonate",
      "calcium citrate",
      "dietary calcium",
      "oral calcium"
    ],
    trapTerms: [
      "calcium antagonist",
      "calcium channel blocker",
      "calcium score",
      "calcium scoring",
      "calcification",
      "calcified",
      "coronary artery calcium",
      "coronary calcium",
      "intracellular calcium",
      // IV calcium in cardiac surgery is a resuscitation drug, not a supplement.
      "intravenous calcium",
      "calcium chloride",
      "calcium gluconate",
      "serum calcium",
      "vascular calcification"
    ]
  },
  "creatine-monohydrate": {
    supplementTerms: [
      "creatine supplementation",
      "creatine monohydrate",
      "creatine loading",
      "oral creatine",
      "creatine supplement"
    ],
    // The known contamination case. "creatine kinase" clears a word-boundary
    // check because the boundary is a space, so identity matching alone cannot
    // reject a statin-myopathy trial that measures it.
    trapTerms: [
      "creatine kinase",
      "creatine phosphokinase",
      "phosphocreatine",
      "creatine phosphate",
      "serum creatine",
      "urinary creatine",
      "creatine transporter deficiency"
    ]
  },
  "folic-acid": {
    supplementTerms: [
      "folic acid supplementation",
      "folate supplementation",
      "folic acid supplement",
      "dietary folate",
      "methylfolate"
    ],
    trapTerms: [
      "folate concentration",
      "folate deficiency",
      "folate level",
      "folate status",
      "serum folate",
      "red cell folate"
    ]
  },
  glycine: {
    supplementTerms: ["glycine supplementation", "oral glycine", "glycine ingestion"],
    // "Glycine max" is the soybean. "Glycine receptor" and the transporter are
    // neuroscience targets, not a supplement being administered.
    trapTerms: ["glycine max", "glycine receptor", "glycine transporter", "glycine cleavage"]
  },
  iron: {
    supplementTerms: [
      "iron supplementation",
      "iron supplement",
      "ferrous sulfate",
      "ferrous bisglycinate",
      "oral iron",
      "iron fortification"
    ],
    trapTerms: ["iron chelation", "iron overload", "serum iron", "iron deposition"]
  },
  "lithium-orotate": {
    supplementTerms: ["lithium orotate", "low-dose lithium"],
    // Psychiatric lithium is a prescription salt at a different dose entirely.
    trapTerms: ["lithium carbonate", "lithium toxicity", "serum lithium", "lithium battery"]
  },
  magnesium: {
    supplementTerms: [
      "magnesium supplementation",
      "magnesium supplement",
      "magnesium glycinate",
      "magnesium citrate",
      "magnesium oxide",
      "dietary magnesium",
      "oral magnesium"
    ],
    // IV magnesium sulfate in eclampsia and cardiac arrhythmia is a drug.
    trapTerms: [
      "magnesium sulfate",
      "magnesium sulphate",
      "serum magnesium",
      "magnesium deficiency"
    ]
  },
  taurine: {
    supplementTerms: ["taurine supplementation", "oral taurine"],
    trapTerms: ["taurine transporter", "taurine deficiency"]
  },
  "vitamin-c": {
    supplementTerms: [
      "vitamin c supplementation",
      "ascorbic acid supplementation",
      "oral vitamin c",
      "sodium ascorbate"
    ],
    // High-dose IV ascorbate in oncology is a pharmacological intervention.
    trapTerms: ["intravenous vitamin c", "intravenous ascorbate", "plasma ascorbate"]
  },
  "vitamin-d": {
    supplementTerms: [
      "vitamin d supplementation",
      "vitamin d supplement",
      "cholecalciferol",
      "ergocalciferol",
      "oral vitamin d"
    ],
    trapTerms: [
      "vitamin d status",
      "vitamin d deficiency",
      "serum 25 hydroxyvitamin d",
      "vitamin d receptor",
      "vitamin d binding protein"
    ]
  },
  zinc: {
    supplementTerms: [
      "zinc supplementation",
      "zinc supplement",
      "zinc gluconate",
      "zinc citrate",
      "zinc picolinate",
      "oral zinc"
    ],
    trapTerms: ["zinc finger", "zinc transporter", "serum zinc", "zinc oxide nanoparticle"]
  }
};

/**
 * Designs the gate will accept unattended. Everything here is either a
 * controlled comparison or a registered protocol, so a claim built on it can
 * name its design honestly.
 */
const ACCEPTABLE_DESIGNS = new Set<StudySourceTypeCommandHint>([
  "meta-analysis",
  "systematic-review",
  "randomized-controlled-trial",
  "clinical-trial-record"
]);

/**
 * Designs that cannot support a human claim regardless of quality. A mouse study
 * is not weak human evidence, it is not human evidence.
 */
const REJECTED_DESIGNS = new Set<StudySourceTypeCommandHint>([
  "animal-study",
  "in-vitro-mechanistic",
  "case-report"
]);

/**
 * Keywords per outcome area. Only used to answer "does this paper report an
 * outcome the catalog tracks" — never to decide direction or effect.
 */
const OUTCOME_KEYWORDS: Record<OutcomeArea, string[]> = {
  "Mortality/lifespan": ["mortality", "all cause death", "survival", "lifespan", "longevity"],
  "Cardiovascular events": [
    "cardiovascular event",
    "myocardial infarction",
    "stroke",
    "major adverse cardiovascular",
    "heart failure",
    "coronary heart disease"
  ],
  "LDL/ApoB/lipids": [
    "ldl",
    "ldl cholesterol",
    "apob",
    "apolipoprotein b",
    "triglyceride",
    "lipid profile",
    "total cholesterol",
    "hdl"
  ],
  "Blood pressure": [
    "blood pressure",
    "systolic",
    "diastolic",
    "hypertension",
    "antihypertensive"
  ],
  "Glucose/insulin/HbA1c": [
    "hba1c",
    "glycated haemoglobin",
    "glycated hemoglobin",
    "fasting glucose",
    "insulin resistance",
    "homa ir",
    "glycaemic control",
    "glycemic control",
    "type 2 diabetes"
  ],
  Inflammation: [
    "c reactive protein",
    "crp",
    "interleukin 6",
    "tnf alpha",
    "inflammatory marker",
    "inflammation"
  ],
  Cognition: [
    "cognition",
    "cognitive function",
    "cognitive performance",
    "memory",
    "executive function",
    "dementia",
    "alzheimer"
  ],
  Sleep: ["sleep quality", "sleep onset", "insomnia", "sleep efficiency", "sleep duration"],
  "Mood/stress": [
    "depression",
    "depressive symptom",
    "anxiety",
    "mood",
    "perceived stress",
    "cortisol"
  ],
  "Muscle/strength": [
    "lean mass",
    "muscle mass",
    "muscle strength",
    "resistance training",
    "sarcopenia",
    "grip strength",
    "hypertrophy"
  ],
  "VO2 max/endurance": [
    "vo 2 max",
    "vo 2 peak",
    "aerobic capacity",
    "endurance performance",
    "time to exhaustion",
    "exercise capacity"
  ],
  "Joint/tendon/skin": [
    "osteoarthritis",
    "joint pain",
    "tendon",
    "skin elasticity",
    "wrinkle",
    "wound healing",
    "cartilage"
  ],
  "Eye health": [
    "macular",
    "visual acuity",
    "retina",
    "age related macular degeneration",
    "dry eye",
    "contrast sensitivity"
  ],
  "Immune/respiratory": [
    "respiratory tract infection",
    "common cold",
    "immune function",
    "influenza",
    "pneumonia",
    "covid 19"
  ],
  "Fertility/hormones": [
    "testosterone",
    "sperm",
    "fertility",
    "menopause",
    "oestrogen",
    "estrogen",
    "polycystic ovary"
  ],
  "Biological aging clocks": [
    "epigenetic age",
    "dna methylation age",
    "telomere",
    "biological age",
    "senescence"
  ],
  "Safety/adverse effects": [
    "adverse event",
    "adverse effect",
    "safety profile",
    "tolerability",
    "toxicity",
    "side effect"
  ]
};

function detectTrapTerm(
  slug: string | undefined,
  haystack: string
): { supplementContext: boolean; trapTerm: string } | undefined {
  const rule = slug ? INTERVENTION_TRAP_RULES[slug] : undefined;

  if (!rule) {
    return undefined;
  }

  const trapTerm = rule.trapTerms
    .map(normaliseForMatch)
    .find((term) => containsIdentityTerm(haystack, term));

  if (!trapTerm) {
    return undefined;
  }

  const supplementContext = rule.supplementTerms
    .map(normaliseForMatch)
    .some((term) => containsIdentityTerm(haystack, term));

  return { supplementContext, trapTerm };
}

/** Strongest first: a paper tagged both "Journal Article" and "Meta-Analysis" is
 * a meta-analysis. */
const DESIGN_PRECEDENCE: StudySourceTypeCommandHint[] = [
  "meta-analysis",
  "systematic-review",
  "randomized-controlled-trial",
  "clinical-trial-record",
  "observational-cohort",
  "case-report",
  "animal-study",
  "in-vitro-mechanistic"
];

export function detectStudyDesign(
  publicationTypes: string[],
  source: RelevanceGateSource
): StudySourceTypeCommandHint | undefined {
  const hints = publicationTypes
    .map((value) => studySourceTypeCommandHintFromText(value))
    .filter((hint): hint is StudySourceTypeCommandHint => Boolean(hint));

  for (const preferred of DESIGN_PRECEDENCE) {
    if (hints.includes(preferred)) {
      return preferred;
    }
  }

  // A ClinicalTrials.gov record is a registered protocol by definition, even
  // when its own fields say nothing about design.
  return source === "CLINICALTRIALS_GOV" ? "clinical-trial-record" : undefined;
}

export function detectOutcomeArea(haystack: string): OutcomeArea | undefined {
  for (const [outcome, keywords] of Object.entries(OUTCOME_KEYWORDS) as Array<
    [OutcomeArea, string[]]
  >) {
    if (keywords.map(normaliseForMatch).some((term) => containsIdentityTerm(haystack, term))) {
      return outcome;
    }
  }

  return undefined;
}

export function evaluateRelevance({
  abstract,
  intervention,
  publicationTypes = [],
  source,
  title
}: RelevanceGateInput): RelevanceGateResult {
  const reasons: string[] = [];
  const haystack = normaliseForMatch([title ?? "", abstract ?? ""].join(" "));

  // 1. Identity. Nothing downstream is worth checking if the paper is not about
  //    this intervention.
  const identity = findInterventionIdentityMatch({ abstract, intervention, title });

  if (!identity) {
    // A title that does not name the intervention is only evidence of absence
    // when there was an abstract to check as well. Roughly a third of on-target
    // papers never name their intervention in the title, so rejecting on a
    // title-only miss would discard them for having no stored abstract rather
    // than for being irrelevant — punishing the catalog's gaps, not the paper.
    if (!abstract || abstract.trim().length === 0) {
      return {
        reasons: [
          "The title does not name this intervention and no abstract is stored, so there is nothing to check it against."
        ],
        verdict: "undecided"
      };
    }

    return {
      reasons: ["Neither the title nor the abstract names this intervention or a known synonym."],
      verdict: "reject"
    };
  }

  reasons.push(`Identity: matched "${identity.matchedTerm}" in the ${identity.field}.`);

  // 2. Trap terms. The name is present but may be a biomarker or a different
  //    substance sharing it.
  const trap = detectTrapTerm(intervention.slug, haystack);

  if (trap && !trap.supplementContext) {
    return {
      identity,
      reasons: [
        ...reasons,
        `Trap: "${trap.trapTerm}" is present with no sign the supplement was administered, so the name is a biomarker or a different substance.`
      ],
      trapTerm: trap.trapTerm,
      verdict: "reject"
    };
  }

  if (trap) {
    reasons.push(
      `Trap "${trap.trapTerm}" is present but so is supplement context, so it is measured rather than mistaken.`
    );
  }

  // 3. Design.
  const design = detectStudyDesign(publicationTypes, source);

  if (design && REJECTED_DESIGNS.has(design)) {
    return {
      design,
      identity,
      reasons: [...reasons, `Design: ${design} cannot support a claim about people.`],
      trapTerm: trap?.trapTerm,
      verdict: "reject"
    };
  }

  // 4. Outcome.
  const outcome = detectOutcomeArea(haystack);

  if (!design) {
    return {
      identity,
      outcome,
      reasons: [
        ...reasons,
        "Design: no publication type resolved to a known design, so rigor cannot be judged here."
      ],
      trapTerm: trap?.trapTerm,
      verdict: "undecided"
    };
  }

  if (!ACCEPTABLE_DESIGNS.has(design)) {
    // Observational cohorts land here. The plan called for RCT/SR/MA/registry
    // only, and auto-accepting a cohort would overstate what it shows — but
    // rejecting outright would discard most of the mortality and lifespan
    // literature, which is overwhelmingly observational. Undecided sends it to
    // the LLM check, which honours the plan without burning the evidence.
    return {
      design,
      identity,
      outcome,
      reasons: [
        ...reasons,
        `Design: ${design} is real evidence but weaker than this gate accepts unattended.`
      ],
      trapTerm: trap?.trapTerm,
      verdict: "undecided"
    };
  }

  reasons.push(`Design: ${design}.`);

  if (!outcome) {
    return {
      design,
      identity,
      reasons: [
        ...reasons,
        "Outcome: no tracked outcome area was named, so there is nowhere to file the finding."
      ],
      trapTerm: trap?.trapTerm,
      verdict: "undecided"
    };
  }

  reasons.push(`Outcome: ${outcome}.`);

  // An abstract can name an intervention it is not about: as a comparator, as
  // background, as the other arm. Measured against reviewer decisions, this was
  // the gate's single biggest source of wrong accepts — a tirzepatide trial
  // filed under semaglutide, an ashwagandha review filed under ginseng, a
  // polyphenol review filed under quercetin. Every one matched on the abstract
  // and none was about the intervention it was filed under.
  //
  // A title is a claim of subject; an abstract mention is not. So an
  // abstract-only match is exactly the case the LLM relevance check exists for.
  if (identity.field === "abstract") {
    return {
      design,
      identity,
      outcome,
      reasons: [
        ...reasons,
        "Identity rests on the abstract rather than the title, so the intervention may be a comparator or background mention."
      ],
      trapTerm: trap?.trapTerm,
      verdict: "undecided"
    };
  }

  return {
    design,
    identity,
    outcome,
    reasons,
    trapTerm: trap?.trapTerm,
    verdict: "accept"
  };
}
