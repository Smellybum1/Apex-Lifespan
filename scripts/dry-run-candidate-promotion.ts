import { listSourceCandidateReviewQueue } from "@/lib/data/source-candidates";
import { assessSourceCandidatePublicPromotion } from "@/lib/operator/curation-promotion";

async function main() {
  const dedupeKey = await resolveDedupeKey(process.argv.slice(2));

  if (!dedupeKey) {
    console.error(
      "Usage: npm run promotion:dry-run -- <source-candidate-dedupe-key>\n" +
        "   or: npm run promotion:dry-run -- --pmid <pubmed-id>"
    );
    process.exitCode = 1;
    return;
  }

  const assessment = await assessSourceCandidatePublicPromotion(dedupeKey);
  console.log(JSON.stringify(assessment, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function resolveDedupeKey(args: string[]) {
  const pmidIndex = args.indexOf("--pmid");
  const pmid = pmidIndex >= 0 ? args[pmidIndex + 1]?.trim() : undefined;

  if (pmid) {
    const candidates = await listSourceCandidateReviewQueue({
      decision: "Accepted",
      externalId: pmid,
      limit: 10,
      source: "PubMed"
    });

    if (candidates.length === 1) {
      return candidates[0]?.dedupeKey;
    }

    if (candidates.length === 0) {
      throw new Error(`No accepted PubMed source candidate found for PMID ${pmid}.`);
    }

    throw new Error(
      `Multiple accepted PubMed candidates found for PMID ${pmid}; rerun with a dedupe key.`
    );
  }

  return args.find((arg) => arg.trim() && !arg.startsWith("--"))?.trim();
}
