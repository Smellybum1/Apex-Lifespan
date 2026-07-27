import type { PublicChangelogEntry as DbPublicChangelogEntry } from "@prisma/client";

import {
  formatChangelogDate,
  publicChangelogEntries,
  type ChangelogEntry
} from "@/lib/changelog";
import { prisma } from "@/lib/db/prisma";
import { publicChangelogKindFromDb } from "@/lib/data/evidence-model-mappers";

export function mapDbPublicChangelogEntry(entry: DbPublicChangelogEntry): ChangelogEntry {
  let details: string[];
  let scoreChange: ChangelogEntry["scoreChange"] | undefined;

  if (Array.isArray(entry.details)) {
    details = entry.details.filter((item): item is string => typeof item === "string");
  } else if (entry.details && typeof entry.details === "object") {
    const payload = entry.details as {
      bullets?: string[];
      scoreChange?: ChangelogEntry["scoreChange"];
    };
    details = payload.bullets ?? [JSON.stringify(entry.details)];
    scoreChange = payload.scoreChange;
  } else {
    details = [String(entry.details)];
  }

  return {
    date: entry.date.toISOString().slice(0, 10),
    details,
    id: entry.slug,
    kind: publicChangelogKindFromDb(entry.kind),
    publicImpact: entry.publicImpact,
    scoreChange,
    title: entry.title
  };
}

export async function listPublishedPublicChangelogEntries(): Promise<ChangelogEntry[]> {
  const rows = await prisma.publicChangelogEntry.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    where: {
      publishedAt: {
        not: null
      }
    }
  });

  return rows.map(mapDbPublicChangelogEntry);
}

export async function getPublicChangelogEntries(): Promise<ChangelogEntry[]> {
  try {
    const published = await listPublishedPublicChangelogEntries();

    if (published.length === 0) {
      return publicChangelogEntries;
    }

    const publishedIds = new Set(published.map((entry) => entry.id));
    const staticFallback = publicChangelogEntries.filter((entry) => !publishedIds.has(entry.id));

    return [...published, ...staticFallback].sort((left, right) => right.date.localeCompare(left.date));
  } catch {
    return publicChangelogEntries;
  }
}

export { formatChangelogDate };
