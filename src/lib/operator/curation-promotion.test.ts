import { describe, expect, it, vi } from "vitest";

import {
  getSourceCandidateCurationStatus,
  listSourceCandidateCurationHandoff
} from "@/lib/data/source-candidates";
import {
  assessSourceCandidatePublicPromotion,
  getSourceCandidatePromotionReadinessSnapshot
} from "@/lib/operator/curation-promotion";
import type { Reference, SourceCandidate } from "@/lib/types";

vi.mock("@/lib/data/source-candidates", () => ({
  getSourceCandidateCurationStatus: vi.fn(),
  listSourceCandidateCurationHandoff: vi.fn()
}));

const getSourceCandidateCurationStatusMock = vi.mocked(getSourceCandidateCurationStatus);
const listSourceCandidateCurationHandoffMock = vi.mocked(listSourceCandidateCurationHandoff);

const candidate: SourceCandidate = {
  acceptedReferenceId: "ref-pubmed-42141930",
  claimId: "creatine-strength",
  decision: "Accepted",
  dedupeKey: "pubmed|au|creatine-strength|42141930|creatine|creatine-strength",
  externalId: "42141930",
  metadata: {},
  query: "creatine strength",
  region: "AU",
  reviewStatus: "Human reviewed",
  source: "PubMed",
  title: "Creatine and resistance training",
  triageReasons: ["High title overlap"],
  triageScore: 87,
  url: "https://pubmed.ncbi.nlm.nih.gov/42141930/"
};

const acceptedReference: Reference = {
  id: "ref-pubmed-42141930",
  identifier: "42141930",
  source: "PubMed",
  title: "Creatine and resistance training",
  url: "https://pubmed.ncbi.nlm.nih.gov/42141930/",
  year: 2026
};

describe("source candidate promotion assessment", () => {
  it("blocks missing candidates", async () => {
    getSourceCandidateCurationStatusMock.mockResolvedValue(null);

    await expect(assessSourceCandidatePublicPromotion(candidate.dedupeKey)).resolves.toMatchObject({
      blockers: ["Source candidate not found."],
      ready: false
    });
  });

  it("blocks candidates before claim link and extraction are complete", async () => {
    getSourceCandidateCurationStatusMock.mockResolvedValue({
      acceptedReference,
      acceptedReferenceId: acceptedReference.id,
      candidate,
      claimLinks: [],
      nextAction: "Link accepted reference to candidate claim.",
      publicSourcePacketReady: false,
      status: "Claim link missing",
      studies: []
    });

    await expect(assessSourceCandidatePublicPromotion(candidate.dedupeKey)).resolves.toMatchObject({
      blockers: [
        "Accepted reference must be linked to the candidate claim.",
        "Accepted reference must have a structured study extraction.",
        "Curation status must report publicSourcePacketReady=true."
      ],
      ready: false
    });
  });

  it("returns a public packet only after curation is ready", async () => {
    getSourceCandidateCurationStatusMock.mockResolvedValue({
      acceptedReference,
      acceptedReferenceId: acceptedReference.id,
      candidate,
      candidateClaimLinked: true,
      claimLinks: [
        {
          claimId: candidate.claimId as string,
          note: "Primary source.",
          relevance: 5
        }
      ],
      nextAction: "Review for public source packet inclusion.",
      publicSourcePacketReady: true,
      status: "Public source packet ready",
      studies: [
        {
          id: "study-pubmed-42141930",
          referenceId: acceptedReference.id,
          title: acceptedReference.title,
          year: 2026
        }
      ]
    });

    await expect(assessSourceCandidatePublicPromotion(candidate.dedupeKey)).resolves.toEqual({
      blockers: [],
      candidate: {
        acceptedReferenceId: acceptedReference.id,
        claimId: candidate.claimId,
        decision: "Accepted",
        dedupeKey: candidate.dedupeKey,
        externalId: candidate.externalId,
        reviewStatus: "Human reviewed",
        source: "PubMed",
        title: candidate.title
      },
      dryRun: true,
      nextAction: "Ready for explicit human promotion review.",
      publicPacket: {
        claimId: candidate.claimId,
        referenceId: acceptedReference.id,
        referenceUrl: acceptedReference.url,
        studyIds: ["study-pubmed-42141930"]
      },
      ready: true
    });
  });
});

describe("source candidate promotion readiness snapshot", () => {
  it("summarizes accepted candidates without promoting them", async () => {
    listSourceCandidateCurationHandoffMock.mockResolvedValue([
      {
        acceptedReference,
        acceptedReferenceId: acceptedReference.id,
        candidate,
        claimLinks: [],
        nextAction: "Link accepted reference to candidate claim.",
        publicSourcePacketReady: false,
        status: "Claim link missing",
        studies: []
      },
      {
        acceptedReference,
        acceptedReferenceId: acceptedReference.id,
        candidate: {
          ...candidate,
          dedupeKey: "pubmed|au|creatine-strength|42141930|ready",
          title: "Ready creatine source"
        },
        claimLinks: [
          {
            claimId: candidate.claimId as string,
            note: "Primary source.",
            relevance: 5
          }
        ],
        nextAction: "Review for public source packet inclusion.",
        publicSourcePacketReady: true,
        status: "Public source packet ready",
        studies: [
          {
            id: "study-pubmed-42141930",
            referenceId: acceptedReference.id,
            title: acceptedReference.title,
            year: 2026
          }
        ]
      }
    ]);

    await expect(getSourceCandidatePromotionReadinessSnapshot(2)).resolves.toMatchObject({
      blockedCount: 1,
      readyCount: 1,
      rows: [
        {
          blockers: [
            "Accepted reference must be linked to the candidate claim.",
            "Accepted reference must have a structured study extraction.",
            "Curation status must report publicSourcePacketReady=true."
          ],
          nextAction: "Accepted reference must be linked to the candidate claim.",
          ready: false,
          status: "Claim link missing"
        },
        {
          blockers: [],
          nextAction: "Ready for explicit human promotion review.",
          ready: true,
          status: "Public source packet ready"
        }
      ],
      total: 2
    });
    expect(listSourceCandidateCurationHandoffMock).toHaveBeenCalledWith({ limit: 2 });
  });
});
