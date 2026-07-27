import { describe, expect, it } from "vitest";

import { requiresLocalDockerPostgres } from "./start-dev-and-open";

describe("Apex Lifespan local launcher", () => {
  it("starts Docker Postgres for the configured local evidence database", () => {
    expect(
      requiresLocalDockerPostgres({
        APEX_DATA_SOURCE: "database",
        DATABASE_URL:
          "postgresql://postgres:postgres@localhost:5432/apex_lifespan?schema=public"
      })
    ).toBe(true);
  });

  it("does not start local Docker for seed or managed database modes", () => {
    expect(
      requiresLocalDockerPostgres({
        APEX_DATA_SOURCE: "seed",
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/apex_lifespan"
      })
    ).toBe(false);
    expect(
      requiresLocalDockerPostgres({
        APEX_DATA_SOURCE: "database",
        DATABASE_URL: "postgresql://user:secret@db.example.com/apex_lifespan"
      })
    ).toBe(false);
  });

  it("leaves malformed or custom local database targets alone", () => {
    expect(
      requiresLocalDockerPostgres({
        APEX_DATA_SOURCE: "database",
        DATABASE_URL: "not-a-database-url"
      })
    ).toBe(false);
    expect(
      requiresLocalDockerPostgres({
        APEX_DATA_SOURCE: "database",
        DATABASE_URL: "postgresql://localhost:5544/custom_database"
      })
    ).toBe(false);
  });
});
