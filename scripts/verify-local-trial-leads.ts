import {
  EvidenceMomentum as DbEvidenceMomentum,
  TrialStatus as DbTrialStatus
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { loadEnvFile, mergeEnv, withProcessEnv } from "@/lib/env-file";
import { isNctIdFormat } from "@/lib/catalog-trust";

interface ClinicalTrialsStudyResponse {
  protocolSection?: {
    identificationModule?: {
      nctId?: string;
      briefTitle?: string;
      officialTitle?: string;
    };
    statusModule?: {
      overallStatus?: string;
      resultsFirstSubmitDate?: string;
      resultsFirstPostDateStruct?: {
        date?: string;
      };
    };
  };
  resultsSection?: unknown;
}

async function main() {
  const args = process.argv.slice(2);
  const envFile = readOption(args, "--env-file") ?? ".env.local";
  const limit = Number(readOption(args, "--limit") ?? "0");
  const summaryOnly = args.includes("--summary");
  const failuresOnly = args.includes("--failures-only");
  const demoteFailedToSearch = args.includes("--demote-failed-to-search");
  const apply = args.includes("--apply");
  const json = args.includes("--json");
  const env = mergeEnv(process.env, loadEnvFile(envFile).env);

  await withProcessEnv(env, async () => {
    const trials = await prisma.trial.findMany({
      orderBy: [{ interventionId: "asc" }, { nctId: "asc" }],
      select: {
        id: true,
        interventionId: true,
        intervention: {
          select: {
            name: true,
            slug: true
          }
        },
        nctId: true,
        resultsPosted: true,
        title: true,
        url: true
      }
    });
    const nctIdTrials = trials.filter((trial) => isNctIdFormat(trial.nctId ?? undefined));
    const searchOnlyTrials = trials.filter((trial) => !isNctIdFormat(trial.nctId ?? undefined));
    const searchOnlyRowsNeedingCleanup = searchOnlyTrials
      .filter(
        (trial) =>
          Boolean(trial.nctId) ||
          trial.resultsPosted ||
          trial.url.toLowerCase().includes("/study/")
      )
      .map((trial) => ({
        id: trial.id,
        interventionId: trial.interventionId,
        nctId: trial.nctId,
        resultsPosted: trial.resultsPosted,
        searchTerm: trial.intervention?.name ?? trial.intervention?.slug ?? trial.interventionId ?? trial.title,
        url: trial.url
      }));
    const toVerify = limit > 0 ? nctIdTrials.slice(0, limit) : nctIdTrials;
    const verified = [];
    const failed = [];

    for (const trial of toVerify) {
      try {
        const remote = await fetchClinicalTrialsStudy(trial.nctId as string);
        verified.push({
          id: trial.id,
          interventionId: trial.interventionId,
          localTitle: trial.title,
          nctId: trial.nctId,
          remoteStatus: remote.status,
          remoteTitle: remote.title,
          resultsPosted: remote.resultsPosted,
          url: trial.url
        });
      } catch (error) {
        failed.push({
          id: trial.id,
          interventionId: trial.interventionId,
          localTitle: trial.title,
          nctId: trial.nctId,
          error: error instanceof Error ? error.message : String(error),
          searchTerm: trial.intervention?.name ?? trial.intervention?.slug ?? trial.interventionId ?? trial.title,
          url: trial.url
        });
      }
    }

    const demoted = [];
    if (demoteFailedToSearch && apply) {
      for (const lead of failed) {
        await prisma.trial.update({
          where: { id: lead.id },
          data: searchOnlyUpdateData(lead.searchTerm)
        });
        demoted.push(`${lead.interventionId}: ${lead.nctId}`);
      }

      for (const lead of searchOnlyRowsNeedingCleanup) {
        await prisma.trial.update({
          where: { id: lead.id },
          data: searchOnlyUpdateData(lead.searchTerm)
        });
        demoted.push(`${lead.interventionId}: search-only cleanup`);
      }
    }

    const report = {
      apply,
      checked: verified.length + failed.length,
      demoteFailedToSearch,
      demoted,
      demotedCount: demoted.length,
      failedCount: failed.length,
      failed,
      nctIdFormatLeads: nctIdTrials.length,
      searchOnlyCleanupCount: searchOnlyRowsNeedingCleanup.length,
      searchOnlyLeads:
        summaryOnly || failuresOnly
          ? []
          : searchOnlyTrials.map((trial) => ({
              id: trial.id,
              interventionId: trial.interventionId,
              title: trial.title,
              url: trial.url
            })),
      searchOnlyLeadCount: searchOnlyTrials.length,
      totalTrials: trials.length,
      verified: summaryOnly || failuresOnly ? [] : verified,
      verifiedCount: verified.length
    };

    if (json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    console.log(`Trial leads: ${report.totalTrials}`);
    console.log(`NCT ID-format leads: ${report.nctIdFormatLeads}`);
    console.log(`Checked with ClinicalTrials.gov: ${report.checked}`);
    console.log(`Verified live NCT records: ${report.verifiedCount}`);
    console.log(`Failed live NCT lookup: ${report.failedCount}`);
    console.log(`Search-only leads needing NCT selection: ${report.searchOnlyLeadCount}`);
    console.log(`Search-only rows needing cleanup: ${report.searchOnlyCleanupCount}`);
    if (demoteFailedToSearch) {
      console.log(
        apply
          ? `Normalized trial rows to search-only: ${report.demotedCount}`
          : "Normalize failed or stale trial rows to search-only: dry run only; add --apply to update local DB."
      );
    }

    if (summaryOnly) {
      return;
    }

    if (report.failed.length > 0) {
      console.log("\nFailed NCT lookups:");
      for (const lead of report.failed) {
        console.log(`- ${lead.interventionId}: ${lead.nctId} (${lead.error})`);
      }
    }

    if (report.searchOnlyLeads.length > 0) {
      console.log("\nSearch-only leads:");
      for (const lead of report.searchOnlyLeads) {
        console.log(`- ${lead.interventionId}: ${lead.title} (${lead.url})`);
      }
    }
  });
}

async function fetchClinicalTrialsStudy(nctId: string) {
  const response = await fetch(`https://clinicaltrials.gov/api/v2/studies/${nctId}`, {
    headers: { accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`ClinicalTrials.gov returned ${response.status}`);
  }

  const study = (await response.json()) as ClinicalTrialsStudyResponse;
  const remoteNctId = study.protocolSection?.identificationModule?.nctId;

  if (remoteNctId !== nctId) {
    throw new Error(`ClinicalTrials.gov returned ${remoteNctId ?? "no NCT id"}`);
  }

  return {
    resultsPosted: Boolean(
      study.protocolSection?.statusModule?.resultsFirstSubmitDate ||
        study.protocolSection?.statusModule?.resultsFirstPostDateStruct?.date ||
        study.resultsSection
    ),
    status: study.protocolSection?.statusModule?.overallStatus ?? "Unknown",
    title:
      study.protocolSection?.identificationModule?.briefTitle ??
      study.protocolSection?.identificationModule?.officialTitle ??
      "Untitled study"
  };
}

function searchOnlyUpdateData(searchTerm: string) {
  return {
    evidenceImpact: DbEvidenceMomentum.STABLE,
    enrollment: "Not linked",
    lastUpdateDate: new Date(),
    nctId: null,
    phase: "Search-only lead",
    resultsPosted: false,
    status: DbTrialStatus.RESULTS_PENDING,
    url: `https://clinicaltrials.gov/search?term=${encodeURIComponent(searchTerm)}`
  };
}

function readOption(args: string[], option: string) {
  const index = args.indexOf(option);
  if (index >= 0) {
    const value = args[index + 1]?.trim();
    if (!value || value.startsWith("--")) {
      throw new Error(`${option} requires a value.`);
    }
    return value;
  }

  const prefix = `${option}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
