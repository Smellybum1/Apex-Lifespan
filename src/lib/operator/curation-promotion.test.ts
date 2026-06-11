import { describe, expect, it, vi } from "vitest";

import {
  getSourceCandidateCurationStatus,
  listSourceCandidateCurationHandoff
} from "@/lib/data/source-candidates";
import {
  assessSourceCandidatePublicPromotion,
  buildSourceCandidatePromotionReadinessReport,
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

const candidateSafeKey = safeCandidateKey(candidate.dedupeKey);
const candidateReadOnlyCommands = {
  candidateReviewPacket: `npm run ingest:sources -- --candidate-review-packet ${candidateSafeKey}`,
  curationDraft: `npm run ingest:sources -- --candidate-curation-draft ${candidateSafeKey}`,
  curationStatus: `npm run ingest:sources -- --candidate-curation-status ${candidateSafeKey}`,
  dryRunPromotion: `npm run promotion:dry-run -- ${candidateSafeKey}`,
  referenceMatches: `npm run ingest:sources -- --candidate-reference-matches ${candidateSafeKey}`,
  siblings: `npm run ingest:sources -- --candidate-siblings ${candidateSafeKey}`
};

describe("source candidate promotion assessment", () => {
  it("blocks missing candidates", async () => {
    getSourceCandidateCurationStatusMock.mockResolvedValue(null);

    const assessment = await assessSourceCandidatePublicPromotion(candidate.dedupeKey);

    expect(assessment).toMatchObject({
      blockers: ["Source candidate not found."],
      ready: false
    });
    expect(assessment.worksheet).toBeUndefined();
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
      ready: false,
      worksheet: {
        acceptedReferenceId: acceptedReference.id,
        candidateClaimId: candidate.claimId,
        claimLink: {
          existingClaimIds: [],
          nextAction:
            "Human link the accepted reference to the candidate claim before promotion review.",
          ready: false,
          targetClaimId: candidate.claimId,
          targetReferenceId: acceptedReference.id
        },
        curationStatus: "Claim link missing",
        humanReviewRequired: true,
        nextHumanActions: [
          "Human link the accepted reference to the candidate claim before promotion review.",
          "Human add structured study extraction for the accepted reference before promotion review.",
          "Rerun promotion dry-run after claim link and extraction are complete."
        ],
        publicSourcePacketReady: false,
        readOnlyCommands: candidateReadOnlyCommands,
        requiredEvidence: [
          {
            id: "candidate-accepted",
            label: "Candidate accepted",
            nextAction: "Candidate is accepted.",
            ready: true
          },
          {
            id: "candidate-human-reviewed",
            label: "Candidate human review",
            nextAction: "Candidate review status is Human reviewed.",
            ready: true
          },
          {
            id: "accepted-reference-traceable",
            label: "Traceable accepted reference",
            nextAction: "Accepted reference has id, title, and URL.",
            ready: true
          },
          {
            id: "claim-link",
            label: "Claim link",
            nextAction:
              "Human link the accepted reference to the candidate claim before promotion review.",
            ready: false
          },
          {
            id: "structured-extraction",
            label: "Structured extraction",
            nextAction:
              "Human add structured study extraction for the accepted reference before promotion review.",
            ready: false
          },
          {
            id: "public-source-packet-ready",
            label: "Public source packet readiness",
            nextAction: "Rerun the dry run after claim link and structured extraction are complete.",
            ready: false
          }
        ],
        studyExtraction: {
          existingStudyIds: [],
          nextAction:
            "Human add structured study extraction for the accepted reference before promotion review.",
          ready: false,
          targetReferenceId: acceptedReference.id
        }
      }
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
      ready: true,
      worksheet: {
        acceptedReferenceId: acceptedReference.id,
        candidateClaimId: candidate.claimId,
        claimLink: {
          existingClaimIds: [candidate.claimId],
          nextAction: "Accepted reference is linked to the candidate claim.",
          ready: true,
          targetClaimId: candidate.claimId,
          targetReferenceId: acceptedReference.id
        },
        curationStatus: "Public source packet ready",
        humanReviewRequired: true,
        nextHumanActions: ["Human review the ready public packet before any explicit promotion."],
        publicSourcePacketReady: true,
        readOnlyCommands: candidateReadOnlyCommands,
        requiredEvidence: [
          {
            id: "candidate-accepted",
            label: "Candidate accepted",
            nextAction: "Candidate is accepted.",
            ready: true
          },
          {
            id: "candidate-human-reviewed",
            label: "Candidate human review",
            nextAction: "Candidate review status is Human reviewed.",
            ready: true
          },
          {
            id: "accepted-reference-traceable",
            label: "Traceable accepted reference",
            nextAction: "Accepted reference has id, title, and URL.",
            ready: true
          },
          {
            id: "claim-link",
            label: "Claim link",
            nextAction: "Accepted reference is linked to the candidate claim.",
            ready: true
          },
          {
            id: "structured-extraction",
            label: "Structured extraction",
            nextAction: "Structured study extraction is present for the accepted reference.",
            ready: true
          },
          {
            id: "public-source-packet-ready",
            label: "Public source packet readiness",
            nextAction: "Curation status reports publicSourcePacketReady=true.",
            ready: true
          }
        ],
        studyExtraction: {
          existingStudyIds: ["study-pubmed-42141930"],
          nextAction: "Structured study extraction is present for the accepted reference.",
          ready: true,
          targetReferenceId: acceptedReference.id
        }
      }
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

  it("builds a read-only promotion readiness report", async () => {
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
      }
    ]);

    await expect(
      buildSourceCandidatePromotionReadinessReport({
        generatedAt: new Date("2026-06-11T00:00:00.000Z"),
        limit: 1
      })
    ).resolves.toMatchObject({
      generatedAt: "2026-06-11T00:00:00.000Z",
      humanOwned: true,
      readOnly: true,
      snapshot: {
        blockedCount: 1,
        readyCount: 0,
        total: 1
      },
      worksheet: {
        blocked: [
          {
            blockers: [
              "Accepted reference must be linked to the candidate claim.",
              "Accepted reference must have a structured study extraction.",
              "Curation status must report publicSourcePacketReady=true."
            ],
            dedupeKey: candidate.dedupeKey,
            externalId: candidate.externalId,
            label: candidate.title,
            nextAction: "Accepted reference must be linked to the candidate claim.",
            source: "PubMed",
            status: "Claim link missing"
          }
        ],
        copySafeCommands: [
          {
            command: "npm run promotion:readiness",
            id: "promotion-readiness",
            label: "Refresh promotion readiness",
            mode: "read-only",
            purpose:
              "Summarize accepted source-candidate promotion blockers without writing public evidence."
          },
          {
            command: "npm run promotion:dry-run -- --pmid <pmid>",
            id: "promotion-dry-run",
            label: "Dry-run one accepted PMID",
            mode: "read-only",
            purpose:
              "Inspect one accepted PubMed candidate's claim link, extraction, and public packet readiness."
          },
          {
            command: "npm run ingest:sources -- --candidate-curation-handoff",
            id: "candidate-curation-handoff",
            label: "Review curation handoff",
            mode: "read-only",
            purpose:
              "List accepted candidates and their curation handoff status without mutating decisions."
          },
          {
            command:
              "npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 10",
            id: "candidate-review-overview",
            label: "Review pending candidate overview",
            mode: "read-only",
            purpose: "Inspect pending source-candidate groups before any human review decisions."
          },
          {
            command: "npm run launch:readiness",
            id: "launch-readiness",
            label: "Refresh aggregate launch readiness",
            mode: "read-only",
            purpose: "Recheck fully-live launch gates after promotion evidence changes."
          }
        ],
        humanOwned: true,
        nextHumanAction: "Accepted reference must be linked to the candidate claim.",
        ready: []
      }
    });
    expect(listSourceCandidateCurationHandoffMock).toHaveBeenCalledWith({ limit: 1 });
  });
});

function safeCandidateKey(dedupeKey: string) {
  return `b64:${Buffer.from(dedupeKey, "utf8").toString("base64url")}`;
}
