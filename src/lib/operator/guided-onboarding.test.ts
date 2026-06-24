import { SupplementOnboardingDraftStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { buildOperatorGuidedOnboardingWorkflowSnapshot } from "@/lib/operator/guided-onboarding";
import type { OperatorOnboardingQualitySnapshot } from "@/lib/operator/onboarding-quality";
import type { SupplementOnboardingDraftReviewSnapshot } from "@/lib/operator/supplement-onboarding-drafts";
import { getSourceConvictionRubric } from "@/lib/source-conviction";

describe("operator guided onboarding workflow", () => {
  it("combines saved private drafts with source workflow next actions", () => {
    const snapshot = buildOperatorGuidedOnboardingWorkflowSnapshot({
      generatedAt: new Date("2026-06-13T10:00:00.000Z"),
      quality: qualitySnapshot(),
      savedDrafts: savedDraftSnapshot()
    });

    expect(snapshot).toMatchObject({
      generatedAt: "2026-06-13T10:00:00.000Z",
      humanOwned: true,
      nextAction:
        "Complete manual copy review, then copy accepted snippets into src/lib/seed-data.ts and run validation.",
      noAutoPromotion: true,
      noAutoReview: true,
      noAutoWrite: true,
      noCandidateDecision: true,
      noDatabaseWrite: true,
      noExtractionWrite: true,
      noPublicEvidenceRowsWritten: true,
      readOnly: true,
      summary: {
        batchReviewKitSteps: 0,
        currentSteps: 1,
        privateDraftSteps: 1,
        readySteps: 1,
        steps: 3,
        waitingSteps: 1
      }
    });
    expect(snapshot.steps).toContainEqual(
      expect.objectContaining({
        command:
          'npm run onboarding:import-assistant -- --name "Magnesium glycinate" --summary',
        label: "Private draft review",
        noDatabaseWrite: true,
        stage: "private-draft-review",
        status: "current",
        target: "Magnesium glycinate"
      })
    );
    expect(snapshot.steps).toContainEqual(
      expect.objectContaining({
        command: "npm run promotion:readiness -- --summary",
        label: "Ready check",
        stage: "ready",
        target: "Creatine"
      })
    );
    expect(snapshot.steps).toContainEqual(
      expect.objectContaining({
        command: "npm run onboarding:fulltext-sources -- --summary",
        label: "Full-text source gate",
        status: "waiting"
      })
    );
  });

  it("adds batch review-kit guidance when several private drafts are visible", () => {
    const savedDrafts = savedDraftSnapshot();
    savedDrafts.rows.push({
      ...savedDrafts.rows[0],
      id: "draft-2",
      name: "Zinc picolinate",
      slug: "zinc-picolinate"
    });
    savedDrafts.summary.drafts = 2;
    savedDrafts.summary.reviewRequired = 2;
    const snapshot = buildOperatorGuidedOnboardingWorkflowSnapshot({
      generatedAt: new Date("2026-06-13T10:00:00.000Z"),
      quality: qualitySnapshot(),
      savedDrafts
    });

    expect(snapshot.summary).toMatchObject({
      batchReviewKitSteps: 1,
      currentSteps: 3,
      privateDraftSteps: 2,
      steps: 5
    });
    expect(snapshot.steps).toContainEqual(
      expect.objectContaining({
        command:
          "npm run onboard:supplement -- --batch-file <reviewed-batch-json> --write-review-kit",
        label: "Batch review kit",
        noCandidateDecision: true,
        noDatabaseWrite: true,
        noExtractionWrite: true,
        noAutoPromotion: true,
        stage: "batch-review-kit",
        status: "current",
        target: "Local batch review"
      })
    );
    expect(
      snapshot.steps.find((step) => step.stage === "batch-review-kit")?.rationale
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("The command writes only local review artifacts"),
        expect.stringContaining("npm run onboarding:packet -- --supplements")
      ])
    );
  });

  it("adds full-text fixture follow-up previews when connector prep is ready", () => {
    const quality = qualitySnapshot();
    quality.fullTextNextAction = {
      ...quality.fullTextNextAction,
      commands: [
        {
          command:
            "npm run onboarding:fulltext-fixture -- --fixture-dir docs/codex/onboarding/fulltext-fixtures --progress --summary",
          id: "check-fixture-progress",
          label: "Check fixture starter progress",
          mode: "read-only",
          purpose:
            "Summarize generated local fixture starter states without reading from live sources."
        },
        {
          command:
            "npm run onboarding:fulltext-fixture -- --fixture-file docs/codex/onboarding/fulltext-fixtures/pmc-open-access.local.json --summary",
          id: "validate-fixture-starter",
          label: "Validate local fixture starter",
          mode: "read-only",
          purpose:
            "Check the generated local fixture starter after reviewed local values are filled."
        },
        {
          command:
            "npm run onboarding:fulltext-fixture -- --fixture-file docs/codex/onboarding/fulltext-fixtures/pmc-open-access.local.json --extraction-draft --candidate-key <accepted-candidate-dedupe-key> --study-source-type randomized-controlled-trial --summary",
          id: "draft-fixture-extraction",
          label: "Preview fixture extraction draft",
          mode: "read-only",
          purpose:
            "Map reviewed local fixture fields into a command draft without writing extraction rows."
        }
      ],
      selectedSource: {
        approvalWarnings: [],
        connectorReviewStatus: "ready-for-review",
        id: "pmc-open-access",
        label: "PubMed Central Open Access subset",
        missingRequiredFields: [],
        progressStatus: "ready-for-connector-review",
        tier: "start-here"
      },
      status: "open-connector-review"
    };
    const snapshot = buildOperatorGuidedOnboardingWorkflowSnapshot({
      generatedAt: new Date("2026-06-13T10:00:00.000Z"),
      quality
    });

    expect(snapshot.summary).toMatchObject({
      fixturePreviewSteps: 3,
      steps: 5
    });
    expect(snapshot.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command:
            "npm run onboarding:fulltext-fixture -- --fixture-dir docs/codex/onboarding/fulltext-fixtures --progress --summary",
          label: "Fixture progress",
          noCandidateDecision: true,
          noExtractionWrite: true,
          noPublicEvidenceRowsWritten: true,
          stage: "full-text-fixture-progress",
          status: "current",
          target: "PubMed Central Open Access subset"
        }),
        expect.objectContaining({
          label: "Fixture validation",
          stage: "full-text-fixture-validation",
          status: "waiting"
        }),
        expect.objectContaining({
          label: "Fixture extraction draft",
          stage: "full-text-fixture-extraction-draft",
          status: "waiting"
        })
      ])
    );
  });
});

function savedDraftSnapshot(): SupplementOnboardingDraftReviewSnapshot {
  return {
    generatedAt: "2026-06-13T10:00:00.000Z",
    humanOwned: true,
    limit: 5,
    noAutoPromotion: true,
    noAutoWrite: true,
    noDatabaseWrite: true,
    noPublicEvidenceRowsWritten: true,
    readOnly: true,
    rows: [
      {
        blockerCount: 0,
        claimCount: 1,
        createdByEmail: "admin@example.test",
        databaseImportAction: {
          blockerCount: 0,
          blockers: [],
          claimCount: 1,
          claimIds: ["magnesium-glycinate-sleep"],
          enabledWhenGateSatisfied: true,
          importedRowPreview: {
            australiaRegulatoryStatuses: 1,
            claims: 1,
            interventions: 1
          },
          interventionId: "magnesium-glycinate",
          nextAction:
            "Review warnings, confirm draft public visibility is acceptable, then use the approved operator import action with an import note.",
          noAutoPromotion: true,
          noCandidateDecision: true,
          noClaimReview: true,
          noConnectorApproval: true,
          noExtractionWrite: true,
          noFullTextFetch: true,
          permission: "onboarding:import",
          publicVisibilityWarning:
            "Database-backed public dashboards may display imported rows as unreviewed draft claims; import only after accepting that draft status, uncertainty labels, and AU/TGA Unknown framing are appropriate.",
          regulatoryStatusId: "magnesium-glycinate-au-status",
          requiresImportNote: true,
          requiresOperatorBrowserGate: true,
          status: "review-required",
          supportedNow: true,
          warnings: [
            "1 AU/TGA product-status gap(s) remain; keep regulatory kind Unknown until reviewed."
          ]
        },
        draftStatus: SupplementOnboardingDraftStatus.DRAFT,
        id: "draft-1",
        importPlan: {
          databaseImport: {
            nextAction:
              "Keep saved operator drafts private for now; a future database import action must be separately implemented, operator-approved, audited, and reviewed before it can create intervention or claim rows.",
            noImportCommand: true,
            requiredFutureApproval:
              "Explicit authenticated operator database-import implementation and review.",
            status: "not-yet-enabled",
            supportedNow: false
          },
          nextAction:
            "Complete manual copy review, then copy accepted snippets into src/lib/seed-data.ts and run validation. Database import remains not yet enabled.",
          noAutoPromotion: true,
          noAutoWrite: true,
          noDatabaseWrite: true,
          noPublicEvidenceRowsWritten: true,
          recommendedPath: "manual-seed-copy",
          seedCopy: {
            nextAction:
              "Complete manual copy review, then copy accepted snippets into src/lib/seed-data.ts and run validation.",
            operations: [],
            reviewRequired: true,
            status: "review-required",
            targetPath: "src/lib/seed-data.ts"
          },
          status: "review-required",
          validationCommands: ["npm run db:validate"]
        },
        name: "Magnesium glycinate",
        nextAction:
          "Complete manual copy review, then copy accepted snippets into src/lib/seed-data.ts and run validation.",
        privateDraft: true,
        readOnly: true,
        slug: "magnesium-glycinate",
        updatedAt: "2026-06-13T10:00:00.000Z",
        warningCount: 1
      }
    ],
    summary: {
      blocked: 0,
      databaseImportBlocked: 0,
      databaseImportReady: 0,
      databaseImportReviewRequired: 1,
      databaseImportSupported: true,
      drafts: 1,
      readyForManualSeedCopy: 0,
      reviewRequired: 1
    }
  };
}

function qualitySnapshot(): OperatorOnboardingQualitySnapshot {
  return {
    dataSource: "seed",
    fullTextConnectorApproval: {
      approvalGranted: false,
      generatedAt: "2026-06-13T10:00:00.000Z",
      humanOwned: true,
      nextAction: "Terms URL is incomplete.",
      noAutoApproval: true,
      noConnectorApproval: true,
      noImplementationApproval: true,
      noLiveFetch: true,
      noNetworkFetch: true,
      readOnly: true,
      rows: [],
      summary: {
        blockedSources: 1,
        holdSources: 0,
        readyForApprovalSources: 0,
        sources: 1
      }
    },
    fullTextConnectorReview: {
      generatedAt: "2026-06-13T10:00:00.000Z",
      humanOwned: true,
      nextAction: "Terms URL is incomplete.",
      noAutoApproval: true,
      noConnectorApproval: true,
      noLiveFetch: true,
      readOnly: true,
      rows: [],
      summary: {
        blockedSources: 1,
        holdSources: 0,
        readyForReviewSources: 0,
        sources: 1
      }
    },
    fullTextNextAction: {
      commands: [],
      generatedAt: "2026-06-13T10:00:00.000Z",
      humanOwned: true,
      inventoryFilePath: "docs/codex/onboarding/fulltext-source-inventory.local.json",
      inventoryFileProvided: false,
      nextAction: "Create a user-owned full-text source inventory.",
      noAutoApproval: true,
      noConnectorApproval: true,
      noLiveFetch: true,
      readOnly: true,
      selectedSource: undefined,
      status: "create-inventory-template",
      summary: {
        blockedSources: 1,
        changedSources: 0,
        connectorReadyForReviewSources: 0,
        inProgressSources: 0,
        notStartedSources: 1,
        prematureApprovalSources: 0,
        readyForConnectorReviewSources: 0,
        sources: 1
      }
    },
    fullTextProgress: {
      generatedAt: "2026-06-13T10:00:00.000Z",
      humanOwned: true,
      liveCaptureReady: false,
      nextAction: "Start from the worksheet or template.",
      noAutoApproval: true,
      noLiveFetch: true,
      readOnly: true,
      rows: [],
      summary: {
        changedSources: 0,
        inProgressSources: 0,
        notStartedSources: 1,
        prematureApprovalSources: 0,
        readyForConnectorReviewSources: 0,
        sources: 1
      }
    },
    fullTextSources: {
      blocked: [],
      counts: {
        blockedSources: 1,
        dryRunSupportedSources: 0,
        holdSources: 0,
        liveApprovedSources: 0,
        startHereSources: 1,
        sources: 1
      },
      fixtureContract: {
        derivedOnly: true,
        fields: ["title", "population", "intervention", "outcomes"],
        nextAction: "Use operator-provided local fixtures.",
        rawTextStored: false,
        status: "ready",
        supportedInput: "operator-local-fixture"
      },
      generatedAt: "2026-06-13T10:00:00.000Z",
      liveCaptureReady: false,
      nextAction: "Review source terms before live capture.",
      readOnly: true,
      reviewQueue: []
    },
    generatedAt: "2026-06-13T10:00:00.000Z",
    humanOwned: true,
    monitor: {
      generatedAt: "2026-06-13T10:00:00.000Z",
      globalIssues: [
        {
          command: "npm run onboarding:fulltext-sources -- --next --summary",
          count: 1,
          detail:
            "1 full-text source class(es) remain blocked; no live full-text connector is approved.",
          kind: "full-text-gate-blocked",
          label: "Full-text source gate",
          nextAction:
            "Review source terms, access, retention, and derived-only export before any connector implementation.",
          severity: "warning"
        }
      ],
      humanOwned: true,
      nextAction:
        "Review source terms, access, retention, and derived-only export before any connector implementation.",
      noAutoPromotion: true,
      noAutoReview: true,
      noAutoWrite: true,
      noCandidateDecision: true,
      noDatabaseWrite: true,
      noExtractionWrite: true,
      noPublicEvidenceRowsWritten: true,
      readOnly: true,
      rows: [
        {
          humanOwned: true,
          issues: [],
          nextAction:
            "Keep this supplement in periodic source, safety, and product-status monitoring.",
          noAutoPromotion: true,
          noAutoReview: true,
          noAutoWrite: true,
          noCandidateDecision: true,
          noDatabaseWrite: true,
          noExtractionWrite: true,
          noPublicEvidenceRowsWritten: true,
          oldestReviewEvidenceDate: "2026-06-13",
          readOnly: true,
          refreshPolicy: {
            intervalDays: 365,
            rationale: [
              "Routine reviewed supplement packets start with a 365-day refresh interval."
            ],
            tier: "routine"
          },
          reviewAgeDays: 0,
          staleAfterDays: 365,
          status: "ready",
          supplement: {
            category: "Amino acid",
            id: "creatine-monohydrate",
            name: "Creatine",
            slug: "creatine"
          }
        }
      ],
      staleAfterDays: 365,
      summary: {
        actionNeededSupplements: 0,
        extractionGapSupplements: 0,
        fullTextGateBlocked: true,
        globalIssues: 1,
        highAttentionCadenceSupplements: 0,
        missingProductStatusSupplements: 0,
        pendingCandidateSupplements: 0,
        promotionReadySupplements: 0,
        readySupplements: 1,
        routineCadenceSupplements: 1,
        safetySignalSupplements: 0,
        sourceTrackingUnavailable: false,
        staleReviewSupplements: 0,
        supplements: 1,
        unknownProductStatusSupplements: 0,
        unreviewedClaimSupplements: 0,
        watchCadenceSupplements: 0,
        watchSupplements: 0
      }
    },
    nextAction: "Ready for explicit operator-owned review or promotion checks.",
    priorityQueue: [],
    readOnly: true,
    rows: [
      {
        blockers: [],
        counts: {
          acceptedCandidates: 1,
          claims: 2,
          pendingCandidates: 0,
          rejectedCandidates: 0,
          reviewedCandidates: 1,
          reviewedClaims: 2,
          safetySignals: 0,
          sourceCandidates: 1,
          sourceJobs: 1
        },
        convictionDistribution: {
          high: 1,
          low: 0,
          moderate: 0,
          unscored: 0,
          veryLow: 0
        },
        nextAction: "Ready for explicit operator-owned review or promotion checks.",
        promotion: {
          blockedClaims: 0,
          blockers: [],
          readyClaims: 2,
          totalClaims: 2
        },
        reviewPacketAutopilot: {
          blockedBySafety: 0,
          nextAction: "No pending candidates remain.",
          noAutoAccept: true,
          noAutoExtraction: true,
          noAutoPromotion: true,
          noAutoReject: true,
          readyNoPendingCandidates: 2,
          reviewPendingCandidate: 0,
          summarizeLimitations: 0
        },
        reviewPacketDecision: {
          holdOrReject: 0,
          needsMoreEvidence: 0,
          readyForHumanReview: 2
        },
        reviewPacketDiff: {
          publicWordingChanges: 0,
          referenceLinkChanges: 0,
          scoreChanges: 0,
          uncertaintyLabelChanges: 0
        },
        sourcePacket: {
          completeClaims: 2,
          extractionPendingClaims: 0,
          extractedReferences: 2,
          missingReferences: 0,
          missingSourceClaims: 0,
          pendingReferences: 0,
          totalReferences: 2,
          unlinkedClaims: 0
        },
        states: {
          candidates: "found",
          draft: "reviewed",
          extraction: "complete",
          promotion: "ready",
          queue: "completed",
          reviewPacket: "complete"
        },
        status: "ready",
        supplement: {
          category: "Amino acid",
          id: "creatine-monohydrate",
          name: "Creatine",
          slug: "creatine"
        },
        warnings: []
      }
    ],
    sourceConvictionRubric: getSourceConvictionRubric(),
    sourceTracking: {
      status: "available"
    },
    summary: {
      acceptedCandidates: 1,
      blockedSupplements: 0,
      candidates: 1,
      extractionCompleteClaims: 2,
      pendingCandidates: 0,
      promotionBlockedClaims: 0,
      promotionReadyClaims: 2,
      queuedJobs: 0,
      readySupplements: 1,
      reviewedCandidates: 1,
      reviewedClaims: 2,
      safetySignals: 0,
      sourceJobs: 1,
      supplements: 1,
      totalClaims: 2,
      warningSupplements: 0
    }
  };
}
