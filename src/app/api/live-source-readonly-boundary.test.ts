import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const API_DIR = path.join(process.cwd(), "src", "app", "api");
const PUBLIC_RUNTIME_PATHS = [
  path.join(process.cwd(), "src", "app"),
  path.join(process.cwd(), "src", "components"),
  path.join(process.cwd(), "src", "lib", "data", "dashboard.ts")
];

const SOURCE_CANDIDATE_MODULE_IMPORT_PATTERN =
  /\b(?:from|import\s*\(|require\s*\()\s*["'][^"']*source-candidate(?:s|-[^"']*)?["']/;
const MUTATING_ROUTE_METHOD_PATTERN =
  /\bexport\s+(?:async\s+)?function\s+(?:POST|PUT|PATCH|DELETE)\b|\bexport\s+const\s+(?:POST|PUT|PATCH|DELETE)\b|\bexport\s*\{[\s\S]*?\bas\s+(?:POST|PUT|PATCH|DELETE)\b[\s\S]*?\}/;
const PRISMA_WRITE_PATTERN =
  /\bprisma\.[A-Za-z]\w*\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(|\bprisma\.\$(?:executeRaw|executeRawUnsafe)\s*(?:`|\()/;

const DISALLOWED_ROUTE_PATTERNS = [
  {
    label: "mutating HTTP route handler",
    pattern: MUTATING_ROUTE_METHOD_PATTERN
  },
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
  },
  {
    label: "Prisma write from public route handler",
    pattern: PRISMA_WRITE_PATTERN
  }
];
const DISALLOWED_PUBLIC_SURFACE_PATTERNS = DISALLOWED_ROUTE_PATTERNS;

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

  it("detects mutating HTTP route handlers", () => {
    expect(MUTATING_ROUTE_METHOD_PATTERN.test("export async function POST(request: Request) {}"))
      .toBe(true);
    expect(MUTATING_ROUTE_METHOD_PATTERN.test("export function DELETE(request: Request) {}"))
      .toBe(true);
    expect(MUTATING_ROUTE_METHOD_PATTERN.test("export const PATCH = handler;"))
      .toBe(true);
    expect(MUTATING_ROUTE_METHOD_PATTERN.test("export { handler as PUT };"))
      .toBe(true);
    expect(MUTATING_ROUTE_METHOD_PATTERN.test("export async function GET(request: Request) {}"))
      .toBe(false);
  });

  it("detects Prisma write calls while allowing read calls", () => {
    expect(PRISMA_WRITE_PATTERN.test("await prisma.reference.create({ data });")).toBe(true);
    expect(PRISMA_WRITE_PATTERN.test("await prisma.claim.updateMany({ data });")).toBe(true);
    expect(PRISMA_WRITE_PATTERN.test("await prisma.study.delete({ where });")).toBe(true);
    expect(PRISMA_WRITE_PATTERN.test("await prisma.$executeRaw`DELETE FROM Claim`;")).toBe(true);
    expect(PRISMA_WRITE_PATTERN.test("await prisma.reference.findMany({});")).toBe(false);
    expect(PRISMA_WRITE_PATTERN.test("await prisma.$queryRaw`SELECT 1`;")).toBe(false);
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

  it("does not expose source-candidate workflows from the public dashboard surface", () => {
    const publicFiles = listPublicRuntimeFiles(PUBLIC_RUNTIME_PATHS);

    expect(publicFiles.length).toBeGreaterThan(0);

    for (const filePath of publicFiles) {
      const source = readFileSync(filePath, "utf8");
      const violations = DISALLOWED_PUBLIC_SURFACE_PATTERNS
        .filter(({ pattern }) => pattern.test(source))
        .map(({ label }) => label);

      expect(
        violations,
        `${relativeProjectPath(filePath)} must not expose local source-candidate workflows publicly`
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

function listPublicRuntimeFiles(entries: string[]): string[] {
  return entries.flatMap((entryPath) => listPublicRuntimeEntry(entryPath)).sort();
}

function listPublicRuntimeEntry(entryPath: string): string[] {
  const stat = statSync(entryPath);

  if (stat.isDirectory()) {
    return readdirSync(entryPath).flatMap((entry) => {
      return listPublicRuntimeEntry(path.join(entryPath, entry));
    });
  }

  if (!/\.(?:ts|tsx)$/.test(entryPath) || /\.test\.(?:ts|tsx)$/.test(entryPath)) {
    return [];
  }

  return [entryPath];
}

function relativeRoutePath(filePath: string) {
  return relativeProjectPath(filePath);
}

function relativeProjectPath(filePath: string) {
  return path.relative(process.cwd(), filePath).replace(/\\/g, "/");
}
