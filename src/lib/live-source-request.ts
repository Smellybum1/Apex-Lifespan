export const MAX_LIVE_SOURCE_TERM_LENGTH = 240;
export const MAX_LIVE_SOURCE_RESULT_LIMIT = 20;
export const LIVE_SOURCE_RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex"
} satisfies HeadersInit;
const UNSAFE_LIVE_SOURCE_TERM_PATTERN =
  /\b(?:buy|inject|injectable|injected|injecting|injection|injections|needle|needles|purchase|reconstitute|reconstituted|reconstitution|supplier|suppliers|sourcing|vendor|vendors|vial|vials)\b/gi;
const UNSAFE_LIVE_SOURCE_PHRASE_PATTERN =
  /\b(?:bac(?:teriostatic)?|sterile)[-\s]+water\b|\bself[-\s]+(?:administer(?:ed|ing)?|administration|use)\b/gi;

interface LiveSourceSearchRequestOptions {
  defaultLimit: number;
  limitParam: string;
}

type LiveSourceSearchRequest =
  | {
      ok: true;
      term: string;
      limit: number;
    }
  | {
      ok: false;
      status: 400;
      error: string;
    };

export function parseLiveSourceSearchRequest(
  requestUrl: string,
  options: LiveSourceSearchRequestOptions
): LiveSourceSearchRequest {
  const url = new URL(requestUrl);
  const rawTerm = normaliseSourceTerm(url.searchParams.get("term") ?? "");
  const term = normaliseLiveSourceSearchTerm(rawTerm);

  if (!rawTerm) {
    return {
      ok: false,
      status: 400,
      error: "Missing term query parameter."
    };
  }

  if (!term) {
    return {
      ok: false,
      status: 400,
      error: "Term query parameter must include citation-oriented search terms."
    };
  }

  if (term.length > MAX_LIVE_SOURCE_TERM_LENGTH) {
    return {
      ok: false,
      status: 400,
      error: `Term query parameter must be ${MAX_LIVE_SOURCE_TERM_LENGTH} characters or fewer.`
    };
  }

  return {
    ok: true,
    term,
    limit: normaliseSourceLimit(url.searchParams.get(options.limitParam), options.defaultLimit)
  };
}

export function publicLiveSourceError(sourceName: string) {
  return `${sourceName} search is temporarily unavailable.`;
}

export function normaliseLiveSourceSearchTerm(value: string) {
  return normaliseSourceTerm(
    value
      .replace(UNSAFE_LIVE_SOURCE_PHRASE_PATTERN, " ")
      .replace(UNSAFE_LIVE_SOURCE_TERM_PATTERN, " ")
  );
}

function normaliseSourceTerm(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normaliseSourceLimit(value: string | null, defaultLimit: number) {
  const parsedLimit = value && value.trim() ? Number(value) : defaultLimit;
  const fallbackLimit = Number.isFinite(defaultLimit) ? defaultLimit : 10;
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : fallbackLimit;

  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIVE_SOURCE_RESULT_LIMIT);
}
