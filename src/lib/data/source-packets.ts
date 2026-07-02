import {
  StudyType as DbStudyType,
  type SourcePacket,
  type SourcePacketReference
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
  claimStudyRelationForStudyType,
  mapReviewStatusFromDb,
  sourcePacketCompletenessFromDb,
  sourcePacketStatusFromCompleteness
} from "@/lib/data/evidence-model-mappers";
import { buildClaimSourcePacket } from "@/lib/source-packet";
import type { NormalizedSourcePacketRow, Reference, Study } from "@/lib/types";

const studyTypeMap: Record<DbStudyType, Study["studyType"]> = {
  ANIMAL_STUDY: "Animal study",
  CASE_REPORT: "Case report",
  CLINICAL_TRIAL_RECORD: "Clinical trial record",
  IN_VITRO_MECHANISTIC: "In vitro/mechanistic",
  META_ANALYSIS: "Meta-analysis",
  OBSERVATIONAL_COHORT: "Observational cohort",
  RANDOMIZED_CONTROLLED_TRIAL: "Randomized controlled trial",
  REGULATORY_SAFETY_WARNING: "Regulatory safety warning",
  SYSTEMATIC_REVIEW: "Systematic review"
};

type DbSourcePacketWithReferences = SourcePacket & {
  references: SourcePacketReference[];
};

export function mapNormalizedSourcePacketRow(packet: DbSourcePacketWithReferences): NormalizedSourcePacketRow {
  return {
    claimId: packet.claimId,
    current: packet.current,
    referenceIds: packet.references.map((reference) => reference.referenceId).sort(),
    reviewStatus: mapReviewStatusFromDb(packet.reviewStatus),
    sourcePacketId: packet.id,
    status: sourcePacketCompletenessFromDb(packet.status)
  };
}

export async function listCurrentSourcePackets(
  claimIds?: string[]
): Promise<NormalizedSourcePacketRow[]> {
  const packets = await prisma.sourcePacket.findMany({
    include: { references: true },
    orderBy: [{ updatedAt: "desc" }],
    where: {
      current: true,
      ...(claimIds ? { claimId: { in: claimIds } } : {})
    }
  });

  return packets.map(mapNormalizedSourcePacketRow);
}

export async function syncClaimStudyLinksForClaim(claimId: string) {
  const claim = await prisma.claim.findUnique({
    select: {
      references: {
        select: {
          reference: {
            select: {
              studies: {
                select: {
                  id: true,
                  sourceType: true
                }
              }
            }
          }
        }
      }
    },
    where: { id: claimId }
  });

  if (!claim) {
    throw new Error(`Claim not found for study-link sync: ${claimId}.`);
  }

  const studies = claim.references.flatMap((link) => link.reference.studies);
  let created = 0;
  let updated = 0;

  for (const study of studies) {
    const relation = claimStudyRelationForStudyType(study.sourceType);
    const existing = await prisma.claimStudy.findUnique({
      where: {
        claimId_studyId: {
          claimId,
          studyId: study.id
        }
      }
    });

    if (existing) {
      if (existing.relation === "UNREVIEWED_LEAD" && relation !== "UNREVIEWED_LEAD") {
        await prisma.claimStudy.update({
          data: { relation },
          where: {
            claimId_studyId: {
              claimId,
              studyId: study.id
            }
          }
        });
        updated += 1;
      }
      continue;
    }

    await prisma.claimStudy.create({
      data: {
        claimId,
        relation,
        studyId: study.id
      }
    });
    created += 1;
  }

  return { created, studyCount: studies.length, updated };
}

export async function syncSourcePacketForClaim(claimId: string) {
  const claim = await prisma.claim.findUnique({
    include: {
      references: {
        include: {
          reference: true
        }
      }
    },
    where: { id: claimId }
  });

  if (!claim) {
    throw new Error(`Claim not found for source-packet sync: ${claimId}.`);
  }

  const referencesById = new Map<string, Reference>(
    claim.references.map((link) => [
      link.referenceId,
      {
        id: link.reference.id,
        identifier: link.reference.identifier ?? undefined,
        source: link.reference.source,
        title: link.reference.title,
        url: link.reference.url,
        year: link.reference.year ?? undefined
      }
    ])
  );

  const studies = await prisma.study.findMany({
    orderBy: [{ year: "desc" }, { title: "asc" }],
    where: {
      referenceId: {
        in: claim.references.map((link) => link.referenceId)
      }
    }
  });

  const mappedStudies: Study[] = studies.map((study) => ({
    abstract: study.abstract ?? undefined,
    adverseEvents: study.adverseEvents,
    dose: study.dose ?? undefined,
    duration: study.duration ?? undefined,
    fundingConflicts: study.fundingConflicts,
    id: study.id,
    intervention: study.interventionName,
    mainResults: study.mainResults ?? undefined,
    outcomes: study.outcomes,
    population: study.population,
    referenceId: study.referenceId ?? "",
    riskOfBias: study.riskOfBias,
    sampleSize: study.sampleSize,
    source: study.source,
    studyType: studyTypeMap[study.sourceType],
    title: study.title,
    year: study.year ?? 0
  }));

  const packet = buildClaimSourcePacket({
    claim: {
      keyReferenceIds: claim.references.map((link) => link.referenceId)
    },
    referencesById,
    studies: mappedStudies
  });

  const status = sourcePacketStatusFromCompleteness(packet.completeness.status);
  const existing = await prisma.sourcePacket.findFirst({
    include: { references: true },
    where: {
      claimId,
      current: true
    }
  });

  const sourcePacket = existing
    ? await prisma.sourcePacket.update({
        data: {
          interventionId: claim.interventionId,
          reviewStatus: claim.reviewStatus,
          status
        },
        include: { references: true },
        where: { id: existing.id }
      })
    : await prisma.sourcePacket.create({
        data: {
          claimId,
          current: true,
          interventionId: claim.interventionId,
          reviewStatus: claim.reviewStatus,
          status
        },
        include: { references: true }
      });

  const referenceIds = new Set(packet.referenceIds);
  const existingReferenceIds = new Set(sourcePacket.references.map((row) => row.referenceId));
  const pendingReferenceIds = new Set(packet.pendingReferences.map((reference) => reference.id));
  const missingReferenceIds = new Set(packet.missingReferenceIds);

  for (const referenceId of referenceIds) {
    const extracted =
      !pendingReferenceIds.has(referenceId) && !missingReferenceIds.has(referenceId);
    await prisma.sourcePacketReference.upsert({
      create: {
        citationStatus: extracted ? "linked" : "pending",
        extractionStatus: extracted ? "complete" : "pending",
        referenceId,
        sourcePacketId: sourcePacket.id
      },
      update: {
        citationStatus: extracted ? "linked" : "pending",
        extractionStatus: extracted ? "complete" : "pending"
      },
      where: {
        sourcePacketId_referenceId: {
          referenceId,
          sourcePacketId: sourcePacket.id
        }
      }
    });
  }

  for (const referenceId of existingReferenceIds) {
    if (!referenceIds.has(referenceId)) {
      await prisma.sourcePacketReference.delete({
        where: {
          sourcePacketId_referenceId: {
            referenceId,
            sourcePacketId: sourcePacket.id
          }
        }
      });
    }
  }

  const studySync = await syncClaimStudyLinksForClaim(claimId);

  return {
    created: !existing,
    sourcePacketId: sourcePacket.id,
    status,
    studySync
  };
}
