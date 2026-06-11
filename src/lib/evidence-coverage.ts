import {
  buildClaimSourcePacket,
  summarizeClaimSourcePackets
} from "@/lib/source-packet";
import type { EvidenceDashboardData } from "@/lib/types";

export interface EvidenceCoverageClaimGap {
  claimId: string;
  interventionId: string;
  packetStatus: string;
  reviewStatus: string;
}

export interface EvidenceCoverageSummary {
  completeSourcePackets: number;
  humanReviewedClaims: number;
  incompleteClaims: EvidenceCoverageClaimGap[];
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

  return {
    completeSourcePackets: sourcePacketSummary.completeClaims,
    humanReviewedClaims: data.claims.filter((claim) => claim.reviewStatus === "Human reviewed")
      .length,
    incompleteClaims,
    interventionsWithClaims: claimInterventionIds.size,
    interventionsWithoutClaims: data.interventions
      .filter((intervention) => !claimInterventionIds.has(intervention.id))
      .map((intervention) => intervention.id)
      .sort(),
    totalClaims: data.claims.length,
    totalInterventions: data.interventions.length,
    unreviewedClaims: data.claims.filter((claim) => claim.reviewStatus !== "Human reviewed")
      .length
  };
}
