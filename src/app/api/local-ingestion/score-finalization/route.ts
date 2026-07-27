import { runLocalScoreFinalization } from "@/lib/data/local-score-finalization";
import { guardLocalIngestionRequest } from "@/lib/data/local-ingestion-route-guard";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const forbiddenResponse = guardLocalIngestionRequest(request);

  if (forbiddenResponse) {
    return forbiddenResponse;
  }

  try {
    return Response.json(await runLocalScoreFinalization(await request.json()));
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Score-ready finalization failed."
      },
      {
        status: 400
      }
    );
  }
}
