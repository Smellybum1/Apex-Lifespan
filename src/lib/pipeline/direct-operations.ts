import type { SourceKind as DbSourceKind } from "@prisma/client";

import type { LocalIngestionSource } from "@/components/local-ingestion/types";
import { runLocalClaimExpansion } from "@/lib/data/local-claim-expansion";
import {
  getLocalAcceptedCandidateProcessingStatus,
  getLocalBenefitDiscoveryQueue,
  getLocalIngestionStatus,
  recordLocalCandidateReviewBulkDecision,
  runLocalAcceptedCandidateProcessingBatch,
  runLocalBenefitDiscoveryAutomation,
  runLocalCandidateReviewAutomation,
  runLocalIdentityResolutionAutomation,
  runLocalIngestionBatch,
  startLocalIngestionDiscovery,
  startLocalIngestionSynonymDiscovery
} from "@/lib/data/local-ingestion-control";
import { runLocalScoreFinalization } from "@/lib/data/local-score-finalization";
import { runLocalSourceWorkRepair } from "@/lib/data/local-source-work-repair";
import type { LocalUpdatePipelineOperations } from "@/lib/pipeline/types";

/**
 * The data layer types every `source` as the full Prisma `SourceKind`, while
 * the component response types narrow it to the two sources local ingestion
 * actually queries. The routes never reshape anything — the dashboard's fetch
 * client asserted the narrow type when it parsed the JSON, so in-process the
 * same assertion has to happen here. Mapping the type instead of casting the
 * whole readout keeps the rest of each shape structurally checked.
 */
type NarrowLocalIngestionSource<TValue> = TValue extends DbSourceKind
  ? LocalIngestionSource
  : TValue extends Array<infer TItem>
    ? Array<NarrowLocalIngestionSource<TItem>>
    : TValue extends object
      ? { [TKey in keyof TValue]: NarrowLocalIngestionSource<TValue[TKey]> }
      : TValue;

async function narrowLocalIngestionSources<TReadout>(
  readout: Promise<TReadout>
): Promise<NarrowLocalIngestionSource<TReadout>> {
  return (await readout) as NarrowLocalIngestionSource<TReadout>;
}

/**
 * The dashboard reaches these stages over `/api/local-ingestion/*`, which
 * `guardLocalIngestionRequest` gates on localhost origin headers. A headless
 * run has no browser to produce those headers, so it calls the same data-layer
 * functions the routes call once the guard passes.
 */
export function directLocalUpdatePipelineOperations(): LocalUpdatePipelineOperations {
  return {
    fetchAcceptedCandidateProcessingStatus: () =>
      narrowLocalIngestionSources(getLocalAcceptedCandidateProcessingStatus()),
    // The dashboard fetches this queue as `?limit=20`; the readout the pipeline
    // reads its cluster counts from is bounded by that limit.
    fetchBenefitDiscoveryQueue: () =>
      narrowLocalIngestionSources(getLocalBenefitDiscoveryQueue({ limit: 20 })),
    fetchIngestionStatus: () => narrowLocalIngestionSources(getLocalIngestionStatus()),
    postAcceptedCandidateProcessingRun: (limit) =>
      narrowLocalIngestionSources(runLocalAcceptedCandidateProcessingBatch({ limit })),
    postBenefitDiscoveryAutomation: (input) =>
      runLocalBenefitDiscoveryAutomation({
        action: "auto-build",
        apply: input.apply,
        rejectThreshold: input.rejectThreshold,
        scope: input.scope,
        strategy: input.strategy,
        threshold: input.threshold
      }),
    postCandidateReviewAutomation: (input) =>
      narrowLocalIngestionSources(
        runLocalCandidateReviewAutomation({
          action: "auto-triage-maybe-useful",
          apply: input.apply,
          q: input.q,
          source: input.source,
          strategy: input.strategy,
          studyFilter: input.studyFilter
        })
      ),
    postCandidateReviewBulkDecision: (input) =>
      recordLocalCandidateReviewBulkDecision({
        bucket: input.bucket,
        bulkAction: input.bulkAction,
        q: input.q,
        reviewNote: input.reviewNote,
        source: input.source,
        studyFilter: input.studyFilter
      }),
    postClaimExpansion: (input) => runLocalClaimExpansion(input),
    postIdentityResolutionAutomation: (input) =>
      narrowLocalIngestionSources(
        runLocalIdentityResolutionAutomation({
          action: "auto-resolve",
          apply: input.apply,
          scope: input.scope,
          strategy: input.strategy
        })
      ),
    postIngestionRun: (limit, minDelayMs) =>
      narrowLocalIngestionSources(runLocalIngestionBatch({ limit, minDelayMs })),
    postIngestionStart: () => narrowLocalIngestionSources(startLocalIngestionDiscovery()),
    postIngestionSynonyms: () =>
      narrowLocalIngestionSources(startLocalIngestionSynonymDiscovery()),
    postScoreFinalization: (input) => runLocalScoreFinalization(input),
    postSourceWorkRepair: (input) => runLocalSourceWorkRepair(input)
  };
}
