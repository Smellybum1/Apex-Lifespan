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
          nextAction: "Link accepted reference to candidate claim.",
          publicSourcePacketReady: false,
          source: "PubMed",
          title: "Creatine and resistance training",
          triageReasons: ["High title overlap"],
          triageScore: 87,
          url: "https://pubmed.ncbi.nlm.nih.gov/42141930/"
        }
      ]
    });
    expect(listSourceCandidateReviewQueueMock).toHaveBeenCalledWith({ limit: 5 });
    expect(listSourceCandidateCurationHandoffMock).toHaveBeenCalledWith({ limit: 5 });
  });
});
