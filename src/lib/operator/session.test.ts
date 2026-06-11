import { describe, expect, it } from "vitest";

import { operatorAuthConfigured } from "@/lib/operator/config";

const configuredEnv = {
  AUTH_GITHUB_ID: "github-id",
  AUTH_GITHUB_SECRET: "github-secret",
  AUTH_SECRET: "auth-secret",
  DATABASE_URL: "postgresql://user:password@localhost:5432/apex_lifespan"
};

describe("operator auth session configuration", () => {
  it("requires GitHub OAuth, auth secret, and database URL", () => {
    expect(operatorAuthConfigured(configuredEnv)).toBe(true);
    expect(operatorAuthConfigured({ ...configuredEnv, AUTH_GITHUB_ID: "" })).toBe(false);
    expect(operatorAuthConfigured({ ...configuredEnv, AUTH_GITHUB_SECRET: "" })).toBe(false);
    expect(operatorAuthConfigured({ ...configuredEnv, AUTH_SECRET: "" })).toBe(false);
    expect(operatorAuthConfigured({ ...configuredEnv, DATABASE_URL: "" })).toBe(false);
  });
});
