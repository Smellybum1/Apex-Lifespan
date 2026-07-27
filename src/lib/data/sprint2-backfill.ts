import { ScoreChangeKind as DbScoreChangeKind } from "@prisma/client";

import { publicChangelogEntries } from "@/lib/changelog";
import { prisma } from "@/lib/db/prisma";
import { publicChangelogKindToDb } from "@/lib/data/evidence-model-mappers";
import {
  captureClaimScoreSnapshot,
  getLatestClaimScoreSnapshot
} from "@/lib/data/score-history";
import { syncClaimStudyLinksForClaim, syncSourcePacketForClaim } from "@/lib/data/source-packets";

export interface Sprint2BackfillSummary {
  applied: boolean;
  changelog: {
    created: number;
    skipped: number;
  };
  claimStudyLinks: {
    created: number;
    updated: number;
  };
  claimsProcessed: number;
  scoreSnapshots: {
    created: number;
    skipped: number;
  };
  sourcePackets: {
    created: number;
    updated: number;
  };
}

export async function runSprint2Backfill({
  apply = false,
  importChangelog = true
}: {
  apply?: boolean;
  importChangelog?: boolean;
} = {}): Promise<Sprint2BackfillSummary> {
  const claims = await prisma.claim.findMany({
    orderBy: { id: "asc" },
    select: { id: true }
  });

  const summary: Sprint2BackfillSummary = {
    applied: apply,
    changelog: { created: 0, skipped: 0 },
    claimStudyLinks: { created: 0, updated: 0 },
    claimsProcessed: claims.length,
    scoreSnapshots: { created: 0, skipped: 0 },
    sourcePackets: { created: 0, updated: 0 }
  };

  if (!apply) {
    for (const claim of claims) {
      const existingPacket = await prisma.sourcePacket.findFirst({
        where: { claimId: claim.id, current: true }
      });
      if (existingPacket) {
        summary.sourcePackets.updated += 1;
      } else {
        summary.sourcePackets.created += 1;
      }

      const latestSnapshot = await getLatestClaimScoreSnapshot(claim.id);
      if (latestSnapshot) {
        summary.scoreSnapshots.skipped += 1;
      } else {
        summary.scoreSnapshots.created += 1;
      }
    }

    if (importChangelog) {
      for (const entry of publicChangelogEntries) {
        const existing = await prisma.publicChangelogEntry.findUnique({
          where: { slug: entry.id }
        });
        if (existing) {
          summary.changelog.skipped += 1;
        } else {
          summary.changelog.created += 1;
        }
      }
    }

    return summary;
  }

  for (const claim of claims) {
    const packet = await syncSourcePacketForClaim(claim.id);
    if (packet.created) {
      summary.sourcePackets.created += 1;
    } else {
      summary.sourcePackets.updated += 1;
    }

    summary.claimStudyLinks.created += packet.studySync.created;
    summary.claimStudyLinks.updated += packet.studySync.updated;

    const dbClaim = await prisma.claim.findUnique({
      select: {
        effectSizeScore: true,
        evidenceDirectnessScore: true,
        evidenceRigorScore: true,
        finalLabel: true,
        hypePenalty: true,
        id: true,
        measurabilityScore: true,
        productQualityScore: true,
        regulatoryRiskScore: true,
        reviewStatus: true,
        safetyScore: true
      },
      where: { id: claim.id }
    });

    if (!dbClaim) {
      continue;
    }

    const snapshot = await captureClaimScoreSnapshot(dbClaim, {
      claimId: claim.id,
      rationale: "Sprint 2 backfill baseline snapshot.",
      reason: DbScoreChangeKind.MANUAL_REVIEW
    });

    if (snapshot.created) {
      summary.scoreSnapshots.created += 1;
    } else {
      summary.scoreSnapshots.skipped += 1;
    }
  }

  if (importChangelog) {
    for (const entry of publicChangelogEntries) {
      const existing = await prisma.publicChangelogEntry.findUnique({
        where: { slug: entry.id }
      });

      if (existing) {
        summary.changelog.skipped += 1;
        continue;
      }

      await prisma.publicChangelogEntry.create({
        data: {
          date: new Date(`${entry.date}T00:00:00.000Z`),
          details: entry.scoreChange
            ? { bullets: entry.details, scoreChange: entry.scoreChange }
            : entry.details,
          kind: publicChangelogKindToDb(entry.kind),
          publicImpact: entry.publicImpact,
          publishedAt: new Date(`${entry.date}T00:00:00.000Z`),
          slug: entry.id,
          title: entry.title
        }
      });
      summary.changelog.created += 1;
    }
  }

  return summary;
}

export async function syncNormalizedEvidenceForClaim(claimId: string) {
  const packet = await syncSourcePacketForClaim(claimId);
  const studySync = await syncClaimStudyLinksForClaim(claimId);

  return {
    ...packet,
    studySync
  };
}
