import { SourceKind as DbSourceKind } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { loadEnvFile, mergeEnv, withProcessEnv } from "@/lib/env-file";
import {
  queueClaimSourceCandidateIngestionJobs,
  queueSourceCandidateIngestionJob,
  runSourceCandidateIngestionJob,
  summarizeSourceCandidateIngestionJobs
} from "@/lib/data/source-candidate-jobs";
import { buildSourceSearchQueries } from "@/lib/source-queries";
import type { OutcomeArea } from "@/lib/types";

import { EXPANSION_INTERVENTION_IDS } from "./local-db-catalog-phase4-expansion-data";

type Scope = "expansion" | "all";

interface Args {
  apply: boolean;
  pubMedOnly: boolean;
  region: string;
  run: boolean;
  runLimit: number;
  scope: Scope;
}

async function main() {
  const args = readArgs(process.argv.slice(2));
  const env = mergeEnv(process.env, loadEnvFile(".env.local").env);

  await withProcessEnv(env, async () => {
    const interventionIds =
      args.scope === "all"
        ? (
            await prisma.intervention.findMany({ select: { id: true }, orderBy: { id: "asc" } })
          ).map((row) => row.id)
        : [...EXPANSION_INTERVENTION_IDS];

    const claims = await prisma.claim.findMany({
      where: { interventionId: { in: interventionIds } },
      select: { id: true, interventionId: true },
      orderBy: [{ interventionId: "asc" }, { id: "asc" }]
    });

    if (!args.apply && !args.run) {
      console.log(
        JSON.stringify(
          {
            applyRequired: true,
            note:
              "Dry run. Pass --apply to queue jobs and/or --run to execute queued PubMed/ClinicalTrials jobs.",
            scope: args.scope,
            interventionCount: interventionIds.length,
            claimCount: claims.length,
            estimatedJobsPerClaim: args.pubMedOnly ? 1 : 2,
            region: args.region
          },
          null,
          2
        )
      );
      return;
    }

    const summary: Record<string, unknown> = {
      scope: args.scope,
      region: args.region,
      claimCount: claims.length
    };

    if (args.apply) {
      const queueResults = [];
      let created = 0;
      let existing = 0;

      for (const claim of claims) {
        if (args.pubMedOnly) {
          const claimRow = await prisma.claim.findUnique({
            where: { id: claim.id },
            select: {
              claimText: true,
              id: true,
              outcome: true,
              intervention: { select: { id: true, name: true, synonyms: true } }
            }
          });

          if (!claimRow) continue;

          const queries = buildSourceSearchQueries({
            claim: {
              claimText: claimRow.claimText,
              outcome: outcomeLabel(claimRow.outcome)
            },
            intervention: {
              name: claimRow.intervention.name,
              synonyms: claimRow.intervention.synonyms
            }
          });

          const job = await queueSourceCandidateIngestionJob({
            claimId: claimRow.id,
            interventionId: claimRow.intervention.id,
            region: args.region,
            source: "PubMed",
            query: queries.pubMedTerm
          });

          if (job.created) created += 1;
          else existing += 1;
          queueResults.push({
            claimId: claim.id,
            interventionId: claim.interventionId,
            pubMedTerm: queries.pubMedTerm,
            jobs: [{ jobId: job.jobId, source: job.source, created: job.created, status: job.status }]
          });
          continue;
        }

        const result = await queueClaimSourceCandidateIngestionJobs({
          claimId: claim.id,
          region: args.region
        });
        for (const job of result.jobs) {
          if (job.created) created += 1;
          else existing += 1;
        }
        queueResults.push({
          claimId: claim.id,
          interventionId: claim.interventionId,
          pubMedTerm: result.pubMedTerm,
          trialTerm: result.trialTerm,
          jobs: result.jobs.map((job) => ({
            jobId: job.jobId,
            source: job.source,
            created: job.created,
            status: job.status
          }))
        });
      }

      summary.queue = {
        created,
        existing,
        results: queueResults
      };
    }

    if (args.run) {
      const runResults = [];
      let ran = 0;

      while (ran < args.runLimit) {
        const nextJob = await prisma.ingestionJob.findFirst({
          where: {
            status: "QUEUED",
            source: args.pubMedOnly
              ? DbSourceKind.PUBMED
              : { in: [DbSourceKind.PUBMED, DbSourceKind.CLINICALTRIALS_GOV] }
          },
          orderBy: [{ createdAt: "asc" }]
        });

        if (!nextJob) break;

        const result = await runSourceCandidateIngestionJob(nextJob.id, {
          pubMedRetmax: 15,
          clinicalTrialPageSize: 10
        });
        runResults.push(result);
        ran += 1;
      }

      summary.run = {
        attempted: ran,
        results: runResults
      };
    }

    summary.after = await summarizeSourceCandidateIngestionJobs();
    summary.queuedRemaining = await prisma.ingestionJob.count({ where: { status: "QUEUED" } });
    summary.candidateCount = await prisma.sourceCandidate.count();

    console.log(JSON.stringify(summary, null, 2));
  });
}

function readArgs(argv: string[]): Args {
  const parsed: Args = {
    apply: false,
    pubMedOnly: false,
    region: "AU",
    run: false,
    runLimit: 25,
    scope: "expansion"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--apply") {
      parsed.apply = true;
      continue;
    }

    if (arg === "--run") {
      parsed.run = true;
      continue;
    }

    if (arg === "--pubmed-only") {
      parsed.pubMedOnly = true;
      continue;
    }

    if (arg === "--scope") {
      parsed.scope = readScope(readRequiredValue(argv, index, arg));
      index += 1;
      continue;
    }

    if (arg.startsWith("--scope=")) {
      parsed.scope = readScope(readInlineValue(arg, "--scope"));
      continue;
    }

    if (arg === "--region") {
      parsed.region = readRequiredValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--region=")) {
      parsed.region = readInlineValue(arg, "--region");
      continue;
    }

    if (arg === "--run-limit") {
      parsed.runLimit = Number(readRequiredValue(argv, index, arg));
      index += 1;
      continue;
    }

    if (arg.startsWith("--run-limit=")) {
      parsed.runLimit = Number(readInlineValue(arg, "--run-limit"));
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  if (parsed.runLimit < 1 || parsed.runLimit > 100 || Number.isNaN(parsed.runLimit)) {
    throw new Error("--run-limit must be between 1 and 100.");
  }

  return parsed;
}

function readScope(value: string): Scope {
  if (value === "expansion" || value === "all") return value;
  throw new Error('--scope must be "expansion" or "all".');
}

const outcomeLabels: Record<string, OutcomeArea> = {
  MORTALITY_LIFESPAN: "Mortality/lifespan",
  CARDIOVASCULAR_EVENTS: "Cardiovascular events",
  LDL_APOB_LIPIDS: "LDL/ApoB/lipids",
  BLOOD_PRESSURE: "Blood pressure",
  GLUCOSE_INSULIN_HBA1C: "Glucose/insulin/HbA1c",
  INFLAMMATION: "Inflammation",
  COGNITION: "Cognition",
  SLEEP: "Sleep",
  MOOD_STRESS: "Mood/stress",
  SAFETY_ADVERSE_EFFECTS: "Safety/adverse effects",
  IMMUNE_RESPIRATORY: "Immune/respiratory",
  FERTILITY_HORMONES: "Fertility/hormones",
  JOINT_TENDON_SKIN: "Joint/tendon/skin",
  MUSCLE_STRENGTH: "Muscle/strength",
  VO2_MAX_ENDURANCE: "VO2 max/endurance",
  EYE_HEALTH: "Eye health",
  BIOLOGICAL_AGING_CLOCKS: "Biological aging clocks"
};

function outcomeLabel(outcome: string): OutcomeArea {
  const label = outcomeLabels[outcome];
  if (!label) {
    throw new Error(`Unknown outcome enum value: ${outcome}`);
  }
  return label;
}

function readRequiredValue(args: string[], index: number, option: string) {
  const value = args[index + 1]?.trim();
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function readInlineValue(arg: string, option: string) {
  const value = arg.slice(`${option}=`.length).trim();
  if (!value) throw new Error(`${option} requires a value.`);
  return value;
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
