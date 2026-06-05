import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { pathToFileURL, URL } from "node:url";

import "dotenv/config";
import { Codex, type ThreadOptions, type Usage } from "@openai/codex-sdk";

const DEFAULT_PORT = 3217;
const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001"
];
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_PACKET_BYTES = 64 * 1024;

export interface CodexReviewSidecarConfig {
  allowedOrigins: string[];
  port: number;
  threadId: string;
  token: string;
  timeoutMs: number;
  workingDirectory: string;
  model?: string;
}

export interface CodexReviewResult {
  finalResponse: string;
  usage: Usage | null;
}

export type CodexReviewRunner = (
  packet: string,
  config: CodexReviewSidecarConfig
) => Promise<CodexReviewResult>;

export function readCodexReviewSidecarConfig(
  env: Record<string, string | undefined> = process.env
): CodexReviewSidecarConfig {
  const threadId = env.APEX_CODEX_THREAD_ID?.trim();
  const token = env.APEX_CODEX_REVIEW_TOKEN?.trim();

  if (!threadId) {
    throw new Error("APEX_CODEX_THREAD_ID is required.");
  }

  if (!token) {
    throw new Error("APEX_CODEX_REVIEW_TOKEN is required.");
  }

  return {
    allowedOrigins: parseAllowedOrigins(env.APEX_CODEX_REVIEW_ORIGINS),
    port: readIntegerEnv(env.APEX_CODEX_REVIEW_PORT, DEFAULT_PORT),
    threadId,
    token,
    timeoutMs: readIntegerEnv(env.APEX_CODEX_REVIEW_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    workingDirectory: process.cwd(),
    model: env.APEX_CODEX_MODEL?.trim() || undefined
  };
}

export function createCodexReviewSidecar(
  config: CodexReviewSidecarConfig,
  runCodexReview: CodexReviewRunner = sendPacketToCodex
) {
  let inFlight = false;

  return createServer(async (request, response) => {
    const origin = request.headers.origin;
    const corsHeaders = allowedCorsHeaders(origin, config.allowedOrigins);

    if (!corsHeaders) {
      writeJson(response, 403, { error: "Origin is not allowed." });
      return;
    }

    if (request.method === "OPTIONS") {
      writeJson(response, 204, null, corsHeaders);
      return;
    }

    const url = request.url ? new URL(request.url, "http://127.0.0.1") : null;

    if (request.method !== "POST" || url?.pathname !== "/codex/review") {
      writeJson(response, 404, { error: "Not found." }, corsHeaders);
      return;
    }

    if (!matchesToken(request.headers["x-apex-codex-token"], config.token)) {
      writeJson(response, 401, { error: "Operator token is required." }, corsHeaders);
      return;
    }

    if (inFlight) {
      writeJson(response, 409, { error: "A Codex review is already running." }, corsHeaders);
      return;
    }

    try {
      const body = await readJsonBody(request);
      const packet = typeof body.packet === "string" ? body.packet.trim() : "";

      if (!packet) {
        writeJson(response, 400, { error: "Review packet is required." }, corsHeaders);
        return;
      }

      inFlight = true;
      const result = await runCodexReview(packet, config);
      writeJson(
        response,
        200,
        {
          finalResponse: result.finalResponse,
          usage: result.usage
        },
        corsHeaders
      );
    } catch (error) {
      writeJson(
        response,
        error instanceof PayloadTooLargeError ? 413 : 500,
        { error: publicErrorMessage(error) },
        corsHeaders
      );
    } finally {
      inFlight = false;
    }
  });
}

export async function sendPacketToCodex(
  packet: string,
  config: CodexReviewSidecarConfig
): Promise<CodexReviewResult> {
  const codex = new Codex();
  const threadOptions: ThreadOptions = {
    approvalPolicy: "never",
    sandboxMode: "read-only",
    workingDirectory: config.workingDirectory,
    ...(config.model ? { model: config.model } : {})
  };
  const thread = codex.resumeThread(config.threadId, threadOptions);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const result = await thread.run(wrapPacket(packet), {
      signal: controller.signal
    });

    return {
      finalResponse: result.finalResponse,
      usage: result.usage
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function wrapPacket(packet: string) {
  return [
    "The dashboard operator approved this read-only Apex Lifespan review packet.",
    "Analyze it and return a reviewer packet in this thread.",
    "Do not edit files, run writes, accept/reject source candidates, promote references, or change public evidence.",
    "",
    packet
  ].join("\n");
}

function parseAllowedOrigins(value: string | undefined) {
  const origins = value
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins && origins.length > 0 ? origins : DEFAULT_ALLOWED_ORIGINS;
}

function readIntegerEnv(value: string | undefined, fallback: number) {
  const parsed = value ? Number(value) : fallback;

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function allowedCorsHeaders(
  origin: string | undefined,
  allowedOrigins: string[]
): Record<string, string> | null {
  if (!origin) {
    return {};
  }

  if (!allowedOrigins.includes(origin)) {
    return null;
  }

  return {
    "Access-Control-Allow-Headers": "Content-Type, X-Apex-Codex-Token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin"
  };
}

function matchesToken(value: string | string[] | undefined, expected: string) {
  const received = Array.isArray(value) ? value[0] : value;

  if (!received) {
    return false;
  }

  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);

  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

async function readJsonBody(request: IncomingMessage): Promise<{ packet?: unknown }> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;

    if (totalBytes > MAX_PACKET_BYTES) {
      throw new PayloadTooLargeError();
    }

    chunks.push(buffer);
  }

  const text = Buffer.concat(chunks).toString("utf8");

  if (!text.trim()) {
    return {};
  }

  return JSON.parse(text) as { packet?: unknown };
}

function writeJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> | null = {}
) {
  response.writeHead(status, {
    ...(headers ?? {}),
    "Content-Type": "application/json"
  });

  if (status === 204) {
    response.end();
    return;
  }

  response.end(JSON.stringify(body));
}

function publicErrorMessage(error: unknown) {
  if (error instanceof PayloadTooLargeError) {
    return "Review packet is too large.";
  }

  if (error instanceof SyntaxError) {
    return "Request body must be valid JSON.";
  }

  if (error instanceof Error && error.name === "AbortError") {
    return "Codex review timed out.";
  }

  return "Codex review failed.";
}

class PayloadTooLargeError extends Error {}

function main() {
  const config = readCodexReviewSidecarConfig();
  const server = createCodexReviewSidecar(config);

  server.listen(config.port, "127.0.0.1", () => {
    console.log(`Codex review sidecar listening on http://127.0.0.1:${config.port}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
