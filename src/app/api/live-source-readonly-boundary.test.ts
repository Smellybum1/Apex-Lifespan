import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const API_DIR = path.join(process.cwd(), "src", "app", "api");

const SOURCE_CANDIDATE_MODULE_IMPORT_PATTERN =
  /\b(?:from|import\s*\(|require\s*\()\s*["'][^"']*source-candidate(?:s|-[^"']*)?["']/;

const DISALLOWED_ROUTE_PATTERNS = [
  {
    label: "source-candidate module import",
    pattern: SOURCE_CANDIDATE_MODULE_IMPORT_PATTERN
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
  it("detects static, dynamic, and CommonJS source-candidate module imports", () => {
    expect(
      SOURCE_CANDIDATE_MODULE_IMPORT_PATTERN.test(
        'import { listSourceCandidateReviewQueue } from "@/lib/data/source-candidates";'
      )
    ).toBe(true);
    expect(
      SOURCE_CANDIDATE_MODULE_IMPORT_PATTERN.test(
        'const helpers = await import("@/lib/data/source-candidate-jobs");'
      )
    ).toBe(true);
    expect(
      SOURCE_CANDIDATE_MODULE_IMPORT_PATTERN.test(
        'const mapper = require("../../lib/source-candidates");'
      )
    ).toBe(true);
    expect(
      SOURCE_CANDIDATE_MODULE_IMPORT_PATTERN.test(
        'import { searchPubMed } from "@/lib/integrations/pubmed";'
      )
    ).toBe(false);
  });

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
