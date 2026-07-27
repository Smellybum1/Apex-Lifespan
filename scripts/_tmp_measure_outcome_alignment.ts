/**
 * Read-only: how many claims are supported by studies that never measured the
 * outcome they are filed under? Deleted once the check is wired in.
 */
import { PrismaClient } from "@prisma/client";

import { assessClaimOutcomeAlignment } from "@/lib/claim-outcome-alignment";
import { getEvidenceDashboardData } from "@/lib/data/dashboard";
import { classifyClaim } from "@/lib/evidence-brief";
import { buildClaimSourcePacket } from "@/lib/source-packet";

const prisma = new PrismaClient();

async function main() {
  const data = await getEvidenceDashboardData();
  const referencesById = new Map(data.references.map((reference) => [reference.id, reference]));
  const interventionNames = new Map(
    data.interventions.map((intervention) => [intervention.id, intervention.name])
  );

  const tally = { aligned: 0, unaligned: 0, unknown: 0 };
  const unalignedConclusions: string[] = [];
  const unalignedAboveFloor: string[] = [];

  for (const claim of data.claims) {
    const packet = buildClaimSourcePacket({ claim, referencesById, studies: data.studies });
    const result = assessClaimOutcomeAlignment({ claim, packet });

    tally[result.verdict] += 1;

    if (result.verdict !== "unaligned") {
      continue;
    }

    const label = `  ${(interventionNames.get(claim.interventionId) ?? "?").padEnd(22)} ${claim.outcome.padEnd(26)} ${result.reason}`;

    if (classifyClaim(claim) === "conclusion") {
      unalignedConclusions.push(label);
    }

    if (claim.confidenceLevel !== "Very low") {
      unalignedAboveFloor.push(
        `  ${claim.confidenceLevel.padEnd(9)} ${(interventionNames.get(claim.interventionId) ?? "?").padEnd(22)} ${claim.outcome.padEnd(26)} ${result.reason}`
      );
    }
  }

  console.log(`Claims: ${data.claims.length}`);
  console.log(`  aligned    ${String(tally.aligned).padStart(4)}  at least one study measured the claim's outcome`);
  console.log(`  unaligned  ${String(tally.unaligned).padStart(4)}  studies record outcomes, none matching`);
  console.log(`  unknown    ${String(tally.unknown).padStart(4)}  nothing extracted, or nothing recording what it measured`);

  console.log("");
  console.log(`Unaligned CONCLUSIONS (reader-facing): ${unalignedConclusions.length}`);
  console.log(unalignedConclusions.slice(0, 25).join("\n"));

  console.log("");
  console.log(`Unaligned claims currently ABOVE the confidence floor: ${unalignedAboveFloor.length}`);
  console.log(unalignedAboveFloor.join("\n"));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
