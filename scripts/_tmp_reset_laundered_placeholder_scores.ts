/**
 * Strip the scores the pipeline invented for claims that state nothing.
 *
 * Claims created by `local-claim-expansion.ts` start with deliberately low
 * starter subscores that composite to 3.1 — a value `score-readiness.ts` reads
 * as "default-looking, not really scored". Pipeline stage 9 then overwrote them
 * with `buildClaimScoreSuggestion`, which derives directness and rigor purely
 * from the study design of the linked papers and never checks whether the claim
 * says anything. A placeholder linked to 19 meta-analyses came out at composite
 * 7.5 and stopped being flagged.
 *
 * The generator is fixed (`blockedReason`, enforced in both
 * `local-score-finalization.ts` and `score-update-draft.ts`), so a reset sticks
 * — the nightly run will not re-launder these. This pass corrects the rows that
 * were already written.
 *
 * It restores the starter subscores and the "Draft lead" grade. It does NOT
 * delete anything: the placeholder claims hold 4,644 reference links, 4,075
 * extracted study links and 517 source packets, and 3,515 of their references
 * are reachable through no other claim.
 *
 * Dry run by default — prints what it would change and writes nothing.
 * Back up + apply:  npx tsx scripts/_tmp_reset_laundered_placeholder_scores.ts --apply
 * The backup is written before the first update, so a bad run is recoverable.
 */
import { writeFileSync } from "node:fs";

import { PrismaClient } from "@prisma/client";

import { getEvidenceDashboardData } from "@/lib/data/dashboard";
import { classifyClaim } from "@/lib/evidence-brief";
import { compositeScore } from "@/lib/scoring";

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");
const BACKUP_PATH = "scripts/_tmp_laundered_scores_backup.json";

/** Exactly the values `local-claim-expansion.ts` writes at creation. */
const STARTER_SCORES = {
  effectSizeScore: 1,
  evidenceDirectnessScore: 2,
  evidenceRigorScore: 2,
  hypePenalty: 2,
  measurabilityScore: 4,
  productQualityScore: 3,
  regulatoryRiskScore: 5,
  safetyScore: 5
} as const;

/** The grade a placeholder carries before stage 9 relabels it. */
const STARTER_EVIDENCE_GRADE = "Draft lead";
const LAUNDERED_EVIDENCE_GRADE = "Scored from linked source packet; pending human review.";

async function main() {
  console.log(APPLY ? "MODE: APPLY (writes enabled)" : "MODE: DRY RUN (no writes)");
  console.log("");

  const data = await getEvidenceDashboardData();
  const placeholderIds = data.claims
    .filter((claim) => classifyClaim(claim) === "pipeline")
    .map((claim) => claim.id);

  console.log(`Placeholder claims: ${placeholderIds.length}`);

  const rows = await prisma.claim.findMany({
    where: { id: { in: placeholderIds } },
    select: {
      id: true,
      interventionId: true,
      outcome: true,
      evidenceGrade: true,
      effectSizeScore: true,
      evidenceDirectnessScore: true,
      evidenceRigorScore: true,
      hypePenalty: true,
      measurabilityScore: true,
      productQualityScore: true,
      regulatoryRiskScore: true,
      safetyScore: true
    }
  });

  const drifted = rows.filter(
    (row) =>
      row.effectSizeScore !== STARTER_SCORES.effectSizeScore ||
      row.evidenceDirectnessScore !== STARTER_SCORES.evidenceDirectnessScore ||
      row.evidenceRigorScore !== STARTER_SCORES.evidenceRigorScore ||
      row.hypePenalty !== STARTER_SCORES.hypePenalty ||
      row.measurabilityScore !== STARTER_SCORES.measurabilityScore ||
      row.productQualityScore !== STARTER_SCORES.productQualityScore ||
      row.regulatoryRiskScore !== STARTER_SCORES.regulatoryRiskScore ||
      row.safetyScore !== STARTER_SCORES.safetyScore ||
      row.evidenceGrade === LAUNDERED_EVIDENCE_GRADE
  );

  const compositeOf = (row: (typeof rows)[number]) =>
    compositeScore({
      effectSize: row.effectSizeScore,
      evidenceDirectness: row.evidenceDirectnessScore,
      evidenceRigor: row.evidenceRigorScore,
      hypePenalty: row.hypePenalty,
      measurability: row.measurabilityScore,
      productQuality: row.productQualityScore,
      regulatoryRisk: row.regulatoryRiskScore,
      safety: row.safetyScore
    });

  const starterComposite = compositeScore({
    effectSize: STARTER_SCORES.effectSizeScore,
    evidenceDirectness: STARTER_SCORES.evidenceDirectnessScore,
    evidenceRigor: STARTER_SCORES.evidenceRigorScore,
    hypePenalty: STARTER_SCORES.hypePenalty,
    measurability: STARTER_SCORES.measurabilityScore,
    productQuality: STARTER_SCORES.productQualityScore,
    regulatoryRisk: STARTER_SCORES.regulatoryRiskScore,
    safety: STARTER_SCORES.safetyScore
  });

  console.log(`  already at starter values: ${rows.length - drifted.length}`);
  console.log(`  carrying invented scores:  ${drifted.length}`);
  console.log("");
  console.log(`Starter composite: ${starterComposite.toFixed(1)}`);

  if (drifted.length === 0) {
    console.log("Nothing to correct.");
    return;
  }

  const composites = drifted.map(compositeOf).sort((a, b) => b - a);
  const bands = new Map<string, number>();

  for (const value of composites) {
    const band = `${Math.floor(value)}.0-${Math.floor(value)}.9`;
    bands.set(band, (bands.get(band) ?? 0) + 1);
  }

  console.log("");
  console.log("Current composite distribution of the invented scores:");

  for (const [band, count] of [...bands.entries()].sort((a, b) => b[0].localeCompare(a[0]))) {
    console.log(`  ${band}  ${String(count).padStart(4)}`);
  }

  console.log("");
  console.log(`  highest: ${composites[0]?.toFixed(1)}`);
  console.log(`  median:  ${composites[Math.floor(composites.length / 2)]?.toFixed(1)}`);
  console.log(`  lowest:  ${composites[composites.length - 1]?.toFixed(1)}`);

  const interventionNames = new Map(
    data.interventions.map((intervention) => [intervention.id, intervention.name])
  );

  console.log("");
  console.log("Worst offenders — a placeholder scoring like a curated conclusion:");

  for (const row of [...drifted].sort((a, b) => compositeOf(b) - compositeOf(a)).slice(0, 12)) {
    console.log(
      `  ${compositeOf(row).toFixed(1)} -> ${starterComposite.toFixed(1)}   ${interventionNames.get(row.interventionId) ?? row.interventionId} / ${row.outcome}`
    );
  }

  if (!APPLY) {
    console.log("");
    console.log("Dry run only. Re-run with --apply to correct these.");
    console.log(`Applying writes a backup of the current values to ${BACKUP_PATH} first.`);
    return;
  }

  writeFileSync(BACKUP_PATH, JSON.stringify(drifted, null, 2), "utf8");
  console.log("");
  console.log(`Backed up ${drifted.length} rows to ${BACKUP_PATH}`);

  let updated = 0;

  for (const row of drifted) {
    await prisma.claim.update({
      data: {
        ...STARTER_SCORES,
        evidenceGrade:
          row.evidenceGrade === LAUNDERED_EVIDENCE_GRADE
            ? STARTER_EVIDENCE_GRADE
            : row.evidenceGrade
      },
      where: { id: row.id }
    });
    updated += 1;
  }

  console.log(`Reset ${updated} placeholder claim(s) to starter scores.`);
  console.log("");
  console.log(
    "Note: ClaimScoreSnapshot rows are left untouched as history. They still record the"
  );
  console.log(
    "invented scores; nothing reads them for the reader-facing surface, but a snapshot-built"
  );
  console.log("packet would. Correcting those is a separate pass if it turns out to matter.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
