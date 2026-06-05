import { searchPubMed } from "@/lib/integrations/pubmed";
import {
  LIVE_SOURCE_RESPONSE_HEADERS,
  parseLiveSourceSearchRequest,
  publicLiveSourceError
} from "@/lib/live-source-request";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const searchRequest = parseLiveSourceSearchRequest(request.url, {
    defaultLimit: 10,
    limitParam: "retmax"
  });

  if (!searchRequest.ok) {
    return Response.json(
      { error: searchRequest.error },
      { headers: LIVE_SOURCE_RESPONSE_HEADERS, status: searchRequest.status }
    );
  }

  try {
    const result = await searchPubMed(searchRequest.term, searchRequest.limit);
    return Response.json(result, { headers: LIVE_SOURCE_RESPONSE_HEADERS });
  } catch {
    return Response.json(
      {
        error: publicLiveSourceError("PubMed")
      },
      { headers: LIVE_SOURCE_RESPONSE_HEADERS, status: 502 }
    );
  }
}
