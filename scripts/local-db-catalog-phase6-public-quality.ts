import {
  AustraliaRegulatoryKind as DbAustraliaRegulatoryKind,
  OutcomeArea as DbOutcomeArea,
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

async function main() {
  const tracks = readTracks(process.argv.slice(2));
  const result: Record<string, unknown> = {};

  if (tracks.has("depth")) {
    result.depth = await deepenTop10();
  }

  if (tracks.has("au")) {
    result.au = await upgradeGenericAuRows();
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
      .filter(Boolean)
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
