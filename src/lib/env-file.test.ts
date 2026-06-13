import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadEnvFile, mergeEnv, withProcessEnv } from "@/lib/env-file";

describe("env file loader", () => {
  it("loads dotenv-style values without exposing values in metadata", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "apex-env-file-"));
    const envPath = path.join(tempDir, ".env.preview.local");

    try {
      writeFileSync(
        envPath,
        [
          "DATABASE_URL=postgresql://user:secret@staging-db.example.com:5432/apex",
          "APEX_DATA_SOURCE=database",
          "EMPTY_VALUE=\"\""
        ].join("\n")
      );

      const loaded = loadEnvFile(envPath);

      expect(loaded.path).toBe(envPath);
      expect(loaded.loadedKeys).toEqual(["APEX_DATA_SOURCE", "DATABASE_URL", "EMPTY_VALUE"]);
      expect(loaded.env.EMPTY_VALUE).toBe("");
      expect(JSON.stringify({ loadedKeys: loaded.loadedKeys, path: loaded.path })).not.toContain(
        "secret"
      );
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("lets env-file values override shell values, including empty clears", () => {
    const env = mergeEnv(
      {
        APEX_DATA_SOURCE: "seed",
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/apex_lifespan"
      },
      {
        APEX_DATA_SOURCE: "database",
        DATABASE_URL: ""
      }
    );

    expect(env).toEqual({
      APEX_DATA_SOURCE: "database",
      DATABASE_URL: ""
    });
  });

  it("fails closed when the env file is missing", () => {
    expect(() => loadEnvFile(path.join(os.tmpdir(), "missing-apex-env-file"))).toThrow(
      /Env file not found/
    );
  });

  it("scopes process env overrides to the callback", async () => {
    const originalValue = process.env.APEX_ENV_FILE_TEST_VALUE;
    process.env.APEX_ENV_FILE_TEST_VALUE = "shell";

    await withProcessEnv(
      {
        APEX_ENV_FILE_TEST_VALUE: "env-file"
      },
      async () => {
        expect(process.env.APEX_ENV_FILE_TEST_VALUE).toBe("env-file");
      }
    );

    expect(process.env.APEX_ENV_FILE_TEST_VALUE).toBe("shell");

    if (typeof originalValue === "string") {
      process.env.APEX_ENV_FILE_TEST_VALUE = originalValue;
    } else {
      delete process.env.APEX_ENV_FILE_TEST_VALUE;
    }
  });
});
