import { OperatorRole, OperatorStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  extractAcceptedSourceCandidateStudy,
  getSourceCandidateByDedupeKey,
  getSourceCandidateCurationStatus,
  linkAcceptedSourceCandidateClaim,
  recordSourceCandidateDecision
} from "@/lib/data/source-candidates";
import { prisma } from "@/lib/db/prisma";
import {
  extractSourceCandidateStudyAsOperator,
  linkSourceCandidateClaimAsOperator,
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
    operatorAuditEvent: {
      create: vi.fn()
    }
  }
}));

const getSourceCandidateByDedupeKeyMock = vi.mocked(getSourceCandidateByDedupeKey);
const getSourceCandidateCurationStatusMock = vi.mocked(getSourceCandidateCurationStatus);
const recordSourceCandidateDecisionMock = vi.mocked(recordSourceCandidateDecision);
const linkAcceptedSourceCandidateClaimMock = vi.mocked(linkAcceptedSourceCandidateClaim);
const extractAcceptedSourceCandidateStudyMock = vi.mocked(
  extractAcceptedSourceCandidateStudy
);
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
});
