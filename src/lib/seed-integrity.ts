export interface SeedIntegrityCollection {
  name: string;
  expectedIds: readonly string[];
  actualIds: readonly string[];
  seedOwnedPrefixes?: readonly string[];
}

export interface SeedIntegrityIssue {
  name: string;
  missingIds: string[];
  staleSeedOwnedIds: string[];
}

export function findSeedIntegrityIssues(collections: readonly SeedIntegrityCollection[]) {
  return collections
    .map((collection): SeedIntegrityIssue => {
      const expectedIds = new Set(collection.expectedIds);
      const actualIds = new Set(collection.actualIds);
      const seedOwnedPrefixes = collection.seedOwnedPrefixes ?? [];

      return {
        name: collection.name,
        missingIds: sortedUnique(
          collection.expectedIds.filter((expectedId) => !actualIds.has(expectedId))
        ),
        staleSeedOwnedIds: sortedUnique(
          collection.actualIds.filter(
            (actualId) =>
              !expectedIds.has(actualId) &&
              seedOwnedPrefixes.some((prefix) => actualId.startsWith(prefix))
          )
        )
      };
    })
    .filter((issue) => issue.missingIds.length > 0 || issue.staleSeedOwnedIds.length > 0);
}

export function assertSeedIntegrity(collections: readonly SeedIntegrityCollection[]) {
  const issues = findSeedIntegrityIssues(collections);

  if (issues.length > 0) {
    throw new Error(formatSeedIntegrityIssues(issues));
  }
}

export function formatSeedIntegrityIssues(issues: readonly SeedIntegrityIssue[]) {
  const lines = ["Seed integrity check failed."];

  for (const issue of issues) {
    if (issue.missingIds.length > 0) {
      lines.push(`${issue.name} missing expected IDs: ${issue.missingIds.join(", ")}`);
    }

    if (issue.staleSeedOwnedIds.length > 0) {
      lines.push(
        `${issue.name} has stale seed-owned IDs: ${issue.staleSeedOwnedIds.join(", ")}`
      );
    }
  }

  return lines.join("\n");
}

function sortedUnique(values: readonly string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}
