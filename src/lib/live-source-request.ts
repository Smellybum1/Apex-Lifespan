export const MAX_LIVE_SOURCE_TERM_LENGTH = 240;

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
    limit: Number(url.searchParams.get(options.limitParam) ?? options.defaultLimit)
  };
}

function normaliseSourceTerm(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
