import { describe, expect, it } from "vitest";

import {
  buildEvidenceHumanConfirmationQueue,
  buildEvidenceHumanReviewQueue,
  summarizeEvidenceCoverage,
  summarizeEvidenceCoverageClaimReview,
  summarizeEvidenceCoverageReadyClaimReviews,
  summarizeEvidenceCoverageReviewReport
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
const READY_SOURCE_PACKET_COUNT = 18;
const SOURCE_PACKET_BACKLOG_COUNT = claims.length - READY_SOURCE_PACKET_COUNT;
const SOURCE_PACKET_BACKLOG_BLOCKER =
  `${SOURCE_PACKET_BACKLOG_COUNT} current claim(s) still need complete source packets before expansion.`;

describe("evidence coverage summary", () => {
  it("reports current seed coverage without treating unreviewed drafts as complete", () => {
    const summary = summarizeEvidenceCoverage(seedDashboardData);

    expect(summary).toEqual(expect.objectContaining({
      claimReviewBacklog: expect.arrayContaining([
        {
          claimId: "bpc-157-injury-healing",
          confidenceLevel: "Very low",
          extractedReferences: 2,
          finalLabel: "Regulatory Concern",
          interventionId: "bpc-157",
          nextAction: "Codex may mark the complete source packet AI reviewed after checking cited references and extraction.",
          outcome: "Joint/tendon/skin",
          packetStatus: "complete",
          priority: 175,
          priorityReasons: [
            "Unreviewed draft claim",
            "Complete source packet ready for AI review",
            "Regulatory concern label"
          ],
          rawCompositeScore: 1.8,
          referenceCount: 2,
          reviewStatus: "Unreviewed AI draft"
        },
        {
          claimId: "vitamin-d-deficiency",
          confidenceLevel: "High",
          extractedReferences: 1,
          finalLabel: "Conditional / Biomarker-Gated",
          interventionId: "vitamin-d",
          nextAction: "Codex may mark the complete source packet AI reviewed after checking cited references and extraction.",
          outcome: "Safety/adverse effects",
          packetStatus: "complete",
          priority: 175,
          priorityReasons: [
            "Unreviewed draft claim",
            "Complete source packet ready for AI review",
            "Safety outcome",
            "High confidence draft"
          ],
          rawCompositeScore: 7.6,
          referenceCount: 1,
          reviewStatus: "Unreviewed AI draft"
        },
        {
          claimId: "creatine-strength",
          confidenceLevel: "High",
          extractedReferences: 1,
          finalLabel: "Core Evidence-Based",
          interventionId: "creatine",
          nextAction: "Codex may mark the complete source packet AI reviewed after checking cited references and extraction.",
          outcome: "Muscle/strength",
          packetStatus: "complete",
          priority: 160,
          priorityReasons: [
            "Unreviewed draft claim",
            "Complete source packet ready for AI review",
            "High confidence draft"
          ],
          rawCompositeScore: 8.4,
          referenceCount: 1,
          reviewStatus: "Unreviewed AI draft"
        },
        {
          claimId: "omega-3-cv-events",
          confidenceLevel: "Moderate",
          extractedReferences: 1,
          finalLabel: "Conditional / Biomarker-Gated",
          interventionId: "omega-3",
          nextAction: "Codex may mark the complete source packet AI reviewed after checking cited references and extraction.",
          outcome: "Cardiovascular events",
          packetStatus: "complete",
          priority: 160,
          priorityReasons: [
            "Unreviewed draft claim",
            "Complete source packet ready for AI review",
            "Moderate confidence draft"
          ],
          rawCompositeScore: 5.9,
          referenceCount: 1,
          reviewStatus: "Unreviewed AI draft"
        },
        {
          claimId: "omega-3-triglycerides",
          confidenceLevel: "Moderate",
          extractedReferences: 1,
          finalLabel: "Useful for Specific Use Case",
          interventionId: "omega-3",
          nextAction: "Codex may mark the complete source packet AI reviewed after checking cited references and extraction.",
          outcome: "LDL/ApoB/lipids",
          packetStatus: "complete",
          priority: 160,
          priorityReasons: [
            "Unreviewed draft claim",
            "Complete source packet ready for AI review",
            "Moderate confidence draft"
          ],
          rawCompositeScore: 7.1,
          referenceCount: 1,
          reviewStatus: "Unreviewed AI draft"
        },
        {
          claimId: "psyllium-ldl-lipids",
          confidenceLevel: "Moderate",
          extractedReferences: 1,
          finalLabel: "Useful for Specific Use Case",
          interventionId: "psyllium",
          nextAction: "Codex may mark the complete source packet AI reviewed after checking cited references and extraction.",
          outcome: "LDL/ApoB/lipids",
          packetStatus: "complete",
          priority: 160,
          priorityReasons: [
            "Unreviewed draft claim",
            "Complete source packet ready for AI review",
            "Moderate confidence draft"
          ],
          rawCompositeScore: 6.5,
          referenceCount: 1,
          reviewStatus: "Unreviewed AI draft"
        },
        {
          claimId: "creatine-lifespan",
          confidenceLevel: "Very low",
          extractedReferences: 1,
          finalLabel: "Insufficient Evidence",
          interventionId: "creatine",
          nextAction: "Codex may mark the complete source packet AI reviewed after checking cited references and extraction.",
          outcome: "Mortality/lifespan",
          packetStatus: "complete",
          priority: 150,
          priorityReasons: [
            "Unreviewed draft claim",
            "Complete source packet ready for AI review"
          ],
          rawCompositeScore: 3.2,
          referenceCount: 1,
          reviewStatus: "Unreviewed AI draft"
        },
        {
          claimId: "vitamin-d-longevity",
          confidenceLevel: "Low",
          extractedReferences: 1,
          finalLabel: "Insufficient Evidence",
          interventionId: "vitamin-d",
          nextAction: "Codex may mark the complete source packet AI reviewed after checking cited references and extraction.",
          outcome: "Mortality/lifespan",
          packetStatus: "complete",
          priority: 150,
          priorityReasons: [
            "Unreviewed draft claim",
            "Complete source packet ready for AI review"
          ],
          rawCompositeScore: 4.6,
          referenceCount: 1,
          reviewStatus: "Unreviewed AI draft"
        }
      ]),
      completeSourcePackets: READY_SOURCE_PACKET_COUNT,
      expansionReadiness: expect.objectContaining({
        blockingClaims: expect.arrayContaining([
          expect.objectContaining({
            claimId: "magnesium-glycinate-sleep",
            interventionId: "magnesium-glycinate",
            packetStatus: "not_linked",
            priority: 100
          })
        ]),
        blockers: [SOURCE_PACKET_BACKLOG_BLOCKER],
        candidateBatchSize: {
          maximum: 10,
          minimum: 5
        },
        candidateReviewCommands: [
          {
            command: "npm run onboarding:guide -- --name <supplement-name> --summary",
            id: "onboarding-draft-guide",
            label: "Preview one draft onboarding guide",
            mode: "read-only",
            purpose:
              "Preview a new intervention onboarding packet without writing seed, database, source-candidate, or public evidence rows."
          },
          {
            command:
              "npm run onboarding:guide -- --batch-file <reviewed-expansion-batch.json> --summary",
            id: "onboarding-draft-batch-guide",
            label: "Preview reviewed expansion batch",
            mode: "read-only",
            purpose:
              "Preview a 5-10 intervention onboarding batch after humans define scoped claims and source targets."
          },
          {
            command:
              "npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 10",
            id: "candidate-review-overview",
            label: "Review source-candidate backlog",
            mode: "read-only",
            purpose:
              "Inspect pending source candidates that may support future curated intervention expansion."
          }
        ],
        humanOwned: true,
        milestoneReviewClaims: expect.arrayContaining([
          expect.objectContaining({
            claimId: "bpc-157-injury-healing",
            nextAction: "Codex may mark the complete source packet AI reviewed after checking cited references and extraction.",
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
        nextAction:
          "Resolve source-packet or intervention-shape blockers before expanding the evidence map.",
        noAutoPromotion: true,
        noPublicEvidenceRowsWritten: true,
        readySignals: [],
        status: "blocked"
      }),
      humanReviewedClaims: 0,
      incompleteClaims: expect.arrayContaining([
        expect.objectContaining({
          claimId: "creatine-strength",
          packetStatus: "complete"
        }),
        expect.objectContaining({
          claimId: "magnesium-glycinate-sleep",
          interventionId: "magnesium-glycinate",
          packetStatus: "not_linked"
        })
      ]),
      interventionGaps: [],
      interventionsWithClaims: interventions.length,
      interventionsWithoutClaims: [],
      reviewSamplingPlan: {
        batchSize: 3,
        items: expect.arrayContaining([
          expect.objectContaining({
            claimBoundary: expect.objectContaining({
              finalLabel: "Regulatory Concern",
              populationStudied: "Human clinical evidence is limited in the seed data."
            }),
            claimId: "bpc-157-injury-healing",
            referenceIds: ["tga-safety-alerts", "fda-bpc-157-category-2"],
            referenceSummaries: expect.arrayContaining([
              expect.objectContaining({
                id: "tga-safety-alerts",
                source: "TGA"
              }),
              expect.objectContaining({
                id: "fda-bpc-157-category-2",
                source: "FDA"
              })
            ]),
            reviewChecklist: expect.arrayContaining([
              "Preserve regulatory-concern framing and do not add peptide sourcing, compounding, injection, cycling, or self-administration guidance."
            ]),
            reviewPacketCommand:
              "npm run coverage:review -- --claim bpc-157-injury-healing",
            sourcePacketStatus: "complete",
            studyIds: ["study-tga-unapproved-peptides", "study-fda-bpc-157"],
            studySummaries: expect.arrayContaining([
              expect.objectContaining({
                id: "study-tga-unapproved-peptides",
                sourceTypeTaxonomy: "regulatory warning"
              })
            ])
          }),
          expect.objectContaining({
            claimBoundary: expect.objectContaining({
              finalLabel: "Conditional / Biomarker-Gated",
              populationStudied: "People with low vitamin D status or deficiency contexts."
            }),
            claimId: "vitamin-d-deficiency",
            referenceIds: ["ods-vitamin-d"],
            referenceSummaries: expect.arrayContaining([
              expect.objectContaining({
                id: "ods-vitamin-d",
                source: "NIH Office of Dietary Supplements"
              })
            ]),
            reviewChecklist: expect.arrayContaining([
              "Confirm adverse-event and upper-limit wording does not imply product safety or TGA clearance."
            ]),
            reviewPacketCommand: "npm run coverage:review -- --claim vitamin-d-deficiency",
            sourcePacketStatus: "complete",
            studyIds: ["study-vitamin-d-ods"]
          }),
          expect.objectContaining({
            claimBoundary: expect.objectContaining({
              finalLabel: "Useful for Specific Use Case",
              populationStudied: "Healthy and trained adults in sport and exercise performance literature."
            }),
            claimId: "caffeine-endurance",
            referenceIds: ["issn-caffeine-2021"],
            referenceSummaries: expect.arrayContaining([
              expect.objectContaining({
                id: "issn-caffeine-2021",
                identifier: "PMID: 33388079; DOI: 10.1186/s12970-020-00383-4",
                source: "Journal of the International Society of Sports Nutrition via PubMed"
              })
            ]),
            reviewPacketCommand: "npm run coverage:review -- --claim caffeine-endurance",
            sourcePacketStatus: "complete",
            studyIds: ["study-issn-caffeine-2021"],
            studySummaries: expect.arrayContaining([
              expect.objectContaining({
                id: "study-issn-caffeine-2021",
                sourceTypeTaxonomy: "position stand"
              })
            ])
          })
        ]),
        nextAction:
          "Review this sampled batch first; Codex may mark packets AI reviewed after cited packet and extraction checks.",
        readyClaims: READY_SOURCE_PACKET_COUNT
      },
      totalClaims: claims.length,
      totalInterventions: interventions.length,
      unreviewedClaims: claims.length,
      worksheet: expect.objectContaining({
        coverageGaps: [],
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
          "Review this sampled batch first; Codex may mark packets AI reviewed after cited packet and extraction checks.",
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
              finalLabel: "Useful for Specific Use Case",
              populationStudied: "Healthy and trained adults in sport and exercise performance literature."
            }),
            claimId: "caffeine-endurance",
            referenceIds: ["issn-caffeine-2021"],
            sourcePacketStatus: "complete",
            studyIds: ["study-issn-caffeine-2021"]
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
        remainingBacklog: expect.arrayContaining([
          expect.objectContaining({
            claimId: "magnesium-glycinate-sleep",
            packetStatus: "not_linked",
            priority: 100
          })
        ])
      })
    }));
    expect(summary.claimReviewBacklog).toHaveLength(claims.length);
    expect(summary.incompleteClaims).toHaveLength(claims.length);
    expect(summary.worksheet.readySourcePackets).toHaveLength(READY_SOURCE_PACKET_COUNT);
    expect(summary.worksheet.remainingBacklog).toHaveLength(SOURCE_PACKET_BACKLOG_COUNT);
  });

  it("builds a compact read-only coverage review summary", () => {
    const summary = summarizeEvidenceCoverageReviewReport(
      summarizeEvidenceCoverage(seedDashboardData)
    );

    expect(summary).toEqual(expect.objectContaining({
      counts: {
        completeSourcePackets: READY_SOURCE_PACKET_COUNT,
        coverageGaps: 0,
        humanReviewedClaims: 0,
        incompleteClaims: claims.length,
        interventionsWithClaims: interventions.length,
        interventionsWithoutClaims: 0,
        readyReviewBatch: 3,
        readySourcePackets: READY_SOURCE_PACKET_COUNT,
        totalClaims: claims.length,
        totalInterventions: interventions.length,
        unreviewedClaims: claims.length
      },
      coverageGaps: [],
      expansionReadiness: expect.objectContaining({
        blockingClaims: expect.arrayContaining([
          expect.objectContaining({
            claimId: "magnesium-glycinate-sleep",
            packetStatus: "not_linked",
            priority: 100
          })
        ]),
        blockers: [SOURCE_PACKET_BACKLOG_BLOCKER],
        milestoneReviewClaims: expect.arrayContaining([
          expect.objectContaining({
            claimId: "bpc-157-injury-healing",
            nextAction: "Codex may mark the complete source packet AI reviewed after checking cited references and extraction.",
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
        candidateBatchSize: {
          maximum: 10,
          minimum: 5
        },
        candidateReviewCommands: [
          {
            command: "npm run onboarding:guide -- --name <supplement-name> --summary",
            id: "onboarding-draft-guide",
            label: "Preview one draft onboarding guide",
            mode: "read-only",
            purpose:
              "Preview a new intervention onboarding packet without writing seed, database, source-candidate, or public evidence rows."
          },
          {
            command:
              "npm run onboarding:guide -- --batch-file <reviewed-expansion-batch.json> --summary",
            id: "onboarding-draft-batch-guide",
            label: "Preview reviewed expansion batch",
            mode: "read-only",
            purpose:
              "Preview a 5-10 intervention onboarding batch after humans define scoped claims and source targets."
          },
          {
            command:
              "npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 10",
            id: "candidate-review-overview",
            label: "Review source-candidate backlog",
            mode: "read-only",
            purpose:
              "Inspect pending source candidates that may support future curated intervention expansion."
          }
        ],
        humanOwned: true,
        nextAction:
          "Resolve source-packet or intervention-shape blockers before expanding the evidence map.",
        noAutoPromotion: true,
        noPublicEvidenceRowsWritten: true,
        readySignals: [],
        status: "blocked"
      }),
      humanOwned: true,
      nextAction:
        "Review this sampled batch first; Codex may mark packets AI reviewed after cited packet and extraction checks.",
      readOnly: true,
      readyReviewClaims: expect.arrayContaining([
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
      sampledReviewClaims: [
        {
          claimId: "bpc-157-injury-healing",
          interventionId: "bpc-157",
          outcome: "Joint/tendon/skin",
          priority: 175,
          priorityReasons: [
            "Unreviewed draft claim",
            "Complete source packet ready for AI review",
            "Regulatory concern label"
          ],
          referenceIds: ["tga-safety-alerts", "fda-bpc-157-category-2"],
          sourcePacketStatus: "complete",
          studyIds: ["study-tga-unapproved-peptides", "study-fda-bpc-157"]
        },
        {
          claimId: "vitamin-d-deficiency",
          interventionId: "vitamin-d",
          outcome: "Safety/adverse effects",
          priority: 175,
          priorityReasons: [
            "Unreviewed draft claim",
            "Complete source packet ready for AI review",
            "Safety outcome",
            "High confidence draft"
          ],
          referenceIds: ["ods-vitamin-d"],
          sourcePacketStatus: "complete",
          studyIds: ["study-vitamin-d-ods"]
        },
        {
          claimId: "caffeine-endurance",
          interventionId: "caffeine",
          outcome: "VO2 max/endurance",
          priority: 160,
          priorityReasons: [
            "Unreviewed draft claim",
            "Complete source packet ready for AI review",
            "Moderate confidence draft"
          ],
          referenceIds: ["issn-caffeine-2021"],
          sourcePacketStatus: "complete",
          studyIds: ["study-issn-caffeine-2021"]
        }
      ]
    }));
    expect(JSON.stringify(summary)).not.toContain("copySafeCommands");
    expect(JSON.stringify(summary)).not.toContain("claimReviewBacklog");
    expect(JSON.stringify(summary)).not.toContain("reviewChecklist");
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

    expect(summary.worksheet.copySafeCommands).toHaveLength(10);
    expect(summary.worksheet.copySafeCommands.every((item) => item.mode === "read-only")).toBe(
      true
    );
    expect(summary.worksheet.copySafeCommands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: "npm run coverage:review -- --ready-claim-packets",
          id: "coverage-ready-claim-packets",
          mode: "read-only"
        })
      ])
    );
    expect(
      summary.worksheet.copySafeCommands.some((item) =>
        blockedWriteTokens.some((token) => item.command.includes(token))
      )
    ).toBe(false);
  });

  it("builds read-only human review packets for all ready claims in priority order", () => {
    const batch = summarizeEvidenceCoverageReadyClaimReviews(seedDashboardData);

    expect(batch).toEqual(
      expect.objectContaining({
        claimIds: [
          "bpc-157-injury-healing",
          "vitamin-d-deficiency",
          "caffeine-endurance",
          "creatine-strength",
          "magnesium-glycinate-blood-pressure",
          "melatonin-sleep",
          "omega-3-cv-events",
          "omega-3-triglycerides",
          "psyllium-ldl-lipids",
          "whey-protein-strength",
          "ashwagandha-mood-stress",
          "berberine-glucose",
          "creatine-lifespan",
          "curcumin-joint-tendon-skin",
          "hydrolyzed-collagen-joint-tendon-skin",
          "probiotic-blend-immune-respiratory",
          "vitamin-d-longevity",
          "zinc-immune-respiratory"
        ],
        humanOwned: true,
        readOnly: true,
        readyClaims: READY_SOURCE_PACKET_COUNT
      })
    );
    expect(batch.nextAction).toContain("Codex may mark them AI reviewed");
    expect(batch.claimPackets).toHaveLength(READY_SOURCE_PACKET_COUNT);
    expect(batch.claimPackets.every((packet) => packet.readOnly && packet.humanOwned)).toBe(true);
    expect(batch.claimPackets.map((packet) => packet.claimId)).toEqual(batch.claimIds);
    expect(batch.claimPackets[0]).toEqual(
      expect.objectContaining({
        claimId: "bpc-157-injury-healing",
        status: "ready-for-review"
      })
    );
    expect(batch.claimPackets[0].reviewContext).toEqual(
      expect.objectContaining({
        referenceSummaries: expect.arrayContaining([
          expect.objectContaining({
            id: "tga-safety-alerts",
            source: "TGA"
          })
        ]),
        reviewPacketCommand:
          "npm run coverage:review -- --claim bpc-157-injury-healing",
        studySummaries: expect.arrayContaining([
          expect.objectContaining({
            id: "study-tga-unapproved-peptides",
            sourceTypeTaxonomy: "regulatory warning"
          })
        ])
      })
    );
  });

  it("builds an AI-preflighted human review queue without approving claims", () => {
    const queue = buildEvidenceHumanReviewQueue(seedDashboardData);

    expect(queue).toEqual(
      expect.objectContaining({
        aiCrossCheckRecommended: 2,
        aiConfidenceAverage: expect.any(Number),
        aiPreReviewed: READY_SOURCE_PACKET_COUNT,
        blockedBySourcePacket: SOURCE_PACKET_BACKLOG_COUNT,
        humanOwned: true,
        nextAction:
          "Use AI evidence-confidence scores as quick-iteration decision support; low confidence is acceptable when the source packet is weak or claim fit is uncertain.",
        noAiApproval: true,
        noMedicalAdvice: true,
        noAutoPromotion: true,
        noPublicEvidenceRowsWritten: true,
        readOnly: true,
        total: claims.length
      })
    );
    expect(queue.aiConfidenceAverage).toBeGreaterThan(0);
    expect(queue.aiConfidenceAverage).toBeLessThanOrEqual(32);
    expect(queue.items).toHaveLength(claims.length);
    expect(queue.items.slice(0, READY_SOURCE_PACKET_COUNT).map((item) => item.claimId)).toEqual([
      "bpc-157-injury-healing",
      "vitamin-d-deficiency",
      "caffeine-endurance",
      "creatine-strength",
      "magnesium-glycinate-blood-pressure",
      "melatonin-sleep",
      "omega-3-cv-events",
      "omega-3-triglycerides",
      "psyllium-ldl-lipids",
      "whey-protein-strength",
      "ashwagandha-mood-stress",
      "berberine-glucose",
      "creatine-lifespan",
      "curcumin-joint-tendon-skin",
      "hydrolyzed-collagen-joint-tendon-skin",
      "probiotic-blend-immune-respiratory",
      "vitamin-d-longevity",
      "zinc-immune-respiratory"
    ]);
    expect(queue.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          aiPreReviewLabel: "AI scoring blocked",
          aiPreReviewStatus: "codex-preflight-blocked",
          claimId: "magnesium-glycinate-sleep",
          packetStatus: "not_linked"
        })
      ])
    );
    expect(queue.items[0]).toEqual(
      expect.objectContaining({
        aiConfidenceScore: 17,
        aiConfidenceSummary: "Very low AI confidence",
        aiPreReviewLabel: "AI confidence scored",
        aiPreReviewStatus: "codex-preflight-passed",
        claimId: "bpc-157-injury-healing",
        confirmationRequirement:
          "AI confidence is a transparent model judgment for quick iteration. It is not individualized medical advice, qualified clinical review, or product-level TGA/ARTG clearance.",
        confidenceWeight: 0.17,
        confidenceWeightedScore: 0.3,
        confidenceWeightedScoreExplanation:
          "Confidence-weighted score uses the raw 1.8/10 composite multiplied by 17/100 AI confidence, so low-confidence packets still contribute with lower impact.",
        highAttention: true,
        highAttentionReasons: [
          "Peptide/biologic scope.",
          "Regulatory Concern label."
        ],
        humanDecisionGate:
          "Keep bpc-157-injury-healing read-only here until Codex applies AI review, or a human explicitly confirms human review, through the authenticated operator workflow after cited references, structured extraction, scope, uncertainty, and safety/regulatory caveats are checked.",
        interventionName: "BPC-157",
        operatorHref: "/operator?reviewClaim=bpc-157-injury-healing"
      })
    );
    expect(queue.items[0].aiPreReviewExplanation).toContain(
      "high-attention evidence packet"
    );
    expect(queue.items[0].aiConfidenceRationale).toContain(
      "Score is Codex's evidence-confidence estimate, not expert review."
    );
    expect(queue.items[0].chatGptProPrompt).toContain(
      "Please cross-check this Apex Lifespan AI evidence review: bpc-157-injury-healing."
    );
    expect(queue.items[0].reviewFocus).toContain(
      "Regulatory caveat: preserve warning framing and avoid peptide sourcing, compounding, injection, cycling, dosing, or self-administration guidance."
    );
  });

  it("builds a human-confirmation queue for complete AI-reviewed packets", () => {
    const queue = buildEvidenceHumanConfirmationQueue({
      ...seedDashboardData,
      claims: seedDashboardData.claims.map((claim) => {
        if (claim.id === "vitamin-d-deficiency") {
          return {
            ...claim,
            reviewStatus: "AI reviewed" as const
          };
        }

        if (claim.id === "creatine-strength") {
          return {
            ...claim,
            reviewStatus: "Human reviewed" as const
          };
        }

        return claim;
      })
    });

    expect(queue).toEqual(
      expect.objectContaining({
        aiPreReviewed: 1,
        blockedBySourcePacket: 0,
        nextAction:
          "Human may confirm these AI-reviewed complete source packets after checking cited references, extraction, uncertainty, and caveats.",
        total: 1
      })
    );
    expect(queue.items).toEqual([
      expect.objectContaining({
        aiPreReviewStatus: "codex-preflight-passed",
        claimId: "vitamin-d-deficiency",
        nextAction:
          "Human may confirm this AI-reviewed source packet after checking cited references, structured extraction, uncertainty labels, and caveats.",
        reviewStatus: "AI reviewed"
      })
    ]);
  });

  it("builds a focused read-only human review packet for one claim", () => {
    expect(
      summarizeEvidenceCoverageClaimReview(seedDashboardData, "creatine-strength")
    ).toEqual({
      claimId: "creatine-strength",
      found: true,
      humanOwned: true,
      nextAction:
        "Codex may mark this claim packet AI reviewed after cited references and structured extraction are checked.",
      readOnly: true,
      reviewBacklogItem: {
        claimId: "creatine-strength",
        confidenceLevel: "High",
        extractedReferences: 1,
        finalLabel: "Core Evidence-Based",
        interventionId: "creatine",
        nextAction: "Codex may mark the complete source packet AI reviewed after checking cited references and extraction.",
        outcome: "Muscle/strength",
        packetStatus: "complete",
        priority: 160,
        priorityReasons: [
          "Unreviewed draft claim",
          "Complete source packet ready for AI review",
          "High confidence draft"
        ],
        rawCompositeScore: 8.4,
        referenceCount: 1,
        reviewStatus: "Unreviewed AI draft"
      },
      reviewContext: expect.objectContaining({
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
          "Complete source packet ready for AI review",
          "High confidence draft"
        ],
        envFileReviewPacketCommand:
          "npm run coverage:review -- --env-file <non-production-env-file> --claim creatine-strength",
        humanDecisionGate:
          "Keep creatine-strength read-only here until Codex applies AI review, or a human explicitly confirms human review, through the authenticated operator workflow after cited references, structured extraction, scope, uncertainty, and safety/regulatory caveats are checked.",
        referenceIds: ["issn-creatine-2017"],
        referenceSummaries: [
          {
            id: "issn-creatine-2017",
            identifier: "PMID: 28615996",
            source: "PubMed",
            title:
              "International Society of Sports Nutrition position stand: safety and efficacy of creatine supplementation in exercise, sport, and medicine",
            url: "https://pubmed.ncbi.nlm.nih.gov/28615996/",
            year: 2017
          }
        ],
        reviewChecklist: [
          "Confirm the cited references and structured studies match this claim's population, outcome, comparator, and uncertainty label.",
          "Check population, dose/form, duration, safety notes, and applicability notes before changing review status.",
          "Verify source packet status is still complete and every linked reference has traceable extraction.",
          "Leave review status unchanged until Codex records an AI-reviewed decision or a human confirms human review."
        ],
        reviewPacketCommand: "npm run coverage:review -- --claim creatine-strength",
        sourcePacketStatus: "complete",
        studyIds: ["study-creatine-issn"],
        studySummaries: [
          {
            adverseEvents:
              "Seed review cites safety considerations; patient-specific review still required.",
            fundingConflicts: "Check source record for details.",
            id: "study-creatine-issn",
            outcomes: ["Strength", "Lean mass", "Exercise capacity", "Safety"],
            population: "Exercise, sport, and medical nutrition contexts",
            referenceId: "issn-creatine-2017",
            riskOfBias:
              "Evidence synthesis and position stand; app should retain source metadata.",
            sampleSize: "Review/position stand",
            source: "Journal of the International Society of Sports Nutrition via PubMed",
            sourceTypeTaxonomy: "position stand",
            studyType: "Systematic review",
            title:
              "International Society of Sports Nutrition position stand: safety and efficacy of creatine supplementation in exercise, sport, and medicine",
            year: 2017
          }
        ]
      }),
      status: "ready-for-review"
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
