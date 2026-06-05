import { searchClinicalTrials } from "@/lib/integrations/clinical-trials";
import { parseLiveSourceSearchRequest, publicLiveSourceError } from "@/lib/live-source-request";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const searchRequest = parseLiveSourceSearchRequest(request.url, {
    defaultLimit: 10,
    limitParam: "pageSize"
  });

  if (!searchRequest.ok) {
    return Response.json({ error: searchRequest.error }, { status: searchRequest.status });
  }

  try {
    const result = await searchClinicalTrials(searchRequest.term, searchRequest.limit);
    return Response.json(result);
  } catch {
    return Response.json(
      {
        error: publicLiveSourceError("ClinicalTrials.gov")
      },
      { status: 502 }
    );
  }
}
