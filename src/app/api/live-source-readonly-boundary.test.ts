import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const API_DIR = path.join(process.cwd(), "src", "app", "api");

const DISALLOWED_ROUTE_PATTERNS = [
  {
    label: "source-candidate module import",
    pattern: /from\s+["'][^"']*source-candidate(?:s|-[^"']*)?["']/
  },
  {
    label: "source-candidate Prisma write surface",
    pattern: /\bprisma\.sourceCandidate\b/
  },
  {
    label: "source-candidate persistence helper",
    pattern: /\b(upsertSourceCandidate|queueSourceCandidate|recordSourceCandidateDecision)\b/
  }
];

describe("live source API read-only boundary", () => {
  it("does not expose source-candidate persistence from public route handlers", () => {
    const routeFiles = listRouteFiles(API_DIR);

    expect(routeFiles.length).toBeGreaterThan(0);

    for (const filePath of routeFiles) {
      const source = readFileSync(filePath, "utf8");
      const violations = DISALLOWED_ROUTE_PATTERNS
        .filter(({ pattern }) => pattern.test(source))
        .map(({ label }) => label);

      expect(
        violations,
        `${relativeRoutePath(filePath)} must stay read-only for live-source previews`
      ).toEqual([]);
    }
  });
});

function listRouteFiles(directory: string): string[] {
  return readdirSync(directory)
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry);

      if (statSync(entryPath).isDirectory()) {
        return listRouteFiles(entryPath);
      }

      return entry === "route.ts" ? [entryPath] : [];
    })
    .sort();
}

function relativeRoutePath(filePath: string) {
  return path.relative(process.cwd(), filePath).replace(/\\/g, "/");
}
