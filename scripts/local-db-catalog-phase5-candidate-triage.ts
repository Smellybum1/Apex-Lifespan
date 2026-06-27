import {
  SourceCandidateDecision as DbSourceCandidateDecision,
  SourceKind as DbSourceKind
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { loadEnvFile, mergeEnv, withProcessEnv } from "@/lib/env-file";
import {
  extractAcceptedSourceCandidateStudy,
  linkAcceptedSourceCandidateClaim,
  recordSourceCandidateDecision
} from "@/lib/data/source-candidates";
import {
  syncClaimStudyLinksForClaim,
  syncSourcePacketForClaim
} from "@/lib/data/source-packets";

import { EXPANSION_INTERVENTION_IDS } from "./local-db-catalog-phase4-expansion-data";

const REVIEW_NOTE =
  "Local catalog phase-5 candidate triage (hobby-project mode); verify before public promotion.";

const REJECT_TITLE_PATTERNS = [
  /\balbus\b/i,
  /\brat(s)?\b/i,
  /\bmice\b/i,
  /\bmurine\b/i,
  /\bporcine\b/i,
  /\bzebrafish\b/i
];

const INTERVENTION_KEYWORDS: Record<string, string[]> = {
  astaxanthin: ["astaxanthin", "carotenoid"],
  calcium: ["calcium supplement", "calcium supplementation", "dietary calcium", "oral calcium"],
  ginseng: ["ginseng", "panax ginseng", "panax"],
  "green-tea-extract": ["green tea", "camellia sinensis", "egcg", "catechin"],
  "lion-s-mane": ["hericium", "lion's mane", "lion mane"],
  "lutein-and-zeaxanthin": ["lutein", "zeaxanthin", "macular pigment", "carotenoid"],
  psilocybin: ["psilocybin", "psychedelic"],
  quercetin: ["quercetin"],
  resveratrol: ["resveratrol"],
  "vitamin-c": ["vitamin c", "ascorbic acid"],
  glycine: ["glycine"],
  collagen: ["collagen"],
  matcha: ["matcha", "green tea"],
  "nmn-nr": ["nmn", "nicotinamide mononucleotide", "nicotinamide riboside", "nad+"],
  semaglutide: ["semaglutide"],
  retatrutide: ["retatrutide"],
  "trimethylglycine-tmg": ["betaine", "trimethylglycine", "tmg"],
  caffeine: ["caffeine"],
  "coenzyme-q10": ["coenzyme q10", "coq10", "ubiquinone"],
  ashwagandha: ["ashwagandha", "withania"],
  berberine: ["berberine"],
  "beta-alanine": ["beta-alanine", "β-alanine", "beta alanine"],
  creatine: ["creatine"],
  "omega-3": ["omega-3", "omega 3", "epa", "dha", "fish oil"],
  "vitamin-d": ["vitamin d", "vitamin d3", "cholecalciferol", "25(oh)d"],
  curcumin: ["curcumin", "turmeric"],
  magnesium: ["magnesium"],
  melatonin: ["melatonin"],
  zinc: ["zinc"],
  iron: ["iron"],
  "folic-acid": ["folate", "folic acid"],
  "vitamin-b12": ["vitamin b12", "cobalamin", "b12"],
  "n-acetylcysteine": ["n-acetylcysteine", "nac", "n acetylcysteine"],
  "l-theanine": ["l-theanine", "theanine"],
  "l-citrulline": ["l-citrulline", "citrulline"],
  taurine: ["taurine"],
  "probiotic-blend": ["probiotic", "probiotics"],
  psyllium: ["psyllium"],
  "glucosamine-chondroitin": ["glucosamine", "chondroitin"],
  "hydrolyzed-collagen": ["collagen"],
  "whey-protein": ["whey protein", "whey"],
  "bpc-157": ["bpc-157", "bpc 157", "body protection compound"]
};

const CALCIUM_FALSE_POSITIVE_PATTERNS = [
  /\bamlodipine\b/i,
  /\bantihypertensive\b/i,
  /\bangiotensin\b/i,
  /\bcoronary artery calcium\b/i,
  /\bcalcified\b/i,
  /\blithotripsy\b/i,
  /\bdietary salt\b/i,
  /\bdigital health\b/i,
  /\btelmisartan\b/i,
  /\blevosimendan\b/i,
  /\bdobutamine\b/i,
  /\bintravenous calcium\b/i,
  /\biv calcium\b/i,
  /\bhypertension treatment\b/i,
  /\bhypertensive drug\b/i,
  /\bpost-partum hypertension\b/i
];

const CROSS_INTERVENTION_REJECT: Array<{
  interventionId: string;
  patterns: RegExp[];
}> = [
  {
    interventionId: "ginseng",
    patterns: [/\bashwagandha\b/i, /\bwithania\b/i]
  },
  {
    interventionId: "lion-s-mane",
    patterns: [/\bashwagandha\b/i, /\bwithania\b/i]
  }
];

function classifyPendingCandidate(candidate: {
  claimId: string | null;
  externalId: string;
  interventionId: string | null;
  query: string;
  source: DbSourceKind;
  title: string;
  triageScore: number;
}): "accept" | "reject" | "skip" {
  const title = candidate.title.toLowerCase();

  if (!candidate.interventionId || !candidate.claimId) {
    return "reject";
  }

  if (REJECT_TITLE_PATTERNS.some((pattern) => pattern.test(candidate.title))) {
    return "reject";
  }

  const crossReject = CROSS_INTERVENTION_REJECT.find(
    (rule) => rule.interventionId === candidate.interventionId
  );
  if (crossReject?.patterns.some((pattern) => pattern.test(candidate.title))) {
    return "reject";
  }

  if (candidate.interventionId === "calcium") {
    if (CALCIUM_FALSE_POSITIVE_PATTERNS.some((pattern) => pattern.test(candidate.title))) {
      return "reject";
    }
    const hasDietaryCalcium =
      title.includes("calcium supplement") ||
      title.includes("calcium supplementation") ||
      title.includes("dietary calcium") ||
      (title.includes("calcium") &&
        (title.includes("blood pressure") || title.includes("hypertension")) &&
        !title.includes("coronary artery calcium"));
    if (!hasDietaryCalcium) {
      return "reject";
    }
  }

  if (candidate.interventionId === "quercetin" && !title.includes("quercetin")) {
    return "reject";
  }

  if (candidate.interventionId === "astaxanthin") {
    if (!title.includes("astaxanthin") && !title.includes("carotenoid")) {
      return "reject";
    }
  }

  const keywords = INTERVENTION_KEYWORDS[candidate.interventionId] ?? [
    candidate.interventionId.replace(/-/g, " ")
  ];
  const titleMatches = keywords.some((keyword) => title.includes(keyword.toLowerCase()));

  if (!titleMatches) {
    return "reject";
  }

  if (candidate.triageScore >= 70) {
    return "accept";
  }

  if (
    candidate.triageScore >= 60 &&
    candidate.source === DbSourceKind.PUBMED &&
    candidate.interventionId === "green-tea-extract" &&
    title.includes("green tea")
  ) {
    return "accept";
  }

  return "reject";
}

async function triageExpansionCandidates(scope: "expansion" | "all") {
  const result = {
    accepted: [] as string[],
    rejected: [] as string[],
    skipped: [] as string[],
    errors: [] as string[]
  };

  const pending = await prisma.sourceCandidate.findMany({
    where: {
      decision: DbSourceCandidateDecision.PENDING_REVIEW,
      ...(scope === "expansion"
        ? { interventionId: { in: [...EXPANSION_INTERVENTION_IDS] } }
        : {})
    },
    orderBy: [{ triageScore: "desc" }, { title: "asc" }]
  });

  for (const candidate of pending) {
    const decision = classifyPendingCandidate(candidate);

    if (decision === "skip") {
      result.skipped.push(candidate.dedupeKey);
      continue;
    }

    if (decision === "reject") {
      try {
        await recordSourceCandidateDecision({
          dedupeKey: candidate.dedupeKey,
          decision: "Rejected",
          reviewNote: "Rejected in local catalog phase-5 triage: weak or mismatched PubMed match."
        });
        result.rejected.push(candidate.dedupeKey);
      } catch (error) {
        result.errors.push(
          `reject ${candidate.dedupeKey}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      continue;
    }

    if (!candidate.claimId) {
      result.skipped.push(candidate.dedupeKey);
      continue;
    }

    try {
      const referenceId = await ensureSourceCandidateReference(candidate);
      await recordSourceCandidateDecision({
        acceptedReferenceId: referenceId,
        dedupeKey: candidate.dedupeKey,
        decision: "Accepted",
        reviewNote: REVIEW_NOTE
      });
      await linkAcceptedSourceCandidateClaim({
        dedupeKey: candidate.dedupeKey,
        relevance: 7
      });

      const studyCount = await prisma.study.count({ where: { referenceId } });
      if (studyCount === 0) {
        await extractAcceptedSourceCandidateStudy({
          dedupeKey: candidate.dedupeKey,
          adverseEvents: "Verify tolerability and adverse events in linked source record.",
          fundingConflicts: "Check source record for funding and conflicts.",
          interventionName: candidate.interventionId ?? "See source record",
          outcomes: ["See source record"],
          population: "See source record.",
          riskOfBias: "Review design and heterogeneity in linked source record.",
          sampleSize: "See source record.",
          sourceType:
            candidate.source === DbSourceKind.CLINICALTRIALS_GOV
              ? "CLINICAL_TRIAL_RECORD"
              : "META_ANALYSIS"
        });
      }

      await syncSourcePacketForClaim(candidate.claimId);
      await syncClaimStudyLinksForClaim(candidate.claimId);
      result.accepted.push(candidate.dedupeKey);
    } catch (error) {
      result.errors.push(
        `accept ${candidate.dedupeKey}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return { ...result, scanned: pending.length };
}

async function ensureSourceCandidateReference(candidate: {
  externalId: string;
  publishedYear: number | null;
  source: DbSourceKind;
  title: string;
  url: string;
}) {
  const referenceId = sourceCandidateReferenceId(candidate);
  const identifier =
    candidate.source === DbSourceKind.PUBMED
      ? `PMID: ${normalisePubMedId(candidate.externalId)}`
      : normaliseNctId(candidate.externalId);

  await prisma.reference.upsert({
    create: {
      id: referenceId,
      identifier,
      source: candidate.source,
      title: candidate.title,
      url: candidate.url,
      year: candidate.publishedYear ?? null
    },
    update: {
      identifier,
      source: candidate.source,
      title: candidate.title,
      url: candidate.url,
      year: candidate.publishedYear ?? null
    },
    where: { id: referenceId }
  });

  return referenceId;
}

function sourceCandidateReferenceId(candidate: { externalId: string; source: DbSourceKind }) {
  const sourceSlug =
    candidate.source === DbSourceKind.CLINICALTRIALS_GOV ? "clinicaltrials-gov" : "pubmed";
  const externalIdSlug = candidate.externalId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `ref-${sourceSlug}-${externalIdSlug || "candidate"}`;
}

function normalisePubMedId(value: string) {
  return value.trim().replace(/^pmid[:\s]*/i, "");
}

function normaliseNctId(value: string) {
  const trimmed = value.trim().toUpperCase();
  return trimmed.startsWith("NCT") ? trimmed : `NCT${trimmed}`;
}

async function main() {
  const scope = process.argv.includes("--scope=all") ? "all" : "expansion";
  const env = mergeEnv(process.env, loadEnvFile(".env.local").env);

  await withProcessEnv(env, async () => {
    const triage = await triageExpansionCandidates(scope);
    const pending = await prisma.sourceCandidate.count({
      where: { decision: DbSourceCandidateDecision.PENDING_REVIEW }
    });
    const accepted = await prisma.sourceCandidate.count({
      where: { decision: DbSourceCandidateDecision.ACCEPTED }
    });

    console.log(
      JSON.stringify(
        {
          scope,
          triage,
          after: { pendingReview: pending, accepted }
        },
        null,
        2
      )
    );
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
