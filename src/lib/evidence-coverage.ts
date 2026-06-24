import {
  buildClaimSourcePacket,
  type ClaimSourcePacketCompletenessStatus,
  summarizeClaimSourcePackets
} from "@/lib/source-packet";
import {
  compositeScore,
  confidenceWeightFromAiScore,
  confidenceWeightedScore
} from "@/lib/scoring";
import type {
  Claim,
  ConfidenceLevel,
  EvidenceDashboardData,
  EvidenceLabel,
  Intervention,
  Reference,
  Study
} from "@/lib/types";

export interface EvidenceCoverageClaimGap {
  claimId: string;
  interventionId: string;
  packetStatus: string;
  reviewStatus: string;
}

export interface EvidenceCoverageInterventionGap {
  interventionId: string;
  interventionName: string;
  nextAction: string;
}

export interface EvidenceCoverageReviewBacklogItem {
  claimId: string;
  confidenceLevel: ConfidenceLevel;
  extractedReferences: number;
  finalLabel: EvidenceLabel;
  interventionId: string;
  nextAction: string;
  outcome: Claim["outcome"];
  packetStatus: ClaimSourcePacketCompletenessStatus;
  priority: number;
  priorityReasons: string[];
  rawCompositeScore: number;
  referenceCount: number;
  reviewStatus: string;
}

export type EvidenceCoverageAiPreReviewStatus =
  | "codex-preflight-blocked"
  | "codex-preflight-passed";

export interface EvidenceCoverageHumanReviewQueue {
  aiCrossCheckRecommended: number;
  aiConfidenceAverage: number;
  aiPreReviewed: number;
  blockedBySourcePacket: number;
  humanOwned: true;
  items: EvidenceCoverageHumanReviewQueueItem[];
  nextAction: string;
  noAiApproval: true;
  noMedicalAdvice: true;
  noAutoPromotion: true;
  noPublicEvidenceRowsWritten: true;
  readOnly: true;
  total: number;
}

export interface EvidenceCoverageHumanReviewQueueItem {
  aiConfidenceRationale: string[];
  aiConfidenceScore: number;
  aiConfidenceSummary: string;
  aiPreReviewExplanation: string;
  aiPreReviewLabel: string;
  aiPreReviewStatus: EvidenceCoverageAiPreReviewStatus;
  chatGptProPrompt: string;
  claimId: string;
  confidenceLevel: ConfidenceLevel;
  confirmationRequirement: string;
  confidenceWeight: number;
  confidenceWeightedScore: number;
  confidenceWeightedScoreExplanation: string;
  extractedReferences: number;
  finalLabel: EvidenceLabel;
  highAttention: boolean;
  highAttentionReasons: string[];
  humanDecisionGate: string;
  interventionId: string;
  interventionName: string;
  nextAction: string;
  operatorHref: string;
  outcome: Claim["outcome"];
  packetStatus: ClaimSourcePacketCompletenessStatus;
  priority: number;
  priorityReasons: string[];
  rawCompositeScore: number;
  referenceCount: number;
  reviewFocus: string[];
  reviewOrder: number;
  reviewPacketCommand: string;
  reviewStatus: string;
}

export interface EvidenceCoverageReviewSampleItem {
  claimBoundary: EvidenceCoverageReviewBoundary;
  claimId: string;
  envFileReviewPacketCommand: string;
  humanDecisionGate: string;
  interventionId: string;
  nextAction: string;
  outcome: Claim["outcome"];
  priority: number;
  priorityReasons: string[];
  referenceIds: string[];
  referenceSummaries: EvidenceCoverageReviewReferenceSummary[];
  reviewChecklist: string[];
  reviewPacketCommand: string;
  sourcePacketStatus: ClaimSourcePacketCompletenessStatus;
  studyIds: string[];
  studySummaries: EvidenceCoverageReviewStudySummary[];
}

export type EvidenceCoverageClaimReviewStatus =
  | "already-reviewed"
  | "incomplete-source-packet"
  | "not-found"
  | "ready-for-review";

export interface EvidenceCoverageClaimReviewPacket {
  claimId: string;
  found: boolean;
  humanOwned: true;
  nextAction: string;
  readOnly: true;
  reviewBacklogItem: EvidenceCoverageReviewBacklogItem | null;
  reviewContext: EvidenceCoverageReviewSampleItem | null;
  status: EvidenceCoverageClaimReviewStatus;
}

export interface EvidenceCoverageReadyClaimReviewBatch {
  claimIds: string[];
  claimPackets: EvidenceCoverageClaimReviewPacket[];
  humanOwned: true;
  nextAction: string;
  readOnly: true;
  readyClaims: number;
}

export interface EvidenceCoverageReviewBoundary {
  confidenceLevel: ConfidenceLevel;
  doseFormStudied: string;
  durationStudied: string;
  finalLabel: EvidenceLabel;
  populationStudied: string;
  reviewStatus: Claim["reviewStatus"];
}

export interface EvidenceCoverageReviewSamplingPlan {
  batchSize: number;
  items: EvidenceCoverageReviewSampleItem[];
  nextAction: string;
  readyClaims: number;
}

export interface EvidenceCoverageReviewReferenceSummary {
  id: string;
  identifier?: string;
  source: string;
  title: string;
  url: string;
  year?: number;
}

export interface EvidenceCoverageReviewStudySummary {
  adverseEvents: string;
  fundingConflicts: string;
  id: string;
  outcomes: string[];
  population: string;
  referenceId: string;
  riskOfBias: string;
  sampleSize: string;
  source: string;
  sourceTypeTaxonomy?: Study["sourceTypeTaxonomy"];
  studyType: Study["studyType"];
  title: string;
  year: number;
}

export interface EvidenceCoverageWorksheet {
  coverageGaps: EvidenceCoverageInterventionGap[];
  copySafeCommands: EvidenceCoverageCommand[];
  humanOwned: true;
  nextHumanAction: string;
  readyReviewBatch: EvidenceCoverageReviewSampleItem[];
  readySourcePackets: EvidenceCoverageWorksheetClaimItem[];
  remainingBacklog: EvidenceCoverageWorksheetClaimItem[];
}

export interface EvidenceCoverageCommand {
  command: string;
  id: string;
  label: string;
  mode: "read-only";
  purpose: string;
}

export interface EvidenceCoverageExpansionReadiness {
  blockingClaims: EvidenceCoverageExpansionBlockingClaim[];
  blockers: string[];
  candidateBatchSize: {
    maximum: 10;
    minimum: 5;
  };
  candidateReviewCommands: EvidenceCoverageCommand[];
  humanOwned: true;
  milestoneReviewClaims: EvidenceCoverageExpansionBlockingClaim[];
  nextAction: string;
  noAutoPromotion: true;
  noPublicEvidenceRowsWritten: true;
  readySignals: string[];
  status: "blocked" | "ready";
}

export interface EvidenceCoverageExpansionBlockingClaim {
  claimId: string;
  interventionId: string;
  nextAction: string;
  outcome: Claim["outcome"];
  packetStatus: ClaimSourcePacketCompletenessStatus;
  priority: number;
  priorityReasons: string[];
  reviewStatus: string;
}

export interface EvidenceCoverageWorksheetClaimItem {
  claimId: string;
  envFileReviewPacketCommand: string;
  extractedReferences: number;
  humanDecisionGate: string;
  interventionId: string;
  nextAction: string;
  packetStatus: ClaimSourcePacketCompletenessStatus;
  priority: number;
  priorityReasons: string[];
  referenceCount: number;
  reviewOrder: number;
  reviewPacketCommand: string;
  reviewStatus: string;
}

export interface EvidenceCoverageSummary {
  claimReviewBacklog: EvidenceCoverageReviewBacklogItem[];
  completeSourcePackets: number;
  expansionReadiness: EvidenceCoverageExpansionReadiness;
  humanReviewedClaims: number;
  incompleteClaims: EvidenceCoverageClaimGap[];
  interventionGaps: EvidenceCoverageInterventionGap[];
  interventionsWithClaims: number;
  interventionsWithoutClaims: string[];
  reviewSamplingPlan: EvidenceCoverageReviewSamplingPlan;
  totalClaims: number;
  totalInterventions: number;
  unreviewedClaims: number;
  worksheet: EvidenceCoverageWorksheet;
}

export interface EvidenceCoverageReviewReportSummary {
  counts: EvidenceCoverageReviewReportSummaryCounts;
  coverageGaps: EvidenceCoverageInterventionGap[];
  expansionReadiness: EvidenceCoverageExpansionReadiness;
  humanOwned: true;
  nextAction: string;
  readOnly: true;
  readyReviewClaims: EvidenceCoverageWorksheetClaimItem[];
  sampledReviewClaims: EvidenceCoverageReviewReportSampleItem[];
}

export interface EvidenceCoverageReviewReportSummaryCounts {
  completeSourcePackets: number;
  coverageGaps: number;
  humanReviewedClaims: number;
  incompleteClaims: number;
  interventionsWithClaims: number;
  interventionsWithoutClaims: number;
  readyReviewBatch: number;
  readySourcePackets: number;
  totalClaims: number;
  totalInterventions: number;
  unreviewedClaims: number;
}

export interface EvidenceCoverageReviewReportSampleItem {
  claimId: string;
  interventionId: string;
  outcome: Claim["outcome"];
  priority: number;
  priorityReasons: string[];
  referenceIds: string[];
  sourcePacketStatus: ClaimSourcePacketCompletenessStatus;
  studyIds: string[];
}

export function summarizeEvidenceCoverage(data: EvidenceDashboardData): EvidenceCoverageSummary {
  const referencesById = new Map(data.references.map((reference) => [reference.id, reference]));
  const sourcePacketSummary = summarizeClaimSourcePackets({
    claims: data.claims,
    referencesById,
    studies: data.studies
  });
  const claimInterventionIds = new Set(data.claims.map((claim) => claim.interventionId));
  const incompleteClaims = data.claims.flatMap((claim) => {
    const packet = buildClaimSourcePacket({
      claim,
      referencesById,
      studies: data.studies
    });

    if (packet.completeness.status === "complete" && reviewStatusIsReviewed(claim.reviewStatus)) {
      return [];
    }

    return [
      {
        claimId: claim.id,
        interventionId: claim.interventionId,
        packetStatus: packet.completeness.status,
        reviewStatus: claim.reviewStatus
      }
    ];
  });
  const claimReviewBacklog = data.claims
    .map((claim) => {
      const packet = buildClaimSourcePacket({
        claim,
        referencesById,
        studies: data.studies
      });

      return evidenceCoverageReviewBacklogItem({ claim, packet });
    })
    .filter((item): item is EvidenceCoverageReviewBacklogItem => Boolean(item))
    .sort(compareReviewBacklogItems);
  const reviewSamplingPlan = evidenceCoverageReviewSamplingPlan({
    claimReviewBacklog,
    claims: data.claims,
    referencesById,
    studies: data.studies
  });
  const interventionGaps = data.interventions
    .filter((intervention) => !claimInterventionIds.has(intervention.id))
    .map((intervention) => ({
      interventionId: intervention.id,
      interventionName: intervention.name,
      nextAction:
        "Add at least one scoped claim with curated source links before treating this intervention as covered."
    }))
    .sort((left, right) => left.interventionId.localeCompare(right.interventionId));

  return {
    claimReviewBacklog,
    completeSourcePackets: sourcePacketSummary.completeClaims,
    expansionReadiness: evidenceExpansionReadiness({
      claimReviewBacklog,
      completeSourcePackets: sourcePacketSummary.completeClaims,
      interventionGaps,
      totalClaims: data.claims.length
    }),
    humanReviewedClaims: data.claims.filter((claim) => claim.reviewStatus === "Human reviewed")
      .length,
    incompleteClaims,
    interventionGaps,
    interventionsWithClaims: claimInterventionIds.size,
    interventionsWithoutClaims: interventionGaps.map((gap) => gap.interventionId),
    reviewSamplingPlan,
    totalClaims: data.claims.length,
    totalInterventions: data.interventions.length,
    unreviewedClaims: data.claims.filter((claim) => !reviewStatusIsReviewed(claim.reviewStatus))
      .length,
    worksheet: evidenceCoverageWorksheet({
      claimReviewBacklog,
      interventionGaps,
      reviewSamplingPlan
    })
  };
}

export function buildEvidenceHumanReviewQueue(
  data: EvidenceDashboardData,
  options: {
    limit?: number;
  } = {}
): EvidenceCoverageHumanReviewQueue {
  const summary = summarizeEvidenceCoverage(data);
  const interventionsById = new Map(
    data.interventions.map((intervention) => [intervention.id, intervention])
  );
  const backlog = summary.claimReviewBacklog.filter(
    (item) => !reviewStatusIsReviewed(item.reviewStatus)
  );
  const limitedBacklog =
    typeof options.limit === "number" ? backlog.slice(0, options.limit) : backlog;
  const items = limitedBacklog.map((item, index) =>
    evidenceCoverageHumanReviewQueueItem({
      interventionCategory: interventionsById.get(item.interventionId)?.category,
      item,
      interventionName:
        interventionsById.get(item.interventionId)?.name ?? item.interventionId,
      reviewOrder: index + 1
    })
  );
  const aiPreReviewed = items.filter(
    (item) => item.aiPreReviewStatus === "codex-preflight-passed"
  ).length;
  const aiConfidenceAverage =
    items.length > 0
      ? Math.round(items.reduce((total, item) => total + item.aiConfidenceScore, 0) / items.length)
      : 0;
  const blockedBySourcePacket = items.length - aiPreReviewed;
  const aiCrossCheckRecommended = items.filter((item) => item.highAttention).length;

  return {
    aiCrossCheckRecommended,
    aiConfidenceAverage,
    aiPreReviewed,
    blockedBySourcePacket,
    humanOwned: true,
    items,
    nextAction:
      items.length > 0
        ? "Use AI evidence-confidence scores as quick-iteration decision support; low confidence is acceptable when the source packet is weak or claim fit is uncertain."
        : backlog.length > 0
          ? "Resolve source-packet blockers before AI confidence can be scored cleanly."
          : "No claims currently need AI confidence scoring.",
    noAiApproval: true,
    noMedicalAdvice: true,
    noAutoPromotion: true,
    noPublicEvidenceRowsWritten: true,
    readOnly: true,
    total: backlog.length
  };
}

export function buildEvidenceHumanConfirmationQueue(
  data: EvidenceDashboardData,
  options: {
    limit?: number;
  } = {}
): EvidenceCoverageHumanReviewQueue {
  const referencesById = new Map(data.references.map((reference) => [reference.id, reference]));
  const interventionsById = new Map(
    data.interventions.map((intervention) => [intervention.id, intervention])
  );
  const backlog = data.claims
    .flatMap((claim) => {
      const packet = buildClaimSourcePacket({
        claim,
        referencesById,
        studies: data.studies
      });

      if (claim.reviewStatus !== "AI reviewed" || packet.completeness.status !== "complete") {
        return [];
      }

      return [
        evidenceCoverageHumanConfirmationBacklogItem({
          claim,
          packet
        })
      ];
    })
    .sort(compareReviewBacklogItems);
  const limitedBacklog =
    typeof options.limit === "number" ? backlog.slice(0, options.limit) : backlog;
  const items = limitedBacklog.map((item, index) =>
    evidenceCoverageHumanReviewQueueItem({
      interventionCategory: interventionsById.get(item.interventionId)?.category,
      item,
      interventionName:
        interventionsById.get(item.interventionId)?.name ?? item.interventionId,
      reviewOrder: index + 1
    })
  );
  const aiPreReviewed = items.filter(
    (item) => item.aiPreReviewStatus === "codex-preflight-passed"
  ).length;
  const aiConfidenceAverage =
    items.length > 0
      ? Math.round(items.reduce((total, item) => total + item.aiConfidenceScore, 0) / items.length)
      : 0;

  return {
    aiCrossCheckRecommended: items.filter((item) => item.highAttention).length,
    aiConfidenceAverage,
    aiPreReviewed,
    blockedBySourcePacket: items.length - aiPreReviewed,
    humanOwned: true,
    items,
    nextAction:
      items.length > 0
        ? "Human may confirm these AI-reviewed complete source packets after checking cited references, extraction, uncertainty, and caveats."
        : "No AI-reviewed complete source packets are waiting for human confirmation.",
    noAiApproval: true,
    noMedicalAdvice: true,
    noAutoPromotion: true,
    noPublicEvidenceRowsWritten: true,
    readOnly: true,
    total: backlog.length
  };
}

export function summarizeEvidenceCoverageReviewReport(
  summary: EvidenceCoverageSummary
): EvidenceCoverageReviewReportSummary {
  return {
    counts: {
      completeSourcePackets: summary.completeSourcePackets,
      coverageGaps: summary.interventionGaps.length,
      humanReviewedClaims: summary.humanReviewedClaims,
      incompleteClaims: summary.incompleteClaims.length,
      interventionsWithClaims: summary.interventionsWithClaims,
      interventionsWithoutClaims: summary.interventionsWithoutClaims.length,
      readyReviewBatch: summary.worksheet.readyReviewBatch.length,
      readySourcePackets: summary.worksheet.readySourcePackets.length,
      totalClaims: summary.totalClaims,
      totalInterventions: summary.totalInterventions,
      unreviewedClaims: summary.unreviewedClaims
    },
    coverageGaps: summary.worksheet.coverageGaps,
    expansionReadiness: summary.expansionReadiness,
    humanOwned: true,
    nextAction: summary.worksheet.nextHumanAction,
    readOnly: true,
    readyReviewClaims: summary.worksheet.readySourcePackets,
    sampledReviewClaims: summary.worksheet.readyReviewBatch.map(
      evidenceCoverageReviewReportSampleItem
    )
  };
}

export function summarizeEvidenceCoverageClaimReview(
  data: EvidenceDashboardData,
  claimId: string
): EvidenceCoverageClaimReviewPacket {
  const claim = data.claims.find((item) => item.id === claimId);

  if (!claim) {
    return {
      claimId,
      found: false,
      humanOwned: true,
      nextAction: `No claim found for ${claimId}; rerun npm run coverage:review to inspect valid claim IDs.`,
      readOnly: true,
      reviewBacklogItem: null,
      reviewContext: null,
      status: "not-found"
    };
  }

  const referencesById = new Map(data.references.map((reference) => [reference.id, reference]));
  const packet = buildClaimSourcePacket({
    claim,
    referencesById,
    studies: data.studies
  });
  const reviewBacklogItem = evidenceCoverageReviewBacklogItem({ claim, packet });

  if (!reviewBacklogItem) {
    return {
      claimId,
      found: true,
      humanOwned: true,
      nextAction:
        "Claim already has a complete reviewed source packet; rerun aggregate launch readiness before changing scope.",
      readOnly: true,
      reviewBacklogItem: null,
      reviewContext: evidenceCoverageReviewSampleItem({
        claim,
        packet,
        priority: 0,
        priorityReasons: [`${claim.reviewStatus} claim`]
      }),
      status: "already-reviewed"
    };
  }

  return {
    claimId,
    found: true,
    humanOwned: true,
    nextAction:
      reviewBacklogItem.packetStatus === "complete" && !reviewStatusIsReviewed(claim.reviewStatus)
        ? "Codex may mark this claim packet AI reviewed after cited references and structured extraction are checked."
        : reviewBacklogItem.nextAction,
    readOnly: true,
    reviewBacklogItem,
    reviewContext: evidenceCoverageReviewSampleItem({
      claim,
      packet,
      priority: reviewBacklogItem.priority,
      priorityReasons: reviewBacklogItem.priorityReasons
    }),
    status:
      reviewBacklogItem.packetStatus === "complete"
        ? "ready-for-review"
      : "incomplete-source-packet"
  };
}

export function summarizeEvidenceCoverageReadyClaimReviews(
  data: EvidenceDashboardData
): EvidenceCoverageReadyClaimReviewBatch {
  const summary = summarizeEvidenceCoverage(data);
  const claimIds = summary.worksheet.readySourcePackets.map((item) => item.claimId);
  const claimPackets = claimIds.map((claimId) =>
    summarizeEvidenceCoverageClaimReview(data, claimId)
  );

  return {
    claimIds,
    claimPackets,
    humanOwned: true,
    nextAction:
      claimPackets.length > 0
        ? "Review these packets in priority order; Codex may mark them AI reviewed through the authenticated operator workflow."
        : "No complete unreviewed source packets are ready for review.",
    readOnly: true,
    readyClaims: claimPackets.length
  };
}

function evidenceExpansionReadiness({
  claimReviewBacklog,
  completeSourcePackets,
  interventionGaps,
  totalClaims
}: {
  claimReviewBacklog: EvidenceCoverageReviewBacklogItem[];
  completeSourcePackets: number;
  interventionGaps: EvidenceCoverageInterventionGap[];
  totalClaims: number;
}): EvidenceCoverageExpansionReadiness {
  const blockingClaims = claimReviewBacklog
    .filter((item) => item.packetStatus !== "complete")
    .map(evidenceCoverageExpansionBlockingClaim);
  const milestoneReviewClaims = claimReviewBacklog
    .filter(
      (item) =>
        item.packetStatus === "complete" && !reviewStatusIsReviewed(item.reviewStatus)
    )
    .map(evidenceCoverageExpansionBlockingClaim);
  const blockers = [
    ...(completeSourcePackets < totalClaims
      ? [
          `${totalClaims - completeSourcePackets} current claim(s) still need complete source packets before expansion.`
        ]
      : []),
    ...(interventionGaps.length > 0
      ? [
          `${interventionGaps.length} current intervention(s) still need at least one scoped claim.`
        ]
      : [])
  ];

  return {
    blockingClaims,
    blockers,
    candidateBatchSize: {
      maximum: 10,
      minimum: 5
    },
    candidateReviewCommands: expansionCandidateReviewCommands(),
    humanOwned: true,
    milestoneReviewClaims,
    nextAction:
      blockers.length > 0
        ? "Resolve source-packet or intervention-shape blockers before expanding the evidence map."
        : milestoneReviewClaims.length > 0
          ? `Continue quick iteration; batch ${milestoneReviewClaims.length} complete claim review(s) into the next milestone review.`
          : "Prepare a reviewed 5-10 intervention onboarding batch with scoped claims, citation-linked source packets, and safety/regulatory caveats.",
    noAutoPromotion: true,
    noPublicEvidenceRowsWritten: true,
    readySignals:
      blockers.length > 0
        ? []
        : [
            completeSourcePackets === totalClaims
              ? "Current public claims have complete source packets."
              : "Current public claims still need source-packet completion.",
            milestoneReviewClaims.length > 0
              ? "Complete-but-unreviewed claim packets are queued for milestone review instead of blocking quick iteration."
              : "Current public claims have AI-reviewed or human-reviewed complete source packets.",
            "Current intervention coverage has no empty intervention rows.",
            "Expansion can proceed through onboarding/review-kit commands only."
          ],
    status: blockers.length > 0 ? "blocked" : "ready"
  };
}

function evidenceCoverageExpansionBlockingClaim(
  item: EvidenceCoverageReviewBacklogItem
): EvidenceCoverageExpansionBlockingClaim {
  return {
    claimId: item.claimId,
    interventionId: item.interventionId,
    nextAction: item.nextAction,
    outcome: item.outcome,
    packetStatus: item.packetStatus,
    priority: item.priority,
    priorityReasons: item.priorityReasons,
    reviewStatus: item.reviewStatus
  };
}

function expansionCandidateReviewCommands(): EvidenceCoverageCommand[] {
  return [
    {
      command: "npm run onboarding:guide -- --name <supplement-name> --summary",
      id: "onboarding-draft-guide",
      label: "Preview one draft onboarding guide",
      mode: "read-only",
      purpose:
        "Preview a new intervention onboarding packet without writing seed, database, source-candidate, or public evidence rows."
    },
    {
      command: "npm run onboarding:guide -- --batch-file <reviewed-expansion-batch.json> --summary",
      id: "onboarding-draft-batch-guide",
      label: "Preview reviewed expansion batch",
      mode: "read-only",
      purpose:
        "Preview a 5-10 intervention onboarding batch after humans define scoped claims and source targets."
    },
    {
      command: "npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 10",
      id: "candidate-review-overview",
      label: "Review source-candidate backlog",
      mode: "read-only",
      purpose:
        "Inspect pending source candidates that may support future curated intervention expansion."
    }
  ];
}

function evidenceCoverageWorksheet({
  claimReviewBacklog,
  interventionGaps,
  reviewSamplingPlan
}: {
  claimReviewBacklog: EvidenceCoverageReviewBacklogItem[];
  interventionGaps: EvidenceCoverageInterventionGap[];
  reviewSamplingPlan: EvidenceCoverageReviewSamplingPlan;
}): EvidenceCoverageWorksheet {
  const readySourcePackets = claimReviewBacklog
    .filter(
      (item) =>
        !reviewStatusIsReviewed(item.reviewStatus) && item.packetStatus === "complete"
    )
    .map((item, index) => evidenceCoverageWorksheetClaimItem(item, index + 1));
  const remainingBacklog = claimReviewBacklog
    .filter(
      (item) =>
        reviewStatusIsReviewed(item.reviewStatus) || item.packetStatus !== "complete"
    )
    .map((item, index) => evidenceCoverageWorksheetClaimItem(item, index + 1));

  return {
    coverageGaps: interventionGaps,
    copySafeCommands: evidenceCoverageCopySafeCommands(),
    humanOwned: true,
    nextHumanAction:
      reviewSamplingPlan.items.length > 0
        ? reviewSamplingPlan.nextAction
        : interventionGaps[0]?.nextAction ??
          claimReviewBacklog[0]?.nextAction ??
          "Coverage review is complete; review launch readiness before expanding scope.",
    readyReviewBatch: reviewSamplingPlan.items,
    readySourcePackets,
    remainingBacklog
  };
}

function evidenceCoverageCopySafeCommands(): EvidenceCoverageCommand[] {
  return [
    {
      command: "npm run coverage:review",
      id: "coverage-review",
      label: "Refresh coverage review",
      mode: "read-only",
      purpose:
        "Recheck source-packet coverage, review backlog, sampled review batch, and intervention gaps without changing review status."
    },
    {
      command: "npm run coverage:review -- --summary",
      id: "coverage-review-summary",
      label: "Refresh compact coverage summary",
      mode: "read-only",
      purpose:
        "Print coverage counts, sampled review claims, ready review claims, gaps, and next action without dumping the full review report."
    },
    {
      command: "npm run coverage:review -- --env-file <non-production-env-file> --summary",
      id: "coverage-review-env-file-summary",
      label: "Refresh compact coverage summary from env file",
      mode: "read-only",
      purpose:
        "Print coverage counts from an approved non-production env file without dumping secrets or changing review status."
    },
    {
      command: "npm run coverage:review -- --claim <claim-id>",
      id: "coverage-claim-review",
      label: "Focus one claim review packet",
      mode: "read-only",
      purpose:
        "Print one claim's source-packet boundary, checklist, references, and structured study IDs for AI or human review."
    },
    {
      command: "npm run coverage:review -- --ready-claim-packets",
      id: "coverage-ready-claim-packets",
      label: "Print all ready claim packets",
      mode: "read-only",
      purpose:
        "Print full read-only AI-review packets for all complete unreviewed claims in priority order."
    },
    {
      command: "npm run regulatory:review",
      id: "regulatory-review",
      label: "Refresh AU/TGA review",
      mode: "read-only",
      purpose:
        "Recheck product-level AU/TGA unknown/stale states before updating coverage decisions."
    },
    {
      command: "npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 10",
      id: "candidate-review-overview",
      label: "Review pending source candidates",
      mode: "read-only",
      purpose:
        "Inspect pending source-candidate groups that may support future curated coverage expansion."
    },
    {
      command: "npm run ingest:sources -- --candidate-review-flags --candidate-review-flags-limit 10",
      id: "candidate-review-flags",
      label: "Review flagged source candidates",
      mode: "read-only",
      purpose:
        "Inspect broad safety or low-overlap candidate groups before any human curation decision."
    },
    {
      command: "npm run ingest:sources -- --candidate-curation-handoff --candidate-curation-handoff-limit 10",
      id: "candidate-curation-handoff",
      label: "Review accepted candidate curation",
      mode: "read-only",
      purpose:
        "Inspect accepted source candidates that still need claim linking or structured extraction before public source-packet use."
    },
    {
      command: "npm run launch:readiness",
      id: "launch-readiness",
      label: "Refresh aggregate launch readiness",
      mode: "read-only",
      purpose: "Recheck fully-live launch gates after evidence coverage review changes."
    }
  ];
}

function evidenceCoverageReviewReportSampleItem(
  item: EvidenceCoverageReviewSampleItem
): EvidenceCoverageReviewReportSampleItem {
  return {
    claimId: item.claimId,
    interventionId: item.interventionId,
    outcome: item.outcome,
    priority: item.priority,
    priorityReasons: item.priorityReasons,
    referenceIds: item.referenceIds,
    sourcePacketStatus: item.sourcePacketStatus,
    studyIds: item.studyIds
  };
}

function evidenceCoverageWorksheetClaimItem(
  item: EvidenceCoverageReviewBacklogItem,
  reviewOrder: number
): EvidenceCoverageWorksheetClaimItem {
  return {
    claimId: item.claimId,
    envFileReviewPacketCommand: coverageClaimReviewEnvFileCommand(item.claimId),
    extractedReferences: item.extractedReferences,
    humanDecisionGate: evidenceCoverageHumanDecisionGate(item.claimId),
    interventionId: item.interventionId,
    nextAction: item.nextAction,
    packetStatus: item.packetStatus,
    priority: item.priority,
    priorityReasons: item.priorityReasons,
    referenceCount: item.referenceCount,
    reviewOrder,
    reviewPacketCommand: coverageClaimReviewCommand(item.claimId),
    reviewStatus: item.reviewStatus
  };
}

function evidenceCoverageHumanReviewQueueItem({
  interventionCategory,
  interventionName,
  item,
  reviewOrder
}: {
  interventionCategory?: Intervention["category"];
  interventionName: string;
  item: EvidenceCoverageReviewBacklogItem;
  reviewOrder: number;
}): EvidenceCoverageHumanReviewQueueItem {
  const readyForHumanReview =
    item.packetStatus === "complete" && item.reviewStatus !== "Human reviewed";
  const highAttentionReasons = readyForHumanReview
    ? evidenceCoverageHighAttentionReasons({ interventionCategory, item })
    : [];
  const highAttention = highAttentionReasons.length > 0;
  const aiConfidence = evidenceCoverageAiConfidence({ highAttention, item });
  const confidenceWeight = confidenceWeightFromAiScore(aiConfidence.score);
  const weightedScore = confidenceWeightedScore(item.rawCompositeScore, aiConfidence.score);

  return {
    aiConfidenceRationale: aiConfidence.rationale,
    aiConfidenceScore: aiConfidence.score,
    aiConfidenceSummary: aiConfidence.summary,
    aiPreReviewExplanation: readyForHumanReview
      ? highAttention
        ? "Codex scored this as a high-attention evidence packet because safety, regulatory, or peptide-specific caveats materially affect confidence."
        : "Codex scored this evidence packet from citation traceability, source-packet completeness, claim fit, uncertainty, and caveats."
      : "Codex cannot score this packet cleanly until the source packet is complete.",
    aiPreReviewLabel: readyForHumanReview
      ? "AI confidence scored"
      : "AI scoring blocked",
    aiPreReviewStatus: readyForHumanReview
      ? "codex-preflight-passed"
      : "codex-preflight-blocked",
    chatGptProPrompt: evidenceCoverageChatGptProPrompt({
      highAttentionReasons,
      interventionName,
      item
    }),
    claimId: item.claimId,
    confidenceLevel: item.confidenceLevel,
    confirmationRequirement:
      "AI confidence is a transparent model judgment for quick iteration. It is not individualized medical advice, qualified clinical review, or product-level TGA/ARTG clearance.",
    confidenceWeight,
    confidenceWeightedScore: weightedScore,
    confidenceWeightedScoreExplanation: `Confidence-weighted score uses the raw ${item.rawCompositeScore.toFixed(
      1
    )}/10 composite multiplied by ${aiConfidence.score}/100 AI confidence, so low-confidence packets still contribute with lower impact.`,
    extractedReferences: item.extractedReferences,
    finalLabel: item.finalLabel,
    highAttention,
    highAttentionReasons,
    humanDecisionGate: evidenceCoverageHumanDecisionGate(item.claimId),
    interventionId: item.interventionId,
    interventionName,
    nextAction: item.nextAction,
    operatorHref: `/operator?reviewClaim=${encodeURIComponent(item.claimId)}`,
    outcome: item.outcome,
    packetStatus: item.packetStatus,
    priority: item.priority,
    priorityReasons: item.priorityReasons,
    rawCompositeScore: item.rawCompositeScore,
    referenceCount: item.referenceCount,
    reviewFocus: evidenceCoverageHumanReviewFocus(item),
    reviewOrder,
    reviewPacketCommand: coverageClaimReviewCommand(item.claimId),
    reviewStatus: item.reviewStatus
  };
}

function evidenceCoverageHumanReviewFocus(item: EvidenceCoverageReviewBacklogItem) {
  const focus = [
    `Citation traceability: ${item.extractedReferences}/${item.referenceCount} linked reference(s) have structured extraction.`,
    `Claim scope: ${item.outcome} for ${item.interventionId}; current label is ${item.finalLabel}.`,
    `Uncertainty: ${item.confidenceLevel} confidence draft; do not treat the AI score as expert or clinical approval.`
  ];

  if (item.finalLabel === "Regulatory Concern") {
    focus.push(
      "Regulatory caveat: preserve warning framing and avoid peptide sourcing, compounding, injection, cycling, dosing, or self-administration guidance."
    );
  }

  if (item.outcome === "Safety/adverse effects") {
    focus.push(
      "Safety caveat: confirm adverse-event and upper-limit wording does not imply product safety or TGA clearance."
    );
  }

  return focus;
}

function evidenceCoverageAiConfidence({
  highAttention,
  item
}: {
  highAttention: boolean;
  item: EvidenceCoverageReviewBacklogItem;
}) {
  const confidenceBase: Record<ConfidenceLevel, number> = {
    High: 82,
    Moderate: 62,
    Low: 38,
    "Very low": 18
  };
  const labelAdjustment: Partial<Record<EvidenceLabel, number>> = {
    "Avoid / Not Recommended": -10,
    "Core Evidence-Based": 8,
    "Insufficient Evidence": -12,
    "Regulatory Concern": -12,
    "Requires Clinician Oversight": -8,
    "Safety Concern": -10,
    "Speculative Watchlist": -8,
    "Useful for Specific Use Case": 2
  };
  const extractionRatio =
    item.referenceCount > 0 ? item.extractedReferences / item.referenceCount : 0;
  const traceabilityAdjustment = Math.round(extractionRatio * 8);
  const completenessAdjustment = item.packetStatus === "complete" ? 8 : -25;
  const attentionAdjustment = highAttention ? -5 : 0;
  const score = clampAiConfidenceScore(
    confidenceBase[item.confidenceLevel] +
      (labelAdjustment[item.finalLabel] ?? 0) +
      traceabilityAdjustment +
      completenessAdjustment +
      attentionAdjustment
  );

  return {
    rationale: [
      `${item.confidenceLevel} source confidence baseline.`,
      `${item.extractedReferences}/${item.referenceCount} linked reference(s) have structured extraction.`,
      `${item.finalLabel} label shapes the confidence score.`,
      ...(highAttention
        ? ["High-attention safety/regulatory context lowers confidence until caveats are clear."]
        : []),
      "Score is Codex's evidence-confidence estimate, not expert review."
    ],
    score,
    summary: aiConfidenceSummary(score)
  };
}

function clampAiConfidenceScore(score: number) {
  return Math.max(5, Math.min(95, score));
}

function aiConfidenceSummary(score: number) {
  if (score >= 80) {
    return "High AI confidence";
  }

  if (score >= 60) {
    return "Moderate AI confidence";
  }

  if (score >= 35) {
    return "Low AI confidence";
  }

  return "Very low AI confidence";
}

function evidenceCoverageHighAttentionReasons({
  interventionCategory,
  item
}: {
  interventionCategory?: Intervention["category"];
  item: EvidenceCoverageReviewBacklogItem;
}) {
  const reasons: string[] = [];

  if (interventionCategory === "Peptide/biologic") {
    reasons.push("Peptide/biologic scope.");
  }

  if (
    item.finalLabel === "Regulatory Concern" ||
    item.finalLabel === "Safety Concern" ||
    item.finalLabel === "Avoid / Not Recommended" ||
    item.finalLabel === "Requires Clinician Oversight"
  ) {
    reasons.push(`${item.finalLabel} label.`);
  }

  if (item.outcome === "Safety/adverse effects") {
    reasons.push("Safety/adverse-effects outcome.");
  }

  return reasons;
}

function evidenceCoverageChatGptProPrompt({
  highAttentionReasons,
  interventionName,
  item
}: {
  highAttentionReasons: string[];
  interventionName: string;
  item: EvidenceCoverageReviewBacklogItem;
}) {
  if (highAttentionReasons.length === 0) {
    return "";
  }

  return [
    `Please cross-check this Apex Lifespan AI evidence review: ${item.claimId}.`,
    `Intervention: ${interventionName}. Outcome: ${item.outcome}. Current label: ${item.finalLabel}. Confidence: ${item.confidenceLevel}.`,
    `High-attention reasons: ${highAttentionReasons.join(" ")}`,
    `Focus on citation fit, claim scope, uncertainty wording, safety/regulatory caveats, and whether the public wording should stay cautious.`,
    "Do not provide sourcing, compounding, reconstitution, injection, cycling, dosing, self-administration, diagnosis, or individualized medical advice.",
    `Local packet command: ${coverageClaimReviewCommand(item.claimId)}`
  ].join("\n");
}

function evidenceCoverageReviewSamplingPlan({
  claimReviewBacklog,
  claims,
  referencesById,
  studies
}: {
  claimReviewBacklog: EvidenceCoverageReviewBacklogItem[];
  claims: Claim[];
  referencesById: Map<string, Reference>;
  studies: EvidenceDashboardData["studies"];
}): EvidenceCoverageReviewSamplingPlan {
  const claimById = new Map(claims.map((claim) => [claim.id, claim]));
  const readyBacklog = claimReviewBacklog.filter(
    (item) =>
      !reviewStatusIsReviewed(item.reviewStatus) && item.packetStatus === "complete"
  );
  const batchSize = Math.min(3, readyBacklog.length);
  const items = readyBacklog.slice(0, batchSize).flatMap((item) => {
    const claim = claimById.get(item.claimId);

    if (!claim) {
      return [];
    }

    const packet = buildClaimSourcePacket({
      claim,
      referencesById,
      studies
    });

    return [
      evidenceCoverageReviewSampleItem({
        claim,
        packet,
        priority: item.priority,
        priorityReasons: item.priorityReasons
      })
    ];
  });

  return {
    batchSize,
    items,
    nextAction:
      items.length > 0
        ? "Review this sampled batch first; Codex may mark packets AI reviewed after cited packet and extraction checks."
        : "No complete unreviewed source packets are ready for sampling.",
    readyClaims: readyBacklog.length
  };
}

function evidenceCoverageReviewSampleItem({
  claim,
  packet,
  priority,
  priorityReasons
}: {
  claim: Claim;
  packet: ReturnType<typeof buildClaimSourcePacket>;
  priority: number;
  priorityReasons: string[];
}): EvidenceCoverageReviewSampleItem {
  return {
    claimBoundary: evidenceCoverageReviewBoundary(claim),
    claimId: claim.id,
    envFileReviewPacketCommand: coverageClaimReviewEnvFileCommand(claim.id),
    humanDecisionGate: evidenceCoverageHumanDecisionGate(claim.id),
    interventionId: claim.interventionId,
    nextAction:
      "Review the linked references and structured study extraction before changing this claim's review status.",
    outcome: claim.outcome,
    priority,
    priorityReasons,
    referenceIds: packet.referenceIds,
    referenceSummaries: packet.references.map(evidenceCoverageReviewReferenceSummary),
    reviewChecklist: evidenceCoverageReviewChecklist({ claim, packet }),
    reviewPacketCommand: coverageClaimReviewCommand(claim.id),
    sourcePacketStatus: packet.completeness.status,
    studyIds: packet.referenceIds.flatMap((referenceId) =>
      packet.studies
        .filter((study) => study.referenceId === referenceId)
        .map((study) => study.id)
        .sort()
    ),
    studySummaries: packet.studies.map(evidenceCoverageReviewStudySummary)
  };
}

function coverageClaimReviewCommand(claimId: string) {
  return `npm run coverage:review -- --claim ${claimId}`;
}

function coverageClaimReviewEnvFileCommand(claimId: string) {
  return `npm run coverage:review -- --env-file <non-production-env-file> --claim ${claimId}`;
}

function evidenceCoverageHumanDecisionGate(claimId: string) {
  return `Keep ${claimId} read-only here until Codex applies AI review, or a human explicitly confirms human review, through the authenticated operator workflow after cited references, structured extraction, scope, uncertainty, and safety/regulatory caveats are checked.`;
}

function evidenceCoverageReviewReferenceSummary(
  reference: Reference
): EvidenceCoverageReviewReferenceSummary {
  return {
    id: reference.id,
    ...(reference.identifier ? { identifier: reference.identifier } : {}),
    source: reference.source,
    title: reference.title,
    url: reference.url,
    ...(reference.year ? { year: reference.year } : {})
  };
}

function evidenceCoverageReviewStudySummary(study: Study): EvidenceCoverageReviewStudySummary {
  return {
    adverseEvents: study.adverseEvents,
    fundingConflicts: study.fundingConflicts,
    id: study.id,
    outcomes: study.outcomes,
    population: study.population,
    referenceId: study.referenceId,
    riskOfBias: study.riskOfBias,
    sampleSize: study.sampleSize,
    source: study.source,
    ...(study.sourceTypeTaxonomy ? { sourceTypeTaxonomy: study.sourceTypeTaxonomy } : {}),
    studyType: study.studyType,
    title: study.title,
    year: study.year
  };
}

function evidenceCoverageReviewBoundary(claim: Claim): EvidenceCoverageReviewBoundary {
  return {
    confidenceLevel: claim.confidenceLevel,
    doseFormStudied: claim.doseFormStudied,
    durationStudied: claim.durationStudied,
    finalLabel: claim.finalLabel,
    populationStudied: claim.populationStudied,
    reviewStatus: claim.reviewStatus
  };
}

function evidenceCoverageReviewChecklist({
  claim,
  packet
}: {
  claim: Claim;
  packet: ReturnType<typeof buildClaimSourcePacket>;
}) {
  const checklist = [
    "Confirm the cited references and structured studies match this claim's population, outcome, comparator, and uncertainty label.",
    "Check population, dose/form, duration, safety notes, and applicability notes before changing review status.",
    `Verify source packet status is still ${packet.completeness.status} and every linked reference has traceable extraction.`,
    "Leave review status unchanged until Codex records an AI-reviewed decision or a human confirms human review."
  ];

  if (claim.finalLabel === "Regulatory Concern") {
    checklist.splice(
      3,
      0,
      "Preserve regulatory-concern framing and do not add peptide sourcing, compounding, injection, cycling, or self-administration guidance."
    );
  }

  if (claim.outcome === "Safety/adverse effects") {
    checklist.splice(
      3,
      0,
      "Confirm adverse-event and upper-limit wording does not imply product safety or TGA clearance."
    );
  }

  return checklist;
}

function evidenceCoverageReviewBacklogItem({
  claim,
  packet
}: {
  claim: Claim;
  packet: ReturnType<typeof buildClaimSourcePacket>;
}): EvidenceCoverageReviewBacklogItem | null {
  if (reviewStatusIsReviewed(claim.reviewStatus) && packet.completeness.status === "complete") {
    return null;
  }

  const { priority, priorityReasons } = evidenceCoverageReviewPriority({ claim, packet });

  return {
    claimId: claim.id,
    confidenceLevel: claim.confidenceLevel,
    extractedReferences: packet.completeness.extractedReferences,
    finalLabel: claim.finalLabel,
    interventionId: claim.interventionId,
    nextAction:
      !reviewStatusIsReviewed(claim.reviewStatus) && packet.completeness.status === "complete"
        ? "Codex may mark the complete source packet AI reviewed after checking cited references and extraction."
        : packet.completeness.nextStep,
    outcome: claim.outcome,
    packetStatus: packet.completeness.status,
    priority,
    priorityReasons,
    rawCompositeScore: compositeScore(claim.scores),
    referenceCount: packet.completeness.totalReferences,
    reviewStatus: claim.reviewStatus
  };
}

function evidenceCoverageHumanConfirmationBacklogItem({
  claim,
  packet
}: {
  claim: Claim;
  packet: ReturnType<typeof buildClaimSourcePacket>;
}): EvidenceCoverageReviewBacklogItem {
  const { priority, priorityReasons } = evidenceCoverageReviewPriority({ claim, packet });

  return {
    claimId: claim.id,
    confidenceLevel: claim.confidenceLevel,
    extractedReferences: packet.completeness.extractedReferences,
    finalLabel: claim.finalLabel,
    interventionId: claim.interventionId,
    nextAction:
      "Human may confirm this AI-reviewed source packet after checking cited references, structured extraction, uncertainty labels, and caveats.",
    outcome: claim.outcome,
    packetStatus: packet.completeness.status,
    priority,
    priorityReasons,
    rawCompositeScore: compositeScore(claim.scores),
    referenceCount: packet.completeness.totalReferences,
    reviewStatus: claim.reviewStatus
  };
}

function reviewStatusIsReviewed(reviewStatus: string) {
  return reviewStatus === "AI reviewed" || reviewStatus === "Human reviewed";
}

function evidenceCoverageReviewPriority({
  claim,
  packet
}: {
  claim: Claim;
  packet: ReturnType<typeof buildClaimSourcePacket>;
}) {
  const reasons: string[] = [];
  let priority = 0;

  if (!reviewStatusIsReviewed(claim.reviewStatus)) {
    priority += 100;
    reasons.push("Unreviewed draft claim");
  }

  if (packet.completeness.status === "complete") {
    priority += 50;
    reasons.push("Complete source packet ready for AI review");
  } else {
    reasons.push(packet.completeness.label);
  }

  if (claim.finalLabel === "Regulatory Concern") {
    priority += 25;
    reasons.push("Regulatory concern label");
  }

  if (claim.outcome === "Safety/adverse effects") {
    priority += 15;
    reasons.push("Safety outcome");
  }

  if (claim.confidenceLevel === "High" || claim.confidenceLevel === "Moderate") {
    priority += 10;
    reasons.push(`${claim.confidenceLevel} confidence draft`);
  }

  return {
    priority,
    priorityReasons: reasons
  };
}

function compareReviewBacklogItems(
  left: EvidenceCoverageReviewBacklogItem,
  right: EvidenceCoverageReviewBacklogItem
) {
  return right.priority - left.priority || left.claimId.localeCompare(right.claimId);
}
