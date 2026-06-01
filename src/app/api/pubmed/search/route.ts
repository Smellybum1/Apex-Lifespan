import { searchPubMed } from "@/lib/integrations/pubmed";
import { parseLiveSourceSearchRequest } from "@/lib/live-source-request";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const searchRequest = parseLiveSourceSearchRequest(request.url, {
    defaultLimit: 10,
    limitParam: "retmax"
  });

  if (!searchRequest.ok) {
    return Response.json({ error: searchRequest.error }, { status: searchRequest.status });
  }

  try {
    const result = await searchPubMed(searchRequest.term, searchRequest.limit);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "PubMed search failed."
      },
      { status: 502 }
    );
  }
}
