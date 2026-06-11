import { prisma } from "@/lib/db/prisma";

export interface OperatorAuditTrailRow {
  action: string;
  actorEmail: string;
  actorRole: string;
  createdAt: string;
  id: string;
  notePreview?: string;
  target: string;
}

export interface OperatorAuditTrailSnapshot {
  eventCount: number;
  rows: OperatorAuditTrailRow[];
}

export async function getOperatorAuditTrailSnapshot(
  limit = 10
): Promise<OperatorAuditTrailSnapshot> {
  const take = boundedLimit(limit);
  const events = await prisma.operatorAuditEvent.findMany({
    orderBy: {
      createdAt: "desc"
    },
    select: {
      action: true,
      actorEmail: true,
      actorRole: true,
      createdAt: true,
      id: true,
      note: true,
      targetId: true,
      targetType: true
    },
    take
  });
  const rows = events.map((event) => ({
    action: event.action,
    actorEmail: event.actorEmail,
    actorRole: event.actorRole,
    createdAt: event.createdAt.toISOString(),
    id: event.id,
    notePreview: previewText(event.note),
    target: event.targetId ? `${event.targetType} ${event.targetId}` : event.targetType
  }));

  return {
    eventCount: rows.length,
    rows
  };
}

function boundedLimit(limit: number) {
  if (!Number.isFinite(limit)) {
    return 10;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), 50);
}

function previewText(value: string | null) {
  const normalized = value?.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return undefined;
  }

  if (normalized.length <= 120) {
    return normalized;
  }

  return `${normalized.slice(0, 117)}...`;
}
