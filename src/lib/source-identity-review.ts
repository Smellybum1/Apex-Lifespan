import { buildScoreWorklistReport } from "@/lib/score-worklist";
import type { EvidenceDashboardData, Intervention } from "@/lib/types";

const MIN_MATCH_TERM_LENGTH = 3;
// Generic words that appear in many supplement names/synonyms and would produce
// misleading title matches on their own. Includes chemical/nutrient class terms
// (e.g. "polyphenols") that span multiple interventions, so matching on them
// would wrongly name one supplement as the paper's subject.
const GENERIC_MATCH_STOPWORDS = new Set([
  "acid",
  "acids",
  "antioxidant",
  "antioxidants",
  "blend",
  "catechin",
  "catechins",
  "complex",
  "extract",
  "flavonoid",
  "flavonoids",
  "micronutrient",
  "micronutrients",
  "mineral",
  "minerals",
  "nutraceutical",
  "nutraceuticals",
  "oil",
  "phytochemical",
  "phytochemicals",
  "polyphenol",
  "polyphenols",
  "supplement",
  "vitamin"
]);

export type SupplementSourceDisposition = "likely-subject" | "needs-manual-check";

export interface SupplementSourceMatch {
  claimCount: number;
  disposition: SupplementSourceDisposition;
  interventionId: string;
  matchedTerm?: string;
  name: string;
  outcomes: string[];
  slug: string;
  titleMentionsSupplement: boolean;
}

export interface MultiSupplementSourceReview {
  claimCount: number;
  identityWarnings: string[];
  reference: {
    id: string;
    label: string;
    source: string;
    title: string;
    url: string;
    year?: number;
  };
  summary: string;
  supplementCount: number;
  supplements: SupplementSourceMatch[];
  titleSupportedNames: string[];
}

export interface BuildMultiSupplementSourceReviewOptions {
  limit?: number;
}

/**
 * Builds a read-only "which supplement does this paper actually support?" model
 * for references that are linked to two or more interventions but whose title
 * does not clearly name all of them. It never mutates data; it only surfaces the
 * title-match signal so a reviewer can confirm, reassign, or reject each link.
 */
export function buildMultiSupplementSourceReview(
  data: EvidenceDashboardData,
  options: BuildMultiSupplementSourceReviewOptions = {}
): MultiSupplementSourceReview[] {
  const interventionsById = new Map(
    data.interventions.map((intervention) => [intervention.id, intervention])
  );
  const report = buildScoreWorklistReport(data, {
    limit: Math.max(data.claims.length, 1),
    state: "work"
  });

  const reviews = report.repairSummary.pendingReferenceGroups
    .filter(
      (group) => group.interventions.length >= 2 && group.identityWarnings.length > 0
    )
    .map((group): MultiSupplementSourceReview => {
      const title = group.reference.title ?? "";
      const supplements = group.interventions
        .map((linked): SupplementSourceMatch => {
          const match = titleMatchForIntervention(title, interventionsById.get(linked.id));

          return {
            claimCount: linked.claimCount,
            disposition: match ? "likely-subject" : "needs-manual-check",
            interventionId: linked.id,
            matchedTerm: match,
            name: linked.name,
            outcomes: outcomesForIntervention(group.sampleClaims, linked.name),
            slug: linked.slug,
            titleMentionsSupplement: Boolean(match)
          };
        })
        .sort(
          (left, right) =>
            Number(right.titleMentionsSupplement) - Number(left.titleMentionsSupplement) ||
            right.claimCount - left.claimCount ||
            left.name.localeCompare(right.name)
        );
      const titleSupportedNames = supplements
        .filter((supplement) => supplement.titleMentionsSupplement)
        .map((supplement) => supplement.name);

      return {
        claimCount: group.claimCount,
        identityWarnings: group.identityWarnings,
        reference: group.reference,
        summary: buildReviewSummary(title, supplements, titleSupportedNames),
        supplementCount: supplements.length,
        supplements,
        titleSupportedNames
      };
    })
    .sort(
      (left, right) =>
        right.supplementCount - left.supplementCount ||
        right.claimCount - left.claimCount ||
        left.reference.label.localeCompare(right.reference.label)
    );

  return options.limit ? reviews.slice(0, options.limit) : reviews;
}

function outcomesForIntervention(
  sampleClaims: Array<{ interventionName: string; outcome: string }>,
  interventionName: string
) {
  return Array.from(
    new Set(
      sampleClaims
        .filter((claim) => claim.interventionName === interventionName)
        .map((claim) => claim.outcome)
    )
  ).filter(Boolean);
}

function titleMatchForIntervention(title: string, intervention?: Intervention) {
  if (!intervention) {
    return undefined;
  }

  const haystack = normaliseForMatch(title);

  if (!haystack) {
    return undefined;
  }

  const terms = [intervention.name, ...intervention.synonyms]
    .flatMap((term) => matchTermsFromName(term))
    .filter((term, index, all) => all.indexOf(term) === index);

  for (const term of terms) {
    if (containsTerm(haystack, term)) {
      return term;
    }
  }

  return undefined;
}

function matchTermsFromName(name: string) {
  const normalised = normaliseForMatch(name);

  if (!normalised) {
    return [];
  }

  const whole = normalised.replace(/\s+/g, " ").trim();
  const tokens = whole
    .split(" ")
    .filter(
      (token) =>
        token.length >= MIN_MATCH_TERM_LENGTH && !GENERIC_MATCH_STOPWORDS.has(token)
    );

  // Prefer the whole normalised name plus its meaningful tokens.
  return [whole, ...tokens].filter(
    (term) => term.length >= MIN_MATCH_TERM_LENGTH && !GENERIC_MATCH_STOPWORDS.has(term)
  );
}

function containsTerm(haystack: string, term: string) {
  const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(term)}(?:$|[^a-z0-9])`, "i");

  return pattern.test(haystack);
}

function normaliseForMatch(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildReviewSummary(
  title: string,
  supplements: SupplementSourceMatch[],
  titleSupportedNames: string[]
) {
  const unmatched = supplements
    .filter((supplement) => !supplement.titleMentionsSupplement)
    .map((supplement) => supplement.name);

  if (titleSupportedNames.length === 0) {
    return `The title names none of the ${supplements.length} linked supplements, so each link needs a manual read to confirm, reassign, or reject before it is used as claim evidence.`;
  }

  if (unmatched.length === 0) {
    return `The title names all ${supplements.length} linked supplements (${naturalJoin(
      titleSupportedNames
    )}); still confirm each supplement is actually studied rather than only mentioned.`;
  }

  return `The title names ${naturalJoin(
    titleSupportedNames
  )}; the other ${unmatched.length} linked supplement${
    unmatched.length === 1 ? "" : "s"
  } (${naturalJoin(unmatched)}) ${
    unmatched.length === 1 ? "is" : "are"
  } not named in the title and likely need reassignment or rejection.`;
}

function naturalJoin(values: string[]) {
  if (values.length === 0) {
    return "";
  }

  if (values.length === 1) {
    return values[0];
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

export function formatMultiSupplementSourceReviewLines(
  reviews: MultiSupplementSourceReview[]
) {
  if (reviews.length === 0) {
    return ["No multi-supplement source-identity reviews are pending."];
  }

  const lines = [
    `Multi-supplement source identity review (${reviews.length} reference(s))`,
    "Read-only: shows which linked supplement each shared paper actually names in its title.",
    ""
  ];

  reviews.forEach((review, index) => {
    lines.push(`${index + 1}. ${review.reference.label} - ${review.reference.title}`.trim());
    lines.push(`   ${review.summary}`);
    lines.push(`   URL: ${review.reference.url}`);
    review.supplements.forEach((supplement) => {
      const marker = supplement.titleMentionsSupplement
        ? `title names it (${supplement.matchedTerm})`
        : "not in title - manual check";
      lines.push(
        `   - ${supplement.name} [${supplement.disposition}] ${marker}; ${supplement.claimCount} claim link(s)`
      );
    });
    lines.push("");
  });

  return lines;
}
