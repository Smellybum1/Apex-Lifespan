import { pathToFileURL } from "node:url";

const DEFAULT_TIMEOUT_MS = 15000;

type OperatorSmokeMode = "auth-required" | "auth-unavailable" | "closed";
type SmokeLogger = Pick<Console, "log">;

export interface OperatorSmokeOptions {
  mode?: OperatorSmokeMode;
}

const CLOSED_STATE_TEXT: Record<Exclude<OperatorSmokeMode, "closed">, string> = {
  "auth-required": "Operator access required",
  "auth-unavailable": "Operator auth unavailable"
};

const AUTHENTICATED_CONTENT = [
  "Review console",
  "Candidate review queue",
  "Promotion readiness",
  "Audit trail",
  "pending candidates loaded",
  "Sign out",
  "Accept",
  "Reject",
  "Link Claim",
  "Save Extraction",
  "Promote"
];

export async function runOperatorSmoke(
  rawBaseUrl: string,
  options: OperatorSmokeOptions = {},
  logger: SmokeLogger = console
) {
  const baseUrl = readBaseUrl(rawBaseUrl);
  const mode = options.mode ?? "closed";
  const response = await fetchWithTimeout(new URL("/operator", baseUrl));

  expectEqual(response.status, 200, "Operator page status");
  expectSecurityHeaders(response, "Operator page");

  const html = await response.text();
  const allowedClosedStates = Object.values(CLOSED_STATE_TEXT);
  const expectedClosedState = mode === "closed" ? undefined : CLOSED_STATE_TEXT[mode];

  if (expectedClosedState) {
    if (!html.includes(expectedClosedState)) {
      throw new Error(`Operator page must show closed state: ${expectedClosedState}.`);
    }
  } else if (!allowedClosedStates.some((text) => html.includes(text))) {
    throw new Error("Operator page must show a closed unauthenticated state.");
  }

  for (const text of AUTHENTICATED_CONTENT) {
    if (html.includes(text)) {
      throw new Error(`Operator page exposed authenticated content: ${text}`);
    }
  }

  logger.log(`[ok] Operator anonymous boundary (${mode})`);
}

async function main() {
  const args = process.argv.slice(2);
  const rawBaseUrl = args.find((arg) => !arg.startsWith("--"))?.trim();

  if (!rawBaseUrl) {
    throw new Error(
      "Usage: npm run operator:smoke -- <public-or-local-base-url> [--expect-auth-required|--expect-auth-unavailable]"
    );
  }

  await runOperatorSmoke(rawBaseUrl, {
    mode: readMode(args)
  });
}

function readMode(args: string[]): OperatorSmokeMode {
  const authRequired = args.includes("--expect-auth-required");
  const authUnavailable = args.includes("--expect-auth-unavailable");

  if (authRequired && authUnavailable) {
    throw new Error("Choose only one expected operator closed state.");
  }

  if (authRequired) {
    return "auth-required";
  }

  if (authUnavailable) {
    return "auth-unavailable";
  }

  return "closed";
}

function readBaseUrl(rawUrl: string) {
  const url = new URL(rawUrl);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Operator smoke base URL must start with http:// or https://.");
  }

  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";

  return url;
}

async function fetchWithTimeout(url: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    return await fetch(url, {
      cache: "no-store",
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function expectSecurityHeaders(response: Response, label: string) {
  expectHeaderIncludes(response, "Content-Security-Policy", "frame-ancestors 'none'", label);
  expectHeaderIncludes(response, "Referrer-Policy", "strict-origin-when-cross-origin", label);
  expectHeaderIncludes(response, "Strict-Transport-Security", "max-age=31536000", label);
  expectHeaderIncludes(response, "X-Content-Type-Options", "nosniff", label);
  expectHeaderIncludes(response, "X-Frame-Options", "DENY", label);
  expectHeaderIncludes(response, "Permissions-Policy", "camera=()", label);
}

function expectHeaderIncludes(response: Response, headerName: string, value: string, label: string) {
  const headerValue = response.headers.get(headerName);

  if (!headerValue?.toLowerCase().includes(value.toLowerCase())) {
    throw new Error(`${label} must include ${headerName}: ${value}.`);
  }
}

function expectEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label} expected ${String(expected)} but received ${String(actual)}.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Operator smoke failed: ${message}`);
    process.exitCode = 1;
  });
}
