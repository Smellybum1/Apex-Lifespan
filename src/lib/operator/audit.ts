import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type { OperatorPrincipal } from "@/lib/operator/authorization";

type OperatorAuditClient = Pick<typeof prisma, "operatorAuditEvent">;

export interface OperatorAuditInput {
  action: string;
  afterSummary?: Prisma.InputJsonValue;
  beforeSummary?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
  note?: string;
  targetId?: string;
  targetType: string;
}

export async function recordOperatorAuditEvent(
  principal: OperatorPrincipal,
  input: OperatorAuditInput,
  client: OperatorAuditClient = prisma
) {
  return client.operatorAuditEvent.create({
    data: {
      action: input.action,
      actorEmail: principal.email,
      actorRole: principal.role,
      actorUserId: principal.userId.trim() ? principal.userId : undefined,
      afterSummary: input.afterSummary,
      beforeSummary: input.beforeSummary,
      metadata: input.metadata,
      note: input.note,
      requestId: undefined,
      targetId: input.targetId,
      targetType: input.targetType
    }
  });
}
