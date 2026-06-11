import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const NEXT_CONFIG_SOURCE = readFileSync(path.join(process.cwd(), "next.config.mjs"), "utf8");

describe("Next.js security header config", () => {
  it("sets the conservative public security header baseline", () => {
    expect(NEXT_CONFIG_SOURCE).toContain("async headers()");
    expect(NEXT_CONFIG_SOURCE).toContain('source: "/:path*"');
    expect(NEXT_CONFIG_SOURCE).toContain('"Content-Security-Policy"');
    expect(NEXT_CONFIG_SOURCE).toContain("base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
    expect(NEXT_CONFIG_SOURCE).toContain('"Referrer-Policy"');
    expect(NEXT_CONFIG_SOURCE).toContain('"strict-origin-when-cross-origin"');
    expect(NEXT_CONFIG_SOURCE).toContain('"Strict-Transport-Security"');
    expect(NEXT_CONFIG_SOURCE).toContain('"max-age=31536000"');
    expect(NEXT_CONFIG_SOURCE).toContain('"X-Content-Type-Options"');
    expect(NEXT_CONFIG_SOURCE).toContain('"nosniff"');
    expect(NEXT_CONFIG_SOURCE).toContain('"X-Frame-Options"');
    expect(NEXT_CONFIG_SOURCE).toContain('"DENY"');
    expect(NEXT_CONFIG_SOURCE).toContain('"Permissions-Policy"');
    expect(NEXT_CONFIG_SOURCE).toContain(
      '"camera=(), microphone=(), geolocation=(), browsing-topics=()"'
    );
  });

  it("does not add strict script/style CSP before browser QA", () => {
    expect(NEXT_CONFIG_SOURCE).not.toContain("script-src");
    expect(NEXT_CONFIG_SOURCE).not.toContain("style-src");
    expect(NEXT_CONFIG_SOURCE).not.toContain("Cross-Origin-Opener-Policy");
    expect(NEXT_CONFIG_SOURCE).not.toContain("Cross-Origin-Embedder-Policy");
  });
});
