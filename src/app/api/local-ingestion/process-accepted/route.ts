import {
  getLocalAcceptedCandidateProcessingStatus,
  runLocalAcceptedCandidateProcessingBatch
} from "@/lib/data/local-ingestion-control";
import { guardLocalIngestionRequest } from "@/lib/data/local-ingestion-route-guard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const forbiddenResponse = guardLocalIngestionRequest(request);

  if (forbiddenResponse) {
    return forbiddenResponse;
  }

  return Response.json(await getLocalAcceptedCandidateProcessingStatus());
}

export async function POST(request: Request) {
  const forbiddenResponse = guardLocalIngestionRequest(request);

  if (forbiddenResponse) {
    return forbiddenResponse;
  }

  try {
    return Response.json(await runLocalAcceptedCandidateProcessingBatch(await request.json()));
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Accepted candidate processing failed."
      },
      {
        status: 400
      }
    );
  }
}
