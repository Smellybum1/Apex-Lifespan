/**
 * One-off correction: rows stamped `HUMAN_REVIEWED` by automation.
 *
 * Until `ReviewStatus.AI_REVIEWED` existed, `recordSourceCandidateDecision`
 * hardcoded `HUMAN_REVIEWED` on every decision it wrote, including bulk
 * accepts, conservative auto-triage, and identity-resolver rejections. Those
 * rows claim a human confirmed them. They did not.
 *
 * The `reviewNote` is the evidence: automated paths write fixed, recognisable
 * sentences. This script matches those notes and only those notes.
 *
 * Dry run by default — prints what it would change and writes nothing.
 * Apply with:  npx tsx scripts/_tmp_correct_mislabelled_human_reviewed.ts --apply
 *
 * Idempotent: re-running after an apply finds nothing left to change, because
 * corrected rows are no longer HUMAN_REVIEWED.
 */
import { PrismaClient, ReviewStatus } from "@prisma/client";

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");

/**
 * Note fragments written only by automated decision paths. Matched
 * case-insensitively as substrings against `reviewNote`.
 *
 * Kept deliberately narrow: a note that merely *sounds* automated is not
 * enough. Anything not listed here stays `HUMAN_REVIEWED` — under-correcting
 * leaves a row honest-but-stale, over-correcting silently erases a real human
 * review, so the bias is toward leaving rows alone.
 */
const AUTOMATED_NOTE_FRAGMENTS = [
  "Bulk accepted",
  "Bulk rejected",
  "Auto-accepted",
  "Auto-rejected",
  "one-click local UPDATE pipeline",
  "conservative local review triage",
  "local identity resolver",
  "local catalog triage",
  "local catalog phase-2 triage",
  "local catalog phase-5 triage",
  // The `REVIEW_NOTE` constant shared by the three scripts/local-db-catalog-*
  // triage passes, all of which now declare `reviewedBy: "automation"`.
  "(hobby-project mode)",
  // Notes that declare their own authorship. These were written by an agent
  // and then stamped HUMAN_REVIEWED by the hardcoded write.
  "AI reviewed:",
  // "Codex confirmed all listed AI recommendations in the Operator Review
  // Queue." Adjudicated 2026-07-27: the user does not recall confirming these,
  // so there is no evidence a person did. An unremembered confirmation is not a
  // confirmation — `HUMAN_REVIEWED` would be a claim we cannot support, and the
  // catalog's honesty depends on that status meaning exactly what it says.
  // Downgrading costs nothing; these 2 rows can be re-reviewed for real.
  "Codex confirmed"
];

/**
 * Notes that look automated but are written when a person clicked a single
 * candidate in the dashboard. These stay `HUMAN_REVIEWED`. Checked before the
 * fragments above, so an exclusion always wins.
 */
const HUMAN_NOTE_FRAGMENTS = [
  "Accepted from local candidate review dashboard.",
  "Rejected from local candidate review dashboard",
  "Human reviewed",
  "Human-approved"
];

/**
 * Genuinely unclear authorship: reported as `[ASK]` and never changed
 * automatically. Empty after the "Codex confirmed" rows were adjudicated (see
 * `AUTOMATED_NOTE_FRAGMENTS`). Kept so a note pattern nobody can vouch for has
 * somewhere to go rather than defaulting into a status it has not earned.
 */
const AMBIGUOUS_NOTE_FRAGMENTS: string[] = [];

type Verdict = "automated" | "ambiguous" | "human-or-unknown";

function classify(note: string | null): Verdict {
  if (!note) {
    // No note at all: cannot prove it was automated, so leave it.
    return "human-or-unknown";
  }

  const lowered = note.toLowerCase();
  const matches = (fragments: string[]) =>
    fragments.some((fragment) => lowered.includes(fragment.toLowerCase()));

  if (matches(AMBIGUOUS_NOTE_FRAGMENTS)) {
    return "ambiguous";
  }

  if (matches(HUMAN_NOTE_FRAGMENTS)) {
    return "human-or-unknown";
  }

  return matches(AUTOMATED_NOTE_FRAGMENTS) ? "automated" : "human-or-unknown";
}

async function main() {
  console.log(APPLY ? "MODE: APPLY (writes enabled)" : "MODE: DRY RUN (no writes)");
  console.log("");

  // SourceCandidate is the only model the automated decision path wrote to,
  // and the only one carrying a reviewNote we can adjudicate. The other six
  // models with a reviewStatus are reported for visibility but never touched.
  const totalHumanReviewed = await prisma.sourceCandidate.count({
    where: { reviewStatus: ReviewStatus.HUMAN_REVIEWED }
  });

  console.log(`SourceCandidate rows stamped HUMAN_REVIEWED: ${totalHumanReviewed}`);

  const rows = await prisma.sourceCandidate.findMany({
    where: { reviewStatus: ReviewStatus.HUMAN_REVIEWED },
    select: { id: true, reviewNote: true }
  });

  const byNote = new Map<string, { count: number; verdict: Verdict }>();
  const automatedIds: string[] = [];
  let ambiguousCount = 0;

  for (const row of rows) {
    const verdict = classify(row.reviewNote);
    const key = row.reviewNote ?? "(no reviewNote)";
    const entry = byNote.get(key) ?? { count: 0, verdict };

    entry.count += 1;
    byNote.set(key, entry);

    if (verdict === "automated") {
      automatedIds.push(row.id);
    }

    if (verdict === "ambiguous") {
      ambiguousCount += 1;
    }
  }

  console.log("");
  console.log("Distinct reviewNote values among HUMAN_REVIEWED rows:");
  console.log("");

  for (const [note, { count, verdict }] of [...byNote.entries()].sort(
    (a, b) => b[1].count - a[1].count
  )) {
    const marker =
      verdict === "automated" ? "[AI]  " : verdict === "ambiguous" ? "[ASK] " : "[keep]";
    const shown = note.length > 110 ? `${note.slice(0, 110)}...` : note;
    console.log(`  ${marker} ${String(count).padStart(6)}  ${shown}`);
  }

  console.log("");
  console.log(`Would change to AI_REVIEWED: ${automatedIds.length}`);
  console.log(`Would leave HUMAN_REVIEWED: ${totalHumanReviewed - automatedIds.length}`);
  console.log(`  of which need a human call [ASK]: ${ambiguousCount}`);

  console.log("");
  console.log("Other models carrying reviewStatus (reported only, never modified):");

  for (const [label, count] of [
    ["Claim", await prisma.claim.count({ where: { reviewStatus: ReviewStatus.HUMAN_REVIEWED } })],
    [
      "Product",
      await prisma.product.count({ where: { reviewStatus: ReviewStatus.HUMAN_REVIEWED } })
    ],
    [
      "SourceDocument",
      await prisma.sourceDocument.count({ where: { reviewStatus: ReviewStatus.HUMAN_REVIEWED } })
    ],
    [
      "SourcePacket",
      await prisma.sourcePacket.count({ where: { reviewStatus: ReviewStatus.HUMAN_REVIEWED } })
    ],
    [
      "ClaimScoreSnapshot",
      await prisma.claimScoreSnapshot.count({
        where: { reviewStatus: ReviewStatus.HUMAN_REVIEWED }
      })
    ],
    [
      "ReviewEvent",
      await prisma.reviewEvent.count({ where: { reviewStatus: ReviewStatus.HUMAN_REVIEWED } })
    ]
  ] as Array<[string, number]>) {
    console.log(`  ${label.padEnd(20)} ${count}`);
  }

  if (!APPLY) {
    console.log("");
    console.log("Dry run complete. Nothing written.");
    console.log("Re-run with --apply to write the SourceCandidate changes above.");
    return;
  }

  if (automatedIds.length === 0) {
    console.log("");
    console.log("Nothing to change.");
    return;
  }

  console.log("");
  console.log(`Applying ${automatedIds.length} updates...`);

  // Chunked so a large id list cannot blow the query parameter limit.
  const CHUNK = 1000;
  let updated = 0;

  for (let index = 0; index < automatedIds.length; index += CHUNK) {
    const chunk = automatedIds.slice(index, index + CHUNK);
    const result = await prisma.sourceCandidate.updateMany({
      where: { id: { in: chunk }, reviewStatus: ReviewStatus.HUMAN_REVIEWED },
      data: { reviewStatus: ReviewStatus.AI_REVIEWED }
    });

    updated += result.count;
    console.log(`  ${updated}/${automatedIds.length}`);
  }

  console.log("");
  console.log(`Done. ${updated} rows corrected to AI_REVIEWED.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
