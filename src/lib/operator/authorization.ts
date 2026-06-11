import { OperatorRole, OperatorStatus } from "@prisma/client";

export type OperatorPermission =
  | "audit:read"
  | "candidate:review"
  | "curation:claim-link"
  | "curation:study-extraction"
  | "evidence:promote"
  | "operator:manage";

export interface OperatorPrincipal {
  email: string;
  role: OperatorRole;
  status: OperatorStatus;
  userId: string;
}

export interface OperatorWriteEnv {
  APEX_OPERATOR_WRITES_ENABLED?: string;
}

export class OperatorAuthorizationError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 | 503
  ) {
    super(message);
    this.name = "OperatorAuthorizationError";
  }
}

const ROLE_RANK: Record<OperatorRole, number> = {
  [OperatorRole.AUDITOR]: 1,
  [OperatorRole.REVIEWER]: 2,
  [OperatorRole.ADMIN]: 3,
  [OperatorRole.OWNER]: 4
};

const PERMISSION_MIN_ROLE: Record<OperatorPermission, OperatorRole> = {
  "audit:read": OperatorRole.AUDITOR,
  "candidate:review": OperatorRole.REVIEWER,
  "curation:claim-link": OperatorRole.ADMIN,
  "curation:study-extraction": OperatorRole.ADMIN,
  "evidence:promote": OperatorRole.ADMIN,
  "operator:manage": OperatorRole.OWNER
};

const WRITE_PERMISSIONS = new Set<OperatorPermission>([
  "candidate:review",
  "curation:claim-link",
  "curation:study-extraction",
  "evidence:promote",
  "operator:manage"
]);

export function canOperatorAccess(role: OperatorRole, permission: OperatorPermission) {
  return ROLE_RANK[role] >= ROLE_RANK[PERMISSION_MIN_ROLE[permission]];
}

export function isOperatorWritePermission(permission: OperatorPermission) {
  return WRITE_PERMISSIONS.has(permission);
}

export function operatorWritesEnabled(
  env: OperatorWriteEnv = {
    APEX_OPERATOR_WRITES_ENABLED: process.env.APEX_OPERATOR_WRITES_ENABLED
  }
) {
  return env.APEX_OPERATOR_WRITES_ENABLED === "true";
}

export function requireOperatorPermission(
  principal: OperatorPrincipal | null | undefined,
  permission: OperatorPermission,
  env?: OperatorWriteEnv
) {
  if (!principal) {
    throw new OperatorAuthorizationError("Operator authentication required.", 401);
  }

  if (principal.status !== OperatorStatus.ACTIVE) {
    throw new OperatorAuthorizationError("Operator access is disabled.", 403);
  }

  if (!canOperatorAccess(principal.role, permission)) {
    throw new OperatorAuthorizationError("Operator role does not allow this action.", 403);
  }

  if (isOperatorWritePermission(permission) && !operatorWritesEnabled(env)) {
    throw new OperatorAuthorizationError("Operator writes are disabled.", 503);
  }

  return principal;
}
