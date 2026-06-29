import { describe, expect, it } from "vitest";

import {
  guardLocalIngestionRequest,
  isLocalIngestionRequest
} from "@/lib/data/local-ingestion-route-guard";
import {
  LOCAL_INGESTION_WRITE_HEADER,
  LOCAL_INGESTION_WRITE_HEADER_VALUE
} from "@/lib/local-ingestion-security";

describe("local ingestion route guard", () => {
  it("allows localhost read requests", () => {
    expect(
      isLocalIngestionRequest(
        new Request("http://localhost:3000/api/local-ingestion/status")
      )
    ).toBe(true);
  });

  it("rejects non-localhost read requests", () => {
    expect(
      isLocalIngestionRequest(
        new Request("https://example.com/api/local-ingestion/status")
      )
    ).toBe(false);
  });

  it("rejects forwarded non-localhost requests", () => {
    expect(
      isLocalIngestionRequest(
        new Request("http://localhost:3000/api/local-ingestion/status", {
          headers: {
            "x-forwarded-host": "example.com"
          }
        })
      )
    ).toBe(false);
  });

  it("rejects local writes that are missing the dashboard write header", () => {
    expect(
      isLocalIngestionRequest(
        new Request("http://localhost:3000/api/local-ingestion/start", {
          headers: {
            origin: "http://localhost:3000",
            "sec-fetch-site": "same-origin"
          },
          method: "POST"
        })
      )
    ).toBe(false);
  });

  it("allows same-origin dashboard writes", () => {
    expect(
      isLocalIngestionWriteAllowed({
        origin: "http://localhost:3000",
        "sec-fetch-site": "same-origin"
      })
    ).toBe(true);
  });

  it("allows script-style local writes when the dashboard write header is present", () => {
    expect(isLocalIngestionWriteAllowed({})).toBe(true);
  });

  it("rejects cross-site browser writes", () => {
    expect(
      isLocalIngestionWriteAllowed({
        origin: "https://example.com",
        referer: "https://example.com/page",
        "sec-fetch-site": "cross-site"
      })
    ).toBe(false);
  });

  it("rejects same-site writes from a different localhost origin", () => {
    expect(
      isLocalIngestionRequest(
        new Request("http://localhost:3000/api/local-ingestion/start", {
          headers: {
            [LOCAL_INGESTION_WRITE_HEADER]: LOCAL_INGESTION_WRITE_HEADER_VALUE,
            origin: "http://localhost:4000",
            "sec-fetch-site": "same-site"
          },
          method: "POST"
        })
      )
    ).toBe(false);
  });

  it("returns a no-store forbidden response for rejected requests", async () => {
    const response = guardLocalIngestionRequest(
      new Request("https://example.com/api/local-ingestion/start", {
        method: "POST"
      })
    );

    expect(response?.status).toBe(403);
    expect(response?.headers.get("Cache-Control")).toBe("no-store");
    expect(await response?.json()).toEqual({
      error: "Local ingestion controls are only available from localhost."
    });
  });
});

function isLocalIngestionWriteAllowed(headers: Record<string, string>) {
  return isLocalIngestionRequest(
    new Request("http://localhost:3000/api/local-ingestion/start", {
      headers: {
        [LOCAL_INGESTION_WRITE_HEADER]: LOCAL_INGESTION_WRITE_HEADER_VALUE,
        ...headers
      },
      method: "POST"
    })
  );
}
