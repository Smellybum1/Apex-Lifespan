import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  listSourceCandidateAcceptedReferenceMatches,
  listSourceCandidateCurationHandoff,
  listSourceCandidateReviewQueue,
  listSourceCandidateSiblings
} from "@/lib/data/source-candidates";
import {
  getOperatorReviewQueueSnapshot,
  getOperatorReviewQueueSnapshotForIngestionJobs
} from "@/lib/operator/review-queue";
import type { Reference, SourceCandidate } from "@/lib/types";

vi.mock("@/lib/data/source-candidates", () => ({
  listSourceCandidateAcceptedReferenceMatches: vi.fn(),
  listSourceCandidateCurationHandoff: vi.fn(),
  listSourceCandidateReviewQueue: vi.fn(),
  listSourceCandidateSiblings: vi.fn()
}));

const listSourceCandidateAcceptedReferenceMatchesMock = vi.mocked(
  listSourceCandidateAcceptedReferenceMatches
);
const listSourceCandidateReviewQueueMock = vi.mocked(listSourceCandidateReviewQueue);
const listSourceCandidateSiblingsMock = vi.mocked(listSourceCandidateSiblings);
const listSourceCandidateCurationHandoffMock = vi.mocked(
  listSourceCandidateCurationHandoff
);

const candidate: SourceCandidate = {
  decision: "Pending review",
  dedupeKey: "pubmed:creatine:42141930",
  externalId: "42141930",
  metadata: {},
  query: "creatine",
  region: "AU",
  reviewStatus: "Unreviewed AI draft",
  source: "PubMed",
  title: "Creatine and resistance training",
  triageReasons: ["High title overlap"],
  triageScore: 87,
  url: "https://pubmed.ncbi.nlm.nih.gov/42141930/"
};

const reference: Reference = {
  id: "ref-pubmed-42141930",
  identifier: "PMID: 42141930",
  source: "PubMed",
  title: "Creatine and resistance training",
  url: "https://pubmed.ncbi.nlm.nih.gov/42141930/",
  year: 2026
};

describe("operator review queue snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listSourceCandidateSiblingsMock.mockImplementation(async (dedupeKey) => ({
      siblings: [],
      target: {
        ...candidate,
        dedupeKey
      }
    }));
  });

  it("returns read-only rows with curation status hints", async () => {
    listSourceCandidateReviewQueueMock.mockResolvedValue([candidate]);
    listSourceCandidateAcceptedReferenceMatchesMock.mockResolvedValue(null);
    listSourceCandidateCurationHandoffMock.mockResolvedValue([
      {
        candidate,
        claimLinks: [],
        nextAction: "Link accepted reference to candidate claim.",
        publicSourcePacketReady: false,
        status: "Claim link missing",
        studies: []
      }
    ]);

    await expect(getOperatorReviewQueueSnapshot(5)).resolves.toEqual({
      pendingCount: 1,
      rows: [
        {
          aiReview: {
            approvalBlockers: [
              "Codex did not produce an accept/reject decision; inspect this source before applying."
            ],
            approvalEnabled: false,
            approvalNote: expect.stringContaining(
              "Codex AI-reviewed candidate decision: Needs Codex inspection."
            ),
            decision: "Needs Codex inspection",
            label: "AI review needs Codex inspection",
            noAutoDecision: true,
            noAutoExtraction: true,
            noAutoPromotion: true,
            rationale: expect.arrayContaining([
              "No accepted-reference match is prefilled for an AI accept decision."
            ]),
            reviewFocus: expect.arrayContaining([
              "Accepting only reviews the source candidate; it does not write extraction rows or promote public evidence."
            ])
          },
          curationStatus: "Claim link missing",
          dedupeKey: "pubmed:creatine:42141930",
          decision: "Pending review",
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
              "No blind background decision is made; Codex may apply an AI-reviewed decision with a source-backed audit note.",
            disposition: "needs-codex-inspection",
            explicitApprovalRequired: false,
            label: "Low",
            noAutoAccept: true,
            noAutoDecision: true,
            noAutoReject: true,
            rationale: [
              "54/100 low source confidence from rubric 2026-06-13.",
              "Confidence is not enough for a shortcut; inspect source identity, claim fit, and siblings before applying a decision.",
              "No blind background decision is performed."
            ],
            score: 54,
            thresholds: {
              highConfidenceAcceptAtLeast: 75,
              veryLowConfidenceRejectBelow: 35
            },
            version: "2026-06-14"
          },
          nextAction: "Link accepted reference to candidate claim.",
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
          publicSourcePacketReady: false,
          reviewStage: {
            actionLabel: "Approve or reject the claim-link handoff",
            kind: "claim-link",
            label: "Claim-link review",
            priority: 5
          },
          reviewStatus: "Unreviewed AI draft",
          siblingContext: {
            candidateRows: [],
            duplicateIdentityRows: 0,
            inspectedRows: 0,
            matchReasons: [],
            mixedDecisionRows: 0,
            noAutomaticCandidateDecision: true,
            noAutomaticExtractionWrite: true,
            noAutomaticPromotion: true,
            readOnly: true,
            relatedContextRows: 0,
            reviewCue:
              "No sibling rows were found in the bounded read-only inspection."
          },
          source: "PubMed",
          title: "Creatine and resistance training",
          triageReasons: ["High title overlap"],
          triageScore: 87,
          url: "https://pubmed.ncbi.nlm.nih.gov/42141930/"
        }
      ]
    });
    expect(listSourceCandidateReviewQueueMock).toHaveBeenCalledWith({ limit: 15 });
    expect(listSourceCandidateCurationHandoffMock).toHaveBeenCalledWith({ limit: 5 });
    expect(listSourceCandidateAcceptedReferenceMatchesMock).toHaveBeenCalledWith(
      "pubmed:creatine:42141930"
    );
    expect(listSourceCandidateSiblingsMock).toHaveBeenCalledWith(
      "pubmed:creatine:42141930",
      { limit: 10 }
    );
  });

  it("includes accepted curation handoff rows without reopening candidate decisions", async () => {
    const acceptedCandidate: SourceCandidate = {
      ...candidate,
      acceptedReferenceId: reference.id,
      decision: "Accepted",
      reviewStatus: "Human reviewed"
    };

    listSourceCandidateReviewQueueMock.mockResolvedValue([]);
    listSourceCandidateCurationHandoffMock.mockResolvedValue([
      {
        acceptedReference: reference,
        acceptedReferenceId: reference.id,
        candidate: acceptedCandidate,
        candidateClaimLinked: true,
        claimLinks: [],
        nextAction: "Review for public source packet inclusion.",
        publicSourcePacketReady: true,
        status: "Public source packet ready",
        studies: []
      }
    ]);
    listSourceCandidateAcceptedReferenceMatchesMock.mockResolvedValue({
      candidate: acceptedCandidate,
      references: [reference]
    });

    await expect(getOperatorReviewQueueSnapshot(5)).resolves.toMatchObject({
      pendingCount: 1,
      rows: [
        {
          curationStatus: "Public source packet ready",
          decision: "Accepted",
          dedupeKey: "pubmed:creatine:42141930",
          publicSourcePacketReady: true,
          reviewStage: {
            actionLabel: "Review source packet for public inclusion",
            kind: "public-source-packet",
            label: "Public source packet review",
            priority: 6
          },
          reviewStatus: "Human reviewed"
        }
      ]
    });
    expect(listSourceCandidateReviewQueueMock).toHaveBeenCalledWith({ limit: 15 });
    expect(listSourceCandidateCurationHandoffMock).toHaveBeenCalledWith({ limit: 5 });
  });

  it("returns exact pending candidates from recent ingestion jobs", async () => {
    const duplicateCandidate: SourceCandidate = {
      ...candidate,
      ingestionJobId: "job-b"
    };

    listSourceCandidateReviewQueueMock
      .mockResolvedValueOnce([{ ...candidate, ingestionJobId: "job-a" }])
      .mockResolvedValueOnce([duplicateCandidate]);
    listSourceCandidateCurationHandoffMock
      .mockResolvedValueOnce([
        {
          candidate,
          claimLinks: [],
          nextAction: "Link accepted reference to candidate claim.",
          publicSourcePacketReady: false,
          status: "Claim link missing",
          studies: []
        }
      ])
      .mockResolvedValueOnce([]);
    listSourceCandidateAcceptedReferenceMatchesMock.mockResolvedValue(null);

    await expect(
      getOperatorReviewQueueSnapshotForIngestionJobs(["job-a", "job-b", "job-a"], 5)
    ).resolves.toMatchObject({
      pendingCount: 1,
      rows: [
        {
          curationStatus: "Claim link missing",
          dedupeKey: "pubmed:creatine:42141930",
          nextAction: "Link accepted reference to candidate claim."
        }
      ]
    });
    expect(listSourceCandidateReviewQueueMock).toHaveBeenNthCalledWith(1, {
      ingestionJobId: "job-a",
      limit: 5
    });
    expect(listSourceCandidateReviewQueueMock).toHaveBeenNthCalledWith(2, {
      ingestionJobId: "job-b",
      limit: 5
    });
    expect(listSourceCandidateReviewQueueMock).toHaveBeenCalledTimes(2);
    expect(listSourceCandidateCurationHandoffMock).toHaveBeenNthCalledWith(1, {
      ingestionJobId: "job-a",
      limit: 5
    });
    expect(listSourceCandidateCurationHandoffMock).toHaveBeenNthCalledWith(2, {
      ingestionJobId: "job-b",
      limit: 5
    });
  });

  it("summarizes bounded sibling and duplicate context for cluster planning", async () => {
    const acceptedSibling: SourceCandidate = {
      ...candidate,
      decision: "Accepted",
      dedupeKey: "pubmed:creatine-aging:42141930",
      query: "creatine aging",
      title: "Creatine aging duplicate context"
    };
    const querySibling: SourceCandidate = {
      ...candidate,
      decision: "Rejected",
      dedupeKey: "pubmed:creatine-strength:999999",
      externalId: "999999",
      query: "creatine",
      title: "Creatine unrelated query context"
    };

    listSourceCandidateReviewQueueMock.mockResolvedValue([candidate]);
    listSourceCandidateCurationHandoffMock.mockResolvedValue([]);
    listSourceCandidateAcceptedReferenceMatchesMock.mockResolvedValue(null);
    listSourceCandidateSiblingsMock.mockResolvedValue({
      siblings: [
        {
          candidate: acceptedSibling,
          matchReasons: ["Same source/external id"]
        },
        {
          candidate: querySibling,
          matchReasons: ["Same query/region"]
        }
      ],
      target: candidate
    });

    await expect(getOperatorReviewQueueSnapshot(1)).resolves.toMatchObject({
      rows: [
        {
          dedupeKey: "pubmed:creatine:42141930",
          siblingContext: {
            candidateRows: [
              {
                decision: "Accepted",
                dedupeKey: "pubmed:creatine-aging:42141930",
                matchReasons: ["Same source/external id"],
                title: "Creatine aging duplicate context",
                triageScore: 87
              },
              {
                decision: "Rejected",
                dedupeKey: "pubmed:creatine-strength:999999",
                matchReasons: ["Same query/region"],
                title: "Creatine unrelated query context",
                triageScore: 87
              }
            ],
            duplicateIdentityRows: 1,
            inspectedRows: 2,
            matchReasons: ["Same source/external id", "Same query/region"],
            mixedDecisionRows: 2,
            noAutomaticCandidateDecision: true,
            noAutomaticExtractionWrite: true,
            noAutomaticPromotion: true,
            readOnly: true,
            relatedContextRows: 1,
            reviewCue:
              "Review duplicate identity rows together before changing any candidate decision."
          }
        }
      ]
    });
  });

  it("sorts queue rows by source-conviction autopilot priority before raw triage score", async () => {
    const highTriageWeakCandidate: SourceCandidate = {
      ...candidate,
      dedupeKey: "clinicaltrials:weak:nct123",
      externalId: "NCT123",
      metadata: {
        trialAlertDetail:
          "This direct-match registry row is active or recruiting. Monitor for status/results changes; do not promote it into evidence automatically.",
        trialAlertLabel: "Monitor active trial"
      },
      query: "creatine strength",
      source: "ClinicalTrials.gov",
      sourceType: "animal mechanistic",
      title: "Unrelated endurance protocol",
      triageReasons: ["High raw queue score"],
      triageScore: 100,
      url: "https://clinicaltrials.gov/study/NCT123"
    };
    const lowerTriageReviewFirstCandidate: SourceCandidate = {
      ...candidate,
      abstractAvailable: true,
      claimId: "creatine-strength",
      dedupeKey: "pubmed:strong:28615996",
      externalId: "28615996",
      interventionId: "creatine",
      publishedYear: 2025,
      query: "creatine strength",
      sourceType: "randomized controlled trial",
      title: "Creatine strength randomized controlled trial",
      triageReasons: ["Lower raw queue score"],
      triageScore: 40,
      url: "https://pubmed.ncbi.nlm.nih.gov/28615996/"
    };

    listSourceCandidateReviewQueueMock.mockResolvedValue([
      highTriageWeakCandidate,
      lowerTriageReviewFirstCandidate
    ]);
    listSourceCandidateCurationHandoffMock.mockResolvedValue([]);
    listSourceCandidateAcceptedReferenceMatchesMock.mockImplementation(async (dedupeKey) =>
      dedupeKey === "pubmed:strong:28615996"
        ? {
            candidate: lowerTriageReviewFirstCandidate,
            references: [reference]
          }
        : null
    );

    await expect(getOperatorReviewQueueSnapshot(2)).resolves.toMatchObject({
      pendingCount: 2,
      rows: [
        {
          claimFit: {
            claimId: "creatine-strength",
            confidence: "claim-scoped",
            interventionId: "creatine",
            label: "Claim-scoped lead: creatine-strength",
            query: "creatine strength"
          },
          dedupeKey: "pubmed:strong:28615996",
          aiReview: {
            acceptedReferenceId: "ref-pubmed-42141930",
            approvalEnabled: true,
            decision: "Accepted",
            label: "AI recommends accepted"
          },
          autopilot: {
            recommendation: "review-first",
            priority: 4
          },
          confidencePolicy: {
            disposition: "recommend-accept",
            explicitApprovalRequired: false,
            noAutoDecision: true
          }
        },
        {
          dedupeKey: "clinicaltrials:weak:nct123",
          autopilot: {
            recommendation: "review-after-stronger-sources",
            priority: 3
          },
          confidencePolicy: {
            disposition: "needs-codex-inspection",
            explicitApprovalRequired: false,
            noAutoReject: true
          },
          trialAlert: {
            detail:
              "This direct-match registry row is active or recruiting. Monitor for status/results changes; do not promote it into evidence automatically.",
            label: "Monitor active trial",
            noAutoPromotion: true,
            noScoreChange: true
          }
        }
      ]
    });
    expect(listSourceCandidateReviewQueueMock).toHaveBeenCalledWith({ limit: 6 });
  });

  it("recommends but does not auto-write rejection for very-low-confidence candidates", async () => {
    const veryLowConfidenceCandidate: SourceCandidate = {
      ...candidate,
      abstractAvailable: false,
      dedupeKey: "clinicaltrials:weak:nct999",
      externalId: "NCT999",
      metadata: {},
      query: "creatine strength muscle",
      source: "ClinicalTrials.gov",
      sourceType: "animal mechanistic",
      title: "Unrelated endurance protocol",
      triageReasons: ["No direct human result signal"],
      triageScore: 0,
      url: "https://clinicaltrials.gov/study/NCT999"
    };

    listSourceCandidateReviewQueueMock.mockResolvedValue([veryLowConfidenceCandidate]);
    listSourceCandidateCurationHandoffMock.mockResolvedValue([]);
    listSourceCandidateAcceptedReferenceMatchesMock.mockResolvedValue(null);

    await expect(getOperatorReviewQueueSnapshot(1)).resolves.toMatchObject({
      pendingCount: 1,
      rows: [
        {
          aiReview: {
            approvalBlockers: [],
            approvalEnabled: true,
            decision: "Rejected",
            label: "AI recommends rejected",
            noAutoDecision: true,
            noAutoExtraction: true,
            noAutoPromotion: true
          },
          confidencePolicy: {
            actionLabel: "Recommend reject",
            disposition: "recommend-reject",
            explicitApprovalRequired: false,
            label: "Very low",
            noAutoAccept: true,
            noAutoDecision: true,
            noAutoReject: true,
            rationale: [
              "31/100 very low source confidence from rubric 2026-06-13.",
              "Very-low confidence below 35/100 or hold/reject triage; Codex may reject with an AI-reviewed audit note.",
              "No blind background rejection is performed."
            ],
            score: 31,
            thresholds: {
              highConfidenceAcceptAtLeast: 75,
              veryLowConfidenceRejectBelow: 35
            },
            version: "2026-06-14"
          },
          dedupeKey: "clinicaltrials:weak:nct999"
        }
      ]
    });
  });
});
