import { startLocalIngestionSynonymDiscovery } from "@/lib/data/local-ingestion-control";
import { guardLocalIngestionRequest } from "@/lib/data/local-ingestion-route-guard";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const forbiddenResponse = guardLocalIngestionRequest(request);

  if (forbiddenResponse) {
    return forbiddenResponse;
  }

  return Response.json(await startLocalIngestionSynonymDiscovery());
}
