import { describe, expect, it, vi } from "vitest";

import {
  listSourceCandidateCurationHandoff,
  listSourceCandidateReviewQueue
} from "@/lib/data/source-candidates";
import { getOperatorReviewQueueSnapshot } from "@/lib/operator/review-queue";
import type { SourceCandidate } from "@/lib/types";

vi.mock("@/lib/data/source-candidates", () => ({
  listSourceCandidateCurationHandoff: vi.fn(),
  listSourceCandidateReviewQueue: vi.fn()
}));

const listSourceCandidateReviewQueueMock = vi.mocked(listSourceCandidateReviewQueue);
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

describe("operator review queue snapshot", () => {
  it("returns read-only rows with curation status hints", async () => {
    listSourceCandidateReviewQueueMock.mockResolvedValue([candidate]);
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
          curationStatus: "Claim link missing",
          dedupeKey: "pubmed:creatine:42141930",
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
  });

  it("sorts queue rows by source-conviction autopilot priority before raw triage score", async () => {
    const highTriageWeakCandidate: SourceCandidate = {
      ...candidate,
      dedupeKey: "clinicaltrials:weak:nct123",
      externalId: "NCT123",
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
      dedupeKey: "pubmed:strong:28615996",
      externalId: "28615996",
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

    await expect(getOperatorReviewQueueSnapshot(2)).resolves.toMatchObject({
      pendingCount: 2,
      rows: [
        {
          dedupeKey: "pubmed:strong:28615996",
          autopilot: {
            recommendation: "review-first",
            priority: 4
          }
        },
        {
          dedupeKey: "clinicaltrials:weak:nct123",
          autopilot: {
            recommendation: "review-after-stronger-sources",
            priority: 3
          }
        }
      ]
    });
    expect(listSourceCandidateReviewQueueMock).toHaveBeenCalledWith({ limit: 6 });
  });
});
