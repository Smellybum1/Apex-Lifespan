import { getEvidenceDashboardData } from "@/lib/data/dashboard";
import { loadEnvFile, mergeEnv, withProcessEnv } from "@/lib/env-file";
import {
  buildInterventionDiscoverySearchQueries,
  buildSourceSearchQueries
} from "@/lib/source-queries";

async function main() {
  const args = process.argv.slice(2);
  const envFile = readOption(args, "--env-file") ?? ".env.local";
  const claimQuery = readOption(args, "--claim");
  const interventionQuery = readOption(args, "--intervention");
  const json = args.includes("--json");

  if (!claimQuery && !interventionQuery) {
    throw new Error("Provide --claim <claim-id> or --intervention <id-or-slug>.");
  }

  const env = mergeEnv(process.env, loadEnvFile(envFile).env);

  await withProcessEnv(env, async () => {
    const data = await getEvidenceDashboardData();
    const claims = claimQuery
      ? data.claims.filter((claim) => claim.id === claimQuery)
      : data.claims.filter((claim) => {
          const intervention = data.interventions.find(
            (item) => item.id === claim.interventionId
          );
          return intervention
            ? [intervention.id, intervention.slug, intervention.name.toLowerCase()].includes(
                (interventionQuery ?? "").toLowerCase()
              )
            : false;
        });

    if (claims.length === 0) {
      throw new Error("No local claim matched the requested intake target.");
    }

    const rows = claims.map((claim) => {
      const intervention = data.interventions.find((item) => item.id === claim.interventionId);
      const queries = buildSourceSearchQueries({
        claim,
        intervention
      });
      const discoveryQueries = intervention
        ? buildInterventionDiscoverySearchQueries({
            intervention
          })
        : undefined;

      return {
        claimId: claim.id,
        claimText: claim.claimText,
        currentLabel: claim.finalLabel,
        interventionId: claim.interventionId,
        interventionName: intervention?.name ?? "Unknown intervention",
        outcome: claim.outcome,
        requiredFields: [
          "source title and URL",
          "PMID/DOI/NCT when available",
          "population, dose/form, comparator, duration, outcome",
          "main result and adverse-event note",
          "why the source matches this scoped claim",
          "what the source does not prove"
        ],
        searches: {
          clinicalTrials: queries.trialTerm,
          pubMed: queries.pubMedTerms
        },
        discoverySearches: discoveryQueries
          ? {
              clinicalTrials: discoveryQueries.trialTerm,
              pubMed: discoveryQueries.pubMedTerms
            }
          : undefined
      };
    });

    if (json) {
      console.log(JSON.stringify({ rows }, null, 2));
      return;
    }

    console.log("Local evidence intake");
    for (const row of rows) {
      console.log(`\n${row.interventionName} - ${row.outcome}`);
      console.log(`Claim: ${row.claimText}`);
      console.log("PubMed:");
      for (const term of row.searches.pubMed) {
        console.log(`- ${term}`);
      }
      console.log(`ClinicalTrials.gov: ${row.searches.clinicalTrials}`);
      if (row.discoverySearches) {
        console.log("Broad discovery PubMed:");
        for (const term of row.discoverySearches.pubMed) {
          console.log(`- ${term}`);
        }
        console.log(`Broad discovery ClinicalTrials.gov: ${row.discoverySearches.clinicalTrials}`);
      }
      console.log("Capture:");
      for (const field of row.requiredFields) {
        console.log(`- ${field}`);
      }
    }
  });
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
