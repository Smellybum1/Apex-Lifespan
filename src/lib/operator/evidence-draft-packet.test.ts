import { describe, expect, it } from "vitest";

import {
  buildEvidenceDraftPacket,
  type EvidenceDraftField,
  type EvidenceDraftPacket
} from "@/lib/operator/evidence-draft-packet";
import { buildEvidenceCandidateClusterPlan } from "@/lib/operator/evidence-candidate-cluster-plan";
import type { SourceCandidatePromotionReadinessRow } from "@/lib/operator/curation-promotion";
import type { OperatorReviewQueueRow } from "@/lib/operator/review-queue";

describe("evidence draft packet", () => {
  it("builds a serializable read-only draft from a pending review queue row", () => {
    const packet = buildEvidenceDraftPacket({
      generatedAt: new Date("2026-06-15T00:00:00.000Z"),
      reviewQueueRow: reviewRow()
    });

    expect(JSON.parse(JSON.stringify(packet))).toEqual(packet);
    expect(packet).toMatchObject({
      candidate: {
        dedupeKey: "pubmed:creatine:42141930",
        source: "PubMed",
        title: "Creatine and resistance training",
        url: "https://pubmed.ncbi.nlm.nih.gov/42141930/"
      },
      draftId: "evidence-draft:pubmed:creatine:42141930",
      generatedAt: "2026-06-15T00:00:00.000Z",
      guardrails: {
        humanOwned: true,
        noAutoCandidateDecision: true,
        noAutoClaimReviewWrite: true,
        noAutoExtractionWrite: true,
        noAutoPromotion: true,
        noAutoPublicEvidenceWrite: true,
        noAutoScoreSnapshot: true,
        readOnly: true
      },
      publication: {
        blockedWriteKinds: [
          "SourceCandidate",
          "Reference",
          "ClaimReference",
          "Study",
          "ReviewEvent",
          "ScoreSnapshot"
        ],
        humanApprovalRequired: true,
        noPublicEvidenceRowsWritten: true,
        status: "draft-only"
      },
      uncertaintyLabels: [
        "accepted-reference-unknown",
        "claim-link-unknown",
        "manual-extraction-required",
        "publication-blocked"
      ]
    });
    expect(packet.diffSnapshot).toMatchObject({
      humanOwned: true,
      noDatabaseWrite: true,
      noPublicEvidenceRowsWritten: true,
      readOnly: true,
      summary: {
        proposedRows: 4,
        totalRows: 8,
        unknownRows: 4
      }
    });
    expect(packet.sourcePacketReadiness).toMatchObject({
      blockedSectionIds: [
        "candidate-review",
        "reference",
        "claim-link",
        "outcome-relevance",
        "study-extraction"
      ],
      clearBlockerList: expect.arrayContaining([
        "Codex did not produce an accept/reject decision; inspect this source before applying.",
        "Accepted reference must be matched by Codex/operator review before evidence drafting can become promotable.",
        "No accepted reference ID is available from the candidate review or promotion snapshot.",
        "No candidate claim ID is available.",
        "No promotion readiness extraction prefill was supplied."
      ]),
      noPublicEvidenceRowsWritten: true,
      status: "blocked",
      writes: "none"
    });
    expect(field(packet, "reference.accepted")).toMatchObject({
      status: "unknown",
      targetRows: [{ table: "Reference" }],
      unknownReason: "No accepted reference ID is available from the candidate review or promotion snapshot."
    });
    expect(field(packet, "claim-link.target")).toMatchObject({
      status: "unknown",
      targetRows: [{ table: "ClaimReference" }],
      unknownReason: "No candidate claim ID is available."
    });
    expect(field(packet, "study-extraction.prefill")).toMatchObject({
      status: "unknown",
      targetRows: [{ table: "Study" }],
      unknownReason: "No promotion readiness extraction prefill was supplied."
    });
    expect(field(packet, "claim-link.outcome-relevance")).toMatchObject({
      blockers: ["Outcome relevance cannot be drafted without a scoped claim."],
      status: "unknown",
      targetRows: [{ table: "ClaimReference" }],
      unknownReason: "No scoped candidate claim ID is available for outcome relevance review."
    });
    expect(field(packet, "confidence.change-gap")).toMatchObject({
      status: "proposed",
      targetRows: [{ table: "ScoreSnapshot" }],
      value:
        "Human-reviewed promotion packet could support a later explicit score snapshot review."
    });
    expect(field(packet, "safety.caveat")).toMatchObject({
      status: "proposed",
      targetRows: [{ table: "ReviewEvent" }],
      value:
        "Keep safety claims conservative until adverse events, population/applicability, interactions, and risk-of-bias context are reviewed."
    });
    expect(packet.blockers.map((blocker) => blocker.label)).toEqual(
      expect.arrayContaining([
        "Codex did not produce an accept/reject decision; inspect this source before applying.",
        "Accepted reference must be matched by Codex/operator review before evidence drafting can become promotable.",
        "Candidate must be linked to a scoped claim before any evidence-map update can be proposed."
      ])
    );
    expectEveryFieldIsTraceableOrExplicitlyUnknown(packet);
  });

  it("marks a fully proposed source packet draft complete without enabling writes", () => {
    const basePromotion = promotionRow();
    const packet = buildEvidenceDraftPacket({
      generatedAt: new Date("2026-06-15T00:00:00.000Z"),
      promotionReadinessRow: promotionRow({
        blockers: [],
        extractionPrefill: {
          ...basePromotion.extractionPrefill,
          fieldSuggestions: [basePromotion.extractionPrefill.fieldSuggestions[0]]
        },
        nextAction:
          "Review ready promotion packet before any explicit publication approval.",
        publicSourcePacketReady: true,
        ready: true,
        status: "Public source packet ready"
      }),
      reviewQueueRow: reviewRow({
        aiReview: {
          ...reviewRow().aiReview,
          acceptedReferenceId: "ref-pubmed-42141930",
          approvalBlockers: [],
          approvalEnabled: true,
          decision: "Accepted",
          label: "AI recommends accepted"
        },
        claimFit: {
          claimId: "creatine-strength",
          confidence: "claim-scoped",
          interventionId: "creatine",
          label: "Claim-scoped lead: creatine-strength",
          query: "creatine strength",
          rationale: [
            "Source discovery persisted claim ID creatine-strength.",
            "Intervention context is creatine.",
            "Original source query: creatine strength."
          ],
          reviewCue:
            "Confirm the source title, external ID, and extracted source text fit this exact claim before accepting."
        }
      })
    });

    expect(packet.sourcePacketReadiness).toMatchObject({
      blockedSectionIds: [],
      clearBlockerList: [],
      humanOwned: true,
      noPublicEvidenceRowsWritten: true,
      readySectionIds: [
        "reference",
        "claim-link",
        "outcome-relevance",
        "study-extraction",
        "limitations",
        "safety",
        "regulatory",
        "confidence"
      ],
      status: "complete-proposed-packet",
      writes: "none"
    });
    expect(packet.sourcePacketReadiness.blockerSummary).toContain(
      "final writes remain AI-reviewed unless a human explicitly confirms them"
    );
    expect(packet.nextAction).toBe(
      "Review the draft packet, then approve explicit candidate, claim-link, extraction, and promotion steps separately."
    );
    expectEveryFieldIsTraceableOrExplicitlyUnknown(packet);
  });

  it("keeps metadata extraction suggestions as proposed draft fields and blocks manual fields", () => {
    const packet = buildEvidenceDraftPacket({
      generatedAt: new Date("2026-06-15T00:00:00.000Z"),
      promotionReadinessRow: promotionRow()
    });

    expect(field(packet, "reference.accepted")).toMatchObject({
      status: "proposed",
      targetRows: [{ id: "ref-pubmed-42141930", table: "Reference" }],
      value: "ref-pubmed-42141930"
    });
    expect(field(packet, "claim-link.target")).toMatchObject({
      status: "proposed",
      targetRows: [
        {
          field: "creatine-strength:ref-pubmed-42141930",
          table: "ClaimReference"
        }
      ],
      value: "creatine-strength -> ref-pubmed-42141930"
    });
    expect(field(packet, "claim-link.target").provenance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "candidate.claimId",
          source: "curation-claim-link-draft",
          value: "creatine-strength"
        }),
        expect.objectContaining({
          field: "candidate.acceptedReferenceId",
          source: "curation-claim-link-draft",
          value: "ref-pubmed-42141930"
        }),
        expect.objectContaining({
          field: "curation.status",
          source: "curation-status",
          value: "Claim link missing"
        })
      ])
    );
    expect(field(packet, "claim-link.outcome-relevance")).toMatchObject({
      blockers: [
        "Human reviewer must confirm outcome relevance before any ClaimReference relevance is written."
      ],
      status: "unknown",
      targetRows: [
        {
          field: "creatine-strength:ref-pubmed-42141930:relevance",
          table: "ClaimReference"
        }
      ],
      unknownReason:
        "No claim-fit snapshot was supplied; review source against the claim outcome before setting relevance."
    });
    expect(field(packet, "study-extraction.abstract")).toMatchObject({
      confidence: "strong",
      status: "proposed",
      targetRows: [
        {
          field: "--study-abstract",
          id: "ref-pubmed-42141930",
          table: "Study"
        }
      ],
      value: "PubMed abstract: Creatine abstract for extraction prefill."
    });
    expect(field(packet, "study-extraction.abstract").provenance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "abstract",
          label: "Draft extraction value",
          source: "curation-extraction-draft",
          value: "PubMed abstract: Creatine abstract for extraction prefill.",
          writeFlag: "--study-abstract"
        }),
        expect.objectContaining({
          field: "sourceTextStatus",
          source: "candidate-metadata",
          value: "PubMed abstract text captured for the curation draft."
        }),
        expect.objectContaining({
          field: "fullTextStatus",
          source: "curation-extraction-draft",
          value:
            "Full text is not automatically captured; operators must verify the source packet before writing extraction fields."
        })
      ])
    );
    expect(field(packet, "study-extraction.sampleSize")).toMatchObject({
      confidence: "missing",
      status: "unknown",
      unknownReason:
        "No sampleSize value was available in candidate metadata; human extraction is required."
    });
    expect(field(packet, "study-extraction.sampleSize").value).toBeUndefined();
    expect(field(packet, "study-extraction.sampleSize").provenance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "sampleSize",
          label: "Missing",
          source: "curation-extraction-draft",
          value:
            "No sampleSize value was available in candidate metadata; human extraction is required.",
          writeFlag: "--study-sample-size"
        })
      ])
    );
    expect(packet.diffSnapshot.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          after: {
            status: "unknown"
          },
          before: {
            status: "not-inspected"
          },
          fieldId: "study-extraction.sampleSize",
          provenanceCount: 3
        })
      ])
    );
    expect(packet.uncertaintyLabels).toEqual(
      expect.arrayContaining(["manual-extraction-required", "publication-blocked"])
    );
    expect(packet.blockers.map((blocker) => blocker.label)).toEqual(
      expect.arrayContaining([
        "Accepted reference must be linked to the candidate claim.",
        "Accepted reference must have a structured study extraction.",
        "Curation status must report publicSourcePacketReady=true.",
        "Sample size requires human extraction before it can become evidence-map truth."
      ])
    );
    expectEveryFieldIsTraceableOrExplicitlyUnknown(packet);
  });

  it("carries candidate cluster review order into draft blockers without writing", () => {
    const reviewQueueRow = reviewRow();
    const candidateClusterRow = buildEvidenceCandidateClusterPlan({
      reviewQueue: {
        pendingCount: 1,
        rows: [reviewQueueRow]
      }
    }).rows[0];
    const packet = buildEvidenceDraftPacket({
      candidateClusterRow,
      generatedAt: new Date("2026-06-15T00:00:00.000Z"),
      reviewQueueRow
    });

    expect(packet.candidateReviewOrder).toMatchObject({
      clusterKey: "PubMed|external-id|42141930",
      firstInspectCommand:
        'npm run ingest:sources -- --candidate-reference-matches "pubmed:creatine:42141930"',
      firstInspectLabel: "Inspect reviewed reference matches first",
      noCandidateDecisionWrite: true,
      noEvidenceExtractionWrite: true,
      noPublicEvidenceRowsWritten: true,
      reviewState: "blocked-before-decision",
      writes: "none"
    });
    expect(field(packet, "candidate-review.order")).toMatchObject({
      blockers: [
        "Claim fit is query-only; inspect exact claim fit before any decision."
      ],
      confidence: "weak",
      status: "blocked",
      targetRows: [
        {
          id: "pubmed:creatine:42141930",
          table: "SourceCandidate"
        }
      ],
      unknownReason:
        "Candidate cluster review order is blocked before any candidate decision."
    });
    expect(field(packet, "candidate-review.order").provenance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command:
            'npm run ingest:sources -- --candidate-reference-matches "pubmed:creatine:42141930"',
          field: "reviewOrder.orderingReason",
          source: "candidate-cluster"
        })
      ])
    );
    expect(packet.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label:
            "Claim fit is query-only; inspect exact claim fit before any decision.",
          source: "candidate-review"
        })
      ])
    );
    expectEveryFieldIsTraceableOrExplicitlyUnknown(packet);
  });

  it("combines accepted review guidance with promotion blockers without publication writes", () => {
    const packet = buildEvidenceDraftPacket({
      promotionReadinessRow: promotionRow(),
      reviewQueueRow: reviewRow({
        aiReview: {
          ...reviewRow().aiReview,
          acceptedReferenceId: "ref-pubmed-42141930",
          approvalBlockers: [],
          approvalEnabled: true,
          decision: "Accepted",
          label: "AI recommends accepted"
        },
        claimFit: {
          claimId: "creatine-strength",
          confidence: "claim-scoped",
          interventionId: "creatine",
          label: "Claim-scoped lead: creatine-strength",
          query: "creatine strength",
          rationale: [
            "Source discovery persisted claim ID creatine-strength.",
            "Intervention context is creatine.",
            "Original source query: creatine strength."
          ],
          reviewCue:
            "Confirm the source title, external ID, and extracted source text fit this exact claim before accepting."
        }
      })
    });

    expect(packet.confidence).toMatchObject({
      disposition: "needs-codex-inspection",
      label: "Low",
      score: 54
    });
    expect(packet.nextAction).toBe("Accepted reference must be linked to the candidate claim.");
    expect(packet.publication).toEqual({
      blockedWriteKinds: [
        "SourceCandidate",
        "Reference",
        "ClaimReference",
        "Study",
        "ReviewEvent",
        "ScoreSnapshot"
      ],
      humanApprovalRequired: true,
      noPublicEvidenceRowsWritten: true,
      status: "draft-only"
    });
    expect(packet.guardrails.noAutoCandidateDecision).toBe(true);
    expect(packet.guardrails.noAutoExtractionWrite).toBe(true);
    expect(packet.guardrails.noAutoPromotion).toBe(true);
    expect(packet.blockers.map((blocker) => blocker.source)).toEqual(
      expect.arrayContaining(["claim-link", "study-extraction", "publication"])
    );
    expect(field(packet, "claim-link.outcome-relevance")).toMatchObject({
      confidence: "strong",
      status: "proposed",
      targetRows: [
        {
          field: "creatine-strength:ref-pubmed-42141930:relevance",
          table: "ClaimReference"
        }
      ],
      value: "creatine-strength / claim-scoped outcome relevance requires human confirmation"
    });
  });
});

function field(packet: EvidenceDraftPacket, id: string): EvidenceDraftField {
  const found = packet.fields.find((item) => item.id === id);

  if (!found) {
    throw new Error(`Expected field ${id} in draft packet.`);
  }

  return found;
}

function expectEveryFieldIsTraceableOrExplicitlyUnknown(packet: EvidenceDraftPacket) {
  for (const item of packet.fields) {
    expect(
      item.provenance.length > 0 || Boolean(item.unknownReason),
      `${item.id} should have provenance or unknownReason`
    ).toBe(true);
  }
}

function reviewRow(overrides: Partial<OperatorReviewQueueRow> = {}): OperatorReviewQueueRow {
  return {
    aiReview: {
      approvalBlockers: [
        "Codex did not produce an accept/reject decision; inspect this source before applying."
      ],
      approvalEnabled: false,
      approvalNote:
        "Codex AI-reviewed candidate decision: Needs Codex inspection. No extraction rows or public evidence promotion are approved by this action.",
      decision: "Needs Codex inspection",
      label: "AI review needs Codex inspection",
      noAutoDecision: true,
      noAutoExtraction: true,
      noAutoPromotion: true,
      rationale: ["No accepted-reference match is prefilled for an AI accept decision."],
      reviewFocus: [
        "Confirm source identity, external ID, title/query relevance, and claim fit before approving."
      ]
    },
    autopilot: {
      curationDraftCommand:
        'npm run ingest:sources -- --candidate-curation-draft "pubmed:creatine:42141930"',
      nextAction:
        "Use as limitation or secondary context unless stronger reviewed evidence is unavailable.",
      noAutoAccept: true,
      noAutoExtraction: true,
      noAutoPromotion: true,
      noAutoReject: true,
      priority: 2,
      rationale: [
        "high-repute source with low conviction (54/100).",
        "Use as limitation or context unless stronger human evidence is unavailable."
      ],
      recommendation: "limitations-only",
      sourceConvictionScore: 54,
      sourceReputationLabel: "high-repute"
    },
    claimFit: {
      confidence: "query-only",
      label: "Unscoped source lead",
      query: "creatine",
      rationale: [
        "No persisted claim ID or intervention ID is attached to this candidate.",
        "Original source query: creatine."
      ],
      reviewCue:
        "Use the packet, siblings, and reference-match commands to establish claim fit before any decision."
    },
    confidencePolicy: {
      actionLabel: "Needs Codex inspection",
      autoDecisionDisabledReason:
        "Source-candidate decisions are never automatic; the confidence policy only prefills an operator-owned decision.",
      disposition: "needs-codex-inspection",
      explicitApprovalRequired: false,
      label: "Low",
      noAutoAccept: true,
      noAutoDecision: true,
      noAutoReject: true,
      rationale: [
        "54/100 low source confidence from rubric 2026-06-13.",
        "Confidence is not enough for an accept/reject shortcut; keep this row in Codex inspection.",
        "No automatic decision is performed."
      ],
      score: 54,
      thresholds: {
        highConfidenceAcceptAtLeast: 75,
        veryLowConfidenceRejectBelow: 35
      },
      version: "2026-06-14"
    },
    dedupeKey: "pubmed:creatine:42141930",
    packetPreview: {
      candidateReviewPacketCommand:
        'npm run ingest:sources -- --candidate-review-packet "pubmed:creatine:42141930"',
      curationStatusCommand:
        'npm run ingest:sources -- --candidate-curation-status "pubmed:creatine:42141930"',
      noCandidateDecision: true,
      noExtractionWrite: true,
      noPromotion: true,
      readOnly: true,
      referenceMatchesCommand:
        'npm run ingest:sources -- --candidate-reference-matches "pubmed:creatine:42141930"',
      siblingsCommand:
        'npm run ingest:sources -- --candidate-siblings "pubmed:creatine:42141930"'
    },
    source: "PubMed",
    title: "Creatine and resistance training",
    triageReasons: ["High title overlap"],
    triageScore: 87,
    url: "https://pubmed.ncbi.nlm.nih.gov/42141930/",
    ...overrides,
    decision: overrides.decision ?? "Pending review",
    reviewStage: overrides.reviewStage ?? {
      actionLabel: "Apply or override: Needs Codex inspection",
      kind: "candidate-decision",
      label: "Candidate decision",
      priority: 4
    },
    reviewStatus: overrides.reviewStatus ?? "Unreviewed AI draft"
  };
}

function promotionRow(
  overrides: Partial<SourceCandidatePromotionReadinessRow> = {}
): SourceCandidatePromotionReadinessRow {
  return {
    actionPreview: {
      browserAction:
        "Resolve promotion blockers before the browser promotion action is usable.",
      dryRunCommand:
        "npm run promotion:dry-run -- b64:cHVibWVkOmNyZWF0aW5lOjQyMTQxOTMw",
      promotionEffect:
        "No public packet write preview until accepted reference, claim link, structured extraction, and packet readiness are complete.",
      requiredPermission: "evidence:promote"
    },
    blockers: [
      "Accepted reference must be linked to the candidate claim.",
      "Accepted reference must have a structured study extraction.",
      "Curation status must report publicSourcePacketReady=true."
    ],
    candidate: {
      acceptedReferenceId: "ref-pubmed-42141930",
      claimId: "creatine-strength",
      decision: "Accepted",
      dedupeKey: "pubmed:creatine:42141930",
      externalId: "42141930",
      reviewStatus: "Human reviewed",
      source: "PubMed",
      title: "Creatine and resistance training"
    },
    extractionPrefill: {
      curationDraftCommand:
        "npm run ingest:sources -- --candidate-curation-draft b64:cHVibWVkOmNyZWF0aW5lOjQyMTQxOTMw",
      fieldSuggestions: [
        {
          confidence: "candidate-metadata",
          confidenceLabel: "Strong",
          confidenceRationale:
            "Value comes directly from captured source metadata or source-text preview, but still needs operator verification.",
          field: "abstract",
          label: "Abstract/source summary",
          note:
            "Captured abstract or registry summary can seed the optional study abstract field, but operators must verify source context before writing.",
          reviewConfidence: "strong",
          value: "PubMed abstract: Creatine abstract for extraction prefill.",
          writeFlag: "--study-abstract"
        },
        {
          confidence: "manual-required",
          confidenceLabel: "Missing",
          confidenceRationale:
            "No sampleSize value was available in candidate metadata; human extraction is required.",
          field: "sampleSize",
          label: "Sample size",
          note:
            "Enrollment/sample-size metadata may describe planned rather than analyzed sample; verify actual analyzed sample before writing.",
          reviewConfidence: "missing",
          value: "Human-reviewed sampleSize required.",
          writeFlag: "--study-sample-size"
        }
      ],
      fullTextStatus:
        "Full text is not automatically captured; operators must verify the source packet before writing extraction fields.",
      sourceTextStatus: "PubMed abstract text captured for the curation draft."
    },
    nextAction: "Accepted reference must be linked to the candidate claim.",
    publicSourcePacketReady: false,
    ready: false,
    status: "Claim link missing",
    ...overrides
  };
}
