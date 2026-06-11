import { describe, expect, it } from "vitest";

import {
  summarizeEvidenceCoverage,
  summarizeEvidenceCoverageClaimReview
} from "@/lib/evidence-coverage";
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
            claimBoundary: {
              confidenceLevel: "Very low",
              doseFormStudied: "Not provided; self-administration details are out of scope.",
              durationStudied: "Not established for public guidance.",
              finalLabel: "Regulatory Concern",
              populationStudied: "Human clinical evidence is limited in the seed data.",
              reviewStatus: "Unreviewed AI draft"
            },
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
            reviewChecklist: [
              "Confirm the cited references and structured studies match this claim's population, outcome, comparator, and uncertainty label.",
              "Check population, dose/form, duration, safety notes, and applicability notes before changing review status.",
              "Verify source packet status is still complete and every linked reference has traceable extraction.",
              "Preserve regulatory-concern framing and do not add peptide sourcing, compounding, injection, cycling, or self-administration guidance.",
              "Leave review status unchanged until a human reviewer records the evidence decision."
            ],
            sourcePacketStatus: "complete",
            studyIds: ["study-tga-unapproved-peptides", "study-fda-bpc-157"]
          },
          {
            claimBoundary: {
              confidenceLevel: "High",
              doseFormStudied: "D2 or D3; dosing must be matched to labs and clinical context.",
              durationStudied: "Varies by deficiency and monitoring plan.",
              finalLabel: "Conditional / Biomarker-Gated",
              populationStudied: "People with low vitamin D status or deficiency contexts.",
              reviewStatus: "Unreviewed AI draft"
            },
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
            reviewChecklist: [
              "Confirm the cited references and structured studies match this claim's population, outcome, comparator, and uncertainty label.",
              "Check population, dose/form, duration, safety notes, and applicability notes before changing review status.",
              "Verify source packet status is still complete and every linked reference has traceable extraction.",
              "Confirm adverse-event and upper-limit wording does not imply product safety or TGA clearance.",
              "Leave review status unchanged until a human reviewer records the evidence decision."
            ],
            sourcePacketStatus: "complete",
            studyIds: ["study-vitamin-d-ods"]
          },
          {
            claimBoundary: {
              confidenceLevel: "High",
              doseFormStudied:
                "Creatine monohydrate; dose details must be checked per study.",
              durationStudied: "Varies by trial and review.",
              finalLabel: "Core Evidence-Based",
              populationStudied: "Adults in exercise and sport nutrition literature.",
              reviewStatus: "Unreviewed AI draft"
            },
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
            reviewChecklist: [
              "Confirm the cited references and structured studies match this claim's population, outcome, comparator, and uncertainty label.",
              "Check population, dose/form, duration, safety notes, and applicability notes before changing review status.",
              "Verify source packet status is still complete and every linked reference has traceable extraction.",
              "Leave review status unchanged until a human reviewer records the evidence decision."
            ],
            sourcePacketStatus: "complete",
            studyIds: ["study-creatine-issn"]
          }
        ],
        nextAction:
          "Human review this sampled batch first; do not update review status until the cited packet and extraction are checked.",
        readyClaims: 7
      },
      totalClaims: 7,
      totalInterventions: 5,
      unreviewedClaims: 7,
      worksheet: {
        coverageGaps: [
          {
            interventionId: "psyllium",
            interventionName: "Psyllium",
            nextAction:
              "Add at least one scoped claim with curated source links before treating this intervention as covered."
          }
        ],
        copySafeCommands: [
          {
            command: "npm run coverage:review",
            id: "coverage-review",
            label: "Refresh coverage review",
            mode: "read-only",
            purpose:
              "Recheck source-packet coverage, review backlog, sampled review batch, and intervention gaps without changing review status."
          },
          {
            command: "npm run coverage:review -- --claim <claim-id>",
            id: "coverage-claim-review",
            label: "Focus one claim review packet",
            mode: "read-only",
            purpose:
              "Print one claim's source-packet boundary, checklist, references, and structured study IDs for human review."
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
            command:
              "npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 10",
            id: "candidate-review-overview",
            label: "Review pending source candidates",
            mode: "read-only",
            purpose:
              "Inspect pending source-candidate groups that may support future curated coverage expansion."
          },
          {
            command:
              "npm run ingest:sources -- --candidate-review-flags --candidate-review-flags-limit 10",
            id: "candidate-review-flags",
            label: "Review flagged source candidates",
            mode: "read-only",
            purpose:
              "Inspect broad safety or low-overlap candidate groups before any human curation decision."
          },
          {
            command:
              "npm run ingest:sources -- --candidate-curation-handoff --candidate-curation-handoff-limit 10",
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
        ],
        humanOwned: true,
        nextHumanAction:
          "Human review this sampled batch first; do not update review status until the cited packet and extraction are checked.",
        readyReviewBatch: expect.arrayContaining([
          expect.objectContaining({
            claimBoundary: expect.objectContaining({
              finalLabel: "Regulatory Concern",
              populationStudied: "Human clinical evidence is limited in the seed data."
            }),
            claimId: "bpc-157-injury-healing",
            referenceIds: ["tga-safety-alerts", "fda-bpc-157-category-2"],
            reviewChecklist: expect.arrayContaining([
              "Preserve regulatory-concern framing and do not add peptide sourcing, compounding, injection, cycling, or self-administration guidance."
            ]),
            sourcePacketStatus: "complete",
            studyIds: ["study-tga-unapproved-peptides", "study-fda-bpc-157"]
          }),
          expect.objectContaining({
            claimBoundary: expect.objectContaining({
              finalLabel: "Conditional / Biomarker-Gated",
              populationStudied: "People with low vitamin D status or deficiency contexts."
            }),
            claimId: "vitamin-d-deficiency",
            referenceIds: ["ods-vitamin-d"],
            reviewChecklist: expect.arrayContaining([
              "Confirm adverse-event and upper-limit wording does not imply product safety or TGA clearance."
            ]),
            sourcePacketStatus: "complete",
            studyIds: ["study-vitamin-d-ods"]
          }),
          expect.objectContaining({
            claimBoundary: expect.objectContaining({
              finalLabel: "Core Evidence-Based",
              populationStudied: "Adults in exercise and sport nutrition literature."
            }),
            claimId: "creatine-strength",
            referenceIds: ["issn-creatine-2017"],
            sourcePacketStatus: "complete",
            studyIds: ["study-creatine-issn"]
          })
        ]),
        readySourcePackets: expect.arrayContaining([
          expect.objectContaining({
            claimId: "bpc-157-injury-healing",
            packetStatus: "complete",
            priority: 175
          }),
          expect.objectContaining({
            claimId: "vitamin-d-deficiency",
            packetStatus: "complete",
            priority: 175
          }),
          expect.objectContaining({
            claimId: "creatine-strength",
            packetStatus: "complete",
            priority: 160
          })
        ]),
        remainingBacklog: []
      }
    });
  });

  it("emits only read-only commands for human coverage review", () => {
    const summary = summarizeEvidenceCoverage(seedDashboardData);
    const blockedWriteTokens = [
      "--accept-candidate",
      "--reject-candidate",
      "--link-candidate-claim",
      "--extract-candidate-study",
      "--queue-",
      "--run-next",
      "--apply"
    ];

    expect(summary.worksheet.copySafeCommands).toHaveLength(7);
    expect(summary.worksheet.copySafeCommands.every((item) => item.mode === "read-only")).toBe(
      true
    );
    expect(
      summary.worksheet.copySafeCommands.some((item) =>
        blockedWriteTokens.some((token) => item.command.includes(token))
      )
    ).toBe(false);
  });

  it("builds a focused read-only human review packet for one claim", () => {
    expect(
      summarizeEvidenceCoverageClaimReview(seedDashboardData, "creatine-strength")
    ).toEqual({
      claimId: "creatine-strength",
      found: true,
      humanOwned: true,
      nextAction:
        "Human review this claim packet; do not update review status until cited references and structured extraction are checked.",
      readOnly: true,
      reviewBacklogItem: {
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
      reviewContext: {
        claimBoundary: {
          confidenceLevel: "High",
          doseFormStudied: "Creatine monohydrate; dose details must be checked per study.",
          durationStudied: "Varies by trial and review.",
          finalLabel: "Core Evidence-Based",
          populationStudied: "Adults in exercise and sport nutrition literature.",
          reviewStatus: "Unreviewed AI draft"
        },
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
        reviewChecklist: [
          "Confirm the cited references and structured studies match this claim's population, outcome, comparator, and uncertainty label.",
          "Check population, dose/form, duration, safety notes, and applicability notes before changing review status.",
          "Verify source packet status is still complete and every linked reference has traceable extraction.",
          "Leave review status unchanged until a human reviewer records the evidence decision."
        ],
        sourcePacketStatus: "complete",
        studyIds: ["study-creatine-issn"]
      },
      status: "ready-for-human-review"
    });
  });

  it("reports missing focused claim review packets without writes", () => {
    expect(summarizeEvidenceCoverageClaimReview(seedDashboardData, "missing-claim")).toEqual({
      claimId: "missing-claim",
      found: false,
      humanOwned: true,
      nextAction:
        "No claim found for missing-claim; rerun npm run coverage:review to inspect valid claim IDs.",
      readOnly: true,
      reviewBacklogItem: null,
      reviewContext: null,
      status: "not-found"
    });
  });
});
