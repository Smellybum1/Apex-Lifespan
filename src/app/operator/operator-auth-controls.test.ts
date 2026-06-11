import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const OPERATOR_PAGE_SOURCE = readFileSync(
  path.join(process.cwd(), "src", "app", "operator", "page.tsx"),
  "utf8"
);

describe("operator auth controls", () => {
  it("uses Auth.js server actions for explicit operator session entry and exit", () => {
    expect(OPERATOR_PAGE_SOURCE).toContain('import { signIn, signOut } from "@/auth";');
    expect(OPERATOR_PAGE_SOURCE).toContain("async function signInWithGitHub()");
    expect(OPERATOR_PAGE_SOURCE).toContain('"use server";');
    expect(OPERATOR_PAGE_SOURCE).toContain('await signIn("github", { redirectTo: "/operator" });');
    expect(OPERATOR_PAGE_SOURCE).toContain("async function signOutOperator()");
    expect(OPERATOR_PAGE_SOURCE).toContain('await signOut({ redirectTo: "/operator" });');
  });

  it("does not expose source-candidate write controls in the browser surface", () => {
    expect(OPERATOR_PAGE_SOURCE).toContain("Promotion readiness");
    expect(OPERATOR_PAGE_SOURCE).not.toMatch(/recordSourceCandidateDecision/);
    expect(OPERATOR_PAGE_SOURCE).not.toMatch(/linkSourceCandidateClaim/);
    expect(OPERATOR_PAGE_SOURCE).not.toMatch(/extractSourceCandidateStudy/);
    expect(OPERATOR_PAGE_SOURCE).not.toMatch(/assessSourceCandidatePublicPromotion/);
    expect(OPERATOR_PAGE_SOURCE).not.toMatch(/source-candidate-actions/);
    expect(OPERATOR_PAGE_SOURCE).not.toMatch(/<button[\s\S]*Promote/);
    expect(OPERATOR_PAGE_SOURCE).toContain("Read-only");
  });
});
