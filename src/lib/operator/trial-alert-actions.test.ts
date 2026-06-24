import {
  OperatorRole,
  OperatorStatus,
  SourceKind as DbSourceKind,
  TrialAlertKind as DbTrialAlertKind,
  TrialAlertStatus as DbTrialAlertStatus
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db/prisma";
import type { ClinicalTrialSearchResult } from "@/lib/integrations/clinical-trials";
import type { OperatorPrincipal } from "@/lib/operator/authorization";
import {
  recordTrialAlertFromSourceCandidateAsOperator,
  recordTrialAlertsAsOperator
} from "@/lib/operator/trial-alert-actions";

vi.mock("@/lib/db/prisma", () => {
  const prismaMock = {
    $transaction: vi.fn(),
    operatorAuditEvent: {
      create: vi.fn()
    },
    sourceCandidate: {
      findUnique: vi.fn()
    },
    trialAlert: {
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

const auditCreateMock = vi.mocked(prisma.operatorAuditEvent.create);
const sourceCandidateFindUniqueMock = vi.mocked(prisma.sourceCandidate.findUnique);
const trialAlertCreateMock = vi.mocked(prisma.trialAlert.create);

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

describe("operator trial-alert actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditCreateMock.mockResolvedValue({ id: "audit-1" } as never);
    trialAlertCreateMock.mockResolvedValue({
      id: "trial-alert-1",
      kind: DbTrialAlertKind.RESULTS_REVIEW_NEEDED,
      nctId: "NCT123",
      noAutoPromotion: true,
      status: DbTrialAlertStatus.OPEN
    } as never);
  });

  it("requires admin curation write permission", async () => {
    await expect(
      recordTrialAlertsAsOperator(
        reviewer,
        {
          note: "Reviewed trial alert draft.",
          result: trialResultFixture()
        },
        writesEnabled
      )
    ).rejects.toMatchObject({
      message: "Operator role does not allow this action.",
      status: 403
    });

    expect(trialAlertCreateMock).not.toHaveBeenCalled();
  });

  it("fails closed when writes are disabled", async () => {
    await expect(
      recordTrialAlertsAsOperator(admin, {
        note: "Reviewed trial alert draft.",
        result: trialResultFixture()
      })
    ).rejects.toMatchObject({
      message: "Operator writes are disabled.",
      status: 503
    });

    expect(trialAlertCreateMock).not.toHaveBeenCalled();
  });

  it("requires a human review note", async () => {
    await expect(
      recordTrialAlertsAsOperator(
        admin,
        {
          note: " ",
          result: trialResultFixture()
        },
        writesEnabled
      )
    ).rejects.toThrow("Trial alert review note is required.");

    expect(trialAlertCreateMock).not.toHaveBeenCalled();
  });

  it("records trial alerts with no auto-promotion and an audit event", async () => {
    const detectedAt = new Date("2026-06-13T10:00:00.000Z");
    const reviewedAt = new Date("2026-06-13T10:05:00.000Z");

    await expect(
      recordTrialAlertsAsOperator(
        admin,
        {
          claimId: "creatine-strength",
          detectedAt,
          interventionId: "creatine",
          note: "Reviewed posted-results alert for operator follow-up.",
          result: trialResultFixture(),
          reviewedAt,
          sourceCandidateIdByNctId: new Map([["NCT123", "candidate-1"]]),
          trialIdByNctId: new Map([["NCT123", "trial-1"]])
        },
        writesEnabled
      )
    ).resolves.toEqual({
      alertIds: ["trial-alert-1"],
      count: 1,
      noAutoPromotion: true
    });

    expect(trialAlertCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        claim: {
          connect: {
            id: "creatine-strength"
          }
        },
        detectedAt,
        intervention: {
          connect: {
            id: "creatine"
          }
        },
        kind: DbTrialAlertKind.RESULTS_REVIEW_NEEDED,
        nctId: "NCT123",
        noAutoPromotion: true,
        reviewedAt,
        reviewerNotes: "Reviewed posted-results alert for operator follow-up.",
        status: DbTrialAlertStatus.OPEN,
        title: "Creatine trial with posted results"
      }),
      select: {
        id: true,
        kind: true,
        nctId: true,
        noAutoPromotion: true,
        status: true
      }
    });
    expect(trialAlertCreateMock.mock.calls[0]?.[0].data).not.toHaveProperty(
      "scoreHistory"
    );
    expect(auditCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "trialAlert.record",
        actorEmail: admin.email,
        actorRole: OperatorRole.ADMIN,
        actorUserId: admin.userId,
        afterSummary: expect.objectContaining({
          alertIds: ["trial-alert-1"],
          count: 1,
          noAutoPromotion: true
        }),
        metadata: expect.objectContaining({
          kinds: [DbTrialAlertKind.RESULTS_REVIEW_NEEDED],
          nctIds: ["NCT123"],
          query: "creatine",
          source: "ClinicalTrials.gov API v2"
        }),
        note: "Reviewed posted-results alert for operator follow-up.",
        targetType: "TrialAlert"
      })
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("records a reviewed trial alert from a ClinicalTrials.gov source candidate", async () => {
    sourceCandidateFindUniqueMock.mockResolvedValue({
      claimId: "creatine-strength",
      externalId: "NCT123",
      id: "source-candidate-1",
      interventionId: "creatine",
      metadata: {
        completionDate: "2026-01-01",
        conditions: ["Strength"],
        enrollment: "120 actual",
        enrollmentCount: 120,
        hasResults: true,
        interventions: ["DIETARY_SUPPLEMENT: Creatine"],
        lastUpdateDate: "2026-02-01",
        phase: "Not applicable",
        primaryOutcomes: ["Strength"],
        resultsFirstPostDate: "2026-03-01",
        sponsor: "Example University",
        startDate: "2025-01-01",
        status: "Completed",
        trialAlertDetail:
          "Posted registry results are an operator review alert. Do not change public scores until outcomes are extracted, citation-linked, and human-reviewed.",
        trialAlertLabel: "Results review needed",
        trialRelevanceDetail: "The query intervention appears in metadata.",
        trialRelevanceLabel: "Direct match",
        trialResultDetail: "Results are posted.",
        trialResultLabel: "Results posted"
      },
      query: "creatine",
      source: DbSourceKind.CLINICALTRIALS_GOV,
      sourceType: "Interventional",
      title: "Creatine trial with posted results",
      triageReasons: ["Results posted"],
      triageScore: 100,
      url: "https://clinicaltrials.gov/study/NCT123"
    } as never);

    await expect(
      recordTrialAlertFromSourceCandidateAsOperator(
        admin,
        {
          dedupeKey: "clinicaltrials|creatine|NCT123",
          note: "Reviewed candidate alert."
        },
        writesEnabled
      )
    ).resolves.toEqual({
      alertIds: ["trial-alert-1"],
      count: 1,
      noAutoPromotion: true
    });

    expect(sourceCandidateFindUniqueMock).toHaveBeenCalledWith({
      select: expect.objectContaining({
        externalId: true,
        id: true,
        metadata: true
      }),
      where: {
        dedupeKey: "clinicaltrials|creatine|NCT123"
      }
    });
    expect(trialAlertCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        claim: {
          connect: {
            id: "creatine-strength"
          }
        },
        intervention: {
          connect: {
            id: "creatine"
          }
        },
        kind: DbTrialAlertKind.RESULTS_REVIEW_NEEDED,
        nctId: "NCT123",
        sourceCandidate: {
          connect: {
            id: "source-candidate-1"
          }
        },
        noAutoPromotion: true,
        reviewerNotes: "Reviewed candidate alert."
      }),
      select: expect.any(Object)
    });
  });

  it("refuses non-ClinicalTrials.gov source candidates", async () => {
    sourceCandidateFindUniqueMock.mockResolvedValue({
      externalId: "42141930",
      id: "source-candidate-2",
      metadata: {},
      query: "creatine",
      source: DbSourceKind.PUBMED,
      sourceType: "Journal Article",
      title: "Creatine paper",
      triageReasons: [],
      triageScore: 70,
      url: "https://pubmed.ncbi.nlm.nih.gov/42141930/"
    } as never);

    await expect(
      recordTrialAlertFromSourceCandidateAsOperator(
        admin,
        {
          dedupeKey: "pubmed|creatine|42141930",
          note: "Reviewed candidate alert."
        },
        writesEnabled
      )
    ).rejects.toThrow(
      "Trial alerts can only be recorded from ClinicalTrials.gov candidates."
    );

    expect(trialAlertCreateMock).not.toHaveBeenCalled();
  });
});

function trialResultFixture(): ClinicalTrialSearchResult {
  return {
    query: "creatine",
    source: "ClinicalTrials.gov API v2",
    studies: [
      {
        completionDate: "2026-01-01",
        conditions: ["Strength"],
        enrollment: "120 actual",
        enrollmentCount: 120,
        hasResults: true,
        interventions: ["DIETARY_SUPPLEMENT: Creatine"],
        lastUpdateDate: "2026-02-01",
        nctId: "NCT123",
        phase: "Not applicable",
        primaryOutcomes: ["Strength"],
        resultsFirstPostDate: "2026-03-01",
        sponsor: "Example University",
        startDate: "2025-01-01",
        status: "Completed",
        studyType: "Interventional",
        title: "Creatine trial with posted results",
        trialAlertDetail:
          "Posted registry results are an operator review alert. Do not change public scores until outcomes are extracted, citation-linked, and human-reviewed.",
        trialAlertLabel: "Results review needed",
        trialRelevanceDetail:
          "The query intervention appears in the registered intervention metadata.",
        trialRelevanceLabel: "Direct match",
        trialResultDetail: "Results are posted.",
        trialResultLabel: "Results posted",
        triageReasons: ["Results posted"],
        triageScore: 100,
        url: "https://clinicaltrials.gov/study/NCT123"
      }
    ]
  };
}
