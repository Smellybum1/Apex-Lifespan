/**
 * Backfill `Claim.confidenceLevel` from the evidence actually extracted.
 *
 * It is set once at claim creation as VERY_LOW and never written again, so 687
 * of 704 claims sit at the floor while the public page reads it in five places
 * to decide whether to show a score and how to present the supplement.
 *
 * Dry run by default — prints what it would change and writes nothing.
 * Apply with:  npx tsx scripts/_tmp_backfill_claim_confidence.ts --apply
 *
 * Read the "would RAISE" section before applying. Raising a claim's confidence
 * is the only direction that puts something new in front of a reader.
 */
import { ConfidenceLevel as DbConfidenceLevel, PrismaClient } from "@prisma/client";

import { confidenceChange, deriveClaimConfidence } from "@/lib/claim-confidence";
import { getEvidenceDashboardData } from "@/lib/data/dashboard";
import { buildClaimSourcePacket } from "@/lib/source-packet";
import type { ConfidenceLevel } from "@/lib/types";

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");

const CONFIDENCE_TO_DB: Record<ConfidenceLevel, DbConfidenceLevel> = {
  High: DbConfidenceLevel.HIGH,
  Low: DbConfidenceLevel.LOW,
  Moderate: DbConfidenceLevel.MODERATE,
  "Very low": DbConfidenceLevel.VERY_LOW
};

async function main() {
  console.log(APPLY ? "MODE: APPLY (writes enabled)" : "MODE: DRY RUN (no writes)");
  console.log("");

  const data = await getEvidenceDashboardData();
  const referencesById = new Map(data.references.map((reference) => [reference.id, reference]));
  const interventionNames = new Map(
    data.interventions.map((intervention) => [intervention.id, intervention.name])
  );

  const raised: string[] = [];
  const lowered: string[] = [];
  const blocked = new Map<string, number>();
  const derivedTally = new Map<ConfidenceLevel, number>();
  const changes: Array<{ claimId: string; next: ConfidenceLevel }> = [];

  for (const claim of data.claims) {
    const packet = buildClaimSourcePacket({
      claim,
      referencesById,
      studies: data.studies
    });
    const derived = deriveClaimConfidence({ claim, packet });
    const direction = confidenceChange(claim.confidenceLevel, derived.confidenceLevel);

    derivedTally.set(
      derived.confidenceLevel,
      (derivedTally.get(derived.confidenceLevel) ?? 0) + 1
    );

    if (derived.blockedReason) {
      const key = derived.blockedReason.split(".")[0];
      blocked.set(key, (blocked.get(key) ?? 0) + 1);
    }

    if (direction === "unchanged") {
      continue;
    }

    changes.push({ claimId: claim.id, next: derived.confidenceLevel });

    const intervention = interventionNames.get(claim.interventionId) ?? claim.interventionId;
    const line = `  ${`${claim.confidenceLevel} -> ${derived.confidenceLevel}`.padEnd(24)} ${intervention} / ${claim.outcome}\n      ${derived.reason}`;

    if (direction === "raised") {
      raised.push(line);
    } else {
      lowered.push(line);
    }
  }

  console.log(`Claims: ${data.claims.length}`);
  console.log("");
  console.log("Derived confidence distribution:");

  for (const level of ["High", "Moderate", "Low", "Very low"] as ConfidenceLevel[]) {
    console.log(`  ${level.padEnd(10)} ${String(derivedTally.get(level) ?? 0).padStart(5)}`);
  }

  console.log("");
  console.log("Held at the floor because the claim itself is not scorable:");

  for (const [reason, count] of [...blocked.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(5)}  ${reason}.`);
  }

  console.log("");
  console.log(`Would RAISE ${raised.length} claim(s) — this is what reaches readers:`);
  console.log(raised.slice(0, 40).join("\n"));

  if (raised.length > 40) {
    console.log(`  ... and ${raised.length - 40} more`);
  }

  console.log("");
  console.log(`Would LOWER ${lowered.length} claim(s):`);
  console.log(lowered.slice(0, 20).join("\n"));

  if (lowered.length > 20) {
    console.log(`  ... and ${lowered.length - 20} more`);
  }

  console.log("");
  console.log(`Total changes: ${changes.length}`);

  if (!APPLY) {
    console.log("");
    console.log("Dry run only. Re-run with --apply to write these.");
    return;
  }

  let written = 0;

  for (const change of changes) {
    await prisma.claim.update({
      data: { confidenceLevel: CONFIDENCE_TO_DB[change.next] },
      where: { id: change.claimId }
    });
    written += 1;
  }

  console.log(`Applied ${written} confidence update(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
