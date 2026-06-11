import {
  listSourceCandidateCurationHandoff,
  listSourceCandidateReviewQueue,
  type SourceCandidateCurationStatus
} from "@/lib/data/source-candidates";
import type { SourceCandidate } from "@/lib/types";

export interface OperatorReviewQueueRow {
  curationStatus?: SourceCandidateCurationStatus["status"];
  dedupeKey: string;
  nextAction?: string;
  publicSourcePacketReady?: boolean;
  source: SourceCandidate["source"];
  title: string;
  triageReasons: string[];
  triageScore: number;
  url: string;
}

export interface OperatorReviewQueueSnapshot {
  pendingCount: number;
  rows: OperatorReviewQueueRow[];
}

export async function getOperatorReviewQueueSnapshot(
  limit = 10
): Promise<OperatorReviewQueueSnapshot> {
  const [candidates, curationStatuses] = await Promise.all([
    listSourceCandidateReviewQueue({ limit }),
    listSourceCandidateCurationHandoff({ limit })
  ]);
  const curationByKey = new Map(
    curationStatuses.map((status) => [status.candidate.dedupeKey, status])
  );
  const rows = candidates.map((candidate) =>
    operatorReviewQueueRow(candidate, curationByKey.get(candidate.dedupeKey))
  );

  return {
    pendingCount: rows.length,
    rows
  };
}

function operatorReviewQueueRow(
  candidate: SourceCandidate,
  curationStatus?: SourceCandidateCurationStatus
): OperatorReviewQueueRow {
  return {
    curationStatus: curationStatus?.status,
    dedupeKey: candidate.dedupeKey,
    nextAction: curationStatus?.nextAction,
    publicSourcePacketReady: curationStatus?.publicSourcePacketReady,
    source: candidate.source,
    title: candidate.title,
    triageReasons: candidate.triageReasons,
    triageScore: candidate.triageScore,
    url: candidate.url
  };
}
