import { describe, expect, it } from "vitest";

import {
  buildSupplementOnboardingNextActionReport,
  summarizeSupplementOnboardingNextActionReport
} from "@/lib/supplement-onboarding-next-action";
import { getSourceConvictionRubric } from "@/lib/source-conviction";
import type {
  SupplementOnboardingQualityDashboard,
  SupplementOnboardingQualityRow
} from "@/lib/supplement-onboarding-quality";

describe("supplement onboarding next action", () => {
  it("routes supplements with missing claim scopes to the dry-run draft helper", () => {
    const report = buildSupplementOnboardingNextActionReport({
      dashboard: qualityDashboard([
        qualityRow({
          counts: {
            claims: 0
          },
          states: {
            draft: "missing-claims"
          },
          status: "blocked"
        })
      ])
    });

    expect(report.rows[0]).toMatchObject({
      action: "Draft and review claim scopes before queueing source discovery.",
      command:
        'npm run onboard:supplement -- --name "Magnesium" --category "Vitamin/mineral"',
      noAutoPromotion: true,
      noAutoWrite: true,
      readOnly: true,
      stage: "draft-claims"
    });
  });

  it("previews source queueing without adding the apply flag", () => {
    const report = buildSupplementOnboardingNextActionReport({
      dashboard: qualityDashboard([
        qualityRow({
          states: {
            queue: "missing"
          },
          status: "blocked"
        })
      ])
    });

    expect(report.rows[0]).toMatchObject({
      command: 'npm run onboarding:queue-sources -- --supplement "magnesium"',
      stage: "queue-sources"
    });
    expect(report.rows[0]?.command).not.toContain("--apply");
  });

  it("prioritizes pending candidate review before extraction or promotion", () => {
    const report = buildSupplementOnboardingNextActionReport({
      dashboard: qualityDashboard([
        qualityRow({
          counts: {
            pendingCandidates: 2,
            sourceCandidates: 2
          },
          states: {
            candidates: "found",
            extraction: "partial",
            queue: "completed"
          },
          status: "blocked"
        })
      ])
    });

    expect(report.rows[0]).toMatchObject({
      command:
        "npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 10",
      stage: "review-candidates"
    });
  });

  it("keeps ready supplements on read-only promotion readiness", () => {
    const report = buildSupplementOnboardingNextActionReport({
      dashboard: qualityDashboard([
        qualityRow({
          counts: {
            reviewedClaims: 1
          },
          promotion: {
            blockedClaims: 0,
            readyClaims: 1
          },
          states: {
            candidates: "found",
            draft: "reviewed",
            extraction: "complete",
            promotion: "ready",
            queue: "completed",
            reviewPacket: "complete"
          },
          status: "ready"
        })
      ])
    });

    expect(report.rows[0]).toMatchObject({
      command: "npm run promotion:readiness -- --summary",
      noAutoPromotion: true,
      stage: "ready"
    });
  });

  it("surfaces global source tracking and full-text gates in summaries", () => {
    const report = buildSupplementOnboardingNextActionReport({
      dashboard: qualityDashboard([], {
        sourceTracking: {
          status: "unavailable",
          unavailableReason: "database-backed source tracking is unavailable"
        }
      })
    });
    const summary = summarizeSupplementOnboardingNextActionReport(report);

    expect(summary.globalActions).toEqual([
      expect.objectContaining({
        command:
          "npm run onboarding:quality -- --env-file <non-production-env-file> --summary",
        stage: "source-tracking-gate"
      }),
      expect.objectContaining({
        command: "npm run onboarding:fulltext-sources -- --summary",
        stage: "full-text-source-gate"
      })
    ]);
    expect(summary).toMatchObject({
      noAutoPromotion: true,
      noAutoWrite: true,
      readOnly: true
    });
  });

  it("filters rows by supplement slug", () => {
    const report = buildSupplementOnboardingNextActionReport({
      dashboard: qualityDashboard([
        qualityRow(),
        qualityRow({
          supplement: {
            id: "creatine-monohydrate",
            name: "Creatine",
            slug: "creatine"
          }
        })
      ]),
      supplementQuery: "creatine"
    });

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]?.supplement.id).toBe("creatine-monohydrate");
  });
});

function qualityDashboard(
  rows: SupplementOnboardingQualityRow[],
  overrides: Partial<SupplementOnboardingQualityDashboard> = {}
): SupplementOnboardingQualityDashboard {
  return {
    dataSource: "database",
    fullTextConnectorApproval: {
      approvalGranted: false,
      generatedAt: "2026-06-12T00:00:00.000Z",
      humanOwned: true,
      nextAction:
        "Complete source review and connector planning before preparing approval.",
      noAutoApproval: true,
      noConnectorApproval: true,
      noImplementationApproval: true,
      noLiveFetch: true,
      noNetworkFetch: true,
      readOnly: true,
      rows: [],
      summary: {
        blockedSources: 0,
        holdSources: 0,
        readyForApprovalSources: 0,
        sources: 0
      }
    },
    fullTextNextAction: {
      commands: [
        {
          command:
            "npm run onboarding:fulltext-sources -- --write-template docs/codex/onboarding/fulltext-source-inventory.local.json",
          id: "write-inventory-template",
          label: "Create source inventory template",
          mode: "local-file-write",
          purpose:
            "Write a user-owned inventory starter with all approvals false and no live fetch enabled."
        }
      ],
      generatedAt: "2026-06-12T00:00:00.000Z",
      humanOwned: true,
      inventoryFilePath: "docs/codex/onboarding/fulltext-source-inventory.local.json",
      inventoryFileProvided: false,
      nextAction:
        "Create a user-owned full-text source inventory from the safe template, then fill one source worksheet before rerunning the gate.",
      noAutoApproval: true,
      noConnectorApproval: true,
      noLiveFetch: true,
      readOnly: true,
      selectedSource: {
        approvalWarnings: [],
        connectorReviewStatus: "blocked",
        id: "pmc-open-access",
        label: "PubMed Central Open Access subset",
        missingRequiredFields: ["Terms URL"],
        progressStatus: "not-started",
        tier: "start-here"
      },
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
    fullTextSources: {
      blocked: [
        {
          blockers: ["Terms URL is missing."],
          id: "pmc-open-access",
          label: "PubMed Central Open Access subset",
          nextAction: "Terms URL is missing."
        }
      ],
      counts: {
        blockedSources: 1,
        dryRunSupportedSources: 1,
        holdSources: 0,
        liveApprovedSources: 0,
        startHereSources: 1,
        sources: 1
      },
      fixtureContract: {
        derivedOnly: true,
        fields: [],
        nextAction: "Use local fixtures.",
        rawTextStored: false,
        status: "ready",
        supportedInput: "operator-local-fixture"
      },
      generatedAt: "2026-06-12T00:00:00.000Z",
      liveCaptureReady: false,
      nextAction: "Terms URL is missing.",
      readOnly: true,
      reviewQueue: [
        {
          convictionScore: 55,
          id: "pmc-open-access",
          label: "PubMed Central Open Access subset",
          limitations: ["Terms URL is missing."],
          missingRequiredFields: ["Terms URL"],
          nextAction: "Terms URL is missing.",
          positiveFactors: ["High-repute biomedical source class."],
          reviewPriority: 10,
          sourceReputation: "high",
          tier: "start-here"
        }
      ]
    },
    generatedAt: "2026-06-12T00:00:00.000Z",
    humanOwned: true,
    nextAction: "Review onboarding next action.",
    priorityQueue: rows.map((row, index) => ({
      action: row.nextAction,
      blockers: row.blockers.length,
      category: row.supplement.category,
      claims: row.counts.claims,
      id: row.supplement.id,
      name: row.supplement.name,
      pendingCandidates: row.counts.pendingCandidates,
      priority: index + 1,
      promotionReadyClaims: row.promotion.readyClaims,
      rationale: [`${row.status} onboarding status.`],
      safetySignals: row.counts.safetySignals,
      slug: row.supplement.slug,
      status: row.status,
      tier: row.status === "blocked" ? "blocked-setup" : "monitor",
      warnings: row.warnings.length
    })),
    readOnly: true,
    rows,
    sourceConvictionRubric: getSourceConvictionRubric(),
    sourceTracking: {
      status: "available"
    },
    summary: {
      acceptedCandidates: 0,
      blockedSupplements: 0,
      candidates: 0,
      extractionCompleteClaims: 0,
      pendingCandidates: 0,
      promotionBlockedClaims: 0,
      promotionReadyClaims: 0,
      queuedJobs: 0,
      readySupplements: 0,
      reviewedCandidates: 0,
      reviewedClaims: 0,
      safetySignals: 0,
      sourceJobs: 0,
      supplements: rows.length,
      totalClaims: 0,
      warningSupplements: 0
    },
    ...overrides,
    monitor: overrides.monitor ?? monitorDashboard(rows)
  };
}

function monitorDashboard(rows: SupplementOnboardingQualityRow[]) {
  return {
    generatedAt: "2026-06-12T00:00:00.000Z",
    globalIssues: [],
    humanOwned: true as const,
    nextAction:
      "Continue periodic monitor checks; no post-onboarding maintenance issue is currently visible.",
    noAutoPromotion: true as const,
    noAutoReview: true as const,
    noAutoWrite: true as const,
    noCandidateDecision: true as const,
    noDatabaseWrite: true as const,
    noExtractionWrite: true as const,
    noPublicEvidenceRowsWritten: true as const,
    readOnly: true as const,
    rows: rows.map((row) => ({
      humanOwned: true as const,
      issues: [],
      nextAction:
        "Keep this supplement in periodic source, safety, and product-status monitoring.",
      noAutoPromotion: true as const,
      noAutoReview: true as const,
      noAutoWrite: true as const,
      noCandidateDecision: true as const,
      noDatabaseWrite: true as const,
      noExtractionWrite: true as const,
      noPublicEvidenceRowsWritten: true as const,
      readOnly: true as const,
      refreshPolicy: {
        intervalDays: 365,
        rationale: [
          "Routine reviewed supplement packets start with a 365-day refresh interval."
        ],
        tier: "routine" as const
      },
      staleAfterDays: 365,
      status: "ready" as const,
      supplement: row.supplement
    })),
    staleAfterDays: 365,
    summary: {
      actionNeededSupplements: 0,
      extractionGapSupplements: 0,
      fullTextGateBlocked: false,
      globalIssues: 0,
      highAttentionCadenceSupplements: 0,
      missingProductStatusSupplements: 0,
      pendingCandidateSupplements: 0,
      promotionReadySupplements: 0,
      readySupplements: rows.length,
      routineCadenceSupplements: rows.length,
      safetySignalSupplements: 0,
      sourceTrackingUnavailable: false,
      staleReviewSupplements: 0,
      supplements: rows.length,
      unknownProductStatusSupplements: 0,
      unreviewedClaimSupplements: 0,
      watchCadenceSupplements: 0,
      watchSupplements: 0
    }
  };
}

function qualityRow(
  overrides: Omit<
    Partial<SupplementOnboardingQualityRow>,
    "counts" | "promotion" | "sourcePacket" | "states" | "supplement"
  > & {
    counts?: Partial<SupplementOnboardingQualityRow["counts"]>;
    promotion?: Partial<SupplementOnboardingQualityRow["promotion"]>;
    reviewPacketAutopilot?: Partial<SupplementOnboardingQualityRow["reviewPacketAutopilot"]>;
    reviewPacketDecision?: Partial<SupplementOnboardingQualityRow["reviewPacketDecision"]>;
    sourcePacket?: Partial<SupplementOnboardingQualityRow["sourcePacket"]>;
    states?: Partial<SupplementOnboardingQualityRow["states"]>;
    supplement?: Partial<SupplementOnboardingQualityRow["supplement"]>;
  } = {}
): SupplementOnboardingQualityRow {
  return {
    blockers: [],
    counts: {
      acceptedCandidates: 0,
      claims: 1,
      pendingCandidates: 0,
      rejectedCandidates: 0,
      reviewedCandidates: 0,
      reviewedClaims: 0,
      safetySignals: 0,
      sourceCandidates: 0,
      sourceJobs: 0,
      ...overrides.counts
    },
    convictionDistribution: {
      high: 0,
      low: 0,
      moderate: 0,
      unscored: 0,
      veryLow: 0
    },
    nextAction: "Review onboarding.",
    promotion: {
      blockedClaims: 1,
      blockers: [],
      readyClaims: 0,
      totalClaims: 1,
      ...overrides.promotion
    },
    reviewPacketDiff: {
      publicWordingChanges: 0,
      referenceLinkChanges: 0,
      scoreChanges: 0,
      uncertaintyLabelChanges: 0
    },
    reviewPacketDecision: {
      holdOrReject: 0,
      needsMoreEvidence: 1,
      readyForHumanReview: 0,
      ...overrides.reviewPacketDecision
    },
    reviewPacketAutopilot: {
      blockedBySafety: 0,
      nextAction:
        "Open the recommended candidate curation draft, then explicitly accept or reject it after source review.",
      noAutoAccept: true,
      noAutoExtraction: true,
      noAutoPromotion: true,
      noAutoReject: true,
      readyNoPendingCandidates: 0,
      reviewPendingCandidate: 1,
      summarizeLimitations: 0,
      ...overrides.reviewPacketAutopilot
    },
    sourcePacket: {
      completeClaims: 0,
      extractionPendingClaims: 0,
      extractedReferences: 0,
      missingReferences: 0,
      missingSourceClaims: 0,
      pendingReferences: 0,
      totalReferences: 0,
      unlinkedClaims: 0,
      ...overrides.sourcePacket
    },
    status: overrides.status ?? "blocked",
    states: {
      candidates: "missing",
      draft: "drafted",
      extraction: "missing",
      promotion: "blocked",
      queue: "missing",
      reviewPacket: "missing",
      ...overrides.states
    },
    supplement: {
      category: "Vitamin/mineral",
      id: "magnesium",
      name: "Magnesium",
      slug: "magnesium",
      ...overrides.supplement
    },
    warnings: []
  };
}
