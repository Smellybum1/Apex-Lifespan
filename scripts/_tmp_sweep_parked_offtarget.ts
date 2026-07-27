/**
 * One-off sweep: reject the parked-research candidates the relevance gate can
 * show are off-target.
 *
 * The nightly review lane deliberately skips candidates parked as research —
 * 10,577 of the ~10,871 pending rows — so the veto wired into that lane only
 * ever reaches a few dozen rows a night. This clears the parked backlog once,
 * on the user's explicit instruction (2026-07-27).
 *
 * It only acts on `reject`. `undecided` and `accept` are left parked exactly as
 * they were: the gate cannot show those are wrong, and parking was intentional.
 *
 * Every row goes through `recordSourceCandidateDecision(..., "automation")`, the
 * same audited path the in-pipeline veto uses, so rows land as `AI_REVIEWED`
 * (never `HUMAN_REVIEWED`) and carry a note that identifies them for bulk
 * reversal:
 *
 *   AI reviewed: rejected by the relevance gate (parked-research sweep). <reason>
 *
 * Dry run by default. Back up + apply:
 *   npx tsx scripts/_tmp_sweep_parked_offtarget.ts --apply
 */
import { writeFileSync } from "node:fs";

import { PrismaClient, SourceCandidateDecision } from "@prisma/client";

import { recordSourceCandidateDecision } from "@/lib/data/source-candidates";
import { evaluateRelevance } from "@/lib/relevance-gate";

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");
const BACKUP_PATH = "scripts/_tmp_parked_sweep_backup.json";
const NOTE_PREFIX = "AI reviewed: rejected by the relevance gate (parked-research sweep).";

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
  console.log(APPLY ? "MODE: APPLY (writes enabled)" : "MODE: DRY RUN (no writes)");
  console.log("");

  const interventions = await prisma.intervention.findMany({
    select: { id: true, slug: true, name: true, synonyms: true }
  });
  const byId = new Map(interventions.map((intervention) => [intervention.id, intervention]));

  const pending = await prisma.sourceCandidate.findMany({
    where: { decision: SourceCandidateDecision.PENDING_REVIEW },
    select: {
      dedupeKey: true,
      title: true,
      source: true,
      interventionId: true,
      metadata: true,
      reviewStatus: true,
      triageScore: true
    }
  });

  const parked = pending.filter((row) => {
    const metadata = row.metadata as Record<string, unknown> | null;
    return Boolean(metadata?.localCandidateReviewDisposition);
  });

  console.log(`Pending candidates:            ${pending.length}`);
  console.log(`  parked as research:          ${parked.length}`);
  console.log(`  reachable by the nightly run: ${pending.length - parked.length} (left alone)`);

  const doomed: Array<{
    dedupeKey: string;
    interventionSlug: string;
    reason: string;
    title: string;
    triageScore: number;
  }> = [];
  const verdicts = { accept: 0, reject: 0, undecided: 0, unresolvable: 0 };
  const reasonTally = new Map<string, number>();

  for (const row of parked) {
    const intervention = row.interventionId ? byId.get(row.interventionId) : undefined;

    if (!intervention) {
      verdicts.unresolvable += 1;
      continue;
    }

    const abstract = [
      metadataText(row.metadata, "abstractText"),
      metadataText(row.metadata, "briefSummary")
    ]
      .filter(Boolean)
      .join(" ");

    const result = evaluateRelevance({
      abstract,
      intervention,
      publicationTypes: metadataStrings(row.metadata, "publicationTypes"),
      source: row.source === "CLINICALTRIALS_GOV" ? "CLINICALTRIALS_GOV" : "PUBMED",
      title: row.title
    });

    verdicts[result.verdict] += 1;

    if (result.verdict !== "reject") {
      continue;
    }

    const reason = result.reasons[result.reasons.length - 1] ?? "Failed the relevance gate.";

    reasonTally.set(reason.split(":")[0], (reasonTally.get(reason.split(":")[0]) ?? 0) + 1);
    doomed.push({
      dedupeKey: row.dedupeKey,
      interventionSlug: intervention.slug,
      reason,
      title: row.title ?? "",
      triageScore: row.triageScore
    });
  }

  console.log("");
  console.log("Gate verdicts over the parked pool:");
  console.log(`  reject     ${String(verdicts.reject).padStart(6)}  <-- swept`);
  console.log(`  undecided  ${String(verdicts.undecided).padStart(6)}  (left parked)`);
  console.log(`  accept     ${String(verdicts.accept).padStart(6)}  (left parked — the gate never promotes)`);
  console.log(`  no intervention linked ${String(verdicts.unresolvable).padStart(4)}  (skipped)`);

  console.log("");
  console.log("Why the swept rows fail:");

  for (const [reason, count] of [...reasonTally.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(6)}  ${reason}`);
  }

  // Design rejections deserve a full read, not a sample. A case report is weak
  // efficacy evidence but it is exactly how supplement harms get published, and
  // the catalog tracks a Safety/adverse effects outcome for that reason.
  const designRejects = doomed.filter((row) => row.reason.startsWith("Design"));

  console.log("");
  console.log(`All ${designRejects.length} design rejections, in full:`);

  for (const row of designRejects) {
    console.log(`  [${row.interventionSlug}] ${row.title}`);
  }

  console.log("");
  console.log("Sample of the rest, with reasons:");

  for (const row of doomed.filter((entry) => !entry.reason.startsWith("Design")).slice(0, 12)) {
    console.log(`  [${row.interventionSlug}] ${row.title.slice(0, 88)}`);
    console.log(`      ${row.reason.slice(0, 120)}`);
  }

  if (!APPLY) {
    console.log("");
    console.log(`Dry run only. ${doomed.length} row(s) would be rejected.`);
    console.log("Re-run with --apply to write. A backup is saved before the first update.");
    return;
  }

  writeFileSync(BACKUP_PATH, JSON.stringify(doomed, null, 2), "utf8");
  console.log("");
  console.log(`Backed up ${doomed.length} rows to ${BACKUP_PATH}`);

  let written = 0;
  let failed = 0;

  for (const row of doomed) {
    try {
      await recordSourceCandidateDecision({
        decision: "Rejected",
        dedupeKey: row.dedupeKey,
        reviewNote: `${NOTE_PREFIX} ${row.reason}`,
        reviewedBy: "automation"
      });
      written += 1;

      if (written % 250 === 0) {
        console.log(`  ${written}/${doomed.length}...`);
      }
    } catch (error) {
      failed += 1;

      if (failed <= 5) {
        console.error(
          `  failed ${row.dedupeKey}: ${error instanceof Error ? error.message : "unknown"}`
        );
      }
    }
  }

  console.log("");
  console.log(`Rejected ${written} parked candidate(s); ${failed} failure(s).`);
  console.log("");
  console.log("Reverse in bulk by matching the review note:");
  console.log(`  reviewNote startsWith ${JSON.stringify(NOTE_PREFIX)}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
