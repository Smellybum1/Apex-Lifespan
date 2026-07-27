"use client";

import { cn } from "@/lib/utils";
import type {
  LocalAcceptedCandidateProcessingStatusResponse,
  LocalBenefitDiscoveryQueueResponse,
  LocalCandidateReviewBucket,
  LocalCandidateReviewResponse,
  LocalIdentityResolutionQueueResponse,
  LocalIngestionStatusReadout
} from "@/components/local-ingestion/types";

export type LocalNextAction = {
  detail: string;
  label: string;
  tone: "info" | "ready" | "warn";
};

export function LocalNextActionStrip({ action }: { action: LocalNextAction }) {
  return (
    <div
      className={cn(
        "mt-3 flex flex-col gap-1 rounded-md border px-3 py-2 text-xs leading-5 sm:flex-row sm:items-center sm:justify-between",
        localNextActionToneClassName(action.tone)
      )}
    >
      <span className="font-semibold">{action.label}</span>
      <span className="text-slate-700">{action.detail}</span>
    </div>
  );
}

export function localIngestionNextAction({
  active,
  busy,
  status
}: {
  active: boolean;
  busy: boolean;
  status: LocalIngestionStatusReadout | null;
}): LocalNextAction {
  if (!status) {
    return {
      detail: "Load the local ingestion readout before choosing the next step.",
      label: "Refresh local status",
      tone: "info"
    };
  }

  const queued = status.queue.counts.QUEUED ?? 0;
  const running = status.queue.counts.RUNNING ?? 0;
  const pending = status.candidates.counts.PENDING_REVIEW ?? 0;
  const accepted = status.candidates.counts.ACCEPTED ?? 0;

  if (active || busy || running > 0) {
    return {
      detail: `${queued.toLocaleString()} queued, ${running.toLocaleString()} running.`,
      label: "Let ingestion continue",
      tone: "ready"
    };
  }

  if (queued > 0) {
    return {
      detail: `${queued.toLocaleString()} source search job(s) are waiting.`,
      label: "Start ingestion",
      tone: "ready"
    };
  }

  if (pending > 0) {
    return {
      detail: `${pending.toLocaleString()} candidate(s) are waiting in review.`,
      label: "Review candidates",
      tone: "warn"
    };
  }

  if (accepted > 0) {
    return {
      detail: `${accepted.toLocaleString()} accepted candidate(s) can feed processing and discovery.`,
      label: "Process accepted",
      tone: "ready"
    };
  }

  return {
    detail: `${status.candidates.total.toLocaleString()} source candidate(s) are in the local database.`,
    label: "Run discovery when ready",
    tone: "info"
  };
}

export function candidateReviewNextAction({
  bucket,
  review
}: {
  bucket: LocalCandidateReviewBucket;
  review: LocalCandidateReviewResponse | null;
}): LocalNextAction {
  if (!review) {
    return {
      detail: "Load candidate counts before bulk review.",
      label: "Refresh candidates",
      tone: "info"
    };
  }

  if (review.counts.likelyUseful > 0) {
    return {
      detail: `${review.counts.likelyUseful.toLocaleString()} likely useful candidate(s) can be accepted in bulk.`,
      label: "Accept likely useful",
      tone: "ready"
    };
  }

  if (review.counts.likelyNoise > 0) {
    return {
      detail: `${review.counts.likelyNoise.toLocaleString()} likely-noise candidate(s) can be rejected.`,
      label: "Reject not useful",
      tone: "warn"
    };
  }

  if (review.counts.maybeUseful > 0) {
    return {
      detail: `${review.counts.maybeUseful.toLocaleString()} maybe-useful candidate(s) remain for manual review.`,
      label: "Review maybe useful",
      tone: "info"
    };
  }

  if (review.counts.all > 0) {
    return {
      detail: `Current ${bucket.replace(/-/g, " ")} filter has rows; adjust filters if needed.`,
      label: "Review current queue",
      tone: "info"
    };
  }

  return {
    detail: "No pending candidates are visible in this queue.",
    label: "Run ingestion",
    tone: "info"
  };
}

export function acceptedCandidateProcessingNextAction(
  status: LocalAcceptedCandidateProcessingStatusResponse | null
): LocalNextAction {
  if (!status) {
    return {
      detail: "Load accepted candidate processor status.",
      label: "Refresh processor",
      tone: "info"
    };
  }

  if (status.counts.unprocessed > 0) {
    return {
      detail: `${status.counts.unprocessed.toLocaleString()} accepted candidate(s) still need processing.`,
      label: "Process accepted",
      tone: "ready"
    };
  }

  if (status.counts.needsClaim > 0) {
    return {
      detail: `${status.counts.needsClaim.toLocaleString()} processed candidate(s) need benefit claim review.`,
      label: "Build claims",
      tone: "warn"
    };
  }

  return {
    detail: `${status.counts.processed.toLocaleString()} accepted candidate(s) processed.`,
    label: "Processor caught up",
    tone: "info"
  };
}

export function benefitDiscoveryNextAction(
  queue: LocalBenefitDiscoveryQueueResponse | null
): LocalNextAction {
  if (!queue) {
    return {
      detail: "Load benefit clusters before auto-build or manual review.",
      label: "Refresh benefit queue",
      tone: "info"
    };
  }

  if (queue.counts.mismatchCandidates > 0) {
    return {
      detail: `${queue.counts.mismatchCandidates.toLocaleString()} candidate(s) need identity resolution first.`,
      label: "Resolve identities",
      tone: "warn"
    };
  }

  if (queue.counts.activeClusters > 0) {
    return {
      detail: `${queue.counts.activeClusters.toLocaleString()} cluster(s) are ready for preview or manual action.`,
      label: "Preview automation",
      tone: "ready"
    };
  }

  if (queue.counts.parkedClusters > 0) {
    return {
      detail: `${queue.counts.parkedClusters.toLocaleString()} lead(s) are parked for later source review.`,
      label: "Backlog parked",
      tone: "info"
    };
  }

  return {
    detail: "No active clusters are ready yet.",
    label: "Process accepted",
    tone: "info"
  };
}

export function identityResolutionNextAction(
  queue: LocalIdentityResolutionQueueResponse | null
): LocalNextAction {
  if (!queue) {
    return {
      detail: "Load identity rows before claim automation.",
      label: "Refresh identities",
      tone: "info"
    };
  }

  if (queue.counts.blockedCandidates > 0) {
    return {
      detail: `${queue.counts.blockedCandidates.toLocaleString()} accepted source(s) are blocked on supplement identity.`,
      label: "Resolve identities",
      tone: "warn"
    };
  }

  return {
    detail: "No identity blockers are waiting.",
    label: "Identity clear",
    tone: "ready"
  };
}

function localNextActionToneClassName(tone: LocalNextAction["tone"]) {
  switch (tone) {
    case "info":
      return "border-line bg-white text-slate-700";
    case "ready":
      return "border-signal/25 bg-blue-50 text-signal";
    case "warn":
      return "border-amberline/30 bg-amber-50 text-amberline";
  }
}
