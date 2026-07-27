import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchLiveSource,
  resetLiveSourceFetchStateForTests
} from "@/lib/live-source-fetch";

describe("fetchLiveSource", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetLiveSourceFetchStateForTests();
  });

  it("retries retryable live-source responses with Retry-After backoff", async () => {
    const sleep = vi.fn(async () => undefined);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response("slow down", {
          headers: {
            "Retry-After": "2"
          },
          status: 429
        })
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const response = await fetchLiveSource(
      "PubMed",
      "https://example.test/pubmed",
      {},
      {
        minIntervalMs: 0,
        retryDelaysMs: [500],
        sleep
      }
    );

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("does not retry non-retryable live-source responses", async () => {
    const sleep = vi.fn(async () => undefined);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("bad request", { status: 400 }));

    const response = await fetchLiveSource(
      "ClinicalTrials.gov",
      "https://example.test/trials",
      {},
      {
        minIntervalMs: 0,
        retryDelaysMs: [500],
        sleep
      }
    );

    expect(response.status).toBe(400);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("throttles sequential calls to the same live-source provider", async () => {
    let now = 1000;
    const sleep = vi.fn(async (ms: number) => {
      now += ms;
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok", { status: 200 }));
    const policy = {
      minIntervalMs: 1000,
      now: () => now,
      retryDelaysMs: [],
      sleep
    };

    await fetchLiveSource("PubMed", "https://example.test/pubmed/1", {}, policy);
    await fetchLiveSource("PubMed", "https://example.test/pubmed/2", {}, policy);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(1000);
  });
});
