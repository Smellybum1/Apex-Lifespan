import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("/api/health", () => {
  it("returns a minimal public read-only health response", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
    expect(body).toEqual({
      checks: {
        database: "not_checked"
      },
      service: "apex-lifespan",
      status: "ok",
      surface: "public-read-only"
    });
  });
});
