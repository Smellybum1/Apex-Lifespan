import {
  getLocalIdentityResolutionQueue,
  isLocalIdentityResolutionAutomationInput,
  runLocalIdentityResolutionAutomation,
  recordLocalIdentityResolutionAction
} from "@/lib/data/local-ingestion-control";
import { guardLocalIngestionRequest } from "@/lib/data/local-ingestion-route-guard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const forbiddenResponse = guardLocalIngestionRequest(request);

  if (forbiddenResponse) {
    return forbiddenResponse;
  }

  const searchParams = new URL(request.url).searchParams;

  return Response.json(
    await getLocalIdentityResolutionQueue({
      limit: searchParams.get("limit")
    })
  );
}

export async function POST(request: Request) {
  const forbiddenResponse = guardLocalIngestionRequest(request);

  if (forbiddenResponse) {
    return forbiddenResponse;
  }

  try {
    const input = await request.json();

    if (isLocalIdentityResolutionAutomationInput(input)) {
      return Response.json(await runLocalIdentityResolutionAutomation(input));
    }

    return Response.json(await recordLocalIdentityResolutionAction(input));
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Identity resolution action failed."
      },
      {
        status: 400
      }
    );
  }
}
