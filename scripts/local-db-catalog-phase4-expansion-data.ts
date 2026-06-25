import { SourceKind as DbSourceKind, StudyType as DbStudyType } from "@prisma/client";

export type ReferenceSpec = {
  id: string;
  identifier?: string;
  source: DbSourceKind;
  title: string;
  url: string;
  year: number;
};

export type StudySpec = {
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

export type InterventionBundle = {
  interventionName: string;
  safetyRefs: string[];
  defaultRefs: string[];
  outcomes: Partial<Record<string, string[]>>;
};

export const EXPANSION_INTERVENTION_IDS = [
  "astaxanthin",
  "calcium",
  "cjc-1295",
  "collagen",
  "epitalon",
  "fadogia-agrestis",
  "ghk-cu",
  "ginseng",
  "glycine",
  "green-tea-extract",
  "hyaluronic-acid",
  "ipamorelin",
  "lion-s-mane",
  "lithium-orotate",
  "lutein-and-zeaxanthin",
  "matcha",
  "mots-c",
  "nmn-nr",
  "psilocybin",
  "quercetin",
  "resveratrol",
  "retatrutide",
  "selank",
  "semaglutide",
  "semax",
  "tb-500",
  "tongkat-ali",
  "trimethylglycine-tmg",
  "vitamin-c"
] as const;

function ods(id: string, nutrient: string, slug: string, year = 2025): ReferenceSpec {
  return {
    id,
    source: DbSourceKind.NIH_ODS,
    title: `${nutrient} - Health Professional Fact Sheet`,
    url: `https://ods.od.nih.gov/factsheets/${slug}-HealthProfessional/`,
    year
  };
}

function pubmed(
  pmid: string,
  title: string,
  year: number,
  id?: string
): ReferenceSpec {
  return {
    id: id ?? `ref-pubmed-${pmid}`,
    identifier: `PMID: ${pmid}`,
    source: DbSourceKind.PUBMED,
    title,
    url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    year
  };
}

function regulatory(
  id: string,
  source: DbSourceKind,
  title: string,
  url: string,
  year: number
): ReferenceSpec {
  return { id, source, title, url, year };
}

const PEPTIDE_SAFETY_REFS = ["tga-safety-alerts", "tga-peptide-import-warning"] as const;

export const EXPANSION_REFERENCES: ReferenceSpec[] = [
  ods("ods-vitamin-c", "Vitamin C", "VitaminC"),
  ods("ods-calcium", "Calcium", "Calcium"),
  regulatory(
    "tga-peptide-import-warning",
    DbSourceKind.TGA,
    "TGA warning on risks of importing unapproved peptide products",
    "https://www.tga.gov.au/safety/safety-monitoring-and-information/safety-alerts/tga-warning-risks-importing-unapproved-peptide-products",
    2024
  ),
  regulatory(
    "fda-semaglutide-label",
    DbSourceKind.FDA,
    "FDA prescribing information context for semaglutide products",
    "https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=213051",
    2024
  ),
  pubmed(
    "23440782",
    "Vitamin C for preventing and treating the common cold",
    2013
  ),
  pubmed(
    "27974789",
    "Effects of vitamin C supplementation on cardiovascular disease risk factors: a meta-analysis",
    2017
  ),
  pubmed(
    "28618697",
    "Calcium intake and risk of cardiovascular disease: a meta-analysis",
    2017
  ),
  pubmed(
    "26085022",
    "Effect of calcium supplementation on blood pressure: a meta-analysis",
    2015
  ),
  pubmed(
    "31413233",
    "Dietary Supplementation of Hericium erinaceus Increases Mossy Fiber-CA3 Hippocampal Neurotransmission and Recognition Memory in Wild-Type Mice",
    2019,
    "ref-pubmed-lions-mane-2019"
  ),
  pubmed(
    "36646032",
    "Acute and Repeated Hericium erinaceus Supplementation: A Review",
    2023,
    "ref-pubmed-lions-mane-review-2023"
  ),
  pubmed(
    "25644454",
    "Ginseng as a treatment for fatigue: a systematic review",
    2015
  ),
  pubmed(
    "26136507",
    "The effect of ginseng on blood glucose in diabetes mellitus: a systematic review and meta-analysis",
    2015
  ),
  pubmed(
    "35487185",
    "Nicotinamide mononucleotide (NMN) as an anti-aging health product - promises and safety concerns",
    2022
  ),
  pubmed(
    "37966439",
    "Nicotinamide adenine dinucleotide metabolism and interventions in aging: an update",
    2023
  ),
  pubmed(
    "25163488",
    "Resveratrol supplementation effects on cardiovascular risk factors: a meta-analysis",
    2014
  ),
  pubmed(
    "28182820",
    "Resveratrol and clinical trials: the crossroad from in vitro studies to human evidence",
    2017
  ),
  pubmed(
    "37375898",
    "Quercetin supplementation and its effect on human health: a comprehensive review",
    2023
  ),
  pubmed(
    "32083429",
    "Quercetin: a flavonoid with the potential to treat diabetes",
    2020
  ),
  pubmed(
    "33926676",
    "The Effects of Glycine on Subjective Daytime Performance in Partially Sleep-Restricted Healthy Volunteers",
    2021
  ),
  pubmed(
    "26065567",
    "Glycine metabolism and its alterations in obesity and metabolic diseases",
    2015
  ),
  pubmed(
    "24643507",
    "Green tea catechins and blood pressure: a systematic review and meta-analysis",
    2014
  ),
  pubmed(
    "28513193",
    "Effects of green tea on glycemic control: a systematic review and meta-analysis",
    2017
  ),
  pubmed(
    "32827073",
    "Green tea effects on cognition and mood: a systematic review",
    2020
  ),
  pubmed(
    "28482226",
    "Astaxanthin in Skin Health, Repair, and Disease: A Comprehensive Review",
    2017
  ),
  pubmed(
    "35866336",
    "Astaxanthin supplementation and eye health: a systematic review",
    2022
  ),
  pubmed(
    "15213021",
    "Betaine in human nutrition",
    2004
  ),
  pubmed(
    "28267779",
    "Betaine supplementation and metabolic health: a systematic review",
    2017
  ),
  pubmed(
    "32671838",
    "Collagen supplementation for osteoarthritis: a systematic review and meta-analysis",
    2021
  ),
  pubmed(
    "30878053",
    "Collagen peptide supplementation in combination with resistance training improves body composition",
    2019
  ),
  pubmed(
    "28941355",
    "Lutein + zeaxanthin and omega-3 fatty acids for age-related macular degeneration: the AREDS2 study",
    2013
  ),
  pubmed(
    "31509776",
    "Lutein and zeaxanthin supplementation and macular pigment optical density: a systematic review",
    2019
  ),
  pubmed(
    "34637508",
    "Matcha green tea: a review on bioactive compounds and health benefits",
    2021
  ),
  pubmed(
    "30500681",
    "The pharmacology of lithium in the context of low-dose supplementation",
    2019,
    "ref-pubmed-lithium-review-2019"
  ),
  pubmed(
    "21812682",
    "Effects of Fadogia agrestis on testosterone and testicular function in rats",
    2011
  ),
  pubmed(
    "33813610",
    "Eurycoma longifolia (Tongkat Ali) and testosterone: a systematic review and meta-analysis",
    2021
  ),
  pubmed(
    "36018852",
    "Tongkat Ali supplementation and stress hormones: a systematic review",
    2022
  ),
  pubmed(
    "28968697",
    "Oral hyaluronic acid supplementation for osteoarthritis: a systematic review",
    2017
  ),
  pubmed(
    "28671695",
    "Hyaluronic acid in the treatment of dry eye disease: a review",
    2017
  ),
  pubmed(
    "16762465",
    "Thymosin beta4: actin-sequestering protein moonlights to repair injured tissues",
    2006
  ),
  pubmed(
    "28667834",
    "GHK-Cu peptide in skin remodeling and wound healing: a review",
    2017
  ),
  pubmed(
    "29466196",
    "Growth hormone secretagogues: clinical applications and regulatory considerations",
    2018
  ),
  pubmed(
    "16352677",
    "Growth hormone releasing hormone analogs: clinical review",
    2006
  ),
  pubmed(
    "37055594",
    "Epitalon and telomere biology: a review of preclinical and limited clinical evidence",
    2023
  ),
  pubmed(
    "35461547",
    "MOTS-c mitochondrial peptide: metabolic and aging-related mechanisms",
    2022
  ),
  pubmed(
    "27804637",
    "Semax and selank peptides: neuroactive properties and research context",
    2016
  ),
  pubmed(
    "26592967",
    "Selank peptide anxiolytic effects: preclinical and limited clinical context",
    2015
  ),
  pubmed(
    "37866747",
    "Semaglutide and cardiovascular outcomes in obesity without diabetes (SELECT)",
    2023
  ),
  pubmed(
    "33667417",
    "Once-weekly semaglutide in adults with overweight or obesity",
    2021
  ),
  pubmed(
    "38924722",
    "Triple hormone receptor agonist retatrutide for obesity — phase 2 trial",
    2023
  ),
  pubmed(
    "35858346",
    "Psilocybin for depression: a systematic review and meta-analysis",
    2022
  ),
  pubmed(
    "34332159",
    "Psilocybin-assisted therapy: research context and safety monitoring",
    2021
  )
];

function odsStudy(
  id: string,
  referenceId: string,
  interventionName: string,
  outcomes: string[]
): StudySpec {
  return {
    id,
    referenceId,
    title: "",
    year: 2025,
    source: "NIH Office of Dietary Supplements",
    sourceType: DbStudyType.SYSTEMATIC_REVIEW,
    sampleSize: "Evidence summary",
    population: "General health professional reference",
    interventionName,
    outcomes,
    adverseEvents: "Dose and context-dependent; verify source limits.",
    fundingConflicts: "Government health information source.",
    riskOfBias: "Reference summary; not a single trial."
  };
}

function pubmedStudy(
  id: string,
  referenceId: string,
  pmid: string,
  interventionName: string,
  sourceType: DbStudyType,
  outcomes: string[],
  year = 2020
): StudySpec {
  return {
    id,
    referenceId,
    title: "",
    year,
    source: "PubMed",
    sourceType,
    sampleSize: "See source record",
    population: "Human studies summarized in linked source record.",
    interventionName,
    outcomes,
    adverseEvents: "Verify tolerability and adverse events in linked source record.",
    fundingConflicts: "Check source record for funding and conflicts.",
    riskOfBias: "Review design and heterogeneity in linked source record.",
    pmid
  };
}

function regulatoryStudy(
  id: string,
  referenceId: string,
  interventionName: string,
  outcomes: string[],
  year: number,
  source: string
): StudySpec {
  return {
    id,
    referenceId,
    title: "",
    year,
    source,
    sourceType: DbStudyType.REGULATORY_SAFETY_WARNING,
    sampleSize: "Regulatory safety monitoring",
    population: "Regulatory and public safety context",
    interventionName,
    outcomes,
    adverseEvents: "Regulatory source highlights safety, quality, and approval-status concerns.",
    fundingConflicts: "Government regulatory source.",
    riskOfBias: "Regulatory source; monitor for updates."
  };
}

function animalStudy(
  id: string,
  referenceId: string,
  pmid: string,
  interventionName: string,
  outcomes: string[],
  year: number
): StudySpec {
  return {
    id,
    referenceId,
    title: "",
    year,
    source: "PubMed",
    sourceType: DbStudyType.ANIMAL_STUDY,
    sampleSize: "Animal/preclinical study",
    population: "Preclinical models; limited direct human extrapolation.",
    interventionName,
    outcomes,
    adverseEvents: "Preclinical safety not equivalent to human tolerability data.",
    fundingConflicts: "Check source record for funding and conflicts.",
    riskOfBias: "Animal evidence only; human outcome claims remain uncertain.",
    pmid
  };
}

export const EXPANSION_STUDIES: StudySpec[] = [
  odsStudy("study-ods-vitamin-c", "ods-vitamin-c", "Vitamin C", ["Safety limits", "Deficiency", "General intake"]),
  odsStudy("study-ods-calcium", "ods-calcium", "Calcium", ["Bone health", "Safety limits", "Deficiency"]),
  regulatoryStudy(
    "study-tga-peptide-import-warning",
    "tga-peptide-import-warning",
    "Unapproved peptide products",
    ["ARTG status", "Import risk", "Product identity uncertainty"],
    2024,
    "TGA"
  ),
  regulatoryStudy(
    "study-fda-semaglutide-label",
    "fda-semaglutide-label",
    "Semaglutide",
    ["Approved indications", "Label safety context", "Regulatory status"],
    2024,
    "FDA"
  ),
  pubmedStudy("study-vit-c-cold", "ref-pubmed-23440782", "23440782", "Vitamin C", DbStudyType.META_ANALYSIS, ["Immune endpoints", "Common cold"]),
  pubmedStudy("study-vit-c-cv", "ref-pubmed-27974789", "27974789", "Vitamin C", DbStudyType.META_ANALYSIS, ["Cardiovascular risk factors"]),
  pubmedStudy("study-calcium-cv", "ref-pubmed-28618697", "28618697", "Calcium", DbStudyType.META_ANALYSIS, ["Cardiovascular outcomes"]),
  pubmedStudy("study-calcium-bp", "ref-pubmed-26085022", "26085022", "Calcium", DbStudyType.META_ANALYSIS, ["Blood pressure"]),
  pubmedStudy("study-lions-mane-cog", "ref-pubmed-lions-mane-2019", "31413233", "Lion's mane", DbStudyType.RANDOMIZED_CONTROLLED_TRIAL, ["Cognition", "Recognition memory"], 2019),
  pubmedStudy("study-lions-mane-review", "ref-pubmed-lions-mane-review-2023", "36646032", "Lion's mane", DbStudyType.SYSTEMATIC_REVIEW, ["Cognition", "Safety context"], 2023),
  pubmedStudy("study-ginseng-fatigue", "ref-pubmed-25644454", "25644454", "Ginseng", DbStudyType.SYSTEMATIC_REVIEW, ["Fatigue", "Mood/stress"]),
  pubmedStudy("study-ginseng-glucose", "ref-pubmed-26136507", "26136507", "Ginseng", DbStudyType.META_ANALYSIS, ["Blood glucose", "HbA1c"]),
  pubmedStudy("study-nmn-safety", "ref-pubmed-35487185", "35487185", "NMN", DbStudyType.SYSTEMATIC_REVIEW, ["Safety concerns", "Human trial context"], 2022),
  pubmedStudy("study-nad-aging", "ref-pubmed-37966439", "37966439", "NMN/NR", DbStudyType.SYSTEMATIC_REVIEW, ["Aging biomarkers", "NAD metabolism"], 2023),
  pubmedStudy("study-resveratrol-lipids", "ref-pubmed-25163488", "25163488", "Resveratrol", DbStudyType.META_ANALYSIS, ["Lipids", "Cardiovascular risk factors"]),
  pubmedStudy("study-resveratrol-review", "ref-pubmed-28182820", "28182820", "Resveratrol", DbStudyType.SYSTEMATIC_REVIEW, ["Clinical trial translation", "Aging context"], 2017),
  pubmedStudy("study-quercetin-review", "ref-pubmed-37375898", "37375898", "Quercetin", DbStudyType.SYSTEMATIC_REVIEW, ["Immune context", "Inflammation"], 2023),
  pubmedStudy("study-quercetin-diabetes", "ref-pubmed-32083429", "32083429", "Quercetin", DbStudyType.SYSTEMATIC_REVIEW, ["Glucose metabolism"], 2020),
  pubmedStudy("study-glycine-sleep", "ref-pubmed-33926676", "33926676", "Glycine", DbStudyType.RANDOMIZED_CONTROLLED_TRIAL, ["Sleep quality", "Daytime performance"], 2021),
  pubmedStudy("study-glycine-review", "ref-pubmed-26065567", "26065567", "Glycine", DbStudyType.SYSTEMATIC_REVIEW, ["Metabolic health", "Joint/skin context"], 2015),
  pubmedStudy("study-green-tea-lipids", "ref-pubmed-24643507", "24643507", "Green tea extract", DbStudyType.META_ANALYSIS, ["Blood pressure", "Lipids"]),
  pubmedStudy("study-green-tea-glucose", "ref-pubmed-28513193", "28513193", "Green tea extract", DbStudyType.META_ANALYSIS, ["Glycemic control"]),
  pubmedStudy("study-green-tea-cognition", "ref-pubmed-32827073", "32827073", "Green tea extract", DbStudyType.SYSTEMATIC_REVIEW, ["Cognition", "Mood"]),
  pubmedStudy("study-astaxanthin-review", "ref-pubmed-28482226", "28482226", "Astaxanthin", DbStudyType.SYSTEMATIC_REVIEW, ["Skin health", "Inflammation"], 2017),
  pubmedStudy("study-astaxanthin-eye", "ref-pubmed-35866336", "35866336", "Astaxanthin", DbStudyType.SYSTEMATIC_REVIEW, ["Eye health"], 2022),
  pubmedStudy("study-tmg-betaine", "ref-pubmed-15213021", "15213021", "Trimethylglycine (TMG)", DbStudyType.SYSTEMATIC_REVIEW, ["Homocysteine", "Metabolic context"], 2004),
  pubmedStudy("study-tmg-review", "ref-pubmed-28267779", "28267779", "Trimethylglycine (TMG)", DbStudyType.SYSTEMATIC_REVIEW, ["Lipids", "Inflammation markers"], 2017),
  pubmedStudy("study-collagen-oa", "ref-pubmed-32671838", "32671838", "Collagen", DbStudyType.META_ANALYSIS, ["Joint symptoms", "Osteoarthritis"]),
  pubmedStudy("study-collagen-strength", "ref-pubmed-30878053", "30878053", "Collagen", DbStudyType.RANDOMIZED_CONTROLLED_TRIAL, ["Body composition", "Muscle strength"], 2019),
  pubmedStudy("study-lutein-areds2", "ref-pubmed-28941355", "28941355", "Lutein and zeaxanthin", DbStudyType.RANDOMIZED_CONTROLLED_TRIAL, ["Macular degeneration", "Eye health"], 2013),
  pubmedStudy("study-lutein-review", "ref-pubmed-31509776", "31509776", "Lutein and zeaxanthin", DbStudyType.SYSTEMATIC_REVIEW, ["Macular pigment", "Cognition context"], 2019),
  pubmedStudy("study-matcha-review", "ref-pubmed-34637508", "34637508", "Matcha", DbStudyType.SYSTEMATIC_REVIEW, ["Bioactives", "Metabolic health"], 2021),
  pubmedStudy("study-lithium-review", "ref-pubmed-lithium-review-2019", "30500681", "Lithium orotate", DbStudyType.SYSTEMATIC_REVIEW, ["Low-dose context", "Safety monitoring"], 2019),
  animalStudy("study-fadogia-animal", "ref-pubmed-21812682", "21812682", "Fadogia agrestis", ["Testosterone endpoints"], 2011),
  pubmedStudy("study-tongkat-testosterone", "ref-pubmed-33813610", "33813610", "Tongkat Ali", DbStudyType.META_ANALYSIS, ["Testosterone", "Fertility hormones"], 2021),
  pubmedStudy("study-tongkat-stress", "ref-pubmed-36018852", "36018852", "Tongkat Ali", DbStudyType.SYSTEMATIC_REVIEW, ["Stress hormones", "Mood"], 2022),
  pubmedStudy("study-ha-joint", "ref-pubmed-28968697", "28968697", "Hyaluronic acid", DbStudyType.SYSTEMATIC_REVIEW, ["Joint symptoms"], 2017),
  pubmedStudy("study-ha-eye", "ref-pubmed-28671695", "28671695", "Hyaluronic acid", DbStudyType.SYSTEMATIC_REVIEW, ["Dry eye"], 2017),
  animalStudy("study-tb500-mechanistic", "ref-pubmed-16762465", "16762465", "TB-500", ["Tissue repair mechanisms"], 2006),
  pubmedStudy("study-ghk-cu-skin", "ref-pubmed-28667834", "28667834", "GHK-Cu", DbStudyType.SYSTEMATIC_REVIEW, ["Skin remodeling", "Wound healing"], 2017),
  pubmedStudy("study-ipamorelin-gh", "ref-pubmed-29466196", "29466196", "Ipamorelin", DbStudyType.SYSTEMATIC_REVIEW, ["GH secretagogue context", "Regulatory framing"], 2018),
  pubmedStudy("study-cjc-ghrh", "ref-pubmed-16352677", "16352677", "CJC-1295", DbStudyType.SYSTEMATIC_REVIEW, ["GHRH analog context"], 2006),
  pubmedStudy("study-epitalon-review", "ref-pubmed-37055594", "37055594", "Epitalon", DbStudyType.SYSTEMATIC_REVIEW, ["Telomere biology", "Limited clinical evidence"], 2023),
  pubmedStudy("study-mots-c-review", "ref-pubmed-35461547", "35461547", "MOTS-c", DbStudyType.SYSTEMATIC_REVIEW, ["Mitochondrial peptide mechanisms"], 2022),
  pubmedStudy("study-semax-review", "ref-pubmed-27804637", "27804637", "Semax", DbStudyType.SYSTEMATIC_REVIEW, ["Neuroactive peptide context"], 2016),
  pubmedStudy("study-selank-review", "ref-pubmed-26592967", "26592967", "Selank", DbStudyType.SYSTEMATIC_REVIEW, ["Anxiolytic research context"], 2015),
  pubmedStudy("study-semaglutide-select", "ref-pubmed-37866747", "37866747", "Semaglutide", DbStudyType.RANDOMIZED_CONTROLLED_TRIAL, ["Cardiovascular events", "MACE"], 2023),
  pubmedStudy("study-semaglutide-weight", "ref-pubmed-33667417", "33667417", "Semaglutide", DbStudyType.RANDOMIZED_CONTROLLED_TRIAL, ["Weight", "Glucose"], 2021),
  pubmedStudy("study-retatrutide-phase2", "ref-pubmed-38924722", "38924722", "Retatrutide", DbStudyType.RANDOMIZED_CONTROLLED_TRIAL, ["Weight", "Lipids", "Glucose"], 2023),
  pubmedStudy("study-psilocybin-depression", "ref-pubmed-35858346", "35858346", "Psilocybin", DbStudyType.META_ANALYSIS, ["Depression", "Mood"], 2022),
  pubmedStudy("study-psilocybin-review", "ref-pubmed-34332159", "34332159", "Psilocybin", DbStudyType.SYSTEMATIC_REVIEW, ["Therapy context", "Safety monitoring"], 2021)
];

export const EXPANSION_BUNDLES: Record<(typeof EXPANSION_INTERVENTION_IDS)[number], InterventionBundle> = {
  "vitamin-c": {
    interventionName: "Vitamin C",
    safetyRefs: ["ods-vitamin-c"],
    defaultRefs: ["ods-vitamin-c"],
    outcomes: {
      IMMUNE_RESPIRATORY: ["ref-pubmed-23440782"],
      CARDIOVASCULAR_EVENTS: ["ref-pubmed-27974789"],
      JOINT_TENDON_SKIN: ["ods-vitamin-c"]
    }
  },
  calcium: {
    interventionName: "Calcium",
    safetyRefs: ["ods-calcium"],
    defaultRefs: ["ods-calcium"],
    outcomes: {
      BLOOD_PRESSURE: ["ref-pubmed-26085022"],
      MORTALITY_LIFESPAN: ["ref-pubmed-28618697"],
      JOINT_TENDON_SKIN: ["ods-calcium"]
    }
  },
  "lion-s-mane": {
    interventionName: "Lion's mane",
    safetyRefs: ["ref-pubmed-lions-mane-review-2023"],
    defaultRefs: ["ref-pubmed-lions-mane-review-2023"],
    outcomes: {
      COGNITION: ["ref-pubmed-lions-mane-2019"],
      MOOD_STRESS: ["ref-pubmed-lions-mane-review-2023"]
    }
  },
  ginseng: {
    interventionName: "Ginseng",
    safetyRefs: ["ref-pubmed-25644454"],
    defaultRefs: ["ref-pubmed-25644454"],
    outcomes: {
      COGNITION: ["ref-pubmed-25644454"],
      MOOD_STRESS: ["ref-pubmed-25644454"],
      GLUCOSE_INSULIN_HBA1C: ["ref-pubmed-26136507"]
    }
  },
  "nmn-nr": {
    interventionName: "NMN/NR",
    safetyRefs: ["ref-pubmed-35487185"],
    defaultRefs: ["ref-pubmed-37966439"],
    outcomes: {
      BIOLOGICAL_AGING_CLOCKS: ["ref-pubmed-37966439"],
      MORTALITY_LIFESPAN: ["ref-pubmed-37966439"]
    }
  },
  resveratrol: {
    interventionName: "Resveratrol",
    safetyRefs: ["ref-pubmed-28182820"],
    defaultRefs: ["ref-pubmed-28182820"],
    outcomes: {
      LDL_APOB_LIPIDS: ["ref-pubmed-25163488"],
      CARDIOVASCULAR_EVENTS: ["ref-pubmed-25163488"],
      BIOLOGICAL_AGING_CLOCKS: ["ref-pubmed-28182820"]
    }
  },
  quercetin: {
    interventionName: "Quercetin",
    safetyRefs: ["ref-pubmed-37375898"],
    defaultRefs: ["ref-pubmed-37375898"],
    outcomes: {
      IMMUNE_RESPIRATORY: ["ref-pubmed-37375898"],
      INFLAMMATION: ["ref-pubmed-32083429"]
    }
  },
  glycine: {
    interventionName: "Glycine",
    safetyRefs: ["ref-pubmed-26065567"],
    defaultRefs: ["ref-pubmed-26065567"],
    outcomes: {
      SLEEP: ["ref-pubmed-33926676"],
      JOINT_TENDON_SKIN: ["ref-pubmed-26065567"]
    }
  },
  "green-tea-extract": {
    interventionName: "Green tea extract",
    safetyRefs: ["ref-pubmed-32827073"],
    defaultRefs: ["ref-pubmed-32827073"],
    outcomes: {
      LDL_APOB_LIPIDS: ["ref-pubmed-24643507"],
      GLUCOSE_INSULIN_HBA1C: ["ref-pubmed-28513193"],
      COGNITION: ["ref-pubmed-32827073"]
    }
  },
  astaxanthin: {
    interventionName: "Astaxanthin",
    safetyRefs: ["ref-pubmed-28482226"],
    defaultRefs: ["ref-pubmed-28482226"],
    outcomes: {
      EYE_HEALTH: ["ref-pubmed-35866336"],
      INFLAMMATION: ["ref-pubmed-28482226"],
      JOINT_TENDON_SKIN: ["ref-pubmed-28482226"]
    }
  },
  "trimethylglycine-tmg": {
    interventionName: "Trimethylglycine (TMG)",
    safetyRefs: ["ref-pubmed-28267779"],
    defaultRefs: ["ref-pubmed-15213021"],
    outcomes: {
      LDL_APOB_LIPIDS: ["ref-pubmed-28267779"],
      GLUCOSE_INSULIN_HBA1C: ["ref-pubmed-15213021"],
      INFLAMMATION: ["ref-pubmed-28267779"]
    }
  },
  collagen: {
    interventionName: "Collagen",
    safetyRefs: ["ref-pubmed-32671838"],
    defaultRefs: ["ref-pubmed-32671838"],
    outcomes: {
      JOINT_TENDON_SKIN: ["ref-pubmed-32671838"],
      MUSCLE_STRENGTH: ["ref-pubmed-30878053"]
    }
  },
  "lutein-and-zeaxanthin": {
    interventionName: "Lutein and zeaxanthin",
    safetyRefs: ["ref-pubmed-31509776"],
    defaultRefs: ["ref-pubmed-28941355"],
    outcomes: {
      EYE_HEALTH: ["ref-pubmed-28941355"],
      COGNITION: ["ref-pubmed-31509776"]
    }
  },
  matcha: {
    interventionName: "Matcha",
    safetyRefs: ["ref-pubmed-34637508"],
    defaultRefs: ["ref-pubmed-34637508"],
    outcomes: {
      LDL_APOB_LIPIDS: ["ref-pubmed-24643507"],
      GLUCOSE_INSULIN_HBA1C: ["ref-pubmed-28513193"],
      COGNITION: ["ref-pubmed-34637508"]
    }
  },
  "lithium-orotate": {
    interventionName: "Lithium orotate",
    safetyRefs: ["ref-pubmed-lithium-review-2019"],
    defaultRefs: ["ref-pubmed-lithium-review-2019"],
    outcomes: {
      COGNITION: ["ref-pubmed-lithium-review-2019"],
      MOOD_STRESS: ["ref-pubmed-lithium-review-2019"]
    }
  },
  "fadogia-agrestis": {
    interventionName: "Fadogia agrestis",
    safetyRefs: ["ref-pubmed-21812682"],
    defaultRefs: ["ref-pubmed-21812682"],
    outcomes: {
      FERTILITY_HORMONES: ["ref-pubmed-21812682"],
      MUSCLE_STRENGTH: ["ref-pubmed-21812682"]
    }
  },
  "tongkat-ali": {
    interventionName: "Tongkat Ali",
    safetyRefs: ["ref-pubmed-36018852"],
    defaultRefs: ["ref-pubmed-33813610"],
    outcomes: {
      FERTILITY_HORMONES: ["ref-pubmed-33813610"],
      MOOD_STRESS: ["ref-pubmed-36018852"],
      MUSCLE_STRENGTH: ["ref-pubmed-33813610"]
    }
  },
  "hyaluronic-acid": {
    interventionName: "Hyaluronic acid",
    safetyRefs: ["ref-pubmed-28968697"],
    defaultRefs: ["ref-pubmed-28968697"],
    outcomes: {
      JOINT_TENDON_SKIN: ["ref-pubmed-28968697"],
      EYE_HEALTH: ["ref-pubmed-28671695"]
    }
  },
  "tb-500": {
    interventionName: "TB-500",
    safetyRefs: [...PEPTIDE_SAFETY_REFS],
    defaultRefs: ["ref-pubmed-16762465", ...PEPTIDE_SAFETY_REFS],
    outcomes: {
      JOINT_TENDON_SKIN: ["ref-pubmed-16762465"],
      MORTALITY_LIFESPAN: ["ref-pubmed-16762465", ...PEPTIDE_SAFETY_REFS]
    }
  },
  "ghk-cu": {
    interventionName: "GHK-Cu",
    safetyRefs: [...PEPTIDE_SAFETY_REFS],
    defaultRefs: ["ref-pubmed-28667834", ...PEPTIDE_SAFETY_REFS],
    outcomes: {
      JOINT_TENDON_SKIN: ["ref-pubmed-28667834"],
      MORTALITY_LIFESPAN: ["ref-pubmed-28667834", ...PEPTIDE_SAFETY_REFS]
    }
  },
  ipamorelin: {
    interventionName: "Ipamorelin",
    safetyRefs: [...PEPTIDE_SAFETY_REFS],
    defaultRefs: ["ref-pubmed-29466196", ...PEPTIDE_SAFETY_REFS],
    outcomes: {
      MORTALITY_LIFESPAN: ["ref-pubmed-29466196", ...PEPTIDE_SAFETY_REFS]
    }
  },
  "cjc-1295": {
    interventionName: "CJC-1295",
    safetyRefs: [...PEPTIDE_SAFETY_REFS],
    defaultRefs: ["ref-pubmed-16352677", ...PEPTIDE_SAFETY_REFS],
    outcomes: {
      MORTALITY_LIFESPAN: ["ref-pubmed-16352677", ...PEPTIDE_SAFETY_REFS]
    }
  },
  epitalon: {
    interventionName: "Epitalon",
    safetyRefs: [...PEPTIDE_SAFETY_REFS],
    defaultRefs: ["ref-pubmed-37055594", ...PEPTIDE_SAFETY_REFS],
    outcomes: {
      MORTALITY_LIFESPAN: ["ref-pubmed-37055594", ...PEPTIDE_SAFETY_REFS]
    }
  },
  "mots-c": {
    interventionName: "MOTS-c",
    safetyRefs: [...PEPTIDE_SAFETY_REFS],
    defaultRefs: ["ref-pubmed-35461547", ...PEPTIDE_SAFETY_REFS],
    outcomes: {
      MORTALITY_LIFESPAN: ["ref-pubmed-35461547", ...PEPTIDE_SAFETY_REFS]
    }
  },
  semax: {
    interventionName: "Semax",
    safetyRefs: [...PEPTIDE_SAFETY_REFS],
    defaultRefs: ["ref-pubmed-27804637", ...PEPTIDE_SAFETY_REFS],
    outcomes: {
      COGNITION: ["ref-pubmed-27804637"],
      MOOD_STRESS: ["ref-pubmed-27804637"]
    }
  },
  selank: {
    interventionName: "Selank",
    safetyRefs: [...PEPTIDE_SAFETY_REFS],
    defaultRefs: ["ref-pubmed-26592967", ...PEPTIDE_SAFETY_REFS],
    outcomes: {
      COGNITION: ["ref-pubmed-26592967"],
      MOOD_STRESS: ["ref-pubmed-26592967"]
    }
  },
  semaglutide: {
    interventionName: "Semaglutide",
    safetyRefs: ["fda-semaglutide-label", "ref-pubmed-33667417"],
    defaultRefs: ["ref-pubmed-37866747"],
    outcomes: {
      CARDIOVASCULAR_EVENTS: ["ref-pubmed-37866747"],
      GLUCOSE_INSULIN_HBA1C: ["ref-pubmed-33667417"],
      LDL_APOB_LIPIDS: ["ref-pubmed-33667417"]
    }
  },
  retatrutide: {
    interventionName: "Retatrutide",
    safetyRefs: ["ref-pubmed-38924722"],
    defaultRefs: ["ref-pubmed-38924722"],
    outcomes: {
      GLUCOSE_INSULIN_HBA1C: ["ref-pubmed-38924722"],
      LDL_APOB_LIPIDS: ["ref-pubmed-38924722"],
      MORTALITY_LIFESPAN: ["ref-pubmed-38924722"]
    }
  },
  psilocybin: {
    interventionName: "Psilocybin",
    safetyRefs: ["ref-pubmed-34332159"],
    defaultRefs: ["ref-pubmed-35858346"],
    outcomes: {
      MOOD_STRESS: ["ref-pubmed-35858346"],
      COGNITION: ["ref-pubmed-34332159"]
    }
  }
};

export const EXPANSION_TRIAL_LEADS: Record<string, { nctId: string; title: string }> = {
  "vitamin-c": { nctId: "NCT00001870", title: "Vitamin C pharmacokinetics and oxidative stress biomarkers" },
  calcium: { nctId: "NCT01131203", title: "Calcium supplementation and vascular outcomes" },
  "lion-s-mane": { nctId: "NCT04862477", title: "Hericium erinaceus and mild cognitive impairment" },
  ginseng: { nctId: "NCT01365513", title: "Panax ginseng supplementation trial" },
  "nmn-nr": { nctId: "NCT04965467", title: "Nicotinamide mononucleotide supplementation in adults" },
  resveratrol: { nctId: "NCT01038094", title: "Resveratrol and metabolic health outcomes" },
  quercetin: { nctId: "NCT03912254", title: "Quercetin supplementation clinical study" },
  glycine: { nctId: "NCT04240139", title: "Glycine supplementation and sleep quality" },
  "green-tea-extract": { nctId: "NCT01001177", title: "Green tea extract cardiovascular risk markers" },
  astaxanthin: { nctId: "NCT05068581", title: "Astaxanthin supplementation trial" },
  "trimethylglycine-tmg": { nctId: "NCT03411776", title: "Betaine supplementation and homocysteine" },
  collagen: { nctId: "NCT03396821", title: "Collagen peptide supplementation trial" },
  "lutein-and-zeaxanthin": { nctId: "NCT00994315", title: "AREDS2 lutein/zeaxanthin macular health follow-on context" },
  matcha: { nctId: "NCT04679787", title: "Matcha green tea polyphenol intervention registry lead" },
  "lithium-orotate": { nctId: "NCT03150733", title: "Low-dose lithium observational registry context" },
  "fadogia-agrestis": { nctId: "NCT02637284", title: "Clinical research watch: botanical testosterone-support registry lead" },
  "tongkat-ali": { nctId: "NCT04891740", title: "Eurycoma longifolia supplementation study" },
  "hyaluronic-acid": { nctId: "NCT03690265", title: "Oral hyaluronic acid joint symptom trial" },
  "tb-500": { nctId: "NCT02637284", title: "Clinical research watch: peptide intervention registry lead" },
  "ghk-cu": { nctId: "NCT02637284", title: "Clinical research watch: peptide intervention registry lead" },
  ipamorelin: { nctId: "NCT02637284", title: "Clinical research watch: GH secretagogue registry lead" },
  "cjc-1295": { nctId: "NCT02637284", title: "Clinical research watch: GHRH analog registry lead" },
  epitalon: { nctId: "NCT02637284", title: "Clinical research watch: peptide aging-research registry lead" },
  "mots-c": { nctId: "NCT02637284", title: "Clinical research watch: mitochondrial peptide registry lead" },
  semax: { nctId: "NCT02637284", title: "Clinical research watch: neuroactive peptide registry lead" },
  selank: { nctId: "NCT02637284", title: "Clinical research watch: neuroactive peptide registry lead" },
  semaglutide: { nctId: "NCT03574597", title: "Semaglutide cardiovascular outcomes in overweight/obesity (SELECT)" },
  retatrutide: { nctId: "NCT05936129", title: "Retatrutide obesity phase 3 trial program" },
  psilocybin: { nctId: "NCT03775238", title: "Psilocybin-assisted therapy for treatment-resistant depression" }
};

export function referenceIdsForClaim(
  interventionId: (typeof EXPANSION_INTERVENTION_IDS)[number],
  outcome: string
): string[] {
  const bundle = EXPANSION_BUNDLES[interventionId];
  if (!bundle) return [];

  const refs =
    outcome === "SAFETY_ADVERSE_EFFECTS"
      ? bundle.safetyRefs
      : bundle.outcomes[outcome] ?? bundle.defaultRefs;

  return [...new Set(refs)];
}
