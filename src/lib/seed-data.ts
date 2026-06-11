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
      "Seed placeholder for lipid, glucose, gut, and satiety claims.",
    lastReviewed: "2026-06-02"
  }
];

export const claims: Claim[] = [
  {
    id: "creatine-strength",
    interventionId: "creatine",
    outcome: "Muscle/strength",
    claimText: "Strength, power, and lean mass support when paired with resistance training.",
    populationStudied: "Adults in exercise and sport nutrition literature.",
    doseFormStudied: "Creatine monohydrate; dose details must be checked per study.",
    durationStudied: "Varies by trial and review.",
    comparator: "Placebo or usual training controls.",
    evidenceGrade: "Strong human evidence for this use case in the seed set.",
    effectSize: "Meaningful for performance-oriented outcomes; not a mortality endpoint.",
    clinicalRelevance: "Most relevant to training outcomes, function, and lean mass.",
    confidenceLevel: "High",
    safetyNotes: "Renal disease or abnormal renal markers require clinician review.",
    applicabilityNotes:
      "Do not extrapolate this score to direct lifespan extension or all cognitive claims.",
    keyReferenceIds: ["issn-creatine-2017"],
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
    reviewStatus: "Unreviewed AI draft",
    lastUpdated: "2026-06-02",
    whatWouldChangeScore:
      "Large independent trials showing different effects by population, safety signal changes, or stronger functional-aging endpoints."
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
  }
];

export const studies: Study[] = [
  {
    id: "study-creatine-issn",
    title:
      "International Society of Sports Nutrition position stand: safety and efficacy of creatine supplementation in exercise, sport, and medicine",
    year: 2017,
    source: "Journal of the International Society of Sports Nutrition via PubMed",
    studyType: "Systematic review",
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
    id: "study-vitamin-d-ods",
    title: "Vitamin D health professional fact sheet",
    year: 2025,
    source: "NIH Office of Dietary Supplements",
    studyType: "Systematic review",
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
    id: "study-fda-bpc-157",
    title:
      "Certain bulk drug substances for use in compounding that may present significant safety risks",
    year: 2023,
    source: "FDA",
    studyType: "Regulatory safety warning",
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
    sampleSize: "Regulatory safety-alert monitoring",
    population: "Australian public, suppliers, and health professional regulatory context",
    intervention: "Unapproved peptide products including BPC-157",
    outcomes: ["ARTG status", "Regulatory concern", "Public safety monitoring"],
    adverseEvents:
      "TGA alerts highlight unknown safety, quality, effectiveness, product identity, and contamination risks for unapproved peptide products.",
    fundingConflicts: "Government regulatory source.",
    riskOfBias: "Regulatory safety source; monitor for current TGA updates.",
    referenceId: "tga-safety-alerts"
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
  }
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
  }
];
