import { describe, expect, it } from "vitest";

import { buildEvidenceCandidateClusterPlan } from "@/lib/operator/evidence-candidate-cluster-plan";
import type {
  OperatorReviewQueueRow,
  OperatorReviewQueueSnapshot
} from "@/lib/operator/review-queue";

describe("evidence candidate cluster plan", () => {
  it("groups duplicate source identities and keeps review actions read-only", () => {
    const plan = buildEvidenceCandidateClusterPlan({
      reviewQueue: reviewQueueSnapshot([
        reviewQueueRow({
          dedupeKey: "pubmed:creatine:42141930",
          score: 87,
          title: "Creatine and resistance training"
        }),
        reviewQueueRow({
          dedupeKey: "pubmed:other-claim:42141930",
          score: 72,
          title: "Creatine resistance training duplicate context"
        })
      ])
    });

    expect(plan).toMatchObject({
      humanOwned: true,
      noAutomaticCandidateDecision: true,
      noAutomaticExtractionWrite: true,
      noAutomaticPromotion: true,
      noPublicEvidenceRowsWritten: true,
      readOnly: true,
      summary: {
        candidateRows: 2,
        acceptedReferenceMatchedClusters: 0,
        clusters: 1,
        curationBlockedClusters: 0,
        duplicateIdentityRows: 0,
        duplicateClusters: 1,
        highPriorityClusters: 1,
        offClaimRiskClusters: 0,
        siblingInspectedRows: 0
      }
    });
    expect(plan.rows[0]).toMatchObject({
      candidateCount: 2,
      clusterKey: "PubMed|external-id|42141930",
      matchKind: "source-external-id",
      reviewOrder: {
        firstInspectCommand:
          'npm run ingest:sources -- --candidate-siblings "pubmed:creatine:42141930"',
        firstInspectLabel: "Inspect sibling and duplicate rows first",
        noCandidateDecisionWrite: true,
        noEvidenceExtractionWrite: true,
        noPublicEvidenceRowsWritten: true,
        reviewState: "ready-for-inspection",
        writes: "none"
      },
      reviewRisks: [
        "Review sibling/duplicate rows together before changing any candidate decision."
      ],
      topCandidate: {
        dedupeKey: "pubmed:creatine:42141930",
        sourceConvictionScore: 87
      }
    });
    expect(plan.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command:
            "npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 10",
          mode: "read-only"
        }),
        expect.objectContaining({
          command:
            'npm run ingest:sources -- --candidate-siblings "pubmed:creatine:42141930"',
          mode: "read-only"
        })
      ])
    );
  });

  it("ranks high-conviction claim-scoped clusters before off-claim risk clusters", () => {
    const plan = buildEvidenceCandidateClusterPlan({
      reviewQueue: reviewQueueSnapshot([
        reviewQueueRow({
          claimFitConfidence: "query-only",
          dedupeKey: "clinicaltrials:weak:nct999",
          disposition: "recommend-reject",
          priority: 1,
          recommendation: "hold-or-reject",
          score: 31,
          source: "ClinicalTrials.gov",
          title: "Unrelated endurance protocol",
          trialAlertLabel: "Results review needed"
        }),
        reviewQueueRow({
          dedupeKey: "pubmed:creatine:42141930",
          priority: 4,
          score: 87,
          title: "Creatine and resistance training"
        })
      ])
    });

    expect(plan.summary).toMatchObject({
      clusters: 2,
      highPriorityClusters: 1,
      offClaimRiskClusters: 1
    });
    expect(plan.rows.map((row) => row.clusterKey)).toEqual([
      "PubMed|external-id|42141930",
      "ClinicalTrials.gov|external-id|NCT999"
    ]);
    expect(plan.rows[1].reviewRisks).toEqual(
      expect.arrayContaining([
        "Claim fit is query-only; confirm exact claim fit before accepting.",
        "Confidence policy recommends rejection, but rejection still requires explicit operator approval.",
        "ClinicalTrials.gov alert context must not create score changes or public evidence automatically."
      ])
    );
  });

  it("uses bounded sibling context to flag duplicate and mixed-decision evidence", () => {
    const plan = buildEvidenceCandidateClusterPlan({
      reviewQueue: reviewQueueSnapshot([
        reviewQueueRow({
          dedupeKey: "pubmed:creatine:42141930",
          score: 87,
          siblingContext: {
            candidateRows: [
              {
                decision: "Accepted",
                dedupeKey: "pubmed:creatine-aging:42141930",
                matchReasons: ["Same source/external id"],
                title: "Creatine duplicate context",
                triageScore: 72
              }
            ],
            duplicateIdentityRows: 1,
            inspectedRows: 1,
            matchReasons: ["Same source/external id"],
            mixedDecisionRows: 1,
            noAutomaticCandidateDecision: true,
            noAutomaticExtractionWrite: true,
            noAutomaticPromotion: true,
            readOnly: true,
            relatedContextRows: 0,
            reviewCue:
              "Review duplicate identity rows together before changing any candidate decision."
          },
          title: "Creatine and resistance training"
        })
      ])
    });

    expect(plan.summary).toMatchObject({
      duplicateIdentityRows: 1,
      duplicateClusters: 1,
      siblingInspectedRows: 1
    });
    expect(plan.rows[0]).toMatchObject({
      siblingEvidence: {
        duplicateIdentityRows: 1,
        inspectedRows: 1,
        matchReasons: ["Same source/external id"],
        mixedDecisionRows: 1,
        topRows: [
          {
            decision: "Accepted",
            dedupeKey: "pubmed:creatine-aging:42141930",
            matchReasons: ["Same source/external id"],
            title: "Creatine duplicate context"
          }
        ]
      }
    });
    expect(plan.rows[0].reviewerReasons).toEqual(
      expect.arrayContaining([
        "1 sibling/context row inspected: Review duplicate identity rows together before changing any candidate decision."
      ])
    );
    expect(plan.rows[0].reviewRisks).toEqual(
      expect.arrayContaining([
        "Review sibling/duplicate rows together before changing any candidate decision.",
        "Sibling context includes mixed candidate decisions; compare accepted, rejected, and pending rows before any new decision."
      ])
    );
  });

  it("surfaces accepted-reference matches and curation blockers without writing", () => {
    const plan = buildEvidenceCandidateClusterPlan({
      reviewQueue: reviewQueueSnapshot([
        reviewQueueRow({
          acceptedReferenceId: "ref-pubmed-42141930",
          curationStatus: "Claim link missing",
          dedupeKey: "pubmed:creatine:42141930",
          nextAction: "Link accepted reference to candidate claim.",
          publicSourcePacketReady: false,
          score: 87,
          title: "Creatine and resistance training"
        })
      ])
    });

    expect(plan.summary).toMatchObject({
      acceptedReferenceMatchedClusters: 1,
      curationBlockedClusters: 1
    });
    expect(plan.rows[0].curationEvidence).toEqual({
      acceptedReferenceId: "ref-pubmed-42141930",
      acceptedReferenceMatched: true,
      blockers: [
        "Curation status is Claim link missing; resolve before publication review.",
        "Public source packet is not ready."
      ],
      nextAction: "Link accepted reference to candidate claim.",
      publicSourcePacketReady: false,
      status: "Claim link missing"
    });
    expect(plan.rows[0].reviewRisks).toEqual(
      expect.arrayContaining([
        "Curation status is Claim link missing; resolve before publication review.",
        "Public source packet is not ready."
      ])
    );
    expect(plan.rows[0].reviewOrder).toMatchObject({
      blockerSummary:
        "Curation status is Claim link missing; resolve before publication review.",
      firstInspectLabel: "Inspect reviewed reference matches first",
      reviewState: "blocked-before-decision",
      writes: "none"
    });
  });

  it("returns an empty read-only plan when no review rows are loaded", () => {
    const plan = buildEvidenceCandidateClusterPlan();

    expect(plan.summary).toEqual({
      candidateRows: 0,
      acceptedReferenceMatchedClusters: 0,
      clusters: 0,
      curationBlockedClusters: 0,
      duplicateIdentityRows: 0,
      duplicateClusters: 0,
      highPriorityClusters: 0,
      offClaimRiskClusters: 0,
      siblingInspectedRows: 0
    });
    expect(plan.nextAction).toBe(
      "No pending source-candidate rows are loaded for read-only clustering."
    );
  });
});

function reviewQueueSnapshot(rows: OperatorReviewQueueRow[]): OperatorReviewQueueSnapshot {
  return {
    pendingCount: rows.length,
    rows
  };
}

function reviewQueueRow({
  acceptedReferenceId,
  claimFitConfidence = "claim-scoped",
  curationStatus,
  dedupeKey,
  disposition = "recommend-accept",
  nextAction,
  priority = 4,
  publicSourcePacketReady,
  recommendation = "review-first",
  score,
  siblingContext,
  source = "PubMed",
  title,
  trialAlertLabel
}: {
  acceptedReferenceId?: string;
  claimFitConfidence?: OperatorReviewQueueRow["claimFit"]["confidence"];
  curationStatus?: OperatorReviewQueueRow["curationStatus"];
  dedupeKey: string;
  disposition?: OperatorReviewQueueRow["confidencePolicy"]["disposition"];
  nextAction?: string;
  priority?: number;
  publicSourcePacketReady?: boolean;
  recommendation?: OperatorReviewQueueRow["autopilot"]["recommendation"];
  score: number;
  siblingContext?: OperatorReviewQueueRow["siblingContext"];
  source?: OperatorReviewQueueRow["source"];
  title: string;
  trialAlertLabel?: string;
}): OperatorReviewQueueRow {
  return {
    aiReview: {
      ...(acceptedReferenceId ? { acceptedReferenceId } : {}),
      approvalBlockers: [],
      approvalEnabled: disposition !== "needs-codex-inspection",
      approvalNote: "Codex inspection required.",
      decision: disposition === "recommend-reject" ? "Rejected" : "Accepted",
      label: disposition === "recommend-reject" ? "AI recommends rejected" : "AI recommends accepted",
      noAutoDecision: true,
      noAutoExtraction: true,
      noAutoPromotion: true,
      rationale: ["No automatic decision is performed."],
      reviewFocus: ["Confirm source identity and claim fit before approving."]
    },
    autopilot: {
      curationDraftCommand: `npm run ingest:sources -- --candidate-curation-draft ${JSON.stringify(dedupeKey)}`,
      nextAction: "Review this candidate before any write.",
      noAutoAccept: true,
      noAutoExtraction: true,
      noAutoPromotion: true,
      noAutoReject: true,
      priority,
      rationale: [`${score}/100 source confidence.`],
      recommendation,
      sourceConvictionScore: score,
      sourceReputationLabel: score >= 75 ? "high-repute" : "low-repute"
    },
    claimFit: {
      confidence: claimFitConfidence,
      label:
        claimFitConfidence === "claim-scoped"
          ? "Claim-scoped lead: creatine-strength"
          : "Unscoped source lead",
      query: "creatine strength",
      rationale: ["Original source query: creatine strength."],
      reviewCue: "Confirm exact scoped claim fit before accepting."
    },
    confidencePolicy: {
      actionLabel: disposition === "recommend-reject" ? "Recommend reject" : "Recommend accept",
      autoDecisionDisabledReason: "Source-candidate decisions are never automatic.",
      disposition,
      explicitApprovalRequired: false,
      label: score >= 75 ? "High" : "Very low",
      noAutoAccept: true,
      noAutoDecision: true,
      noAutoReject: true,
      rationale: ["No automatic decision is performed."],
      score,
      thresholds: {
        highConfidenceAcceptAtLeast: 75,
        veryLowConfidenceRejectBelow: 35
      },
      version: "2026-06-14"
    },
    ...(curationStatus ? { curationStatus } : {}),
    dedupeKey,
    decision: "Pending review",
    ...(nextAction ? { nextAction } : {}),
    packetPreview: {
      candidateReviewPacketCommand: `npm run ingest:sources -- --candidate-review-packet ${JSON.stringify(dedupeKey)}`,
      curationStatusCommand: `npm run ingest:sources -- --candidate-curation-status ${JSON.stringify(dedupeKey)}`,
      noCandidateDecision: true,
      noExtractionWrite: true,
      noPromotion: true,
      readOnly: true,
      referenceMatchesCommand: `npm run ingest:sources -- --candidate-reference-matches ${JSON.stringify(dedupeKey)}`,
      siblingsCommand: `npm run ingest:sources -- --candidate-siblings ${JSON.stringify(dedupeKey)}`
    },
    ...(publicSourcePacketReady !== undefined ? { publicSourcePacketReady } : {}),
    ...(siblingContext ? { siblingContext } : {}),
    source,
    reviewStage: {
      actionLabel: "Apply or override: Needs Codex inspection",
      kind: "candidate-decision",
      label: "Candidate decision",
      priority: 4
    },
    reviewStatus: "Unreviewed AI draft",
    title,
    ...(trialAlertLabel
      ? {
          trialAlert: {
            detail: "Posted registry results need review.",
            label: trialAlertLabel,
            noAutoPromotion: true,
            noScoreChange: true
          }
        }
      : {}),
    triageReasons: ["High title overlap"],
    triageScore: score,
    url:
      source === "PubMed"
        ? "https://pubmed.ncbi.nlm.nih.gov/42141930/"
        : "https://clinicaltrials.gov/study/NCT999"
  };
}
