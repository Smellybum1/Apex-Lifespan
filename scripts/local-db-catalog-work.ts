import {
  Prisma,
  ScoreChangeKind as DbScoreChangeKind,
  SourceKind as DbSourceKind,
  SourceCandidateDecision as DbSourceCandidateDecision,
  StudyType as DbStudyType
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { loadEnvFile, mergeEnv, withProcessEnv } from "@/lib/env-file";
import {
  extractAcceptedSourceCandidateStudy,
  linkAcceptedSourceCandidateClaim,
  recordSourceCandidateDecision
} from "@/lib/data/source-candidates";
import { captureClaimScoreSnapshot } from "@/lib/data/score-history";
import {
  syncClaimStudyLinksForClaim,
  syncSourcePacketForClaim
} from "@/lib/data/source-packets";

interface WorkSummary {
  trackA: Record<string, unknown>;
  trackB: Record<string, unknown>;
  trackC: Record<string, unknown>;
  after: Record<string, unknown>;
}

const REVIEW_NOTE =
  "Local catalog maintenance pass (hobby-project mode); verify before public promotion.";

const PENDING_ACCEPT_PMIDS: Array<{
  pmid: string;
  claimId: string;
}> = [
  { pmid: "30762623", claimId: "creatine-strength" },
  { pmid: "35914996", claimId: "omega-3-cv-events" },
  { pmid: "42144851", claimId: "omega-3-cv-events" },
  { pmid: "32634581", claimId: "omega-3-cv-events" },
  { pmid: "42126475", claimId: "ashwagandha-safety" }
];

const PENDING_ACCEPT_NCTS: Array<{
  claimId: string;
  nctId: string;
}> = [
  { nctId: "NCT06606704", claimId: "creatine-strength" },
  { nctId: "NCT02047864", claimId: "creatine-strength" }
];

const VITAMIN_D_SAFETY_REJECT_TERMS = [
  "lubiprostone",
  "chitosan",
  "erxian",
  "warts",
  "urticaria",
  "psoriasis",
  "breast cancer",
  "asthma",
  "osteoporosis",
  "fracture",
  "calcium",
  "placebo-controlled trial of"
];

async function main() {
  const tracks = readTrackArgs(process.argv.slice(2));
  const env = mergeEnv(process.env, loadEnvFile(".env.local").env);

  await withProcessEnv(env, async () => {
    const summary: Partial<WorkSummary> = {};

    if (tracks.has("a")) {
      summary.trackA = await trackA();
    }
    if (tracks.has("b")) {
      summary.trackB = await trackB();
    }
    if (tracks.has("c")) {
      summary.trackC = await trackC();
    }
    summary.after = await catalogSnapshot();

    console.log(JSON.stringify(summary, null, 2));
  });
}

function readTrackArgs(args: string[]) {
  const trackArg = args.find((arg) => arg.startsWith("--tracks="));
  if (!trackArg) {
    return new Set(["a", "b", "c"]);
  }

  return new Set(
    trackArg
      .slice("--tracks=".length)
      .split(",")
      .map((track) => track.trim().toLowerCase())
      .filter((track) => track === "a" || track === "b" || track === "c")
  );
}

async function trackA() {
  const result: Record<string, unknown> = {};

  const claimAiFix = await prisma.$executeRaw`
    UPDATE "Claim"
    SET "reviewStatus" = 'UNREVIEWED_AI_DRAFT'::"ReviewStatus"
    WHERE "reviewStatus" = 'AI_REVIEWED'::"ReviewStatus"
  `;
  result.claimAiReviewedFixed = claimAiFix;

  const candidateAiFix = await prisma.$executeRaw`
    UPDATE "SourceCandidate"
    SET "reviewStatus" = CASE
      WHEN decision IN ('ACCEPTED'::"SourceCandidateDecision", 'REJECTED'::"SourceCandidateDecision")
        THEN 'HUMAN_REVIEWED'::"ReviewStatus"
      ELSE 'UNREVIEWED_AI_DRAFT'::"ReviewStatus"
    END
    WHERE "reviewStatus" = 'AI_REVIEWED'::"ReviewStatus"
  `;
  result.candidateAiReviewedFixed = candidateAiFix;

  const snapshotAiFix = await prisma.$executeRaw`
    UPDATE "ClaimScoreSnapshot"
    SET "reviewStatus" = 'UNREVIEWED_AI_DRAFT'::"ReviewStatus"
    WHERE "reviewStatus"::text = 'AI_REVIEWED'
  `;
  result.snapshotAiReviewedFixed = snapshotAiFix;

  const glycinateId = "magnesium-glycinate";
  const glycinate = await prisma.intervention.findUnique({
    where: { id: glycinateId },
    include: { claims: true }
  });

  if (glycinate) {
    await prisma.sourceCandidate.updateMany({
      data: { interventionId: "magnesium" },
      where: { interventionId: glycinateId }
    });
    await prisma.australiaRegulatoryStatus.deleteMany({
      where: { interventionId: glycinateId }
    });
    await prisma.trial.deleteMany({
      where: { interventionId: glycinateId }
    });
    await prisma.product.deleteMany({
      where: { interventionId: glycinateId }
    });
    await prisma.intervention.delete({ where: { id: glycinateId } });
    result.magnesiumGlycinateDeleted = true;
  } else {
    result.magnesiumGlycinateDeleted = false;
  }

  await upsertReference({
    id: "ods-magnesium",
    identifier: undefined,
    source: DbSourceKind.NIH_ODS,
    title: "Magnesium - Health Professional Fact Sheet",
    url: "https://ods.od.nih.gov/factsheets/Magnesium-HealthProfessional/",
    year: 2025
  });

  await upsertStudy({
    id: "study-magnesium-ods",
    referenceId: "ods-magnesium",
    title: "Magnesium health professional fact sheet",
    year: 2025,
    source: "NIH Office of Dietary Supplements",
    sourceType: DbStudyType.SYSTEMATIC_REVIEW,
    sampleSize: "Evidence summary",
    population: "General health professional reference",
    interventionName: "Magnesium",
    outcomes: ["Dietary intake", "Deficiency", "Sleep and other endpoints", "Safety limits"],
    adverseEvents:
      "Diarrhea with some forms; renal disease and medication interactions matter.",
    fundingConflicts: "Government health information source.",
    riskOfBias: "Reference summary; not a single trial."
  });

  await upsertClaimReference("magnesium-sleep", "ods-magnesium", 7);

  const magnesiumAu = await prisma.australiaRegulatoryStatus.findFirst({
    where: { interventionId: "magnesium" }
  });
  if (!magnesiumAu) {
    await upsertReference({
      id: "tga-artg",
      identifier: undefined,
      source: DbSourceKind.TGA,
      title: "About the Australian Register of Therapeutic Goods (ARTG)",
      url: "https://www.tga.gov.au/products/regulations-all-products/about-australian-register-therapeutic-goods-artg",
      year: 2024
    });

    await prisma.australiaRegulatoryStatus.create({
      data: {
        id: "au-reg-magnesium-intervention",
        interventionId: "magnesium",
        referenceId: "tga-artg",
        region: "AU",
        kind: "UNKNOWN",
        status: "Product-level ARTG status required",
        supplySummary:
          "Magnesium is tracked as an intervention; Australian product supply status must be verified product by product.",
        evidenceRequirement:
          "Record AUST number, sponsor, formulation, and permitted indications when product ingestion is added.",
        sourceUrl:
          "https://www.tga.gov.au/products/regulations-all-products/about-australian-register-therapeutic-goods-artg",
        checkedAt: new Date("2026-06-24T00:00:00.000Z"),
        notes:
          "Do not assume a generic mineral evidence card applies to every Australian product label."
      }
    });
    result.magnesiumAuCreated = true;
  } else {
    result.magnesiumAuCreated = false;
  }

  const magnesiumSleepPacket = await syncSourcePacketForClaim("magnesium-sleep");
  await syncClaimStudyLinksForClaim("magnesium-sleep");

  const magnesiumSleepClaim = await prisma.claim.findUnique({
    where: { id: "magnesium-sleep" }
  });
  if (magnesiumSleepClaim) {
    const snapshot = await captureClaimScoreSnapshot(magnesiumSleepClaim, {
      claimId: magnesiumSleepClaim.id,
      rationale: "Magnesium sleep packet completion after local catalog maintenance.",
      reason: DbScoreChangeKind.MANUAL_REVIEW
    });
    result.magnesiumSleepSnapshot = snapshot.created ? "created" : "skipped";
  }

  result.magnesiumSleepPacket = magnesiumSleepPacket.status;

  return result;
}

async function trackB() {
  const result: Record<string, unknown> = { claims: {} };

  await upsertReference({
    id: "issn-caffeine-2021",
    identifier: "PMID: 33303903",
    source: DbSourceKind.PUBMED,
    title:
      "International society of sports nutrition position stand: caffeine and exercise performance",
    url: "https://pubmed.ncbi.nlm.nih.gov/33303903/",
    year: 2021
  });

  await upsertReference({
    id: "pubmed-caffeine-sleep-2017",
    identifier: "PMID: 28841483",
    source: DbSourceKind.PUBMED,
    title:
      "Caffeine consumption and sleep quality in Australian adults",
    url: "https://pubmed.ncbi.nlm.nih.gov/28841483/",
    year: 2017
  });

  await upsertStudy({
    id: "study-issn-caffeine-2021",
    referenceId: "issn-caffeine-2021",
    title:
      "International society of sports nutrition position stand: caffeine and exercise performance",
    year: 2021,
    source: "Journal of the International Society of Sports Nutrition via PubMed",
    sourceType: DbStudyType.SYSTEMATIC_REVIEW,
    sampleSize: "Position stand / evidence synthesis",
    population: "Exercise and sport nutrition contexts",
    interventionName: "Caffeine",
    outcomes: ["Endurance", "Strength", "Cognition", "Safety"],
    adverseEvents: "Dose, timing, and individual sensitivity affect tolerability; verify source.",
    fundingConflicts: "Check source record for details.",
    riskOfBias: "Position stand synthesis; not a single trial.",
    pmid: "33303903"
  });

  await upsertStudy({
    id: "study-pubmed-caffeine-sleep-2017",
    referenceId: "pubmed-caffeine-sleep-2017",
    title: "Caffeine consumption and sleep quality in Australian adults",
    year: 2017,
    source: "Nutrients via PubMed",
    sourceType: DbStudyType.OBSERVATIONAL_COHORT,
    sampleSize: "Cross-sectional cohort",
    population: "Australian adults",
    interventionName: "Dietary caffeine intake",
    outcomes: ["Sleep quality", "Sleep duration"],
    adverseEvents: "Observational association context; not interventional safety proof.",
    fundingConflicts: "Check source record for details.",
    riskOfBias: "Observational design; residual confounding possible.",
    pmid: "28841483"
  });

  const claimLinks: Record<string, string[]> = {
    "caffeine-endurance": ["issn-caffeine-2021"],
    "caffeine-cognition": ["issn-caffeine-2021"],
    "caffeine-safety": ["issn-caffeine-2021"],
    "caffeine-sleep": ["pubmed-caffeine-sleep-2017", "issn-caffeine-2021"]
  };

  for (const [claimId, referenceIds] of Object.entries(claimLinks)) {
    for (const referenceId of referenceIds) {
      await upsertClaimReference(claimId, referenceId, 7);
    }
    const packet = await syncSourcePacketForClaim(claimId);
    const studySync = await syncClaimStudyLinksForClaim(claimId);
    (result.claims as Record<string, unknown>)[claimId] = {
      packetStatus: packet.status,
      studySync
    };
  }

  return result;
}

async function trackC() {
  const result: Record<string, unknown> = {
    acceptedLinked: [] as string[],
    acceptedExtracted: [] as string[],
    pendingAccepted: [] as string[],
    pendingRejected: [] as string[],
    errors: [] as string[]
  };

  const accepted = await prisma.sourceCandidate.findMany({
    where: { decision: DbSourceCandidateDecision.ACCEPTED },
    orderBy: { dedupeKey: "asc" }
  });

  for (const candidate of accepted) {
    if (!candidate.claimId || !candidate.acceptedReferenceId) {
      continue;
    }

    const existingLink = await prisma.claimReference.findUnique({
      where: {
        claimId_referenceId: {
          claimId: candidate.claimId,
          referenceId: candidate.acceptedReferenceId
        }
      }
    });

    if (!existingLink) {
      try {
        await linkAcceptedSourceCandidateClaim({
          dedupeKey: candidate.dedupeKey,
          relevance: 7
        });
        (result.acceptedLinked as string[]).push(candidate.dedupeKey);
      } catch (error) {
        (result.errors as string[]).push(
          `link ${candidate.dedupeKey}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    const studyCount = await prisma.study.count({
      where: { referenceId: candidate.acceptedReferenceId }
    });

    if (studyCount === 0) {
      try {
        await extractAcceptedSourceCandidateStudy({
          dedupeKey: candidate.dedupeKey,
          adverseEvents: "Not extracted in catalog maintenance pass; verify in source.",
          fundingConflicts: "Check source record.",
          interventionName: candidate.interventionId ?? "See source record",
          outcomes: ["See source record"],
          population: "See source record.",
          riskOfBias: "Not formally assessed in catalog maintenance pass.",
          sampleSize: "See source record.",
          sourceType:
            candidate.source === DbSourceKind.CLINICALTRIALS_GOV
              ? "CLINICAL_TRIAL_RECORD"
              : "SYSTEMATIC_REVIEW"
        });
        (result.acceptedExtracted as string[]).push(candidate.dedupeKey);
      } catch (error) {
        (result.errors as string[]).push(
          `extract ${candidate.dedupeKey}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    if (candidate.claimId) {
      await syncSourcePacketForClaim(candidate.claimId);
      await syncClaimStudyLinksForClaim(candidate.claimId);
    }
  }

  const pending = await prisma.sourceCandidate.findMany({
    where: { decision: DbSourceCandidateDecision.PENDING_REVIEW },
    orderBy: [{ triageScore: "desc" }, { title: "asc" }]
  });

  for (const candidate of pending) {
    const shouldReject = isRejectableVitaminDSafetyNoise(candidate);
    const shouldAccept =
      !shouldReject &&
      (isAllowlistedPendingAccept(candidate) || isHighConfidencePendingAccept(candidate));

    if (shouldReject) {
      try {
        await recordSourceCandidateDecision({
          dedupeKey: candidate.dedupeKey,
          decision: "Rejected",
          reviewNote:
            "Rejected in local catalog triage: query/title mismatch for vitamin D safety claim."
        });
        (result.pendingRejected as string[]).push(candidate.dedupeKey);
      } catch (error) {
        (result.errors as string[]).push(
          `reject ${candidate.dedupeKey}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      continue;
    }

    if (!shouldAccept || !candidate.claimId) {
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
          adverseEvents: "Not extracted in catalog maintenance pass; verify in source.",
          fundingConflicts: "Check source record.",
          interventionName: candidate.interventionId ?? "See source record",
          outcomes: ["See source record"],
          population: "See source record.",
          riskOfBias: "Not formally assessed in catalog maintenance pass.",
          sampleSize: "See source record.",
          sourceType:
            candidate.source === DbSourceKind.CLINICALTRIALS_GOV
              ? "CLINICAL_TRIAL_RECORD"
              : "SYSTEMATIC_REVIEW"
        });
      }

      await syncSourcePacketForClaim(candidate.claimId);
      await syncClaimStudyLinksForClaim(candidate.claimId);
      (result.pendingAccepted as string[]).push(candidate.dedupeKey);
    } catch (error) {
      (result.errors as string[]).push(
        `accept ${candidate.dedupeKey}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return result;
}

function isRejectableVitaminDSafetyNoise(candidate: {
  claimId: string | null;
  interventionId: string | null;
  query: string;
  title: string;
}) {
  if (candidate.interventionId !== "vitamin-d") {
    return false;
  }

  const haystack = `${candidate.query} ${candidate.title}`.toLowerCase();
  const title = candidate.title.toLowerCase();
  const query = candidate.query.toLowerCase();
  const safetyOriented =
    query.includes("safety") ||
    query.includes("adverse") ||
    candidate.claimId === "vitamin-d-deficiency";

  if (!safetyOriented) {
    return false;
  }

  const hasVitaminDContext =
    title.includes("vitamin d") ||
    title.includes("vitamin d3") ||
    title.includes("cholecalciferol") ||
    title.includes("25(oh)d") ||
    title.includes("25-hydroxy") ||
    title.includes("ergocalciferol");

  if (hasVitaminDContext) {
    return false;
  }

  if (VITAMIN_D_SAFETY_REJECT_TERMS.some((term) => haystack.includes(term))) {
    return true;
  }

  return !title.includes("vitamin");
}

function isAllowlistedPendingAccept(candidate: {
  claimId: string | null;
  externalId: string;
}) {
  const pmid = normalisePubMedId(candidate.externalId);
  const nctId = normaliseNctId(candidate.externalId);

  if (pmid && candidate.claimId) {
    return PENDING_ACCEPT_PMIDS.some(
      (row) => row.pmid === pmid && row.claimId === candidate.claimId
    );
  }

  if (nctId && candidate.claimId) {
    return PENDING_ACCEPT_NCTS.some(
      (row) => row.nctId === nctId && row.claimId === candidate.claimId
    );
  }

  return false;
}

function isHighConfidencePendingAccept(candidate: {
  claimId: string | null;
  interventionId: string | null;
  source: DbSourceKind;
  title: string;
  triageScore: number;
}) {
  if (!candidate.claimId || !candidate.interventionId || candidate.triageScore < 75) {
    return false;
  }

  if (candidate.source !== DbSourceKind.PUBMED) {
    return false;
  }

  const title = candidate.title.toLowerCase();
  const intervention = candidate.interventionId.toLowerCase();

  if (intervention === "creatine" && title.includes("creatine") && title.includes("strength")) {
    return candidate.claimId === "creatine-strength";
  }

  if (intervention === "omega-3" && title.includes("omega") && title.includes("cardiovascular")) {
    return candidate.claimId === "omega-3-cv-events";
  }

  if (intervention === "ashwagandha" && title.includes("ashwagandha") && title.includes("safety")) {
    return candidate.claimId === "ashwagandha-safety";
  }

  return false;
}

async function ensureSourceCandidateReference(candidate: {
  externalId: string;
  metadata: Prisma.JsonValue;
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

  await upsertReference({
    id: referenceId,
    identifier,
    source: candidate.source,
    title: candidate.title,
    url: candidate.url,
    year: candidate.publishedYear ?? undefined
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

async function upsertReference(input: {
  id: string;
  identifier?: string;
  source: DbSourceKind;
  title: string;
  url: string;
  year?: number;
}) {
  await prisma.reference.upsert({
    create: {
      id: input.id,
      identifier: input.identifier ?? null,
      source: input.source,
      title: input.title,
      url: input.url,
      year: input.year ?? null
    },
    update: {
      identifier: input.identifier ?? null,
      source: input.source,
      title: input.title,
      url: input.url,
      year: input.year ?? null
    },
    where: { id: input.id }
  });
}

async function upsertStudy(input: {
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
  nctId?: string;
}) {
  await prisma.study.upsert({
    create: {
      id: input.id,
      referenceId: input.referenceId,
      title: input.title,
      year: input.year,
      source: input.source,
      sourceType: input.sourceType,
      sampleSize: input.sampleSize,
      population: input.population,
      interventionName: input.interventionName,
      outcomes: input.outcomes,
      adverseEvents: input.adverseEvents,
      fundingConflicts: input.fundingConflicts,
      riskOfBias: input.riskOfBias,
      pmid: input.pmid ?? null,
      nctId: input.nctId ?? null
    },
    update: {
      referenceId: input.referenceId,
      title: input.title,
      year: input.year,
      source: input.source,
      sourceType: input.sourceType,
      sampleSize: input.sampleSize,
      population: input.population,
      interventionName: input.interventionName,
      outcomes: input.outcomes,
      adverseEvents: input.adverseEvents,
      fundingConflicts: input.fundingConflicts,
      riskOfBias: input.riskOfBias,
      pmid: input.pmid ?? null,
      nctId: input.nctId ?? null
    },
    where: { id: input.id }
  });
}

async function upsertClaimReference(claimId: string, referenceId: string, relevance: number) {
  await prisma.claimReference.upsert({
    create: {
      claimId,
      note: REVIEW_NOTE,
      referenceId,
      relevance
    },
    update: {
      note: REVIEW_NOTE,
      relevance
    },
    where: {
      claimId_referenceId: {
        claimId,
        referenceId
      }
    }
  });
}

async function catalogSnapshot() {
  const [
    interventionCount,
    claimCount,
    aiReviewedClaims,
    aiReviewedCandidates,
    packetGroups,
    pendingCount,
    acceptedCount,
    rejectedCount,
    caffeinePackets,
    magnesiumSleepPacket
  ] = await Promise.all([
    prisma.intervention.count(),
    prisma.claim.count(),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "Claim" WHERE "reviewStatus" = 'AI_REVIEWED'
    `,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "SourceCandidate" WHERE "reviewStatus" = 'AI_REVIEWED'
    `,
    prisma.sourcePacket.groupBy({
      by: ["status"],
      where: { current: true },
      _count: { _all: true }
    }),
    prisma.sourceCandidate.count({
      where: { decision: DbSourceCandidateDecision.PENDING_REVIEW }
    }),
    prisma.sourceCandidate.count({
      where: { decision: DbSourceCandidateDecision.ACCEPTED }
    }),
    prisma.sourceCandidate.count({
      where: { decision: DbSourceCandidateDecision.REJECTED }
    }),
    prisma.sourcePacket.findMany({
      where: {
        current: true,
        claimId: { startsWith: "caffeine-" }
      },
      select: { claimId: true, status: true }
    }),
    prisma.sourcePacket.findFirst({
      where: { claimId: "magnesium-sleep", current: true },
      select: { status: true }
    })
  ]);

  return {
    interventions: interventionCount,
    claims: claimCount,
    aiReviewedClaims: Number(aiReviewedClaims[0]?.count ?? 0),
    aiReviewedCandidates: Number(aiReviewedCandidates[0]?.count ?? 0),
    sourcePacketStatus: packetGroups.map((group) => ({
      status: group.status,
      count: group._count._all
    })),
    sourceCandidates: {
      accepted: acceptedCount,
      pending: pendingCount,
      rejected: rejectedCount
    },
    caffeinePackets,
    magnesiumSleepPacket: magnesiumSleepPacket?.status ?? null
  };
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
