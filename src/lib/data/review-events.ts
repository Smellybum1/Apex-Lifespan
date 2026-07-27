import type { Prisma, ReviewEventType } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { mapReviewStatusToDb } from "@/lib/data/evidence-model-mappers";
import type { ReviewStatus } from "@/lib/types";

export interface RecordReviewEventInput {
  actorEmail?: string;
  actorUserId?: string;
  claimId?: string;
  entityId?: string;
  entityType: string;
  eventType: ReviewEventType;
  metadata?: Record<string, unknown>;
  note?: string;
  referenceId?: string;
  reviewStatus?: ReviewStatus;
  sourcePacketId?: string;
  studyId?: string;
}

export async function recordReviewEvent(input: RecordReviewEventInput) {
  return prisma.reviewEvent.create({
    data: {
      actorEmail: input.actorEmail,
      actorUserId: input.actorUserId,
      claimId: input.claimId,
      entityId: input.entityId,
      entityType: input.entityType,
      eventType: input.eventType,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
      note: input.note,
      referenceId: input.referenceId,
      reviewStatus: input.reviewStatus ? mapReviewStatusToDb(input.reviewStatus) : undefined,
      sourcePacketId: input.sourcePacketId,
      studyId: input.studyId
    }
  });
}

export async function listReviewEventsForClaim(claimId: string, limit = 20) {
  return prisma.reviewEvent.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: limit,
    where: { claimId }
  });
}
