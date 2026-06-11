import { OperatorRole, OperatorStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  getOperatorBrowserWriteControlState,
  type OperatorBrowserWriteControlEnv
} from "@/lib/operator/browser-write-controls";
import type { OperatorPrincipal } from "@/lib/operator/authorization";

const activeAdmin: OperatorPrincipal = {
  email: "admin@example.test",
  role: OperatorRole.ADMIN,
  status: OperatorStatus.ACTIVE,
  userId: "user-admin"
};

const approvedEnv: OperatorBrowserWriteControlEnv = {
  APEX_OPERATOR_BROWSER_WRITE_CONTROLS_APPROVED_AT: "2026-06-11T12:00:00Z",
  APEX_OPERATOR_FLOW_QA_REVIEWED_AT: "2026-06-11T11:00:00Z",
  APEX_OPERATOR_NONPROD_WRITE_QA_AT: "2026-06-11T10:00:00Z",
  APEX_OPERATOR_WRITES_ENABLED: "true"
};

describe("operator browser write control gate", () => {
  it("keeps browser writes locked by default", () => {
    const state = getOperatorBrowserWriteControlState(activeAdmin, "claim-link", {});

    expect(state.enabled).toBe(false);
    expect(state.blockers).toEqual([
      "APEX_OPERATOR_WRITES_ENABLED=true is required.",
      "APEX_OPERATOR_NONPROD_WRITE_QA_AT is required.",
      "APEX_OPERATOR_FLOW_QA_REVIEWED_AT is required.",
      "APEX_OPERATOR_BROWSER_WRITE_CONTROLS_APPROVED_AT is required."
    ]);
    expect(state.evidenceKeys).toEqual([
      "APEX_OPERATOR_WRITES_ENABLED",
      "APEX_OPERATOR_NONPROD_WRITE_QA_AT",
      "APEX_OPERATOR_FLOW_QA_REVIEWED_AT",
      "APEX_OPERATOR_BROWSER_WRITE_CONTROLS_APPROVED_AT"
    ]);
  });

  it("requires an active operator with the matching role", () => {
    const disabledReviewer = {
      ...activeAdmin,
      role: OperatorRole.REVIEWER,
      status: OperatorStatus.DISABLED
    };

    const state = getOperatorBrowserWriteControlState(
      disabledReviewer,
      "study-extraction",
      approvedEnv
    );

    expect(state.enabled).toBe(false);
    expect(state.blockers).toEqual([
      "Operator account must be active.",
      "Operator role does not allow this browser control."
    ]);
  });

  it("enables only after write gate and browser-control approval evidence are present", () => {
    const state = getOperatorBrowserWriteControlState(
      activeAdmin,
      "study-extraction",
      approvedEnv
    );

    expect(state.enabled).toBe(true);
    expect(state.blockers).toEqual([]);
    expect(state.permission).toBe("curation:study-extraction");
  });
});
