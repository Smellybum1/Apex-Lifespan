import {
  isLocalIngestionWriteMethod,
  LOCAL_INGESTION_WRITE_HEADER,
  LOCAL_INGESTION_WRITE_HEADER_VALUE
} from "@/lib/local-ingestion-security";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const LOCAL_INGESTION_FORBIDDEN_MESSAGE =
  "Local ingestion controls are only available from localhost.";

export function guardLocalIngestionRequest(request: Request) {
  return isLocalIngestionRequest(request) ? null : localIngestionForbiddenResponse();
}

export function localIngestionForbiddenResponse() {
  return Response.json(
    {
      error: LOCAL_INGESTION_FORBIDDEN_MESSAGE
    },
    {
      headers: {
        "Cache-Control": "no-store"
      },
      status: 403
    }
  );
}

export function isLocalIngestionRequest(request: Request) {
  if (process.env.VERCEL) {
    return false;
  }

  const url = safeRequestUrl(request);

  if (!url) {
    return false;
  }

  const urlHostname = localHostName(url.hostname);
  const headerHostname = localHostName(request.headers.get("host"));
  const forwardedHostname = localHostName(request.headers.get("x-forwarded-host"));

  if (
    !LOCAL_HOSTS.has(urlHostname) ||
    (headerHostname && !LOCAL_HOSTS.has(headerHostname)) ||
    (forwardedHostname && !LOCAL_HOSTS.has(forwardedHostname))
  ) {
    return false;
  }

  if (!isLocalIngestionWriteMethod(request.method)) {
    return true;
  }

  return isSafeLocalIngestionWrite(request, url);
}

function isSafeLocalIngestionWrite(request: Request, url: URL) {
  if (
    request.headers.get(LOCAL_INGESTION_WRITE_HEADER)?.trim() !==
    LOCAL_INGESTION_WRITE_HEADER_VALUE
  ) {
    return false;
  }

  if (!isSameOrEquivalentLocalOriginHeader(request.headers.get("origin"), url)) {
    return false;
  }

  if (!isSameOrEquivalentLocalOriginHeader(request.headers.get("referer"), url)) {
    return false;
  }

  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();

  return !fetchSite || fetchSite === "same-origin";
}

function safeRequestUrl(request: Request) {
  try {
    return new URL(request.url);
  } catch {
    return null;
  }
}

function isSameOrEquivalentLocalOriginHeader(value: string | null, expectedUrl: URL) {
  if (!value) {
    return true;
  }

  try {
    const actualUrl = new URL(value);

    return (
      actualUrl.origin === expectedUrl.origin ||
      isEquivalentLocalOrigin(actualUrl, expectedUrl)
    );
  } catch {
    return false;
  }
}

function isEquivalentLocalOrigin(actualUrl: URL, expectedUrl: URL) {
  return (
    actualUrl.protocol === expectedUrl.protocol &&
    localOriginPort(actualUrl) === localOriginPort(expectedUrl) &&
    LOCAL_HOSTS.has(localHostName(actualUrl.hostname)) &&
    LOCAL_HOSTS.has(localHostName(expectedUrl.hostname))
  );
}

function localOriginPort(url: URL) {
  if (url.port) {
    return url.port;
  }

  if (url.protocol === "http:") {
    return "80";
  }

  if (url.protocol === "https:") {
    return "443";
  }

  return "";
}

function localHostName(value: string | null) {
  const trimmed = (value ?? "").split(",")[0]?.trim().toLowerCase() ?? "";

  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("[")) {
    const closingIndex = trimmed.indexOf("]");

    return closingIndex > 0 ? trimmed.slice(1, closingIndex) : trimmed;
  }

  return trimmed.split(":")[0] ?? trimmed;
}
