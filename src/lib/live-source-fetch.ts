export type LiveSourceProvider = "ClinicalTrials.gov" | "PubMed";

export const LIVE_SOURCE_JSON_FETCH_INIT = {
  headers: {
    accept: "application/json"
  },
  cache: "no-store"
} satisfies RequestInit;

const DEFAULT_PROVIDER_MIN_INTERVAL_MS = 1000;
const DEFAULT_RETRY_DELAYS_MS = [2000, 5000];
const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504]);

const providerLastRequestAt = new Map<LiveSourceProvider, number>();
const providerQueues = new Map<LiveSourceProvider, Promise<void>>();

export interface LiveSourceFetchPolicy {
  minIntervalMs?: number;
  now?: () => number;
  retryDelaysMs?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
}

export async function fetchLiveSource(
  provider: LiveSourceProvider,
  input: RequestInfo | URL,
  init: RequestInit = {},
  policy: LiveSourceFetchPolicy = {}
) {
  const sleep = policy.sleep ?? defaultSleep;
  const retryDelaysMs = policy.retryDelaysMs ?? liveSourceRetryDelaysMs();
  let lastError: unknown;

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    await waitForProviderSlot(provider, policy);

    try {
      const response = await fetch(input, init);

      if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt >= retryDelaysMs.length) {
        return response;
      }

      await sleep(liveSourceRetryDelayMs(response, retryDelaysMs[attempt] ?? 0));
    } catch (error) {
      lastError = error;

      if (attempt >= retryDelaysMs.length) {
        throw error;
      }

      await sleep(retryDelaysMs[attempt] ?? 0);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Live source request failed.");
}

export function resetLiveSourceFetchStateForTests() {
  providerLastRequestAt.clear();
  providerQueues.clear();
}

async function waitForProviderSlot(
  provider: LiveSourceProvider,
  policy: LiveSourceFetchPolicy
) {
  const minIntervalMs = policy.minIntervalMs ?? liveSourceMinIntervalMs(provider);

  if (minIntervalMs <= 0) {
    return;
  }

  const sleep = policy.sleep ?? defaultSleep;
  const now = policy.now ?? Date.now;
  const previousQueue = providerQueues.get(provider) ?? Promise.resolve();
  const nextQueue = previousQueue
    .catch(() => undefined)
    .then(async () => {
      const elapsed = now() - (providerLastRequestAt.get(provider) ?? 0);
      const waitMs = Math.max(0, minIntervalMs - elapsed);

      if (waitMs > 0) {
        await sleep(waitMs);
      }

      providerLastRequestAt.set(provider, now());
    });

  providerQueues.set(provider, nextQueue);

  await nextQueue;
}

function liveSourceMinIntervalMs(provider: LiveSourceProvider) {
  if (process.env.NODE_ENV === "test") {
    return 0;
  }

  return readNonNegativeInteger(
    provider === "PubMed"
      ? process.env.APEX_PUBMED_MIN_INTERVAL_MS
      : process.env.APEX_CLINICALTRIALS_MIN_INTERVAL_MS,
    readNonNegativeInteger(
      process.env.APEX_LIVE_SOURCE_MIN_INTERVAL_MS,
      DEFAULT_PROVIDER_MIN_INTERVAL_MS
    )
  );
}

function liveSourceRetryDelaysMs() {
  if (process.env.NODE_ENV === "test") {
    return [];
  }

  const configured = process.env.APEX_LIVE_SOURCE_RETRY_DELAYS_MS;

  if (!configured) {
    return DEFAULT_RETRY_DELAYS_MS;
  }

  const values = configured
    .split(",")
    .map((value) => readNonNegativeInteger(value, Number.NaN))
    .filter(Number.isFinite);

  return values.length > 0 ? values : DEFAULT_RETRY_DELAYS_MS;
}

function liveSourceRetryDelayMs(response: Response, fallbackMs: number) {
  const retryAfter = response.headers.get("Retry-After");

  if (!retryAfter) {
    return fallbackMs;
  }

  const seconds = Number(retryAfter);

  if (Number.isFinite(seconds)) {
    return Math.max(0, Math.trunc(seconds * 1000));
  }

  const retryDate = Date.parse(retryAfter);

  return Number.isFinite(retryDate) ? Math.max(0, retryDate - Date.now()) : fallbackMs;
}

function readNonNegativeInteger(value: string | undefined, fallback: number) {
  const parsed = value === undefined ? Number.NaN : Number(value);

  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback;
}

function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
