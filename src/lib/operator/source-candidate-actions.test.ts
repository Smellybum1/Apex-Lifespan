import {
  OperatorRole,
  OperatorStatus,
  ReviewStatus as DbReviewStatus
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  confirmSourceCandidateHumanReview,
  extractAcceptedSourceCandidateStudy,
  getSourceCandidateByDedupeKey,
  getSourceCandidateCurationStatus,
  linkAcceptedSourceCandidateClaim,
  recordSourceCandidateDecision
} from "@/lib/data/source-candidates";
import { prisma } from "@/lib/db/prisma";
import { assessSourceCandidatePublicPromotion } from "@/lib/operator/curation-promotion";
import {
  confirmSourceCandidateHumanReviewAsOperator,
  extractSourceCandidateStudyAsOperator,
  linkSourceCandidateClaimAsOperator,
  promoteSourceCandidatePublicEvidenceAsOperator,
  reviewSourceCandidateAsOperator
} from "@/lib/operator/source-candidate-actions";
import type { OperatorPrincipal } from "@/lib/operator/authorization";
import type { Reference, SourceCandidate } from "@/lib/types";

vi.mock("@/lib/data/source-candidates", () => ({
  confirmSourceCandidateHumanReview: vi.fn(),
  extractAcceptedSourceCandidateStudy: vi.fn(),
  getSourceCandidateByDedupeKey: vi.fn(),
  getSourceCandidateCurationStatus: vi.fn(),
  linkAcceptedSourceCandidateClaim: vi.fn(),
  recordSourceCandidateDecision: vi.fn()
}));

vi.mock("@/lib/db/prisma", () => {
  const prismaMock = {
    $transaction: vi.fn(),
    claim: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    claimScoreSnapshot: {
      findFirst: vi.fn(),
      create: vi.fn()
    },
    claimScoreHistory: {
      create: vi.fn()
    },
    operatorAuditEvent: {
      create: vi.fn()
    },
    publicChangelogEntry: {
      create: vi.fn()
    },
    reviewEvent: {
      create: vi.fn()
    }
  };

  prismaMock.$transaction.mockImplementation(async (callback) =>
    callback(prismaMock)
  );

  return {
    prisma: prismaMock
  };
});

vi.mock("@/lib/operator/curation-promotion", () => ({
  assessSourceCandidatePublicPromotion: vi.fn()
}));

const getSourceCandidateByDedupeKeyMock = vi.mocked(getSourceCandidateByDedupeKey);
const confirmSourceCandidateHumanReviewMock = vi.mocked(confirmSourceCandidateHumanReview);
const getSourceCandidateCurationStatusMock = vi.mocked(getSourceCandidateCurationStatus);
const recordSourceCandidateDecisionMock = vi.mocked(recordSourceCandidateDecision);
const linkAcceptedSourceCandidateClaimMock = vi.mocked(linkAcceptedSourceCandidateClaim);
const extractAcceptedSourceCandidateStudyMock = vi.mocked(
  extractAcceptedSourceCandidateStudy
);
const assessPromotionMock = vi.mocked(assessSourceCandidatePublicPromotion);
const claimFindUniqueMock = vi.mocked(prisma.claim.findUnique);
const claimUpdateMock = vi.mocked(prisma.claim.update);
const claimScoreSnapshotFindFirstMock = vi.mocked(prisma.claimScoreSnapshot.findFirst);
const claimScoreSnapshotCreateMock = vi.mocked(prisma.claimScoreSnapshot.create);
const claimScoreHistoryCreateMock = vi.mocked(prisma.claimScoreHistory.create);
const operatorAuditCreateMock = vi.mocked(prisma.operatorAuditEvent.create);
const publicChangelogEntryCreateMock = vi.mocked(prisma.publicChangelogEntry.create);
const reviewEventCreateMock = vi.mocked(prisma.reviewEvent.create);

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
    claimScoreHistoryCreateMock.mockResolvedValue({ id: "score-history" } as never);
    claimScoreSnapshotFindFirstMock.mockResolvedValue({
      compositeScore: "8.1",
      finalLabel: "CORE_EVIDENCE_BASED",
      id: "previous-score-snapshot"
    } as never);
    claimScoreSnapshotCreateMock.mockResolvedValue({
      compositeScore: "8.4",
      finalLabel: "CORE_EVIDENCE_BASED",
      id: "score-snapshot"
    } as never);
    operatorAuditCreateMock.mockResolvedValue({ id: "audit-event" } as never);
    publicChangelogEntryCreateMock.mockResolvedValue({ id: "changelog-entry" } as never);
    reviewEventCreateMock.mockResolvedValue({ id: "review-event" } as never);
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
      reviewNote: "Matches PMID and claim context.",
      reviewStatus: "AI reviewed"
    });
    expect(operatorAuditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "sourceCandidate.aiReview",
          actorEmail: reviewer.email,
          actorRole: reviewer.role,
          actorUserId: reviewer.userId,
          targetId: pendingCandidate.dedupeKey,
          targetType: "SourceCandidate"
        })
      })
    );
  });

  it("records Codex AI candidate review metadata", async () => {
    const rejectedCandidate: SourceCandidate = {
      ...pendingCandidate,
      decision: "Rejected",
      reviewStatus: "AI reviewed"
    };
    getSourceCandidateByDedupeKeyMock.mockResolvedValue(pendingCandidate);
    recordSourceCandidateDecisionMock.mockResolvedValue(rejectedCandidate);

    await expect(
      reviewSourceCandidateAsOperator(
        reviewer,
        {
          aiReviewSummary: "AI recommends rejected",
          approvalBasis: "codex-ai-candidate-review",
          decision: "Rejected",
          dedupeKey: pendingCandidate.dedupeKey,
          reviewNote: "Codex applied AI rejection."
        },
        writesEnabled
      )
    ).resolves.toEqual(rejectedCandidate);

    expect(recordSourceCandidateDecisionMock).toHaveBeenCalledWith({
      decision: "Rejected",
      dedupeKey: pendingCandidate.dedupeKey,
      reviewNote: "Codex applied AI rejection.",
      reviewStatus: "AI reviewed"
    });
    expect(operatorAuditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "sourceCandidate.aiReview",
          metadata: expect.objectContaining({
            aiReviewSummary: "AI recommends rejected",
            approvalBasis: "codex-ai-candidate-review",
            noExtractionWrite: true,
            noPromotion: true,
            source: "PubMed"
          }),
          note: "Codex applied AI rejection.",
          targetId: pendingCandidate.dedupeKey,
          targetType: "SourceCandidate"
        })
      })
    );
  });

  it("confirms an AI-reviewed candidate as human reviewed and appends an audit event", async () => {
    const aiReviewedCandidate: SourceCandidate = {
      ...acceptedCandidate,
      reviewStatus: "AI reviewed"
    };
    const humanReviewedCandidate: SourceCandidate = {
      ...acceptedCandidate,
      reviewNote: "Human confirmed the Codex AI-reviewed decision.",
      reviewStatus: "Human reviewed"
    };
    getSourceCandidateByDedupeKeyMock.mockResolvedValue(aiReviewedCandidate);
    confirmSourceCandidateHumanReviewMock.mockResolvedValue(humanReviewedCandidate);

    await expect(
      confirmSourceCandidateHumanReviewAsOperator(
        reviewer,
        {
          dedupeKey: acceptedCandidate.dedupeKey,
          reviewNote: "Human confirmed the Codex AI-reviewed decision."
        },
        writesEnabled
      )
    ).resolves.toEqual(humanReviewedCandidate);

    expect(confirmSourceCandidateHumanReviewMock).toHaveBeenCalledWith({
      dedupeKey: acceptedCandidate.dedupeKey,
      reviewNote: "Human confirmed the Codex AI-reviewed decision."
    });
    expect(operatorAuditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "sourceCandidate.humanReview",
          actorEmail: reviewer.email,
          metadata: expect.objectContaining({
            approvalBasis: "manual-operator-review",
            noExtractionWrite: true,
            noPromotion: true,
            source: "PubMed"
          }),
          note: "Human confirmed the Codex AI-reviewed decision.",
          targetId: acceptedCandidate.dedupeKey,
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
    expect(claimScoreHistoryCreateMock).not.toHaveBeenCalled();
    expect(claimScoreSnapshotCreateMock).not.toHaveBeenCalled();
    expect(publicChangelogEntryCreateMock).not.toHaveBeenCalled();
    expect(reviewEventCreateMock).not.toHaveBeenCalled();
  });

  it("promotes a ready candidate by marking the claim AI-reviewed and auditing it", async () => {
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
      evidenceDirectnessScore: 9,
      evidenceRigorScore: 9,
      effectSizeScore: 7,
      finalLabel: "CORE_EVIDENCE_BASED",
      hypePenalty: 2,
      interventionId: "creatine",
      lastReviewedAt: null,
      measurabilityScore: 9,
      productQualityScore: 4,
      regulatoryRiskScore: 1,
      safetyScore: 8,
      reviewStatus: DbReviewStatus.UNREVIEWED_AI_DRAFT
    } as never);
    claimUpdateMock.mockResolvedValue({
      id: "creatine-strength",
      lastReviewedAt: promotedAt,
      reviewStatus: DbReviewStatus.AI_REVIEWED
    } as never);

    await expect(
      promoteSourceCandidatePublicEvidenceAsOperator(
        admin,
        {
          dedupeKey: acceptedCandidate.dedupeKey,
          promotedAt,
          promotionNote: "Codex reviewed the curation packet."
        },
        writesEnabled
      )
    ).resolves.toEqual({
      claim: {
        id: "creatine-strength",
        lastReviewedAt: "2026-06-11T14:00:00.000Z",
        reviewStatus: "AI reviewed"
      },
      dedupeKey: acceptedCandidate.dedupeKey,
      referenceId: reference.id,
      studyIds: ["study-42141930"]
    });

    expect(claimUpdateMock).toHaveBeenCalledWith({
      data: {
        lastReviewedAt: promotedAt,
        reviewStatus: DbReviewStatus.AI_REVIEWED
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
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(reviewEventCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorEmail: admin.email,
        actorUserId: admin.userId,
        claimId: "creatine-strength",
        createdAt: promotedAt,
        entityId: "creatine-strength",
        entityType: "Claim",
        eventType: "AI_REVIEWED",
        metadata: expect.objectContaining({
          candidateExternalId: acceptedCandidate.externalId,
          publicSourcePacketReady: true,
          sourceCandidateDedupeKey: acceptedCandidate.dedupeKey,
          studyIds: ["study-42141930"],
          workflow: "sourceCandidate.publicEvidencePromotion"
        }),
        note: "Codex reviewed the curation packet.",
        referenceId: reference.id,
        reviewStatus: DbReviewStatus.AI_REVIEWED
      })
    });
    expect(claimScoreSnapshotCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        claimId: "creatine-strength",
        compositeScore: 8.4,
        computedAt: promotedAt,
        finalLabel: "CORE_EVIDENCE_BASED",
        rationale: "Source-candidate public promotion: Codex reviewed the curation packet.",
        reviewStatus: DbReviewStatus.AI_REVIEWED,
        scoreVersion: "v1"
      })
    });
    expect(claimScoreHistoryCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        changedByUserId: admin.userId,
        claimId: "creatine-strength",
        createdAt: promotedAt,
        newCompositeScore: "8.4",
        newLabel: "CORE_EVIDENCE_BASED",
        newSnapshotId: "score-snapshot",
        oldCompositeScore: "8.1",
        oldLabel: "CORE_EVIDENCE_BASED",
        previousSnapshotId: "previous-score-snapshot",
        rationale: "Source-candidate public promotion: Codex reviewed the curation packet.",
        reason: "MANUAL_REVIEW",
        referenceId: reference.id
      })
    });
    expect(publicChangelogEntryCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        claimId: "creatine-strength",
        date: promotedAt,
        interventionId: "creatine",
        kind: "EVIDENCE_CARD",
        publishedAt: null,
        scoreHistoryId: "score-history",
        slug: "claim-review-creatine-strength-score-history",
        title: "Source-candidate evidence promotion recorded"
      })
    });
    expect(operatorAuditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "sourceCandidate.publicEvidencePromotion",
          actorRole: OperatorRole.ADMIN,
          afterSummary: expect.objectContaining({
            claimId: "creatine-strength",
            referenceId: reference.id,
            reviewStatus: DbReviewStatus.AI_REVIEWED,
            studyIds: ["study-42141930"]
          }),
          note: "Codex reviewed the curation packet.",
          targetId: acceptedCandidate.dedupeKey,
          targetType: "SourceCandidate"
        })
      })
    );
  });
});
