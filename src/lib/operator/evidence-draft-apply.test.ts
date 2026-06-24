import {
  EvidenceLabel as DbEvidenceLabel,
  OperatorRole,
  OperatorStatus,
  ReviewStatus as DbReviewStatus,
  StudyType as DbStudyType
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db/prisma";
import type { OperatorPrincipal } from "@/lib/operator/authorization";
import type { EvidenceDraftPacket } from "@/lib/operator/evidence-draft-packet";
import { applyApprovedEvidenceDraftAsOperator } from "@/lib/operator/evidence-draft-apply";

vi.mock("@/lib/db/prisma", () => {
  const prismaMock = {
    $transaction: vi.fn(),
    claim: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    claimReference: {
      upsert: vi.fn()
    },
    claimScoreHistory: {
      create: vi.fn()
    },
    claimScoreSnapshot: {
      create: vi.fn(),
      findFirst: vi.fn()
    },
    operatorAuditEvent: {
      create: vi.fn()
    },
    publicChangelogEntry: {
      create: vi.fn()
    },
    reference: {
      findUnique: vi.fn()
    },
    reviewEvent: {
      create: vi.fn()
    },
    study: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn()
    }
  };

  prismaMock.$transaction.mockImplementation(async (callback) =>
    callback(prismaMock)
  );

  return {
    prisma: prismaMock
  };
});

const writesEnabled = {
  APEX_OPERATOR_WRITES_ENABLED: "true"
};

const admin: OperatorPrincipal = {
  email: "admin@example.test",
  role: OperatorRole.ADMIN,
  status: OperatorStatus.ACTIVE,
  userId: "user-admin"
};

const reviewedAt = new Date("2026-06-16T06:30:00.000Z");

const transactionMock = vi.mocked(prisma.$transaction);
const claimFindUniqueMock = vi.mocked(prisma.claim.findUnique);
const claimUpdateMock = vi.mocked(prisma.claim.update);
const claimReferenceUpsertMock = vi.mocked(prisma.claimReference.upsert);
const claimScoreHistoryCreateMock = vi.mocked(prisma.claimScoreHistory.create);
const claimScoreSnapshotCreateMock = vi.mocked(prisma.claimScoreSnapshot.create);
const claimScoreSnapshotFindFirstMock = vi.mocked(prisma.claimScoreSnapshot.findFirst);
const operatorAuditCreateMock = vi.mocked(prisma.operatorAuditEvent.create);
const publicChangelogEntryCreateMock = vi.mocked(prisma.publicChangelogEntry.create);
const referenceFindUniqueMock = vi.mocked(prisma.reference.findUnique);
const reviewEventCreateMock = vi.mocked(prisma.reviewEvent.create);
const studyCreateMock = vi.mocked(prisma.study.create);
const studyFindManyMock = vi.mocked(prisma.study.findMany);
const studyUpdateMock = vi.mocked(prisma.study.update);

describe("applyApprovedEvidenceDraftAsOperator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.mockImplementation(async (callback) => callback(prisma));
    claimFindUniqueMock.mockResolvedValue(reviewableClaim() as never);
    referenceFindUniqueMock.mockResolvedValue(referenceRow() as never);
    studyFindManyMock.mockResolvedValue([] as never);
    claimReferenceUpsertMock.mockResolvedValue({
      claimId: "creatine-strength",
      referenceId: "ref-pubmed-42141930"
    } as never);
    studyCreateMock.mockResolvedValue({ id: "study-42141930" } as never);
    studyUpdateMock.mockResolvedValue({ id: "study-existing" } as never);
    claimUpdateMock.mockResolvedValue({
      id: "creatine-strength",
      lastReviewedAt: reviewedAt,
      reviewStatus: DbReviewStatus.AI_REVIEWED
    } as never);
    claimScoreSnapshotFindFirstMock.mockResolvedValue({
      compositeScore: "8.1",
      finalLabel: DbEvidenceLabel.CORE_EVIDENCE_BASED,
      id: "previous-score-snapshot"
    } as never);
    claimScoreSnapshotCreateMock.mockResolvedValue({
      compositeScore: "8.4",
      finalLabel: DbEvidenceLabel.CORE_EVIDENCE_BASED,
      id: "score-snapshot"
    } as never);
    claimScoreHistoryCreateMock.mockResolvedValue({ id: "score-history" } as never);
    publicChangelogEntryCreateMock.mockResolvedValue({
      id: "changelog-entry"
    } as never);
    reviewEventCreateMock.mockResolvedValue({ id: "review-event" } as never);
    operatorAuditCreateMock.mockResolvedValue({ id: "audit-event" } as never);
  });

  it("fails closed before opening a transaction when operator writes are disabled", async () => {
    await expect(
      applyApprovedEvidenceDraftAsOperator(
        admin,
        {
          applyNote: "Apply reviewed evidence draft.",
          approvalId: "approval-1",
          draft: completeDraft()
        },
        {}
      )
    ).rejects.toMatchObject({
      message: "Operator writes are disabled.",
      status: 503
    });

    expect(transactionMock).not.toHaveBeenCalled();
    expect(claimReferenceUpsertMock).not.toHaveBeenCalled();
    expect(studyCreateMock).not.toHaveBeenCalled();
    expect(operatorAuditCreateMock).not.toHaveBeenCalled();
  });

  it("refuses incomplete source-packet drafts before opening a transaction", async () => {
    const draft = completeDraft({
      sourcePacketReadiness: {
        ...completeDraft().sourcePacketReadiness,
        status: "blocked"
      }
    });

    await expect(
      applyApprovedEvidenceDraftAsOperator(
        admin,
        {
          applyNote: "Apply reviewed evidence draft.",
          approvalId: "approval-1",
          draft
        },
        writesEnabled
      )
    ).rejects.toThrow(
      "Evidence draft is not ready for apply: source packet readiness is blocked."
    );

    expect(transactionMock).not.toHaveBeenCalled();
    expect(claimReferenceUpsertMock).not.toHaveBeenCalled();
    expect(studyCreateMock).not.toHaveBeenCalled();
  });

  it("requires complete study extraction fields before opening a transaction", async () => {
    const draft = completeDraft({
      fields: completeDraft().fields.filter(
        (field) => field.id !== "study-extraction.sampleSize"
      )
    });

    await expect(
      applyApprovedEvidenceDraftAsOperator(
        admin,
        {
          applyNote: "Apply reviewed evidence draft.",
          approvalId: "approval-1",
          draft
        },
        writesEnabled
      )
    ).rejects.toThrow("Approved evidence draft requires study-extraction.sampleSize.");

    expect(transactionMock).not.toHaveBeenCalled();
    expect(claimReferenceUpsertMock).not.toHaveBeenCalled();
    expect(studyCreateMock).not.toHaveBeenCalled();
  });

  it("refuses rejected candidates before opening a transaction", async () => {
    const draft = completeDraft({
      candidate: {
        ...completeDraft().candidate,
        decision: "Rejected"
      }
    });

    await expect(
      applyApprovedEvidenceDraftAsOperator(
        admin,
        {
          applyNote: "Apply reviewed evidence draft.",
          approvalId: "approval-1",
          draft
        },
        writesEnabled
      )
    ).rejects.toThrow("Evidence draft candidate must be accepted before apply.");

    expect(transactionMock).not.toHaveBeenCalled();
    expect(claimReferenceUpsertMock).not.toHaveBeenCalled();
    expect(studyCreateMock).not.toHaveBeenCalled();
  });

  it("refuses unreviewed candidate drafts before opening a transaction", async () => {
    const draft = completeDraft({
      candidate: {
        ...completeDraft().candidate,
        reviewStatus: "Unreviewed AI draft"
      }
    });

    await expect(
      applyApprovedEvidenceDraftAsOperator(
        admin,
        {
          applyNote: "Apply reviewed evidence draft.",
          approvalId: "approval-1",
          draft
        },
        writesEnabled
      )
    ).rejects.toThrow("Evidence draft candidate must be AI reviewed or Human reviewed.");

    expect(transactionMock).not.toHaveBeenCalled();
    expect(claimReferenceUpsertMock).not.toHaveBeenCalled();
    expect(studyCreateMock).not.toHaveBeenCalled();
  });

  it("refuses unknown draft fields before opening a transaction", async () => {
    const draft = completeDraft({
      fields: completeDraft().fields.map((field) =>
        field.id === "regulatory.au-product-boundary"
          ? {
              ...field,
              status: "unknown",
              unknownReason: "AU/TGA product boundary has not been reviewed."
            }
          : field
      )
    });

    await expect(
      applyApprovedEvidenceDraftAsOperator(
        admin,
        {
          applyNote: "Apply reviewed evidence draft.",
          approvalId: "approval-1",
          draft
        },
        writesEnabled
      )
    ).rejects.toThrow(
      "Evidence draft is not ready for apply: AU/TGA product boundary is unknown."
    );

    expect(transactionMock).not.toHaveBeenCalled();
    expect(claimReferenceUpsertMock).not.toHaveBeenCalled();
    expect(studyCreateMock).not.toHaveBeenCalled();
  });

  it("applies a ready draft through one transaction and records traceable review artifacts", async () => {
    await expect(
      applyApprovedEvidenceDraftAsOperator(
        admin,
        {
          applyNote: "Codex AI reviewed the evidence draft and preserved AU/TGA caveats.",
          approvalId: "approval-1",
          draft: completeDraft(),
          reviewedAt
        },
        writesEnabled
      )
    ).resolves.toEqual({
      approvalId: "approval-1",
      changelogEntryId: "changelog-entry",
      claimId: "creatine-strength",
      claimReference: {
        claimId: "creatine-strength",
        referenceId: "ref-pubmed-42141930"
      },
      draftId: "evidence-draft:pubmed:creatine:42141930",
      referenceId: "ref-pubmed-42141930",
      reviewStatus: "AI reviewed",
      scoreHistoryId: "score-history",
      scoreSnapshotId: "score-snapshot",
      studyId: "study-42141930"
    });

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(claimReferenceUpsertMock).toHaveBeenCalledWith({
      create: {
        claimId: "creatine-strength",
        note: "Codex AI reviewed the evidence draft and preserved AU/TGA caveats.",
        referenceId: "ref-pubmed-42141930",
        relevance: 5
      },
      update: {
        note: "Codex AI reviewed the evidence draft and preserved AU/TGA caveats.",
        relevance: 5
      },
      where: {
        claimId_referenceId: {
          claimId: "creatine-strength",
          referenceId: "ref-pubmed-42141930"
        }
      }
    });
    expect(studyCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adverseEvents: "No serious adverse events reported in the abstract.",
        fundingConflicts: "Public funding; no product-level inference.",
        interventionName: "Creatine monohydrate",
        outcomes: ["strength", "lean mass", "fatigue"],
        pmid: "42141930",
        referenceId: "ref-pubmed-42141930",
        relevanceScore: 5,
        riskOfBias: "Some performance outcome blinding limitations.",
        source: "PubMed",
        sourceType: DbStudyType.RANDOMIZED_CONTROLLED_TRIAL,
        title: "Creatine and resistance training",
        url: "https://pubmed.ncbi.nlm.nih.gov/42141930/",
        year: 2026
      })
    });
    expect(claimUpdateMock).toHaveBeenCalledWith({
      data: {
        lastReviewedAt: reviewedAt,
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
    expect(reviewEventCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorEmail: admin.email,
        actorUserId: admin.userId,
        claimId: "creatine-strength",
        entityId: "evidence-draft:pubmed:creatine:42141930",
        entityType: "EvidenceDraft",
        eventType: "AI_REVIEWED",
        metadata: expect.objectContaining({
          approvalId: "approval-1",
          noIndividualizedMedicalAdvice: true,
          noPeptideOperationalGuidance: true,
          noProductLevelTgaClearanceInferred: true,
          workflow: "evidenceDraft.applyApprovedDiff"
        }),
        note: "Codex AI reviewed the evidence draft and preserved AU/TGA caveats.",
        referenceId: "ref-pubmed-42141930",
        reviewStatus: DbReviewStatus.AI_REVIEWED,
        studyId: "study-42141930"
      })
    });
    expect(claimScoreSnapshotCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        claimId: "creatine-strength",
        compositeScore: 8.4,
        computedAt: reviewedAt,
        reviewStatus: DbReviewStatus.AI_REVIEWED,
        scoreVersion: "v1"
      })
    });
    expect(claimScoreHistoryCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        changedByUserId: admin.userId,
        claimId: "creatine-strength",
        newSnapshotId: "score-snapshot",
        previousSnapshotId: "previous-score-snapshot",
        reason: "MANUAL_REVIEW",
        referenceId: "ref-pubmed-42141930"
      })
    });
    expect(publicChangelogEntryCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        claimId: "creatine-strength",
        interventionId: "creatine",
        publishedAt: null,
        scoreHistoryId: "score-history",
        title: "Approved evidence draft applied"
      })
    });
    expect(operatorAuditCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "evidenceDraft.applyApprovedDiff",
        actorEmail: admin.email,
        afterSummary: expect.objectContaining({
          claimId: "creatine-strength",
          referenceId: "ref-pubmed-42141930",
          reviewStatus: DbReviewStatus.AI_REVIEWED,
          scoreHistoryId: "score-history",
          scoreSnapshotId: "score-snapshot",
          studyId: "study-42141930"
        }),
        metadata: expect.objectContaining({
          approvalId: "approval-1",
          changelogEntryId: "changelog-entry",
          noPublicChangelogPublication: true
        }),
        targetId: "evidence-draft:pubmed:creatine:42141930",
        targetType: "EvidenceDraft"
      })
    });
  });

  it("updates one existing study extraction instead of creating a duplicate study row", async () => {
    studyFindManyMock.mockResolvedValue([{ id: "study-existing" }] as never);

    await expect(
      applyApprovedEvidenceDraftAsOperator(
        admin,
        {
          applyNote: "Update the reviewed extraction.",
          approvalId: "approval-2",
          draft: completeDraft(),
          reviewedAt
        },
        writesEnabled
      )
    ).resolves.toMatchObject({
      studyId: "study-existing"
    });

    expect(studyUpdateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        referenceId: "ref-pubmed-42141930",
        sourceType: DbStudyType.RANDOMIZED_CONTROLLED_TRIAL
      }),
      where: {
        id: "study-existing"
      }
    });
    expect(studyCreateMock).not.toHaveBeenCalled();
  });

  it("aborts inside the transaction before writes when a reference has duplicate study rows", async () => {
    studyFindManyMock.mockResolvedValue([
      { id: "study-one" },
      { id: "study-two" }
    ] as never);

    await expect(
      applyApprovedEvidenceDraftAsOperator(
        admin,
        {
          applyNote: "Apply reviewed evidence draft.",
          approvalId: "approval-1",
          draft: completeDraft()
        },
        writesEnabled
      )
    ).rejects.toThrow(
      "Approved evidence draft reference has multiple study extractions; resolve manually before transaction apply."
    );

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(claimReferenceUpsertMock).not.toHaveBeenCalled();
    expect(studyCreateMock).not.toHaveBeenCalled();
    expect(studyUpdateMock).not.toHaveBeenCalled();
    expect(claimUpdateMock).not.toHaveBeenCalled();
    expect(reviewEventCreateMock).not.toHaveBeenCalled();
    expect(claimScoreSnapshotCreateMock).not.toHaveBeenCalled();
    expect(claimScoreHistoryCreateMock).not.toHaveBeenCalled();
    expect(publicChangelogEntryCreateMock).not.toHaveBeenCalled();
    expect(operatorAuditCreateMock).not.toHaveBeenCalled();
  });
});

function reviewableClaim() {
  return {
    evidenceDirectnessScore: 9,
    evidenceRigorScore: 9,
    effectSizeScore: 7,
    finalLabel: DbEvidenceLabel.CORE_EVIDENCE_BASED,
    hypePenalty: 2,
    id: "creatine-strength",
    interventionId: "creatine",
    lastReviewedAt: null,
    measurabilityScore: 9,
    productQualityScore: 4,
    regulatoryRiskScore: 1,
    reviewStatus: DbReviewStatus.UNREVIEWED_AI_DRAFT,
    safetyScore: 8
  };
}

function referenceRow() {
  return {
    id: "ref-pubmed-42141930",
    identifier: "42141930",
    source: "PubMed",
    title: "Creatine and resistance training",
    url: "https://pubmed.ncbi.nlm.nih.gov/42141930/",
    year: 2026
  };
}

function completeDraft(overrides: Partial<EvidenceDraftPacket> = {}): EvidenceDraftPacket {
  const draft: EvidenceDraftPacket = {
    blockers: [],
    candidate: {
      acceptedReferenceId: "ref-pubmed-42141930",
      claimId: "creatine-strength",
      decision: "Accepted",
      dedupeKey: "pubmed:creatine:42141930",
      externalId: "42141930",
      reviewStatus: "AI reviewed",
      source: "PubMed",
      title: "Creatine and resistance training",
      url: "https://pubmed.ncbi.nlm.nih.gov/42141930/"
    },
    confidence: {
      disposition: "recommend-accept",
      label: "Likely claim fit",
      rationale: ["Matched claim outcome and accepted reference."],
      score: 87
    },
    diffSnapshot: {
      humanOwned: true,
      noDatabaseWrite: true,
      noPublicEvidenceRowsWritten: true,
      readOnly: true,
      rows: [],
      summary: {
        blockedRows: 0,
        proposedRows: 12,
        totalRows: 12,
        unknownRows: 0
      }
    },
    draftId: "evidence-draft:pubmed:creatine:42141930",
    fields: completeDraftFields(),
    generatedAt: "2026-06-16T06:00:00.000Z",
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
    nextAction: "Review the complete proposed packet before applying.",
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
    readOnlyCommands: {},
    sourcePacketReadiness: {
      blockedSectionIds: [],
      blockerSummary: "All required source-packet draft sections are proposed.",
      clearBlockerList: [],
      humanOwned: true,
      nextHumanAction: "Review before explicit apply.",
      noPublicEvidenceRowsWritten: true,
      readOnly: true,
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
      requiredSectionIds: [
        "reference",
        "claim-link",
        "outcome-relevance",
        "study-extraction",
        "limitations",
        "safety",
        "regulatory",
        "confidence"
      ],
      sections: [],
      status: "complete-proposed-packet",
      writes: "none"
    },
    uncertaintyLabels: ["ai-reviewed-local-evidence-map"]
  };

  return {
    ...draft,
    ...overrides
  };
}

function completeDraftFields(): EvidenceDraftPacket["fields"] {
  return [
    draftField("reference.accepted", "Accepted reference", "ref-pubmed-42141930", [
      { id: "ref-pubmed-42141930", table: "Reference" }
    ]),
    draftField(
      "claim-link.target",
      "Claim link",
      "creatine-strength -> ref-pubmed-42141930",
      [{ field: "creatine-strength:ref-pubmed-42141930", table: "ClaimReference" }]
    ),
    draftField("study-extraction.sampleSize", "Sample size", "94 participants", [
      { field: "sampleSize", id: "ref-pubmed-42141930", table: "Study" }
    ]),
    draftField("study-extraction.population", "Population", "Resistance-trained adults", [
      { field: "population", id: "ref-pubmed-42141930", table: "Study" }
    ]),
    draftField(
      "study-extraction.interventionName",
      "Intervention",
      "Creatine monohydrate",
      [{ field: "interventionName", id: "ref-pubmed-42141930", table: "Study" }]
    ),
    draftField("study-extraction.outcomes", "Outcomes", "strength; lean mass | fatigue", [
      { field: "outcomes", id: "ref-pubmed-42141930", table: "Study" }
    ]),
    draftField(
      "study-extraction.adverseEvents",
      "Adverse events",
      "No serious adverse events reported in the abstract.",
      [{ field: "adverseEvents", id: "ref-pubmed-42141930", table: "Study" }]
    ),
    draftField(
      "study-extraction.fundingConflicts",
      "Funding conflicts",
      "Public funding; no product-level inference.",
      [{ field: "fundingConflicts", id: "ref-pubmed-42141930", table: "Study" }]
    ),
    draftField(
      "study-extraction.riskOfBias",
      "Risk of bias",
      "Some performance outcome blinding limitations.",
      [{ field: "riskOfBias", id: "ref-pubmed-42141930", table: "Study" }]
    ),
    draftField(
      "study-extraction.sourceType",
      "Study type",
      DbStudyType.RANDOMIZED_CONTROLLED_TRIAL,
      [{ field: "sourceType", id: "ref-pubmed-42141930", table: "Study" }]
    ),
    draftField(
      "limitations.no-overclaim",
      "Does not prove",
      "Does not prove product-level TGA clearance or individualized benefit.",
      [{ field: "limitations", table: "ReviewEvent" }]
    ),
    draftField(
      "regulatory.au-product-boundary",
      "AU/TGA product boundary",
      "Generic creatine evidence does not establish product-level ARTG/AUST status.",
      [{ field: "metadata.regulatory", table: "ReviewEvent" }]
    )
  ];
}

function draftField(
  id: string,
  label: string,
  value: string,
  targetRows: EvidenceDraftPacket["fields"][number]["targetRows"]
): EvidenceDraftPacket["fields"][number] {
  return {
    blockers: [],
    confidence: "strong",
    id,
    label,
    note: "Reviewed local evidence-map draft field.",
    provenance: [
      {
        label: "Test provenance",
        source: "promotion-readiness",
        value
      }
    ],
    reviewRequired: true,
    status: "proposed",
    targetRows,
    value
  };
}
