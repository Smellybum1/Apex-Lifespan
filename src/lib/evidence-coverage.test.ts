import { describe, expect, it } from "vitest";

import { summarizeEvidenceCoverage } from "@/lib/evidence-coverage";
import {
  claims,
  interventions,
  references,
  studies,
  trialWatchItems,
  safetyAlerts,
  productSignals,
  australiaRegulatoryStatuses
} from "@/lib/seed-data";
import type { EvidenceDashboardData } from "@/lib/types";

const seedDashboardData: EvidenceDashboardData = {
  australiaRegulatoryStatuses,
  claims,
  dataSource: "seed",
  interventions,
  productSignals,
  references,
  safetyAlerts,
  studies,
  trialWatchItems
};

describe("evidence coverage summary", () => {
  it("reports current seed coverage without treating unreviewed drafts as complete", () => {
    expect(summarizeEvidenceCoverage(seedDashboardData)).toEqual({
      claimReviewBacklog: [
        {
          claimId: "bpc-157-injury-healing",
          confidenceLevel: "Very low",
          extractedReferences: 2,
          finalLabel: "Regulatory Concern",
          interventionId: "bpc-157",
          nextAction: "Human review the complete source packet before upgrading review status.",
          outcome: "Joint/tendon/skin",
          packetStatus: "complete",
          priority: 175,
          priorityReasons: [
            "Unreviewed draft claim",
            "Complete source packet ready for human review",
            "Regulatory concern label"
          ],
          referenceCount: 2,
          reviewStatus: "Unreviewed AI draft"
        },
        {
          claimId: "vitamin-d-deficiency",
          confidenceLevel: "High",
          extractedReferences: 1,
          finalLabel: "Conditional / Biomarker-Gated",
          interventionId: "vitamin-d",
          nextAction: "Human review the complete source packet before upgrading review status.",
          outcome: "Safety/adverse effects",
          packetStatus: "complete",
          priority: 175,
          priorityReasons: [
            "Unreviewed draft claim",
            "Complete source packet ready for human review",
            "Safety outcome",
            "High confidence draft"
          ],
          referenceCount: 1,
          reviewStatus: "Unreviewed AI draft"
        },
        {
          claimId: "creatine-strength",
          confidenceLevel: "High",
          extractedReferences: 1,
          finalLabel: "Core Evidence-Based",
          interventionId: "creatine",
          nextAction: "Human review the complete source packet before upgrading review status.",
          outcome: "Muscle/strength",
          packetStatus: "complete",
          priority: 160,
          priorityReasons: [
            "Unreviewed draft claim",
            "Complete source packet ready for human review",
            "High confidence draft"
          ],
          referenceCount: 1,
          reviewStatus: "Unreviewed AI draft"
        },
        {
          claimId: "omega-3-cv-events",
          confidenceLevel: "Moderate",
          extractedReferences: 1,
          finalLabel: "Conditional / Biomarker-Gated",
          interventionId: "omega-3",
          nextAction: "Human review the complete source packet before upgrading review status.",
          outcome: "Cardiovascular events",
          packetStatus: "complete",
          priority: 160,
          priorityReasons: [
            "Unreviewed draft claim",
            "Complete source packet ready for human review",
            "Moderate confidence draft"
          ],
          referenceCount: 1,
          reviewStatus: "Unreviewed AI draft"
        },
        {
          claimId: "omega-3-triglycerides",
          confidenceLevel: "Moderate",
          extractedReferences: 1,
          finalLabel: "Useful for Specific Use Case",
          interventionId: "omega-3",
          nextAction: "Human review the complete source packet before upgrading review status.",
          outcome: "LDL/ApoB/lipids",
          packetStatus: "complete",
          priority: 160,
          priorityReasons: [
            "Unreviewed draft claim",
            "Complete source packet ready for human review",
            "Moderate confidence draft"
          ],
          referenceCount: 1,
          reviewStatus: "Unreviewed AI draft"
        },
        {
          claimId: "creatine-lifespan",
          confidenceLevel: "Very low",
          extractedReferences: 1,
          finalLabel: "Insufficient Evidence",
          interventionId: "creatine",
          nextAction: "Human review the complete source packet before upgrading review status.",
          outcome: "Mortality/lifespan",
          packetStatus: "complete",
          priority: 150,
          priorityReasons: [
            "Unreviewed draft claim",
            "Complete source packet ready for human review"
          ],
          referenceCount: 1,
          reviewStatus: "Unreviewed AI draft"
        },
        {
          claimId: "vitamin-d-longevity",
          confidenceLevel: "Low",
          extractedReferences: 1,
          finalLabel: "Insufficient Evidence",
          interventionId: "vitamin-d",
          nextAction: "Human review the complete source packet before upgrading review status.",
          outcome: "Mortality/lifespan",
          packetStatus: "complete",
          priority: 150,
          priorityReasons: [
            "Unreviewed draft claim",
            "Complete source packet ready for human review"
          ],
          referenceCount: 1,
          reviewStatus: "Unreviewed AI draft"
        }
      ],
      completeSourcePackets: 7,
      humanReviewedClaims: 0,
      incompleteClaims: claims.map((claim) => ({
        claimId: claim.id,
        interventionId: claim.interventionId,
        packetStatus: "complete",
        reviewStatus: "Unreviewed AI draft"
      })),
      interventionGaps: [
        {
          interventionId: "psyllium",
          interventionName: "Psyllium",
          nextAction:
            "Add at least one scoped claim with curated source links before treating this intervention as covered."
        }
      ],
      interventionsWithClaims: 4,
      interventionsWithoutClaims: ["psyllium"],
      reviewSamplingPlan: {
        batchSize: 3,
        items: [
          {
            claimId: "bpc-157-injury-healing",
            interventionId: "bpc-157",
            nextAction:
              "Review the linked references and structured study extraction before changing this claim's review status.",
            outcome: "Joint/tendon/skin",
            priority: 175,
            priorityReasons: [
              "Unreviewed draft claim",
              "Complete source packet ready for human review",
              "Regulatory concern label"
            ],
            referenceIds: ["tga-safety-alerts", "fda-bpc-157-category-2"],
            studyIds: ["study-tga-unapproved-peptides", "study-fda-bpc-157"]
          },
          {
            claimId: "vitamin-d-deficiency",
            interventionId: "vitamin-d",
            nextAction:
              "Review the linked references and structured study extraction before changing this claim's review status.",
            outcome: "Safety/adverse effects",
            priority: 175,
            priorityReasons: [
              "Unreviewed draft claim",
              "Complete source packet ready for human review",
              "Safety outcome",
              "High confidence draft"
            ],
            referenceIds: ["ods-vitamin-d"],
            studyIds: ["study-vitamin-d-ods"]
          },
          {
            claimId: "creatine-strength",
            interventionId: "creatine",
            nextAction:
              "Review the linked references and structured study extraction before changing this claim's review status.",
            outcome: "Muscle/strength",
            priority: 160,
            priorityReasons: [
              "Unreviewed draft claim",
              "Complete source packet ready for human review",
              "High confidence draft"
            ],
            referenceIds: ["issn-creatine-2017"],
            studyIds: ["study-creatine-issn"]
          }
        ],
        nextAction:
          "Human review this sampled batch first; do not update review status until the cited packet and extraction are checked.",
        readyClaims: 7
      },
      totalClaims: 7,
      totalInterventions: 5,
      unreviewedClaims: 7
    });
  });
});
