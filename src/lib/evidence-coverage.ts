import {
  buildClaimSourcePacket,
  type ClaimSourcePacketCompletenessStatus,
  summarizeClaimSourcePackets
} from "@/lib/source-packet";
import type { Claim, ConfidenceLevel, EvidenceDashboardData, EvidenceLabel } from "@/lib/types";

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

export interface EvidenceCoverageSummary {
  claimReviewBacklog: EvidenceCoverageReviewBacklogItem[];
  completeSourcePackets: number;
  humanReviewedClaims: number;
  incompleteClaims: EvidenceCoverageClaimGap[];
  interventionGaps: EvidenceCoverageInterventionGap[];
  interventionsWithClaims: number;
  interventionsWithoutClaims: string[];
  totalClaims: number;
  totalInterventions: number;
  unreviewedClaims: number;
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
    totalClaims: data.claims.length,
    totalInterventions: data.interventions.length,
    unreviewedClaims: data.claims.filter((claim) => claim.reviewStatus !== "Human reviewed")
      .length
  };
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
