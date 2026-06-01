import { searchClinicalTrials } from "@/lib/integrations/clinical-trials";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const term = url.searchParams.get("term")?.trim();

  if (!term) {
    return Response.json({ error: "Missing term query parameter." }, { status: 400 });
  }

  try {
    const result = await searchClinicalTrials(term);
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
