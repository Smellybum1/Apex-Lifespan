import {
  EvidenceMomentum as DbEvidenceMomentum,
  TrialStatus as DbTrialStatus
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { loadEnvFile, mergeEnv, withProcessEnv } from "@/lib/env-file";
import {
  syncClaimStudyLinksForClaim,
  syncSourcePacketForClaim
} from "@/lib/data/source-packets";

import {
  EXPANSION_INTERVENTION_IDS,
  EXPANSION_REFERENCES,
  EXPANSION_STUDIES,
  EXPANSION_TRIAL_LEADS,
  referenceIdsForClaim,
  type ReferenceSpec,
  type StudySpec
} from "./local-db-catalog-phase4-expansion-data";

const REVIEW_NOTE =
  "Local catalog phase-4 expansion pass (hobby-project mode); verify before public promotion.";

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

async function phaseExpansionPackets() {
  const result: Record<string, unknown> = { claims: {}, references: EXPANSION_REFERENCES.length };

  for (const ref of EXPANSION_REFERENCES) {
    await upsertReference(ref);
  }

  for (const study of EXPANSION_STUDIES) {
    await upsertStudy(study);
  }

  const claims = await prisma.claim.findMany({
    where: { interventionId: { in: [...EXPANSION_INTERVENTION_IDS] } },
    select: { id: true, interventionId: true, outcome: true },
    orderBy: [{ interventionId: "asc" }, { id: "asc" }]
  });

  let complete = 0;
  let incomplete = 0;

  for (const claim of claims) {
    const referenceIds = referenceIdsForClaim(
      claim.interventionId as (typeof EXPANSION_INTERVENTION_IDS)[number],
      claim.outcome
    );

    if (referenceIds.length === 0) {
      (result.claims as Record<string, unknown>)[claim.id] = { error: "no references mapped" };
      incomplete += 1;
      continue;
    }

    for (const [index, referenceId] of referenceIds.entries()) {
      await upsertClaimReference(claim.id, referenceId, 8 - index);
    }

    const packet = await syncSourcePacketForClaim(claim.id);
    const studySync = await syncClaimStudyLinksForClaim(claim.id);
    const isComplete = packet.status === "COMPLETE";
    if (isComplete) complete += 1;
    else incomplete += 1;

    (result.claims as Record<string, unknown>)[claim.id] = {
      packetStatus: packet.status,
      referenceIds,
      studySync
    };
  }

  result.summary = { total: claims.length, complete, incomplete };
  return result;
}

async function phaseExpansionTrials() {
  const result = { updated: [] as string[], errors: [] as string[] };

  const placeholders = await prisma.trial.findMany({
    where: {
      interventionId: { in: [...EXPANSION_INTERVENTION_IDS] },
      OR: [
        { title: { contains: "placeholder", mode: "insensitive" } },
        { title: { contains: "registry monitoring", mode: "insensitive" } }
      ]
    }
  });

  for (const trial of placeholders) {
    const interventionId = trial.interventionId;
    if (!interventionId) continue;

    const curated = EXPANSION_TRIAL_LEADS[interventionId];
    if (!curated) {
      result.errors.push(`${interventionId}: no curated trial lead`);
      continue;
    }

    const nctTaken = curated.nctId
      ? await prisma.trial.findFirst({
          where: { nctId: curated.nctId, NOT: { id: trial.id } },
          select: { id: true }
        })
      : null;
    const nctId = curated.nctId && !nctTaken ? curated.nctId : null;
    const url = nctId
      ? `https://clinicaltrials.gov/study/${nctId}`
      : `https://clinicaltrials.gov/search?term=${encodeURIComponent(interventionId)}`;

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
        url,
        nctId,
        resultsPosted: false,
        lastUpdateDate: new Date()
      }
    });
    result.updated.push(`${trial.id}<=curated:${nctId ?? "search"}`);
  }

  return result;
}

async function catalogSnapshot() {
  const [packetGroups, expansionClaims, expansionIncomplete] = await Promise.all([
    prisma.sourcePacket.groupBy({
      by: ["status"],
      where: { current: true },
      _count: { _all: true }
    }),
    prisma.claim.count({ where: { interventionId: { in: [...EXPANSION_INTERVENTION_IDS] } } }),
    prisma.claim.count({
      where: {
        interventionId: { in: [...EXPANSION_INTERVENTION_IDS] },
        OR: [
          { sourcePackets: { none: { current: true } } },
          { sourcePackets: { some: { current: true, status: { not: "COMPLETE" } } } }
        ]
      }
    })
  ]);

  return {
    expansionClaims,
    expansionIncompleteClaims: expansionIncomplete,
    sourcePacketStatus: packetGroups.map((group) => ({
      status: group.status,
      count: group._count._all
    }))
  };
}

function readTrackArgs(args: string[]) {
  const trackArg = args.find((arg) => arg.startsWith("--tracks="));
  if (!trackArg) return new Set(["1", "2"]);
  return new Set(
    trackArg
      .slice("--tracks=".length)
      .split(",")
      .map((track) => track.trim())
      .filter((track) => ["1", "2"].includes(track))
  );
}

async function main() {
  const tracks = readTrackArgs(process.argv.slice(2));
  const env = mergeEnv(process.env, loadEnvFile(".env.local").env);

  await withProcessEnv(env, async () => {
    const summary: Record<string, unknown> = {};
    if (tracks.has("1")) summary.packets = await phaseExpansionPackets();
    if (tracks.has("2")) summary.trials = await phaseExpansionTrials();
    summary.after = await catalogSnapshot();
    console.log(JSON.stringify(summary, null, 2));
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
