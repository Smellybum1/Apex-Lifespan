import {
  OperatorRole,
  OperatorStatus,
  type Prisma,
  type PrismaClient
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export interface OperatorBootstrapInput {
  email: string;
  name?: string;
  note?: string;
  role: OperatorRole;
  status: OperatorStatus;
}

export interface OperatorBootstrapPlan {
  apply: boolean;
  blockers: string[];
  confirmEmail?: string;
  input: OperatorBootstrapInput;
}

export interface OperatorBootstrapResult {
  action: "created" | "updated";
  auditEventId: string;
  email: string;
  role: OperatorRole;
  status: OperatorStatus;
  userId: string;
}

export function parseOperatorRole(value: string | undefined) {
  const normalized = value?.trim().toUpperCase().replace(/[-\s]+/g, "_");

  if (!normalized) {
    return OperatorRole.REVIEWER;
  }

  if (isOperatorRole(normalized)) {
    return normalized;
  }

  throw new Error(
    `--role must be one of ${Object.values(OperatorRole).join(", ")}.`
  );
}

export function parseOperatorStatus(value: string | undefined) {
  const normalized = value?.trim().toUpperCase().replace(/[-\s]+/g, "_");

  if (!normalized) {
    return OperatorStatus.ACTIVE;
  }

  if (isOperatorStatus(normalized)) {
    return normalized;
  }

  throw new Error(
    `--status must be one of ${Object.values(OperatorStatus).join(", ")}.`
  );
}

export function buildOperatorBootstrapPlan({
  apply,
  confirmEmail,
  env,
  input
}: {
  apply: boolean;
  confirmEmail?: string;
  env: { APEX_OPERATOR_WRITES_ENABLED?: string };
  input: OperatorBootstrapInput;
}): OperatorBootstrapPlan {
  const blockers: string[] = [];

  if (!isValidEmail(input.email)) {
    blockers.push("--email must be a valid email address.");
  }

  if (apply) {
    if (confirmEmail !== input.email) {
      blockers.push("--confirm-email must exactly match --email when --apply is used.");
    }

    if (env.APEX_OPERATOR_WRITES_ENABLED !== "true") {
      blockers.push("APEX_OPERATOR_WRITES_ENABLED=true is required when --apply is used.");
    }
  }

  return {
    apply,
    blockers,
    confirmEmail,
    input: {
      ...input,
      email: input.email.trim().toLowerCase(),
      name: normalizeOptional(input.name),
      note: normalizeOptional(input.note)
    }
  };
}

export async function bootstrapOperatorProfile(
  input: OperatorBootstrapInput,
  client: Pick<
    PrismaClient,
    "$transaction" | "operatorAuditEvent" | "operatorProfile" | "user"
  > = prisma
): Promise<OperatorBootstrapResult> {
  return client.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: {
        email: input.email
      },
      include: {
        operatorProfile: true
      }
    });
    const user = await tx.user.upsert({
      create: {
        email: input.email,
        name: input.name
      },
      update: {
        name: input.name
      },
      where: {
        email: input.email
      }
    });
    const profile = await tx.operatorProfile.upsert({
      create: {
        note: input.note,
        role: input.role,
        status: input.status,
        userId: user.id
      },
      update: {
        disabledAt: input.status === OperatorStatus.DISABLED ? new Date() : null,
        note: input.note,
        role: input.role,
        status: input.status
      },
      where: {
        userId: user.id
      }
    });
    const auditEvent = await tx.operatorAuditEvent.create({
      data: {
        action: "operator.bootstrap",
        actorEmail: "local-operator-bootstrap",
        actorRole: OperatorRole.OWNER,
        actorUserId: undefined,
        afterSummary: operatorProfileSummary({
          email: input.email,
          role: profile.role,
          status: profile.status
        }),
        beforeSummary: existingUser?.operatorProfile
          ? operatorProfileSummary({
              email: input.email,
              role: existingUser.operatorProfile.role,
              status: existingUser.operatorProfile.status
            })
          : undefined,
        metadata: {
          command: "operator:bootstrap",
          localOnly: true
        },
        note: input.note,
        targetId: profile.id,
        targetType: "OperatorProfile"
      }
    });

    return {
      action: existingUser?.operatorProfile ? "updated" : "created",
      auditEventId: auditEvent.id,
      email: input.email,
      role: profile.role,
      status: profile.status,
      userId: user.id
    };
  });
}

function operatorProfileSummary({
  email,
  role,
  status
}: {
  email: string;
  role: OperatorRole;
  status: OperatorStatus;
}): Prisma.InputJsonValue {
  return {
    email,
    role,
    status
  };
}

function isOperatorRole(value: string): value is OperatorRole {
  return Object.values(OperatorRole).includes(value as OperatorRole);
}

function isOperatorStatus(value: string): value is OperatorStatus {
  return Object.values(OperatorStatus).includes(value as OperatorStatus);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function normalizeOptional(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
