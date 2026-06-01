import { searchClinicalTrials } from "@/lib/integrations/clinical-trials";
import { parseLiveSourceSearchRequest } from "@/lib/live-source-request";

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
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "ClinicalTrials.gov search failed."
      },
      { status: 502 }
    );
  }
}
