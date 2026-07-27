import { runLocalClaimExpansion } from "@/lib/data/local-claim-expansion";
import { guardLocalIngestionRequest } from "@/lib/data/local-ingestion-route-guard";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const forbiddenResponse = guardLocalIngestionRequest(request);

  if (forbiddenResponse) {
    return forbiddenResponse;
  }

  try {
    return Response.json(await runLocalClaimExpansion(await request.json()));
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Claim expansion failed."
      },
      {
        status: 400
      }
    );
  }
}
