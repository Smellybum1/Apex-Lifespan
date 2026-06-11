export interface SeedIntegrityCollection {
  name: string;
  expectedIds: readonly string[];
  actualIds: readonly string[];
  allowDuplicateActualIds?: boolean;
  allowDuplicateExpectedIds?: boolean;
  seedOwnedPrefixes?: readonly string[];
}

export interface SeedIntegrityIssue {
  name: string;
  duplicateActualIds: string[];
  duplicateExpectedIds: string[];
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
        duplicateActualIds: collection.allowDuplicateActualIds
          ? []
          : sortedDuplicates(collection.actualIds),
        duplicateExpectedIds: collection.allowDuplicateExpectedIds
          ? []
          : sortedDuplicates(collection.expectedIds),
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
    .filter(hasSeedIntegrityIssue);
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
    if (issue.duplicateExpectedIds.length > 0) {
      lines.push(
        `${issue.name} has duplicate expected IDs: ${issue.duplicateExpectedIds.join(", ")}`
      );
    }

    if (issue.duplicateActualIds.length > 0) {
      lines.push(
        `${issue.name} has duplicate actual IDs: ${issue.duplicateActualIds.join(", ")}`
      );
    }

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

function hasSeedIntegrityIssue(issue: SeedIntegrityIssue) {
  return (
    issue.duplicateActualIds.length > 0 ||
    issue.duplicateExpectedIds.length > 0 ||
    issue.missingIds.length > 0 ||
    issue.staleSeedOwnedIds.length > 0
  );
}

function sortedDuplicates(values: readonly string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
      continue;
    }

    seen.add(value);
  }

  return Array.from(duplicates).sort((a, b) => a.localeCompare(b));
}

function sortedUnique(values: readonly string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}
