/**
 * Read-only: what would the relevance-gate veto do to the pending pool the
 * unattended 03:00 run will actually scan?
 *
 * Run before letting the veto loose. The veto only ever turns an accept or a
 * hold into a reject, so the number that matters is how many rows it removes
 * and whether the reasons hold up on inspection.
 *
 * Deleted once verified. Writes nothing.
 */
import { PrismaClient, SourceCandidateDecision } from "@prisma/client";

import { evaluateRelevance, type RelevanceVerdict } from "@/lib/relevance-gate";

const prisma = new PrismaClient();

function metadataStrings(value: unknown, key: string): string[] {
  const record = value as Record<string, unknown> | null;
  const raw = record?.[key];

  if (Array.isArray(raw)) {
    return raw.filter((entry): entry is string => typeof entry === "string");
  }

  return typeof raw === "string" ? [raw] : [];
}

function metadataText(value: unknown, key: string): string {
  const record = value as Record<string, unknown> | null;
  const raw = record?.[key];

  return typeof raw === "string" ? raw : "";
}

async function main() {
  const interventions = await prisma.intervention.findMany({
    select: { id: true, slug: true, name: true, synonyms: true }
  });
  const byId = new Map(interventions.map((intervention) => [intervention.id, intervention]));

  const pending = await prisma.sourceCandidate.findMany({
    where: { decision: SourceCandidateDecision.PENDING_REVIEW },
    select: { title: true, source: true, interventionId: true, metadata: true }
  });

  console.log(`Pending candidates: ${pending.length}`);

  const tally: Record<RelevanceVerdict, number> = { accept: 0, reject: 0, undecided: 0 };
  const reasonTally = new Map<string, number>();
  const rejectSamples: string[] = [];
  // Split by discovery bucket: "likely-useful" rows go through the bulk-accept
  // lane, "maybe-useful" through auto-triage. Both now carry the veto, but the
  // bulk lane is the one that previously accepted without looking.
  const byBucket = new Map<string, { reject: number; total: number }>();
  let noAbstract = 0;
  let noIntervention = 0;

  for (const row of pending) {
    const intervention = row.interventionId ? byId.get(row.interventionId) : undefined;

    if (!intervention) {
      noIntervention += 1;
      continue;
    }

    const abstract = [
      metadataText(row.metadata, "abstractText"),
      metadataText(row.metadata, "briefSummary")
    ]
      .filter(Boolean)
      .join(" ");

    if (!abstract) {
      noAbstract += 1;
    }

    const result = evaluateRelevance({
      abstract,
      intervention,
      publicationTypes: metadataStrings(row.metadata, "publicationTypes"),
      source: row.source === "CLINICALTRIALS_GOV" ? "CLINICALTRIALS_GOV" : "PUBMED",
      title: row.title
    });

    tally[result.verdict] += 1;

    const classification = (row.metadata as { discoveryClassification?: { bucket?: unknown } } | null)
      ?.discoveryClassification;
    const bucket =
      typeof classification?.bucket === "string" ? classification.bucket : "(unclassified)";
    const bucketTally = byBucket.get(bucket) ?? { reject: 0, total: 0 };

    bucketTally.total += 1;

    if (result.verdict === "reject") {
      bucketTally.reject += 1;
    }

    byBucket.set(bucket, bucketTally);

    if (result.verdict === "reject") {
      const headline = result.reasons[result.reasons.length - 1] ?? "(none)";
      reasonTally.set(headline, (reasonTally.get(headline) ?? 0) + 1);

      if (rejectSamples.length < 25) {
        rejectSamples.push(`  [${intervention.slug}] ${(row.title ?? "").slice(0, 92)}`);
      }
    }
  }

  const scanned = tally.accept + tally.reject + tally.undecided;
  const pct = (n: number) => `${((n / Math.max(scanned, 1)) * 100).toFixed(1)}%`;

  console.log(`  unlinked to an intervention (gate skipped): ${noIntervention}`);
  console.log(`  no stored abstract:                         ${noAbstract}`);
  console.log("");
  console.log(`Gate verdicts over ${scanned} pending candidates:`);
  console.log(`  reject (the veto fires)  ${String(tally.reject).padStart(7)} (${pct(tally.reject)})`);
  console.log(`  undecided (veto silent)  ${String(tally.undecided).padStart(7)} (${pct(tally.undecided)})`);
  console.log(`  accept (veto silent)     ${String(tally.accept).padStart(7)} (${pct(tally.accept)})`);
  console.log("");
  console.log("By discovery bucket (likely-useful is the bulk-accept lane):");

  for (const [bucket, counts] of [...byBucket.entries()].sort((a, b) => b[1].total - a[1].total)) {
    console.log(
      `  ${bucket.padEnd(18)} ${String(counts.reject).padStart(6)}/${String(counts.total).padEnd(7)} vetoed (${((counts.reject / Math.max(counts.total, 1)) * 100).toFixed(1)}%)`
    );
  }

  console.log("");
  console.log("Veto reasons:");

  for (const [reason, count] of [...reasonTally.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(7)}  ${reason}`);
  }

  console.log("");
  console.log("Sample of what the veto would remove:");
  console.log(rejectSamples.join("\n"));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
