import { OperatorStatus } from "@prisma/client";

import {
  canOperatorAccess,
  operatorWritesEnabled,
  type OperatorPermission,
  type OperatorPrincipal,
  type OperatorWriteEnv
} from "@/lib/operator/authorization";

export type OperatorBrowserWriteControl =
  | "candidate-review"
  | "claim-link"
  | "public-promotion"
  | "study-extraction";

export interface OperatorBrowserWriteControlEnv
  extends OperatorWriteEnv,
    Record<string, string | undefined> {
  APEX_OPERATOR_BROWSER_WRITE_CONTROLS_APPROVED_AT?: string;
  APEX_OPERATOR_FLOW_QA_REVIEWED_AT?: string;
  APEX_OPERATOR_NONPROD_WRITE_QA_AT?: string;
}

export interface OperatorBrowserWriteControlState {
  blockers: string[];
  enabled: boolean;
  evidenceKeys: string[];
  permission: OperatorPermission;
}

const CONTROL_PERMISSION: Record<OperatorBrowserWriteControl, OperatorPermission> = {
  "candidate-review": "candidate:review",
  "claim-link": "curation:claim-link",
  "public-promotion": "evidence:promote",
  "study-extraction": "curation:study-extraction"
};

const REQUIRED_APPROVAL_KEYS = [
  "APEX_OPERATOR_NONPROD_WRITE_QA_AT",
  "APEX_OPERATOR_FLOW_QA_REVIEWED_AT",
  "APEX_OPERATOR_BROWSER_WRITE_CONTROLS_APPROVED_AT"
] as const;

export function getOperatorBrowserWriteControlState(
  principal: OperatorPrincipal | null | undefined,
  control: OperatorBrowserWriteControl,
  env: OperatorBrowserWriteControlEnv = {
    APEX_OPERATOR_BROWSER_WRITE_CONTROLS_APPROVED_AT:
      process.env.APEX_OPERATOR_BROWSER_WRITE_CONTROLS_APPROVED_AT,
    APEX_OPERATOR_FLOW_QA_REVIEWED_AT: process.env.APEX_OPERATOR_FLOW_QA_REVIEWED_AT,
    APEX_OPERATOR_NONPROD_WRITE_QA_AT: process.env.APEX_OPERATOR_NONPROD_WRITE_QA_AT,
    APEX_OPERATOR_WRITES_ENABLED: process.env.APEX_OPERATOR_WRITES_ENABLED
  }
): OperatorBrowserWriteControlState {
  const permission = CONTROL_PERMISSION[control];
  const blockers: string[] = [];

  if (!principal) {
    blockers.push("Operator authentication required.");
  } else {
    if (principal.status !== OperatorStatus.ACTIVE) {
      blockers.push("Operator account must be active.");
    }

    if (!canOperatorAccess(principal.role, permission)) {
      blockers.push("Operator role does not allow this browser control.");
    }
  }

  if (!operatorWritesEnabled(env)) {
    blockers.push("APEX_OPERATOR_WRITES_ENABLED=true is required.");
  }

  for (const key of REQUIRED_APPROVAL_KEYS) {
    if (!readEnv(env, key)) {
      blockers.push(`${key} is required.`);
    }
  }

  return {
    blockers,
    enabled: blockers.length === 0,
    evidenceKeys: ["APEX_OPERATOR_WRITES_ENABLED", ...REQUIRED_APPROVAL_KEYS],
    permission
  };
}

function readEnv(env: Record<string, string | undefined>, key: string) {
  const value = env[key];
  return value && value.trim() ? value.trim() : undefined;
}
