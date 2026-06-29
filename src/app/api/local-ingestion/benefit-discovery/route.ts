import {
  getLocalBenefitDiscoveryQueue,
  isLocalBenefitDiscoveryAutomationInput,
  recordLocalBenefitDiscoveryAction,
  runLocalBenefitDiscoveryAutomation
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
    await getLocalBenefitDiscoveryQueue({
      includeDecided: searchParams.get("includeDecided"),
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

    if (isLocalBenefitDiscoveryAutomationInput(input)) {
      return Response.json(await runLocalBenefitDiscoveryAutomation(input));
    }

    return Response.json(await recordLocalBenefitDiscoveryAction(input));
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Benefit discovery action failed."
      },
      {
        status: 400
      }
    );
  }
}
