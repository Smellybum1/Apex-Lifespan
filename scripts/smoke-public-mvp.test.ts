import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { runPublicMvpSmoke } from "./smoke-public-mvp";

const servers: ReturnType<typeof createServer>[] = [];
const quietLogger = { log: () => undefined };

describe("public MVP smoke", () => {
  afterEach(async () => {
    await Promise.all(
      servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve())))
    );
    servers.length = 0;
  });

  it("passes against a database-backed public surface with a closed anonymous operator boundary", async () => {
    const baseUrl = await listenWithPages({
      homeDataSourceBadge: "Database-backed",
      operatorHtml: "Operator access required"
    });

    await expect(runPublicMvpSmoke(baseUrl, quietLogger)).resolves.toBeUndefined();
  });

  it("passes against a seed-backed public demo unless database mode is explicitly required", async () => {
    const baseUrl = await listenWithPages({
      homeDataSourceBadge: "Seed fallback",
      operatorHtml: "Operator access required"
    });

    await expect(runPublicMvpSmoke(baseUrl, quietLogger)).resolves.toBeUndefined();
  });

  it("requires the database-backed badge for fully-live smoke", async () => {
    const baseUrl = await listenWithPages({
      homeDataSourceBadge: "Seed fallback",
      operatorHtml: "Operator access required"
    });

    await expect(
      runPublicMvpSmoke(baseUrl, quietLogger, { requireDatabase: true })
    ).rejects.toThrow("Homepage must show Database-backed data source for fully-live smoke.");
  });

  it("rejects seed-mode text during fully-live smoke even when database-backed text is present", async () => {
    const baseUrl = await listenWithPages({
      homeDataSourceBadge: "Database-backed",
      homeExtraHtml: "Seed mode forced by APEX_DATA_SOURCE.",
      operatorHtml: "Operator access required"
    });

    await expect(
      runPublicMvpSmoke(baseUrl, quietLogger, { requireDatabase: true })
    ).rejects.toThrow(
      "Homepage must not show seed-mode text during fully-live smoke: Seed mode forced by APEX_DATA_SOURCE"
    );
  });

  it("fails when anonymous users can see authenticated operator content", async () => {
    const baseUrl = await listenWithPages({
      homeDataSourceBadge: "Seed fallback",
      operatorHtml: "Operator access required Candidate review queue"
    });

    await expect(runPublicMvpSmoke(baseUrl, quietLogger)).rejects.toThrow(
      "Operator anonymous boundary exposed authenticated operator content: Candidate review queue"
    );
  });

  it("fails when anonymous users can see the operator audit trail", async () => {
    const baseUrl = await listenWithPages({
      homeDataSourceBadge: "Seed fallback",
      operatorHtml: "Operator access required Audit trail"
    });

    await expect(runPublicMvpSmoke(baseUrl, quietLogger)).rejects.toThrow(
      "Operator anonymous boundary exposed authenticated operator content: Audit trail"
    );
  });
});

async function listenWithPages({
  homeDataSourceBadge,
  homeExtraHtml = "",
  operatorHtml
}: {
  homeDataSourceBadge: "Database-backed" | "Seed fallback";
  homeExtraHtml?: string;
  operatorHtml: string;
}) {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    if (url.pathname === "/") {
      writeHtml(
        response,
        `Apex Lifespan AU TGA ${homeDataSourceBadge} ${homeExtraHtml} Unreviewed AI draft Source packet Live PubMed results are unreviewed citation leads Registry records are research leads, not proof of benefit href="/privacy" href="/terms"`
      );
      return;
    }

    if (url.pathname === "/privacy") {
      writeHtml(
        response,
        "Privacy public evidence dashboard Public routes are read-only Live Source Searches Browser Storage"
      );
      return;
    }

    if (url.pathname === "/terms") {
      writeHtml(
        response,
        "Terms No Medical Advice Evidence Is Provisional Australia/TGA Context Public Read-Only Surface"
      );
      return;
    }

    if (url.pathname === "/operator") {
      writeHtml(response, operatorHtml);
      return;
    }

    if (url.pathname === "/api/health") {
      writeJson(response, 200, {
        checks: {
          database: "not_checked"
        },
        service: "apex-lifespan",
        status: "ok",
        surface: "public-read-only"
      });
      return;
    }

    if (url.pathname === "/api/pubmed/search") {
      if (url.searchParams.get("term")?.includes("injection")) {
        writeJson(response, 400, {
          error: "Term query parameter must include citation-oriented search terms."
        });
        return;
      }

      writeJson(response, 200, {
        articles: [],
        query: "creatine",
        source: "PubMed"
      });
      return;
    }

    if (url.pathname === "/api/trials/search") {
      if ((url.searchParams.get("term") ?? "").length > 240) {
        writeJson(response, 400, {
          error: "Term query parameter must be 240 characters or fewer."
        });
        return;
      }

      writeJson(response, 200, {
        query: "creatine",
        source: "ClinicalTrials.gov",
        studies: []
      });
      return;
    }

    response.writeHead(404);
    response.end("Not found");
  });
  servers.push(server);

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address() as AddressInfo;

  return `http://127.0.0.1:${address.port}`;
}

function writeHtml(response: ServerResponse, html: string) {
  response.writeHead(200, {
    "Content-Security-Policy": "base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    "Content-Type": "text/html",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=31536000",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY"
  });
  response.end(html);
}

function writeJson(response: ServerResponse, status: number, body: Record<string, unknown>) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
    "X-Robots-Tag": "noindex"
  });
  response.end(JSON.stringify(body));
}
