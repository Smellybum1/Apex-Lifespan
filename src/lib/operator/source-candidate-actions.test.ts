import {
  OperatorRole,
  OperatorStatus,
  ReviewStatus as DbReviewStatus
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  extractAcceptedSourceCandidateStudy,
  getSourceCandidateByDedupeKey,
  getSourceCandidateCurationStatus,
  linkAcceptedSourceCandidateClaim,
  recordSourceCandidateDecision
} from "@/lib/data/source-candidates";
import { prisma } from "@/lib/db/prisma";
import { assessSourceCandidatePublicPromotion } from "@/lib/operator/curation-promotion";
import {
  extractSourceCandidateStudyAsOperator,
  linkSourceCandidateClaimAsOperator,
  promoteSourceCandidatePublicEvidenceAsOperator,
  reviewSourceCandidateAsOperator
} from "@/lib/operator/source-candidate-actions";
import type { OperatorPrincipal } from "@/lib/operator/authorization";
import type { Reference, SourceCandidate } from "@/lib/types";

vi.mock("@/lib/data/source-candidates", () => ({
  extractAcceptedSourceCandidateStudy: vi.fn(),
  getSourceCandidateByDedupeKey: vi.fn(),
  getSourceCandidateCurationStatus: vi.fn(),
  linkAcceptedSourceCandidateClaim: vi.fn(),
  recordSourceCandidateDecision: vi.fn()
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    claim: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    operatorAuditEvent: {
      create: vi.fn()
    }
  }
}));

vi.mock("@/lib/operator/curation-promotion", () => ({
  assessSourceCandidatePublicPromotion: vi.fn()
}));

const getSourceCandidateByDedupeKeyMock = vi.mocked(getSourceCandidateByDedupeKey);
const getSourceCandidateCurationStatusMock = vi.mocked(getSourceCandidateCurationStatus);
const recordSourceCandidateDecisionMock = vi.mocked(recordSourceCandidateDecision);
const linkAcceptedSourceCandidateClaimMock = vi.mocked(linkAcceptedSourceCandidateClaim);
const extractAcceptedSourceCandidateStudyMock = vi.mocked(
  extractAcceptedSourceCandidateStudy
);
const assessPromotionMock = vi.mocked(assessSourceCandidatePublicPromotion);
const claimFindUniqueMock = vi.mocked(prisma.claim.findUnique);
const claimUpdateMock = vi.mocked(prisma.claim.update);
const operatorAuditCreateMock = vi.mocked(prisma.operatorAuditEvent.create);

const writesEnabled = {
  APEX_OPERATOR_WRITES_ENABLED: "true"
};

const reviewer: OperatorPrincipal = {
  email: "reviewer@example.test",
  role: OperatorRole.REVIEWER,
  status: OperatorStatus.ACTIVE,
  userId: "user-reviewer"
};

const admin: OperatorPrincipal = {
  ...reviewer,
  role: OperatorRole.ADMIN,
  userId: "user-admin"
};

const reference: Reference = {
  id: "ref-pubmed-42141930",
  identifier: "42141930",
  source: "PubMed",
  title: "Creatine and resistance training",
  url: "https://pubmed.ncbi.nlm.nih.gov/42141930/",
  year: 2026
};

const pendingCandidate: SourceCandidate = {
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

const acceptedCandidate: SourceCandidate = {
  ...pendingCandidate,
  acceptedReferenceId: reference.id,
  decision: "Accepted",
  reviewStatus: "Human reviewed"
};

describe("operator source-candidate actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    operatorAuditCreateMock.mockResolvedValue({ id: "audit-event" } as never);
  });

  it("reviews a candidate and appends an audit event", async () => {
    getSourceCandidateByDedupeKeyMock.mockResolvedValue(pendingCandidate);
    recordSourceCandidateDecisionMock.mockResolvedValue(acceptedCandidate);

    await expect(
      reviewSourceCandidateAsOperator(
        reviewer,
        {
          acceptedReferenceId: reference.id,
          decision: "Accepted",
          dedupeKey: pendingCandidate.dedupeKey,
          reviewNote: "Matches PMID and claim context."
        },
        writesEnabled
      )
    ).resolves.toEqual(acceptedCandidate);

    expect(recordSourceCandidateDecisionMock).toHaveBeenCalledWith({
      acceptedReferenceId: reference.id,
      decision: "Accepted",
      dedupeKey: pendingCandidate.dedupeKey,
      reviewNote: "Matches PMID and claim context."
    });
    expect(operatorAuditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "sourceCandidate.reviewDecision",
          actorEmail: reviewer.email,
          actorRole: reviewer.role,
          actorUserId: reviewer.userId,
          targetId: pendingCandidate.dedupeKey,
          targetType: "SourceCandidate"
        })
      })
    );
  });

  it("fails closed before calling write helpers when writes are disabled", async () => {
    await expect(
      reviewSourceCandidateAsOperator(
        reviewer,
        {
          decision: "Rejected",
          dedupeKey: pendingCandidate.dedupeKey,
          reviewNote: "Out of scope."
        },
        {}
      )
    ).rejects.toMatchObject({
      message: "Operator writes are disabled.",
      status: 503
    });

    expect(recordSourceCandidateDecisionMock).not.toHaveBeenCalled();
    expect(operatorAuditCreateMock).not.toHaveBeenCalled();
  });

  it("requires admin access for claim linking", async () => {
    await expect(
      linkSourceCandidateClaimAsOperator(
        reviewer,
        {
          dedupeKey: pendingCandidate.dedupeKey,
          note: "Claim context"
        },
        writesEnabled
      )
    ).rejects.toMatchObject({
      message: "Operator role does not allow this action.",
      status: 403
    });

    expect(linkAcceptedSourceCandidateClaimMock).not.toHaveBeenCalled();
  });

  it("requires admin access for public evidence promotion", async () => {
    await expect(
      promoteSourceCandidatePublicEvidenceAsOperator(
        reviewer,
        {
          dedupeKey: acceptedCandidate.dedupeKey,
          promotionNote: "Human reviewed the curation packet."
        },
        writesEnabled
      )
    ).rejects.toMatchObject({
      message: "Operator role does not allow this action.",
      status: 403
    });

    expect(assessPromotionMock).not.toHaveBeenCalled();
    expect(claimUpdateMock).not.toHaveBeenCalled();
  });

  it("requires a human promotion note before assessment or writes", async () => {
    await expect(
      promoteSourceCandidatePublicEvidenceAsOperator(
        admin,
        {
          dedupeKey: acceptedCandidate.dedupeKey,
          promotionNote: " "
        },
        writesEnabled
      )
    ).rejects.toThrow("Promotion note is required.");

    expect(assessPromotionMock).not.toHaveBeenCalled();
    expect(claimUpdateMock).not.toHaveBeenCalled();
  });

  it("links claims and extracts studies with audit events for admins", async () => {
    getSourceCandidateCurationStatusMock.mockResolvedValue({
      candidate: acceptedCandidate,
      claimLinks: [],
      nextAction: "Link accepted reference to candidate claim.",
      publicSourcePacketReady: false,
      status: "Claim link missing",
      studies: []
    });
    linkAcceptedSourceCandidateClaimMock.mockResolvedValue({
      acceptedReference: reference,
      candidate: acceptedCandidate,
      claimLink: {
        claimId: "claim-creatine-strength",
        note: "Claim context",
        relevance: 5
      },
      created: true,
      status: {
        candidate: acceptedCandidate,
        claimLinks: [],
        nextAction: "Extract study details.",
        publicSourcePacketReady: false,
        status: "Extraction pending",
        studies: []
      }
    });
    extractAcceptedSourceCandidateStudyMock.mockResolvedValue({
      acceptedReference: reference,
      candidate: acceptedCandidate,
      created: true,
      status: {
        candidate: acceptedCandidate,
        claimLinks: [],
        nextAction: "Ready for public packet review.",
        publicSourcePacketReady: true,
        status: "Public source packet ready",
        studies: []
      },
      study: {
        id: "study-42141930",
        referenceId: reference.id,
        title: reference.title,
        year: 2026
      }
    });

    await expect(
      linkSourceCandidateClaimAsOperator(
        admin,
        {
          dedupeKey: pendingCandidate.dedupeKey,
          note: "Claim context"
        },
        writesEnabled
      )
    ).resolves.toMatchObject({
      created: true
    });
    await expect(
      extractSourceCandidateStudyAsOperator(
        admin,
        {
          adverseEvents: "Not extracted yet.",
          dedupeKey: pendingCandidate.dedupeKey,
          fundingConflicts: "Not extracted yet.",
          interventionName: "Creatine monohydrate",
          outcomes: ["Strength"],
          population: "Adults",
          riskOfBias: "Not assessed yet.",
          sampleSize: "Not extracted yet."
        },
        writesEnabled
      )
    ).resolves.toMatchObject({
      created: true
    });

    expect(operatorAuditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "sourceCandidate.claimLink",
          actorRole: OperatorRole.ADMIN
        })
      })
    );
    expect(operatorAuditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "sourceCandidate.studyExtraction",
          actorRole: OperatorRole.ADMIN
        })
      })
    );
  });

  it("blocks public promotion before dry-run readiness is complete", async () => {
    assessPromotionMock.mockResolvedValue({
      blockers: ["Accepted reference must be linked to the candidate claim."],
      candidate: acceptedCandidate,
      dryRun: true,
      nextAction: "Accepted reference must be linked to the candidate claim.",
      ready: false
    });

    await expect(
      promoteSourceCandidatePublicEvidenceAsOperator(
        admin,
        {
          dedupeKey: acceptedCandidate.dedupeKey,
          promotionNote: "Human reviewed the curation packet."
        },
        writesEnabled
      )
    ).rejects.toThrow(
      "Source candidate is not ready for public promotion: Accepted reference must be linked to the candidate claim."
    );

    expect(claimFindUniqueMock).not.toHaveBeenCalled();
    expect(claimUpdateMock).not.toHaveBeenCalled();
    expect(operatorAuditCreateMock).not.toHaveBeenCalled();
  });

  it("promotes a ready candidate by marking the claim human-reviewed and auditing it", async () => {
    const promotedAt = new Date("2026-06-11T14:00:00.000Z");
    assessPromotionMock.mockResolvedValue({
      blockers: [],
      candidate: {
        acceptedReferenceId: reference.id,
        claimId: "creatine-strength",
        decision: "Accepted",
        dedupeKey: acceptedCandidate.dedupeKey,
        externalId: acceptedCandidate.externalId,
        reviewStatus: "Human reviewed",
        source: "PubMed",
        title: acceptedCandidate.title
      },
      dryRun: true,
      nextAction: "Ready for explicit human promotion review.",
      publicPacket: {
        claimId: "creatine-strength",
        referenceId: reference.id,
        referenceUrl: reference.url,
        studyIds: ["study-42141930"]
      },
      ready: true
    });
    claimFindUniqueMock.mockResolvedValue({
      id: "creatine-strength",
      lastReviewedAt: null,
      reviewStatus: DbReviewStatus.UNREVIEWED_AI_DRAFT
    } as never);
    claimUpdateMock.mockResolvedValue({
      id: "creatine-strength",
      lastReviewedAt: promotedAt,
      reviewStatus: DbReviewStatus.HUMAN_REVIEWED
    } as never);

    await expect(
      promoteSourceCandidatePublicEvidenceAsOperator(
        admin,
        {
          dedupeKey: acceptedCandidate.dedupeKey,
          promotedAt,
          promotionNote: "Human reviewed the curation packet."
        },
        writesEnabled
      )
    ).resolves.toEqual({
      claim: {
        id: "creatine-strength",
        lastReviewedAt: "2026-06-11T14:00:00.000Z",
        reviewStatus: "Human reviewed"
      },
      dedupeKey: acceptedCandidate.dedupeKey,
      referenceId: reference.id,
      studyIds: ["study-42141930"]
    });

    expect(claimUpdateMock).toHaveBeenCalledWith({
      data: {
        lastReviewedAt: promotedAt,
        reviewStatus: DbReviewStatus.HUMAN_REVIEWED
      },
      select: {
        id: true,
        lastReviewedAt: true,
        reviewStatus: true
      },
      where: {
        id: "creatine-strength"
      }
    });
    expect(operatorAuditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "sourceCandidate.publicEvidencePromotion",
          actorRole: OperatorRole.ADMIN,
          afterSummary: expect.objectContaining({
            claimId: "creatine-strength",
            referenceId: reference.id,
            reviewStatus: DbReviewStatus.HUMAN_REVIEWED,
            studyIds: ["study-42141930"]
          }),
          note: "Human reviewed the curation packet.",
          targetId: acceptedCandidate.dedupeKey,
          targetType: "SourceCandidate"
        })
      })
    );
  });
});
