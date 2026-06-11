import {
  buildClaimSourcePacket,
  type ClaimSourcePacketCompletenessStatus,
  summarizeClaimSourcePackets
} from "@/lib/source-packet";
import type {
  Claim,
  ConfidenceLevel,
  EvidenceDashboardData,
  EvidenceLabel,
  Reference
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
  referenceCount: number;
  reviewStatus: string;
}

export interface EvidenceCoverageReviewSampleItem {
  claimBoundary: EvidenceCoverageReviewBoundary;
  claimId: string;
  interventionId: string;
  nextAction: string;
  outcome: Claim["outcome"];
  priority: number;
  priorityReasons: string[];
  referenceIds: string[];
  reviewChecklist: string[];
  sourcePacketStatus: ClaimSourcePacketCompletenessStatus;
  studyIds: string[];
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

export interface EvidenceCoverageWorksheet {
  coverageGaps: EvidenceCoverageInterventionGap[];
  humanOwned: true;
  nextHumanAction: string;
  readyReviewBatch: EvidenceCoverageReviewSampleItem[];
  readySourcePackets: EvidenceCoverageWorksheetClaimItem[];
  remainingBacklog: EvidenceCoverageWorksheetClaimItem[];
}

export interface EvidenceCoverageWorksheetClaimItem {
  claimId: string;
  extractedReferences: number;
  interventionId: string;
  nextAction: string;
  packetStatus: ClaimSourcePacketCompletenessStatus;
  priority: number;
  priorityReasons: string[];
  referenceCount: number;
  reviewStatus: string;
}

export interface EvidenceCoverageSummary {
  claimReviewBacklog: EvidenceCoverageReviewBacklogItem[];
  completeSourcePackets: number;
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

    if (packet.completeness.status === "complete" && claim.reviewStatus === "Human reviewed") {
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
    humanReviewedClaims: data.claims.filter((claim) => claim.reviewStatus === "Human reviewed")
      .length,
    incompleteClaims,
    interventionGaps,
    interventionsWithClaims: claimInterventionIds.size,
    interventionsWithoutClaims: interventionGaps.map((gap) => gap.interventionId),
    reviewSamplingPlan,
    totalClaims: data.claims.length,
    totalInterventions: data.interventions.length,
    unreviewedClaims: data.claims.filter((claim) => claim.reviewStatus !== "Human reviewed")
      .length,
    worksheet: evidenceCoverageWorksheet({
      claimReviewBacklog,
      interventionGaps,
      reviewSamplingPlan
    })
  };
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
        item.reviewStatus !== "Human reviewed" && item.packetStatus === "complete"
    )
    .map(evidenceCoverageWorksheetClaimItem);
  const remainingBacklog = claimReviewBacklog
    .filter(
      (item) =>
        item.reviewStatus === "Human reviewed" || item.packetStatus !== "complete"
    )
    .map(evidenceCoverageWorksheetClaimItem);

  return {
    coverageGaps: interventionGaps,
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

function evidenceCoverageWorksheetClaimItem(
  item: EvidenceCoverageReviewBacklogItem
): EvidenceCoverageWorksheetClaimItem {
  return {
    claimId: item.claimId,
    extractedReferences: item.extractedReferences,
    interventionId: item.interventionId,
    nextAction: item.nextAction,
    packetStatus: item.packetStatus,
    priority: item.priority,
    priorityReasons: item.priorityReasons,
    referenceCount: item.referenceCount,
    reviewStatus: item.reviewStatus
  };
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
      item.reviewStatus !== "Human reviewed" && item.packetStatus === "complete"
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
      {
        claimBoundary: evidenceCoverageReviewBoundary(claim),
        claimId: item.claimId,
        interventionId: item.interventionId,
        nextAction:
          "Review the linked references and structured study extraction before changing this claim's review status.",
        outcome: item.outcome,
        priority: item.priority,
        priorityReasons: item.priorityReasons,
        referenceIds: packet.referenceIds,
        reviewChecklist: evidenceCoverageReviewChecklist({ claim, packet }),
        sourcePacketStatus: packet.completeness.status,
        studyIds: packet.referenceIds.flatMap((referenceId) =>
          packet.studies
            .filter((study) => study.referenceId === referenceId)
            .map((study) => study.id)
            .sort()
        )
      }
    ];
  });

  return {
    batchSize,
    items,
    nextAction:
      items.length > 0
        ? "Human review this sampled batch first; do not update review status until the cited packet and extraction are checked."
        : "No complete unreviewed source packets are ready for sampling.",
    readyClaims: readyBacklog.length
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
    "Leave review status unchanged until a human reviewer records the evidence decision."
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
  if (claim.reviewStatus === "Human reviewed" && packet.completeness.status === "complete") {
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
      claim.reviewStatus !== "Human reviewed" && packet.completeness.status === "complete"
        ? "Human review the complete source packet before upgrading review status."
        : packet.completeness.nextStep,
    outcome: claim.outcome,
    packetStatus: packet.completeness.status,
    priority,
    priorityReasons,
    referenceCount: packet.completeness.totalReferences,
    reviewStatus: claim.reviewStatus
  };
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

  if (claim.reviewStatus !== "Human reviewed") {
    priority += 100;
    reasons.push("Unreviewed draft claim");
  }

  if (packet.completeness.status === "complete") {
    priority += 50;
    reasons.push("Complete source packet ready for human review");
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
