/**
 * Pipeline bookkeeping appended to stored claim text.
 *
 * The ingestion pipeline writes sentences about *itself* into `summary` and
 * `uncertainty` — how many articles were linked, what would improve the score,
 * that the row is an unreviewed draft. They describe the pipeline, not the
 * supplement.
 *
 * These prefixes live here rather than inside the reader model because more
 * than one consumer has to ignore them, and a consumer that forgets draws a
 * conclusion about the supplement from a sentence about the catalog. That is
 * exactly what happened to `isAdverseDirectionClaim`: hydrolyzed collagen and
 * probiotic blend rendered as safety cautions on the dashboard because their
 * uncertainty text ends "What would change the score: ... adverse-event detail",
 * and the word "adverse" was enough. Both claims are positive findings —
 * osteoarthritis symptom support and upper-respiratory infection prevention.
 */

/** Trailing sentences the pipeline appends to almost every summary. */
export const SUMMARY_NOISE_PREFIXES = [
  "This is based on ",
  "Representative extracted text:",
  "Keep the conclusion scoped to",
  "Safety evidence is kept separate from efficacy",
  "The current claim should be treated as low-certainty",
  "Local abstract/source metadata reports:"
];

/** The same, for `uncertainty`. */
export const UNCERTAINTY_NOISE_PREFIXES = [
  "Uncertainty remains because current local confidence is",
  "What would change the score:",
  "population, dose/form, duration, comparator, product quality",
  "Keep population, endpoint,"
];

export function splitClaimSentences(text: string) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function startsWithAny(sentence: string, prefixes: string[]) {
  const lowered = sentence.toLowerCase();

  return prefixes.some((prefix) => lowered.startsWith(prefix.toLowerCase()));
}

/**
 * Drops the bookkeeping sentences, leaving only text that says something about
 * the supplement. Anything reasoning about what a claim *means* should read
 * this, not the raw stored field.
 */
export function withoutPipelineNoise(text: string, prefixes: string[]) {
  return splitClaimSentences(text)
    .filter((sentence) => !startsWithAny(sentence, prefixes))
    .join(" ");
}
