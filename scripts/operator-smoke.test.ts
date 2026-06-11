import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { runOperatorSmoke } from "./operator-smoke";

const servers: ReturnType<typeof createServer>[] = [];
const quietLogger = { log: () => undefined };

describe("operator smoke", () => {
  afterEach(async () => {
    await Promise.all(
      servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve())))
    );
    servers.length = 0;
  });

  it("passes when anonymous users see the auth-unavailable closed state", async () => {
    const baseUrl = await listenWithOperatorHtml("Operator auth unavailable");

    await expect(
      runOperatorSmoke(baseUrl, { mode: "auth-unavailable" }, quietLogger)
    ).resolves.toBeUndefined();
  });

  it("passes when anonymous users see the sign-in required closed state", async () => {
    const baseUrl = await listenWithOperatorHtml("Operator access required Sign in with GitHub");

    await expect(
      runOperatorSmoke(baseUrl, { mode: "auth-required" }, quietLogger)
    ).resolves.toBeUndefined();
  });

  it("fails when authenticated operator content is visible anonymously", async () => {
    const baseUrl = await listenWithOperatorHtml(
      "Operator access required Candidate review queue"
    );

    await expect(runOperatorSmoke(baseUrl, {}, quietLogger)).rejects.toThrow(
      "Operator page exposed authenticated content: Candidate review queue"
    );
  });

  it("fails when anonymous users can see the audit trail", async () => {
    const baseUrl = await listenWithOperatorHtml("Operator access required Audit trail");

    await expect(runOperatorSmoke(baseUrl, {}, quietLogger)).rejects.toThrow(
      "Operator page exposed authenticated content: Audit trail"
    );
  });
});

async function listenWithOperatorHtml(operatorHtml: string) {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    if (url.pathname === "/operator") {
      writeHtml(response, operatorHtml);
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
