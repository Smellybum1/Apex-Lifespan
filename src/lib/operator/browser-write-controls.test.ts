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

const approvedImportEnv: OperatorBrowserWriteControlEnv = {
  ...approvedEnv,
  APEX_ONBOARDING_DATABASE_IMPORT_ENABLED: "true",
  APEX_ONBOARDING_DATABASE_IMPORT_REVIEWED_AT: "2026-06-13T01:00:00Z"
};

const approvedPublicChangelogPublicationEnv: OperatorBrowserWriteControlEnv = {
  ...approvedEnv,
  APEX_PUBLIC_CHANGELOG_PUBLISH_REVIEWED_AT: "2026-06-13T02:00:00Z"
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

  it("enables only after write control and browser-control evidence are present", () => {
    const state = getOperatorBrowserWriteControlState(
      activeAdmin,
      "study-extraction",
      approvedEnv
    );

    expect(state.enabled).toBe(true);
    expect(state.blockers).toEqual([]);
    expect(state.permission).toBe("curation:study-extraction");
  });

  it("maps public promotion to the evidence promotion permission", () => {
    const state = getOperatorBrowserWriteControlState(
      activeAdmin,
      "public-promotion",
      approvedEnv
    );

    expect(state.enabled).toBe(true);
    expect(state.permission).toBe("evidence:promote");
  });

  it("keeps public changelog publication behind its dedicated reviewed-at evidence", () => {
    const locked = getOperatorBrowserWriteControlState(
      activeAdmin,
      "public-changelog-publication",
      approvedEnv
    );

    expect(locked.enabled).toBe(false);
    expect(locked.blockers).toEqual([
      "APEX_PUBLIC_CHANGELOG_PUBLISH_REVIEWED_AT is required."
    ]);
    expect(locked.permission).toBe("evidence:promote");

    const ready = getOperatorBrowserWriteControlState(
      activeAdmin,
      "public-changelog-publication",
      approvedPublicChangelogPublicationEnv
    );

    expect(ready.enabled).toBe(true);
    expect(ready.blockers).toEqual([]);
    expect(ready.evidenceKeys).toContain(
      "APEX_PUBLIC_CHANGELOG_PUBLISH_REVIEWED_AT"
    );
  });

  it("maps source discovery collection to the candidate review permission", () => {
    const state = getOperatorBrowserWriteControlState(
      activeAdmin,
      "source-discovery",
      approvedEnv
    );

    expect(state.enabled).toBe(true);
    expect(state.permission).toBe("candidate:review");
  });

  it("maps claim-packet review to the evidence promotion permission", () => {
    const state = getOperatorBrowserWriteControlState(
      activeAdmin,
      "claim-packet-review",
      approvedEnv
    );

    expect(state.enabled).toBe(true);
    expect(state.permission).toBe("evidence:promote");
  });

  it("maps trial-alert recording to the admin curation permission", () => {
    const state = getOperatorBrowserWriteControlState(
      activeAdmin,
      "trial-alert",
      approvedEnv
    );

    expect(state.enabled).toBe(true);
    expect(state.permission).toBe("curation:study-extraction");
  });

  it("maps onboarding drafts to the admin-only onboarding draft permission", () => {
    const state = getOperatorBrowserWriteControlState(
      activeAdmin,
      "onboarding-draft",
      approvedEnv
    );

    expect(state.enabled).toBe(true);
    expect(state.permission).toBe("onboarding:draft");
  });

  it("keeps onboarding database import behind its own reviewed gate", () => {
    const locked = getOperatorBrowserWriteControlState(
      activeAdmin,
      "onboarding-import",
      approvedEnv
    );

    expect(locked.enabled).toBe(false);
    expect(locked.blockers).toEqual([
      "APEX_ONBOARDING_DATABASE_IMPORT_ENABLED=true is required.",
      "APEX_ONBOARDING_DATABASE_IMPORT_REVIEWED_AT is required."
    ]);
    expect(locked.permission).toBe("onboarding:import");

    const ready = getOperatorBrowserWriteControlState(
      activeAdmin,
      "onboarding-import",
      approvedImportEnv
    );

    expect(ready.enabled).toBe(true);
    expect(ready.blockers).toEqual([]);
    expect(ready.evidenceKeys).toContain("APEX_ONBOARDING_DATABASE_IMPORT_ENABLED");
    expect(ready.evidenceKeys).toContain("APEX_ONBOARDING_DATABASE_IMPORT_REVIEWED_AT");
  });
});
