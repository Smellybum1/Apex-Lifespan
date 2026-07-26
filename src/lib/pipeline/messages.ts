/**
 * Pure string formatters shared by the pipeline runner and the dashboard UI.
 *
 * These moved out of `evidence-dashboard.tsx` when the runner was extracted so
 * a headless run produces byte-identical log lines to the on-screen ones. They
 * are deliberately free of React and of any I/O — the dashboard imports them
 * back for its own rendering.
 */
import type {
  LocalAcceptedCandidateProcessingRunResponse,
  LocalBenefitDiscoveryAutomationResponse,
  LocalBenefitDiscoveryAutomationScope,
  LocalBenefitDiscoveryAutomationStrategy,
  LocalCandidateReviewAutomationResponse,
  LocalCandidateReviewAutomationStrategy,
  LocalCandidateReviewBulkResponse,
  LocalClaimExpansionResponse,
  LocalIdentityResolutionAutomationResponse,
  LocalIdentityResolutionAutomationScope,
  LocalIdentityResolutionAutomationStrategy,
  LocalIngestionDeepeningCatchUpReadout,
  LocalIngestionJobStatus,
  LocalIngestionRunJobResult,
  LocalIngestionSource,
  LocalIngestionStatusReadout,
  LocalScoreFinalizationResponse,
  LocalSourceWorkRepairResponse
} from "@/components/local-ingestion/types";

const LOCAL_UPDATE_PIPELINE_ERROR_REASON_LIMIT = 3;
const LOCAL_UPDATE_PIPELINE_ERROR_REASON_MAX_LENGTH = 180;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function localIngestionQueueCount(
  status: LocalIngestionStatusReadout,
  key: LocalIngestionJobStatus
) {
  return status.queue.counts[key] ?? 0;
}

export function formatLocalIngestionDelay(delayMs: number) {
  if (delayMs < 1000) {
    return `${delayMs.toLocaleString()}ms`;
  }

  return `${Math.round(delayMs / 1000).toLocaleString()}s`;
}

export function localIngestionSourceLabel(source: LocalIngestionSource) {
  switch (source) {
    case "CLINICALTRIALS_GOV":
      return "ClinicalTrials.gov";
    case "PUBMED":
      return "PubMed";
  }
}

export function localIngestionStatusLabel(
  status: LocalIngestionJobStatus | LocalIngestionRunJobResult["status"]
) {
  return status.replace(/_/g, " ").toLowerCase();
}

export function localIngestionDeepeningCatchUpSummary(
  catchUp: LocalIngestionDeepeningCatchUpReadout
) {
  if (catchUp.eligibleJobs === 0) {
    return "No completed full PubMed first-page jobs needed catch-up deepening.";
  }

  return `Deepening catch-up: ${catchUp.newJobs.toLocaleString()} queued, ${catchUp.existingJobs.toLocaleString()} already queued, ${catchUp.skippedJobs.toLocaleString()} skipped from ${catchUp.eligibleJobs.toLocaleString()} completed full PubMed first-page job(s).`;
}

export function localIngestionDeepeningRunSummary(
  deepening: NonNullable<LocalIngestionRunJobResult["deepening"]>
) {
  const usefulRatio = `${Math.round(deepening.usefulRatio * 100)}%`;
  const pageRange = `${deepening.pageStart + 1}-${deepening.pageStart + deepening.pageSize}`;
  const total =
    deepening.totalCount !== undefined
      ? ` of ${deepening.totalCount.toLocaleString()} reported`
      : `; cap ${deepening.maxResults.toLocaleString()}`;
  const nextPage =
    deepening.nextPageStart !== undefined
      ? ` Next page starts at ${deepening.nextPageStart + 1}.`
      : "";

  return `Deepening: ${deepening.reason}. Useful-looking ${deepening.usefulCandidateCount.toLocaleString()}/${deepening.candidateCount.toLocaleString()} (${usefulRatio}) on PubMed page ${pageRange}${total}.${nextPage}`;
}

export function localCandidateReviewAutomationStrategyLabel(
  strategy: LocalCandidateReviewAutomationStrategy
) {
  switch (strategy) {
    case "query-backed":
      return "Pass 2";
    case "strict":
      return "Strict";
  }
}

export function localCandidateReviewAutomationResultMessage(
  result: LocalCandidateReviewAutomationResponse
) {
  const parts = [
    `${result.counts.scanned.toLocaleString()} scanned`,
    `${result.counts.accepted.toLocaleString()} accept`,
    `${result.counts.rejected.toLocaleString()} reject`,
    `${result.counts.held.toLocaleString()} hold`
  ];

  if (result.applied) {
    parts.push(`${result.counts.appliedActions.toLocaleString()} action(s) applied`);
  }

  if (result.status === "stopped-at-limit") {
    parts.push("stopped at safety limit");
  }

  if (result.counts.errors > 0) {
    parts.push(`${result.counts.errors.toLocaleString()} error(s)`);
  }

  return `Maybe-useful ${localCandidateReviewAutomationStrategyLabel(result.strategy).toLowerCase()} auto-triage ${result.applied ? "applied" : "preview"}: ${parts.join(", ")}.`;
}

export function localCandidateBulkResultMessage(result: LocalCandidateReviewBulkResponse) {
  const parts = [
    `${result.accepted.toLocaleString()} accepted`,
    `${result.rejected.toLocaleString()} rejected`,
    `${result.scanned.toLocaleString()} scanned`
  ];

  if (result.status === "stopped-at-limit") {
    parts.push("stopped at the safety limit; press the button again to continue");
  }

  if (result.errors.length > 0) {
    parts.push(`${result.errors.length.toLocaleString()} error(s)`);
  }

  return `Bulk review finished: ${parts.join(", ")}.`;
}

export function localIdentityResolutionAutomationStrategyLabel(
  strategy: LocalIdentityResolutionAutomationStrategy
) {
  return strategy === "source-led" ? "source-led" : "strict";
}

export function localIdentityResolutionAutomationScopeLabel(
  scope: LocalIdentityResolutionAutomationScope
) {
  return scope === "all-eligible" ? "all eligible" : "batch";
}

export function localIdentityResolutionAutomationMessage(
  result: LocalIdentityResolutionAutomationResponse
) {
  const parts = [
    `${result.counts.scannedCandidates.toLocaleString()} scanned`,
    `${result.counts.confirmTarget.toLocaleString()} confirm`,
    `${result.counts.reassignIntervention.toLocaleString()} reassign`,
    `${result.counts.rejectWrongSupplement.toLocaleString()} reject`,
    `${result.counts.hold.toLocaleString()} hold`
  ];

  if (result.applied) {
    parts.push(`${result.counts.appliedActions.toLocaleString()} action(s) applied`);
  }

  if (result.counts.errors > 0) {
    parts.push(`${result.counts.errors.toLocaleString()} error(s)`);
  }

  return `Identity auto-resolve ${localIdentityResolutionAutomationStrategyLabel(result.strategy)} ${localIdentityResolutionAutomationScopeLabel(result.scope)} ${result.applied ? "applied" : "preview"}: ${parts.join(", ")}.`;
}

export function localBenefitDiscoveryAutomationScopeLabel(
  scope: LocalBenefitDiscoveryAutomationScope
) {
  return scope === "all-eligible" ? "all eligible" : "batch";
}

export function localBenefitDiscoveryAutomationStrategyLabel(
  strategy: LocalBenefitDiscoveryAutomationStrategy
) {
  switch (strategy) {
    case "build-leads":
      return "build leads";
    case "link-existing":
      return "link existing";
    case "park-backlog":
      return "park backlog";
  }
}

export function localBenefitDiscoveryAutomationMessage(
  result: LocalBenefitDiscoveryAutomationResponse
) {
  const parts = [
    `${result.counts.scannedClusters.toLocaleString()} scanned`,
    `${result.counts.draftClaims.toLocaleString()} draft`,
    `${result.counts.linkExistingClaims.toLocaleString()} link`,
    `${result.counts.parkLeadClusters.toLocaleString()} park`,
    `${result.counts.holdClusters.toLocaleString()} hold`,
    `${result.counts.rejectClusters.toLocaleString()} reject`
  ];

  if (result.applied) {
    parts.push(`${result.counts.appliedActions.toLocaleString()} action(s) applied`);
    parts.push(`${result.counts.linkedReferences.toLocaleString()} reference(s) linked`);
  }

  if (result.counts.errors > 0) {
    parts.push(`${result.counts.errors.toLocaleString()} error(s)`);
  }

  const bands =
    result.strategy === "park-backlog"
      ? ` Park ${result.rejectThreshold}-${result.threshold - 1}, reject below ${result.rejectThreshold}.`
      : "";

  return `Auto-build ${localBenefitDiscoveryAutomationStrategyLabel(result.strategy)} ${localBenefitDiscoveryAutomationScopeLabel(result.scope)} ${result.applied ? "applied" : "preview"}: ${parts.join(", ")}.${bands}`;
}

export function localUpdatePipelineDetailWithErrors(
  baseDetail: string,
  errorCount: number,
  reasons: string[]
) {
  if (errorCount <= 0) {
    return baseDetail;
  }

  return `${baseDetail} ${localUpdatePipelineErrorSummary(errorCount, reasons)}`;
}

export function localUpdatePipelineDetailWithErrorReasons(baseDetail: string, reasons: string[]) {
  const reasonDetail = localUpdatePipelineErrorReasonDetail(reasons);

  return reasonDetail ? `${baseDetail} ${reasonDetail}` : baseDetail;
}

function localUpdatePipelineErrorSummary(errorCount: number, reasons: string[]) {
  const reasonDetail = localUpdatePipelineErrorReasonDetail(reasons);

  if (reasonDetail) {
    return `${errorCount.toLocaleString()} error(s). ${reasonDetail}`;
  }

  return `${errorCount.toLocaleString()} error(s). No row-level reason returned by this stage.`;
}

function localUpdatePipelineErrorReasonDetail(reasons: string[]) {
  const limitedReasons = localUpdatePipelineLimitedErrorReasons(reasons);

  if (limitedReasons.length === 0) {
    return "";
  }

  return `Reasons: ${limitedReasons.join("; ")}.`;
}

function localUpdatePipelineLimitedErrorReasons(reasons: string[]) {
  const seen = new Set<string>();
  const cleanReasons: string[] = [];

  for (const reason of reasons) {
    const cleanReason = localUpdatePipelineCleanErrorReason(reason);
    const key = cleanReason.toLowerCase();

    if (!cleanReason || seen.has(key)) {
      continue;
    }

    seen.add(key);
    cleanReasons.push(cleanReason);
  }

  const shown = cleanReasons.slice(0, LOCAL_UPDATE_PIPELINE_ERROR_REASON_LIMIT);
  const remaining = cleanReasons.length - shown.length;

  if (remaining > 0) {
    shown.push(`${remaining.toLocaleString()} more error reason(s)`);
  }

  return shown;
}

function localUpdatePipelineCleanErrorReason(reason: string) {
  const trimmed = reason.replace(/\s+/g, " ").trim();

  if (trimmed.length <= LOCAL_UPDATE_PIPELINE_ERROR_REASON_MAX_LENGTH) {
    return trimmed;
  }

  return `${trimmed
    .slice(0, LOCAL_UPDATE_PIPELINE_ERROR_REASON_MAX_LENGTH - 3)
    .trimEnd()}...`;
}

export function localUpdatePipelineAcceptedErrorReason(
  error: LocalAcceptedCandidateProcessingRunResponse["errors"][number]
) {
  return `${error.title || error.dedupeKey}: ${error.error}`;
}

export function localUpdatePipelineCandidateAutomationErrorReasons(
  result: LocalCandidateReviewAutomationResponse
) {
  return result.decisions.flatMap((decision) =>
    decision.error ? [`${decision.title}: ${decision.error}`] : []
  );
}

export function localUpdatePipelineIdentityAutomationErrorReasons(
  result: LocalIdentityResolutionAutomationResponse
) {
  return result.decisions.flatMap((decision) =>
    decision.error
      ? [`${decision.interventionName} / ${decision.externalId}: ${decision.error}`]
      : []
  );
}

export function localUpdatePipelineBenefitAutomationErrorReasons(
  result: LocalBenefitDiscoveryAutomationResponse,
  stageLabel: string
) {
  return result.decisions.flatMap((decision) =>
    decision.error
      ? [`${stageLabel}: ${decision.interventionName} / ${decision.topicLabel}: ${decision.error}`]
      : []
  );
}

export function localUpdatePipelineClaimExpansionErrorReasons(result: LocalClaimExpansionResponse) {
  return result.decisions.flatMap((decision) =>
    decision.error ? [`${decision.interventionName} / ${decision.outcome}: ${decision.error}`] : []
  );
}

export function localUpdatePipelineScoreFinalizationErrorReasons(
  result: LocalScoreFinalizationResponse
) {
  return result.decisions.flatMap((decision) =>
    decision.error
      ? [
          `${decision.interventionName ?? "Unknown intervention"} / ${decision.outcome}: ${
            decision.error
          }`
        ]
      : []
  );
}

export function localUpdatePipelineSourceWorkRepairErrorReasons(
  result: LocalSourceWorkRepairResponse
) {
  return result.decisions.flatMap((decision) =>
    decision.error ? [`${decision.referenceLabel}: ${decision.error}`] : []
  );
}

export function localUpdatePipelineClaimExpansionDetail(result: LocalClaimExpansionResponse) {
  const held = [
    result.counts.heldIdentity > 0
      ? `${result.counts.heldIdentity.toLocaleString()} identity held`
      : undefined,
    result.counts.heldNoOutcome > 0
      ? `${result.counts.heldNoOutcome.toLocaleString()} no outcome`
      : undefined,
    result.counts.heldRejectedDecision > 0
      ? `${result.counts.heldRejectedDecision.toLocaleString()} rejected/noise`
      : undefined
  ].filter((part): part is string => Boolean(part));

  return `${result.counts.claimsCreated.toLocaleString()} draft claim(s), ${result.counts.linkedExistingClaims.toLocaleString()} existing claim group(s), ${result.counts.linkedReferences.toLocaleString()} reference link(s); claim cells ${result.counts.claimCellsBefore.toLocaleString()} -> ${result.counts.claimCellsAfter.toLocaleString()}, unlinked accepted sources ${result.counts.sourceCandidatesBefore.toLocaleString()} -> ${result.counts.sourceCandidatesAfter.toLocaleString()}${
    held.length > 0 ? `; held ${held.join(", ")}` : ""
  }.`;
}

export function localUpdatePipelineSourceWorkRepairDetail(result: LocalSourceWorkRepairResponse) {
  const held = [
    result.counts.heldIdentityWarnings > 0
      ? `${result.counts.heldIdentityWarnings.toLocaleString()} identity warning`
      : undefined,
    result.counts.heldNoSourceText > 0
      ? `${result.counts.heldNoSourceText.toLocaleString()} no source text`
      : undefined,
    result.counts.heldExistingMultiStudy > 0
      ? `${result.counts.heldExistingMultiStudy.toLocaleString()} multi-study`
      : undefined
  ].filter((part): part is string => Boolean(part));
  const covered =
    result.counts.identityWarningsCovered > 0
      ? `; ${result.counts.identityWarningsCovered.toLocaleString()} identity warning(s) covered by accepted candidates`
      : "";

  return `${result.counts.draftedExtractions.toLocaleString()} extraction draft(s), ${result.counts.syncedClaims.toLocaleString()} packet(s) synced; source-work ${result.counts.sourceBlockedBefore.toLocaleString()} -> ${result.counts.sourceBlockedAfter.toLocaleString()}${
    held.length > 0 ? `; held ${held.join(", ")}` : ""
  }${covered}.`;
}

export function localUpdatePipelineScoreFinalizationDetail(result: LocalScoreFinalizationResponse) {
  const blockers = result.counts.sourceBlockers;
  const blockerParts = [
    blockers.extraction_pending > 0
      ? `${blockers.extraction_pending.toLocaleString()} extraction pending`
      : undefined,
    blockers.not_linked > 0
      ? `${blockers.not_linked.toLocaleString()} no curated sources`
      : undefined,
    blockers.missing_sources > 0
      ? `${blockers.missing_sources.toLocaleString()} missing source records`
      : undefined
  ].filter((part): part is string => Boolean(part));
  const sourceWork =
    result.counts.sourceBlocked > 0
      ? ` Source work: ${result.counts.sourceBlocked.toLocaleString()} blocked${
          blockerParts.length > 0 ? ` (${blockerParts.join("; ")})` : ""
        }.`
      : " No source-work cells remain.";

  return `${result.counts.appliedUpdates.toLocaleString()} score-ready update(s) applied; ${result.counts.readyAfter.toLocaleString()} ready-to-score row(s) remain.${sourceWork}`;
}
