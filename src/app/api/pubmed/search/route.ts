import { searchPubMed } from "@/lib/integrations/pubmed";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const term = url.searchParams.get("term")?.trim();
  const retmax = Number(url.searchParams.get("retmax") ?? 10);

  if (!term) {
    return Response.json({ error: "Missing term query parameter." }, { status: 400 });
  }

  try {
    const result = await searchPubMed(term, retmax);
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
