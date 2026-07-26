import type {
  LocalClaimExpansionResponse,
  LocalIngestionLogEntry,
  LocalScoreFinalizationResponse,
  LocalSourceWorkRepairResponse
} from "@/components/local-ingestion/types";
import {
  formatLocalIngestionDelay,
  localBenefitDiscoveryAutomationMessage,
  localCandidateBulkResultMessage,
  localCandidateReviewAutomationResultMessage,
  localIdentityResolutionAutomationMessage,
  localIngestionDeepeningCatchUpSummary,
  localIngestionDeepeningRunSummary,
  localIngestionQueueCount,
  localIngestionSourceLabel,
  localIngestionStatusLabel,
  localUpdatePipelineAcceptedErrorReason,
  localUpdatePipelineBenefitAutomationErrorReasons,
  localUpdatePipelineCandidateAutomationErrorReasons,
  localUpdatePipelineClaimExpansionDetail,
  localUpdatePipelineClaimExpansionErrorReasons,
  localUpdatePipelineDetailWithErrorReasons,
  localUpdatePipelineDetailWithErrors,
  localUpdatePipelineIdentityAutomationErrorReasons,
  localUpdatePipelineScoreFinalizationDetail,
  localUpdatePipelineScoreFinalizationErrorReasons,
  localUpdatePipelineSourceWorkRepairDetail,
  localUpdatePipelineSourceWorkRepairErrorReasons,
  sleep
} from "@/lib/pipeline/messages";
import {
  LOCAL_ACCEPTED_PROCESSING_BATCH_SIZE,
  LOCAL_UPDATE_PIPELINE_ACCEPTED_BATCH_CAP,
  type LocalUpdatePipelineOperations,
  type LocalUpdatePipelineRunResult,
  type LocalUpdatePipelineSettings,
  type LocalUpdatePipelineStageId,
  type LocalUpdatePipelineStageStatus
} from "@/lib/pipeline/types";

/**
 * The one-click local UPDATE pipeline, independent of React.
 *
 * Everything that touches the outside world goes through `operations`, so the
 * dashboard can inject HTTP-backed implementations while `scripts/pipeline-run.ts`
 * injects in-process ones. `appendLog` and `setStageStatus` are the only other
 * seams; a headless caller passes console writers.
 *
 * `operations` is required here, unlike the dashboard wrapper that defaults it.
 * The default implementation POSTs to `/api/local-ingestion/*` and belongs to
 * the component layer — defaulting to it in the lib would quietly reintroduce
 * the browser dependency this extraction exists to remove.
 */
export async function runLocalUpdatePipeline({
  appendLog,
  operations,
  setStageStatus,
  settings,
  shouldStop = () => false,
  sleepFor = sleep
}: {
  appendLog: (entry: Omit<LocalIngestionLogEntry, "id" | "timestamp">) => void;
  operations: LocalUpdatePipelineOperations;
  setStageStatus: (
    id: LocalUpdatePipelineStageId,
    status: LocalUpdatePipelineStageStatus,
    detail?: string
  ) => void;
  settings: LocalUpdatePipelineSettings;
  shouldStop?: () => boolean;
  sleepFor?: (ms: number) => Promise<void>;
}): Promise<LocalUpdatePipelineRunResult> {
  const { leadThreshold, rejectThreshold, runDelayMs, sessionJobLimit } = settings;
  const finishStopped = (
    stageId: LocalUpdatePipelineStageId,
    detail: string
  ): LocalUpdatePipelineRunResult => {
    setStageStatus(stageId, "skipped", detail);
    appendLog({
      detail,
      level: "info",
      message: "UPDATE stopped"
    });

    return {
      status: "stopped"
    };
  };
  const acceptedTotals = {
    errors: 0,
    errorReasons: [] as string[],
    linked: 0,
    needsClaim: 0,
    processed: 0,
    stoppedAtCap: false
  };
  let claimExpansionResult: LocalClaimExpansionResponse | null = null;
  let sourceWorkRepairResult: LocalSourceWorkRepairResponse | null = null;
  let scoreFinalizationResult: LocalScoreFinalizationResponse | null = null;
  const runAcceptedProcessingPass = async ({
    emptyDetail,
    runningDetail
  }: {
    emptyDetail: string;
    runningDetail: string;
  }) => {
    setStageStatus("accepted-processing", "running", runningDetail);
    let passBatches = 0;
    let passProcessed = 0;

    while (!shouldStop() && passBatches < LOCAL_UPDATE_PIPELINE_ACCEPTED_BATCH_CAP) {
      const batch = await operations.postAcceptedCandidateProcessingRun(
        LOCAL_ACCEPTED_PROCESSING_BATCH_SIZE
      );
      passBatches += 1;

      if (batch.processed === 0) {
        break;
      }

      const batchLinked = batch.results.filter((result) => result.linkedClaim).length;
      const batchNeedsClaim = batch.results.filter((result) => !result.claimId).length;
      const batchErrorReasons = batch.errors.map(localUpdatePipelineAcceptedErrorReason);

      passProcessed += batch.processed;
      acceptedTotals.processed += batch.processed;
      acceptedTotals.linked += batchLinked;
      acceptedTotals.needsClaim += batchNeedsClaim;
      acceptedTotals.errors += batch.errors.length;
      acceptedTotals.errorReasons.push(...batchErrorReasons);

      appendLog({
        detail: localUpdatePipelineDetailWithErrors(
          `${batchLinked.toLocaleString()} linked to existing claim(s), ${batchNeedsClaim.toLocaleString()} need claim/outcome review.`,
          batch.errors.length,
          batchErrorReasons
        ),
        level: batch.errors.length > 0 ? "error" : "success",
        message: `Processed ${batch.processed.toLocaleString()} accepted candidate(s)`
      });
      setStageStatus(
        "accepted-processing",
        "running",
        `${acceptedTotals.processed.toLocaleString()} accepted candidate(s) processed this UPDATE.`
      );

      if (!batch.hasMore) {
        break;
      }

      if (passBatches >= LOCAL_UPDATE_PIPELINE_ACCEPTED_BATCH_CAP) {
        acceptedTotals.stoppedAtCap = true;
        appendLog({
          detail: `${batch.status.counts.unprocessed.toLocaleString()} accepted candidate(s) remain unprocessed; press UPDATE again or use Process accepted to continue.`,
          level: "info",
          message: "Accepted-candidate batch cap reached"
        });
        break;
      }

      await sleepFor(750);
    }

    if (shouldStop()) {
      return;
    }

    if (acceptedTotals.processed === 0 && passProcessed === 0) {
      setStageStatus("accepted-processing", "done", emptyDetail);
      return;
    }

    setStageStatus(
      "accepted-processing",
      acceptedTotals.errors > 0 ? "error" : "done",
      localUpdatePipelineDetailWithErrors(
        `${acceptedTotals.processed.toLocaleString()} processed, ${acceptedTotals.linked.toLocaleString()} linked, ${acceptedTotals.needsClaim.toLocaleString()} need lead review${
          acceptedTotals.stoppedAtCap ? "; accepted batch cap reached" : ""
        }.`,
        acceptedTotals.errors,
        acceptedTotals.errorReasons
      )
    );
  };

  setStageStatus("queue", "running", "Queueing broad supplement discovery searches.");
  const startResult = await operations.postIngestionStart();
  let nextStatus = startResult.status;
  setStageStatus(
    "queue",
    "done",
    `${startResult.newJobs.toLocaleString()} new job(s), ${startResult.existingJobs.toLocaleString()} already queued.`
  );
  appendLog({
    detail: `${startResult.interventionCount.toLocaleString()} interventions scanned. ${localIngestionDeepeningCatchUpSummary(startResult.deepeningCatchUp)}`,
    level: "success",
    message: `Queued ${startResult.newJobs.toLocaleString()} new ingestion job(s)`
  });

  if (shouldStop()) {
    return finishStopped("ingestion", "Stopped after queueing searches.");
  }

  await runAcceptedProcessingPass({
    emptyDetail: "No accepted-candidate backlog found before source ingestion.",
    runningDetail: "Catching up already accepted candidates before source ingestion continues."
  });

  if (shouldStop()) {
    return finishStopped("ingestion", "Stopped after accepted-candidate catch-up.");
  }

  setStageStatus(
    "ingestion",
    "running",
    `${formatLocalIngestionDelay(runDelayMs)} pause, ${sessionJobLimit.toLocaleString()} job session cap.`
  );
  let synonymExpansionQueued = false;
  let processedThisSession = 0;
  let ingestionStoppedAtCap = false;
  let ingestionFailures = 0;
  const ingestionFailureReasons: string[] = [];

  while (!shouldStop()) {
    const queued = localIngestionQueueCount(nextStatus, "QUEUED");
    const running = localIngestionQueueCount(nextStatus, "RUNNING");

    if (queued <= 0 && running <= 0) {
      if (!synonymExpansionQueued) {
        synonymExpansionQueued = true;
        setStageStatus("ingestion", "running", "Queueing saved supplement synonyms.");
        const synonymResult = await operations.postIngestionSynonyms();
        nextStatus = synonymResult.status;
        appendLog({
          detail: `${synonymResult.searchTermCount.toLocaleString()} saved synonym term(s), ${synonymResult.existingJobs.toLocaleString()} existing job(s). ${localIngestionDeepeningCatchUpSummary(synonymResult.deepeningCatchUp)}`,
          level: synonymResult.newJobs > 0 ? "success" : "info",
          message: `Synonym pass queued ${synonymResult.newJobs.toLocaleString()} new ingestion job(s)`
        });

        if (
          localIngestionQueueCount(nextStatus, "QUEUED") > 0 ||
          localIngestionQueueCount(nextStatus, "RUNNING") > 0
        ) {
          continue;
        }
      }

      break;
    }

    if (processedThisSession >= sessionJobLimit) {
      ingestionStoppedAtCap = true;
      appendLog({
        detail:
          "Queued jobs were left in the local database so the next UPDATE can resume without re-downloading completed sources.",
        level: "info",
        message: "Ingestion session cap reached"
      });
      break;
    }

    setStageStatus(
      "ingestion",
      "running",
      `${queued.toLocaleString()} queued; ${processedThisSession.toLocaleString()} processed this run.`
    );
    const batch = await operations.postIngestionRun(1, runDelayMs);
    nextStatus = batch.status;
    processedThisSession += batch.processed;

    if (batch.results.length === 0) {
      appendLog({
        detail: "The runner did not claim a queued job on this pulse.",
        level: "info",
        message: "No ingestion job claimed"
      });
      break;
    }

    for (const result of batch.results) {
      const deepeningDetail = result.deepening
        ? ` ${localIngestionDeepeningRunSummary(result.deepening)}`
        : "";
      appendLog({
        detail: result.error
          ? `${result.query} - ${result.error}${deepeningDetail}`
          : `${result.query}${deepeningDetail}`,
        level: result.status === "FAILED" ? "error" : "success",
        message: `${localIngestionSourceLabel(result.source)} ${localIngestionStatusLabel(result.status)}: ${result.recordsFound.toLocaleString()} found, ${result.recordsChanged.toLocaleString()} saved`
      });

      if (result.status === "FAILED") {
        ingestionFailures += 1;
        ingestionFailureReasons.push(
          `${localIngestionSourceLabel(result.source)} ${result.query}: ${
            result.error ?? "Job failed without a returned reason."
          }`
        );
      }
    }

    await sleepFor(batch.safety.minDelayMs);
  }

  if (shouldStop()) {
    return finishStopped(
      "ingestion",
      `Stopped after ${processedThisSession.toLocaleString()} ingestion job(s).`
    );
  }

  setStageStatus(
    "ingestion",
    ingestionFailures > 0 ? "error" : "done",
    localUpdatePipelineDetailWithErrors(
      ingestionStoppedAtCap
        ? `Processed ${processedThisSession.toLocaleString()} job(s); cap reached.`
        : `Processed ${processedThisSession.toLocaleString()} job(s); queue pass finished.`,
      ingestionFailures,
      ingestionFailureReasons
    )
  );

  setStageStatus(
    "candidate-review",
    "running",
    "Accepting likely-useful candidates and triaging maybe-useful rows."
  );
  const likelyUsefulResult = await operations.postCandidateReviewBulkDecision({
    bucket: "likely-useful",
    bulkAction: "accept-likely-useful",
    q: "",
    reviewNote: "Bulk accepted likely useful candidates from the one-click local UPDATE pipeline.",
    source: "ALL",
    studyFilter: "all"
  });
  appendLog({
    detail: localUpdatePipelineDetailWithErrorReasons(
      localCandidateBulkResultMessage(likelyUsefulResult),
      likelyUsefulResult.errors
    ),
    level: likelyUsefulResult.errors.length > 0 ? "error" : "success",
    message: "Likely-useful candidate pass finished"
  });

  const maybeUsefulResult = await operations.postCandidateReviewAutomation({
    apply: true,
    q: "",
    source: "ALL",
    strategy: "query-backed",
    studyFilter: "all"
  });
  appendLog({
    detail: localUpdatePipelineDetailWithErrorReasons(
      localCandidateReviewAutomationResultMessage(maybeUsefulResult),
      localUpdatePipelineCandidateAutomationErrorReasons(maybeUsefulResult)
    ),
    level: maybeUsefulResult.counts.errors > 0 ? "error" : "success",
    message: "Maybe-useful candidate automation finished"
  });
  const candidateReviewErrors = likelyUsefulResult.errors.length + maybeUsefulResult.counts.errors;
  const candidateReviewErrorReasons = [
    ...likelyUsefulResult.errors,
    ...localUpdatePipelineCandidateAutomationErrorReasons(maybeUsefulResult)
  ];
  setStageStatus(
    "candidate-review",
    candidateReviewErrors > 0 ? "error" : "done",
    localUpdatePipelineDetailWithErrors(
      `${(
        likelyUsefulResult.accepted + maybeUsefulResult.counts.accepted
      ).toLocaleString()} accepted, ${(
        likelyUsefulResult.rejected + maybeUsefulResult.counts.rejected
      ).toLocaleString()} rejected, ${maybeUsefulResult.counts.held.toLocaleString()} held.`,
      candidateReviewErrors,
      candidateReviewErrorReasons
    )
  );

  if (shouldStop()) {
    return finishStopped("accepted-processing", "Stopped after candidate review.");
  }

  await runAcceptedProcessingPass({
    emptyDetail: "No newly accepted candidates needed processing after candidate review.",
    runningDetail:
      "Processing newly accepted candidates into references and benefit-area suggestions."
  });

  if (shouldStop()) {
    return finishStopped(
      "accepted-processing",
      `Stopped after ${acceptedTotals.processed.toLocaleString()} accepted candidate(s).`
    );
  }

  setStageStatus(
    "identity-resolution",
    "running",
    "Applying source-led identity cleanup to all eligible blocked rows."
  );
  const identityResult = await operations.postIdentityResolutionAutomation({
    apply: true,
    scope: "all-eligible",
    strategy: "source-led"
  });
  const identityErrorReasons = localUpdatePipelineIdentityAutomationErrorReasons(identityResult);
  appendLog({
    detail: localUpdatePipelineDetailWithErrorReasons(
      localIdentityResolutionAutomationMessage(identityResult),
      identityErrorReasons
    ),
    level: identityResult.counts.errors > 0 ? "error" : "success",
    message: "Identity auto-resolve finished"
  });
  setStageStatus(
    "identity-resolution",
    identityResult.counts.errors > 0 ? "error" : "done",
    localUpdatePipelineDetailWithErrors(
      `${identityResult.counts.appliedActions.toLocaleString()} applied, ${identityResult.counts.hold.toLocaleString()} held.`,
      identityResult.counts.errors,
      identityErrorReasons
    )
  );

  if (shouldStop()) {
    return finishStopped("benefit-discovery", "Stopped after identity resolution.");
  }

  setStageStatus(
    "benefit-discovery",
    "running",
    `Building score ${leadThreshold}+ leads; parking ${rejectThreshold}-${leadThreshold - 1}; rejecting under ${rejectThreshold}.`
  );
  const buildResult = await operations.postBenefitDiscoveryAutomation({
    apply: true,
    rejectThreshold,
    scope: "all-eligible",
    strategy: "build-leads",
    threshold: leadThreshold
  });
  const buildErrorReasons = localUpdatePipelineBenefitAutomationErrorReasons(
    buildResult,
    "Build leads"
  );
  appendLog({
    detail: localUpdatePipelineDetailWithErrorReasons(
      localBenefitDiscoveryAutomationMessage(buildResult),
      buildErrorReasons
    ),
    level: buildResult.counts.errors > 0 ? "error" : "success",
    message: "High-confidence lead build finished"
  });
  const parkResult = await operations.postBenefitDiscoveryAutomation({
    apply: true,
    rejectThreshold,
    scope: "all-eligible",
    strategy: "park-backlog",
    threshold: leadThreshold
  });
  const parkErrorReasons = localUpdatePipelineBenefitAutomationErrorReasons(
    parkResult,
    "Park/reject"
  );
  appendLog({
    detail: localUpdatePipelineDetailWithErrorReasons(
      localBenefitDiscoveryAutomationMessage(parkResult),
      parkErrorReasons
    ),
    level: parkResult.counts.errors > 0 ? "error" : "success",
    message: "Backlog park/reject pass finished"
  });
  const benefitErrors = buildResult.counts.errors + parkResult.counts.errors;
  setStageStatus(
    "benefit-discovery",
    benefitErrors > 0 ? "error" : "done",
    localUpdatePipelineDetailWithErrors(
      `${(
        buildResult.counts.draftClaims + buildResult.counts.linkExistingClaims
      ).toLocaleString()} built/linked, ${parkResult.counts.parkLeadClusters.toLocaleString()} parked, ${(
        buildResult.counts.rejectClusters + parkResult.counts.rejectClusters
      ).toLocaleString()} rejected.`,
      benefitErrors,
      [...buildErrorReasons, ...parkErrorReasons]
    )
  );

  if (shouldStop()) {
    return finishStopped("claim-expansion", "Stopped before accepted-source claim expansion.");
  }

  setStageStatus(
    "claim-expansion",
    "running",
    "Expanding accepted, unlinked source candidates into traceable draft claim cells."
  );
  claimExpansionResult = await operations.postClaimExpansion({
    apply: true
  });
  const claimExpansionErrorReasons =
    localUpdatePipelineClaimExpansionErrorReasons(claimExpansionResult);
  appendLog({
    detail: localUpdatePipelineDetailWithErrorReasons(
      localUpdatePipelineClaimExpansionDetail(claimExpansionResult),
      claimExpansionErrorReasons
    ),
    level: claimExpansionResult.counts.errors > 0 ? "error" : "success",
    message: "Accepted-source claim expansion finished"
  });
  setStageStatus(
    "claim-expansion",
    claimExpansionResult.counts.errors > 0 ? "error" : "done",
    localUpdatePipelineDetailWithErrors(
      localUpdatePipelineClaimExpansionDetail(claimExpansionResult),
      claimExpansionResult.counts.errors,
      claimExpansionErrorReasons
    )
  );

  if (shouldStop()) {
    return finishStopped("source-work-repair", "Stopped before source-work extraction repair.");
  }

  setStageStatus(
    "source-work-repair",
    "running",
    "Drafting conservative extraction rows from captured abstracts and registry summaries."
  );
  sourceWorkRepairResult = await operations.postSourceWorkRepair({
    apply: true
  });
  const sourceRepairErrorReasons =
    localUpdatePipelineSourceWorkRepairErrorReasons(sourceWorkRepairResult);
  appendLog({
    detail: localUpdatePipelineDetailWithErrorReasons(
      localUpdatePipelineSourceWorkRepairDetail(sourceWorkRepairResult),
      sourceRepairErrorReasons
    ),
    level: sourceWorkRepairResult.counts.errors > 0 ? "error" : "success",
    message: "Source-work extraction repair finished"
  });
  setStageStatus(
    "source-work-repair",
    sourceWorkRepairResult.counts.errors > 0 ? "error" : "done",
    localUpdatePipelineDetailWithErrors(
      localUpdatePipelineSourceWorkRepairDetail(sourceWorkRepairResult),
      sourceWorkRepairResult.counts.errors,
      sourceRepairErrorReasons
    )
  );

  if (shouldStop()) {
    return finishStopped("score-finalization", "Stopped before score-ready finalization.");
  }

  setStageStatus(
    "score-finalization",
    "running",
    "Applying already-ready source-packet scores and summarizing remaining source work."
  );
  scoreFinalizationResult = await operations.postScoreFinalization({
    apply: true
  });
  const scoreFinalizationErrorReasons =
    localUpdatePipelineScoreFinalizationErrorReasons(scoreFinalizationResult);
  appendLog({
    detail: localUpdatePipelineDetailWithErrorReasons(
      localUpdatePipelineScoreFinalizationDetail(scoreFinalizationResult),
      scoreFinalizationErrorReasons
    ),
    level: scoreFinalizationResult.counts.errors > 0 ? "error" : "success",
    message: "Score-ready finalization finished"
  });
  setStageStatus(
    "score-finalization",
    scoreFinalizationResult.counts.errors > 0 ? "error" : "done",
    localUpdatePipelineDetailWithErrors(
      localUpdatePipelineScoreFinalizationDetail(scoreFinalizationResult),
      scoreFinalizationResult.counts.errors,
      scoreFinalizationErrorReasons
    )
  );

  if (shouldStop()) {
    return finishStopped("refresh", "Stopped before refreshing derived dashboard views.");
  }

  // Named for the dashboard's benefit, but the work is three status reads that
  // produce the run's closing summary line — the most useful line in a cron
  // log. Kept for headless runs rather than dropped with the rest of the UI.
  setStageStatus("refresh", "running", "Refreshing local readouts and derived views.");
  const [finalIngestionStatus, finalProcessorStatus, finalBenefitQueue] = await Promise.all([
    operations.fetchIngestionStatus(),
    operations.fetchAcceptedCandidateProcessingStatus(),
    operations.fetchBenefitDiscoveryQueue()
  ]);
  setStageStatus(
    "refresh",
    "done",
    `${finalIngestionStatus.candidates.total.toLocaleString()} candidates, ${finalProcessorStatus.counts.processed.toLocaleString()} accepted processed, ${finalBenefitQueue.counts.activeClusters.toLocaleString()} active lead cluster(s)${
      claimExpansionResult
        ? `, ${claimExpansionResult.counts.claimCellsAfter.toLocaleString()} claim cell(s), ${claimExpansionResult.counts.sourceCandidatesAfter.toLocaleString()} accepted source(s) still unlinked`
        : ""
    }${
      scoreFinalizationResult
        ? `, ${scoreFinalizationResult.counts.scoredPublicClaims.toLocaleString()} scored cell(s), ${scoreFinalizationResult.counts.sourceBlocked.toLocaleString()} source-work cell(s)${
            sourceWorkRepairResult
              ? ` after ${sourceWorkRepairResult.counts.draftedExtractions.toLocaleString()} extraction draft(s)`
              : ""
          }`
        : ""
    }.`
  );
  appendLog({
    detail:
      "Heatmap cells and plain-language supplement briefs are derived from the local catalog; reloading shows the new source links and draft claims.",
    level: "success",
    message: "Derived dashboard refresh finished"
  });

  return {
    status: "completed"
  };
}
