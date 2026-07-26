import { runLocalSourceWorkRepair } from "@/lib/data/local-source-work-repair";
import { guardLocalIngestionRequest } from "@/lib/data/local-ingestion-route-guard";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const forbiddenResponse = guardLocalIngestionRequest(request);

  if (forbiddenResponse) {
    return forbiddenResponse;
  }

  try {
    return Response.json(await runLocalSourceWorkRepair(await request.json()));
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Source-work repair failed."
      },
      {
        status: 400
      }
    );
  }
}
