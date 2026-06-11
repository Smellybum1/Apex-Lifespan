import { OperatorRole, OperatorStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  canOperatorAccess,
  isOperatorWritePermission,
  operatorWritesEnabled,
  requireOperatorPermission,
  OperatorAuthorizationError,
  type OperatorPrincipal
} from "@/lib/operator/authorization";

const activeReviewer: OperatorPrincipal = {
  email: "reviewer@example.test",
  role: OperatorRole.REVIEWER,
  status: OperatorStatus.ACTIVE,
  userId: "user-reviewer"
};

const writesEnabled = {
  APEX_OPERATOR_WRITES_ENABLED: "true"
};

describe("operator authorization policy", () => {
  it("allows higher roles to perform lower-role permissions", () => {
    expect(canOperatorAccess(OperatorRole.OWNER, "operator:manage")).toBe(true);
    expect(canOperatorAccess(OperatorRole.ADMIN, "evidence:promote")).toBe(true);
    expect(canOperatorAccess(OperatorRole.REVIEWER, "candidate:review")).toBe(true);
    expect(canOperatorAccess(OperatorRole.AUDITOR, "audit:read")).toBe(true);
  });

  it("blocks lower roles from elevated permissions", () => {
    expect(canOperatorAccess(OperatorRole.AUDITOR, "candidate:review")).toBe(false);
    expect(canOperatorAccess(OperatorRole.REVIEWER, "curation:claim-link")).toBe(false);
    expect(canOperatorAccess(OperatorRole.ADMIN, "operator:manage")).toBe(false);
  });

  it("treats review, curation, promotion, and operator management as writes", () => {
    expect(isOperatorWritePermission("audit:read")).toBe(false);
    expect(isOperatorWritePermission("candidate:review")).toBe(true);
    expect(isOperatorWritePermission("curation:claim-link")).toBe(true);
    expect(isOperatorWritePermission("curation:study-extraction")).toBe(true);
    expect(isOperatorWritePermission("evidence:promote")).toBe(true);
    expect(isOperatorWritePermission("operator:manage")).toBe(true);
  });

  it("fails write permissions closed unless explicitly enabled", () => {
    expect(operatorWritesEnabled({})).toBe(false);
    expect(operatorWritesEnabled({ APEX_OPERATOR_WRITES_ENABLED: "false" })).toBe(false);
    expect(operatorWritesEnabled(writesEnabled)).toBe(true);

    expect(() => requireOperatorPermission(activeReviewer, "candidate:review", {}))
      .toThrowError(
        new OperatorAuthorizationError("Operator writes are disabled.", 503)
      );
  });

  it("allows an active operator when role and write gate both pass", () => {
    expect(requireOperatorPermission(activeReviewer, "candidate:review", writesEnabled))
      .toBe(activeReviewer);
  });

  it("rejects missing, disabled, or underprivileged operators", () => {
    expect(() => requireOperatorPermission(null, "audit:read", writesEnabled))
      .toThrowError(
        new OperatorAuthorizationError("Operator authentication required.", 401)
      );

    expect(() =>
      requireOperatorPermission(
        {
          ...activeReviewer,
          status: OperatorStatus.DISABLED
        },
        "audit:read",
        writesEnabled
      )
    ).toThrowError(new OperatorAuthorizationError("Operator access is disabled.", 403));

    expect(() => requireOperatorPermission(activeReviewer, "operator:manage", writesEnabled))
      .toThrowError(
        new OperatorAuthorizationError("Operator role does not allow this action.", 403)
      );
  });
});
