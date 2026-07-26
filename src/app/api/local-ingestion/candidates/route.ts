import {
  getLocalCandidateReviewWorkbench,
  isLocalCandidateReviewAutomationInput,
  isLocalCandidateReviewSignalApplyInput,
  isLocalCandidateReviewSignalMiningInput,
  recordLocalCandidateReviewBulkDecision,
  recordLocalCandidateReviewDecision,
  runLocalCandidateReviewAutomation,
  runLocalCandidateReviewSignalApply,
  runLocalCandidateReviewSignalMining
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
    await getLocalCandidateReviewWorkbench({
      bucket: searchParams.get("bucket"),
      interventionId: searchParams.get("interventionId"),
      limit: searchParams.get("limit"),
      q: searchParams.get("q"),
      source: searchParams.get("source"),
      studyFilter: searchParams.get("studyFilter")
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

    if (isLocalCandidateReviewAutomationInput(input)) {
      return Response.json(await runLocalCandidateReviewAutomation(input));
    }

    if (isLocalCandidateReviewSignalMiningInput(input)) {
      return Response.json(await runLocalCandidateReviewSignalMining(input));
    }

    if (isLocalCandidateReviewSignalApplyInput(input)) {
      return Response.json(await runLocalCandidateReviewSignalApply(input));
    }

    if (hasBulkAction(input)) {
      return Response.json(await recordLocalCandidateReviewBulkDecision(input));
    }

    // Single-candidate decision from the dashboard: a person read this one row.
    return Response.json(await recordLocalCandidateReviewDecision(input, "human"));
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Candidate review action failed."
      },
      {
        status: 400
      }
    );
  }
}

function hasBulkAction(input: unknown): input is { bulkAction: unknown } {
  return Boolean(input && typeof input === "object" && "bulkAction" in input);
}
