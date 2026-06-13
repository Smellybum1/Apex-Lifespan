import { existsSync, readFileSync } from "node:fs";

import { parse } from "dotenv";

export interface LoadedEnvFile {
  env: Record<string, string>;
  loadedKeys: string[];
  path: string;
}

export function loadEnvFile(filePath: string): LoadedEnvFile {
  const trimmedPath = filePath.trim();

  if (!trimmedPath) {
    throw new Error("--env-file requires a path.");
  }

  if (!existsSync(trimmedPath)) {
    throw new Error(`Env file not found: ${trimmedPath}`);
  }

  const env = parse(readFileSync(trimmedPath, "utf8"));

  return {
    env,
    loadedKeys: Object.keys(env).sort(),
    path: trimmedPath
  };
}

export function mergeEnv(
  baseEnv: Record<string, string | undefined>,
  overlayEnv?: Record<string, string | undefined>
): Record<string, string | undefined> {
  return {
    ...baseEnv,
    ...(overlayEnv ?? {})
  };
}

export async function withProcessEnv<T>(
  env: Record<string, string | undefined>,
  callback: () => Promise<T>
): Promise<T> {
  const previousEnv = { ...process.env };

  try {
    for (const key of Object.keys(process.env)) {
      if (!(key in env)) {
        delete process.env[key];
      }
    }

    for (const [key, value] of Object.entries(env)) {
      if (typeof value === "string") {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    }

    return await callback();
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in previousEnv)) {
        delete process.env[key];
      }
    }

    for (const [key, value] of Object.entries(previousEnv)) {
      process.env[key] = value;
    }
  }
}
