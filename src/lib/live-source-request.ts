export const MAX_LIVE_SOURCE_TERM_LENGTH = 240;
export const MAX_LIVE_SOURCE_RESULT_LIMIT = 20;

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
  const term = normaliseSourceTerm(url.searchParams.get("term") ?? "");

  if (!term) {
    return {
      ok: false,
      status: 400,
      error: "Missing term query parameter."
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

function normaliseSourceTerm(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normaliseSourceLimit(value: string | null, defaultLimit: number) {
  const parsedLimit = value && value.trim() ? Number(value) : defaultLimit;
  const fallbackLimit = Number.isFinite(defaultLimit) ? defaultLimit : 10;
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : fallbackLimit;

  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIVE_SOURCE_RESULT_LIMIT);
}
