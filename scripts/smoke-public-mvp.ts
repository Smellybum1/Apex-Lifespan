import { pathToFileURL } from "node:url";

const DEFAULT_TIMEOUT_MS = 15000;

type JsonObject = Record<string, unknown>;
type SmokeLogger = Pick<Console, "log">;

type RouteSmoke = {
  path: string;
  label: string;
  expectedStatus: number;
  validateJson: (body: JsonObject) => void;
};

type PageSmoke = {
  path: string;
  label: string;
  requiredAnyText?: Array<{
    label: string;
    values: string[];
  }>;
  requiredText: string[];
};

const pageSmokes: PageSmoke[] = [
  {
    path: "/",
    label: "Homepage",
    requiredText: [
      "Apex Lifespan",
      "AU",
      "TGA",
      "Unreviewed AI draft",
      "Source packet",
      "Live PubMed results are unreviewed citation leads",
      "Registry records are research leads, not proof of benefit",
      'href="/privacy"',
      'href="/terms"'
    ],
    requiredAnyText: [
      {
        label: "data source badge",
        values: ["Seed fallback", "Database-backed"]
      }
    ]
  },
  {
    path: "/privacy",
    label: "Privacy page",
    requiredText: [
      "Privacy",
      "public evidence dashboard",
      "Public routes are read-only",
      "Live Source Searches",
      "Browser Storage"
    ]
  },
  {
    path: "/terms",
    label: "Terms page",
    requiredText: [
      "Terms",
      "No Medical Advice",
      "Evidence Is Provisional",
      "Australia/TGA Context",
      "Public Read-Only Surface"
    ]
  }
];

const routeSmokes: RouteSmoke[] = [
  {
    path: "/api/health",
    label: "Health endpoint",
    expectedStatus: 200,
    validateJson: (body) => {
      expectEqual(body.status, "ok", "Health status");
      expectEqual(body.service, "apex-lifespan", "Health service");
      expectEqual(body.surface, "public-read-only", "Health surface");
      expectObject(body.checks, "Health checks");
      expectEqual((body.checks as JsonObject).database, "not_checked", "Health database check");
    }
  },
  {
    path: "/api/pubmed/search?term=creatine&retmax=1",
    label: "PubMed live preview",
    expectedStatus: 200,
    validateJson: (body) => {
      expectEqual(body.query, "creatine", "PubMed query");
      expectArray(body.articles, "PubMed articles");
      expectString(body.source, "PubMed source");
    }
  },
  {
    path: "/api/trials/search?term=creatine&pageSize=1",
    label: "ClinicalTrials.gov live preview",
    expectedStatus: 200,
    validateJson: (body) => {
      expectEqual(body.query, "creatine", "ClinicalTrials.gov query");
      expectArray(body.studies, "ClinicalTrials.gov studies");
      expectString(body.source, "ClinicalTrials.gov source");
    }
  },
  {
    path: "/api/pubmed/search?term=injection%20reconstitution%20vials%20sourcing",
    label: "PubMed invalid-term guard",
    expectedStatus: 400,
    validateJson: (body) => {
      expectEqual(
        body.error,
        "Term query parameter must include citation-oriented search terms.",
        "PubMed invalid-term error"
      );
    }
  },
  {
    path: `/api/trials/search?term=${"a".repeat(241)}`,
    label: "ClinicalTrials.gov invalid-term guard",
    expectedStatus: 400,
    validateJson: (body) => {
      expectEqual(
        body.error,
        "Term query parameter must be 240 characters or fewer.",
        "ClinicalTrials.gov invalid-term error"
      );
    }
  }
];

export async function runPublicMvpSmoke(
  rawBaseUrl: string,
  logger: SmokeLogger = console
) {
  const baseUrl = readBaseUrl([rawBaseUrl]);

  logger.log(`Smoking public MVP at ${baseUrl.href}`);
  for (const smoke of pageSmokes) {
    await smokePage(baseUrl, smoke, logger);
  }

  await smokeAnonymousOperatorBoundary(baseUrl, logger);

  for (const smoke of routeSmokes) {
    await smokeRoute(baseUrl, smoke, logger);
  }

  logger.log("Public MVP smoke passed.");
}

async function main() {
  const rawBaseUrl = process.argv.slice(2)[0]?.trim();

  if (!rawBaseUrl) {
    throw new Error("Usage: npm run smoke:public-mvp -- <public-or-local-base-url>");
  }

  await runPublicMvpSmoke(rawBaseUrl);
}

function readBaseUrl(args: string[]) {
  const rawUrl = args[0]?.trim();

  if (!rawUrl) {
    throw new Error("Usage: npm run smoke:public-mvp -- <public-or-local-base-url>");
  }

  const url = new URL(rawUrl);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Smoke base URL must start with http:// or https://.");
  }

  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";

  return url;
}

async function smokePage(baseUrl: URL, smoke: PageSmoke, logger: SmokeLogger) {
  const response = await fetchWithTimeout(new URL(smoke.path, baseUrl));

  expectEqual(response.status, 200, `${smoke.label} status`);
  expectSecurityHeaders(response, smoke.label);

  const html = await response.text();

  for (const text of smoke.requiredText) {
    if (!html.includes(text)) {
      throw new Error(`${smoke.label} is missing expected public text: ${text}`);
    }
  }

  for (const requirement of smoke.requiredAnyText ?? []) {
    if (!requirement.values.some((text) => html.includes(text))) {
      throw new Error(
        `${smoke.label} is missing expected ${requirement.label}: ${requirement.values.join(" or ")}`
      );
    }
  }

  logger.log(`[ok] ${smoke.label}`);
}

async function smokeAnonymousOperatorBoundary(baseUrl: URL, logger: SmokeLogger) {
  const label = "Operator anonymous boundary";
  const response = await fetchWithTimeout(new URL("/operator", baseUrl));

  expectEqual(response.status, 200, `${label} status`);
  expectSecurityHeaders(response, label);

  const html = await response.text();
  const closedStates = ["Operator auth unavailable", "Operator access required"];

  if (!closedStates.some((text) => html.includes(text))) {
    throw new Error(`${label} must show a closed unauthenticated state.`);
  }

  for (const text of [
    "Review console",
    "Candidate review queue",
    "Promotion readiness",
    "Audit trail",
    "pending candidates loaded",
    "Sign out"
  ]) {
    if (html.includes(text)) {
      throw new Error(`${label} exposed authenticated operator content: ${text}`);
    }
  }

  logger.log(`[ok] ${label}`);
}

async function smokeRoute(baseUrl: URL, smoke: RouteSmoke, logger: SmokeLogger) {
  const response = await fetchWithTimeout(new URL(smoke.path, baseUrl));

  expectEqual(response.status, smoke.expectedStatus, `${smoke.label} status`);
  expectHeaderIncludes(response, "Cache-Control", "no-store", smoke.label);
  expectHeaderIncludes(response, "X-Robots-Tag", "noindex", smoke.label);

  const body = await readJsonObject(response, smoke.label);
  smoke.validateJson(body);

  logger.log(`[ok] ${smoke.label}`);
}

async function fetchWithTimeout(url: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    return await fetch(url, {
      signal: controller.signal,
      cache: "no-store"
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readJsonObject(response: Response, label: string): Promise<JsonObject> {
  const body: unknown = await response.json();

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error(`${label} response JSON must be an object.`);
  }

  return body as JsonObject;
}

function expectHeaderIncludes(response: Response, headerName: string, value: string, label: string) {
  const headerValue = response.headers.get(headerName);

  if (!headerValue?.toLowerCase().includes(value.toLowerCase())) {
    throw new Error(`${label} must include ${headerName}: ${value}.`);
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

function expectArray(value: unknown, label: string) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
}

function expectObject(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function expectString(value: unknown, label: string) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
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
    console.error(`Public MVP smoke failed: ${message}`);
    process.exitCode = 1;
  });
}
