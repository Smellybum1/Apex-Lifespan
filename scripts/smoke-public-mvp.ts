const DEFAULT_TIMEOUT_MS = 15000;

type JsonObject = Record<string, unknown>;

type RouteSmoke = {
  path: string;
  label: string;
  expectedStatus: number;
  validateJson: (body: JsonObject) => void;
};

const routeSmokes: RouteSmoke[] = [
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

async function main() {
  const baseUrl = readBaseUrl(process.argv.slice(2));

  console.log(`Smoking public MVP at ${baseUrl.href}`);
  await smokeHomepage(baseUrl);

  for (const smoke of routeSmokes) {
    await smokeRoute(baseUrl, smoke);
  }

  console.log("Public MVP smoke passed.");
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

async function smokeHomepage(baseUrl: URL) {
  const response = await fetchWithTimeout(new URL("/", baseUrl));

  expectEqual(response.status, 200, "Homepage status");

  const html = await response.text();
  const requiredText = [
    "Apex Lifespan",
    "AU",
    "TGA",
    "Seed fallback",
    "Unreviewed AI draft",
    "Source packet",
    "Live PubMed results are unreviewed citation leads",
    "Registry records are research leads, not proof of benefit"
  ];

  for (const text of requiredText) {
    if (!html.includes(text)) {
      throw new Error(`Homepage is missing expected public-demo text: ${text}`);
    }
  }

  console.log("[ok] Homepage renders public demo caveats.");
}

async function smokeRoute(baseUrl: URL, smoke: RouteSmoke) {
  const response = await fetchWithTimeout(new URL(smoke.path, baseUrl));

  expectEqual(response.status, smoke.expectedStatus, `${smoke.label} status`);
  expectHeaderIncludes(response, "Cache-Control", "no-store", smoke.label);
  expectHeaderIncludes(response, "X-Robots-Tag", "noindex", smoke.label);

  const body = await readJsonObject(response, smoke.label);
  smoke.validateJson(body);

  console.log(`[ok] ${smoke.label}`);
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

function expectArray(value: unknown, label: string) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
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

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Public MVP smoke failed: ${message}`);
  process.exitCode = 1;
});
