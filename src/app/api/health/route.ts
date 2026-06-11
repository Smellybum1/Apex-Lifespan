export const dynamic = "force-dynamic";

const HEALTH_RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex"
} satisfies HeadersInit;

export async function GET() {
  return Response.json(
    {
      checks: {
        database: "not_checked"
      },
      service: "apex-lifespan",
      status: "ok",
      surface: "public-read-only"
    },
    {
      headers: HEALTH_RESPONSE_HEADERS
    }
  );
}
