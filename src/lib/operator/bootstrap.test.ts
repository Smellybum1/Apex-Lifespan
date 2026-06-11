import { OperatorRole, OperatorStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  bootstrapOperatorProfile,
  buildOperatorBootstrapPlan,
  parseOperatorRole,
  parseOperatorStatus
} from "@/lib/operator/bootstrap";

describe("operator bootstrap helper", () => {
  it("defaults to reviewer and active status", () => {
    expect(parseOperatorRole(undefined)).toBe(OperatorRole.REVIEWER);
    expect(parseOperatorStatus(undefined)).toBe(OperatorStatus.ACTIVE);
  });

  it("normalizes role and status values", () => {
    expect(parseOperatorRole("owner")).toBe(OperatorRole.OWNER);
    expect(parseOperatorStatus("disabled")).toBe(OperatorStatus.DISABLED);
  });

  it("keeps dry-runs available without enabling writes", () => {
    const plan = buildOperatorBootstrapPlan({
      apply: false,
      env: {},
      input: {
        email: " Reviewer@Example.com ",
        role: OperatorRole.REVIEWER,
        status: OperatorStatus.ACTIVE
      }
    });

    expect(plan.blockers).toEqual([]);
    expect(plan.input.email).toBe("reviewer@example.com");
  });

  it("requires explicit confirmation and write flag before apply", () => {
    const plan = buildOperatorBootstrapPlan({
      apply: true,
      confirmEmail: "other@example.com",
      env: {},
      input: {
        email: "owner@example.com",
        role: OperatorRole.OWNER,
        status: OperatorStatus.ACTIVE
      }
    });

    expect(plan.blockers).toEqual([
      "--confirm-email must exactly match --email when --apply is used.",
      "APEX_OPERATOR_WRITES_ENABLED=true is required when --apply is used."
    ]);
  });

  it("allows apply only after confirmation and write flag", () => {
    const plan = buildOperatorBootstrapPlan({
      apply: true,
      confirmEmail: "owner@example.com",
      env: {
        APEX_OPERATOR_WRITES_ENABLED: "true"
      },
      input: {
        email: "owner@example.com",
        role: OperatorRole.OWNER,
        status: OperatorStatus.ACTIVE
      }
    });

    expect(plan.blockers).toEqual([]);
  });

  it("upserts a user, profile, and audit event when applied", async () => {
    const userFindUnique = vi.fn().mockResolvedValue(null);
    const userUpsert = vi.fn().mockResolvedValue({ id: "user-1" });
    const profileUpsert = vi.fn().mockResolvedValue({
      id: "profile-1",
      role: OperatorRole.OWNER,
      status: OperatorStatus.ACTIVE
    });
    const auditCreate = vi.fn().mockResolvedValue({ id: "audit-1" });
    const tx = {
      operatorAuditEvent: {
        create: auditCreate
      },
      operatorProfile: {
        upsert: profileUpsert
      },
      user: {
        findUnique: userFindUnique,
        upsert: userUpsert
      }
    };
    const client = {
      $transaction: vi.fn(async (callback) => callback(tx))
    };

    await expect(
      bootstrapOperatorProfile(
        {
          email: "owner@example.com",
          name: "Owner",
          note: "Initial owner",
          role: OperatorRole.OWNER,
          status: OperatorStatus.ACTIVE
        },
        client as never
      )
    ).resolves.toEqual({
      action: "created",
      auditEventId: "audit-1",
      email: "owner@example.com",
      role: OperatorRole.OWNER,
      status: OperatorStatus.ACTIVE,
      userId: "user-1"
    });
    expect(userUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ email: "owner@example.com" })
      })
    );
    expect(profileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ role: OperatorRole.OWNER, userId: "user-1" })
      })
    );
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "operator.bootstrap",
          actorEmail: "local-operator-bootstrap",
          targetType: "OperatorProfile"
        })
      })
    );
  });
});
