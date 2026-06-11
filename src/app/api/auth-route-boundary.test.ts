import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AUTH_ROUTE_SOURCE = readFileSync(
  path.join(process.cwd(), "src", "app", "api", "auth", "[...nextauth]", "route.ts"),
  "utf8"
);

describe("operator auth route boundary", () => {
  it("mounts only Auth.js route handlers", () => {
    expect(AUTH_ROUTE_SOURCE).toContain('import { handlers } from "@/auth";');
    expect(AUTH_ROUTE_SOURCE).toContain("export const { GET, POST } = handlers;");
    expect(AUTH_ROUTE_SOURCE).not.toContain("function POST");
    expect(AUTH_ROUTE_SOURCE).not.toContain("prisma.");
  });

  it("does not import source-candidate persistence", () => {
    expect(AUTH_ROUTE_SOURCE).not.toMatch(/source-candidate/);
    expect(AUTH_ROUTE_SOURCE).not.toMatch(/source-candidates/);
    expect(AUTH_ROUTE_SOURCE).not.toMatch(/recordSourceCandidateDecision/);
    expect(AUTH_ROUTE_SOURCE).not.toMatch(/upsertSourceCandidate/);
  });
});
