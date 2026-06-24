import {
  AustraliaRegulatoryKind as DbAustraliaRegulatoryKind,
  ConfidenceLevel as DbConfidenceLevel,
  EvidenceLabel as DbEvidenceLabel,
  EvidenceMomentum as DbEvidenceMomentum,
  InterventionCategory as DbInterventionCategory,
  OutcomeArea as DbOutcomeArea,
  OperatorRole,
  OperatorStatus,
  ReviewStatus as DbReviewStatus,
  SupplementOnboardingDraftStatus
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db/prisma";
import type { OperatorPrincipal } from "@/lib/operator/authorization";
import {
  getSupplementOnboardingDraftReviewSnapshot,
  importSupplementOnboardingDraftAsOperator,
  saveSupplementOnboardingDraftAsOperator
} from "@/lib/operator/supplement-onboarding-drafts";
import { buildSupplementOnboardingPlan } from "@/lib/supplement-onboarding";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (callback) =>
      callback({
        australiaRegulatoryStatus: {
          create: vi.fn()
        },
        claim: {
          createMany: vi.fn()
        },
        intervention: {
          create: vi.fn()
        },
        supplementOnboardingDraft: {
          update: vi.fn()
        }
      })
    ),
    australiaRegulatoryStatus: {
      findMany: vi.fn()
    },
    claim: {
      findMany: vi.fn()
    },
    intervention: {
      findMany: vi.fn()
    },
    operatorAuditEvent: {
      create: vi.fn()
    },
    supplementOnboardingDraft: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn()
    }
  }
}));

const transactionMock = vi.mocked(prisma.$transaction);
const findRegulatoryStatusesMock = vi.mocked(prisma.australiaRegulatoryStatus.findMany);
const findClaimsMock = vi.mocked(prisma.claim.findMany);
const findInterventionsMock = vi.mocked(prisma.intervention.findMany);
const findManyDraftsMock = vi.mocked(prisma.supplementOnboardingDraft.findMany);
const findDraftMock = vi.mocked(prisma.supplementOnboardingDraft.findUnique);
const upsertDraftMock = vi.mocked(prisma.supplementOnboardingDraft.upsert);
const auditCreateMock = vi.mocked(prisma.operatorAuditEvent.create);

const admin: OperatorPrincipal = {
  email: "admin@example.test",
  role: OperatorRole.ADMIN,
  status: OperatorStatus.ACTIVE,
  userId: "user-admin"
};

const writesEnabled = {
  APEX_OPERATOR_WRITES_ENABLED: "true"
};

const importEnabled = {
  ...writesEnabled,
  APEX_ONBOARDING_DATABASE_IMPORT_ENABLED: "true",
  APEX_ONBOARDING_DATABASE_IMPORT_REVIEWED_AT: "2026-06-13T01:00:00Z"
};

function transactionClient() {
  return {
    australiaRegulatoryStatus: {
      create: vi.fn()
    },
    claim: {
      createMany: vi.fn()
    },
    intervention: {
      create: vi.fn()
    },
    supplementOnboardingDraft: {
      update: vi.fn()
    }
  };
}

describe("operator supplement onboarding drafts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditCreateMock.mockResolvedValue({ id: "audit-1" } as never);
    findRegulatoryStatusesMock.mockResolvedValue([]);
    findClaimsMock.mockResolvedValue([]);
    findInterventionsMock.mockResolvedValue([]);
    findManyDraftsMock.mockResolvedValue([]);
    findDraftMock.mockResolvedValue(null);
    transactionMock.mockImplementation(async (callback) => callback(transactionClient() as never));
    upsertDraftMock.mockResolvedValue({
      blockingReviewItems: [],
      createdAt: new Date("2026-06-12T10:00:00.000Z"),
      guardrailWarnings: [],
      id: "draft-1",
      name: "Magnesium glycinate",
      slug: "magnesium-glycinate",
      status: SupplementOnboardingDraftStatus.DRAFT,
      updatedAt: new Date("2026-06-12T10:00:00.000Z")
    } as never);
  });

  it("creates a private draft and records an audit event", async () => {
    await expect(
      saveSupplementOnboardingDraftAsOperator(
        admin,
        {
          category: "Vitamin/mineral",
          claimTemplateIds: ["sleep", "safety"],
          commonForms: ["capsule"],
          generatedAt: new Date("2026-06-12T10:00:00.000Z"),
          name: "Magnesium glycinate",
          note: "Initial operator draft.",
          product: {
            austNumber: "AUST L 123456",
            brand: "Example Brand",
            name: "Example Magnesium Glycinate",
            sourceUrl: "https://example.test/artg-product",
            sponsor: "Example Sponsor Pty Ltd"
          },
          region: "AU",
          synonyms: ["magnesium"]
        },
        writesEnabled
      )
    ).resolves.toEqual({
      action: "created",
      blockingReviewItems: [],
      claimCount: 2,
      createdAt: "2026-06-12T10:00:00.000Z",
      guardrailWarnings: [],
      id: "draft-1",
      name: "Magnesium glycinate",
      slug: "magnesium-glycinate",
      status: "DRAFT",
      updatedAt: "2026-06-12T10:00:00.000Z"
    });

    expect(upsertDraftMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          category: DbInterventionCategory.VITAMIN_MINERAL,
          createdByEmail: admin.email,
          createdByUserId: admin.userId,
          name: "Magnesium glycinate",
          region: "AU",
          slug: "magnesium-glycinate",
          status: SupplementOnboardingDraftStatus.DRAFT
        }),
        update: expect.objectContaining({
          category: DbInterventionCategory.VITAMIN_MINERAL,
          name: "Magnesium glycinate",
          region: "AU",
          status: SupplementOnboardingDraftStatus.DRAFT
        }),
        where: {
          slug: "magnesium-glycinate"
        }
      })
    );
    expect(upsertDraftMock.mock.calls[0][0].create).not.toHaveProperty(
      "interventionId"
    );
    expect(upsertDraftMock.mock.calls[0][0].create.input).toEqual(
      expect.objectContaining({
        product: {
          austNumber: "AUST L 123456",
          brand: "Example Brand",
          name: "Example Magnesium Glycinate",
          sourceUrl: "https://example.test/artg-product",
          sponsor: "Example Sponsor Pty Ltd"
        }
      })
    );
    expect(upsertDraftMock.mock.calls[0][0].create.plan).toEqual(
      expect.objectContaining({
        productStatusAssistant: expect.objectContaining({
          target: expect.objectContaining({
            austNumber: "AUST L 123456",
            brand: "Example Brand",
            name: "Example Magnesium Glycinate"
          })
        })
      })
    );
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "supplementOnboarding.draftSaved",
          actorEmail: admin.email,
          actorRole: OperatorRole.ADMIN,
          metadata: expect.objectContaining({
            noPublicEvidenceRowsWritten: true,
            productStatusTarget: expect.objectContaining({
              austNumber: "AUST L 123456",
              brand: "Example Brand",
              name: "Example Magnesium Glycinate"
            })
          }),
          note: "Initial operator draft.",
          targetId: "magnesium-glycinate",
          targetType: "SupplementOnboardingDraft"
        })
      })
    );
  });

  it("updates an existing draft and fails closed when writes are disabled", async () => {
    findDraftMock.mockResolvedValue({
      blockingReviewItems: ["Review category."],
      guardrailWarnings: ["Guardrail."],
      id: "draft-1",
      name: "Magnesium glycinate",
      status: SupplementOnboardingDraftStatus.DRAFT,
      updatedAt: new Date("2026-06-12T09:00:00.000Z")
    } as never);

    await expect(
      saveSupplementOnboardingDraftAsOperator(
        admin,
        {
          category: "Vitamin/mineral",
          claimTemplateIds: ["sleep"],
          generatedAt: new Date("2026-06-12T10:00:00.000Z"),
          name: "Magnesium glycinate"
        },
        writesEnabled
      )
    ).resolves.toMatchObject({
      action: "updated",
      slug: "magnesium-glycinate"
    });
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          beforeSummary: expect.objectContaining({
            name: "Magnesium glycinate",
            updatedAt: "2026-06-12T09:00:00.000Z"
          })
        })
      })
    );

    vi.clearAllMocks();

    await expect(
      saveSupplementOnboardingDraftAsOperator(
        admin,
        {
          name: "Magnesium glycinate"
        },
        {}
      )
    ).rejects.toMatchObject({
      message: "Operator writes are disabled.",
      status: 503
    });
    expect(upsertDraftMock).not.toHaveBeenCalled();
    expect(auditCreateMock).not.toHaveBeenCalled();
  });

  it("returns a read-only saved draft review snapshot with import-plan status", async () => {
    const plan = buildSupplementOnboardingPlan({
      category: "Botanical/herbal",
      claimTemplateIds: ["mood-stress"],
      generatedAt: new Date("2026-06-12T10:00:00.000Z"),
      name: "Saffron"
    });
    findManyDraftsMock.mockResolvedValue([
      {
        blockingReviewItems: plan.blockingReviewItems,
        createdByEmail: admin.email,
        guardrailWarnings: plan.guardrailWarnings,
        id: "draft-1",
        name: plan.interventionDraft.name,
        plan,
        slug: plan.interventionDraft.slug,
        status: SupplementOnboardingDraftStatus.DRAFT,
        updatedAt: new Date("2026-06-12T10:00:00.000Z")
      }
    ] as never);

    await expect(
      getSupplementOnboardingDraftReviewSnapshot(
        3,
        new Date("2026-06-12T10:30:00.000Z")
      )
    ).resolves.toMatchObject({
      generatedAt: "2026-06-12T10:30:00.000Z",
      humanOwned: true,
      limit: 3,
      noAutoPromotion: true,
      noAutoWrite: true,
      noDatabaseWrite: true,
      noPublicEvidenceRowsWritten: true,
      readOnly: true,
      rows: [
        {
          claimCount: 1,
          createdByEmail: admin.email,
          databaseImportAction: expect.objectContaining({
            blockerCount: 0,
            claimCount: 1,
            enabledWhenGateSatisfied: true,
            importedRowPreview: {
              australiaRegulatoryStatuses: 1,
              claims: 1,
              interventions: 1
            },
            noAutoPromotion: true,
            noCandidateDecision: true,
            noClaimReview: true,
            noConnectorApproval: true,
            noExtractionWrite: true,
            noFullTextFetch: true,
            permission: "onboarding:import",
            requiresImportNote: true,
            requiresOperatorBrowserGate: true,
            status: "review-required",
            supportedNow: true
          }),
          draftStatus: SupplementOnboardingDraftStatus.DRAFT,
          id: "draft-1",
          importPlan: expect.objectContaining({
            databaseImport: expect.objectContaining({
              status: "not-yet-enabled",
              supportedNow: false
            }),
            noAutoPromotion: true,
            noAutoWrite: true,
            noDatabaseWrite: true,
            noPublicEvidenceRowsWritten: true,
            recommendedPath: "manual-seed-copy",
            status: "review-required"
          }),
          name: "Saffron",
          privateDraft: true,
          readOnly: true,
          slug: "saffron",
          updatedAt: "2026-06-12T10:00:00.000Z"
        }
      ],
      summary: {
        databaseImportBlocked: 0,
        databaseImportReady: 0,
        databaseImportReviewRequired: 1,
        databaseImportSupported: true,
        drafts: 1,
        readyForManualSeedCopy: 0,
        reviewRequired: 1
      }
    });
    expect(findManyDraftsMock).toHaveBeenCalledWith({
      orderBy: {
        updatedAt: "desc"
      },
      select: {
        blockingReviewItems: true,
        createdByEmail: true,
        guardrailWarnings: true,
        id: true,
        name: true,
        plan: true,
        slug: true,
        status: true,
        updatedAt: true
      },
      take: 3
    });
    expect(findInterventionsMock).toHaveBeenCalledWith({
      select: {
        id: true
      },
      where: {
        id: {
          in: ["saffron"]
        }
      }
    });
    expect(findClaimsMock).toHaveBeenCalledWith({
      select: {
        id: true
      },
      where: {
        id: {
          in: ["saffron-mood-stress"]
        }
      }
    });
    expect(findRegulatoryStatusesMock).toHaveBeenCalledWith({
      select: {
        id: true
      },
      where: {
        id: {
          in: ["saffron-au-status"]
        }
      }
    });
  });

  it("blocks unreadable saved draft plans without running import writes", async () => {
    findManyDraftsMock.mockResolvedValue([
      {
        blockingReviewItems: ["Saved plan is incomplete."],
        createdByEmail: admin.email,
        guardrailWarnings: [],
        id: "draft-bad",
        name: "Broken draft",
        plan: {
          interventionDraft: {
            id: "broken"
          }
        },
        slug: "broken-draft",
        status: SupplementOnboardingDraftStatus.DRAFT,
        updatedAt: new Date("2026-06-12T10:00:00.000Z")
      }
    ] as never);

    const snapshot = await getSupplementOnboardingDraftReviewSnapshot();

    expect(snapshot.summary.blocked).toBe(1);
    expect(snapshot.rows[0]).toMatchObject({
      claimCount: 0,
      databaseImportAction: {
        blockerCount: 1,
        claimCount: 0,
        enabledWhenGateSatisfied: false,
        importedRowPreview: {
          australiaRegulatoryStatuses: 1,
          claims: 0,
          interventions: 1
        },
        noAutoPromotion: true,
        noCandidateDecision: true,
        noClaimReview: true,
        noConnectorApproval: true,
        noExtractionWrite: true,
        noFullTextFetch: true,
        permission: "onboarding:import",
        requiresImportNote: true,
        requiresOperatorBrowserGate: true,
        status: "blocked",
        supportedNow: true,
        warnings: []
      },
      importPlan: {
        noAutoWrite: true,
        noDatabaseWrite: true,
        noPublicEvidenceRowsWritten: true,
        recommendedPath: "resolve-blockers",
        status: "blocked"
      },
      nextAction:
        "Re-save this private draft from the operator wizard before seed copy review."
    });
  });

  it("keeps database import disabled unless the dedicated import gate is reviewed", async () => {
    await expect(
      importSupplementOnboardingDraftAsOperator(
        admin,
        {
          draftId: "draft-1",
          importNote: "Reviewed import readiness."
        },
        writesEnabled
      )
    ).rejects.toMatchObject({
      message: "Supplement onboarding database import is disabled.",
      status: 503
    });

    expect(transactionMock).not.toHaveBeenCalled();
    expect(auditCreateMock).not.toHaveBeenCalled();
  });

  it("blocks database import when draft record ids already exist", async () => {
    const plan = buildSupplementOnboardingPlan({
      category: "Vitamin/mineral",
      claimTemplateIds: ["sleep"],
      generatedAt: new Date("2026-06-12T10:00:00.000Z"),
      name: "Magnesium glycinate"
    });
    findDraftMock.mockResolvedValue({
      blockingReviewItems: plan.blockingReviewItems,
      guardrailWarnings: plan.guardrailWarnings,
      id: "draft-1",
      name: plan.interventionDraft.name,
      plan,
      slug: plan.interventionDraft.slug,
      status: SupplementOnboardingDraftStatus.DRAFT,
      updatedAt: new Date("2026-06-12T10:00:00.000Z")
    } as never);
    findInterventionsMock.mockResolvedValue([{ id: "magnesium-glycinate" }] as never);

    await expect(
      importSupplementOnboardingDraftAsOperator(
        admin,
        {
          draftId: "draft-1",
          importNote: "Reviewed import readiness."
        },
        importEnabled
      )
    ).rejects.toThrow("Intervention id already exists in database: magnesium-glycinate.");

    expect(transactionMock).not.toHaveBeenCalled();
    expect(auditCreateMock).not.toHaveBeenCalled();
  });

  it("imports a reviewed draft into unreviewed database rows and audits the action", async () => {
    const plan = buildSupplementOnboardingPlan({
      category: "Vitamin/mineral",
      claimTemplateIds: ["sleep"],
      generatedAt: new Date("2026-06-12T10:00:00.000Z"),
      name: "Magnesium glycinate"
    });
    const tx = transactionClient();
    transactionMock.mockImplementation(async (callback) => callback(tx as never));
    findDraftMock.mockResolvedValue({
      blockingReviewItems: plan.blockingReviewItems,
      guardrailWarnings: plan.guardrailWarnings,
      id: "draft-1",
      name: plan.interventionDraft.name,
      plan,
      slug: plan.interventionDraft.slug,
      status: SupplementOnboardingDraftStatus.DRAFT,
      updatedAt: new Date("2026-06-12T10:00:00.000Z")
    } as never);

    await expect(
      importSupplementOnboardingDraftAsOperator(
        admin,
        {
          draftId: "draft-1",
          importedAt: new Date("2026-06-13T01:23:45.000Z"),
          importNote: "Reviewed draft import; keep claims unreviewed."
        },
        importEnabled
      )
    ).resolves.toMatchObject({
      action: "imported",
      claimCount: 1,
      claimIds: ["magnesium-glycinate-sleep"],
      draftId: "draft-1",
      draftStatus: "READY_FOR_REVIEW",
      importedAt: "2026-06-13T01:23:45.000Z",
      interventionId: "magnesium-glycinate",
      noAutoPromotion: true,
      noCandidateDecision: true,
      noClaimReview: true,
      noConnectorApproval: true,
      noExtractionWrite: true,
      noFullTextFetch: true,
      regulatoryStatusId: "magnesium-glycinate-au-status"
    });

    expect(tx.intervention.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        category: DbInterventionCategory.VITAMIN_MINERAL,
        id: "magnesium-glycinate",
        lastReviewedAt: null,
        name: "Magnesium glycinate",
        slug: "magnesium-glycinate"
      })
    });
    expect(tx.claim.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          claimText: "Sleep quality or sleep-continuity support.",
          confidenceLevel: DbConfidenceLevel.VERY_LOW,
          evidenceDirectnessScore: 1,
          evidenceRigorScore: 1,
          finalLabel: DbEvidenceLabel.INSUFFICIENT_EVIDENCE,
          id: "magnesium-glycinate-sleep",
          interventionId: "magnesium-glycinate",
          momentum: DbEvidenceMomentum.STABLE,
          outcome: DbOutcomeArea.SLEEP,
          reviewStatus: DbReviewStatus.UNREVIEWED_AI_DRAFT
        })
      ]
    });
    expect(tx.australiaRegulatoryStatus.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        checkedAt: new Date("2026-06-13T01:23:45.000Z"),
        efficacyAssessed: false,
        id: "magnesium-glycinate-au-status",
        intervention: {
          connect: {
            id: "magnesium-glycinate"
          }
        },
        kind: DbAustraliaRegulatoryKind.UNKNOWN,
        preMarketAssessment: false,
        region: "AU"
      })
    });
    expect(tx.supplementOnboardingDraft.update).toHaveBeenCalledWith({
      data: {
        status: SupplementOnboardingDraftStatus.READY_FOR_REVIEW
      },
      where: {
        id: "draft-1"
      }
    });
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "supplementOnboarding.databaseImport",
          actorEmail: admin.email,
          metadata: expect.objectContaining({
            noAutoPromotion: true,
            noCandidateDecision: true,
            noClaimReview: true,
            noConnectorApproval: true,
            noExtractionWrite: true,
            noFullTextFetch: true
          }),
          note: "Reviewed draft import; keep claims unreviewed.",
          targetId: "draft-1",
          targetType: "SupplementOnboardingDraft"
        })
      })
    );
  });
});
