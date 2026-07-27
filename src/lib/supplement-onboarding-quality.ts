import {
  buildFullTextConnectorApprovalPacket,
  buildFullTextSourceInventoryNextActionPlan,
  buildFullTextSourceReadinessReport,
  summarizeFullTextConnectorApprovalPacket,
  summarizeFullTextSourceInventoryNextActionPlan,
  summarizeFullTextSourceReadinessReport,
  type FullTextSourceInventoryItem,
  type FullTextSourceReadinessSummary
} from "@/lib/full-text-source-readiness";
import { summarizeClaimSourcePackets } from "@/lib/source-packet";
import {
  buildSupplementOnboardingMonitorDashboard,
  summarizeSupplementOnboardingMonitorDashboard,
  type SupplementOnboardingMonitorDashboard,
  type SupplementOnboardingMonitorSummary
} from "@/lib/supplement-onboarding-monitor";
import {
  buildSupplementOnboardingReviewPacketReport,
  type SupplementOnboardingReviewPacket
} from "@/lib/supplement-onboarding-review-packet";
import {
  getSourceConvictionRubric,
  type SourceConvictionRubric,
  type SourceConvictionScoreBreakdown
} from "@/lib/source-conviction";
import type {
  SupplementOnboardingSourceCandidateSignal,
  SupplementOnboardingSourceJobSignal,
  SupplementOnboardingSourceSignals
} from "@/lib/supplement-onboarding-readiness";
import type { Claim, EvidenceDashboardData, Intervention } from "@/lib/types";

export type SupplementOnboardingQualityStatus = "ready" | "warning" | "blocked";

export type SupplementOnboardingQualityPriorityTier =
  | "blocked-setup"
  | "safety-caveat-review"
  | "source-candidate-review"
  | "warning-review"
  | "extraction-review"
  | "promotion-review"
  | "monitor";

export type SupplementOnboardingDraftState =
  | "missing-claims"
  | "drafted"
  | "reviewing"
  | "reviewed";

export type SupplementOnboardingQueueState =
  | "unavailable"
  | "missing"
  | "queued"
  | "running"
  | "failed"
  | "completed"
  | "mixed";

export type SupplementOnboardingCandidateState =
  | "unavailable"
  | "missing"
  | "found";

export type SupplementOnboardingCompletenessState =
  | "missing"
  | "partial"
  | "complete";

export interface SupplementOnboardingQualityDashboard {
  dataSource: EvidenceDashboardData["dataSource"];
  fullTextConnectorApproval: ReturnType<typeof summarizeFullTextConnectorApprovalPacket>;
  fullTextNextAction: ReturnType<typeof summarizeFullTextSourceInventoryNextActionPlan>;
  fullTextSources: FullTextSourceReadinessSummary;
  generatedAt: string;
  humanOwned: true;
  monitor: SupplementOnboardingMonitorDashboard;
  nextAction: string;
  priorityQueue: SupplementOnboardingQualityPriorityItem[];
  readOnly: true;
  rows: SupplementOnboardingQualityRow[];
  sourceConvictionRubric: SourceConvictionRubric;
  sourceTracking: {
    status: "available" | "unavailable";
    unavailableReason?: string;
  };
  summary: SupplementOnboardingQualitySummaryCounts;
}

export interface SupplementOnboardingQualitySummary {
  dataSource: EvidenceDashboardData["dataSource"];
  fullTextConnectorApproval: SupplementOnboardingQualityDashboard["fullTextConnectorApproval"];
  fullTextNextAction: SupplementOnboardingQualityDashboard["fullTextNextAction"];
  fullTextSources: SupplementOnboardingQualityDashboard["fullTextSources"];
  generatedAt: string;
  humanOwned: true;
  monitor: SupplementOnboardingMonitorSummary;
  nextAction: string;
  priorityQueue: SupplementOnboardingQualityPriorityItem[];
  readOnly: true;
  rows: Array<{
    blockers: string[];
    candidates: number;
    claims: number;
    convictionDistribution: SupplementOnboardingQualityRow["convictionDistribution"];
    name: string;
    nextAction: string;
    promotionReadyClaims: number;
    reviewPacketAutopilot: SupplementOnboardingQualityRow["reviewPacketAutopilot"];
    reviewPacketDecision: SupplementOnboardingQualityRow["reviewPacketDecision"];
    safetySignals: number;
    slug: string;
    status: SupplementOnboardingQualityStatus;
    states: SupplementOnboardingQualityRow["states"];
    warnings: string[];
  }>;
  sourceConvictionRubric: SourceConvictionRubric;
  sourceTracking: SupplementOnboardingQualityDashboard["sourceTracking"];
  summary: SupplementOnboardingQualitySummaryCounts;
}

export interface SupplementOnboardingQualitySummaryCounts {
  acceptedCandidates: number;
  blockedSupplements: number;
  candidates: number;
  extractionCompleteClaims: number;
  pendingCandidates: number;
  promotionBlockedClaims: number;
  promotionReadyClaims: number;
  queuedJobs: number;
  readySupplements: number;
  reviewedCandidates: number;
  reviewedClaims: number;
  safetySignals: number;
  sourceJobs: number;
  supplements: number;
  totalClaims: number;
  warningSupplements: number;
}

export interface SupplementOnboardingQualityPriorityItem {
  action: string;
  blockers: number;
  category: Intervention["category"];
  claims: number;
  id: string;
  name: string;
  pendingCandidates: number;
  priority: number;
  promotionReadyClaims: number;
  rationale: string[];
  safetySignals: number;
  slug: string;
  status: SupplementOnboardingQualityStatus;
  tier: SupplementOnboardingQualityPriorityTier;
  warnings: number;
}

export interface SupplementOnboardingQualityRow {
  blockers: string[];
  counts: {
    acceptedCandidates: number;
    claims: number;
    pendingCandidates: number;
    rejectedCandidates: number;
    reviewedCandidates: number;
    reviewedClaims: number;
    safetySignals: number;
    sourceCandidates: number;
    sourceJobs: number;
  };
  convictionDistribution: {
    high: number;
    low: number;
    moderate: number;
    unscored: number;
    veryLow: number;
  };
  nextAction: string;
  promotion: {
    blockedClaims: number;
    blockers: string[];
    readyClaims: number;
    totalClaims: number;
  };
  reviewPacketDiff: {
    publicWordingChanges: number;
    referenceLinkChanges: number;
    scoreChanges: number;
    uncertaintyLabelChanges: number;
  };
  reviewPacketDecision: {
    holdOrReject: number;
    needsMoreEvidence: number;
    readyForHumanReview: number;
  };
  reviewPacketAutopilot: {
    blockedBySafety: number;
    nextAction: string;
    noAutoAccept: true;
    noAutoExtraction: true;
    noAutoPromotion: true;
    noAutoReject: true;
    readyNoPendingCandidates: number;
    recommendedCandidate?: {
      claimId: string;
      curationDraftCommand?: string;
      dedupeKey?: string;
      packetPreview?: {
        candidateReviewPacketCommand: string;
        curationStatusCommand: string;
        noCandidateDecision: true;
        noExtractionWrite: true;
        noPromotion: true;
        readOnly: true;
        referenceMatchesCommand: string;
        siblingsCommand: string;
      };
      score?: number;
      scoreBreakdown?: SourceConvictionScoreBreakdown;
      rubricVersion?: string;
      source?: string;
      sourceReputationLabel?: string;
      title?: string;
      triageRecommendation?: string;
    };
    reviewPendingCandidate: number;
    summarizeLimitations: number;
  };
  sourcePacket: {
    completeClaims: number;
    extractionPendingClaims: number;
    extractedReferences: number;
    missingReferences: number;
    missingSourceClaims: number;
    pendingReferences: number;
    totalReferences: number;
    unlinkedClaims: number;
  };
  status: SupplementOnboardingQualityStatus;
  states: {
    candidates: SupplementOnboardingCandidateState;
    draft: SupplementOnboardingDraftState;
    extraction: SupplementOnboardingCompletenessState;
    promotion: "ready" | "blocked";
    queue: SupplementOnboardingQueueState;
    reviewPacket: SupplementOnboardingCompletenessState;
  };
  supplement: {
    category: Intervention["category"];
    id: string;
    name: string;
    slug: string;
  };
  warnings: string[];
}

export function buildSupplementOnboardingQualityDashboard({
  data,
  fullTextInventoryPath,
  fullTextSourceInventory,
  generatedAt = new Date(),
  sourceSignals
}: {
  data: EvidenceDashboardData;
  fullTextInventoryPath?: string;
  fullTextSourceInventory?: FullTextSourceInventoryItem[];
  generatedAt?: Date;
  sourceSignals?: SupplementOnboardingSourceSignals;
}): SupplementOnboardingQualityDashboard {
  const referencesById = new Map(data.references.map((reference) => [reference.id, reference]));
  const rows = data.interventions
    .map((supplement) =>
      qualityRowForSupplement({
        data,
        generatedAt,
        referencesById,
        sourceSignals,
        supplement
      })
    )
    .sort(compareQualityRows);
  const summary = summarizeRows(rows);
  const fullTextSources = summarizeFullTextSourceReadinessReport(
    buildFullTextSourceReadinessReport({
      generatedAt,
      inventory: fullTextSourceInventory
    })
  );
  const fullTextNextAction = summarizeFullTextSourceInventoryNextActionPlan(
    buildFullTextSourceInventoryNextActionPlan({
      generatedAt,
      inventory: fullTextSourceInventory,
      inventoryFilePath: fullTextInventoryPath
    })
  );
  const fullTextConnectorApproval = summarizeFullTextConnectorApprovalPacket(
    buildFullTextConnectorApprovalPacket({
      generatedAt,
      inventory: fullTextSourceInventory
    })
  );
  const sourceTracking = sourceSignals?.unavailableReason
    ? {
        status: "unavailable" as const,
        unavailableReason: sourceSignals.unavailableReason
      }
    : {
        status: "available" as const
      };
  const monitor = buildSupplementOnboardingMonitorDashboard({
    data,
    fullTextSources,
    generatedAt,
    qualityRows: rows,
    sourceTracking
  });
  const nextAction =
    rows.find((row) => row.status === "blocked")?.nextAction ??
    rows.find((row) => row.status === "warning")?.nextAction ??
    "All visible supplements are ready for explicit operator-owned review or promotion checks.";

  return {
    dataSource: data.dataSource,
    fullTextConnectorApproval,
    fullTextNextAction,
    fullTextSources,
    generatedAt: generatedAt.toISOString(),
    humanOwned: true,
    monitor,
    nextAction,
    priorityQueue: buildQualityPriorityQueue(rows),
    readOnly: true,
    rows,
    sourceConvictionRubric: getSourceConvictionRubric(),
    sourceTracking,
    summary
  };
}

export function summarizeSupplementOnboardingQualityDashboard(
  dashboard: SupplementOnboardingQualityDashboard
): SupplementOnboardingQualitySummary {
  return {
    dataSource: dashboard.dataSource,
    fullTextConnectorApproval: dashboard.fullTextConnectorApproval,
    fullTextNextAction: dashboard.fullTextNextAction,
    fullTextSources: dashboard.fullTextSources,
    generatedAt: dashboard.generatedAt,
    humanOwned: true,
    monitor: summarizeSupplementOnboardingMonitorDashboard(dashboard.monitor),
    nextAction: dashboard.nextAction,
    priorityQueue: dashboard.priorityQueue,
    readOnly: true,
    rows: dashboard.rows.map((row) => ({
      blockers: row.blockers,
      candidates: row.counts.sourceCandidates,
      claims: row.counts.claims,
      convictionDistribution: row.convictionDistribution,
      name: row.supplement.name,
      nextAction: row.nextAction,
      promotionReadyClaims: row.promotion.readyClaims,
      reviewPacketAutopilot: row.reviewPacketAutopilot,
      reviewPacketDecision: row.reviewPacketDecision,
      safetySignals: row.counts.safetySignals,
      slug: row.supplement.slug,
      status: row.status,
      states: row.states,
      warnings: row.warnings
    })),
    sourceConvictionRubric: dashboard.sourceConvictionRubric,
    sourceTracking: dashboard.sourceTracking,
    summary: dashboard.summary
  };
}

function qualityRowForSupplement({
  data,
  generatedAt,
  referencesById,
  sourceSignals,
  supplement
}: {
  data: EvidenceDashboardData;
  generatedAt: Date;
  referencesById: Map<string, EvidenceDashboardData["references"][number]>;
  sourceSignals?: SupplementOnboardingSourceSignals;
  supplement: Intervention;
}): SupplementOnboardingQualityRow {
  const claims = data.claims.filter((claim) => claim.interventionId === supplement.id);
  const claimIds = new Set(claims.map((claim) => claim.id));
  const candidates = relevantCandidates(sourceSignals?.candidates ?? [], supplement.id, claims);
  const jobs = relevantJobs(sourceSignals?.jobs ?? [], supplement.id, claimIds);
  const packetSummary = summarizeClaimSourcePackets({
    claims,
    referencesById,
    studies: data.studies
  });
  const reviewReport = buildSupplementOnboardingReviewPacketReport({
    data,
    generatedAt,
    sourceSignals,
    supplementQuery: supplement.id
  });
  const reviewedClaims = claims.filter((claim) => claim.reviewStatus === "Human reviewed").length;
  const reviewedCandidates = candidates.filter(
    (candidate) => normalizeDecision(candidate.decision) !== "PENDING_REVIEW"
  ).length;
  const acceptedCandidates = candidates.filter(
    (candidate) => normalizeDecision(candidate.decision) === "ACCEPTED"
  ).length;
  const pendingCandidates = candidates.filter(
    (candidate) => normalizeDecision(candidate.decision) === "PENDING_REVIEW"
  ).length;
  const rejectedCandidates = candidates.filter(
    (candidate) => normalizeDecision(candidate.decision) === "REJECTED"
  ).length;
  const promotionReadyClaims = reviewReport.packets.filter(
    (packet) => packet.promotionDiff.readyForPromotionReview
  ).length;
  const promotionBlockers = uniqueNonEmpty(
    reviewReport.packets.flatMap((packet) =>
      packet.promotionDiff.blockers.map((blocker) => `${packet.claim.id}: ${blocker}`)
    )
  );
  const reviewPacketDiff = reviewPacketDiffSummary(reviewReport.packets);
  const reviewPacketDecision = reviewPacketDecisionSummary(reviewReport.packets);
  const reviewPacketAutopilot = reviewPacketAutopilotSummary(reviewReport.packets);
  const safetySignals = reviewReport.packets.reduce(
    (total, packet) =>
      total + packet.safetyWatchlist.acceptedPacketSignals.length,
    0
  );
  const regulatoryStatuses = data.australiaRegulatoryStatuses.filter(
    (status) => status.interventionId === supplement.id
  );
  const blockers = rowBlockers({
    claims,
    candidates,
    jobs,
    packetSummary,
    promotionBlockers,
    regulatoryStatuses,
    reviewedClaims,
    sourceUnavailable: Boolean(sourceSignals?.unavailableReason)
  });
  const warnings = rowWarnings({
    candidates,
    claims,
    jobs,
    packetSummary,
    regulatoryStatuses,
    safetySignals,
    sourceUnavailable: Boolean(sourceSignals?.unavailableReason),
    sourceUnavailableReason: sourceSignals?.unavailableReason
  });
  const status =
    blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "ready";

  return {
    blockers,
    counts: {
      acceptedCandidates,
      claims: claims.length,
      pendingCandidates,
      rejectedCandidates,
      reviewedCandidates,
      reviewedClaims,
      safetySignals,
      sourceCandidates: candidates.length,
      sourceJobs: jobs.length
    },
    convictionDistribution: convictionDistribution(candidates),
    nextAction:
      blockers[0] ??
      warnings[0] ??
      "Ready for explicit operator-owned review or promotion checks.",
    promotion: {
      blockedClaims: Math.max(0, claims.length - promotionReadyClaims),
      blockers: promotionBlockers,
      readyClaims: promotionReadyClaims,
      totalClaims: claims.length
    },
    reviewPacketDiff,
    reviewPacketAutopilot,
    reviewPacketDecision,
    sourcePacket: {
      completeClaims: packetSummary.completeClaims,
      extractionPendingClaims: packetSummary.extractionPendingClaims,
      extractedReferences: packetSummary.extractedReferences,
      missingReferences: packetSummary.missingReferences,
      missingSourceClaims: packetSummary.missingSourceClaims,
      pendingReferences: packetSummary.pendingReferences,
      totalReferences: packetSummary.totalReferences,
      unlinkedClaims: packetSummary.unlinkedClaims
    },
    status,
    states: {
      candidates: candidateState(sourceSignals, candidates),
      draft: draftState(claims),
      extraction: extractionState(claims.length, packetSummary.completeClaims),
      promotion:
        claims.length > 0 && promotionReadyClaims === claims.length ? "ready" : "blocked",
      queue: queueState(sourceSignals, jobs),
      reviewPacket: reviewPacketState(claims.length, reviewedClaims, packetSummary.completeClaims)
    },
    supplement: {
      category: supplement.category,
      id: supplement.id,
      name: supplement.name,
      slug: supplement.slug
    },
    warnings
  };
}

function rowBlockers({
  claims,
  candidates,
  jobs,
  packetSummary,
  promotionBlockers,
  regulatoryStatuses,
  reviewedClaims,
  sourceUnavailable
}: {
  claims: Claim[];
  candidates: SupplementOnboardingSourceCandidateSignal[];
  jobs: SupplementOnboardingSourceJobSignal[];
  packetSummary: ReturnType<typeof summarizeClaimSourcePackets>;
  promotionBlockers: string[];
  regulatoryStatuses: EvidenceDashboardData["australiaRegulatoryStatuses"];
  reviewedClaims: number;
  sourceUnavailable: boolean;
}) {
  const blockers: string[] = [];
  const packetComplete = claims.length > 0 && packetSummary.completeClaims === claims.length;

  if (claims.length === 0) {
    blockers.push("Add reviewed draft claim scopes before queueing source discovery.");
  }

  if (regulatoryStatuses.length === 0) {
    blockers.push("Add an explicit AU/TGA Unknown/Unverified status record before public display.");
  }

  if (!sourceUnavailable) {
    if (jobs.length === 0 && !packetComplete) {
      blockers.push("Queue claim-scoped source discovery jobs.");
    }

    if (jobs.some((job) => normalizeStatus(job.status) === "FAILED")) {
      blockers.push("Resolve failed source discovery jobs before treating onboarding as current.");
    }

    if (candidates.length === 0 && !packetComplete) {
      blockers.push("Run source discovery jobs until source candidates are available for review.");
    }
  }

  if (claims.length > 0 && packetSummary.completeClaims < claims.length) {
    blockers.push("Complete curated reference links and structured extractions for every claim.");
  }

  if (claims.length > 0 && reviewedClaims < claims.length) {
    blockers.push("Review every claim packet after citation traceability and caveats are checked.");
  }

  blockers.push(...promotionBlockers);

  return uniqueNonEmpty(blockers);
}

function rowWarnings({
  candidates,
  claims,
  jobs,
  packetSummary,
  regulatoryStatuses,
  safetySignals,
  sourceUnavailable,
  sourceUnavailableReason
}: {
  candidates: SupplementOnboardingSourceCandidateSignal[];
  claims: Claim[];
  jobs: SupplementOnboardingSourceJobSignal[];
  packetSummary: ReturnType<typeof summarizeClaimSourcePackets>;
  regulatoryStatuses: EvidenceDashboardData["australiaRegulatoryStatuses"];
  safetySignals: number;
  sourceUnavailable: boolean;
  sourceUnavailableReason?: string;
}) {
  const warnings: string[] = [];
  const packetComplete = claims.length > 0 && packetSummary.completeClaims === claims.length;

  if (sourceUnavailableReason) {
    warnings.push(`Source tracking unavailable: ${sourceUnavailableReason}`);
  }

  if (!sourceUnavailable && packetComplete && jobs.length === 0) {
    warnings.push("No source discovery job history is visible; this packet may predate onboarding queueing.");
  }

  if (!sourceUnavailable && packetComplete && candidates.length === 0) {
    warnings.push("No source candidates are visible; this packet may predate source-candidate tracking.");
  }

  if (regulatoryStatuses.some((status) => status.kind === "Unknown")) {
    warnings.push("AU/TGA status is explicitly Unknown; do not infer product-level authorisation.");
  }

  if (safetySignals > 0) {
    warnings.push(
      `${safetySignals} accepted-packet safety/watchlist signal(s) need caveat review.`
    );
  }

  if (candidates.some((candidate) => normalizeDecision(candidate.decision) === "PENDING_REVIEW")) {
    warnings.push("Unreviewed source candidates remain in the onboarding queue.");
  }

  if (
    candidates.length > 0 &&
    candidates.every((candidate) => convictionBucket(candidate) !== "high")
  ) {
    warnings.push("No high-conviction source candidate is currently visible for this supplement.");
  }

  return uniqueNonEmpty(warnings);
}

function reviewPacketDiffSummary(packets: SupplementOnboardingReviewPacket[]) {
  return packets.reduce(
    (summary, packet) => {
      summary.publicWordingChanges += packet.promotionDiff.publicClaimText.changes
        ? 1
        : 0;
      summary.referenceLinkChanges +=
        packet.promotionDiff.referenceLinks.addedReferenceIds.length +
        packet.promotionDiff.referenceLinks.removedReferenceIds.length;
      summary.scoreChanges += packet.promotionDiff.scoreChanges.filter(
        (change) => change.changes
      ).length;
      summary.uncertaintyLabelChanges +=
        (packet.promotionDiff.uncertaintyLabels.confidenceLevel.changes ? 1 : 0) +
        (packet.promotionDiff.uncertaintyLabels.reviewStatus.changes ? 1 : 0);

      return summary;
    },
    {
      publicWordingChanges: 0,
      referenceLinkChanges: 0,
      scoreChanges: 0,
      uncertaintyLabelChanges: 0
    }
  );
}

function reviewPacketDecisionSummary(packets: SupplementOnboardingReviewPacket[]) {
  return packets.reduce(
    (summary, packet) => {
      if (packet.operatorDecision.recommendation === "ready-for-human-review") {
        summary.readyForHumanReview += 1;
      } else if (packet.operatorDecision.recommendation === "hold-or-reject") {
        summary.holdOrReject += 1;
      } else {
        summary.needsMoreEvidence += 1;
      }

      return summary;
    },
    {
      holdOrReject: 0,
      needsMoreEvidence: 0,
      readyForHumanReview: 0
    }
  );
}

function reviewPacketAutopilotSummary(
  packets: SupplementOnboardingReviewPacket[]
): SupplementOnboardingQualityRow["reviewPacketAutopilot"] {
  const selectedPacket =
    packets.find((packet) => packet.candidateReviewAutopilot.status === "blocked-by-safety") ??
    packets.find((packet) => packet.candidateReviewAutopilot.status === "review-pending-candidate") ??
    packets.find((packet) => packet.candidateReviewAutopilot.status === "summarize-limitations") ??
    packets.find((packet) => packet.candidateReviewAutopilot.status === "ready-no-pending-candidates");
  const recommendedCandidate =
    selectedPacket?.candidateReviewAutopilot.recommendedCandidate;
  const base = {
    blockedBySafety: packets.filter(
      (packet) => packet.candidateReviewAutopilot.status === "blocked-by-safety"
    ).length,
    nextAction:
      selectedPacket?.candidateReviewAutopilot.nextAction ??
      "Add claim scopes before candidate review autopilot can route source decisions.",
    noAutoAccept: true,
    noAutoExtraction: true,
    noAutoPromotion: true,
    noAutoReject: true,
    readyNoPendingCandidates: packets.filter(
      (packet) =>
        packet.candidateReviewAutopilot.status === "ready-no-pending-candidates"
    ).length,
    reviewPendingCandidate: packets.filter(
      (packet) =>
        packet.candidateReviewAutopilot.status === "review-pending-candidate"
    ).length,
    summarizeLimitations: packets.filter(
      (packet) => packet.candidateReviewAutopilot.status === "summarize-limitations"
    ).length
  } as const;

  if (!selectedPacket || !recommendedCandidate) {
    return base;
  }

  return {
    ...base,
    recommendedCandidate: {
      claimId: selectedPacket.claim.id,
      ...(selectedPacket.candidateReviewAutopilot.curationDraftCommand
        ? {
            curationDraftCommand:
              selectedPacket.candidateReviewAutopilot.curationDraftCommand
          }
        : {}),
      ...(recommendedCandidate.dedupeKey
        ? {
            dedupeKey: recommendedCandidate.dedupeKey,
            packetPreview: candidatePacketPreviewCommands(
              recommendedCandidate.dedupeKey
            )
          }
        : {}),
      ...(recommendedCandidate.score !== undefined
        ? { score: recommendedCandidate.score }
        : {}),
      ...(recommendedCandidate.scoreBreakdown
        ? { scoreBreakdown: recommendedCandidate.scoreBreakdown }
        : {}),
      ...(recommendedCandidate.rubricVersion
        ? { rubricVersion: recommendedCandidate.rubricVersion }
        : {}),
      ...(recommendedCandidate.source ? { source: recommendedCandidate.source } : {}),
      ...(recommendedCandidate.sourceReputationLabel
        ? { sourceReputationLabel: recommendedCandidate.sourceReputationLabel }
        : {}),
      ...(recommendedCandidate.title ? { title: recommendedCandidate.title } : {}),
      ...(recommendedCandidate.triageRecommendation
        ? { triageRecommendation: recommendedCandidate.triageRecommendation }
        : {})
    }
  };
}

function candidatePacketPreviewCommands(dedupeKey: string) {
  const quotedDedupeKey = quote(dedupeKey);

  return {
    candidateReviewPacketCommand: `npm run ingest:sources -- --candidate-review-packet ${quotedDedupeKey}`,
    curationStatusCommand: `npm run ingest:sources -- --candidate-curation-status ${quotedDedupeKey}`,
    noCandidateDecision: true,
    noExtractionWrite: true,
    noPromotion: true,
    readOnly: true,
    referenceMatchesCommand: `npm run ingest:sources -- --candidate-reference-matches ${quotedDedupeKey}`,
    siblingsCommand: `npm run ingest:sources -- --candidate-siblings ${quotedDedupeKey}`
  } as const;
}

function relevantCandidates(
  candidates: SupplementOnboardingSourceCandidateSignal[],
  supplementId: string,
  claims: Claim[]
) {
  const claimIds = new Set(claims.map((claim) => claim.id));
  const referenceIds = new Set(claims.flatMap((claim) => claim.keyReferenceIds));

  return candidates.filter(
    (candidate) =>
      candidate.interventionId === supplementId ||
      (candidate.claimId ? claimIds.has(candidate.claimId) : false) ||
      (candidate.acceptedReferenceId
        ? referenceIds.has(candidate.acceptedReferenceId)
        : false)
  );
}

function relevantJobs(
  jobs: SupplementOnboardingSourceJobSignal[],
  supplementId: string,
  claimIds: Set<string>
) {
  return jobs.filter(
    (job) =>
      job.interventionId === supplementId ||
      (job.claimId ? claimIds.has(job.claimId) : false)
  );
}

function draftState(claims: Claim[]): SupplementOnboardingDraftState {
  if (claims.length === 0) {
    return "missing-claims";
  }

  const reviewedClaims = claims.filter((claim) => claim.reviewStatus === "Human reviewed").length;

  if (reviewedClaims === claims.length) {
    return "reviewed";
  }

  if (reviewedClaims > 0) {
    return "reviewing";
  }

  return "drafted";
}

function queueState(
  sourceSignals: SupplementOnboardingSourceSignals | undefined,
  jobs: SupplementOnboardingSourceJobSignal[]
): SupplementOnboardingQueueState {
  if (sourceSignals?.unavailableReason) {
    return "unavailable";
  }

  if (jobs.length === 0) {
    return "missing";
  }

  const statuses = new Set(jobs.map((job) => normalizeStatus(job.status)));

  if (statuses.has("FAILED")) {
    return statuses.size === 1 ? "failed" : "mixed";
  }

  if (statuses.has("RUNNING")) {
    return "running";
  }

  if (statuses.has("QUEUED")) {
    return "queued";
  }

  if (Array.from(statuses).every((status) => status === "SUCCEEDED" || status === "SKIPPED")) {
    return "completed";
  }

  return "mixed";
}

function candidateState(
  sourceSignals: SupplementOnboardingSourceSignals | undefined,
  candidates: SupplementOnboardingSourceCandidateSignal[]
): SupplementOnboardingCandidateState {
  if (sourceSignals?.unavailableReason) {
    return "unavailable";
  }

  return candidates.length > 0 ? "found" : "missing";
}

function extractionState(
  claimCount: number,
  completeClaims: number
): SupplementOnboardingCompletenessState {
  if (claimCount === 0 || completeClaims === 0) {
    return "missing";
  }

  return completeClaims === claimCount ? "complete" : "partial";
}

function reviewPacketState(
  claimCount: number,
  reviewedClaims: number,
  completeClaims: number
): SupplementOnboardingCompletenessState {
  const completeReviewedClaims = Math.min(reviewedClaims, completeClaims);

  if (claimCount === 0 || completeReviewedClaims === 0) {
    return "missing";
  }

  return completeReviewedClaims === claimCount ? "complete" : "partial";
}

function convictionDistribution(candidates: SupplementOnboardingSourceCandidateSignal[]) {
  return candidates.reduce(
    (distribution, candidate) => {
      distribution[convictionBucket(candidate)] += 1;
      return distribution;
    },
    {
      high: 0,
      low: 0,
      moderate: 0,
      unscored: 0,
      veryLow: 0
    }
  );
}

function convictionBucket(
  candidate: SupplementOnboardingSourceCandidateSignal
): keyof SupplementOnboardingQualityRow["convictionDistribution"] {
  const label = candidate.convictionLabel?.trim().toLowerCase();

  if (label === "high") {
    return "high";
  }

  if (label === "moderate") {
    return "moderate";
  }

  if (label === "low") {
    return "low";
  }

  if (label === "very low" || label === "very_low") {
    return "veryLow";
  }

  if (typeof candidate.convictionScore !== "number") {
    return "unscored";
  }

  if (candidate.convictionScore >= 75) {
    return "high";
  }

  if (candidate.convictionScore >= 55) {
    return "moderate";
  }

  if (candidate.convictionScore >= 35) {
    return "low";
  }

  return "veryLow";
}

function summarizeRows(rows: SupplementOnboardingQualityRow[]): SupplementOnboardingQualitySummaryCounts {
  return rows.reduce(
    (summary, row) => {
      summary.supplements += 1;
      summary.totalClaims += row.counts.claims;
      summary.reviewedClaims += row.counts.reviewedClaims;
      summary.sourceJobs += row.counts.sourceJobs;
      summary.queuedJobs += row.states.queue === "queued" ? row.counts.sourceJobs : 0;
      summary.candidates += row.counts.sourceCandidates;
      summary.reviewedCandidates += row.counts.reviewedCandidates;
      summary.acceptedCandidates += row.counts.acceptedCandidates;
      summary.pendingCandidates += row.counts.pendingCandidates;
      summary.extractionCompleteClaims += row.sourcePacket.completeClaims;
      summary.promotionReadyClaims += row.promotion.readyClaims;
      summary.promotionBlockedClaims += row.promotion.blockedClaims;
      summary.safetySignals += row.counts.safetySignals;

      if (row.status === "ready") {
        summary.readySupplements += 1;
      } else if (row.status === "warning") {
        summary.warningSupplements += 1;
      } else {
        summary.blockedSupplements += 1;
      }

      return summary;
    },
    {
      acceptedCandidates: 0,
      blockedSupplements: 0,
      candidates: 0,
      extractionCompleteClaims: 0,
      pendingCandidates: 0,
      promotionBlockedClaims: 0,
      promotionReadyClaims: 0,
      queuedJobs: 0,
      readySupplements: 0,
      reviewedCandidates: 0,
      reviewedClaims: 0,
      safetySignals: 0,
      sourceJobs: 0,
      supplements: 0,
      totalClaims: 0,
      warningSupplements: 0
    }
  );
}

function buildQualityPriorityQueue(
  rows: SupplementOnboardingQualityRow[]
): SupplementOnboardingQualityPriorityItem[] {
  return rows
    .map(qualityPriorityItemForRow)
    .sort(
      (left, right) =>
        left.priority - right.priority ||
        right.safetySignals - left.safetySignals ||
        right.blockers - left.blockers ||
        right.pendingCandidates - left.pendingCandidates ||
        right.promotionReadyClaims - left.promotionReadyClaims ||
        left.name.localeCompare(right.name)
    );
}

function qualityPriorityItemForRow(
  row: SupplementOnboardingQualityRow
): SupplementOnboardingQualityPriorityItem {
  const tier = qualityPriorityTier(row);

  return {
    action: qualityPriorityAction(row, tier),
    blockers: row.blockers.length,
    category: row.supplement.category,
    claims: row.counts.claims,
    id: row.supplement.id,
    name: row.supplement.name,
    pendingCandidates: row.counts.pendingCandidates,
    priority: qualityPriorityValue(tier),
    promotionReadyClaims: row.promotion.readyClaims,
    rationale: qualityPriorityRationale(row),
    safetySignals: row.counts.safetySignals,
    slug: row.supplement.slug,
    status: row.status,
    tier,
    warnings: row.warnings.length
  };
}

function qualityPriorityTier(
  row: SupplementOnboardingQualityRow
): SupplementOnboardingQualityPriorityTier {
  if (row.status === "blocked") {
    return "blocked-setup";
  }

  if (row.counts.safetySignals > 0) {
    return "safety-caveat-review";
  }

  if (row.counts.pendingCandidates > 0) {
    return "source-candidate-review";
  }

  if (row.status === "warning") {
    return "warning-review";
  }

  if (row.sourcePacket.extractionPendingClaims > 0) {
    return "extraction-review";
  }

  if (row.promotion.readyClaims > 0) {
    return "promotion-review";
  }

  return "monitor";
}

function qualityPriorityValue(tier: SupplementOnboardingQualityPriorityTier) {
  if (tier === "blocked-setup") {
    return 10;
  }

  if (tier === "safety-caveat-review") {
    return 20;
  }

  if (tier === "source-candidate-review") {
    return 30;
  }

  if (tier === "warning-review") {
    return 40;
  }

  if (tier === "extraction-review") {
    return 50;
  }

  if (tier === "promotion-review") {
    return 60;
  }

  return 70;
}

function qualityPriorityAction(
  row: SupplementOnboardingQualityRow,
  tier: SupplementOnboardingQualityPriorityTier
) {
  if (tier === "blocked-setup") {
    return row.nextAction;
  }

  if (tier === "safety-caveat-review") {
    return "Review accepted-packet safety/watchlist caveats before promotion.";
  }

  if (tier === "source-candidate-review") {
    return "Review pending source candidates and record explicit accept/reject decisions.";
  }

  if (tier === "warning-review") {
    return row.nextAction;
  }

  if (tier === "extraction-review") {
    return "Complete structured extraction and citation traceability checks.";
  }

  if (tier === "promotion-review") {
    return "Review promotion readiness diffs before any explicit promotion action.";
  }

  return "Monitor reviewed packet status and refresh source coverage when needed.";
}

function qualityPriorityRationale(row: SupplementOnboardingQualityRow) {
  return [
    `${row.status} onboarding status.`,
    row.blockers.length > 0 ? `${row.blockers.length} blocker(s) remain.` : undefined,
    row.warnings.length > 0 ? `${row.warnings.length} warning(s) need review.` : undefined,
    row.counts.safetySignals > 0
      ? `${row.counts.safetySignals} safety/watchlist signal(s) need caveat review.`
      : undefined,
    row.counts.pendingCandidates > 0
      ? `${row.counts.pendingCandidates} pending source candidate(s) need explicit review.`
      : undefined,
    row.sourcePacket.extractionPendingClaims > 0
      ? `${row.sourcePacket.extractionPendingClaims} claim(s) still need structured extraction.`
      : undefined,
    row.promotion.readyClaims > 0
      ? `${row.promotion.readyClaims}/${row.promotion.totalClaims} claim(s) are promotion-review ready.`
      : undefined
  ].filter((item): item is string => Boolean(item));
}

function compareQualityRows(
  left: SupplementOnboardingQualityRow,
  right: SupplementOnboardingQualityRow
) {
  return (
    statusRank(left.status) - statusRank(right.status) ||
    right.blockers.length - left.blockers.length ||
    left.supplement.name.localeCompare(right.supplement.name)
  );
}

function statusRank(status: SupplementOnboardingQualityStatus) {
  if (status === "blocked") {
    return 0;
  }

  if (status === "warning") {
    return 1;
  }

  return 2;
}

function normalizeDecision(decision: string) {
  const normalized = decision.trim().toUpperCase().replace(/\s+/g, "_");

  if (normalized === "ACCEPTED") {
    return "ACCEPTED";
  }

  if (normalized === "REJECTED") {
    return "REJECTED";
  }

  return "PENDING_REVIEW";
}

function normalizeStatus(status: string) {
  return status.trim().toUpperCase().replace(/\s+/g, "_");
}

function quote(value: string) {
  return JSON.stringify(value);
}

function uniqueNonEmpty(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
