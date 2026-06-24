import {
  type Prisma,
  PublicChangelogKind as DbPublicChangelogKind,
  type PublicChangelogEntry as DbPublicChangelogEntry
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export type ChangelogEntryKind =
  | "Evidence card"
  | "Operations"
  | "Public trust"
  | "Scoring"
  | "Source search";

export interface ChangelogEntry {
  date: string;
  details: string[];
  id: string;
  kind: ChangelogEntryKind;
  publicImpact: string;
  scoreChange?: {
    after: string;
    before: string;
    label: string;
    reason: string;
  };
  title: string;
}

export const publicChangelogEntries: ChangelogEntry[] = [
  {
    date: "2026-06-13",
    details: [
      "Every evidence card now includes a mandatory boundary box that states what the card does not prove.",
      "Seed claims include curated non-proof statements; database claims fall back to safety and applicability limits."
    ],
    id: "non-proof-boxes",
    kind: "Public trust",
    publicImpact:
      "Readers can see claim boundaries before treating a score as broader evidence than it is.",
    title: 'Added "what this does not prove" boxes'
  },
  {
    date: "2026-06-13",
    details: [
      "ClinicalTrials.gov preview rows now classify relevance as direct match, combination product, related outcome only, wrong population, or unreviewed lead.",
      "Registry rows also distinguish results posted, completed without posted results, and terminated or unknown status."
    ],
    id: "trial-relevance-labels",
    kind: "Source search",
    publicImpact:
      "Live trial previews are easier to scan without implying that registry matches prove benefit.",
    title: "Improved trial relevance labels"
  },
  {
    date: "2026-06-13",
    details: [
      "Claim cards now show source-packet depth, extracted study types, whether direct human trial rows are present, and regulatory-only evidence warnings.",
      "Badges are derived from curated source-packet rows rather than free text."
    ],
    id: "evidence-depth-badges",
    kind: "Public trust",
    publicImpact:
      "Readers can judge the kind of evidence behind a card before relying on a numeric score.",
    title: "Added evidence-depth badges"
  },
  {
    date: "2026-06-13",
    details: [
      "Composite and component scores now expose hover/click explanations.",
      "The dashboard states that the formula is partly heuristic and remains a review aid, not medical advice."
    ],
    id: "score-formula-tooltips",
    kind: "Scoring",
    publicImpact:
      "Score mechanics are visible instead of being hidden behind a single number.",
    title: "Added score formula tooltips"
  },
  {
    date: "2026-06-13",
    details: [
      "A visible top-of-page notice states that Apex Lifespan is an early public prototype.",
      "The notice clarifies that current scores are based on a small curated seed dataset and live source-search previews."
    ],
    id: "prototype-seed-dataset-notice",
    kind: "Public trust",
    publicImpact:
      "The public page is clearer about dataset size, review status, and medical-advice boundaries.",
    title: "Added prototype / seed dataset status"
  },
  {
    date: "2026-06-13",
    details: [
      "Public PubMed and ClinicalTrials.gov preview endpoints support citation and registry lead discovery.",
      "Live source previews remain unreviewed leads and do not write evidence or promote source candidates."
    ],
    id: "live-source-search-previews",
    kind: "Source search",
    publicImpact:
      "Readers and operators can inspect likely source leads while keeping public routes read-only.",
    title: "Added live source-search previews"
  },
  {
    date: "2026-06-12",
    details: [
      "The BPC-157 card keeps regulatory concern and very-low-confidence framing visible.",
      "The public wording avoids sourcing, compounding, preparation, route, cycling, dosing, or self-administration guidance."
    ],
    id: "bpc-157-regulatory-card",
    kind: "Evidence card",
    publicImpact:
      "Peptide watchlist content stays framed as regulatory and safety context, not consumer-use guidance.",
    title: "Added BPC-157 regulatory card"
  },
  {
    date: "2026-06-12",
    details: [
      "The psyllium card scopes evidence to small LDL-cholesterol biomarker support.",
      "The card separates lipid-biomarker evidence from glucose, gut, satiety, cardiovascular-event, and lifespan claims."
    ],
    id: "psyllium-lipid-evidence-card",
    kind: "Evidence card",
    publicImpact:
      "Psyllium now has a narrow reviewed evidence card instead of a broad supplement-level implication.",
    title: "Added psyllium lipid evidence card"
  },
  {
    date: "2026-06-12",
    details: [
      "Omega-3 cardiovascular-event framing was tightened after atrial-fibrillation and bleeding-context caveats were made more visible.",
      "The score remains conditional and product/form specific."
    ],
    id: "omega-3-cv-safety-score-update",
    kind: "Scoring",
    publicImpact:
      "Safety caveats affect interpretation rather than sitting outside the score discussion.",
    scoreChange: {
      after: "5.9",
      before: "6.2",
      label: "Omega-3 CV events",
      reason: "Safety signal and formulation caveats were made visible."
    },
    title: "Updated omega-3 cardiovascular event scoring"
  },
  {
    date: "2026-06-12",
    details: [
      "Complete launch source packets were human-reviewed before fully-live approval.",
      "Source-candidate review and public promotion remain explicit operator workflows."
    ],
    id: "human-reviewed-source-packets",
    kind: "Operations",
    publicImpact:
      "The public dataset distinguishes reviewed evidence cards from unreviewed live-source leads.",
    title: "Recorded reviewed source-packet baseline"
  }
];

const changelogKindMap: Record<DbPublicChangelogKind, ChangelogEntryKind> = {
  EVIDENCE_CARD: "Evidence card",
  METHODOLOGY: "Public trust",
  OPERATIONS: "Operations",
  PRODUCT_LABEL_ANALYZER: "Public trust",
  SAFETY_REGULATORY: "Evidence card",
  SCORING: "Scoring",
  SOURCE_SEARCH: "Source search"
};

export async function getPublicChangelogEntries(): Promise<ChangelogEntry[]> {
  try {
    const entries = await prisma.publicChangelogEntry.findMany({
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      where: {
        publishedAt: {
          not: null
        }
      }
    });

    if (entries.length === 0) {
      return publicChangelogEntries;
    }

    return [...entries.map(mapDatabaseChangelogEntry), ...publicChangelogEntries];
  } catch {
    return publicChangelogEntries;
  }
}

export function formatChangelogDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric"
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function mapDatabaseChangelogEntry(entry: DbPublicChangelogEntry): ChangelogEntry {
  return {
    date: entry.date.toISOString().slice(0, 10),
    details: jsonStringArray(entry.details),
    id: entry.slug,
    kind: changelogKindMap[entry.kind],
    publicImpact: entry.publicImpact,
    title: entry.title
  };
}

function jsonStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}
