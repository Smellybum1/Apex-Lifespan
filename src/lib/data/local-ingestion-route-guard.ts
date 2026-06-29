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

  if (!isSameOriginHeader(request.headers.get("origin"), url.origin)) {
    return false;
  }

  if (!isSameOriginHeader(request.headers.get("referer"), url.origin)) {
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

function isSameOriginHeader(value: string | null, expectedOrigin: string) {
  if (!value) {
    return true;
  }

  try {
    return new URL(value).origin === expectedOrigin;
  } catch {
    return false;
  }
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
