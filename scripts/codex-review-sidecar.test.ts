import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createCodexReviewSidecar,
  readCodexReviewSidecarConfig,
  wrapPacket,
  type CodexReviewRunner,
  type CodexReviewSidecarConfig
} from "./codex-review-sidecar";

const servers: ReturnType<typeof createCodexReviewSidecar>[] = [];

describe("codex review sidecar", () => {
  afterEach(async () => {
    await Promise.all(
      servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve())))
    );
    servers.length = 0;
  });

  it("requires explicit operator thread and token configuration", () => {
    expect(() => readCodexReviewSidecarConfig({})).toThrow("APEX_CODEX_THREAD_ID is required.");
    expect(() =>
      readCodexReviewSidecarConfig({
        APEX_CODEX_THREAD_ID: "thread-123"
      })
    ).toThrow("APEX_CODEX_REVIEW_TOKEN is required.");
  });

  it("accepts approved local dashboard packets and calls the runner", async () => {
    const runner = vi.fn<CodexReviewRunner>().mockResolvedValue({
      finalResponse: "reviewer packet",
      usage: null
    });
    const { baseUrl } = await listenWithRunner(runner);

    const response = await fetch(`${baseUrl}/codex/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "http://localhost:3000",
        "X-Apex-Codex-Token": "secret-token"
      },
      body: JSON.stringify({ packet: "Analyze dashboard state." })
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
    expect(await response.json()).toEqual({
      finalResponse: "reviewer packet",
      usage: null
    });
    expect(runner).toHaveBeenCalledWith(
      "Analyze dashboard state.",
      expect.objectContaining({ threadId: "thread-123" })
    );
  });

  it("rejects missing or incorrect operator tokens before calling the runner", async () => {
    const runner = vi.fn<CodexReviewRunner>();
    const { baseUrl } = await listenWithRunner(runner);

    const response = await fetch(`${baseUrl}/codex/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "http://localhost:3000"
      },
      body: JSON.stringify({ packet: "Analyze dashboard state." })
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Operator token is required." });
    expect(runner).not.toHaveBeenCalled();
  });

  it("rejects unapproved browser origins", async () => {
    const runner = vi.fn<CodexReviewRunner>();
    const { baseUrl } = await listenWithRunner(runner);

    const response = await fetch(`${baseUrl}/codex/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://example.com",
        "X-Apex-Codex-Token": "secret-token"
      },
      body: JSON.stringify({ packet: "Analyze dashboard state." })
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Origin is not allowed." });
    expect(runner).not.toHaveBeenCalled();
  });

  it("wraps dashboard packets with read-only Codex instructions", () => {
    const packet = wrapPacket("Dashboard snapshot.");

    expect(packet).toContain("operator approved this read-only Apex Lifespan review packet");
    expect(packet).toContain("Do not edit files");
    expect(packet).toContain("accept/reject source candidates");
    expect(packet).toContain("Dashboard snapshot.");
  });
});

async function listenWithRunner(runner: CodexReviewRunner) {
  const server = createCodexReviewSidecar(testConfig(), runner);
  servers.push(server);

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`
  };
}

function testConfig(): CodexReviewSidecarConfig {
  return {
    allowedOrigins: ["http://localhost:3000"],
    port: 0,
    threadId: "thread-123",
    token: "secret-token",
    timeoutMs: 1000,
    workingDirectory: process.cwd()
  };
}
