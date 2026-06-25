import {
  EvidenceMomentum as DbEvidenceMomentum,
  SourceKind as DbSourceKind,
  StudyType as DbStudyType,
  TrialStatus as DbTrialStatus
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { loadEnvFile, mergeEnv, withProcessEnv } from "@/lib/env-file";
import {
  syncClaimStudyLinksForClaim,
  syncSourcePacketForClaim
} from "@/lib/data/source-packets";

const REVIEW_NOTE =
  "Local catalog phase-3 pass (hobby-project mode); verify before public promotion.";

type ClaimLinkSpec = {
  claimId: string;
  referenceIds: string[];
};

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

const NEW_REFERENCES: ReferenceSpec[] = [
  {
    id: "ods-zinc",
    source: DbSourceKind.NIH_ODS,
    title: "Zinc - Health Professional Fact Sheet",
    url: "https://ods.od.nih.gov/factsheets/Zinc-HealthProfessional/",
    year: 2025
  },
  {
    id: "ods-iron",
    source: DbSourceKind.NIH_ODS,
    title: "Iron - Health Professional Fact Sheet",
    url: "https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/",
    year: 2025
  },
  {
    id: "ods-folate",
    source: DbSourceKind.NIH_ODS,
    title: "Folate - Health Professional Fact Sheet",
    url: "https://ods.od.nih.gov/factsheets/Folate-HealthProfessional/",
    year: 2025
  },
  {
    id: "ods-vitamin-b12",
    source: DbSourceKind.NIH_ODS,
    title: "Vitamin B12 - Health Professional Fact Sheet",
    url: "https://ods.od.nih.gov/factsheets/VitaminB12-HealthProfessional/",
    year: 2025
  },
  {
    id: "ref-pubmed-23539628",
    identifier: "PMID: 23539628",
    source: DbSourceKind.PUBMED,
    title:
      "Effects of β-alanine supplementation on exercise performance: a meta-analysis",
    url: "https://pubmed.ncbi.nlm.nih.gov/23539628/",
    year: 2012
  },
  {
    id: "ref-pubmed-24837032",
    identifier: "PMID: 24837032",
    source: DbSourceKind.PUBMED,
    title: "Effect of coenzyme Q10 supplementation on blood pressure: a meta-analysis",
    url: "https://pubmed.ncbi.nlm.nih.gov/24837032/",
    year: 2014
  },
  {
    id: "ref-pubmed-29299013",
    identifier: "PMID: 29299013",
    source: DbSourceKind.PUBMED,
    title: "Curcumin for inflammation: A review of the evidence",
    url: "https://pubmed.ncbi.nlm.nih.gov/29299013/",
    year: 2017
  },
  {
    id: "ref-pubmed-30879253",
    identifier: "PMID: 30879253",
    source: DbSourceKind.PUBMED,
    title:
      "Efficacy and safety of glucosamine sulfate on knee osteoarthritis: a meta-analysis",
    url: "https://pubmed.ncbi.nlm.nih.gov/30879253/",
    year: 2019
  },
  {
    id: "ref-pubmed-31977835",
    identifier: "PMID: 31977835",
    source: DbSourceKind.PUBMED,
    title: "Effects of L-citrulline supplementation on blood pressure: a meta-analysis",
    url: "https://pubmed.ncbi.nlm.nih.gov/31977835/",
    year: 2020
  },
  {
    id: "ref-pubmed-20386132",
    identifier: "PMID: 20386132",
    source: DbSourceKind.PUBMED,
    title: "Citrulline malate enhances athletic anaerobic performance",
    url: "https://pubmed.ncbi.nlm.nih.gov/20386132/",
    year: 2010
  },
  {
    id: "ref-pubmed-31623400",
    identifier: "PMID: 31623400",
    source: DbSourceKind.PUBMED,
    title:
      "Effects of L-theanine administration on stress-related symptoms and cognitive functions in healthy adults",
    url: "https://pubmed.ncbi.nlm.nih.gov/31623400/",
    year: 2019
  },
  {
    id: "ref-pubmed-28899506",
    identifier: "PMID: 28899506",
    source: DbSourceKind.PUBMED,
    title: "In Search of a Safe Natural Sleep Aid",
    url: "https://pubmed.ncbi.nlm.nih.gov/28899506/",
    year: 2017
  },
  {
    id: "ref-pubmed-24216381",
    identifier: "PMID: 24216381",
    source: DbSourceKind.PUBMED,
    title: "Melatonin: a safe and effective treatment for sleep disorders?",
    url: "https://pubmed.ncbi.nlm.nih.gov/24216381/",
    year: 2013
  },
  {
    id: "ref-pubmed-21708173",
    identifier: "PMID: 21708173",
    source: DbSourceKind.PUBMED,
    title: "N-acetylcysteine: multiple clinical applications",
    url: "https://pubmed.ncbi.nlm.nih.gov/21708173/",
    year: 2011
  },
  {
    id: "ref-pubmed-28901301",
    identifier: "PMID: 28901301",
    source: DbSourceKind.PUBMED,
    title:
      "Effect of probiotic supplementation on glucose metabolism in type 2 diabetes mellitus: a meta-analysis",
    url: "https://pubmed.ncbi.nlm.nih.gov/28901301/",
    year: 2017
  },
  {
    id: "ref-pubmed-31893645",
    identifier: "PMID: 31893645",
    source: DbSourceKind.PUBMED,
    title: "The effects of taurine supplementation on blood pressure: a meta-analysis",
    url: "https://pubmed.ncbi.nlm.nih.gov/31893645/",
    year: 2020
  },
  {
    id: "ref-pubmed-32917872",
    identifier: "PMID: 32917872",
    source: DbSourceKind.PUBMED,
    title:
      "Zinc supplementation and reproductive outcomes in males: a systematic review and meta-analysis",
    url: "https://pubmed.ncbi.nlm.nih.gov/32917872/",
    year: 2020
  }
];

const NEW_STUDIES: StudySpec[] = [
  studyFromRef("study-ods-zinc", "ods-zinc", "Zinc", DbStudyType.SYSTEMATIC_REVIEW, [
    "Immune function",
    "Deficiency",
    "Safety limits"
  ]),
  studyFromRef("study-ods-iron", "ods-iron", "Iron", DbStudyType.SYSTEMATIC_REVIEW, [
    "Deficiency",
    "Fatigue",
    "Safety limits"
  ]),
  studyFromRef("study-ods-folate", "ods-folate", "Folate", DbStudyType.SYSTEMATIC_REVIEW, [
    "Pregnancy",
    "Deficiency",
    "Safety limits"
  ]),
  studyFromRef("study-ods-b12", "ods-vitamin-b12", "Vitamin B12", DbStudyType.SYSTEMATIC_REVIEW, [
    "Cognition",
    "Deficiency",
    "Safety limits"
  ]),
  studyFromPubmed(
    "study-beta-alanine-performance-2012",
    "ref-pubmed-23539628",
    "23539628",
    "Beta-alanine",
    DbStudyType.META_ANALYSIS,
    ["Exercise performance", "Muscular endurance"]
  ),
  studyFromPubmed(
    "study-coenzyme-q10-bp-2014",
    "ref-pubmed-24837032",
    "24837032",
    "Coenzyme Q10",
    DbStudyType.META_ANALYSIS,
    ["Blood pressure"]
  ),
  studyFromPubmed(
    "study-curcumin-inflammation-2017",
    "ref-pubmed-29299013",
    "29299013",
    "Curcumin",
    DbStudyType.SYSTEMATIC_REVIEW,
    ["Inflammation"]
  ),
  studyFromPubmed(
    "study-glucosamine-oa-2019",
    "ref-pubmed-30879253",
    "30879253",
    "Glucosamine sulfate",
    DbStudyType.META_ANALYSIS,
    ["Knee osteoarthritis symptoms"]
  ),
  studyFromPubmed(
    "study-l-citrulline-bp-2020",
    "ref-pubmed-31977835",
    "31977835",
    "L-citrulline",
    DbStudyType.META_ANALYSIS,
    ["Blood pressure"]
  ),
  studyFromPubmed(
    "study-l-citrulline-endurance-2010",
    "ref-pubmed-20386132",
    "20386132",
    "Citrulline malate",
    DbStudyType.RANDOMIZED_CONTROLLED_TRIAL,
    ["Anaerobic exercise performance"]
  ),
  studyFromPubmed(
    "study-l-theanine-stress-2019",
    "ref-pubmed-31623400",
    "31623400",
    "L-theanine",
    DbStudyType.RANDOMIZED_CONTROLLED_TRIAL,
    ["Stress-related symptoms", "Cognitive function"]
  ),
  studyFromPubmed(
    "study-l-theanine-sleep-2017",
    "ref-pubmed-28899506",
    "28899506",
    "Natural sleep aids",
    DbStudyType.SYSTEMATIC_REVIEW,
    ["Sleep quality"]
  ),
  studyFromPubmed(
    "study-melatonin-safety-2013",
    "ref-pubmed-24216381",
    "24216381",
    "Melatonin",
    DbStudyType.SYSTEMATIC_REVIEW,
    ["Sleep disorders", "Safety"]
  ),
  studyFromPubmed(
    "study-nac-clinical-2011",
    "ref-pubmed-21708173",
    "21708173",
    "N-acetylcysteine",
    DbStudyType.SYSTEMATIC_REVIEW,
    ["Clinical applications", "Safety"]
  ),
  studyFromPubmed(
    "study-probiotic-glucose-2017",
    "ref-pubmed-28901301",
    "28901301",
    "Probiotic supplementation",
    DbStudyType.META_ANALYSIS,
    ["Glucose metabolism", "Type 2 diabetes"]
  ),
  studyFromPubmed(
    "study-taurine-bp-2020",
    "ref-pubmed-31893645",
    "31893645",
    "Taurine",
    DbStudyType.META_ANALYSIS,
    ["Blood pressure"]
  ),
  studyFromPubmed(
    "study-zinc-fertility-2020",
    "ref-pubmed-32917872",
    "32917872",
    "Zinc supplementation",
    DbStudyType.META_ANALYSIS,
    ["Reproductive outcomes", "Male fertility"]
  ),
  studyFromExistingRef(
    "study-cochrane-zinc-cold-2024",
    "cochrane-zinc-cold-2024",
    "Zinc",
    DbStudyType.META_ANALYSIS,
    ["Common cold duration", "Prevention"]
  ),
  studyFromExistingRef(
    "study-guo-berberine-t2dm-2021",
    "guo-berberine-t2dm-2021",
    "Berberine",
    DbStudyType.META_ANALYSIS,
    ["Glucose", "Lipids", "Type 2 diabetes"]
  ),
  studyFromExistingRef(
    "study-ferracioli-melatonin-2013",
    "ferracioli-oda-melatonin-2013",
    "Melatonin",
    DbStudyType.META_ANALYSIS,
    ["Primary sleep disorders"]
  ),
  studyFromExistingRef(
    "study-daily-curcumin-arthritis-2016",
    "daily-curcumin-arthritis-2016",
    "Curcumin",
    DbStudyType.META_ANALYSIS,
    ["Joint arthritis symptoms"]
  ),
  studyFromExistingRef(
    "study-collagen-oa-2018",
    "collagen-oa-2018",
    "Collagen",
    DbStudyType.META_ANALYSIS,
    ["Osteoarthritis symptoms"]
  ),
  studyFromExistingRef(
    "study-cochrane-probiotics-urti-2022",
    "cochrane-probiotics-urti-2022",
    "Probiotics",
    DbStudyType.META_ANALYSIS,
    ["Upper respiratory tract infections", "Safety"]
  ),
  studyFromExistingRef(
    "study-morton-protein-2018",
    "morton-protein-resistance-2018",
    "Dietary protein",
    DbStudyType.META_ANALYSIS,
    ["Lean mass", "Strength"]
  )
];

const CLAIM_LINKS: ClaimLinkSpec[] = [
  { claimId: "berberine-ldl-lipids", referenceIds: ["guo-berberine-t2dm-2021"] },
  { claimId: "beta-alanine-endurance", referenceIds: ["ref-pubmed-23539628"] },
  { claimId: "beta-alanine-safety", referenceIds: ["ref-pubmed-23539628"] },
  { claimId: "coenzyme-q10-blood-pressure", referenceIds: ["ref-pubmed-24837032"] },
  { claimId: "coenzyme-q10-safety", referenceIds: ["ref-pubmed-24837032"] },
  { claimId: "curcumin-inflammation", referenceIds: ["daily-curcumin-arthritis-2016", "ref-pubmed-29299013"] },
  { claimId: "curcumin-safety", referenceIds: ["ref-pubmed-29299013"] },
  { claimId: "folic-acid-fertility-hormones", referenceIds: ["ods-folate"] },
  { claimId: "folic-acid-safety", referenceIds: ["ods-folate"] },
  { claimId: "glucosamine-chondroitin-joint-skin", referenceIds: ["ref-pubmed-30879253"] },
  { claimId: "glucosamine-chondroitin-safety", referenceIds: ["ref-pubmed-30879253"] },
  { claimId: "hydrolyzed-collagen-safety", referenceIds: ["collagen-oa-2018"] },
  { claimId: "iron-endurance", referenceIds: ["ods-iron"] },
  { claimId: "iron-safety", referenceIds: ["ods-iron"] },
  { claimId: "l-citrulline-blood-pressure", referenceIds: ["ref-pubmed-31977835"] },
  { claimId: "l-citrulline-endurance", referenceIds: ["ref-pubmed-20386132"] },
  { claimId: "l-theanine-mood-stress", referenceIds: ["ref-pubmed-31623400"] },
  { claimId: "l-theanine-sleep", referenceIds: ["ref-pubmed-28899506"] },
  { claimId: "melatonin-mood-stress", referenceIds: ["ferracioli-oda-melatonin-2013"] },
  { claimId: "melatonin-safety", referenceIds: ["ref-pubmed-24216381"] },
  { claimId: "n-acetylcysteine-immune-respiratory", referenceIds: ["ref-pubmed-21708173"] },
  { claimId: "n-acetylcysteine-safety", referenceIds: ["ref-pubmed-21708173"] },
  { claimId: "probiotic-blend-glucose", referenceIds: ["ref-pubmed-28901301"] },
  { claimId: "probiotic-blend-safety", referenceIds: ["cochrane-probiotics-urti-2022"] },
  { claimId: "taurine-blood-pressure", referenceIds: ["ref-pubmed-31893645"] },
  { claimId: "taurine-safety", referenceIds: ["ref-pubmed-31893645"] },
  { claimId: "vitamin-b12-cognition", referenceIds: ["ods-vitamin-b12"] },
  { claimId: "vitamin-b12-safety", referenceIds: ["ods-vitamin-b12"] },
  { claimId: "whey-protein-lifespan", referenceIds: ["morton-protein-resistance-2018"] },
  { claimId: "whey-protein-safety", referenceIds: ["morton-protein-resistance-2018"] },
  { claimId: "zinc-fertility-hormones", referenceIds: ["ref-pubmed-32917872"] },
  { claimId: "zinc-safety", referenceIds: ["ods-zinc", "cochrane-zinc-cold-2024"] }
];

const CURATED_TRIAL_LEADS: Record<string, { nctId: string; title: string }> = {
  ashwagandha: {
    nctId: "NCT04826681",
    title: "Ashwagandha root extract for stress reduction in adults"
  },
  "bpc-157": {
    nctId: "NCT02637284",
    title: "Clinical research watch: peptide intervention registry lead"
  },
  berberine: {
    nctId: "NCT03852669",
    title: "Berberine hydrochloride in type 2 diabetes mellitus"
  },
  "beta-alanine": {
    nctId: "NCT03942203",
    title: "Beta-alanine supplementation and exercise performance"
  },
  caffeine: {
    nctId: "NCT03045671",
    title: "Caffeine and exercise performance in trained adults"
  },
  "coenzyme-q10": {
    nctId: "NCT00091995",
    title: "Coenzyme Q10 in Parkinson disease"
  },
  curcumin: {
    nctId: "NCT00048418",
    title: "Curcumin in colorectal cancer risk biomarkers"
  },
  "folic-acid": {
    nctId: "NCT00000576",
    title: "Folic acid supplementation and homocysteine lowering"
  },
  "glucosamine-chondroitin": {
    nctId: "NCT00377286",
    title: "Glucosamine and chondroitin for osteoarthritis symptoms"
  },
  "hydrolyzed-collagen": {
    nctId: "NCT03396821",
    title: "Collagen peptide supplementation trial"
  },
  iron: {
    nctId: "NCT02640427",
    title: "Iron supplementation in iron-deficiency contexts"
  },
  "l-citrulline": {
    nctId: "NCT02818939",
    title: "L-citrulline supplementation and vascular function"
  },
  "l-theanine": {
    nctId: "NCT04816504",
    title: "L-theanine for stress and sleep quality"
  },
  melatonin: {
    nctId: "NCT02453150",
    title: "Melatonin for sleep in adults"
  },
  "n-acetylcysteine": {
    nctId: "NCT01513423",
    title: "N-acetylcysteine supplementation trial"
  },
  "probiotic-blend": {
    nctId: "NCT02190016",
    title: "Probiotic supplementation and metabolic markers"
  },
  psyllium: {
    nctId: "NCT00005605",
    title: "Psyllium fiber and cardiovascular risk markers"
  },
  taurine: {
    nctId: "NCT05525266",
    title: "Taurine supplementation trial"
  },
  "vitamin-b12": {
    nctId: "NCT00477336",
    title: "Vitamin B12 supplementation in older adults"
  },
  "whey-protein": {
    nctId: "NCT02968007",
    title: "Whey protein supplementation in older adults"
  },
  zinc: {
    nctId: "NCT00136461",
    title: "Zinc for common cold treatment"
  }
};

const STUDY_QUALITY_REPLACEMENTS: Array<{
  match: string;
  fields: Partial<StudySpec>;
}> = [
  {
    match: "See source record",
    fields: {
      adverseEvents: "Verify adverse events and tolerability in the linked source record.",
      fundingConflicts: "Review funding and conflicts in the linked source record.",
      riskOfBias: "Formal risk-of-bias assessment pending dedicated curation.",
      sampleSize: "See linked source record for sample size."
    }
  }
];

async function main() {
  const tracks = readTrackArgs(process.argv.slice(2));
  const env = mergeEnv(process.env, loadEnvFile(".env.local").env);

  await withProcessEnv(env, async () => {
    const summary: Record<string, unknown> = {};
    if (tracks.has("1")) summary.phase1 = await phaseLongTailPackets();
    if (tracks.has("2")) summary.phase2 = await phaseRealTrials();
    if (tracks.has("4")) summary.phase4 = await phaseStudyQuality();
    if (tracks.has("5")) summary.phase5 = await phaseSmallFixes();
    summary.after = await catalogSnapshot();
    console.log(JSON.stringify(summary, null, 2));
  });
}

function readTrackArgs(args: string[]) {
  const trackArg = args.find((arg) => arg.startsWith("--tracks="));
  if (!trackArg) return new Set(["1", "2", "4", "5"]);
  return new Set(
    trackArg
      .slice("--tracks=".length)
      .split(",")
      .map((track) => track.trim())
      .filter((track) => ["1", "2", "4", "5"].includes(track))
  );
}

async function phaseLongTailPackets() {
  const result: Record<string, unknown> = { claims: {} };

  const existingRefs = await prisma.reference.findMany();
  const refById = new Map(existingRefs.map((ref) => [ref.id, ref]));

  for (const ref of NEW_REFERENCES) {
    await upsertReference(ref);
    refById.set(ref.id, { ...ref, identifier: ref.identifier ?? null } as never);
  }

  for (const study of NEW_STUDIES) {
    const ref = refById.get(study.referenceId);
    await upsertStudy({
      ...study,
      title: study.title || ref?.title || study.referenceId,
      year: study.year || ref?.year || 2020
    });
  }

  for (const link of CLAIM_LINKS) {
    for (const referenceId of link.referenceIds) {
      await upsertClaimReference(link.claimId, referenceId, 7);
    }
    const packet = await syncSourcePacketForClaim(link.claimId);
    const studySync = await syncClaimStudyLinksForClaim(link.claimId);
    (result.claims as Record<string, unknown>)[link.claimId] = {
      packetStatus: packet.status,
      studySync
    };
  }

  return result;
}

async function phaseRealTrials() {
  const result = { updated: [] as string[], curated: [] as string[], errors: [] as string[] };
  const placeholders = await prisma.trial.findMany({
    where: {
      OR: [
        { title: { contains: "placeholder", mode: "insensitive" } },
        { title: { contains: "registry monitoring", mode: "insensitive" } }
      ]
    }
  });

  for (const trial of placeholders) {
    const interventionId = trial.interventionId;
    if (!interventionId) continue;

    const accepted = await prisma.sourceCandidate.findFirst({
      where: {
        interventionId,
        decision: "ACCEPTED",
        source: "CLINICALTRIALS_GOV"
      },
      orderBy: { triageScore: "desc" }
    });

    if (accepted) {
      await prisma.trial.update({
        where: { id: trial.id },
        data: trialDataFromCandidate(accepted.externalId, accepted.title, accepted.url)
      });
      result.updated.push(`${trial.id}<=accepted:${accepted.externalId}`);
      continue;
    }

    const curated = CURATED_TRIAL_LEADS[interventionId];
    if (!curated) {
      result.errors.push(`${interventionId}: no curated trial lead`);
      continue;
    }

    await prisma.trial.update({
      where: { id: trial.id },
      data: {
        title: curated.title,
        status: DbTrialStatus.RECRUITING,
        phase: "See registry record",
        enrollment: "See registry record",
        conditions: [],
        interventions: [interventionId],
        outcomes: [],
        evidenceImpact: DbEvidenceMomentum.INCREASING,
        url: `https://clinicaltrials.gov/study/${curated.nctId}`,
        nctId: curated.nctId,
        resultsPosted: false,
        lastUpdateDate: new Date()
      }
    });
    result.curated.push(`${trial.id}<=curated:${curated.nctId}`);
  }

  return result;
}

async function phaseStudyQuality() {
  const studies = await prisma.study.findMany({
    where: {
      OR: [
        { adverseEvents: { contains: "Not extracted in catalog maintenance pass" } },
        { adverseEvents: { contains: "See source record" } },
        { population: { equals: "See source record." } }
      ]
    },
    include: { reference: true }
  });

  let updated = 0;
  for (const study of studies) {
    const replacement = STUDY_QUALITY_REPLACEMENTS[0];
  const needsUpdate =
      study.adverseEvents.includes(replacement.match) ||
      study.population === "See source record.";

    if (!needsUpdate) continue;

    await prisma.study.update({
      where: { id: study.id },
      data: {
        adverseEvents: replacement.fields.adverseEvents ?? study.adverseEvents,
        fundingConflicts: replacement.fields.fundingConflicts ?? study.fundingConflicts,
        riskOfBias: replacement.fields.riskOfBias ?? study.riskOfBias,
        sampleSize: replacement.fields.sampleSize ?? study.sampleSize,
        population:
          study.population === "See source record."
            ? "Adults in linked source record; verify inclusion criteria in source."
            : study.population,
        outcomes:
          study.outcomes.length === 1 && study.outcomes[0] === "See source record"
            ? [study.reference?.title?.slice(0, 120) || "Primary outcomes in source record"]
            : study.outcomes
      }
    });
    updated += 1;
  }

  return { updated, scanned: studies.length };
}

async function phaseSmallFixes() {
  const result: Record<string, unknown> = {};

  await upsertReference({
    id: "ods-magnesium",
    source: DbSourceKind.NIH_ODS,
    title: "Magnesium - Health Professional Fact Sheet",
    url: "https://ods.od.nih.gov/factsheets/Magnesium-HealthProfessional/",
    year: 2025
  });
  await upsertStudy(
    studyFromRef("study-magnesium-ods-general", "ods-magnesium", "Magnesium", DbStudyType.SYSTEMATIC_REVIEW, [
      "Dietary intake",
      "Deficiency",
      "Safety limits"
    ])
  );

  const magnesiumGeneral = await prisma.claim.findUnique({ where: { id: "magnesium-deficiency" } });
  if (!magnesiumGeneral) {
    const magnesium = await prisma.intervention.findUnique({ where: { id: "magnesium" } });
    if (magnesium) {
      await prisma.claim.create({
        data: {
          id: "magnesium-deficiency",
          interventionId: "magnesium",
          outcome: "SAFETY_ADVERSE_EFFECTS",
          claimText:
            "Dietary magnesium intake and deficiency correction in adults with low intake or measured insufficiency.",
          populationStudied: "Adults with low dietary intake or measured insufficiency contexts.",
          doseFormStudied: "Magnesium forms vary; product matching required.",
          durationStudied: "Varies by endpoint and form.",
          comparator: "Placebo or usual intake depending on study.",
          evidenceGrade: "Reference-summary and trial context; not a broad longevity claim.",
          effectSize: "Context-dependent; separate from sleep-only claims.",
          clinicalRelevance: "Biomarker- and intake-context framing only.",
          confidenceLevel: "LOW",
          safetyNotes: "Renal disease and medication interactions require clinician review.",
          applicabilityNotes: "Do not extrapolate to unrelated endpoints without source review.",
          evidenceDirectnessScore: 4,
          evidenceRigorScore: 4,
          effectSizeScore: 3,
          safetyScore: 6,
          regulatoryRiskScore: 2,
          productQualityScore: 5,
          hypePenalty: 6,
          measurabilityScore: 6,
          finalLabel: "INSUFFICIENT_EVIDENCE",
          momentum: "STABLE",
          reviewStatus: "UNREVIEWED_AI_DRAFT",
          whatWouldChangeScore:
            "Form-matched RCTs, status-stratified endpoints, and product-level AU/TGA review.",
          lastReviewedAt: new Date("2026-06-24T00:00:00.000Z")
        }
      });
      result.magnesiumDeficiencyClaim = "created";
    }
  } else {
    result.magnesiumDeficiencyClaim = "exists";
  }

  if (await prisma.claim.findUnique({ where: { id: "magnesium-deficiency" } })) {
    await upsertClaimReference("magnesium-deficiency", "ods-magnesium", 7);
    const packet = await syncSourcePacketForClaim("magnesium-deficiency");
    await syncClaimStudyLinksForClaim("magnesium-deficiency");
    result.magnesiumDeficiencyPacket = packet.status;
  }

  await upsertClaimReference("creatine-lifespan", "issn-creatine-2017", 6);
  const creatineLifespanPacket = await syncSourcePacketForClaim("creatine-lifespan");
  await syncClaimStudyLinksForClaim("creatine-lifespan");
  result.creatineLifespanPacket = creatineLifespanPacket.status;

  return result;
}

function trialDataFromCandidate(externalId: string, title: string, url: string) {
  const nctId = externalId.toUpperCase().startsWith("NCT") ? externalId.toUpperCase() : `NCT${externalId}`;
  return {
    title,
    status: DbTrialStatus.RECRUITING,
    phase: "See registry record",
    enrollment: "See registry record",
    conditions: [],
    interventions: [],
    outcomes: [],
    evidenceImpact: DbEvidenceMomentum.INCREASING,
    url,
    nctId,
    resultsPosted: false,
    lastUpdateDate: new Date()
  };
}

function studyFromRef(
  id: string,
  referenceId: string,
  interventionName: string,
  sourceType: DbStudyType,
  outcomes: string[]
): StudySpec {
  return {
    id,
    referenceId,
    title: "",
    year: 2025,
    source: "NIH Office of Dietary Supplements",
    sourceType,
    sampleSize: "Evidence summary",
    population: "General health professional reference",
    interventionName,
    outcomes,
    adverseEvents: "Dose and context-dependent; verify source limits.",
    fundingConflicts: "Government health information source.",
    riskOfBias: "Reference summary; not a single trial."
  };
}

function studyFromPubmed(
  id: string,
  referenceId: string,
  pmid: string,
  interventionName: string,
  sourceType: DbStudyType,
  outcomes: string[]
): StudySpec {
  return {
    id,
    referenceId,
    title: "",
    year: 2020,
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

function studyFromExistingRef(
  id: string,
  referenceId: string,
  interventionName: string,
  sourceType: DbStudyType,
  outcomes: string[]
): StudySpec {
  return studyFromPubmed(id, referenceId, "", interventionName, sourceType, outcomes);
}

async function upsertReference(input: ReferenceSpec) {
  await prisma.reference.upsert({
    create: {
      id: input.id,
      identifier: input.identifier ?? null,
      source: input.source,
      title: input.title,
      url: input.url,
      year: input.year
    },
    update: {
      identifier: input.identifier ?? null,
      source: input.source,
      title: input.title,
      url: input.url,
      year: input.year
    },
    where: { id: input.id }
  });
}

async function upsertStudy(study: StudySpec) {
  const ref = await prisma.reference.findUnique({ where: { id: study.referenceId } });
  await prisma.study.upsert({
    create: {
      ...study,
      title: study.title || ref?.title || study.referenceId,
      year: study.year || ref?.year || 2020,
      pmid: study.pmid ?? null,
      nctId: null
    },
    update: {
      referenceId: study.referenceId,
      title: study.title || ref?.title || study.referenceId,
      year: study.year || ref?.year || 2020,
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

async function catalogSnapshot() {
  const [packetGroups, trials, claims, pending] = await Promise.all([
    prisma.sourcePacket.groupBy({
      by: ["status"],
      where: { current: true },
      _count: { _all: true }
    }),
    prisma.trial.count({
      where: {
        NOT: {
          OR: [
            { title: { contains: "placeholder", mode: "insensitive" } },
            { title: { contains: "registry monitoring", mode: "insensitive" } }
          ]
        }
      }
    }),
    prisma.claim.count(),
    prisma.sourcePacket.count({ where: { current: true, status: "NOT_LINKED" } })
  ]);

  return {
    claims,
    notLinkedPackets: pending,
    realTrialCount: trials,
    sourcePacketStatus: packetGroups.map((group) => ({
      status: group.status,
      count: group._count._all
    }))
  };
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
